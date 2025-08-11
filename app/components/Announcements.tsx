"use client";
import { useEffect, useState } from "react";

type Announcement = {
  id: string;
  created_at: string;
  content: string;
  is_active: boolean;
};

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 定义不同的颜色组合
  const colorSchemes = [
    "bg-yellow-50 border-yellow-200",
    "bg-blue-50 border-blue-200", 
    "bg-green-50 border-green-200",
    "bg-purple-50 border-purple-200",
    "bg-pink-50 border-pink-200",
    "bg-indigo-50 border-indigo-200",
    "bg-red-50 border-red-200",
    "bg-orange-50 border-orange-200",
    "bg-teal-50 border-teal-200",
    "bg-cyan-50 border-cyan-200"
  ];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/announcements');
      const j = await res.json();
      if (res.ok) setItems(j.items || []); else setError(j?.error || '加载失败');
      setLoading(false);
    };
    load();
  }, []);

  return (
    <section className="w-full">
      {/* 公告中心 - 紧凑版设计 */}
      <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 border border-amber-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-white text-sm">📢</span>
            </div>
            <div>
              <h2 className="text-lg font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                公告中心
              </h2>
              <p className="text-amber-400/70 font-medium text-xs">发布和管理系统公告</p>
            </div>
          </div>
          <span className="bg-green-900/40 text-green-400 border border-green-700/50 px-2 py-1 rounded-full text-xs font-semibold">新建</span>
        </div>

        {/* 发布新公告区域 - 紧凑版 */}
        <div className="bg-gray-800/40 backdrop-blur-sm rounded-lg p-3 border border-amber-700/20">
          <div className="flex gap-3">
            <textarea
              value={newContent}
              onChange={(e)=>setNewContent(e.target.value)}
              placeholder="输入公告内容..." 
              className="flex-1 border border-amber-700/30 bg-gray-800/50 text-gray-200 rounded-lg p-3 focus:border-amber-600/50 focus:ring-1 focus:ring-amber-900/30 transition-all duration-200 resize-none placeholder-gray-400 text-sm" 
              rows={2}
            />
            <button 
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap self-start ${
                newContent.trim() 
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md hover:shadow-lg' 
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
              onClick={async()=>{
                if (!newContent.trim()) return;
                const res = await fetch('/api/announcements', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: newContent, is_active: true }) });
                if (res.ok) {
                  setNewContent('');
                  const r = await fetch('/api/announcements'); const j = await r.json(); setItems(j.items || []);
                }
              }}
              disabled={!newContent.trim()}
            >
              📤 发布
            </button>
          </div>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-400 mb-4 flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        加载中...
      </div>}
      {error && <div className="text-sm text-red-400 mb-4 bg-red-900/20 border border-red-700/30 rounded-lg p-3">❌ {error}</div>}
      
      <div className="space-y-6">

        {/* 公告列表 - 深色主题卡片式布局 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((a, index) => (
            <div key={a.id} className="bg-gradient-to-br from-slate-900/30 to-gray-900/30 border border-slate-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-6 relative animate-slide-up" style={{ animationDelay: `${0.1 * (index + 1)}s` }}>
              {editingId === a.id ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center shadow-md">
                        <span className="text-white text-sm">✏️</span>
                      </div>
                      <h3 className="font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">编辑公告</h3>
                    </div>
                    <span className="bg-yellow-900/40 text-yellow-400 border border-yellow-700/50 px-3 py-1 rounded-full text-xs font-semibold">编辑中</span>
                  </div>
                  <textarea 
                    className="w-full border border-slate-700/30 bg-gray-800/50 text-gray-200 rounded-lg p-4 mb-4 focus:border-slate-600/50 focus:ring-2 focus:ring-slate-900/30 transition-all duration-200 resize-none" 
                    defaultValue={a.content} 
                    rows={4} 
                    id={`edit-${a.id}`} 
                  />
                  <div className="flex gap-3">
                    <button 
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200" 
                      onClick={async()=>{
                        const el = document.getElementById(`edit-${a.id}`) as HTMLTextAreaElement;
                        const content = el?.value || '';
                        await fetch('/api/announcements', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: a.id, content }) });
                        setEditingId(null);
                        const r = await fetch('/api/announcements'); const j = await r.json(); setItems(j.items || []);
                      }}
                    >
                      💾 保存
                    </button>
                    <button 
                      className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200" 
                      onClick={()=> setEditingId(null)}
                    >
                      ❌ 取消
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-slate-500 to-gray-600 rounded-lg flex items-center justify-center shadow-md">
                        <span className="text-white text-sm">📋</span>
                      </div>
                      <h3 className="font-bold bg-gradient-to-r from-slate-400 to-gray-400 bg-clip-text text-transparent">公告</h3>
                    </div>
                    <span className="bg-blue-900/40 text-blue-400 border border-blue-700/50 px-3 py-1 rounded-full text-xs font-semibold">活跃</span>
                  </div>
                  
                  <div className="text-sm text-slate-400 mb-2 font-medium">内容</div>
                  <div className="text-sm whitespace-pre-wrap mb-4 p-4 bg-gray-800/60 backdrop-blur-sm rounded-lg border-l-4 border-blue-500 text-gray-200">
                    {a.content}
                  </div>
                  
                  <div className="text-xs text-gray-400 mb-4 flex items-center gap-1 bg-gray-800/40 rounded-lg px-3 py-2">
                    <span>🕒</span>
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                  
                  {/* 操作按钮 - 深色主题 */}
                  <div className="absolute bottom-4 right-4 flex items-center gap-2">
                    <button 
                      className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-blue-900/40 text-blue-400 border border-blue-700/50 hover:bg-blue-800/40 hover:border-blue-600/50 transition-all duration-200 shadow-sm hover:shadow-md" 
                      onClick={()=> setEditingId(a.id)}
                    >
                      <span>✏️</span>
                      <span className="font-medium">编辑</span>
                    </button>
                    <button 
                      className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-red-900/40 text-red-400 border border-red-700/50 hover:bg-red-800/40 hover:border-red-600/50 transition-all duration-200 shadow-sm hover:shadow-md" 
                      onClick={async()=>{
                        if (confirm('确定要删除这条公告吗？')) {
                          await fetch('/api/announcements', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: a.id }) });
                          const r = await fetch('/api/announcements'); const j = await r.json(); setItems(j.items || []);
                        }
                      }}
                    >
                      <span>🗑️</span>
                      <span className="font-medium">删除</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        
        {/* 空状态 - 深色主题设计 */}
        {items.length === 0 && !loading && !error && (
          <div className="bg-gradient-to-br from-gray-900/30 to-slate-900/30 border border-gray-700/30 shadow-lg rounded-xl p-12 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-500 to-slate-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <span className="text-white text-4xl">📢</span>
            </div>
            <div className="text-xl font-bold text-gray-300 mb-3">暂无公告</div>
            <div className="text-gray-400">发布第一条公告来开始吧！</div>
          </div>
        )}
      </div>
    </section>
  );
}


