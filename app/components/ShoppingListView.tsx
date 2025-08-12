"use client";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useRealtimeSubscription } from "@/lib/useRealtimeSubscription";

type Rec = { dish: string; ingredients: string[] };
type Item = { id: string; name: string; category: Category; qty?: string; checked?: boolean };
type Category = "肉类" | "蔬果类" | "海鲜类" | "调料类" | "日杂类" | "饮品类";

const CATEGORY_ORDER: Category[] = ["肉类", "蔬果类", "海鲜类", "调料类", "日杂类", "饮品类"];

// 分类表情符号映射
const CATEGORY_EMOJIS: Record<Category, string> = {
  "肉类": "🥩",
  "蔬果类": "🥬", 
  "海鲜类": "🦐",
  "调料类": "🧂",
  "日杂类": "🧻",
  "饮品类": "🥤"
};

export default function ShoppingListView() {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [list, setList] = useState<Item[]>([]);
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState<Category | "智能分类">("智能分类");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(()=>{
    (async()=>{
      try{
        const r = await fetch('/api/recommendations');
        const j = await r.json();
        setRecs(j.items || []);
      }catch{}
    })();
  },[]);

  // 使用AI分析食材的异步函数
  const guessIngredientsWithAI = async (dish: string): Promise<string[]> => {
    try {
      const response = await fetch('/api/ai-ingredients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dish })
      });

      if (!response.ok) {
        throw new Error(`AI分析请求失败: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[前端AI分析] ${dish} -> ${data.ingredients.join(', ')}`);
      return data.ingredients || [];
    } catch (error) {
      console.error(`[前端AI分析失败] ${dish}:`, error);
      // 如果AI调用失败，回退到简单规则
      return guessIngredientsFallback(dish);
    }
  };

  // 回退的食材提取函数
  const guessIngredientsFallback = (dish: string): string[] => {
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
  };

  // 同步版本的食材提取函数（用于兼容现有代码）
  const guessIngredients = (dish: string): string[] => {
    return guessIngredientsFallback(dish);
  };

  // 智能分类函数
  const smartClassify = async (ingredient: string): Promise<Category> => {
    try {
      const response = await fetch('/api/ai-classify', {
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
      return (data.category || '蔬果类') as Category;
    } catch (error) {
      console.error(`[前端智能分类失败] ${ingredient}:`, error);
      // 回退到简单分类
      return fallbackClassify(ingredient);
    }
  };

  // 回退分类函数
  const fallbackClassify = (name: string): Category => {
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
  };

  // 同步版本的分类函数（用于兼容现有代码）
  const classify = (name: string): Category => {
    return fallbackClassify(name);
  };

  // 从数据库加载购物清单
  const loadShoppingList = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('shopping_list')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('加载购物清单失败:', error);
        setError("加载购物清单失败，请稍后重试");
        
        // 尝试从本地存储恢复
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem('shopping_list_latest') : null;
        if (raw) {
          const saved = JSON.parse(raw);
          if (Array.isArray(saved) && saved.length > 0) {
            setList(saved);
          }
        }
        return;
      }
      
      // 将数据库数据转换为应用所需格式（包括空数组的情况）
      const items = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        category: item.category as Category,
        checked: item.checked || false,
        qty: item.qty
      }));
      setList(items);
      
      // 同时更新本地存储作为备份
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('shopping_list_latest', JSON.stringify(items));
      }
      
      // 只有在首次加载且数据库为空时才生成初始清单
      if (items.length === 0 && !window.localStorage.getItem('shopping_list_initialized')) {
        // 标记已初始化，避免重复生成
        window.localStorage.setItem('shopping_list_initialized', 'true');
        generateInitialList();
      }
    } catch (error) {
      console.error('加载购物清单失败:', error);
      setError("加载购物清单失败，请稍后重试");
      
      // 尝试从本地存储恢复
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('shopping_list_latest') : null;
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length > 0) {
          setList(saved);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 根据推荐菜生成初始清单
  const generateInitialList = () => {
    console.log('[ShoppingListView] 开始生成初始购物清单，推荐菜数据:', recs);
    
    const base = {};
    recs.forEach(r => {
      console.log('[ShoppingListView] 处理推荐菜:', r.dish, '食材:', r.ingredients);
      
      // 直接使用推荐菜API返回的食材，这些已经是AI分析过的
      const ingredients = r.ingredients || [];
      console.log('[ShoppingListView] 使用推荐菜的食材:', ingredients);
      
      ingredients.forEach(ingredient => {
        const key = ingredient.trim();
        if (!key) return;
        if (!base[key]) {
          base[key] = { 
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${key}`, 
            name: key, 
            category: classify(key) 
          };
        }
      });
    });
    
    const arr = Object.values(base);
    console.log('[ShoppingListView] 生成的购物清单:', arr);
    setList(arr);
    
    // 保存到数据库
    saveToDatabase(arr);
  };

  // 保存到数据库
  const saveToDatabase = async (items) => {
    try {
      const supabase = getSupabaseClient();
      
      // 先删除所有现有项目
      await supabase.from('shopping_list').delete().gte('id', '0');
      
      // 如果没有数据，直接返回
      if (items.length === 0) return;
      
      // 插入新数据
      const { error } = await supabase.from('shopping_list').insert(
        items.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          checked: item.checked || false,
          qty: item.qty || null
        }))
      );
      
      if (error) {
        console.error('保存购物清单失败:', error);
        setError("保存购物清单失败，请稍后重试");
        
        // 保存到本地作为备份
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('shopping_list_latest', JSON.stringify(items));
        }
      }
    } catch (error) {
      console.error('保存购物清单失败:', error);
      setError("保存购物清单失败，请稍后重试");
      
      // 保存到本地作为备份
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('shopping_list_latest', JSON.stringify(items));
      }
    }
  };

  // 初始加载
  useEffect(() => {
    loadShoppingList();
  }, []);

  // 当推荐菜数据加载完成后，自动生成购物清单
  useEffect(() => {
    if (recs.length > 0) {
      console.log('[ShoppingListView] 推荐菜数据已加载，自动生成购物清单:', recs);
      // 检查当前购物清单是否为空，如果为空则自动生成
      if (list.length === 0) {
        console.log('[ShoppingListView] 购物清单为空，自动从推荐菜生成');
        generateInitialList();
      }
    }
  }, [recs]);

  // 添加实时订阅 - 购物清单变更
  useRealtimeSubscription({
    table: 'shopping_list',
    onChange: (payload) => {
      console.log('[ShoppingListView] 检测到购物清单变更:', payload);
      
      // 监听所有事件类型：INSERT、UPDATE、DELETE
      if (payload.eventType === 'INSERT') {
        console.log('[ShoppingListView] 检测到新增食材，重新加载...');
        setTimeout(() => loadShoppingList(), 100);
      } else if (payload.eventType === 'UPDATE') {
        console.log('[ShoppingListView] 检测到食材更新，同步本地状态...');
        // 直接更新本地状态，避免重新加载整个列表
        const updatedItem = payload.new;
        setList(prevList => 
          prevList.map(item => 
            item.id === updatedItem.id 
              ? { ...item, checked: updatedItem.checked, qty: updatedItem.qty }
              : item
          )
        );
      } else if (payload.eventType === 'DELETE') {
        console.log('[ShoppingListView] 检测到食材删除，同步本地状态...');
        // 直接从本地状态中移除，避免重新加载整个列表
        const deletedItem = payload.old;
        setList(prevList => prevList.filter(item => item.id !== deletedItem.id));
      }
    }
  });

  // 添加实时订阅 - 监听新的菜品心愿
  useRealtimeSubscription({
    table: 'menu_wishes',
    onChange: (payload) => {
      console.log('[ShoppingListView] 检测到新的菜品心愿:', payload);
      
      // 只处理新增的"想吃的菜"类型心愿
      if (payload.eventType === 'INSERT' && payload.new?.request_type === '想吃的菜') {
        const newWish = payload.new;
        console.log('[ShoppingListView] 自动处理新心愿:', newWish.content);
        
        // 自动添加新心愿的食材到购物清单
        autoAddIngredientsFromWish(newWish);
      }
    }
  });

  // 自动从新心愿中添加食材
  const autoAddIngredientsFromWish = async (wish) => {
    try {
      const dishName = wish.content?.trim();
      console.log('[ShoppingListView] 开始处理新心愿:', dishName, '完整数据:', wish);
      
      if (!dishName) {
        console.log('[ShoppingListView] 菜品名称为空，跳过处理');
        return;
      }

      console.log('[ShoppingListView] 正在使用AI为新菜品提取食材:', dishName);
      
      // 使用AI分析食材
      const ingredients = await guessIngredientsWithAI(dishName);
      console.log('[ShoppingListView] AI提取到的食材:', ingredients);
      
      if (ingredients.length === 0) {
        console.log('[ShoppingListView] 没有提取到食材，跳过处理');
        return;
      }

      // 获取当前购物清单
      const supabase = getSupabaseClient();
      const { data: currentItems, error: fetchError } = await supabase
        .from('shopping_list')
        .select('name');
      
      if (fetchError) {
        console.error('[ShoppingListView] 获取当前购物清单失败:', fetchError);
        return;
      }
      
      console.log('[ShoppingListView] 当前购物清单:', currentItems);
      const existingNames = new Set((currentItems || []).map(item => item.name));
      
      // 过滤出不存在的食材
      const newIngredients = ingredients.filter(ingredient => !existingNames.has(ingredient));
      console.log('[ShoppingListView] 需要添加的新食材:', newIngredients);
      
      if (newIngredients.length === 0) {
        console.log('[ShoppingListView] 所有食材已存在于购物清单中');
        setError(`"${dishName}"的食材已存在于购物清单中`);
        setTimeout(() => setError(""), 3000);
        return;
      }

      // 添加新食材到购物清单
      const itemsToAdd = newIngredients.map(ingredient => ({
        id: `auto-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: ingredient,
        category: classify(ingredient),
        checked: false
      }));

      console.log('[ShoppingListView] 准备添加的食材项:', itemsToAdd);

      const { error } = await supabase
        .from('shopping_list')
        .insert(itemsToAdd);

      if (error) {
        console.error('[ShoppingListView] 自动添加食材失败:', error);
        setError(`自动添加"${dishName}"的食材失败，请稍后重试`);
        setTimeout(() => setError(""), 5000);
      } else {
        console.log(`[ShoppingListView] 成功自动添加 ${newIngredients.length} 个食材:`, newIngredients);
        
        // 显示通知给用户
        setError(`已自动添加"${dishName}"的食材：${newIngredients.join('、')}`);
        setTimeout(() => setError(""), 5000); // 5秒后清除通知
      }
    } catch (error) {
      console.error('[ShoppingListView] 自动添加食材时出错:', error);
      setError(`处理新心愿时出错，请稍后重试`);
      setTimeout(() => setError(""), 5000);
    }
  };

  const byCat = useMemo(()=>{
    const map: Record<Category, Item[]> = { "肉类":[], "蔬果类":[], "海鲜类":[], "调料类":[], "日杂类":[], "饮品类":[] };
    list.forEach(i=> {
      if (map[i.category]) {
        map[i.category].push(i);
      } else {
        // 如果分类不存在，默认放到蔬果类
        map["蔬果类"].push(i);
      }
    });
    return map;
  },[list]);

  // 添加物品
  const addItem = async () => {
    if (!newName.trim()) return;
    setError("");
    
    // 如果用户选择了"智能分类"，使用AI分类
    let finalCategory = newCat;
    if (newCat === "智能分类") {
      try {
        finalCategory = await smartClassify(newName.trim());
        console.log(`[手动添加-智能分类] ${newName.trim()} -> ${finalCategory}`);
      } catch (error) {
        console.error('智能分类失败，使用默认分类:', error);
        finalCategory = "蔬果类";
      }
    }
    
    // 创建新物品
    const item = { 
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, 
      name: newName.trim(), 
      category: finalCategory as Category,
      checked: false
    };
    
    // 先更新本地状态，使界面立即响应
    const newList = [...list, item];
    setList(newList);
    setNewName("");
    
    try {
      const supabase = getSupabaseClient();
      
      // 保存到数据库
      const { error } = await supabase.from('shopping_list').insert({
        id: item.id,
        name: item.name,
        category: item.category,
        checked: item.checked
      });
      
      if (error) {
        console.error('添加物品失败:', error);
        setError("添加物品失败，请稍后重试");
        
        // 保存到本地作为备份
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('shopping_list_latest', JSON.stringify(newList));
        }
      }
    } catch (error) {
      console.error('添加物品失败:', error);
      setError("添加物品失败，请稍后重试");
      
      // 保存到本地作为备份
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('shopping_list_latest', JSON.stringify(newList));
      }
    }
  };

  // 删除物品
  const removeItem = async (id: string) => {
    setError("");
    
    // 先更新本地状态，使界面立即响应
    const newList = list.filter(item => item.id !== id);
    setList(newList);
    
    try {
      const supabase = getSupabaseClient();
      
      // 从数据库中删除
      const { error } = await supabase
        .from('shopping_list')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('删除物品失败:', error);
        setError("删除物品失败，请稍后重试");
        
        // 保存到本地作为备份
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('shopping_list_latest', JSON.stringify(newList));
        }
      }
    } catch (error) {
      console.error('删除物品失败:', error);
      setError("删除物品失败，请稍后重试");
      
      // 保存到本地作为备份
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('shopping_list_latest', JSON.stringify(newList));
      }
    }
  };

  // 更新物品状态
  const updateItemStatus = async (id, checked) => {
    setError("");
    
    // 先更新本地状态，使界面立即响应
    const newList = list.map(item => 
      item.id === id ? { ...item, checked } : item
    );
    setList(newList);
    
    try {
      const supabase = getSupabaseClient();
      
      // 更新数据库
      const { error } = await supabase
        .from('shopping_list')
        .update({ checked })
        .eq('id', id);
      
      if (error) {
        console.error('更新物品状态失败:', error);
        setError("更新物品状态失败，请稍后重试");
        
        // 保存到本地作为备份
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('shopping_list_latest', JSON.stringify(newList));
        }
      }
    } catch (error) {
      console.error('更新物品状态失败:', error);
      setError("更新物品状态失败，请稍后重试");
      
      // 保存到本地作为备份
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('shopping_list_latest', JSON.stringify(newList));
      }
    }
  };

  return (
    <section className="space-y-6">
      {error && (
        <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-sm flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <span className="block sm:inline font-medium">{error}</span>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-orange-900/30 via-amber-900/30 to-yellow-900/30 border border-orange-700/30 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-xl p-6 backdrop-blur-sm">
          <h3 className="font-bold mb-4 flex items-center gap-2 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">
            <span className="text-xl">➕</span>
            快速添加
          </h3>
          <div className="flex gap-3 items-center">
            <input 
              className="bg-gradient-to-r from-orange-800/30 to-amber-800/30 border border-orange-600/30 rounded-lg px-4 py-2 flex-1 text-orange-100 placeholder-orange-400/70 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-200" 
              placeholder="🥬 输入食材名称" 
              value={newName} 
              onChange={e=>setNewName(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && addItem()}
            />
            <select className="bg-gradient-to-r from-orange-800/30 to-amber-800/30 border border-orange-600/30 rounded-lg px-4 py-2 text-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-200" value={newCat} onChange={e=>setNewCat(e.target.value as Category | "智能分类")}>
              <option value="智能分类">🤖 智能分类</option>
              {CATEGORY_ORDER.map(c => <option key={c} value={c}>{CATEGORY_EMOJIS[c]} {c}</option>)}
            </select>
            <button 
              className="px-4 py-2 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-600 hover:from-orange-600 hover:via-amber-600 hover:to-yellow-700 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95" 
              onClick={addItem}
              disabled={isLoading || !newName.trim()}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  添加中...
                </>
              ) : (
                <>
                  <span>✨</span>
                  添加
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-900/30 via-amber-900/30 to-yellow-900/30 border border-orange-700/30 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-xl p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold flex items-center gap-2 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">
              <span className="text-xl">🍽️</span>
              从推荐菜生成清单
            </h3>
            <button 
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-600 hover:from-emerald-600 hover:via-green-600 hover:to-teal-700 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95" 
              onClick={() => {
                if (window.confirm('这将清空当前购物清单并从推荐菜中重新生成，确定继续吗？')) {
                  generateInitialList();
                }
              }}
              disabled={isLoading || recs.length === 0}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  生成中...
                </>
              ) : (
                <>
                  <span>🔄</span>
                  重新生成
                </>
              )}
            </button>
          </div>
          <div className="text-sm text-orange-200/80 bg-gradient-to-r from-orange-800/20 via-amber-800/20 to-yellow-800/20 border border-orange-600/30 p-4 rounded-lg backdrop-blur-sm">
            {recs.length > 0 ? (
              <div>
                <p className="flex items-center gap-2 mb-2">
                  <span className="text-base">📋</span>
                  <strong className="text-orange-100">本周推荐菜：</strong>{recs.map(r => r.dish).join('、')}
                </p>
                <p className="flex items-center gap-2 text-orange-300/70">
                  <span className="text-base">💡</span>
                  点击"重新生成"按钮将根据推荐菜自动添加所需食材
                </p>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-orange-400/70">
                <span className="text-base">😴</span>
                暂无推荐菜数据
              </p>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-4">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATEGORY_ORDER.map((cat, index) => {
            // 为每个分类定义不同的橙色系配色
            const categoryStyles = {
              "肉类": {
                bg: "from-red-900/40 via-orange-900/35 to-amber-900/30",
                border: "border-red-700/40",
                shadow: "shadow-red-500/10",
                hoverShadow: "hover:shadow-red-500/20",
                title: "from-red-400 via-orange-400 to-amber-400",
                badge: "from-red-500/25 to-orange-500/20 border-red-500/40",
                badgeText: "text-red-200",
                iconBg: "bg-gradient-to-br from-red-500/30 to-orange-500/20",
                itemBg: "from-red-800/25 via-orange-800/20 to-amber-800/15",
                itemHover: "hover:from-red-800/35 hover:via-orange-800/30 hover:to-amber-800/25"
              },
              "蔬果类": {
                bg: "from-green-900/35 via-yellow-900/40 to-orange-900/30",
                border: "border-green-700/30",
                shadow: "shadow-green-500/10",
                hoverShadow: "hover:shadow-green-500/20",
                title: "from-green-400 via-yellow-400 to-orange-400",
                badge: "from-green-500/20 to-yellow-500/25 border-green-500/30",
                badgeText: "text-green-200",
                iconBg: "bg-gradient-to-br from-green-500/25 to-yellow-500/30",
                itemBg: "from-green-800/20 via-yellow-800/25 to-orange-800/15",
                itemHover: "hover:from-green-800/30 hover:via-yellow-800/35 hover:to-orange-800/25"
              },
              "海鲜类": {
                bg: "from-blue-900/35 via-cyan-900/30 to-orange-900/35",
                border: "border-blue-700/40",
                shadow: "shadow-blue-500/10",
                hoverShadow: "hover:shadow-blue-500/20",
                title: "from-blue-400 via-cyan-400 to-orange-400",
                badge: "from-blue-500/25 to-cyan-500/20 border-blue-500/40",
                badgeText: "text-blue-200",
                iconBg: "bg-gradient-to-br from-blue-500/30 to-cyan-500/25",
                itemBg: "from-blue-800/25 via-cyan-800/20 to-orange-800/15",
                itemHover: "hover:from-blue-800/35 hover:via-cyan-800/30 hover:to-orange-800/25"
              },
              "调料类": {
                bg: "from-amber-900/45 via-orange-900/40 to-yellow-900/35",
                border: "border-amber-700/50",
                shadow: "shadow-amber-500/15",
                hoverShadow: "hover:shadow-amber-500/25",
                title: "from-amber-300 via-orange-400 to-yellow-400",
                badge: "from-amber-500/30 to-orange-500/25 border-amber-500/50",
                badgeText: "text-amber-100",
                iconBg: "bg-gradient-to-br from-amber-500/35 to-orange-500/30",
                itemBg: "from-amber-800/30 via-orange-800/25 to-yellow-800/20",
                itemHover: "hover:from-amber-800/40 hover:via-orange-800/35 hover:to-yellow-800/30"
              },
              "日杂类": {
                bg: "from-purple-900/30 via-pink-900/25 to-orange-900/35",
                border: "border-purple-700/35",
                shadow: "shadow-purple-500/10",
                hoverShadow: "hover:shadow-purple-500/20",
                title: "from-purple-400 via-pink-400 to-orange-400",
                badge: "from-purple-500/20 to-pink-500/25 border-purple-500/35",
                badgeText: "text-purple-200",
                iconBg: "bg-gradient-to-br from-purple-500/25 to-pink-500/30",
                itemBg: "from-purple-800/20 via-pink-800/15 to-orange-800/20",
                itemHover: "hover:from-purple-800/30 hover:via-pink-800/25 hover:to-orange-800/30"
              },
              "饮品类": {
                bg: "from-indigo-900/35 via-blue-900/30 to-orange-900/30",
                border: "border-indigo-700/40",
                shadow: "shadow-indigo-500/10",
                hoverShadow: "hover:shadow-indigo-500/20",
                title: "from-indigo-400 via-blue-400 to-orange-400",
                badge: "from-indigo-500/25 to-blue-500/20 border-indigo-500/40",
                badgeText: "text-indigo-200",
                iconBg: "bg-gradient-to-br from-indigo-500/30 to-blue-500/25",
                itemBg: "from-indigo-800/25 via-blue-800/20 to-orange-800/15",
                itemHover: "hover:from-indigo-800/35 hover:via-blue-800/30 hover:to-orange-800/25"
              }
            };
            
            const style = categoryStyles[cat];
            
            return (
              <div key={cat} className={`bg-gradient-to-br ${style.bg} border ${style.border} ${style.shadow} ${style.hoverShadow} shadow-xl transition-all duration-300 rounded-xl p-4 backdrop-blur-sm transform hover:scale-[1.02]`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`font-bold flex items-center gap-2 bg-gradient-to-r ${style.title} bg-clip-text text-transparent text-lg`}>
                    <span className="text-lg">{CATEGORY_EMOJIS[cat]}</span>
                    {cat}
                  </h3>
                  <span className={`text-xs bg-gradient-to-r ${style.badge} ${style.badgeText} px-2.5 py-1 rounded-full font-semibold backdrop-blur-sm`}>
                    {byCat[cat]?.length || 0} 项
                  </span>
                </div>
                <ul className="space-y-1.5 max-h-80 overflow-auto pr-2">
                  {(byCat[cat]||[]).map(it => (
                    <li key={it.id} className={`flex items-center justify-between py-2 px-3 rounded-lg bg-gradient-to-r ${style.itemBg} border border-white/10 ${style.itemHover} transition-all duration-200 backdrop-blur-sm group`}>
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                        <div className="relative">
                          <input 
                            type="checkbox" 
                            checked={!!it.checked} 
                            onChange={() => updateItemStatus(it.id, !it.checked)}
                            className="w-4 h-4 text-orange-500 bg-orange-800/30 border-orange-600/50 rounded focus:ring-orange-500/50 focus:ring-2 transition-all duration-200"
                          />
                          {it.checked && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-green-400 text-xs animate-pulse">✓</span>
                            </div>
                          )}
                        </div>
                        <span className={`${it.checked ? 'line-through text-orange-400/60' : 'text-orange-100 group-hover:text-white'} font-medium transition-colors duration-200 text-sm`}>
                          {it.name}
                        </span>
                      </label>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${it.checked ? 'bg-gradient-to-r from-green-400 to-emerald-500 shadow-green-400/50' : 'bg-gradient-to-r from-orange-400 to-amber-500 shadow-orange-400/50'} shadow-md animate-pulse`}></div>
                        <button 
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-gradient-to-r from-red-500/25 to-pink-500/20 text-red-300 hover:from-red-500/35 hover:to-pink-500/30 hover:text-red-200 rounded-md transition-all duration-200 font-medium border border-red-500/30 backdrop-blur-sm transform hover:scale-105 active:scale-95 shadow-md hover:shadow-red-500/20"
                          onClick={() => removeItem(it.id)}
                          title="删除此项"
                        >
                          <span className="text-sm">🗑️</span>
                          删除
                        </button>
                      </div>
                    </li>
                  ))}
                  {(byCat[cat]||[]).length===0 && (
                    <li className="text-center py-6 text-orange-400/70 italic">
                      <div className={`inline-block p-3 rounded-full ${style.iconBg} backdrop-blur-sm border border-white/10 mb-2`}>
                        <span className="text-3xl">📝</span>
                      </div>
                      <div className="text-xs">暂无物品</div>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}