import { ArrowDown, ArrowUp } from "lucide-react";

const MarketCardsGrid = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div className="terminal-border bg-card rounded p-3 sm:p-4 hover:bg-accent/10 transition-all duration-200 cursor-pointer relative ring-2 ring-primary shadow-lg shadow-primary/20">
        <div className="absolute top-2 right-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(151,253,229,0.8)]"></div>
        </div>
        <div className="text-xs text-muted-foreground mb-2">Bitcoin</div>
        <div className="text-xl sm:text-2xl font-bold mb-1">$95733.70</div>
        <div className="flex items-center gap-2 text-xs sm:text-sm transition-colors duration-200 text-[var(--terminal-red)]">
          <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4" />
          <span>-1146.30</span>
          <span>(-1.18%)</span>
        </div>
      </div>
      <div className="terminal-border bg-card rounded p-3 sm:p-4 hover:bg-accent/10 transition-all duration-200 cursor-pointer relative">
        <div className="text-xs text-muted-foreground mb-2">Ethereum</div>
        <div className="text-xl sm:text-2xl font-bold mb-1">$3147.20</div>
        <div className="flex items-center gap-2 text-xs sm:text-sm transition-colors duration-200 text-[var(--terminal-red)]">
          <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4" />
          <span>-21.41</span>
          <span>(-0.68%)</span>
        </div>
      </div>
      <div className="terminal-border bg-card rounded p-3 sm:p-4 hover:bg-accent/10 transition-all duration-200 cursor-pointer relative">
        <div className="text-xs text-muted-foreground mb-2">Solana</div>
        <div className="text-xl sm:text-2xl font-bold mb-1">$140.76</div>
        <div className="flex items-center gap-2 text-xs sm:text-sm transition-colors duration-200 text-[var(--terminal-red)]">
          <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4" />
          <span>-0.67</span>
          <span>(-0.47%)</span>
        </div>
      </div>
      <div className="terminal-border bg-card rounded p-3 sm:p-4 hover:bg-accent/10 transition-all duration-200 cursor-pointer relative">
        <div className="text-xs text-muted-foreground mb-2">BNB</div>
        <div className="text-xl sm:text-2xl font-bold mb-1">$930.90</div>
        <div className="flex items-center gap-2 text-xs sm:text-sm transition-colors duration-200 text-[var(--terminal-green)]">
          <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4" />
          <span>+19.80</span>
          <span>(+2.17%)</span>
        </div>
      </div>
    </div>
  );
};

export default MarketCardsGrid;