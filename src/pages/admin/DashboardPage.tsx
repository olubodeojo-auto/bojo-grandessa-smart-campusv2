import AppHeader from "../../components/layout/AppHeader";

import GreetingWidget from "../../components/home/GreetingWidget";
import StatsWidget from "../../components/home/StatsWidget";
import StatusWidget from "../../components/home/StatusWidget";
import ToolsWidget from "../../components/home/ToolsWidget";
import AnnouncementsWidget from "../../components/home/AnnouncementsWidget";
import RecentActivityWidget from "../../components/home/RecentActivityWidget";

export default function DashboardPage() {
  return (
    <div className="dashboard-grid">
      <div className="span-12">
        <AppHeader />
      </div>

      <div className="span-12">
        <GreetingWidget />
      </div>

      <div className="span-12">
        <StatsWidget />
      </div>

      <div className="span-12">
        <StatusWidget />
      </div>

      <div className="span-8">
        <ToolsWidget />
      </div>

      <div className="span-4">
        <AnnouncementsWidget />
      </div>

      <div className="span-12">
        <RecentActivityWidget />
      </div>
    </div>
  );
}