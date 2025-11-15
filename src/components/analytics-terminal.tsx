"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  DollarSign, 
  Activity,
  RefreshCw,
  Search,
  ArrowUpDown,
  Eye,
  Zap
} from 'lucide-react';

const API_KEY = 'sk_nNhuLkdGdW5sxnYec33C2FBPzLjXBnEd';
const API_ROUTE = '/api/analytics';
const WS_URL = `wss://api.hydromancer.xyz/ws`;

interface SmartMoneyAccount {
  address: string;
  positions: any[];
  totalValue: number;
  pnl: number;
  leverage: number;
}

interface BigPosition {
  user: string;
  coin: string;
  size: number;
  notionalSize: number;
  entryPrice: number;
  leverage: number;
  side: 'long' | 'short';
}

interface Liquidation {
  timestamp: number;
  account: string;
  coin: string;
  size: number;
  price: number;
  value: number;
  side: string;
}

interface PerpSnapshot {
  [coin: string]: {
    positions: Array<[string, any[]]>;
    totalLongs: number;
    totalShorts: number;
    biggestLong: BigPosition | null;
    biggestShort: BigPosition | null;
  };
}

const AnalyticsTerminal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'smart-money' | 'positions' | 'liquidations'>('smart-money');
  const [smartMoneyAddresses, setSmartMoneyAddresses] = useState<string[]>([
    '0x010461c14e146ac35fe42271bdc1134ee31c703a',
    '0x574bafce69d9411f662a433896e74e4f153096fa'
  ]);
  const [newAddress, setNewAddress] = useState('');
  const [smartMoneyData, setSmartMoneyData] = useState<SmartMoneyAccount[]>([]);
  const [perpSnapshot, setPerpSnapshot] = useState<PerpSnapshot>({});
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'value' | 'size'>('value');
  
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket connection for liquidations
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('✅ Analytics WebSocket connected');
        setIsConnected(true);
        
        // Authenticate
        ws.send(JSON.stringify({
          type: 'auth',
          apiKey: API_KEY
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.type === 'connected') {
            // Subscribe to liquidation fills
            ws.send(JSON.stringify({
              type: 'subscribe',
              subscription: { type: 'liquidationFills' }
            }));
            console.log('📡 Subscribed to liquidationFills');
          } else if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          } else if (msg.type === 'liquidationFills' && msg.fills) {
            const newLiquidations = msg.fills.map((fill: any) => ({
              timestamp: Date.now(),
              account: fill.user || 'Unknown',
              coin: fill.coin,
              size: parseFloat(fill.sz),
              price: parseFloat(fill.px),
              value: parseFloat(fill.sz) * parseFloat(fill.px),
              side: fill.side
            }));
            
            setLiquidations(prev => [...newLiquidations, ...prev].slice(0, 100));
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        console.log('❌ Analytics WebSocket disconnected');
        setIsConnected(false);
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Fetch smart money positions
  const fetchSmartMoneyData = async () => {
    if (smartMoneyAddresses.length === 0) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(API_ROUTE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'batchClearinghouseStates',
          users: smartMoneyAddresses
        })
      });

      const data = await response.json();
      
      const accounts: SmartMoneyAccount[] = smartMoneyAddresses.map((address, index) => {
        const state = data[index];
        if (!state || !state.assetPositions) {
          return {
            address,
            positions: [],
            totalValue: 0,
            pnl: 0,
            leverage: 0
          };
        }

        const positions = state.assetPositions;
        const marginSummary = state.marginSummary;
        
        return {
          address,
          positions,
          totalValue: marginSummary?.accountValue ? parseFloat(marginSummary.accountValue) : 0,
          pnl: positions.reduce((sum: number, p: any) => sum + (p.position?.unrealizedPnl ? parseFloat(p.position.unrealizedPnl) : 0), 0),
          leverage: marginSummary?.accountValue ? parseFloat(marginSummary.totalNtlPos || 0) / parseFloat(marginSummary.accountValue) : 0
        };
      });

      setSmartMoneyData(accounts);
    } catch (error) {
      console.error('Failed to fetch smart money data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch perp snapshot for biggest positions
  const fetchPerpSnapshot = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API_ROUTE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'perpSnapshots',
          market_names: ['BTC', 'ETH', 'SOL', 'HYPE', 'FARTCOIN', 'TRUMP']
        })
      });

      // Note: This endpoint returns binary data (zstd compressed msgpack)
      // For now, we'll handle the JSON fallback
      const data = await response.json().catch(() => null);
      
      if (data) {
        // Process snapshot data
        console.log('Perp snapshot data:', data);
        // TODO: Parse binary data properly with zstd and msgpack
      }
    } catch (error) {
      console.error('Failed to fetch perp snapshot:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add new smart money address
  const addSmartMoneyAddress = () => {
    if (newAddress && newAddress.startsWith('0x') && newAddress.length === 42) {
      if (!smartMoneyAddresses.includes(newAddress)) {
        setSmartMoneyAddresses([...smartMoneyAddresses, newAddress]);
        setNewAddress('');
      }
    }
  };

  // Remove smart money address
  const removeSmartMoneyAddress = (address: string) => {
    setSmartMoneyAddresses(smartMoneyAddresses.filter(a => a !== address));
    setSmartMoneyData(smartMoneyData.filter(d => d.address !== address));
  };

  // Auto-refresh smart money data
  useEffect(() => {
    if (activeTab === 'smart-money' && smartMoneyAddresses.length > 0) {
      fetchSmartMoneyData();
      const interval = setInterval(fetchSmartMoneyData, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [activeTab, smartMoneyAddresses]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format address
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="h-full flex flex-col bg-card/50 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div>
          <h2 className="text-lg font-semibold text-primary">Data & Information Tooling</h2>
          <p className="text-sm text-muted-foreground">
            {isConnected ? 'Connected to Hydromancer API' : 'Connecting...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-xs text-muted-foreground">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/50">
        <button
          onClick={() => setActiveTab('smart-money')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'smart-money'
              ? 'text-primary border-b-2 border-primary bg-accent/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/5'
          }`}
        >
          <Users className="h-4 w-4" />
          Smart Money Tracker
        </button>
        <button
          onClick={() => setActiveTab('positions')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'positions'
              ? 'text-primary border-b-2 border-primary bg-accent/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/5'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Biggest Positions
        </button>
        <button
          onClick={() => setActiveTab('liquidations')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'liquidations'
              ? 'text-primary border-b-2 border-primary bg-accent/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/5'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Live Liquidations
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Smart Money Tracker */}
        {activeTab === 'smart-money' && (
          <div className="p-4 space-y-4">
            {/* Add Address Section */}
            <div className="bg-background border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Track Smart Money Accounts
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter wallet address (0x...)"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="flex-1 px-3 py-2 bg-card border border-border rounded text-sm"
                />
                <button
                  onClick={addSmartMoneyAddress}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={fetchSmartMoneyData}
                  disabled={isLoading}
                  className="px-4 py-2 bg-accent/10 hover:bg-accent/20 rounded text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Track up to 1000 wallets. Data refreshes every 30 seconds.
              </p>
            </div>

            {/* Smart Money Accounts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {smartMoneyData.map((account) => (
                <div key={account.address} className="bg-background border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-mono font-semibold">{formatAddress(account.address)}</p>
                        <p className="text-xs text-muted-foreground">{account.positions.length} positions</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeSmartMoneyAddress(account.address)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Account Value</p>
                      <p className="text-sm font-semibold">{formatCurrency(account.totalValue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Unrealized PnL</p>
                      <p className={`text-sm font-semibold ${account.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatCurrency(account.pnl)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Leverage</p>
                      <p className="text-sm font-semibold">{account.leverage.toFixed(2)}x</p>
                    </div>
                  </div>

                  {/* Positions */}
                  <div className="space-y-2">
                    {account.positions.slice(0, 3).map((pos: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs bg-card/50 rounded p-2">
                        <span className="font-medium">{pos.position?.coin || 'Unknown'}</span>
                        <span className={pos.position?.szi > 0 ? 'text-green-500' : 'text-red-500'}>
                          {pos.position?.szi > 0 ? 'LONG' : 'SHORT'} {Math.abs(pos.position?.szi || 0).toFixed(4)}
                        </span>
                      </div>
                    ))}
                    {account.positions.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{account.positions.length - 3} more positions
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {smartMoneyData.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No smart money accounts tracked yet.</p>
                <p className="text-sm">Add wallet addresses above to start tracking.</p>
              </div>
            )}
          </div>
        )}

        {/* Biggest Positions */}
        {activeTab === 'positions' && (
          <div className="p-4 space-y-4">
            <div className="bg-background border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Market Positioning Overview
                </h3>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedCoin}
                    onChange={(e) => setSelectedCoin(e.target.value)}
                    className="px-3 py-1.5 bg-card border border-border rounded text-sm"
                  >
                    <option value="ALL">All Markets</option>
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                    <option value="SOL">SOL</option>
                    <option value="HYPE">HYPE</option>
                  </select>
                  <button
                    onClick={fetchPerpSnapshot}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 rounded text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Perp snapshot data visualization coming soon.</p>
                <p className="text-sm">This will show the biggest long and short positions across all markets.</p>
                <button
                  onClick={fetchPerpSnapshot}
                  className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Load Snapshot Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Live Liquidations */}
        {activeTab === 'liquidations' && (
          <div className="p-4 space-y-4">
            <div className="bg-background border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Live Liquidation Feed
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Filter by coin..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="px-3 py-1.5 bg-card border border-border rounded text-sm w-40"
                  />
                  <button
                    onClick={() => setLiquidations([])}
                    className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 rounded text-sm font-medium transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Liquidations Stats */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="bg-card/50 rounded p-3">
                  <p className="text-xs text-muted-foreground">Total Liquidations</p>
                  <p className="text-lg font-semibold">{liquidations.length}</p>
                </div>
                <div className="bg-card/50 rounded p-3">
                  <p className="text-xs text-muted-foreground">Total Volume</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(liquidations.reduce((sum, l) => sum + l.value, 0))}
                  </p>
                </div>
                <div className="bg-card/50 rounded p-3">
                  <p className="text-xs text-muted-foreground">Largest Liquidation</p>
                  <p className="text-lg font-semibold">
                    {liquidations.length > 0 ? formatCurrency(Math.max(...liquidations.map(l => l.value))) : '$0.00'}
                  </p>
                </div>
                <div className="bg-card/50 rounded p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-lg font-semibold flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                    {isConnected ? 'Live' : 'Offline'}
                  </p>
                </div>
              </div>

              {/* Liquidations Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Time</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Account</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Coin</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Size</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Price</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Value</th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground">Side</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liquidations
                      .filter(l => !searchQuery || l.coin.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((liq, idx) => (
                        <tr key={idx} className="border-b border-border/50 hover:bg-accent/5 transition-colors">
                          <td className="py-2 px-3 text-xs text-muted-foreground">
                            {new Date(liq.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-2 px-3 text-xs font-mono">
                            {typeof liq.account === 'string' ? formatAddress(liq.account) : 'Unknown'}
                          </td>
                          <td className="py-2 px-3 text-xs font-semibold">{liq.coin}</td>
                          <td className="py-2 px-3 text-xs text-right">{liq.size.toFixed(4)}</td>
                          <td className="py-2 px-3 text-xs text-right">{formatCurrency(liq.price)}</td>
                          <td className="py-2 px-3 text-xs text-right font-semibold">{formatCurrency(liq.value)}</td>
                          <td className="py-2 px-3 text-xs text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              liq.side === 'B' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                            }`}>
                              {liq.side === 'B' ? 'LONG' : 'SHORT'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {liquidations.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No liquidations yet.</p>
                  <p className="text-sm">Liquidations will appear here in real-time when they occur.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsTerminal;

