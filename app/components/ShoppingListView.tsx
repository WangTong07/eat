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
    if (/(油|酱|醋|盐|糖|精|粉|料酒)/.test(name)) return "调料类";
    if (/(猪|牛|羊|鸡(?!蛋)|鸭|鹅|肉|排骨)/.test(name)) return "肉类";
    if (/(虾|蟹|鱼|贝)/.test(name)) return "海鲜类";
    if (/(牛奶|可乐|饮料)/.test(name)) return "饮品类";
    if (/(纸|袋|保鲜|餐巾|洗洁|日杂)/.test(name)) return "日杂类";
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
      
      if (data && data.length > 0) {
        // 将数据库数据转换为应用所需格式
        const items = data.map(item => ({
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
      } else {
        // 如果数据库中没有数据，尝试从本地存储恢复
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem('shopping_list_latest') : null;
        if (raw) {
          const saved = JSON.parse(raw);
          if (Array.isArray(saved) && saved.length > 0) {
            setList(saved);
            
            // 将本地数据同步到数据库
            await saveToDatabase(saved);
            return;
          }
        }
        
        // 如果没有本地数据，根据推荐菜生成初始清单
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
      
      // 只在INSERT事件时重新加载，避免DELETE和UPDATE时的重复加载
      if (payload.eventType === 'INSERT') {
        console.log('[ShoppingListView] 检测到新增食材，重新加载...');
        setTimeout(() => loadShoppingList(), 100); // 延迟一点避免冲突
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
        <div className="ui-card rounded-xl p-4">
          <h3 className="font-bold mb-3 flex items-center gap-2 text-gray-800">
            <span className="text-xl">➕</span>
            快速添加
          </h3>
          <div className="flex gap-3 items-center">
            <input 
              className="border border-gray-300 rounded-lg px-4 py-2 flex-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
              placeholder="🥬 输入食材名称" 
              value={newName} 
              onChange={e=>setNewName(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && addItem()}
            />
            <select className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" value={newCat} onChange={e=>setNewCat(e.target.value as Category | "智能分类")}>
              <option value="智能分类">🤖 智能分类</option>
              {CATEGORY_ORDER.map(c => <option key={c} value={c}>{CATEGORY_EMOJIS[c]} {c}</option>)}
            </select>
            <button 
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" 
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
        
        <div className="ui-card rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2 text-gray-800">
              <span className="text-xl">🍽️</span>
              从推荐菜生成清单
            </h3>
            <button 
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" 
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
          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            {recs.length > 0 ? (
              <div>
                <p className="flex items-center gap-2 mb-2">
                  <span className="text-base">📋</span>
                  <strong>本周推荐菜：</strong>{recs.map(r => r.dish).join('、')}
                </p>
                <p className="flex items-center gap-2 text-gray-500">
                  <span className="text-base">💡</span>
                  点击"重新生成"按钮将根据推荐菜自动添加所需食材
                </p>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-gray-400">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORY_ORDER.map(cat => (
            <div key={cat} className="ui-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold flex items-center gap-2 text-gray-800">
                  <span className="text-xl">{CATEGORY_EMOJIS[cat]}</span>
                  {cat}
                </h3>
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-medium">
                  {byCat[cat]?.length || 0} 项
                </span>
              </div>
              <ul className="space-y-3">
                {(byCat[cat]||[]).map(it => (
                  <li key={it.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input 
                        type="checkbox" 
                        checked={!!it.checked} 
                        onChange={() => updateItemStatus(it.id, !it.checked)}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className={`${it.checked ? 'line-through text-gray-400' : 'text-gray-700'} font-medium`}>
                        {it.name}
                      </span>
                    </label>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${it.checked ? 'bg-green-500' : 'bg-orange-400'}`}></div>
                      <button 
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors duration-200 font-medium"
                        onClick={() => removeItem(it.id)}
                        title="删除此项"
                      >
                        <span className="text-base">🗑️</span>
                        删除
                      </button>
                    </div>
                  </li>
                ))}
                {(byCat[cat]||[]).length===0 && (
                  <li className="text-center py-4 text-gray-400 italic">
                    <span className="text-2xl block mb-1">📝</span>
                    暂无物品
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}