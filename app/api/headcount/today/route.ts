import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

function isoWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return date.getUTCFullYear() * 100 + week;
}

export async function GET() {
  try {
    const supabase = getClient();
    const today = new Date();
    const weekNumber = isoWeekNumber(today);

    // 新逻辑：直接以成员列表中 is_active=true 的数量作为本周吃饭人数
    let headcount = 0;
    // 首选 household_members 表
    const { count, error } = await supabase
      .from('household_members')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);
    if (!error && typeof count === 'number') {
      headcount = count;
    } else {
      // 兼容你之前的 house_members
      const fb = await supabase
        .from('house_members')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      if (!fb.error && typeof fb.count === 'number') headcount = fb.count;
    }

    return NextResponse.json({ weekNumber, headcount, todayCount: headcount });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}


