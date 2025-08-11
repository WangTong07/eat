import { NextRequest, NextResponse } from "next/server";

// 规则分类函数
function classifyByRules(name: string): { category: string; confidence: number } {
  // 调料类 - 高置信度
  if (/(油|酱|醋|盐|糖|精|粉|料酒|生抽|老抽|耗油|蚝油|鸡精|味精|白糖|红糖|冰糖|食盐|白醋|陈醋|香醋|米醋|料酒|黄酒|胡椒|花椒|孜然|八角|桂皮|香叶|豆瓣|豆瓣酱|辣椒粉|辣椒面|花椒粉|胡椒粉|孜然粉|咖喱粉|五香粉|十三香|淀粉|生粉|玉米淀粉|土豆淀粉|红薯淀粉|辣椒油|香油|芝麻油|花生油|菜籽油|调和油|橄榄油|玉米油|葵花籽油|大豆油)/.test(name)) {
    return { category: "调料类", confidence: 0.9 };
  }
  
  // 肉类 - 高置信度
  if (/(猪|牛|羊|鸡(?!蛋)|鸭|鹅|肉|排骨|里脊|五花|腊肉|培根|鸡腿|鸡翅|鸡胸|牛肉末|猪肉末)/.test(name)) {
    return { category: "肉类", confidence: 0.9 };
  }
  
  // 海鲜类 - 高置信度
  if (/(虾|蟹|鱼|贝|海参|鱿|蛤|鲍|蛎|龙虾|扇贝|带鱼|黄鱼|鲫鱼|草鱼|鲤鱼|三文鱼)/.test(name)) {
    return { category: "海鲜类", confidence: 0.9 };
  }
  
  // 饮品类 - 高置信度
  if (/(牛奶|豆奶|酸奶|可乐|雪碧|汽水|苏打水|矿泉水|纯净水|果汁|橙汁|苹果汁|椰汁|椰奶|茶饮|奶茶|咖啡|啤酒|葡萄酒|黄酒|清酒|饮料|运动饮料|豆浆|蜂蜜水)/.test(name)) {
    return { category: "饮品类", confidence: 0.9 };
  }
  
  // 日杂类 - 高置信度
  if (/(纸|袋|保鲜|餐巾|洗洁|日杂|一次性|牙膏|纸巾|垃圾袋|保鲜膜|铝箔纸)/.test(name)) {
    return { category: "日杂类", confidence: 0.9 };
  }
  
  // 常见蔬果 - 中等置信度
  if (/(番茄|西红柿|土豆|马铃薯|胡萝卜|白萝卜|洋葱|大白菜|小白菜|包菜|卷心菜|西瓜|苹果|香蕉|橙子|梨|桃|葡萄|草莓|樱桃|芒果|菠萝|柚子|柠檬|猕猴桃|火龙果|鸡蛋|蛋)/.test(name)) {
    return { category: "蔬果类", confidence: 0.8 };
  }
  
  // 其他蔬菜 - 低置信度
  if (/(菜|葱|姜|蒜|豆腐|豆皮|豆芽|藕|金针菇|香菇|蘑菇|菌|茄子|青菜|油麦菜|娃娃菜|生菜|菠菜|西兰花|花菜|空心菜|豆角|四季豆|芹菜|黄瓜|冬瓜|南瓜|苦瓜|海带|木耳|莴笋|莴苣|莲藕|韭菜|蒜薹|香菜|花生|核桃|杏仁)/.test(name)) {
    return { category: "蔬果类", confidence: 0.6 };
  }
  
  // 默认分类 - 低置信度
  return { category: "蔬果类", confidence: 0.3 };
}

// AI分类函数
async function classifyByAI(ingredient: string): Promise<string> {
  try {
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
            content: '你是一个专业的食材分类助手。请将食材准确分类到以下6个类别之一：肉类、蔬果类、海鲜类、调料类、日杂类、饮品类。只返回类别名称，不要其他内容。'
          },
          {
            role: 'user',
            content: `请将"${ingredient}"分类到正确的类别中。只返回类别名称：肉类、蔬果类、海鲜类、调料类、日杂类、饮品类`
          }
        ],
        temperature: 0.1,
        max_tokens: 10
      })
    });

    if (!response.ok) {
      throw new Error(`AI分类请求失败: ${response.status}`);
    }

    const data = await response.json();
    const category = data.choices?.[0]?.message?.content?.trim() || '';
    
    // 验证返回的类别是否有效
    const validCategories = ['肉类', '蔬果类', '海鲜类', '调料类', '日杂类', '饮品类'];
    if (validCategories.includes(category)) {
      console.log(`[AI分类] ${ingredient} -> ${category}`);
      return category;
    } else {
      console.log(`[AI分类] ${ingredient} -> 无效类别 "${category}"，使用默认分类`);
      return '蔬果类';
    }
  } catch (error) {
    console.error(`[AI分类失败] ${ingredient}:`, error);
    return '蔬果类';
  }
}

// 智能分类主函数
async function smartClassify(ingredient: string): Promise<string> {
  // 1. 先用规则分类
  const ruleResult = classifyByRules(ingredient);
  
  // 2. 如果置信度高（>= 0.8），直接返回规则分类结果
  if (ruleResult.confidence >= 0.8) {
    console.log(`[规则分类] ${ingredient} -> ${ruleResult.category} (置信度: ${ruleResult.confidence})`);
    return ruleResult.category;
  }
  
  // 3. 置信度低，使用AI分类
  console.log(`[规则分类置信度低] ${ingredient} -> ${ruleResult.category} (置信度: ${ruleResult.confidence})，调用AI分类`);
  return await classifyByAI(ingredient);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ingredient } = body;
    
    if (!ingredient) {
      return NextResponse.json(
        { error: '缺少食材名称' },
        { status: 400 }
      );
    }

    const category = await smartClassify(ingredient);
    
    return NextResponse.json({ 
      ingredient,
      category,
      success: true 
    });

  } catch (error: any) {
    console.error('[智能分类API失败]:', error);
    return NextResponse.json(
      { error: '分类失败', details: error.message },
      { status: 500 }
    );
  }
}