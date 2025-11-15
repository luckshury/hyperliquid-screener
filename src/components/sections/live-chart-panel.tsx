import React from "react";

const LiveChartPanel = () => {
  return (
    <div className="terminal-border flex flex-col bg-card lg:col-span-2 h-64 sm:h-80 md:h-96 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 sm:px-4 py-2 bg-secondary/30">
        <h3
          className="text-xs sm:text-sm font-bold text-primary"
          style={{ textShadow: "0 0 8px rgba(249, 115, 22, 0.5)" }}
        >
          LIVE MARKET STREAM - BTCUSDT
        </h3>
      </div>
      <div className="flex-1 p-3 sm:p-4">
        {/* Placeholder for the TradingView-style lightweight chart */}
        <div className="h-full w-full bg-background rounded-sm" />
      </div>
    </div>
  );
};

export default LiveChartPanel;