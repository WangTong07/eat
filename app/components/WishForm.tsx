"use client";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

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
      <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-700/30 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-xl p-6 mb-8 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white text-lg">📝</span>
          </div>
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              菜单心愿表单
            </h2>
            <p className="text-blue-400/70 text-sm font-medium">告诉我们你的美食偏好</p>
          </div>
        </div>
        
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-1">
            <label className="block text-blue-300 text-sm font-medium mb-2">👤 姓名</label>
            <input
              className="w-full bg-gray-800/50 border border-blue-700/30 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-400 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
              placeholder="请输入姓名"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
          </div>
          
          <div className="sm:col-span-1">
            <label className="block text-blue-300 text-sm font-medium mb-2">🏷️ 类型</label>
            <select
              className="w-full bg-gray-800/50 border border-blue-700/30 rounded-lg px-4 py-3 text-gray-200 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as "想吃的菜" | "忌口")}
            >
              <option value="想吃的菜">想吃的菜</option>
              <option value="忌口">忌口</option>
            </select>
          </div>
          
          <div className="sm:col-span-1">
            <label className="block text-blue-300 text-sm font-medium mb-2">💭 内容</label>
            <input
              className="w-full bg-gray-800/50 border border-blue-700/30 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-400 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
              placeholder="例如：麻婆豆腐 / 不要香菜"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          
          <div className="sm:col-span-1 flex flex-col justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg px-6 py-3 font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
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
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white text-lg">💫</span>
          </div>
          <div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              心愿池
            </h3>
            <p className="text-purple-400/70 text-sm font-medium">大家的美食心愿汇聚于此</p>
          </div>
        </div>
        
        <div className="mt-4">
          {pool.length === 0 ? (
            <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-700/20 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-blue-400 text-2xl">🌟</span>
              </div>
              <p className="text-blue-400/70 text-sm">暂无心愿，快来许下第一个美食愿望吧！</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pool.map((w, idx)=> {
                return (
                  <div 
                    key={w.id} 
                    className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-5 relative group hover:scale-105 backdrop-blur-sm"
                    style={{ animationDelay: `${0.1 * (idx + 1)}s` }}
                  >
                    {/* 心愿内容 */}
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-bold text-gray-200 text-lg leading-tight pr-2">{w.content}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                        w.request_type === '想吃的菜' 
                          ? 'bg-green-900/40 text-green-400 border border-green-700/50' 
                          : 'bg-orange-900/40 text-orange-400 border border-orange-700/50'
                      }`}>
                        {w.request_type === '想吃的菜' ? '🍽️ 想吃' : '🚫 忌口'}
                      </span>
                    </div>
                    
                    {/* 提交人信息 */}
                    <div className="mb-4">
                      <div className="text-blue-300/70 text-xs font-medium mb-1">提交人</div>
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-2">
                          <span className="text-white text-xs">👤</span>
                        </div>
                        <span className="text-gray-300 font-medium">{w.user_name}</span>
                      </div>
                    </div>
                    
                    {/* 时间戳 */}
                    <div className="text-xs text-blue-400/60 mb-3">
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
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-900/40 border border-red-700/50 text-red-400 hover:bg-red-800/40 hover:border-red-600/50 active:scale-95 transition-all duration-200 text-xs font-medium"
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
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}


