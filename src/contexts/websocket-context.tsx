"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { SymbolBuffers } from '@/lib/ring-buffer';

interface AssetData {
  symbol: string;
  name: string;
  price: number;
  oraclePrice: number | null;
  midPrice: number | null;
  impactPxs: [number, number] | null;
  change24h: number;
  spread: number | null;
  lastUpdate: number;
}

interface FillData {
  timestamp: number;
  coin: string;
  side: string;
  price: number;
  size: number;
  value: number;
  direction: string;
  pnl: number;
  address: string;
  hash: string;
}

interface FillsStats {
  totalFills: number;
  totalVolume: number;
  fillsPerMinute: number;
}

interface WebSocketContextType {
  isConnected: boolean;
  isInitialized: boolean;
  // Screener data
  assets: AssetData[];
  tickers: string[];
  subscribeToTicker: (ticker: string) => void;
  // Fills data
  fills: FillData[];
  fillsStats: FillsStats;
  fillsStreamActive: boolean;
  setFillsStreamActive: (active: boolean) => void;
  clearFills: () => void;
  // Ring buffer data
  getChartData: (symbol: string, range: string) => number[];
  hasChartData: (symbol: string, range: string) => boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

const API_KEY = process.env.NEXT_PUBLIC_HYDROMANCER_API_KEY || '';
const WS_URL = `wss://api.hydromancer.xyz/ws?token=${API_KEY}`;

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [tickers, setTickers] = useState<string[]>([]);
  const [fills, setFills] = useState<FillData[]>([]);
  const [fillsStats, setFillsStats] = useState<FillsStats>({
    totalFills: 0,
    totalVolume: 0,
    fillsPerMinute: 0
  });
  const [fillsStreamActive, setFillsStreamActive] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const tickerDataRef = useRef<{ [key: string]: AssetData }>({});
  const fillsRef = useRef<FillData[]>([]);
  const statsRef = useRef<FillsStats>({ totalFills: 0, totalVolume: 0, fillsPerMinute: 0 });
  const fillsLastMinuteRef = useRef(0);
  const minuteTimestampRef = useRef(Date.now());
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const subscribedTickersRef = useRef<Set<string>>(new Set());
  const fillsSubscribedRef = useRef(false);
  const hasDiscoveredRef = useRef(false);
  
  // Ring buffers for price history
  const priceBuffersRef = useRef<Map<string, SymbolBuffers>>(new Map());
  const lastSampleRef = useRef<Map<string, number>>(new Map());
  const SAMPLE_INTERVAL_MS = 60 * 1000; // 1 minute sampling

  // Discover assets immediately on mount (don't wait for WebSocket)
  useEffect(() => {
    if (hasDiscoveredRef.current) return;

    const discoverAssets = async () => {
      try {
        console.log('🔍 Discovering assets...');
        const response = await fetch('https://api.hyperliquid.xyz/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'meta' })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        
        // Check if universe exists and is an array
        if (!data || !data.universe || !Array.isArray(data.universe)) {
          console.error('Invalid universe data:', data);
          return;
        }

        const allCoins = data.universe.map((asset: any) => asset.name);

        // Add known xyz pairs (expanded list)
        const knownXyzPairs = [
          'xyz:XYZ100', 'xyz:NVDA', 'xyz:TSLA', 'xyz:PLTR', 'xyz:GOLD', 'xyz:HOOD', 'xyz:INTC',
          'xyz:AMD', 'xyz:AAPL', 'xyz:MSFT', 'xyz:GOOGL', 'xyz:AMZN', 'xyz:META', 'xyz:NFLX',
          'xyz:COIN', 'xyz:MSTR', 'xyz:SQ', 'xyz:PYPL', 'xyz:V', 'xyz:MA', 'xyz:JPM',
          'xyz:BAC', 'xyz:WFC', 'xyz:GS', 'xyz:MS', 'xyz:C', 'xyz:BLK', 'xyz:SCHW'
        ];
        
        knownXyzPairs.forEach(pair => {
          if (!allCoins.includes(pair)) {
            allCoins.push(pair);
          }
        });

        console.log(`✅ Discovered ${allCoins.length} assets (including ${knownXyzPairs.length} xyz pairs)`);
        setTickers(allCoins);

        // Initialize assets immediately with placeholder data and seed cache
        allCoins.forEach((coin: string) => {
          tickerDataRef.current[coin] = {
            symbol: coin,
            name: coin,
            price: 0,
            oraclePrice: null,
            midPrice: null,
            impactPxs: null,
            change24h: 0,
            spread: null,
            lastUpdate: Date.now()
          };
        });

        setAssets(Object.values(tickerDataRef.current));
        setIsInitialized(true);
        hasDiscoveredRef.current = true;

        console.log('✅ Assets initialized, ready for WebSocket subscriptions');
      } catch (error) {
        console.error('❌ Failed to discover assets:', error);
        // Retry after 2 seconds on failure
        setTimeout(() => {
          hasDiscoveredRef.current = false;
        }, 2000);
      }
    };

    discoverAssets();
  }, []);

  // Backfill ring buffers with historical data
  const backfillRingBuffers = useCallback(async () => {
    if (tickers.length === 0) return;

    console.log('🔄 Backfilling ring buffers with historical data...');
    
    let successCount = 0;
    let failCount = 0;
    
    // Backfill in batches to avoid overwhelming the API
    const BATCH_SIZE = 20;
    const ranges: Array<'1H' | '4H' | '1D' | '7D' | '30D'> = ['1H', '4H', '1D', '7D', '30D'];
    
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const batch = tickers.slice(i, i + BATCH_SIZE);
      
      const results = await Promise.allSettled(
        batch.flatMap(symbol =>
          ranges.map(async (range) => {
            try {
              // Fetch candle data from Hyperliquid
              const rangeConfig: Record<string, { interval: string; lookback: number }> = {
                '1H': { interval: '1m', lookback: 60 },
                '4H': { interval: '1m', lookback: 240 },
                '1D': { interval: '1m', lookback: 1440 },
                '7D': { interval: '1h', lookback: 168 },  // Use hourly for 7D to reduce data
                '30D': { interval: '1h', lookback: 720 }, // Use hourly for 30D
              };

              const config = rangeConfig[range];
              const intervalMs = config.interval === '1m' ? 60 * 1000 : 60 * 60 * 1000;
              const startTime = Date.now() - (config.lookback * intervalMs);

              const response = await fetch('https://api.hyperliquid.xyz/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'candleSnapshot',
                  req: {
                    coin: symbol,
                    interval: config.interval,
                    startTime,
                    endTime: Date.now(),
                  },
                }),
              });

              if (!response.ok) {
                failCount++;
                return { symbol, range, success: false };
              }

              const data = await response.json();
              if (!Array.isArray(data) || data.length === 0) {
                failCount++;
                return { symbol, range, success: false };
              }

              // Get or create buffer
              let buffer = priceBuffersRef.current.get(symbol);
              if (!buffer) {
                buffer = new SymbolBuffers();
                priceBuffersRef.current.set(symbol, buffer);
              }

              // Append all historical points to the specific range buffer
              const rangeBuffer = buffer.getBuffer(range);
              if (rangeBuffer) {
                data.forEach((candle: any) => {
                  const timestamp = candle.t || candle.time || Date.now();
                  const price = parseFloat(candle.c || candle.close || 0);
                  if (price > 0) {
                    rangeBuffer.append(timestamp, price);
                  }
                });
                successCount++;
                return { symbol, range, success: true, points: data.length };
              }
              
              failCount++;
              return { symbol, range, success: false };
            } catch (error) {
              failCount++;
              return { symbol, range, success: false, error };
            }
          })
        )
      );
    }

    console.log(`✅ Ring buffer backfill complete! Success: ${successCount}, Failed: ${failCount}`);
    console.log(`💡 Tip: Failed tickers will use live WebSocket data as it arrives`);
  }, [tickers]);

  // Subscribe to tickers when WebSocket connects
  useEffect(() => {
    if (!isConnected || !hasDiscoveredRef.current) return;

    console.log('📡 WebSocket connected, subscribing to tickers...');
    
    // Subscribe to all tickers
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      tickers.forEach((ticker: string) => {
        subscribeToTicker(ticker);
      });
    }

    // Subscribe to allFills
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !fillsSubscribedRef.current) {
      wsRef.current.send(JSON.stringify({
        method: 'subscribe',
        subscription: { type: 'allFills' }
      }));
      fillsSubscribedRef.current = true;
      console.log('📡 Subscribed to allFills stream');
    }

    // Start backfilling ring buffers in background
    backfillRingBuffers();
  }, [isConnected, tickers, backfillRingBuffers]);

  const subscribeToTicker = useCallback((ticker: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !subscribedTickersRef.current.has(ticker)) {
      wsRef.current.send(JSON.stringify({
        method: 'subscribe',
        subscription: {
          type: 'activeAssetCtx',
          coin: ticker
        }
      }));
      subscribedTickersRef.current.add(ticker);
    }
  }, []);

  const handleTickerUpdate = useCallback((data: any) => {
    const coin = data.coin;
    if (!coin) return;

    const ctx = data.ctx || data;
    const markPx = ctx.markPx ? parseFloat(ctx.markPx) : null;
    const oraclePx = ctx.oraclePx ? parseFloat(ctx.oraclePx) : null;
    const midPx = ctx.midPx ? parseFloat(ctx.midPx) : null;

    let impactPxs: [number, number] | null = null;
    if (ctx.impactPxs && Array.isArray(ctx.impactPxs) && ctx.impactPxs.length === 2) {
      impactPxs = [parseFloat(ctx.impactPxs[0]), parseFloat(ctx.impactPxs[1])] as [number, number];
    }

    const spread = impactPxs ? ((impactPxs[1] - impactPxs[0]) / impactPxs[0]) * 100 : null;

    const existing = tickerDataRef.current[coin];
    const oldPrice = existing?.price || markPx || 0;
    const newPrice = markPx || oldPrice;
    const change24h = oldPrice ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;

    tickerDataRef.current[coin] = {
      symbol: coin,
      name: coin,
      price: newPrice,
      oraclePrice: oraclePx,
      midPrice: midPx,
      impactPxs: impactPxs,
      change24h: existing?.change24h || change24h,
      spread: spread,
      lastUpdate: Date.now()
    };

    // Append price to ring buffers (sampled at 1-minute intervals)
    if (newPrice > 0) {
      const now = Date.now();
      const lastSample = lastSampleRef.current.get(coin) ?? 0;

      if (now - lastSample >= SAMPLE_INTERVAL_MS) {
        let buffer = priceBuffersRef.current.get(coin);
        if (!buffer) {
          buffer = new SymbolBuffers();
          priceBuffersRef.current.set(coin, buffer);
        }
        buffer.appendToAll(now, newPrice);
        lastSampleRef.current.set(coin, now);
      }
    }

    // Batch updates - only update UI every 500ms instead of 100ms
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }

    updateTimerRef.current = setTimeout(() => {
      const assetsArray = Object.values(tickerDataRef.current);
      // Only sort top movers for performance
      assetsArray.sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));
      setAssets(assetsArray);
    }, 500);
  }, []);

  const handleAllFills = useCallback((data: any) => {
    if (!fillsStreamActive) return;

    const now = Date.now();

    if (now - minuteTimestampRef.current >= 60000) {
      statsRef.current.fillsPerMinute = fillsLastMinuteRef.current;
      fillsLastMinuteRef.current = 0;
      minuteTimestampRef.current = now;
    }

    if (!data.fills || !Array.isArray(data.fills)) {
      return;
    }

    data.fills.forEach(([address, fill]: [string, any]) => {
      const value = parseFloat(fill.px) * parseFloat(fill.sz);
      const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Unknown';

      statsRef.current.totalFills++;
      statsRef.current.totalVolume += value;
      fillsLastMinuteRef.current++;

      const fillData: FillData = {
        timestamp: now,
        coin: fill.coin,
        side: fill.side,
        price: parseFloat(fill.px),
        size: parseFloat(fill.sz),
        value: value,
        direction: fill.dir,
        pnl: fill.closedPnl ? parseFloat(fill.closedPnl) : 0,
        address: shortAddress,
        hash: fill.hash
      };

      fillsRef.current.unshift(fillData);
    });

    // Keep only last 5000 fills to prevent memory issues
    if (fillsRef.current.length > 5000) {
      fillsRef.current = fillsRef.current.slice(0, 5000);
    }

    setFills([...fillsRef.current]);
    setFillsStats({ ...statsRef.current });
  }, [fillsStreamActive]);

  const clearFills = useCallback(() => {
    fillsRef.current = [];
    statsRef.current = { totalFills: 0, totalVolume: 0, fillsPerMinute: 0 };
    setFills([]);
    setFillsStats({ totalFills: 0, totalVolume: 0, fillsPerMinute: 0 });
  }, []);

  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('✅ Global WebSocket connected');
        setIsConnected(true);
      };

      ws.onclose = () => {
        console.log('❌ WebSocket disconnected');
        setIsConnected(false);
        subscribedTickersRef.current.clear();
        fillsSubscribedRef.current = false;

        setTimeout(() => {
          console.log('🔄 Reconnecting...');
          connectWebSocket();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          } else if (msg.channel === 'activeAssetCtx') {
            handleTickerUpdate(msg.data);
          } else if (msg.type === 'allFills') {
            handleAllFills(msg);
          }
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [handleTickerUpdate, handleAllFills]);

  // Ring buffer access methods
  const getChartData = useCallback((symbol: string, range: string): number[] => {
    const buffer = priceBuffersRef.current.get(symbol);
    if (!buffer) return [];
    
    const data = buffer.read(range);
    return data.map(point => point.price);
  }, []);

  const hasChartData = useCallback((symbol: string, range: string): boolean => {
    const buffer = priceBuffersRef.current.get(symbol);
    if (!buffer) return false;
    
    const rangeBuffer = buffer.getBuffer(range);
    return rangeBuffer ? rangeBuffer.getSize() > 0 : false;
  }, []);

  const value: WebSocketContextType = {
    isConnected,
    isInitialized,
    assets,
    tickers,
    subscribeToTicker,
    fills,
    fillsStats,
    fillsStreamActive,
    setFillsStreamActive,
    clearFills,
    getChartData,
    hasChartData
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

