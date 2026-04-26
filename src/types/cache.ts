/**
 * Cache Type Definitions
 * Based on docs/design/speech-to-visuals/interfaces.ts
 */

// ========================================
// Cache Entry
// ========================================

export interface CacheEntry<T> {
  key: string;
  embedding: number[];
  result: T;
  timestamp: number;
  ttl: number;
}

// ========================================
// Cache Config
// ========================================

export interface CacheConfig {
  maxSize: number;
  ttl: number;
  similarityThreshold: number;
}

// ========================================
// Cache Stats
// ========================================

export interface CacheStats {
  hitRate: number;
  totalEntries: number;
  maxEntries: number;
  ttlMinutes: number;
  similarityThreshold: number;
}

// ========================================
// Semantic Cache Result
// ========================================

export interface SemanticCacheResult<T> {
  hit: boolean;
  entry?: CacheEntry<T>;
  similarity?: number;
}
