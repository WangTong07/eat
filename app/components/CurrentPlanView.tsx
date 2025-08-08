"use client";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Plan = {
  id: string;
  week_number: number;
  generated_at: string;
  menu_json: Record<string, string[] | string>;
  shopping_list_json: Record<string, string[] | string>;
};

export default function CurrentPlanView() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("weekly_plans")
        .select("id, week_number, generated_at, menu_json, shopping_list_json")
        .order("generated_at", { ascending: false })
        .limit(1);
      if (error) setError(error.message);
      else setPlan(data?.[0] ?? null);
      setLoading(false);
    };
    load();
  }, []);

  const renderMenu = () => {
    if (!plan?.menu_json) return null;
    const entries = Object.entries(plan.menu_json);
    return (
      <ul className="list-disc pl-5 space-y-1">
        {entries.map(([day, menu]) => (
          <li key={day}>
            <span className="font-medium">{day}：</span>
            <span>{typeof menu === "string" ? menu : JSON.stringify(menu)}</span>
          </li>
        ))}
      </ul>
    );
  };

  const renderShopping = () => {
    if (!plan?.shopping_list_json) return null;
    const hjx = plan.shopping_list_json["海吉星"] ?? [];
    const qdm = plan.shopping_list_json["钱大妈"] ?? [];
    const others = Object.entries(plan.shopping_list_json).filter(
      ([k]) => k !== "海吉星" && k !== "钱大妈"
    );
    return (
      <div className="space-y-2">
        <div>
          <h4 className="font-medium">海吉星</h4>
          <ul className="list-disc pl-5">
            {(Array.isArray(hjx) ? hjx : []).map((i, idx: number) => (
              <li key={idx}>{typeof i === "string" ? i : JSON.stringify(i)}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-medium">钱大妈</h4>
          <ul className="list-disc pl-5">
            {(Array.isArray(qdm) ? qdm : []).map((i, idx: number) => (
              <li key={idx}>{typeof i === "string" ? i : JSON.stringify(i)}</li>
            ))}
          </ul>
        </div>
        {others.length > 0 && (
          <div>
            <h4 className="font-medium">其他</h4>
            {others.map(([k, v]) => (
              <div key={k} className="mt-1">
                <div className="text-sm text-gray-600">{k}</div>
                <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(v, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="w-full">
      <h2 className="text-lg font-semibold mb-3">本周计划</h2>
      {loading && <div className="text-sm text-gray-500">加载中...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!plan && !loading && !error && (
        <div className="text-sm text-gray-500">暂无计划数据</div>
      )}
      {plan && (
        <div className="space-y-4">
          <div className="text-sm text-gray-700">周编号：{plan.week_number}</div>
          <div>
            <h3 className="font-medium mb-1">菜单</h3>
            {renderMenu()}
          </div>
          <div>
            <h3 className="font-medium mb-1">采购清单</h3>
            {renderShopping()}
          </div>
        </div>
      )}
    </section>
  );
}


