// 检查数据库表结构和权限
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// 读取 .env.local 文件
try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const envLines = envContent.split('\n');
  
  let supabaseUrl;
  let supabaseKey;
  
  for (const line of envLines) {
    const [key, value] = line.split('=');
    if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
      supabaseUrl = value;
    } else if (key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
      supabaseKey = value;
    }
  }
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('缺少 Supabase 环境变量');
    process.exit(1);
  }
  
  // 创建 Supabase 客户端
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  async function checkTables() {
    try {
      console.log('检查数据库表...');
      
      // 获取所有表
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
      
      if (tablesError) {
        console.error('获取表列表失败:', tablesError);
      } else {
        console.log('数据库表列表:', tables.map(t => t.table_name));
      }
      
      // 检查 shopping_list 表
      console.log('\n检查 shopping_list 表...');
      const { data: shoppingItems, error: shoppingError } = await supabase
        .from('shopping_list')
        .select('*')
        .limit(5);
      
      if (shoppingError) {
        console.error('查询 shopping_list 表失败:', shoppingError);
      } else {
        console.log('shopping_list 表数据:', shoppingItems);
      }
      
      // 检查 menu_wishes 表
      console.log('\n检查 menu_wishes 表...');
      const { data: wishes, error: wishesError } = await supabase
        .from('menu_wishes')
        .select('*')
        .eq('request_type', '想吃的菜')
        .limit(5);
      
      if (wishesError) {
        console.error('查询 menu_wishes 表失败:', wishesError);
      } else {
        console.log('menu_wishes 表数据:', wishes);
      }
      
      // 测试 API 接口
      console.log('\n测试 recommendations API...');
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_recommendations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        });
        
        if (!response.ok) {
          console.error('API 请求失败:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('错误详情:', errorText);
        } else {
          const data = await response.json();
          console.log('API 响应:', data);
        }
      } catch (apiError) {
        console.error('API 请求出错:', apiError);
      }
    } catch (error) {
      console.error('检查数据库表时出错:', error);
    }
  }
  
  checkTables();
} catch (error) {
  console.error('读取 .env.local 文件失败:', error);
}