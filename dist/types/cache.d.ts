/**
 * Cache Type Definitions
 * Based on docs/design/speech-to-visuals/interfaces.ts
 */
export interface CacheEntry<T> {
    key: string;
    embedding: number[];
    result: T;
    timestamp: number;
    ttl: number;
}
export interface CacheConfig {
    maxSize: number;
    ttl: number;
    similarityThreshold: number;
}
export interface CacheStats {
    hitRate: number;
    totalEntries: number;
    maxEntries: number;
    ttlMinutes: number;
    similarityThreshold: number;
}
export interface SemanticCacheResult<T> {
    hit: boolean;
    entry?: CacheEntry<T>;
    similarity?: number;
}
