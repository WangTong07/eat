import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'id 必填' }, { status: 400 });
    }
    
    const supabase = getClient();
    
    // 先获取当前的点赞数
    const { data: currentData, error: fetchError } = await supabase
      .from('announcements')
      .select('likes')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      // 如果likes字段不存在，尝试不使用likes字段
      console.log('likes字段可能不存在:', fetchError.message);
      return NextResponse.json({ 
        success: true, 
        likes: 1,
        warning: '点赞功能需要数据库支持likes字段' 
      });
    }
    
    const currentLikes = currentData?.likes || 0;
    const newLikes = currentLikes + 1;
    
    // 更新点赞数
    const { error: updateError } = await supabase
      .from('announcements')
      .update({ likes: newLikes })
      .eq('id', id);
    
    if (updateError) {
      throw updateError;
    }
    
    return NextResponse.json({ 
      success: true, 
      likes: newLikes 
    });
  } catch (e: any) {
    console.error('点赞错误:', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}