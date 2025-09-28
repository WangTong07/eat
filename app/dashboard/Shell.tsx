"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from '../contexts/AuthContext';

// 内部组件处理认证逻辑
function ShellContent({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();

  // 检查认证状态
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // 如果正在加载或没有用户，显示加载状态
  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-slate-800 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg animate-pulse">
            <span className="text-white text-3xl">🍽️</span>
          </div>
          <div className="text-lg font-medium">验证身份中...</div>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navItems = [
    {
      href: "/dashboard",
      icon: "🏠",
      label: "首页总览",
      gradient: "from-blue-500 to-indigo-600",
      bgGradient: "from-blue-50 to-indigo-50"
    },
    {
      href: "/preferences",
      icon: "📝",
      label: "偏好提交",
      gradient: "from-emerald-500 to-teal-600",
      bgGradient: "from-emerald-50 to-teal-50"
    },
    {
      href: "/people",
      icon: "👥",
      label: "成员详情",
      gradient: "from-purple-500 to-indigo-600",
      bgGradient: "from-purple-50 to-indigo-50"
    },
    {
      href: "/shopping",
      icon: "🛒",
      label: "采购清单",
      gradient: "from-orange-500 to-amber-600",
      bgGradient: "from-orange-50 to-amber-50"
    },
    {
      href: "/finance",
      icon: "💰",
      label: "财务详情",
      gradient: "from-cyan-500 to-blue-600",
      bgGradient: "from-cyan-50 to-blue-50"
    },
    {
      href: "/finance-audit",
      icon: "📊",
      label: "支出核对",
      gradient: "from-violet-500 to-purple-600",
      bgGradient: "from-violet-50 to-purple-50"
    }
  ];

  return (
    <div className="font-inter bg-gradient-to-br from-gray-900 to-slate-800 text-gray-100 min-h-screen flex flex-col">
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-gray-900/90 backdrop-blur-md shadow-lg z-50 transition-all duration-300 border-b border-gray-700/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <button 
              onClick={() => setOpen((v) => !v)} 
              className="mr-3 text-gray-300 hover:text-emerald-400 transition-colors duration-200 p-2 rounded-lg hover:bg-emerald-900/30"
            >
              <i className="fa fa-bars text-xl" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white text-lg">🍽️</span>
              </div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">AI伙食官</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-14 lg:pt-0">
        <aside className={`fixed lg:static top-14 lg:top-0 left-0 bottom-0 w-72 bg-gray-800/80 backdrop-blur-md shadow-xl transform ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 transition-all duration-300 z-40 overflow-y-auto border-r border-gray-700/50`}>
          {/* 头部区域 - 深色主题设计 */}
          <div className="p-6 bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border-b border-emerald-700/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
                  <span className="text-white text-2xl">🍽️</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">AI伙食官</h1>
                  <p className="text-sm text-emerald-400/70 font-medium">智能伙食管理系统</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-400 transition-colors duration-200 p-2 rounded-lg hover:bg-red-900/20"
                title="退出登录"
              >
                <i className="fa fa-sign-out text-lg" />
              </button>
            </div>
            {/* 用户信息 */}
            <div className="bg-gray-800/50 rounded-lg p-3 mt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
                    user.role === 'admin'
                      ? 'bg-gradient-to-br from-red-500 to-pink-600'
                      : 'bg-gradient-to-br from-blue-500 to-cyan-600'
                  }`}>
                    <span className="text-white text-sm">
                      {user.role === 'admin' ? '👑' : '👤'}
                    </span>
                  </div>
                  <div>
                    <div className="text-white font-medium text-sm">{user.name}</div>
                    <div className="text-xs text-gray-400">
                      {user.role === 'admin' ? '管理员' : '普通用户'}
                    </div>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${
                  user.isActive ? 'bg-green-400' : 'bg-gray-500'
                }`} />
              </div>
            </div>
          </div>

          {/* 导航区域 - 深色主题设计 */}
          <nav className="p-4">
            <ul className="space-y-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link 
                      href={item.href} 
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 hover:shadow-md active:scale-95 ${
                        isActive 
                          ? `bg-gradient-to-r from-gray-700/50 to-gray-600/50 border-2 border-gray-600/50 shadow-lg` 
                          : 'hover:bg-gray-700/40 hover:backdrop-blur-sm border-2 border-transparent hover:border-gray-600/30'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 shadow-md transition-all duration-200 ${
                        isActive 
                          ? `bg-gradient-to-br ${item.gradient} text-white shadow-lg` 
                          : 'bg-gray-700/60 group-hover:bg-gray-600/60 text-gray-300 group-hover:shadow-lg'
                      }`}>
                        <span className="text-lg">{item.icon}</span>
                      </div>
                      <span className={`font-semibold transition-all duration-200 ${
                        isActive 
                          ? `bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent` 
                          : 'text-gray-300 group-hover:text-gray-100'
                      }`}>
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* 底部装饰 - 深色主题 */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 rounded-xl p-4 border border-emerald-700/30">
              <div className="text-center">
                <div className="text-2xl mb-2">✨</div>
                <div className="text-sm text-emerald-400 font-medium">智能管理，轻松生活</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>

      {/* 移动端遮罩 */}
      {open && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-30 transition-all duration-300"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}

// 主导出组件，提供认证上下文
export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ShellContent>{children}</ShellContent>
    </AuthProvider>
  );
}
