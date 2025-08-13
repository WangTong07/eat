import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const { postId, content, author } = await req.json();
    if (!postId || !content || !author) {
      return NextResponse.json({ error: '所有字段都是必填的' }, { status: 400 });
    }
    
    const supabase = getClient();
    
    // 先获取当前的评论列表
    const { data: currentData, error: fetchError } = await supabase
      .from('announcements')
      .select('comments')
      .eq('id', postId)
      .single();
    
    if (fetchError) {
      // 如果comments字段不存在，返回警告但不报错
      console.log('comments字段可能不存在:', fetchError.message);
      return NextResponse.json({ 
        success: true, 
        warning: '回复功能需要数据库支持comments字段' 
      });
    }
    
    const currentComments = currentData?.comments || [];
    
    // 创建新评论
    const newComment = {
      id: Date.now().toString(), // 简单的ID生成
      content: content.trim(),
      author: author.trim(),
      created_at: new Date().toISOString()
    };
    
    const updatedComments = [...currentComments, newComment];
    
    // 更新评论列表
    const { error: updateError } = await supabase
      .from('announcements')
      .update({ comments: updatedComments })
      .eq('id', postId);
    
    if (updateError) {
      throw updateError;
    }
    
    return NextResponse.json({ 
      success: true, 
      comment: newComment,
      totalComments: updatedComments.length
    });
  } catch (e: any) {
    console.error('回复错误:', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}