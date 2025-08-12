import { createClient } from '@supabase/supabase-js';

// 直接使用环境变量
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function addAuthorColumn() {
  try {
    console.log('正在检查并添加author字段...');
    
    // 先测试author字段是否存在
    const { data: testData, error: testError } = await supabase
      .from('announcements')
      .select('author')
      .limit(1);
    
    if (testError) {
      if (testError.message.includes('author')) {
        console.log('确认：author字段不存在');
        console.log('错误信息:', testError.message);
        
        // 尝试使用SQL函数添加字段
        console.log('尝试添加author字段...');
        const { data: sqlData, error: sqlError } = await supabase.rpc('exec_sql', {
          sql: 'ALTER TABLE announcements ADD COLUMN author TEXT;'
        });
        
        if (sqlError) {
          console.log('SQL执行失败:', sqlError.message);
          console.log('需要手动在Supabase控制台添加author字段');
          console.log('字段配置：');
          console.log('- 表名: announcements');
          console.log('- 字段名: author');
          console.log('- 类型: text');
          console.log('- 允许为空: true');
        } else {
          console.log('成功添加author字段！');
          
          // 验证字段是否添加成功
          const { data: verifyData, error: verifyError } = await supabase
            .from('announcements')
            .select('author')
            .limit(1);
            
          if (verifyError) {
            console.log('验证失败:', verifyError.message);
          } else {
            console.log('验证成功：author字段已存在');
          }
        }
      } else {
        console.log('其他错误:', testError.message);
      }
    } else {
      console.log('author字段已存在！');
      console.log('测试数据:', testData);
    }
  } catch (e) {
    console.error('操作失败:', e.message);
  }
}

addAuthorColumn();