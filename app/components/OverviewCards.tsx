"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { autoExecuteRecurringExpenses, getCurrentCycle } from "@/app/lib/autoRecurringExpenses";

type Plan = {
  id: string;
  week_number: number;
  generated_at: string;
  menu_json: Record<string, string[] | string>;
  shopping_list_json: Record<string, string[] | string>;
};

type Schedule = { user_name: string; week_number: number };

export default function OverviewCards() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [onDuty, setOnDuty] = useState<string>("");
  const [monthlyExpense, setMonthlyExpense] = useState<number>(0);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
  const [headcount, setHeadcount] = useState<number>(5);
  const [editingHeadcount, setEditingHeadcount] = useState<boolean>(false);
  const [baseDate, setBaseDate] = useState<Date>(() => {
    // 始终使用当前日期作为默认值，确保日期选择器显示今天
    return new Date();
  });

  const currentWeekNumber = useMemo(() => {
    const now = baseDate;
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return d.getUTCFullYear() * 100 + week;
  }, [baseDate]);

  // 数据加载函数
  const loadFinancialData = async () => {
    const supabase = getSupabaseClient();
    
    // 获取当前周期支出数据（21号-次月20号）
    const { periodStart, periodEnd } = getBillingPeriod(baseDate);
    const periodStartStr = periodStart.toISOString().slice(0, 10);
    const periodEndStr = periodEnd.toISOString().slice(0, 10);
    
    const { data: exp } = await supabase
      .from("expenses")
      .select("amount, date")
      .gte("date", periodStartStr)
      .lte("date", periodEndStr);
    setMonthlyExpense((exp ?? []).reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0));

    // 获取当前周期预算数据（缴费总额）
    try {
      const y = baseDate.getFullYear();
      const m = baseDate.getMonth() + 1;
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
      
      // 计算总预算（所有已缴费金额之和）
      const budget = members.reduce((sum: number, member: any) => {
        const payment = paymentMap[member.id];
        return sum + (payment && payment.paid && payment.amount ? Number(payment.amount) : 0);
      }, 0);
      
      setMonthlyBudget(budget);
    } catch {
      setMonthlyBudget(0);
    }
  };

  useEffect(() => {
    const supabase = getSupabaseClient();
    (async () => {
      // 首先自动执行固定支出，如果有新增则重新加载财务数据
      try {
        const currentCycle = getCurrentCycle();
        await autoExecuteRecurringExpenses(currentCycle, () => {
          // 固定支出执行成功后，立即重新加载财务数据
          loadFinancialData();
        });
      } catch (error) {
        console.error('自动执行固定支出失败:', error);
      }

      const { data: p } = await supabase
        .from("weekly_plans")
        .select("id, week_number, generated_at, menu_json, shopping_list_json")
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setPlan(p ?? null);

      // 从“值班人员（本月）”中按当前日期的月与周序取负责人
      try {
        const y = baseDate.getFullYear();
        const m = baseDate.getMonth() + 1;
        const wom = weekOfMonth(baseDate); // 1-4
        const res = await fetch(`/api/duty/staff?year=${y}&month=${m}`);
        const j = await res.json();
        const items = Array.isArray(j.items) ? j.items : [];
        const todays = items.filter((it: any) => Number(it.week_in_month) === wom);
        const names = todays
          .map((t: any) => (t.name || '').trim())
          .filter((n: string) => n && n !== '未知');
        if (names.length > 0) {
          setOnDuty(names.join('、'));
        } else {
          setOnDuty('');
        }
      } catch {
        setOnDuty('');
      }

      // 初始加载财务数据
      await loadFinancialData();

      // 读取可编辑的"吃饭人数"（若后端存在 app_settings 表，则以该表优先）
      try {
        const res = await fetch('/api/headcount/today');
        const j = await res.json();
        if (typeof j.todayCount === 'number') setHeadcount(j.todayCount);
      } catch {}
    })();
  }, [currentWeekNumber, baseDate]);

  const [shoppingListItems, setShoppingListItems] = useState<any[]>([]);

  // 获取实时购物清单数据
  useEffect(() => {
    const fetchShoppingList = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('shopping_list')
          .select('*');
        
        if (!error && data) {
          setShoppingListItems(data);
        }
      } catch (error) {
        console.error('获取购物清单失败:', error);
      }
    };

    fetchShoppingList();

    // 设置实时监听
    const supabase = getSupabaseClient();
    const subscription = supabase
      .channel('shopping_list_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'shopping_list' },
        () => {
          fetchShoppingList();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const todayNeedsShopping = useMemo(() => {
    // 正确的逻辑：检查是否有未勾选的购物清单项目
    if (shoppingListItems.length === 0) {
      return false; // 没有购物清单，无需采购
    }
    
    // 如果有任何未勾选的项目，则需要采购
    const uncheckedItems = shoppingListItems.filter(item => !item.checked);
    return uncheckedItems.length > 0;
  }, [shoppingListItems]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("dashboard-base-date", formatDate(baseDate));
    }
  }, [baseDate]);

  return (
    <>
      {/* 装饰图片区域 - 保留原有设计 */}
      <div className="relative mb-8">
        <img 
          src="https://images.unsplash.com/photo-1543352632-5a4b24e4d2a6?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb"
          alt="美食装饰图片" 
          className="w-full h-48 object-cover rounded-lg shadow-md"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent flex items-center">
          <div className="text-white px-6">
            <h2 className="text-3xl font-bold">首页总览</h2>
            <p className="text-white/80">{rangeText(baseDate)}</p>
          </div>
        </div>
      </div>
      
      {/* 时间控制区域 - 深色主题设计 */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-gray-400 font-medium">当前周期</div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-400">选择日期</label>
          <input
            type="date"
            className="border border-slate-700/30 bg-gray-800/50 text-gray-200 rounded-lg px-3 py-2 text-sm focus:border-slate-600/50 focus:ring-2 focus:ring-slate-900/30 transition-all duration-200"
            value={formatDate(baseDate)}
            onChange={(e) => {
              const val = e.target.value;
              if (val) setBaseDate(new Date(val));
            }}
          />
          <button
            className="bg-gradient-to-r from-slate-500 to-gray-600 hover:from-slate-600 hover:to-gray-700 text-white font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
            onClick={() => setBaseDate(new Date())}
          >
            本周
          </button>
        </div>
      </div>

      {/* 概览卡片网格 - 深色主题设计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 吃饭人数卡片 */}
        <Link href="/people" className="group bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border border-purple-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-6 block animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-purple-400/70 text-sm font-medium mb-2">本周吃饭人数</p>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">{headcount}</h3>
                <span className="text-purple-400 font-semibold">人</span>
              </div>
              <p className="text-purple-400/80 text-sm flex items-center gap-1 group-hover:text-purple-300 transition-colors duration-200">
                <span className="text-xs">📊</span>
                点击进入人数管理
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-200">
              <span className="text-white text-xl">👥</span>
            </div>
          </div>
        </Link>

        {/* 值班人员卡片 */}
        <Link href="/people" className="group bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border border-emerald-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-6 block animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-emerald-400/70 text-sm font-medium mb-2">当前值班人</p>
              <div className="mb-3 min-h-[32px]">
                {onDuty ? (
                  onDuty.includes('、') ? (
                    // 多个值班人员，上下双排显示
                    <div className="space-y-1">
                      {onDuty.split('、').map((person, index) => (
                        <h3 key={index} className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent leading-tight">
                          {person.trim()}
                        </h3>
                      ))}
                    </div>
                  ) : (
                    // 单个值班人员，正常显示
                    <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                      {onDuty}
                    </h3>
                  )
                ) : (
                  <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    未设置
                  </h3>
                )}
              </div>
              <p className="text-emerald-400/80 text-sm flex items-center gap-1 group-hover:text-emerald-300 transition-colors duration-200">
                <span className="text-xs">⚡</span>
                查看值班安排
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-200">
              <span className="text-white text-xl">👨‍🍳</span>
            </div>
          </div>
        </Link>

        {/* 采购状态卡片 */}
        <Link href="/shopping" className="group bg-gradient-to-br from-orange-900/30 to-amber-900/30 border border-orange-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-6 block animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-orange-400/70 text-sm font-medium mb-2">今日采购状态</p>
              <h3 className={`text-xl font-bold mb-3 min-h-[28px] ${
                shoppingListItems.length === 0 
                  ? "text-gray-400" 
                  : todayNeedsShopping 
                    ? "bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent" 
                    : "bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent"
              }`}>
                {shoppingListItems.length === 0 
                  ? "暂无清单" 
                  : todayNeedsShopping 
                    ? "需要采购" 
                    : "已完成采购"
                }
              </h3>
              <p className="text-orange-400/80 text-sm group-hover:text-orange-300 transition-colors duration-200">
                {shoppingListItems.length === 0 
                  ? "点击添加购物清单" 
                  : todayNeedsShopping 
                    ? `还有 ${shoppingListItems.filter(item => !item.checked).length} 项未完成`
                    : "所有物品已采购完成"
                }
              </p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-200 ${
              shoppingListItems.length === 0 
                ? "bg-gradient-to-br from-gray-500 to-gray-600" 
                : todayNeedsShopping 
                  ? "bg-gradient-to-br from-orange-500 to-amber-600" 
                  : "bg-gradient-to-br from-green-500 to-emerald-600"
            }`}>
              <span className="text-white text-xl">
                {shoppingListItems.length === 0 
                  ? "📝" 
                  : todayNeedsShopping 
                    ? "🛒" 
                    : "✅"
                }
              </span>
            </div>
          </div>
        </Link>

        {/* 预算状态卡片 */}
        <Link href="/finance" className="group bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border border-cyan-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-6 block animate-slide-up" style={{ animationDelay: "0.4s" }}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-cyan-400/70 text-sm font-medium mb-2">当前周期预算</p>
              <h3 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-3">
                ¥{monthlyExpense.toFixed(0)} / ¥{monthlyBudget.toFixed(0)}
              </h3>
              {/* 现代化进度条 - 深色主题 */}
              <div className="w-full bg-gray-700 rounded-full h-2 shadow-inner mb-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ease-out shadow-sm ${
                    monthlyBudget > 0 && (monthlyExpense / monthlyBudget) >= 1 ? 'bg-gradient-to-r from-red-500 to-red-600' : 
                    monthlyBudget > 0 && (monthlyExpense / monthlyBudget) >= 0.9 ? 'bg-gradient-to-r from-orange-500 to-red-500' : 
                    monthlyBudget > 0 && (monthlyExpense / monthlyBudget) >= 0.8 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 
                    'bg-gradient-to-r from-cyan-500 to-blue-500'
                  }`}
                  style={{ 
                    width: monthlyBudget > 0 ? `${Math.min((monthlyExpense / monthlyBudget) * 100, 100)}%` : "0%" 
                  }}
                ></div>
              </div>
              {/* 结余显示 - 加大字体 */}
              <div className="mb-2">
                <span className="text-green-400 text-2xl font-bold">结余: </span>
                <span className="text-green-400 text-3xl font-bold">¥{Math.max(0, monthlyBudget - monthlyExpense).toFixed(0)}</span>
              </div>
              <p className="text-cyan-400/80 text-sm group-hover:text-cyan-300 transition-colors duration-200">
                查看详细财务信息
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-200">
              <span className="text-white text-xl">💰</span>
            </div>
          </div>
        </Link>
      </div>
    </>
  );
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - (day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function estimateHeadcount(plan: Plan | null): number {
  if (!plan?.menu_json) return 0;
  // 估算：以菜单项数量推断 4-6 人；此处保守展示 5
  return 5;
}

function rangeText(base: Date) {
  const now = new Date(base);
  const start = startOfWeek(now);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.getFullYear()}年${start.getMonth() + 1}月第${weekOfMonth(now)}周 · ${start.getMonth() + 1}月${start.getDate()}日-${end.getMonth() + 1}月${end.getDate()}日`;
}

function weekOfMonth(d: Date) {
  const date = new Date(d);
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const diff = date.getDate() + start.getDay() - 1;
  return Math.floor(diff / 7) + 1;
}

// 获取基于21号周期的月度范围
function getBillingPeriod(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  let periodStart: Date;
  let periodEnd: Date;
  
  if (day >= 21) {
    // 当前日期在21号及以后，周期是当月21号到次月20号
    periodStart = new Date(year, month, 21);
    periodEnd = new Date(year, month + 1, 20);
  } else {
    // 当前日期在20号及以前，周期是上月21号到当月20号
    periodStart = new Date(year, month - 1, 21);
    periodEnd = new Date(year, month, 20);
  }
  
  return { periodStart, periodEnd };
}

// 格式化周期显示文本
function formatBillingPeriod(date: Date) {
  const { periodStart, periodEnd } = getBillingPeriod(date);
  const startMonth = periodStart.getMonth() + 1;
  const endMonth = periodEnd.getMonth() + 1;
  const startYear = periodStart.getFullYear();
  const endYear = periodEnd.getFullYear();
  
  if (startYear === endYear) {
    return `${startYear}年${startMonth}.21-${endMonth}.20`;
  } else {
    return `${startYear}.${startMonth}.21-${endYear}.${endMonth}.20`;
  }
}


