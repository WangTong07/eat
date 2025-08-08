import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getClient();
    const { weekNumber, base } = await req.json();
    if (!weekNumber || !base || base <= 0) {
      return NextResponse.json({ error: "weekNumber/base 参数无效" }, { status: 400 });
    }
    // 手动实现 upsert，避免数据库缺少唯一约束时失败
    const { data: exist, error: selErr } = await supabase
      .from("app_settings")
      .select("id")
      .eq("week_number", weekNumber)
      .eq("key", "headcount")
      .maybeSingle();
    if (selErr && selErr.code !== 'PGRST116') throw selErr; // PGRST116: no rows

    if (exist?.id) {
      const { error: updErr } = await supabase
        .from("app_settings")
        .update({ value: base })
        .eq("id", exist.id);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await supabase
        .from("app_settings")
        .insert({ key: "headcount", value: base, week_number: weekNumber });
      if (insErr) throw insErr;
    }
    // 成功写入数据库后，同步清理掉可能存在的 cookie 兜底，避免覆盖
    const store = await cookies();
    store.set(`hc_base_${weekNumber}`, String(base), { path: "/", maxAge: 0 });
    return NextResponse.json({ success: true, source: "db" });
  } catch (e: any) {
    // 最后兜底：也写入 Cookie
    try {
      const body = await req.json();
      const weekNumber = body?.weekNumber;
      const base = body?.base;
      if (weekNumber && base) {
        const store = await cookies();
        store.set(`hc_base_${weekNumber}`, String(base), { path: "/", maxAge: 60 * 60 * 24 * 30 });
      }
    } catch {}
    return NextResponse.json({ success: true, fallback: "cookie" });
  }
}


