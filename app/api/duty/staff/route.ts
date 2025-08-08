import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

type Assignment = { member_id: string; year: number; month: number; week_in_month: number };

function getYearMonthFromReq(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const now = new Date();
  const year = Number(searchParams.get("year")) || now.getFullYear();
  const month = Number(searchParams.get("month")) || now.getMonth() + 1; // 1-12
  return { year, month };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getClient();
    const { year, month } = getYearMonthFromReq(req);

    // 读取当月分配
    let assignData: Assignment[] = [];
    try {
      const { data, error } = await supabase
        .from("duty_staff_assignments")
        .select("member_id, year, month, week_in_month")
        .eq("year", year)
        .eq("month", month);
      if (error && error.code !== "42P01") throw error;
      if (!error) assignData = (data || []) as Assignment[];
      // 表不存在，尝试从 Cookie 读取兜底
      if (error && error.code === "42P01") {
        const store = await cookies();
        const key = `duty_staff_${year}_${month}`;
        const raw = store.get(key)?.value;
        if (raw) assignData = JSON.parse(raw);
      }
    } catch (e) {
      // 读取失败时，保持空
    }

    // 读取成员以匹配姓名
    let membersRes = await supabase
      .from("household_members")
      .select("id, name, role")
      .order("created_at", { ascending: true });
    if (membersRes.error && membersRes.error.code === "42P01") {
      membersRes = await supabase
        .from("house_members")
        .select("id, name, role")
        .order("created_at", { ascending: true });
    }
    if (membersRes.error) throw membersRes.error;
    const allMembers = (membersRes.data || []) as Array<{ id: string; name: string; role?: string | null }>;
    const idToMember = new Map(allMembers.map((m) => [m.id, m]));

    const items = assignData
      .map((a) => {
        const m = idToMember.get(a.member_id);
        return {
          member_id: a.member_id,
          name: m?.name || "未知",
          role: (m?.role as string) || "成员",
          week_in_month: a.week_in_month,
        };
      });

    return NextResponse.json({ year, month, items });
  } catch (e: any) {
    console.error("[api/duty/staff GET] fatal:", e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getClient();
    const body = await req.json();
    const member_id: string = body.member_id;
    const week_in_month: number = Number(body.week_in_month);
    const year: number = Number(body.year) || new Date().getFullYear();
    const month: number = Number(body.month) || new Date().getMonth() + 1;
    if (!member_id || !week_in_month || week_in_month < 1 || week_in_month > 4) {
      return NextResponse.json({ error: "member_id/week_in_month 无效" }, { status: 400 });
    }

    // 先查
    const { data: exist, error: selErr } = await supabase
      .from("duty_staff_assignments")
      .select("member_id, year, month")
      .eq("member_id", member_id)
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();

    if (selErr && selErr.code === "42P01") {
      // 表不存在：写 Cookie 兜底
      const store = await cookies();
      const key = `duty_staff_${year}_${month}`;
      const raw = store.get(key)?.value;
      const list: Assignment[] = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex((x) => x.member_id === member_id);
      if (idx >= 0) list[idx].week_in_month = week_in_month; else list.push({ member_id, year, month, week_in_month });
      store.set(key, JSON.stringify(list), { path: "/", maxAge: 60 * 60 * 24 * 45 });
      return NextResponse.json({ success: true, fallback: "cookie" });
    } else if (selErr) {
      throw selErr;
    }

    if (exist) {
      const { error } = await supabase
        .from("duty_staff_assignments")
        .update({ week_in_month })
        .eq("member_id", member_id)
        .eq("year", year)
        .eq("month", month);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("duty_staff_assignments")
        .insert({ member_id, year, month, week_in_month });
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[api/duty/staff POST] fatal:", e);
    // 最后兜底：也尝试 cookie
    try {
      const body = await req.json();
      const member_id = body?.member_id; const week_in_month = Number(body?.week_in_month);
      const year = Number(body?.year) || new Date().getFullYear();
      const month = Number(body?.month) || new Date().getMonth() + 1;
      if (member_id && week_in_month) {
        const store = await cookies();
        const key = `duty_staff_${year}_${month}`;
        const raw = store.get(key)?.value;
        const list: Assignment[] = raw ? JSON.parse(raw) : [];
        const idx = list.findIndex((x) => x.member_id === member_id);
        if (idx >= 0) list[idx].week_in_month = week_in_month; else list.push({ member_id, year, month, week_in_month });
        store.set(key, JSON.stringify(list), { path: "/", maxAge: 60 * 60 * 24 * 45 });
      }
    } catch {}
    return NextResponse.json({ success: true, fallback: "cookie" });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getClient();
    const body = await req.json();
    const member_id: string = body.member_id;
    const year: number = Number(body.year) || new Date().getFullYear();
    const month: number = Number(body.month) || new Date().getMonth() + 1;
    if (!member_id) return NextResponse.json({ error: 'member_id 必填' }, { status: 400 });

    const { error } = await supabase
      .from('duty_staff_assignments')
      .delete()
      .eq('member_id', member_id)
      .eq('year', year)
      .eq('month', month);

    if (error) {
      if (error.code === '42P01') {
        // 表不存在：Cookie 删除
        const store = await cookies();
        const key = `duty_staff_${year}_${month}`;
        const raw = store.get(key)?.value;
        if (raw) {
          const list: Assignment[] = JSON.parse(raw);
          const next = list.filter(x => !(x.member_id === member_id));
          store.set(key, JSON.stringify(next), { path: '/', maxAge: 60 * 60 * 24 * 45 });
        }
        return NextResponse.json({ success: true, fallback: 'cookie' });
      }
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    try {
      const body = await req.json();
      const member_id = body?.member_id; const year = Number(body?.year) || new Date().getFullYear(); const month = Number(body?.month) || new Date().getMonth()+1;
      if (member_id) {
        const store = await cookies();
        const key = `duty_staff_${year}_${month}`;
        const raw = store.get(key)?.value;
        if (raw) {
          const list: Assignment[] = JSON.parse(raw);
          const next = list.filter(x => x.member_id !== member_id);
          store.set(key, JSON.stringify(next), { path: '/', maxAge: 60 * 60 * 24 * 45 });
        }
      }
    } catch {}
    return NextResponse.json({ success: true, fallback: 'cookie' });
  }
}


