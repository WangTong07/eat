'use client';

import { useEffect, useState } from 'react';

interface MonthlyComparisonCardProps {
  currentMonth: string;
  currentAmount: number;
}

export default function MonthlyComparisonCard({ currentMonth, currentAmount }: MonthlyComparisonCardProps) {
  const [monthlyData, setMonthlyData] = useState<Array<{ month: string; amount: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // 生成可选择的月份列表（最近12个月）
  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const displayStr = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      options.push({ value: monthStr, label: displayStr });
    }
    return options;
  };

  const monthOptions = generateMonthOptions();

  // 获取月度数据
  const fetchMonthlyData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/expenses');
      if (!response.ok) throw new Error('Failed to fetch expenses');
      
      const expenses = await response.json();
      
      // 按月聚合数据
      const monthlyMap = new Map<string, number>();
      
      expenses.forEach((expense: any) => {
        const date = new Date(expense.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const amount = Number(expense.amount) || 0;
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + amount);
      });

      // 转换为数组并排序
      const monthlyArray = Array.from(monthlyMap.entries())
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => a.month.localeCompare(b.month));

      setMonthlyData(monthlyArray);
    } catch (error) {
      console.error('Error fetching monthly data:', error);
      setMonthlyData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyData();
  }, []);

  // 获取选中月份的数据
  const getSelectedMonthData = () => {
    const selectedData = monthlyData.find(item => item.month === selectedMonth);
    return selectedData ? selectedData.amount : 0;
  };

  // 获取上个月的数据
  const getPreviousMonthData = () => {
    const selectedDate = new Date(selectedMonth + '-01');
    const prevDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
    const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    
    const prevData = monthlyData.find(item => item.month === prevMonthKey);
    return prevData ? prevData.amount : 0;
  };

  // 计算环比变化
  const calculateChange = () => {
    const currentAmount = getSelectedMonthData();
    const previousAmount = getPreviousMonthData();
    
    if (previousAmount === 0) return { percentage: 0, isIncrease: false };
    
    const change = ((currentAmount - previousAmount) / previousAmount) * 100;
    return {
      percentage: Math.abs(change),
      isIncrease: change > 0
    };
  };

  // 获取趋势数据（选中月份前后各3个月，共7个月）
  const getTrendData = () => {
    const selectedDate = new Date(selectedMonth + '-01');
    const trendData = [];
    
    for (let i = -3; i <= 3; i++) {
      const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthData = monthlyData.find(item => item.month === monthKey);
      
      trendData.push({
        month: monthKey,
        amount: monthData ? monthData.amount : 0,
        isSelected: monthKey === selectedMonth,
        displayName: `${date.getMonth() + 1}月`
      });
    }
    
    return trendData;
  };

  const selectedAmount = getSelectedMonthData();
  const previousAmount = getPreviousMonthData();
  const change = calculateChange();
  const trendData = getTrendData();
  const maxAmount = Math.max(...trendData.map(d => d.amount), 1);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 bg-purple-500 rounded-lg flex items-center justify-center">
            📈
          </div>
          <h3 className="text-lg font-semibold">月度花销对比</h3>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-purple-700 rounded mb-2"></div>
          <div className="h-4 bg-purple-700 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 rounded-xl p-6 text-white shadow-lg">
      {/* 标题和月份选择器 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-purple-500 rounded-lg flex items-center justify-center">
            📈
          </div>
          <h3 className="text-lg font-semibold">月度花销对比</h3>
        </div>
        
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-purple-700/50 border border-purple-600 rounded-lg px-3 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          {monthOptions.map(option => (
            <option key={option.value} value={option.value} className="bg-purple-800">
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* 金额对比 */}
      <div className="mb-4">
        <div className="text-3xl font-bold mb-2">¥{selectedAmount.toFixed(0)}</div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-purple-200">
            上月: ¥{previousAmount.toFixed(0)}
          </span>
          {change.percentage > 0 && (
            <span className={`flex items-center gap-1 ${
              change.isIncrease ? 'text-red-400' : 'text-green-400'
            }`}>
              {change.isIncrease ? '↑' : '↓'}{change.percentage.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* 趋势图 */}
      <div className="mb-4">
        <div className="text-sm text-purple-200 mb-2">最近7个月趋势:</div>
        <div className="flex items-end justify-between gap-1 h-16 mb-2">
          {trendData.map((data, index) => (
            <div key={data.month} className="flex flex-col items-center flex-1">
              <div
                className={`w-full rounded-t transition-all duration-300 ${
                  data.isSelected 
                    ? 'bg-blue-400 shadow-lg' 
                    : 'bg-purple-400/60 hover:bg-purple-400/80'
                }`}
                style={{
                  height: `${Math.max((data.amount / maxAmount) * 100, 2)}%`,
                  minHeight: '2px'
                }}
                title={`${data.displayName}: ¥${data.amount.toFixed(0)}`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-purple-300">
          {trendData.map((data) => (
            <span key={data.month} className={data.isSelected ? 'text-blue-300 font-semibold' : ''}>
              {data.displayName}
            </span>
          ))}
        </div>
      </div>

      {/* 底部统计 */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-purple-700/50">
        <div className="text-center">
          <div className="text-xs text-purple-300">环比变化</div>
          <div className={`text-sm font-semibold ${
            change.isIncrease ? 'text-red-400' : 'text-green-400'
          }`}>
            {change.percentage > 0 ? (
              `${change.isIncrease ? '+' : '-'}¥${Math.abs(selectedAmount - previousAmount).toFixed(0)}`
            ) : (
              '无变化'
            )}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-purple-300">趋势</div>
          <div className={`text-sm font-semibold ${
            change.isIncrease ? 'text-red-400' : 'text-green-400'
          }`}>
            {change.percentage === 0 ? '持平' : change.isIncrease ? '上升' : '下降'}
          </div>
        </div>
      </div>
    </div>
  );
}