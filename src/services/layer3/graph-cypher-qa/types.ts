// Types for GraphCypher QA Chain - removed unused imports

export interface CypherQAConfig {
  // Neo4j connection configuration
  neo4j: {
    uri: string;
    user: string;
    password: string;
    database?: string;
  };
  
  // LLM configuration for query generation
  llm: {
    provider: 'openai' | 'anthropic' | 'local';
    model: string;
    temperature: number;
    maxTokens: number;
  };
  
  // Query generation settings
  queryGeneration: {
    maxRetries: number;
    timeoutMs: number;
    validateSyntax: boolean;
    optimizeQuery: boolean;
  };
  
  // Schema introspection settings
  schema: {
    cacheEnabled: boolean;
    cacheTtl: number;
    includeIndexes: boolean;
    includeConstraints: boolean;
    maxNodes: number;
    maxRelationships: number;
  };
  
  // Response formatting
  response: {
    includeQuery: boolean;
    includeExplanation: boolean;
    maxResults: number;
    formatResults: boolean;
  };
}

export interface GraphSchema {
  nodes: Array<{
    label: string;
    properties: Array<{
      name: string;
      type: string;
      required: boolean;
      indexed: boolean;
    }>;
    count: number;
    examples: string[];
  }>;
  relationships: Array<{
    type: string;
    startNode: string;
    endNode: string;
    properties: Array<{
      name: string;
      type: string;
      required: boolean;
    }>;
    count: number;
    examples: string[];
  }>;
  indexes: Array<{
    label: string;
    properties: string[];
    type: 'BTREE' | 'TEXT' | 'POINT' | 'RANGE';
  }>;
  constraints: Array<{
    label: string;
    properties: string[];
    type: 'UNIQUE' | 'NODE_KEY' | 'EXISTS';
  }>;
  statistics: {
    nodeCount: number;
    relationshipCount: number;
    labelCount: number;
    relationshipTypeCount: number;
    propertyKeyCount: number;
  };
}

export interface NaturalLanguageQuery {
  query: string;
  intent: 'find' | 'count' | 'aggregate' | 'path' | 'pattern' | 'update' | 'create' | 'delete';
  entities: Array<{
    type: 'node' | 'relationship' | 'property';
    name: string;
    label?: string;
    confidence: number;
  }>;
  filters: Array<{
    property: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'CONTAINS' | 'STARTS WITH' | 'ENDS WITH' | 'IN';
    value: any;
    confidence: number;
  }>;
  aggregations: Array<{
    function: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COLLECT';
    property?: string;
    alias?: string;
  }>;
  orderBy: Array<{
    property: string;
    direction: 'ASC' | 'DESC';
  }>;
  limit?: number;
  context?: {
    previousQueries: string[];
    userPreferences: Record<string, any>;
    domainKnowledge: string[];
  };
}

export interface CypherQuery {
  cypher: string;
  parameters: Record<string, any>;
  explanation: string;
  confidence: number;
  estimatedComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedCost: number;
  warnings: string[];
  optimizations: string[];
  metadata: {
    generatedAt: Date;
    llmModel: string;
    processingTime: number;
    retryCount: number;
  };
}

export interface QueryResult {
  success: boolean;
  data: any[];
  summary: {
    executionTime: number;
    recordsReturned: number;
    recordsAvailable: number;
    nodesCreated: number;
    nodesDeleted: number;
    relationshipsCreated: number;
    relationshipsDeleted: number;
    propertiesSet: number;
    labelsAdded: number;
    labelsRemoved: number;
    indexesAdded: number;
    indexesRemoved: number;
    constraintsAdded: number;
    constraintsRemoved: number;
  };
  profile?: {
    operatorType: string;
    identifiers: string[];
    arguments: Record<string, any>;
    children: any[];
    dbHits: number;
    rows: number;
    time: number;
  };
  notifications: Array<{
    code: string;
    title: string;
    description: string;
    severity: 'WARNING' | 'INFORMATION';
    position?: {
      offset: number;
      line: number;
      column: number;
    };
  }>;
}

export interface CypherQAResponse {
  originalQuery: string;
  interpretedQuery: NaturalLanguageQuery;
  generatedCypher: CypherQuery;
  executionResult: QueryResult;
  formattedResponse: string;
  explanation: string;
  suggestions: {
    relatedQueries: string[];
    optimizations: string[];
    followUpQuestions: string[];
  };
  metadata: {
    processingTime: number;
    confidence: number;
    cached: boolean;
    schemaVersion: string;
  };
}

export interface QueryPattern {
  id: string;
  name: string;
  description: string;
  pattern: string;
  examples: string[];
  cypherTemplate: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  category: 'BASIC' | 'TRAVERSAL' | 'AGGREGATION' | 'PATTERN_MATCHING' | 'ADVANCED';
}

export interface QueryOptimization {
  type: 'INDEX_HINT' | 'QUERY_REWRITE' | 'PARAMETER_OPTIMIZATION' | 'LIMIT_ADDITION';
  description: string;
  originalQuery: string;
  optimizedQuery: string;
  expectedImprovement: string;
  confidence: number;
}

export interface CypherValidationResult {
  isValid: boolean;
  syntaxErrors: Array<{
    message: string;
    line: number;
    column: number;
    severity: 'ERROR' | 'WARNING';
  }>;
  semanticErrors: Array<{
    message: string;
    type: 'UNKNOWN_LABEL' | 'UNKNOWN_PROPERTY' | 'UNKNOWN_RELATIONSHIP' | 'TYPE_MISMATCH';
    suggestion?: string;
  }>;
  warnings: string[];
  suggestions: string[];
}

export interface CypherQAMetrics {
  queries: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
    averageConfidence: number;
  };
  generation: {
    averageGenerationTime: number;
    retryRate: number;
    syntaxErrorRate: number;
    semanticErrorRate: number;
  };
  execution: {
    averageExecutionTime: number;
    averageRecordsReturned: number;
    timeoutRate: number;
    errorRate: number;
  };
  schema: {
    cacheHitRate: number;
    lastUpdated: Date;
    introspectionTime: number;
  };
  performance: {
    memoryUsage: number;
    cpuUsage: number;
    cacheSize: number;
  };
}

export type CypherQAErrorCode = 
  | 'SCHEMA_INTROSPECTION_FAILED'
  | 'QUERY_GENERATION_FAILED'
  | 'CYPHER_SYNTAX_ERROR'
  | 'CYPHER_SEMANTIC_ERROR'
  | 'QUERY_EXECUTION_FAILED'
  | 'QUERY_TIMEOUT'
  | 'CONNECTION_FAILED'
  | 'INVALID_PARAMETERS'
  | 'RATE_LIMITED'
  | 'INSUFFICIENT_PERMISSIONS';

export interface CypherQAErrorDetails {
  code: CypherQAErrorCode;
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  query?: string;
  cypher?: string;
  context?: any;
}