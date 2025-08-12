import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAnnouncementsTable() {
  try {
    console.log('检查 announcements 表...');
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .limit(3);
    
    if (error) {
      console.log('查询错误:', error.message);
      console.log('错误详情:', error);
    } else {
      console.log('announcements 表数据:', data);
      if (data && data.length > 0) {
        console.log('字段列表:', Object.keys(data[0]));
      } else {
        console.log('表为空');
      }
    }
  } catch (e) {
    console.error('检查失败:', e.message);
  }
}

checkAnnouncementsTable();