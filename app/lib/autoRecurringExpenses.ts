// 自动执行固定支出的工具函数
export async function autoExecuteRecurringExpenses(currentCycle: string, onSuccess?: () => void) {
  try {
    const response = await fetch(`/api/recurring-expenses?action=check_and_execute&cycle=${currentCycle}`);
    const data = await response.json();
    
    if (data.success) {
      const addedCount = data.results?.filter((r: any) => r.status === 'added').length || 0;
      if (addedCount > 0) {
        console.log(`[自动固定支出] 本周期新增 ${addedCount} 项固定支出`);
        
        // 如果有新增的固定支出，触发回调通知组件更新
        if (onSuccess) {
          // 延迟一点执行，确保数据库操作完成
          setTimeout(() => {
            onSuccess();
          }, 100);
        }
        
        return { success: true, addedCount, results: data.results };
      }
    }
    
    return { success: true, addedCount: 0, results: data.results || [] };
  } catch (error) {
    console.error('[自动固定支出] 执行失败:', error);
    return { success: false, error };
  }
}

// 获取当前21号周期标识符
export function getCurrentCycle(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  
  // 如果当前日期在21号及以后，使用当前月份
  // 如果在20号及以前，使用上个月份
  if (day >= 21) {
    return `${year}-${String(month).padStart(2, '0')}`;
  } else {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  }
}