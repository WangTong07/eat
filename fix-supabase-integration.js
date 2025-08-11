// 这个脚本将恢复 ShoppingListView.tsx 文件，使其使用 Supabase 实时同步功能
import fs from 'fs';

try {
  // 读取 ShoppingListView.tsx 文件
  const filePath = 'app/components/ShoppingListView.tsx';
  
  // 创建新的文件内容
  const newContent = `"use client";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useRealtimeSubscription } from "@/lib/useRealtimeSubscription";

type Rec = { dish: string; ingredients: string[] };
type Item = { id: string; name: string; category: Category; qty?: string; checked?: boolean };
type Category = "肉类" | "蔬果类" | "海鲜类" | "调料类" | "日杂类" | "饮品类";

const CATEGORY_ORDER: Category[] = ["肉类", "蔬果类", "海鲜类", "调料类", "日杂类", "饮品类"];

export default function ShoppingListView() {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [list, setList] = useState<Item[]>([]);
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState<Category>("蔬果类");
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

  // 分类函数
  const classify = (name: string): Category => {
    // 肉类
    if (/(猪|牛|羊|鸡(?!蛋)|鸭|鹅|肉|排骨|里脊|五花|腊肉|培根)/.test(name)) return "肉类";
    // 海鲜类
    if (/(虾|蟹|鱼|贝|海参|鱿|蛤|鲍|蛎|龙虾|扇贝)/.test(name)) return "海鲜类";
    // 蔬菜/豆制品等（先于调料判断，避免"油麦菜"被油命中）
    if (/(菜|葱|姜|蒜|椒|瓜|豆腐|豆皮|豆芽|土豆|马铃薯|藕|金针菇|香菇|蘑菇|菌|茄子|番茄|西红柿|青菜|油麦菜|娃娃菜|生菜|菠菜|西兰花|花菜|空心菜|豆角|四季豆|芹菜|黄瓜|冬瓜|南瓜|苦瓜|海带|木耳|莴笋|莴苣|莲藕|韭菜|蒜薹|香菜)/.test(name))
      return "蔬果类";
    // 调料类（只匹配具体词，避免"油麦菜"的"油"被误判）
    if (/(食用油|花生油|调和油|菜籽油|生抽|老抽|耗油|蚝油|鸡精|味精|白糖|冰糖|食盐|白醋|陈醋|料酒|胡椒|花椒|孜然|八角|桂皮|香叶|豆瓣|豆瓣酱|辣椒粉|辣椒面|淀粉)/.test(name))
      return "调料类";
    // 饮品类
    if (/(牛奶|豆奶|酸奶|可乐|雪碧|汽水|苏打水|矿泉水|纯净水|果汁|橙汁|苹果汁|椰汁|椰汁|椰奶|茶饮|奶茶|咖啡|啤酒|葡萄酒|黄酒|清酒|饮料|运动饮料)/.test(name))
      return "饮品类";
    // 日杂
    if (/(纸|袋|保鲜|餐巾|洗洁|日杂|一次性|牙膏|纸巾)/.test(name)) return "日杂类";
    return "蔬果类";
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
    const base = {};
    recs.forEach(r => {
      r.ingredients.forEach(n => {
        const key = n.trim();
        if (!key) return;
        if (!base[key]) base[key] = { id: \`\${Date.now()}-\${key}\`, name: key, category: classify(key) };
      });
    });
    const arr = Object.values(base);
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
  }, [recs]);

  // 添加实时订阅
  useRealtimeSubscription({
    table: 'shopping_list',
    onChange: () => {
      console.log('[ShoppingListView] 检测到购物清单变更，重新加载...');
      loadShoppingList();
    }
  });

  const byCat = useMemo(()=>{
    const map = { "肉类":[], "蔬果类":[], "海鲜类":[], "调料类":[], "日杂类":[], "饮品类":[] };
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
    
    // 创建新物品
    const item = { 
      id: \`\${Date.now()}-\${Math.random().toString(36).substring(2, 9)}\`, 
      name: newName.trim(), 
      category: newCat,
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
  const removeItem = async (id) => {
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
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      <div className="ui-card rounded-xl p-4">
        <h3 className="font-bold mb-2">快速添加</h3>
        <div className="flex gap-2 items-center">
          <input 
            className="border rounded px-3 py-2" 
            placeholder="食材名称" 
            value={newName} 
            onChange={e=>setNewName(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && addItem()}
          />
          <select className="border rounded px-3 py-2" value={newCat} onChange={e=>setNewCat(e.target.value as Category)}>
            {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button 
            className="badge badge-primary" 
            onClick={addItem}
            disabled={isLoading || !newName.trim()}
          >
            {isLoading ? '添加中...' : '添加'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-4">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {CATEGORY_ORDER.map(cat => (
            <div key={cat} className="ui-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold">{cat}</h3>
                <span className="text-sm text-muted">{byCat[cat]?.length || 0} 项</span>
              </div>
              <ul className="space-y-2">
                {(byCat[cat]||[]).map(it => (
                  <li key={it.id} className="flex items-center justify-between">
                    <label className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={!!it.checked} 
                        onChange={() => updateItemStatus(it.id, !it.checked)}
                      />
                      <span className={it.checked? 'line-through text-neutral-400':''}>{it.name}</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className={\`w-3 h-3 rounded-full \${it.checked ? 'bg-green-500' : 'bg-red-500'}\`}></div>
                      <button 
                        className="btn-link" 
                        onClick={() => removeItem(it.id)}
                      >
                        删除
                      </button>
                    </div>
                  </li>
                ))}
                {(byCat[cat]||[]).length===0 && <li className="text-sm text-muted">暂无</li>}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}`;

  // 写入修改后的文件
  fs.writeFileSync(filePath, newContent);
  
  console.log('成功修改 ShoppingListView.tsx 文件，现在它将使用 Supabase 实时同步功能');
} catch (error) {
  console.error('修改文件时出错:', error);
}