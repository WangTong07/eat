"use client";
import { useEffect, useState, useMemo } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type MonthlyData = {
  month: string;
  amount: number;
  displayName: string;
};

// 获取基于21号周期的范围
function getBillingPeriod(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  let periodStart: Date;
  let periodEnd: Date;
  
  if (day >= 21) {
    // 当前日期在21号及以后，周期是当月21号到次月20号
    periodStart = new Date(year, month, 21);
    periodEnd = new Date(year, month + 1, 20);
  } else {
    // 当前日期在20号及以前，周期是上月21号到当月20号
    periodStart = new Date(year, month - 1, 21);
    periodEnd = new Date(year, month, 20);
  }
  
  return { periodStart, periodEnd };
}

// 格式化周期标识符 (YYYY-MM-P 格式，P表示周期)
function formatPeriodId(periodStart: Date): string {
  return `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}-P`;
}

// 格式化周期显示文本
function formatPeriodDisplay(periodStart: Date): string {
  const endDate = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 20);
  const startMonth = periodStart.getMonth() + 1;
  const endMonth = endDate.getMonth() + 1;
  const startYear = periodStart.getFullYear();
  const endYear = endDate.getFullYear();
  
  if (startYear === endYear) {
    return `${startYear}年${startMonth}.21-${endMonth}.20`;
  } else {
    return `${startYear}.${startMonth}.21-${endYear}.${endMonth}.20`;
  }
}

interface MonthlyComparisonCardProps {
  currentMonth: string; // YYYY-MM format (保持兼容性)
  currentAmount: number;
}

export default function MonthlyComparisonCard({ currentMonth, currentAmount }: MonthlyComparisonCardProps) {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    // 根据当前日期计算当前周期
    const now = new Date();
    const { periodStart } = getBillingPeriod(now);
    return formatPeriodId(periodStart);
  });

  // 生成可选择的周期列表（从当前周期往前推12个周期）
  const generatePeriodOptions = () => {
    const options = [];
    const now = new Date();
    
    for (let i = 0; i <= 11; i++) {
      // 计算i个周期前的日期
      const baseDate = new Date(now.getFullYear(), now.getMonth() - i, now.getDate());
      const { periodStart } = getBillingPeriod(baseDate);
      
      const periodId = formatPeriodId(periodStart);
      const displayStr = formatPeriodDisplay(periodStart);
      options.push({ value: periodId, label: displayStr });
    }
    return options;
  };

  const periodOptions = generatePeriodOptions();

  // 获取选中周期周围的4个周期数据（选中周期居中）
  useEffect(() => {
    const fetchPeriodData = async () => {
      try {
        setLoading(true);
        const supabase = getSupabaseClient();
        
        // 解析选中的周期ID，获取周期开始日期
        const [yearStr, monthStr] = selectedPeriod.split('-');
        const selectedPeriodStart = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 21);
        
        // 生成选中周期前后的周期列表（选中周期居中）
        const periods: { id: string; start: Date; end: Date; displayName: string }[] = [];
        
        // 前2个周期，选中周期，后1个周期
        for (let i = 2; i >= -1; i--) {
          const periodStart = new Date(selectedPeriodStart);
          periodStart.setMonth(periodStart.getMonth() - i);
          const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 20);
          
          const periodId = formatPeriodId(periodStart);
          const displayName = `${periodStart.getMonth() + 1}.21-${periodEnd.getMonth() + 1}.20`;
          
          periods.push({
            id: periodId,
            start: periodStart,
            end: periodEnd,
            displayName
          });
        }

        // 计算总查询范围
        const earliestStart = periods[0].start;
        const latestEnd = periods[periods.length - 1].end;
        
        const startDate = earliestStart.toISOString().slice(0, 10);
        const endDate = latestEnd.toISOString().slice(0, 10);

        // 单次查询获取所有数据，然后按周期分组
        const { data, error } = await supabase
          .from('expenses')
          .select('amount, date')
          .gte('date', startDate)
          .lte('date', endDate);
        
        if (error) throw error;

        // 按周期分组数据
        const periodMap = new Map<string, number>();
        
        // 初始化所有周期为0
        periods.forEach(period => {
          periodMap.set(period.id, 0);
        });

        // 聚合数据
        (data || []).forEach(expense => {
          const expenseDate = new Date(expense.date);
          const amount = Number(expense.amount) || 0;
          
          // 判断该支出属于哪个周期
          periods.forEach(period => {
            if (expenseDate >= period.start && expenseDate <= period.end) {
              const currentAmount = periodMap.get(period.id) || 0;
              periodMap.set(period.id, currentAmount + amount);
            }
          });
        });

        // 转换为数组格式
        const periodAmounts: MonthlyData[] = periods.map(period => {
          const amount = periodMap.get(period.id) || 0;
          return {
            month: period.id, // 使用周期ID作为标识
            amount,
            displayName: period.displayName
          };
        });

        setMonthlyData(periodAmounts);
      } catch (error) {
        console.error('获取周期对比数据失败:', error);
        // 设置默认数据，避免一直加载
        const [yearStr, monthStr] = selectedPeriod.split('-');
        const selectedPeriodStart = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 21);
        const fallbackData: MonthlyData[] = [];
        
        for (let i = 2; i >= -1; i--) {
          const periodStart = new Date(selectedPeriodStart);
          periodStart.setMonth(periodStart.getMonth() - i);
          const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 20);
          
          const periodId = formatPeriodId(periodStart);
          const displayName = `${periodStart.getMonth() + 1}.21-${periodEnd.getMonth() + 1}.20`;
          
          fallbackData.push({
            month: periodId,
            amount: 0,
            displayName
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
        console.warn('周期数据查询超时，使用默认数据');
        setLoading(false);
        setMonthlyData([]);
      }
    }, 5000); // 5秒超时

    fetchPeriodData().finally(() => {
      clearTimeout(timeoutId);
    });

    return () => {
      clearTimeout(timeoutId);
    };
  }, [selectedPeriod]);

  // 计算统计数据
  const stats = useMemo(() => {
    if (monthlyData.length === 0) return null;

    const amounts = monthlyData.map(d => d.amount);
    const selectedData = monthlyData.find(d => d.month === selectedPeriod);
    const selectedAmount = selectedData ? selectedData.amount : 0;
    
    // 获取上个周期数据
    const [yearStr, monthStr] = selectedPeriod.split('-');
    const selectedPeriodStart = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 21);
    const prevPeriodStart = new Date(selectedPeriodStart);
    prevPeriodStart.setMonth(prevPeriodStart.getMonth() - 1);
    const prevPeriodKey = formatPeriodId(prevPeriodStart);
    const prevData = monthlyData.find(d => d.month === prevPeriodKey);
    const lastPeriodAmount = prevData ? prevData.amount : 0;
    
    // 计算环比变化
    const changeAmount = selectedAmount - lastPeriodAmount;
    const changePercent = lastPeriodAmount > 0 ? (changeAmount / lastPeriodAmount) * 100 : 0;
    
    // 计算最大值用于图表缩放
    const maxAmount = Math.max(...amounts.filter(a => a > 0), 1); // 只考虑大于0的值
    
    return {
      selectedAmount,
      lastPeriodAmount,
      changeAmount,
      changePercent,
      maxAmount,
      isIncrease: changeAmount > 0,
      isDecrease: changeAmount < 0
    };
  }, [monthlyData, selectedPeriod]);

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
          📈 周期花销对比
        </div>
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
          <span className="text-white text-lg">📊</span>
        </div>
      </div>

      {/* 当前选中周期与上周期对比 */}
      <div className="space-y-2 mb-4">
        <div className="flex items-baseline gap-2">
          <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            ¥{stats?.selectedAmount.toLocaleString('zh-CN', { minimumFractionDigits: 0 }) || '0'}
          </div>
          <div className="relative">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="text-lg text-gray-400 font-medium bg-transparent border-none outline-none cursor-pointer appearance-none pr-4 hover:text-gray-300 transition-colors"
              style={{ 
                background: 'transparent',
                color: 'rgb(156 163 175)', // text-gray-400
                fontSize: '1.125rem', // text-lg
                fontWeight: '500' // font-medium
              }}
            >
              {periodOptions.map(option => (
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
            <span className="text-gray-400">上周期: ¥{stats.lastPeriodAmount.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}</span>
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

      {/* 最近4个周期趋势图 */}
      <div className="space-y-2">
        <div className="text-sm text-gray-400 font-medium">最近4个周期趋势: (21号周期)</div>
        <div className="flex items-end justify-between gap-1 h-16 bg-gray-800/30 rounded-lg p-2">
          {monthlyData.map((data, index) => {
            const isSelectedPeriod = data.month === selectedPeriod;
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
                    isSelectedPeriod 
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
                  isSelectedPeriod ? 'text-blue-300' : 'text-gray-500'
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