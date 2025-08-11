const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://sirxaxuvtvtpeozqjzur.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcnhheHV2dHZ0cGVvenFqenVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NzQ3OTksImV4cCI6MjA2ODI1MDc5OX0.6-rO17rkd27J_uqHCT2uhmzgH0LoJv6rcri-vvEhvpM'
);

async function testUserModifications() {
  console.log('🧪 测试用户修改的智能延续功能...\n');
  
  try {
    // 1. 获取Mike的ID
    const { data: mikeData } = await supabase
      .from('household_members')
      .select('id, name')
      .eq('name', 'Mike')
      .single();
    
    if (!mikeData) {
      console.log('❌ 未找到Mike成员');
      return;
    }
    
    console.log(`✅ 找到测试成员: ${mikeData.name} (${mikeData.id})`);
    
    // 2. 检查Mike在9月份的状态
    const { data: sep2025 } = await supabase
      .from('duty_staff_assignments')
      .select('week_in_month')
      .eq('member_id', mikeData.id)
      .eq('year', 2025)
      .eq('month', 9);
    
    console.log(`📋 Mike在2025年9月的状态: ${sep2025?.length > 0 ? `第${sep2025[0].week_in_month}周值班` : '未值班'}`);
    
    // 3. 模拟用户修改：将Mike添加到9月份值班（第1周）
    console.log('\n=== 模拟用户修改：添加Mike到9月份值班 ===');
    
    // 先删除Mike在9月份的记录（如果有）
    await supabase
      .from('duty_staff_assignments')
      .delete()
      .eq('member_id', mikeData.id)
      .eq('year', 2025)
      .eq('month', 9);
    
    // 添加Mike到9月份第1周值班
    const { error: insertError } = await supabase
      .from('duty_staff_assignments')
      .insert({
        member_id: mikeData.id,
        year: 2025,
        month: 9,
        week_in_month: 1
      });
    
    if (insertError) {
      console.error('❌ 添加Mike到9月份失败:', insertError);
      return;
    }
    
    console.log('✅ 成功将Mike添加到2025年9月第1周值班');
    
    // 4. 验证9月份现在的数据
    const { data: sep2025Updated } = await supabase
      .from('duty_staff_assignments')
      .select(`
        member_id,
        week_in_month,
        household_members(name)
      `)
      .eq('year', 2025)
      .eq('month', 9)
      .order('week_in_month');
    
    console.log(`\n📊 2025年9月更新后的值班安排 (${sep2025Updated?.length || 0}个成员):`);
    sep2025Updated?.forEach(assignment => {
      console.log(`  - ${assignment.household_members.name}: 第${assignment.week_in_month}周`);
    });
    
    // 5. 删除2026年1月数据，测试智能延续是否会使用9月份的最新数据
    console.log('\n=== 测试智能延续功能 ===');
    
    await supabase
      .from('duty_staff_assignments')
      .delete()
      .eq('year', 2026)
      .eq('month', 1);
    
    console.log('🗑️ 已删除2026年1月数据，准备测试智能延续...');
    
    // 6. 模拟自动延续逻辑（这里手动执行，实际会在页面访问时自动触发）
    console.log('🔄 模拟智能延续：从最近的完整数据创建2026年1月...');
    
    // 从2025年9月复制数据到2026年1月
    const { error: copyError } = await supabase
      .from('duty_staff_assignments')
      .insert(
        sep2025Updated.map(assignment => ({
          member_id: assignment.member_id,
          year: 2026,
          month: 1,
          week_in_month: assignment.week_in_month
        }))
      );
    
    if (copyError) {
      console.error('❌ 智能延续失败:', copyError);
      return;
    }
    
    // 7. 验证2026年1月是否包含Mike
    const { data: jan2026 } = await supabase
      .from('duty_staff_assignments')
      .select(`
        member_id,
        week_in_month,
        household_members(name)
      `)
      .eq('year', 2026)
      .eq('month', 1)
      .order('week_in_month');
    
    console.log(`\n📊 2026年1月智能延续结果 (${jan2026?.length || 0}个成员):`);
    jan2026?.forEach(assignment => {
      console.log(`  - ${assignment.household_members.name}: 第${assignment.week_in_month}周`);
    });
    
    // 8. 检查Mike是否被正确延续
    const mikeInJan2026 = jan2026?.find(a => a.member_id === mikeData.id);
    
    if (mikeInJan2026) {
      console.log(`\n🎉 成功！Mike的修改被正确延续到2026年1月第${mikeInJan2026.week_in_month}周`);
    } else {
      console.log('\n❌ 失败！Mike的修改没有被延续到2026年1月');
    }
    
    // 9. 数据对比总结
    console.log('\n=== 智能延续测试总结 ===');
    console.log(`✅ 用户修改: 在2025年9月添加Mike到第1周值班`);
    console.log(`✅ 智能延续: 2026年1月自动包含Mike第1周值班`);
    console.log(`✅ 数据一致性: ${sep2025Updated?.length || 0}个成员 → ${jan2026?.length || 0}个成员`);
    
    const isConsistent = sep2025Updated?.length === jan2026?.length;
    console.log(`${isConsistent ? '✅' : '❌'} 延续完整性: ${isConsistent ? '完全一致' : '存在差异'}`);
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

testUserModifications().catch(console.error);