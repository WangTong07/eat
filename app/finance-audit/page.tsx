"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import Shell from "../dashboard/Shell";
import FinanceAuditSummary from "../components/FinanceAuditSummary";
import ExpenseByHandlerTable from "../components/ExpenseByHandlerTable";
import ExpenseDetailModal from "../components/ExpenseDetailModal";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useRealtimeSubscription } from "@/lib/useRealtimeSubscription";

interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  handler?: string;
  attachments?: Array<{ url: string; name?: string }>;
}

interface ExpenseByHandler {
  handlerName: string;
  expenseCount: number;
  totalAmount: number;
  expenses: Expense[];
}

interface AuditData {
  period: string;
  periodRange: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalBudget: number;
    totalExpense: number;
    remaining: number;
    activeMembers: number;
    refundPerPerson: number;
  };
  expensesByHandler: ExpenseByHandler[];
  totalRecords: number;
}

export default function FinanceAuditPage() {
  const [loading, setLoading] = useState(true);
  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedHandler, setSelectedHandler] = useState<ExpenseByHandler | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // 生成可选择的周期列表（最近12个月）
  const availablePeriods = useMemo(() => {
    const periods = [];
    const now = new Date();

    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const periodId = `${year}-${String(month).padStart(2, '0')}`;
      const periodLabel = `${year}年${month}月周期`;

      periods.push({ id: periodId, label: periodLabel });
    }

    return periods;
  }, []);

  // 21号周期计算函数 (修复时区问题)
  const getCycleRange = (yearMonth: string) => {
    const [year, month] = yearMonth.split('-').map(v => parseInt(v));

    // 21号周期：选择的月份的21号到次月20号
    // 如果用户选择"2025-09"，应该查询2025年9月21号到2025年10月20号的数据

    // 使用本地时间格式避免时区问题
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-21`;
    const endDateStr = `${year}-${String(month + 1).padStart(2, '0')}-20`;

    return {
      startDate: startDateStr,
      endDate: endDateStr
    };
  };

  // 数据处理函数 (与财务页面完全一致的逻辑)
  const processExpensesData = (expenses: any[], payments: any[], members: any[], period: string, periodRange: { startDate: string; endDate: string }): AuditData => {
    console.log('[FinanceAudit] 开始处理数据...');
    console.log('[FinanceAudit] 支出记录数量:', expenses.length);
    console.log('[FinanceAudit] 缴费记录数量:', payments.length);
    console.log('[FinanceAudit] 成员数量:', members.length);

    // 创建缴费状态映射 (与财务页面PaymentStatsCard完全相同的逻辑)
    const paymentMap: Record<string, any> = {};
    payments.forEach((p: any) => {
      paymentMap[p.member_id] = p;
    });

    // 统计缴费情况 (与财务页面PaymentStatsCard完全相同的逻辑)
    const memberDetails = members.map((member: any) => {
      const payment = paymentMap[member.id];
      return {
        name: member.name,
        paid: payment ? payment.paid : false,
        amount: payment ? payment.amount : null,
        coverage: payment ? payment.coverage : null
      };
    });

    // 计算总预算（与财务页面PaymentStatsCard完全相同：所有已缴费成员的金额总和，不管是整月还是区间）
    const totalBudget = memberDetails.reduce((sum: number, member: any) => {
      return sum + (member.paid && member.amount ? Number(member.amount) : 0);
    }, 0);

    console.log('[FinanceAudit] 总预算计算:', totalBudget);

    // 计算总支出 (不使用四舍五入，保持原始精度)
    const totalExpense = expenses.reduce((sum, expense) => {
      return sum + Number(expense.amount || 0);
    }, 0);

    console.log('[FinanceAudit] 总支出计算:', totalExpense);

    // 计算结余 (不使用四舍五入)
    const remaining = totalBudget - totalExpense;

    // 计算符合返费条件的成员数量（与财务页面PayStats完全相同：只有整月缴费、已缴费的人才能参与返费）
    const refundEligibleMembers = memberDetails.filter((member: any) =>
      member.paid && member.coverage === 'month'
    ).length;

    console.log('[FinanceAudit] 参与退费人数:', refundEligibleMembers);
    console.log('[FinanceAudit] 参与退费的成员:', memberDetails.filter(m => m.paid && m.coverage === 'month').map(m => m.name));

    // 计算每人返费金额（只有整月缴费的人平分结余，不使用四舍五入）
    const refundPerPerson = refundEligibleMembers > 0 ? Math.max(0, remaining / refundEligibleMembers) : 0;

    console.log('[FinanceAudit] 每人返费金额:', refundPerPerson);

    // 按经手人分组统计支出
    const handlerMap: Record<string, { expenses: any[], totalAmount: number }> = {};

    expenses.forEach(expense => {
      const handlerName = expense.user_name || expense.handler || '未知经手人';

      if (!handlerMap[handlerName]) {
        handlerMap[handlerName] = {
          expenses: [],
          totalAmount: 0
        };
      }

      // 转换字段名以匹配组件接口
      const processedExpense = {
        id: expense.id,
        date: expense.date,
        description: expense.item_description || expense.description || '无描述',
        amount: Number(expense.amount || 0),
        handler: handlerName,
        attachments: expense.receipt_url ? (() => {
          try {
            // 尝试解析为 JSON 数组（多张图片）
            const urls = JSON.parse(expense.receipt_url);
            if (Array.isArray(urls)) {
              return urls.map((url: string, index: number) => ({
                url,
                name: `附件${index + 1}`
              }));
            }
          } catch {
            // 如果解析失败，说明是单张图片的字符串格式
          }
          // 单张图片处理
          return [{
            url: expense.receipt_url,
            name: '附件'
          }];
        })() : []
      };

      handlerMap[handlerName].expenses.push(processedExpense);
      handlerMap[handlerName].totalAmount += processedExpense.amount;
    });

    // 转换为组件需要的格式
    const expensesByHandler: ExpenseByHandler[] = Object.entries(handlerMap)
      .map(([handlerName, data]) => ({
        handlerName,
        expenseCount: data.expenses.length,
        totalAmount: data.totalAmount,
        expenses: data.expenses
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount); // 按金额从高到低排序

    return {
      period,
      periodRange,
      summary: {
        totalBudget,
        totalExpense,
        remaining,
        activeMembers: refundEligibleMembers, // 只有整月缴费的人数
        refundPerPerson: refundPerPerson // 已经确保不为负数
      },
      expensesByHandler,
      totalRecords: expenses.length
    };
  };

  // 加载审计数据 (直接使用Supabase客户端，与财务页面完全相同的方式)
  const loadAuditData = async (period: string) => {
    try {
      setLoading(true);
      setError(null);

      // 计算21号周期范围
      const { startDate, endDate } = getCycleRange(period);

      // 直接使用Supabase客户端查询，与财务页面完全相同的方式
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;

      const expenses = data || [];

      // 调用成员缴费API
      const [year, month] = period.split('-').map(v => parseInt(v));
      console.log('[FinanceAudit] 开始获取缴费数据...', { year, month });

      const paymentsResponse = await fetch(`/api/members/pay?year=${year}&month=${month}`);
      if (!paymentsResponse.ok) {
        throw new Error(`获取缴费数据失败: ${paymentsResponse.status} ${paymentsResponse.statusText}`);
      }

      const paymentsText = await paymentsResponse.text();
      console.log('[FinanceAudit] 缴费API响应:', paymentsText.substring(0, 200));

      let paymentsData;
      try {
        paymentsData = JSON.parse(paymentsText);
      } catch (parseError) {
        console.error('[FinanceAudit] 解析缴费数据失败:', parseError);
        throw new Error(`解析缴费数据失败: ${parseError}`);
      }

      const payments = paymentsData.items || [];
      console.log('[FinanceAudit] 获取到缴费记录:', payments.length);

      // 调用成员列表API
      console.log('[FinanceAudit] 开始获取成员数据...');
      const membersResponse = await fetch('/api/members');
      if (!membersResponse.ok) {
        throw new Error(`获取成员数据失败: ${membersResponse.status} ${membersResponse.statusText}`);
      }

      const membersText = await membersResponse.text();
      console.log('[FinanceAudit] 成员API响应:', membersText.substring(0, 200));

      let membersData;
      try {
        membersData = JSON.parse(membersText);
      } catch (parseError) {
        console.error('[FinanceAudit] 解析成员数据失败:', parseError);
        throw new Error(`解析成员数据失败: ${parseError}`);
      }

      const members = (membersData.items || []).filter((m: any) => m.is_active);
      console.log('[FinanceAudit] 获取到活跃成员:', members.length);

      // 处理数据，与财务页面完全相同的逻辑
      const processedData = processExpensesData(expenses, payments, members, period, { startDate, endDate });

      setAuditData(processedData);
    } catch (err: any) {
      console.error('加载审计数据失败:', err);
      setError(err.message || '加载失败');
      setAuditData(null);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadAuditData(selectedPeriod);
  }, [selectedPeriod]);

  // 添加实时订阅 - 监听支出记录变化
  const handleExpensesChange = useCallback(() => {
    console.log('[FinanceAudit] 检测到支出记录变更，重新加载...');
    setTimeout(() => {
      loadAuditData(selectedPeriod);
    }, 1000);
  }, [selectedPeriod, loadAuditData]);

  // 添加实时订阅 - 监听缴费数据变化
  const handlePaymentsChange = useCallback(() => {
    console.log('[FinanceAudit] 检测到缴费数据变更，重新加载...');
    setTimeout(() => {
      loadAuditData(selectedPeriod);
    }, 1000);
  }, [selectedPeriod, loadAuditData]);

  useRealtimeSubscription({
    table: 'expenses',
    onChange: handleExpensesChange
  });

  useRealtimeSubscription({
    table: 'member_payments',
    onChange: handlePaymentsChange
  });

  // 添加刷新按钮功能
  const handleRefresh = useCallback(async () => {
    await loadAuditData(selectedPeriod);
  }, [selectedPeriod, loadAuditData]);

  // 处理周期变更
  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
  };

  // 处理查看明细
  const handleViewDetails = (handler: ExpenseByHandler) => {
    setSelectedHandler(handler);
    setModalOpen(true);
  };

  // 关闭弹窗
  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedHandler(null);
  };

  // 格式化周期显示
  const formatPeriodDisplay = (period: string) => {
    if (!auditData?.periodRange) return period;

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    return `${period} (${formatDate(auditData.periodRange.startDate)} - ${formatDate(auditData.periodRange.endDate)})`;
  };

  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 页面标题和周期选择 */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">💰 支出核对</h1>
            <p className="text-gray-300">
              查看周期财务统计和个人支出明细，计算返费金额
            </p>
          </div>

          <div className="mt-4 lg:mt-0 flex items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                选择周期 (21号周期)
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[200px]"
              >
                {availablePeriods.map(period => (
                  <option key={period.id} value={period.id}>
                    {period.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2 h-[44px]"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span>
              {loading ? '同步中' : '同步数据'}
            </button>
          </div>
        </div>

        {/* 当前周期显示 */}
        {auditData && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <span className="text-blue-600 font-medium">📅 当前查看周期: </span>
              <span className="text-blue-800 font-bold ml-2">
                {formatPeriodDisplay(auditData.period)}
              </span>
              <span className="text-blue-600 ml-4">
                共 {auditData.totalRecords} 条支出记录
              </span>
            </div>
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">正在加载数据...</span>
          </div>
        )}

        {/* 错误状态 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="text-red-800">
              ❌ 加载失败: {error}
            </div>
            <button
              onClick={() => loadAuditData(selectedPeriod)}
              className="mt-2 text-red-600 hover:text-red-800 font-medium"
            >
              点击重试
            </button>
          </div>
        )}

        {/* 主要内容 */}
        {!loading && !error && auditData && (
          <div className="space-y-6">
            {/* 财务概览 */}
            <FinanceAuditSummary
              summary={auditData.summary}
              periodRange={auditData.periodRange}
            />

            {/* 个人支出统计 */}
            <ExpenseByHandlerTable
              expensesByHandler={auditData.expensesByHandler}
              onViewDetails={handleViewDetails}
            />
          </div>
        )}

        {/* 支出明细弹窗 */}
        <ExpenseDetailModal
          isOpen={modalOpen}
          onClose={handleCloseModal}
          handlerData={selectedHandler}
        />
      </div>
    </Shell>
  );
}