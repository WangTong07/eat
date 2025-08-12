// 移除 "use server" 指令，因为这是 Next.js API 路由，不是服务器操作
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";

// 检查表是否存在的函数
async function checkTableExists() {
  const supabase = getSupabaseClient();
  
  try {
    // 简单查询以检查表是否存在
    const { data, error } = await supabase
      .from('shopping_list')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('检查表失败:', error);
      return false;
    }
    
    return true; // 表存在
  } catch (error) {
    console.error('检查表失败:', error);
    return false;
  }
}

// GET: 获取购物清单
export async function GET() {
  try {
    // 检查表是否存在
    const tableExists = await checkTableExists();
    if (!tableExists) {
      return NextResponse.json(
        { error: '购物清单表不存在或无法访问' },
        { status: 500 }
      );
    }
    
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('shopping_list')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('获取购物清单数据失败:', error);
      throw error;
    }
    
    return NextResponse.json({ items: data || [] });
  } catch (error: any) {
    console.error('获取购物清单失败:', error);
    return NextResponse.json(
      { error: '获取购物清单失败', details: error.message },
      { status: 500 }
    );
  }
}

// POST: 添加或更新购物清单项
export async function POST(request: NextRequest) {
  try {
    // 检查表是否存在
    const tableExists = await checkTableExists();
    if (!tableExists) {
      return NextResponse.json(
        { error: '购物清单表不存在或无法访问' },
        { status: 500 }
      );
    }
    
    // 解析请求数据
    const body = await request.json();
    const { items } = body;
    
    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: '无效的请求数据' },
        { status: 400 }
      );
    }
    
    const supabase = getSupabaseClient();
    
    // 简化操作：先删除所有项目，然后插入新项目
    // 这种方法在小型应用中更简单可靠
    const { error: deleteError } = await supabase
      .from('shopping_list')
      .delete()
      .gte('id', '0'); // 删除所有记录
    
    if (deleteError) {
      console.error('删除购物清单项目失败:', deleteError);
      throw deleteError;
    }
    
    // 如果有新项目，则插入
    if (items.length > 0) {
      // 准备插入数据，确保每个项目都有必要的字段
      const validItems = items.map(item => ({
        id: item.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: item.name,
        category: item.category,
        checked: item.checked || false,
        qty: item.qty || null
      }));
      
      // 插入新项目
      const { error: insertError } = await supabase
        .from('shopping_list')
        .insert(validItems);
      
      if (insertError) {
        console.error('插入购物清单项目失败:', insertError);
        throw insertError;
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('保存购物清单失败:', error);
    return NextResponse.json(
      { error: '保存购物清单失败', details: error.message },
      { status: 500 }
    );
  }
}

// PUT: 添加单个购物清单项
export async function PUT(request: NextRequest) {
  try {
    // 检查表是否存在
    const tableExists = await checkTableExists();
    if (!tableExists) {
      return NextResponse.json(
        { error: '购物清单表不存在或无法访问' },
        { status: 500 }
      );
    }
    
    const body = await request.json();
    const { item } = body;
    
    if (!item || !item.name || !item.category) {
      return NextResponse.json(
        { error: '无效的请求数据' },
        { status: 400 }
      );
    }
    
    const supabase = getSupabaseClient();
    
    // 插入新项目
    const { error } = await supabase.from('shopping_list').insert({
      id: item.id || `${Date.now()}`,
      name: item.name,
      category: item.category,
      checked: item.checked || false,
      qty: item.qty || null
    });
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('添加购物清单项失败:', error);
    return NextResponse.json(
      { error: '添加购物清单项失败', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: 删除购物清单项
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: '缺少ID参数' },
        { status: 400 }
      );
    }
    
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('shopping_list')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('删除购物清单项失败:', error);
    return NextResponse.json(
      { error: '删除购物清单项失败', details: error.message },
      { status: 500 }
    );
  }
}