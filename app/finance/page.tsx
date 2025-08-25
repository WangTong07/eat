"use client";
import Shell from "../dashboard/Shell";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useRealtimeSubscription } from "@/lib/useRealtimeSubscription";
import MonthlyComparisonCard from "../components/MonthlyComparisonCard";
import RecurringExpenseManager from "../components/RecurringExpenseManager";
import { autoExecuteRecurringExpenses, getCurrentCycle } from "@/app/lib/autoRecurringExpenses";
// 移除重复导入的getSupabaseClient

// 固定月费（按工作日分摊）
const MONTH_PRICE = 920;

type Expense = { id:string; date:string; description:string; amount:number; handler?:string; week_number?:number; attachments?:Array<{url:string,name?:string}> };

export default function FinancePage(){
  const [date,setDate]=useState(()=> new Date().toISOString().slice(0,10));
  const [desc,setDesc]=useState("");
  const [amount,setAmount]=useState("");
  const [handler,setHandler]=useState("");
  const [files,setFiles]=useState<File[]>([]);
  const [staffList, setStaffList] = useState<string[]>([]);
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [filteredStaff, setFilteredStaff] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement|null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [showExpense, setShowExpense] = useState<boolean>(false);
  const [payRefreshKey, setPayRefreshKey] = useState<number>(0);
  const [linkedBudget, setLinkedBudget] = useState<number>(0);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const ym = useMemo(()=>{ const d=new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; },[date]);
  const [items,setItems]=useState<Expense[]>([]);
  const [weekly,setWeekly]=useState<Array<{week_number:number,amount_sum:number}>>([]);
  
  // 21号周期计算辅助函数
  const getCycleRange = useCallback((yearMonth: string) => {
    const [year, month] = yearMonth.split('-').map(v => parseInt(v));
    
    // 修复：21号周期应该是本月21号到次月20号
    // 如果用户选择"2025-08"，应该查询2025年8月21号到2025年9月20号的数据
    const startDate = new Date(year, month - 1, 21); // month-1 表示本月21号
    const endDate = new Date(year, month, 20);       // month 表示次月20号
    
    return {
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10)
    };
  }, []);
  
  // 计算当前周期总支出
  const currentMonthTotal = useMemo(() => {
    const { startDate, endDate } = getCycleRange(ym);
    return items
      .filter(item => item.date >= startDate && item.date <= endDate)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [items, ym, getCycleRange]);
  
  // 当前周期标识
  const currentMonth = ym;

  const fetchList = useCallback(async (skipAutoExecute = false) => {
    try {
      console.log(`[FinancePage] 开始加载支出数据，周期: ${ym}, 跳过自动执行: ${skipAutoExecute}`);
      
      const supabase = getSupabaseClient();
      const { startDate, endDate } = getCycleRange(ym);
      
      console.log(`[FinancePage] 查询支出数据，时间范围: ${startDate} 到 ${endDate}`);
      
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });
      
      if (error) throw error;
      
      console.log(`[FinancePage] 查询到 ${data?.length || 0} 条支出记录`);
      
      // 统计固定支出
      const recurringExpenses = data?.filter(e => e.is_recurring) || [];
      console.log(`[FinancePage] 其中固定支出: ${recurringExpenses.length} 条`);
      
      setItems(data || []);
      
      // 清理本地兜底数据
      try {
        const localKey = `expenses_local_${ym}`;
        localStorage.removeItem(localKey);
      } catch {}
    } catch (error) {
      console.error('获取支出记录失败:', error);
      setItems([]);
    }
  }, [ym, getCycleRange]);
  const fetchWeekly = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { startDate, endDate } = getCycleRange(ym);
      
      // 只查询 date 和 amount，然后在前端计算周数
      const { data, error } = await supabase
        .from('expenses')
        .select('date, amount')
        .gte('date', startDate)
        .lte('date', endDate);
      
      if (error) throw error;
      
      // 按周数汇总（在前端计算周数）
      const weekMap: Record<number, number> = {};
      (data || []).forEach(item => {
        if (item.date) {
          const weekNumber = isoWeekNumberFromString(item.date);
          weekMap[weekNumber] = (weekMap[weekNumber] || 0) + Number(item.amount || 0);
        }
      });
      
      const weeklyData = Object.keys(weekMap).map(weekNum => ({
        week_number: parseInt(weekNum),
        amount_sum: weekMap[parseInt(weekNum)]
      })).sort((a, b) => a.week_number - b.week_number);
      
      setWeekly(weeklyData);
    } catch (error) {
      console.error('获取周汇总失败:', error);
      setWeekly([]);
    }
  }, [ym, getCycleRange]);

  useEffect(()=>{ 
    fetchList(); 
    fetchWeekly(); 
  },[ym]); // 只依赖 ym，避免无限循环

  // 获取值班人员名单
  useEffect(() => {
    async function fetchStaffList() {
      try {
        const response = await fetch('/api/duty/staff');
        if (response.ok) {
          const data = await response.json();
          // 提取所有值班人员的姓名，去重
          const names = [...new Set(data.flatMap((item: any) => [
            item.morning_staff,
            item.afternoon_staff,
            item.evening_staff
          ]).filter(Boolean))];
          setStaffList(names);
          setFilteredStaff(names);
        }
      } catch (error) {
        console.error('获取值班人员失败:', error);
      }
    }
    fetchStaffList();
  }, []);

  // 处理经手人输入变化
  const handleHandlerChange = (value: string) => {
    setHandler(value);
    if (value.trim()) {
      const filtered = staffList.filter(name => 
        name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredStaff(filtered);
      setShowStaffDropdown(filtered.length > 0);
    } else {
      setFilteredStaff(staffList);
      setShowStaffDropdown(false);
    }
  };

  // 选择值班人员
  const selectStaff = (name: string) => {
    setHandler(name);
    setShowStaffDropdown(false);
  };

  // 添加实时订阅 - 使用防抖避免频繁刷新
  const handleRealtimeChange = useCallback(() => {
    console.log('[FinancePage] 检测到支出记录变更，重新加载...');
    // 防抖处理，避免频繁刷新
    setTimeout(() => {
      fetchList(true); // 跳过自动执行
      fetchWeekly();
      setRefreshKey(k => k + 1);
    }, 1000);
  }, [fetchList, fetchWeekly]);

  useRealtimeSubscription({
    table: 'expenses',
    onChange: handleRealtimeChange
  });

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

  // 以客户端数据即时计算"本周期每周支出汇总"（21号周期内的数据）
  const weeklyView = useMemo(() => {
    const map: Record<string, number> = {};
    const { startDate, endDate } = getCycleRange(ym);
    
    items.forEach((it) => {
      if (!it?.date) return;
      // 检查日期是否在当前21号周期内
      if (it.date >= startDate && it.date <= endDate) {
        const wk = isoWeekNumberFromString(it.date);
        map[wk] = (map[wk] || 0) + Number(it.amount || 0);
      }
    });
    return Object.keys(map)
      .sort()
      .map((k) => ({ week_number: Number(k), amount_sum: map[k] }));
  }, [items, ym, getCycleRange]);

  // 将 ISO 周编号转换为"几月几号-几号"的显示
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
    try {
      // 将文件转成可持久显示的 Data URL
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
      
      // 计算周数
      const dateObj = new Date(date);
      const day = dateObj.getUTCDay() || 7;
      dateObj.setUTCDate(dateObj.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(dateObj.getUTCFullYear(), 0, 1));
      const week_number = Math.ceil(((dateObj.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      const weekNumber = dateObj.getUTCFullYear() * 100 + week_number;
      
      // 直接插入数据库，确保实时同步
      const supabase = getSupabaseClient();
      
      // 如果有图片，将所有图片的 Data URL 保存为 JSON 字符串
      let receiptUrl = null;
      if (files.length > 0) {
        const allDataUrls = await Promise.all(files.map(fileToDataUrl));
        receiptUrl = JSON.stringify(allDataUrls);
      }
      
      const { error } = await supabase.from('expenses').insert({
        date,
        item_description: desc,  // 使用数据库中的正确字段名
        amount: parseFloat(amount || '0'),
        user_name: handler,      // 使用数据库中的正确字段名
        receipt_url: receiptUrl  // 保存所有图片的 JSON 字符串
      });
      
      if (error) throw error;
      
      // 清空表单
      setDesc("");
      setAmount("");
      setHandler("");
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      
      // 手动重新加载数据，确保界面立即更新
      // 手动重新加载数据，确保界面立即更新
      await fetchList();
      await fetchWeekly();
      setRefreshKey(k => k + 1); // 触发MonthlyComparisonCard刷新
    } catch (error: any) {
      console.error('添加支出失败:', error);
      alert(`添加失败：${error.message}`);
    }
  }

  async function onDelete(it: Expense){
    // 添加删除确认弹窗，显示详细信息
    const description = (it as any).item_description || it.description || '无描述';
    const amount = Number(it.amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 });
    const handler = (it as any).user_name || it.handler || '无经手人';
    
    const confirmMessage = `确定要删除这条支出记录吗？

📅 日期：${it.date}
📝 描述：${description}
💰 金额：¥${amount}
👤 经手人：${handler}

⚠️ 删除后无法恢复，请确认！`;

    if (!confirm(confirmMessage)) {
      return; // 用户点击取消，不执行删除
    }

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', it.id);
      
      if (error) throw error;
      
      // 清理本地兜底数据
      try {
        const localKey = `expenses_local_${ym}`;
        localStorage.removeItem(localKey);
      } catch {}
      
      // 手动重新加载数据，确保界面立即更新
      await fetchList();
      await fetchWeekly();
      setRefreshKey(k => k + 1); // 触发MonthlyComparisonCard刷新
    } catch (error: any) {
      console.error('删除支出失败:', error);
      alert(`删除失败：${error.message}`);
    }
  }

  return (
    <Shell>
      <div className="relative mb-8">
        <img 
          src="https://images.unsplash.com/photo-1538356111053-748a48e1acb8?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=4800"
          alt="财务装饰图片" 
          className="w-full h-48 object-cover rounded-lg shadow-md"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent flex items-center">
          <div className="text-white px-6">
            <h2 className="text-3xl font-bold">财务 · 支出与结算</h2>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PaymentStatsCard ym={ym} refreshKey={payRefreshKey} onBudgetChange={setLinkedBudget} expenseItems={items} />
        <MonthlyComparisonCard 
          currentMonth={currentMonth}
          currentAmount={currentMonthTotal}
          refreshKey={refreshKey}
        />
      </div>

      <RecurringExpenseManager 
        currentCycle={ym} 
        onExpenseAdded={() => {
          console.log(`[FinancePage] RecurringExpenseManager 触发刷新回调`);
          // 使用防抖，避免频繁调用
          setTimeout(() => {
            fetchList(true); // 跳过自动执行，避免重复
            fetchWeekly();
            setPayRefreshKey(k => k + 1);
            setRefreshKey(k => k + 1); // 确保MonthlyComparisonCard也刷新
          }, 500);
        }} 
      />

      <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border border-emerald-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-6 mt-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white text-lg">📊</span>
          </div>
          <div className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            本周期每周支出汇总 (21号-20号)
          </div>
        </div>
        <div className="bg-gray-800/70 backdrop-blur-sm rounded-lg border border-emerald-700/30 overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">📅 周编号</th>
                <th className="px-6 py-4 text-right font-semibold">💰 支出金额</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-700/30">
              {weeklyView.length===0 && (
                <tr>
                  <td className="px-6 py-3 text-center text-gray-400" colSpan={2}>
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-2xl">📝</span>
                      <span>本月暂无支出</span>
                    </div>
                  </td>
                </tr>
              )}
              {weeklyView.map((w, index)=> (
                <tr key={w.week_number} className={`hover:bg-emerald-800/30 transition-colors duration-150 ${index % 2 === 0 ? 'bg-gray-800/30' : 'bg-emerald-800/20'}`}>
                  <td className="px-6 py-2 font-medium text-gray-200">{isoWeekRangeLabel(w.week_number)}</td>
                  <td className="px-6 py-2 text-right font-mono font-bold text-emerald-400">
                    ¥{Number(w.amount_sum||0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gradient-to-br from-orange-900/30 to-amber-900/30 border border-orange-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-6 mt-4">
        <button className="w-full flex items-center justify-between mb-4 group" onClick={()=>setShowExpense(s=>!s)}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-200">
              <span className="text-white text-lg">📝</span>
            </div>
            <div className="text-xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              支出记录
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gray-800/70 backdrop-blur-sm px-4 py-2 rounded-lg border border-orange-700/30 group-hover:border-orange-600/50 transition-all duration-200">
            <span className="text-sm font-medium text-orange-400">
              {showExpense? '📤 收起' : '📥 展开'}
            </span>
          </div>
        </button>
        
        {showExpense && (
        <>
          {/* 添加支出表单 */}
          <div className="bg-gray-800/70 backdrop-blur-sm rounded-lg p-4 border border-orange-700/30 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-start">
              <input 
                type="date" 
                value={date} 
                onChange={e=>setDate(e.target.value)} 
                className="border-2 border-orange-700/30 bg-gray-800/50 text-gray-200 rounded-lg px-3 py-2 focus:border-orange-600/50 focus:ring-2 focus:ring-orange-900/30 transition-all duration-200" 
              />
              <div className="relative">
                <input 
                  placeholder="📝 描述" 
                  value={desc} 
                  onChange={e=>setDesc(e.target.value)} 
                  className="w-full border-2 border-orange-700/30 bg-gray-800/50 text-gray-200 rounded-lg px-3 py-2 pr-12 focus:border-orange-600/50 focus:ring-2 focus:ring-orange-900/30 transition-all duration-200 placeholder-gray-400" 
                />
                <button
                  type="button"
                  onClick={()=> inputRef.current?.click() }
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-orange-900/40 border-2 border-orange-700/30 text-orange-400 flex items-center justify-center hover:bg-orange-800/40 hover:border-orange-600/50 transition-all duration-200 shadow-sm"
                  aria-label="添加图片"
                >
                  📷
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
                      <img 
                        key={idx} 
                        src={src} 
                        alt="预览" 
                        className="h-12 w-12 object-cover rounded-lg border-2 border-orange-700/30 cursor-pointer hover:border-orange-600/50 transition-colors duration-200 shadow-sm hover:shadow-md" 
                        onClick={()=> setViewerSrc(src)} 
                      />
                    ))}
                  </div>
                )}
              </div>
              <input 
                placeholder="💰 金额" 
                value={amount} 
                onChange={e=>setAmount(e.target.value)} 
                className="border-2 border-orange-700/30 bg-gray-800/50 text-gray-200 rounded-lg px-3 py-2 focus:border-orange-600/50 focus:ring-2 focus:ring-orange-900/30 transition-all duration-200 placeholder-gray-400" 
              />
              <div className="relative">
                <input
                  type="text"
                  className="w-full border-2 border-orange-700/30 bg-gray-800/50 text-gray-200 rounded-lg px-3 py-2 focus:border-orange-600/50 focus:ring-2 focus:ring-orange-900/30 transition-all duration-200 placeholder-gray-400"
                  placeholder="👤 经手人"
                  value={handler}
                  onChange={e => handleHandlerChange(e.target.value)}
                  onFocus={() => {
                    if (staffList.length > 0) {
                      setFilteredStaff(staffList);
                      setShowStaffDropdown(true);
                    }
                  }}
                  onBlur={() => {
                    // 延迟隐藏下拉框，允许点击选项
                    setTimeout(() => setShowStaffDropdown(false), 200);
                  }}
                />
                
                {/* 值班人员下拉列表 */}
                {showStaffDropdown && filteredStaff.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800/95 backdrop-blur-sm border border-gray-600/50 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                    {filteredStaff.map((name, index) => (
                      <button
                        key={index}
                        type="button"
                        className="w-full text-left px-4 py-2 text-white hover:bg-purple-600/30 transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg"
                        onMouseDown={(e) => {
                          e.preventDefault(); // 防止输入框失去焦点
                          selectStaff(name);
                        }}
                      >
                        <span className="text-purple-400">👤</span> {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button 
                className="bg-gradient-to-r from-orange-400 to-amber-500 hover:from-orange-500 hover:to-amber-600 text-white font-semibold px-4 py-2 rounded-lg h-[44px] flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all duration-200" 
                onClick={onAdd}
              >
                ➕ 添加支出
              </button>
            </div>
          </div>

          {/* 支出记录表格 - 深色主题 */}
          <div className="bg-gray-800/70 backdrop-blur-sm rounded-lg border border-orange-700/30 overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-orange-300 to-amber-400 text-white">
                <tr>
                  <th className="px-4 py-4 text-left font-semibold text-sm">📅 日期</th>
                  <th className="px-4 py-4 text-left font-semibold text-sm">📝 描述</th>
                  <th className="px-4 py-4 text-right font-semibold text-sm">💰 金额</th>
                  <th className="px-4 py-4 text-left font-semibold text-sm">👤 经手人</th>
                  <th className="px-4 py-4 text-center font-semibold text-sm w-24">⚙️ 操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-700/30">
                {items.length===0 && (
                  <tr>
                    <td className="px-4 py-4 text-center text-gray-400" colSpan={5}>
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-2xl">📋</span>
                        <span className="text-sm">暂无支出记录</span>
                      </div>
                    </td>
                  </tr>
                )}
                {items.map((it, index)=> (
                  <tr key={it.id} className={`hover:bg-orange-800/30 transition-colors duration-150 ${index % 2 === 0 ? 'bg-gray-800/30' : 'bg-orange-800/20'}`}>
                    <td className="px-4 py-2 font-medium text-gray-200 text-sm">{it.date}</td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-200 text-sm">{(it as any).item_description || it.description}</div>
                      {(it as any).receipt_url && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(() => {
                            try {
                              // 尝试解析为 JSON 数组（多张图片）
                              const urls = JSON.parse((it as any).receipt_url);
                              if (Array.isArray(urls)) {
                                return urls.map((url, idx) => (
                                  <img
                                    key={idx}
                                    src={url}
                                    alt={`收据 ${idx + 1}`}
                                    className="h-8 w-8 object-cover rounded border border-orange-700/30 cursor-pointer hover:border-orange-600/50 transition-colors duration-200 shadow-sm hover:shadow-md"
                                    onClick={() => setViewerSrc(url)}
                                  />
                                ));
                              }
                            } catch {
                              // 如果解析失败，说明是单张图片的字符串格式
                            }
                            // 单张图片显示
                            return (
                              <img
                                src={(it as any).receipt_url}
                                alt="收据"
                                className="h-8 w-8 object-cover rounded border border-orange-700/30 cursor-pointer hover:border-orange-600/50 transition-colors duration-200 shadow-sm hover:shadow-md"
                                onClick={() => setViewerSrc((it as any).receipt_url)}
                              />
                            );
                          })()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-orange-400 text-sm">
                      ¥{Number(it.amount||0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-300 text-sm">{(it as any).user_name || it.handler || '-'}</td>
                    <td className="px-4 py-2 text-center">
                      <button
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-900/40 border border-red-700/50 text-red-400 hover:bg-red-800/40 hover:border-red-600/50 active:scale-95 transition-all duration-200 font-medium shadow-sm hover:shadow-md text-xs whitespace-nowrap"
                        onClick={()=> onDelete(it)}
                      >
                        <span>🗑️</span>
                        <span>删除</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
        )}
      </div>
      <PayStatsCard onChange={()=> setPayRefreshKey(k=>k+1)} expenseItems={items} />
      {viewerSrc && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
          onClick={()=> setViewerSrc(null)}
        >
          <img src={viewerSrc} className="max-w-[90vw] max-h-[90vh] object-contain shadow-2xl" />
        </div>
      )}
    </Shell>
  );
}

// 缴费统计卡片组件 - 深色主题设计
function PaymentStatsCard({ ym, refreshKey, onBudgetChange, expenseItems }: { ym: string; refreshKey: number; onBudgetChange?: (budget: number) => void; expenseItems: Expense[] }){
  const [totalMembers, setTotalMembers] = useState(0);
  const [paidMembers, setPaidMembers] = useState(0);
  const [unpaidMembers, setUnpaidMembers] = useState(0);
  const [details, setDetails] = useState<Array<{name:string; paid:boolean; amount?:number}>>([]);
  const [open, setOpen] = useState(false);
  const [totalBudget, setTotalBudget] = useState(0);

  // 21号周期计算辅助函数
  const getCycleRange = useCallback((yearMonth: string) => {
    const [year, month] = yearMonth.split('-').map(v => parseInt(v));
    
    // 修复：21号周期应该是本月21号到次月20号
    // 如果用户选择"2025-08"，应该查询2025年8月21号到2025年9月20号的数据
    const startDate = new Date(year, month - 1, 21); // month-1 表示本月21号
    const endDate = new Date(year, month, 20);       // month 表示次月20号
    
    return {
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10)
    };
  }, []);

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
        
        const members = mem.items || [];
        const payments = pay.items || [];
        
        // 创建缴费状态映射
        const paymentMap: Record<string, any> = {};
        payments.forEach((p: any) => {
          paymentMap[p.member_id] = p;
        });
        
        // 统计缴费情况
        const memberDetails = members.map((member: any) => {
          const payment = paymentMap[member.id];
          return {
            name: member.name,
            paid: payment ? payment.paid : false,
            amount: payment ? payment.amount : null
          };
        });
        
        const total = members.length;
        const paid = memberDetails.filter((m: any) => m.paid).length;
        const unpaid = total - paid;
        
        // 计算总预算（所有已缴费成员的金额总和，不管是整月还是区间）
        const budget = memberDetails.reduce((sum: number, member: any) => {
          return sum + (member.paid && member.amount ? Number(member.amount) : 0);
        }, 0);
        
        setTotalMembers(total);
        setPaidMembers(paid);
        setUnpaidMembers(unpaid);
        setDetails(memberDetails);
        setTotalBudget(budget);
        
        // 通知父组件预算变化
        // 通知父组件预算变化
        onBudgetChange && onBudgetChange(budget);
      }catch{
        setTotalMembers(0);
        setPaidMembers(0);
        setUnpaidMembers(0);
        setDetails([]);
        setTotalBudget(0);
        onBudgetChange && onBudgetChange(0);
      }
    })();
  },[ym, refreshKey, onBudgetChange]);

  // 计算本周期支出总额（21号周期）
  const monthlySpend = useMemo(() => {
    const { startDate, endDate } = getCycleRange(ym);
    return expenseItems
      .filter(e => typeof e.date === 'string' && e.date >= startDate && e.date <= endDate)
      .reduce((s, e) => s + Number(e.amount || 0), 0);
  }, [expenseItems, ym, getCycleRange]);

  // 计算结余
  const remainingBudget = totalBudget - monthlySpend;
  
  // 计算使用百分比
  const usagePercentage = totalBudget > 0 ? Math.min((monthlySpend / totalBudget) * 100, 100) : 0;

  return (
    <div className="bg-gradient-to-br from-blue-900/30 via-indigo-900/30 to-purple-900/30 border border-blue-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          💰 本周期预算概览 (21号-20号)
        </div>
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
          <span className="text-white text-lg">💎</span>
        </div>
      </div>
      
      {/* 预算/支出显示 - 深色主题设计 */}
      <div className="space-y-2 mb-4">
        <div className="flex items-baseline gap-2">
          <div className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            ¥{monthlySpend.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}
          </div>
          <div className="text-lg text-gray-400 font-medium">
            / ¥{totalBudget.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}
          </div>
        </div>
        
        {/* 现代化进度条 - 深色主题 */}
        <div className="w-full bg-gray-700 rounded-full h-3 shadow-inner">
          <div 
            className={`h-3 rounded-full transition-all duration-500 ease-out shadow-sm ${
              usagePercentage >= 100 ? 'bg-gradient-to-r from-red-500 to-red-600' : 
              usagePercentage >= 90 ? 'bg-gradient-to-r from-orange-500 to-red-500' : 
              usagePercentage >= 80 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 
              'bg-gradient-to-r from-green-500 to-emerald-500'
            }`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          ></div>
        </div>
        
        {/* 结余显示 - 深色主题，加大字体 */}
        <div className={`${remainingBudget >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          <span className="text-2xl font-bold">{remainingBudget >= 0 ? '✅ 结余' : '⚠️ 超支'}: </span>
          <span className="text-3xl font-bold">¥{Math.abs(remainingBudget).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* 缴费统计 - 深色主题卡片设计 */}
      <div className="grid grid-cols-3 gap-3 mb-4 pt-4 border-t border-indigo-700/30">
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-all duration-200 border border-gray-700/30">
          <div className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1">
            <span>👥</span> 总人数
          </div>
          <div className="text-2xl font-bold text-gray-200">{totalMembers}</div>
        </div>
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-all duration-200 border border-gray-700/30">
          <div className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1">
            <span>✅</span> 已交费
          </div>
          <div className="text-2xl font-bold text-green-400">{paidMembers}</div>
        </div>
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-all duration-200 border border-gray-700/30">
          <div className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1">
            <span>❌</span> 未交费
          </div>
          <div className="text-2xl font-bold text-red-400">{unpaidMembers}</div>
        </div>
      </div>
      
    </div>
  );
}

// 成员缴费统计组件 - 深色主题设计
function PayStatsCard({ onChange, expenseItems }: { onChange?: ()=>void; expenseItems?: Expense[] }){
  const [open, setOpen] = useState<boolean>(false);
  return (
    <div className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border border-cyan-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-6 mt-4">
      <button className="w-full flex items-center justify-between mb-4 group" onClick={()=>setOpen(o=>!o)}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-200">
            <span className="text-white text-lg">👥</span>
          </div>
          <div className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            成员缴费统计（本周期 21号-20号）
          </div>
        </div>
        <div className="flex items-center gap-2 bg-gray-800/70 backdrop-blur-sm px-4 py-2 rounded-lg border border-cyan-700/30 group-hover:border-cyan-600/50 transition-all duration-200">
          <span className="text-sm font-medium text-cyan-400">
            {open? '📤 收起' : '📥 展开'}
          </span>
        </div>
      </button>
      {open && (
        <div className="bg-gray-800/70 backdrop-blur-sm rounded-lg p-4 border border-cyan-700/30">
          <PayStats onChange={onChange} expenseItems={expenseItems} />
        </div>
      )}
    </div>
  );
}

// 成员缴费统计明细表 - 深色主题
function PayStats({ onChange, expenseItems }: { onChange?: ()=>void; expenseItems?: Expense[] }){
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth()+1);
  const [members, setMembers] = useState<Array<{id:string; name:string}>>([]);
  const [records, setRecords] = useState<Array<{member_id:string; paid:boolean; amount?:number|null; coverage?:'month'|'range'|null; from_date?:string|null; to_date?:string|null; settlement_amount?:number|null; settlement_date?:string|null; is_settled?:boolean}>>([]);
  const [localAmounts, setLocalAmounts] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [debounceTimers, setDebounceTimers] = useState<Record<string, NodeJS.Timeout>>({});
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});

  function monthWorkdays(yy:number, mm:number){
    const isWorkday = (d:Date)=>{ const k=d.getDay(); return k>=1 && k<=5; };
    const first=new Date(yy,mm-1,1,12,0,0); const last=new Date(yy,mm,0,12,0,0);
    let c=0; const d=new Date(first); while(d<=last){ if(isWorkday(d)) c++; d.setDate(d.getDate()+1);} return c;
  }
  function suggestAmountByRange(from:string|null, to:string|null){
    if(!from || !to) return null as number|null;
    const isWorkday = (d:Date)=>{ const k=d.getDay(); return k>=1 && k<=5; };
    let workdayCount=0; const s=new Date(from); const e=new Date(to);
    if(isNaN(s.getTime())||isNaN(e.getTime())||s>e) return null;
    const d=new Date(s);
    while(d<=e){ if(isWorkday(d)){ workdayCount++; } d.setDate(d.getDate()+1); }
    return workdayCount * 48; // 每个工作日48元，周末不计费
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

  // 计算当前周期支出总额（使用传递进来的expenseItems）
  const totalExpenses = useMemo(() => {
    if (!expenseItems) return 0;
    
    // 计算21号周期范围
    const startDate = new Date(year, month - 1, 21); // 本月21号
    const endDate = new Date(year, month, 20);       // 次月20号
    
    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = endDate.toISOString().slice(0, 10);
    
    return expenseItems
      .filter(item => item.date >= startStr && item.date <= endStr)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [expenseItems, year, month]);

  useEffect(()=>{ 
    reload(); 
  },[year,month]);

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      Object.values(debounceTimers).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, [debounceTimers]);

  const map: Record<string, any> = {};
  records.forEach(r=>{ map[r.member_id]=r; });
  const totalCount = members.length;
  const paidCount = members.filter(m=> !!(map[m.id] && map[m.id].paid)).length;
  const unpaidCount = totalCount - paidCount;

  // 计算结算相关数据
  const monthlyMembers = members.filter(m => {
    const rec = map[m.id];
    return rec && rec.paid && rec.coverage === 'month';
  });
  
  // 总预算 = 所有已缴费成员的金额总和（包括整月和区间）
  const totalBudget = members.reduce((sum, m) => {
    const rec = map[m.id];
    return sum + (rec && rec.paid && rec.amount ? Number(rec.amount) : 0);
  }, 0);
  
  const remainingBudget = totalBudget - totalExpenses;
  const settlementPerPerson = monthlyMembers.length > 0 ? remainingBudget / monthlyMembers.length : 0;

  // 手动结算功能
  async function handleSettlement() {
    if (isSettling) return;
    if (monthlyMembers.length === 0) {
      alert('没有符合条件的成员（整月缴费且已缴费）');
      return;
    }
    if (remainingBudget <= 0) {
      alert('当前没有结余可分配');
      return;
    }
    
    const confirmMsg = `确认结算吗？\n结余金额：¥${remainingBudget.toFixed(2)}\n符合条件成员：${monthlyMembers.length}人\n每人返还：¥${settlementPerPerson.toFixed(2)}`;
    if (!confirm(confirmMsg)) return;
    
    setIsSettling(true);
    try {
      // 调用结算API
      const response = await fetch('/api/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`结算完成！每人返还：¥${result.settlement.settlementAmount.toFixed(2)}`);
      } else {
        alert(`结算失败：${result.message || '未知错误'}`);
      }
      
      await reload();
      onChange && onChange();
    } catch (error) {
      console.error('结算失败:', error);
      alert('结算失败，请重试');
    } finally {
      setIsSettling(false);
    }
  }

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
    // 仅发送"被修改"的字段，避免把未修改的旧值写回覆盖
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
      // 发送更新请求
      const response = await fetch('/api/members/pay', { 
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body: JSON.stringify({ member_id: memberId, year, month, paid }) 
      });
      
      // 重新加载缴费数据
      await reload();
      
      // 通知父组件数据已更新，触发全局刷新
      if (onChange) {
        try {
          onChange();
        } catch (err) {
          console.error('触发onChange回调失败:', err);
        }
      }
    } catch(e){ 
      console.error('保存缴费状态失败:', e); 
      alert('更新缴费状态失败，请重试');
    } finally { 
      setSavingIds(prev=>{ const n={...prev}; delete n[memberId]; return n; }); 
    }
  }

  return (
    <div className="space-y-4">
      {/* 控制面板 - 深色主题设计 */}
      <div className="bg-gradient-to-r from-cyan-900/40 to-blue-900/40 rounded-lg p-4 border border-cyan-700/30">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* 左侧：年份月份和刷新按钮 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-cyan-400">📅 年份</label>
              <input 
                type="number" 
                className="border-2 border-cyan-700/30 bg-gray-800/50 text-gray-200 rounded-lg px-3 py-2 w-24 focus:border-cyan-600/50 focus:ring-2 focus:ring-cyan-900/30 transition-all duration-200" 
                value={year} 
                onChange={e=>setYear(parseInt(e.target.value||`${new Date().getFullYear()}`))} 
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-cyan-400">📅 月份</label>
              <input 
                type="number" 
                className="border-2 border-cyan-700/30 bg-gray-800/50 text-gray-200 rounded-lg px-3 py-2 w-20 focus:border-cyan-600/50 focus:ring-2 focus:ring-cyan-900/30 transition-all duration-200" 
                value={month} 
                onChange={e=>setMonth(parseInt(e.target.value||`${new Date().getMonth()+1}`))} 
              />
            </div>
            <button 
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200" 
              onClick={reload}
            >
              🔄 刷新
            </button>
          </div>
          
          {/* 右侧：统计信息 */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 bg-gray-800/60 backdrop-blur-sm px-3 py-2 rounded-lg border border-cyan-700/30">
              <span className="text-cyan-400">👥</span>
              <span className="text-gray-300">总人数：</span>
              <span className="font-bold text-gray-200">{totalCount}</span>
            </div>
            <div className="flex items-center gap-2 bg-gray-800/60 backdrop-blur-sm px-3 py-2 rounded-lg border border-green-700/30">
              <span className="text-green-400">✅</span>
              <span className="text-gray-300">已交：</span>
              <span className="font-bold text-green-400">{paidCount}</span>
            </div>
            <div className="flex items-center gap-2 bg-gray-800/60 backdrop-blur-sm px-3 py-2 rounded-lg border border-red-700/30">
              <span className="text-red-400">❌</span>
              <span className="text-gray-300">未交：</span>
              <span className="font-bold text-red-400">{unpaidCount}</span>
            </div>
          </div>
        </div>
        
        {/* 结算信息和按钮 */}
        {monthlyMembers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-cyan-700/30">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2 bg-gray-800/60 backdrop-blur-sm px-3 py-2 rounded-lg border border-yellow-700/30">
                  <span className="text-yellow-400">💰</span>
                  <span className="text-gray-300">总预算：</span>
                  <span className="font-bold text-yellow-400">¥{totalBudget.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-800/60 backdrop-blur-sm px-3 py-2 rounded-lg border border-orange-700/30">
                  <span className="text-orange-400">💸</span>
                  <span className="text-gray-300">总支出：</span>
                  <span className="font-bold text-orange-400">¥{totalExpenses.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-800/60 backdrop-blur-sm px-3 py-2 rounded-lg border border-green-700/30">
                  <span className="text-green-400">💎</span>
                  <span className="text-gray-300">结余：</span>
                  <span className="font-bold text-green-400">¥{remainingBudget.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-800/60 backdrop-blur-sm px-3 py-2 rounded-lg border border-purple-700/30">
                  <span className="text-purple-400">👥</span>
                  <span className="text-gray-300">整月人数：</span>
                  <span className="font-bold text-purple-400">{monthlyMembers.length}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 bg-gray-800/60 backdrop-blur-sm px-3 py-2 rounded-lg border border-green-700/30">
                <span className="text-green-400">💰</span>
                <button
                  className={`px-4 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 ${
                    isSettling || remainingBudget <= 0 || monthlyMembers.length === 0
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                  }`}
                  onClick={handleSettlement}
                  disabled={isSettling || remainingBudget <= 0 || monthlyMembers.length === 0}
                >
                  {isSettling ? '🔄 结算中...' : '立即结算'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 成员缴费表格 - 深色主题设计 */}
      <div className="bg-gray-800/70 backdrop-blur-sm rounded-lg border border-cyan-700/30 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-sm">👤姓名</th>
                <th className="px-4 py-3 text-center font-semibold text-sm">💳是否已交</th>
                <th className="px-4 py-3 text-center font-semibold text-sm">💰金额</th>
                <th className="px-4 py-3 text-center font-semibold text-sm">📅覆盖范围</th>
                <th className="px-4 py-3 text-center font-semibold text-sm">💰结算返还</th>
                <th className="px-4 py-3 text-center font-semibold text-sm w-20">⚙️操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-700/30">
                {members.map((m, index)=>{
                const rec = map[m.id] || {};
                const isEligibleForSettlement = rec.paid && rec.coverage === 'month';
                const settlementAmount = rec.is_settled ? rec.settlement_amount : (isEligibleForSettlement ? settlementPerPerson : 0);
                
                return (
                  <tr key={`pay-${m.id}`} className={`hover:bg-cyan-800/30 transition-colors duration-150 ${index % 2 === 0 ? 'bg-gray-800/30' : 'bg-cyan-800/20'}`}>
                    <td className="px-4 py-2 font-medium text-gray-200">{m.name}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="inline-flex rounded-md border border-gray-600/50 overflow-hidden shadow-sm">
                        <button
                          className={`px-3 py-1 text-xs font-medium transition-all duration-200 ${
                            rec.paid 
                              ? 'bg-green-600 text-white' 
                              : 'bg-gray-700 text-gray-300 hover:bg-green-700/30 hover:text-green-400'
                          }`}
                          onClick={()=> setPaid(m.id, true)}
                        >
                          ✓ 已交
                        </button>
                        <button
                          className={`px-3 py-1 text-xs font-medium transition-all duration-200 ${
                            !rec.paid 
                              ? 'bg-red-600 text-white' 
                              : 'bg-gray-700 text-gray-300 hover:bg-red-700/30 hover:text-red-400'
                          }`}
                          onClick={()=> setPaid(m.id, false)}
                        >
                          ✗ 未交
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="number"
                        step="0.01"
                        className="border border-cyan-700/30 bg-gray-800/50 text-gray-200 rounded-md px-2 py-1 w-24 text-center text-sm font-mono focus:border-cyan-600/50 focus:ring-1 focus:ring-cyan-900/30 transition-all duration-200 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
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
                      <div className="flex items-center gap-2 justify-center">
                        <select
                          className="border border-cyan-700/30 bg-gray-800/50 text-gray-200 rounded-md px-2 py-1 text-sm focus:border-cyan-600/50 focus:ring-1 focus:ring-cyan-900/30 transition-all duration-200"
                          value={rec.coverage || ''}
                          onChange={(e)=>{
                            const v = e.target.value as any;
                            setLocal(m.id, v? { coverage: v } : { coverage: null, from_date: null, to_date: null });
                            if(v==='month') { upsert(m.id, { coverage:'month', from_date: null, to_date: null, amount: MONTH_PRICE }); setLocal(m.id, { amount: MONTH_PRICE }); }
                            else if(v==='range') upsert(m.id, { coverage:'range' });
                            else upsert(m.id, { coverage: null, from_date: null, to_date: null });
                          }}
                        >
                          <option value="">选择</option>
                          <option value="month">整月</option>
                          <option value="range">区间</option>
                        </select>
                        <div className="flex items-center gap-1" style={{ minWidth: 240, visibility: rec.coverage==='range' ? 'visible' as any : 'hidden' as any }}>
                          <div className="relative">
                            <input 
                              type="date" 
                              className={`border border-cyan-700/30 bg-gray-800/50 text-gray-200 rounded-md px-2 py-1 text-sm focus:border-cyan-600/50 focus:ring-1 focus:ring-cyan-900/30 transition-all duration-200 ${
                                savingStates[`${m.id}_from_date`] ? 'opacity-60' : ''
                              }`}
                              value={rec.from_date || ''} 
                              disabled={savingStates[`${m.id}_from_date`]}
                              onChange={(e)=>{ 
                                const v=e.target.value||null; 
                                
                                // 清除之前的防抖定时器
                                const timerKey = `${m.id}_from_date`;
                                setDebounceTimers(prev => {
                                  if (prev[timerKey]) {
                                    clearTimeout(prev[timerKey]);
                                  }
                                  return prev;
                                });
                                
                                // 立即更新本地状态，提升用户体验
                                setLocal(m.id, { from_date: v }); 
                                
                                // 设置新的防抖定时器，延迟API调用
                                const newTimer = setTimeout(async () => {
                                  // 设置保存状态
                                  setSavingStates(prev => ({ ...prev, [timerKey]: true }));
                                  
                                  try {
                                    await upsert(m.id, { from_date: v }); 
                                    const sug=suggestAmountByRange(v, rec.to_date||null); 
                                    if(sug!==null){ 
                                      setLocal(m.id, { amount: sug }); 
                                      await upsert(m.id, { amount: sug }); 
                                    }
                                  } finally {
                                    // 清理保存状态和定时器
                                    setSavingStates(prev => {
                                      const newStates = {...prev};
                                      delete newStates[timerKey];
                                      return newStates;
                                    });
                                    setDebounceTimers(prev => {
                                      const newTimers = {...prev};
                                      delete newTimers[timerKey];
                                      return newTimers;
                                    });
                                  }
                                }, 1000); // 增加到1000ms防抖延迟，给API更多响应时间
                                
                                // 保存新定时器
                                setDebounceTimers(prev => ({
                                  ...prev,
                                  [timerKey]: newTimer
                                }));
                              }} 
                            />
                            {savingStates[`${m.id}_from_date`] && (
                              <div className="absolute -right-6 top-1/2 -translate-y-1/2">
                                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                              </div>
                            )}
                          </div>
                          <span className="text-cyan-400 text-sm">~</span>
                          <div className="relative">
                            <input 
                              type="date" 
                              className={`border border-cyan-700/30 bg-gray-800/50 text-gray-200 rounded-md px-2 py-1 text-sm focus:border-cyan-600/50 focus:ring-1 focus:ring-cyan-900/30 transition-all duration-200 ${
                                savingStates[`${m.id}_to_date`] ? 'opacity-60' : ''
                              }`}
                              value={rec.to_date || ''} 
                              disabled={savingStates[`${m.id}_to_date`]}
                              onChange={(e)=>{ 
                                const v=e.target.value||null; 
                                
                                // 清除之前的防抖定时器
                                const timerKey = `${m.id}_to_date`;
                                setDebounceTimers(prev => {
                                  if (prev[timerKey]) {
                                    clearTimeout(prev[timerKey]);
                                  }
                                  return prev;
                                });
                                
                                // 立即更新本地状态，提升用户体验
                                setLocal(m.id, { to_date: v }); 
                                
                                // 设置新的防抖定时器，延迟API调用
                                const newTimer = setTimeout(async () => {
                                  // 设置保存状态
                                  setSavingStates(prev => ({ ...prev, [timerKey]: true }));
                                  
                                  try {
                                    await upsert(m.id, { to_date: v }); 
                                    const sug=suggestAmountByRange(rec.from_date||null, v); 
                                    if(sug!==null){ 
                                      setLocal(m.id, { amount: sug }); 
                                      await upsert(m.id, { amount: sug }); 
                                    }
                                  } finally {
                                    // 清理保存状态和定时器
                                    setSavingStates(prev => {
                                      const newStates = {...prev};
                                      delete newStates[timerKey];
                                      return newStates;
                                    });
                                    setDebounceTimers(prev => {
                                      const newTimers = {...prev};
                                      delete newTimers[timerKey];
                                      return newTimers;
                                    });
                                  }
                                }, 1000); // 增加到1000ms防抖延迟，给API更多响应时间
                                
                                // 保存新定时器
                                setDebounceTimers(prev => ({
                                  ...prev,
                                  [timerKey]: newTimer
                                }));
                              }} 
                            />
                            {savingStates[`${m.id}_to_date`] && (
                              <div className="absolute -right-6 top-1/2 -translate-y-1/2">
                                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {!isEligibleForSettlement ? (
                        <span className="text-gray-500 text-sm">-</span>
                      ) : rec.is_settled ? (
                        <div className="flex flex-col items-center">
                          <span className="text-green-400 font-bold text-sm">¥{Number(rec.settlement_amount || 0).toFixed(2)}</span>
                          <span className="text-green-300 text-xs">已结算</span>
                          {rec.settlement_date && (
                            <span className="text-gray-400 text-xs">{new Date(rec.settlement_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="text-yellow-400 font-bold text-sm">¥{settlementPerPerson.toFixed(2)}</span>
                          <span className="text-yellow-300 text-xs">预计返还</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button 
                        className="inline-flex items-center gap-1 bg-red-900/40 hover:bg-red-800/40 border border-red-700/50 text-red-400 px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 hover:shadow-sm whitespace-nowrap" 
                        onClick={async()=>{ 
                          await fetch(`/api/members/pay?member_id=${m.id}&year=${year}&month=${month}`, { method:'DELETE' }); 
                          await reload(); 
                        }}
                      >
                        <span>🗑️</span>
                        <span>清除</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {members.length===0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-3xl">👥</span>
                      <span>暂无成员</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
