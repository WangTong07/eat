import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  // 优先使用服务端密钥，保证线上所有用户共享、可持久化。否则回退到 anon key
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

type PayItem = {
  member_id: string;
  year: number;
  month: number;
  paid: boolean;
  paid_at?: string;
  amount?: number | null;
  coverage?: 'month' | 'range' | null;
  from_date?: string | null;
  to_date?: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const supabase = getClient();
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const year = Number(searchParams.get("year")) || now.getFullYear();
    const month = Number(searchParams.get("month")) || now.getMonth() + 1;

    let items: Array<PayItem> = [];
    const { data, error } = await supabase
      .from("member_payments")
      .select("member_id, year, month, paid, paid_at, amount, coverage, from_date, to_date")
      .eq("year", year)
      .eq("month", month);

    if (!error) {
      const dbItems = (data || []).map((d: any) => ({
        member_id: d.member_id,
        year: d.year,
        month: d.month,
        paid: !!d.paid,
        paid_at: d.paid_at || null,
        amount: typeof d.amount === 'number' ? d.amount : null,
        coverage: d.coverage || null,
        from_date: d.from_date || null,
        to_date: d.to_date || null,
      }));
      if (dbItems.length > 0) {
        items = dbItems;
        return NextResponse.json({ year, month, items, source: 'db' });
      }
      // DB 无数据时，尝试读取 cookie 做为兜底，避免刷新后全部显示未交
      const store = await cookies();
      const rawArr = store.get(`pay_records_${year}_${month}`)?.value;
      const rawMap = store.get(`pay_${year}_${month}`)?.value;
      if (rawArr) {
        items = JSON.parse(rawArr);
        return NextResponse.json({ year, month, items, fallback: 'cookie-empty-db' });
      }
      if (rawMap) {
        const map: Record<string, boolean> = JSON.parse(rawMap);
        items = Object.keys(map).map((k) => ({ member_id: k, paid: !!map[k], year, month }));
        return NextResponse.json({ year, month, items, fallback: 'cookie-empty-db-legacy' });
      }
      items = [];
      return NextResponse.json({ year, month, items, source: 'db-empty' });
    } else {
      // 任何错误（表不存在、权限不足等）都回退到 cookie
      const store = await cookies();
      const keyArr = `pay_records_${year}_${month}`;
      const keyMap = `pay_${year}_${month}`;
      const rawArr = store.get(keyArr)?.value;
      const rawMap = store.get(keyMap)?.value;
      if (rawArr) {
        items = JSON.parse(rawArr);
      } else if (rawMap) {
        const map: Record<string, boolean> = rawMap ? JSON.parse(rawMap) : {};
        items = Object.keys(map).map((k) => ({ member_id: k, paid: !!map[k], year, month }));
      } else {
        items = [];
      }
      return NextResponse.json({ year, month, items, fallback: 'cookie', reason: String(error?.message || error) });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // 先解析 body，便于任何路径下都能回退 cookie
  let body: any = null;
  try { body = await req.json(); } catch {}
  try {
    const supabase = getClient();
    const member_id: string = body?.member_id;
    const hasPaid = typeof body?.paid === 'boolean';
    const paidVal: boolean | undefined = hasPaid ? !!body?.paid : undefined;
    const year: number = Number(body?.year) || new Date().getFullYear();
    const month: number = Number(body?.month) || new Date().getMonth() + 1;
    const amountDef = (body?.amount !== undefined) ? (body?.amount === null || body?.amount === '' ? null : Number(body?.amount)) : undefined;
    const coverageDef: 'month' | 'range' | null | undefined = (body?.coverage === 'range' || body?.coverage === 'month') ? body?.coverage : (body?.coverage === null ? null : undefined);
    const fromDateDef: string | null | undefined = (body?.from_date !== undefined) ? (body?.from_date || null) : undefined;
    const toDateDef: string | null | undefined = (body?.to_date !== undefined) ? (body?.to_date || null) : undefined;
    if (!member_id) return NextResponse.json({ error: "member_id 必填" }, { status: 400 });

    // 局部更新：只更新传入的字段；没有传入的保持不变
    const { data: exist, error: selErr } = await supabase
      .from('member_payments')
      .select('member_id')
      .eq('member_id', member_id)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();
    if (selErr && selErr.code) {
      const store = await cookies();
      const key = `pay_records_${year}_${month}`;
      const raw = store.get(key)?.value;
      const arr: PayItem[] = raw ? JSON.parse(raw) : [];
      const idx = arr.findIndex(it => it.member_id === member_id);
      const rec: PayItem = {
        member_id, year, month,
        paid: paidVal ?? arr[idx]?.paid ?? false,
        paid_at: new Date().toISOString(),
        amount: amountDef !== undefined ? amountDef : (arr[idx]?.amount ?? null),
        coverage: coverageDef !== undefined ? coverageDef : (arr[idx]?.coverage ?? null),
        from_date: fromDateDef !== undefined ? fromDateDef : (arr[idx]?.from_date ?? null),
        to_date: toDateDef !== undefined ? toDateDef : (arr[idx]?.to_date ?? null),
      };
      if (idx >= 0) arr[idx] = rec; else arr.push(rec);
      store.set(key, JSON.stringify(arr), { path: '/', maxAge: 60*60*24*90 });
      return NextResponse.json({ success: true, fallback: 'cookie', reason: String(selErr.message || selErr), saved: rec });
    }

    if (exist) {
      const patch: any = {};
      if (paidVal !== undefined) { patch.paid = paidVal; patch.paid_at = new Date().toISOString(); }
      if (amountDef !== undefined) patch.amount = amountDef;
      if (coverageDef !== undefined) patch.coverage = coverageDef;
      if (fromDateDef !== undefined) patch.from_date = fromDateDef;
      if (toDateDef !== undefined) patch.to_date = toDateDef;
      if (Object.keys(patch).length === 0) return NextResponse.json({ success: true, source: 'db', saved: { member_id, year, month } });
      const { error: updErr } = await supabase
        .from('member_payments')
        .update(patch)
        .eq('member_id', member_id)
        .eq('year', year)
        .eq('month', month);
      if (updErr) throw updErr;
      return NextResponse.json({ success: true, source: 'db', saved: { member_id, year, month, ...patch } });
    }

    // 不存在则插入新纪录，未提供的字段用默认
    const row: any = {
      member_id, year, month,
      paid: paidVal ?? false,
      paid_at: new Date().toISOString(),
      amount: amountDef ?? null,
      coverage: coverageDef ?? null,
      from_date: fromDateDef ?? null,
      to_date: toDateDef ?? null,
    };
    const { error: insErr } = await supabase.from('member_payments').insert(row);
    if (insErr) throw insErr;
    return NextResponse.json({ success: true, source: 'db', saved: row });
  } catch (e: any) {
    // 兜底：写入 cookie（数组格式）
    try {
      const mid = body?.member_id;
      const pd = body?.paid === undefined ? true : !!body?.paid;
      const y = Number(body?.year) || new Date().getFullYear();
      const m = Number(body?.month) || new Date().getMonth() + 1;
      if (mid) {
        const store = await cookies();
        const key = `pay_records_${y}_${m}`;
        const raw = store.get(key)?.value;
        const arr: PayItem[] = raw ? JSON.parse(raw) : [];
        const idx = arr.findIndex(it => it.member_id === mid);
        const rec: PayItem = {
          member_id: mid,
          year: y,
          month: m,
          paid: pd,
          paid_at: new Date().toISOString(),
          amount: body?.amount ?? null,
          coverage: body?.coverage ?? null,
          from_date: body?.from_date ?? null,
          to_date: body?.to_date ?? null,
        };
        if (idx >= 0) arr[idx] = rec; else arr.push(rec);
        store.set(key, JSON.stringify(arr), { path: '/', maxAge: 60*60*24*90 });
      }
    } catch {}
    return NextResponse.json({ success: true, fallback: "cookie", reason: String(e?.message || e) });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getClient();
    const { searchParams } = new URL(req.url);
    const member_id = searchParams.get('member_id') || '';
    const year = Number(searchParams.get('year')) || new Date().getFullYear();
    const month = Number(searchParams.get('month')) || new Date().getMonth() + 1;
    if (!member_id) return NextResponse.json({ success: true });
    try {
      const { error } = await supabase
        .from('member_payments')
        .delete()
        .eq('member_id', member_id)
        .eq('year', year)
        .eq('month', month);
      if (error && (error as any).code !== '42P01') throw error;
    } catch {}
    try {
      const store = await cookies();
      const key = `pay_records_${year}_${month}`;
      const raw = store.get(key)?.value;
      const arr: PayItem[] = raw ? JSON.parse(raw) : [];
      const next = arr.filter(it => it.member_id !== member_id);
      store.set(key, JSON.stringify(next), { path: '/', maxAge: 60*60*24*90 });
    } catch {}
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}


