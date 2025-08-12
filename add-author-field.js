import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function addAuthorColumn() {
  try {
    console.log('检查 author 字段是否存在...');
    
    // 先测试当前表结构
    const { data: testData, error: testError } = await supabase
      .from('announcements')
      .select('author')
      .limit(1);
    
    if (testError && testError.message.includes('author')) {
      console.log('确认：author字段不存在');
      console.log('错误信息:', testError.message);
      console.log('需要在Supabase控制台手动添加author字段');
      console.log('字段配置：');
      console.log('- 字段名: author');
      console.log('- 类型: text');
      console.log('- 允许为空: true');
    } else if (testError) {
      console.log('其他错误:', testError.message);
    } else {
      console.log('author字段已存在！');
      console.log('测试数据:', testData);
    }
  } catch (e) {
    console.error('操作失败:', e.message);
  }
}

addAuthorColumn();