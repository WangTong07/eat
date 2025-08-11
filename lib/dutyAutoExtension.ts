import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * 智能自动延续值班安排到指定月份 - 包含用户最新修改
 * @param targetYear 目标年份
 * @param targetMonth 目标月份
 * @returns 是否成功创建
 */
export async function ensureDutyAssignmentsExist(targetYear: number, targetMonth: number): Promise<boolean> {
  try {
    console.log(`🎯 智能延续: 确保 ${targetYear}年${targetMonth}月 值班数据存在...`);
    
    // 1. 检查目标月份是否已有数据
    const { data: existingData, error: checkError } = await supabase
      .from('duty_staff_assignments')
      .select('member_id, week_in_month')
      .eq('year', targetYear)
      .eq('month', targetMonth);

    if (checkError) {
      console.error('❌ 检查现有数据失败:', checkError);
      return false;
    }

    // 2. 如果已有数据，评估数据质量
    if (existingData && existingData.length > 0) {
      const quality = evaluateDataQuality(existingData, targetYear, targetMonth);
      
      if (quality.isGood || quality.isExcellent) {
        console.log(`✅ ${targetYear}年${targetMonth}月已有优质数据 (${existingData.length}个成员，质量评分: ${quality.score})`);
        return true;
      } else if (quality.isAcceptable) {
        console.log(`⚠️ ${targetYear}年${targetMonth}月数据质量一般 (${existingData.length}个成员，质量评分: ${quality.score})，保持现状`);
        return true;
      } else {
        console.log(`🔄 ${targetYear}年${targetMonth}月数据质量较差 (${existingData.length}个成员，质量评分: ${quality.score})，尝试重新生成...`);
        
        // 删除低质量数据，重新生成
        const { error: deleteError } = await supabase
          .from('duty_staff_assignments')
          .delete()
          .eq('year', targetYear)
          .eq('month', targetMonth);
          
        if (deleteError) {
          console.error('❌ 删除低质量数据失败:', deleteError);
          return false;
        }
        
        console.log(`🗑️ 已删除 ${targetYear}年${targetMonth}月 的低质量数据，准备重新生成...`);
      }
    }

    // 3. 智能寻找最佳基准数据（包含用户最新修改）
    const baselineData = await findLatestBaselineData(targetYear, targetMonth);
    if (!baselineData || baselineData.length === 0) {
      console.error('❌ 未找到有效的基准数据');
      return false;
    }

    // 4. 智能复制基准数据到目标月份
    const newAssignments = baselineData.map(assignment => ({
      member_id: assignment.member_id,
      year: targetYear,
      month: targetMonth,
      week_in_month: assignment.week_in_month
    }));

    // 5. 原子性插入新数据
    const { error: insertError } = await supabase
      .from('duty_staff_assignments')
      .insert(newAssignments);

    if (insertError) {
      console.error('❌ 插入新数据失败:', insertError);
      
      // 如果是唯一约束冲突，可能是并发操作导致的，检查是否已经有数据了
      if (insertError.code === '23505') {
        console.log('🔄 检测到并发操作，重新检查数据状态...');
        const { data: recheckData } = await supabase
          .from('duty_staff_assignments')
          .select('member_id')
          .eq('year', targetYear)
          .eq('month', targetMonth);
          
        if (recheckData && recheckData.length > 0) {
          console.log(`✅ 并发操作已完成，${targetYear}年${targetMonth}月现有${recheckData.length}条数据`);
          return true;
        }
      }
      
      return false;
    }

    console.log(`🎉 成功为 ${targetYear}年${targetMonth}月 创建 ${newAssignments.length} 条值班数据（包含用户最新修改）`);
    
    // 6. 验证创建结果
    const { data: verifyData } = await supabase
      .from('duty_staff_assignments')
      .select('member_id')
      .eq('year', targetYear)
      .eq('month', targetMonth);
      
    const actualCount = verifyData?.length || 0;
    const expectedCount = newAssignments.length;
    
    if (actualCount === expectedCount) {
      console.log(`✅ 数据验证成功: ${actualCount}/${expectedCount} 条记录`);
      return true;
    } else {
      console.warn(`⚠️ 数据验证异常: 期望${expectedCount}条，实际${actualCount}条`);
      return actualCount > 0; // 只要有数据就算成功
    }

  } catch (error) {
    console.error('❌ 智能自动延续失败:', error);
    return false;
  }
}

/**
 * 智能基准选择 - 优先使用最近的完整数据，包含用户最新修改
 */
async function findLatestBaselineData(targetYear: number, targetMonth: number) {
  console.log(`🔍 为 ${targetYear}年${targetMonth}月 智能寻找最佳基准数据...`);
  
  // 🎯 智能基准选择策略：优先使用最近的完整数据
  const searchMonths = [];
  
  // 1. 按时间倒序生成搜索列表（最近6个月）
  let searchYear = targetYear;
  let searchMonth = targetMonth - 1;
  
  for (let i = 0; i < 6; i++) {
    if (searchMonth < 1) {
      searchMonth = 12;
      searchYear--;
    }
    
    // 不搜索未来的月份
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    if (searchYear < currentYear || (searchYear === currentYear && searchMonth <= currentMonth)) {
      searchMonths.push({ year: searchYear, month: searchMonth });
    }
    
    searchMonth--;
  }
  
  console.log(`📋 搜索顺序: ${searchMonths.map(m => `${m.year}年${m.month}月`).join(' → ')}`);
  
  // 2. 按优先级搜索最佳基准数据
  for (const { year, month } of searchMonths) {
    const { data, error } = await supabase
      .from('duty_staff_assignments')
      .select('member_id, week_in_month')
      .eq('year', year)
      .eq('month', month);

    if (error) {
      console.log(`⚠️ ${year}年${month}月 查询失败:`, error.message);
      continue;
    }

    // 3. 数据质量评估
    const quality = evaluateDataQuality(data, year, month);
    
    if (quality.isExcellent) {
      console.log(`✅ 找到优质基准: ${year}年${month}月 (${data.length}个成员，质量评分: ${quality.score})`);
      return data;
    } else if (quality.isGood) {
      console.log(`✅ 找到良好基准: ${year}年${month}月 (${data.length}个成员，质量评分: ${quality.score})`);
      return data;
    } else if (quality.isAcceptable) {
      console.log(`⚠️ 发现可用基准: ${year}年${month}月 (${data.length}个成员，质量评分: ${quality.score})`);
      // 继续寻找更好的，但记录这个作为备选
      if (!searchMonths.find(m => m.year === 2025 && m.month === 8)) {
        // 如果还没搜索到2025年8月，继续寻找
        continue;
      } else {
        // 如果已经搜索过2025年8月但质量不佳，使用当前可用的
        return data;
      }
    } else {
      console.log(`❌ 跳过低质量数据: ${year}年${month}月 (${data.length}个成员，质量评分: ${quality.score})`);
    }
  }

  // 4. 如果都没找到，尝试使用2025年8月作为最后的安全基准
  console.log(`🔄 尝试使用安全基准: 2025年8月...`);
  const { data: fallbackData, error: fallbackError } = await supabase
    .from('duty_staff_assignments')
    .select('member_id, week_in_month')
    .eq('year', 2025)
    .eq('month', 8);

  if (!fallbackError && fallbackData && fallbackData.length > 0) {
    console.log(`🛡️ 使用安全基准: 2025年8月 (${fallbackData.length}个成员)`);
    return fallbackData;
  }

  console.error('❌ 未找到任何可用的基准数据');
  return null;
}

/**
 * 数据质量评估函数
 */
function evaluateDataQuality(data: any[], year: number, month: number) {
  if (!data || data.length === 0) {
    return { isExcellent: false, isGood: false, isAcceptable: false, score: 0 };
  }

  let score = 0;
  
  // 1. 成员数量评分 (40分)
  if (data.length >= 8) {
    score += 40; // 完整的8个成员
  } else if (data.length >= 6) {
    score += 30; // 至少6个成员
  } else if (data.length >= 4) {
    score += 20; // 至少4个成员
  } else {
    score += 10; // 少于4个成员
  }
  
  // 2. 数据完整性评分 (30分)
  const validAssignments = data.filter(item => 
    item.member_id && 
    (item.week_in_month === null || (item.week_in_month >= 1 && item.week_in_month <= 6))
  );
  
  if (validAssignments.length === data.length) {
    score += 30; // 所有数据都有效
  } else if (validAssignments.length >= data.length * 0.8) {
    score += 20; // 80%以上数据有效
  } else {
    score += 10; // 数据有问题
  }
  
  // 3. 时间新近性评分 (20分)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  const monthsAgo = (currentYear - year) * 12 + (currentMonth - month);
  
  if (monthsAgo <= 1) {
    score += 20; // 最近1个月
  } else if (monthsAgo <= 3) {
    score += 15; // 最近3个月
  } else if (monthsAgo <= 6) {
    score += 10; // 最近6个月
  } else {
    score += 5; // 超过6个月
  }
  
  // 4. 特殊加分 (10分)
  if (year === 2025 && month === 8) {
    score += 10; // 原始基准数据加分
  }
  
  return {
    isExcellent: score >= 90, // 90分以上为优质
    isGood: score >= 70,      // 70分以上为良好
    isAcceptable: score >= 50, // 50分以上为可接受
    score: score
  };
}

/**
 * 批量确保多个月份的值班安排存在
 */
export async function ensureMultipleMonthsExist(startYear: number, startMonth: number, monthCount: number): Promise<void> {
  let currentYear = startYear;
  let currentMonth = startMonth;

  for (let i = 0; i < monthCount; i++) {
    await ensureDutyAssignmentsExist(currentYear, currentMonth);
    
    // 计算下个月
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }
}

/**
 * 在页面加载时自动确保当前月份和未来几个月的数据存在
 * 包含数据完整性检查和错误恢复
 */
export async function autoEnsureCurrentAndFutureMonths(): Promise<void> {
  console.log('🚀 启动智能自动延续系统...');
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  try {
    // 1. 首先检查和修复基准数据（2025年8月）
    await ensureBaselineDataIntegrity();
    
    // 2. 确保当前月份和未来5个月的数据存在
    console.log(`📅 确保 ${currentYear}年${currentMonth}月 及未来5个月的数据完整性...`);
    await ensureMultipleMonthsExist(currentYear, currentMonth, 6);
    
    // 3. 数据完整性验证
    await validateDataIntegrity(currentYear, currentMonth, 6);
    
    console.log('✅ 智能自动延续系统启动完成');
    
  } catch (error) {
    console.error('❌ 智能自动延续系统启动失败:', error);
    
    // 错误恢复：至少确保当前月份有数据
    try {
      console.log('🔄 尝试错误恢复...');
      await ensureDutyAssignmentsExist(currentYear, currentMonth);
    } catch (recoveryError) {
      console.error('❌ 错误恢复也失败了:', recoveryError);
    }
  }
}

/**
 * 确保基准数据完整性（2025年8月）
 */
async function ensureBaselineDataIntegrity(): Promise<void> {
  console.log('🔍 检查基准数据完整性 (2025年8月)...');
  
  const { data: baselineData, error } = await supabase
    .from('duty_staff_assignments')
    .select('member_id, week_in_month')
    .eq('year', 2025)
    .eq('month', 8);

  if (error) {
    console.error('❌ 基准数据查询失败:', error);
    return;
  }

  const quality = evaluateDataQuality(baselineData, 2025, 8);
  
  if (quality.isExcellent || quality.isGood) {
    console.log(`✅ 基准数据质量良好 (${baselineData?.length || 0}个成员，质量评分: ${quality.score})`);
  } else if (quality.isAcceptable) {
    console.log(`⚠️ 基准数据质量一般 (${baselineData?.length || 0}个成员，质量评分: ${quality.score})`);
  } else {
    console.log(`🚨 基准数据质量较差 (${baselineData?.length || 0}个成员，质量评分: ${quality.score})`);
    console.log('💡 建议检查2025年8月的值班安排数据');
  }
}

/**
 * 数据完整性验证
 */
async function validateDataIntegrity(startYear: number, startMonth: number, monthCount: number): Promise<void> {
  console.log('🔍 执行数据完整性验证...');
  
  let currentYear = startYear;
  let currentMonth = startMonth;
  let totalIssues = 0;

  for (let i = 0; i < monthCount; i++) {
    const { data, error } = await supabase
      .from('duty_staff_assignments')
      .select('member_id, week_in_month')
      .eq('year', currentYear)
      .eq('month', currentMonth);

    if (error) {
      console.error(`❌ ${currentYear}年${currentMonth}月 数据查询失败:`, error);
      totalIssues++;
    } else {
      const quality = evaluateDataQuality(data, currentYear, currentMonth);
      
      if (quality.isExcellent) {
        console.log(`✅ ${currentYear}年${currentMonth}月: 优质 (${data?.length || 0}个成员)`);
      } else if (quality.isGood) {
        console.log(`✅ ${currentYear}年${currentMonth}月: 良好 (${data?.length || 0}个成员)`);
      } else if (quality.isAcceptable) {
        console.log(`⚠️ ${currentYear}年${currentMonth}月: 可接受 (${data?.length || 0}个成员)`);
      } else {
        console.log(`❌ ${currentYear}年${currentMonth}月: 质量较差 (${data?.length || 0}个成员)`);
        totalIssues++;
      }
    }
    
    // 计算下个月
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }
  
  if (totalIssues === 0) {
    console.log('🎉 数据完整性验证通过，所有月份数据质量良好');
  } else {
    console.log(`⚠️ 发现 ${totalIssues} 个月份存在数据质量问题`);
  }
}

/**
 * 智能数据修复 - 修复指定月份的数据问题
 */
export async function repairMonthData(year: number, month: number): Promise<boolean> {
  console.log(`🔧 开始修复 ${year}年${month}月 的数据...`);
  
  try {
    // 1. 删除现有的问题数据
    const { error: deleteError } = await supabase
      .from('duty_staff_assignments')
      .delete()
      .eq('year', year)
      .eq('month', month);
      
    if (deleteError) {
      console.error('❌ 删除问题数据失败:', deleteError);
      return false;
    }
    
    // 2. 重新生成数据
    const success = await ensureDutyAssignmentsExist(year, month);
    
    if (success) {
      console.log(`✅ ${year}年${month}月 数据修复成功`);
    } else {
      console.log(`❌ ${year}年${month}月 数据修复失败`);
    }
    
    return success;
    
  } catch (error) {
    console.error(`❌ 修复 ${year}年${month}月 数据时发生错误:`, error);
    return false;
  }
}
