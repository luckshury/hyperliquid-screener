import React from 'react';

const newsItems = [
  { time: "14:32", headline: "Bitcoin perpetual futures hit key resistance on institutional demand" },
  { time: "13:15", headline: "Ethereum network upgrade drives perpetual swap volume surge" },
  { time: "12:08", headline: "Major exchange expands USDT perpetual offerings for altcoins" },
  { time: "11:45", headline: "Funding rates turn positive as crypto derivatives market heats up" },
  { time: "10:22", headline: "Open i..." },
];

const DerivativesNewsPanel = () => {
  return (
    <div className="terminal-border flex flex-col bg-card rounded">
      <div className="flex items-center justify-between border-b border-border px-3 sm:px-4 py-2 bg-secondary/30">
        <h3 className="text-xs sm:text-sm font-bold text-primary terminal-glow">
          DERIVATIVES NEWS
        </h3>
      </div>
      <div className="flex-1 p-3 sm:p-4">
        <div className="space-y-2 sm:space-y-3">
          {newsItems.map((item, index) => (
            <div
              key={index}
              className="flex gap-2 sm:gap-4 py-2 sm:py-3 border-b border-border/50 last:border-0 hover:bg-accent/10 px-2 rounded transition-all duration-150 cursor-pointer"
            >
              <div className="text-xs text-primary font-bold w-10 sm:w-12 flex-shrink-0">
                {item.time}
              </div>
              <div className="text-xs sm:text-sm flex-1">
                {item.headline}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DerivativesNewsPanel;