import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://sirxaxuvtvtpeozqjzur.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcnhheHV2dHZ0cGVvenFqenVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NzQ3OTksImV4cCI6MjA2ODI1MDc5OX0.6-rO17rkd27J_uqHCT2uhmzgH0LoJv6rcri-vvEhvpM'
);

async function addAuthorColumn() {
  try {
    console.log('正在检查announcements表结构...');
    
    // 先测试author字段是否存在
    const { data: testData, error: testError } = await supabase
      .from('announcements')
      .select('author')
      .limit(1);
    
    if (testError) {
      if (testError.message.includes('author')) {
        console.log('✅ 确认：author字段不存在，需要添加');
        console.log('错误信息:', testError.message);
        
        // 尝试使用不同的RPC方法添加字段
        console.log('🔧 尝试添加author字段...');
        
        // 方法1: 尝试exec_sql
        try {
          const { data: sqlData, error: sqlError } = await supabase.rpc('exec_sql', {
            sql: 'ALTER TABLE announcements ADD COLUMN author TEXT;'
          });
          
          if (sqlError) {
            console.log('❌ exec_sql方法失败:', sqlError.message);
          } else {
            console.log('✅ 使用exec_sql成功添加author字段！');
            return;
          }
        } catch (e) {
          console.log('❌ exec_sql方法异常:', e.message);
        }
        
        // 方法2: 尝试sql
        try {
          const { data: sqlData2, error: sqlError2 } = await supabase.rpc('sql', {
            query: 'ALTER TABLE announcements ADD COLUMN author TEXT;'
          });
          
          if (sqlError2) {
            console.log('❌ sql方法失败:', sqlError2.message);
          } else {
            console.log('✅ 使用sql成功添加author字段！');
            return;
          }
        } catch (e) {
          console.log('❌ sql方法异常:', e.message);
        }
        
        // 如果所有方法都失败
        console.log('⚠️  自动添加失败，需要手动操作');
        console.log('📋 请在Supabase控制台手动添加author字段：');
        console.log('   - 打开: https://sirxaxuvtvtpeozqjzur.supabase.co');
        console.log('   - 进入: Table Editor');
        console.log('   - 选择: announcements表');
        console.log('   - 添加列: author (类型: text, 允许为空: true)');
        
      } else {
        console.log('❌ 其他错误:', testError.message);
      }
    } else {
      console.log('✅ author字段已存在！');
      console.log('📊 测试数据:', testData);
      
      // 测试插入功能
      console.log('🧪 测试插入功能...');
      const { data: insertData, error: insertError } = await supabase
        .from('announcements')
        .insert({
          content: '测试author字段功能',
          author: '系统测试',
          is_active: true
        });
        
      if (insertError) {
        console.log('❌ 插入测试失败:', insertError.message);
      } else {
        console.log('✅ 插入测试成功！author字段工作正常');
      }
    }
  } catch (e) {
    console.error('💥 操作失败:', e.message);
  }
}

addAuthorColumn();