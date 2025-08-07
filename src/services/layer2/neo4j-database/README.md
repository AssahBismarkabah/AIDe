# Neo4j Database Service

## Overview

The Neo4j Database Service provides comprehensive integration with Neo4j graph database for the AI-Assisted Software Engineering system. This service handles connection management, TTL file ingestion, query optimization, and health monitoring for the knowledge graph storage layer.

## Features

### 🔌 Connection Management
- **Secure Connection**: Configurable authentication and encryption
- **Connection Pooling**: Optimized connection pool management
- **Health Monitoring**: Continuous connection health checks
- **Auto-reconnection**: Automatic reconnection on connection failures

### 📊 TTL Ingestion Pipeline
- **TTL File Processing**: Parse and ingest Turtle (TTL) files into Neo4j
- **Batch Processing**: Efficient batch ingestion of multiple files
- **Validation**: Pre-ingestion validation of TTL syntax and semantics
- **Error Handling**: Comprehensive error reporting and recovery

### ⚡ Query Optimization
- **Performance Analysis**: Detailed query performance metrics
- **Index Suggestions**: Automatic index recommendations
- **Query Validation**: Syntax and semantic validation
- **Execution Planning**: Query execution plan analysis

### 🏥 Health Monitoring
- **System Health**: Overall database health status
- **Metrics Collection**: Comprehensive database metrics
- **Constraint Monitoring**: Track constraint status and failures
- **Index Monitoring**: Monitor index health and population

## Architecture

```
Neo4jDatabaseService
├── Connection Management
│   ├── Driver initialization
│   ├── Session management
│   └── Transaction handling
├── TTL Ingestion Pipeline
│   ├── Content validation
│   ├── Triple parsing
│   ├── Node creation
│   └── Relationship creation
├── Query Optimization
│   ├── Performance analysis
│   ├── Index suggestions
│   └── Query validation
└── Health Monitoring
    ├── Connection health
    ├── Database metrics
    └── Schema monitoring
```

## Usage

### Basic Setup

```typescript
import { Neo4jDatabaseService } from './Neo4jDatabaseService';

const service = new Neo4jDatabaseService();

// Configure connection
const config = {
  uri: 'bolt://localhost:7687',
  username: 'neo4j',
  password: 'password',
  database: 'neo4j'
};

// Connect to database
await service.connect(config);
```

### TTL File Ingestion

```typescript
// Ingest single TTL file
const result = await service.ingestTTLFile('./module-knowledge.ttl');
console.log(`Created ${result.nodesCreated} nodes and ${result.relationshipsCreated} relationships`);

// Batch ingest multiple files
const files = ['module1.ttl', 'module2.ttl', 'module3.ttl'];
const batchResult = await service.batchIngestTTLFiles(files);
console.log(`Processed ${batchResult.totalFiles} files with ${batchResult.successfulFiles} successes`);

// Ingest TTL content directly
const ttlContent = `
  @prefix ex: <http://example.org/> .
  ex:Module1 rdf:type ex:Module .
  ex:Module1 ex:hasFunction ex:Function1 .
`;
const contentResult = await service.ingestTTLContent(ttlContent, 'inline.ttl');
```

### Query Optimization

```typescript
// Analyze query performance
const query = "MATCH (n:Module) WHERE n.name = 'TestModule' RETURN n";
const performance = await service.analyzeQueryPerformance(query);
console.log(`Query executed in ${performance.executionTime}ms with ${performance.dbHits} db hits`);

// Get optimization suggestions
const optimized = await service.optimizeQuery(query);
console.log(`Estimated improvement: ${optimized.estimatedImprovement}%`);

// Get index suggestions
const suggestions = await service.suggestIndexes(query);
suggestions.forEach(suggestion => {
  console.log(`Suggested index: ${suggestion.cypherCommand}`);
});
```

### Health Monitoring

```typescript
// Check overall health
const health = await service.checkHealth();
console.log(`Database status: ${health.status}`);

// Get detailed metrics
const metrics = await service.getMetrics();
console.log(`Nodes: ${metrics.nodeCount}, Relationships: ${metrics.relationshipCount}`);

// Monitor constraints and indexes
const constraints = await service.getConstraints();
const indexes = await service.getIndexes();
```

## Configuration

### Connection Configuration

```typescript
interface Neo4jConfig {
  uri: string;                    // Neo4j connection URI
  username: string;               // Database username
  password: string;               // Database password
  database?: string;              // Target database name
  maxConnectionPoolSize?: number; // Maximum connections in pool
  connectionTimeout?: number;     // Connection timeout in ms
  maxTransactionRetryTime?: number; // Transaction retry timeout
  encrypted?: boolean;            // Enable encryption
  trust?: 'TRUST_ALL_CERTIFICATES' | 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES';
}
```

### Environment Variables

```bash
# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password
NEO4J_DATABASE=neo4j

# Connection Pool Settings
NEO4J_MAX_POOL_SIZE=50
NEO4J_CONNECTION_TIMEOUT=30000
NEO4J_RETRY_TIMEOUT=30000
```

## TTL File Format

The service expects TTL files in standard Turtle format:

```turtle
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

# Node definitions
ex:Module1 rdf:type ex:Module .
ex:Function1 rdf:type ex:Function .
ex:Class1 rdf:type ex:Class .

# Relationships
ex:Module1 ex:hasFunction ex:Function1 .
ex:Module1 ex:hasClass ex:Class1 .
ex:Function1 ex:belongsToClass ex:Class1 .

# Properties
ex:Module1 ex:name "UserService" .
ex:Function1 ex:name "createUser" .
ex:Function1 ex:complexity "3" .
```

## Event System

The service emits events for monitoring and integration:

```typescript
// Listen to database events
service.on('database_event', (event) => {
  console.log(`Event: ${event.type}, Severity: ${event.severity}`);
});

// Event types
// - CONNECTION: Connection state changes
// - QUERY: Query execution events
// - TRANSACTION: Transaction lifecycle events
// - SCHEMA: Schema modification events
// - ERROR: Error events
```

## Error Handling

### Common Error Types

- **Connection Errors**: Network connectivity, authentication failures
- **Ingestion Errors**: TTL parsing errors, constraint violations
- **Query Errors**: Syntax errors, semantic validation failures
- **Schema Errors**: Constraint or index creation failures

### Error Recovery

```typescript
try {
  await service.ingestTTLFile('invalid.ttl');
} catch (error) {
  if (error.type === 'PARSING_ERROR') {
    console.log('TTL syntax error:', error.message);
    // Handle parsing error
  } else if (error.type === 'CONSTRAINT_VIOLATION') {
    console.log('Constraint violation:', error.message);
    // Handle constraint violation
  }
}
```

## Performance Optimization

### Best Practices

1. **Use Indexes**: Create appropriate indexes for frequently queried properties
2. **Batch Operations**: Use batch ingestion for multiple files
3. **Connection Pooling**: Configure appropriate pool size for your workload
4. **Query Optimization**: Use the built-in query optimizer
5. **Health Monitoring**: Regular health checks to detect issues early

### Index Management

```typescript
// Get index suggestions
const suggestions = await service.suggestIndexes(query);

// Create suggested indexes
for (const suggestion of suggestions) {
  await session.run(suggestion.cypherCommand);
}
```

## Testing

The service includes comprehensive tests covering:

- Connection management scenarios
- TTL ingestion workflows
- Query optimization features
- Health monitoring capabilities
- Error handling scenarios
- Integration workflows

Run tests:
```bash
npm test -- tests/neo4j-database.test.ts
```

## Integration

### With Module Knowledge Manager

```typescript
import { ModuleKnowledgeManager } from '../module-knowledge';
import { Neo4jDatabaseService } from './Neo4jDatabaseService';

const knowledgeManager = new ModuleKnowledgeManager();
const neo4jService = new Neo4jDatabaseService();

// Sync TTL files to Neo4j
knowledgeManager.on('ttl_updated', async (filePath) => {
  await neo4jService.ingestTTLFile(filePath);
});
```

### With RDF Generator

```typescript
import { RDFGenerator } from '../rdf-generator';
import { Neo4jDatabaseService } from './Neo4jDatabaseService';

const rdfGenerator = new RDFGenerator();
const neo4jService = new Neo4jDatabaseService();

// Generate and ingest RDF
const rdfContent = await rdfGenerator.generateRDF(codeAnalysis);
await neo4jService.ingestTTLContent(rdfContent, 'generated.ttl');
```

## Monitoring and Observability

### Metrics

The service provides comprehensive metrics:

- **Connection Metrics**: Pool usage, connection health
- **Ingestion Metrics**: Files processed, success/failure rates
- **Query Metrics**: Execution times, performance statistics
- **Database Metrics**: Node/relationship counts, storage usage

### Health Checks

Regular health checks monitor:

- Database connectivity
- Query response times
- Constraint and index health
- Storage capacity
- Memory usage

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check Neo4j server status
   - Verify connection credentials
   - Check network connectivity

2. **TTL Ingestion Errors**
   - Validate TTL syntax
   - Check for constraint violations
   - Verify node/relationship types

3. **Performance Issues**
   - Review query execution plans
   - Check for missing indexes
   - Monitor connection pool usage

4. **Memory Issues**
   - Monitor large query results
   - Check for memory leaks in connections
   - Review batch processing sizes

### Debug Mode

Enable debug logging:

```typescript
const service = new Neo4jDatabaseService();
service.on('database_event', (event) => {
  if (event.severity === 'ERROR') {
    console.error('Database Error:', event);
  }
});
```

## Contributing

When contributing to the Neo4j Database Service:

1. Follow the existing code patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure proper error handling
5. Add appropriate logging and monitoring

## Dependencies

- **neo4j-driver**: Official Neo4j driver for Node.js
- **fs/promises**: File system operations
- **events**: Event emitter functionality

## License

This service is part of the AI-Assisted Software Engineering system and follows the project's licensing terms.