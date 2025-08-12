"use client";
import Shell from "../dashboard/Shell";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRealtimeSubscription } from "@/lib/useRealtimeSubscription";
import { getFreshHouseholdMembers, clearLocalFallbackData } from "@/lib/dataUtils";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { autoEnsureCurrentAndFutureMonths } from "@/lib/dutyAutoExtension";

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
  const [loadingStates, setLoadingStates] = useState({
    members: true,
    assignments: true,
    payments: true,
    headcount: true,
    dutyWeek: true
  });
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

  // 🚀 优化后的值班安排加载 - 并行查询，减少延迟
  const reloadAssignments = async (year: number, month: number) => {
    try {
      const supabase = getSupabaseClient();
      const startTime = performance.now();
      
      console.log(`🔍 [优化] 并行加载 ${year}年${month}月 值班安排...`);
      
      // 🎯 关键优化：并行查询当月和下月数据
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      
      const [currentResult, nextMonthResult] = await Promise.allSettled([
        // 当月数据
        supabase
          .from('duty_staff_assignments')
          .select('member_id, week_in_month')
          .eq('year', year)
          .eq('month', month),
        
        // 下月前2周数据（用于跨月显示）
        supabase
          .from('duty_staff_assignments')
          .select('member_id, week_in_month')
          .eq('year', nextYear)
          .eq('month', nextMonth)
          .lte('week_in_month', 2)
      ]);
      
      // 处理当月数据
      const currentData = currentResult.status === 'fulfilled' && !currentResult.value.error 
        ? currentResult.value.data || []
        : [];
      
      // 处理下月数据
      const nextMonthData = nextMonthResult.status === 'fulfilled' && !nextMonthResult.value.error
        ? nextMonthResult.value.data || []
        : [];
      
      // 如果当月没有数据，返回空状态
      if (currentData.length === 0) {
        console.log(`📋 ${year}年${month}月 无值班安排，返回空状态`);
        setStaffAssign({});
        setStaffSet({});
        return;
      }
      
      // 🎯 优化：使用Map提高处理效率
      const serverMap: Record<string, number|null> = {};
      const serverPresent: Record<string, boolean> = {};
      
      // 处理当月数据
      currentData.forEach((x: any) => { 
        serverMap[x.member_id] = x.week_in_month ?? null; 
        serverPresent[x.member_id] = true; 
      });

      // 处理下月数据（显示为负数，表示下月）
      nextMonthData.forEach((x: any) => {
        if (!serverPresent[x.member_id]) { // 避免重复
          serverMap[x.member_id] = -(x.week_in_month ?? 0); // 负数表示下月
          serverPresent[x.member_id] = true;
        }
      });

      setStaffAssign(serverMap);
      setStaffSet(serverPresent);
      
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      
      console.log(`✅ [优化] ${year}年${month}月 值班安排加载完成 (${loadTime}ms):`, { 
        当月记录: currentData.length,
        下月前2周: nextMonthData.length,
        总人员: Object.keys(serverPresent).length
      });
    } catch (error) {
      console.error('❌ 加载值班安排失败:', error);
      // 设置空状态，避免界面卡住
      setStaffAssign({});
      setStaffSet({});
    }
  };

  const reloadPayStatus = async (year: number, month: number) => {
    try {
      const supabase = getSupabaseClient();
      const startTime = performance.now();
      
      console.log(`🔍 [优化] 加载 ${year}年${month}月 付款状态...`);
      
      // 🎯 优化：只查询必要字段，减少数据传输
      const { data, error } = await supabase
        .from('member_payments')
        .select('member_id, paid')
        .eq('year', year)
        .eq('month', month);

      if (error) throw error;

      // 🎯 优化：使用Map提高处理效率
      const map: Record<string, boolean> = {};
      (data || []).forEach((x: any) => { map[x.member_id] = !!x.paid; });
      setPayMap(map);
      
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      
      console.log(`✅ [优化] ${year}年${month}月 付款状态加载完成 (${loadTime}ms):`, {
        付款记录: data?.length || 0
      });
    } catch (error) {
      console.error('❌ 加载付款状态失败:', error);
      setPayMap({}); // 设置空状态，避免界面异常
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
      console.log('🚀 [PeoplePage] 开始并行加载数据...');
      const startTime = performance.now();
      
      // 🎯 关键优化：将自动延续系统移到后台执行，不阻塞页面加载
      const autoExtensionPromise = autoEnsureCurrentAndFutureMonths().catch(err => {
        console.warn('⚠️ 自动延续系统执行失败（不影响页面加载）:', err);
      });
      
      // 🚀 并行加载所有必需数据，带进度跟踪
      const [
        headcountResult,
        membersResult,
        dutyWeekResult,
        assignmentsResult,
        payStatusResult
      ] = await Promise.allSettled([
        // 1. 头数统计
        fetch("/api/headcount/today").then(res => res.json()).then(data => {
          setLoadingStates(prev => ({ ...prev, headcount: false }));
          return data;
        }),
        
        // 2. 成员数据（优化兜底逻辑）
        (async () => {
          try {
            setSyncing(true);
            const data = await getFreshHouseholdMembers();
            setLoadingStates(prev => ({ ...prev, members: false }));
            return { data: data || [], source: 'fresh' };
          } catch {
            try {
              const r2 = await fetch('/api/members');
              const j2 = await r2.json();
              setLoadingStates(prev => ({ ...prev, members: false }));
              return { data: j2.items || [], source: 'api' };
            } catch {
              setLoadingStates(prev => ({ ...prev, members: false }));
              return { data: [], source: 'fallback' };
            }
          }
        })(),
        
        // 3. 值班周数据（延迟获取weekNumber）
        (async () => {
          try {
            const headcount = await fetch("/api/headcount/today").then(res => res.json());
            const r3 = await fetch(`/api/duty/weeks?weekNumber=${headcount.weekNumber || weekNumber}`);
            const result = await r3.json();
            setLoadingStates(prev => ({ ...prev, dutyWeek: false }));
            return result;
          } catch {
            setLoadingStates(prev => ({ ...prev, dutyWeek: false }));
            return { item: null };
          }
        })(),
        
        // 4. 值班安排
        (async () => {
          try {
            await reloadAssignments(assignYear, assignMonth);
            setLoadingStates(prev => ({ ...prev, assignments: false }));
            return { success: true };
          } catch (err) {
            console.warn('值班安排加载失败:', err);
            setLoadingStates(prev => ({ ...prev, assignments: false }));
            return { success: false };
          }
        })(),
        
        // 5. 付款状态
        (async () => {
          try {
            await reloadPayStatus(assignYear, assignMonth);
            setLoadingStates(prev => ({ ...prev, payments: false }));
            return { success: true };
          } catch (err) {
            console.warn('付款状态加载失败:', err);
            setLoadingStates(prev => ({ ...prev, payments: false }));
            return { success: false };
          }
        })()
      ]);
      
      // 处理头数统计结果
      if (headcountResult.status === 'fulfilled') {
        const j = headcountResult.value;
        if (j.weekNumber) setWeekNumber(j.weekNumber);
        if (typeof j.base === 'number') setBase(j.base);
        if (typeof j.delta === 'number') setDelta(j.delta);
        if (typeof j.todayCount === 'number') setTodayCount(j.todayCount);
        console.log('✅ 头数统计加载完成');
      } else {
        console.warn('⚠️ 头数统计加载失败:', headcountResult.reason);
      }
      
      // 处理成员数据结果
      if (membersResult.status === 'fulfilled') {
        const result = membersResult.value;
        setMembers(result.data);
        if (result.source === 'fresh') {
          clearLocalFallbackData();
        }
        console.log(`✅ 成员数据加载完成 (${result.data.length}个成员，来源: ${result.source})`);
      } else {
        console.warn('⚠️ 成员数据加载失败:', membersResult.reason);
        setMembers([]);
      }
      setSyncing(false);
      
      // 处理值班周数据结果
      if (dutyWeekResult.status === 'fulfilled') {
        const j3 = dutyWeekResult.value;
        setDutyWeek(j3.item || null);
        console.log('✅ 值班周数据加载完成');
      } else {
        console.warn('⚠️ 值班周数据加载失败:', dutyWeekResult.reason);
      }
      
      // 记录加载性能
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.log(`🎉 [PeoplePage] 并行加载完成，耗时: ${loadTime}ms`);
      console.log('📊 加载结果统计:', {
        头数统计: headcountResult.status,
        成员数据: membersResult.status,
        值班周: dutyWeekResult.status,
        值班安排: assignmentsResult.status,
        付款状态: payStatusResult.status
      });
      
      // 🔄 后台执行自动延续系统（不阻塞用户交互）
      autoExtensionPromise.then(() => {
        console.log('✅ 后台自动延续系统执行完成');
      });
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-900/30 via-purple-900/30 to-indigo-900/30 border border-purple-700/30 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-xl p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              成员列表
              {loadingStates.members && <span className="ml-2 text-sm text-blue-300 animate-pulse">🔄 加载中...</span>}
              {syncing && <span className="ml-2 text-sm text-blue-300">🔄 同步中...</span>}
            </h3>
            <div className="text-purple-400/70 font-medium flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span>活跃人数</span>
                <span className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 px-2 py-1 rounded-full text-sm font-semibold" aria-label="活跃人数">{members.filter(m => m.is_active).length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>总人数</span>
                <span className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-purple-300 px-2 py-1 rounded-full text-sm font-semibold" aria-label="总人数">{members.length}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2 max-h-96 overflow-auto pr-2">
            {members.map(m => (
              <div key={m.id} className="grid grid-cols-4 items-center text-sm py-2 border-b border-purple-700/20 last:border-b-0">
                <div className="truncate col-span-2 text-purple-100 font-medium flex items-center gap-2">
                  {/* 头像 */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
                    {m.name.charAt(0)}
                  </div>
                  <span>{m.name}</span>
                </div>
                <div className="text-right col-span-2">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition-all duration-200 min-w-[80px] ${
                        m.is_active
                          ? 'bg-green-100 text-green-600 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      onClick={async()=>{
                        try {
                          const supabase = getSupabaseClient();
                          const { error } = await supabase
                            .from('household_members')
                            .update({ is_active: !m.is_active })
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
                      <span>{m.is_active ? '🍽️' : '🚫'}</span>
                      <span className="font-medium">{m.is_active ? '吃饭' : '不吃'}</span>
                    </button>
                    {/* 值班人员标记 - 智能跨月分配逻辑 */}
                    <button
                      className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition-all duration-200 min-w-[80px] ${
                        !!staffSet[m.id]
                          ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      onClick={async()=>{
                        try {
                          const supabase = getSupabaseClient();
                          if (!staffSet[m.id]) {
                            // 添加到值班人员 - 先清除可能存在的记录，避免唯一约束冲突
                            console.log(`[添加值班人员] 开始为 ${m.name} 添加值班安排`);
                            
                            // 1. 先清除该成员在当月和下月的所有记录，避免约束冲突
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
                            
                            console.log(`[清理完成] 已清除 ${m.name} 在 ${assignYear}年${assignMonth}月 和 ${nextYear}年${nextMonth}月 的记录`);
                            
                            // 2. 获取当月的工作周数量
                            const currentMonthRanges = getRangesFor(assignYear, assignMonth);
                            const maxPossibleWeeks = currentMonthRanges.length;
                            
                            // 3. 获取当前月份已有的最大周次
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
                            
                            // 4. 检查是否需要跨月分配
                            if (maxWeek >= maxPossibleWeeks) {
                              // 当月工作周都分配完了，分配到下个月第1周
                              targetMonth = assignMonth === 12 ? 1 : assignMonth + 1;
                              targetYear = assignMonth === 12 ? assignYear + 1 : assignYear;
                              targetWeek = 1;
                              
                              console.log(`[智能跨月分配] ${m.name} 当月${assignYear}年${assignMonth}月已满(${maxWeek}/${maxPossibleWeeks}周)，分配到${targetYear}年${targetMonth}月第${targetWeek}周`);
                            } else {
                              console.log(`[新增值班人员] ${m.name} 分配到${targetYear}年${targetMonth}月第${targetWeek}周`);
                            }
                            
                            // 5. 插入到目标月份
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
                              alert(`添加值班人员失败：${error.message}\n\n详细信息：${JSON.stringify(error, null, 2)}`);
                              return;
                            }
                            
                            console.log(`[添加成功] ${m.name} 已成功添加到 ${targetYear}年${targetMonth}月第${targetWeek}周`);
                            
                            // 6. 手动重新加载数据，确保界面立即更新
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
                    >
                      <span>{!!staffSet[m.id] ? '👷‍♂️' : '👤'}</span>
                      <span className="font-medium">值班</span>
                    </button>
                  <button 
                    className="flex items-center gap-1 px-3 py-1.5 rounded text-sm bg-red-100 text-red-600 hover:bg-red-200 cursor-pointer transition-all duration-200 min-w-[80px]" 
                    onClick={async(e)=>{
                      if (!confirm(`确定要删除成员"${m.name}"吗？`)) return;
                      
                      const el = e.currentTarget as HTMLButtonElement;
                      const old = el.innerHTML;
                      el.innerHTML = '<span>⏳</span><span class="font-medium">删除中...</span>';
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
                        alert(`删除失败：${error.message}`);
                      }
                      el.innerHTML = old;
                      el.style.opacity = '1';
                    }}
                  >
                    <span>🗑️</span>
                    <span className="font-medium">删除</span>
                  </button>
                  </div>
                </div>
              </div>
            ))}
            {members.length === 0 && <div className="text-purple-400/70 text-sm">暂无成员</div>}
          </div>
          <div className="mt-8 bg-gradient-to-br from-blue-800/20 via-purple-800/20 to-indigo-800/20 border border-purple-600/30 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-purple-200 flex items-center gap-2">
                <span>👤</span>
                <span>添加新成员</span>
              </h4>
              <span className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-purple-300 px-2 py-1 rounded-full text-xs font-semibold">新增</span>
            </div>
            <div className="flex items-center gap-3">
              <input 
                value={newName} 
                onChange={e=>setNewName(e.target.value)} 
                placeholder="请输入成员姓名..." 
                className="flex-1 bg-gradient-to-r from-blue-800/30 to-purple-800/30 border border-purple-600/30 rounded-lg px-4 py-2 text-purple-100 placeholder-purple-400/70 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200" 
                onKeyPress={e => e.key === 'Enter' && newName.trim() && document.getElementById('add-member-btn')?.click()}
              />
              <button 
                id="add-member-btn"
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-600 hover:from-blue-600 hover:via-purple-600 hover:to-indigo-700 text-white cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95" 
                disabled={!newName.trim() || syncing}
                onClick={async()=>{
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
                }}
              >
                <span>➕</span>
                <span className="font-medium">{syncing ? '添加中...' : '添加成员'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-900/30 via-purple-900/30 to-indigo-900/30 border border-purple-700/30 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-xl p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">值班人员</h3>
            <div className="flex items-center gap-2 text-sm">
              <button 
                className="flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-purple-300 hover:from-blue-500/30 hover:to-purple-500/30 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md backdrop-blur-sm border border-purple-500/30" 
                onClick={() => {
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
                }}
              >
                <span>⬅️</span>
              </button>
              <span className="font-bold text-lg bg-gradient-to-r from-blue-300 via-purple-300 to-indigo-300 bg-clip-text text-transparent">{assignYear}年{assignMonth}月</span>
              <button 
                className="flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-purple-300 hover:from-blue-500/30 hover:to-purple-500/30 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md backdrop-blur-sm border border-purple-500/30" 
                onClick={() => {
                  if (assignMonth === 12) {
                    setAssignYear(assignYear + 1);
                    setAssignMonth(1);
                  } else {
                    setAssignMonth(assignMonth + 1);
                  }
                }}
              >
                <span>➡️</span>
              </button>
            </div>
            <button 
              className="flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-indigo-500/20 text-purple-300 hover:from-blue-500/30 hover:via-purple-500/30 hover:to-indigo-500/30 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md backdrop-blur-sm border border-purple-500/30" 
              onClick={async()=>{
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
            }}
            >
              <span>📋</span>
              <span className="font-medium">复制上月值班</span>
            </button>
          </div>
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-purple-700/20">
            <thead className="bg-gradient-to-r from-blue-800/20 via-purple-800/20 to-indigo-800/20 backdrop-blur-sm">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">姓名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">负责周次</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-purple-300 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-gradient-to-br from-blue-900/10 via-purple-900/10 to-indigo-900/10 divide-y divide-purple-700/20 backdrop-blur-sm">
              {Object.keys(staffAssign).length === 0 && (
                <tr><td colSpan={3} className="px-6 py-6 text-center text-sm text-purple-400/70">本月暂无值班人员</td></tr>
              )}
              {(() => {
                const filteredMembers = members.filter(m => !!staffSet[m.id]);
                
                // 🎯 智能排序：未分配时间按首字母，分配后按时间
                const sortedMembers = filteredMembers.sort((a, b) => {
                  const aWeek = staffAssign[a.id];
                  const bWeek = staffAssign[b.id];
                  
                  // 检查是否都已分配时间（null、undefined、0都视为未分配）
                  const aHasTime = aWeek !== null && aWeek !== undefined && aWeek !== 0;
                  const bHasTime = bWeek !== null && bWeek !== undefined && bWeek !== 0;
                  
                  // 如果都未分配时间，按首字母排序
                  if (!aHasTime && !bHasTime) {
                    return a.name.localeCompare(b.name, 'zh-CN');
                  }
                  
                  // 如果都已分配时间，按时间先后排序
                  if (aHasTime && bHasTime) {
                    // 处理负数（下月）和正数（当月）的排序
                    const aSort = aWeek < 0 ? Math.abs(aWeek) + 100 : aWeek;
                    const bSort = bWeek < 0 ? Math.abs(bWeek) + 100 : bWeek;
                    
                    if (aSort !== bSort) {
                      return aSort - bSort;
                    }
                    // 时间相同时按首字母排序
                    return a.name.localeCompare(b.name, 'zh-CN');
                  }
                  
                  // 混合情况：已分配时间的排在前面，未分配的排在后面
                  if (aHasTime && !bHasTime) {
                    return -1; // a排在前面
                  }
                  if (!aHasTime && bHasTime) {
                    return 1; // b排在前面
                  }
                  
                  return 0;
                });
                
                // 调试信息
                console.log(`${assignYear}年${assignMonth}月 智能排序结果:`, 
                  sortedMembers.map(m => {
                    const week = staffAssign[m.id];
                    const hasTime = week !== null && week !== undefined && week !== 0;
                    return {
                      name: m.name, 
                      week: week,
                      hasTime: hasTime,
                      sortType: hasTime ? '按时间' : '按首字母'
                    };
                  })
                );
                
                return sortedMembers;
              })().map(m => (
                <tr key={`assign-${m.id}`} className="hover:bg-gradient-to-r hover:from-blue-800/10 hover:via-purple-800/10 hover:to-indigo-800/10 transition-colors duration-200">
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-purple-100 flex items-center gap-2">
                    {/* 头像 */}
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      {m.name.charAt(0)}
                    </div>
                    <span>{m.name}</span>
                  </td>
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
                          
                          // 总是插入记录，保持人员在值班列表中
                          if (v === null) {
                            // 选择"未分配"：插入记录但week_in_month为null
                            await supabase
                              .from('duty_staff_assignments')
                              .insert({
                                member_id: m.id,
                                week_in_month: null,
                                year: assignYear,
                                month: assignMonth
                              });
                            console.log(`✅ ${m.name} 已设置为未分配状态，保留在值班列表中`);
                          } else if (v < 0) {
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
                          
                          // 手动触发数据重新加载，确保界面立即更新
                          await reloadAssignments(assignYear, assignMonth);
                          
                        } catch (error: any) {
                          console.error('更新值班安排失败:', error);
                          alert(`更新失败：${error.message}`);
                          // 发生错误时恢复原值
                          await reloadAssignments(assignYear, assignMonth);
                        }
                      }}
                      className="bg-gradient-to-r from-blue-800/30 to-purple-800/30 border border-purple-600/30 rounded-lg px-3 py-2 text-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200 font-semibold"
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
                  <td className="px-6 py-3 whitespace-nowrap text-right text-sm">
                    <div className="flex justify-end">
                      <button 
                        className="flex items-center gap-1 px-3 py-1.5 rounded text-sm min-w-[80px] bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-purple-300 hover:from-blue-500/30 hover:to-purple-500/30 cursor-pointer transition-all duration-200 backdrop-blur-sm border border-purple-500/30" 
                        onClick={async()=>{
                          if (!confirm(`确定要清空"${m.name}"的时间分配吗？\n\n清空后该人员仍在值班列表中，但时间显示为"未分配"。`)) return;
                          
                          try {
                            const supabase = getSupabaseClient();
                            
                            // 清空时间分配：将week_in_month设为null，保留人员记录
                            const { error } = await supabase
                              .from('duty_staff_assignments')
                              .update({ week_in_month: null })
                              .eq('member_id', m.id)
                              .eq('year', assignYear)
                              .eq('month', assignMonth);
                            
                            if (error) throw error;
                            
                            // 同时清空下月的分配（如果有的话）
                            const nextMonth = assignMonth === 12 ? 1 : assignMonth + 1;
                            const nextYear = assignMonth === 12 ? assignYear + 1 : assignYear;
                            
                            await supabase
                              .from('duty_staff_assignments')
                              .update({ week_in_month: null })
                              .eq('member_id', m.id)
                              .eq('year', nextYear)
                              .eq('month', nextMonth);
                            
                            await reloadAssignments(assignYear, assignMonth);
                            console.log(`✅ 已清空 ${m.name} 的时间分配，保留在值班列表中`);
                          } catch (error: any) {
                            console.error('清空时间分配失败:', error);
                            alert(`清空失败：${error.message}`);
                          }
                        }}
                      >
                        <span>🔄</span>
                        <span className="font-medium">清空</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </Shell>
  );
}
