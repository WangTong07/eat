// 这个脚本用于在 Supabase 中设置购物清单表
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 读取 .env.local 文件
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = path.join(__dirname, '.env.local');

let supabaseUrl;
let supabaseKey;

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  
  for (const line of envLines) {
    const [key, value] = line.split('=');
    if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
      supabaseUrl = value;
    } else if (key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
      supabaseKey = value;
    }
  }
} catch (error) {
  console.error('读取 .env.local 文件失败:', error);
}

if (!supabaseUrl || !supabaseKey) {
  console.error('缺少 Supabase 环境变量');
  process.exit(1);
}

// 创建 Supabase 客户端
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  try {
    // 读取 SQL 文件
    const sqlFilePath = path.join(process.cwd(), 'create-shopping-list-table.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    // 执行 SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sqlContent
    });

    if (error) {
      console.error('执行 SQL 失败:', error);
      
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
        const { error: createError } = await supabase
          .from('shopping_list')
          .insert([
            { 
              id: 'test-item', 
              name: '测试物品', 
              category: '日杂类',
              checked: false
            }
          ]);
        
        if (createError) {
          console.error('创建表失败:', createError);
        } else {
          console.log('表创建成功');
        }
      } else {
        console.log('表已存在');
      }
    } else {
      console.log('数据库设置成功');
    }
  } catch (error) {
    console.error('设置数据库时出错:', error);
  }
}

setupDatabase();