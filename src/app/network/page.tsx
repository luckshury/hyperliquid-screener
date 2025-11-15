import SidebarNavigation from "@/components/sections/sidebar-navigation";
import HeaderBar from "@/components/sections/header-bar";
import NetworkGraph from "@/components/sections/network-graph";

export default function NetworkPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SidebarNavigation />
      
      <div className="flex flex-1 flex-col overflow-hidden">
        <HeaderBar />
        
        <main className="flex-1 overflow-hidden">
          <NetworkGraph />
        </main>
      </div>
    </div>
  );
}

