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
    
    // 先尝试包含author字段的插入
    let insertData: any = { 
      content, 
      is_active: is_active !== false
    };
    
    // 如果有author，先尝试包含它
    if (author && typeof author === 'string' && author.trim()) {
      insertData.author = author.trim();
    }
    
    console.log('尝试插入数据:', insertData);
    
    const { error } = await supabase
      .from('announcements')
      .insert(insertData);
      
    if (error) {
      // 如果author字段不存在，回退到不包含author的插入
      if (error.message.includes('author')) {
        console.log('author字段不存在，使用基础字段插入');
        const basicData = { content, is_active: is_active !== false };
        const { error: retryError } = await supabase
          .from('announcements')
          .insert(basicData);
        if (retryError) throw retryError;
        
        // 成功插入，但提醒需要添加author字段
        console.log('插入成功，但author字段未保存');
        return NextResponse.json({ 
          success: true, 
          warning: '发布成功，但发布人信息未保存。请联系管理员添加author字段。' 
        });
      } else {
        throw error;
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('POST错误:', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, content, author, is_active } = await req.json();
    if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 });
    
    const supabase = getClient();
    let updateData: any = {};
    if (content !== undefined) updateData.content = content;
    if (is_active !== undefined) updateData.is_active = is_active;
    
    // 尝试包含author字段
    if (author !== undefined) {
      updateData.author = author;
    }
    
    console.log('尝试更新数据:', updateData);
    
    const { error } = await supabase
      .from('announcements')
      .update(updateData)
      .eq('id', id);
      
    if (error) {
      // 如果author字段不存在，回退到不包含author的更新
      if (error.message.includes('author')) {
        console.log('author字段不存在，使用基础字段更新');
        const basicUpdateData: any = {};
        if (content !== undefined) basicUpdateData.content = content;
        if (is_active !== undefined) basicUpdateData.is_active = is_active;
        
        const { error: retryError } = await supabase
          .from('announcements')
          .update(basicUpdateData)
          .eq('id', id);
        if (retryError) throw retryError;
        
        console.log('更新成功，但author字段未保存');
        return NextResponse.json({ 
          success: true, 
          warning: '更新成功，但发布人信息未保存。请联系管理员添加author字段。' 
        });
      } else {
        throw error;
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('PATCH错误:', e);
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


