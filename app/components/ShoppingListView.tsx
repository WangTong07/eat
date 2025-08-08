"use client";
import { useEffect, useMemo, useState } from "react";

type Rec = { dish: string; ingredients: string[] };
type Item = { id: string; name: string; category: Category; qty?: string; checked?: boolean };
type Category = "肉类" | "菜类" | "海鲜类" | "调料类" | "日杂类" | "饮品类";

const CATEGORY_ORDER: Category[] = ["肉类", "菜类", "海鲜类", "调料类", "日杂类", "饮品类"];

export default function ShoppingListView() {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [list, setList] = useState<Item[]>([]);
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState<Category>("菜类");

  useEffect(()=>{
    (async()=>{
      try{
        const r = await fetch('/api/recommendations');
        const j = await r.json();
        setRecs(j.items || []);
      }catch{}
    })();
  },[]);

  useEffect(()=>{
    // 先尝试恢复本地已保存的清单
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('shopping_list_latest') : null;
      if (raw) {
        const saved: Item[] = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length > 0) {
          setList(saved);
          return; // 有保存的就直接用
        }
      }
    } catch {}

    // 根据推荐菜生成初始清单（简单归类）
    const classify = (name: string): Category => {
      // 肉类
      if (/(猪|牛|羊|鸡(?!蛋)|鸭|鹅|肉|排骨|里脊|五花|腊肉|培根)/.test(name)) return "肉类";
      // 海鲜类
      if (/(虾|蟹|鱼|贝|海参|鱿|蛤|鲍|蛎|龙虾|扇贝)/.test(name)) return "海鲜类";
      // 蔬菜/豆制品等（先于调料判断，避免“油麦菜”被油命中）
      if (/(菜|葱|姜|蒜|椒|瓜|豆腐|豆皮|豆芽|土豆|马铃薯|藕|金针菇|香菇|蘑菇|菌|茄子|番茄|西红柿|青菜|油麦菜|娃娃菜|生菜|菠菜|西兰花|花菜|空心菜|豆角|四季豆|芹菜|黄瓜|冬瓜|南瓜|苦瓜|海带|木耳|莴笋|莴苣|莲藕|韭菜|蒜薹|香菜)/.test(name))
        return "菜类";
      // 调料类（只匹配具体词，避免“油麦菜”的“油”被误判）
      if (/(食用油|花生油|调和油|菜籽油|生抽|老抽|耗油|蚝油|鸡精|味精|白糖|冰糖|食盐|白醋|陈醋|料酒|胡椒|花椒|孜然|八角|桂皮|香叶|豆瓣|豆瓣酱|辣椒粉|辣椒面|淀粉)/.test(name))
        return "调料类";
      // 饮品类
      if (/(牛奶|豆奶|酸奶|可乐|雪碧|汽水|苏打水|矿泉水|纯净水|果汁|橙汁|苹果汁|椰汁|椰汁|椰奶|茶饮|奶茶|咖啡|啤酒|葡萄酒|黄酒|清酒|饮料|运动饮料)/.test(name))
        return "饮品类";
      // 日杂
      if (/(纸|袋|保鲜|餐巾|洗洁|日杂|一次性|牙膏|纸巾)/.test(name)) return "日杂类";
      return "菜类";
    };
    const base: Record<string, Item> = {};
    recs.forEach(r=>{
      r.ingredients.forEach(n=>{
        const key = n.trim();
        if (!key) return;
        if (!base[key]) base[key] = { id: key, name: key, category: classify(key) };
      });
    });
    const arr = Object.values(base);
    setList(arr);
  },[recs]);

  // 保存到本地，保证切换页面后不丢
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('shopping_list_latest', JSON.stringify(list));
      }
    } catch {}
  }, [list]);

  const byCat = useMemo(()=>{
    const map: Record<Category, Item[]> = { "肉类":[], "菜类":[], "海鲜类":[], "调料类":[], "日杂类":[], "饮品类":[] };
    list.forEach(i=> map[i.category].push(i));
    return map;
  },[list]);

  const addItem = () => {
    if (!newName.trim()) return;
    const item: Item = { id: `${Date.now()}`, name: newName.trim(), category: newCat };
    setList(prev => [...prev, item]);
    setNewName("");
  };

  return (
    <section className="space-y-6">
      <div className="ui-card rounded-xl p-4">
        <h3 className="font-bold mb-2">快速添加</h3>
        <div className="flex gap-2 items-center">
          <input className="border rounded px-3 py-2" placeholder="食材名称" value={newName} onChange={e=>setNewName(e.target.value)} />
          <select className="border rounded px-3 py-2" value={newCat} onChange={e=>setNewCat(e.target.value as Category)}>
            {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="badge badge-primary" onClick={addItem}>添加</button>
        </div>
      </div>

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
                    <input type="checkbox" checked={!!it.checked} onChange={()=> setList(prev => prev.map(p=> p.id===it.id? {...p, checked: !p.checked }: p))} />
                    <span className={it.checked? 'line-through text-neutral-400':''}>{it.name}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input className="border rounded px-2 py-1 w-24 text-sm" placeholder="数量" value={it.qty || ''} onChange={e=> setList(prev => prev.map(p=> p.id===it.id? {...p, qty:e.target.value}: p))} />
                    <button className="btn-link" onClick={()=> setList(prev => prev.filter(p=> p.id!==it.id))}>删除</button>
                  </div>
                </li>
              ))}
              {(byCat[cat]||[]).length===0 && <li className="text-sm text-muted">暂无</li>}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}


