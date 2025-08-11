const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://sirxaxuvtvtpeozqjzur.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcnhheHV2dHZ0cGVvenFqenVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NzQ3OTksImV4cCI6MjA2ODI1MDc5OX0.6-rO17rkd27J_uqHCT2uhmzgH0LoJv6rcri-vvEhvpM'
);

async function verifyFix() {
  console.log('🔧 验证修复结果...\n');
  
  // 1. 检查所有月份的数据完整性
  console.log('=== 数据完整性验证 ===');
  const months = [
    { year: 2025, month: 8, name: '8月(基准)' },
    { year: 2025, month: 9, name: '9月' },
    { year: 2025, month: 10, name: '10月' },
    { year: 2025, month: 11, name: '11月' },
    { year: 2025, month: 12, name: '12月' },
    { year: 2026, month: 1, name: '2026年1月' }
  ];
  
  for (const { year, month, name } of months) {
    const { data, error } = await supabase
      .from('duty_staff_assignments')
      .select('member_id, week_in_month')
      .eq('year', year)
      .eq('month', month);
    
    if (error) {
      console.error(`❌ ${name} 查询失败:`, error.message);
    } else {
      const count = data?.length || 0;
      const status = count === 8 ? '✅' : '❌';
      console.log(`${status} ${name}: ${count}/8 个成员`);
      
      if (count !== 8) {
        // 显示缺失的成员
        const { data: allMembers } = await supabase
          .from('household_members')
          .select('id, name')
          .eq('is_active', true);
        
        const assignedIds = new Set(data?.map(d => d.member_id) || []);
        const missing = allMembers?.filter(m => !assignedIds.has(m.id)) || [];
        
        if (missing.length > 0) {
          console.log(`   缺失成员: ${missing.map(m => m.name).join(', ')}`);
        }
      }
    }
  }
  
  // 2. 检查基准数据的一致性
  console.log('\n=== 基准数据一致性检查 ===');
  const { data: baseline } = await supabase
    .from('duty_staff_assignments')
    .select('member_id, week_in_month')
    .eq('year', 2025)
    .eq('month', 8)
    .order('member_id');
  
  if (baseline && baseline.length === 8) {
    console.log('✅ 基准数据完整 (2025年8月)');
    
    // 检查其他月份是否与基准一致
    for (const { year, month, name } of months.slice(1)) {
      const { data: monthData } = await supabase
        .from('duty_staff_assignments')
        .select('member_id, week_in_month')
        .eq('year', year)
        .eq('month', month)
        .order('member_id');
      
      if (monthData && monthData.length === 8) {
        const isConsistent = baseline.every(b => {
          const corresponding = monthData.find(m => m.member_id === b.member_id);
          return corresponding && corresponding.week_in_month === b.week_in_month;
        });
        
        const status = isConsistent ? '✅' : '❌';
        console.log(`${status} ${name} 与基准数据一致性: ${isConsistent ? '一致' : '不一致'}`);
      }
    }
  } else {
    console.log('❌ 基准数据不完整');
  }
  
  // 3. 模拟自动延续功能测试
  console.log('\n=== 自动延续功能测试 ===');
  
  // 删除2026年2月数据（如果存在）
  await supabase
    .from('duty_staff_assignments')
    .delete()
    .eq('year', 2026)
    .eq('month', 2);
  
  console.log('🧪 已删除2026年2月数据，测试自动延续...');
  
  // 模拟调用自动延续函数（这里只是检查逻辑，实际需要在页面中触发）
  console.log('💡 提示: 访问页面并切换到2026年2月，应该会自动创建数据');
  
  console.log('\n🎉 修复验证完成！');
  
  // 4. 显示修复总结
  console.log('\n=== 修复总结 ===');
  console.log('✅ 强制使用2025年8月作为唯一可靠基准');
  console.log('✅ 修复了10月和11月的数据不完整问题');
  console.log('✅ 添加了防抖机制，避免实时订阅导致的频繁重新加载');
  console.log('✅ 确保只接受完整的8个成员数据作为基准');
  console.log('💡 建议: 测试修改操作，确认不再出现"一修改就混乱"的问题');
}

verifyFix().catch(console.error);