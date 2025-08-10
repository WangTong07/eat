const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('请设置 SUPABASE_URL 和 SUPABASE_ANON_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkExpensesTable() {
  try {
    console.log('检查 expenses 表结构...');
    
    // 尝试查询表结构
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('查询 expenses 表失败:', error);
      return;
    }
    
    console.log('expenses 表查询成功');
    if (data && data.length > 0) {
      console.log('表字段:', Object.keys(data[0]));
    } else {
      console.log('表为空，无法确定字段结构');
    }
    
    // 尝试插入一条测试记录来验证字段
    console.log('\n尝试插入测试记录...');
    const testRecord = {
      date: '2025-08-11',
      description: '测试记录',
      amount: 1.00,
      handler: '测试用户'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('expenses')
      .insert(testRecord)
      .select();
    
    if (insertError) {
      console.error('插入测试记录失败:', insertError);
    } else {
      console.log('插入测试记录成功:', insertData);
      
      // 删除测试记录
      if (insertData && insertData[0]) {
        await supabase
          .from('expenses')
          .delete()
          .eq('id', insertData[0].id);
        console.log('已删除测试记录');
      }
    }
    
  } catch (error) {
    console.error('检查过程中出错:', error);
  }
}

checkExpensesTable();