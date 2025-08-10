
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

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
  return date.getUTCFullYear() * 100 + week; // e.g. 202532
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getClient();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month'); // YYYY-MM
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let start: string | null = null;
    let end: string | null = null;
    if (month) {
      const [y, m] = month.split('-').map((v)=>parseInt(v));
      const first = new Date(Date.UTC(y, m-1, 1));
      const last = new Date(Date.UTC(y, m, 0));
      start = first.toISOString().slice(0,10);
      end = last.toISOString().slice(0,10);
    } else if (from && to) {
      start = from; end = to;
    }

    try {
      let query = supabase
        .from('expenses')
        .select('id, date, description, amount, handler, week_number, attachments')
        .order('date', { ascending: false });
      if (start && end) {
        // @ts-ignore
        query = query.gte('date', start).lte('date', end);
      }
      const { data, error } = await query;
      if (error && (error as any).code !== '42P01') throw error;
      if (!error) return NextResponse.json({ items: data || [] });
    } catch (e) {}

    // fallback to cookie by month key
    const store = await cookies();
    const key = month ? `expenses_${month}` : 'expenses_misc';
    const raw = store.get(key)?.value;
    const list = raw ? JSON.parse(raw) : [];
    return NextResponse.json({ items: list });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getClient();
    const body = await req.json();
    const dateStr: string = body?.date; // YYYY-MM-DD
    const description: string = body?.description || '';
    const amount: number = Number(body?.amount || 0);
    const handler: string = body?.handler || '';
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];
    if (!dateStr || Number.isNaN(amount)) {
      return NextResponse.json({ error: '参数无效' }, { status: 400 });
    }
    const [y, m, d] = dateStr.split('-').map((v: string)=>parseInt(v));
    const wk = isoWeekNumber(new Date(Date.UTC(y, m-1, d)));

    try {
      const { error } = await supabase
        .from('expenses')
        .insert({ date: dateStr, description, amount, handler, week_number: wk, attachments });
      if (error && (error as any).code !== '42P01') throw error;
      if (!error) return NextResponse.json({ success: true, source: 'db' });
    } catch (e) {}

    // fallback cookie store by month
    const store = await cookies();
    const monthKey = `${y}-${String(m).padStart(2, '0')}`;
    const cookieKey = `expenses_${monthKey}`;
    const raw = store.get(cookieKey)?.value;
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({ id: `${Date.now()}`, date: dateStr, description, amount, handler, week_number: wk, attachments });
    store.set(cookieKey, JSON.stringify(list), { path: '/', maxAge: 60*60*24*60 });
    return NextResponse.json({ success: true, source: 'cookie' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const month = searchParams.get('month') || '';
    if (!id) return NextResponse.json({ success: true });

    // 1) 尝试数据库删除
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error && (error as any).code !== '42P01') throw error;
    } catch (e) {}

    // 2) cookie fallback 删除
    try {
      if (month) {
        const store = await cookies();
        const key = `expenses_${month}`;
        const raw = store.get(key)?.value;
        const list = raw ? JSON.parse(raw) : [];
        const next = list.filter((it: any) => String(it.id) !== String(id));
        store.set(key, JSON.stringify(next), { path: '/', maxAge: 60*60*24*60 });
      }
    } catch (e) {}

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}