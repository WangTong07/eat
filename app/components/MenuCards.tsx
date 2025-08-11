"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Plan = {
  id: string;
  week_number: number;
  menu_json: Record<string, string[] | string>;
};

const DAY_ORDER = ["周一", "周二", "周三", "周四", "周五"] as const;

export default function MenuCards({ preview = false }: { preview?: boolean }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [recs, setRecs] = useState<Array<{ dish: string; ingredients: string[] }>>([]);
  const [likeStats, setLikeStats] = useState<Record<string, number>>({});
  const [userLikes, setUserLikes] = useState<Record<string, boolean>>({});
  const [likingDish, setLikingDish] = useState<string | null>(null);

  const todayLabel = useMemo(() => {
    const d = new Date();
    const idx = (d.getDay() + 6) % 7; // 1=>0 ... 5=>4
    return DAY_ORDER[Math.min(idx, 4)];
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("weekly_plans")
        .select("id, week_number, menu_json")
        .order("generated_at", { ascending: false })
        .limit(1);
      if (!error) setPlan(data?.[0] ?? null);
      try {
        const r = await fetch('/api/recommendations');
        const j = await r.json();
        const recommendations = j.items || [];
        setRecs(recommendations);
        
        // 获取点赞统计
        const likesRes = await fetch('/api/dish-likes');
        const likesData = await likesRes.json();
        setLikeStats(likesData.stats || {});
        
        // 获取用户点赞状态
        if (recommendations.length > 0) {
          const dishNames = recommendations.map((rec: any) => rec.dish);
          const userLikesRes = await fetch('/api/dish-likes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dish_names: dishNames })
          });
          const userLikesData = await userLikesRes.json();
          setUserLikes(userLikesData.userLikes || {});
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  // 实时订阅点赞变化
  useEffect(() => {
    const supabase = getSupabaseClient();
    const subscription = supabase
      .channel('dish_likes_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'dish_likes' },
        async () => {
          // 重新获取点赞统计
          try {
            const likesRes = await fetch('/api/dish-likes');
            const likesData = await likesRes.json();
            setLikeStats(likesData.stats || {});
          } catch {}
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 处理点赞/取消点赞
  const handleLike = async (dishName: string) => {
    if (likingDish) return; // 防止重复点击
    
    setLikingDish(dishName);
    const isLiked = userLikes[dishName];
    const action = isLiked ? 'unlike' : 'like';
    
    try {
      const response = await fetch('/api/dish-likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_name: dishName, action })
      });
      
      if (response.ok) {
        // 乐观更新UI
        setUserLikes(prev => ({ ...prev, [dishName]: !isLiked }));
        setLikeStats(prev => ({
          ...prev,
          [dishName]: Math.max(0, (prev[dishName] || 0) + (isLiked ? -1 : 1))
        }));
      }
    } catch (error) {
      console.error('点赞操作失败:', error);
    } finally {
      setLikingDish(null);
    }
  };


  const menu = plan?.menu_json ?? {};
  const daysToRender = preview ? previewOrder(todayLabel) : DAY_ORDER;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">本周推荐菜</h3>
        {preview && (
          <Link href="/menu" className="text-sm text-emerald-600 hover:underline">
            查看全部
          </Link>
        )}
      </div>
      {loading && <div className="text-sm text-neutral-500">加载中...</div>}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recs.map((r, i) => (
            <div key={`${r.dish}-${i}`} className={`ui-card rounded-xl p-5 card-hover animate-slide-up relative`} style={{ animationDelay: `${0.1 * (i + 1)}s` }}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-heading">{r.dish}</h3>
                <span className="badge badge-primary">推荐</span>
              </div>
              <div className="text-sm text-muted mb-2">所需食材</div>
              <ul className="grid grid-cols-2 gap-1 text-sm mb-4">
                {r.ingredients.map((ing, idx) => (
                  <li key={idx} className="flex items-center"><i className="fa fa-check text-primary mr-2" />{ing}</li>
                ))}
              </ul>
              
              {/* 点赞功能 */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <button
                  onClick={() => handleLike(r.dish)}
                  disabled={likingDish === r.dish}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-all duration-200 ${
                    userLikes[r.dish] 
                      ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  } ${likingDish === r.dish ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className={`text-lg ${userLikes[r.dish] ? '👍' : '👍'}`} 
                        style={{ filter: userLikes[r.dish] ? 'none' : 'grayscale(100%)' }}>
                    👍
                  </span>
                  <span className="font-medium">
                    {likeStats[r.dish] || 0}
                  </span>
                </button>
              </div>
            </div>
          ))}
          {recs.length === 0 && (
            <div className="text-sm text-muted">暂无推荐菜，请在“偏好提交”页添加想吃的菜</div>
          )}
        </div>
      )}
    </section>
  );
}

function toArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v as string[];
  if (typeof v === "string") return [v];
  return [];
}

function previewOrder(today: string) {
  const idx = DAY_ORDER.indexOf(today as any);
  const a = DAY_ORDER[(idx + 0) % DAY_ORDER.length];
  const b = DAY_ORDER[(idx + 1) % DAY_ORDER.length];
  const c = DAY_ORDER[(idx + 2) % DAY_ORDER.length];
  return [a, b, c];
}


