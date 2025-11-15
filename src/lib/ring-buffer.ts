/**
 * Ring Buffer for storing price history with fixed memory footprint
 * Uses typed arrays for memory efficiency
 */
export class RingBuffer {
  private prices: Float32Array;
  private timestamps: Float64Array;
  private writeIndex: number = 0;
  private filled: boolean = false;
  public readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.prices = new Float32Array(capacity);
    this.timestamps = new Float64Array(capacity);
  }

  /**
   * Append a new price point to the buffer
   * Automatically overwrites oldest data when full
   */
  append(timestamp: number, price: number): void {
    this.prices[this.writeIndex] = price;
    this.timestamps[this.writeIndex] = timestamp;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    
    if (this.writeIndex === 0) {
      this.filled = true;
    }
  }

  /**
   * Read the last N points in chronological order
   * Returns empty array if buffer is empty
   */
  read(count?: number): Array<{ timestamp: number; price: number }> {
    const actualCount = Math.min(count ?? this.capacity, this.getSize());
    if (actualCount === 0) return [];

    const result: Array<{ timestamp: number; price: number }> = [];
    const startIndex = this.filled 
      ? (this.writeIndex + this.capacity - actualCount) % this.capacity
      : 0;

    for (let i = 0; i < actualCount; i++) {
      const idx = (startIndex + i) % this.capacity;
      result.push({
        timestamp: this.timestamps[idx],
        price: this.prices[idx],
      });
    }

    return result;
  }

  /**
   * Get current number of valid data points
   */
  getSize(): number {
    return this.filled ? this.capacity : this.writeIndex;
  }

  /**
   * Get the most recent price
   */
  getLatest(): number | null {
    const size = this.getSize();
    if (size === 0) return null;
    
    const lastIdx = (this.writeIndex - 1 + this.capacity) % this.capacity;
    return this.prices[lastIdx];
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.writeIndex = 0;
    this.filled = false;
  }
}

/**
 * Multi-resolution ring buffer manager for a single symbol
 * Maintains separate buffers for different time ranges
 */
export class SymbolBuffers {
  private buffers: Map<string, RingBuffer>;

  constructor() {
    this.buffers = new Map([
      ['1H', new RingBuffer(60)],      // 60 points at 1min = 1 hour
      ['4H', new RingBuffer(240)],     // 240 points at 1min = 4 hours
      ['1D', new RingBuffer(1440)],    // 1440 points at 1min = 24 hours
      ['7D', new RingBuffer(10080)],   // 10080 points at 1min = 7 days
      ['30D', new RingBuffer(43200)],  // 43200 points at 1min = 30 days
    ]);
  }

  /**
   * Append price to all buffers
   */
  appendToAll(timestamp: number, price: number): void {
    for (const buffer of this.buffers.values()) {
      buffer.append(timestamp, price);
    }
  }

  /**
   * Get buffer for specific range
   */
  getBuffer(range: string): RingBuffer | undefined {
    return this.buffers.get(range);
  }

  /**
   * Read data from specific range buffer
   */
  read(range: string, count?: number): Array<{ timestamp: number; price: number }> {
    const buffer = this.buffers.get(range);
    return buffer?.read(count) ?? [];
  }

  /**
   * Clear all buffers
   */
  clearAll(): void {
    for (const buffer of this.buffers.values()) {
      buffer.clear();
    }
  }
}

