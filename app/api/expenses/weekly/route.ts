
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month'); // YYYY-MM
    if (!month) return NextResponse.json({ items: [] });

    const supabase = getClient();
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('week_number, amount, date')
        .like('date', `${month}-%`);
      if (error && (error as any).code !== '42P01') throw error;
      if (!error) {
        const map: Record<string, number> = {};
        (data || []).forEach((it: any) => {
          const wk = String(it.week_number || '0');
          map[wk] = (map[wk] || 0) + Number(it.amount || 0);
        });
        const items = Object.keys(map).sort().map(k => ({ week_number: Number(k), amount_sum: map[k] }));
        return NextResponse.json({ items });
      }
    } catch (e) {}

    // cookie fallback
    const store = await cookies();
    const raw = store.get(`expenses_${month}`)?.value;
    const list = raw ? JSON.parse(raw) : [];
    const map: Record<string, number> = {};
    (list || []).forEach((it: any) => {
      const wk = String(it.week_number || '0');
      map[wk] = (map[wk] || 0) + Number(it.amount || 0);
    });
    const items = Object.keys(map).sort().map(k => ({ week_number: Number(k), amount_sum: map[k] }));
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
