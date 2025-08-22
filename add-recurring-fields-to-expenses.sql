-- 为expenses表添加固定支出相关字段
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurring_expense_id UUID REFERENCES recurring_expenses(id) ON DELETE SET NULL;

-- 创建索引提高查询性能
CREATE INDEX IF NOT EXISTS idx_expenses_is_recurring ON expenses(is_recurring);
CREATE INDEX IF NOT EXISTS idx_expenses_recurring_expense_id ON expenses(recurring_expense_id);