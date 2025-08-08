# MCP Server for IDE Integration

The **Model Context Protocol (MCP) Server** is the core deliverable of the AASWE system, providing rich codebase context to IDE LLMs through `.module-knowledge.ttl` files and knowledge graphs.

## Overview

The MCP Server acts as a bridge between your **existing IDE LLM** and the comprehensive knowledge graph built from your codebase. It enhances your current development setup by providing rich contextual information without requiring you to change your preferred LLM.

## 🎯 **Two Deployment Modes**

### **Mode 1: Pure Context Provider (Recommended)**
**Perfect for most developers who want enhanced context with their existing setup**

```
Your IDE LLM (Claude, GPT-4, etc.)
    ↕️ MCP Protocol
AASWE MCP Server
    ↕️ Direct TTL access
TTL Files + Code Graph (Layers 1+2)
```

**What you get:**
- ✅ **Keep your existing IDE LLM** (Claude, GPT-4, Copilot, etc.)
- ✅ **Rich codebase context** from TTL files and knowledge graphs
- ✅ **No additional model configuration** required
- ✅ **Lightweight and fast** - just context enhancement
- ✅ **Works with any LLM** your IDE supports

### **Mode 2: Enhanced with AI Analysis (Advanced)**
**For teams wanting advanced AI-powered code analysis and reasoning**

```
Your IDE LLM (Claude, GPT-4, etc.)
    ↕️ MCP Protocol
AASWE MCP Server
    ↕️ Enhanced queries
Layer 3 AI Services (RAG, Graph QA, SPARQL)
    ↕️ Deep analysis
TTL Files + Code Graph + Neo4j (All Layers)
```

**Additional features:**
- ✅ **Everything from Mode 1** PLUS
- ✅ **Advanced RAG queries** for complex code questions
- ✅ **Natural language to Cypher** for graph database queries
- ✅ **SPARQL reasoning** over RDF knowledge graphs
- ✅ **AI-powered code analysis** and recommendations

## 🚀 **Quick Start (Mode 1 - Recommended)**

Most users should start with Mode 1 - it provides immediate value with minimal setup:

```bash
# 1. Install and start AASWE
npm install -g @aaswe/codebase-ai
aaswe start --mode=context-only

# 2. Configure your IDE to connect to: ws://localhost:3001
# 3. Your existing LLM now has rich codebase context!
```

**No model configuration needed** - your IDE LLM gets enhanced context automatically.

## Key Features

### 🎯 **Intelligent Context Selection**
- Automatically selects relevant TTL files based on current file and cursor position
- Scores relevance using file proximity, language matching, and content analysis
- Optimizes context size to stay within LLM token limits

### 📁 **TTL File Integration**
- Real-time monitoring of `.module-knowledge.ttl` files
- Serves both auto-generated and developer-enhanced knowledge
- Preserves business context and architectural insights

### 🔧 **MCP Tools**
- **`get_context`**: Get rich codebase context for specific file/position
- **`query_knowledge`**: Query knowledge graph using natural language
- **`analyze_code`**: Analyze code structure and relationships

### 🔄 **Real-time Updates**
- File system watcher for TTL file changes
- Automatic cache invalidation and context refresh
- Live updates to connected IDE clients

### ⚡ **Performance Optimized**
- Intelligent caching with configurable TTL
- Context size optimization
- Efficient relevance scoring algorithms

## Architecture

### **Mode 1: Pure Context Provider**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Your IDE LLM    │◄──►│   MCP Server    │◄──►│   TTL Files     │
│ (Claude/GPT-4)  │    │ (Context Only)  │    │ + Code Graph    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Mode 2: Enhanced with AI Analysis**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Your IDE LLM    │◄──►│   MCP Server    │◄──►│ Layer 3 AI      │
│ (Claude/GPT-4)  │    │ (Full Features) │    │ (RAG/Graph QA)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   TTL Files     │    │ Neo4j + RDF    │
                       │ + Code Graph    │    │ Knowledge Base  │
                       └─────────────────┘    └─────────────────┘
```

## Configuration

### Basic Configuration

```typescript
import { createDefaultMCPConfig, MCPServer } from './mcp-server';

const config = createDefaultMCPConfig();
config.server.port = 3001;
config.context.maxTokens = 8000;
config.context.maxFiles = 10;
```

### Advanced Configuration

```typescript
const config: MCPServerConfig = {
  server: {
    name: 'My-AASWE-Server',
    version: '1.0.0',
    port: 3001,
    host: 'localhost',
    maxConnections: 100,
    timeout: 30000
  },
  context: {
    maxTokens: 8000,           // Maximum tokens per context
    maxFiles: 10,              // Maximum TTL files per context
    relevanceThreshold: 0.3,   // Minimum relevance score
    cacheEnabled: true,
    cacheTtl: 300000          // 5 minutes
  },
  ttl: {
    watchEnabled: true,        // Monitor TTL file changes
    watchDebounce: 1000,      // Debounce file events
    maxFileSize: 1024 * 1024, // 1MB max file size
    encoding: 'utf-8'
  },
  // ... integration settings
};
```

## Usage

### Starting the Server

```typescript
import { MCPServer, createDefaultMCPConfig } from './mcp-server';
import { Layer3AIService } from '../layer3';
import { HybridStorageManager } from '../layer2/hybrid-storage';

// Initialize dependencies
const layer3Service = new Layer3AIService(layer3Config);
const hybridStorage = new HybridStorageManager(storageConfig);

// Create and start MCP server
const config = createDefaultMCPConfig();
const mcpServer = new MCPServer(config, layer3Service, hybridStorage);

await mcpServer.start();
console.log('MCP Server running on port 3001');
```

### IDE Integration

#### VS Code Extension

```json
{
  "name": "aaswe-mcp-extension",
  "contributes": {
    "configuration": {
      "properties": {
        "aaswe.mcpServer.url": {
          "type": "string",
          "default": "ws://localhost:3001",
          "description": "MCP Server WebSocket URL"
        }
      }
    }
  }
}
```

#### IntelliJ Plugin

```kotlin
class AASWEMCPService {
    private val mcpClient = MCPClient("ws://localhost:3001")
    
    fun getContextForPosition(file: VirtualFile, offset: Int): String {
        return mcpClient.callTool("get_context", mapOf(
            "filePath" to file.path,
            "cursorPosition" to getLineColumn(offset)
        ))
    }
}
```

## MCP Protocol Implementation

### Tools

#### `get_context`
Get rich codebase context for a specific file and cursor position.

**Input:**
```json
{
  "filePath": "src/components/UserService.ts",
  "cursorPosition": { "line": 42, "column": 15 },
  "query": "How does user authentication work?",
  "intent": "explanation",
  "maxTokens": 4000,
  "includeRelated": true
}
```

**Output:**
```json
{
  "context": "# Codebase Context\n# Current File: src/components/UserService.ts...",
  "sources": [
    {
      "type": "ttl",
      "path": "src/auth/.module-knowledge.ttl",
      "relevanceScore": 0.95,
      "content": "# Authentication Module\n@prefix auth: <http://example.org/auth#>..."
    }
  ],
  "metadata": {
    "totalTokens": 3847,
    "processingTime": 156,
    "relevanceScore": 0.87,
    "cached": false
  }
}
```

#### `query_knowledge`
Query the knowledge graph using natural language.

**Input:**
```json
{
  "query": "What are all the database entities in this system?",
  "type": "cypher",
  "maxResults": 50
}
```

#### `analyze_code`
Analyze code structure and relationships.

**Input:**
```json
{
  "filePath": "src/models/User.ts",
  "includeMetrics": true,
  "includeDependencies": true
}
```

### Resources

The server exposes TTL files as MCP resources:

```json
{
  "resources": [
    {
      "uri": "ttl://src/auth/.module-knowledge.ttl",
      "name": "TTL: src/auth/.module-knowledge.ttl",
      "description": "Module knowledge file for auth",
      "mimeType": "text/turtle"
    }
  ]
}
```

## Context Selection Algorithm

The MCP Server uses intelligent context selection to provide the most relevant information:

### Relevance Scoring

1. **File Proximity** (0.5 points)
   - Same directory as current file
   - Parent/child directory relationship (0.3 points)

2. **Language Matching** (0.3 points)
   - TTL file language matches current file language

3. **Query Matching** (0.4 points)
   - TTL content contains query terms

4. **Dependency Matching** (0.2 points)
   - TTL file lists current file as dependency

### Selection Process

1. Score all TTL files for relevance
2. Filter by minimum threshold (default: 0.3)
3. Sort by relevance score (descending)
4. Limit to maximum files (default: 10)
5. Optimize for token limits

## TTL File Format

The server expects `.module-knowledge.ttl` files with this structure:

```turtle
@prefix aaswe: <http://aaswe.org/ontology#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

# Module: UserService
# Language: typescript
# Dependencies: AuthService, DatabaseService

aaswe:UserService a aaswe:Module ;
    rdfs:label "User Service" ;
    rdfs:comment "Handles user management and authentication" ;
    aaswe:hasClass aaswe:UserController ;
    aaswe:dependsOn aaswe:AuthService .

aaswe:UserController a aaswe:Class ;
    rdfs:label "User Controller" ;
    rdfs:comment "REST controller for user operations" ;
    aaswe:hasMethod aaswe:createUser, aaswe:updateUser .

# Business Context:
# This service is the main entry point for user operations
# It implements OAuth2 authentication with JWT tokens
# Critical for user onboarding and profile management
```

## Monitoring and Metrics

### Server Status

```typescript
const status = mcpServer.getStatus();
console.log(status);
// {
//   status: 'running',
//   uptime: 3600000,
//   connections: 2,
//   metrics: {
//     totalRequests: 1247,
//     successfulRequests: 1198,
//     failedRequests: 49,
//     averageResponseTime: 156,
//     contextCacheHits: 892,
//     contextCacheMisses: 355
//   }
// }
```

### Detailed Metrics

```typescript
const metrics = mcpServer.getMetrics();
console.log(metrics.context);
// {
//   totalContextRequests: 1247,
//   averageContextSize: 3847,
//   cacheHitRate: 0.715,
//   averageRelevanceScore: 0.82,
//   ttlFilesWatched: 47,
//   ttlFilesLoaded: 47
// }
```

## Error Handling

The server provides comprehensive error handling:

```typescript
// Custom error types
class MCPServerError extends Error {
  constructor(
    public code: MCPServerErrorCode,
    message: string,
    public data?: any
  ) {
    super(message);
  }
}

// Error codes
type MCPServerErrorCode = 
  | 'INVALID_REQUEST'
  | 'METHOD_NOT_FOUND'
  | 'CONTEXT_GENERATION_FAILED'
  | 'TTL_PARSING_FAILED'
  | 'FILE_NOT_FOUND'
  | 'SERVICE_UNAVAILABLE';
```

## Development

### Running Tests

```bash
npm test -- --testPathPattern=mcp-server
```

### Debug Mode

```typescript
const config = createDefaultMCPConfig();
config.global.enableLogging = true;

// Enable detailed logging
process.env.LOG_LEVEL = 'debug';
```

### Performance Tuning

1. **Cache Configuration**
   ```typescript
   config.context.cacheEnabled = true;
   config.context.cacheTtl = 600000; // 10 minutes
   ```

2. **Context Optimization**
   ```typescript
   config.context.maxTokens = 6000;    // Reduce for faster processing
   config.context.maxFiles = 5;        // Limit file count
   config.context.relevanceThreshold = 0.5; // Higher threshold
   ```

3. **File Watching**
   ```typescript
   config.ttl.watchDebounce = 2000;    // Reduce file system load
   config.ttl.maxFileSize = 512 * 1024; // Limit file size
   ```

## Integration Examples

### Custom Tool Implementation

```typescript
// Add custom tool to MCP server
class CustomMCPServer extends MCPServer {
  protected async handleToolsList(): Promise<{ tools: MCPTool[] }> {
    const defaultTools = await super.handleToolsList();
    
    defaultTools.tools.push({
      name: 'custom_analysis',
      description: 'Perform custom code analysis',
      inputSchema: {
        type: 'object',
        properties: {
          analysisType: { type: 'string', enum: ['security', 'performance'] },
          filePath: { type: 'string' }
        },
        required: ['analysisType', 'filePath']
      }
    });
    
    return defaultTools;
  }
}
```

### Context Enhancement

```typescript
// Enhance context with custom data
class EnhancedMCPServer extends MCPServer {
  protected async generateContext(request: ContextRequest): Promise<ContextResponse> {
    const baseContext = await super.generateContext(request);
    
    // Add custom context
    baseContext.context += '\n\n# Custom Analysis\n';
    baseContext.context += await this.getCustomAnalysis(request.filePath);
    
    return baseContext;
  }
}
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check if server is running on correct port
   - Verify firewall settings
   - Ensure WebSocket support

2. **No Context Returned**
   - Verify TTL files exist and are readable
   - Check relevance threshold settings
   - Review file path patterns

3. **High Memory Usage**
   - Reduce cache size and TTL
   - Limit max files and tokens
   - Monitor TTL file sizes

4. **Slow Response Times**
   - Enable caching
   - Optimize relevance threshold
   - Reduce context size

### Debug Commands

```bash
# Check server health
curl http://localhost:3001/health

# View metrics
curl http://localhost:3001/metrics

# Test WebSocket connection
wscat -c ws://localhost:3001
```

## Future Enhancements

- **Multi-language Support**: Enhanced parsing for more programming languages
- **Advanced Caching**: Redis-based distributed caching
- **Security**: Authentication and authorization for enterprise use
- **Scalability**: Horizontal scaling with load balancing
- **Analytics**: Advanced usage analytics and insights

---

The MCP Server is the cornerstone of the AASWE system, enabling seamless integration between your development environment and the rich knowledge graph of your codebase. It transforms static code into intelligent, contextual assistance for developers.