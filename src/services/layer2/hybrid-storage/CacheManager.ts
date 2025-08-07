/**
 * Cache Manager
 * 
 * Implements intelligent caching strategies for the Hybrid Storage Manager
 * with support for multiple eviction policies, TTL management, and persistence.
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';
import logger from '../../../utils/logger';
import {
  CacheConfig,
  CacheEntry,
  CacheMetrics,
  CacheError
} from './types';

export class CacheManager extends EventEmitter {
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = []; // For LRU
  private accessCount: Map<string, number> = new Map(); // For LFU
  private timers: Map<string, NodeJS.Timeout> = new Map(); // For TTL cleanup
  private metricsCollectionTimer?: NodeJS.Timeout | undefined;
  private persistenceTimer?: NodeJS.Timeout | undefined;
  private metrics: CacheMetrics;
  private hits = 0;
  private misses = 0;

  constructor(private config: CacheConfig) {
    super();
    this.metrics = this.initializeMetrics();
    this.setupMetricsCollection();
    this.setupPersistence();
  }

  /**
   * Initialize the cache manager
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Cache Manager');
      
      if (this.config.persistenceEnabled && this.config.persistenceFile) {
        await this.loadFromPersistence();
      }
      
      logger.info('Cache Manager initialized successfully');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize Cache Manager:', error);
      throw error;
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      this.metrics.missRate = this.calculateMissRate();
      this.emit('cache_miss', { key });
      return null;
    }

    // Check TTL expiration
    if (this.isExpired(entry)) {
      await this.delete(key);
      this.misses++;
      this.metrics.missRate = this.calculateMissRate();
      this.emit('cache_miss', { key, reason: 'expired' });
      return null;
    }

    // Update access tracking
    this.updateAccessTracking(key, entry);
    
    this.hits++;
    this.metrics.hitRate = this.calculateHitRate();
    this.emit('cache_hit', { key });
    
    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  async set<T = any>(
    key: string, 
    value: T, 
    ttl?: number, 
    tags?: string[]
  ): Promise<void> {
    try {
      // Check if we need to evict entries
      if (this.cache.size >= this.config.maxEntries) {
        await this.evictEntries(1);
      }

      // Calculate entry size
      const size = this.calculateSize(value);
      
      // Check memory limits
      if (this.getTotalSize() + size > this.config.maxMemoryMB * 1024 * 1024) {
        await this.evictByMemory(size);
      }

      const effectiveTTL = ttl || this.config.defaultTTL;
      const entry: CacheEntry<T> = {
        key,
        value,
        ttl: effectiveTTL,
        createdAt: new Date(),
        accessCount: 1,
        lastAccessed: new Date(),
        size,
        ...(tags && { tags })
      };

      // Remove existing entry if present
      if (this.cache.has(key)) {
        await this.delete(key);
      }

      // Add new entry
      this.cache.set(key, entry);
      this.accessOrder.push(key);
      this.accessCount.set(key, 1);

      // Set TTL timer
      if (effectiveTTL > 0) {
        const timer = setTimeout(() => {
          this.delete(key).catch(error => {
            logger.error(`Failed to delete expired cache entry ${key}:`, error);
          });
        }, effectiveTTL);
        
        this.timers.set(key, timer);
      }

      this.updateMetrics();
      this.emit('cache_set', { key, size, ttl: effectiveTTL });
      
    } catch (error) {
      logger.error(`Failed to set cache entry ${key}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorObj = error instanceof Error ? error : undefined;
      throw new CacheError(`Failed to set cache entry: ${errorMessage}`, key, errorObj);
    }
  }

  /**
   * Delete entry from cache
   */
  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Clear TTL timer
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }

    // Remove from tracking structures
    this.cache.delete(key);
    this.accessCount.delete(key);
    
    const orderIndex = this.accessOrder.indexOf(key);
    if (orderIndex !== -1) {
      this.accessOrder.splice(orderIndex, 1);
    }

    this.updateMetrics();
    this.emit('cache_delete', { key });
    
    return true;
  }

  /**
   * Clear cache entries by pattern or tags
   */
  async invalidate(pattern?: string, tags?: string[]): Promise<number> {
    let deletedCount = 0;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      let shouldDelete = false;

      // Check pattern match
      if (pattern) {
        const regex = new RegExp(pattern);
        shouldDelete = regex.test(key);
      }

      // Check tag match
      if (tags && entry.tags) {
        shouldDelete = shouldDelete || tags.some(tag => entry.tags!.includes(tag));
      }

      // If no pattern or tags specified, delete all
      if (!pattern && !tags) {
        shouldDelete = true;
      }

      if (shouldDelete) {
        keysToDelete.push(key);
      }
    }

    // Delete matched entries
    for (const key of keysToDelete) {
      if (await this.delete(key)) {
        deletedCount++;
      }
    }

    this.emit('cache_invalidate', { pattern, tags, deletedCount });
    return deletedCount;
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  getStats(): Record<string, any> {
    return {
      totalEntries: this.cache.size,
      totalSize: this.getTotalSize(),
      memoryUsageMB: this.getTotalSize() / (1024 * 1024),
      hitRate: this.metrics.hitRate,
      missRate: this.metrics.missRate,
      evictionRate: this.metrics.evictionRate,
      averageAccessTime: this.metrics.averageAccessTime,
      oldestEntry: this.getOldestEntry(),
      newestEntry: this.getNewestEntry()
    };
  }

  /**
   * Shutdown the cache manager
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Cache Manager');
      
      // Clear all timers
      for (const timer of this.timers.values()) {
        clearTimeout(timer);
      }
      this.timers.clear();
      
      if (this.metricsCollectionTimer) {
        clearInterval(this.metricsCollectionTimer);
        this.metricsCollectionTimer = undefined;
      }
      
      if (this.persistenceTimer) {
        clearInterval(this.persistenceTimer);
        this.persistenceTimer = undefined;
      }
      
      // Save to persistence if enabled
      if (this.config.persistenceEnabled) {
        await this.saveToPersistence();
      }
      
      // Clear cache
      this.cache.clear();
      this.accessOrder.length = 0;
      this.accessCount.clear();
      
      logger.info('Cache Manager shutdown completed');
      this.emit('shutdown');
    } catch (error) {
      logger.error('Cache Manager shutdown failed:', error);
      throw error;
    }
  }

  // Private helper methods

  private initializeMetrics(): CacheMetrics {
    return {
      hitRate: 0,
      missRate: 0,
      evictionRate: 0,
      totalEntries: 0,
      totalSize: 0,
      averageAccessTime: 0,
      memoryUsage: 0
    };
  }

  private setupMetricsCollection(): void {
    this.metricsCollectionTimer = setInterval(() => {
      this.updateMetrics();
    }, 10000); // Update every 10 seconds
    
    // Ensure timer doesn't keep Node.js process alive
    this.metricsCollectionTimer.unref();
  }

  private setupPersistence(): void {
    if (this.config.persistenceEnabled && this.config.persistenceFile) {
      this.persistenceTimer = setInterval(() => {
        this.saveToPersistence().catch(error => {
          logger.error('Failed to save cache to persistence:', error);
        });
      }, 60000); // Save every minute
      
      // Ensure timer doesn't keep Node.js process alive
      this.persistenceTimer.unref();
    }
  }

  private updateAccessTracking(key: string, entry: CacheEntry): void {
    entry.accessCount++;
    entry.lastAccessed = new Date();
    
    // Update access count tracking
    this.accessCount.set(key, entry.accessCount);
    
    // Update LRU order
    const orderIndex = this.accessOrder.indexOf(key);
    if (orderIndex !== -1) {
      this.accessOrder.splice(orderIndex, 1);
    }
    this.accessOrder.push(key);
  }

  private isExpired(entry: CacheEntry): boolean {
    if (entry.ttl <= 0) return false;
    return Date.now() - entry.createdAt.getTime() > entry.ttl;
  }

  private calculateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1024; // Default size for non-serializable objects
    }
  }

  private getTotalSize(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  private async evictEntries(count: number): Promise<void> {
    const keysToEvict = this.selectEvictionCandidates(count);
    
    for (const key of keysToEvict) {
      await this.delete(key);
      this.metrics.evictionRate++;
    }
    
    this.emit('cache_eviction', { count: keysToEvict.length, policy: this.config.evictionPolicy });
  }

  private async evictByMemory(requiredSize: number): Promise<void> {
    let freedSize = 0;
    const keysToEvict: string[] = [];
    
    while (freedSize < requiredSize && this.cache.size > 0) {
      const candidates = this.selectEvictionCandidates(1);
      if (candidates.length === 0) break;
      
      const key = candidates[0];
      const entry = this.cache.get(key);
      if (entry) {
        freedSize += entry.size;
        keysToEvict.push(key);
      }
    }
    
    for (const key of keysToEvict) {
      await this.delete(key);
      this.metrics.evictionRate++;
    }
  }

  private selectEvictionCandidates(count: number): string[] {
    const candidates: string[] = [];
    
    switch (this.config.evictionPolicy) {
      case 'lru':
        candidates.push(...this.accessOrder.slice(0, count));
        break;
        
      case 'lfu':
        const sortedByFrequency = Array.from(this.accessCount.entries())
          .sort(([, a], [, b]) => a - b)
          .slice(0, count)
          .map(([key]) => key);
        candidates.push(...sortedByFrequency);
        break;
        
      case 'ttl':
        const sortedByAge = Array.from(this.cache.entries())
          .sort(([, a], [, b]) => a.createdAt.getTime() - b.createdAt.getTime())
          .slice(0, count)
          .map(([key]) => key);
        candidates.push(...sortedByAge);
        break;
        
      case 'random':
        const keys = Array.from(this.cache.keys());
        for (let i = 0; i < Math.min(count, keys.length); i++) {
          const randomIndex = Math.floor(Math.random() * keys.length);
          candidates.push(keys[randomIndex]);
        }
        break;
    }
    
    return candidates;
  }

  private calculateHitRate(): number {
    const totalRequests = this.hits + this.misses;
    if (totalRequests === 0) {
      return 0;
    }
    
    return this.hits / totalRequests;
  }

  private calculateMissRate(): number {
    return 1 - this.calculateHitRate();
  }

  private updateMetrics(): void {
    this.metrics.totalEntries = this.cache.size;
    this.metrics.totalSize = this.getTotalSize();
    this.metrics.memoryUsage = this.metrics.totalSize / (this.config.maxMemoryMB * 1024 * 1024);
    
    // Calculate average access time (simplified)
    let totalAccessTime = 0;
    let accessCount = 0;
    
    for (const entry of this.cache.values()) {
      totalAccessTime += entry.lastAccessed.getTime() - entry.createdAt.getTime();
      accessCount += entry.accessCount;
    }
    
    this.metrics.averageAccessTime = accessCount > 0 ? totalAccessTime / accessCount : 0;
  }

  private getOldestEntry(): Date | null {
    let oldest: Date | null = null;
    
    for (const entry of this.cache.values()) {
      if (!oldest || entry.createdAt < oldest) {
        oldest = entry.createdAt;
      }
    }
    
    return oldest;
  }

  private getNewestEntry(): Date | null {
    let newest: Date | null = null;
    
    for (const entry of this.cache.values()) {
      if (!newest || entry.createdAt > newest) {
        newest = entry.createdAt;
      }
    }
    
    return newest;
  }

  private async loadFromPersistence(): Promise<void> {
    if (!this.config.persistenceFile) return;
    
    try {
      const data = await fs.readFile(this.config.persistenceFile, 'utf-8');
      const persistedData = JSON.parse(data);
      
      for (const entryData of persistedData.entries || []) {
        const entry: CacheEntry = {
          ...entryData,
          createdAt: new Date(entryData.createdAt),
          lastAccessed: new Date(entryData.lastAccessed)
        };
        
        // Check if entry is still valid
        if (!this.isExpired(entry)) {
          this.cache.set(entry.key, entry);
          this.accessOrder.push(entry.key);
          this.accessCount.set(entry.key, entry.accessCount);
        }
      }
      
      logger.info(`Loaded ${this.cache.size} entries from cache persistence`);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error('Failed to load cache from persistence:', error);
      }
    }
  }

  private async saveToPersistence(): Promise<void> {
    if (!this.config.persistenceFile) return;
    
    try {
      const persistenceDir = path.dirname(this.config.persistenceFile);
      await fs.mkdir(persistenceDir, { recursive: true });
      
      const persistedData = {
        timestamp: new Date().toISOString(),
        entries: Array.from(this.cache.values())
      };
      
      await fs.writeFile(
        this.config.persistenceFile,
        JSON.stringify(persistedData, null, 2),
        'utf-8'
      );
      
      logger.debug(`Saved ${this.cache.size} entries to cache persistence`);
    } catch (error) {
      logger.error('Failed to save cache to persistence:', error);
    }
  }
}

export default CacheManager;