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

interface ExpenseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  handlerData: ExpenseByHandler | null;
}

export default function ExpenseDetailModal({ isOpen, onClose, handlerData }: ExpenseDetailModalProps) {
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  if (!isOpen || !handlerData) return null;

  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const handleAttachmentClick = (url: string) => {
    setViewerSrc(url);
  };

  const closeViewer = () => {
    setViewerSrc(null);
  };

  return (
    <>
      {/* 主弹窗 */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* 弹窗头部 */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">
                📋 {handlerData.handlerName} 的支出明细
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center"
              >
                ×
              </button>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              共 {handlerData.expenseCount} 笔支出，合计 {formatCurrency(handlerData.totalAmount)}
            </div>
          </div>

          {/* 弹窗内容 */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="space-y-4">
              {handlerData.expenses.map((expense, index) => (
                <div key={expense.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium mr-3">
                          #{index + 1}
                        </span>
                        <span className="text-gray-600 text-sm">
                          {formatDate(expense.date)}
                        </span>
                      </div>
                      <div className="text-gray-800 font-medium mb-2">
                        {expense.description || '无描述'}
                      </div>
                      {expense.attachments && expense.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {expense.attachments.map((attachment, i) => (
                            <button
                              key={i}
                              onClick={() => handleAttachmentClick(attachment.url)}
                              className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs hover:bg-green-200 transition-colors"
                            >
                              📎 {attachment.name || `附件${i + 1}`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-bold text-red-600">
                        {formatCurrency(expense.amount)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 统计总结 */}
            <div className="mt-6 pt-4 border-t border-gray-200 bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-gray-600 text-sm">支出笔数</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {handlerData.expenseCount}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 text-sm">支出总额</div>
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(handlerData.totalAmount)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 图片查看器 */}
      {viewerSrc && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-60 p-4"
          onClick={closeViewer}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <button
              onClick={closeViewer}
              className="absolute top-4 right-4 text-white bg-black/50 rounded-full w-12 h-12 flex items-center justify-center text-2xl font-bold hover:bg-black/70 transition-all duration-200 z-10"
            >
              ×
            </button>
            <img
              src={viewerSrc}
              alt="支出附件"
              className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl"
              onError={() => {
                alert('图片加载失败');
                closeViewer();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}