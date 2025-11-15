"use client";

import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { SymbolBuffers } from '@/lib/ring-buffer';

interface PriceBufferContextType {
  getChartData: (symbol: string, range: string, pointCount?: number) => number[];
  appendPrice: (symbol: string, price: number) => void;
  hasData: (symbol: string, range: string) => boolean;
}

const PriceBufferContext = createContext<PriceBufferContextType | undefined>(undefined);

export const usePriceBuffer = () => {
  const context = useContext(PriceBufferContext);
  if (!context) {
    throw new Error('usePriceBuffer must be used within PriceBufferProvider');
  }
  return context;
};

export const PriceBufferProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Map of symbol -> SymbolBuffers (all time ranges)
  const buffersRef = useRef<Map<string, SymbolBuffers>>(new Map());
  
  // Sampling interval for 1-minute resolution
  const lastSampleRef = useRef<Map<string, number>>(new Map());
  const SAMPLE_INTERVAL_MS = 60 * 1000; // 1 minute

  /**
   * Get or create buffer for a symbol
   */
  const getOrCreateBuffer = useCallback((symbol: string): SymbolBuffers => {
    let buffer = buffersRef.current.get(symbol);
    if (!buffer) {
      buffer = new SymbolBuffers();
      buffersRef.current.set(symbol, buffer);
    }
    return buffer;
  }, []);

  /**
   * Append price update from WebSocket (activeAssetCtx)
   * Samples at 1-minute intervals to maintain consistent resolution
   */
  const appendPrice = useCallback((symbol: string, price: number) => {
    if (price <= 0) return; // Ignore invalid prices

    const now = Date.now();
    const lastSample = lastSampleRef.current.get(symbol) ?? 0;

    // Sample at 1-minute intervals
    if (now - lastSample >= SAMPLE_INTERVAL_MS) {
      const buffer = getOrCreateBuffer(symbol);
      buffer.appendToAll(now, price);
      lastSampleRef.current.set(symbol, now);
    }
  }, [getOrCreateBuffer]);

  /**
   * Get chart data for a symbol and range
   * Returns array of prices (timestamps not needed for sparklines)
   */
  const getChartData = useCallback((symbol: string, range: string, pointCount?: number): number[] => {
    const buffer = buffersRef.current.get(symbol);
    if (!buffer) return [];

    const data = buffer.read(range, pointCount);
    return data.map(point => point.price);
  }, []);

  /**
   * Check if buffer has data for a symbol/range
   */
  const hasData = useCallback((symbol: string, range: string): boolean => {
    const buffer = buffersRef.current.get(symbol);
    if (!buffer) return false;
    
    const rangeBuffer = buffer.getBuffer(range);
    return rangeBuffer ? rangeBuffer.getSize() > 0 : false;
  }, []);

  const value: PriceBufferContextType = {
    getChartData,
    appendPrice,
    hasData,
  };

  return (
    <PriceBufferContext.Provider value={value}>
      {children}
    </PriceBufferContext.Provider>
  );
};

