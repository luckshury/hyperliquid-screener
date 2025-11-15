"use client";

import { useState, useMemo, memo, useEffect, useRef, useCallback, useId } from "react";
import { useWebSocket } from "@/contexts/websocket-context";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { encoreClient } from "@/lib/encore-client";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  YAxis,
} from "recharts";

const formatPrice = (price: number): string => {
  if (price < 0.01) {
    return price.toFixed(6);
  }
  if (price < 1) {
    return price.toFixed(4);
  }
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
};

const formatVolume = (volume: number): string => {
  if (volume >= 1000000) {
    return `$${(volume / 1000000).toFixed(1)}M`;
  }
  if (volume >= 1000) {
    return `$${(volume / 1000).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
};

const RANGE_HOURS: Record<string, number> = {
  "1H": 1,
  "4H": 4,
  "1D": 24,
  "7D": 168,
  "30D": 720,
};

const getTimeAgoLabel = (index: number, totalPoints: number, rangeFilter: string) => {
  if (totalPoints <= 1) return "Now";

  const hours = RANGE_HOURS[rangeFilter] ?? 24;
  const hoursPerPoint = hours / totalPoints;
  const pointsFromEnd = totalPoints - 1 - index;
  const hoursAgo = pointsFromEnd * hoursPerPoint;

  if (index === totalPoints - 1 || hoursAgo <= 0) return "Now";
  if (hoursAgo < 1) return `${Math.round(hoursAgo * 60)}m ago`;
  if (hoursAgo < 24) return `${Math.round(hoursAgo)}h ago`;
  return `${Math.round(hoursAgo / 24)}d ago`;
};

type MiniChartTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ value: number; payload: { index: number } }>;
  rangeFilter: string;
  totalPoints: number;
};

const MiniChartTooltip = ({ active, payload, rangeFilter, totalPoints }: MiniChartTooltipProps) => {
  if (!active || !payload?.length) return null;

  const price = payload[0].value ?? 0;
  const pointIndex = payload[0].payload?.index ?? totalPoints - 1;
  const timeLabel = getTimeAgoLabel(pointIndex, totalPoints, rangeFilter);

  return (
    <div className="bg-black/90 border border-[#00ff88]/30 rounded px-2 py-1 text-xs text-white whitespace-nowrap shadow-lg">
      <div className="font-semibold">${formatPrice(price)}</div>
      <div className="text-[9px] text-gray-400">{timeLabel}</div>
    </div>
  );
};

// Recharts-based sparkline with tooltip and proper scaling
const MiniChart = memo(({ data, isPositive, rangeFilter }: { data: number[]; isPositive: boolean; rangeFilter: string }) => {
  const gradientId = useId();
  const chartData = useMemo(() => data.map((value, index) => ({ index, value })), [data]);
  const strokeColor = isPositive ? "#00ff88" : "#ff4444";

  // Calculate proper domain with padding for better visualization
  const { minValue, maxValue } = useMemo(() => {
    if (chartData.length === 0) return { minValue: 0, maxValue: 1 };
    
    const values = chartData.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    // Add 10% padding on top and bottom for better visual spacing
    const padding = range * 0.1 || max * 0.05 || 0.1;
    
    return {
      minValue: min - padding,
      maxValue: max + padding
    };
  }, [chartData]);

  if (chartData.length === 0) {
    return <div className="w-full h-full" />;
  }

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis 
            domain={[minValue, maxValue]} 
            hide 
          />
          <RechartsTooltip
            cursor={{ stroke: "rgba(255,255,255,0.2)", strokeWidth: 1 }}
            content={(props) => (
              <MiniChartTooltip
                {...props}
                rangeFilter={rangeFilter}
                totalPoints={chartData.length}
              />
            )}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

MiniChart.displayName = 'MiniChart';

// Asset card component with historical data fetching
const AssetCard = memo(({ 
  asset, 
  rangeFilter,
  onFetchHistory,
  crazyMode = false,
  showCharts = true
}: { 
  asset: any; 
  rangeFilter: string;
  onFetchHistory: (symbol: string, range: string) => Promise<number[]>;
  crazyMode?: boolean;
  showCharts?: boolean;
}) => {
  const [chartData, setChartData] = useState<number[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [rangeChange, setRangeChange] = useState<number>(0);
  const [isVisible, setIsVisible] = useState(false);

  // Store historical data separately to prevent chart flashing
  const historicalDataRef = useRef<number[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  // Load immediately instead of waiting for intersection
  useEffect(() => {
    // Set visible immediately for instant loading from cache
    setIsVisible(true);
  }, []);

  // Fetch historical data when range or symbol changes (only if visible and charts enabled)
  useEffect(() => {
    if (!isVisible || !showCharts) return; // Don't load until visible and charts enabled
    
    let isMounted = true;
    
    const loadData = async () => {
      setIsLoadingChart(true);
      try {
        const historicalData = await onFetchHistory(asset.symbol, rangeFilter);
        
        if (!isMounted) return;

        if (historicalData.length > 0) {
          historicalDataRef.current = historicalData;
          const fallbackPrice = historicalData[historicalData.length - 1];
          const livePrice = asset.price > 0 ? asset.price : fallbackPrice;
          const completeData = [...historicalData, livePrice];
          setChartData(completeData);

          const startPrice = historicalData[0];
          if (startPrice > 0 && livePrice > 0) {
            const change = ((livePrice - startPrice) / startPrice) * 100;
            setRangeChange(change);
          } else {
            setRangeChange(0);
          }
        } else {
          historicalDataRef.current = [];
          setChartData([]);
          setRangeChange(0);
        }
      } catch (error) {
        if (isMounted) {
          historicalDataRef.current = [];
          setChartData([]);
          setRangeChange(0);
        }
      } finally {
        if (isMounted) {
          setIsLoadingChart(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [asset.symbol, rangeFilter, onFetchHistory, isVisible, showCharts]);

  // Update only the % change when live price changes (don't update chart data to prevent flashing)
  useEffect(() => {
    if (historicalDataRef.current.length > 0) {
      const startPrice = historicalDataRef.current[0];
      const lastKnownPrice = historicalDataRef.current[historicalDataRef.current.length - 1];
      const currentPrice = asset.price > 0 ? asset.price : lastKnownPrice;

      if (startPrice > 0 && currentPrice > 0) {
        const change = ((currentPrice - startPrice) / startPrice) * 100;
        setRangeChange(change);
      }
      
      // Update only the last point in chart data (live price)
      setChartData([...historicalDataRef.current, currentPrice]);
    }
  }, [asset.price]);

  // Use WebSocket 24h change when charts are disabled, otherwise use calculated range change
  const displayChange = showCharts ? rangeChange : asset.change24h;
  const isPositive = displayChange >= 0;

  return (
    <div 
      ref={cardRef}
      className={cn(
        "bg-[#0a0a0a] border border-[#1a1a1a] rounded hover:border-[#00ff88]/50 hover:shadow-[0_0_10px_rgba(0,255,136,0.15)] transition-all duration-75 cursor-pointer group",
        crazyMode ? "p-1.5" : "p-3"
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-start justify-between",
        crazyMode ? "mb-1" : "mb-2"
      )}>
        <div>
          <div className={cn(
            "font-bold text-white",
            crazyMode ? "text-[11px] mb-0" : "text-sm mb-0.5"
          )}>{asset.symbol}</div>
          <div className={cn(
            "font-semibold",
            crazyMode ? "text-[9px]" : "text-xs",
            isPositive ? "text-[#00ff88]" : "text-[#ff4444]"
          )}>
            {isPositive ? '+' : ''}{displayChange.toFixed(2)}%
          </div>
        </div>
        {!crazyMode && (
          <div className="text-[9px] text-gray-500 uppercase font-medium">{rangeFilter}</div>
        )}
      </div>

      {/* Mini Chart - only show if charts enabled */}
      {showCharts && (
        <div className={cn("relative", crazyMode ? "h-5 mb-1" : "h-10 mb-2")}>
          {isLoadingChart ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex gap-1">
                <div className="h-1 w-1 bg-gray-500 rounded-full animate-pulse" />
                <div className="h-1 w-1 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="h-1 w-1 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          ) : chartData.length > 0 ? (
            <>
              <MiniChart data={chartData} isPositive={isPositive} rangeFilter={rangeFilter} />
              {/* Show indicator if historical data is sparse */}
              {chartData.length < 10 && (
                <div className="absolute top-0 right-0 text-[8px] text-yellow-500/70 font-medium">
                  Building...
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-[9px] text-gray-600">
              No data
            </div>
          )}
        </div>
      )}

      {/* Price Info - Live from WebSocket */}
      {crazyMode ? (
        // Compact layout for crazy mode
        <div className="text-center">
          <div className="text-xs font-semibold text-white">
            {asset.price > 0 ? `$${formatPrice(asset.price)}` : (
              <span className="text-gray-600">Loading...</span>
            )}
          </div>
        </div>
      ) : (
        // Normal layout
        <div className="space-y-1">
          {/* Large Price Display */}
          <div className="text-center">
            <div className="text-lg font-bold text-white">
              {asset.price > 0 ? `$${formatPrice(asset.price)}` : (
                <span className="text-gray-600 text-sm">Loading...</span>
              )}
            </div>
          </div>
          
          {/* Spread */}
          {asset.spread !== null && asset.spread !== undefined && (
            <div className="flex justify-between items-center pt-1 border-t border-[#1a1a1a]">
              <span className="text-[10px] text-gray-500">Spread</span>
              <span className="text-xs text-gray-400">{asset.spread.toFixed(4)}%</span>
            </div>
          )}
        </div>
      )}

      {/* Live indicator - only in normal mode */}
      {!crazyMode && (
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-[#1a1a1a]">
          <div className="h-1 w-1 rounded-full bg-[#00ff88] animate-pulse" />
          <span className="text-[9px] text-gray-500 uppercase">Live</span>
        </div>
      )}
    </div>
  );
});

AssetCard.displayName = 'AssetCard';

// List row component
const AssetRow = memo(({ asset, index }: { asset: any; index: number }) => {
  const isPositive = asset.change24h >= 0;

  return (
    <div className="flex items-center justify-between py-2 px-3 border-b border-[#1a1a1a] hover:bg-[#0f0f0f] hover:border-[#00ff88]/20 transition-all duration-75 cursor-pointer">
      <div className="flex items-center gap-3 flex-1">
        <span className="text-xs text-gray-600 w-8">{index + 1}</span>
        <span className="text-sm font-bold text-white min-w-[80px]">{asset.symbol}</span>
      </div>
      <div className="flex items-center gap-6 flex-1 justify-end">
        <span className="text-sm text-white min-w-[100px] text-right">${formatPrice(asset.price)}</span>
        <span className={cn(
          "text-sm font-semibold min-w-[80px] text-right",
          isPositive ? "text-[#00ff88]" : "text-[#ff4444]"
        )}>
          {isPositive ? '+' : ''}{asset.change24h.toFixed(2)}%
        </span>
        {asset.spread !== null && asset.spread !== undefined && (
          <span className="text-sm text-gray-400 min-w-[80px] text-right">{asset.spread.toFixed(4)}%</span>
        )}
      </div>
    </div>
  );
});

AssetRow.displayName = 'AssetRow';

const HybridWatchlist = memo(({ assets }: { assets: any[] }) => {
  const rows = useMemo(() => assets.slice(0, 40), [assets]);
  const stats = useMemo(() => {
    const gainers = rows.filter((asset) => asset.change24h > 0).length;
    const losers = rows.filter((asset) => asset.change24h < 0).length;
    return { gainers, losers };
  }, [rows]);

  return (
    <div className="h-full bg-[#050505] border border-[#0f0f0f] rounded-lg flex flex-col shadow-[0_0_25px_rgba(0,0,0,0.45)] font-mono text-[11px]">
      <div className="px-3 py-2 border-b border-[#111] flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold text-white uppercase tracking-[0.2em]">ATV WATCH</div>
          <div className="text-[10px] text-gray-500 tracking-tight">LIVE {rows.length} mkts</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-[#00ff88] font-semibold">▲ {stats.gainers}</div>
          <div className="text-[11px] text-[#ff4444] font-semibold">▼ {stats.losers}</div>
        </div>
      </div>
      <div className="grid grid-cols-[1.2fr,0.9fr,0.8fr] gap-2 text-[10px] text-gray-500 uppercase tracking-[0.3em] px-3 py-1.5 border-b border-[#111]">
        <div>SYM</div>
        <div className="text-right">PX</div>
        <div className="text-right">Δ24H</div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar-thin">
        {rows.map((asset) => {
          const isPositive = asset.change24h >= 0;
          return (
            <div
              key={`hybrid-${asset.symbol}`}
              className="grid grid-cols-[1.2fr,0.9fr,0.8fr] gap-2 px-3 py-1.5 border-b border-[#0d0d0d] hover:bg-[#0f0f0f] hover:border-[#00ff88]/10 transition-all duration-50"
            >
              <div className="text-[11px] font-semibold text-white truncate">{asset.symbol}</div>
              <div className="text-[11px] text-right text-gray-200">
                {asset.price > 0 ? `$${formatPrice(asset.price)}` : '—'}
              </div>
              <div
                className={cn(
                  "text-[11px] text-right font-semibold",
                  isPositive ? "text-[#00ff88]" : "text-[#ff4444]"
                )}
              >
                {isPositive ? '+' : ''}
                {asset.change24h.toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

HybridWatchlist.displayName = 'HybridWatchlist';

// Simple Mode - minimal ticker/price list like the image
const SimpleList = memo(({ assets, sortBy }: { assets: any[]; sortBy: string }) => {
  const [sortAsc, setSortAsc] = useState(false);

  const sortedAssets = useMemo(() => {
    const sorted = [...assets];
    if (sortBy === 'symbol') {
      return sorted.sort((a, b) => 
        sortAsc ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol)
      );
    } else if (sortBy === 'price') {
      return sorted.sort((a, b) => 
        sortAsc ? a.price - b.price : b.price - a.price
      );
    }
    return sorted;
  }, [assets, sortBy, sortAsc]);

  return (
    <div className="h-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-black border-b border-[#1a1a1a] grid grid-cols-2 px-4 py-3 sticky top-0 z-10">
        <button 
          onClick={() => setSortAsc(!sortAsc)}
          className="text-left text-sm font-semibold text-white uppercase tracking-wide flex items-center gap-2 hover:text-[#00ff88] transition-colors"
        >
          Symbol 
          <span className="text-xs text-[#00ff88]">{sortAsc ? '▲' : '▼'}</span>
        </button>
        <div className="text-right text-sm font-semibold text-white uppercase tracking-wide flex items-center justify-end gap-2">
          Price
          <span className="text-xs text-[#00ff88]">{sortAsc ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {sortedAssets.map((asset) => (
          <div
            key={asset.symbol}
            className="grid grid-cols-2 px-4 py-2.5 border-b border-[#1a1a1a] hover:bg-[#0f0f0f] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {asset.symbol.includes('/') && (
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-[10px] font-bold text-white">
                  {asset.symbol.split('/')[0].slice(0, 2)}
                </div>
              )}
              <span className="text-sm font-semibold text-white">{asset.symbol}</span>
            </div>
            <div className="text-right text-sm font-medium text-white">
              {asset.price > 0 ? formatPrice(asset.price) : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

SimpleList.displayName = 'SimpleList';

const ScreenerTerminal = () => {
  const { assets, isConnected, isInitialized, getChartData: getRingBufferData, hasChartData: hasRingBufferData } = useWebSocket();
  const [searchText, setSearchText] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'gain' | 'price' | 'symbol' | 'spread'>('symbol'); // Default to symbol to prevent reshuffling
  const [rangeFilter, setRangeFilter] = useState<'1H' | '4H' | '1D' | '7D' | '30D'>('1D');
  const [gainFilter, setGainFilter] = useState<'All' | 'High-Low' | 'Low-High'>('All');
  const [crazyMode, setCrazyMode] = useState(false);
  const [showCharts, setShowCharts] = useState(false); // Charts OFF by default - instant loading like perpsmoney.xyz
  const [hybridMode, setHybridMode] = useState(false);
  const [simpleMode, setSimpleMode] = useState(false);
  
  // Cache for historical data with localStorage persistence
  const historicalDataCache = useRef<Map<string, {
    range: string;
    data: number[];
    fetchedAt: number;
  }>>(new Map());

  // Load cache from localStorage on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('screener-chart-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        historicalDataCache.current = new Map(Object.entries(parsed));
        console.log(`📦 Loaded ${historicalDataCache.current.size} cached charts from localStorage`);
      }
    } catch (error) {
      console.error('Failed to load cache from localStorage:', error);
    }
  }, []);

  // Save cache to localStorage periodically
  useEffect(() => {
    const saveCache = () => {
      try {
        const cacheObj = Object.fromEntries(historicalDataCache.current.entries());
        localStorage.setItem('screener-chart-cache', JSON.stringify(cacheObj));
      } catch (error) {
        console.error('Failed to save cache to localStorage:', error);
      }
    };

    const interval = setInterval(saveCache, 60000); // Save every minute
    return () => clearInterval(interval);
  }, []);

  const fetchChartsFromServer = useCallback(
    async (symbols: string[], range: string): Promise<Record<string, number[]>> => {
      if (!symbols.length) return {};

      try {
        const response = await encoreClient.chartCache.get({ symbols, range });
        return response?.data ?? {};
      } catch (error) {
        console.error('chart-cache fetch failed:', error);
        return {};
      }
    },
    [],
  );

  // Fetch historical data for charts from Hyperliquid candleSnapshot API
  const initialPrefetchRef = useRef(false);
  const lastPrefetchRangeRef = useRef<string | null>(null);

  useEffect(() => {
    if (assets.length === 0) return;

    const INITIAL_PREFETCH_COUNT = 20;
    const symbolsToPrefetch = assets.slice(0, INITIAL_PREFETCH_COUNT).map((asset) => asset.symbol);
    if (!symbolsToPrefetch.length) return;

    if (lastPrefetchRangeRef.current === rangeFilter && initialPrefetchRef.current) {
      return;
    }

    lastPrefetchRangeRef.current = rangeFilter;
    initialPrefetchRef.current = true;

    const runPrefetch = async () => {
      try {
        const serverData = await fetchChartsFromServer(symbolsToPrefetch, rangeFilter);
        const timestamp = Date.now();

        symbolsToPrefetch.forEach((symbol) => {
          const cacheKey = `${symbol}-${rangeFilter}`;
          const series = serverData[symbol] ?? [];
          historicalDataCache.current.set(cacheKey, {
            range: rangeFilter,
            data: series,
            fetchedAt: timestamp,
          });
        });

        console.log(`🛰️ Prefetched ${symbolsToPrefetch.length} charts for ${rangeFilter}`);
      } catch (error) {
        console.warn('Initial chart prefetch failed:', error);
        initialPrefetchRef.current = false;
        lastPrefetchRangeRef.current = null;
      }
    };

    runPrefetch();
  }, [assets, rangeFilter, fetchChartsFromServer]);

  const fetchHistoricalData = useCallback(
    async (symbol: string, range: string): Promise<number[]> => {
      // First, try ring buffer (instant, always up-to-date from WebSocket)
      if (hasRingBufferData(symbol, range)) {
        const ringData = getRingBufferData(symbol, range);
        if (ringData.length > 0) {
          console.log(`📊 Using ring buffer for ${symbol} ${range} (${ringData.length} points)`);
          return ringData;
        }
      }

      // Fallback to Hyperliquid candleSnapshot API for historical backfill
      const cacheKey = `${symbol}-${range}`;
      const cached = historicalDataCache.current.get(cacheKey);
      
      // Return cached data if less than 24 hours old (aggressive caching for instant charts)
      if (cached && Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000) {
        return cached.data;
      }

      try {
        const serverData = await fetchChartsFromServer([symbol], range);
        const series = serverData[symbol] ?? [];

        historicalDataCache.current.set(cacheKey, {
          range,
          data: series,
          fetchedAt: Date.now(),
        });

        return series;
      } catch (error) {
        console.error(`Failed to fetch historical data for ${symbol}:`, error);
        // Last resort: try ring buffer even if it's empty
        return getRingBufferData(symbol, range);
      }
    },
    [fetchChartsFromServer, getRingBufferData, hasRingBufferData],
  );

  // Pre-fetch charts for all assets in background when charts are enabled
  useEffect(() => {
    if (!showCharts || assets.length === 0) return;

    let isCancelled = false;
    const assetSymbols = assets
      .filter((asset) => asset.price > 0)
      .map((asset) => asset.symbol);

    const preFetchCharts = async () => {
      console.log(`🚀 Pre-fetching charts for ${assetSymbols.length} assets via cache API...`);
      const CHUNK_SIZE = 25;

      for (let i = 0; i < assetSymbols.length; i += CHUNK_SIZE) {
        if (isCancelled) break;
        const chunk = assetSymbols.slice(i, i + CHUNK_SIZE);

        try {
          const serverData = await fetchChartsFromServer(chunk, rangeFilter);
          const timestamp = Date.now();

          Object.entries(serverData).forEach(([symbol, series]) => {
            const cacheKey = `${symbol}-${rangeFilter}`;
            historicalDataCache.current.set(cacheKey, {
              range: rangeFilter,
              data: series,
              fetchedAt: timestamp,
            });
          });
        } catch (error) {
          console.warn('Prefetch chunk failed:', error);
        }
      }

      console.log('✅ Prefetch complete (Hyperliquid candles).');
    };

    preFetchCharts();

    return () => {
      isCancelled = true;
    };
  }, [showCharts, assets, rangeFilter, fetchChartsFromServer]);

  // Filter and sort assets
  const displayedAssets = useMemo(() => {
    // Show all assets immediately - don't wait for price data
    let filtered = assets;

    // Apply search filter
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      filtered = filtered.filter(asset => 
        asset.symbol.toLowerCase().includes(lowerSearch)
      );
    }

    // Sort based on sortBy
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'gain':
          return Math.abs(b.change24h) - Math.abs(a.change24h);
        case 'price':
          return b.price - a.price;
        case 'spread':
          const spreadA = a.spread || 0;
          const spreadB = b.spread || 0;
          return spreadB - spreadA;
        case 'symbol':
        default:
          return a.symbol.localeCompare(b.symbol);
      }
    });

    // Apply gain filter (after sorting)
    if (gainFilter === 'High-Low') {
      // Show only gainers, sorted high to low
      return sorted.filter(asset => asset.change24h > 0).sort((a, b) => b.change24h - a.change24h);
    } else if (gainFilter === 'Low-High') {
      // Show only losers, sorted low to high (most negative first)
      return sorted.filter(asset => asset.change24h < 0).sort((a, b) => a.change24h - b.change24h);
    }

    return sorted;
  }, [assets, searchText, sortBy, gainFilter]);

  const stats = useMemo(() => {
    const total = assets.length;
    const displayed = displayedAssets.length;
    const gainers = assets.filter(a => a.change24h > 0).length;
    const losers = assets.filter(a => a.change24h < 0).length;
    return { total, displayed, gainers, losers };
  }, [assets, displayedAssets]);

  return (
    <div className="h-full bg-black text-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-[#0a0a0a] border-b border-[#1a1a1a] px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <div className="text-xs text-gray-500">
              <span className="text-white font-semibold">{stats.displayed}</span>/<span className="text-white">{stats.total}</span>
            </div>
            <div className="text-xs text-gray-500">
              <span className="text-[#00ff88] font-semibold">{stats.gainers}</span> gainers
            </div>
            <div className="text-xs text-gray-500">
              <span className="text-[#ff4444] font-semibold">{stats.losers}</span> losers
            </div>
      </div>

          <div className="flex items-center gap-2">
            <div className={cn(
              "h-2 w-2 rounded-full",
              isConnected ? "bg-[#00ff88] animate-pulse" : "bg-[#ff4444]"
            )} />
            <span className="text-xs text-gray-500">
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
            <span className="text-xs text-gray-500 ml-2">• {stats.displayed} symbols</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Range Filter */}
          <div className="flex items-center gap-1 bg-black border border-[#1a1a1a] rounded px-2 py-1">
            <span className="text-xs text-gray-500">Range:</span>
            {(['1H', '4H', '1D', '7D', '30D'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setRangeFilter(range)}
                className={cn(
                  "px-2 py-0.5 text-xs rounded transition-all duration-75",
                  rangeFilter === range ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:text-white hover:bg-[#0f0f0f]"
                )}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Sort Filter */}
          <div className="flex items-center gap-1 bg-black border border-[#1a1a1a] rounded px-2 py-1">
            <span className="text-xs text-gray-500">Sort:</span>
            {[
              { value: 'gain', label: '% Gain' },
              { value: 'price', label: 'Price' },
              { value: 'spread', label: 'Spread' },
              { value: 'symbol', label: 'Symbol' }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setSortBy(option.value as any)}
                className={cn(
                  "px-2 py-0.5 text-xs rounded transition-all duration-75",
                  sortBy === option.value ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:text-white hover:bg-[#0f0f0f]"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Gain Filter */}
          <div className="flex items-center gap-1 bg-black border border-[#1a1a1a] rounded px-2 py-1">
            <span className="text-xs text-gray-500">% Gain:</span>
            {(['All', 'High-Low', 'Low-High'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setGainFilter(option)}
                className={cn(
                  "px-2 py-0.5 text-xs rounded transition-colors",
                  gainFilter === option ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:text-white"
                )}
              >
                {option === 'High-Low' ? '↑ Gainers' : option === 'Low-High' ? '↓ Losers' : 'All'}
              </button>
            ))}
          </div>

          {/* Base Filter */}
          <div className="flex items-center gap-1 bg-black border border-[#1a1a1a] rounded px-2 py-1">
            <span className="text-xs text-gray-500">Base:</span>
            <span className="text-xs text-white">USD</span>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full bg-black border border-[#1a1a1a] rounded pl-8 pr-3 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00ff88]/30"
            />
          </div>

          {/* List/Grid Toggle */}
          <div className="flex items-center gap-1 bg-black border border-[#1a1a1a] rounded px-2 py-1">
            <span className="text-xs text-gray-500">List:</span>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "px-2 py-0.5 text-xs rounded transition-colors",
                viewMode === 'list' ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:text-white"
              )}
            >
              All
            </button>
          </div>

          {/* Simple Mode Toggle */}
          <button 
            onClick={() => setSimpleMode(!simpleMode)}
            className={cn(
              "px-3 py-1 text-xs border rounded font-semibold transition-all duration-75",
              simpleMode 
                ? "bg-blue-500/20 border-blue-500/50 text-blue-300" 
                : "bg-[#1a1a1a] border-[#333] text-gray-500 hover:text-white hover:bg-[#0f0f0f]"
            )}
            title="Minimal list view with just symbol and price"
          >
            {simpleMode ? '📋 Simple ON' : 'Simple Mode'}
          </button>

          {/* Charts Toggle */}
          <button 
            onClick={() => setShowCharts(!showCharts)}
            className={cn(
              "px-3 py-1 text-xs border rounded font-semibold transition-all duration-75",
              showCharts 
                ? "bg-[#00ff88]/20 border-[#00ff88]/50 text-[#00ff88]" 
                : "bg-[#1a1a1a] border-[#333] text-gray-500 hover:text-white hover:bg-[#0f0f0f]"
            )}
            title={showCharts ? "Hide charts for faster loading" : "Show historical charts"}
          >
            {showCharts ? '📈 Charts ON' : '📊 Charts OFF'}
          </button>

          {/* Hybrid Mode Toggle */}
          <button
            onClick={() => setHybridMode(!hybridMode)}
            className={cn(
              "px-3 py-1 text-xs border rounded font-semibold transition-all duration-75",
              hybridMode
                ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300"
                : "bg-[#1a1a1a] border-[#333] text-gray-500 hover:text-white hover:bg-[#0f0f0f]"
            )}
            title="Show widgets + watchlist side by side"
          >
            {hybridMode ? '🤝 Hybrid ON' : 'Hybrid Mode'}
          </button>

          {/* Crazy Mode Toggle */}
          <button 
            onClick={() => setCrazyMode(!crazyMode)}
            className={cn(
              "px-3 py-1 text-xs border rounded font-semibold transition-all duration-75",
              crazyMode 
                ? "bg-red-500/20 border-red-500/50 text-red-400" 
                : "bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20 hover:border-red-500/40"
            )}
          >
            {crazyMode ? '🔥 Crazy ON' : 'Crazy Mode'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={cn("flex-1 p-4", hybridMode ? "overflow-hidden" : "overflow-y-auto")}>
        {simpleMode ? (
          <SimpleList assets={displayedAssets} sortBy={sortBy} />
        ) : (
          <div className={cn("h-full", hybridMode ? "flex gap-4" : "")}>
            <div className={cn("flex-1", hybridMode ? "overflow-y-auto pr-2" : "")}>
              {viewMode === 'grid' ? (
              <div className={cn(
                "grid gap-3",
                crazyMode 
                  ? "grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-15" 
                  : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8"
              )}>
                {displayedAssets.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    {!isInitialized 
                      ? (isConnected ? 'Discovering assets...' : 'Connecting to WebSocket...')
                      : 'No assets match your filter'
                    }
                  </div>
                ) : (
                  displayedAssets.map((asset) => (
                    <AssetCard
                      key={asset.symbol}
                      asset={asset}
                      rangeFilter={rangeFilter}
                      onFetchHistory={fetchHistoricalData}
                      crazyMode={crazyMode}
                      showCharts={showCharts}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg overflow-hidden">
                {/* List Header */}
                <div className="flex items-center justify-between py-2 px-3 border-b border-[#1a1a1a] bg-black">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-xs text-gray-500 w-8">#</span>
                    <span className="text-xs text-gray-500 min-w-[80px]">SYMBOL</span>
                  </div>
                  <div className="flex items-center gap-6 flex-1 justify-end">
                    <span className="text-xs text-gray-500 min-w-[100px] text-right">PRICE</span>
                    <span className="text-xs text-gray-500 min-w-[80px] text-right">CHANGE</span>
                    <span className="text-xs text-gray-500 min-w-[80px] text-right">24H VOL</span>
                  </div>
                </div>

                {/* List Items */}
                <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
                  {displayedAssets.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      {!isInitialized 
                        ? (isConnected ? 'Discovering assets...' : 'Connecting to WebSocket...')
                        : 'No assets match your filter'
                      }
                    </div>
                  ) : (
                    displayedAssets.map((asset, index) => (
                      <AssetRow key={asset.symbol} asset={asset} index={index} />
                    ))
                  )}
                </div>
              </div>
            )}
            </div>

            {hybridMode && (
              <div className="w-[320px] flex-shrink-0">
                <HybridWatchlist assets={displayedAssets} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(ScreenerTerminal);
