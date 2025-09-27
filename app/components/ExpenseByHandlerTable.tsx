"use client";
import { useState } from "react";

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

interface ExpenseByHandlerTableProps {
  expensesByHandler: ExpenseByHandler[];
  onViewDetails: (handler: ExpenseByHandler) => void;
}

export default function ExpenseByHandlerTable({ expensesByHandler, onViewDetails }: ExpenseByHandlerTableProps) {
  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const totalExpense = expensesByHandler.reduce((sum, handler) => sum + handler.totalAmount, 0);

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center">
          👥 个人支出统计
        </h2>
        <div className="text-sm text-gray-500">
          共 {expensesByHandler.length} 位经手人
        </div>
      </div>

      {expensesByHandler.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">📝</div>
          <div className="text-gray-500">暂无支出记录</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">经手人</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">支出笔数</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">支出金额</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {expensesByHandler.map((handler, index) => (
                <tr key={handler.handlerName} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-3 ${
                        index === 0 ? 'bg-yellow-400' :
                        index === 1 ? 'bg-gray-400' :
                        index === 2 ? 'bg-amber-600' : 'bg-blue-400'
                      }`}></div>
                      <span className="font-medium text-gray-800">{handler.handlerName}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                      {handler.expenseCount} 笔
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="font-bold text-lg text-gray-800">
                      {formatCurrency(handler.totalAmount)}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <button
                      onClick={() => onViewDetails(handler)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      查看明细
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td className="py-4 px-4 font-bold text-gray-800">总计</td>
                <td className="py-4 px-4 text-center font-bold text-gray-800">
                  {expensesByHandler.reduce((sum, handler) => sum + handler.expenseCount, 0)} 笔
                </td>
                <td className="py-4 px-4 text-right font-bold text-lg text-gray-800">
                  {formatCurrency(totalExpense)}
                </td>
                <td className="py-4 px-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}