/**
 * Neo4j Database Service
 * 
 * Comprehensive Neo4j database integration service providing connection management,
 * schema operations, TTL file ingestion, query optimization, and health monitoring.
 */

import neo4j, { Driver, Session, Transaction } from 'neo4j-driver';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';

import {
  Neo4jConfig,
  Neo4jConnectionManager,
  TTLIngestionPipeline,
  RDFTriple,
  IngestionResult,
  BatchIngestionResult,
  ValidationResult,
  NodeCreationResult,
  RelationshipCreationResult,
  CypherQueryOptimizer,
  OptimizedQuery,
  QueryPerformance,
  IndexSuggestion,
  QueryValidation,
  QueryExplanation,
  CacheStats,
  DatabaseHealth,
  HealthStatus,
  DatabaseMetrics,
  DatabaseEventListener,
  DatabaseEvent,
  IngestionError,
  ValidationError
} from './types';

/**
 * Main Neo4j Database Service
 * Orchestrates all Neo4j operations including connection management,
 * schema operations, TTL ingestion, and query optimization.
 */
export class Neo4jDatabaseService extends EventEmitter implements 
  Neo4jConnectionManager, 
  TTLIngestionPipeline, 
  CypherQueryOptimizer,
  DatabaseHealth {

  private driver: Driver | null = null;
  private config: Neo4jConfig | null = null;
  private cacheStats: CacheStats = {
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    hitRate: 0,
    totalMemoryUsage: 0,
    averageQueryTime: 0
  };
  private eventListeners: DatabaseEventListener[] = [];

  constructor() {
    super();
    this.setupEventHandlers();
  }

  // Connection Management Implementation
  async connect(config: Neo4jConfig): Promise<Driver> {
    try {
      this.config = config;
      
      const auth = neo4j.auth.basic(config.username, config.password);
      
      this.driver = neo4j.driver(config.uri, auth, {
        maxConnectionPoolSize: config.maxConnectionPoolSize || 50,
        connectionTimeout: config.connectionTimeout || 30000,
        maxTransactionRetryTime: config.maxTransactionRetryTime || 30000,
        encrypted: config.encrypted !== false,
        trust: config.trust || 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES'
      });

      await this.testConnection();
      
      this.emitEvent({
        type: 'CONNECTION',
        timestamp: new Date(),
        details: { action: 'CONNECT', database: config.database || 'neo4j', user: config.username },
        severity: 'INFO'
      });

      return this.driver;
    } catch (error) {
      this.emitError(error as Error, 'Failed to connect to Neo4j database');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      
      this.emitEvent({
        type: 'CONNECTION',
        timestamp: new Date(),
        details: { action: 'DISCONNECT', database: this.config?.database || 'neo4j', user: this.config?.username || 'unknown' },
        severity: 'INFO'
      });
    }
  }

  getDriver(): Driver | null {
    return this.driver;
  }

  isConnected(): boolean {
    return this.driver !== null;
  }

  async testConnection(): Promise<boolean> {
    if (!this.driver) {
      return false;
    }

    try {
      const session = this.driver.session();
      const result = await session.run('RETURN 1 as test');
      await session.close();
      return result.records.length > 0;
    } catch (error) {
      this.emitError(error as Error, 'Connection test failed');
      return false;
    }
  }

  getSession(database?: string): Session {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized. Call connect() first.');
    }
    
    return this.driver.session({ 
      database: database || this.config?.database || 'neo4j' 
    });
  }

  async executeTransaction<T>(
    work: (tx: Transaction) => Promise<T>, 
    database?: string
  ): Promise<T> {
    const session = this.getSession(database);
    
    try {
      const startTime = Date.now();
      const result = await session.executeWrite(work as any) as T;
      const executionTime = Date.now() - startTime;
      
      this.emitEvent({
        type: 'TRANSACTION',
        timestamp: new Date(),
        details: { action: 'COMMIT', database: database || this.config?.database || 'neo4j', duration: executionTime },
        severity: 'INFO'
      });
      
      return result;
    } catch (error) {
      this.emitEvent({
        type: 'TRANSACTION',
        timestamp: new Date(),
        details: { action: 'ROLLBACK', database: database || this.config?.database || 'neo4j' },
        severity: 'ERROR'
      });
      throw error;
    } finally {
      await session.close();
    }
  }

  // TTL Ingestion Pipeline Implementation
  async ingestTTLFile(filePath: string): Promise<IngestionResult> {
    const startTime = Date.now();
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return await this.ingestTTLContent(content, filePath);
    } catch (error) {
      return {
        success: false,
        sourceFile: filePath,
        nodesCreated: 0,
        relationshipsCreated: 0,
        propertiesSet: 0,
        errors: [{
          type: 'PARSING_ERROR',
          message: `Failed to read TTL file: ${(error as Error).message}`,
          sourceFile: filePath
        }],
        warnings: [],
        processingTime: Date.now() - startTime,
        cypherQueries: []
      };
    }
  }

  async ingestTTLContent(content: string, sourceFile: string): Promise<IngestionResult> {
    const startTime = Date.now();
    const result: IngestionResult = {
      success: false,
      sourceFile,
      nodesCreated: 0,
      relationshipsCreated: 0,
      propertiesSet: 0,
      errors: [],
      warnings: [],
      processingTime: 0,
      cypherQueries: []
    };

    try {
      // Validate TTL content before ingestion
      const validation = await this.validateTTLBeforeIngestion(content);
      if (!validation.valid) {
        result.errors = validation.errors.map(err => ({
          type: 'PARSING_ERROR' as const,
          message: err.message,
          sourceFile,
          lineNumber: err.lineNumber
        }));
        result.processingTime = Date.now() - startTime;
        return result;
      }

      // Parse TTL content into RDF triples
      const triples = this.parseTTLContent(content, sourceFile);
      
      // Create nodes from triples
      const nodeResult = await this.createNodesFromTriples(triples);
      result.nodesCreated = nodeResult.nodesCreated;
      result.cypherQueries.push(...nodeResult.cypherQueries);
      result.errors.push(...nodeResult.errors);

      // Create relationships from triples
      const relationshipResult = await this.createRelationshipsFromTriples(triples);
      result.relationshipsCreated = relationshipResult.relationshipsCreated;
      result.cypherQueries.push(...relationshipResult.cypherQueries);
      result.errors.push(...relationshipResult.errors);

      // Calculate properties set
      result.propertiesSet = triples.filter(t => t.objectType === 'literal').length;

      result.success = result.errors.length === 0;
      result.processingTime = Date.now() - startTime;

      return result;
    } catch (error) {
      result.errors.push({
        type: 'PARSING_ERROR',
        message: `TTL ingestion failed: ${(error as Error).message}`,
        sourceFile
      });
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  async batchIngestTTLFiles(filePaths: string[]): Promise<BatchIngestionResult> {
    const startTime = Date.now();
    const results: IngestionResult[] = [];
    const errors: IngestionError[] = [];

    for (const filePath of filePaths) {
      try {
        const result = await this.ingestTTLFile(filePath);
        results.push(result);
        if (!result.success) {
          errors.push(...result.errors);
        }
      } catch (error) {
        errors.push({
          type: 'PARSING_ERROR',
          message: `Batch ingestion failed for ${filePath}: ${(error as Error).message}`,
          sourceFile: filePath
        });
      }
    }

    const successfulFiles = results.filter(r => r.success).length;
    const totalNodesCreated = results.reduce((sum, r) => sum + r.nodesCreated, 0);
    const totalRelationshipsCreated = results.reduce((sum, r) => sum + r.relationshipsCreated, 0);

    return {
      totalFiles: filePaths.length,
      successfulFiles,
      failedFiles: filePaths.length - successfulFiles,
      results,
      totalNodesCreated,
      totalRelationshipsCreated,
      totalProcessingTime: Date.now() - startTime,
      errors
    };
  }

  async validateTTLBeforeIngestion(content: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    
    try {
      // Basic TTL syntax validation
      const lines = content.split('\n');
      let tripleCount = 0;
      let nodeCount = 0;
      let relationshipCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines and comments
        if (!line || line.startsWith('#')) continue;
        
        // Basic triple pattern validation
        if (line.includes(' ') && (line.endsWith('.') || line.endsWith(';'))) {
          tripleCount++;
          
          // Count potential nodes and relationships
          if (line.includes('a ') || line.includes('rdf:type')) {
            nodeCount++;
          } else if (line.includes(':') && !line.includes('rdf:type')) {
            relationshipCount++;
          }
        } else if (line.length > 0) {
          errors.push({
            type: 'SYNTAX_ERROR',
            message: `Invalid TTL syntax: ${line}`,
            lineNumber: i + 1
          });
        }
      }

      // Validation warnings
      if (tripleCount === 0) {
        warnings.push('No valid triples found in TTL content');
      }
      
      if (nodeCount === 0) {
        warnings.push('No node definitions found in TTL content');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        tripleCount,
        nodeCount,
        relationshipCount
      };
    } catch (error) {
      errors.push({
        type: 'SYNTAX_ERROR',
        message: `TTL validation failed: ${(error as Error).message}`
      });
      
      return {
        valid: false,
        errors,
        warnings,
        tripleCount: 0,
        nodeCount: 0,
        relationshipCount: 0
      };
    }
  }

  async createNodesFromTriples(triples: RDFTriple[]): Promise<NodeCreationResult> {
    const nodesByLabel: { [key: string]: number } = {};
    const errors: IngestionError[] = [];
    const cypherQueries: string[] = [];
    let nodesCreated = 0;

    try {
      // Group triples by subject to create nodes
      const nodeTriples = triples.filter(t => 
        t.predicate === 'rdf:type' || t.predicate === 'a'
      );

      for (const triple of nodeTriples) {
        try {
          const nodeId = this.extractNodeId(triple.subject);
          const nodeLabel = this.extractNodeLabel(triple.object);
          
          const cypherQuery = `
            MERGE (n:${nodeLabel} {id: $nodeId})
            SET n.sourceFile = $sourceFile,
                n.lastUpdated = datetime()
            RETURN n
          `;
          
          const session = this.getSession();
          const result = await session.run(cypherQuery, {
            nodeId,
            sourceFile: triple.sourceFile
          });
          await session.close();

          if (result.records.length > 0) {
            nodesCreated++;
            nodesByLabel[nodeLabel] = (nodesByLabel[nodeLabel] || 0) + 1;
            cypherQueries.push(cypherQuery);
          }
        } catch (error) {
          errors.push({
            type: 'CYPHER_ERROR' as const,
            message: `Failed to create node: ${(error as Error).message}`,
            sourceFile: triple.sourceFile,
            triple,
            lineNumber: triple.lineNumber
          });
        }
      }

      return {
        nodesCreated,
        nodesByLabel,
        errors,
        cypherQueries
      };
    } catch (error) {
      errors.push({
        type: 'CYPHER_ERROR',
        message: `Node creation failed: ${(error as Error).message}`,
        sourceFile: triples[0]?.sourceFile || 'unknown'
      });
      
      return {
        nodesCreated: 0,
        nodesByLabel: {},
        errors,
        cypherQueries: []
      };
    }
  }

  async createRelationshipsFromTriples(triples: RDFTriple[]): Promise<RelationshipCreationResult> {
    const relationshipsByType: { [key: string]: number } = {};
    const errors: IngestionError[] = [];
    const cypherQueries: string[] = [];
    let relationshipsCreated = 0;

    try {
      // Filter relationship triples (not type declarations)
      const relationshipTriples = triples.filter(t => 
        t.predicate !== 'rdf:type' && t.predicate !== 'a' && t.objectType === 'uri'
      );

      for (const triple of relationshipTriples) {
        try {
          const sourceId = this.extractNodeId(triple.subject);
          const targetId = this.extractNodeId(triple.object);
          const relationshipType = this.extractRelationshipType(triple.predicate);
          
          const cypherQuery = `
            MATCH (source {id: $sourceId})
            MATCH (target {id: $targetId})
            MERGE (source)-[r:${relationshipType}]->(target)
            SET r.sourceFile = $sourceFile,
                r.lastUpdated = datetime()
            RETURN r
          `;
          
          const session = this.getSession();
          const result = await session.run(cypherQuery, {
            sourceId,
            targetId,
            sourceFile: triple.sourceFile
          });
          await session.close();

          if (result.records.length > 0) {
            relationshipsCreated++;
            relationshipsByType[relationshipType] = (relationshipsByType[relationshipType] || 0) + 1;
            cypherQueries.push(cypherQuery);
          }
        } catch (error) {
          errors.push({
            type: 'CYPHER_ERROR' as const,
            message: `Failed to create relationship: ${(error as Error).message}`,
            sourceFile: triple.sourceFile,
            triple,
            lineNumber: triple.lineNumber
          });
        }
      }

      return {
        relationshipsCreated,
        relationshipsByType,
        errors,
        cypherQueries
      };
    } catch (error) {
      errors.push({
        type: 'CYPHER_ERROR',
        message: `Relationship creation failed: ${(error as Error).message}`,
        sourceFile: triples[0]?.sourceFile || 'unknown'
      });
      
      return {
        relationshipsCreated: 0,
        relationshipsByType: {},
        errors,
        cypherQueries: []
      };
    }
  }

  // Query Optimization Implementation
  async optimizeQuery(query: string): Promise<OptimizedQuery> {
    const originalQuery = query;
    let optimizedQuery = query;
    const optimizations: any[] = [];
    let estimatedImprovement = 0;
    const warnings: string[] = [];

    try {
      // Basic query optimizations
      
      // 1. Add index hints for common patterns
      if (query.includes('WHERE') && query.includes('=')) {
        const indexHint = this.suggestIndexHints(query);
        if (indexHint) {
          optimizedQuery = indexHint.optimizedQuery;
          optimizations.push({
            type: 'INDEX_HINT',
            description: 'Added index hint for property lookup',
            impact: 'HIGH',
            before: query,
            after: optimizedQuery
          });
          estimatedImprovement += 30;
        }
      }

      // 2. Parameter binding optimization
      if (query.includes("'") || query.includes('"')) {
        const parameterized = this.parameterizeQuery(query);
        if (parameterized.hasChanges) {
          optimizedQuery = parameterized.query;
          optimizations.push({
            type: 'PARAMETER_BINDING',
            description: 'Converted literals to parameters',
            impact: 'MEDIUM',
            before: query,
            after: optimizedQuery
          });
          estimatedImprovement += 15;
        }
      }

      // 3. Query rewrite optimizations
      if (query.toLowerCase().includes('optional match')) {
        warnings.push('OPTIONAL MATCH can be expensive. Consider using WHERE EXISTS() pattern.');
      }

      if (query.toLowerCase().includes('collect(')) {
        warnings.push('COLLECT() operations can consume significant memory for large result sets.');
      }

      return {
        originalQuery,
        optimizedQuery,
        optimizations,
        estimatedImprovement,
        warnings
      };
    } catch (error) {
      warnings.push(`Query optimization failed: ${(error as Error).message}`);
      return {
        originalQuery,
        optimizedQuery: originalQuery,
        optimizations: [],
        estimatedImprovement: 0,
        warnings
      };
    }
  }

  async analyzeQueryPerformance(query: string): Promise<QueryPerformance> {
    try {
      const session = this.getSession();
      const startTime = Date.now();
      
      // Execute query with profiling
      const result = await session.run(`PROFILE ${query}`);
      const executionTime = Date.now() - startTime;
      
      await session.close();

      // Extract performance metrics from profile
      const profile = result.summary.profile;
      const plan = result.summary.plan;

      return {
        executionTime,
        dbHits: (profile as any)?.dbHits || 0,
        rows: result.records.length,
        memoryUsage: 0, // Neo4j doesn't directly expose memory usage
        planningTime: 0, // Would need to be calculated separately
        profile: this.convertProfileToQueryProfile(profile),
        bottlenecks: this.identifyBottlenecks(profile, plan)
      };
    } catch (error) {
      throw new Error(`Query performance analysis failed: ${(error as Error).message}`);
    }
  }

  async suggestIndexes(query: string): Promise<IndexSuggestion[]> {
    const suggestions: IndexSuggestion[] = [];
    
    try {
      // Analyze query for potential index opportunities
      const patterns = this.extractQueryPatterns(query);
      
      for (const pattern of patterns) {
        if (pattern.type === 'property_lookup') {
          suggestions.push({
            type: 'BTREE',
            nodeLabel: pattern.label,
            properties: [pattern.property],
            estimatedImprovement: 50,
            cypherCommand: `CREATE INDEX ${pattern.label}_${pattern.property}_idx FOR (n:${pattern.label}) ON (n.${pattern.property})`,
            reasoning: `Property lookup on ${pattern.label}.${pattern.property} would benefit from an index`
          });
        }
        
        if (pattern.type === 'text_search') {
          suggestions.push({
            type: 'FULLTEXT',
            nodeLabel: pattern.label,
            properties: [pattern.property],
            estimatedImprovement: 70,
            cypherCommand: `CREATE FULLTEXT INDEX ${pattern.label}_${pattern.property}_fulltext FOR (n:${pattern.label}) ON EACH [n.${pattern.property}]`,
            reasoning: `Text search on ${pattern.label}.${pattern.property} would benefit from a fulltext index`
          });
        }
      }

      return suggestions;
    } catch (error) {
      throw new Error(`Index suggestion failed: ${(error as Error).message}`);
    }
  }

  async validateQuery(query: string): Promise<QueryValidation> {
    const errors: any[] = [];
    const warnings: string[] = [];
    
    try {
      // Basic syntax validation
      const syntaxValidation = this.validateQuerySyntax(query);
      
      // Semantic validation
      const semanticValidation = await this.validateQuerySemantics(query);
      
      return {
        valid: syntaxValidation.valid && semanticValidation.valid,
        errors: [...syntaxValidation.errors, ...semanticValidation.errors],
        warnings,
        syntax: syntaxValidation,
        semantics: semanticValidation
      };
    } catch (error) {
      errors.push({
        type: 'SYNTAX_ERROR',
        message: `Query validation failed: ${(error as Error).message}`
      });
      
      return {
        valid: false,
        errors,
        warnings,
        syntax: { valid: false, errors: [(error as Error).message] },
        semantics: { valid: false, errors: [], undefinedLabels: [], undefinedProperties: [], undefinedRelationships: [] }
      };
    }
  }

  async explainQuery(query: string): Promise<QueryExplanation> {
    try {
      const session = this.getSession();
      const result = await session.run(`EXPLAIN ${query}`);
      await session.close();

      const plan = result.summary.plan;
      
      return {
        query,
        executionPlan: this.convertPlanToExecutionPlan(plan),
        estimatedCost: (plan as any)?.arguments?.EstimatedRows || 0,
        estimatedRows: (plan as any)?.arguments?.EstimatedRows || 0,
        indexUsage: this.extractIndexUsage(plan),
        recommendations: this.generateQueryRecommendations(plan)
      };
    } catch (error) {
      throw new Error(`Query explanation failed: ${(error as Error).message}`);
    }
  }

  // Health Monitoring Implementation
  async checkHealth(): Promise<HealthStatus> {
    const checks: any[] = [];
    const startTime = Date.now();
    
    try {
      // Connection health check
      const connectionCheck = await this.checkConnectionHealth();
      checks.push(connectionCheck);
      
      // Database health check
      const databaseCheck = await this.checkDatabaseHealth();
      checks.push(databaseCheck);
      
      // Schema health check
      const schemaCheck = await this.checkSchemaHealth();
      checks.push(schemaCheck);
      
      // Performance health check
      const performanceCheck = await this.checkPerformanceHealth();
      checks.push(performanceCheck);

      const failedChecks = checks.filter(c => c.status === 'FAIL');
      const warnChecks = checks.filter(c => c.status === 'WARN');
      
      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
      if (failedChecks.length > 0) {
        status = 'UNHEALTHY';
      } else if (warnChecks.length > 0) {
        status = 'DEGRADED';
      } else {
        status = 'HEALTHY';
      }

      return {
        status,
        checks,
        lastChecked: new Date(),
        uptime: Date.now() - startTime
      };
    } catch (error) {
      checks.push({
        name: 'health_check_error',
        status: 'FAIL',
        message: `Health check failed: ${(error as Error).message}`,
        duration: Date.now() - startTime
      });
      
      return {
        status: 'UNHEALTHY',
        checks,
        lastChecked: new Date(),
        uptime: 0
      };
    }
  }

  async getMetrics(): Promise<DatabaseMetrics> {
    try {
      const session = this.getSession();
      
      // Get node count
      const nodeCountResult = await session.run('MATCH (n) RETURN count(n) as nodeCount');
      const nodeCount = nodeCountResult.records[0]?.get('nodeCount')?.toNumber() || 0;
      
      // Get relationship count
      const relCountResult = await session.run('MATCH ()-[r]->() RETURN count(r) as relCount');
      const relationshipCount = relCountResult.records[0]?.get('relCount')?.toNumber() || 0;
      
      // Get label counts
      const labelCountsResult = await session.run('CALL db.labels() YIELD label MATCH (n) WHERE label IN labels(n) RETURN label, count(n) as count');
      const labelCounts: { [key: string]: number } = {};
      labelCountsResult.records.forEach(record => {
        labelCounts[record.get('label')] = record.get('count').toNumber();
      });
      
      // Get relationship type counts
      const relTypeCountsResult = await session.run('CALL db.relationshipTypes() YIELD relationshipType MATCH ()-[r]->() WHERE type(r) = relationshipType RETURN relationshipType, count(r) as count');
      const relationshipTypeCounts: { [key: string]: number } = {};
      relTypeCountsResult.records.forEach(record => {
        relationshipTypeCounts[record.get('relationshipType')] = record.get('count').toNumber();
      });

      await session.close();

      return {
        nodeCount,
        relationshipCount,
        propertyCount: 0, // Would need additional query
        labelCounts,
        relationshipTypeCounts,
        storageSize: 0, // Would need APOC or system queries
        memoryUsage: 0, // Would need system queries
        queryCount: this.cacheStats.totalQueries,
        averageQueryTime: this.cacheStats.averageQueryTime,
        activeTransactions: 0 // Would need system queries
      };
    } catch (error) {
      throw new Error(`Failed to get database metrics: ${(error as Error).message}`);
    }
  }

  async getConstraints(): Promise<any[]> {
    try {
      const session = this.getSession();
      const result = await session.run('SHOW CONSTRAINTS');
      await session.close();
      
      return result.records.map(record => ({
        name: record.get('name'),
        type: record.get('type'),
        state: record.get('state'),
        nodeLabel: record.get('labelsOrTypes')?.[0],
        properties: record.get('properties') || [],
        failureMessage: record.get('failureMessage')
      }));
    } catch (error) {
      throw new Error(`Failed to get constraints: ${(error as Error).message}`);
    }
  }

  async getIndexes(): Promise<any[]> {
    try {
      const session = this.getSession();
      const result = await session.run('SHOW INDEXES');
      await session.close();
      
      return result.records.map(record => ({
        name: record.get('name'),
        type: record.get('type'),
        state: record.get('state'),
        nodeLabel: record.get('labelsOrTypes')?.[0],
        properties: record.get('properties') || [],
        populationPercent: record.get('populationPercent'),
        failureMessage: record.get('failureMessage')
      }));
    } catch (error) {
      throw new Error(`Failed to get indexes: ${(error as Error).message}`);
    }
  }

  async getStorageInfo(): Promise<any> {
    try {
      const session = this.getSession();
      
      // Get database storage information using system procedures
      const storageResult = await session.run(`
        CALL dbms.queryJmx("org.neo4j:instance=kernel#0,name=Store file sizes")
        YIELD attributes
        RETURN attributes
      `);
      
      let storageInfo = {
        totalSize: 0,
        usedSize: 0,
        freeSize: 0,
        nodeStoreSize: 0,
        relationshipStoreSize: 0,
        propertyStoreSize: 0,
        stringStoreSize: 0,
        arrayStoreSize: 0
      };

      if (storageResult.records.length > 0) {
        const attributes = storageResult.records[0].get('attributes');
        
        // Extract storage sizes from JMX attributes
        storageInfo.nodeStoreSize = this.extractStorageSize(attributes, 'NodeStoreSize');
        storageInfo.relationshipStoreSize = this.extractStorageSize(attributes, 'RelationshipStoreSize');
        storageInfo.propertyStoreSize = this.extractStorageSize(attributes, 'PropertyStoreSize');
        storageInfo.stringStoreSize = this.extractStorageSize(attributes, 'StringStoreSize');
        storageInfo.arrayStoreSize = this.extractStorageSize(attributes, 'ArrayStoreSize');
        
        storageInfo.usedSize = storageInfo.nodeStoreSize + storageInfo.relationshipStoreSize +
                              storageInfo.propertyStoreSize + storageInfo.stringStoreSize +
                              storageInfo.arrayStoreSize;
      }

      // Get total database size using alternative approach if JMX fails
      if (storageInfo.usedSize === 0) {
        try {
          const sizeResult = await session.run(`
            CALL apoc.monitor.store() YIELD totalStoreSize, usedStoreSize
            RETURN totalStoreSize, usedStoreSize
          `);
          
          if (sizeResult.records.length > 0) {
            const record = sizeResult.records[0];
            storageInfo.totalSize = record.get('totalStoreSize') || 0;
            storageInfo.usedSize = record.get('usedStoreSize') || 0;
            storageInfo.freeSize = storageInfo.totalSize - storageInfo.usedSize;
          }
        } catch (apocError) {
          // APOC not available, use basic estimation
          const countResult = await session.run(`
            MATCH (n)
            OPTIONAL MATCH (n)-[r]->()
            RETURN count(DISTINCT n) as nodeCount, count(r) as relCount
          `);
          
          if (countResult.records.length > 0) {
            const nodeCount = countResult.records[0].get('nodeCount').toNumber();
            const relCount = countResult.records[0].get('relCount').toNumber();
            
            // Rough estimation: 100 bytes per node, 50 bytes per relationship
            storageInfo.nodeStoreSize = nodeCount * 100;
            storageInfo.relationshipStoreSize = relCount * 50;
            storageInfo.usedSize = storageInfo.nodeStoreSize + storageInfo.relationshipStoreSize;
            storageInfo.totalSize = storageInfo.usedSize * 1.2; // Add 20% overhead
            storageInfo.freeSize = storageInfo.totalSize - storageInfo.usedSize;
          }
        }
      }

      await session.close();
      return storageInfo;
    } catch (error) {
      throw new Error(`Failed to get storage info: ${(error as Error).message}`);
    }
  }

  private extractStorageSize(attributes: any, sizeName: string): number {
    try {
      if (attributes && attributes[sizeName]) {
        const sizeValue = attributes[sizeName].value || attributes[sizeName];
        return typeof sizeValue === 'number' ? sizeValue : parseInt(sizeValue) || 0;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  // Private Helper Methods
  private setupEventHandlers(): void {
    this.on('error', (error: Error) => {
      console.error('Neo4j Database Service Error:', error);
    });
  }

  private emitEvent(event: DatabaseEvent): void {
    this.emit('database_event', event);
    this.eventListeners.forEach(listener => {
      switch (event.type) {
        case 'CONNECTION':
          listener.onConnection?.(event as any);
          break;
        case 'QUERY':
          listener.onQuery?.(event as any);
          break;
        case 'TRANSACTION':
          listener.onTransaction?.(event as any);
          break;
        case 'SCHEMA':
          listener.onSchema?.(event as any);
          break;
        case 'ERROR':
          listener.onError?.(event as any);
          break;
      }
    });
  }

  private emitError(error: Error, context?: string): void {
    const errorEvent: DatabaseEvent = {
      type: 'ERROR',
      timestamp: new Date(),
      details: { error: error.message, context: context || 'unknown' },
      severity: 'ERROR'
    };
    this.emitEvent(errorEvent);
  }

  private parseTTLContent(content: string, sourceFile: string): RDFTriple[] {
    const triples: RDFTriple[] = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) continue;
      
      // Basic triple parsing (simplified)
      const parts = line.replace(/\.$/, '').split(/\s+/);
      if (parts.length >= 3) {
        const subject = parts[0];
        const predicate = parts[1];
        const object = parts.slice(2).join(' ');
        
        triples.push({
          subject,
          predicate,
          object,
          objectType: this.determineObjectType(object),
          sourceFile,
          lineNumber: i + 1
        });
      }
    }
    
    return triples;
  }

  private determineObjectType(object: string): 'uri' | 'literal' | 'blank' {
    if (object.startsWith('<') && object.endsWith('>')) {
      return 'uri';
    } else if (object.startsWith('_:')) {
      return 'blank';
    } else {
      return 'literal';
    }
  }

  private extractNodeId(subject: string): string {
    // Remove angle brackets and extract the last part after #
    const cleaned = subject.replace(/[<>]/g, '');
    const parts = cleaned.split('#');
    return parts[parts.length - 1] || cleaned;
  }

  private extractNodeLabel(object: string): string {
    // Extract label from RDF type declaration
    const cleaned = object.replace(/[<>]/g, '');
    const parts = cleaned.split('#');
    return parts[parts.length - 1] || 'Node';
  }

  private extractRelationshipType(predicate: string): string {
    // Extract relationship type from predicate
    const cleaned = predicate.replace(/[<>]/g, '');
    const parts = cleaned.split('#');
    return parts[parts.length - 1] || 'RELATED_TO';
  }

  private suggestIndexHints(query: string): { optimizedQuery: string } | null {
    // Simple index hint suggestion
    if (query.includes('WHERE') && query.includes('=')) {
      const optimizedQuery = query.replace(/WHERE\s+(\w+)\.(\w+)\s*=/, 'USING INDEX $1($2) WHERE $1.$2 =');
      return { optimizedQuery };
    }
    return null;
  }

  private parameterizeQuery(query: string): { query: string; hasChanges: boolean } {
    let hasChanges = false;
    let parameterizedQuery = query;
    
    // Replace string literals with parameters
    const stringLiterals = query.match(/'[^']*'/g) || [];
    stringLiterals.forEach((literal, index) => {
      parameterizedQuery = parameterizedQuery.replace(literal, `$param${index}`);
      hasChanges = true;
    });
    
    return { query: parameterizedQuery, hasChanges };
  }

  private convertProfileToQueryProfile(profile: any): any {
    if (!profile) {
      return {
        operatorType: 'Unknown',
        identifiers: [],
        arguments: {},
        children: [],
        dbHits: 0,
        rows: 0,
        time: 0
      };
    }
    
    return {
      operatorType: profile.operatorType || 'Unknown',
      identifiers: profile.identifiers || [],
      arguments: profile.arguments || {},
      children: (profile.children || []).map((child: any) => this.convertProfileToQueryProfile(child)),
      dbHits: profile.dbHits || 0,
      rows: profile.rows || 0,
      time: profile.time || 0
    };
  }

  private identifyBottlenecks(profile: any, _plan: any): any[] {
    const bottlenecks: any[] = [];
    
    if (profile && profile.dbHits > 1000) {
      bottlenecks.push({
        type: 'LARGE_SCAN',
        description: 'High database hits detected',
        suggestion: 'Consider adding indexes or optimizing query',
        impact: 'HIGH'
      });
    }
    
    return bottlenecks;
  }

  private extractQueryPatterns(query: string): any[] {
    const patterns: any[] = [];
    
    // Look for property lookups
    const propertyMatches = query.match(/(\w+)\.(\w+)\s*=/g);
    if (propertyMatches) {
      propertyMatches.forEach(match => {
        const parts = match.split('.');
        if (parts.length >= 2) {
          patterns.push({
            type: 'property_lookup',
            label: parts[0],
            property: parts[1].replace(/\s*=.*/, '')
          });
        }
      });
    }
    
    // Look for text search patterns
    const textMatches = query.match(/CONTAINS\s+['"]([^'"]+)['"]/gi);
    if (textMatches) {
      textMatches.forEach(() => {
        patterns.push({
          type: 'text_search',
          label: 'Node',
          property: 'text'
        });
      });
    }
    
    return patterns;
  }

  private validateQuerySyntax(query: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Basic syntax checks
    if (!query.trim()) {
      errors.push('Query cannot be empty');
    }
    
    // Check for balanced parentheses
    const openParens = (query.match(/\(/g) || []).length;
    const closeParens = (query.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push('Unbalanced parentheses in query');
    }
    
    // Check for basic Cypher keywords
    const hasValidKeyword = /\b(MATCH|CREATE|MERGE|RETURN|WHERE|WITH)\b/i.test(query);
    if (!hasValidKeyword) {
      errors.push('Query must contain at least one valid Cypher keyword');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async validateQuerySemantics(_query: string): Promise<any> {
    // For now, return a basic semantic validation
    return {
      valid: true,
      errors: [],
      undefinedLabels: [],
      undefinedProperties: [],
      undefinedRelationships: []
    };
  }

  private convertPlanToExecutionPlan(plan: any): any {
    if (!plan) {
      return {
        operatorType: 'Unknown',
        cost: 0,
        rows: 0,
        arguments: {},
        children: []
      };
    }
    
    return {
      operatorType: plan.operatorType || 'Unknown',
      cost: plan.cost || 0,
      rows: plan.rows || 0,
      arguments: plan.arguments || {},
      children: (plan.children || []).map((child: any) => this.convertPlanToExecutionPlan(child))
    };
  }

  private extractIndexUsage(plan: any): any[] {
    const indexUsage: any[] = [];
    
    if (plan && plan.operatorType === 'NodeIndexSeek') {
      indexUsage.push({
        indexName: plan.arguments?.index || 'unknown',
        indexType: 'BTREE',
        properties: plan.arguments?.properties || [],
        usage: 'SEEK',
        selectivity: plan.arguments?.selectivity || 0
      });
    }
    
    return indexUsage;
  }

  private generateQueryRecommendations(plan: any): string[] {
    const recommendations: string[] = [];
    
    if (plan && plan.operatorType === 'AllNodesScan') {
      recommendations.push('Consider adding a label to avoid scanning all nodes');
    }
    
    if (plan && plan.operatorType === 'Filter') {
      recommendations.push('Consider adding an index for the filtered property');
    }
    
    return recommendations;
  }

  private async checkConnectionHealth(): Promise<any> {
    const startTime = Date.now();
    
    try {
      const isConnected = await this.testConnection();
      return {
        name: 'connection_health',
        status: isConnected ? 'PASS' : 'FAIL',
        message: isConnected ? 'Database connection is healthy' : 'Database connection failed',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'connection_health',
        status: 'FAIL',
        message: `Connection health check failed: ${(error as Error).message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkDatabaseHealth(): Promise<any> {
    const startTime = Date.now();
    
    try {
      const session = this.getSession();
      await session.run('RETURN 1');
      await session.close();
      
      return {
        name: 'database_health',
        status: 'PASS',
        message: 'Database is responding to queries',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'database_health',
        status: 'FAIL',
        message: `Database health check failed: ${(error as Error).message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkSchemaHealth(): Promise<any> {
    const startTime = Date.now();
    
    try {
      const constraints = await this.getConstraints();
      const indexes = await this.getIndexes();
      
      const failedConstraints = constraints.filter(c => c.state === 'FAILED');
      const failedIndexes = indexes.filter(i => i.state === 'FAILED');
      
      if (failedConstraints.length > 0 || failedIndexes.length > 0) {
        return {
          name: 'schema_health',
          status: 'WARN',
          message: `Found ${failedConstraints.length} failed constraints and ${failedIndexes.length} failed indexes`,
          duration: Date.now() - startTime
        };
      }
      
      return {
        name: 'schema_health',
        status: 'PASS',
        message: 'All constraints and indexes are healthy',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'schema_health',
        status: 'FAIL',
        message: `Schema health check failed: ${(error as Error).message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkPerformanceHealth(): Promise<any> {
    const startTime = Date.now();
    
    try {
      const metrics = await this.getMetrics();
      
      // Check for performance issues
      if (metrics.averageQueryTime > 5000) {
        return {
          name: 'performance_health',
          status: 'WARN',
          message: `Average query time is high: ${metrics.averageQueryTime}ms`,
          duration: Date.now() - startTime
        };
      }
      
      return {
        name: 'performance_health',
        status: 'PASS',
        message: 'Database performance is within acceptable limits',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'performance_health',
        status: 'FAIL',
        message: `Performance health check failed: ${(error as Error).message}`,
        duration: Date.now() - startTime
      };
    }
  }
}