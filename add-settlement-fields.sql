-- 添加结算相关字段到member_payments表
ALTER TABLE member_payments ADD COLUMN IF NOT EXISTS settlement_amount DECIMAL(10, 2);
ALTER TABLE member_payments ADD COLUMN IF NOT EXISTS settlement_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE member_payments ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT FALSE;

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_member_payments_settlement ON member_payments (year, month, paid, coverage);