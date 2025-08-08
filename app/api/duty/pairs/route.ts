import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getClient();
    const { searchParams } = new URL(req.url);
    const weekNumber = searchParams.get("weekNumber");
    const day = searchParams.get("day"); // yyyy-mm-dd 可选

    let query = supabase.from("duty_pairs").select("id, week_number, day, member_a_id, member_b_id, status");
    if (weekNumber) query = query.eq("week_number", Number(weekNumber));
    if (day) query = query.eq("day", day);
    const { data, error } = await query.order("day", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

// 保存某一天的分组：删除该日旧分组，再插入新分组
export async function POST(req: NextRequest) {
  try {
    const supabase = getClient();
    const { weekNumber, day, pairs } = await req.json();
    if (!weekNumber || !day || !Array.isArray(pairs)) {
      return NextResponse.json({ error: "weekNumber/day/pairs 必填" }, { status: 400 });
    }
    const { error: delErr } = await supabase.from("duty_pairs").delete().eq("week_number", weekNumber).eq("day", day);
    if (delErr) throw delErr;
    if (pairs.length > 0) {
      const rows = pairs.map((p: any) => ({
        week_number: weekNumber,
        day,
        member_a_id: p.member_a_id,
        member_b_id: p.member_b_id,
        status: "进行中",
      }));
      const { error: insErr } = await supabase.from("duty_pairs").insert(rows);
      if (insErr) throw insErr;
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}


