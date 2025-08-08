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

function guessIngredients(dish: string): string[] {
  const items: string[] = [];
  const add = (arr: string[]) => arr.forEach((i) => items.includes(i) ? null : items.push(i));
  const d = dish || "";
  // 只保留主要食材，不列出盐/酱油/醋等基础调味
  if (/(红烧肉|东坡肉)/.test(d)) add(["五花肉", "葱", "姜", "蒜"]);
  else if (/排骨/.test(d)) add(["排骨", "葱", "姜", "蒜"]);
  else if (/鸡翅/.test(d)) add(["鸡翅", "葱", "姜", "蒜"]);
  else if (/宫保鸡丁/.test(d)) add(["鸡胸肉", "花生米", "干辣椒", "花椒", "葱", "姜", "蒜"]);
  else if (/鱼香肉丝/.test(d)) add(["猪里脊", "木耳", "笋", "葱", "姜", "蒜"]);
  else if (/鱼香茄子|红烧茄子|茄子/.test(d)) add(["茄子", "葱", "姜", "蒜"]);
  else if (/麻婆豆腐/.test(d)) add(["豆腐", "牛/猪肉末", "豆瓣酱", "花椒"]);
  else if (/豆腐/.test(d)) add(["豆腐", "葱", "姜", "蒜"]);
  else if (/西红柿|番茄/.test(d) && /鸡蛋/.test(d)) add(["西红柿", "鸡蛋", "葱"]);
  else if (/西红柿|番茄/.test(d)) add(["西红柿", "葱"]);
  else if (/西兰花/.test(d)) add(["西兰花", "蒜"]);
  else if (/空心菜|青菜|油麦/.test(d)) add(["青菜/空心菜", "蒜"]);
  else if (/火锅|涮锅/.test(d)) add(["牛/羊肉卷", "午餐肉", "虾滑/鱼丸", "蟹棒", "金针菇", "香菇", "娃娃菜", "油麦菜", "土豆片", "藕片", "海带结", "豆皮", "冻豆腐", "宽粉", "火锅底料", "火锅蘸料"]);
  else if (/鸡/.test(d) && !/鸡蛋/.test(d)) add(["鸡肉", "葱", "姜", "蒜"]);
  else if (/牛肉/.test(d)) add(["牛肉", "葱", "姜", "蒜"]);
  else if (/猪肉/.test(d)) add(["猪肉", "葱", "姜", "蒜"]);
  else add([d]);
  return items;
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
    for (const w of data || []) {
      const dish = normalizeDish(w.content || "");
      if (!dish || seen.has(dish)) continue;
      seen.add(dish);
      recs.push({ dish, ingredients: guessIngredients(dish), wish_id: w.id, created_at: w.created_at });
      if (recs.length >= 9) break;
    }

    return NextResponse.json({ items: recs });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}


