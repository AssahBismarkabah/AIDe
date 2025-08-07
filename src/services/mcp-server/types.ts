/**
 * MCP Server Types
 * 
 * Type definitions for Model Context Protocol server that provides
 * rich codebase context to IDE LLMs using TTL files and knowledge graphs.
 */

import { Layer3Config } from '../layer3/types';

// MCP Server Configuration
export interface MCPServerConfig {
  // Server settings
  server: {
    name: string;
    version: string;
    port: number;
    host: string;
    maxConnections: number;
    timeout: number;
  };

  // Context settings
  context: {
    maxTokens: number;
    maxFiles: number;
    relevanceThreshold: number;
    cacheEnabled: boolean;
    cacheTtl: number;
  };

  // TTL file settings
  ttl: {
    watchEnabled: boolean;
    watchDebounce: number;
    maxFileSize: number;
    encoding: string;
  };

  // Integration settings
  integration: {
    layer3Config: Layer3Config;
    neo4jEnabled: boolean;
    rdfStoreEnabled: boolean;
    hybridStorageEnabled: boolean;
  };

  // IDE-specific settings
  ide: {
    vscode: {
      enabled: boolean;
      extensionId: string;
      contextWindow: number;
    };
    intellij: {
      enabled: boolean;
      pluginId: string;
      contextWindow: number;
    };
  };
}

// MCP Protocol Types
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

// Context Types
export interface ContextRequest {
  filePath: string;
  cursorPosition: {
    line: number;
    column: number;
  };
  selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
    text: string;
  };
  query?: string;
  intent?: 'explanation' | 'completion' | 'refactoring' | 'debugging' | 'documentation';
  maxTokens?: number;
  includeRelated?: boolean;
}

export interface ContextResponse {
  context: string;
  sources: ContextSource[];
  metadata: {
    totalTokens: number;
    processingTime: number;
    relevanceScore: number;
    cached: boolean;
  };
  suggestions?: {
    relatedFiles: string[];
    followUpQueries: string[];
    improvements: string[];
  };
}

export interface ContextSource {
  type: 'ttl' | 'graph' | 'code' | 'documentation';
  path: string;
  content: string;
  relevanceScore: number;
  metadata: {
    lastModified: Date;
    size: number;
    language?: string;
    module?: string;
  };
}

// TTL File Types
export interface TTLFile {
  path: string;
  content: string;
  lastModified: Date;
  size: number;
  hash: string;
  parsed: {
    triples: TTLTriple[];
    prefixes: { [prefix: string]: string };
    classes: string[];
    properties: string[];
    individuals: string[];
  };
  metadata: {
    module: string;
    language: string;
    dependencies: string[];
    businessContext: string[];
  };
}

export interface TTLTriple {
  subject: string;
  predicate: string;
  object: string;
  type: 'resource' | 'literal';
  datatype?: string;
  language?: string;
}

// Context Selection Types
export interface ContextSelector {
  filePath: string;
  cursorPosition: { line: number; column: number };
  query?: string;
  intent?: string;
}

export interface ContextSelectionResult {
  selectedFiles: string[];
  relevanceScores: { [filePath: string]: number };
  reasoning: string;
  alternatives: Array<{
    files: string[];
    score: number;
    reason: string;
  }>;
}

// Tool Types (MCP Tools)
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: { [key: string]: any };
    required?: string[];
  };
}

export interface MCPToolCall {
  name: string;
  arguments: { [key: string]: any };
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// Resource Types (MCP Resources)
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourceContent {
  uri: string;
  mimeType: string;
  text?: string;
  blob?: string;
}

// Server Status Types
export interface MCPServerStatus {
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  uptime: number;
  connections: number;
  lastError?: string;
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    contextCacheHits: number;
    contextCacheMisses: number;
  };
}

// Event Types
export interface MCPServerEvent {
  type: 'connection' | 'disconnection' | 'request' | 'response' | 'error' | 'context_update';
  timestamp: number;
  data: any;
  clientId?: string;
}

// Client Types
export interface MCPClient {
  id: string;
  name: string;
  version: string;
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    logging?: boolean;
  };
  connected: Date;
  lastActivity: Date;
}

// Cache Types
export interface ContextCache {
  key: string;
  context: ContextResponse;
  timestamp: number;
  ttl: number;
  hits: number;
}

// File Watcher Types
export interface FileWatchEvent {
  type: 'created' | 'modified' | 'deleted' | 'renamed';
  path: string;
  oldPath?: string;
  timestamp: number;
}

// Error Types
export type MCPServerErrorCode = 
  | 'INVALID_REQUEST'
  | 'METHOD_NOT_FOUND'
  | 'INVALID_PARAMS'
  | 'INTERNAL_ERROR'
  | 'CONTEXT_GENERATION_FAILED'
  | 'TTL_PARSING_FAILED'
  | 'FILE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE';

export class MCPServerError extends Error {
  public readonly code: MCPServerErrorCode;
  public readonly data?: any;

  constructor(code: MCPServerErrorCode, message: string, data?: any) {
    super(message);
    this.name = 'MCPServerError';
    this.code = code;
    this.data = data;
  }
}

// Metrics Types
export interface MCPServerMetrics {
  server: {
    uptime: number;
    connections: number;
    totalRequests: number;
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
  };
  context: {
    totalContextRequests: number;
    averageContextSize: number;
    cacheHitRate: number;
    averageRelevanceScore: number;
    ttlFilesWatched: number;
    ttlFilesLoaded: number;
  };
  performance: {
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    networkBytesIn: number;
    networkBytesOut: number;
  };
}

// Configuration Validation Types
export interface MCPConfigValidation {
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