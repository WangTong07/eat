import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

function normalizeDish(content: string): string {
  const str = (content || "").trim();
  // 取到空格/逗号/顿号/括号之前
  const m = str.match(/^[^,，、（(\s)]+/);
  return m ? m[0] : str;
}

async function guessIngredientsWithAI(dish: string): Promise<string[]> {
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

    console.log(`[AI分析] ${dish} -> ${ingredients.join(', ')}`);
    return ingredients;
  } catch (error) {
    console.error(`[AI分析失败] ${dish}:`, error);
    // 如果AI调用失败，回退到简单规则
    return guessIngredientsFallback(dish);
  }
}

function guessIngredientsFallback(dish: string): string[] {
  const items: string[] = [];
  const add = (arr: string[]) => arr.forEach((i) => items.includes(i) ? null : items.push(i));
  const d = dish || "";
  
  // 简化的回退规则
  if (/(鸡蛋.*柿子|鸡蛋.*西红柿|鸡蛋.*番茄|柿子.*鸡蛋|西红柿.*鸡蛋|番茄.*鸡蛋)/.test(d)) add(["鸡蛋", "西红柿", "葱"]);
  else if (/红烧肉/.test(d)) add(["五花肉", "葱", "姜", "蒜"]);
  else if (/排骨/.test(d)) add(["排骨", "葱", "姜", "蒜"]);
  else if (/鸡翅/.test(d)) add(["鸡翅", "葱", "姜", "蒜"]);
  else if (/苹果/.test(d)) add(["苹果"]);
  else if (/西瓜/.test(d)) add(["西瓜"]);
  else add([d]);
  
  return items;
}

function guessIngredients(dish: string): string[] {
  // 注意：这里返回Promise，但为了保持兼容性，我们需要修改调用方式
  return guessIngredientsFallback(dish);
}

// 智能分类函数
async function smartClassify(ingredient: string): Promise<string> {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3200'}/api/ai-classify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ingredient })
    });

    if (!response.ok) {
      throw new Error(`分类API请求失败: ${response.status}`);
    }

    const data = await response.json();
    return data.category || '蔬果类';
  } catch (error) {
    console.error(`[智能分类失败] ${ingredient}:`, error);
    // 回退到简单分类
    return fallbackClassify(ingredient);
  }
}

// 回退分类函数
function fallbackClassify(name: string): string {
  // 调料类
  if (/(油|酱|醋|盐|糖|精|粉|料酒|生抽|老抽|耗油|蚝油|鸡精|味精|白糖|红糖|冰糖|食盐|白醋|陈醋|香醋|米醋|料酒|黄酒|胡椒|花椒|孜然|八角|桂皮|香叶|豆瓣|豆瓣酱|辣椒粉|辣椒面|花椒粉|胡椒粉|孜然粉|咖喱粉|五香粉|十三香|淀粉|生粉|玉米淀粉|土豆淀粉|红薯淀粉|辣椒油|香油|芝麻油|花生油|菜籽油|调和油|橄榄油|玉米油|葵花籽油|大豆油)/.test(name)) return "调料类";
  
  // 肉类
  if (/(猪|牛|羊|鸡(?!蛋)|鸭|鹅|肉|排骨|里脊|五花|腊肉|培根|鸡腿|鸡翅|鸡胸|牛肉末|猪肉末)/.test(name)) return "肉类";
  
  // 海鲜类
  if (/(虾|蟹|鱼|贝|海参|鱿|蛤|鲍|蛎|龙虾|扇贝|带鱼|黄鱼|鲫鱼|草鱼|鲤鱼|三文鱼)/.test(name)) return "海鲜类";
  
  // 饮品类
  if (/(牛奶|豆奶|酸奶|可乐|雪碧|汽水|苏打水|矿泉水|纯净水|果汁|橙汁|苹果汁|椰汁|椰奶|茶饮|奶茶|咖啡|啤酒|葡萄酒|黄酒|清酒|饮料|运动饮料|豆浆|蜂蜜水)/.test(name)) return "饮品类";
  
  // 日杂类
  if (/(纸|袋|保鲜|餐巾|洗洁|日杂|一次性|牙膏|纸巾|垃圾袋|保鲜膜|铝箔纸)/.test(name)) return "日杂类";
  
  // 豆制品 - 专门处理豆腐等豆制品，确保分到蔬果类
  if (/(豆腐|豆干|豆皮|豆腐皮|千张|腐竹|豆腐丝|臭豆腐|嫩豆腐|老豆腐|内酯豆腐|豆腐块|豆腐条|豆制品)/.test(name)) return "蔬果类";
  
  // 默认蔬果类
  return "蔬果类";
}

// 自动同步食材到购物清单
async function autoSyncIngredientsToShoppingList(allIngredients: string[]) {
  try {
    const supabase = getClient();
    
    // 获取现有购物清单
    const { data: existingItems } = await supabase
      .from('shopping_list')
      .select('name');
    
    const existingNames = new Set((existingItems || []).map(item => item.name));
    
    // 过滤出新食材
    const newIngredients = allIngredients.filter(ingredient => !existingNames.has(ingredient));
    
    if (newIngredients.length === 0) {
      console.log('[自动同步] 所有食材已存在于购物清单中');
      return;
    }
    
    // 使用智能分类为每个食材分类
    const itemsToAdd = [];
    for (const ingredient of newIngredients) {
      const category = await smartClassify(ingredient);
      itemsToAdd.push({
        id: `auto-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: ingredient,
        category: category,
        checked: false,
        qty: null
      });
      
      // 添加小延迟避免API调用过快
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // 插入到购物清单
    const { error } = await supabase
      .from('shopping_list')
      .insert(itemsToAdd);
    
    if (error) {
      console.error('[自动同步] 同步食材到购物清单失败:', error);
    } else {
      console.log(`[自动同步] 成功添加 ${newIngredients.length} 个食材到购物清单:`, newIngredients);
      // 打印分类结果
      itemsToAdd.forEach(item => {
        console.log(`[智能分类] ${item.name} -> ${item.category}`);
      });
    }
  } catch (error) {
    console.error('[自动同步] 同步过程出错:', error);
  }
}

export async function GET() {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('menu_wishes')
      .select('id, user_name, request_type, content, status, created_at')
      .eq('request_type', '想吃的菜')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;

    const seen = new Set<string>();
    const recs: Array<{ dish: string; ingredients: string[]; wish_id: string; created_at?: string }>=[];
    const allIngredients: string[] = [];
    
    // 使用AI分析每道菜的食材
    for (const w of data || []) {
      const dish = normalizeDish(w.content || "");
      if (!dish || seen.has(dish)) continue;
      seen.add(dish);
      
      // 使用AI分析食材
      const ingredients = await guessIngredientsWithAI(dish);
      recs.push({ dish, ingredients, wish_id: w.id, created_at: w.created_at });
      
      // 收集所有食材
      allIngredients.push(...ingredients);
      
      if (recs.length >= 9) break;
    }

    // 自动同步所有食材到购物清单
    if (allIngredients.length > 0) {
      await autoSyncIngredientsToShoppingList(allIngredients);
    }

    return NextResponse.json({ items: recs });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}


