"use client";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Schedule = {
  id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  user_name: string;
  status: string;
};

function getISOWeekNumber(date: Date): number {
  const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tempDate.getUTCDay() || 7;
  tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return tempDate.getUTCFullYear() * 100 + weekNo; // 形如 202532
}

export default function ScheduleView() {
  const [items, setItems] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const currentWeekNumber = useMemo(() => getISOWeekNumber(new Date()), []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("schedules")
        .select("id, week_number, start_date, end_date, user_name, status")
        .order("week_number", { ascending: false });
      if (error) {
        setError(error.message);
      } else {
        setItems(data ?? []);
      }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <section className="w-full">
      <h2 className="text-lg font-semibold mb-3">值班表</h2>
      {loading && <div className="text-sm text-gray-500">加载中...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">周编号</th>
              <th className="px-3 py-2 text-left">开始</th>
              <th className="px-3 py-2 text-left">结束</th>
              <th className="px-3 py-2 text-left">值班人</th>
              <th className="px-3 py-2 text-left">状态</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => {
              const isCurrent = s.week_number === currentWeekNumber;
              return (
                <tr key={s.id} className={isCurrent ? "bg-yellow-50" : undefined}>
                  <td className="px-3 py-2">第 {s.week_number} 周</td>
                  <td className="px-3 py-2">{s.start_date}</td>
                  <td className="px-3 py-2">{s.end_date}</td>
                  <td className="px-3 py-2">{s.user_name}</td>
                  <td className="px-3 py-2">{s.status}</td>
                </tr>
              );
            })}
            {items.length === 0 && !loading && !error && (
              <tr>
                <td className="px-3 py-4 text-gray-500" colSpan={5}>
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}


