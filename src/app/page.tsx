import SidebarNavigation from "@/components/sections/sidebar-navigation";
import HeaderBar from "@/components/sections/header-bar";
import MiniWidgets from "@/components/sections/mini-widgets";
import MarketCardsGrid from "@/components/sections/market-cards-grid";
import LiveChartPanel from "@/components/sections/live-chart-panel";
import TopMoversPanel from "@/components/sections/top-movers-panel";
import DerivativesNewsPanel from "@/components/sections/derivatives-news-panel";
import PerpetualsWatchlistPanel from "@/components/sections/perpetuals-watchlist-panel";

export default function Page() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SidebarNavigation />
      
      <div className="flex flex-1 flex-col overflow-hidden">
        <HeaderBar />
        
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Mini Widgets - Live Hyperliquid Prices */}
            <MiniWidgets />
            
            <MarketCardsGrid />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <LiveChartPanel />
              <TopMoversPanel />
            </div>
            
            <DerivativesNewsPanel />
            
            <PerpetualsWatchlistPanel />
          </div>
        </main>
      </div>
    </div>
  );
}