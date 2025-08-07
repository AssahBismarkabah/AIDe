import { Document } from '@langchain/core/documents';
import { BaseRetriever } from '@langchain/core/retrievers';
import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { VectorStore } from '@langchain/core/vectorstores';
import { Embeddings } from '@langchain/core/embeddings';

export interface RAGConfig {
  // Vector store configuration
  vectorStore: {
    type: 'memory' | 'redis' | 'neo4j';
    dimensions: number;
    similarity: 'cosine' | 'euclidean' | 'dot';
  };
  
  // Retrieval configuration
  retrieval: {
    topK: number;
    scoreThreshold: number;
    maxTokens: number;
    contextWindow: number;
  };
  
  // LLM configuration
  llm: {
    provider: 'openai' | 'anthropic' | 'local';
    model: string;
    temperature: number;
    maxTokens: number;
  };
  
  // Embeddings configuration
  embeddings: {
    provider: 'openai' | 'local';
    model: string;
    dimensions: number;
  };
  
  // Caching configuration
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

export interface CodeContext {
  filePath: string;
  language: string;
  content: string;
  functions: Array<{
    name: string;
    signature: string;
    docstring?: string;
    startLine: number;
    endLine: number;
  }>;
  classes: Array<{
    name: string;
    methods: string[];
    properties: string[];
    startLine: number;
    endLine: number;
  }>;
  imports: Array<{
    module: string;
    items: string[];
    alias?: string;
  }>;
  dependencies: string[];
  metadata: {
    lastModified: Date;
    size: number;
    complexity: number;
    testCoverage?: number;
  };
}

export interface QueryContext {
  query: string;
  intent: 'code_explanation' | 'bug_fix' | 'feature_request' | 'refactoring' | 'testing' | 'documentation';
  scope: 'file' | 'module' | 'project' | 'global';
  language?: string;
  filePath?: string;
  codeSelection?: {
    startLine: number;
    endLine: number;
    content: string;
  };
  previousContext?: string[];
  userPreferences?: {
    verbosity: 'concise' | 'detailed' | 'comprehensive';
    includeExamples: boolean;
    includeReferences: boolean;
  };
}

export interface RAGResponse {
  answer: string;
  sources: Array<{
    document: Document;
    score: number;
    relevance: 'high' | 'medium' | 'low';
    type: 'code' | 'documentation' | 'test' | 'comment';
  }>;
  context: {
    retrievedDocuments: number;
    tokensUsed: number;
    processingTime: number;
    cacheHit: boolean;
  };
  reasoning: {
    steps: string[];
    confidence: number;
    alternatives?: string[];
  };
  suggestions?: {
    followUpQuestions: string[];
    relatedTopics: string[];
    actionItems: string[];
  };
}

export interface DocumentMetadata {
  source: string;
  type: 'code' | 'documentation' | 'test' | 'comment' | 'config';
  language?: string;
  filePath: string;
  lastModified: Date;
  size: number;
  hash: string;
  version?: string;
  tags: string[];
  relationships: Array<{
    type: 'imports' | 'extends' | 'implements' | 'calls' | 'tests';
    target: string;
    confidence: number;
  }>;
}

export interface SemanticSearchResult {
  documents: Document[];
  scores: number[];
  query: string;
  searchTime: number;
  totalResults: number;
  filters?: Record<string, any>;
}

export interface ContextChain {
  id: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    metadata?: Record<string, any>;
  }>;
  context: {
    codeFiles: string[];
    relevantDocs: string[];
    userIntent: string;
    sessionId: string;
  };
  reasoning: {
    chain: string[];
    confidence: number;
    sources: string[];
  };
}

export interface RAGMetrics {
  queries: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
  retrieval: {
    averageDocuments: number;
    averageScore: number;
    cacheHitRate: number;
  };
  llm: {
    tokensUsed: number;
    averageTokensPerQuery: number;
    costEstimate: number;
  };
  performance: {
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  };
}

export type RAGErrorCode =
  | 'RETRIEVAL_FAILED'
  | 'LLM_ERROR'
  | 'CONTEXT_TOO_LARGE'
  | 'INVALID_QUERY'
  | 'RATE_LIMITED'
  | 'INITIALIZATION_FAILED'
  | 'VECTOR_STORE_NOT_INITIALIZED'
  | 'DOCUMENT_ADDITION_FAILED'
  | 'QUERY_FAILED'
  | 'RETRIEVER_NOT_INITIALIZED';

export interface RAGErrorDetails {
  code: RAGErrorCode;
  details: Record<string, any>;
  timestamp: Date;
  query?: string;
  context?: any;
}