-- 添加 author 字段到 announcements 表
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS author TEXT;

-- 验证字段是否添加成功
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'announcements' 
AND table_schema = 'public';