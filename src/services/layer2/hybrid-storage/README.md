# Hybrid Storage Manager

The Hybrid Storage Manager is a sophisticated multi-layer storage coordination system that intelligently routes queries and manages data across Neo4j, RDF files, in-memory storage, and caching layers. It provides optimal performance through intelligent query routing, automatic synchronization, and comprehensive health monitoring.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                 Hybrid Storage Manager                      │
├─────────────────────────────────────────────────────────────┤
│  Query Router  │  Cache Manager  │  Sync Coordinator       │
├─────────────────────────────────────────────────────────────┤
│  Neo4j Layer   │  In-Memory     │  RDF Files    │  Cache   │
│  (Graph DB)    │  (Fast Access) │  (Persistence)│ (Speed)  │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### 🎯 Intelligent Query Routing
- **Performance-based routing**: Automatically routes queries to the optimal storage layer based on query type, complexity, and performance metrics
- **Fallback mechanisms**: Provides automatic failover to alternative storage layers when primary layers are unavailable
- **Cost optimization**: Considers response time, reliability, consistency, and scalability factors

### 🚀 Multi-Layer Storage
- **Neo4j**: Complex graph relationships and analytical queries
- **In-Memory**: Fast access for frequently used data with compression and garbage collection
- **RDF Files**: Persistent TTL file storage with file watching and backup capabilities
- **Cache**: High-speed caching with multiple eviction policies (LRU, LFU, TTL, Random)

### 🔄 Automatic Synchronization
- **Cross-layer sync**: Keeps data consistent across all storage layers
- **Conflict resolution**: Handles data conflicts with configurable resolution strategies
- **Batch operations**: Efficient bulk data synchronization

### 📊 Comprehensive Monitoring
- **Health checks**: Continuous monitoring of all storage layers
- **Performance metrics**: Detailed metrics collection and analysis
- **Real-time alerts**: Configurable alerting based on performance thresholds

## Components

### HybridStorageManager
The main coordinator that orchestrates all storage operations.

```typescript
import { HybridStorageManager, defaultHybridStorageConfig } from './hybrid-storage';

const storageManager = new HybridStorageManager(defaultHybridStorageConfig);
await storageManager.initialize();

// Execute queries with intelligent routing
const result = await storageManager.query('MATCH (n:Module) RETURN n', {
  type: QueryType.STRUCTURAL,
  priority: 'high'
});
```

### QueryRouter
Intelligent query routing based on performance characteristics and query analysis.

```typescript
// Query routing is automatic, but you can also plan queries
const plan = await storageManager.planQuery('MATCH (n) RETURN count(n)', {
  type: QueryType.AGGREGATION
});

console.log(`Query will be routed to: ${plan.primaryLayer}`);
console.log(`Estimated cost: ${plan.estimatedCost}ms`);
console.log(`Reasoning: ${plan.reasoning}`);
```

### CacheManager
Advanced caching with multiple strategies and persistence options.

```typescript
// Cache operations are handled automatically, but you can also manage cache directly
const cacheMetrics = await storageManager.getCacheMetrics();
console.log(`Cache hit rate: ${cacheMetrics.hitRate * 100}%`);

// Invalidate specific cache patterns
await storageManager.invalidateCache('module_*');
```

### Storage Layers

#### Neo4jStorageLayer
Optimized for complex graph operations and analytical queries.

```typescript
// Handles queries like:
// - Complex graph traversals
// - Aggregations and analytics
// - Relationship-heavy operations
```

#### InMemoryStorageLayer
High-performance in-memory storage with compression and garbage collection.

```typescript
// Optimized for:
// - Frequently accessed data
// - Simple lookups
// - Pattern matching operations
```

#### RDFStorageLayer
File-based RDF storage with watching and backup capabilities.

```typescript
// Manages:
// - TTL file persistence
// - File change monitoring
// - Backup and recovery
```

## Configuration

### Basic Configuration

```typescript
import { HybridStorageConfig, QueryType, StorageLayer } from './hybrid-storage';

const config: HybridStorageConfig = {
  neo4j: {
    uri: 'bolt://localhost:7687',
    username: 'neo4j',
    password: 'password',
    database: 'neo4j'
  },
  rdfFiles: {
    baseDirectory: './data/rdf',
    filePattern: '**/*.module-knowledge.ttl',
    watchForChanges: true,
    backupEnabled: true
  },
  inMemory: {
    maxMemoryMB: 512,
    compressionEnabled: true,
    persistenceEnabled: false
  },
  cache: {
    strategy: 'memory',
    maxMemoryMB: 256,
    defaultTTL: 300000, // 5 minutes
    evictionPolicy: 'lru'
  },
  queryRouting: {
    preferredLayersByQueryType: {
      [QueryType.STRUCTURAL]: [StorageLayer.NEO4J, StorageLayer.IN_MEMORY],
      [QueryType.CONTEXTUAL]: [StorageLayer.IN_MEMORY, StorageLayer.CACHE],
      [QueryType.ANALYTICAL]: [StorageLayer.NEO4J, StorageLayer.CACHE]
    }
  }
};
```

### Advanced Configuration

```typescript
const advancedConfig: HybridStorageConfig = {
  // ... basic config
  monitoring: {
    enabled: true,
    healthCheckInterval: 30000,
    metricsCollectionInterval: 10000,
    alertThresholds: {
      responseTime: 5000,
      errorRate: 0.05,
      memoryUsage: 0.8
    }
  },
  synchronization: {
    enabled: true,
    syncInterval: 10000,
    conflictResolution: 'last_write_wins',
    batchSize: 100,
    syncStrategies: {
      neo4jToRdf: true,
      rdfToNeo4j: true,
      inMemorySync: true,
      cacheInvalidation: true
    }
  }
};
```

## Usage Examples

### Basic Operations

```typescript
// Initialize the storage manager
const storageManager = new HybridStorageManager(config);
await storageManager.initialize();

// Create data (automatically synced across layers)
const createResult = await storageManager.create({
  type: 'Module',
  name: 'UserService',
  path: '/src/services/user.ts'
}, {
  type: QueryType.STRUCTURAL,
  priority: 'high'
});

// Query with intelligent routing
const modules = await storageManager.query(
  'MATCH (n:Module) WHERE n.type = $type RETURN n',
  {
    type: QueryType.STRUCTURAL,
    preferredLayers: [StorageLayer.NEO4J, StorageLayer.IN_MEMORY]
  }
);

// Update with automatic synchronization
const updateResult = await storageManager.update('module_123', {
  lastModified: new Date(),
  version: '2.0.0'
});

// Delete with cache invalidation
const deleteResult = await storageManager.delete('module_123');
```

### Advanced Query Operations

```typescript
// Complex graph traversal
const dependencies = await storageManager.query(`
  MATCH (m:Module {name: $moduleName})-[:DEPENDS_ON*1..3]->(dep:Module)
  RETURN dep.name, dep.version
  ORDER BY dep.name
`, {
  type: QueryType.GRAPH_TRAVERSAL,
  priority: 'medium',
  cacheTTL: 600000 // Cache for 10 minutes
});

// Aggregation query
const stats = await storageManager.query(`
  MATCH (m:Module)
  RETURN 
    count(m) as totalModules,
    avg(m.complexity) as avgComplexity,
    collect(DISTINCT m.type) as moduleTypes
`, {
  type: QueryType.AGGREGATION,
  priority: 'low'
});

// Full-text search
const searchResults = await storageManager.query(`
  CALL db.index.fulltext.queryNodes("moduleSearch", $searchTerm)
  YIELD node, score
  RETURN node.name, node.description, score
  ORDER BY score DESC
  LIMIT 10
`, {
  type: QueryType.FULL_TEXT_SEARCH,
  priority: 'medium'
});
```

### Monitoring and Health Checks

```typescript
// Get comprehensive health status
const healthStatus = await storageManager.getHealthStatus();
healthStatus.forEach(status => {
  console.log(`${status.layer}: ${status.status} (${status.responseTime}ms)`);
});

// Get detailed metrics
const metrics = await storageManager.getMetrics();
console.log('Query Distribution:', metrics.queryMetrics.queryDistribution);
console.log('Cache Hit Rate:', metrics.cacheMetrics.hitRate);
console.log('Sync Success Rate:', metrics.syncMetrics.successRate);

// Monitor events
storageManager.on('query_completed', ({ query, result, routingDecision }) => {
  console.log(`Query routed to ${routingDecision.primaryLayer}: ${result.executionTime}ms`);
});

storageManager.on('cache_hit', ({ key }) => {
  console.log(`Cache hit for: ${key}`);
});

storageManager.on('sync_completed', ({ operation, result }) => {
  console.log(`Sync completed: ${result.affectedLayers.join(', ')}`);
});
```

### Synchronization Management

```typescript
// Manual synchronization
const syncResults = await storageManager.syncAll();
syncResults.forEach(result => {
  console.log(`Sync ${result.operationId}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
});

// Conflict resolution
const conflict: ConflictResolution = {
  conflictId: 'conflict_123',
  sourceLayer: StorageLayer.NEO4J,
  targetLayer: StorageLayer.RDF_FILES,
  conflictType: 'data',
  resolution: 'merge',
  resolvedData: { /* merged data */ },
  timestamp: new Date()
};

const resolved = await storageManager.resolveConflict(conflict);
console.log(`Conflict resolved: ${resolved}`);
```

## Performance Optimization

### Query Optimization
- Use appropriate query types for optimal routing
- Leverage caching for frequently accessed data
- Specify preferred layers for critical queries

### Memory Management
- Configure appropriate memory limits for in-memory storage
- Enable compression for large datasets
- Use garbage collection thresholds effectively

### Synchronization Tuning
- Adjust sync intervals based on data change frequency
- Use batch operations for bulk data changes
- Configure conflict resolution strategies appropriately

## Error Handling

The Hybrid Storage Manager provides comprehensive error handling with specific error types:

```typescript
import { HybridStorageError, QueryRoutingError, SynchronizationError, CacheError } from './hybrid-storage';

try {
  const result = await storageManager.query('INVALID QUERY');
} catch (error) {
  if (error instanceof HybridStorageError) {
    console.error(`Storage error in ${error.layer}: ${error.message}`);
    if (error.cause) {
      console.error('Caused by:', error.cause);
    }
  }
}
```

## Best Practices

1. **Query Design**: Design queries with the target storage layer in mind
2. **Caching Strategy**: Use appropriate cache TTL values based on data volatility
3. **Monitoring**: Regularly monitor health and performance metrics
4. **Synchronization**: Configure sync strategies based on consistency requirements
5. **Resource Management**: Monitor memory usage and adjust limits as needed

## Integration with Other Services

The Hybrid Storage Manager integrates seamlessly with other system components:

- **Version Manager**: Provides versioned storage capabilities
- **Module Knowledge Manager**: Stores and retrieves module knowledge graphs
- **Neo4j Database Service**: Leverages existing Neo4j infrastructure
- **RDF Generator**: Consumes generated RDF/TTL files

## Troubleshooting

### Common Issues

1. **High Memory Usage**: Adjust in-memory storage limits and enable compression
2. **Slow Query Performance**: Check query routing and consider adding indexes
3. **Sync Failures**: Review conflict resolution strategies and network connectivity
4. **Cache Misses**: Adjust cache TTL values and eviction policies

### Debugging

Enable detailed logging and monitoring:

```typescript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Monitor all events
storageManager.on('*', (eventName, data) => {
  console.log(`Event: ${eventName}`, data);
});
```

## Future Enhancements

- **Distributed Caching**: Support for Redis and other distributed cache systems
- **Advanced Analytics**: Machine learning-based query optimization
- **Multi-tenancy**: Support for isolated storage per tenant
- **Streaming Sync**: Real-time data streaming between layers
- **Advanced Conflict Resolution**: AI-powered conflict resolution strategies