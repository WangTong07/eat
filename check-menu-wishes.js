// 检查 menu_wishes 表是否存在
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
  
  async function checkMenuWishes() {
    try {
      console.log('检查 menu_wishes 表...');
      
      // 尝试查询 menu_wishes 表
      const { data, error } = await supabase
        .from('menu_wishes')
        .select('*')
        .limit(5);
      
      if (error) {
        console.error('查询 menu_wishes 表失败:', error);
        
        // 如果表不存在，尝试创建
        console.log('尝试创建 menu_wishes 表...');
        
        const { error: createError } = await supabase.rpc('exec_sql', {
          sql_query: `
            -- 创建 menu_wishes 表
            CREATE TABLE IF NOT EXISTS menu_wishes (
              id TEXT PRIMARY KEY,
              user_name TEXT,
              request_type TEXT NOT NULL,
              content TEXT NOT NULL,
              status TEXT DEFAULT 'pending',
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            -- 添加行级安全策略
            ALTER TABLE menu_wishes ENABLE ROW LEVEL SECURITY;
            
            -- 删除可能存在的旧策略
            DROP POLICY IF EXISTS "Allow anonymous read access on menu_wishes" ON menu_wishes;
            DROP POLICY IF EXISTS "Allow anonymous insert access on menu_wishes" ON menu_wishes;
            DROP POLICY IF EXISTS "Allow anonymous update access on menu_wishes" ON menu_wishes;
            DROP POLICY IF EXISTS "Allow anonymous delete access on menu_wishes" ON menu_wishes;
            
            -- 创建新策略
            CREATE POLICY "Allow anonymous read access on menu_wishes" ON menu_wishes
            FOR SELECT USING (true);
            
            CREATE POLICY "Allow anonymous insert access on menu_wishes" ON menu_wishes
            FOR INSERT WITH CHECK (true);
            
            CREATE POLICY "Allow anonymous update access on menu_wishes" ON menu_wishes
            FOR UPDATE USING (true);
            
            CREATE POLICY "Allow anonymous delete access on menu_wishes" ON menu_wishes
            FOR DELETE USING (true);
          `
        });
        
        if (createError) {
          console.error('创建 menu_wishes 表失败:', createError);
          
          // 尝试使用另一种方式创建表
          console.log('尝试使用另一种方式创建表...');
          
          // 使用 REST API 创建表
          const { error: insertError } = await supabase
            .from('menu_wishes')
            .insert([
              { 
                id: 'test-wish-' + Date.now(), 
                user_name: '测试用户',
                request_type: '想吃的菜',
                content: '红烧肉',
                status: 'pending'
              }
            ]);
          
          if (insertError) {
            console.error('创建 menu_wishes 表失败:', insertError);
          } else {
            console.log('menu_wishes 表创建成功');
          }
        } else {
          console.log('menu_wishes 表创建成功');
        }
        
        // 插入一些测试数据
        console.log('插入测试数据...');
        const testData = [
          { 
            id: 'test-wish-1', 
            user_name: '用户1',
            request_type: '想吃的菜',
            content: '红烧肉',
            status: 'pending'
          },
          { 
            id: 'test-wish-2', 
            user_name: '用户2',
            request_type: '想吃的菜',
            content: '鱼香肉丝',
            status: 'pending'
          },
          { 
            id: 'test-wish-3', 
            user_name: '用户3',
            request_type: '想吃的菜',
            content: '宫保鸡丁',
            status: 'pending'
          }
        ];
        
        for (const item of testData) {
          const { error } = await supabase
            .from('menu_wishes')
            .insert([item]);
          
          if (error) {
            console.error(`插入数据 ${item.content} 失败:`, error);
          }
        }
        
        console.log('测试数据插入完成');
      } else {
        console.log('menu_wishes 表已存在，数据:', data);
      }
    } catch (error) {
      console.error('检查 menu_wishes 表时出错:', error);
    }
  }
  
  checkMenuWishes();
} catch (error) {
  console.error('读取 .env.local 文件失败:', error);
}