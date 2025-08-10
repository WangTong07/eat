// 调试 expenses 表结构
const { createClient } = require('@supabase/supabase-js');

// 直接使用环境变量值
const supabaseUrl = 'https://sirxaxuvtvtpeozqjzur.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcnhheHV2dHZ0cGVvenFqenVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NzQ3OTksImV4cCI6MjA2ODI1MDc5OX0.6-rO17rkd27J_uqHCT2uhmzgH0LoJv6rcri-vvEhvpM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugExpensesTable() {
  console.log('正在检查 expenses 表结构...');
  
  // 尝试查询表结构
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('查询 expenses 表失败:', error);
  } else {
    console.log('expenses 表查询成功:', data);
    if (data && data.length > 0) {
      console.log('表字段:', Object.keys(data[0]));
    }
  }
  
  // 测试不同的字段名组合
  const testCases = [
    { date: '2025-01-10', description: '测试1', amount: 10.00, handler: '测试用户' },
    { date: '2025-01-10', item_description: '测试2', amount: 10.00, user_name: '测试用户' },
    { date: '2025-01-10', desc: '测试3', amount: 10.00, handler: '测试用户' },
    { date: '2025-01-10', description: '测试4', amount: 10.00, user_name: '测试用户' }
  ];
  
  for (let i = 0; i < testCases.length; i++) {
    console.log(`\n尝试插入测试记录 ${i + 1}:`, testCases[i]);
    const { error: insertError } = await supabase
      .from('expenses')
      .insert(testCases[i]);
    
    if (insertError) {
      console.error(`测试 ${i + 1} 失败:`, insertError.message);
    } else {
      console.log(`测试 ${i + 1} 成功！正确的字段组合:`, Object.keys(testCases[i]));
      break;
    }
  }
}

debugExpensesTable().catch(console.error);