-- 创建固定支出配置表
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  cycle_type VARCHAR(50) DEFAULT '21day_cycle',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建固定支出执行记录表（跟踪哪些周期已经添加过）
CREATE TABLE IF NOT EXISTS recurring_expense_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recurring_expense_id UUID REFERENCES recurring_expenses(id) ON DELETE CASCADE,
  cycle_year INTEGER NOT NULL,
  cycle_month INTEGER NOT NULL,
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(recurring_expense_id, cycle_year, cycle_month)
);

-- 插入默认的做饭阿姨固定支出
INSERT INTO recurring_expenses (name, amount, description, cycle_type, is_active)
VALUES ('做饭阿姨', 3000.00, '每周期固定支出 - 做饭阿姨工资', '21day_cycle', true)
ON CONFLICT DO NOTHING;

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_recurring_expenses_updated_at 
    BEFORE UPDATE ON recurring_expenses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();