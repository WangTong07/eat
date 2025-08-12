const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://sirxaxuvtvtpeozqjzur.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcnhheHV2dHZ0cGVvenFqenVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NzQ3OTksImV4cCI6MjA2ODI1MDc5OX0.6-rO17rkd27J_uqHCT2uhmzgH0LoJv6rcri-vvEhvpM'
);

async function testConnection() {
  console.log('🔗 测试Supabase连接...');
  
  try {
    // 测试基本连接
    const { data, error } = await supabase
      .from('announcements')
      .select('id, content')
      .limit(1);
    
    if (error) {
      console.log('❌ 连接失败:', error.message);
      return;
    }
    
    console.log('✅ Supabase连接正常');
    console.log('📊 最新数据:', data[0]);
    
    // 测试author字段
    const { error: authorError } = await supabase
      .from('announcements')
      .select('author')
      .limit(1);
      
    if (authorError && authorError.message.includes('author')) {
      console.log('⚠️  author字段不存在，需要手动添加');
      console.log('📋 请在Supabase控制台添加author字段');
    } else {
      console.log('✅ author字段已存在');
    }
    
  } catch (e) {
    console.error('💥 测试异常:', e.message);
  }
}

testConnection();