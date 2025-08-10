"use client";
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRealtimeSubscription } from '@/lib/useRealtimeSubscription';

export default function TestRealtimePage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const loadAssignments = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('duty_staff_assignments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setAssignments(data || []);
      setLastUpdate(new Date().toLocaleTimeString());
      console.log('✅ 数据已重新加载:', data?.length, '条记录');
    } catch (error) {
      console.error('❌ 加载失败:', error);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  // 实时订阅测试
  useRealtimeSubscription({
    table: 'duty_staff_assignments',
    onChange: () => {
      console.log('🔄 [TestRealtime] 检测到 duty_staff_assignments 变更');
      loadAssignments();
    }
  });

  const testInsert = async () => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('duty_staff_assignments')
        .insert({
          member_id: 'test-' + Date.now(),
          year: 2025,
          month: 8,
          week_in_month: 1
        });
      
      if (error) throw error;
      console.log('✅ 测试插入成功');
    } catch (error) {
      console.error('❌ 测试插入失败:', error);
    }
  };

  const testDelete = async () => {
    if (assignments.length === 0) return;
    
    try {
      const supabase = getSupabaseClient();
      const lastRecord = assignments[0];
      const { error } = await supabase
        .from('duty_staff_assignments')
        .delete()
        .eq('id', lastRecord.id);
      
      if (error) throw error;
      console.log('✅ 测试删除成功');
    } catch (error) {
      console.error('❌ 测试删除失败:', error);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">实时订阅测试</h1>
      
      <div className="mb-4 space-x-2">
        <button 
          onClick={testInsert}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          测试插入
        </button>
        <button 
          onClick={testDelete}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          测试删除
        </button>
        <button 
          onClick={loadAssignments}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          手动刷新
        </button>
      </div>

      <div className="mb-4">
        <p><strong>最后更新时间:</strong> {lastUpdate}</p>
        <p><strong>记录数量:</strong> {assignments.length}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="border border-gray-300 px-4 py-2">ID</th>
              <th className="border border-gray-300 px-4 py-2">Member ID</th>
              <th className="border border-gray-300 px-4 py-2">Year</th>
              <th className="border border-gray-300 px-4 py-2">Month</th>
              <th className="border border-gray-300 px-4 py-2">Week</th>
              <th className="border border-gray-300 px-4 py-2">Created At</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment, index) => (
              <tr key={assignment.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-300 px-4 py-2">{assignment.id}</td>
                <td className="border border-gray-300 px-4 py-2">{assignment.member_id}</td>
                <td className="border border-gray-300 px-4 py-2">{assignment.year}</td>
                <td className="border border-gray-300 px-4 py-2">{assignment.month}</td>
                <td className="border border-gray-300 px-4 py-2">{assignment.week_in_month}</td>
                <td className="border border-gray-300 px-4 py-2">
                  {new Date(assignment.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h3 className="font-bold text-yellow-800">测试说明:</h3>
        <ul className="list-disc list-inside text-yellow-700 mt-2">
          <li>点击"测试插入"按钮，观察表格是否自动更新（不需要手动刷新）</li>
          <li>点击"测试删除"按钮，观察最新记录是否自动消失</li>
          <li>打开浏览器开发者工具查看控制台日志</li>
          <li>如果实时订阅正常工作，应该能看到 "[TestRealtime] 检测到 duty_staff_assignments 变更" 日志</li>
        </ul>
      </div>
    </div>
  );
}