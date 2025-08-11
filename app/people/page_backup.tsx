"use client";
import Shell from "../dashboard/Shell";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRealtimeSubscription } from "@/lib/useRealtimeSubscription";
import { getFreshHouseholdMembers, clearLocalFallbackData } from "@/lib/dataUtils";
import { getSupabaseClient } from "@/lib/supabaseClient";

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
  const [syncing, setSyncing] = useState(false);
  const [newName, setNewName] = useState("");
  const [dutyWeek, setDutyWeek] = useState<{id?:string; member_a_id?:string|null; member_b_id?:string|null; a_confirmed?:boolean; b_confirmed?:boolean} | null>(null);
  const [assignYear, setAssignYear] = useState<number>(new Date().getFullYear());
  const [assignMonth, setAssignMonth] = useState<number>(new Date().getMonth() + 1);
  const [staffAssign, setStaffAssign] = useState<Record<string, number | null>>({});
  const [staffSet, setStaffSet] = useState<Record<string, boolean>>({});
  const [payMap, setPayMap] = useState<Record<string, boolean>>({});
  const [priorityIds, setPriorityIds] = useState<string[]>([]);

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

  // 计算当月工作周区间（周一到周五）
  function getRangesFor(year: number, month: number) {
    const ranges: Array<{ start: Date; end: Date; label: string }> = [];
    
    // 获取当月第一天和最后一天
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    
    // 找到包含当月的第一个周一（可能在上个月）
    let currentDate = new Date(monthStart);
    
    // 如果1号不是周一，向前找到最近的周一
    while (currentDate.getDay() !== 1) {
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    // 生成工作周，直到完全超出当月
    while (true) {
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(weekEnd.getDate() + 4); // 周五
      
      // 检查这一周是否与当月有交集
      if (weekStart > monthEnd) {
        break; // 完全超出当月，停止
      }
      
      if (weekEnd >= monthStart) {
        // 有交集，添加到结果中
        const startMonth = weekStart.getMonth() + 1;
        const endMonth = weekEnd.getMonth() + 1;
        const startYear = weekStart.getFullYear();
        const endYear = weekEnd.getFullYear();
        
        let label: string;
        if (startYear === endYear && startMonth === endMonth) {
          // 同年同月：8/04-8/08
          label = `${startMonth}/${String(weekStart.getDate()).padStart(2,'0')}-${startMonth}/${String(weekEnd.getDate()).padStart(2,'0')}`;
        } else if (startYear === endYear) {
          // 同年不同月：12/30-1/03
          label = `${startMonth}/${String(weekStart.getDate()).padStart(2,'0')}-${endMonth}/${String(weekEnd.getDate()).padStart(2,'0')}`;
        } else {
          // 跨年：2025/12/30-2026/1/03
          label = `${startYear}/${startMonth}/${String(weekStart.getDate()).padStart(2,'0')}-${endYear}/${endMonth}/${String(weekEnd.getDate()).padStart(2,'0')}`;
        }
        
        ranges.push({ start: weekStart, end: weekEnd, label });
      }
      
      // 移动到下一周
      currentDate.setDate(currentDate.getDate() + 7);
      
      // 安全检查：避免无限循环
      if (ranges.length > 6) break;
    }
    
    return ranges;
  }

  // 🚫 完全禁用自动生成 - 纯手动值班安排加载
  const reloadAssignments = async (year: number, month: number) => {
    try {
      const supabase = getSupabaseClient();
      
      console.log(`🔍 加载 ${year}年${month}月 值班安排（纯手动模式）`);
      
      // 1. 只加载当前月的值班安排，不进行任何自动操作
      const { data: currentData, error: currentError } = await supabase
        .from('duty_staff_assignments')
        .select('*')
        .eq('year', year)
        .eq('month', month);

      if (currentError) throw currentError;

      // 2. 加载下个月前几周的数据（仅用于显示跨月分配）
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      
      const { data: nextMonthData } = await supabase
        .from('duty_staff_assignments')
        .select('*')
        .eq('year', nextYear)
        .eq('month', nextMonth)
        .lte('week_in_month', 2); // 只取下月前2周

      // 3. 处理当前月数据
      const serverMap: Record<string, number|null> = {};
      const serverPresent: Record<string, boolean> = {};
      
      (currentData || []).forEach((x: any) => { 
        serverMap[x.member_id] = x.week_in_month ?? null; 
        serverPresent[x.member_id] = true; 
      });

      // 4. 处理下月数据（显示为负数，表示下月）
      (nextMonthData || []).forEach((x: any) => {
        if (!serverPresent[x.member_id]) { // 避免重复
          serverMap[x.member_id] = -(x.week_in_month ?? 0); // 负数表示下月
          serverPresent[x.member_id] = true;
        }
      });

      setStaffAssign(serverMap);
      setStaffSet(serverPresent);
      
      console.log(`✅ 已加载 ${year}年${month}月 值班安排:`, { 
        当月记录: currentData?.length || 0,
        下月前2周: nextMonthData?.length || 0,
        serverMap, 
        serverPresent 
      });
    } catch (error) {
      console.error('❌ 加载值班安排失败:', error);
    }
  };

  const reloadPayStatus = async (year: number, month: number) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('member_payments')
        .select('*')
        .eq('year', year)
        .eq('month', month);

      if (error) throw error;

      const map: Record<string, boolean> = {};
      (data || []).forEach((x: any) => { map[x.member_id] = !!x.paid; });
      setPayMap(map);
    } catch (error) {
      console.error('加载付款状态失败:', error);
    }
  };

  const getWeekStyle = (wk?: number | null) => {
    switch (wk) {
      case 1:
        return { backgroundColor: '#E3F2FD', color: '#1e3a8a' } as React.CSSProperties;
      case 2:
        return { backgroundColor: '#E8F5E9', color: '#166534' } as React.CSSProperties;
      case 3:
        return { backgroundColor: '#FFF7ED', color: '#7c2d12' } as React.CSSProperties;
      case 4:
        return { backgroundColor: '#F3E8FF', color: '#5b21b6' } as React.CSSProperties;
      case 5:
        return { backgroundColor: '#FDE68A', color: '#854d0e' } as React.CSSProperties;
      default:
        return {} as React.CSSProperties;
    }
  };

  // 计算当月工作周区间，按时间先后顺序排列
  const workWeekRanges = useMemo(() => {
    const ranges = getRangesFor(assignYear, assignMonth);
    console.log(`${assignYear}年${assignMonth}月 工作周区间:`, ranges);
    return ranges;
  }, [assignYear, assignMonth]);

  function getPrevYM(y:number, m:number){
    return m===1 ? { y: y-1, m: 12 } : { y, m: m-1 };
  }

  const todayStr = useMemo(() => new Date().toISOString().slice(0,10), []);

  useEffect(() => {
    (async () => {
      // 直接从数据库加载，不使用本地存储
      
      const res = await fetch("/api/headcount/today");
      const j = await res.json();
      if (j.weekNumber) setWeekNumber(j.weekNumber);
      if (typeof j.base === 'number') setBase(j.base);
      if (typeof j.delta === 'number') setDelta(j.delta);
      if (typeof j.todayCount === 'number') setTodayCount(j.todayCount);
      
      try {
        setSyncing(true);
        const data = await getFreshHouseholdMembers();
        setMembers(data || []);
        clearLocalFallbackData();
      } catch {
        // 兜底：使用原有 API
        try {
          const r2 = await fetch('/api/members');
          const j2 = await r2.json();
          setMembers(j2.items || []);
        } catch {}
      } finally {
        setSyncing(false);
      }
      
      try {
        const r3 = await fetch(`/api/duty/weeks?weekNumber=${j.weekNumber || weekNumber}`);
        const j3 = await r3.json();
        setDutyWeek(j3.item || null);
      } catch {}
      
      try { await reloadAssignments(assignYear, assignMonth); } catch {}
      try { await reloadPayStatus(assignYear, assignMonth); } catch {}
    })();
  }, []);

  // 当年月变化时重新加载数据
  useEffect(() => {
    if (members.length > 0) {
      reloadAssignments(assignYear, assignMonth);
      reloadPayStatus(assignYear, assignMonth);
    }
  }, [assignYear, assignMonth, members.length]);

  // 添加实时订阅 - 监听成员和值班相关表变更
  useRealtimeSubscription({
    table: 'household_members',
    onChange: () => {
      console.log('[PeoplePage] 检测到成员变更，重新加载...');
      (async () => {
        try {
          setSyncing(true);
          const data = await getFreshHouseholdMembers();
          setMembers(data || []);
          clearLocalFallbackData();
        } catch {
          try {
            const r2 = await fetch('/api/members');
            const j2 = await r2.json();
            setMembers(j2.items || []);
          } catch {}
        } finally {
          setSyncing(false);
        }
      })();
    }
  });

  useRealtimeSubscription({
    table: 'member_payments',
    onChange: () => {
      console.log('[PeoplePage] 检测到付款记录变更，重新加载...');
      reloadPayStatus(assignYear, assignMonth);
    }
  });

  // 添加值班安排表的实时订阅
  useRealtimeSubscription({
    table: 'duty_staff_assignments',
    onChange: () => {
      console.log('[PeoplePage] 检测到值班安排变更，重新加载...');
      reloadAssignments(assignYear, assignMonth);
    }
  });

  return (
    <Shell>
      <div className="relative mb-8">
        <img 
          src="https://cdn.pixabay.com/photo/2016/11/23/13/45/celebration-1852926_1280.jpg"
          alt="成员详情装饰图片" 
          className="w-full h-48 object-cover rounded-lg shadow-md"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent flex items-center">
          <div className="text-white px-6">
            <h2 className="text-3xl font-bold">成员详情</h2>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="ui-card rounded-xl p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">
              成员列表
              {syncing && <span className="ml-2 text-sm text-blue-600">🔄 同步中...</span>}
            </h3>
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
                  <div className="inline-flex rounded-full border border-gray-300 overflow-hidden">
                    <button
                      className={`px-4 py-1 text-sm font-medium transition-colors ${
                        m.is_active 
                          ? 'bg-green-500 text-white' 
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={async()=>{
                        if (m.is_active) return; // 已经是激活状态，不需要重复点击
                        try {
                          const supabase = getSupabaseClient();
                          const { error } = await supabase
                            .from('household_members')
                            .update({ is_active: true })
                            .eq('id', m.id);
                          if (error) throw error;
                          
                          // 手动重新加载成员数据，确保界面立即更新
                          try {
                            setSyncing(true);
                            const data = await getFreshHouseholdMembers();
                            setMembers(data || []);
                            clearLocalFallbackData();
                          } catch {
                            try {
                              const r2 = await fetch('/api/members');
                              const j2 = await r2.json();
                              setMembers(j2.items || []);
                            } catch {}
                          } finally {
                            setSyncing(false);
                          }
                        } catch (error: any) {
                          console.error('更新成员状态失败:', error);
                        }
                      }}
                    >
                      本周吃饭
                    </button>
                    <button
                      className={`px-4 py-1 text-sm font-medium transition-colors ${
                        !m.is_active 
                          ? 'bg-gray-500 text-white' 
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={async()=>{
                        if (!m.is_active) return; // 已经是非激活状态，不需要重复点击
                        try {
                          const supabase = getSupabaseClient();
                          const { error } = await supabase
                            .from('household_members')
                            .update({ is_active: false })
                            .eq('id', m.id);
                          if (error) throw error;
                          
                          // 手动重新加载成员数据，确保界面立即更新
                          try {
                            setSyncing(true);
                            const data = await getFreshHouseholdMembers();
                            setMembers(data || []);
                            clearLocalFallbackData();
                          } catch {
                            try {
                              const r2 = await fetch('/api/members');
                              const j2 = await r2.json();
                              setMembers(j2.items || []);
                            } catch {}
                          } finally {
                            setSyncing(false);
                          }
                        } catch (error: any) {
                          console.error('更新成员状态失败:', error);
                        }
                      }}
                    >
                      不吃
                    </button>
                  </div>
                </div>
                <div className="text-right col-span-1 flex items-center justify-end gap-3">
                  {/* 值班人员标记 - 智能跨月分配逻辑 */}
                  <label className="inline-flex items-center gap-1 text-primary">
                    <input type="checkbox"
                      checked={!!staffSet[m.id]}
                      onChange={async(e)=>{
                        try {
                          const supabase = getSupabaseClient();
                          if (e.target.checked) {
                            // 获取当月的工作周数量
                            const currentMonthRanges = getRangesFor(assignYear, assignMonth);
                            const maxPossibleWeeks = currentMonthRanges.length;
                            
                            // 获取当前月份已有的最大周次
                            const { data: existingData } = await supabase
                              .from('duty_staff_assignments')
                              .select('week_in_month')
                              .eq('year', assignYear)
                              .eq('month', assignMonth)
                              .order('week_in_month', { ascending: false })
                              .limit(1);
                            
                            const maxWeek = existingData && existingData.length > 0 ? existingData[0].week_in_month : 0;
                            
                            let targetYear = assignYear;
                            let targetMonth = assignMonth;
                            let targetWeek = maxWeek + 1;
                            
                            // 检查是否需要跨月分配
                            if (maxWeek >= maxPossibleWeeks) {
                              // 当月工作周都分配完了，分配到下个月第1周
                              targetMonth = assignMonth === 12 ? 1 : assignMonth + 1;
                              targetYear = assignMonth === 12 ? assignYear + 1 : assignYear;
                              targetWeek = 1;
                              
                              console.log(`[智能跨月分配] ${m.name} 当月${assignYear}年${assignMonth}月已满(${maxWeek}/${maxPossibleWeeks}周)，分配到${targetYear}年${targetMonth}月第${targetWeek}周`);
                            } else {
                              console.log(`[新增值班人员] ${m.name} 分配到${targetYear}年${targetMonth}月第${targetWeek}周`);
                            }
                            
                            // 插入到目标月份
                            const { error } = await supabase
                              .from('duty_staff_assignments')
                              .insert({
                                member_id: m.id,
                                week_in_month: targetWeek,
                                year: targetYear,
                                month: targetMonth
                              });
                            
                            if (error) {
                              console.error('添加值班人员失败:', error);
                              alert(`添加值班人员失败：${error.message}\n\n请确保在 Supabase 中创建了 duty_staff_assignments 表`);
                              return;
                            }
                            
                            // 手动重新加载数据，确保界面立即更新
                            await reloadAssignments(assignYear, assignMonth);
                          } else {
                            // 从值班人员中移除 - 需要检查当月和下月
                            const supabase = getSupabaseClient();
                            
                            // 先尝试删除当月的
                            await supabase
                              .from('duty_staff_assignments')
                              .delete()
                              .eq('member_id', m.id)
                              .eq('year', assignYear)
                              .eq('month', assignMonth);
                            
                            // 再尝试删除下月的
                            const nextMonth = assignMonth === 12 ? 1 : assignMonth + 1;
                            const nextYear = assignMonth === 12 ? assignYear + 1 : assignYear;
                            await supabase
                              .from('duty_staff_assignments')
                              .delete()
                              .eq('member_id', m.id)
                              .eq('year', nextYear)
                              .eq('month', nextMonth);
                            
                            // 手动重新加载数据，确保界面立即更新
                            await reloadAssignments(assignYear, assignMonth);
                          }
                        } catch (error: any) {
                          console.error('值班人员操作失败:', error);
                          alert(`操作失败：${error.message}`);
                        }
                      }}
                    /> 值班人员
                  </label>
                  <button className="btn-link" onClick={async(e)=>{
                    const el = e.currentTarget as HTMLButtonElement;
                    const old = el.textContent;
                    el.textContent = '删除中...';
                    el.style.opacity = '0.7';
                    try {
                      const supabase = getSupabaseClient();
                      const { error } = await supabase
                        .from('household_members')
                        .delete()
                        .eq('id', m.id);
                      if (error) throw error;
                      
                      // 手动重新加载成员数据，确保界面立即更新
                      try {
                        setSyncing(true);
                        const data = await getFreshHouseholdMembers();
                        setMembers(data || []);
                        clearLocalFallbackData();
                      } catch {
                        try {
                          const r2 = await fetch('/api/members');
                          const j2 = await r2.json();
                          setMembers(j2.items || []);
                        } catch {}
                      } finally {
                        setSyncing(false);
                      }
                    } catch (error: any) {
                      console.error('删除成员失败:', error);
                    }
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
              try {
                const supabase = getSupabaseClient();
                const { error } = await supabase
                  .from('household_members')
                  .insert({ name: newName.trim(), is_active: true });
                
                if (error) throw error;
                
                setNewName('');
                
                // 手动重新加载成员数据，确保界面立即更新
                try {
                  setSyncing(true);
                  const data = await getFreshHouseholdMembers();
                  setMembers(data || []);
                  clearLocalFallbackData();
                } catch {
                  try {
                    const r2 = await fetch('/api/members');
                    const j2 = await r2.json();
                    setMembers(j2.items || []);
                  } catch {}
                } finally {
                  setSyncing(false);
                }
              } catch (error: any) {
                console.error('添加成员失败:', error);
                alert(`添加成员失败：${error.message}`);
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
            <button className="badge badge-muted" onClick={() => {
              // 限制：不允许回到2025年8月之前
              if (assignYear === 2025 && assignMonth === 8) {
                alert('不能回到2025年8月之前');
                return;
              }
              
              if (assignMonth === 1) {
                setAssignYear(assignYear - 1);
                setAssignMonth(12);
              } else {
                setAssignMonth(assignMonth - 1);
              }
            }}>上月</button>
            <span className="font-medium">{assignYear}年{assignMonth}月</span>
            <button className="badge badge-muted" onClick={() => {
              if (assignMonth === 12) {
                setAssignYear(assignYear + 1);
                setAssignMonth(1);
              } else {
                setAssignMonth(assignMonth + 1);
              }
            }}>下月</button>
            <button className="badge badge-muted" onClick={async()=>{ await reloadAssignments(assignYear, assignMonth); await reloadPayStatus(assignYear, assignMonth); }}>刷新</button>
            <button className="badge badge-primary" onClick={async()=>{
              // 计算上个月
              const prevMonth = assignMonth === 1 ? 12 : assignMonth - 1;
              const prevYear = assignMonth === 1 ? assignYear - 1 : assignYear;
              
              if (!confirm(`确定要从 ${prevYear}年${prevMonth}月 手动复制值班安排到 ${assignYear}年${assignMonth}月 吗？\n\n注意：这会覆盖当月现有的值班安排。`)) return;
              
              try {
                const supabase = getSupabaseClient();
                
                // 1. 获取上个月的值班安排
                const { data: prevData, error: prevError } = await supabase
                  .from('duty_staff_assignments')
                  .select('member_id, week_in_month')
                  .eq('year', prevYear)
                  .eq('month', prevMonth);
                
                if (prevError) throw prevError;
                
                if (!prevData || prevData.length === 0) {
                  alert(`${prevYear}年${prevMonth}月 没有值班数据，无法复制！`);
                  return;
                }
                
                // 2. 清除当月所有值班安排
                const { error: deleteError } = await supabase
                  .from('duty_staff_assignments')
                  .delete()
                  .eq('year', assignYear)
                  .eq('month', assignMonth);
                
                if (deleteError) throw deleteError;
                console.log(`已清除 ${assignYear}年${assignMonth}月 的所有值班安排`);
                
                // 3. 获取当月的工作周数量，确保周次分配合理
                const currentMonthRanges = getRangesFor(assignYear, assignMonth);
                const maxWeeksInCurrentMonth = currentMonthRanges.length;
                
                // 4. 复制上个月的值班安排到当月
                const copiedAssignments = prevData.map(item => {
                  // 如果上个月的周次超过当月最大周数，调整到当月最后一周
                  const adjustedWeek = item.week_in_month > maxWeeksInCurrentMonth 
                    ? maxWeeksInCurrentMonth 
                    : item.week_in_month;
                    
                  return {
                    member_id: item.member_id,
                    year: assignYear,
                    month: assignMonth,
                    week_in_month: adjustedWeek
                  };
                });
                
                // 5. 批量插入复制的值班安排
                const { error: insertError } = await supabase
                  .from('duty_staff_assignments')
                  .insert(copiedAssignments);
                
                if (insertError) throw insertError;
                
                // 6. 重新加载数据
                await reloadAssignments(assignYear, assignMonth);
                await reloadPayStatus(assignYear, assignMonth);
                
                alert(`✅ 已成功从 ${prevYear}年${prevMonth}月 复制 ${copiedAssignments.length} 个值班人员到 ${assignYear}年${assignMonth}月！`);
              } catch (error: any) {
                console.error('手动复制失败:', error);
                alert(`手动复制失败：${error.message}`);
              }
            }}>手动复制上月值班</button>
            <div className="text-muted">在"成员列表"中添加/删除成员；这里只显示已分配周次的值班成员</div>
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
              {(() => {
                const filteredMembers = members.filter(m => !!staffSet[m.id]);
                
                // 🎯 用户指定的固定顺序
                const preferredOrder = ['正方形', '兔子', '阿源', '陶子', '大呲花', 'Ethan'];
                
                const sortedMembers = filteredMembers.sort((a, b) => {
                  // 1. 获取在首选顺序中的位置
                  const aIndex = preferredOrder.indexOf(a.name);
                  const bIndex = preferredOrder.indexOf(b.name);
                  
                  // 2. 如果都在首选列表中，按首选顺序排序
                  if (aIndex !== -1 && bIndex !== -1) {
                    return aIndex - bIndex;
                  }
                  
                  // 3. 如果只有一个在首选列表中，首选的排在前面
                  if (aIndex !== -1 && bIndex === -1) {
                    return -1; // a排在前面
                  }
                  if (aIndex === -1 && bIndex !== -1) {
                    return 1; // b排在前面
                  }
                  
                  // 4. 如果都不在首选列表中，按名称排序（新增人员）
                  return a.name.localeCompare(b.name, 'zh-CN');
                });
                
                // 调试信息
                console.log(`${assignYear}年${assignMonth}月 用户指定顺序结果:`, 
                  sortedMembers.map(m => ({ 
                    name: m.name, 
                    week: staffAssign[m.id],
                    orderIndex: preferredOrder.indexOf(m.name)
                  }))
                );
                
                return sortedMembers;
              })().map(m => (
                <tr key={`assign-${m.id}`}>
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-neutral-900">{m.name}</td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-neutral-500">{m.role || '成员'}</td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm">
                    <select
                      value={staffAssign[m.id] ?? ''}
                      onChange={async(e)=>{
                        const v = e.target.value ? parseInt(e.target.value) : null;
                        
                        // 立即更新本地状态，提供即时反馈
                        setStaffAssign(prev => ({ ...prev, [m.id]: v }));
                        
                        try {
                          const supabase = getSupabaseClient();
                          
                          // 先清除该成员在当月和下月的所有记录，避免冲突
                          const nextMonth = assignMonth === 12 ? 1 : assignMonth + 1;
                          const nextYear = assignMonth === 12 ? assignYear + 1 : assignYear;
                          
                          await supabase
                            .from('duty_staff_assignments')
                            .delete()
                            .eq('member_id', m.id)
                            .eq('year', assignYear)
                            .eq('month', assignMonth);
                          
                          await supabase
                            .from('duty_staff_assignments')
                            .delete()
                            .eq('member_id', m.id)
                            .eq('year', nextYear)
                            .eq('month', nextMonth);
                          
                          // 根据新值插入记录
                          if (v !== null) {
                            if (v < 0) {
                              // 负数表示分配到下月
                              const nextWeek = Math.abs(v);
                              await supabase
                                .from('duty_staff_assignments')
                                .insert({
                                  member_id: m.id,
                                  week_in_month: nextWeek,
                                  year: nextYear,
                                  month: nextMonth
                                });
                              console.log(`✅ ${m.name} 已分配到 ${nextYear}年${nextMonth}月第${nextWeek}周`);
                            } else {
                              // 正数表示分配到当月
                              await supabase
                                .from('duty_staff_assignments')
                                .insert({
                                  member_id: m.id,
                                  week_in_month: v,
                                  year: assignYear,
                                  month: assignMonth
                                });
                              console.log(`✅ ${m.name} 已分配到 ${assignYear}年${assignMonth}月第${v}周`);
                            }
                          } else {
                            console.log(`✅ ${m.name} 已从值班安排中移除`);
                          }
                          
                          // 手动触发数据重新加载，确保界面立即更新
                          await reloadAssignments(assignYear, assignMonth);
                          
                        } catch (error: any) {
                          console.error('更新值班安排失败:', error);
                          alert(`更新失败：${error.message}`);
                          // 发生错误时恢复原值
                          await reloadAssignments(assignYear, assignMonth);
                        }
                      }}
                      className="select-interactive font-semibold"
                      style={getWeekStyle(Math.abs(staffAssign[m.id] || 0))}
                    >
                      <option value="">未分配</option>
                      {workWeekRanges.map((w, idx)=> (
                        <option key={idx} value={idx+1} style={getWeekStyle(idx+1)}>
                          {w.label}
                        </option>
                      ))}
                      {/* 显示下个月的周次选项 */}
                      {(() => {
                        const nextMonth = assignMonth === 12 ? 1 : assignMonth + 1;
                        const nextYear = assignMonth === 12 ? assignYear + 1 : assignYear;
                        const nextMonthRanges = getRangesFor(nextYear, nextMonth);
                        
                        return nextMonthRanges.slice(0, 2).map((w, idx) => (
                          <option key={`next-${idx}`} value={-(idx + 1)} style={getWeekStyle(idx + 1)}>
                            {w.label} (下月)
                          </option>
                        ));
                      })()}
                    </select>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-right text-sm space-x-2">
                    <button className="badge badge-muted" onClick={async()=>{
                      try {
                        const supabase = getSupabaseClient();
                        // 从值班人员列表中移除（删除记录）
                        await supabase
                          .from('duty_staff_assignments')
                          .delete()
                          .eq('member_id', m.id)
                          .eq('year', assignYear)
                          .eq('month', assignMonth);
                        await reloadAssignments(assignYear, assignMonth);
                      } catch (error: any) {
                        console.error('移除值班人员失败:', error);
                        alert(`移除失败：${error.message}`);
                      }
                    }}>移除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
