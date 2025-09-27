"use client";

interface FinanceAuditSummaryProps {
  summary: {
    totalBudget: number;
    totalExpense: number;
    remaining: number;
    activeMembers: number;
    refundPerPerson: number;
  };
  periodRange: {
    startDate: string;
    endDate: string;
  };
}

export default function FinanceAuditSummary({ summary, periodRange }: FinanceAuditSummaryProps) {
  // 不使用四舍五入，保持原始精度的金额格式化
  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // 用于显示整数金额的格式化函数（如预算概览）
  const formatCurrencyInteger = (amount: number) => {
    return `¥${Math.floor(amount).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const usageRate = summary.totalBudget > 0 ? (summary.totalExpense / summary.totalBudget) * 100 : 0;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center">
          📊 财务概览
        </h2>
        <div className="text-sm text-gray-500">
          周期: {formatDate(periodRange.startDate)} - {formatDate(periodRange.endDate)}
        </div>
      </div>

      {/* 主要指标 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-blue-600 text-sm font-medium mb-1">总预算</div>
          <div className="text-2xl font-bold text-blue-800">
            {formatCurrencyInteger(summary.totalBudget)}
          </div>
        </div>

        <div className="bg-red-50 rounded-lg p-4">
          <div className="text-red-600 text-sm font-medium mb-1">总支出</div>
          <div className="text-2xl font-bold text-red-800">
            {formatCurrency(summary.totalExpense)}
          </div>
        </div>

        <div className={`${summary.remaining >= 0 ? 'bg-green-50' : 'bg-red-50'} rounded-lg p-4`}>
          <div className={`${summary.remaining >= 0 ? 'text-green-600' : 'text-red-600'} text-sm font-medium mb-1`}>
            {summary.remaining >= 0 ? '剩余金额' : '超支金额'}
          </div>
          <div className={`text-2xl font-bold ${summary.remaining >= 0 ? 'text-green-800' : 'text-red-800'}`}>
            {formatCurrency(Math.abs(summary.remaining))}
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-purple-600 text-sm font-medium mb-1">每人返费</div>
          <div className="text-2xl font-bold text-purple-800">
            {formatCurrency(summary.refundPerPerson)}
          </div>
        </div>
      </div>

      {/* 预算使用率 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">预算使用率</span>
          <span className={`text-sm font-bold ${usageRate > 100 ? 'text-red-600' : usageRate > 80 ? 'text-yellow-600' : 'text-green-600'}`}>
            {usageRate.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${
              usageRate > 100 ? 'bg-red-500' : usageRate > 80 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(usageRate, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* 参与返费信息 */}
      <div className="flex items-center justify-between text-sm text-gray-600 mt-4 pt-4 border-t">
        <span>参与返费人数: {summary.activeMembers}人 (整月缴费)</span>
        {summary.remaining > 0 && (
          <span className="text-green-600">
            💰 共可返费 {formatCurrency(summary.remaining)}
          </span>
        )}
        {summary.remaining < 0 && (
          <span className="text-red-600">
            ⚠️ 超支 {formatCurrency(Math.abs(summary.remaining))}
          </span>
        )}
      </div>
    </div>
  );
}