/**
 * Hybrid Storage Manager Types
 * 
 * Defines interfaces and types for coordinating between Neo4j, RDF files, 
 * and in-memory storage systems with intelligent query routing and caching.
 */


// Storage Layer Types
export enum StorageLayer {
  NEO4J = 'neo4j',
  RDF_FILES = 'rdf_files',
  IN_MEMORY = 'in_memory',
  CACHE = 'cache'
}

export interface StorageLayerHealth {
  layer: StorageLayer;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: Date;
  errorCount: number;
  details?: Record<string, any>;
}

// Query Types
export enum QueryType {
  STRUCTURAL = 'structural',      // Complex graph relationships
  SEMANTIC = 'semantic',          // RDF/SPARQL queries
  CONTEXTUAL = 'contextual',      // LLM context retrieval
  ANALYTICAL = 'analytical',      // Metrics and aggregations
  REAL_TIME = 'real_time',        // Live data updates
  BULK = 'bulk',                  // Large data operations
  SEARCH = 'search',              // Text/semantic search
  SIMPLE_LOOKUP = 'simple_lookup',
  GRAPH_TRAVERSAL = 'graph_traversal',
  FULL_TEXT_SEARCH = 'full_text_search',
  AGGREGATION = 'aggregation',
  PATTERN_MATCHING = 'pattern_matching'
}

export enum QueryComplexity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export interface QueryContext {
  type: QueryType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;
  cacheKey?: string;
  cacheTTL?: number;
  preferredLayers?: StorageLayer[];
  fallbackLayers?: StorageLayer[];
  metadata?: Record<string, any>;
}

export interface QueryResult<T = any> {
  data: T;
  source: StorageLayer;
  executionTime: number;
  cached: boolean;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface QueryPlan {
  primaryLayer: StorageLayer;
  fallbackLayers: StorageLayer[];
  cacheStrategy: CacheStrategy;
  estimatedCost: number;
  reasoning: string;
}

// Cache Types
export type CacheStrategy = 
  | 'none'
  | 'memory'
  | 'persistent'
  | 'distributed'
  | 'write_through'
  | 'write_back'
  | 'read_through';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl: number;
  createdAt: Date;
  accessCount: number;
  lastAccessed: Date;
  size: number;
  tags?: string[];
}

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  totalEntries: number;
  totalSize: number;
  averageAccessTime: number;
  memoryUsage: number;
}

// Storage Configuration
export interface Neo4jStorageConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
  maxConnectionPoolSize?: number;
  connectionTimeout?: number;
  maxTransactionRetryTime?: number;
}

export interface RDFStorageConfig {
  baseDirectory: string;
  filePattern: string;
  watchForChanges: boolean;
  syncInterval?: number;
  backupEnabled?: boolean;
  backupDirectory?: string;
}

export interface InMemoryStorageConfig {
  maxMemoryMB: number;
  gcThreshold: number;
  compressionEnabled: boolean;
  persistenceEnabled: boolean;
  persistenceFile?: string;
}

export interface CacheConfig {
  strategy: CacheStrategy;
  maxMemoryMB: number;
  defaultTTL: number;
  maxEntries: number;
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'random';
  compressionEnabled: boolean;
  persistenceEnabled: boolean;
  persistenceFile?: string;
}

export interface HybridStorageConfig {
  neo4j: Neo4jStorageConfig;
  rdfFiles: RDFStorageConfig;
  inMemory: InMemoryStorageConfig;
  cache: CacheConfig;
  queryRouting: QueryRoutingConfig;
  monitoring: MonitoringConfig;
  synchronization: SynchronizationConfig;
}

// Query Routing Configuration
export interface QueryRoutingConfig {
  defaultTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  loadBalancing: boolean;
  preferredLayersByQueryType: Record<QueryType, StorageLayer[]>;
  costWeights: {
    responseTime: number;
    reliability: number;
    consistency: number;
    scalability: number;
  };
}

// Monitoring Configuration
export interface MonitoringConfig {
  enabled: boolean;
  healthCheckInterval: number;
  metricsCollectionInterval: number;
  alertThresholds: {
    responseTime: number;
    errorRate: number;
    memoryUsage: number;
    diskUsage: number;
  };
  retentionPeriod: number;
}

// Synchronization Configuration
export interface SynchronizationConfig {
  enabled: boolean;
  syncInterval: number;
  conflictResolution: 'last_write_wins' | 'merge' | 'manual';
  batchSize: number;
  maxRetries: number;
  syncStrategies: {
    neo4jToRdf: boolean;
    rdfToNeo4j: boolean;
    inMemorySync: boolean;
    cacheInvalidation: boolean;
  };
}

// Data Synchronization Types
export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'bulk';
  sourceLayer: StorageLayer;
  targetLayers: StorageLayer[];
  data: any;
  timestamp: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  retryCount: number;
  error?: string;
}

export interface SyncResult {
  operationId: string;
  success: boolean;
  affectedLayers: StorageLayer[];
  executionTime: number;
  recordsProcessed: number;
  errors?: string[];
}

export interface ConflictResolution {
  conflictId: string;
  sourceLayer: StorageLayer;
  targetLayer: StorageLayer;
  conflictType: 'version' | 'schema' | 'data' | 'constraint';
  resolution: 'source_wins' | 'target_wins' | 'merge' | 'manual';
  resolvedData?: any;
  timestamp: Date;
}

// Storage Interface Definitions
export interface StorageInterface {
  readonly layer: StorageLayer;
  
  // Basic Operations
  query<T = any>(query: string, params?: Record<string, any>, context?: QueryContext): Promise<QueryResult<T>>;
  create(data: any, context?: QueryContext): Promise<QueryResult<any>>;
  update(id: string, data: any, context?: QueryContext): Promise<QueryResult<any>>;
  delete(id: string, context?: QueryContext): Promise<QueryResult<boolean>>;
  
  // Health and Status
  healthCheck(): Promise<StorageLayerHealth>;
  getMetrics(): Promise<Record<string, any>>;
  
  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

// Hybrid Storage Manager Interface
export interface HybridStorageManagerInterface {
  // Query Operations
  query<T = any>(query: string, context?: QueryContext): Promise<QueryResult<T>>;
  planQuery(query: string, context?: QueryContext): Promise<QueryPlan>;
  
  // Data Operations
  create(data: any, context?: QueryContext): Promise<QueryResult<any>>;
  update(id: string, data: any, context?: QueryContext): Promise<QueryResult<any>>;
  delete(id: string, context?: QueryContext): Promise<QueryResult<boolean>>;
  
  // Synchronization
  sync(operation: SyncOperation): Promise<SyncResult>;
  syncAll(): Promise<SyncResult[]>;
  resolveConflict(conflict: ConflictResolution): Promise<boolean>;
  
  // Cache Management
  invalidateCache(pattern?: string): Promise<void>;
  getCacheMetrics(): Promise<CacheMetrics>;
  
  // Health and Monitoring
  getHealthStatus(): Promise<StorageLayerHealth[]>;
  getMetrics(): Promise<HybridStorageMetrics>;
  
  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

// Metrics and Monitoring
export interface HybridStorageMetrics {
  timestamp: Date;
  queryMetrics: {
    totalQueries: number;
    averageResponseTime: number;
    queryDistribution: Record<StorageLayer, number>;
    errorRate: number;
    throughput: number;
  };
  storageMetrics: Record<StorageLayer, {
    health: StorageLayerHealth;
    usage: {
      memoryMB: number;
      diskMB?: number;
      connections?: number;
    };
    performance: {
      averageResponseTime: number;
      throughput: number;
      errorRate: number;
    };
  }>;
  cacheMetrics: CacheMetrics;
  syncMetrics: {
    totalOperations: number;
    successRate: number;
    averageSyncTime: number;
    pendingOperations: number;
    conflictCount: number;
  };
}

// Event Types
export interface StorageEvent {
  type: 'query' | 'sync' | 'health' | 'cache' | 'error';
  layer?: StorageLayer;
  timestamp: Date;
  data: any;
  metadata?: Record<string, any>;
}

export type StorageEventHandler = (event: StorageEvent) => void | Promise<void>;

// Error Types
export class HybridStorageError extends Error {
  constructor(
    message: string,
    public readonly layer?: StorageLayer,
    public readonly operation?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'HybridStorageError';
  }
}

export class QueryRoutingError extends HybridStorageError {
  constructor(message: string, public readonly queryType?: QueryType) {
    super(message);
    this.name = 'QueryRoutingError';
  }
}

export class SynchronizationError extends HybridStorageError {
  constructor(
    message: string,
    public readonly syncOperation?: SyncOperation,
    cause?: Error
  ) {
    super(message, undefined, 'sync', cause);
    this.name = 'SynchronizationError';
  }
}

export class CacheError extends HybridStorageError {
  constructor(message: string, public readonly cacheKey?: string, cause?: Error) {
    super(message, StorageLayer.CACHE, 'cache', cause);
    this.name = 'CacheError';
  }
}

// Default Configurations
export const defaultHybridStorageConfig: HybridStorageConfig = {
  neo4j: {
    uri: 'bolt://localhost:7687',
    username: 'neo4j',
    password: 'password',
    database: 'neo4j',
    maxConnectionPoolSize: 50,
    connectionTimeout: 30000,
    maxTransactionRetryTime: 30000
  },
  rdfFiles: {
    baseDirectory: './data/rdf',
    filePattern: '**/*.module-knowledge.ttl',
    watchForChanges: true,
    syncInterval: 5000,
    backupEnabled: true,
    backupDirectory: './data/rdf/backups'
  },
  inMemory: {
    maxMemoryMB: 512,
    gcThreshold: 0.8,
    compressionEnabled: true,
    persistenceEnabled: false
  },
  cache: {
    strategy: 'memory',
    maxMemoryMB: 256,
    defaultTTL: 300000, // 5 minutes
    maxEntries: 10000,
    evictionPolicy: 'lru',
    compressionEnabled: false,
    persistenceEnabled: false
  },
  queryRouting: {
    defaultTimeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000,
    loadBalancing: true,
    preferredLayersByQueryType: {
      [QueryType.STRUCTURAL]: [StorageLayer.NEO4J, StorageLayer.IN_MEMORY, StorageLayer.CACHE],
      [QueryType.SEMANTIC]: [StorageLayer.IN_MEMORY, StorageLayer.RDF_FILES, StorageLayer.CACHE],
      [QueryType.CONTEXTUAL]: [StorageLayer.IN_MEMORY, StorageLayer.CACHE, StorageLayer.RDF_FILES],
      [QueryType.ANALYTICAL]: [StorageLayer.NEO4J, StorageLayer.CACHE, StorageLayer.IN_MEMORY],
      [QueryType.REAL_TIME]: [StorageLayer.IN_MEMORY, StorageLayer.CACHE, StorageLayer.NEO4J],
      [QueryType.BULK]: [StorageLayer.NEO4J, StorageLayer.RDF_FILES, StorageLayer.IN_MEMORY],
      [QueryType.SEARCH]: [StorageLayer.IN_MEMORY, StorageLayer.CACHE, StorageLayer.NEO4J],
      [QueryType.SIMPLE_LOOKUP]: [StorageLayer.CACHE, StorageLayer.IN_MEMORY, StorageLayer.NEO4J],
      [QueryType.GRAPH_TRAVERSAL]: [StorageLayer.NEO4J, StorageLayer.IN_MEMORY],
      [QueryType.FULL_TEXT_SEARCH]: [StorageLayer.NEO4J, StorageLayer.RDF_FILES],
      [QueryType.AGGREGATION]: [StorageLayer.NEO4J, StorageLayer.IN_MEMORY],
      [QueryType.PATTERN_MATCHING]: [StorageLayer.IN_MEMORY, StorageLayer.NEO4J]
    },
    costWeights: {
      responseTime: 0.4,
      reliability: 0.3,
      consistency: 0.2,
      scalability: 0.1
    }
  },
  monitoring: {
    enabled: true,
    healthCheckInterval: 30000,
    metricsCollectionInterval: 10000,
    alertThresholds: {
      responseTime: 5000,
      errorRate: 0.05,
      memoryUsage: 0.8,
      diskUsage: 0.9
    },
    retentionPeriod: 86400000 // 24 hours
  },
  synchronization: {
    enabled: true,
    syncInterval: 10000,
    conflictResolution: 'last_write_wins',
    batchSize: 100,
    maxRetries: 3,
    syncStrategies: {
      neo4jToRdf: true,
      rdfToNeo4j: true,
      inMemorySync: true,
      cacheInvalidation: true
    }
  }
};

// Additional Query Router Types
export interface QueryRequest {
  query: string;
  type: QueryType;
  parameters?: Record<string, any>;
  context?: QueryContext;
}

export interface QueryResponse<T = any> {
  data: T;
  source: StorageLayer;
  executionTime: number;
  cached: boolean;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface QueryRoute {
  condition: (request: QueryRequest) => boolean;
  primaryLayer: StorageLayer;
  fallbackLayers: StorageLayer[];
  priority: number;
}

export interface QueryMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  totalLatency: number;
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  successRate: number;
  totalResultSize: number;
  averageResultSize: number;
}

export interface RoutingDecision {
  primaryLayer: StorageLayer;
  fallbackLayers: StorageLayer[];
  reasoning: string;
  estimatedLatency: number;
  cacheStrategy: 'none' | 'short' | 'medium' | 'long';
  queryId: string;
}

export interface QueryRouterConfig {
  defaultTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  loadBalancing: boolean;
  preferredLayersByQueryType: Record<QueryType, StorageLayer[]>;
  costWeights: {
    responseTime: number;
    reliability: number;
    consistency: number;
    scalability: number;
  };
}

export class QueryError extends Error {
  constructor(
    message: string,
    public readonly query?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'QueryError';
  }
}