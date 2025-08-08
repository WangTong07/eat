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
      <div className="space-y-2">
        <div className="ui-card p-3 rounded">
          <textarea
            value={newContent}
            onChange={(e)=>setNewContent(e.target.value)}
            placeholder="输入公告内容..." className="w-full border rounded p-2 mb-2" rows={3}
          />
          <button className="badge badge-primary" onClick={async()=>{
            if (!newContent.trim()) return;
            const res = await fetch('/api/announcements', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: newContent, is_active: true }) });
            if (res.ok) {
              setNewContent('');
              const r = await fetch('/api/announcements'); const j = await r.json(); setItems(j.items || []);
            }
          }}>发布</button>
        </div>
        {items.map((a) => (
          <div key={a.id} className="border rounded p-3 bg-yellow-50 border-yellow-200">
            {editingId === a.id ? (
              <>
                <textarea className="w-full border rounded p-2 mb-2" defaultValue={a.content} rows={3} id={`edit-${a.id}`} />
                <div className="flex gap-2">
                  <button className="badge badge-primary" onClick={async()=>{
                    const el = document.getElementById(`edit-${a.id}`) as HTMLTextAreaElement;
                    const content = el?.value || '';
                    await fetch('/api/announcements', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: a.id, content }) });
                    setEditingId(null);
                    const r = await fetch('/api/announcements'); const j = await r.json(); setItems(j.items || []);
                  }}>保存</button>
                  <button className="badge badge-muted" onClick={()=> setEditingId(null)}>取消</button>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm whitespace-pre-wrap">{a.content}</div>
                <div className="text-xs text-gray-500 mt-1">{new Date(a.created_at).toLocaleString()}</div>
                <div className="mt-2 flex gap-2">
                  <button className="badge badge-primary" onClick={()=> setEditingId(a.id)}>编辑</button>
                  <button className="badge badge-muted" onClick={async()=>{
                    await fetch('/api/announcements', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: a.id }) });
                    const r = await fetch('/api/announcements'); const j = await r.json(); setItems(j.items || []);
                  }}>删除</button>
                </div>
              </>
            )}
          </div>
        ))}
        {items.length === 0 && !loading && !error && (
          <div className="text-sm text-gray-500">暂无公告</div>
        )}
      </div>
    </section>
  );
}


