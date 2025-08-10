import { getSupabaseClient } from './supabaseClient';

/**
 * 数据获取工具 - 确保获取最新数据，避免缓存问题
 */

// 通用查询选项 - 禁用缓存
export const FRESH_DATA_OPTIONS = {
  cache: 'no-store' as const,
  next: { revalidate: 0 }
};

/**
 * 获取最新费用记录
 */
export async function getFreshExpenses() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('获取费用记录失败:', error);
    throw error;
  }
  
  return data || [];
}

/**
 * 获取最新家庭成员
 */
export async function getFreshHouseholdMembers() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('household_members')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('获取家庭成员失败:', error);
    throw error;
  }
  
  return data || [];
}

/**
 * 获取最新成员付款记录
 */
export async function getFreshMemberPayments() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('member_payments')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('获取付款记录失败:', error);
    throw error;
  }
  
  return data || [];
}

/**
 * 获取最新周计划
 */
export async function getFreshWeeklyPlans() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('weekly_plans')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('获取周计划失败:', error);
    throw error;
  }
  
  return data || [];
}

/**
 * 获取最新菜单愿望
 */
export async function getFreshMenuWishes() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('menu_wishes')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('获取菜单愿望失败:', error);
    throw error;
  }
  
  return data || [];
}

/**
 * 获取最新排班安排
 */
export async function getFreshDutyStaffAssignments() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('duty_staff_assignments')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('获取排班安排失败:', error);
    throw error;
  }
  
  return data || [];
}

/**
 * 清理本地存储中的过期数据
 * 避免本地兜底数据与云端不一致
 */
export function clearLocalFallbackData() {
  if (typeof window !== 'undefined') {
    // 清理可能的本地缓存键
    const keysToRemove = [
      'expenses_fallback',
      'members_fallback', 
      'payments_fallback',
      'plans_fallback',
      'wishes_fallback',
      'duty_fallback'
    ];
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log('[DataUtils] 已清理本地兜底数据');
  }
}

/**
 * 数据同步状态检查
 */
export async function checkDataSyncStatus() {
  try {
    const supabase = getSupabaseClient();
    
    // 简单的连接测试
    const { data, error } = await supabase
      .from('app_settings')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('[DataUtils] 数据库连接失败:', error);
      return false;
    }
    
    console.log('[DataUtils] 数据库连接正常');
    return true;
  } catch (err) {
    console.error('[DataUtils] 同步状态检查失败:', err);
    return false;
  }
}