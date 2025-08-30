/**
 * Layer 3: AI/LLM Integration & Reasoning - Types
 * 
 * Unified type definitions for all Layer 3 AI services including
 * RAG Engine, GraphCypher QA Chain, and SPARQL Query Engine.
 */

// Re-export service-specific types with explicit naming to avoid conflicts
export * from './langchain-rag/types';
export * from './graph-cypher-qa/types';
export {
  SPARQLEngineConfig,
  SPARQLQueryIntent,
  SPARQLEntity,
  SPARQLTriplePattern,
  SPARQLFilter,
  ParsedSPARQLQuery,
  SPARQLAggregation,
  SPARQLOrderBy,
  GeneratedSPARQLQuery,
  SPARQLExecutionResult,
  SPARQLResultRow,
  SPARQLValue,
  SPARQLBinding,
  SPARQLQueryResponse,
  SPARQLErrorCode,
  SPARQLError,
  SPARQLMetrics,
  SPARQLQueryPattern,
  OntologyInfo,
  OntologyClass,
  OntologyProperty,
  OntologyIndividual,
  QueryOptimization as SPARQLQueryOptimization,
  CacheEntry,
  SPARQLQueryEvent,
  ValidationResult,
  ValidationError,
  ValidationWarning
} from './sparql-query-engine/types';

// Layer 3 Service Configuration
export interface Layer3Config {
  // RAG Engine configuration
  rag: {
    enabled: boolean;
    vectorStore: {
      type: 'memory' | 'redis' | 'neo4j';
      dimensions: number;
      similarity: 'cosine' | 'euclidean' | 'dot';
    };
    retrieval: {
      topK: number;
      scoreThreshold: number;
      maxTokens: number;
      contextWindow: number;
    };
    llm: {
      provider: 'openai' | 'anthropic' | 'local';
      model: string;
      temperature: number;
      maxTokens: number;
      apiKey?: string;
      baseURL?: string;
    };
    embeddings: {
      provider: 'openai' | 'local';
      model: string;
      dimensions: number;
      apiKey?: string;
    };
    cache: {
      enabled: boolean;
      ttl: number;
      maxSize: number;
    };
  };

  // GraphCypher QA configuration
  graphCypher: {
    enabled: boolean;
    neo4j: {
      uri: string;
      user: string;
      password: string;
      database?: string;
    };
    llm: {
      provider: 'openai' | 'anthropic' | 'local';
      model: string;
      temperature: number;
      maxTokens: number;
      apiKey?: string;
      baseURL?: string;
    };
    queryGeneration: {
      maxRetries: number;
      timeoutMs: number;
      validateSyntax: boolean;
      optimizeQuery: boolean;
    };
    schema: {
      cacheEnabled: boolean;
      cacheTtl: number;
      includeIndexes: boolean;
      includeConstraints: boolean;
      maxNodes: number;
      maxRelationships: number;
    };
    response: {
      includeQuery: boolean;
      includeExplanation: boolean;
      maxResults: number;
      formatResults: boolean;
    };
  };

  // SPARQL Query Engine configuration
  sparql: {
    enabled: boolean;
    rdf: {
      endpoint?: string;
      defaultGraph?: string;
      timeout: number;
      maxResults: number;
    };
    llm: {
      provider: 'openai' | 'anthropic' | 'local';
      model: string;
      temperature: number;
      maxTokens: number;
      apiKey?: string;
      baseURL?: string;
    };
    queryGeneration: {
      maxRetries: number;
      timeoutMs: number;
      validateSyntax: boolean;
      optimizeQuery: boolean;
      usePatterns: boolean;
    };
    prefixes: {
      [prefix: string]: string;
    };
    response: {
      includeQuery: boolean;
      includeExplanation: boolean;
      formatResults: boolean;
      maxResults: number;
    };
    caching: {
      enabled: boolean;
      ttl: number;
      maxSize: number;
    };
  };

  // RAG+SPARQL integration toggle
  ragSparql?: {
    enabled: boolean;
  };

  // Global settings
  global: {
    defaultProvider: 'openai' | 'anthropic' | 'local';
    fallbackProvider?: 'openai' | 'anthropic' | 'local';
    timeout: number;
    retries: number;
    enableMetrics: boolean;
    enableLogging: boolean;
  };
}

// Query Types
export type QueryType = 'rag' | 'cypher' | 'sparql' | 'auto';

export interface UnifiedQuery {
  query: string;
  type?: QueryType;
  context?: {
    filePath?: string;
    language?: string;
    codeSelection?: {
      startLine: number;
      endLine: number;
      content: string;
    };
    previousQueries?: string[];
    userPreferences?: Record<string, any>;
  };
  options?: {
    maxResults?: number;
    includeExplanation?: boolean;
    includeQuery?: boolean;
    timeout?: number;
  };
}

export interface UnifiedResponse {
  query: string;
  type: QueryType;
  answer: string;
  confidence: number;
  sources: Array<{
    type: 'code' | 'graph' | 'rdf' | 'documentation';
    content: string;
    score: number;
    metadata?: Record<string, any>;
  }>;
  explanation?: string;
  generatedQuery?: string;
  suggestions?: {
    relatedQueries: string[];
    followUpQuestions: string[];
    optimizations: string[];
  };
  metadata: {
    processingTime: number;
    service: 'rag' | 'cypher' | 'sparql';
    cached: boolean;
    queryId: string;
    timestamp: number;
  };
}

// Service Status Types
export interface ServiceStatus {
  name: string;
  enabled: boolean;
  healthy: boolean;
  lastCheck: Date;
  error?: string;
  metrics?: {
    totalQueries: number;
    successRate: number;
    averageResponseTime: number;
  };
}

export interface Layer3Status {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    rag: ServiceStatus;
    graphCypher: ServiceStatus;
    sparql: ServiceStatus;
  };
  lastUpdated: Date;
}

// Error Types
export type Layer3ErrorCode = 
  | 'SERVICE_UNAVAILABLE'
  | 'INVALID_QUERY_TYPE'
  | 'QUERY_ROUTING_FAILED'
  | 'ALL_SERVICES_FAILED'
  | 'CONFIGURATION_ERROR'
  | 'INITIALIZATION_FAILED'
  | 'TIMEOUT_ERROR'
  | 'RATE_LIMITED'
  | 'INVALID_PARAMETERS';

export class Layer3Error extends Error {
  public readonly code: Layer3ErrorCode;
  public readonly service: string | undefined;
  public readonly query: string | undefined;
  public readonly details?: any;

  constructor(
    code: Layer3ErrorCode,
    message: string,
    options: {
      service?: string;
      query?: string;
      details?: any;
    } = {}
  ) {
    super(message);
    this.name = 'Layer3Error';
    this.code = code;
    this.service = options.service;
    this.query = options.query;
    this.details = options.details;
  }
}

// Metrics Types
export interface Layer3Metrics {
  overall: {
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
    averageResponseTime: number;
    queriesPerSecond: number;
  };
  services: {
    rag: {
      queries: number;
      successRate: number;
      averageResponseTime: number;
      cacheHitRate: number;
    };
    graphCypher: {
      queries: number;
      successRate: number;
      averageResponseTime: number;
      averageConfidence: number;
    };
    sparql: {
      queries: number;
      successRate: number;
      averageResponseTime: number;
      averageConfidence: number;
    };
  };
  routing: {
    autoDetected: number;
    manuallySpecified: number;
    routingAccuracy: number;
    fallbackUsed: number;
  };
  performance: {
    memoryUsage: number;
    cpuUsage: number;
    cacheSize: number;
    activeConnections: number;
  };
}

// Event Types
export interface Layer3Event {
  type: 'query_start' | 'query_complete' | 'query_error' | 'service_status_change' | 'routing_decision';
  timestamp: number;
  queryId?: string;
  service?: string;
  data?: any;
}

// Query Routing Types
export interface QueryRoutingResult {
  selectedService: 'rag' | 'cypher' | 'sparql';
  confidence: number;
  reasoning: string;
  alternatives: Array<{
    service: 'rag' | 'cypher' | 'sparql';
    confidence: number;
    reason: string;
  }>;
}

export interface QueryPattern {
  pattern: RegExp;
  service: 'rag' | 'cypher' | 'sparql';
  confidence: number;
  description: string;
  examples: string[];
}

// Health Check Types
export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  error?: string;
  details?: Record<string, any>;
}

// Configuration Validation Types
export interface ConfigValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
    value?: any;
  }>;
  warnings: Array<{
    path: string;
    message: string;
    value?: any;
  }>;
}