"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // 检查本地存储中的用户信息
    const storedUser = localStorage.getItem('current_user');

    if (storedUser) {
      // 如果已经登录，跳转到仪表盘
      router.push('/dashboard');
    } else {
      // 如果没有登录，跳转到登录页面
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg animate-pulse">
          <span className="text-white text-3xl">🍽️</span>
        </div>
        <div className="text-white text-lg font-medium">正在初始化系统...</div>
        <div className="text-slate-400 text-sm mt-2">请稍候</div>
      </div>
    </div>
  );
}
 
