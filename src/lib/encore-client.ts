"use client";

// Encore client for frontend API calls
// In production, Encore will handle routing automatically
// In development, we'll proxy through Next.js or call Encore directly

const ENCORE_BASE_URL = process.env.NEXT_PUBLIC_ENCORE_URL || 'http://localhost:4000';

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

interface AnalyticsRequest {
  type: string;
  [key: string]: any;
}

interface PerpSnapshotRequest {
  type: string;
  market_names?: string[];
}

export const encoreClient = {
  chartCache: {
    async get(req: ChartCacheRequest): Promise<ChartCacheResponse> {
      const response = await fetch(`${ENCORE_BASE_URL}/chart-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });

      if (!response.ok) {
        throw new Error(`Chart cache request failed: ${response.status}`);
      }

      return response.json();
    },
  },

  analytics: {
    async post(req: AnalyticsRequest): Promise<any> {
      const response = await fetch(`${ENCORE_BASE_URL}/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });

      if (!response.ok) {
        throw new Error(`Analytics request failed: ${response.status}`);
      }

      return response.json();
    },
  },

  perpSnapshot: {
    async post(req: PerpSnapshotRequest): Promise<any> {
      const response = await fetch(`${ENCORE_BASE_URL}/perp-snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });

      if (!response.ok) {
        throw new Error(`Perp snapshot request failed: ${response.status}`);
      }

      // Handle both JSON and binary responses
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return response.json();
      }

      // For binary data, return the response object with headers
      const arrayBuffer = await response.arrayBuffer();
      return {
        data: arrayBuffer,
        headers: {
          payloadFormat: response.headers.get('x-payload-format'),
          contentEncoding: response.headers.get('content-encoding'),
          compression: response.headers.get('x-compression'),
        },
      };
    },
  },
};

