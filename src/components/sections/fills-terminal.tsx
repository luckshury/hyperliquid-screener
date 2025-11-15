"use client";

import { useState, useMemo, memo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useWebSocket } from "@/contexts/websocket-context";

// Memoized fill row component - only re-renders if its data changes
const FillRow = memo(({ fill, index }: { fill: any; index: number }) => {
  const formatPrice = (price: number) => {
    if (price >= 1000) return price.toFixed(2);
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };

  const formatSize = (size: number) => {
    return size.toFixed(4);
  };

  const formatValue = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  return (
    <tr className="border-b border-border/50 hover:bg-accent/5 transition-none">
      <td className="px-4 py-2 text-xs text-muted-foreground">{index + 1}</td>
      <td className="px-4 py-2">
        <span className="text-sm font-bold text-primary">{fill.coin}</span>
      </td>
      <td className="px-4 py-2">
        <span className={cn(
          "px-2 py-0.5 rounded text-xs font-semibold",
          fill.side === 'B' ? "bg-terminal-green/10 text-terminal-green" : "bg-terminal-red/10 text-terminal-red"
        )}>
          {fill.side === 'B' ? 'BUY' : 'SELL'}
        </span>
      </td>
      <td className="px-4 py-2 text-right">
        <span className="text-sm font-mono">${formatPrice(fill.price)}</span>
      </td>
      <td className="px-4 py-2 text-right">
        <span className="text-sm font-mono">{formatSize(fill.size)}</span>
      </td>
      <td className="px-4 py-2 text-right">
        <span className="text-sm font-semibold">{formatValue(fill.value)}</span>
      </td>
      <td className="px-4 py-2">
        <span className="text-xs text-muted-foreground">{fill.direction}</span>
      </td>
      <td className="px-4 py-2 text-right">
        <span className={cn(
          "text-sm font-semibold",
          fill.pnl >= 0 ? "text-terminal-green" : "text-terminal-red"
        )}>
          {fill.pnl >= 0 ? '+' : ''}{formatValue(fill.pnl)}
        </span>
      </td>
      <td className="px-4 py-2">
        <span className="text-xs font-mono text-muted-foreground">{fill.address}</span>
      </td>
    </tr>
  );
});

FillRow.displayName = 'FillRow';

const FillsTerminal = () => {
  const { fills, fillsStats, isConnected, fillsStreamActive, setFillsStreamActive, clearFills } = useWebSocket();
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [coinFilter, setCoinFilter] = useState('');
  const [sideFilter, setSideFilter] = useState('');
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const playFillSound = () => {
    // Simple beep using Web Audio API
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      console.error('Failed to play sound:', e);
    }
  };

  const toggleStream = () => {
    setFillsStreamActive(!fillsStreamActive);
  };

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
  };

  // Format functions for stats display
  const formatValue = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  // Memoize filtered fills with aggressive optimization
  const displayedFills = useMemo(() => {
    let filtered = fills;

    if (coinFilter) {
      const lowerFilter = coinFilter.toLowerCase();
      filtered = filtered.filter(fill => fill.coin.toLowerCase().includes(lowerFilter));
    }

    if (sideFilter) {
      filtered = filtered.filter(fill => fill.side === sideFilter);
    }

    // Limit to last 500 fills for maximum performance (was 1000)
    return filtered.slice(0, 500);
  }, [fills, coinFilter, sideFilter]);

  return (
    <div className="terminal-border bg-card rounded-lg overflow-hidden shadow-[0_0_10px_rgba(151,253,229,0.1)]">
      <div className="bg-secondary/50 border-b border-border px-4 py-3">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-page-heading text-primary">
            ALL FILLS STREAM
          </h2>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-[var(--terminal-green)] animate-pulse" : "bg-[var(--terminal-red)]"
            )} />
            <span className="text-xs text-muted-foreground">
              {isConnected ? 'STREAMING' : 'DISCONNECTED'}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-3">
          <div className="bg-background/50 rounded px-3 py-2">
            <div className="text-xs text-muted-foreground">Displayed</div>
            <div className="text-lg font-bold text-primary">{displayedFills.length.toLocaleString()}</div>
          </div>
          <div className="bg-background/50 rounded px-3 py-2">
            <div className="text-xs text-muted-foreground">Total Fills</div>
            <div className="text-lg font-bold text-primary">{fills.length.toLocaleString()}</div>
          </div>
          <div className="bg-background/50 rounded px-3 py-2">
            <div className="text-xs text-muted-foreground">Total Volume</div>
            <div className="text-lg font-bold text-primary">{formatValue(fillsStats.totalVolume)}</div>
          </div>
          <div className="bg-background/50 rounded px-3 py-2">
            <div className="text-xs text-muted-foreground">Fills/Min</div>
            <div className="text-lg font-bold text-primary">{fillsStats.fillsPerMinute}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Filter by coin (e.g., BTC, ETH)..."
            value={coinFilter}
            onChange={(e) => setCoinFilter(e.target.value)}
            className="flex-1 px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <select
            value={sideFilter}
            onChange={(e) => setSideFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Sides</option>
            <option value="A">Ask (Sell)</option>
            <option value="B">Bid (Buy)</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={toggleStream}
            className={cn(
              "px-4 py-2 border border-border rounded text-sm transition-none",
              fillsStreamActive ? "bg-[var(--terminal-green)] text-black" : "bg-background"
            )}
          >
            {fillsStreamActive ? 'STREAM: ON' : 'STREAM: OFF'}
          </button>
          <button
            onClick={toggleSound}
            className={cn(
              "px-4 py-2 border border-border rounded text-sm transition-none",
              soundEnabled ? "bg-[var(--terminal-green)] text-black" : "bg-background"
            )}
          >
            {soundEnabled ? 'SOUND: ON' : 'SOUND: OFF'}
          </button>
          <button
            onClick={clearFills}
            className="px-4 py-2 bg-background border border-border rounded text-sm hover:bg-accent transition-none"
          >
            CLEAR
          </button>
          <button
            onClick={() => setCoinFilter('')}
            className="px-4 py-2 bg-background border border-border rounded text-sm hover:bg-accent transition-none"
          >
            RESET FILTERS
          </button>
        </div>
      </div>

      <div ref={tableContainerRef} className="overflow-x-auto max-h-[calc(100vh-380px)] overflow-y-auto will-change-scroll">
        <table className="w-full">
          <thead className="bg-secondary/30 border-b border-border sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Coin</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Side</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Price</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Size</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Value</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Direction</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">PnL</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Address</th>
            </tr>
          </thead>
          <tbody>
            {displayedFills.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  {fills.length === 0 
                    ? (isConnected ? 'Waiting for fills...' : 'Connecting to WebSocket...')
                    : 'No fills match your filter'
                  }
                </td>
              </tr>
            ) : (
              displayedFills.map((fill, index) => (
                <FillRow key={`${fill.hash}-${fill.timestamp}-${index}`} fill={fill} index={index} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default memo(FillsTerminal);

