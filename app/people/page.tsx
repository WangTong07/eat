"use client";
import Shell from "../dashboard/Shell";
import { useEffect, useMemo, useState } from "react";

function isoWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return date.getUTCFullYear() * 100 + week;
}

export default function PeoplePage() {
  const [weekNumber, setWeekNumber] = useState(() => isoWeekNumber(new Date()));
  const [base, setBase] = useState(5);
  const [delta, setDelta] = useState(0);
  const [todayCount, setTodayCount] = useState(5);
  const [members, setMembers] = useState<Array<{id:string;name:string;role?:string;is_active?:boolean}>>([]);
  const [newName, setNewName] = useState("");
  // 角色分类已删除
  const [dutyWeek, setDutyWeek] = useState<{id?:string; member_a_id?:string|null; member_b_id?:string|null; a_confirmed?:boolean; b_confirmed?:boolean} | null>(null);
  const [assignYear, setAssignYear] = useState<number>(new Date().getFullYear());
  const [assignMonth, setAssignMonth] = useState<number>(new Date().getMonth() + 1);
  const [staffAssign, setStaffAssign] = useState<Record<string, number | null>>({});
  const [staffSet, setStaffSet] = useState<Record<string, boolean>>({});
  const [payMap, setPayMap] = useState<Record<string, boolean>>({});
  const readLocal = (year:number, month:number) => {
    if (typeof window === 'undefined') return { map:{}, present:{} } as any;
    const raw = window.localStorage.getItem(`duty_staff_${year}_${month}`);
    const arr: Array<{member_id:string; week_in_month:number|null}> = raw ? JSON.parse(raw) : [];
    const map: Record<string, number|null> = {}; const present: Record<string, boolean> = {};
    arr.forEach(x=>{ map[x.member_id] = x.week_in_month ?? null; present[x.member_id]=true; });
    return { map, present };
  };

  const writeLocal = (year:number, month:number, map: Record<string, number|null>, present: Record<string, boolean>) => {
    if (typeof window === 'undefined') return;
    const arr: Array<{member_id:string; week_in_month:number|null}> = Object.keys(present).filter(id=>present[id]).map(id=>({ member_id:id, week_in_month: map[id] ?? null }));
    window.localStorage.setItem(`duty_staff_${year}_${month}`, JSON.stringify(arr));
  };

  const reloadAssignments = async (year: number, month: number) => {
    try {
      const r = await fetch(`/api/duty/staff?year=${year}&month=${month}`);
      const j = await r.json();
      // 服务端返回的当前分配
      const serverMap: Record<string, number|null> = {};
      const serverPresent: Record<string, boolean> = {};
      (j.items || []).forEach((x: any) => { serverMap[x.member_id] = x.week_in_month ?? null; serverPresent[x.member_id] = true; });

      // 本地缓存（包含“未分配”的 null 值），用于覆盖服务端
      const local = readLocal(year, month);

      // 合并：本地优先（特别是未分配 null），避免被服务端旧值覆盖
      const mergedPresent: Record<string, boolean> = { ...serverPresent, ...local.present };
      const mergedMap: Record<string, number|null> = {};
      Object.keys(mergedPresent).forEach(id => {
        if (id in local.map) {
          mergedMap[id] = local.map[id]; // null 或 1-4，均以本地为准
        } else {
          mergedMap[id] = serverMap[id] ?? null;
        }
      });

      setStaffAssign(mergedMap);
      setStaffSet(mergedPresent);
      writeLocal(year, month, mergedMap, mergedPresent);
    } catch {}
  };
  const reloadPayStatus = async (year: number, month: number) => {
    try {
      const r = await fetch(`/api/members/pay?year=${year}&month=${month}`);
      const j = await r.json();
      const map: Record<string, boolean> = {};
      (j.items || []).forEach((x: any) => { map[x.member_id] = !!x.paid; });
      setPayMap(map);
    } catch {}
  };
  const getWeekStyle = (wk?: number | null) => {
    switch (wk) {
      case 1:
        return { backgroundColor: '#E3F2FD', color: '#1e3a8a' } as React.CSSProperties; // 第一周：蓝
      case 2:
        return { backgroundColor: '#E8F5E9', color: '#166534' } as React.CSSProperties; // 第二周：绿
      case 3:
        return { backgroundColor: '#FFF7ED', color: '#7c2d12' } as React.CSSProperties; // 第三周：橙
      case 4:
        return { backgroundColor: '#F3E8FF', color: '#5b21b6' } as React.CSSProperties; // 第四周：紫
      case 5:
        return { backgroundColor: '#FDE68A', color: '#854d0e' } as React.CSSProperties; // 第五周：黄
      default:
        return {} as React.CSSProperties;
    }
  };

  // 计算当月实际“工作周”区间（周一到周五），允许跨月，例如 7/29-8/02 或 9/30-10/04
  const workWeekRanges = useMemo(() => {
    const y = assignYear; const m = assignMonth; // 1-12
    const first = new Date(y, m - 1, 1, 12, 0, 0);
    const last = new Date(y, m, 0, 12, 0, 0);
    // 找到当月第一个周一（若当月第一天不是周一，则向前取上一个周一，允许跨月）
    const firstMonday = new Date(first);
    while (firstMonday.getDay() !== 1) { // 1=Mon
      firstMonday.setDate(firstMonday.getDate() - 1);
    }
    const ranges: Array<{ start: Date; end: Date; label: string }>=[];
    let start = new Date(firstMonday);
    // 终止条件：当周的周五已经超过当月最后一天的那一周
    while (true) {
      const end = new Date(start);
      end.setDate(end.getDate() + 4); // 周一+4=周五
      // 若这一周完全早于本月（周五 < first）则跳过
      if (end < first) { start.setDate(start.getDate() + 7); continue; }
      // 构造标签（按起止月份展示）
      const startM = start.getMonth() + 1;
      const endM = end.getMonth() + 1;
      const label = `${startM}/${String(start.getDate()).padStart(2,'0')}-${endM}/${String(end.getDate()).padStart(2,'0')}`;
      ranges.push({ start: new Date(start), end, label });
      // 若这一周的周一已超过当月最后一天所在周，则停止
      if (start > last && end > last) break;
      start.setDate(start.getDate() + 7); // 下一周
      // 防止死循环
      if (ranges.length > 6) break;
    }
    return ranges;
  }, [assignYear, assignMonth]);

  function getRangesFor(year:number, month:number){
    const first = new Date(year, month - 1, 1, 12, 0, 0);
    const last = new Date(year, month, 0, 12, 0, 0);
    const firstMonday = new Date(first);
    while (firstMonday.getDay() !== 1) { firstMonday.setDate(firstMonday.getDate() - 1); }
    const arr: Array<{start:Date,end:Date,label:string}> = [];
    let start = new Date(firstMonday);
    while (true){
      const end = new Date(start); end.setDate(end.getDate()+4);
      if (end < first){ start.setDate(start.getDate()+7); continue; }
      const sm = start.getMonth()+1; const em = end.getMonth()+1;
      arr.push({ start:new Date(start), end, label: `${sm}/${String(start.getDate()).padStart(2,'0')}-${em}/${String(end.getDate()).padStart(2,'0')}` });
      if (start > last && end > last) break;
      start.setDate(start.getDate()+7); if (arr.length>6) break;
    }
    return arr;
  }

  function getPrevYM(y:number, m:number){
    return m===1 ? { y: y-1, m: 12 } : { y, m: m-1 };
  }

  // 基于上月最后一周 → 本月第一周的延续，自动排在前，必要时自动赋值
  useEffect(()=>{
    (async()=>{
      try{
        // 仅在值班卡片场景使用：按上月最后一周 → 本月第一周做延续与排序
        const curRanges = getRangesFor(assignYear, assignMonth);
        if(curRanges.length===0) return;
        const firstLabel = curRanges[0].label;
        // 上一月
        const prev = getPrevYM(assignYear, assignMonth);
        const prevRanges = getRangesFor(prev.y, prev.m);
        if(prevRanges.length===0) return;
        const matchIdxPrev = prevRanges.findIndex(r=> r.label === firstLabel);
        if(matchIdxPrev<0) return;
        // 拉取上一月分配
        const r = await fetch(`/api/duty/staff?year=${prev.y}&month=${prev.m}`);
        const j = await r.json();
        const ids: string[] = [];
        (j.items||[]).forEach((x:any)=>{ if((x.week_in_month||0) === (matchIdxPrev+1)) ids.push(x.member_id); });
        if(ids.length===0) return;
        // 计算当前月第一周索引
        const firstIdx = 1; // 在 getRangesFor 中第一项就是第一周
        // 当前月占用第一周的人
        const currentOccupants = Object.keys(staffAssign||{}).filter(uid => (staffAssign as any)[uid] === firstIdx);
        // 若与上月负责人不同，则以上月负责人为准：解除当前占用并指派给 ids
        const toUnassign = currentOccupants.filter(uid => !ids.includes(uid));
        for(const uid of toUnassign){
          try{ await fetch('/api/duty/staff', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ member_id: uid, week_in_month: 0, year: assignYear, month: assignMonth }) }); }catch{}
        }
        for(const id of ids){
          try{ await fetch('/api/duty/staff', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ member_id: id, week_in_month: firstIdx, year: assignYear, month: assignMonth }) }); }catch{}
        }
        // 本地立即体现
        const nextMap = { ...staffAssign } as Record<string, number|null>;
        const nextSet = { ...staffSet } as Record<string, boolean>;
        toUnassign.forEach(uid=>{ nextMap[uid]=0 as any; });
        ids.forEach(id=>{ nextMap[id]=firstIdx; nextSet[id]=true; });
        setStaffAssign(nextMap); setStaffSet(nextSet);
        writeLocal(assignYear, assignMonth, nextMap, nextSet);
        await reloadAssignments(assignYear, assignMonth);
        // 以当前月第一周的实际占用者为优先排序（即便上月没有记录，只要本月已占用，也顶到前面）
        try {
          const rCur = await fetch(`/api/duty/staff?year=${assignYear}&month=${assignMonth}`);
          const jCur = await rCur.json();
          const currentFirst = (jCur.items||[]).filter((x:any)=> (x.week_in_month||0) === firstIdx).map((x:any)=> x.member_id);
          if (currentFirst.length>0) setPriorityIds(currentFirst);
          else setPriorityIds(ids);
        } catch {
          setPriorityIds(ids);
        }
      }catch{}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignYear, assignMonth, members.length]);

  const [priorityIds, setPriorityIds] = useState<string[]>([]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0,10), []);

  useEffect(() => {
    (async () => {
      // 先用本地数据预渲染，避免闪空
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem(`duty_staff_${assignYear}_${assignMonth}`) : null;
        if (raw) {
          const arr: Array<{member_id:string; week_in_month:number|null}> = JSON.parse(raw);
          const map: Record<string, number|null> = {}; const present: Record<string, boolean> = {};
          arr.forEach(x=>{ map[x.member_id] = x.week_in_month ?? null; present[x.member_id]=true; });
          setStaffAssign(map); setStaffSet(present);
        }
      } catch {}
      const res = await fetch("/api/headcount/today");
      const j = await res.json();
      if (j.weekNumber) setWeekNumber(j.weekNumber);
      if (typeof j.base === 'number') setBase(j.base);
      if (typeof j.delta === 'number') setDelta(j.delta);
      if (typeof j.todayCount === 'number') setTodayCount(j.todayCount);
      try {
        const r2 = await fetch('/api/members');
        const j2 = await r2.json();
        setMembers(j2.items || []);
      } catch {}
      try {
        const r3 = await fetch(`/api/duty/weeks?weekNumber=${j.weekNumber || weekNumber}`);
        const j3 = await r3.json();
        setDutyWeek(j3.item || null);
      } catch {}
      try { await reloadAssignments(assignYear, assignMonth); } catch {}
      try { await reloadPayStatus(assignYear, assignMonth); } catch {}
    })();
  }, []);

  return (
    <Shell>
      <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold text-neutral-800 mb-4">成员详情</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="ui-card rounded-xl p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">成员列表</h3>
            <div className="text-sm text-muted flex items-center gap-2">
              <span>总人数</span>
              <span className="badge badge-primary" aria-label="总人数">{members.length}</span>
            </div>
          </div>
          <div className="space-y-1 max-h-80 overflow-auto pr-2">
            {members.map(m => (
              <div key={m.id} className="grid grid-cols-4 items-center text-sm py-2 border-b last:border-b-0">
                <div className="truncate col-span-2">{m.name}</div>
                <div className="col-span-1">
                  <label className="mr-3 inline-flex items-center gap-1">
                    <input type="radio" name={`active-${m.id}`} checked={!!m.is_active} onChange={async()=>{
                      await fetch('/api/members',{method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id:m.id, is_active:true})});
                      const r = await fetch('/api/members'); const j = await r.json(); setMembers(j.items || []);
                    }} /> 本周吃饭
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input type="radio" name={`active-${m.id}`} checked={!m.is_active} onChange={async()=>{
                      await fetch('/api/members',{method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id:m.id, is_active:false})});
                      const r = await fetch('/api/members'); const j = await r.json(); setMembers(j.items || []);
                    }} /> 不吃
                  </label>
                </div>
                <div className="text-right col-span-1 flex items-center justify-end gap-3">
                  {/* 付费标记（钱币表情） */}
                  {/* 付款标记入口移除：仅保留值班相关，不显示钱袋子 */}

                  {/* 值班人员标记 */}
                  <label className="inline-flex items-center gap-1 text-primary">
                    <input type="checkbox"
                      checked={!!staffSet[m.id]}
                      onChange={async(e)=>{
                        if (e.target.checked) {
                          // 加入值班人员，默认第一周
                          await fetch('/api/duty/staff', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ member_id: m.id, week_in_month: 1, year: assignYear, month: assignMonth }) });
                          setStaffSet(prev => ({ ...prev, [m.id]: true }));
                          setStaffAssign(prev => ({ ...prev, [m.id]: 1 }));
                          writeLocal(assignYear, assignMonth, { ...staffAssign, [m.id]: 1 }, { ...staffSet, [m.id]: true });
                        } else {
                          // 从值班人员中移除
                          await fetch('/api/duty/staff', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ member_id: m.id, year: assignYear, month: assignMonth }) });
                          setStaffSet(prev => ({ ...prev, [m.id]: false }));
                          setStaffAssign(prev => ({ ...prev, [m.id]: null }));
                          const nextMap = { ...staffAssign, [m.id]: null };
                          const nextSet = { ...staffSet, [m.id]: false };
                          writeLocal(assignYear, assignMonth, nextMap, nextSet);
                        }
                        // 刷新下方列表
                        try {
                          const r = await fetch(`/api/duty/staff?year=${assignYear}&month=${assignMonth}`);
                          const j = await r.json();
                          const map: Record<string, number|null> = {};
                          const present: Record<string, boolean> = {};
                          (j.items || []).forEach((x: any) => { map[x.member_id] = x.week_in_month ?? null; present[x.member_id] = true; });
                          setStaffAssign(map);
                          setStaffSet(present);
                        } catch {}
                      }}
                    /> 值班人员
                  </label>
                  <button className="btn-link" onClick={async(e)=>{
                    const el = e.currentTarget as HTMLButtonElement;
                    const old = el.textContent;
                    el.textContent = '删除中...';
                    el.style.opacity = '0.7';
                    try {
                      const res = await fetch('/api/members',{method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: m.id })});
                      if (!res.ok) throw new Error('删除失败');
                      const r = await fetch('/api/members'); const j = await r.json(); setMembers(j.items || []);
                    } catch {}
                    el.textContent = old || '删除';
                    el.style.opacity = '1';
                  }}>删除</button>
                </div>
              </div>
            ))}
            {members.length === 0 && <div className="text-muted text-sm">暂无成员</div>}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="姓名" className="border rounded px-3 py-2" />
            <button className="badge badge-primary" onClick={async()=>{
              if (!newName.trim()) return;
              const r = await fetch('/api/members',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name:newName})});
              const j = await r.json().catch(()=>({}));
              if (r.ok && (j?.success || j?.items)) {
                setNewName('');
                const r2 = await fetch('/api/members'); const j2 = await r2.json(); setMembers(j2.items || []);
              }
            }}>添加成员</button>
          </div>
        </div>
      </div>

      <div className="mt-6 ui-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-heading">值班人员（本月）</h3>
          <div className="flex items-center gap-2 text-sm">
            <label>年份</label>
            <input type="number" className="border rounded px-2 py-1 w-24" value={assignYear} onChange={e=>setAssignYear(parseInt(e.target.value || `${new Date().getFullYear()}`))} />
            <label>月份</label>
            <input type="number" className="border rounded px-2 py-1 w-20" value={assignMonth} onChange={e=>setAssignMonth(parseInt(e.target.value || `${new Date().getMonth()+1}`))} />
            <button className="badge badge-muted" onClick={async()=>{ await reloadAssignments(assignYear, assignMonth); await reloadPayStatus(assignYear, assignMonth); }}>刷新</button>
            <div className="text-muted">在“成员列表”中添加/删除成员；这里只显示已分配周次的值班成员</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">姓名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">身份</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">负责周次</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {Object.keys(staffAssign).length === 0 && (
                <tr><td colSpan={4} className="px-6 py-6 text-center text-sm text-muted">本月暂无值班人员</td></tr>
              )}
              {members
                .filter(m => !!staffSet[m.id])
                .sort((a,b)=>{
                  const ai = priorityIds.indexOf(a.id);
                  const bi = priorityIds.indexOf(b.id);
                  if (ai>=0 && bi>=0) return ai-bi;
                  if (ai>=0) return -1;
                  if (bi>=0) return 1;
                  return 0;
                })
                .map(m => (
                <tr key={`assign-${m.id}`}>
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-neutral-900">{m.name}</td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-neutral-500">{m.role || '成员'}</td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm">
                    <select
                      value={staffAssign[m.id] ?? ''}
                      onChange={(e)=>{
                        const v = e.target.value ? parseInt(e.target.value) : null;
                        setStaffAssign(prev => ({ ...prev, [m.id]: v }));
                        (async()=>{
                          if (v === null) {
                            // 未分配：保存到服务端为 0，并保持本地为 null
                            await fetch('/api/duty/staff', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ member_id: m.id, week_in_month: 0, year: assignYear, month: assignMonth })
                            });
                            writeLocal(assignYear, assignMonth, { ...staffAssign, [m.id]: null }, { ...staffSet });
                            await reloadAssignments(assignYear, assignMonth);
                            return;
                          }
                          // 保存当前月
                          await fetch('/api/duty/staff', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ member_id: m.id, week_in_month: v, year: assignYear, month: assignMonth }) });
                          // 同步到相邻月（跨月同一周自动延续）
                          try {
                            const curRanges = getRangesFor(assignYear, assignMonth);
                            const cur = curRanges[(v-1)];
                            if (cur){
                              const sm = cur.start.getMonth()+1; const em = cur.end.getMonth()+1;
                              if (sm !== em){
                                // 跨月：把同一周写到另一个月
                                const otherYear = (em!==assignMonth) ? cur.end.getFullYear() : cur.start.getFullYear();
                                const otherMonth = (em!==assignMonth) ? em : sm;
                                const otherRanges = getRangesFor(otherYear, otherMonth);
                                const idx = otherRanges.findIndex(r=> r.start.getTime()===cur.start.getTime() && r.end.getTime()===cur.end.getTime());
                                if (idx>=0){
                                  await fetch('/api/duty/staff', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ member_id: m.id, week_in_month: idx+1, year: otherYear, month: otherMonth }) });
                                }
                              }
                            }
                          } catch {}
                          writeLocal(assignYear, assignMonth, { ...staffAssign, [m.id]: v }, { ...staffSet });
                          await reloadAssignments(assignYear, assignMonth);
                        })();
                      }}
                      className="select-interactive font-semibold"
                      style={getWeekStyle(staffAssign[m.id])}
                    >
                      <option value="">未分配</option>
                      {workWeekRanges.map((w, idx)=> (
                        <option key={idx} value={idx+1} style={getWeekStyle(idx+1)}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-right text-sm space-x-2">
                    <button className="badge badge-muted" onClick={async()=>{
                      // 从值班人员列表中移除（删除记录）
                      await fetch('/api/duty/staff', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ member_id: m.id, year: assignYear, month: assignMonth }) });
                      await reloadAssignments(assignYear, assignMonth);
                    }}>移除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 按你的需求：移除“值班安排（本周）”模块 */}
    </Shell>
  );
}


