
"use client";
import Shell from "../dashboard/Shell";
import { useEffect, useMemo, useRef, useState } from "react";

// 固定月费（按工作日分摊）
const MONTH_PRICE = 920;

type Expense = { id:string; date:string; description:string; amount:number; handler?:string; week_number?:number; attachments?:Array<{url:string,name?:string}> };

export default function FinancePage(){
  const [date,setDate]=useState(()=> new Date().toISOString().slice(0,10));
  const [desc,setDesc]=useState("");
  const [amount,setAmount]=useState("");
  const [handler,setHandler]=useState("");
  const [files,setFiles]=useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement|null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [showExpense, setShowExpense] = useState<boolean>(false);
  const [payRefreshKey, setPayRefreshKey] = useState<number>(0);

  const ym = useMemo(()=>{ const d=new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; },[date]);
  const [items,setItems]=useState<Expense[]>([]);
  const [weekly,setWeekly]=useState<Array<{week_number:number,amount_sum:number}>>([]);

  async function fetchList(){
    const r = await fetch(`/api/expenses?month=${ym}`);
    const j = await r.json();
    const serverItems: Expense[] = j.items || [];
    // 合并本地兜底存储
    try{
      const localKey = `expenses_local_${ym}`;
      const localRaw = localStorage.getItem(localKey);
      const localItems: Expense[] = localRaw ? JSON.parse(localRaw) : [];
      // 去重：以 id 为主，local 可能没有 id
      const map = new Map<string, Expense>();
      [...serverItems, ...localItems].forEach((it) => {
        const k = String(it.id);
        if(!map.has(k)) map.set(k, it);
      });
      setItems(Array.from(map.values()));
    }catch{
      setItems(serverItems);
    }
  }
  async function fetchWeekly(){
    const r = await fetch(`/api/expenses/weekly?month=${ym}`);
    const j = await r.json();
    setWeekly(j.items||[]);
  }

  useEffect(()=>{ fetchList(); fetchWeekly(); },[ym]);

  // 计算 ISO 周编号，格式与后端一致：YYYYWW
  function isoWeekNumberFromString(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map((v) => parseInt(v));
    const dt = new Date(Date.UTC(y, m - 1, d));
    const day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return dt.getUTCFullYear() * 100 + week;
  }

  const currentWeekNumber = useMemo(() => isoWeekNumberFromString(date), [date]);
  const weekRange = useMemo(() => {
    const dt = new Date(date);
    const day = dt.getDay(); // 0 Sun - 6 Sat
    const diffToMonday = (day + 6) % 7; // Monday=0
    const start = new Date(dt);
    start.setDate(dt.getDate() - diffToMonday);
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23,59,59,999);
    const toStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { startStr: toStr(start), endStr: toStr(end) };
  }, [date]);
  const currentWeekSpend = useMemo(() => {
    return items.reduce((sum, it) => {
      if (!it?.date) return sum;
      try {
        const wk = isoWeekNumberFromString(it.date);
        if (wk === currentWeekNumber) return sum + Number(it.amount || 0);
      } catch {}
      return sum;
    }, 0);
  }, [items, currentWeekNumber]);

  // 以客户端数据即时计算“本月每周支出汇总”（避免 Cookie 被浏览器拦截导致为空）
  const weeklyView = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((it) => {
      if (!it?.date || !String(it.date).startsWith(ym + '-')) return;
      const wk = isoWeekNumberFromString(it.date);
      map[wk] = (map[wk] || 0) + Number(it.amount || 0);
    });
    return Object.keys(map)
      .sort()
      .map((k) => ({ week_number: Number(k), amount_sum: map[k] }));
  }, [items, ym]);

  // 将 ISO 周编号转换为“几月几号-几号”的显示
  function isoWeekRangeLabel(weekNumber: number): string {
    const year = Math.floor(weekNumber / 100);
    const week = weekNumber % 100;
    // 找到第1周的周一（包含1月4日的那一周）
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const day = jan4.getUTCDay() || 7; // 1..7，周一=1
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - day + 1);
    // 目标周的周一
    const start = new Date(week1Monday);
    start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    const fmt = (d: Date) => `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
    return `${fmt(start)}-${fmt(end)}`;
  }

  // Generate preview URLs for selected images
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [files]);

  async function onAdd(){
    // 将文件转成可持久显示的 Data URL，便于直接在页面中展示
    async function fileToDataUrl(file: File): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    const dataUrls = await Promise.all(files.map(fileToDataUrl));
    const attachments = files.map((f, i) => ({ url: dataUrls[i], name: f.name }));
    const payload={ date, description:desc, amount:parseFloat(amount||'0'), handler, attachments };
    // 先本地插入，提升可见性
    const tempId = `local-${Date.now()}`;
    const localItem: Expense = { id: tempId, date, description: desc, amount: payload.amount, handler, attachments } as any;
    setItems((prev)=> [localItem, ...prev]);
    try{
      const localKey = `expenses_local_${ym}`;
      const localRaw = localStorage.getItem(localKey);
      const list: Expense[] = localRaw ? JSON.parse(localRaw) : [];
      list.unshift(localItem);
      localStorage.setItem(localKey, JSON.stringify(list));
    }catch{}

    // 后台持久化
    const r = await fetch('/api/expenses',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    if(r.ok){ setDesc(""); setAmount(""); setHandler(""); setFiles([]); inputRef.current && (inputRef.current.value=""); await fetchWeekly(); }
  }

  async function onDelete(it: Expense){
    // 先从 UI 删除
    setItems((prev)=> prev.filter(x=> x !== it));
    try{
      const localKey = `expenses_local_${ym}`;
      const localRaw = localStorage.getItem(localKey);
      const list: Expense[] = localRaw ? JSON.parse(localRaw) : [];
      const next = list.filter(x=> x.id !== it.id);
      localStorage.setItem(localKey, JSON.stringify(next));
    }catch{}

    // 后端删除（如果有 id）
    try{
      await fetch(`/api/expenses?id=${encodeURIComponent(String(it.id))}&month=${ym}`, { method: 'DELETE' });
    }catch{}
  }

  return (
    <Shell>
      <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold text-neutral-800 mb-4">财务 · 支出与结算</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MonthlySummary ym={ym} expenseItems={items} refreshKey={payRefreshKey} />
      </div>

        <div className="ui-card rounded-xl p-5 mt-4">
        <div className="text-lg font-bold mb-3">本月每周支出汇总</div>
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50"><tr><th className="px-4 py-2 text-left">周编号</th><th className="px-4 py-2 text-left">支出金额</th></tr></thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {weeklyView.length===0 && <tr><td className="px-4 py-3 text-sm text-muted" colSpan={2}>本月暂无支出</td></tr>}
            {weeklyView.map(w=> (
              <tr key={w.week_number}>
                <td className="px-4 py-2">{isoWeekRangeLabel(w.week_number)}</td>
                <td className="px-4 py-2">¥{Number(w.amount_sum||0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ui-card rounded-xl p-5 mt-4">
        <button className="w-full flex items-center justify-between mb-3" onClick={()=>setShowExpense(s=>!s)}>
          <div className="text-lg font-bold">支出记录</div>
          <span className="text-muted text-sm">{showExpense? '收起' : '展开'}</span>
        </button>
        {showExpense && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-start">
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border rounded px-3 py-2" />
          <div className="relative md:col-span-1">
            <input
              type="text"
              placeholder="描述"
              value={desc}
              onChange={e=>setDesc(e.target.value)}
              className="border rounded w-full px-3 py-2 pr-10 h-[40px]"
            />
            <button
              type="button"
              onClick={()=> inputRef.current?.click() }
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border border-neutral-300 text-neutral-600 grid place-content-center hover:bg-neutral-100"
              aria-label="添加图片"
            >
              +
            </button>
            <input
              type="file"
              accept="image/*"
              multiple
              ref={inputRef}
              onChange={(e)=> setFiles(Array.from(e.target.files||[]))}
              className="hidden"
            />
            {previews.length>0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {previews.map((src,idx)=> (
                  <img key={idx} src={src} alt="预览" className="h-10 w-10 object-cover rounded border cursor-pointer" onClick={()=> setViewerSrc(src)} />
                ))}
              </div>
            )}
          </div>
          <input placeholder="金额" value={amount} onChange={e=>setAmount(e.target.value)} className="border rounded px-3 py-2" />
          <input placeholder="经手人" value={handler} onChange={e=>setHandler(e.target.value)} className="border rounded px-3 py-2" />
          <button className="badge badge-primary w-full h-[40px] flex items-center justify-center" onClick={onAdd}>添加支出</button>
        </div>
        )}
      </div>

      {showExpense && (
      <div className="ui-card rounded-xl p-5 mt-4">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-2 text-left">日期</th>
              <th className="px-4 py-2 text-left">描述</th>
              <th className="px-4 py-2 text-left">金额</th>
              <th className="px-4 py-2 text-left">经手人</th>
              <th className="px-4 py-2 text-right w-24">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {items.length===0 && <tr><td className="px-4 py-3 text-sm text-muted" colSpan={4}>暂无支出记录</td></tr>}
            {items.map(it=> (
              <tr key={it.id}>
                <td className="px-4 py-2">{it.date}</td>
                <td className="px-4 py-2">
                  <div>{it.description}</div>
                  {Array.isArray(it.attachments) && it.attachments.length>0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {it.attachments
                        .map((a)=> a && a.url ? a : null)
                        .filter((a): a is {url:string,name?:string} => !!a && /^(data:|https?:|\/)/.test(a.url))
                        .map((a,idx)=> (
                          <img
                            key={idx}
                            src={a.url}
                            alt={a.name||'附件'}
                            className="h-10 w-10 object-cover rounded border cursor-pointer"
                            onClick={()=> setViewerSrc(a.url)}
                          />
                        ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2">¥{Number(it.amount||0).toFixed(2)}</td>
                <td className="px-4 py-2">{it.handler||''}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-red-500 text-red-600 hover:bg-red-50 active:scale-95 transition select-none"
                    onClick={()=> onDelete(it)}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      <PayStatsCard onChange={()=> setPayRefreshKey(k=>k+1)} />
      {viewerSrc && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
          onClick={()=> setViewerSrc(null)}
        >
          <img src={viewerSrc} className="max-w-[90vw] max-h-[90vh] object-contain shadow-2xl" />
        </div>
      )}
    </Shell>
  );
}

// 简易图片预览层挂在页面底部
export function ImageViewer({ src, onClose }: { src: string; onClose: () => void }){
  if(!src) return null as any;
  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <img src={src} className="max-w-[90vw] max-h-[90vh] object-contain shadow-2xl" />
    </div>
  );
}

// 右侧卡片：本月预测/洞察
function MonthInsights({ ym, items, weekStart, weekEnd }: { ym: string; items: Expense[]; weekStart: string; weekEnd: string }){
  const monthTotal = useMemo(() => items
    .filter(it => typeof it.date === 'string' && it.date.startsWith(ym + '-'))
    .reduce((s, it) => s + Number(it.amount || 0), 0), [items, ym]);

  // 平均每日
  const daysInMonth = useMemo(() => {
    const [y, m] = ym.split('-').map(v => parseInt(v));
    return new Date(y, m, 0).getDate();
  }, [ym]);
  const dailyAvg = monthTotal / Math.max(daysInMonth, 1);

  // 最高支出日
  const topDay = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach(it => {
      if (!it.date || !it.date.startsWith(ym + '-')) return;
      map[it.date] = (map[it.date] || 0) + Number(it.amount || 0);
    });
    let maxKey = '';
    let maxVal = 0;
    Object.keys(map).forEach(k => { if (map[k] > maxVal) { maxVal = map[k]; maxKey = k; } });
    return { date: maxKey, amount: maxVal };
  }, [items, ym]);

  // 根据成员缴费合成“本周预算”：统计当前月份所有成员的缴费金额之和
  const weeklyBudget = useMemo(() => {
    // 读取 API cookies 兜底或实时接口（简单方案：直接调用接口同步读取一次）
    // 这里不阻塞渲染，初始显示 0，由下方 Effect 尝试异步更新
    return 0;
  }, [ym]);

  return (
    <div className="space-y-1 text-sm">
      <WeeklyBudget ym={ym} weekStart={weekStart} weekEnd={weekEnd} />
      <div className="flex justify-between"><span className="text-muted">本月累计</span><span className="font-semibold">¥{monthTotal.toFixed(2)}</span></div>
      <div className="flex justify-between"><span className="text-muted">日均支出</span><span>¥{dailyAvg.toFixed(2)}</span></div>
      {topDay.date && (
        <div className="flex justify-between"><span className="text-muted">最高支出日</span><span>{topDay.date} · ¥{topDay.amount.toFixed(2)}</span></div>
      )}
    </div>
  );
}

// 月预算/支出/结余 + 明细
function MonthlySummary({ ym, expenseItems, refreshKey }: { ym: string; expenseItems: Expense[]; refreshKey: number }){
  const [budget, setBudget] = useState(0);
  const [details, setDetails] = useState<Array<{name:string; amount:number; coverage:string; from?:string|null; to?:string|null}>>([]);
  const [open, setOpen] = useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const [y, m] = ym.split('-').map(v=>parseInt(v));
        const [payRes, memRes] = await Promise.all([
          fetch(`/api/members/pay?year=${y}&month=${m}`),
          fetch('/api/members')
        ]);
        const pay = await payRes.json();
        const mem = await memRes.json();
        const id2name: Record<string,string> = {};
        (mem.items||[]).forEach((x: any)=>{ id2name[x.id]=x.name; });

        const isWorkday = (d:Date)=>{ const k=d.getDay(); return k>=1 && k<=5; };
        const monthWorkdays = (yy:number, mm:number)=>{ const first=new Date(yy,mm-1,1,12,0,0); const last=new Date(yy,mm,0,12,0,0); let c=0; const d=new Date(first); while(d<=last){ if(isWorkday(d)) c++; d.setDate(d.getDate()+1);} return c; };
        const countWorkdays = (a:Date,b:Date)=>{ let c=0; const d=new Date(a); const end=new Date(b); while(d<=end){ if(isWorkday(d)) c++; d.setDate(d.getDate()+1);} return c; };
        const toDate = (s:string)=>{ const [yy,mm,dd]=s.split('-').map(Number); return new Date(yy,mm-1,dd,12,0,0); };
        const thisA = new Date(y, m-1, 1, 12,0,0); const thisB = new Date(y, m, 0, 12,0,0);
        const clamp = (x:Date, a:Date, b:Date)=> new Date(Math.min(Math.max(x.getTime(), a.getTime()), b.getTime()));

        let total=0; const det: Array<{name:string; amount:number; coverage:string; from?:string|null; to?:string|null}> = [];
        (pay.items||[]).forEach((it:any)=>{
          if(!it.paid) return;
          let add = 0;
          if(it.coverage === 'month'){
            // 整月：直接使用录入金额（默认 920）
            add = Math.round(Number(it.amount ?? MONTH_PRICE) || 0);
          } else if(it.coverage === 'range' && it.from_date && it.to_date){
            // 区间：按工作日比例分摊到本月
            const amt = Number(it.amount || 0) || 0;
            if (amt > 0) {
              const s = toDate(String(it.from_date));
              const e = toDate(String(it.to_date));
              const totalDays = countWorkdays(s,e);
              if (totalDays > 0) {
                const ia = clamp(s, thisA, thisB);
                const ib = clamp(e, thisA, thisB);
                if (ia <= ib) {
                  const overlap = countWorkdays(ia, ib);
                  add = Math.round(amt * (overlap / totalDays));
                }
              }
            }
          }
          if(add>0){ total += add; det.push({ name: id2name[it.member_id]||it.member_id, amount: add, coverage: it.coverage||'-', from: it.from_date||null, to: it.to_date||null }); }
        });
        setBudget(total);
        setDetails(det.sort((a,b)=> b.amount-a.amount));
      }catch{}
    })();
  },[ym, refreshKey]);

  const expenseTotal = useMemo(()=> expenseItems
    .filter(e=> typeof e.date==='string' && e.date.startsWith(ym+'-'))
    .reduce((s,e)=> s + Number(e.amount||0), 0), [expenseItems, ym]);
  const balance = useMemo(()=> budget - expenseTotal, [budget, expenseTotal]);

  return (
    <div className="ui-card rounded-xl p-5 md:col-span-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div><div className="text-muted text-sm">月预算</div><div className="text-2xl font-bold">¥{Math.round(budget)}</div></div>
        <div><div className="text-muted text-sm">支出</div><div className="text-2xl font-bold">¥{expenseTotal.toFixed(2)}</div></div>
        <div><div className="text-muted text-sm">结余</div><div className="text-2xl font-bold">¥{Math.round(balance)}</div></div>
      </div>
      <div className="mt-3">
        <button className="badge badge-muted" onClick={()=> setOpen(o=>!o)}>{open? '收起明细' : '预算明细'}</button>
      </div>
      {open && (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50"><tr><th className="px-3 py-2 text-left">姓名</th><th className="px-3 py-2 text-left">方式</th><th className="px-3 py-2 text-left">区间</th><th className="px-3 py-2 text-right">计入本月</th></tr></thead>
            <tbody>
              {details.length===0 && <tr><td colSpan={4} className="px-3 py-3 text-muted text-center">本月暂无预算</td></tr>}
              {details.map((d,i)=> (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="px-3 py-2">{d.name}</td>
                  <td className="px-3 py-2">{d.coverage==='month'?'整月':'区间'}</td>
                  <td className="px-3 py-2">{d.coverage==='range'? `${d.from} ~ ${d.to}` : '-'}</td>
                  <td className="px-3 py-2 text-right">¥{Math.round(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// 成员缴费统计组件
function PayStatsCard({ onChange }: { onChange?: ()=>void }){
  const [open, setOpen] = useState<boolean>(false);
  return (
    <div className="ui-card rounded-xl p-5 mt-4">
      <button className="w-full flex items-center justify-between" onClick={()=>setOpen(o=>!o)}>
        <div className="text-lg font-bold">成员缴费统计（本月）</div>
        <span className="text-muted text-sm">{open? '收起' : '展开'}</span>
      </button>
      {open && (
        <div className="mt-3">
          <PayStats onChange={onChange} />
        </div>
      )}
    </div>
  );
}

// 读取成员缴费金额，展示“本周预算”
function WeeklyBudget({ ym, weekStart, weekEnd }: { ym: string; weekStart: string; weekEnd: string }){
  const [sum, setSum] = useState<number>(0);
  useEffect(()=>{
    (async()=>{
      try{
        const [y, m] = ym.split('-').map(v=>parseInt(v));
        const r = await fetch(`/api/members/pay?year=${y}&month=${m}`);
        const j = await r.json();
        // 按天分摊（固定月费 920）：每日金额 = 920 / 当月工作日数，求本周覆盖到的工作日的总额
        const toDate = (s:string)=>{ const [yy,mm,dd]=s.split('-').map(n=>parseInt(n)); return new Date(yy,mm-1,dd,12,0,0); };
        const isWorkday = (d:Date)=>{ const k=d.getDay(); return k>=1 && k<=5; };
        const countWorkdays = (a:Date,b:Date)=>{ const d=new Date(a); d.setHours(12,0,0,0); const end=new Date(b); end.setHours(12,0,0,0); let c=0; while(d<=end){ if(isWorkday(d)) c++; d.setDate(d.getDate()+1);} return c; };
        const monthWorkdays = (yy:number, mm:number)=>{ const first=new Date(yy,mm-1,1,12,0,0); const last=new Date(yy,mm,0,12,0,0); return countWorkdays(first,last); };
        const clamp = (x:Date, a:Date, b:Date)=> new Date(Math.min(Math.max(x.getTime(), a.getTime()), b.getTime()));

        const weekA = toDate(weekStart); const weekB = toDate(weekEnd);

        const total = (j.items||[]).reduce((s:any,it:any)=>{
          if(!it.paid) return s;
          let covA: Date | null = null; let covB: Date | null = null;
          if(it.coverage==='month') {
            // 当月整月覆盖
            covA = new Date(y, m-1, 1, 12,0,0);
            covB = new Date(y, m, 0, 12,0,0);
          }
          else if(it.coverage==='range') { if(!it.from_date || !it.to_date) return s; covA = toDate(String(it.from_date)); covB = toDate(String(it.to_date)); }
          else { return s; }
          if(!covA || !covB || covA>covB) return s;
          const ia = clamp(weekA, covA, covB);
          const ib = clamp(weekB, covA, covB);
          if(ia>ib) return s;
          // 遍历本周工作日逐天计费：日额 = 920 / 当天所在月份的工作日数
          let add = 0; const d=new Date(ia); d.setHours(12,0,0,0); const end=new Date(ib); end.setHours(12,0,0,0);
          while(d<=end){ if(isWorkday(d)) { const md = monthWorkdays(d.getFullYear(), d.getMonth()+1); if(md>0) add += MONTH_PRICE / md; } d.setDate(d.getDate()+1); }
          return s + add;
        }, 0);
        setSum(total);
      }catch{ setSum(0); }
    })();
  },[ym, weekStart, weekEnd]);
  return (
    <div className="flex justify-between"><span className="text-muted">预算合计</span><span className="font-semibold">¥{Number(sum||0).toFixed(2)}</span></div>
  );
}

// 成员缴费统计明细表
function PayStats({ onChange }: { onChange?: ()=>void }){
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth()+1);
  const [members, setMembers] = useState<Array<{id:string; name:string}>>([]);
  const [records, setRecords] = useState<Array<{member_id:string; paid:boolean; amount?:number|null; coverage?:'month'|'range'|null; from_date?:string|null; to_date?:string|null}>>([]);
  const [localAmounts, setLocalAmounts] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});

  function monthWorkdays(yy:number, mm:number){
    const isWorkday = (d:Date)=>{ const k=d.getDay(); return k>=1 && k<=5; };
    const first=new Date(yy,mm-1,1,12,0,0); const last=new Date(yy,mm,0,12,0,0);
    let c=0; const d=new Date(first); while(d<=last){ if(isWorkday(d)) c++; d.setDate(d.getDate()+1);} return c;
  }
  function suggestAmountByRange(from:string|null, to:string|null){
    if(!from || !to) return null as number|null;
    const isWorkday = (d:Date)=>{ const k=d.getDay(); return k>=1 && k<=5; };
    let total=0; const s=new Date(from); const e=new Date(to);
    if(isNaN(s.getTime())||isNaN(e.getTime())||s>e) return null;
    const d=new Date(s);
    while(d<=e){ if(isWorkday(d)){ const md=monthWorkdays(d.getFullYear(), d.getMonth()+1); if(md>0) total += MONTH_PRICE/md; } d.setDate(d.getDate()+1); }
    return Math.round(total);
  }

  async function reload(){
    try{
      const r1 = await fetch('/api/members');
      const j1 = await r1.json();
      setMembers(j1.items?.map((x:any)=>({id:x.id,name:x.name}))||[]);
    }catch{}
    try{
      const r2 = await fetch(`/api/members/pay?year=${year}&month=${month}`);
      const j2 = await r2.json();
      setRecords(j2.items||[]);
    }catch{}
  }
  useEffect(()=>{ reload(); },[year,month]);

  const map: Record<string, any> = {};
  records.forEach(r=>{ map[r.member_id]=r; });
  const totalCount = members.length;
  const paidCount = members.filter(m=> !!(map[m.id] && map[m.id].paid)).length;
  const unpaidCount = totalCount - paidCount;

  function setLocal(memberId: string, patch: any){
    setRecords(prev=>{
      const list = [...prev];
      const idx = list.findIndex(x=>x.member_id===memberId);
      if(idx>=0) list[idx] = { ...list[idx], ...patch } as any; else list.push({ member_id: memberId, paid: false, amount: null, coverage: null, from_date: null, to_date: null, ...patch } as any);
      return list;
    });
  }

  async function upsert(memberId: string, patch: any){
    // 本地合并状态，提升交互手感
    setRecords(prev=>{
      const list = [...prev];
      const idx = list.findIndex(x=>x.member_id===memberId);
      if(idx>=0){ list[idx] = { ...list[idx], ...patch } as any; }
      else { list.push({ member_id: memberId, paid: false, amount: null, coverage: null, from_date: null, to_date: null, ...patch } as any); }
      return list;
    });
    // 仅发送“被修改”的字段，避免把未修改的旧值写回覆盖
    const body: any = { member_id: memberId, year, month };
    Object.keys(patch).forEach((k)=>{ body[k] = (patch as any)[k]; });
    if (savingIds[memberId]) return;
    setSavingIds(prev=>({ ...prev, [memberId]: true }));
    try{
      const r = await fetch('/api/members/pay', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const j = await r.json().catch(()=>({}));
      // 若服务端返回最终 saved，按其回写，避免竞态
      if (j && j.saved && j.source === 'db') {
        const saved = j.saved;
        setRecords(prev=>{
          const list=[...prev];
          const idx=list.findIndex(x=>x.member_id===memberId);
          if(idx>=0) list[idx]={ ...list[idx], ...saved };
          return list;
        });
      }
      onChange && onChange();
    }catch(e){ console.error('保存失败', e); }
    finally{ setSavingIds(prev=>{ const n={...prev}; delete n[memberId]; return n; }); }
  }

  async function setPaid(memberId: string, paid: boolean){
    if (savingIds[memberId]) return;
    setLocal(memberId, { paid });
    setSavingIds(prev=>({ ...prev, [memberId]: true }));
    try{
      await fetch('/api/members/pay', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ member_id: memberId, year, month, paid }) });
      const r = await fetch(`/api/members/pay?year=${year}&month=${month}`);
      const j = await r.json();
      setRecords(j.items||[]);
      onChange && onChange();
    }catch(e){ console.error('保存失败', e); }
    finally{ setSavingIds(prev=>{ const n={...prev}; delete n[memberId]; return n; }); }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-sm">
        <label>年份</label>
        <input type="number" className="border rounded px-2 py-1 w-24" value={year} onChange={e=>setYear(parseInt(e.target.value||`${new Date().getFullYear()}`))} />
        <label>月份</label>
        <input type="number" className="border rounded px-2 py-1 w-20" value={month} onChange={e=>setMonth(parseInt(e.target.value||`${new Date().getMonth()+1}`))} />
        <button className="badge badge-muted" onClick={reload}>刷新</button>
      </div>
      <div className="mb-2 text-sm flex items-center gap-4">
        <span>总人数：<b>{totalCount}</b></span>
        <span>已交：<b className="text-green-600">{paidCount}</b></span>
        <span>未交：<b className="text-red-600">{unpaidCount}</b></span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-2 text-left">姓名</th>
              <th className="px-4 py-2 text-left">是否已交</th>
              <th className="px-4 py-2 text-left">金额</th>
              <th className="px-4 py-2 text-left">覆盖范围</th>
              <th className="px-4 py-2 text-right w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m=>{
              const rec = map[m.id] || {};
              const label = rec.coverage==='range' && rec.from_date && rec.to_date ? `${rec.from_date}~${rec.to_date}` : (rec.paid? '整月' : '-');
              return (
                <tr key={`pay-${m.id}`} className="border-b last:border-b-0">
                  <td className="px-4 py-2">{m.name}</td>
                  <td className="px-4 py-2">
                    <div className="inline-flex rounded-full border overflow-hidden select-none">
                      <button
                        className={`px-3 py-1 text-sm ${rec.paid ? 'bg-green-600 text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50'}`}
                        onClick={()=> setPaid(m.id, true)}
                      >已交</button>
                      <button
                        className={`px-3 py-1 text-sm ${!rec.paid ? 'bg-red-500 text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50'}`}
                        onClick={()=> setPaid(m.id, false)}
                      >未交</button>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.01"
                      className="border rounded px-2 py-1 w-28"
                      value={localAmounts[m.id] ?? (rec.amount ?? '')}
                      placeholder="金额"
                      onChange={(e)=>{
                        const raw = e.target.value;
                        setLocalAmounts(prev=>({ ...prev, [m.id]: raw }));
                      }}
                      onBlur={(e)=>{
                        const raw = e.currentTarget.value;
                        const v = raw === '' ? null : Number(raw);
                        setLocal(m.id, { amount: Number.isNaN(v as any) ? null : v });
                        upsert(m.id, { amount: Number.isNaN(v as any) ? null : v });
                        setLocalAmounts(prev=>{ const n={...prev}; delete n[m.id]; return n; });
                      }}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <select
                        className="border rounded px-2 py-1"
                        value={rec.coverage || ''}
                        onChange={(e)=>{
                          const v = e.target.value as any;
                          // 用户切换时立刻更新本地，避免选择器回跳
                          setLocal(m.id, v? { coverage: v } : { coverage: null, from_date: null, to_date: null });
                          if(v==='month') { upsert(m.id, { coverage:'month', from_date: null, to_date: null, amount: MONTH_PRICE }); setLocal(m.id, { amount: MONTH_PRICE }); }
                          else if(v==='range') upsert(m.id, { coverage:'range' });
                          else upsert(m.id, { coverage: null, from_date: null, to_date: null });
                        }}
                      >
                        <option value="">-</option>
                        <option value="month">整月</option>
                        <option value="range">区间</option>
                      </select>
                      <div className="flex items-center gap-2" style={{ minWidth: 260, visibility: rec.coverage==='range' ? 'visible' as any : 'hidden' as any }}>
                        <input type="date" className="border rounded px-2 py-1" value={rec.from_date || ''} onChange={(e)=>{ const v=e.target.value||null; setLocal(m.id, { from_date: v }); upsert(m.id, { from_date: v }); const sug=suggestAmountByRange(v, rec.to_date||null); if(sug!==null){ setLocal(m.id, { amount: sug }); upsert(m.id, { amount: sug }); } }} />
                        <span className="text-muted">~</span>
                        <input type="date" className="border rounded px-2 py-1" value={rec.to_date || ''} onChange={(e)=>{ const v=e.target.value||null; setLocal(m.id, { to_date: v }); upsert(m.id, { to_date: v }); const sug=suggestAmountByRange(rec.from_date||null, v); if(sug!==null){ setLocal(m.id, { amount: sug }); upsert(m.id, { amount: sug }); } }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="badge badge-muted" onClick={async()=>{ await fetch(`/api/members/pay?member_id=${m.id}&year=${year}&month=${month}`, { method:'DELETE' }); await reload(); }}>清除</button>
                  </td>
                </tr>
              );
            })}
            {members.length===0 && <tr><td colSpan={5} className="px-4 py-4 text-center text-muted">暂无成员</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
