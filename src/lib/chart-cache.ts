type RangeKey = '1H' | '4H' | '1D' | '7D' | '30D';

type ChartCacheEntry = {
  data: number[];
  fetchedAt: number;
};

const HYPERLIQUID_API_URL = 'https://api.hyperliquid.xyz/info';

const CACHE_TTL_MS = 30 * 1000; // 30 seconds freshness
const RETENTION_MS = 5 * 60 * 1000; // 5 minutes retention
const MAX_POINTS = 120;
const BATCH_SIZE = 20;

// Optimized intervals for each range
const CANDLE_RANGE_CONFIG: Record<RangeKey, { interval: '1m' | '3m' | '15m' | '30m' | '1h' | '4h' | '1d'; lookback: number }> = {
  '1H': { interval: '1m', lookback: 60 },      // 60 x 1-min candles
  '4H': { interval: '3m', lookback: 80 },      // 80 x 3-min candles
  '1D': { interval: '15m', lookback: 96 },     // 96 x 15-min candles
  '7D': { interval: '1h', lookback: 168 },     // 168 x 1-hour candles
  '30D': { interval: '4h', lookback: 180 },    // 180 x 4-hour candles
};

const INTERVAL_MS: Record<string, number> = {
  '1m': 60 * 1000,
  '3m': 3 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

const globalCache = (globalThis as any).__HL_CHART_CACHE_MAP as Map<string, ChartCacheEntry> | undefined;
const chartCache: Map<string, ChartCacheEntry> = globalCache ?? new Map();

if (!globalCache) {
  (globalThis as any).__HL_CHART_CACHE_MAP = chartCache;
}

const makeCacheKey = (symbol: string, range: RangeKey) => `${symbol}:${range}`;

const normalizeRange = (range: string): RangeKey => {
  const upper = range.toUpperCase() as RangeKey;
  return ['1H', '4H', '1D', '7D', '30D'].includes(upper) ? upper : '1D';
};

const trimSeries = (series: number[]) => {
  if (series.length <= MAX_POINTS) return series;
  return series.slice(series.length - MAX_POINTS);
};

const sanitizeSeries = (series: number[]) =>
  trimSeries(series.filter((value) => Number.isFinite(value) && value > 0));

async function fetchCandles(symbol: string, range: RangeKey): Promise<number[]> {
  const config = CANDLE_RANGE_CONFIG[range];
  const intervalMs = INTERVAL_MS[config.interval];
  const startTime = Date.now() - config.lookback * intervalMs;

  const response = await fetch(HYPERLIQUID_API_URL, {
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
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`candleSnapshot failed for ${symbol}: ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  // Extract close prices from candles: {T, c, h, l, o, n, v}
  const series = data.map((candle: any) => Number(candle?.c ?? 0));
  return sanitizeSeries(series);
}

async function refreshSymbol(symbol: string, range: RangeKey) {
  try {
    const data = await fetchCandles(symbol, range);
    const key = makeCacheKey(symbol, range);
    chartCache.set(key, { data, fetchedAt: Date.now() });
    return data;
  } catch (error) {
    console.error(`[chart-cache] Failed to refresh ${symbol} (${range})`, error);
    throw error;
  }
}

type ChartDataRequest = {
  symbols: string[];
  range: RangeKey;
};

export async function getChartData({
  symbols,
  range,
}: ChartDataRequest): Promise<Record<string, number[]>> {
  const now = Date.now();
  const uniqueSymbols = Array.from(new Set(symbols.filter(Boolean)));

  const result: Record<string, number[]> = {};
  const needsRefresh: string[] = [];

  for (const symbol of uniqueSymbols) {
    const key = makeCacheKey(symbol, range);
    const cached = chartCache.get(key);

    if (cached) {
      result[symbol] = cached.data;
      const isFresh = now - cached.fetchedAt < CACHE_TTL_MS;
      if (!isFresh) {
        needsRefresh.push(symbol);
      }
    } else {
      needsRefresh.push(symbol);
    }
  }

  // Fetch stale/missing data in batches
  for (let i = 0; i < needsRefresh.length; i += BATCH_SIZE) {
    const batch = needsRefresh.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (symbol) => {
        try {
          const data = await refreshSymbol(symbol, range);
          result[symbol] = data;
        } catch {
          const key = makeCacheKey(symbol, range);
          const fallback = chartCache.get(key);
          if (fallback) {
            result[symbol] = fallback.data;
          } else if (!result[symbol]) {
            result[symbol] = [];
          }
        }
      }),
    );
  }

  return result;
}

export { normalizeRange };
