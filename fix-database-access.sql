-- 这个脚本用于在 Supabase 中设置购物清单表
-- 请在 Supabase 控制台的 SQL 编辑器中执行这个脚本

-- 检查表是否存在，如果不存在则创建
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

-- 插入一条测试数据
INSERT INTO shopping_list (id, name, category, checked)
VALUES ('test-item', '测试物品', '日杂类', false)
ON CONFLICT (id) DO NOTHING;

-- 查询表中的数据
SELECT * FROM shopping_list;