import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    // 在浏览器侧实际调用时再报错/警告，避免构建期失败
    console.warn('[Supabase] 缺少环境变量 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  cachedClient = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');
  return cachedClient as SupabaseClient;
}

export default getSupabaseClient;
