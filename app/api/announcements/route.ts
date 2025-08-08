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
    const { data, error } = await supabase
      .from('announcements')
      .select('id, created_at, content, is_active')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { content, is_active } = await req.json();
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content 必填' }, { status: 400 });
    }
    const supabase = getClient();
    const { error } = await supabase
      .from('announcements')
      .insert({ content, is_active: is_active !== false });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, content, is_active } = await req.json();
    if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 });
    const supabase = getClient();
    const { error } = await supabase
      .from('announcements')
      .update({ content, is_active })
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 });
    const supabase = getClient();
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}


