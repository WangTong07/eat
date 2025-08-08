"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Plan = {
  id: string;
  week_number: number;
  menu_json: Record<string, string[] | string>;
};

const DAY_ORDER = ["周一", "周二", "周三", "周四", "周五"] as const;

export default function MenuCards({ preview = false }: { preview?: boolean }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [recs, setRecs] = useState<Array<{ dish: string; ingredients: string[] }>>([]);

  const todayLabel = useMemo(() => {
    const d = new Date();
    const idx = (d.getDay() + 6) % 7; // 1=>0 ... 5=>4
    return DAY_ORDER[Math.min(idx, 4)];
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("weekly_plans")
        .select("id, week_number, menu_json")
        .order("generated_at", { ascending: false })
        .limit(1);
      if (!error) setPlan(data?.[0] ?? null);
      try {
        const r = await fetch('/api/recommendations');
        const j = await r.json();
        setRecs(j.items || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const menu = plan?.menu_json ?? {};
  const daysToRender = preview ? previewOrder(todayLabel) : DAY_ORDER;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">本周推荐菜</h3>
        {preview && (
          <Link href="/menu" className="text-sm text-emerald-600 hover:underline">
            查看全部
          </Link>
        )}
      </div>
      {loading && <div className="text-sm text-neutral-500">加载中...</div>}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recs.map((r, i) => (
            <div key={`${r.dish}-${i}`} className={`ui-card rounded-xl p-5 card-hover animate-slide-up`} style={{ animationDelay: `${0.1 * (i + 1)}s` }}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-heading">{r.dish}</h3>
                <span className="badge badge-primary">推荐</span>
              </div>
              <div className="text-sm text-muted mb-2">所需食材</div>
              <ul className="grid grid-cols-2 gap-1 text-sm">
                {r.ingredients.map((ing, idx) => (
                  <li key={idx} className="flex items-center"><i className="fa fa-check text-primary mr-2" />{ing}</li>
                ))}
              </ul>
            </div>
          ))}
          {recs.length === 0 && (
            <div className="text-sm text-muted">暂无推荐菜，请在“偏好提交”页添加想吃的菜</div>
          )}
        </div>
      )}
    </section>
  );
}

function toArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v as string[];
  if (typeof v === "string") return [v];
  return [];
}

function previewOrder(today: string) {
  const idx = DAY_ORDER.indexOf(today as any);
  const a = DAY_ORDER[(idx + 0) % DAY_ORDER.length];
  const b = DAY_ORDER[(idx + 1) % DAY_ORDER.length];
  const c = DAY_ORDER[(idx + 2) % DAY_ORDER.length];
  return [a, b, c];
}


