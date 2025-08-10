"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

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
    if (typeof window === "undefined") return new Date();
    const saved = window.localStorage.getItem("dashboard-base-date");
    return saved ? new Date(saved) : new Date();
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

  useEffect(() => {
    const supabase = getSupabaseClient();
    (async () => {
      const { data: p } = await supabase
        .from("weekly_plans")
        .select("id, week_number, generated_at, menu_json, shopping_list_json")
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setPlan(p ?? null);

      // 从"值班人员（本月）"中按当前日期的月与周序取负责人
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

      // 获取本月支出数据
      const y = baseDate.getFullYear();
      const m = baseDate.getMonth() + 1;
      const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
      const monthEnd = new Date(y, m, 0).toISOString().slice(0, 10);
      
      const { data: exp } = await supabase
        .from("expenses")
        .select("amount, date")
        .gte("date", monthStart)
        .lte("date", monthEnd);
      setMonthlyExpense((exp ?? []).reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0));

      // 获取本月预算数据（缴费总额）
      try {
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

      // 读取可编辑的"吃饭人数"（若后端存在 app_settings 表，则以该表优先）
      try {
        const res = await fetch('/api/headcount/today');
        const j = await res.json();
        if (typeof j.todayCount === 'number') setHeadcount(j.todayCount);
      } catch {}
    })();
  }, [currentWeekNumber, baseDate]);

  const todayNeedsShopping = useMemo(() => {
    // 简单规则：如果购物清单存在未分类或非空，则提示需要采购
    const list = plan?.shopping_list_json ?? {};
    const sum = Object.values(list).reduce((acc, v) => acc + (Array.isArray(v) ? v.length : 0), 0);
    return sum > 0;
  }, [plan]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("dashboard-base-date", formatDate(baseDate));
    }
  }, [baseDate]);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="text-muted">{rangeText(baseDate)}</div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted">选择日期</label>
          <input
            type="date"
            className="border border-neutral-200 rounded px-2 py-1 text-sm"
            value={formatDate(baseDate)}
            onChange={(e) => {
              const val = e.target.value;
              if (val) setBaseDate(new Date(val));
            }}
          />
          <button
            className="text-sm text-primary"
            onClick={() => setBaseDate(new Date())}
          >
            本周
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/people" className="ui-card rounded-xl p-5 card-hover animate-slide-up block" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted text-sm">本周吃饭人数</p>
              <div className="flex items-center gap-2">
                <h3 className="text-3xl font-bold mt-1 text-heading">{headcount}人</h3>
              </div>
              <p className="text-primary text-sm mt-2 flex items-center"><i className="fa fa-level-up mr-1" />点击进入人数管理，可编辑</p>
            </div>
            <div className="icon-circle bg-primary-50 text-primary"><i className="fa fa-users" /></div>
          </div>
        </Link>
        <Link href="/people" className="ui-card rounded-xl p-5 card-hover animate-slide-up block" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted text-sm">当前值班人</p>
              <h3 className="text-xl font-bold mt-1 text-heading">{onDuty || "未设置"}</h3>
            </div>
            <div className="icon-circle bg-primary-50 text-primary"><i className="fa fa-user" /></div>
          </div>
        </Link>
        <Link href="/shopping" className="ui-card rounded-xl p-5 card-hover animate-slide-up block" style={{ animationDelay: "0.3s" }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted text-sm">今日是否采购</p>
              <h3 className={`text-xl font-bold mt-1 ${todayNeedsShopping ? "text-secondary" : "text-primary"}`}>{todayNeedsShopping ? "需要采购" : "无需采购"}</h3>
              <p className="text-muted text-sm mt-2">建议 18:00 前完成</p>
            </div>
            <div className="icon-circle bg-primary-50 text-secondary"><i className="fa fa-shopping-cart" /></div>
          </div>
        </Link>
        <Link href="/finance" className="ui-card rounded-xl p-5 card-hover animate-slide-up block" style={{ animationDelay: "0.4s" }}>
          <div className="flex items-start justify-between">
            <div className="w-full">
              <p className="text-muted text-sm">本月预算</p>
              <h3 className="text-xl font-bold mt-1 text-heading">¥{monthlyExpense.toFixed(0)} / ¥{monthlyBudget.toFixed(0)}</h3>
              <div className="mt-3">
                <div className="progress-bar" style={{
                  // @ts-ignore
                  "--progress": monthlyBudget > 0 ? `${Math.min((monthlyExpense / monthlyBudget) * 100, 100)}%` : "0%",
                }} />
              </div>
            </div>
            <div className="icon-circle bg-primary-50 text-primary"><i className="fa fa-money" /></div>
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