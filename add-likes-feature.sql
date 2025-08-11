-- 为推荐菜添加点赞功能的数据库表

-- 1. 推荐菜点赞表
CREATE TABLE IF NOT EXISTS dish_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dish_name TEXT NOT NULL,
  user_identifier TEXT NOT NULL, -- 用户标识（可以是IP或用户名）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(dish_name, user_identifier) -- 防止同一用户重复点赞同一道菜
);

-- 2. 推荐菜点赞统计视图（可选，用于快速查询点赞数）
CREATE OR REPLACE VIEW dish_like_stats AS
SELECT 
  dish_name,
  COUNT(*) as like_count
FROM dish_likes
GROUP BY dish_name;

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_dish_likes_dish_name ON dish_likes(dish_name);
CREATE INDEX IF NOT EXISTS idx_dish_likes_user ON dish_likes(user_identifier);

-- 启用实时订阅
ALTER PUBLICATION supabase_realtime ADD TABLE dish_likes;