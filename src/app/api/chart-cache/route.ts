import { NextResponse } from 'next/server';
import { getChartData, normalizeRange } from '@/lib/chart-cache';

type ChartCacheRequestBody = {
  symbols: string[];
  range?: string;
};

export async function POST(request: Request) {
  try {
    const { symbols, range = '1D' } = (await request.json()) as ChartCacheRequestBody;

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: 'symbols array is required' }, { status: 400 });
    }

    const normalizedRange = normalizeRange(range);
    const data = await getChartData({ symbols, range: normalizedRange });

    return NextResponse.json({
      data,
      meta: {
        range: normalizedRange,
        symbolCount: Object.keys(data).length,
        generatedAt: Date.now(),
      },
    });
  } catch (error) {
    console.error('[chart-cache] route error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
