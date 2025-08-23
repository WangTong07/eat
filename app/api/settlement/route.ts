import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";

// 计算21号周期的开始和结束日期
function getCycleRange(year: number, month: number) {
  const startDate = new Date(year, month - 1, 21); // 本月21号
  const endDate = new Date(year, month, 20);       // 次月20号
  
  return {
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10)
  };
}

// 获取结算预览
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') || `${new Date().getFullYear()}`);
    const month = parseInt(url.searchParams.get('month') || `${new Date().getMonth() + 1}`);
    
    // 获取结算预览数据
    const settlement = await calculateSettlement(year, month);
    
    return NextResponse.json({
      success: true,
      settlement
    });
  } catch (error: any) {
    console.error('获取结算预览失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '获取结算预览失败'
    }, { status: 500 });
  }
}

// 执行结算
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, month } = body;
    
    if (!year || !month) {
      return NextResponse.json({
        success: false,
        message: '缺少必要参数'
      }, { status: 400 });
    }
    
    // 计算结算数据
    const settlement = await calculateSettlement(year, month);
    
    // 如果没有可结算的金额或没有符合条件的成员，返回错误
    if (settlement.remaining <= 0) {
      return NextResponse.json({
        success: false,
        message: '当前没有结余可分配'
      }, { status: 400 });
    }
    
    if (settlement.memberCount === 0) {
      return NextResponse.json({
        success: false,
        message: '没有符合条件的成员（整月缴费且已缴费）'
      }, { status: 400 });
    }
    
    // 执行结算操作
    const supabase = getSupabaseClient();
    const settlementDate = new Date().toISOString();
    
    // 更新所有符合条件的成员记录
    const { error } = await supabase
      .from('member_payments')
      .update({
        settlement_amount: settlement.settlementAmount,
        settlement_date: settlementDate,
        is_settled: true
      })
      .eq('year', year)
      .eq('month', month)
      .eq('paid', true)
      .eq('coverage', 'month');
    
    if (error) {
      throw new Error(`结算更新失败: ${error.message}`);
    }
    
    return NextResponse.json({
      success: true,
      settlement: {
        ...settlement,
        settlementDate
      }
    });
  } catch (error: any) {
    console.error('执行结算失败:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '执行结算失败'
    }, { status: 500 });
  }
}

// 计算结算数据
async function calculateSettlement(year: number, month: number) {
  const supabase = getSupabaseClient();
  
  // 获取当前周期的支出数据
  const { startDate, endDate } = getCycleRange(year, month);
  
  // 获取支出总额
  const { data: expensesData, error: expensesError } = await supabase
    .from('expenses')
    .select('amount')
    .gte('date', startDate)
    .lte('date', endDate);
  
  if (expensesError) {
    throw new Error(`获取支出数据失败: ${expensesError.message}`);
  }
  
  const totalExpenses = expensesData.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  
  // 获取符合条件的成员（整月缴费且已缴费）
  const { data: membersData, error: membersError } = await supabase
    .from('member_payments')
    .select('amount')
    .eq('year', year)
    .eq('month', month)
    .eq('paid', true)
    .eq('coverage', 'month');
  
  if (membersError) {
    throw new Error(`获取成员缴费数据失败: ${membersError.message}`);
  }
  
  const memberCount = membersData.length;
  const budget = membersData.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const remaining = budget - totalExpenses;
  const settlementAmount = memberCount > 0 ? remaining / memberCount : 0;
  
  return {
    year,
    month,
    budget,
    totalExpenses,
    remaining,
    memberCount,
    settlementAmount
  };
}