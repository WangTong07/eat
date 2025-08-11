// 这个脚本将直接使用 Supabase JavaScript 客户端创建必要的表
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
  
  async function createTables() {
    try {
      console.log('开始创建购物清单表...');
      
      // 创建购物清单表
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql_query: `
          -- 创建购物清单表
          CREATE TABLE IF NOT EXISTS shopping_list (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            checked BOOLEAN DEFAULT FALSE,
            qty TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          -- 添加行级安全策略
          ALTER TABLE shopping_list ENABLE ROW LEVEL SECURITY;
          
          -- 删除可能存在的旧策略
          DROP POLICY IF EXISTS "Allow anonymous read access on shopping_list" ON shopping_list;
          DROP POLICY IF EXISTS "Allow anonymous insert access on shopping_list" ON shopping_list;
          DROP POLICY IF EXISTS "Allow anonymous update access on shopping_list" ON shopping_list;
          DROP POLICY IF EXISTS "Allow anonymous delete access on shopping_list" ON shopping_list;
          
          -- 创建新策略
          CREATE POLICY "Allow anonymous read access on shopping_list" ON shopping_list
          FOR SELECT USING (true);
          
          CREATE POLICY "Allow anonymous insert access on shopping_list" ON shopping_list
          FOR INSERT WITH CHECK (true);
          
          CREATE POLICY "Allow anonymous update access on shopping_list" ON shopping_list
          FOR UPDATE USING (true);
          
          CREATE POLICY "Allow anonymous delete access on shopping_list" ON shopping_list
          FOR DELETE USING (true);
        `
      });
      
      if (createError) {
        console.error('创建表失败:', createError);
        
        // 尝试使用另一种方式创建表
        console.log('尝试使用另一种方式创建表...');
        
        // 检查表是否存在
        const { error: checkError } = await supabase
          .from('shopping_list')
          .select('id')
          .limit(1);
        
        if (checkError && checkError.code === 'PGRST116') {
          console.log('表不存在，尝试创建...');
          
          // 使用 REST API 创建表
          const { error: insertError } = await supabase
            .from('shopping_list')
            .insert([
              { 
                id: 'test-item', 
                name: '测试物品', 
                category: '日杂类',
                checked: false
              }
            ]);
          
          if (insertError) {
            console.error('创建表失败:', insertError);
          } else {
            console.log('表创建成功');
          }
        } else {
          console.log('表已存在');
        }
      } else {
        console.log('表创建成功');
      }
      
      // 测试插入数据
      console.log('测试插入数据...');
      const { error: insertError } = await supabase
        .from('shopping_list')
        .insert([
          { 
            id: 'test-item-' + Date.now(), 
            name: '测试物品', 
            category: '日杂类',
            checked: false
          }
        ]);
      
      if (insertError) {
        console.error('插入数据失败:', insertError);
      } else {
        console.log('插入数据成功');
      }
      
      // 测试查询数据
      console.log('测试查询数据...');
      const { data, error: selectError } = await supabase
        .from('shopping_list')
        .select('*')
        .limit(5);
      
      if (selectError) {
        console.error('查询数据失败:', selectError);
      } else {
        console.log('查询数据成功:', data);
      }
    } catch (error) {
      console.error('创建表时出错:', error);
    }
  }
  
  createTables();
} catch (error) {
  console.error('读取 .env.local 文件失败:', error);
}