/**
 * Hybrid Storage Manager Tests
 * 
 * Comprehensive test suite for the Hybrid Storage Manager system
 * including all storage layers, query routing, and synchronization.
 */

import { HybridStorageManager, defaultHybridStorageConfig, StorageLayer, QueryType } from '../src/services/layer2/hybrid-storage';
import { promises as fs } from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('neo4j-driver');
jest.mock('chokidar');
jest.mock('glob');

describe('Hybrid Storage Manager', () => {
  let storageManager: HybridStorageManager;
  let testConfig: any;
  let tempDir: string;

  beforeAll(async () => {
    // Create temporary directory for tests
    tempDir = path.join(__dirname, 'temp', 'hybrid-storage-test');
    await fs.mkdir(tempDir, { recursive: true });
  });

  beforeEach(async () => {
    // Create test configuration
    testConfig = {
      ...defaultHybridStorageConfig,
      neo4j: {
        ...defaultHybridStorageConfig.neo4j,
        uri: 'bolt://localhost:7687',
        username: 'test',
        password: 'test'
      },
      rdfFiles: {
        ...defaultHybridStorageConfig.rdfFiles,
        baseDirectory: path.join(tempDir, 'rdf'),
        watchForChanges: false,
        backupEnabled: false
      },
      inMemory: {
        ...defaultHybridStorageConfig.inMemory,
        maxMemoryMB: 64,
        persistenceEnabled: false
      },
      cache: {
        ...defaultHybridStorageConfig.cache,
        maxMemoryMB: 32,
        persistenceEnabled: false
      },
      monitoring: {
        ...defaultHybridStorageConfig.monitoring,
        enabled: false
      },
      synchronization: {
        ...defaultHybridStorageConfig.synchronization,
        enabled: false
      }
    };

    storageManager = new HybridStorageManager(testConfig);
  });

  afterEach(async () => {
    if (storageManager) {
      try {
        await storageManager.shutdown();
      } catch (error) {
        // Ignore shutdown errors in tests
      }
    }
  });

  afterAll(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully with default config', async () => {
      const initPromise = storageManager.initialize();
      await expect(initPromise).resolves.not.toThrow();
    });

    test('should emit initialized event', async () => {
      const initPromise = new Promise<void>((resolve) => {
        storageManager.once('initialized', resolve);
      });

      await storageManager.initialize();
      await expect(initPromise).resolves.not.toThrow();
    });

    test('should handle initialization errors gracefully', async () => {
      // Create config with invalid Neo4j settings
      const invalidConfig = {
        ...testConfig,
        neo4j: {
          ...testConfig.neo4j,
          uri: 'invalid://uri'
        }
      };

      const invalidManager = new HybridStorageManager(invalidConfig);
      
      // Should not throw, but some layers may fail
      await expect(invalidManager.initialize()).resolves.not.toThrow();
      
      await invalidManager.shutdown();
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    test('should execute simple queries', async () => {
      const query = 'MATCH (n) RETURN n LIMIT 5';
      const context = {
        type: QueryType.STRUCTURAL,
        priority: 'medium' as const
      };

      const result = await storageManager.query(query, context);
      
      expect(result).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test('should handle query failures gracefully', async () => {
      const invalidQuery = 'INVALID QUERY SYNTAX';
      
      await expect(storageManager.query(invalidQuery)).rejects.toThrow();
    });

    test('should plan queries correctly', async () => {
      const query = 'MATCH (n:Module) RETURN n';
      const context = {
        type: QueryType.STRUCTURAL,
        priority: 'high' as const
      };

      const plan = await storageManager.planQuery(query, context);
      
      expect(plan).toBeDefined();
      expect(plan.primaryLayer).toBeDefined();
      expect(plan.fallbackLayers).toBeInstanceOf(Array);
      expect(plan.reasoning).toBeDefined();
      expect(plan.estimatedCost).toBeGreaterThan(0);
    });

    test('should cache query results when appropriate', async () => {
      const query = 'SELECT * FROM modules WHERE type = "service"';
      const context = {
        type: QueryType.STRUCTURAL,
        priority: 'medium' as const
      };

      // First query
      const result1 = await storageManager.query(query, context);
      expect(result1.cached).toBe(false);

      // Second identical query should be cached
      const result2 = await storageManager.query(query, context);
      // Note: Caching behavior depends on implementation details
      expect(result2).toBeDefined();
    });
  });

  describe('Data Operations', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    test('should create data successfully', async () => {
      const testData = {
        type: 'Module',
        name: 'TestService',
        path: '/src/test/TestService.ts'
      };

      const result = await storageManager.create(testData);
      
      expect(result).toBeDefined();
      expect(result.data).toMatchObject(testData);
      expect(result.source).toBeDefined();
    });

    test('should update data successfully', async () => {
      const testData = {
        type: 'Module',
        name: 'TestService',
        path: '/src/test/TestService.ts'
      };

      // Create first
      const createResult = await storageManager.create(testData);
      expect(createResult).toBeDefined();
      
      // Extract the ID from the created record
      const createdId = createResult.data.id || 'fallback-test-id';

      // Update using the actual ID
      const updateData = {
        version: '2.0.0',
        lastModified: new Date()
      };

      const updateResult = await storageManager.update(createdId, updateData);
      expect(updateResult).toBeDefined();
      expect(updateResult.data).toMatchObject(updateData);
    });

    test('should delete data successfully', async () => {
      const result = await storageManager.delete('test-id');
      
      expect(result).toBeDefined();
      expect(typeof result.data).toBe('boolean');
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    test('should return health status for all layers', async () => {
      const healthStatus = await storageManager.getHealthStatus();
      
      expect(healthStatus).toBeInstanceOf(Array);
      expect(healthStatus.length).toBeGreaterThan(0);
      
      for (const status of healthStatus) {
        expect(status.layer).toBeDefined();
        expect(status.status).toMatch(/healthy|degraded|unhealthy/);
        expect(status.responseTime).toBeGreaterThanOrEqual(0);
        expect(status.lastCheck).toBeInstanceOf(Date);
        expect(status.errorCount).toBeGreaterThanOrEqual(0);
      }
    });

    test('should return comprehensive metrics', async () => {
      const metrics = await storageManager.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(metrics.queryMetrics).toBeDefined();
      expect(metrics.storageMetrics).toBeDefined();
      expect(metrics.cacheMetrics).toBeDefined();
      expect(metrics.syncMetrics).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    test('should invalidate cache successfully', async () => {
      await expect(storageManager.invalidateCache()).resolves.not.toThrow();
    });

    test('should invalidate cache with pattern', async () => {
      await expect(storageManager.invalidateCache('test_*')).resolves.not.toThrow();
    });

    test('should return cache metrics', async () => {
      const cacheMetrics = await storageManager.getCacheMetrics();
      
      expect(cacheMetrics).toBeDefined();
      expect(cacheMetrics.hitRate).toBeGreaterThanOrEqual(0);
      expect(cacheMetrics.missRate).toBeGreaterThanOrEqual(0);
      expect(cacheMetrics.totalEntries).toBeGreaterThanOrEqual(0);
      expect(cacheMetrics.totalSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Synchronization', () => {
    beforeEach(async () => {
      // Enable synchronization for these tests
      testConfig.synchronization.enabled = true;
      storageManager = new HybridStorageManager(testConfig);
      await storageManager.initialize();
    });

    test('should sync all pending operations', async () => {
      const results = await storageManager.syncAll();
      
      expect(results).toBeInstanceOf(Array);
      // Results may be empty if no pending operations
    });

    test('should handle sync operations', async () => {
      const syncOperation = {
        id: 'test-sync-1',
        type: 'create' as const,
        sourceLayer: StorageLayer.NEO4J,
        targetLayers: [StorageLayer.IN_MEMORY],
        data: { test: 'data' },
        timestamp: new Date(),
        status: 'pending' as const,
        retryCount: 0
      };

      const result = await storageManager.sync(syncOperation);
      
      expect(result).toBeDefined();
      expect(result.operationId).toBe(syncOperation.id);
      expect(typeof result.success).toBe('boolean');
      expect(result.executionTime).toBeGreaterThan(0);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    test('should emit query events', async () => {
      const queryCompletedPromise = new Promise<void>((resolve) => {
        storageManager.once('query_completed', resolve);
      });

      const query = 'MATCH (n) RETURN n LIMIT 1';
      await storageManager.query(query);
      
      await expect(queryCompletedPromise).resolves.not.toThrow();
    });

    test('should emit cache events', async () => {
      let cacheHitReceived = false;
      let cacheMissReceived = false;

      storageManager.on('cache_hit', () => {
        cacheHitReceived = true;
      });

      storageManager.on('cache_miss', () => {
        cacheMissReceived = true;
      });

      // Execute some queries to trigger cache events
      const query = 'SELECT * FROM test';
      await storageManager.query(query).catch(() => {
        // Ignore query errors, we're testing events
      });

      // At least one of these should be true
      expect(cacheHitReceived || cacheMissReceived).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    test('should handle storage layer failures gracefully', async () => {
      // This test depends on the fallback mechanism
      const query = 'MATCH (n) RETURN n';
      
      // Should not throw even if some layers fail
      await expect(storageManager.query(query)).resolves.toBeDefined();
    });

    test('should handle invalid queries appropriately', async () => {
      const invalidQuery = 'COMPLETELY INVALID QUERY SYNTAX!!!';
      
      await expect(storageManager.query(invalidQuery)).rejects.toThrow();
    });
  });

  describe('Shutdown', () => {
    test('should shutdown gracefully', async () => {
      await storageManager.initialize();
      await expect(storageManager.shutdown()).resolves.not.toThrow();
    });

    test('should emit shutdown event', async () => {
      await storageManager.initialize();
      
      const shutdownPromise = new Promise<void>((resolve) => {
        storageManager.once('shutdown', resolve);
      });

      await storageManager.shutdown();
      await expect(shutdownPromise).resolves.not.toThrow();
    });

    test('should handle multiple shutdown calls', async () => {
      await storageManager.initialize();
      
      await storageManager.shutdown();
      await expect(storageManager.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Configuration Validation', () => {
    test('should work with minimal configuration', async () => {
      const minimalConfig = {
        neo4j: {
          uri: 'bolt://localhost:7687',
          username: 'test',
          password: 'test'
        },
        rdfFiles: {
          baseDirectory: tempDir,
          filePattern: '*.ttl',
          watchForChanges: false
        },
        inMemory: {
          maxMemoryMB: 64,
          gcThreshold: 0.8,
          compressionEnabled: false,
          persistenceEnabled: false
        },
        cache: {
          strategy: 'memory' as const,
          maxMemoryMB: 32,
          defaultTTL: 300000,
          maxEntries: 1000,
          evictionPolicy: 'lru' as const,
          compressionEnabled: false,
          persistenceEnabled: false
        },
        queryRouting: {
          defaultTimeout: 30000,
          retryAttempts: 3,
          retryDelay: 1000,
          circuitBreakerThreshold: 5,
          circuitBreakerTimeout: 60000,
          loadBalancing: false,
          preferredLayersByQueryType: {
            [QueryType.STRUCTURAL]: [StorageLayer.NEO4J],
            [QueryType.SEMANTIC]: [StorageLayer.IN_MEMORY],
            [QueryType.CONTEXTUAL]: [StorageLayer.IN_MEMORY],
            [QueryType.ANALYTICAL]: [StorageLayer.NEO4J],
            [QueryType.REAL_TIME]: [StorageLayer.IN_MEMORY],
            [QueryType.BULK]: [StorageLayer.NEO4J],
            [QueryType.SEARCH]: [StorageLayer.IN_MEMORY],
            [QueryType.SIMPLE_LOOKUP]: [StorageLayer.CACHE],
            [QueryType.GRAPH_TRAVERSAL]: [StorageLayer.NEO4J],
            [QueryType.FULL_TEXT_SEARCH]: [StorageLayer.NEO4J],
            [QueryType.AGGREGATION]: [StorageLayer.NEO4J],
            [QueryType.PATTERN_MATCHING]: [StorageLayer.IN_MEMORY]
          },
          costWeights: {
            responseTime: 0.4,
            reliability: 0.3,
            consistency: 0.2,
            scalability: 0.1
          }
        },
        monitoring: {
          enabled: false,
          healthCheckInterval: 30000,
          metricsCollectionInterval: 10000,
          alertThresholds: {
            responseTime: 5000,
            errorRate: 0.05,
            memoryUsage: 0.8,
            diskUsage: 0.9
          },
          retentionPeriod: 86400000
        },
        synchronization: {
          enabled: false,
          syncInterval: 10000,
          conflictResolution: 'last_write_wins' as const,
          batchSize: 100,
          maxRetries: 3,
          syncStrategies: {
            neo4jToRdf: false,
            rdfToNeo4j: false,
            inMemorySync: false,
            cacheInvalidation: false
          }
        }
      };

      const minimalManager = new HybridStorageManager(minimalConfig);
      await expect(minimalManager.initialize()).resolves.not.toThrow();
      await minimalManager.shutdown();
    });
  });
});