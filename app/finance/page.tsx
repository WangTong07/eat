import Shell from "../dashboard/Shell";
import ExpenseTracker from "../components/ExpenseTracker";
import { getSupabaseClient } from "@/lib/supabaseClient";

export default async function FinancePage() {
  return (
    <Shell>
      <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold text-neutral-800 mb-4">财务 · 支出与结算</h2>
      <WeeklyAndMonthlySummary />
      <div className="mt-8">
        <ExpenseTracker />
      </div>
    </Shell>
  );
}

function startOfWeek(d: Date) {
  const t = new Date(d);
  const day = t.getDay() || 7;
  t.setDate(t.getDate() - (day - 1));
  t.setHours(0, 0, 0, 0);
  return t;
}

function endOfWeek(d: Date) {
  const t = startOfWeek(d);
  const e = new Date(t);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function fetchFinance() {
  const supabase = getSupabaseClient();
  const now = new Date();
  // week summary
  const ws = startOfWeek(now);
  const we = endOfWeek(now);
  const { data: week } = await supabase
    .from("expenses")
    .select("amount, date")
    .gte("date", formatDate(ws))
    .lte("date", formatDate(we));

  const weekTotal = (week ?? []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

  // month summary grouped by ISO week number
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const { data: month } = await supabase
    .from("expenses")
    .select("amount, date")
    .gte("date", formatDate(monthStart))
    .lte("date", formatDate(monthEnd));

  const byWeek = new Map<string, number>();
  (month ?? []).forEach((e: any) => {
    const d = new Date(e.date);
    const wn = isoWeekNumber(d);
    const key = `${wn}`;
    byWeek.set(key, (byWeek.get(key) || 0) + Number(e.amount || 0));
  });

  const monthTotal = Array.from(byWeek.values()).reduce((a, b) => a + b, 0);
  const weekRows = Array.from(byWeek.entries())
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([k, v]) => ({ week: k, total: v }));

  return { weekTotal, monthTotal, weekRows };
}

function isoWeekNumber(date: Date) {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return tmp.getUTCFullYear() * 100 + weekNo;
}

async function WeeklyAndMonthlySummary() {
  const { weekTotal, monthTotal, weekRows } = await fetchFinance();
  return (
    <section>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 card-shadow">
          <p className="text-neutral-500 text-sm">本周总支出</p>
          <h3 className="text-2xl font-bold mt-1">¥{weekTotal.toFixed(2)}</h3>
        </div>
        <div className="bg-white rounded-xl p-5 card-shadow">
          <p className="text-neutral-500 text-sm">本月总支出</p>
          <h3 className="text-2xl font-bold mt-1">¥{monthTotal.toFixed(2)}</h3>
        </div>
        <div className="bg-white rounded-xl p-5 card-shadow">
          <p className="text-neutral-500 text-sm">功能说明</p>
          <p className="text-sm mt-1">下方按“周编号(YYYYWW)”汇总本月每周支出。</p>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-xl p-5 card-shadow overflow-x-auto">
        <h3 className="font-semibold mb-3">本月每周支出汇总</h3>
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left px-3 py-2">周编号</th>
              <th className="text-left px-3 py-2">支出金额</th>
            </tr>
          </thead>
          <tbody>
            {weekRows.map((r) => (
              <tr key={r.week} className="border-b border-neutral-100">
                <td className="px-3 py-2">{r.week}</td>
                <td className="px-3 py-2">¥{r.total.toFixed(2)}</td>
              </tr>
            ))}
            {weekRows.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-neutral-500" colSpan={2}>本月暂无支出</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}


