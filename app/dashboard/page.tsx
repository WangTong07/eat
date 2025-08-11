import Link from "next/link";
import AnnouncementCenter from "../components/AnnouncementCenter";
import Shell from "./Shell";
import OverviewCards from "../components/OverviewCards";
import MenuCards from "../components/MenuCards";

export const dynamicParams = true;

export default function DashboardPage() {
  return (
    <Shell>
      <div id="dashboard" className="space-y-6">
        <OverviewCards />
        <AnnouncementCenter />
      </div>

      {/* 菜单预览区域 - 深色主题设计 */}
      <div id="menu-preview" className="mt-8 space-y-6">
        <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border border-emerald-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white text-lg">🍽️</span>
            </div>
            <div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                菜单预览
              </h3>
              <p className="text-emerald-400/70 font-medium text-sm">今日推荐菜品</p>
            </div>
          </div>
          <MenuCards preview />
        </div>
      </div>
    </Shell>
  );
}


