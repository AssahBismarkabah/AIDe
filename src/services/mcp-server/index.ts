/**
 * MCP Server Module
 * 
 * Model Context Protocol server for IDE integration that provides
 * rich codebase context using TTL files and knowledge graphs.
 */

export { MCPServer } from './MCPServer';
export * from './types';

// Default configuration factory
import { MCPServerConfig } from './types';

export function createDefaultMCPConfig(): MCPServerConfig {
  return {
    server: {
      name: 'AASWE-MCP-Server',
      version: '1.0.0',
      port: 3001,
      host: 'localhost',
      maxConnections: 100,
      timeout: 30000
    },
    context: {
      maxTokens: 8000,
      maxFiles: 10,
      relevanceThreshold: 0.3,
      cacheEnabled: true,
      cacheTtl: 300000 // 5 minutes
    },
    ttl: {
      watchEnabled: true,
      watchDebounce: 1000,
      maxFileSize: 1024 * 1024, // 1MB
      encoding: 'utf-8',
      directories: ['./clean-knowledge', './.aaswe/knowledge', './knowledge'], // Default TTL directories
      patterns: ['**/*.module-knowledge.ttl', '**/*.ttl'] // TTL file patterns
    },
    integration: {
      layer3Config: {
        rag: {
          enabled: true,
          vectorStore: {
            type: 'memory',
            dimensions: 1536,
            similarity: 'cosine'
          },
          retrieval: {
            topK: 5,
            scoreThreshold: 0.7,
            maxTokens: 4000,
            contextWindow: 8000
          },
          llm: {
            provider: 'openai',
            model: 'gpt-4',
            temperature: 0.1,
            maxTokens: 1000
          },
          embeddings: {
            provider: 'openai',
            model: 'text-embedding-ada-002',
            dimensions: 1536
          },
          cache: {
            enabled: true,
            ttl: 300000,
            maxSize: 1000
          }
        },
        graphCypher: {
          enabled: true,
          neo4j: {
            uri: 'bolt://localhost:7687',
            user: 'neo4j',
            password: 'password'
          },
          llm: {
            provider: 'openai',
            model: 'gpt-4',
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
            cacheTtl: 3600000,
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
        },
        sparql: {
          enabled: true,
          rdf: {
            timeout: 30000,
            maxResults: 1000
          },
          llm: {
            provider: 'openai',
            model: 'gpt-4',
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
            'xsd': 'http://www.w3.org/2001/XMLSchema#',
            'aaswe': 'http://aaswe.org/ontology#'
          },
          response: {
            includeQuery: true,
            includeExplanation: true,
            formatResults: true,
            maxResults: 100
          },
          caching: {
            enabled: true,
            ttl: 300000,
            maxSize: 1000
          }
        },
        ragSparql: {
          enabled: false
        },
        global: {
          defaultProvider: 'openai',
          fallbackProvider: 'openai',
          timeout: 30000,
          retries: 3,
          enableMetrics: true,
          enableLogging: true
        }
      },
      neo4jEnabled: true,
      rdfStoreEnabled: true,
      hybridStorageEnabled: true
    },
    ide: {
      vscode: {
        enabled: true,
        extensionId: 'aaswe.mcp-extension',
        contextWindow: 8000
      },
      intellij: {
        enabled: true,
        pluginId: 'org.aaswe.mcp-plugin',
        contextWindow: 8000
      }
    }
  };
}

// Configuration validation
export function validateMCPConfig(config: MCPServerConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate server config
  if (!config.server.name) errors.push('Server name is required');
  if (!config.server.port || config.server.port < 1 || config.server.port > 65535) {
    errors.push('Valid server port (1-65535) is required');
  }

  // Validate context config
  if (config.context.maxTokens < 1000) {
    errors.push('Context maxTokens should be at least 1000');
  }
  if (config.context.maxFiles < 1) {
    errors.push('Context maxFiles should be at least 1');
  }

  // Validate TTL config
  if (config.ttl.maxFileSize < 1024) {
    errors.push('TTL maxFileSize should be at least 1024 bytes');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}