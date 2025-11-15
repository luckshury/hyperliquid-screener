"use client";

import { memo, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, Zap, BarChart3 } from 'lucide-react';
import { useWebSocket } from '@/contexts/websocket-context';
import { cn } from '@/lib/utils';

const formatPrice = (price: number): string => {
  if (price < 1) {
    return `$${price.toFixed(4)}`;
  }
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatVolume = (volume: number): string => {
  if (volume >= 1000000000) {
    return `$${(volume / 1000000000).toFixed(2)}B`;
  }
  if (volume >= 1000000) {
    return `$${(volume / 1000000).toFixed(2)}M`;
  }
  return `$${(volume / 1000).toFixed(2)}K`;
};

// Individual widget component
const MiniWidget = memo(({ 
  symbol, 
  price, 
  change, 
  volume,
  oraclePrice,
  spread 
}: { 
  symbol: string; 
  price: number; 
  change: number; 
  volume?: number;
  oraclePrice?: number;
  spread?: number;
}) => {
  const isPositive = change >= 0;
  
  return (
    <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-all duration-200 hover:shadow-[0_0_15px_rgba(255,186,0,0.15)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <span className="font-bold text-lg text-foreground">{symbol}</span>
        </div>
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold",
          isPositive ? "bg-terminal-green/10 text-terminal-green" : "bg-terminal-red/10 text-terminal-red"
        )}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isPositive ? '+' : ''}{change.toFixed(2)}%
        </div>
      </div>

      {/* Price */}
      <div className="mb-3">
        <div className="text-xs text-muted-foreground mb-1">Mark Price</div>
        <div className="text-2xl font-bold text-primary">{formatPrice(price)}</div>
      </div>

      {/* Additional Info */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {oraclePrice && (
          <div>
            <div className="text-muted-foreground">Oracle</div>
            <div className="font-semibold">{formatPrice(oraclePrice)}</div>
          </div>
        )}
        {spread !== null && spread !== undefined && (
          <div>
            <div className="text-muted-foreground">Spread</div>
            <div className="font-semibold">{spread.toFixed(4)}%</div>
          </div>
        )}
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/50">
        <div className="h-1.5 w-1.5 rounded-full bg-terminal-green animate-pulse" />
        <span className="text-[10px] text-muted-foreground uppercase">Live</span>
      </div>
    </div>
  );
});

MiniWidget.displayName = 'MiniWidget';

const MiniWidgets = () => {
  const { assets, isConnected, fillsStats } = useWebSocket();

  // Get featured assets for widgets
  const featuredAssets = useMemo(() => {
    const featured = ['BTC', 'ETH', 'SOL', 'HYPE', 'DOGE', 'AVAX'];
    return featured
      .map(symbol => assets.find(a => a.symbol === symbol))
      .filter(Boolean)
      .slice(0, 6);
  }, [assets]);

  // Calculate market stats
  const marketStats = useMemo(() => {
    const totalAssets = assets.length;
    const gainers = assets.filter(a => a.change24h > 0).length;
    const losers = assets.filter(a => a.change24h < 0).length;
    const avgChange = assets.length > 0 
      ? assets.reduce((sum, a) => sum + a.change24h, 0) / assets.length 
      : 0;

    return { totalAssets, gainers, losers, avgChange };
  }, [assets]);

  return (
    <div className="space-y-4">
      {/* Market Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total Assets</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{marketStats.totalAssets}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {isConnected ? 'Live' : 'Connecting...'}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-terminal-green" />
            <span className="text-xs text-muted-foreground">Gainers</span>
          </div>
          <div className="text-2xl font-bold text-terminal-green">{marketStats.gainers}</div>
          <div className="text-xs text-muted-foreground mt-1">
            24h positive
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-terminal-red" />
            <span className="text-xs text-muted-foreground">Losers</span>
          </div>
          <div className="text-2xl font-bold text-terminal-red">{marketStats.losers}</div>
          <div className="text-xs text-muted-foreground mt-1">
            24h negative
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Fills/Min</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{fillsStats.fillsPerMinute}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Live activity
          </div>
        </div>
      </div>

      {/* Featured Assets Widgets */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Featured Markets</h2>
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-2 w-2 rounded-full",
              isConnected ? "bg-terminal-green animate-pulse" : "bg-terminal-red"
            )} />
            <span className="text-xs text-muted-foreground">
              {isConnected ? 'Live Data' : 'Connecting...'}
            </span>
          </div>
        </div>

        {featuredAssets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredAssets.map((asset: any) => (
              <MiniWidget
                key={asset.symbol}
                symbol={asset.symbol}
                price={asset.price}
                change={asset.change24h}
                oraclePrice={asset.oraclePrice}
                spread={asset.spread}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-8 w-8 rounded-full bg-muted" />
                  <div className="h-6 w-16 rounded bg-muted" />
                </div>
                <div className="h-8 w-32 rounded bg-muted mb-3" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-10 rounded bg-muted" />
                  <div className="h-10 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Movers */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Top Movers (24h)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Gainers */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-5 w-5 text-terminal-green" />
              <h3 className="font-semibold text-foreground">Top Gainers</h3>
            </div>
            <div className="space-y-2">
              {assets
                .filter(a => a.change24h > 0)
                .sort((a, b) => b.change24h - a.change24h)
                .slice(0, 5)
                .map((asset, idx) => (
                  <div key={asset.symbol} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{idx + 1}</span>
                      <span className="font-semibold text-sm">{asset.symbol}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{formatPrice(asset.price)}</div>
                      <div className="text-xs text-terminal-green">+{asset.change24h.toFixed(2)}%</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Top Losers */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-5 w-5 text-terminal-red" />
              <h3 className="font-semibold text-foreground">Top Losers</h3>
            </div>
            <div className="space-y-2">
              {assets
                .filter(a => a.change24h < 0)
                .sort((a, b) => a.change24h - b.change24h)
                .slice(0, 5)
                .map((asset, idx) => (
                  <div key={asset.symbol} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{idx + 1}</span>
                      <span className="font-semibold text-sm">{asset.symbol}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{formatPrice(asset.price)}</div>
                      <div className="text-xs text-terminal-red">{asset.change24h.toFixed(2)}%</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(MiniWidgets);

