"use client";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

// 智能美食图片匹配系统 - 与首页菜品推荐保持一致
const getSmartFoodImage = (dishName: string) => {
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

  // 豆制品图片库
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

  // 调试日志 - 帮助诊断匹配问题
  console.log(`[心愿池图片匹配] 菜品: ${dishName}, 小写: ${dishLower}`);

  // 水果类优先匹配（解决西瓜问题）
  if (dishLower.includes('西瓜') || dishLower.includes('苹果') || dishLower.includes('香蕉') || 
      dishLower.includes('橙子') || dishLower.includes('葡萄') || dishLower.includes('梨') ||
      dishLower.includes('桃') || dishLower.includes('草莓') || dishLower.includes('猕猴桃') ||
      dishLower.includes('水果')) {
    const index = stableHash(dishName) % fruitImages.length;
    console.log(`[心愿池图片匹配] ${dishName} -> 水果类图片 ${index}`);
    return fruitImages[index];
  }

  // 面食类匹配（饺子等）
  if (dishLower.includes('饺子') || dishLower.includes('包子') || dishLower.includes('馄饨') || 
      dishLower.includes('面条') || dishLower.includes('拉面') || dishLower.includes('面粉') ||
      dishLower.includes('饺') || dishLower.includes('面') || dishLower.includes('粉')) {
    const index = stableHash(dishName) % noodleImages.length;
    console.log(`[心愿池图片匹配] ${dishName} -> 面食类图片 ${index}`);
    return noodleImages[index];
  }

  // 豆制品匹配（麻婆豆腐等）
  if (dishLower.includes('豆腐') || dishLower.includes('麻婆') || dishLower.includes('豆干') || 
      dishLower.includes('豆皮') || dishLower.includes('嫩豆腐') || dishLower.includes('豆')) {
    const index = stableHash(dishName) % tofuImages.length;
    console.log(`[心愿池图片匹配] ${dishName} -> 豆制品图片 ${index}`);
    return tofuImages[index];
  }

  // 海鲜类匹配
  if (dishLower.includes('虾') || dishLower.includes('蟹') || dishLower.includes('鱼') || 
      dishLower.includes('贝') || dishLower.includes('海鲜')) {
    const index = stableHash(dishName) % seafoodImages.length;
    console.log(`[心愿池图片匹配] ${dishName} -> 海鲜类图片 ${index}`);
    return seafoodImages[index];
  }

  // 肉类菜品
  if (dishLower.includes('排骨') || dishLower.includes('红烧') || dishLower.includes('牛肉') || 
      dishLower.includes('猪肉') || dishLower.includes('鸡肉') || dishLower.includes('羊肉') ||
      dishLower.includes('肉末') || dishLower.includes('肉丝') || dishLower.includes('肉') ||
      dishLower.includes('鸡翅') || dishLower.includes('鸭') || dishLower.includes('鸡') ||
      dishLower.includes('牛肉末') || dishLower.includes('鸡腿')) {
    const index = stableHash(dishName) % meatImages.length;
    console.log(`[心愿池图片匹配] ${dishName} -> 肉类图片 ${index}`);
    return meatImages[index];
  }

  // 蛋类菜品（番茄炒蛋等）
  if (dishLower.includes('鸡蛋') || dishLower.includes('蛋') || dishLower.includes('炒蛋') ||
      dishLower.includes('番茄炒蛋')) {
    const index = stableHash(dishName) % eggImages.length;
    console.log(`[心愿池图片匹配] ${dishName} -> 蛋类图片 ${index}`);
    return eggImages[index];
  }

  // 汤品类
  if (dishLower.includes('汤') || dishLower.includes('羹') || dishLower.includes('煲')) {
    const index = stableHash(dishName) % soupImages.length;
    console.log(`[心愿池图片匹配] ${dishName} -> 汤品类图片 ${index}`);
    return soupImages[index];
  }

  // 蔬菜类
  if (dishLower.includes('青菜') || dishLower.includes('白菜') || dishLower.includes('菠菜') ||
      dishLower.includes('蔬菜') || dishLower.includes('菜心') || dishLower.includes('菜')) {
    const index = stableHash(dishName) % vegetableImages.length;
    console.log(`[心愿池图片匹配] ${dishName} -> 蔬菜类图片 ${index}`);
    return vegetableImages[index];
  }

  // 兜底机制：使用通用美食图片
  const index = stableHash(dishName) % generalFoodImages.length;
  console.log(`[心愿池图片匹配] ${dishName} -> 通用美食图片 ${index} (兜底)`);
  return generalFoodImages[index];
};

export default function WishForm() {
  const [userName, setUserName] = useState("");
  const [requestType, setRequestType] = useState<"想吃的菜" | "忌口">("想吃的菜");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pool, setPool] = useState<Array<{id:string; user_name:string; request_type:string; content:string; status:string; created_at?:string}>>([]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!userName || !content) {
      setMessage("请填写姓名与内容");
      return;
    }
    setLoading(true);
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("menu_wishes").insert({
      user_name: userName,
      request_type: requestType,
      content,
      status: "待处理",
    });
    if (error) setMessage(`提交失败：${error.message}`);
    else {
      setMessage("提交成功，已加入心愿池");
      setContent("");
      // refresh list
      const { data } = await supabase
        .from('menu_wishes')
        .select('id, user_name, request_type, content, status, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      setPool(data || []);
    }
    setLoading(false);
  };

  useEffect(()=>{
    const load = async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('menu_wishes')
        .select('id, user_name, request_type, content, status, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      setPool(data || []);
    };
    load();
  }, []);

  return (
    <section className="w-full">
      {/* 表单卡片 */}
      <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-700/30 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-xl p-6 mb-8 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white text-lg">📝</span>
          </div>
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              菜单心愿表单
            </h2>
            <p className="text-green-400/70 text-sm font-medium">告诉我们你的美食偏好</p>
          </div>
        </div>
        
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-1">
            <label className="block text-green-300 text-sm font-medium mb-2">👤 姓名</label>
            <input
              className="w-full bg-gray-800/50 border border-green-700/30 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-400 focus:border-green-500/50 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all duration-200"
              placeholder="请输入姓名"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
          </div>
          
          <div className="sm:col-span-1">
            <label className="block text-green-300 text-sm font-medium mb-2">🏷️ 类型</label>
            <select
              className="w-full bg-gray-800/50 border border-green-700/30 rounded-lg px-4 py-3 text-gray-200 focus:border-green-500/50 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all duration-200"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as "想吃的菜" | "忌口")}
            >
              <option value="想吃的菜">想吃的菜</option>
              <option value="忌口">忌口</option>
            </select>
          </div>
          
          <div className="sm:col-span-1">
            <label className="block text-green-300 text-sm font-medium mb-2">💭 内容</label>
            <input
              className="w-full bg-gray-800/50 border border-green-700/30 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-400 focus:border-green-500/50 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all duration-200"
              placeholder="例如：麻婆豆腐 / 不要香菜"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          
          <div className="sm:col-span-1 flex flex-col justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg px-6 py-3 font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
            >
              {loading ? "✨ 提交中..." : "🚀 提交心愿"}
            </button>
          </div>
        </form>
        
        {message && (
          <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${
            message.includes('成功') 
              ? 'bg-green-900/30 border border-green-700/30 text-green-400' 
              : 'bg-red-900/30 border border-red-700/30 text-red-400'
          }`}>
            {message.includes('成功') ? '✅ ' : '❌ '}{message}
          </div>
        )}
      </div>

      {/* 心愿池 */}
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white text-lg">💫</span>
          </div>
          <div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              心愿池
            </h3>
            <p className="text-green-400/70 text-sm font-medium">大家的美食心愿汇聚于此</p>
          </div>
        </div>
        
        <div className="mt-4">
          {pool.length === 0 ? (
            <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-700/20 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-green-400 text-2xl">🌟</span>
              </div>
              <p className="text-green-400/70 text-sm">暂无心愿，快来许下第一个美食愿望吧！</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pool.map((w, idx)=> {
                return (
                  <div 
                    key={w.id} 
                    className="relative overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl group hover:scale-105"
                    style={{ animationDelay: `${0.1 * (idx + 1)}s` }}
                  >
                    {/* 背景图片 */}
                    <div 
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-110"
                      style={{ 
                        backgroundImage: `url(${getSmartFoodImage(w.content)})`,
                      }}
                    />
                    
                    {/* 轻微渐变遮罩 - 仅用于文字可读性 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    
                    {/* 内容区域 */}
                    <div className="relative z-10 p-5">
                      {/* 心愿内容 */}
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-white text-lg leading-tight pr-2 drop-shadow-2xl bg-black/30 backdrop-blur-sm rounded-lg px-3 py-1">{w.content}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap backdrop-blur-sm ${
                          w.request_type === '想吃的菜' 
                            ? 'bg-green-500/90 text-white border border-green-400/70' 
                            : 'bg-orange-500/90 text-white border border-orange-400/70'
                        }`}>
                          {w.request_type === '想吃的菜' ? '🍽️ 想吃' : '🚫 忌口'}
                        </span>
                      </div>
                      
                      {/* 提交人信息 */}
                      <div className="mb-4">
                        <div className="text-white/90 text-xs font-medium mb-1 drop-shadow-lg bg-black/20 backdrop-blur-sm rounded px-2 py-0.5 inline-block">提交人</div>
                        <div className="flex items-center">
                          <div className="w-6 h-6 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center mr-2 border border-white/50">
                            <span className="text-white text-xs">👤</span>
                          </div>
                          <span className="text-white font-medium drop-shadow-2xl bg-black/30 backdrop-blur-sm rounded px-2 py-1">{w.user_name}</span>
                        </div>
                      </div>
                      
                      {/* 时间戳 */}
                      <div className="text-xs text-white/80 mb-3 drop-shadow-lg bg-black/20 backdrop-blur-sm rounded px-2 py-1 inline-block">
                        🕒 {new Date(w.created_at || '').toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      
                      {/* 删除按钮 */}
                      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/80 backdrop-blur-sm border border-red-400/50 text-white hover:bg-red-600/80 hover:border-red-300/50 active:scale-95 transition-all duration-200 text-xs font-medium drop-shadow"
                          onClick={async()=>{
                            const supabase = getSupabaseClient();
                            await supabase.from('menu_wishes').delete().eq('id', w.id);
                            const { data } = await supabase
                              .from('menu_wishes')
                              .select('id, user_name, request_type, content, status, created_at')
                              .order('created_at', { ascending: false })
                              .limit(100);
                            setPool(data || []);
                          }}
                        >
                          🗑️ 删除
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}


