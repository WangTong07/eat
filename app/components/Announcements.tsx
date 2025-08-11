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
      <h2 className="text-lg font-semibold mb-2">公告</h2>
      {loading && <div className="text-sm text-gray-500">加载中...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="space-y-6">
        {/* 发布新公告卡片 */}
        <div className="ui-card rounded-xl p-5 card-hover">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-heading">📢 发布新公告</h3>
            <span className="badge badge-secondary">新建</span>
          </div>
          <textarea
            value={newContent}
            onChange={(e)=>setNewContent(e.target.value)}
            placeholder="输入公告内容..." 
            className="w-full border rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" 
            rows={3}
          />
          <button 
            className="badge badge-primary px-4 py-2" 
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
            📤 发布公告
          </button>
        </div>

        {/* 公告列表 - 卡片式布局 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((a, index) => (
            <div key={a.id} className={`ui-card rounded-xl p-5 card-hover animate-slide-up relative`} style={{ animationDelay: `${0.1 * (index + 1)}s` }}>
              {editingId === a.id ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-heading">✏️ 编辑公告</h3>
                    <span className="badge badge-warning">编辑中</span>
                  </div>
                  <textarea 
                    className="w-full border rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" 
                    defaultValue={a.content} 
                    rows={4} 
                    id={`edit-${a.id}`} 
                  />
                  <div className="flex gap-2">
                    <button 
                      className="badge badge-primary px-3 py-1" 
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
                      className="badge badge-muted px-3 py-1" 
                      onClick={()=> setEditingId(null)}
                    >
                      ❌ 取消
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-heading">📋 公告</h3>
                    <span className="badge badge-primary">活跃</span>
                  </div>
                  
                  <div className="text-sm text-muted mb-2">内容</div>
                  <div className="text-sm whitespace-pre-wrap mb-4 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500">
                    {a.content}
                  </div>
                  
                  <div className="text-xs text-gray-500 mb-4 flex items-center">
                    <i className="fa fa-clock mr-1"></i>
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    <button 
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-sm bg-blue-100 text-blue-600 hover:bg-blue-200 cursor-pointer transition-all duration-200" 
                      onClick={()=> setEditingId(a.id)}
                    >
                      <span>✏️</span>
                      <span className="font-medium">编辑</span>
                    </button>
                    <button 
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-sm bg-red-100 text-red-600 hover:bg-red-200 cursor-pointer transition-all duration-200" 
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
        
        {items.length === 0 && !loading && !error && (
          <div className="ui-card rounded-xl p-8 text-center">
            <div className="text-6xl mb-4">📢</div>
            <div className="text-lg font-medium text-gray-600 mb-2">暂无公告</div>
            <div className="text-sm text-gray-500">发布第一条公告来开始吧！</div>
          </div>
        )}
      </div>
    </section>
  );
}


