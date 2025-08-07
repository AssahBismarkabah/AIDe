# In-Memory RDF Store

The In-Memory RDF Store is a high-performance, specialized RDF storage system optimized for LLM queries and MCP (Model Context Protocol) context retrieval. It provides lightning-fast access to RDF triples with advanced indexing, semantic search capabilities, and intelligent caching designed specifically for AI/LLM integration.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                 In-Memory RDF Store                         │
├─────────────────────────────────────────────────────────────┤
│  LLM Context    │  MCP Resources  │  Semantic Search       │
│  Builder        │  Manager        │  Engine                │
├─────────────────────────────────────────────────────────────┤
│  Multi-Index System (SPO, PSO, OSP, Full-Text, Semantic)   │
├─────────────────────────────────────────────────────────────┤
│  RDF Triple Store │  Query Cache   │  Context Cache        │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### 🚀 High-Performance RDF Storage
- **In-memory storage**: Lightning-fast access to RDF triples
- **Multiple indexing strategies**: SPO, PSO, OSP, SOP, POS, OPS for optimal query performance
- **Full-text indexing**: Fast text-based searches across all triple components
- **Semantic indexing**: Support for semantic similarity searches

### 🤖 LLM-Optimized Context Retrieval
- **Context building**: Intelligent context assembly for LLM queries
- **Token optimization**: Automatic token counting and limit management
- **Relevance ranking**: Smart ranking of context by relevance to queries
- **Context caching**: Efficient caching of frequently requested contexts

### 🔌 MCP Integration
- **Resource management**: Full support for MCP resource registration and retrieval
- **URI-based access**: Standard MCP resource URI handling
- **Content filtering**: Advanced filtering by tags, content, and metadata
- **Real-time updates**: Dynamic resource updates and notifications

### 🔍 Advanced Query Capabilities
- **SPARQL support**: Basic SPARQL SELECT, CONSTRUCT, and ASK queries
- **Pattern matching**: Flexible triple pattern matching
- **Semantic search**: Text similarity and semantic matching
- **Query optimization**: Intelligent query planning and execution

## Components

### InMemoryRDFStore
The main RDF store implementation providing all core functionality.

```typescript
import { InMemoryRDFStore, defaultInMemoryRDFConfig } from './in-memory-rdf';

const rdfStore = new InMemoryRDFStore(defaultInMemoryRDFConfig);
await rdfStore.initialize();

// Add triples
await rdfStore.addTriple({
  subject: 'module:UserService',
  predicate: 'hasType',
  object: 'TypeScript'
});

// Query with SPARQL
const result = await rdfStore.query(`
  SELECT ?module ?type WHERE {
    ?module hasType ?type
  }
`, {
  type: RDFQueryType.SPARQL,
  maxResults: 10
});
```

### LLM Context Integration
Optimized context building for Large Language Models.

```typescript
// Get LLM-optimized context
const contextResponse = await rdfStore.getLLMContext({
  query: 'user authentication system',
  maxTokens: 2048,
  minRelevance: 0.7,
  includeRelated: true,
  semanticSearch: true
});

console.log(`Found ${contextResponse.contexts.length} relevant contexts`);
console.log(`Total tokens: ${contextResponse.totalTokens}`);

// Build context for specific query
const contexts = await rdfStore.buildContextForQuery(
  'How does the authentication system work?',
  1024 // max tokens
);
```

### MCP Resource Management
Full Model Context Protocol resource support.

```typescript
// Register MCP resource
await rdfStore.registerMCPResource({
  uri: 'file:///src/auth/UserService.ts',
  name: 'UserService',
  description: 'User authentication and management service',
  mimeType: 'text/typescript',
  content: '// TypeScript code here...',
  metadata: {
    source: 'filesystem',
    lastModified: new Date(),
    size: 1024,
    tags: ['authentication', 'user-management']
  }
});

// Query MCP resources
const resources = await rdfStore.getMCPResources({
  query: 'authentication',
  maxResources: 5,
  includeContent: true,
  filterByTags: ['authentication']
});
```

## Configuration

### Basic Configuration

```typescript
import { InMemoryRDFConfig, IndexType } from './in-memory-rdf';

const config: InMemoryRDFConfig = {
  maxTriples: 1000000,
  maxMemoryMB: 1024,
  enabledIndexes: [
    IndexType.SPO,
    IndexType.PSO,
    IndexType.OSP,
    IndexType.FULL_TEXT,
    IndexType.SEMANTIC
  ],
  compressionEnabled: true,
  persistenceEnabled: false,
  cacheConfig: {
    maxEntries: 10000,
    ttl: 300000, // 5 minutes
    evictionPolicy: 'lru'
  }
};
```

### LLM Integration Configuration

```typescript
const llmOptimizedConfig: InMemoryRDFConfig = {
  // ... basic config
  llmIntegration: {
    contextWindowSize: 4096,
    maxContextTokens: 2048,
    semanticSimilarityThreshold: 0.7,
    enableContextRanking: true,
    enableTokenOptimization: true
  },
  optimization: {
    enableSemanticSearch: true,
    enableContextCaching: true,
    enableQueryOptimization: true,
    enableParallelProcessing: true
  }
};
```

### Advanced Configuration

```typescript
const advancedConfig: InMemoryRDFConfig = {
  maxTriples: 5000000,
  maxMemoryMB: 4096,
  enabledIndexes: [
    IndexType.SPO, IndexType.PSO, IndexType.OSP,
    IndexType.SOP, IndexType.POS, IndexType.OPS,
    IndexType.FULL_TEXT, IndexType.SEMANTIC, IndexType.TEMPORAL
  ],
  compressionEnabled: true,
  persistenceEnabled: true,
  persistenceFile: './data/rdf-store.json',
  cacheConfig: {
    maxEntries: 50000,
    ttl: 600000, // 10 minutes
    evictionPolicy: 'lfu'
  },
  optimization: {
    enableSemanticSearch: true,
    enableContextCaching: true,
    enableQueryOptimization: true,
    enableParallelProcessing: true
  },
  llmIntegration: {
    contextWindowSize: 8192,
    maxContextTokens: 4096,
    semanticSimilarityThreshold: 0.6,
    enableContextRanking: true,
    enableTokenOptimization: true
  }
};
```

## Usage Examples

### Basic RDF Operations

```typescript
// Initialize store
const store = new InMemoryRDFStore(config);
await store.initialize();

// Add single triple
await store.addTriple({
  subject: 'module:AuthService',
  predicate: 'implements',
  object: 'interface:IAuthService',
  metadata: {
    source: 'code-analysis',
    timestamp: new Date(),
    confidence: 0.95,
    tags: ['authentication', 'interface']
  }
});

// Add multiple triples
const triples = [
  {
    subject: 'module:AuthService',
    predicate: 'dependsOn',
    object: 'module:UserRepository'
  },
  {
    subject: 'module:AuthService',
    predicate: 'hasMethod',
    object: 'method:login'
  }
];

const addedCount = await store.addTriples(triples);
console.log(`Added ${addedCount} triples`);

// Query triples
const authTriples = await store.findTriples({
  subject: 'module:AuthService'
}, 10);

console.log(`Found ${authTriples.length} triples about AuthService`);
```

### SPARQL Queries

```typescript
// SELECT query
const modules = await store.query(`
  SELECT ?module ?dependency WHERE {
    ?module dependsOn ?dependency
  }
  LIMIT 20
`, {
  type: RDFQueryType.SPARQL,
  priority: 'medium'
});

// CONSTRUCT query
const dependencyGraph = await store.query(`
  CONSTRUCT {
    ?module rdf:type "Module" .
    ?module dependsOn ?dep
  } WHERE {
    ?module dependsOn ?dep
  }
`, {
  type: RDFQueryType.SPARQL
});

// ASK query
const hasAuth = await store.query(`
  ASK {
    ?module hasType "AuthenticationService"
  }
`, {
  type: RDFQueryType.SPARQL
});

console.log(`Has authentication service: ${hasAuth.data}`);
```

### LLM Context Operations

```typescript
// Get context for a development question
const contextResponse = await store.getLLMContext({
  query: 'How to implement user authentication with JWT tokens?',
  maxTokens: 2048,
  minRelevance: 0.6,
  includeRelated: true,
  semanticSearch: true,
  prioritizeRecent: true
});

// Process contexts for LLM
const formattedContext = contextResponse.contexts
  .map(ctx => `${ctx.type.toUpperCase()}: ${ctx.content}`)
  .join('\n\n');

console.log('LLM Context:');
console.log(formattedContext);
console.log(`Total tokens: ${contextResponse.totalTokens}`);

// Rank contexts by relevance
const rankedContexts = await store.rankContextByRelevance(
  contextResponse.contexts,
  'JWT authentication implementation'
);

console.log('Top 3 most relevant contexts:');
rankedContexts.slice(0, 3).forEach((ctx, i) => {
  console.log(`${i + 1}. ${ctx.content} (relevance: ${ctx.relevanceScore})`);
});
```

### Semantic Search

```typescript
// Semantic search for similar concepts
const similarTriples = await store.semanticSearch(
  'user authentication and authorization',
  10
);

console.log('Semantically similar triples:');
similarTriples.forEach(result => {
  console.log(`${result.triple.subject} ${result.triple.predicate} ${result.triple.object}`);
  console.log(`Similarity: ${(result.similarity * 100).toFixed(1)}%`);
  console.log(`Context: ${result.context.join(', ')}`);
  console.log('---');
});

// Find similar triples to a specific triple
const baseTriple = {
  subject: 'module:AuthService',
  predicate: 'implements',
  object: 'interface:IAuthService'
};

const similar = await store.findSimilarTriples(baseTriple, 0.7);
console.log(`Found ${similar.length} similar triples`);
```

### MCP Resource Operations

```typescript
// Register multiple resources
const resources = [
  {
    uri: 'file:///src/auth/AuthService.ts',
    name: 'AuthService',
    description: 'Main authentication service',
    content: '// TypeScript implementation...',
    metadata: {
      source: 'filesystem',
      lastModified: new Date(),
      size: 2048,
      tags: ['authentication', 'service']
    }
  },
  {
    uri: 'file:///src/auth/JWTManager.ts',
    name: 'JWTManager',
    description: 'JWT token management utilities',
    content: '// JWT utilities...',
    metadata: {
      source: 'filesystem',
      lastModified: new Date(),
      size: 1024,
      tags: ['jwt', 'tokens', 'authentication']
    }
  }
];

for (const resource of resources) {
  await store.registerMCPResource(resource);
}

// Query resources by content
const authResources = await store.getMCPResources({
  query: 'JWT token',
  maxResources: 5,
  includeContent: true
});

console.log(`Found ${authResources.totalResources} authentication resources`);

// Filter by tags
const jwtResources = await store.getMCPResources({
  filterByTags: ['jwt', 'tokens'],
  includeContent: false
});

console.log('JWT-related resources:');
jwtResources.resources.forEach(resource => {
  console.log(`- ${resource.name}: ${resource.description}`);
});
```

### Index Management

```typescript
// Build specific index
await store.buildIndex(IndexType.SEMANTIC);

// Rebuild all indexes
await store.rebuildAllIndexes();

// Get index statistics
const indexStats = await store.getIndexStats();

console.log('Index Statistics:');
Object.entries(indexStats).forEach(([type, stats]) => {
  console.log(`${type}: ${stats.size} entries, built in ${stats.buildTime}ms`);
});

// Monitor index performance
store.on('index_built', ({ type, size, buildTime }) => {
  console.log(`Index ${type} rebuilt: ${size} entries in ${buildTime}ms`);
});
```

### Performance Monitoring

```typescript
// Get comprehensive metrics
const metrics = await store.getMetrics();

console.log('RDF Store Metrics:');
console.log(`Total triples: ${metrics.totalTriples}`);
console.log(`Memory usage: ${metrics.memoryUsageMB.toFixed(2)} MB`);
console.log(`Query cache hit rate: ${(metrics.queryMetrics.cacheHitRate * 100).toFixed(1)}%`);
console.log(`Average query time: ${metrics.queryMetrics.averageResponseTime.toFixed(2)}ms`);

// LLM-specific metrics
console.log('\nLLM Integration Metrics:');
console.log(`Context requests: ${metrics.llmMetrics.contextRequests}`);
console.log(`Average context size: ${metrics.llmMetrics.averageContextSize}`);
console.log(`Average token count: ${metrics.llmMetrics.averageTokenCount}`);

// Monitor events
store.on('query_executed', ({ query, result }) => {
  console.log(`Query executed in ${result.executionTime}ms: ${query.substring(0, 50)}...`);
});

store.on('triple_added', ({ tripleId, triple }) => {
  console.log(`Added triple: ${triple.subject} ${triple.predicate} ${triple.object}`);
});
```

### Cache Management

```typescript
// Clear all caches
await store.clearCache();

// Monitor cache performance
store.on('cache_hit', ({ key }) => {
  console.log(`Cache hit for: ${key}`);
});

store.on('cache_miss', ({ key }) => {
  console.log(`Cache miss for: ${key}`);
});

// Optimize store performance
await store.optimize();

store.on('optimized', () => {
  console.log('Store optimization completed');
});
```

## Performance Optimization

### Memory Management
- Configure appropriate memory limits based on available system resources
- Enable compression for large datasets
- Use persistence for data that needs to survive restarts
- Monitor memory usage and optimize index selection

### Query Optimization
- Use specific indexes for different query patterns
- Enable query caching for frequently executed queries
- Use SPARQL for complex queries, pattern matching for simple ones
- Leverage semantic search for similarity-based queries

### LLM Integration Optimization
- Set appropriate token limits based on your LLM's context window
- Use context caching for frequently requested contexts
- Enable context ranking for better relevance
- Optimize semantic similarity thresholds

### Index Strategy
```typescript
// For read-heavy workloads
const readOptimizedIndexes = [
  IndexType.SPO, IndexType.PSO, IndexType.OSP,
  IndexType.FULL_TEXT, IndexType.SEMANTIC
];

// For write-heavy workloads
const writeOptimizedIndexes = [
  IndexType.SPO, IndexType.FULL_TEXT
];

// For LLM-focused workloads
const llmOptimizedIndexes = [
  IndexType.SPO, IndexType.FULL_TEXT, 
  IndexType.SEMANTIC, IndexType.TEMPORAL
];
```

## Integration with Other Services

The In-Memory RDF Store integrates seamlessly with other system components:

### With Hybrid Storage Manager
```typescript
// Use as a storage layer in hybrid storage
const hybridConfig = {
  // ... other config
  inMemoryRdf: rdfStoreConfig
};
```

### With Module Knowledge Manager
```typescript
// Load RDF data from module knowledge
const moduleKnowledge = new ModuleKnowledgeManager(config);
const rdfData = await moduleKnowledge.generateRDF();

// Add to RDF store
for (const triple of rdfData.triples) {
  await rdfStore.addTriple(triple);
}
```

### With Version Manager
```typescript
// Version RDF store state
const versionManager = new VersionManager(config);
const storeState = await rdfStore.getMetrics();

await versionManager.createVersion({
  type: 'rdf_store_snapshot',
  data: storeState,
  metadata: { timestamp: new Date() }
});
```

## Error Handling

The RDF store provides comprehensive error handling:

```typescript
import { RDFStoreError, RDFQueryError, RDFIndexError } from './in-memory-rdf';

try {
  const result = await store.query('INVALID SPARQL QUERY');
} catch (error) {
  if (error instanceof RDFQueryError) {
    console.error(`Query error: ${error.message}`);
    console.error(`Query: ${error.query}`);
  } else if (error instanceof RDFIndexError) {
    console.error(`Index error: ${error.message}`);
    console.error(`Index type: ${error.indexType}`);
  } else if (error instanceof RDFStoreError) {
    console.error(`Store error: ${error.message}`);
    console.error(`Operation: ${error.operation}`);
  }
}
```

## Best Practices

### Data Modeling
1. **Use consistent URI patterns** for subjects and predicates
2. **Add metadata** to triples for better context and filtering
3. **Use appropriate data types** for objects (strings, numbers, dates)
4. **Tag triples** with relevant categories for easier retrieval

### Query Design
1. **Use specific patterns** when possible to leverage indexes
2. **Limit result sets** to avoid memory issues
3. **Cache frequently used queries** for better performance
4. **Use semantic search** for similarity-based queries

### LLM Integration
1. **Set appropriate token limits** based on your LLM's capabilities
2. **Use context ranking** to get the most relevant information
3. **Cache contexts** for frequently asked questions
4. **Monitor token usage** to optimize context building

### Performance Tuning
1. **Choose indexes wisely** based on your query patterns
2. **Monitor memory usage** and adjust limits as needed
3. **Use compression** for large datasets
4. **Enable persistence** for important data

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Reduce `maxTriples` or `maxMemoryMB`
   - Enable compression
   - Optimize index selection
   - Clear caches regularly

2. **Slow Query Performance**
   - Check if appropriate indexes are enabled
   - Use more specific query patterns
   - Enable query caching
   - Consider query optimization

3. **Context Building Issues**
   - Adjust semantic similarity thresholds
   - Check token limits and context window size
   - Verify relevance ranking configuration
   - Monitor context cache performance

### Debugging

Enable detailed logging and monitoring:

```typescript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Monitor all events
store.on('*', (eventName, data) => {
  console.log(`RDF Store Event: ${eventName}`, data);
});

// Get detailed metrics
const metrics = await store.getMetrics();
console.log('Detailed metrics:', JSON.stringify(metrics, null, 2));
```

## Future Enhancements

- **Vector embeddings**: Integration with embedding models for true semantic search
- **Distributed storage**: Support for distributed RDF storage across multiple nodes
- **Advanced SPARQL**: Full SPARQL 1.1 support with federated queries
- **Real-time updates**: WebSocket-based real-time triple updates
- **Graph algorithms**: Built-in graph analysis and traversal algorithms
- **Machine learning**: ML-based query optimization and context ranking