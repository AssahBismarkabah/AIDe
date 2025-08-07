# SPARQL Query Engine - Natural Language to SPARQL Translation

A production-ready natural language to SPARQL translation engine with intelligent query generation, optimization, and execution capabilities for RDF knowledge queries.

## Overview

The SPARQL Query Engine enables developers to query RDF knowledge graphs using natural language, automatically generating optimized SPARQL queries with comprehensive error handling, caching, and performance monitoring.

## Key Features

### 🧠 **Multi-LLM Support**
- **OpenAI**: GPT-3.5, GPT-4, GPT-4 Turbo, GPT-4o
- **Anthropic**: Claude 3 Haiku, Sonnet, Opus
- **Local Models**: Any OpenAI-compatible API endpoint
- **Extensible**: Easy to add new LLM providers

### 🔍 **Intelligent Query Generation**
- Pattern-based generation for common queries (fast, reliable)
- LLM-based generation for complex queries (flexible, powerful)
- Automatic query optimization and validation
- Context-aware entity and relationship detection

### 📊 **Ontology Intelligence**
- Automatic RDF ontology introspection
- Intelligent caching with TTL
- Real-time schema updates
- Class and property awareness

### 🎯 **Intent Recognition**
- **Select**: Retrieve specific data
- **Ask**: Boolean questions
- **Construct**: Build new RDF graphs
- **Describe**: Describe resources
- **Count**: Aggregate counting operations
- **Aggregate**: Sum, average, min, max operations
- **Path**: Property path queries

## Configuration

### Basic Setup
```typescript
import { SPARQLQueryEngine } from '@aide/codebase-ai';
import { InMemoryRDFStore } from '@aide/codebase-ai';

const rdfStore = new InMemoryRDFStore();

const config: SPARQLEngineConfig = {
  rdf: {
    endpoint: 'http://localhost:3030/dataset/sparql', // Optional for in-memory
    timeout: 30000,
    maxResults: 1000
  },
  llm: {
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    temperature: 0.1,
    maxTokens: 1000
  },
  queryGeneration: {
    maxRetries: 3,
    timeoutMs: 30000,
    validateSyntax: true,
    optimizeQuery: true,
    usePatterns: true
  },
  prefixes: {
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
    'owl': 'http://www.w3.org/2002/07/owl#',
    'foaf': 'http://xmlns.com/foaf/0.1/',
    'ex': 'http://example.org/'
  },
  response: {
    includeQuery: true,
    includeExplanation: true,
    formatResults: true,
    maxResults: 100
  },
  caching: {
    enabled: true,
    ttl: 300000, // 5 minutes
    maxSize: 1000
  }
};

const sparqlEngine = new SPARQLQueryEngine(config, rdfStore);
```

### Multi-Provider Configuration

#### OpenAI Models
```typescript
const openaiConfig = {
  llm: {
    provider: 'openai',
    model: 'gpt-4o',              // Latest GPT-4 Omni
    // model: 'gpt-4-turbo-preview', // GPT-4 Turbo
    // model: 'gpt-3.5-turbo',       // GPT-3.5 (faster, cheaper)
    temperature: 0.1,
    maxTokens: 1000,
    apiKey: process.env.OPENAI_API_KEY
  }
};
```

#### Anthropic Models
```typescript
const anthropicConfig = {
  llm: {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',    // Most capable
    // model: 'claude-3-sonnet-20240229', // Balanced
    // model: 'claude-3-haiku-20240307',  // Fastest
    temperature: 0.0,
    maxTokens: 1000,
    apiKey: process.env.ANTHROPIC_API_KEY
  }
};
```

#### Local/Custom Models
```typescript
const localConfig = {
  llm: {
    provider: 'local',
    model: 'llama-3-70b', // Your local model
    temperature: 0.1,
    maxTokens: 1000,
    baseURL: 'http://localhost:1234/v1'
  }
};
```

## Usage Examples

### Basic Queries
```typescript
// Initialize the engine
await sparqlEngine.initialize();

// Simple find query
const response1 = await sparqlEngine.query('find all users');

// Count query
const response2 = await sparqlEngine.query('how many products are there?');

// Filtered query
const response3 = await sparqlEngine.query('find users where age > 25');

// Relationship query
const response4 = await sparqlEngine.query('find users who know other users');
```

### Advanced Queries
```typescript
// Aggregation
const response1 = await sparqlEngine.query('average age of users');

// Boolean questions
const response2 = await sparqlEngine.query('is there a user named John?');

// Complex relationships
const response3 = await sparqlEngine.query('find users who know users from the same organization');

// Property paths
const response4 = await sparqlEngine.query('find all people connected to John through friendship');
```

### Response Structure
```typescript
interface SPARQLQueryResponse {
  originalQuery: string;           // "find users where age > 25"
  interpretedQuery: {              // Parsed query structure
    intent: 'select',
    entities: [{ type: 'class', value: 'User', confidence: 0.9 }],
    filters: [{ property: 'age', operator: '>', value: 25 }]
  };
  generatedSPARQL: {               // Generated SPARQL query
    sparql: "SELECT ?user WHERE { ?user rdf:type ex:User . ?user ex:age ?age . FILTER(?age > 25) }",
    prefixes: { ... },
    confidence: 0.85,
    explanation: "Generated using pattern-based method"
  };
  executionResult: {               // Query execution results
    success: true,
    data: [...],                   // Query results
    summary: { executionTime: 45, resultCount: 12 }
  };
  formattedResponse: string;       // Human-readable response
  explanation: string;             // Query explanation
  suggestions: {                   // Follow-up suggestions
    relatedQueries: ["count users where age > 25"],
    followUpQuestions: ["Would you like to see more details?"],
    optimizations: ["Consider adding an index on age property"]
  };
}
```

## IDE Integration

### VS Code Extension Example
```typescript
// Extension command handler
vscode.commands.registerCommand('sparql.queryRDF', async () => {
  const query = await vscode.window.showInputBox({
    prompt: 'Enter your natural language query',
    placeholder: 'e.g., find all people who work for companies in Berlin'
  });

  if (query) {
    try {
      const response = await sparqlEngine.query(query);
      
      // Show results in a new document
      const doc = await vscode.workspace.openTextDocument({
        content: `
Query: ${response.originalQuery}

Generated SPARQL:
${response.generatedSPARQL.sparql}

Results:
${response.formattedResponse}

Explanation:
${response.explanation}

Suggestions:
${response.suggestions.relatedQueries.join('\n')}
        `,
        language: 'sparql'
      });
      
      await vscode.window.showTextDocument(doc);
    } catch (error) {
      vscode.window.showErrorMessage(`Query failed: ${error.message}`);
    }
  }
});
```

### IntelliJ Plugin Example
```kotlin
class SPARQLQueryAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        
        val query = Messages.showInputDialog(
            project,
            "Enter your natural language query:",
            "SPARQL Query",
            null
        ) ?: return
        
        // Execute query asynchronously
        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                val response = sparqlService.query(query)
                
                ApplicationManager.getApplication().invokeLater {
                    // Create new editor tab with results
                    val fileType = FileTypeManager.getInstance().getFileTypeByExtension("sparql")
                    val document = EditorFactory.getInstance().createDocument(
                        buildString {
                            appendLine("# Query: ${response.originalQuery}")
                            appendLine("# Generated SPARQL:")
                            appendLine(response.generatedSPARQL.sparql)
                            appendLine()
                            appendLine("# Results:")
                            appendLine(response.formattedResponse)
                        }
                    )
                    
                    val editor = EditorFactory.getInstance().createEditor(document, project, fileType, true)
                    // Show in tool window or new tab
                }
            } catch (error: Exception) {
                Messages.showErrorDialog(project, "Query failed: ${error.message}", "Error")
            }
        }
    }
}
```

## Performance Optimization

### Query Patterns
```typescript
// Enable pattern-based generation for common queries
const config = {
  queryGeneration: {
    usePatterns: true,        // Use fast pattern matching
    validateSyntax: true,     // Validate before execution
    optimizeQuery: true       // Apply optimization hints
  }
};
```

### Caching
```typescript
const config = {
  caching: {
    enabled: true,
    ttl: 600000,        // 10 minutes
    maxSize: 1000       // Maximum cached queries
  }
};
```

### Response Optimization
```typescript
const config = {
  response: {
    includeQuery: true,      // Include generated SPARQL
    includeExplanation: true, // Include explanation
    maxResults: 100,         // Limit result size
    formatResults: true      // Format for readability
  }
};
```

## Error Handling

### Graceful Degradation
```typescript
try {
  const response = await sparqlEngine.query('complex query');
  return response;
} catch (error) {
  if (error instanceof SPARQLError) {
    switch (error.code) {
      case 'QUERY_PARSING_FAILED':
        // Retry with simpler parsing
        return await retryWithSimpleQuery(query);
      
      case 'SPARQL_SYNTAX_ERROR':
        // Show user-friendly error
        return { error: 'Could not understand the query. Please try rephrasing.' };
      
      case 'QUERY_EXECUTION_FAILED':
        // Fallback to cached results or suggestions
        return await getFallbackResults(query);
      
      default:
        return { error: 'Query processing failed. Please try again.' };
    }
  }
  throw error;
}
```

### Error Types
```typescript
type SPARQLErrorCode = 
  | 'QUERY_PARSING_FAILED'        // Natural language parsing failed
  | 'SPARQL_GENERATION_FAILED'    // SPARQL generation failed
  | 'SPARQL_SYNTAX_ERROR'         // Invalid SPARQL generated
  | 'SPARQL_SEMANTIC_ERROR'       // Valid syntax, invalid semantics
  | 'QUERY_EXECUTION_FAILED'      // RDF store execution failed
  | 'QUERY_TIMEOUT'               // Query took too long
  | 'ENDPOINT_UNAVAILABLE'        // SPARQL endpoint unavailable
  | 'INVALID_PARAMETERS'          // Invalid configuration
  | 'RATE_LIMITED'                // LLM rate limiting
  | 'INSUFFICIENT_PERMISSIONS';   // RDF store permissions
```

## Monitoring & Metrics

### Built-in Metrics
```typescript
const metrics = await sparqlEngine.getMetrics();

console.log({
  queries: {
    total: metrics.queries.total,
    successful: metrics.queries.successful,
    failed: metrics.queries.failed,
    cached: metrics.queries.cached,
    averageResponseTime: metrics.queries.averageResponseTime,
    averageConfidence: metrics.queries.averageConfidence
  },
  generation: {
    patternBased: metrics.generation.patternBased,
    llmBased: metrics.generation.llmBased,
    averageGenerationTime: metrics.generation.averageGenerationTime,
    retryRate: metrics.generation.retryRate,
    syntaxErrorRate: metrics.generation.syntaxErrorRate
  },
  execution: {
    averageExecutionTime: metrics.execution.averageExecutionTime,
    averageResultCount: metrics.execution.averageResultCount,
    timeoutRate: metrics.execution.timeoutRate
  },
  cache: {
    hits: metrics.cache.hits,
    misses: metrics.cache.misses,
    hitRate: metrics.cache.hitRate,
    size: metrics.cache.size
  }
});
```

### Custom Monitoring
```typescript
// Add custom metrics collection
sparqlEngine.on('query', (event) => {
  metrics.increment('sparql.queries.total');
  metrics.histogram('sparql.query.duration', event.duration);
  metrics.gauge('sparql.query.confidence', event.confidence);
});

sparqlEngine.on('error', (error) => {
  metrics.increment('sparql.errors.total', { code: error.code });
});
```

## Best Practices

### 1. **Model Selection**
- **GPT-4**: Best for complex queries, highest accuracy
- **GPT-3.5**: Good balance of speed and accuracy
- **Claude 3 Opus**: Excellent for complex reasoning
- **Claude 3 Haiku**: Fastest response times
- **Local Models**: Privacy-focused deployments

### 2. **Query Design**
- Use specific entity names that match your ontology
- Include clear relationships in natural language
- Specify filters and conditions explicitly
- Use domain-specific terminology

### 3. **Performance Tuning**
- Enable pattern-based generation for common queries
- Set appropriate timeouts for your use case
- Monitor query patterns and optimize frequent ones
- Use caching for repeated queries

### 4. **Error Handling**
- Implement graceful degradation
- Provide user-friendly error messages
- Log errors for debugging and improvement
- Have fallback strategies for common failures

## Deployment

### Docker Configuration
```dockerfile
FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY dist/ ./dist/

# Environment variables
ENV NODE_ENV=production
ENV OPENAI_API_KEY=your_key_here
ENV ANTHROPIC_API_KEY=your_key_here

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Environment Variables
```bash
# LLM Configuration
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_BASE_URL=http://localhost:1234/v1  # For local models

# SPARQL Configuration
SPARQL_ENDPOINT=http://localhost:3030/dataset/sparql
QUERY_TIMEOUT=30000
MAX_RESULTS=1000

# Application Configuration
CACHE_TTL=300000
CACHE_MAX_SIZE=1000
```

## Architecture

### Query Processing Pipeline
1. **Natural Language Parsing**: Extract intent, entities, and patterns
2. **Query Generation**: Pattern-based or LLM-based SPARQL generation
3. **Validation**: Syntax and semantic validation
4. **Execution**: Query execution against RDF store
5. **Response Formatting**: Human-readable result formatting
6. **Caching**: Result caching for performance

### Integration Points
- **RDF Store**: In-memory or external SPARQL endpoints
- **LLM Providers**: OpenAI, Anthropic, local models
- **IDE Extensions**: VS Code, IntelliJ, others
- **Monitoring**: Metrics collection and alerting
- **Caching**: Redis or in-memory caching

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add comprehensive tests
4. Update documentation
5. Submit a pull request

## License

MIT License - see LICENSE file for details.