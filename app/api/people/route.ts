import { NextResponse } from "next/server";
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
      .from('household_members')
      .select('name')
      .eq('is_active', true)
      .order('name', { ascending: true });
    
    if (error) throw error;
    
    // 提取唯一的姓名列表
    const uniqueNames = [...new Set(data?.map(person => person.name) || [])];
    
    return NextResponse.json({ names: uniqueNames });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
