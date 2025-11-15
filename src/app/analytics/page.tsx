"use client";

import SidebarNavigation from "@/components/sections/sidebar-navigation";
import HeaderBar from "@/components/sections/header-bar";
import AnalyticsTerminal from "@/components/analytics-terminal";

export default function AnalyticsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SidebarNavigation />
      <div className="flex flex-col flex-1 overflow-hidden">
        <HeaderBar />
        <main className="flex-1 overflow-hidden">
          <AnalyticsTerminal />
        </main>
      </div>
    </div>
  );
}

