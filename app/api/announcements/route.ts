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
    // 先尝试包含所有新字段
    let { data, error } = await supabase
      .from('announcements')
      .select('id, created_at, content, is_active, author, type, likes, comments')
      .order('created_at', { ascending: false });
    
    // 如果新字段不存在，逐步回退
    if (error) {
      // 尝试包含部分字段
      const { data: dataPartial, error: errorPartial } = await supabase
        .from('announcements')
        .select('id, created_at, content, is_active, author')
        .order('created_at', { ascending: false });
      
      if (errorPartial) {
        // 最基础的字段
        const { data: dataBasic, error: errorBasic } = await supabase
          .from('announcements')
          .select('id, created_at, content, is_active')
          .order('created_at', { ascending: false });
        
        if (errorBasic) throw errorBasic;
        
        // 为每个项目添加默认字段
        data = dataBasic?.map(item => ({ 
          ...item, 
          author: null,
          type: 'message',
          likes: 0,
          comments: []
        })) || [];
      } else {
        // 为每个项目添加缺失的新字段
        data = dataPartial?.map(item => ({ 
          ...item,
          type: item.type || 'message',
          likes: item.likes || 0,
          comments: item.comments || []
        })) || [];
      }
    } else if (data) {
      // 确保所有字段都有默认值
      data = data.map(item => ({
        ...item,
        type: item.type || 'message',
        likes: item.likes || 0,
        comments: item.comments || []
      }));
    }
    
    return NextResponse.json({ items: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { content, author, is_active, type, likes, comments } = await req.json();
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content 必填' }, { status: 400 });
    }
    
    const supabase = getClient();
    
    // 构建插入数据，包含所有新字段
    let insertData: any = { 
      content, 
      is_active: is_active !== false,
      type: type || 'message',
      likes: likes || 0,
      comments: comments || []
    };
    
    // 如果有author，添加它
    if (author && typeof author === 'string' && author.trim()) {
      insertData.author = author.trim();
    }
    
    console.log('尝试插入数据:', insertData);
    
    const { error } = await supabase
      .from('announcements')
      .insert(insertData);
      
    if (error) {
      // 如果新字段不存在，逐步回退
      if (error.message.includes('type') || error.message.includes('likes') || error.message.includes('comments')) {
        console.log('新字段不存在，使用基础字段插入');
        const basicData: any = { 
          content, 
          is_active: is_active !== false 
        };
        
        // 尝试包含author字段
        if (author && typeof author === 'string' && author.trim()) {
          basicData.author = author.trim();
        }
        
        const { error: retryError } = await supabase
          .from('announcements')
          .insert(basicData);
          
        if (retryError) {
          // 如果author也不存在，使用最基础的字段
          if (retryError.message.includes('author')) {
            const minimalData = { content, is_active: is_active !== false };
            const { error: minimalError } = await supabase
              .from('announcements')
              .insert(minimalData);
            if (minimalError) throw minimalError;
          } else {
            throw retryError;
          }
        }
        
        console.log('插入成功，但部分字段未保存');
        return NextResponse.json({ 
          success: true, 
          warning: '发布成功，但部分新功能字段未保存。' 
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
    const { id, content, author, is_active, type, likes, comments } = await req.json();
    if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 });
    
    const supabase = getClient();
    let updateData: any = {};
    if (content !== undefined) updateData.content = content;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (type !== undefined) updateData.type = type;
    if (likes !== undefined) updateData.likes = likes;
    if (comments !== undefined) updateData.comments = comments;
    
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
      // 如果新字段不存在，回退到基础字段更新
      if (error.message.includes('type') || error.message.includes('likes') || error.message.includes('comments')) {
        console.log('新字段不存在，使用基础字段更新');
        const basicUpdateData: any = {};
        if (content !== undefined) basicUpdateData.content = content;
        if (is_active !== undefined) basicUpdateData.is_active = is_active;
        if (author !== undefined) basicUpdateData.author = author;
        
        const { error: retryError } = await supabase
          .from('announcements')
          .update(basicUpdateData)
          .eq('id', id);
          
        if (retryError) {
          // 如果author也不存在，使用最基础的字段
          if (retryError.message.includes('author')) {
            const minimalUpdateData: any = {};
            if (content !== undefined) minimalUpdateData.content = content;
            if (is_active !== undefined) minimalUpdateData.is_active = is_active;
            
            const { error: minimalError } = await supabase
              .from('announcements')
              .update(minimalUpdateData)
              .eq('id', id);
            if (minimalError) throw minimalError;
          } else {
            throw retryError;
          }
        }
        
        console.log('更新成功，但部分字段未保存');
        return NextResponse.json({ 
          success: true, 
          warning: '更新成功，但部分新功能字段未保存。' 
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


