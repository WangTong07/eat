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
    <section className="space-y-6">

      {loading && (
        <div className="text-sm text-gray-400 flex items-center gap-2 bg-gray-800/60 backdrop-blur-sm rounded-lg p-4 border border-gray-700/30">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          加载中...
        </div>
      )}

      {!loading && (
        <div className="h-80 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pr-2">
            {recs.map((r, i) => {
            // 智能背景图片匹配系统 - 全面优化版本，确保所有菜品都有合适背景图
            const getSmartBackgroundImage = (dishName: string, ingredients: string[]) => {
              // 水果类图片库 - 专门为西瓜等水果准备
              const fruitImages = [
                'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&h=300&fit=crop&crop=center', // 西瓜切片
                'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400&h=300&fit=crop&crop=center', // 新鲜水果
                'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400&h=300&fit=crop&crop=center', // 水果拼盘
                'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&h=300&fit=crop&crop=center', // 夏季水果
                'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?w=400&h=300&fit=crop&crop=center', // 切好的水果
              ];

              // 面食类图片库 - 专门为饺子、面条等面食准备
              const noodleImages = [
                'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=300&fit=crop&crop=center', // 饺子
                'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=400&h=300&fit=crop&crop=center', // 中式面食
                'https://images.unsplash.com/photo-1555126634-323283e090fa?w=400&h=300&fit=crop&crop=center', // 面条
                'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=400&h=300&fit=crop&crop=center', // 意面
                'https://images.unsplash.com/photo-1551892374-ecf8754cf8b0?w=400&h=300&fit=crop&crop=center', // 面食料理
              ];

              // 豆制品图片库 - 更新为更稳定的链接
              const tofuImages = [
                'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=300&fit=crop&crop=center', // 豆腐料理
                'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop&crop=center', // 中式菜品
                'https://images.unsplash.com/photo-1559847844-d721426d6edc?w=400&h=300&fit=crop&crop=center', // 亚洲料理
                'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=300&fit=crop&crop=center', // 美食拼盘
                'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop&crop=center', // 综合菜品
              ];

              // 肉类菜品图片库
              const meatImages = [
                'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&h=300&fit=crop&crop=center', // 牛肉料理
                'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=300&fit=crop&crop=center', // 鸡肉料理
                'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop&crop=center', // 中式肉菜
                'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop&crop=center', // 烤肉
                'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop&crop=center', // 综合肉菜
                'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop&crop=center', // 精美肉菜
              ];

              // 蔬菜类图片库
              const vegetableImages = [
                'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&h=300&fit=crop&crop=center', // 绿叶蔬菜
                'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop&crop=center', // 沙拉蔬菜
                'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=300&fit=crop&crop=center', // 青菜
                'https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?w=400&h=300&fit=crop&crop=center', // 蔬菜拼盘
                'https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=400&h=300&fit=crop&crop=center', // 炒青菜
              ];

              // 汤品类图片库
              const soupImages = [
                'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop&crop=center', // 汤品
                'https://images.unsplash.com/photo-1547592180-85f173990554?w=400&h=300&fit=crop&crop=center', // 热汤
                'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=400&h=300&fit=crop&crop=center', // 蔬菜汤
                'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop&crop=center', // 中式汤
              ];

              // 蛋类图片库
              const eggImages = [
                'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=400&h=300&fit=crop&crop=center', // 炒蛋
                'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&h=300&fit=crop&crop=center', // 蛋料理
                'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=400&h=300&fit=crop&crop=center', // 蛋菜
              ];

              // 海鲜类图片库
              const seafoodImages = [
                'https://images.unsplash.com/photo-1559847844-5315695dadae?w=400&h=300&fit=crop&crop=center', // 海鲜料理
                'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=400&h=300&fit=crop&crop=center', // 鱼类
                'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=400&h=300&fit=crop&crop=center', // 虾类
                'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop&crop=center', // 海鲜拼盘
              ];

              // 通用美食图片库 - 最稳定的备用图片
              const generalFoodImages = [
                'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop&crop=center', // 综合菜品
                'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop&crop=center', // 精美菜品
                'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=300&fit=crop&crop=center', // 美食拼盘
                'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop&crop=center', // 中式菜品
                'https://images.unsplash.com/photo-1559847844-d721426d6edc?w=400&h=300&fit=crop&crop=center', // 亚洲料理
                'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop&crop=center', // 烤肉
                'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=300&fit=crop&crop=center', // 料理
                'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=400&h=300&fit=crop&crop=center', // 意面料理
              ];

              // 强化哈希函数，确保稳定分配
              const stableHash = (str: string) => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                  const char = str.charCodeAt(i);
                  hash = ((hash << 5) - hash) + char;
                  hash = hash & hash;
                }
                return Math.abs(hash);
              };

              // 智能匹配逻辑 - 全面优化，确保所有菜品都能正确匹配
              const dishLower = dishName.toLowerCase();
              const ingredientsStr = ingredients.join('').toLowerCase();
              const fullText = dishLower + ingredientsStr;

              // 调试日志 - 帮助诊断匹配问题
              console.log(`[图片匹配] 菜品: ${dishName}, 食材: ${ingredients.join(', ')}, 全文: ${fullText}`);

              // 水果类优先匹配（解决西瓜问题）
              if (dishLower.includes('西瓜') || dishLower.includes('苹果') || dishLower.includes('香蕉') || 
                  dishLower.includes('橙子') || dishLower.includes('葡萄') || dishLower.includes('梨') ||
                  dishLower.includes('桃') || dishLower.includes('草莓') || dishLower.includes('猕猴桃') ||
                  fullText.includes('水果') || ingredients.some(ing => 
                    ['西瓜', '苹果', '香蕉', '橙子', '葡萄', '梨', '桃', '草莓', '猕猴桃'].includes(ing)
                  )) {
                const index = stableHash(dishName) % fruitImages.length;
                console.log(`[图片匹配] ${dishName} -> 水果类图片 ${index}`);
                return fruitImages[index];
              }

              // 面食类匹配（饺子等）
              if (fullText.includes('饺子') || fullText.includes('包子') || fullText.includes('馄饨') || 
                  fullText.includes('面条') || fullText.includes('拉面') || fullText.includes('面粉') ||
                  dishLower.includes('饺') || dishLower.includes('面') || dishLower.includes('粉')) {
                const index = stableHash(dishName) % noodleImages.length;
                console.log(`[图片匹配] ${dishName} -> 面食类图片 ${index}`);
                return noodleImages[index];
              }

              // 豆制品匹配（麻婆豆腐等）
              if (dishLower.includes('豆腐') || dishLower.includes('麻婆') || dishLower.includes('豆干') || 
                  dishLower.includes('豆皮') || fullText.includes('豆腐') || fullText.includes('豆干') || 
                  fullText.includes('豆皮') || fullText.includes('嫩豆腐') || ingredients.some(ing => 
                    ['豆腐', '嫩豆腐', '豆干', '豆皮', '豆'].includes(ing)
                  )) {
                const index = stableHash(dishName) % tofuImages.length;
                console.log(`[图片匹配] ${dishName} -> 豆制品图片 ${index}`);
                return tofuImages[index];
              }

              // 海鲜类匹配
              if (fullText.includes('虾') || fullText.includes('蟹') || fullText.includes('鱼') || 
                  fullText.includes('贝') || fullText.includes('海鲜') || dishLower.includes('虾') ||
                  dishLower.includes('鱼') || dishLower.includes('蟹')) {
                const index = stableHash(dishName) % seafoodImages.length;
                console.log(`[图片匹配] ${dishName} -> 海鲜类图片 ${index}`);
                return seafoodImages[index];
              }

              // 肉类菜品
              if (fullText.includes('排骨') || fullText.includes('红烧') || fullText.includes('牛肉') || 
                  fullText.includes('猪肉') || fullText.includes('鸡肉') || fullText.includes('羊肉') ||
                  fullText.includes('肉末') || fullText.includes('肉丝') || dishLower.includes('肉') ||
                  fullText.includes('鸡翅') || fullText.includes('鸭') || dishLower.includes('鸡') ||
                  fullText.includes('牛肉末') || fullText.includes('鸡腿') || ingredients.some(ing => 
                    ['鸡腿', '鸡翅', '牛肉', '猪肉', '羊肉', '牛肉末', '肉'].includes(ing)
                  )) {
                const index = stableHash(dishName) % meatImages.length;
                console.log(`[图片匹配] ${dishName} -> 肉类图片 ${index}`);
                return meatImages[index];
              }

              // 蛋类菜品
              if (fullText.includes('鸡蛋') || fullText.includes('蛋') || fullText.includes('炒蛋') ||
                  dishLower.includes('蛋') || ingredients.some(ing => ['鸡蛋', '蛋'].includes(ing))) {
                const index = stableHash(dishName) % eggImages.length;
                console.log(`[图片匹配] ${dishName} -> 蛋类图片 ${index}`);
                return eggImages[index];
              }

              // 汤品类
              if (fullText.includes('汤') || fullText.includes('羹') || fullText.includes('煲') ||
                  dishLower.includes('汤') || dishLower.includes('羹')) {
                const index = stableHash(dishName) % soupImages.length;
                console.log(`[图片匹配] ${dishName} -> 汤品类图片 ${index}`);
                return soupImages[index];
              }

              // 蔬菜类
              if (fullText.includes('青菜') || fullText.includes('白菜') || fullText.includes('菠菜') ||
                  fullText.includes('蔬菜') || fullText.includes('菜心') || dishLower.includes('菜') ||
                  ingredients.some(ing => ['青菜', '白菜', '菠菜', '蔬菜', '菜心'].includes(ing))) {
                const index = stableHash(dishName) % vegetableImages.length;
                console.log(`[图片匹配] ${dishName} -> 蔬菜类图片 ${index}`);
                return vegetableImages[index];
              }

              // 兜底机制：使用通用美食图片
              const index = stableHash(dishName) % generalFoodImages.length;
              console.log(`[图片匹配] ${dishName} -> 通用美食图片 ${index} (兜底)`);
              return generalFoodImages[index];
            };

            const backgroundImage = getSmartBackgroundImage(r.dish, r.ingredients);
            
            // 调试日志 - 开发环境下输出匹配信息
            if (process.env.NODE_ENV === 'development') {
              console.log(`菜品: ${r.dish}, 匹配到背景图: ${backgroundImage}`);
            }
            
            // 兜底机制：确保背景图片存在
            const finalBackgroundImage = backgroundImage || 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop&crop=center';
            
            return (
              <div 
                key={`${r.dish}-${i}`} 
                className="relative border border-teal-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl overflow-hidden animate-slide-up group" 
                style={{ 
                  animationDelay: `${0.1 * (i + 1)}s`,
                  backgroundImage: `url(${finalBackgroundImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  height: '180px'
                }}
              >
                {/* 渐变遮罩层 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20 group-hover:from-black/90 group-hover:via-black/50 group-hover:to-black/30 transition-all duration-300"></div>
                
                {/* 内容区域 */}
                <div className="relative z-10 p-3 h-full flex flex-col">
                  {/* 菜品标题区域 */}
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center">
                      <h3 className="font-bold text-white text-base drop-shadow-lg">{r.dish}</h3>
                    </div>
                    <span className="bg-emerald-500/80 backdrop-blur-sm text-white border border-emerald-400/50 px-1.5 py-0.5 rounded-full text-xs font-semibold shadow-lg">推荐</span>
                  </div>

                  {/* 食材列表区域 - 隐藏滚动条 */}
                  <div className="flex-1 mb-2 min-h-0">
                    <div className="text-xs text-emerald-300 mb-1.5 font-medium flex items-center gap-1 drop-shadow-md">
                      <span>🥬</span>
                      所需食材
                    </div>
                    <div 
                      className="h-16 overflow-y-auto" 
                      style={{ 
                        scrollbarWidth: 'none', 
                        msOverflowStyle: 'none'
                      }}
                    >
                      <style jsx>{`
                        div::-webkit-scrollbar {
                          display: none;
                        }
                      `}</style>
                      <ul className="grid grid-cols-2 gap-1 text-xs">
                        {r.ingredients.map((ing, idx) => (
                          <li key={idx} className="flex items-center gap-1 text-white bg-black/30 backdrop-blur-sm rounded-sm px-1.5 py-1 border border-white/20 shadow-sm">
                            <span className="text-emerald-400 text-xs">✓</span>
                            <span className="drop-shadow-sm text-xs">{ing}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  {/* 点赞功能 - 移除蓝色背景 */}
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => handleLike(r.dish)}
                      disabled={likingDish === r.dish}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all duration-200 backdrop-blur-sm border ${
                        userLikes[r.dish] 
                          ? 'text-white border-white/40 hover:border-white/60' 
                          : 'text-gray-300 border-white/20 hover:border-white/40 hover:text-white'
                      } ${likingDish === r.dish ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span className={`text-sm transition-all duration-200 ${userLikes[r.dish] ? 'scale-110' : ''}`} 
                            style={{ filter: userLikes[r.dish] ? 'none' : 'grayscale(100%)' }}>
                        👍
                      </span>
                      <span className="font-semibold drop-shadow-sm">
                        {likeStats[r.dish] || 0}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 空状态 - 深色主题设计 */}
          {recs.length === 0 && (
            <div className="col-span-full bg-gradient-to-br from-gray-900/30 to-slate-900/30 border border-gray-700/30 shadow-lg rounded-xl p-12 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-500 to-slate-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <span className="text-white text-4xl">🍽️</span>
              </div>
              <div className="text-xl font-bold text-gray-300 mb-3">暂无推荐菜</div>
              <div className="text-gray-400 mb-4">请在"偏好提交"页添加想吃的菜</div>
              <Link 
                href="/preferences" 
                className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium px-6 py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
              >
                <span>📝</span>
                去提交偏好
              </Link>
            </div>
            )}
          </div>
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


