/**
 * SPARQL Query Engine Types
 * 
 * Comprehensive type definitions for natural language to SPARQL translation,
 * RDF knowledge querying, and intelligent query optimization.
 */

// Remove unused import - we'll define our own interfaces

// Core Configuration Types
export interface SPARQLEngineConfig {
  rdf: {
    endpoint?: string;           // SPARQL endpoint URL (optional for in-memory)
    defaultGraph?: string;       // Default graph URI
    timeout?: number;           // Query timeout in milliseconds
    maxResults?: number;        // Maximum results per query
  };
  llm: {
    provider: 'openai' | 'anthropic' | 'local';
    model: string;
    temperature?: number;
    maxTokens?: number;
    apiKey?: string;
    baseURL?: string;
  };
  queryGeneration: {
    maxRetries?: number;        // Maximum generation retries
    timeoutMs?: number;         // Generation timeout
    validateSyntax?: boolean;   // Validate SPARQL syntax
    optimizeQuery?: boolean;    // Apply query optimizations
    usePatterns?: boolean;      // Use pattern-based generation
  };
  prefixes: {
    [prefix: string]: string;   // Namespace prefixes
  };
  response: {
    includeQuery?: boolean;     // Include generated SPARQL
    includeExplanation?: boolean; // Include query explanation
    formatResults?: boolean;    // Format results for readability
    maxResults?: number;        // Limit result count
  };
  caching: {
    enabled?: boolean;          // Enable query caching
    ttl?: number;              // Cache TTL in milliseconds
    maxSize?: number;          // Maximum cache entries
  };
}

// Query Intent Types
export type SPARQLQueryIntent = 
  | 'select'      // SELECT queries - retrieve data
  | 'ask'         // ASK queries - boolean questions
  | 'construct'   // CONSTRUCT queries - build new triples
  | 'describe'    // DESCRIBE queries - describe resources
  | 'count'       // COUNT aggregations
  | 'aggregate'   // Other aggregations (SUM, AVG, etc.)
  | 'filter'      // Filtered queries
  | 'path'        // Property path queries
  | 'union'       // UNION queries
  | 'optional'    // OPTIONAL patterns
  | 'subquery';   // Subqueries

// Entity and Relationship Types
export interface SPARQLEntity {
  type: 'resource' | 'literal' | 'variable' | 'class' | 'property';
  value: string;
  uri?: string;
  datatype?: string;
  language?: string;
  confidence: number;
  context?: string[];
}

export interface SPARQLTriplePattern {
  subject: SPARQLEntity;
  predicate: SPARQLEntity;
  object: SPARQLEntity;
  optional?: boolean;
  filter?: SPARQLFilter;
}

export interface SPARQLFilter {
  type: 'equals' | 'not_equals' | 'greater' | 'less' | 'greater_equal' | 'less_equal' | 
        'contains' | 'starts_with' | 'ends_with' | 'regex' | 'lang' | 'datatype' | 'bound';
  property: string;
  value: any;
  operator?: string;
  modifier?: string;
}

// Query Structure Types
export interface ParsedSPARQLQuery {
  intent: SPARQLQueryIntent;
  entities: SPARQLEntity[];
  triplePatterns: SPARQLTriplePattern[];
  filters: SPARQLFilter[];
  aggregations: SPARQLAggregation[];
  orderBy?: SPARQLOrderBy[];
  groupBy?: string[];
  having?: SPARQLFilter[];
  limit?: number;
  offset?: number;
  distinct?: boolean;
  confidence: number;
}

export interface SPARQLAggregation {
  function: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'GROUP_CONCAT' | 'SAMPLE';
  variable: string;
  alias?: string;
  distinct?: boolean;
  separator?: string;
}

export interface SPARQLOrderBy {
  variable: string;
  direction: 'ASC' | 'DESC';
}

// Generated Query Types
export interface GeneratedSPARQLQuery {
  sparql: string;
  prefixes: { [prefix: string]: string };
  parameters: { [key: string]: any };
  confidence: number;
  explanation: string;
  generationMethod: 'pattern' | 'llm' | 'hybrid';
  optimizations: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

// Execution Types
export interface SPARQLExecutionResult {
  success: boolean;
  data: SPARQLResultRow[];
  bindings?: SPARQLBinding[];
  summary: {
    executionTime: number;
    resultCount: number;
    hasMore?: boolean;
    warnings?: string[];
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface SPARQLResultRow {
  [variable: string]: SPARQLValue;
}

export interface SPARQLValue {
  type: 'uri' | 'literal' | 'bnode';
  value: string;
  datatype?: string;
  language?: string;
  label?: string;
}

export interface SPARQLBinding {
  variable: string;
  value: SPARQLValue;
}

// Response Types
export interface SPARQLQueryResponse {
  originalQuery: string;
  interpretedQuery: ParsedSPARQLQuery;
  generatedSPARQL: GeneratedSPARQLQuery;
  executionResult: SPARQLExecutionResult;
  formattedResponse: string;
  explanation: string;
  suggestions: {
    relatedQueries: string[];
    followUpQuestions: string[];
    optimizations: string[];
    alternativeFormulations: string[];
  };
  metadata: {
    queryId: string;
    timestamp: number;
    processingTime: number;
    cacheHit?: boolean;
  };
}

// Error Types
export type SPARQLErrorCode = 
  | 'QUERY_PARSING_FAILED'
  | 'SPARQL_GENERATION_FAILED'
  | 'SPARQL_SYNTAX_ERROR'
  | 'SPARQL_SEMANTIC_ERROR'
  | 'QUERY_EXECUTION_FAILED'
  | 'QUERY_TIMEOUT'
  | 'ENDPOINT_UNAVAILABLE'
  | 'INVALID_PARAMETERS'
  | 'RATE_LIMITED'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'RESULT_TOO_LARGE'
  | 'UNSUPPORTED_OPERATION';

export class SPARQLError extends Error {
  public readonly code: SPARQLErrorCode;
  public readonly query: string | undefined;
  public readonly sparql: string | undefined;
  public readonly details?: any;

  constructor(
    code: SPARQLErrorCode,
    message: string,
    options: {
      query?: string;
      sparql?: string;
      details?: any;
    } = {}
  ) {
    super(message);
    this.name = 'SPARQLError';
    this.code = code;
    this.query = options.query;
    this.sparql = options.sparql;
    this.details = options.details;
  }
}

// Metrics Types
export interface SPARQLMetrics {
  queries: {
    total: number;
    successful: number;
    failed: number;
    cached: number;
    averageResponseTime: number;
    averageConfidence: number;
  };
  generation: {
    patternBased: number;
    llmBased: number;
    hybrid: number;
    averageGenerationTime: number;
    retryRate: number;
    syntaxErrorRate: number;
  };
  execution: {
    averageExecutionTime: number;
    averageResultCount: number;
    timeoutRate: number;
    errorRate: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  };
}

// Pattern Matching Types
export interface SPARQLQueryPattern {
  id: string;
  name: string;
  description: string;
  intent: SPARQLQueryIntent;
  patterns: string[];
  template: string;
  variables: string[];
  confidence: number;
  examples: string[];
}

// Ontology Types
export interface OntologyInfo {
  classes: OntologyClass[];
  properties: OntologyProperty[];
  individuals: OntologyIndividual[];
  namespaces: { [prefix: string]: string };
}

export interface OntologyClass {
  uri: string;
  label?: string;
  comment?: string;
  subClassOf?: string[];
  instances?: number;
}

export interface OntologyProperty {
  uri: string;
  label?: string;
  comment?: string;
  domain?: string[];
  range?: string[];
  type: 'ObjectProperty' | 'DatatypeProperty' | 'AnnotationProperty';
}

export interface OntologyIndividual {
  uri: string;
  label?: string;
  types: string[];
}

// Query Optimization Types
export interface QueryOptimization {
  type: 'index_hint' | 'join_order' | 'filter_pushdown' | 'limit_early' | 'distinct_optimization';
  description: string;
  impact: 'low' | 'medium' | 'high';
  applicable: boolean;
}

// Cache Types
export interface CacheEntry {
  key: string;
  query: string;
  result: SPARQLQueryResponse;
  timestamp: number;
  ttl: number;
  hits: number;
}

// Event Types
export interface SPARQLQueryEvent {
  type: 'query_start' | 'query_complete' | 'query_error' | 'cache_hit' | 'cache_miss';
  queryId: string;
  query: string;
  timestamp: number;
  duration?: number;
  error?: SPARQLError;
  metadata?: any;
}

// Validation Types
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'syntax' | 'semantic' | 'performance';
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface ValidationWarning {
  type: 'performance' | 'style' | 'compatibility';
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

// All types are already exported above