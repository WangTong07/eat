// 自动执行固定支出的工具函数
export async function autoExecuteRecurringExpenses(currentCycle: string, onSuccess?: () => void) {
  try {
    console.log(`[自动固定支出] 开始检查周期: ${currentCycle}`);
    
    const response = await fetch(`/api/recurring-expenses?action=check_and_execute&cycle=${currentCycle}`);
    const data = await response.json();
    
    console.log(`[自动固定支出] API响应:`, data);
    
    if (data.success) {
      const addedCount = data.results?.filter((r: any) => r.status === 'added').length || 0;
      const existingCount = data.results?.filter((r: any) => r.status === 'already_exists').length || 0;
      
      console.log(`[自动固定支出] 本周期新增: ${addedCount} 项，已存在: ${existingCount} 项`);
      
      // 无论是否有新增，都触发回调以确保界面更新
      if (onSuccess) {
        // 稍微延迟执行，确保数据库操作完成
        setTimeout(() => {
          console.log(`[自动固定支出] 触发成功回调`);
          onSuccess();
        }, 200);
      }
      
      return { success: true, addedCount, existingCount, results: data.results };
    } else {
      console.error(`[自动固定支出] API返回失败:`, data.error);
      return { success: false, error: data.error };
    }
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