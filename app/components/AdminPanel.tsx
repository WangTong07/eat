"use client";
import { useState } from "react";

export default function AdminPanel() {
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    const res = await fetch("/api/generate-menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budget: budget || undefined, onDutyUserName: name || undefined }),
    });
    const data = await res.json();
    setLoading(false);
    alert(data?.error ? `生成失败：${data.error}` : "已触发生成并更新本周值班。稍后刷新查看最新计划。");
  }

  return (
    <section className="w-full">
      <h2 className="text-lg font-semibold mb-3">管理员区域</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          className="border rounded px-3 py-2"
          placeholder="值班人姓名（可选）"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="预算（例如 500 元，可选）"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
        <button onClick={generate} disabled={loading} className="bg-purple-600 text-white rounded px-4 py-2 disabled:opacity-50">
          {loading ? "生成中..." : "本周我值班，生成新菜单"}
        </button>
      </div>
    </section>
  );
}


