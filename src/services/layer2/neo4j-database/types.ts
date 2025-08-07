/**
 * Neo4j Database Integration Types
 * 
 * Comprehensive type definitions for Neo4j database operations,
 * schema management, and TTL file ingestion pipeline.
 */

import { Driver, Session, Transaction, Result, Node, Relationship } from 'neo4j-driver';

// Core Neo4j Connection Types
export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
  maxConnectionPoolSize?: number;
  connectionTimeout?: number;
  maxTransactionRetryTime?: number;
  encrypted?: boolean;
  trust?: 'TRUST_ALL_CERTIFICATES' | 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES';
}

export interface Neo4jConnectionManager {
  connect(config: Neo4jConfig): Promise<Driver>;
  disconnect(): Promise<void>;
  getDriver(): Driver | null;
  isConnected(): boolean;
  testConnection(): Promise<boolean>;
  getSession(database?: string): Session;
  executeTransaction<T>(work: (tx: Transaction) => Promise<T>, database?: string): Promise<T>;
}

// Schema Management Types
export interface GraphSchema {
  nodes: NodeSchema[];
  relationships: RelationshipSchema[];
  constraints: ConstraintDefinition[];
  indexes: IndexDefinition[];
}

export interface NodeSchema {
  label: string;
  properties: PropertyDefinition[];
  requiredProperties: string[];
  uniqueProperties: string[];
}

export interface RelationshipSchema {
  type: string;
  fromLabel: string;
  toLabel: string;
  properties: PropertyDefinition[];
  requiredProperties: string[];
}

export interface PropertyDefinition {
  name: string;
  type: 'string' | 'integer' | 'float' | 'boolean' | 'datetime' | 'array' | 'object';
  required: boolean;
  indexed: boolean;
  unique: boolean;
  description?: string;
}

export interface ConstraintDefinition {
  name: string;
  type: 'UNIQUE' | 'NODE_KEY' | 'EXISTS' | 'ASSERT';
  nodeLabel?: string;
  relationshipType?: string;
  properties: string[];
  description?: string;
}

export interface IndexDefinition {
  name: string;
  type: 'BTREE' | 'FULLTEXT' | 'LOOKUP';
  nodeLabel?: string;
  relationshipType?: string;
  properties: string[];
  description?: string;
}

// TTL Ingestion Pipeline Types
export interface TTLIngestionPipeline {
  ingestTTLFile(filePath: string): Promise<IngestionResult>;
  ingestTTLContent(content: string, sourceFile: string): Promise<IngestionResult>;
  batchIngestTTLFiles(filePaths: string[]): Promise<BatchIngestionResult>;
  validateTTLBeforeIngestion(content: string): Promise<ValidationResult>;
  createNodesFromTriples(triples: RDFTriple[]): Promise<NodeCreationResult>;
  createRelationshipsFromTriples(triples: RDFTriple[]): Promise<RelationshipCreationResult>;
}

export interface RDFTriple {
  subject: string;
  predicate: string;
  object: string;
  objectType: 'uri' | 'literal' | 'blank';
  datatype?: string;
  language?: string;
  sourceFile: string;
  lineNumber?: number;
}

export interface IngestionResult {
  success: boolean;
  sourceFile: string;
  nodesCreated: number;
  relationshipsCreated: number;
  propertiesSet: number;
  errors: IngestionError[];
  warnings: string[];
  processingTime: number;
  cypherQueries: string[];
}

export interface BatchIngestionResult {
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  results: IngestionResult[];
  totalNodesCreated: number;
  totalRelationshipsCreated: number;
  totalProcessingTime: number;
  errors: IngestionError[];
}

export interface IngestionError {
  type: 'PARSING_ERROR' | 'SCHEMA_VIOLATION' | 'CONSTRAINT_VIOLATION' | 'CYPHER_ERROR';
  message: string;
  sourceFile: string;
  lineNumber?: number | undefined;
  triple?: RDFTriple;
  cypherQuery?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
  tripleCount: number;
  nodeCount: number;
  relationshipCount: number;
}

export interface ValidationError {
  type: 'SYNTAX_ERROR' | 'SEMANTIC_ERROR' | 'SCHEMA_ERROR';
  message: string;
  lineNumber?: number;
  column?: number;
}

export interface NodeCreationResult {
  nodesCreated: number;
  nodesByLabel: { [key: string]: number };
  errors: IngestionError[];
  cypherQueries: string[];
}

export interface RelationshipCreationResult {
  relationshipsCreated: number;
  relationshipsByType: { [key: string]: number };
  errors: IngestionError[];
  cypherQueries: string[];
}

// Query Optimization Types
export interface CypherQueryOptimizer {
  optimizeQuery(query: string): Promise<OptimizedQuery>;
  analyzeQueryPerformance(query: string): Promise<QueryPerformance>;
  suggestIndexes(query: string): Promise<IndexSuggestion[]>;
  validateQuery(query: string): Promise<QueryValidation>;
  explainQuery(query: string): Promise<QueryExplanation>;
}

export interface OptimizedQuery {
  originalQuery: string;
  optimizedQuery: string;
  optimizations: QueryOptimization[];
  estimatedImprovement: number;
  warnings: string[];
}

export interface QueryOptimization {
  type: 'INDEX_HINT' | 'REWRITE' | 'PARAMETER_BINDING' | 'PROFILE_GUIDED';
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  before: string;
  after: string;
}

export interface QueryPerformance {
  executionTime: number;
  dbHits: number;
  rows: number;
  memoryUsage: number;
  planningTime: number;
  profile: QueryProfile;
  bottlenecks: PerformanceBottleneck[];
}

export interface QueryProfile {
  operatorType: string;
  identifiers: string[];
  arguments: { [key: string]: any };
  children: QueryProfile[];
  dbHits: number;
  rows: number;
  time: number;
}

export interface PerformanceBottleneck {
  type: 'MISSING_INDEX' | 'CARTESIAN_PRODUCT' | 'LARGE_SCAN' | 'EXPENSIVE_OPERATION';
  description: string;
  suggestion: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface IndexSuggestion {
  type: 'BTREE' | 'FULLTEXT';
  nodeLabel?: string;
  relationshipType?: string;
  properties: string[];
  estimatedImprovement: number;
  cypherCommand: string;
  reasoning: string;
}

export interface QueryValidation {
  valid: boolean;
  errors: QueryError[];
  warnings: string[];
  syntax: SyntaxValidation;
  semantics: SemanticValidation;
}

export interface QueryError {
  type: 'SYNTAX_ERROR' | 'SEMANTIC_ERROR' | 'TYPE_ERROR';
  message: string;
  position?: number;
  suggestion?: string;
}

export interface SyntaxValidation {
  valid: boolean;
  errors: string[];
  parsedQuery?: any;
}

export interface SemanticValidation {
  valid: boolean;
  errors: string[];
  undefinedLabels: string[];
  undefinedProperties: string[];
  undefinedRelationships: string[];
}

export interface QueryExplanation {
  query: string;
  executionPlan: ExecutionPlan;
  estimatedCost: number;
  estimatedRows: number;
  indexUsage: IndexUsage[];
  recommendations: string[];
}

export interface ExecutionPlan {
  operatorType: string;
  cost: number;
  rows: number;
  arguments: { [key: string]: any };
  children: ExecutionPlan[];
}

export interface IndexUsage {
  indexName: string;
  indexType: string;
  properties: string[];
  usage: 'SEEK' | 'SCAN' | 'SKIP';
  selectivity: number;
}

// Caching Types
export interface QueryCache {
  get(queryKey: string): Promise<CachedResult | null>;
  set(queryKey: string, result: any, ttl?: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
  clear(): Promise<void>;
  getStats(): Promise<CacheStats>;
}

export interface CachedResult {
  data: any;
  timestamp: number;
  ttl: number;
  queryHash: string;
  hitCount: number;
}

export interface CacheStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  totalMemoryUsage: number;
  averageQueryTime: number;
}

// APOC Integration Types
export interface APOCProcedures {
  isAvailable(): Promise<boolean>;
  getAvailableProcedures(): Promise<APOCProcedure[]>;
  executePeriodicCommit(query: string, batchSize: number): Promise<Result>;
  loadJson(url: string): Promise<any>;
  loadCsv(url: string, options?: CSVOptions): Promise<any[]>;
  runCypher(query: string, params?: { [key: string]: any }): Promise<Result>;
  createVirtualGraph(nodes: any[], relationships: any[]): Promise<VirtualGraph>;
}

export interface APOCProcedure {
  name: string;
  signature: string;
  description: string;
  mode: 'READ' | 'WRITE' | 'SCHEMA' | 'DBMS';
  deprecated: boolean;
}

export interface CSVOptions {
  sep?: string;
  arrayDelimiter?: string;
  nullValues?: string[];
  mapping?: { [key: string]: string };
}

export interface VirtualGraph {
  nodes: Node[];
  relationships: Relationship[];
  statistics: GraphStatistics;
}

export interface GraphStatistics {
  nodeCount: number;
  relationshipCount: number;
  labelCounts: { [key: string]: number };
  relationshipTypeCounts: { [key: string]: number };
  propertyKeyCounts: { [key: string]: number };
}

// Graph Algorithm Types
export interface GraphAlgorithms {
  pageRank(options: PageRankOptions): Promise<PageRankResult>;
  communityDetection(options: CommunityDetectionOptions): Promise<CommunityDetectionResult>;
  shortestPath(options: ShortestPathOptions): Promise<ShortestPathResult>;
  centralityMeasures(options: CentralityOptions): Promise<CentralityResult>;
  similarityMeasures(options: SimilarityOptions): Promise<SimilarityResult>;
}

export interface PageRankOptions {
  nodeLabel?: string;
  relationshipType?: string;
  dampingFactor?: number;
  maxIterations?: number;
  tolerance?: number;
  writeProperty?: string;
}

export interface PageRankResult {
  nodeCount: number;
  iterations: number;
  dampingFactor: number;
  scores: { [key: string]: number };
  topNodes: Array<{ nodeId: string; score: number }>;
}

export interface CommunityDetectionOptions {
  algorithm: 'LOUVAIN' | 'LABEL_PROPAGATION' | 'WEAKLY_CONNECTED_COMPONENTS';
  nodeLabel?: string;
  relationshipType?: string;
  writeProperty?: string;
  maxIterations?: number;
}

export interface CommunityDetectionResult {
  communityCount: number;
  nodeCount: number;
  communities: { [key: string]: string[] };
  modularity?: number;
  iterations?: number;
}

export interface ShortestPathOptions {
  sourceNode: string;
  targetNode: string;
  relationshipType?: string;
  direction?: 'OUTGOING' | 'INCOMING' | 'BOTH';
  weightProperty?: string;
}

export interface ShortestPathResult {
  path: PathResult;
  distance: number;
  nodeCount: number;
  relationshipCount: number;
}

export interface PathResult {
  nodes: Node[];
  relationships: Relationship[];
  length: number;
}

export interface CentralityOptions {
  algorithm: 'BETWEENNESS' | 'CLOSENESS' | 'DEGREE' | 'EIGENVECTOR';
  nodeLabel?: string;
  relationshipType?: string;
  direction?: 'OUTGOING' | 'INCOMING' | 'BOTH';
  writeProperty?: string;
}

export interface CentralityResult {
  nodeCount: number;
  scores: { [key: string]: number };
  topNodes: Array<{ nodeId: string; score: number }>;
  statistics: CentralityStatistics;
}

export interface CentralityStatistics {
  min: number;
  max: number;
  mean: number;
  standardDeviation: number;
  percentiles: { [key: string]: number };
}

export interface SimilarityOptions {
  algorithm: 'JACCARD' | 'COSINE' | 'PEARSON' | 'EUCLIDEAN';
  nodeLabel?: string;
  relationshipType?: string;
  similarityCutoff?: number;
  topK?: number;
}

export interface SimilarityResult {
  pairCount: number;
  similarities: Array<{
    node1: string;
    node2: string;
    similarity: number;
  }>;
  statistics: SimilarityStatistics;
}

export interface SimilarityStatistics {
  min: number;
  max: number;
  mean: number;
  distribution: { [key: string]: number };
}

// Health Monitoring Types
export interface DatabaseHealth {
  checkHealth(): Promise<HealthStatus>;
  getMetrics(): Promise<DatabaseMetrics>;
  getConstraints(): Promise<ConstraintStatus[]>;
  getIndexes(): Promise<IndexStatus[]>;
  getStorageInfo(): Promise<StorageInfo>;
}

export interface HealthStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  checks: HealthCheck[];
  lastChecked: Date;
  uptime: number;
}

export interface HealthCheck {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  duration: number;
  details?: { [key: string]: any };
}

export interface DatabaseMetrics {
  nodeCount: number;
  relationshipCount: number;
  propertyCount: number;
  labelCounts: { [key: string]: number };
  relationshipTypeCounts: { [key: string]: number };
  storageSize: number;
  memoryUsage: number;
  queryCount: number;
  averageQueryTime: number;
  activeTransactions: number;
}

export interface ConstraintStatus {
  name: string;
  type: string;
  state: 'ONLINE' | 'FAILED' | 'POPULATING';
  nodeLabel?: string;
  relationshipType?: string;
  properties: string[];
  failureMessage?: string;
}

export interface IndexStatus {
  name: string;
  type: string;
  state: 'ONLINE' | 'FAILED' | 'POPULATING';
  nodeLabel?: string;
  relationshipType?: string;
  properties: string[];
  populationPercent?: number;
  failureMessage?: string;
}

export interface StorageInfo {
  totalSize: number;
  usedSize: number;
  freeSize: number;
  nodeStoreSize: number;
  relationshipStoreSize: number;
  propertyStoreSize: number;
  stringStoreSize: number;
  arrayStoreSize: number;
}

// Event Types
export interface DatabaseEvent {
  type: 'CONNECTION' | 'QUERY' | 'TRANSACTION' | 'SCHEMA' | 'ERROR';
  timestamp: Date;
  details: { [key: string]: any };
  severity: 'INFO' | 'WARN' | 'ERROR';
}

export interface DatabaseEventListener {
  onConnection(event: ConnectionEvent): void;
  onQuery(event: QueryEvent): void;
  onTransaction(event: TransactionEvent): void;
  onSchema(event: SchemaEvent): void;
  onError(event: ErrorEvent): void;
}

export interface ConnectionEvent extends DatabaseEvent {
  type: 'CONNECTION';
  action: 'CONNECT' | 'DISCONNECT' | 'RECONNECT';
  database: string;
  user: string;
}

export interface QueryEvent extends DatabaseEvent {
  type: 'QUERY';
  query: string;
  parameters: { [key: string]: any };
  executionTime: number;
  resultCount: number;
  database: string;
}

export interface TransactionEvent extends DatabaseEvent {
  type: 'TRANSACTION';
  action: 'BEGIN' | 'COMMIT' | 'ROLLBACK';
  transactionId: string;
  database: string;
  duration?: number;
}

export interface SchemaEvent extends DatabaseEvent {
  type: 'SCHEMA';
  action: 'CREATE' | 'DROP' | 'ALTER';
  objectType: 'CONSTRAINT' | 'INDEX' | 'NODE' | 'RELATIONSHIP';
  objectName: string;
  database: string;
}

export interface ErrorEvent extends DatabaseEvent {
  type: 'ERROR';
  error: Error;
  query?: string;
  database?: string;
  context: { [key: string]: any };
}