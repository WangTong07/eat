import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

// 计算21号周期
function getCycleRange(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(v => parseInt(v));
  
  // 当前周期：上月21号 - 本月20号
  const startDate = new Date(year, month - 2, 21);
  const endDate = new Date(year, month - 1, 20);
  
  return {
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    year,
    month
  };
}

// 计算ISO周编号
function isoWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return date.getUTCFullYear() * 100 + week;
}

// 获取固定支出配置
export async function GET(req: NextRequest) {
  try {
    const supabase = getClient();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    
    if (action === 'check_and_execute') {
      // 检查并执行固定支出
      const yearMonth = searchParams.get('cycle') || new Date().toISOString().slice(0, 7);
      const { year, month, startDate } = getCycleRange(yearMonth);
      
      // 获取所有活跃的固定支出配置
      const { data: recurringExpenses, error: recurringError } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('is_active', true);
      
      if (recurringError) throw recurringError;
      
      const results = [];
      
      for (const recurring of recurringExpenses || []) {
        // 检查这个周期是否已经执行过
        const { data: execution, error: executionError } = await supabase
          .from('recurring_expense_executions')
          .select('*')
          .eq('recurring_expense_id', recurring.id)
          .eq('cycle_year', year)
          .eq('cycle_month', month)
          .maybeSingle();
        
        if (executionError && executionError.code !== 'PGRST116') {
          console.error('检查执行记录失败:', executionError);
          continue;
        }
        
        if (!execution) {
          // 还没有执行过，创建支出记录
          const expenseDate = startDate; // 在周期开始日期添加
          const weekNumber = isoWeekNumber(new Date(expenseDate));
          
          // 创建支出记录
          const { data: expense, error: expenseError } = await supabase
            .from('expenses')
            .insert({
              date: expenseDate,
              item_description: `${recurring.name} (自动添加)`,
              amount: recurring.amount,
              user_name: '系统自动',
              is_recurring: true,
              recurring_expense_id: recurring.id
            })
            .select()
            .single();
          
          if (expenseError) {
            console.error('创建支出记录失败:', expenseError);
            results.push({
              recurring_id: recurring.id,
              name: recurring.name,
              status: 'error',
              error: expenseError.message
            });
            continue;
          }
          
          // 记录执行状态
          const { error: executionInsertError } = await supabase
            .from('recurring_expense_executions')
            .insert({
              recurring_expense_id: recurring.id,
              cycle_year: year,
              cycle_month: month,
              expense_id: expense.id
            });
          
          if (executionInsertError) {
            console.error('记录执行状态失败:', executionInsertError);
          }
          
          results.push({
            recurring_id: recurring.id,
            name: recurring.name,
            amount: recurring.amount,
            status: 'added',
            expense_id: expense.id,
            date: expenseDate
          });
        } else {
          results.push({
            recurring_id: recurring.id,
            name: recurring.name,
            status: 'already_exists',
            expense_id: execution.expense_id
          });
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        cycle: { year, month, startDate },
        results 
      });
    }
    
    // 默认：获取所有固定支出配置
    const { data, error } = await supabase
      .from('recurring_expenses')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return NextResponse.json({ items: data || [] });
  } catch (error: any) {
    console.error('固定支出API错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 创建或更新固定支出配置
export async function POST(req: NextRequest) {
  try {
    const supabase = getClient();
    const body = await req.json();
    
    const { id, name, amount, description, is_active } = body;
    
    if (!name || !amount) {
      return NextResponse.json({ error: '名称和金额不能为空' }, { status: 400 });
    }
    
    if (id) {
      // 更新现有配置
      const { data, error } = await supabase
        .from('recurring_expenses')
        .update({
          name,
          amount: parseFloat(amount),
          description: description || null,
          is_active: is_active !== undefined ? is_active : true
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      return NextResponse.json({ success: true, data });
    } else {
      // 创建新配置
      const { data, error } = await supabase
        .from('recurring_expenses')
        .insert({
          name,
          amount: parseFloat(amount),
          description: description || null,
          cycle_type: '21day_cycle',
          is_active: is_active !== undefined ? is_active : true
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return NextResponse.json({ success: true, data });
    }
  } catch (error: any) {
    console.error('创建/更新固定支出失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 删除固定支出配置
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'ID不能为空' }, { status: 400 });
    }
    
    const { error } = await supabase
      .from('recurring_expenses')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('删除固定支出失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}