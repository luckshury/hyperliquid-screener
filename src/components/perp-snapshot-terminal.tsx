"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Layers, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  Activity,
  DollarSign,
  Users,
  BarChart3,
  AlertCircle,
  CheckCircle,
  Clock,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import { decode } from '@msgpack/msgpack';
import { decompress } from 'fzstd';
import { encoreClient } from '@/lib/encore-client';

interface Position {
  address: string;
  size: number;
  notionalSize: number;
  fundingPnl: number;
  entryPrice: number;
  leverageType: 'cross' | 'isolated';
  leverageMultiplier: number;
  liquidationPrice: number;
  accountValue: number;
}

interface MarketSnapshot {
  identifier: string;
  market: string;
  positions: Position[];
  totalPositions: number;
  totalLongs: number;
  totalShorts: number;
  totalLongNotional: number;
  totalShortNotional: number;
  biggestLong: Position | null;
  biggestShort: Position | null;
  timestamp: string;
}

interface SnapshotData {
  [market: string]: MarketSnapshot;
}

const PerpSnapshotTerminal: React.FC = () => {
  const [snapshots, setSnapshots] = useState<SnapshotData>({});
  const [selectedMarket, setSelectedMarket] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [cachedTimestamp, setCachedTimestamp] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false); // Start with auto-refresh OFF due to rate limits
  const [pollInterval, setPollInterval] = useState(60000); // 60 seconds default (safe for rate limits)
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(['BTC', 'ETH', 'SOL', 'HYPE']);
  const [sortBy, setSortBy] = useState<'notional' | 'size' | 'leverage'>('notional');
  const [filterSide, setFilterSide] = useState<'all' | 'long' | 'short'>('all');
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Available markets
  const availableMarkets = ['BTC', 'ETH', 'SOL', 'HYPE', 'FARTCOIN', 'TRUMP', 'DOGE', 'AVAX', 'LINK'];

  // Check for updates (metadata endpoint - fast)
  const checkForUpdates = async (): Promise<boolean> => {
    try {
      const data = await encoreClient.perpSnapshot.post({ 
        type: 'perpSnapshotTimestamp' 
      });
      const currentTimestamp = data.timestamp || data.snapshot_id;

      const hasUpdates = cachedTimestamp !== currentTimestamp;
      
      if (hasUpdates) {
        console.log(`📊 Perp snapshot updated: ${cachedTimestamp} -> ${currentTimestamp}`);
        setCachedTimestamp(currentTimestamp);
      } else {
        console.log(`✓ No perp snapshot updates (timestamp: ${currentTimestamp})`);
      }

      return hasUpdates;
    } catch (err) {
      console.error('Failed to check for updates:', err);
      setError('Failed to check for updates');
      return false;
    }
  };

  // Parse single market response
  const parseSingleMarket = async (binaryData: ArrayBuffer, marketName: string): Promise<SnapshotData> => {
    try {
      let decompressed: Uint8Array;
      
      try {
        decompressed = decompress(new Uint8Array(binaryData));
        console.log('✓ Successfully decompressed single market data');
      } catch (e) {
        console.log('Data appears to be uncompressed msgpack');
        decompressed = new Uint8Array(binaryData);
      }

      const data = decode(decompressed) as any;

      if (Array.isArray(data) && data.length >= 4) {
        const [identifier, market, positions, addresses] = data;
        return {
          [market]: processMarketData(identifier, market, positions, addresses)
        };
      }

      throw new Error('Unknown single market data format');
    } catch (err) {
      console.error('Error parsing single market:', err);
      throw err;
    }
  };

  // Parse multiple markets response
  const parseMultipleMarkets = async (binaryData: ArrayBuffer): Promise<SnapshotData> => {
    const buffer = new Uint8Array(binaryData);
    let offset = 0;

    // Read number of snapshots (4 bytes, little-endian)
    const count = new DataView(buffer.buffer).getUint32(offset, true);
    offset += 4;

    console.log(`📦 Number of perp snapshots: ${count}`);

    const markets: SnapshotData = {};

    for (let i = 0; i < count; i++) {
      // Read length of this snapshot (4 bytes, little-endian)
      const length = new DataView(buffer.buffer).getUint32(offset, true);
      offset += 4;

      console.log(`Snapshot ${i + 1}/${count}: ${length} bytes`);

      // Extract and decompress snapshot
      const zstdData = buffer.slice(offset, offset + length);

      try {
        const decompressed = decompress(zstdData);
        const data = decode(decompressed) as any;

        if (Array.isArray(data) && data.length >= 4) {
          const [identifier, market, positions, addresses] = data;
          markets[market] = processMarketData(identifier, market, positions, addresses);
          console.log(`✓ Parsed market: ${market} with ${positions?.length || 0} positions`);
        }
      } catch (e) {
        console.error(`Error parsing snapshot ${i + 1}:`, e);
      }

      offset += length;
    }

    return markets;
  };

  // Process market data into structured format
  const processMarketData = (
    identifier: string,
    market: string,
    positions: any[],
    addresses: string[]
  ): MarketSnapshot => {
    const processedPositions: Position[] = [];
    let totalLongs = 0;
    let totalShorts = 0;
    let totalLongNotional = 0;
    let totalShortNotional = 0;
    let biggestLong: Position | null = null;
    let biggestShort: Position | null = null;

    for (let i = 0; i < positions.length; i++) {
      if (Array.isArray(positions[i]) && positions[i].length >= 8) {
        const pos: Position = {
          address: addresses[i] || 'Unknown',
          size: positions[i][0],
          notionalSize: positions[i][1],
          fundingPnl: positions[i][2],
          entryPrice: positions[i][3],
          leverageType: positions[i][4] === 0 ? 'cross' : 'isolated',
          leverageMultiplier: positions[i][5],
          liquidationPrice: positions[i][6],
          accountValue: positions[i][7]
        };

        processedPositions.push(pos);

        // Calculate stats
        if (pos.size > 0) {
          totalLongs++;
          totalLongNotional += Math.abs(pos.notionalSize);
          if (!biggestLong || Math.abs(pos.notionalSize) > Math.abs(biggestLong.notionalSize)) {
            biggestLong = pos;
          }
        } else if (pos.size < 0) {
          totalShorts++;
          totalShortNotional += Math.abs(pos.notionalSize);
          if (!biggestShort || Math.abs(pos.notionalSize) > Math.abs(biggestShort.notionalSize)) {
            biggestShort = pos;
          }
        }
      }
    }

    return {
      identifier,
      market,
      positions: processedPositions,
      totalPositions: positions.length,
      totalLongs,
      totalShorts,
      totalLongNotional,
      totalShortNotional,
      biggestLong,
      biggestShort,
      timestamp: cachedTimestamp || new Date().toISOString()
    };
  };

  // Download snapshots (heavy endpoint)
  const downloadSnapshots = async (marketNames: string[]): Promise<SnapshotData> => {
    try {
      const response = await encoreClient.perpSnapshot.post({
        type: 'perpSnapshots',
        market_names: marketNames
      });

      const payloadFormat = response.headers?.payloadFormat;
      const binaryData = response.data;

      console.log(`📦 Payload format: ${payloadFormat}`);
      console.log(`📦 Downloaded ${(binaryData.byteLength / 1024 / 1024).toFixed(2)} MB`);

      if (payloadFormat === 'multi-zstd') {
        return await parseMultipleMarkets(binaryData);
      } else {
        return await parseSingleMarket(binaryData, marketNames[0]);
      }
    } catch (err) {
      console.error('Failed to download snapshots:', err);
      throw err;
    }
  };

  // Poll snapshots with efficient pattern
  const pollSnapshots = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Check for updates (fast)
      console.log('🔍 Checking for updates...');
      const hasUpdates = await checkForUpdates();

      if (!hasUpdates && Object.keys(snapshots).length > 0) {
        console.log('✓ No updates available, using cached data');
        setIsLoading(false);
        return;
      }

      // Step 2: Download new data (heavy) - with rate limit awareness
      console.log('📥 New snapshots available, downloading...');
      console.log('⚠️ Note: perpSnapshots endpoint has rate limit of 5 requests per 5 minutes');
      
      const newSnapshots = await downloadSnapshots(selectedMarkets);
      
      setSnapshots(newSnapshots);
      setLastUpdate(new Date());
      setError(null);
      console.log('✅ Successfully loaded snapshots');
    } catch (err) {
      console.error('Polling error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to poll snapshots';
      
      // Check if it's a permission error
      if (errorMessage.includes('403') || errorMessage.includes('permission')) {
        setError('API key does not have permission to access perpSnapshots endpoint. This is a premium feature that requires special API access. Please contact Hydromancer to upgrade your API key.');
      } else if (errorMessage.includes('429')) {
        setError('Rate limit exceeded. The perpSnapshots endpoint allows 5 requests per 5 minutes. Please wait and try again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedMarkets, snapshots, isLoading, cachedTimestamp]);

  // Auto-refresh logic
  useEffect(() => {
    if (autoRefresh) {
      // Set up interval (don't fetch immediately to avoid rate limits)
      intervalRef.current = setInterval(pollSnapshots, pollInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else {
      // Clear interval when auto-refresh is turned off
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [autoRefresh, pollInterval, pollSnapshots]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Format address
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Get filtered and sorted positions
  const getFilteredPositions = (market: MarketSnapshot): Position[] => {
    let filtered = market.positions;

    // Filter by side
    if (filterSide === 'long') {
      filtered = filtered.filter(p => p.size > 0);
    } else if (filterSide === 'short') {
      filtered = filtered.filter(p => p.size < 0);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'notional':
          return Math.abs(b.notionalSize) - Math.abs(a.notionalSize);
        case 'size':
          return Math.abs(b.size) - Math.abs(a.size);
        case 'leverage':
          return b.leverageMultiplier - a.leverageMultiplier;
        default:
          return 0;
      }
    });

    return filtered.slice(0, 50); // Top 50 positions
  };

  // Get market to display
  const displayMarket = selectedMarket === 'ALL' 
    ? Object.values(snapshots)[0] 
    : snapshots[selectedMarket];

  return (
    <div className="h-full flex flex-col bg-card/50 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div>
          <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Perpetual Snapshot - Market Positioning
          </h2>
          <p className="text-sm text-muted-foreground">
            {lastUpdate ? `Last updated: ${lastUpdate.toLocaleTimeString()}` : 'Click "Load Snapshots" to start'}
          </p>
          <p className="text-xs text-yellow-500 mt-1 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Rate limit: 5 requests per 5 minutes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {error ? (
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-500 text-sm">
              <CheckCircle className="h-4 w-4" />
              <span>Connected</span>
            </div>
          )}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              autoRefresh 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-accent/10 hover:bg-accent/20'
            }`}
          >
            Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </button>
          <select
            value={pollInterval}
            onChange={(e) => setPollInterval(Number(e.target.value))}
            className="px-3 py-1.5 bg-card border border-border rounded text-sm"
            disabled={autoRefresh}
          >
            <option value={30000}>30s</option>
            <option value={60000}>60s (Recommended)</option>
            <option value={120000}>2min</option>
            <option value={300000}>5min</option>
          </select>
          <button
            onClick={pollSnapshots}
            disabled={isLoading}
            className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Market Selection */}
      <div className="flex items-center gap-4 p-4 border-b border-border/50 bg-background/50">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Markets:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableMarkets.map(market => (
            <button
              key={market}
              onClick={() => {
                if (selectedMarkets.includes(market)) {
                  setSelectedMarkets(selectedMarkets.filter(m => m !== market));
                } else {
                  setSelectedMarkets([...selectedMarkets, market]);
                }
              }}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                selectedMarkets.includes(market)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent/10 hover:bg-accent/20'
              }`}
            >
              {market}
            </button>
          ))}
        </div>
      </div>

      {/* Market Stats Grid */}
      {Object.keys(snapshots).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b border-border/50">
          {Object.values(snapshots).map(market => (
            <div
              key={market.market}
              onClick={() => setSelectedMarket(market.market)}
              className={`bg-background border rounded-lg p-4 cursor-pointer transition-all ${
                selectedMarket === market.market
                  ? 'border-primary shadow-lg'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg">{market.market}</h3>
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Positions:</span>
                  <span className="font-medium">{market.totalPositions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-500">Longs:</span>
                  <span className="font-medium">{market.totalLongs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-500">Shorts:</span>
                  <span className="font-medium">{market.totalShorts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Long/Short Ratio:</span>
                  <span className="font-medium">
                    {market.totalShorts > 0 
                      ? (market.totalLongs / market.totalShorts).toFixed(2) 
                      : '∞'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detailed Market View */}
      {displayMarket && (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Market Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-background border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Total Notional</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Long Notional</p>
                  <p className="text-lg font-semibold text-green-500">
                    {formatCurrency(displayMarket.totalLongNotional)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Short Notional</p>
                  <p className="text-lg font-semibold text-red-500">
                    {formatCurrency(displayMarket.totalShortNotional)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-background border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold">Biggest Long</h3>
              </div>
              {displayMarket.biggestLong ? (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Address:</span>
                    <span className="font-mono">{formatAddress(displayMarket.biggestLong.address)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size:</span>
                    <span className="font-medium">{displayMarket.biggestLong.size.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Notional:</span>
                    <span className="font-medium">{formatCurrency(displayMarket.biggestLong.notionalSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Leverage:</span>
                    <span className="font-medium">{displayMarket.biggestLong.leverageMultiplier.toFixed(2)}x</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No long positions</p>
              )}
            </div>

            <div className="bg-background border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-5 w-5 text-red-500" />
                <h3 className="font-semibold">Biggest Short</h3>
              </div>
              {displayMarket.biggestShort ? (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Address:</span>
                    <span className="font-mono">{formatAddress(displayMarket.biggestShort.address)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size:</span>
                    <span className="font-medium">{Math.abs(displayMarket.biggestShort.size).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Notional:</span>
                    <span className="font-medium">{formatCurrency(Math.abs(displayMarket.biggestShort.notionalSize))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Leverage:</span>
                    <span className="font-medium">{displayMarket.biggestShort.leverageMultiplier.toFixed(2)}x</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No short positions</p>
              )}
            </div>
          </div>

          {/* Filters and Sort */}
          <div className="flex items-center justify-between bg-background border border-border rounded-lg p-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Filter:</span>
                <select
                  value={filterSide}
                  onChange={(e) => setFilterSide(e.target.value as any)}
                  className="px-3 py-1.5 bg-card border border-border rounded text-sm"
                >
                  <option value="all">All Positions</option>
                  <option value="long">Longs Only</option>
                  <option value="short">Shorts Only</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-1.5 bg-card border border-border rounded text-sm"
                >
                  <option value="notional">Notional Size</option>
                  <option value="size">Position Size</option>
                  <option value="leverage">Leverage</option>
                </select>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Showing top 50 positions
            </div>
          </div>

          {/* Positions Table */}
          <div className="bg-background border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-accent/5 border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">#</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Address</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Side</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Size</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Notional</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Entry Price</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Liq. Price</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Leverage</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Type</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Account Value</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredPositions(displayMarket).map((position, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-accent/5 transition-colors">
                      <td className="py-3 px-4 text-muted-foreground">{idx + 1}</td>
                      <td className="py-3 px-4 font-mono text-xs">{formatAddress(position.address)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          position.size > 0 
                            ? 'bg-green-500/10 text-green-500' 
                            : 'bg-red-500/10 text-red-500'
                        }`}>
                          {position.size > 0 ? 'LONG' : 'SHORT'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {Math.abs(position.size).toFixed(4)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {formatCurrency(Math.abs(position.notionalSize))}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {formatCurrency(position.entryPrice)}
                      </td>
                      <td className="py-3 px-4 text-right text-red-500">
                        {formatCurrency(position.liquidationPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {position.leverageMultiplier.toFixed(2)}x
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          position.leverageType === 'cross'
                            ? 'bg-blue-500/10 text-blue-500'
                            : 'bg-purple-500/10 text-purple-500'
                        }`}>
                          {position.leverageType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {formatCurrency(position.accountValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {Object.keys(snapshots).length === 0 && !isLoading && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-2xl">
            <Layers className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Perpetual Market Snapshots</h3>
            <p className="text-sm text-muted-foreground mb-4">
              View the entire positioning of all traders on Hyperliquid across all assets
            </p>
            
            {error ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <h4 className="font-semibold text-red-500 mb-1">Access Denied</h4>
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <h4 className="font-semibold text-yellow-500 mb-1">Premium Feature</h4>
                    <p className="text-sm text-yellow-400">
                      The perpSnapshots endpoint is a premium feature that requires special API access.
                      Contact Hydromancer to upgrade your API key for access to:
                    </p>
                    <ul className="text-sm text-yellow-400 mt-2 space-y-1 list-disc list-inside">
                      <li>Real-time positioning data for all traders</li>
                      <li>Biggest long and short positions per market</li>
                      <li>Historical snapshot data</li>
                      <li>Advanced market analytics</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
            <button
              onClick={pollSnapshots}
              disabled={isLoading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Try Loading Snapshots'}
            </button>
            
            <p className="text-xs text-muted-foreground mt-4">
              Note: This endpoint has a rate limit of 5 requests per 5 minutes
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerpSnapshotTerminal;

