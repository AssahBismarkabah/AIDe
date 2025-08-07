/**
 * Layer 3: AI/LLM Integration & Reasoning - Main Integration
 * 
 * This module provides the main integration point for Layer 3 services,
 * combining RAG Engine, GraphCypher QA, and SPARQL Query Engine into
 * a unified AI reasoning system.
 */

export { RAGEngine, ContextManager } from './langchain-rag';
export { GraphCypherQAChain } from './graph-cypher-qa';
export { SPARQLQueryEngine } from './sparql-query-engine';

// Export types
export type {
  RAGConfig,
  QueryContext,
  RAGResponse,
  RAGMetrics
} from './langchain-rag/types';

export type {
  CypherQAConfig,
  CypherQAResponse,
  CypherQAMetrics
} from './graph-cypher-qa/types';

export type {
  SPARQLEngineConfig,
  SPARQLQueryResponse,
  SPARQLQueryIntent,
  ParsedSPARQLQuery,
  GeneratedSPARQLQuery,
  SPARQLExecutionResult
} from './sparql-query-engine/types';

// Main Layer 3 Integration Service
import { EventEmitter } from 'events';
import { RAGEngine } from './langchain-rag';
import { GraphCypherQAChain } from './graph-cypher-qa';
import { SPARQLQueryEngine } from './sparql-query-engine';
import { InMemoryRDFStore } from '../layer2/in-memory-rdf';
import { Neo4jDatabaseService } from '../layer2/neo4j-database';
import logger from '../../utils/logger';

export interface Layer3Config {
  rag: {
    provider: 'openai' | 'local';
    model: string;
    apiKey?: string;
    baseURL?: string;
    temperature?: number;
    maxTokens?: number;
  };
  graphCypher: {
    neo4jUrl: string;
    username?: string;
    password?: string;
    database?: string;
  };
  sparql: {
    provider: 'openai' | 'local';
    model: string;
    apiKey?: string;
    baseURL?: string;
  };
}

export interface AIQueryRequest {
  query: string;
  type: 'rag' | 'cypher' | 'sparql' | 'auto';
  context?: {
    currentFile?: string;
    selectedText?: string;
    projectPath?: string;
  };
}

export interface AIQueryResponse {
  query: string;
  type: 'rag' | 'cypher' | 'sparql';
  response: string;
  confidence: number;
  sources?: string[];
  executionTime: number;
  metadata?: Record<string, any>;
}

/**
 * Layer 3 AI Integration Service
 * 
 * Provides unified access to all Layer 3 AI services with intelligent
 * query routing and response coordination.
 */
export class Layer3AIService extends EventEmitter {
  private ragEngine?: RAGEngine;
  private graphCypherQA?: GraphCypherQAChain;
  private sparqlEngine?: SPARQLQueryEngine;
  private rdfStore: InMemoryRDFStore;
  private neo4jService: Neo4jDatabaseService;
  private isInitialized = false;

  constructor(
    private config: Layer3Config,
    rdfStore: InMemoryRDFStore,
    neo4jService: Neo4jDatabaseService
  ) {
    super();
    this.rdfStore = rdfStore;
    this.neo4jService = neo4jService;
  }

  /**
   * Initialize all Layer 3 services
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Layer 3 AI Integration Service');

      // Initialize RAG Engine
      this.ragEngine = new RAGEngine({
        llm: {
          provider: this.config.rag.provider,
          model: this.config.rag.model,
          temperature: this.config.rag.temperature || 0.1,
          maxTokens: this.config.rag.maxTokens || 1000
        },
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
      });
      logger.info('RAG Engine initialized successfully');

      // Initialize GraphCypher QA
      const driver = this.neo4jService.getDriver();
      if (!driver) {
        throw new Error('Neo4j driver not available');
      }

      this.graphCypherQA = new GraphCypherQAChain({
        neo4j: {
          uri: this.config.graphCypher.neo4jUrl,
          user: this.config.graphCypher.username || 'neo4j',
          password: this.config.graphCypher.password || 'password',
          database: this.config.graphCypher.database || 'neo4j'
        },
        llm: {
          provider: this.config.rag.provider,
          model: this.config.rag.model,
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
          cacheTtl: 300000,
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
      }, driver);
      logger.info('GraphCypher QA initialized successfully');

      // Initialize SPARQL Engine
      this.sparqlEngine = new SPARQLQueryEngine({
        rdf: {
          timeout: 30000,
          maxResults: 1000
        },
        llm: {
          provider: this.config.sparql.provider,
          model: this.config.sparql.model,
          temperature: 0.1,
          maxTokens: 1000
        },
        queryGeneration: {
          maxRetries: 3,
          timeoutMs: 30000,
          validateSyntax: true,
          optimizeQuery: true
        },
        prefixes: {
          'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
          'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
          'owl': 'http://www.w3.org/2002/07/owl#',
          'xsd': 'http://www.w3.org/2001/XMLSchema#',
          'code': 'http://example.org/code#',
          'module': 'http://example.org/module#'
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
      }, this.rdfStore);

      await this.sparqlEngine.initialize();
      logger.info('SPARQL Engine initialized successfully');

      this.isInitialized = true;
      this.emit('initialized');
      logger.info('Layer 3 AI Integration Service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Layer 3 AI Integration Service', error);
      throw error;
    }
  }

  /**
   * Process AI query with intelligent routing
   */
  async query(request: AIQueryRequest): Promise<AIQueryResponse> {
    if (!this.isInitialized) {
      throw new Error('Layer 3 AI Service not initialized');
    }

    const startTime = Date.now();
    
    try {
      // Determine query type if auto
      const queryType = request.type === 'auto' 
        ? this.determineQueryType(request.query)
        : request.type;

      let response: AIQueryResponse;

      switch (queryType) {
        case 'rag':
          response = await this.processRAGQuery(request);
          break;
        case 'cypher':
          response = await this.processCypherQuery(request);
          break;
        case 'sparql':
          response = await this.processSPARQLQuery(request);
          break;
        default:
          throw new Error(`Unsupported query type: ${queryType}`);
      }

      response.executionTime = Date.now() - startTime;
      this.emit('query:completed', response);
      
      return response;

    } catch (error) {
      const errorResponse: AIQueryResponse = {
        query: request.query,
        type: request.type as any,
        response: `Error processing query: ${error instanceof Error ? error.message : String(error)}`,
        confidence: 0,
        executionTime: Date.now() - startTime
      };

      this.emit('query:error', errorResponse);
      return errorResponse;
    }
  }

  /**
   * Determine appropriate query type based on query content
   */
  private determineQueryType(query: string): 'rag' | 'cypher' | 'sparql' {
    const lowerQuery = query.toLowerCase();

    // Graph relationship queries
    if (lowerQuery.includes('relationship') || 
        lowerQuery.includes('depends on') ||
        lowerQuery.includes('calls') ||
        lowerQuery.includes('connected to') ||
        lowerQuery.includes('flow') ||
        lowerQuery.includes('path between')) {
      return 'cypher';
    }

    // Semantic/ontology queries
    if (lowerQuery.includes('pattern') ||
        lowerQuery.includes('type of') ||
        lowerQuery.includes('instance of') ||
        lowerQuery.includes('semantic') ||
        lowerQuery.includes('ontology') ||
        lowerQuery.includes('class') && lowerQuery.includes('property')) {
      return 'sparql';
    }

    // Default to RAG for general queries
    return 'rag';
  }

  /**
   * Process RAG query
   */
  private async processRAGQuery(request: AIQueryRequest): Promise<AIQueryResponse> {
    if (!this.ragEngine) {
      throw new Error('RAG Engine not initialized');
    }

    const ragResponse = await this.ragEngine.query({
      query: request.query,
      intent: 'code_explanation',
      scope: 'project'
    });

    return {
      query: request.query,
      type: 'rag',
      response: ragResponse.answer,
      confidence: ragResponse.sources.length > 0 ? 0.8 : 0.3,
      sources: ragResponse.sources?.map(s => s.document.metadata?.source || 'unknown'),
      executionTime: 0, // Will be set by caller
      metadata: {
        contextUsed: ragResponse.context.retrievedDocuments,
        processingTime: ragResponse.context.processingTime
      }
    };
  }

  /**
   * Process Cypher query
   */
  private async processCypherQuery(request: AIQueryRequest): Promise<AIQueryResponse> {
    if (!this.graphCypherQA) {
      throw new Error('GraphCypher QA not initialized');
    }

    const cypherResponse = await this.graphCypherQA.query(request.query);

    return {
      query: request.query,
      type: 'cypher',
      response: cypherResponse.formattedResponse,
      confidence: cypherResponse.interpretedQuery.entities.length > 0 ? 0.8 : 0.3,
      sources: cypherResponse.executionResult.success ? ['Neo4j Graph Database'] : [],
      executionTime: 0, // Will be set by caller
      metadata: {
        cypherQuery: cypherResponse.generatedCypher.cypher,
        resultCount: cypherResponse.executionResult.summary.recordsReturned,
        executionTime: cypherResponse.executionResult.summary.executionTime
      }
    };
  }

  /**
   * Process SPARQL query
   */
  private async processSPARQLQuery(request: AIQueryRequest): Promise<AIQueryResponse> {
    if (!this.sparqlEngine) {
      throw new Error('SPARQL Engine not initialized');
    }

    const sparqlResponse = await this.sparqlEngine.query(request.query);

    return {
      query: request.query,
      type: 'sparql',
      response: sparqlResponse.formattedResponse,
      confidence: sparqlResponse.interpretedQuery.confidence,
      sources: sparqlResponse.executionResult.success ? ['RDF Knowledge Store'] : [],
      executionTime: 0, // Will be set by caller
      metadata: {
        sparqlQuery: sparqlResponse.generatedSPARQL.sparql,
        resultCount: sparqlResponse.executionResult.summary.resultCount,
        executionTime: sparqlResponse.executionResult.summary.executionTime
      }
    };
  }

  /**
   * Get service health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      rag: boolean;
      cypher: boolean;
      sparql: boolean;
    };
  }> {
    const services = {
      rag: this.ragEngine ? true : false,
      cypher: this.graphCypherQA ? true : false,
      sparql: this.sparqlEngine ? true : false
    };

    const healthyCount = Object.values(services).filter(Boolean).length;
    let status: 'healthy' | 'degraded' | 'unhealthy';

    if (healthyCount === 3) {
      status = 'healthy';
    } else if (healthyCount >= 1) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, services };
  }

  /**
   * Get combined metrics from all services
   */
  getMetrics() {
    return {
      rag: this.ragEngine?.getMetrics(),
      cypher: this.graphCypherQA?.getMetrics(),
      sparql: this.sparqlEngine?.getMetrics()
    };
  }

  /**
   * Shutdown all services
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Layer 3 AI Integration Service');

    if (this.ragEngine) {
      await this.ragEngine.shutdown();
    }

    if (this.graphCypherQA) {
      await this.graphCypherQA.shutdown();
    }

    if (this.sparqlEngine) {
      await this.sparqlEngine.shutdown();
    }

    this.removeAllListeners();
    this.isInitialized = false;

    logger.info('Layer 3 AI Integration Service shutdown completed');
  }
}