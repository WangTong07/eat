import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { dish } = await request.json();
    
    if (!dish) {
      return NextResponse.json({ error: '菜品名称不能为空' }, { status: 400 });
    }

    const response = await fetch(process.env.AI_API_BASE!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的厨师助手。请分析用户提供的菜品名称，提取制作这道菜所需的主要食材。只返回食材名称，用逗号分隔，不要包含调料（如盐、酱油、醋、料酒等基础调味品）。如果是水果，直接返回水果名称。'
          },
          {
            role: 'user',
            content: `请分析"${dish}"这道菜需要哪些主要食材？只返回食材名称，用逗号分隔。`
          }
        ],
        temperature: 0.1,
        max_tokens: 100
      })
    });

    if (!response.ok) {
      throw new Error(`AI API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // 解析AI返回的食材列表
    const ingredients = content
      .split(/[,，、]/)
      .map((item: string) => item.trim())
      .filter((item: string) => item.length > 0);

    console.log(`[AI分析API] ${dish} -> ${ingredients.join(', ')}`);
    
    return NextResponse.json({ ingredients });
  } catch (error: any) {
    console.error('[AI分析API失败]:', error);
    return NextResponse.json({ error: error.message || '分析失败' }, { status: 500 });
  }
}