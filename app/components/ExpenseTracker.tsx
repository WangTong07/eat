"use client";
import { useEffect, useState, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useRealtimeSubscription } from "@/lib/useRealtimeSubscription";
import { getFreshExpenses, clearLocalFallbackData } from "@/lib/dataUtils";

type Expense = {
  id: string;
  date: string;
  item_description: string;
  amount: number;
  user_name: string;
  receipt_url: string | null;
};

export default function ExpenseTracker() {
  const [form, setForm] = useState({
    date: "",
    item_description: "",
    amount: "",
    user_name: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [list, setList] = useState<Expense[]>([]);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      setSyncing(true);
      const data = await getFreshExpenses();
      setList(data ?? []);
      
      // 清理可能的本地兜底数据
      clearLocalFallbackData();
    } catch (error) {
      console.error('加载费用记录失败:', error);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 添加实时订阅
  useRealtimeSubscription({
    table: 'expenses',
    onChange: () => {
      console.log('[ExpenseTracker] 检测到费用记录变更，重新加载...');
      load();
    }
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!form.date || !form.item_description || !form.amount || !form.user_name) {
      setMessage("请完整填写表单");
      return;
    }
    setSubmitting(true);
    
    try {
      const supabase = getSupabaseClient();
      
      // 计算周数
      const dateObj = new Date(form.date);
      const day = dateObj.getUTCDay() || 7;
      dateObj.setUTCDate(dateObj.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(dateObj.getUTCFullYear(), 0, 1));
      const week_number = Math.ceil(((dateObj.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      const weekNumber = dateObj.getUTCFullYear() * 100 + week_number;
      
      // 直接插入数据库，确保实时同步
      const { error } = await supabase.from("expenses").insert({
        date: form.date,
        item_description: form.item_description,
        amount: Number(form.amount),
        user_name: form.user_name,
        week_number: weekNumber
      });
      
      if (error) throw error;
      
      setMessage("保存成功");
      setForm({ date: "", item_description: "", amount: "", user_name: "" });
      
      // 不需要手动调用 load()，实时订阅会自动更新
    } catch (error: any) {
      setMessage(`保存失败：${error.message}`);
    }
    
    setSubmitting(false);
  }

  return (
    <section className="w-full">
      <h2 className="text-lg font-semibold mb-3">
        支出记录
        {syncing && <span className="ml-2 text-sm text-blue-600">🔄 同步中...</span>}
      </h2>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-5">
        <input
          type="date"
          className="border rounded px-3 py-2"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="描述"
          value={form.item_description}
          onChange={(e) => setForm((f) => ({ ...f, item_description: e.target.value }))}
        />
        <input
          type="number"
          step="0.01"
          className="border rounded px-3 py-2"
          placeholder="金额"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="经手人"
          value={form.user_name}
          onChange={(e) => setForm((f) => ({ ...f, user_name: e.target.value }))}
        />
        <button
          type="submit"
          disabled={submitting}
          className="bg-green-600 text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {submitting ? "保存中..." : "添加支出"}
        </button>
      </form>
      {message && <div className="mt-2 text-sm text-gray-700">{message}</div>}

      <div className="mt-4 overflow-x-auto rounded border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">日期</th>
              <th className="px-3 py-2 text-left">描述</th>
              <th className="px-3 py-2 text-left">金额</th>
              <th className="px-3 py-2 text-left">经手人</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2">{e.date}</td>
                <td className="px-3 py-2">{e.item_description}</td>
                <td className="px-3 py-2">￥{Number(e.amount).toFixed(2)}</td>
                <td className="px-3 py-2">{e.user_name}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-gray-500" colSpan={4}>
                  暂无支出记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}


