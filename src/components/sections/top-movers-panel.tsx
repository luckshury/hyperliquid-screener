import React from 'react';

type Mover = {
  ticker: string;
  name: string;
  price: string;
  change: number;
};

const topMoversData: Mover[] = [
  { ticker: 'ADA', name: 'Cardano', price: '$0.5012', change: -2.85 },
  { ticker: 'LINK', name: 'Chainlink', price: '$13.95', change: -1.66 },
  { ticker: 'UNI', name: 'Uniswap', price: '$7.28', change: 1.34 },
  { ticker: 'XRP', name: 'Ripple', price: '$2.25', change: -1.32 },
  { ticker: 'AVAX', name: 'Avalanche', price: '$15.36', change: -1.16 },
];

const TopMoversPanel = () => {
  return (
    <div className="terminal-border flex flex-col bg-card rounded h-64 sm:h-80 md:h-96">
      <div className="flex items-center justify-between border-b border-border px-3 sm:px-4 py-2 bg-secondary/30">
        <h3 className="text-xs sm:text-sm font-bold text-primary [text-shadow:0_0_8px_rgba(249,115,22,0.5)]">
          TOP MOVERS
        </h3>
      </div>
      <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
        <div className="space-y-2 sm:space-y-3">
          {topMoversData.map((mover, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 hover:bg-accent/10 px-2 rounded transition-all duration-150 cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs sm:text-sm truncate">{mover.ticker}</div>
                <div className="text-xs text-muted-foreground truncate">{mover.name}</div>
              </div>
              <div className="text-right ml-2 flex-shrink-0">
                <div className="text-xs sm:text-sm font-semibold">{mover.price}</div>
                <div
                  className={`text-xs transition-colors duration-200 ${
                    mover.change >= 0 ? 'text-terminal-green' : 'text-terminal-red'
                  }`}
                >
                  {mover.change >= 0 ? '+' : ''}
                  {mover.change.toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TopMoversPanel;