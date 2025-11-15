import SidebarNavigation from "@/components/sections/sidebar-navigation";
import HeaderBar from "@/components/sections/header-bar";
import FillsTerminal from "@/components/sections/fills-terminal";

export default function FillsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SidebarNavigation />
      
      <div className="flex flex-1 flex-col overflow-hidden">
        <HeaderBar />
        
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6">
            <FillsTerminal />
          </div>
        </main>
      </div>
    </div>
  );
}

