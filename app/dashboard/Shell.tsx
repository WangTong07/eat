"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
            <div className="flex items-center mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
                <span className="text-white text-2xl">🍽️</span>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">AI伙食官</h1>
                <p className="text-sm text-emerald-400/70 font-medium">智能伙食管理系统</p>
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


