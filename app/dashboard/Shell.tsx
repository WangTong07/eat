"use client";
import { useState } from "react";
import Link from "next/link";

export default function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="font-inter bg-neutral-100 text-neutral-800 min-h-screen flex flex-col">
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-white shadow-md z-50 transition-all duration-300">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <button onClick={() => setOpen((v) => !v)} className="mr-3 text-neutral-700 hover:text-primary transition-colors">
              <i className="fa fa-bars text-xl" />
            </button>
            <h1 className="text-lg font-bold text-primary">AI伙食官</h1>
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-14 lg:pt-0">
        <aside className={`fixed lg:static top-14 lg:top-0 left-0 bottom-0 w-64 bg-white shadow-lg transform ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 transition-transform duration-300 z-40 overflow-y-auto`}>
          <div className="p-4 border-b border-neutral-200">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white mr-3">
                <i className="fa fa-cutlery" />
              </div>
              <h1 className="text-xl font-bold text-primary">AI伙食官</h1>
            </div>
            <p className="text-sm text-neutral-500 mt-1">智能伙食管理系统</p>
          </div>
          <nav className="p-2">
            <ul>
              <li className="mb-1">
                <Link href="/dashboard" className="flex items-center px-4 py-3 rounded-lg text-neutral-700 hover:bg-neutral-100 transition-colors">
                  <i className="fa fa-tachometer w-5 text-center mr-3" />
                  <span>首页总览</span>
                </Link>
              </li>
              <li className="mb-1">
                <Link href="/preferences" className="flex items-center px-4 py-3 rounded-lg text-neutral-700 hover:bg-neutral-100 transition-colors">
                  <i className="fa fa-list-alt w-5 text-center mr-3" />
                  <span>偏好提交</span>
                </Link>
              </li>
              <li className="mb-1">
                <Link href="/people" className="flex items-center px-4 py-3 rounded-lg text-neutral-700 hover:bg-neutral-100 transition-colors">
                  <i className="fa fa-user-plus w-5 text-center mr-3" />
                  <span>成员详情</span>
                </Link>
              </li>
              {/* 移除“本周菜单”入口（页面已合并为推荐菜/采购清单） */}
              <li className="mb-1">
                <Link href="/shopping" className="flex items-center px-4 py-3 rounded-lg text-neutral-700 hover:bg-neutral-100 transition-colors">
                  <i className="fa fa-shopping-basket w-5 text-center mr-3" />
                  <span>采购清单</span>
                </Link>
              </li>
              {/* 按你的要求：移除“值班安排”菜单入口 */}
              <li className="mb-1">
                <Link href="/finance" className="flex items-center px-4 py-3 rounded-lg text-neutral-700 hover:bg-neutral-100 transition-colors">
                  <i className="fa fa-calculator w-5 text-center mr-3" />
                  <span>财务</span>
                </Link>
              </li>
            </ul>
          </nav>
        </aside>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}


