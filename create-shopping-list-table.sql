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

-- 允许匿名用户访问
DO $$
BEGIN
  -- 检查策略是否存在
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'shopping_list' AND policyname = 'Allow anonymous read access on shopping_list'
  ) THEN
    CREATE POLICY "Allow anonymous read access on shopping_list" ON shopping_list
    FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'shopping_list' AND policyname = 'Allow anonymous insert access on shopping_list'
  ) THEN
    CREATE POLICY "Allow anonymous insert access on shopping_list" ON shopping_list
    FOR INSERT WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'shopping_list' AND policyname = 'Allow anonymous update access on shopping_list'
  ) THEN
    CREATE POLICY "Allow anonymous update access on shopping_list" ON shopping_list
    FOR UPDATE USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'shopping_list' AND policyname = 'Allow anonymous delete access on shopping_list'
  ) THEN
    CREATE POLICY "Allow anonymous delete access on shopping_list" ON shopping_list
    FOR DELETE USING (true);
  END IF;
END
$$;