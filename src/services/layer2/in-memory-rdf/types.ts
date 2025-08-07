/**
 * In-Memory RDF Store Types
 * 
 * Defines interfaces and types for high-performance in-memory RDF storage
 * optimized for LLM queries and MCP context retrieval.
 */

// Core RDF Types
export interface RDFTriple {
  subject: string;
  predicate: string;
  object: string | number | boolean | Date;
  graph?: string;
  metadata?: TripleMetadata;
}

export interface TripleMetadata {
  source?: string;
  timestamp?: Date;
  confidence?: number;
  version?: string;
  tags?: string[];
}

export interface RDFQuad extends RDFTriple {
  graph: string;
}

// Query Types
export enum RDFQueryType {
  SPARQL = 'sparql',
  PATTERN = 'pattern',
  GRAPH_TRAVERSAL = 'graph_traversal',
  SEMANTIC_SEARCH = 'semantic_search',
  CONTEXT_RETRIEVAL = 'context_retrieval',
  LLM_CONTEXT = 'llm_context'
}

export interface RDFQueryContext {
  type: RDFQueryType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;
  maxResults?: number;
  includeMetadata?: boolean;
  contextWindow?: number;
  semanticThreshold?: number;
  llmOptimized?: boolean;
}

export interface RDFQueryResult<T = any> {
  data: T;
  bindings?: Record<string, any>[];
  totalResults: number;
  executionTime: number;
  fromCache: boolean;
  contextRelevance?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Index Types
export enum IndexType {
  SPO = 'spo',    // Subject-Predicate-Object
  PSO = 'pso',    // Predicate-Subject-Object
  OSP = 'osp',    // Object-Subject-Predicate
  SOP = 'sop',    // Subject-Object-Predicate
  POS = 'pos',    // Predicate-Object-Subject
  OPS = 'ops',    // Object-Predicate-Subject
  FULL_TEXT = 'full_text',
  SEMANTIC = 'semantic',
  TEMPORAL = 'temporal'
}

export interface RDFIndex {
  type: IndexType;
  size: number;
  lastUpdated: Date;
  hitRate: number;
  buildTime: number;
}

// Storage Configuration
export interface InMemoryRDFConfig {
  maxTriples: number;
  maxMemoryMB: number;
  enabledIndexes: IndexType[];
  compressionEnabled: boolean;
  persistenceEnabled: boolean;
  persistenceFile?: string;
  cacheConfig: {
    maxEntries: number;
    ttl: number;
    evictionPolicy: 'lru' | 'lfu' | 'ttl';
  };
  optimization: {
    enableSemanticSearch: boolean;
    enableContextCaching: boolean;
    enableQueryOptimization: boolean;
    enableParallelProcessing: boolean;
  };
  llmIntegration: {
    contextWindowSize: number;
    maxContextTokens: number;
    semanticSimilarityThreshold: number;
    enableContextRanking: boolean;
    enableTokenOptimization: boolean;
  };
}

// LLM Context Types
export interface LLMContext {
  id: string;
  type: 'module' | 'function' | 'class' | 'relationship' | 'semantic';
  content: string;
  relevanceScore: number;
  tokenCount: number;
  metadata: {
    source: string;
    timestamp: Date;
    version?: string;
    dependencies?: string[];
    tags?: string[];
  };
  embeddings?: number[];
}

export interface LLMContextRequest {
  query: string;
  contextType?: string[];
  maxTokens?: number;
  minRelevance?: number;
  includeRelated?: boolean;
  semanticSearch?: boolean;
  prioritizeRecent?: boolean;
}

export interface LLMContextResponse {
  contexts: LLMContext[];
  totalTokens: number;
  relevanceScores: number[];
  executionTime: number;
  fromCache: boolean;
  metadata: {
    queryHash: string;
    searchStrategy: string;
    indexesUsed: IndexType[];
    totalCandidates: number;
  };
}

// MCP Context Types
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  content: string;
  metadata: {
    source: string;
    lastModified: Date;
    size: number;
    version?: string;
    tags?: string[];
  };
}

export interface MCPContextRequest {
  resourceUri?: string;
  query?: string;
  contextType?: string;
  maxResources?: number;
  includeContent?: boolean;
  filterByTags?: string[];
}

export interface MCPContextResponse {
  resources: MCPResource[];
  totalResources: number;
  executionTime: number;
  fromCache: boolean;
  metadata: {
    searchStrategy: string;
    indexesUsed: IndexType[];
  };
}

// Semantic Search Types
export interface SemanticSearchConfig {
  enabled: boolean;
  embeddingModel?: string;
  similarityThreshold: number;
  maxResults: number;
  enableCaching: boolean;
}

export interface SemanticSearchResult {
  triple: RDFTriple;
  similarity: number;
  context: string[];
  relevanceExplanation?: string;
}

// Performance Metrics
export interface RDFStoreMetrics {
  totalTriples: number;
  totalQuads: number;
  memoryUsageMB: number;
  indexMetrics: Record<IndexType, RDFIndex>;
  queryMetrics: {
    totalQueries: number;
    averageResponseTime: number;
    cacheHitRate: number;
    queryTypeDistribution: Record<RDFQueryType, number>;
  };
  llmMetrics: {
    contextRequests: number;
    averageContextSize: number;
    averageTokenCount: number;
    cacheHitRate: number;
  };
  mcpMetrics: {
    resourceRequests: number;
    averageResourceSize: number;
    cacheHitRate: number;
  };
}

// Store Interface
export interface InMemoryRDFStoreInterface {
  // Basic Operations
  addTriple(triple: RDFTriple): Promise<boolean>;
  addTriples(triples: RDFTriple[]): Promise<number>;
  removeTriple(subject: string, predicate?: string, object?: any): Promise<number>;
  hasTriple(subject: string, predicate: string, object: any): Promise<boolean>;
  
  // Query Operations
  query<T = any>(query: string, context?: RDFQueryContext): Promise<RDFQueryResult<T>>;
  findTriples(pattern: Partial<RDFTriple>, limit?: number): Promise<RDFTriple[]>;
  getSubjects(predicate?: string, object?: any): Promise<string[]>;
  getPredicates(subject?: string, object?: any): Promise<string[]>;
  getObjects(subject?: string, predicate?: string): Promise<any[]>;
  
  // LLM Context Operations
  getLLMContext(request: LLMContextRequest): Promise<LLMContextResponse>;
  buildContextForQuery(query: string, maxTokens?: number): Promise<LLMContext[]>;
  rankContextByRelevance(contexts: LLMContext[], query: string): Promise<LLMContext[]>;
  
  // MCP Operations
  getMCPResources(request: MCPContextRequest): Promise<MCPContextResponse>;
  registerMCPResource(resource: MCPResource): Promise<boolean>;
  updateMCPResource(uri: string, resource: Partial<MCPResource>): Promise<boolean>;
  
  // Semantic Search
  semanticSearch(query: string, limit?: number): Promise<SemanticSearchResult[]>;
  findSimilarTriples(triple: RDFTriple, threshold?: number): Promise<SemanticSearchResult[]>;
  
  // Index Management
  buildIndex(type: IndexType): Promise<void>;
  rebuildAllIndexes(): Promise<void>;
  getIndexStats(): Promise<Record<IndexType, RDFIndex>>;
  
  // Performance and Monitoring
  getMetrics(): Promise<RDFStoreMetrics>;
  clearCache(): Promise<void>;
  optimize(): Promise<void>;
  
  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

// Error Types
export class RDFStoreError extends Error {
  constructor(
    message: string,
    public readonly operation?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RDFStoreError';
  }
}

export class RDFQueryError extends RDFStoreError {
  constructor(
    message: string,
    public readonly query?: string,
    cause?: Error
  ) {
    super(message, 'query', cause);
    this.name = 'RDFQueryError';
  }
}

export class RDFIndexError extends RDFStoreError {
  constructor(
    message: string,
    public readonly indexType?: IndexType,
    cause?: Error
  ) {
    super(message, 'index', cause);
    this.name = 'RDFIndexError';
  }
}

// Default Configuration
export const defaultInMemoryRDFConfig: InMemoryRDFConfig = {
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
  },
  optimization: {
    enableSemanticSearch: true,
    enableContextCaching: true,
    enableQueryOptimization: true,
    enableParallelProcessing: true
  },
  llmIntegration: {
    contextWindowSize: 4096,
    maxContextTokens: 2048,
    semanticSimilarityThreshold: 0.7,
    enableContextRanking: true,
    enableTokenOptimization: true
  }
};