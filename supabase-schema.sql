-- 创建所有必需的表，确保数据库完整性
-- 执行前请先在 Supabase Dashboard 中运行此 SQL

-- 1. 成员表（兼容两种命名）
CREATE TABLE IF NOT EXISTS household_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT '成员',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 支出记录表
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  handler TEXT,
  week_number INTEGER,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 成员缴费记录表
CREATE TABLE IF NOT EXISTS member_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES household_members(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  amount DECIMAL(10,2),
  coverage TEXT CHECK (coverage IN ('month', 'range')),
  from_date DATE,
  to_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(member_id, year, month)
);

-- 4. 值班人员分配表
CREATE TABLE IF NOT EXISTS duty_staff_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES household_members(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  week_in_month INTEGER NOT NULL CHECK (week_in_month >= 0 AND week_in_month <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(member_id, year, month)
);

-- 5. 每周计划表
CREATE TABLE IF NOT EXISTS weekly_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_number INTEGER NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  menu_json JSONB DEFAULT '{}'::jsonb,
  shopping_list_json JSONB DEFAULT '{}'::jsonb
);

-- 6. 菜单心愿表
CREATE TABLE IF NOT EXISTS menu_wishes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT NOT NULL,
  dish_name TEXT NOT NULL,
  ingredients JSONB DEFAULT '[]'::jsonb,
  adopted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 值班安排表（周次）
CREATE TABLE IF NOT EXISTS schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_number INTEGER NOT NULL,
  duty_pairs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. 应用设置表
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. 人数调整记录表
CREATE TABLE IF NOT EXISTS headcount_adjustments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_number INTEGER NOT NULL,
  effective_date DATE NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_week_number ON expenses(week_number);
CREATE INDEX IF NOT EXISTS idx_member_payments_year_month ON member_payments(year, month);
CREATE INDEX IF NOT EXISTS idx_duty_staff_year_month ON duty_staff_assignments(year, month);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_week_number ON weekly_plans(week_number);
CREATE INDEX IF NOT EXISTS idx_menu_wishes_adopted ON menu_wishes(adopted);

-- 启用 Realtime（需要在 Supabase Dashboard 中手动开启）
-- 或者运行以下 SQL 启用表的实时订阅：
-- ALTER PUBLICATION supabase_realtime ADD TABLE household_members;
-- ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
-- ALTER PUBLICATION supabase_realtime ADD TABLE member_payments;
-- ALTER PUBLICATION supabase_realtime ADD TABLE duty_staff_assignments;
-- ALTER PUBLICATION supabase_realtime ADD TABLE weekly_plans;
-- ALTER PUBLICATION supabase_realtime ADD TABLE menu_wishes;