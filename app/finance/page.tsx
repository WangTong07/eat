
"use client";
import Shell from "../dashboard/Shell";
import { useEffect, useMemo, useRef, useState } from "react";

type Expense = { id:string; date:string; description:string; amount:number; handler?:string; week_number?:number; attachments?:Array<{url:string,name?:string}> };

export default function FinancePage(){
  const [date,setDate]=useState(()=> new Date().toISOString().slice(0,10));
  const [desc,setDesc]=useState("");
  const [amount,setAmount]=useState("");
  const [handler,setHandler]=useState("");
  const [files,setFiles]=useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement|null>(null);

  const ym = useMemo(()=>{ const d=new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; },[date]);
  const [items,setItems]=useState<Expense[]>([]);
  const [weekly,setWeekly]=useState<Array<{week_number:number,amount_sum:number}>>([]);

  async function fetchList(){
    const r = await fetch(`/api/expenses?month=${ym}`);
    const j = await r.json();
    setItems(j.items||[]);
  }
  async function fetchWeekly(){
    const r = await fetch(`/api/expenses/weekly?month=${ym}`);
    const j = await r.json();
    setWeekly(j.items||[]);
  }

  useEffect(()=>{ fetchList(); fetchWeekly(); },[ym]);

  async function onAdd(){
    const attachments:any[]=[];
    // TODO: 这里先只保存文件名（不上传），后续接你的 Supabase Storage 做真实上传
    for(const f of files){ attachments.push({url:`local://${f.name}`, name:f.name}); }
    const payload={ date, description:desc, amount:parseFloat(amount||'0'), handler, attachments };
    const r = await fetch('/api/expenses',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    if(r.ok){ setDesc(""); setAmount(""); setHandler(""); setFiles([]); inputRef.current && (inputRef.current.value=""); await fetchList(); await fetchWeekly(); }
  }

  return (
    <Shell>
      <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold text-neutral-800 mb-4">财务 · 支出与结算</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="ui-card rounded-xl p-5"><div className="text-muted text-sm">本周总支出</div><div className="text-2xl font-bold">¥{(weekly.find(w=>String(w.week_number).endsWith(String(new Date(date).getUTCFullYear())))?0:0).toFixed?.(2)||'0.00'}</div></div>
        <div className="ui-card rounded-xl p-5"><div className="text-muted text-sm">本月总支出</div><div className="text-2xl font-bold">¥{items.reduce((s,it)=>s+Number(it.amount||0),0).toFixed(2)}</div></div>
        <div className="ui-card rounded-xl p-5"><div className="text-muted text-sm">功能说明</div><div className="text-sm">支持上传图片或文字记账；下方“周编号(YYYYWW)”为本月每周汇总。</div></div>
      </div>

      <div className="ui-card rounded-xl p-5 mt-4">
        <div className="text-lg font-bold mb-3">本月每周支出汇总</div>
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50"><tr><th className="px-4 py-2 text-left">周编号</th><th className="px-4 py-2 text-left">支出金额</th></tr></thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {weekly.length===0 && <tr><td className="px-4 py-3 text-sm text-muted" colSpan={2}>本月暂无支出</td></tr>}
            {weekly.map(w=> <tr key={w.week_number}><td className="px-4 py-2">{w.week_number}</td><td className="px-4 py-2">¥{Number(w.amount_sum||0).toFixed(2)}</td></tr>)}
          </tbody>
        </table>
      </div>

      <div className="ui-card rounded-xl p-5 mt-4">
        <div className="text-lg font-bold mb-3">支出记录</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border rounded px-3 py-2" />
          <input placeholder="描述" value={desc} onChange={e=>setDesc(e.target.value)} className="border rounded px-3 py-2" />
          <input placeholder="金额" value={amount} onChange={e=>setAmount(e.target.value)} className="border rounded px-3 py-2" />
          <input placeholder="经手人" value={handler} onChange={e=>setHandler(e.target.value)} className="border rounded px-3 py-2" />
          <button className="badge badge-primary" onClick={onAdd}>添加支出</button>
        </div>
        <div className="mt-3">
          <input type="file" multiple ref={inputRef} onChange={e=> setFiles(Array.from(e.target.files||[])) } />
          {files.length>0 && <div className="text-sm text-muted mt-1">已选择：{files.map(f=>f.name).join(', ')}</div>}
        </div>
      </div>

      <div className="ui-card rounded-xl p-5 mt-4">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50"><tr><th className="px-4 py-2 text-left">日期</th><th className="px-4 py-2 text-left">描述</th><th className="px-4 py-2 text-left">金额</th><th className="px-4 py-2 text-left">经手人</th></tr></thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {items.length===0 && <tr><td className="px-4 py-3 text-sm text-muted" colSpan={4}>暂无支出记录</td></tr>}
            {items.map(it=> <tr key={it.id}><td className="px-4 py-2">{it.date}</td><td className="px-4 py-2">{it.description}</td><td className="px-4 py-2">¥{Number(it.amount||0).toFixed(2)}</td><td className="px-4 py-2">{it.handler||''}</td></tr>)}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
