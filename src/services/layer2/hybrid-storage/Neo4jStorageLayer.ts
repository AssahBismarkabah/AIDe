/**
 * Neo4j Storage Layer
 * 
 * Implements the Neo4j storage interface for the Hybrid Storage Manager
 * with optimized graph operations and health monitoring.
 */

import { EventEmitter } from 'events';
import neo4j, { Driver, Session } from 'neo4j-driver';
import logger from '../../../utils/logger';
import {
  StorageInterface,
  StorageLayer,
  StorageLayerHealth,
  QueryContext,
  QueryResult,
  Neo4jStorageConfig,
  HybridStorageError
} from './types';

export class Neo4jStorageLayer extends EventEmitter implements StorageInterface {
  readonly layer = StorageLayer.NEO4J;
  private driver: Driver | undefined;
  private isInitialized = false;
  private healthMetrics = {
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    totalResponseTime: 0,
    lastHealthCheck: new Date(),
    connectionPool: {
      active: 0,
      idle: 0,
      total: 0
    }
  };

  constructor(private config: Neo4jStorageConfig) {
    super();
  }

  /**
   * Initialize the Neo4j storage layer
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Neo4j Storage Layer');
      
      // Create Neo4j driver
      this.driver = neo4j.driver(
        this.config.uri,
        neo4j.auth.basic(this.config.username, this.config.password),
        {
          maxConnectionPoolSize: this.config.maxConnectionPoolSize || 50,
          connectionTimeout: this.config.connectionTimeout || 30000,
          maxTransactionRetryTime: this.config.maxTransactionRetryTime || 30000
        }
      );

      // Verify connectivity
      await this.verifyConnectivity();
      
      this.isInitialized = true;
      logger.info('Neo4j Storage Layer initialized successfully');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize Neo4j Storage Layer:', error);
      throw new HybridStorageError(
        `Neo4j initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        StorageLayer.NEO4J,
        'initialize',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Execute a query against Neo4j
   */
  async query<T = any>(
    query: string,
    params?: Record<string, any>,
    context?: QueryContext
  ): Promise<QueryResult<T>> {
    if (!this.isInitialized || !this.driver) {
      throw new HybridStorageError('Neo4j storage layer not initialized', StorageLayer.NEO4J, 'query');
    }

    const startTime = Date.now();
    let session: Session | undefined;
    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
      // Create session with appropriate database
      session = this.driver.session({
        database: this.config.database || 'neo4j',
        defaultAccessMode: this.determineAccessMode(query)
      });

      // Execute query with timeout
      const timeout = context?.timeout || 30000;
      
      const result = await Promise.race([
        session.run(query, params || {}),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error('Query timeout')), timeout);
          timeoutHandle.unref(); // Allow Node.js to exit even if timeout is pending
        })
      ]);
      
      // Clear timeout if query completed successfully
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      // Process results - handle case where result.records might be undefined (mocked scenarios)
      const records = (result.records || []).map(record => {
        const obj: any = {};
        record.keys.forEach(key => {
          obj[key] = this.convertNeo4jValue(record.get(key));
        });
        return obj;
      });

      const executionTime = Date.now() - startTime;
      
      // Update metrics
      this.updateMetrics(true, executionTime);
      
      const queryResult: QueryResult<T> = {
        data: records as T,
        source: StorageLayer.NEO4J,
        executionTime,
        cached: false,
        timestamp: new Date(),
        metadata: {
          summary: result.summary,
          recordCount: records.length,
          database: this.config.database || 'neo4j'
        }
      };

      this.emit('query_executed', { query, params, result: queryResult, context });
      
      return queryResult;
    } catch (error) {
      // Clear timeout if query failed
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      
      const executionTime = Date.now() - startTime;
      this.updateMetrics(false, executionTime);
      
      logger.error('Neo4j query failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('query_failed', { query, params, error, context });
      
      throw new HybridStorageError(
        `Neo4j query failed: ${errorMessage}`,
        StorageLayer.NEO4J,
        'query',
        error instanceof Error ? error : undefined
      );
    } finally {
      // Always clear timeout handle
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      
      if (session) {
        await session.close();
      }
    }
  }

  /**
   * Create a new entity in Neo4j
   */
  async create(data: any, context?: QueryContext): Promise<QueryResult<any>> {
    const createQuery = this.buildCreateQuery(data);
    return this.query(createQuery.query, createQuery.params, context);
  }

  /**
   * Update an entity in Neo4j
   */
  async update(id: string, data: any, context?: QueryContext): Promise<QueryResult<any>> {
    const updateQuery = this.buildUpdateQuery(id, data);
    return this.query(updateQuery.query, updateQuery.params, context);
  }

  /**
   * Delete an entity from Neo4j
   */
  async delete(id: string, context?: QueryContext): Promise<QueryResult<boolean>> {
    const deleteQuery = `
      MATCH (n) WHERE id(n) = $id
      DELETE n
      RETURN count(n) as deletedCount
    `;
    
    const result = await this.query<{ deletedCount: number }[]>(
      deleteQuery, 
      { id: parseInt(id) }, 
      context
    );
    
    const deleted = Array.isArray(result.data) && result.data.length > 0 && result.data[0].deletedCount > 0;
    
    return {
      ...result,
      data: deleted
    };
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<StorageLayerHealth> {
    const startTime = Date.now();
    
    try {
      if (!this.driver) {
        throw new Error('Driver not initialized');
      }

      // Test connectivity with a simple query
      const session = this.driver.session();
      try {
        await session.run('RETURN 1 as test');
        await session.close();
      } catch (error) {
        await session.close();
        throw error;
      }

      // Get connection pool metrics
      const serverInfo = await this.driver.getServerInfo();
      
      const responseTime = Date.now() - startTime;
      this.healthMetrics.lastHealthCheck = new Date();
      
      return {
        layer: StorageLayer.NEO4J,
        status: responseTime < 1000 ? 'healthy' : responseTime < 5000 ? 'degraded' : 'unhealthy',
        responseTime,
        lastCheck: new Date(),
        errorCount: this.healthMetrics.failedQueries,
        details: {
          serverInfo,
          connectionPool: this.healthMetrics.connectionPool,
          database: this.config.database || 'neo4j',
          totalQueries: this.healthMetrics.totalQueries,
          successRate: this.healthMetrics.totalQueries > 0 
            ? this.healthMetrics.successfulQueries / this.healthMetrics.totalQueries 
            : 0
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        layer: StorageLayer.NEO4J,
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date(),
        errorCount: this.healthMetrics.failedQueries,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          lastSuccessfulCheck: this.healthMetrics.lastHealthCheck
        }
      };
    }
  }

  /**
   * Get storage metrics
   */
  async getMetrics(): Promise<Record<string, any>> {
    return {
      layer: StorageLayer.NEO4J,
      totalQueries: this.healthMetrics.totalQueries,
      successfulQueries: this.healthMetrics.successfulQueries,
      failedQueries: this.healthMetrics.failedQueries,
      successRate: this.healthMetrics.totalQueries > 0 
        ? this.healthMetrics.successfulQueries / this.healthMetrics.totalQueries 
        : 0,
      averageResponseTime: this.healthMetrics.totalQueries > 0 
        ? this.healthMetrics.totalResponseTime / this.healthMetrics.totalQueries 
        : 0,
      connectionPool: this.healthMetrics.connectionPool,
      isInitialized: this.isInitialized,
      config: {
        uri: this.config.uri,
        database: this.config.database || 'neo4j',
        maxConnectionPoolSize: this.config.maxConnectionPoolSize || 50
      }
    };
  }

  /**
   * Shutdown the Neo4j storage layer
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Neo4j Storage Layer');
      
      if (this.driver) {
        await this.driver.close();
        this.driver = undefined;
      }
      
      this.isInitialized = false;
      
      logger.info('Neo4j Storage Layer shutdown completed');
      this.emit('shutdown');
    } catch (error) {
      logger.error('Neo4j Storage Layer shutdown failed:', error);
      throw error;
    }
  }

  // Private helper methods

  private async verifyConnectivity(): Promise<void> {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }

    const session = this.driver.session();
    try {
      await session.run('RETURN 1 as test');
      logger.debug('Neo4j connectivity verified');
    } finally {
      await session.close();
    }
  }

  private determineAccessMode(query: string): 'READ' | 'WRITE' {
    const writeKeywords = ['CREATE', 'MERGE', 'SET', 'DELETE', 'REMOVE', 'DROP'];
    const upperQuery = query.toUpperCase();
    
    return writeKeywords.some(keyword => upperQuery.includes(keyword)) ? 'WRITE' : 'READ';
  }

  private convertNeo4jValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Handle Neo4j specific types
    if (typeof value === 'object') {
      if (value.constructor.name === 'Integer') {
        return value.toNumber();
      }
      if (value.constructor.name === 'Node') {
        return {
          id: value.identity.toNumber(),
          labels: value.labels,
          properties: this.convertNeo4jProperties(value.properties)
        };
      }
      if (value.constructor.name === 'Relationship') {
        return {
          id: value.identity.toNumber(),
          type: value.type,
          start: value.start.toNumber(),
          end: value.end.toNumber(),
          properties: this.convertNeo4jProperties(value.properties)
        };
      }
      if (value.constructor.name === 'Path') {
        return {
          start: this.convertNeo4jValue(value.start),
          end: this.convertNeo4jValue(value.end),
          segments: value.segments.map((segment: any) => ({
            start: this.convertNeo4jValue(segment.start),
            relationship: this.convertNeo4jValue(segment.relationship),
            end: this.convertNeo4jValue(segment.end)
          }))
        };
      }
      if (Array.isArray(value)) {
        return value.map(item => this.convertNeo4jValue(item));
      }
      
      // Handle regular objects
      const converted: any = {};
      for (const [key, val] of Object.entries(value)) {
        converted[key] = this.convertNeo4jValue(val);
      }
      return converted;
    }

    return value;
  }

  private convertNeo4jProperties(properties: Record<string, any>): Record<string, any> {
    const converted: Record<string, any> = {};
    for (const [key, value] of Object.entries(properties)) {
      converted[key] = this.convertNeo4jValue(value);
    }
    return converted;
  }

  private buildCreateQuery(data: any): { query: string; params: Record<string, any> } {
    if (data.labels && data.properties) {
      // Node creation
      const labels = Array.isArray(data.labels) ? data.labels.join(':') : data.labels;
      const query = `CREATE (n:${labels} $properties) RETURN n`;
      return { query, params: { properties: data.properties } };
    } else if (data.type && data.start && data.end && data.properties) {
      // Relationship creation
      const query = `
        MATCH (start) WHERE id(start) = $startId
        MATCH (end) WHERE id(end) = $endId
        CREATE (start)-[r:${data.type} $properties]->(end)
        RETURN r
      `;
      return {
        query,
        params: {
          startId: data.start,
          endId: data.end,
          properties: data.properties
        }
      };
    } else {
      // Generic node creation
      const query = 'CREATE (n $properties) RETURN n';
      return { query, params: { properties: data } };
    }
  }

  private buildUpdateQuery(id: string, data: any): { query: string; params: Record<string, any> } {
    // Try to parse as number, but handle string IDs gracefully
    const numericId = isNaN(parseInt(id)) ? null : parseInt(id);
    
    if (numericId !== null) {
      // Use numeric ID for Neo4j internal ID
      const query = `
        MATCH (n) WHERE id(n) = $id
        SET n += $properties
        RETURN n
      `;
      return {
        query,
        params: {
          id: numericId,
          properties: data
        }
      };
    } else {
      // Use string ID as a property match (fallback for test scenarios)
      const query = `
        MATCH (n) WHERE n.id = $id OR n.uuid = $id
        SET n += $properties
        RETURN n
      `;
      return {
        query,
        params: {
          id: id,
          properties: data
        }
      };
    }
  }

  private updateMetrics(success: boolean, responseTime: number): void {
    this.healthMetrics.totalQueries++;
    this.healthMetrics.totalResponseTime += responseTime;
    
    if (success) {
      this.healthMetrics.successfulQueries++;
    } else {
      this.healthMetrics.failedQueries++;
    }
  }
}

export default Neo4jStorageLayer;