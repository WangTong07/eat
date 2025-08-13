"use client";
import { useEffect, useState, useMemo } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type MonthlyData = {
  month: string;
  amount: number;
  displayName: string;
};

interface MonthlyComparisonCardProps {
  currentMonth: string; // YYYY-MM format
  currentAmount: number;
}

export default function MonthlyComparisonCard({ currentMonth, currentAmount }: MonthlyComparisonCardProps) {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // 生成可选择的月份列表（从当前月往前推12个月）
  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i <= 11; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const displayStr = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      options.push({ value: monthStr, label: displayStr });
    }
    return options;
  };

  const monthOptions = generateMonthOptions();

  // 获取选中月份周围的4个月数据（选中月份居中）
  useEffect(() => {
    const fetchMonthlyData = async () => {
      try {
        setLoading(true);
        const supabase = getSupabaseClient();
        
        // 生成选中月份前后4个月的月份列表（选中月份居中）
        const months: string[] = [];
        const selectedDate = new Date(selectedMonth + '-01');
        
        // 前2个月，选中月份，后1个月
        for (let i = 2; i >= -1; i--) {
          const date = new Date(selectedDate);
          date.setMonth(date.getMonth() - i);
          const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          months.push(monthStr);
        }

        // 计算查询范围
        const firstMonth = months[0];
        const lastMonth = months[months.length - 1];
        const [firstYear, firstMonthNum] = firstMonth.split('-').map(v => parseInt(v));
        const [lastYear, lastMonthNum] = lastMonth.split('-').map(v => parseInt(v));
        
        const startDate = `${firstYear}-${String(firstMonthNum).padStart(2, '0')}-01`;
        const endDate = new Date(lastYear, lastMonthNum, 0).toISOString().slice(0, 10);

        // 单次查询获取所有数据，然后按月分组
        const { data, error } = await supabase
          .from('expenses')
          .select('amount, date')
          .gte('date', startDate)
          .lte('date', endDate);
        
        if (error) throw error;

        // 按月分组数据
        const monthlyMap = new Map<string, number>();
        
        // 初始化所有月份为0
        months.forEach(month => {
          monthlyMap.set(month, 0);
        });

        // 聚合数据
        (data || []).forEach(expense => {
          const expenseDate = new Date(expense.date);
          const monthKey = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
          const amount = Number(expense.amount) || 0;
          
          if (monthlyMap.has(monthKey)) {
            const currentAmount = monthlyMap.get(monthKey) || 0;
            monthlyMap.set(monthKey, currentAmount + amount);
          }
        });

        // 转换为数组格式
        const monthlyAmounts: MonthlyData[] = months.map(month => {
          const [year, monthNum] = month.split('-').map(v => parseInt(v));
          const amount = monthlyMap.get(month) || 0;
          return {
            month,
            amount,
            displayName: `${monthNum}月`
          };
        });

        setMonthlyData(monthlyAmounts);
      } catch (error) {
        console.error('获取月度对比数据失败:', error);
        // 设置默认数据，避免一直加载
        const selectedDate = new Date(selectedMonth + '-01');
        const fallbackData: MonthlyData[] = [];
        
        for (let i = 5; i >= 0; i--) {
          const date = new Date(selectedDate);
          date.setMonth(date.getMonth() - i);
          const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const [year, monthNum] = monthStr.split('-').map(v => parseInt(v));
          
          fallbackData.push({
            month: monthStr,
            amount: 0,
            displayName: `${monthNum}月`
          });
        }
        
        setMonthlyData(fallbackData);
      } finally {
        setLoading(false);
      }
    };

    // 添加超时处理
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('月度数据查询超时，使用默认数据');
        setLoading(false);
        setMonthlyData([]);
      }
    }, 5000); // 5秒超时

    fetchMonthlyData().finally(() => {
      clearTimeout(timeoutId);
    });

    return () => {
      clearTimeout(timeoutId);
    };
  }, [selectedMonth]);

  // 计算统计数据
  const stats = useMemo(() => {
    if (monthlyData.length === 0) return null;

    const amounts = monthlyData.map(d => d.amount);
    const selectedData = monthlyData.find(d => d.month === selectedMonth);
    const selectedAmount = selectedData ? selectedData.amount : 0;
    
    // 获取上个月数据
    const selectedDate = new Date(selectedMonth + '-01');
    const prevDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
    const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const prevData = monthlyData.find(d => d.month === prevMonthKey);
    const lastMonthAmount = prevData ? prevData.amount : 0;
    
    // 计算环比变化
    const changeAmount = selectedAmount - lastMonthAmount;
    const changePercent = lastMonthAmount > 0 ? (changeAmount / lastMonthAmount) * 100 : 0;
    
    // 计算最大值用于图表缩放
    const maxAmount = Math.max(...amounts.filter(a => a > 0), 1); // 只考虑大于0的值
    
    return {
      selectedAmount,
      lastMonthAmount,
      changeAmount,
      changePercent,
      maxAmount,
      isIncrease: changeAmount > 0,
      isDecrease: changeAmount < 0
    };
  }, [monthlyData, selectedMonth]);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-purple-900/30 via-pink-900/30 to-indigo-900/30 border border-purple-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            📈 月度花销对比
          </div>
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white text-lg animate-pulse">📊</span>
          </div>
        </div>
        <div className="text-center py-8 text-gray-400">
          <div className="animate-spin text-2xl mb-2">⏳</div>
          <div>加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-900/30 via-pink-900/30 to-indigo-900/30 border border-purple-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          📈 月度花销对比
        </div>
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
          <span className="text-white text-lg">📊</span>
        </div>
      </div>

      {/* 当前选中月与上月对比 */}
      <div className="space-y-2 mb-4">
        <div className="flex items-baseline gap-2">
          <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            ¥{stats?.selectedAmount.toLocaleString('zh-CN', { minimumFractionDigits: 0 }) || '0'}
          </div>
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-lg text-gray-400 font-medium bg-transparent border-none outline-none cursor-pointer appearance-none pr-4 hover:text-gray-300 transition-colors"
              style={{ 
                background: 'transparent',
                color: 'rgb(156 163 175)', // text-gray-400
                fontSize: '1.125rem', // text-lg
                fontWeight: '500' // font-medium
              }}
            >
              {monthOptions.map(option => (
                <option key={option.value} value={option.value} className="bg-gray-800 text-white">
                  {option.label}
                </option>
              ))}
            </select>
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400 text-xs">
              ▼
            </div>
          </div>
        </div>
        
        {stats && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">上月: ¥{stats.lastMonthAmount.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}</span>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              stats.isIncrease ? 'bg-red-900/40 text-red-400' : 
              stats.isDecrease ? 'bg-green-900/40 text-green-400' : 
              'bg-gray-800/40 text-gray-400'
            }`}>
              <span>
                {stats.isIncrease ? '📈' : stats.isDecrease ? '📉' : '➖'}
              </span>
              <span>
                {stats.isIncrease ? '+' : ''}
                {Math.abs(stats.changePercent).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 最近6个月趋势图 */}
      <div className="space-y-2">
        <div className="text-sm text-gray-400 font-medium">最近4个月趋势: (v23:35)</div>
        <div className="flex items-end justify-between gap-1 h-16 bg-gray-800/30 rounded-lg p-2">
          {monthlyData.map((data, index) => {
            const isSelectedMonth = data.month === selectedMonth;
            const amount = data.amount;
            
            // 线性比例高度，消除对数压缩，增强对比
            let finalHeight = '2px'; // 默认最小像素线
            let minHeight = '2px';
            
            if (stats?.maxAmount && stats.maxAmount > 0 && amount > 0) {
              const ratio = Math.min(1, Math.max(0, amount / stats.maxAmount));
              const percent = ratio * 100;
              finalHeight = `${percent}%`;
            }
            
            return (
              <div key={data.month} className="flex flex-col items-center gap-1 flex-1" style={{ height: '100%' }}>
                <div 
                  className={`w-full rounded-sm transition-all duration-300 ${
                    isSelectedMonth 
                      ? 'bg-gradient-to-t from-blue-500 to-blue-400 shadow-md' 
                      : 'bg-gradient-to-t from-purple-600/60 to-pink-600/60'
                  }`}
                  style={{ 
                    height: finalHeight,
                    minHeight: minHeight
                  }}
                  title={`${data.displayName}: ¥${amount.toLocaleString('zh-CN')}`}
                ></div>
                <div className={`text-xs font-medium ${
                  isSelectedMonth ? 'text-blue-300' : 'text-gray-500'
                }`}>
                  {data.displayName}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 简单统计 */}
      {stats && (
        <div className="mt-4 pt-4 border-t border-purple-700/30">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-800/60 backdrop-blur-sm rounded-lg p-2 text-center border border-purple-700/30">
              <div className="text-gray-400 mb-1">环比变化</div>
              <div className={`font-bold ${
                stats.isIncrease ? 'text-red-400' : 
                stats.isDecrease ? 'text-green-400' : 
                'text-gray-400'
              }`}>
                {stats.isIncrease ? '+' : ''}¥{Math.abs(stats.changeAmount).toLocaleString('zh-CN')}
              </div>
            </div>
            <div className="bg-gray-800/60 backdrop-blur-sm rounded-lg p-2 text-center border border-purple-700/30">
              <div className="text-gray-400 mb-1">趋势</div>
              <div className={`font-bold ${
                stats.isIncrease ? 'text-red-400' : 
                stats.isDecrease ? 'text-green-400' : 
                'text-gray-400'
              }`}>
                {stats.isIncrease ? '上升' : stats.isDecrease ? '下降' : '持平'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}