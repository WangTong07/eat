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
    // 先尝试包含author字段
    let { data, error } = await supabase
      .from('announcements')
      .select('id, created_at, content, is_active, author')
      .order('created_at', { ascending: false });
    
    // 如果author字段不存在，则不包含它
    if (error && error.message.includes('author')) {
      const { data: dataWithoutAuthor, error: errorWithoutAuthor } = await supabase
        .from('announcements')
        .select('id, created_at, content, is_active')
        .order('created_at', { ascending: false });
      
      if (errorWithoutAuthor) throw errorWithoutAuthor;
      
      // 为每个项目添加默认的author字段
      data = dataWithoutAuthor?.map(item => ({ ...item, author: null })) || [];
    } else if (error) {
      throw error;
    }
    
    return NextResponse.json({ items: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { content, author, is_active } = await req.json();
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content 必填' }, { status: 400 });
    }
    
    const supabase = getClient();
    
    // 尝试插入包含author字段的数据
    let insertData: any = { content, is_active: is_active !== false };
    if (author && typeof author === 'string') {
      insertData.author = author;
    }
    
    const { error } = await supabase
      .from('announcements')
      .insert(insertData);
      
    if (error) {
      // 如果author字段不存在，尝试不包含author字段
      if (error.message.includes('author')) {
        const { error: retryError } = await supabase
          .from('announcements')
          .insert({ content, is_active: is_active !== false });
        if (retryError) throw retryError;
      } else {
        throw error;
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, content, author, is_active } = await req.json();
    if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 });
    
    const supabase = getClient();
    const updateData: any = {};
    if (content !== undefined) updateData.content = content;
    if (is_active !== undefined) updateData.is_active = is_active;
    
    // 只有当author字段存在时才添加到更新数据中
    if (author !== undefined) {
      updateData.author = author;
    }
    
    const { error } = await supabase
      .from('announcements')
      .update(updateData)
      .eq('id', id);
      
    if (error) {
      // 如果author字段不存在，尝试不包含author字段的更新
      if (error.message.includes('author')) {
        const retryUpdateData: any = {};
        if (content !== undefined) retryUpdateData.content = content;
        if (is_active !== undefined) retryUpdateData.is_active = is_active;
        
        const { error: retryError } = await supabase
          .from('announcements')
          .update(retryUpdateData)
          .eq('id', id);
        if (retryError) throw retryError;
      } else {
        throw error;
      }
    }
    
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


