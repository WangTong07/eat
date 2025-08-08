import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

export async function GET() {
  try {
    const supabase = getClient();
    // 兼容两种表名：household_members（推荐）与 house_members（你之前的）
    let { data, error } = await supabase
      .from("household_members")
      .select("id, name, role, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      const fallback = await supabase
        .from("house_members")
        .select("id, name, role, is_active, created_at")
        .order("created_at", { ascending: false });
      if (fallback.error) throw fallback.error;
      data = fallback.data as any;
    }
    return NextResponse.json({ items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ items: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getClient();
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: "name 必填" }, { status: 400 });
    let { error } = await supabase
      .from("household_members")
      .insert({ name, is_active: true });
    if (error) {
      // 若表不存在，尝试兼容你之前的 house_members
      const fallback = await supabase
        .from("house_members")
        .insert({ name, is_active: true });
      if (fallback.error) throw fallback.error;
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getClient();
    const { id, is_active } = await req.json();
    if (!id || typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'id/is_active 必填' }, { status: 400 });
    }
    let { error } = await supabase
      .from('household_members')
      .update({ is_active })
      .eq('id', id);
    if (error) {
      const fb = await supabase
        .from('house_members')
        .update({ is_active })
        .eq('id', id);
      if (fb.error) throw fb.error;
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getClient();
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');
    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {}
    }
    if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 });
    let { error } = await supabase
      .from('household_members')
      .delete()
      .eq('id', id);
    if (error) {
      const fb = await supabase
        .from('house_members')
        .delete()
        .eq('id', id);
      if (fb.error) throw fb.error;
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}


