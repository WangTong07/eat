import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

type PayItem = { member_id: string; year: number; month: number; paid: boolean; paid_at?: string };

export async function GET(req: NextRequest) {
  try {
    const supabase = getClient();
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const year = Number(searchParams.get("year")) || now.getFullYear();
    const month = Number(searchParams.get("month")) || now.getMonth() + 1;

    let items: Array<{ member_id: string; paid: boolean }> = [];
    try {
      const { data, error } = await supabase
        .from("member_payments")
        .select("member_id, year, month, paid")
        .eq("year", year)
        .eq("month", month);
      if (error) throw error;
      items = (data || []).map((d: any) => ({ member_id: d.member_id, paid: !!d.paid }));
    } catch (e: any) {
      if (e?.code === "42P01") {
        const store = await cookies();
        const key = `pay_${year}_${month}`;
        const raw = store.get(key)?.value;
        const map: Record<string, boolean> = raw ? JSON.parse(raw) : {};
        items = Object.keys(map).map((k) => ({ member_id: k, paid: !!map[k] }));
      } else {
        throw e;
      }
    }

    return NextResponse.json({ year, month, items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getClient();
    const body = await req.json();
    const member_id: string = body.member_id;
    const paid: boolean = !!body.paid;
    const year: number = Number(body.year) || new Date().getFullYear();
    const month: number = Number(body.month) || new Date().getMonth() + 1;
    if (!member_id) return NextResponse.json({ error: "member_id 必填" }, { status: 400 });

    // 显式 select 再 update/insert，避免缺唯一索引时 upsert 失败
    const { data: exist, error: selErr } = await supabase
      .from("member_payments")
      .select("member_id")
      .eq("member_id", member_id)
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();

    if (selErr && selErr.code === "42P01") {
      const store = await cookies();
      const key = `pay_${year}_${month}`;
      const raw = store.get(key)?.value;
      const map: Record<string, boolean> = raw ? JSON.parse(raw) : {};
      map[member_id] = paid;
      store.set(key, JSON.stringify(map), { path: "/", maxAge: 60 * 60 * 24 * 90 });
      return NextResponse.json({ success: true, fallback: "cookie" });
    }
    if (selErr) throw selErr;

    if (exist) {
      const { error } = await supabase
        .from("member_payments")
        .update({ paid, paid_at: new Date().toISOString() })
        .eq("member_id", member_id)
        .eq("year", year)
        .eq("month", month);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("member_payments")
        .insert({ member_id, year, month, paid, paid_at: new Date().toISOString() });
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    // 兜底：写入 cookie
    try {
      const body = await req.json();
      const member_id = body?.member_id;
      const paid = !!body?.paid;
      const year = Number(body?.year) || new Date().getFullYear();
      const month = Number(body?.month) || new Date().getMonth() + 1;
      if (member_id) {
        const store = await cookies();
        const key = `pay_${year}_${month}`;
        const raw = store.get(key)?.value;
        const map: Record<string, boolean> = raw ? JSON.parse(raw) : {};
        map[member_id] = paid;
        store.set(key, JSON.stringify(map), { path: "/", maxAge: 60 * 60 * 24 * 90 });
      }
    } catch {}
    return NextResponse.json({ success: true, fallback: "cookie" });
  }
}


