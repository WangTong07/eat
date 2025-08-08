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
    let query = supabase.from("duty_weeks").select("id, week_number, member_a_id, member_b_id, a_confirmed, b_confirmed");
    if (weekNumber) query = query.eq("week_number", Number(weekNumber));
    const { data, error } = await query.limit(1).maybeSingle();
    if (error) {
      // 42P01: table not found; PGRST116: no rows
      if (error.code === '42P01' || error.code === 'PGRST116') {
        return NextResponse.json({ item: null });
      }
      throw error;
    }
    return NextResponse.json({ item: data ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getClient();
    const { weekNumber, member_a_id, member_b_id } = await req.json();
    if (!weekNumber) return NextResponse.json({ error: 'weekNumber 必填' }, { status: 400 });
    // 先查
    const { data: exist, error: selErr } = await supabase
      .from('duty_weeks')
      .select('id')
      .eq('week_number', weekNumber)
      .maybeSingle();
    if (selErr && selErr.code !== 'PGRST116') throw selErr;

    if (exist?.id) {
      const { error: updErr } = await supabase
        .from('duty_weeks')
        .update({ member_a_id, member_b_id })
        .eq('id', exist.id);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await supabase
        .from('duty_weeks')
        .insert({ week_number: weekNumber, member_a_id, member_b_id, a_confirmed: false, b_confirmed: false });
      if (insErr) throw insErr;
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getClient();
    const { id, who, confirmed } = await req.json();
    if (!id || (who !== 'a' && who !== 'b')) return NextResponse.json({ error: '参数错误' }, { status: 400 });
    const field = who === 'a' ? 'a_confirmed' : 'b_confirmed';
    const { error } = await supabase
      .from('duty_weeks')
      .update({ [field]: !!confirmed })
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}


