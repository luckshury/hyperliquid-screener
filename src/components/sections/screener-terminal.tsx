"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssetData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
}

const mockAssets: AssetData[] = [
  { symbol: "BTC", name: "Bitcoin", price: 43250.50, change24h: 2.45, volume24h: 28500000000, marketCap: 845000000000, high24h: 43850.00, low24h: 42150.00 },
  { symbol: "ETH", name: "Ethereum", price: 2287.35, change24h: 1.82, volume24h: 15200000000, marketCap: 275000000000, high24h: 2315.50, low24h: 2245.00 },
  { symbol: "SOL", name: "Solana", price: 98.42, change24h: -1.23, volume24h: 3200000000, marketCap: 42000000000, high24h: 101.25, low24h: 96.80 },
  { symbol: "BNB", name: "BNB", price: 312.15, change24h: 0.95, volume24h: 1850000000, marketCap: 48000000000, high24h: 318.50, low24h: 308.20 },
  { symbol: "XRP", name: "Ripple", price: 0.5234, change24h: 3.67, volume24h: 1450000000, marketCap: 28000000000, high24h: 0.5389, low24h: 0.5012 },
  { symbol: "ADA", name: "Cardano", price: 0.4821, change24h: -2.15, volume24h: 892000000, marketCap: 17000000000, high24h: 0.4985, low24h: 0.4752 },
  { symbol: "DOGE", name: "Dogecoin", price: 0.0821, change24h: 5.23, volume24h: 1120000000, marketCap: 11500000000, high24h: 0.0865, low24h: 0.0782 },
  { symbol: "AVAX", name: "Avalanche", price: 36.82, change24h: -0.87, volume24h: 645000000, marketCap: 13500000000, high24h: 37.95, low24h: 35.80 },
  { symbol: "LINK", name: "Chainlink", price: 14.52, change24h: 1.45, volume24h: 523000000, marketCap: 8200000000, high24h: 14.89, low24h: 14.12 },
  { symbol: "UNI", name: "Uniswap", price: 6.24, change24h: -1.89, volume24h: 385000000, marketCap: 4700000000, high24h: 6.45, low24h: 6.08 },
  { symbol: "MATIC", name: "Polygon", price: 0.8245, change24h: 2.78, volume24h: 456000000, marketCap: 7600000000, high24h: 0.8512, low24h: 0.7985 },
  { symbol: "DOT", name: "Polkadot", price: 7.18, change24h: -0.52, volume24h: 312000000, marketCap: 9200000000, high24h: 7.35, low24h: 7.02 },
  { symbol: "LTC", name: "Litecoin", price: 72.45, change24h: 1.12, volume24h: 523000000, marketCap: 5400000000, high24h: 74.20, low24h: 71.15 },
  { symbol: "ATOM", name: "Cosmos", price: 9.87, change24h: -1.67, volume24h: 198000000, marketCap: 3800000000, high24h: 10.12, low24h: 9.65 },
  { symbol: "TRX", name: "TRON", price: 0.1023, change24h: 0.85, volume24h: 892000000, marketCap: 9100000000, high24h: 0.1058, low24h: 0.0998 },
];

const formatPrice = (price: number): string => {
  if (price < 1) {
    return price.toFixed(4);
  }
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatVolume = (volume: number): string => {
  if (volume >= 1000000000) {
    return `$${(volume / 1000000000).toFixed(2)}B`;
  }
  return `$${(volume / 1000000).toFixed(2)}M`;
};

const ScreenerTerminal = () => {
  return (
    <div className="terminal-border bg-card rounded-lg overflow-hidden shadow-[0_0_10px_rgba(151,253,229,0.1)]">
      <div className="bg-secondary/50 border-b border-border px-4 py-3">
        <h2 className="text-page-heading text-primary">
          ASSET SCREENER TERMINAL
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-secondary/30 border-b border-border sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Symbol</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Price</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">24h Change</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">24h Volume</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Market Cap</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">24h High</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">24h Low</th>
            </tr>
          </thead>
          <tbody>
            {mockAssets.map((asset, index) => (
              <tr
                key={asset.symbol}
                className={cn(
                  "border-b border-border/50 hover:bg-accent/10 transition-colors cursor-pointer",
                  index === mockAssets.length - 1 && "border-b-0"
                )}
              >
                <td className="px-4 py-3">
                  <span className="text-sm font-bold">{asset.symbol}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-muted-foreground">{asset.name}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-semibold">${formatPrice(asset.price)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {asset.change24h >= 0 ? (
                      <>
                        <ArrowUp className="h-3 w-3 text-[var(--terminal-green)]" />
                        <span className="text-sm font-semibold text-[var(--terminal-green)]">
                          +{asset.change24h.toFixed(2)}%
                        </span>
                      </>
                    ) : (
                      <>
                        <ArrowDown className="h-3 w-3 text-[var(--terminal-red)]" />
                        <span className="text-sm font-semibold text-[var(--terminal-red)]">
                          {asset.change24h.toFixed(2)}%
                        </span>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-muted-foreground">{formatVolume(asset.volume24h)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-muted-foreground">{formatVolume(asset.marketCap)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-muted-foreground">${formatPrice(asset.high24h)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-muted-foreground">${formatPrice(asset.low24h)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScreenerTerminal;
