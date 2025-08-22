"use client";
import { useState, useEffect, useCallback } from 'react';

type RecurringExpense = {
  id: string;
  name: string;
  amount: number;
  description?: string;
  is_active: boolean;
  created_at: string;
};

type RecurringExpenseManagerProps = {
  currentCycle: string; // YYYY-MM format
  onExpenseAdded?: () => void;
};

export default function RecurringExpenseManager({ currentCycle, onExpenseAdded }: RecurringExpenseManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringExpense | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    description: '',
    is_active: true
  });
  const [autoExecuteResult, setAutoExecuteResult] = useState<any>(null);

  // 加载固定支出配置
  const loadRecurringExpenses = useCallback(async () => {
    try {
      const response = await fetch('/api/recurring-expenses');
      const data = await response.json();
      if (data.items) {
        setRecurringExpenses(data.items);
      }
    } catch (error) {
      console.error('加载固定支出配置失败:', error);
    }
  }, []);

  // 检查并执行固定支出
  const checkAndExecuteRecurring = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/recurring-expenses?action=check_and_execute&cycle=${currentCycle}`);
      const data = await response.json();
      
      if (data.success) {
        setAutoExecuteResult(data);
        
        // 如果有新添加的支出，立即通知父组件刷新
        const addedCount = data.results?.filter((r: any) => r.status === 'added').length || 0;
        if (addedCount > 0 && onExpenseAdded) {
          // 立即执行回调，不延迟
          onExpenseAdded();
        }
      }
    } catch (error) {
      console.error('执行固定支出失败:', error);
    } finally {
      setLoading(false);
    }
  }, [currentCycle, onExpenseAdded]);

  // 组件加载时执行
  useEffect(() => {
    loadRecurringExpenses();
    checkAndExecuteRecurring();
  }, [loadRecurringExpenses, checkAndExecuteRecurring]);

  // 保存固定支出配置
  const handleSave = async () => {
    try {
      if (!formData.name || !formData.amount) {
        alert('请填写名称和金额');
        return;
      }

      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        ...(editingItem ? { id: editingItem.id } : {})
      };

      const response = await fetch('/api/recurring-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.success) {
        await loadRecurringExpenses();
        setFormData({ name: '', amount: '', description: '', is_active: true });
        setEditingItem(null);
      } else {
        alert(`保存失败: ${data.error}`);
      }
    } catch (error) {
      console.error('保存固定支出失败:', error);
      alert('保存失败');
    }
  };

  // 删除固定支出配置
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个固定支出配置吗？')) return;

    try {
      const response = await fetch(`/api/recurring-expenses?id=${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        await loadRecurringExpenses();
      } else {
        alert(`删除失败: ${data.error}`);
      }
    } catch (error) {
      console.error('删除固定支出失败:', error);
      alert('删除失败');
    }
  };

  // 编辑固定支出
  const handleEdit = (item: RecurringExpense) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      amount: item.amount.toString(),
      description: item.description || '',
      is_active: item.is_active
    });
  };

  // 取消编辑
  const handleCancel = () => {
    setEditingItem(null);
    setFormData({ name: '', amount: '', description: '', is_active: true });
  };

  return (
    <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-6 mt-4">
      <button 
        className="w-full flex items-center justify-between mb-4 group" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-200">
            <span className="text-white text-lg">🤖</span>
          </div>
          <div className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            固定支出管理 (自动添加)
          </div>
        </div>
        <div className="flex items-center gap-2 bg-gray-800/70 backdrop-blur-sm px-4 py-2 rounded-lg border border-purple-700/30 group-hover:border-purple-600/50 transition-all duration-200">
          <span className="text-sm font-medium text-purple-400">
            {isOpen ? '📤 收起' : '📥 展开'}
          </span>
        </div>
      </button>

      {/* 自动执行结果显示 */}
      {autoExecuteResult && (
        <div className="mb-4 bg-gray-800/70 backdrop-blur-sm rounded-lg p-4 border border-purple-700/30">
          <div className="text-sm font-medium text-purple-400 mb-2">
            🤖 本周期自动执行结果:
          </div>
          {autoExecuteResult.results?.map((result: any, index: number) => (
            <div key={index} className="text-sm text-gray-300 mb-1">
              {result.status === 'added' && (
                <span className="text-green-400">✅ 已添加: {result.name} ¥{result.amount}</span>
              )}
              {result.status === 'already_exists' && (
                <span className="text-yellow-400">⚠️ 已存在: {result.name}</span>
              )}
              {result.status === 'error' && (
                <span className="text-red-400">❌ 失败: {result.name} - {result.error}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="bg-gray-800/70 backdrop-blur-sm rounded-lg p-4 border border-purple-700/30">
          {/* 添加/编辑表单 */}
          <div className="mb-6 bg-gray-900/50 rounded-lg p-4 border border-purple-700/20">
            <div className="text-lg font-semibold text-purple-400 mb-4">
              {editingItem ? '编辑固定支出' : '添加固定支出'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <input
                type="text"
                placeholder="支出名称"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="border-2 border-purple-700/30 bg-gray-800/50 text-gray-200 rounded-lg px-3 py-2 focus:border-purple-600/50 focus:ring-2 focus:ring-purple-900/30 transition-all duration-200 placeholder-gray-400"
              />
              <input
                type="number"
                step="0.01"
                placeholder="金额"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="border-2 border-purple-700/30 bg-gray-800/50 text-gray-200 rounded-lg px-3 py-2 focus:border-purple-600/50 focus:ring-2 focus:ring-purple-900/30 transition-all duration-200 placeholder-gray-400"
              />
              <input
                type="text"
                placeholder="描述 (可选)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="border-2 border-purple-700/30 bg-gray-800/50 text-gray-200 rounded-lg px-3 py-2 focus:border-purple-600/50 focus:ring-2 focus:ring-purple-900/30 transition-all duration-200 placeholder-gray-400"
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-purple-700/30 bg-gray-800/50 text-purple-600 focus:ring-purple-900/30"
                  />
                  <span className="text-sm">启用</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
              >
                {editingItem ? '更新' : '添加'}
              </button>
              {editingItem && (
                <button
                  onClick={handleCancel}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium px-4 py-2 rounded-lg transition-all duration-200"
                >
                  取消
                </button>
              )}
            </div>
          </div>

          {/* 固定支出列表 */}
          <div className="bg-gray-800/70 backdrop-blur-sm rounded-lg border border-purple-700/30 overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gradient-to-r from-purple-500 to-pink-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">名称</th>
                  <th className="px-4 py-3 text-right font-semibold">金额</th>
                  <th className="px-4 py-3 text-left font-semibold">描述</th>
                  <th className="px-4 py-3 text-center font-semibold">状态</th>
                  <th className="px-4 py-3 text-center font-semibold w-32">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-700/30">
                {recurringExpenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-2xl">🤖</span>
                        <span>暂无固定支出配置</span>
                      </div>
                    </td>
                  </tr>
                )}
                {recurringExpenses.map((item, index) => (
                  <tr key={item.id} className={`hover:bg-purple-800/30 transition-colors duration-150 ${index % 2 === 0 ? 'bg-gray-800/30' : 'bg-purple-800/20'}`}>
                    <td className="px-4 py-2 font-medium text-gray-200">{item.name}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-purple-400">
                      ¥{item.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-gray-300">{item.description || '-'}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        item.is_active 
                          ? 'bg-green-900/40 text-green-400 border border-green-700/50' 
                          : 'bg-gray-900/40 text-gray-400 border border-gray-700/50'
                      }`}>
                        {item.is_active ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => handleEdit(item)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-900/40 border border-blue-700/50 text-blue-400 hover:bg-blue-800/40 hover:border-blue-600/50 transition-all duration-200 text-xs"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-900/40 border border-red-700/50 text-red-400 hover:bg-red-800/40 hover:border-red-600/50 transition-all duration-200 text-xs"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {loading && (
            <div className="mt-4 text-center text-purple-400">
              <span className="inline-flex items-center gap-2">
                <span className="animate-spin">⚙️</span>
                正在检查固定支出...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}