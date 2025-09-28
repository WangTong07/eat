"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [selectedUser, setSelectedUser] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const users = [
    { name: '管理员', role: 'admin', icon: '👑', color: 'from-red-500 to-pink-600' },
    { name: '经理', role: 'admin', icon: '🛡️', color: 'from-purple-500 to-indigo-600' },
    { name: '室友A', role: 'user', icon: '👤', color: 'from-blue-500 to-cyan-600' },
    { name: '室友B', role: 'user', icon: '👤', color: 'from-green-500 to-emerald-600' },
    { name: '室友C', role: 'user', icon: '👤', color: 'from-orange-500 to-amber-600' }
  ];

  const handleLogin = async () => {
    if (!selectedUser) return;

    setIsLoading(true);
    const success = await login(selectedUser);

    if (success) {
      router.push('/dashboard');
    } else {
      alert('登录失败，请重试');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/20">
          {/* 头部 */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
              <span className="text-white text-3xl">🍽️</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">AI伙食官</h1>
            <p className="text-slate-300">请选择您的身份登录</p>
          </div>

          {/* 用户选择 */}
          <div className="space-y-3 mb-6">
            {users.map((user) => (
              <button
                key={user.name}
                onClick={() => setSelectedUser(user.name)}
                className={`w-full p-4 rounded-xl border-2 transition-all duration-200 hover:scale-105 active:scale-95 ${
                  selectedUser === user.name
                    ? `border-emerald-400 bg-gradient-to-r ${user.color} text-white shadow-lg`
                    : 'border-white/20 bg-white/5 text-slate-300 hover:border-white/40 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">{user.icon}</span>
                    <div className="text-left">
                      <div className="font-semibold">{user.name}</div>
                      <div className="text-xs opacity-75">
                        {user.role === 'admin' ? '管理员权限' : '普通用户'}
                      </div>
                    </div>
                  </div>
                  {selectedUser === user.name && (
                    <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                      <span className="text-emerald-600 text-sm">✓</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* 登录按钮 */}
          <button
            onClick={handleLogin}
            disabled={!selectedUser || isLoading}
            className={`w-full py-4 rounded-xl font-semibold text-white transition-all duration-200 ${
              selectedUser && !isLoading
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg hover:shadow-xl active:scale-95'
                : 'bg-slate-600 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                登录中...
              </div>
            ) : (
              '进入系统'
            )}
          </button>

          {/* 底部说明 */}
          <div className="mt-6 text-center text-slate-400 text-sm">
            <p>选择您的身份后点击进入系统</p>
            <p className="mt-1">管理员拥有完整权限，普通用户仅可查看</p>
          </div>
        </div>
      </div>
    </div>
  );
}