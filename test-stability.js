const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://sirxaxuvtvtpeozqjzur.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcnhheHV2dHZ0cGVvenFqenVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NzQ3OTksImV4cCI6MjA2ODI1MDc5OX0.6-rO17rkd27J_uqHCT2uhmzgH0LoJv6rcri-vvEhvpM'
);

async function testStability() {
  console.log('🧪 测试系统稳定性...\n');
  
  // 1. 检查各月份数据完整性
  console.log('=== 数据完整性检查 ===');
  for (let month = 8; month <= 12; month++) {
    const { data, error } = await supabase
      .from('duty_staff_assignments')
      .select('member_id')
      .eq('year', 2025)
      .eq('month', month);
    
    if (error) {
      console.error(`❌ ${month}月查询失败:`, error.message);
    } else {
      const count = data?.length || 0;
      const status = count === 8 ? '✅' : '❌';
      console.log(`${status} 2025年${month}月: ${count}/8 个成员`);
    }
  }
  
  // 2. 检查2026年1月数据
  console.log('\n=== 自动延续检查 ===');
  const { data: jan2026, error: jan2026Error } = await supabase
    .from('duty_staff_assignments')
    .select('member_id')
    .eq('year', 2026)
    .eq('month', 1);
  
  if (jan2026Error) {
    console.error('❌ 2026年1月查询失败:', jan2026Error.message);
  } else {
    const count = jan2026?.length || 0;
    const status = count === 8 ? '✅' : '❌';
    console.log(`${status} 2026年1月: ${count}/8 个成员 (自动延续)`);
  }
  
  // 3. 模拟修改操作测试
  console.log('\n=== 修改操作稳定性测试 ===');
  
  // 获取一个测试成员
  const { data: members } = await supabase
    .from('household_members')
    .select('id, name')
    .limit(1);
  
  if (members && members.length > 0) {
    const testMember = members[0];
    console.log(`🧪 使用测试成员: ${testMember.name}`);
    
    try {
      // 模拟修改：先删除再插入
      console.log('1. 删除现有记录...');
      await supabase
        .from('duty_staff_assignments')
        .delete()
        .eq('member_id', testMember.id)
        .eq('year', 2025)
        .eq('month', 9);
      
      // 等待一下，模拟实际操作间隔
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('2. 插入新记录...');
      await supabase
        .from('duty_staff_assignments')
        .insert({
          member_id: testMember.id,
          year: 2025,
          month: 9,
          week_in_month: 2
        });
      
      console.log('✅ 修改操作测试成功');
      
      // 验证数据是否正确
      const { data: verifyData } = await supabase
        .from('duty_staff_assignments')
        .select('week_in_month')
        .eq('member_id', testMember.id)
        .eq('year', 2025)
        .eq('month', 9);
      
      if (verifyData && verifyData.length > 0) {
        console.log(`✅ 数据验证成功: ${testMember.name} 分配到第${verifyData[0].week_in_month}周`);
      } else {
        console.log('❌ 数据验证失败: 记录未找到');
      }
      
    } catch (error) {
      console.error('❌ 修改操作测试失败:', error.message);
    }
  }
  
  console.log('\n🎉 稳定性测试完成！');
}

testStability().catch(console.error);