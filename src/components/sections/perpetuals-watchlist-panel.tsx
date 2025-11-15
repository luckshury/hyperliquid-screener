import { ArrowUp, ArrowDown } from 'lucide-react';

type PerpetualData = {
  symbol: string;
  price: number;
  change: number;
  volume: number;
  markPrice: number;
};

const mockData: PerpetualData[] = [
  { symbol: 'BTCUSDT', price: 67123.45, change: 1.25, volume: 2450000000, markPrice: 67124.00 },
  { symbol: 'ETHUSDT', price: 3456.78, change: -0.89, volume: 1890000000, markPrice: 3456.50 },
  { symbol: 'SOLUSDT', price: 165.20, change: 2.50, volume: 980000000, markPrice: 165.22 },
  { symbol: 'BNBUSDT', price: 598.50, change: -1.45, volume: 750000000, markPrice: 598.45 },
  { symbol: 'XRPUSDT', price: 0.5234, change: 0.15, volume: 540000000, markPrice: 0.5235 },
  { symbol: 'DOGEUSDT', price: 0.1589, change: -3.12, volume: 320000000, markPrice: 0.1588 },
  { symbol: 'ADAUSDT', price: 0.4578, change: 1.05, volume: 410000000, markPrice: 0.4579 },
  { symbol: 'LINKUSDT', price: 18.75, change: -0.55, volume: 380000000, markPrice: 18.74 },
  { symbol: 'AVAXUSDT', price: 35.40, change: 3.15, volume: 620000000, markPrice: 35.42 },
];

const formatVolume = (volume: number): string => {
  if (volume >= 1e9) {
    return `${(volume / 1e9).toFixed(2)}B`;
  }
  if (volume >= 1e6) {
    return `${(volume / 1e6).toFixed(2)}M`;
  }
  if (volume >= 1e3) {
    return `${(volume / 1e3).toFixed(2)}K`;
  }
  return volume.toString();
};

const formatPrice = (price: number) => {
  const options: Intl.NumberFormatOptions = {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: price < 1 ? 4 : 2,
  };
  return price.toLocaleString('en-US', options);
};

const PerpetualsWatchlistPanel = () => {
  return (
    <div className="terminal-border flex flex-col bg-card rounded">
      <div className="flex items-center justify-between border-b border-border px-3 sm:px-4 py-2 bg-secondary/30">
        <h3 className="text-xs sm:text-sm font-bold text-primary terminal-glow">
          PERPETUALS WATCHLIST
        </h3>
      </div>
      <div className="flex-1 overflow-x-auto relative">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border/50">
              <th className="text-left font-normal text-tiny text-muted-foreground px-3 sm:px-4 py-3 whitespace-nowrap">Symbol</th>
              <th className="text-right font-normal text-tiny text-muted-foreground px-3 py-3 whitespace-nowrap">Price</th>
              <th className="text-right font-normal text-tiny text-muted-foreground px-3 py-3 whitespace-nowrap">24h Change</th>
              <th className="text-right font-normal text-tiny text-muted-foreground px-3 py-3 whitespace-nowrap">24h Volume</th>
              <th className="text-right font-normal text-tiny text-muted-foreground px-3 sm:px-4 py-3 whitespace-nowrap">Mark Price</th>
            </tr>
          </thead>
          <tbody>
            {mockData.map((item) => (
              <tr key={item.symbol} className="border-b border-border/50 last:border-0 hover:bg-accent/10 transition-colors duration-150 cursor-pointer">
                <td className="px-3 sm:px-4 py-2">
                  <span className="font-bold text-small-value text-foreground">{item.symbol}</span>
                </td>
                <td className="text-right text-small-value font-semibold px-3 py-2 tabular-nums">
                  {formatPrice(item.price)}
                </td>
                <td className="px-3 py-2">
                  <div className={`flex items-center justify-end gap-1 text-small-value tabular-nums ${item.change >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                    {item.change >= 0 ? <ArrowUp size={12} className="flex-shrink-0" /> : <ArrowDown size={12} className="flex-shrink-0" />}
                    <span>{item.change.toFixed(2)}%</span>
                  </div>
                </td>
                <td className="text-right text-small text-muted-foreground px-3 py-2 tabular-nums">
                  {formatVolume(item.volume)}
                </td>
                <td className="text-right text-small text-muted-foreground px-3 sm:px-4 py-2 tabular-nums">
                  {formatPrice(item.markPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PerpetualsWatchlistPanel;