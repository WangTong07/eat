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

  // 获取选中月份周围的6个月数据（选中月份前后各3个月）
  useEffect(() => {
    const fetchMonthlyData = async () => {
      try {
        setLoading(true);
        const supabase = getSupabaseClient();
        
        // 生成选中月份前后6个月的月份列表
        const months: string[] = [];
        const selectedDate = new Date(selectedMonth + '-01');
        
        for (let i = 5; i >= 0; i--) {
          const date = new Date(selectedDate);
          date.setMonth(date.getMonth() - i);
          const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          months.push(monthStr);
        }

        // 获取每个月的支出数据
        const monthlyAmounts: MonthlyData[] = [];
        
        for (const month of months) {
          const [year, monthNum] = month.split('-').map(v => parseInt(v));
          const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
          const endDate = new Date(year, monthNum, 0).toISOString().slice(0, 10);
          
          try {
            const { data, error } = await supabase
              .from('expenses')
              .select('amount')
              .gte('date', startDate)
              .lte('date', endDate);
            
            if (error) throw error;
            
            const totalAmount = (data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
            
            monthlyAmounts.push({
              month,
              amount: totalAmount,
              displayName: `${monthNum}月`
            });
          } catch (error) {
            console.error(`获取${month}数据失败:`, error);
            monthlyAmounts.push({
              month,
              amount: 0,
              displayName: `${monthNum}月`
            });
          }
        }

        setMonthlyData(monthlyAmounts);
      } catch (error) {
        console.error('获取月度对比数据失败:', error);
        setMonthlyData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMonthlyData();
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
    const maxAmount = Math.max(...amounts, selectedAmount);
    
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
        <div className="text-sm text-gray-400 font-medium">最近6个月趋势:</div>
        <div className="flex items-end justify-between gap-1 h-16 bg-gray-800/30 rounded-lg p-2">
          {monthlyData.map((data, index) => {
            const isSelectedMonth = data.month === selectedMonth;
            const amount = data.amount;
            const height = stats?.maxAmount ? (amount / stats.maxAmount) * 100 : 0;
            
            return (
              <div key={data.month} className="flex flex-col items-center gap-1 flex-1">
                <div 
                  className={`w-full rounded-sm transition-all duration-300 ${
                    isSelectedMonth 
                      ? 'bg-gradient-to-t from-blue-500 to-blue-400 shadow-md' 
                      : 'bg-gradient-to-t from-purple-600/60 to-pink-600/60'
                  }`}
                  style={{ height: `${Math.max(height, 2)}%` }}
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