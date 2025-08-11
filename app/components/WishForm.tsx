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
      <h2 className="text-lg font-semibold mb-3">菜单心愿表单</h2>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-4">
        <input
          className="border rounded px-3 py-2 sm:col-span-1"
          placeholder="姓名"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
        />
        <select
          className="border rounded px-3 py-2 sm:col-span-1"
          value={requestType}
          onChange={(e) => setRequestType(e.target.value as "想吃的菜" | "忌口")}
        >
          <option value="想吃的菜">想吃的菜</option>
          <option value="忌口">忌口</option>
        </select>
        <input
          className="border rounded px-3 py-2 sm:col-span-1"
          placeholder="内容（例如：麻婆豆腐 / 不要香菜）"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white rounded px-4 py-2 sm:col-span-1 disabled:opacity-50"
        >
          {loading ? "提交中..." : "提交心愿"}
        </button>
      </form>
      {message && <div className="mt-2 text-sm text-gray-700">{message}</div>}

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">心愿池</h3>
        </div>
        <div className="mt-2">
          {pool.length === 0 ? (
            <div className="text-sm text-neutral-500">暂无心愿</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pool.map((w, idx)=> {
                return (
                  <div key={w.id} className="ui-card rounded-xl p-5 card-hover animate-slide-up relative" style={{ animationDelay: `${0.1 * (idx + 1)}s` }}>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-heading">{w.content}</h3>
                      <span className="badge badge-primary">{w.request_type}</span>
                    </div>
                    <div className="text-sm text-muted mb-2">提交人</div>
                    <div className="flex items-center mb-4">
                      <i className="fa fa-user text-primary mr-2" />
                      <span>{w.user_name}</span>
                    </div>
                    
                    {/* 删除按钮 */}
                    <div className="absolute bottom-3 right-3">
                      <button
                        className="flex items-center gap-1 px-3 py-1.5 rounded border border-red-500 text-red-600 hover:bg-red-50 active:scale-95 transition select-none"
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
                        删除
                      </button>
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-2 absolute bottom-3 left-5">
                      {new Date(w.created_at || '').toLocaleString()}
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


