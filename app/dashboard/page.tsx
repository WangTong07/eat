import Announcements from "../components/Announcements";
import Shell from "./Shell";
import OverviewCards from "../components/OverviewCards";
import MenuCards from "../components/MenuCards";

export const dynamicParams = true;

export default function DashboardPage() {
  return (
    <Shell>
      <div id="dashboard" className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold text-neutral-800"></h2>
          </div>
        </div>
        <OverviewCards />
        <Announcements />
      </div>

      {/* 首页仅保留三列“菜单预览” */}
      <div id="menu-preview" className="mt-8 space-y-6">
        <MenuCards preview />
      </div>
    </Shell>
  );
}


