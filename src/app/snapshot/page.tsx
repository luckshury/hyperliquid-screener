"use client";

import SidebarNavigation from "@/components/sections/sidebar-navigation";
import HeaderBar from "@/components/sections/header-bar";
import PerpSnapshotTerminal from "@/components/perp-snapshot-terminal";

export default function SnapshotPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SidebarNavigation />
      <div className="flex flex-col flex-1 overflow-hidden">
        <HeaderBar />
        <main className="flex-1 overflow-hidden">
          <PerpSnapshotTerminal />
        </main>
      </div>
    </div>
  );
}

