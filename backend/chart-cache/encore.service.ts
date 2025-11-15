import { api } from "encore.dev/api";

type RangeKey = '1H' | '4H' | '1D' | '7D' | '30D';

interface ChartCacheRequest {
  symbols: string[];
  range?: string;
}

interface ChartCacheResponse {
  data: Record<string, number[]>;
  meta: {
    range: string;
    symbolCount: number;
    generatedAt: number;
  };
}

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
  '1H': { interval: '1m', lookback: 60 },
  '4H': { interval: '3m', lookback: 80 },
  '1D': { interval: '15m', lookback: 96 },
  '7D': { interval: '1h', lookback: 168 },
  '30D': { interval: '4h', lookback: 180 },
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

// In-memory cache
const chartCache = new Map<string, ChartCacheEntry>();

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
  });

  if (!response.ok) {
    throw new Error(`candleSnapshot failed for ${symbol}: ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

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

async function getChartData(symbols: string[], range: RangeKey): Promise<Record<string, number[]>> {
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

// Encore API endpoint
export const chartCache = api(
  { method: "POST", path: "/chart-cache" },
  async (req: ChartCacheRequest): Promise<ChartCacheResponse> => {
    const { symbols, range = '1D' } = req;

    if (!Array.isArray(symbols) || symbols.length === 0) {
      throw new Error('symbols array is required');
    }

    const normalizedRange = normalizeRange(range);
    const data = await getChartData(symbols, normalizedRange);

    return {
      data,
      meta: {
        range: normalizedRange,
        symbolCount: Object.keys(data).length,
        generatedAt: Date.now(),
      },
    };
  }
);

