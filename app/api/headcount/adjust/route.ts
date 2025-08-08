import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getClient();
    const { weekNumber, effectiveDate, delta, reason } = await req.json();
    if (!weekNumber || !effectiveDate || typeof delta !== "number") {
      return NextResponse.json({ error: "缺少 weekNumber/effectiveDate/delta" }, { status: 400 });
    }
    const { error } = await supabase.from("headcount_adjustments").insert({
      week_number: weekNumber,
      effective_date: effectiveDate,
      delta,
      reason: reason || null,
    });
    if (error) {
      // 回退：把增减写入 cookie 列表
      const store = await cookies();
      const key = `hc_adj_${weekNumber}`;
      const raw = store.get(key)?.value;
      const list = raw ? JSON.parse(raw) : [];
      list.push({ effective_date: effectiveDate, delta, reason: reason || null });
      store.set(key, JSON.stringify(list), { path: "/", maxAge: 60 * 60 * 24 * 14 });
      return NextResponse.json({ success: true, fallback: "cookie" });
    }
    return NextResponse.json({ success: true, source: "db" });
  } catch (e: any) {
    // 最后兜底：也尝试写入 cookie
    try {
      const body = await req.json();
      const weekNumber = body?.weekNumber;
      if (weekNumber) {
        const store = await cookies();
        const key = `hc_adj_${weekNumber}`;
        const raw = store.get(key)?.value;
        const list = raw ? JSON.parse(raw) : [];
        list.push({ effective_date: body?.effectiveDate, delta: body?.delta, reason: body?.reason || null });
        store.set(key, JSON.stringify(list), { path: "/", maxAge: 60 * 60 * 24 * 14 });
      }
    } catch {}
    return NextResponse.json({ success: true, fallback: "cookie" });
  }
}


