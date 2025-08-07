# GraphCypherQAChain - Natural Language to Cypher Translation

A production-ready system that translates natural language queries into Neo4j Cypher queries using LLMs, with intelligent schema introspection and query optimization.

## Overview

The GraphCypherQAChain enables developers to query Neo4j databases using natural language, automatically generating optimized Cypher queries with comprehensive error handling and performance monitoring.

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

### 📊 **Schema Intelligence**
- Automatic Neo4j schema introspection
- Intelligent caching with TTL
- Real-time schema updates
- Index and constraint awareness

### 🎯 **Intent Recognition**
- **Find**: Retrieve specific data
- **Count**: Aggregate counting operations
- **Aggregate**: Sum, average, min, max operations
- **Path**: Shortest path and traversal queries
- **Create/Update/Delete**: Data modification operations

## Configuration

### Basic Setup
```typescript
import { GraphCypherQAChain } from '@aide/codebase-ai';
import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'password')
);

const config: CypherQAConfig = {
  neo4j: {
    uri: 'bolt://localhost:7687',
    user: 'neo4j',
    password: 'password',
    database: 'neo4j'
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
    optimizeQuery: true
  },
  schema: {
    cacheEnabled: true,
    cacheTtl: 300000, // 5 minutes
    includeIndexes: true,
    includeConstraints: true,
    maxNodes: 1000,
    maxRelationships: 1000
  },
  response: {
    includeQuery: true,
    includeExplanation: true,
    maxResults: 100,
    formatResults: true
  }
};

const cypherQA = new GraphCypherQAChain(config, driver);
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
    maxTokens: 1000
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
    maxTokens: 1000
  }
};
```

#### Local/Custom Models
```typescript
const localConfig = {
  llm: {
    provider: 'openai', // Use OpenAI-compatible interface
    model: 'llama-3-70b', // Your local model
    temperature: 0.1,
    maxTokens: 1000
  }
};

// Set custom endpoint via environment variable
process.env.OPENAI_BASE_URL = 'http://localhost:1234/v1';
```

## Usage Examples

### Basic Queries
```typescript
// Simple find query
const response1 = await cypherQA.query('find all users');

// Count query
const response2 = await cypherQA.query('how many products are there?');

// Filtered query
const response3 = await cypherQA.query('find users where age > 25');

// Relationship query
const response4 = await cypherQA.query('find users who bought products');
```

### Advanced Queries
```typescript
// Aggregation
const response1 = await cypherQA.query('average price of products in electronics category');

// Path finding
const response2 = await cypherQA.query('shortest path from user John to product iPhone');

// Complex relationships
const response3 = await cypherQA.query('find users who bought products that were also bought by users from the same city');
```

### Response Structure
```typescript
interface CypherQAResponse {
  originalQuery: string;           // "find users where age > 25"
  interpretedQuery: {              // Parsed query structure
    intent: 'find',
    entities: [{ type: 'node', name: 'user', confidence: 0.9 }],
    filters: [{ property: 'age', operator: '>', value: 25 }]
  };
  generatedCypher: {               // Generated Cypher query
    cypher: "MATCH (n:User) WHERE n.age > $age RETURN n",
    parameters: { age: 25 },
    confidence: 0.85,
    explanation: "Generated using pattern: Find Nodes"
  };
  executionResult: {               // Query execution results
    success: true,
    data: [...],                   // Query results
    summary: { executionTime: 45, recordsReturned: 12 }
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
vscode.commands.registerCommand('cypherqa.queryDatabase', async () => {
  const query = await vscode.window.showInputBox({
    prompt: 'Enter your natural language query',
    placeholder: 'e.g., find users who bought products in the last month'
  });

  if (query) {
    try {
      const response = await cypherQA.query(query);
      
      // Show results in a new document
      const doc = await vscode.workspace.openTextDocument({
        content: `
Query: ${response.originalQuery}

Generated Cypher:
${response.generatedCypher.cypher}

Results:
${response.formattedResponse}

Explanation:
${response.explanation}

Suggestions:
${response.suggestions.relatedQueries.join('\n')}
        `,
        language: 'cypher'
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
class CypherQAAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        
        val query = Messages.showInputDialog(
            project,
            "Enter your natural language query:",
            "Cypher QA",
            null
        ) ?: return
        
        // Execute query asynchronously
        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                val response = cypherQAService.query(query)
                
                ApplicationManager.getApplication().invokeLater {
                    // Create new editor tab with results
                    val fileType = FileTypeManager.getInstance().getFileTypeByExtension("cypher")
                    val document = EditorFactory.getInstance().createDocument(
                        buildString {
                            appendLine("-- Query: ${response.originalQuery}")
                            appendLine("-- Generated Cypher:")
                            appendLine(response.generatedCypher.cypher)
                            appendLine()
                            appendLine("-- Results:")
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

### Schema Caching
```typescript
const config = {
  schema: {
    cacheEnabled: true,
    cacheTtl: 600000,        // 10 minutes
    includeIndexes: true,     // Include index information
    includeConstraints: true, // Include constraint information
    maxNodes: 1000,          // Limit schema size
    maxRelationships: 1000
  }
};
```

### Query Optimization
```typescript
const config = {
  queryGeneration: {
    maxRetries: 3,           // Retry failed generations
    timeoutMs: 30000,        // 30 second timeout
    validateSyntax: true,    // Validate before execution
    optimizeQuery: true      // Apply optimization hints
  }
};
```

### Response Optimization
```typescript
const config = {
  response: {
    includeQuery: true,      // Include generated Cypher
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
  const response = await cypherQA.query('complex query');
  return response;
} catch (error) {
  if (error instanceof CypherQAError) {
    switch (error.code) {
      case 'SCHEMA_INTROSPECTION_FAILED':
        // Fallback to basic query patterns
        return await fallbackQuery(query);
      
      case 'CYPHER_SYNTAX_ERROR':
        // Retry with simpler generation
        return await retryWithSimpleGeneration(query);
      
      case 'QUERY_EXECUTION_FAILED':
        // Show user-friendly error
        return { error: 'Database query failed. Please try a simpler query.' };
      
      default:
        return { error: 'Query processing failed. Please try again.' };
    }
  }
  throw error;
}
```

### Error Types
```typescript
type CypherQAErrorCode = 
  | 'SCHEMA_INTROSPECTION_FAILED'  // Database connection issues
  | 'QUERY_GENERATION_FAILED'      // LLM generation failed
  | 'CYPHER_SYNTAX_ERROR'          // Invalid Cypher generated
  | 'CYPHER_SEMANTIC_ERROR'        // Valid syntax, invalid semantics
  | 'QUERY_EXECUTION_FAILED'       // Database execution failed
  | 'QUERY_TIMEOUT'                // Query took too long
  | 'CONNECTION_FAILED'            // Neo4j connection failed
  | 'INVALID_PARAMETERS'           // Invalid configuration
  | 'RATE_LIMITED'                 // LLM rate limiting
  | 'INSUFFICIENT_PERMISSIONS';    // Database permissions
```

## Monitoring & Metrics

### Built-in Metrics
```typescript
const metrics = await cypherQA.getMetrics();

console.log({
  queries: {
    total: metrics.queries.total,
    successful: metrics.queries.successful,
    failed: metrics.queries.failed,
    averageResponseTime: metrics.queries.averageResponseTime,
    averageConfidence: metrics.queries.averageConfidence
  },
  generation: {
    averageGenerationTime: metrics.generation.averageGenerationTime,
    retryRate: metrics.generation.retryRate,
    syntaxErrorRate: metrics.generation.syntaxErrorRate
  },
  execution: {
    averageExecutionTime: metrics.execution.averageExecutionTime,
    averageRecordsReturned: metrics.execution.averageRecordsReturned,
    timeoutRate: metrics.execution.timeoutRate
  }
});
```

### Custom Monitoring
```typescript
// Add custom metrics collection
cypherQA.on('query', (event) => {
  metrics.increment('cypherqa.queries.total');
  metrics.histogram('cypherqa.query.duration', event.duration);
  metrics.gauge('cypherqa.query.confidence', event.confidence);
});

cypherQA.on('error', (error) => {
  metrics.increment('cypherqa.errors.total', { code: error.code });
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
- Use specific entity names that match your schema
- Include clear relationships in natural language
- Specify filters and conditions explicitly
- Use domain-specific terminology

### 3. **Performance Tuning**
- Enable schema caching for production
- Set appropriate timeouts for your use case
- Monitor query patterns and optimize common ones
- Use pattern-based generation for frequent queries

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
ENV NEO4J_URI=bolt://neo4j:7687
ENV NEO4J_USER=neo4j
ENV NEO4J_PASSWORD=password
ENV OPENAI_API_KEY=your_key_here

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Environment Variables
```bash
# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
NEO4J_DATABASE=neo4j

# LLM Configuration
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_BASE_URL=http://localhost:1234/v1  # For local models

# Application Configuration
SCHEMA_CACHE_TTL=300000
QUERY_TIMEOUT=30000
MAX_RESULTS=100
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add comprehensive tests
4. Update documentation
5. Submit a pull request

## License

MIT License - see LICENSE file for details.