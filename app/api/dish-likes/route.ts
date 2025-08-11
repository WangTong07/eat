import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

// 获取用户标识（简单实现，可以根据需要改进）
function getUserIdentifier(request: NextRequest): string {
  // 优先使用用户提供的标识，否则使用IP
  const userAgent = request.headers.get('user-agent') || '';
  const ip = request.headers.get('x-forwarded-for') || 
            request.headers.get('x-real-ip') || 
            'unknown';
  return `${ip}-${userAgent.slice(0, 50)}`.replace(/[^a-zA-Z0-9-]/g, '');
}

// GET: 获取所有菜品的点赞统计
export async function GET() {
  try {
    const supabase = getClient();
    
    // 获取点赞统计
    const { data, error } = await supabase
      .from('dish_likes')
      .select('dish_name')
      .order('created_at', { ascending: false });
    
    if (error) throw error;

    // 统计每道菜的点赞数
    const likeStats: Record<string, number> = {};
    (data || []).forEach(like => {
      likeStats[like.dish_name] = (likeStats[like.dish_name] || 0) + 1;
    });

    return NextResponse.json({ stats: likeStats });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

// POST: 点赞或取消点赞
export async function POST(request: NextRequest) {
  try {
    const { dish_name, action } = await request.json();
    
    if (!dish_name) {
      return NextResponse.json({ error: '菜品名称不能为空' }, { status: 400 });
    }

    const supabase = getClient();
    const userIdentifier = getUserIdentifier(request);

    if (action === 'like') {
      // 添加点赞
      const { error } = await supabase
        .from('dish_likes')
        .insert([{ dish_name, user_identifier: userIdentifier }]);
      
      if (error) {
        // 如果是重复点赞，返回成功（幂等性）
        if (error.code === '23505') {
          return NextResponse.json({ success: true, message: '已经点赞过了' });
        }
        throw error;
      }
      
      return NextResponse.json({ success: true, message: '点赞成功' });
    } else if (action === 'unlike') {
      // 取消点赞
      const { error } = await supabase
        .from('dish_likes')
        .delete()
        .eq('dish_name', dish_name)
        .eq('user_identifier', userIdentifier);
      
      if (error) throw error;
      
      return NextResponse.json({ success: true, message: '取消点赞成功' });
    } else {
      return NextResponse.json({ error: '无效的操作' }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

// GET: 获取用户的点赞状态
export async function PUT(request: NextRequest) {
  try {
    const { dish_names } = await request.json();
    
    if (!Array.isArray(dish_names)) {
      return NextResponse.json({ error: '菜品名称列表格式错误' }, { status: 400 });
    }

    const supabase = getClient();
    const userIdentifier = getUserIdentifier(request);

    const { data, error } = await supabase
      .from('dish_likes')
      .select('dish_name')
      .eq('user_identifier', userIdentifier)
      .in('dish_name', dish_names);
    
    if (error) throw error;

    const userLikes: Record<string, boolean> = {};
    dish_names.forEach(name => {
      userLikes[name] = (data || []).some(like => like.dish_name === name);
    });

    return NextResponse.json({ userLikes });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}