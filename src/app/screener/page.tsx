import SidebarNavigation from "@/components/sections/sidebar-navigation";
import HeaderBar from "@/components/sections/header-bar";
import ScreenerTerminal from "@/components/sections/screener-terminal";

export default function ScreenerPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SidebarNavigation />
      
      <div className="flex flex-1 flex-col overflow-hidden">
        <HeaderBar />
        
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6">
            <ScreenerTerminal />
          </div>
        </main>
      </div>
    </div>
  );
}
