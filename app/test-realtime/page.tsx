"use client";
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function TestRealtimePage() {
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `${timestamp}: ${message}`;
    setLogs(prev => [...prev, logMessage]);
    console.log(logMessage);
  };

  useEffect(() => {
    const supabase = getSupabaseClient();
    
    addLog('开始监听 menu_wishes 表变化...');
    
    // 监听 menu_wishes 表
    const menuChannel = supabase
      .channel('realtime:menu_wishes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'menu_wishes' 
        },
        (payload) => {
          addLog('检测到 menu_wishes 表变化: ' + JSON.stringify(payload, null, 2));
          
          if (payload.eventType === 'INSERT' && payload.new?.request_type === '想吃的菜') {
            addLog('🍽️ 新的菜品心愿: ' + payload.new.content);
          }
        }
      )
      .subscribe((status) => {
        addLog('menu_wishes 订阅状态: ' + status);
      });
    
    // 监听 shopping_list 表
    const shoppingChannel = supabase
      .channel('realtime:shopping_list')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'shopping_list' 
        },
        (payload) => {
          addLog('检测到 shopping_list 表变化: ' + JSON.stringify(payload, null, 2));
          
          if (payload.eventType === 'INSERT') {
            addLog('🛒 新增购物项: ' + payload.new?.name);
          }
        }
      )
      .subscribe((status) => {
        addLog('shopping_list 订阅状态: ' + status);
      });

    return () => {
      addLog('清理订阅...');
      supabase.removeChannel(menuChannel);
      supabase.removeChannel(shoppingChannel);
    };
  }, []);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">实时订阅测试</h1>
      
      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">测试步骤：</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>保持此页面打开</li>
          <li>在新标签页中打开 <a href="/preferences" className="text-blue-600 underline">偏好提交页面</a></li>
          <li>提交一个新的菜品心愿（如"芒果"）</li>
          <li>回到此页面查看是否有日志输出</li>
          <li>然后打开 <a href="/shopping" className="text-blue-600 underline">购物清单页面</a> 查看是否自动添加了食材</li>
        </ol>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-2">实时日志：</h2>
        <div className="bg-black text-green-400 p-4 rounded-lg h-96 overflow-y-auto font-mono text-sm">
          {logs.map((log, index) => (
            <div key={index} className="mb-1">
              {log}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-gray-500">等待日志输出...</div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <button 
          onClick={() => setLogs([])}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          清空日志
        </button>
      </div>
    </div>
  );
}