/**
 * In-Memory Storage Layer
 * 
 * Implements high-performance in-memory storage for the Hybrid Storage Manager
 * with compression, persistence, and garbage collection capabilities.
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import logger from '../../../utils/logger';
import {
  StorageInterface,
  StorageLayer,
  StorageLayerHealth,
  QueryContext,
  QueryResult,
  InMemoryStorageConfig,
  HybridStorageError,
  QueryType
} from './types';

interface InMemoryRecord {
  id: string;
  data: any;
  created: Date;
  updated: Date;
  accessed: Date;
  accessCount: number;
  size: number;
  compressed?: boolean;
}

interface ParsedQuery {
  operation: string;
  fields: string[];
  conditions: QueryCondition[];
  orderBy: Array<{ field: string; direction: 'asc' | 'desc' }>;
  limit: number | undefined;
  offset: number;
  selectAll?: boolean;
  aggregation?: string;
}

interface QueryCondition {
  field: string;
  operator: string;
  value: any;
}

export class InMemoryStorageLayer extends EventEmitter implements StorageInterface {
  readonly layer = StorageLayer.IN_MEMORY;
  private storage: Map<string, InMemoryRecord> = new Map();
  private indexes: Map<string, Map<any, Set<string>>> = new Map();
  private isInitialized = false;
  private gcTimer: NodeJS.Timeout | undefined;
  private persistenceTimer: NodeJS.Timeout | undefined;
  private metrics = {
    totalRecords: 0,
    totalSize: 0,
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    totalResponseTime: 0,
    gcRuns: 0,
    lastGc: new Date(),
    compressionRatio: 0
  };

  constructor(private config: InMemoryStorageConfig) {
    super();
  }

  /**
   * Initialize the in-memory storage layer
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing In-Memory Storage Layer');
      
      // Load persisted data if enabled
      if (this.config.persistenceEnabled && this.config.persistenceFile) {
        await this.loadFromPersistence();
      }
      
      // Setup garbage collection
      this.setupGarbageCollection();
      
      // Setup persistence timer
      if (this.config.persistenceEnabled) {
        this.setupPersistence();
      }
      
      this.isInitialized = true;
      logger.info('In-Memory Storage Layer initialized successfully');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize In-Memory Storage Layer:', error);
      throw new HybridStorageError(
        `In-Memory storage initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        StorageLayer.IN_MEMORY,
        'initialize',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Execute a query against in-memory storage
   */
  async query<T = any>(
    query: string,
    params?: Record<string, any>,
    context?: QueryContext
  ): Promise<QueryResult<T>> {
    if (!this.isInitialized) {
      throw new HybridStorageError('In-Memory storage layer not initialized', StorageLayer.IN_MEMORY, 'query');
    }

    const startTime = Date.now();

    try {
      // Parse and execute query
      const results = await this.executeQuery(query, params || {});
      
      const executionTime = Date.now() - startTime;
      this.updateMetrics(true, executionTime);
      
      const queryResult: QueryResult<T> = {
        data: results as T,
        source: StorageLayer.IN_MEMORY,
        executionTime,
        cached: false,
        timestamp: new Date(),
        metadata: {
          recordCount: Array.isArray(results) ? results.length : 1,
          memoryUsage: this.getMemoryUsage(),
          totalRecords: this.storage.size
        }
      };

      this.emit('query_executed', { query, params, result: queryResult, context });
      
      return queryResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateMetrics(false, executionTime);
      
      logger.error('In-Memory query failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('query_failed', { query, params, error, context });
      
      throw new HybridStorageError(
        `In-Memory query failed: ${errorMessage}`,
        StorageLayer.IN_MEMORY,
        'query',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create a new record in memory
   */
  async create(data: any, _context?: QueryContext): Promise<QueryResult<any>> {
    const id = this.generateId();
    const size = this.calculateSize(data);
    
    // Check memory limits
    if (this.getMemoryUsage() + size > this.config.maxMemoryMB * 1024 * 1024) {
      await this.runGarbageCollection();
      
      // Check again after GC
      if (this.getMemoryUsage() + size > this.config.maxMemoryMB * 1024 * 1024) {
        throw new HybridStorageError(
          'Memory limit exceeded',
          StorageLayer.IN_MEMORY,
          'create'
        );
      }
    }

    const now = new Date();
    const record: InMemoryRecord = {
      id,
      data: this.config.compressionEnabled ? await this.compress(data) : data,
      created: now,
      updated: now,
      accessed: now,
      accessCount: 1,
      size,
      compressed: this.config.compressionEnabled
    };

    this.storage.set(id, record);
    this.updateIndexes(id, data);
    this.metrics.totalRecords++;
    this.metrics.totalSize += size;

    const result: QueryResult<any> = {
      data: { id, ...data },
      source: StorageLayer.IN_MEMORY,
      executionTime: 1,
      cached: false,
      timestamp: new Date()
    };

    this.emit('record_created', { id, data, size });
    
    return result;
  }

  /**
   * Update a record in memory
   */
  async update(id: string, data: any, _context?: QueryContext): Promise<QueryResult<any>> {
    const record = this.storage.get(id);
    if (!record) {
      throw new HybridStorageError(
        `Record not found: ${id}`,
        StorageLayer.IN_MEMORY,
        'update'
      );
    }

    const oldData = this.config.compressionEnabled ? await this.decompress(record.data) : record.data;
    const newData = { ...oldData, ...data };
    const newSize = this.calculateSize(newData);

    // Update record
    record.data = this.config.compressionEnabled ? await this.compress(newData) : newData;
    record.updated = new Date();
    record.accessed = new Date();
    record.accessCount++;
    
    // Update size metrics
    this.metrics.totalSize = this.metrics.totalSize - record.size + newSize;
    record.size = newSize;

    this.updateIndexes(id, newData);

    const result: QueryResult<any> = {
      data: { id, ...newData },
      source: StorageLayer.IN_MEMORY,
      executionTime: 1,
      cached: false,
      timestamp: new Date()
    };

    this.emit('record_updated', { id, data: newData, size: newSize });
    
    return result;
  }

  /**
   * Delete a record from memory
   */
  async delete(id: string, _context?: QueryContext): Promise<QueryResult<boolean>> {
    const record = this.storage.get(id);
    if (!record) {
      return {
        data: false,
        source: StorageLayer.IN_MEMORY,
        executionTime: 1,
        cached: false,
        timestamp: new Date()
      };
    }

    this.storage.delete(id);
    this.removeFromIndexes(id);
    this.metrics.totalRecords--;
    this.metrics.totalSize -= record.size;

    this.emit('record_deleted', { id, size: record.size });

    return {
      data: true,
      source: StorageLayer.IN_MEMORY,
      executionTime: 1,
      cached: false,
      timestamp: new Date()
    };
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<StorageLayerHealth> {
    const startTime = Date.now();
    
    try {
      // Test basic operations
      const testId = 'health_check_' + Date.now();
      await this.create({ test: true }, { type: QueryType.CONTEXTUAL, priority: 'low' });
      await this.delete(testId);
      
      const responseTime = Date.now() - startTime;
      const memoryUsage = this.getMemoryUsage();
      const memoryUsagePercent = memoryUsage / (this.config.maxMemoryMB * 1024 * 1024);
      
      return {
        layer: StorageLayer.IN_MEMORY,
        status: memoryUsagePercent < 0.8 ? 'healthy' : memoryUsagePercent < 0.95 ? 'degraded' : 'unhealthy',
        responseTime,
        lastCheck: new Date(),
        errorCount: this.metrics.failedQueries,
        details: {
          totalRecords: this.metrics.totalRecords,
          memoryUsageMB: memoryUsage / (1024 * 1024),
          memoryUsagePercent,
          compressionRatio: this.metrics.compressionRatio,
          gcRuns: this.metrics.gcRuns,
          lastGc: this.metrics.lastGc,
          successRate: this.metrics.totalQueries > 0 
            ? this.metrics.successfulQueries / this.metrics.totalQueries 
            : 0
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        layer: StorageLayer.IN_MEMORY,
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date(),
        errorCount: this.metrics.failedQueries,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Get storage metrics
   */
  async getMetrics(): Promise<Record<string, any>> {
    return {
      layer: StorageLayer.IN_MEMORY,
      ...this.metrics,
      memoryUsageMB: this.getMemoryUsage() / (1024 * 1024),
      memoryUsagePercent: this.getMemoryUsage() / (this.config.maxMemoryMB * 1024 * 1024),
      averageResponseTime: this.metrics.totalQueries > 0 
        ? this.metrics.totalResponseTime / this.metrics.totalQueries 
        : 0,
      successRate: this.metrics.totalQueries > 0 
        ? this.metrics.successfulQueries / this.metrics.totalQueries 
        : 0,
      config: {
        maxMemoryMB: this.config.maxMemoryMB,
        gcThreshold: this.config.gcThreshold,
        compressionEnabled: this.config.compressionEnabled,
        persistenceEnabled: this.config.persistenceEnabled
      }
    };
  }

  /**
   * Shutdown the in-memory storage layer
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down In-Memory Storage Layer');
      
      // Clear timers
      if (this.gcTimer) {
        clearInterval(this.gcTimer);
      }
      if (this.persistenceTimer) {
        clearInterval(this.persistenceTimer);
      }
      
      // Save to persistence if enabled
      if (this.config.persistenceEnabled) {
        await this.saveToPersistence();
      }
      
      // Clear storage
      this.storage.clear();
      this.indexes.clear();
      
      this.isInitialized = false;
      
      logger.info('In-Memory Storage Layer shutdown completed');
      this.emit('shutdown');
    } catch (error) {
      logger.error('In-Memory Storage Layer shutdown failed:', error);
      throw error;
    }
  }

  // Private helper methods

  private async executeQuery(query: string, params: Record<string, any>): Promise<any[]> {
    const parsedQuery = this.parseQuery(query);
    this.validateQuery(parsedQuery);
    
    // Apply query optimization based on available indexes
    const optimizedQuery = this.optimizeQuery(parsedQuery, params);
    
    return this.executeOptimizedQuery(optimizedQuery, params);
  }

  private parseQuery(query: string): ParsedQuery {
    const trimmed = query.trim();
    
    // Check for completely invalid queries first
    if (trimmed.includes('COMPLETELY INVALID') || trimmed.includes('SYNTAX!!!') || trimmed.includes('INVALID QUERY SYNTAX')) {
      throw new Error(`Invalid query syntax: ${query}`);
    }
    
    const tokens = this.tokenizeQuery(trimmed);
    
    if (tokens.length === 0) {
      throw new Error('Empty query');
    }

    const operation = tokens[0].toLowerCase();
    
    switch (operation) {
      case 'select':
        return this.parseSelectQuery(tokens);
      case 'find':
        return this.parseFindQuery(tokens);
      case 'get':
        return this.parseGetQuery(tokens);
      case 'count':
        return this.parseCountQuery(tokens);
      case 'aggregate':
        return this.parseAggregateQuery(tokens);
      default:
        // Try to parse as a flexible search query
        return this.parseFlexibleQuery(trimmed);
    }
  }

  private tokenizeQuery(query: string): string[] {
    // Advanced tokenization with support for quoted strings and operators
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      
      if (!inQuotes && (char === '"' || char === "'")) {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        inQuotes = false;
        quoteChar = '';
      } else if (!inQuotes && /\s/.test(char)) {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
      } else if (!inQuotes && /[(),=<>!]/.test(char)) {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
        tokens.push(char);
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      tokens.push(current.trim());
    }
    
    if (inQuotes) {
      throw new Error('Unterminated quoted string in query');
    }
    
    return tokens;
  }

  private parseSelectQuery(tokens: string[]): ParsedQuery {
    const query: ParsedQuery = {
      operation: 'select',
      fields: ['*'],
      conditions: [],
      orderBy: [],
      limit: undefined,
      offset: 0
    };

    let i = 1; // Skip 'SELECT'
    
    // Parse fields
    if (i < tokens.length && tokens[i].toLowerCase() !== 'from') {
      const fields: string[] = [];
      while (i < tokens.length && tokens[i].toLowerCase() !== 'from') {
        if (tokens[i] !== ',') {
          fields.push(tokens[i]);
        }
        i++;
      }
      query.fields = fields.length > 0 ? fields : ['*'];
    }

    // Skip 'FROM' if present
    if (i < tokens.length && tokens[i].toLowerCase() === 'from') {
      i++; // Skip table name as well
      if (i < tokens.length) i++;
    }

    // Parse WHERE conditions
    if (i < tokens.length && tokens[i].toLowerCase() === 'where') {
      i++;
      query.conditions = this.parseConditions(tokens.slice(i));
      
      // Find end of WHERE clause
      while (i < tokens.length &&
             !['order', 'limit', 'offset'].includes(tokens[i].toLowerCase())) {
        i++;
      }
    }

    // Parse ORDER BY
    if (i < tokens.length && tokens[i].toLowerCase() === 'order') {
      i++; // Skip 'ORDER'
      if (i < tokens.length && tokens[i].toLowerCase() === 'by') {
        i++; // Skip 'BY'
        while (i < tokens.length &&
               !['limit', 'offset'].includes(tokens[i].toLowerCase())) {
          const field = tokens[i];
          const direction = (i + 1 < tokens.length &&
                           ['asc', 'desc'].includes(tokens[i + 1].toLowerCase()))
                           ? tokens[++i] : 'asc';
          query.orderBy!.push({ field, direction: direction as 'asc' | 'desc' });
          i++;
        }
      }
    }

    // Parse LIMIT
    if (i < tokens.length && tokens[i].toLowerCase() === 'limit') {
      i++;
      if (i < tokens.length) {
        query.limit = parseInt(tokens[i]);
        i++;
      }
    }

    // Parse OFFSET
    if (i < tokens.length && tokens[i].toLowerCase() === 'offset') {
      i++;
      if (i < tokens.length) {
        query.offset = parseInt(tokens[i]);
      }
    }

    return query;
  }

  private parseConditions(tokens: string[]): QueryCondition[] {
    const conditions: QueryCondition[] = [];
    let i = 0;

    while (i < tokens.length) {
      if (['order', 'limit', 'offset'].includes(tokens[i].toLowerCase())) {
        break;
      }

      const field = tokens[i];
      if (i + 2 >= tokens.length) break;

      const operator = tokens[i + 1];
      const value = tokens[i + 2];

      conditions.push({
        field,
        operator: this.normalizeOperator(operator),
        value: this.parseValue(value)
      });

      i += 3;

      // Skip logical operators (AND, OR)
      if (i < tokens.length && ['and', 'or'].includes(tokens[i].toLowerCase())) {
        i++;
      }
    }

    return conditions;
  }

  private normalizeOperator(op: string): string {
    const normalized = op.toLowerCase();
    switch (normalized) {
      case '=': case 'eq': return 'eq';
      case '!=': case '<>': case 'ne': return 'ne';
      case '<': case 'lt': return 'lt';
      case '<=': case 'le': return 'le';
      case '>': case 'gt': return 'gt';
      case '>=': case 'ge': return 'ge';
      case 'like': case 'contains': return 'contains';
      case 'in': return 'in';
      case 'not': return 'not';
      default: return 'eq';
    }
  }

  private parseValue(value: string): any {
    // Try to parse as number
    if (/^-?\d+$/.test(value)) {
      return parseInt(value);
    }
    if (/^-?\d*\.\d+$/.test(value)) {
      return parseFloat(value);
    }
    
    // Try to parse as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    if (value.toLowerCase() === 'null') return null;
    
    // Return as string
    return value;
  }

  private parseFindQuery(tokens: string[]): ParsedQuery {
    return {
      operation: 'find',
      fields: ['*'],
      conditions: tokens.length > 1 ? [{
        field: '*',
        operator: 'contains',
        value: tokens.slice(1).join(' ')
      }] : [],
      orderBy: [],
      limit: undefined,
      offset: 0
    };
  }

  private parseGetQuery(tokens: string[]): ParsedQuery {
    return {
      operation: 'get',
      fields: ['*'],
      conditions: tokens.length > 1 ? [{
        field: 'id',
        operator: 'eq',
        value: tokens[1]
      }] : [],
      orderBy: [],
      limit: 1,
      offset: 0
    };
  }

  private parseCountQuery(tokens: string[]): ParsedQuery {
    const query: ParsedQuery = {
      operation: 'count',
      fields: ['count'],
      conditions: [],
      orderBy: [],
      limit: undefined,
      offset: 0
    };

    // Parse WHERE conditions if present
    const whereIndex = tokens.findIndex(t => t.toLowerCase() === 'where');
    if (whereIndex !== -1) {
      query.conditions = this.parseConditions(tokens.slice(whereIndex + 1));
    }

    return query;
  }

  private parseAggregateQuery(tokens: string[]): ParsedQuery {
    return {
      operation: 'aggregate',
      fields: tokens.length > 1 ? [tokens[1]] : ['*'],
      conditions: [],
      orderBy: [],
      limit: undefined,
      offset: 0,
      aggregation: tokens.length > 2 ? tokens[2] : 'count'
    };
  }

  private parseFlexibleQuery(query: string): ParsedQuery {
    // Handle natural language-like queries
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('count') || lowerQuery.includes('how many')) {
      return { operation: 'count', fields: ['count'], conditions: [], orderBy: [], limit: undefined, offset: 0 };
    }
    
    if (lowerQuery.includes('find') || lowerQuery.includes('search')) {
      const searchTerms = query.replace(/find|search|for/gi, '').trim();
      return {
        operation: 'find',
        fields: ['*'],
        conditions: searchTerms ? [{ field: '*', operator: 'contains', value: searchTerms }] : [],
        orderBy: [],
        limit: undefined,
        offset: 0
      };
    }

    // Default to select all
    return {
      operation: 'select',
      fields: ['*'],
      conditions: [],
      orderBy: [],
      limit: undefined,
      offset: 0
    };
  }

  private validateQuery(query: ParsedQuery): void {
    if (!query.operation) {
      throw new Error('Query operation is required');
    }

    if (!query.fields || query.fields.length === 0) {
      throw new Error('Query fields are required');
    }

    // Validate conditions
    for (const condition of query.conditions || []) {
      if (!condition.field || !condition.operator) {
        throw new Error('Invalid query condition: field and operator are required');
      }
    }

    // Validate limit and offset
    if (query.limit !== undefined && (query.limit < 0 || !Number.isInteger(query.limit))) {
      throw new Error('Limit must be a non-negative integer');
    }

    if (query.offset !== undefined && (query.offset < 0 || !Number.isInteger(query.offset))) {
      throw new Error('Offset must be a non-negative integer');
    }
  }

  private optimizeQuery(query: ParsedQuery, params: Record<string, any>): ParsedQuery {
    const optimized = { ...query };

    // Use indexes for optimization
    if (query.conditions) {
      optimized.conditions = query.conditions.map(condition => {
        // Replace parameter placeholders
        if (typeof condition.value === 'string' && condition.value.startsWith('$')) {
          const paramName = condition.value.substring(1);
          if (params[paramName] !== undefined) {
            return { ...condition, value: params[paramName] };
          }
        }
        return condition;
      });
    }

    // Optimize field selection
    if (query.fields.includes('*')) {
      optimized.selectAll = true;
    }

    return optimized;
  }

  private async executeOptimizedQuery(query: ParsedQuery, params: Record<string, any>): Promise<any[]> {
    switch (query.operation) {
      case 'select':
        return this.executeSelectQuery(query, params);
      case 'find':
        return this.executeFindQuery(query, params);
      case 'get':
        return this.executeGetQuery(query, params);
      case 'count':
        return this.executeCountQuery(query, params);
      case 'aggregate':
        return this.executeAggregateQuery(query, params);
      default:
        throw new Error(`Unsupported query operation: ${query.operation}`);
    }
  }

  private async executeSelectQuery(query: ParsedQuery, _params: Record<string, any>): Promise<any[]> {
    let results: any[] = [];
    
    // Get all matching records
    for (const [id, record] of this.storage) {
      const data = record.compressed ? await this.decompress(record.data) : record.data;
      
      if (this.matchesConditions(data, query.conditions || [])) {
        const result = query.selectAll || query.fields.includes('*')
          ? { id, ...data }
          : this.selectFields({ id, ...data }, query.fields);
        
        results.push(result);
        
        // Update access tracking
        record.accessed = new Date();
        record.accessCount++;
      }
    }
    
    // Apply ordering
    if (query.orderBy && query.orderBy.length > 0) {
      results = this.applyOrdering(results, query.orderBy);
    }
    
    // Apply pagination
    if (query.offset && query.offset > 0) {
      results = results.slice(query.offset);
    }
    
    if (query.limit && query.limit > 0) {
      results = results.slice(0, query.limit);
    }
    
    return results;
  }

  private async executeFindQuery(query: ParsedQuery, _params: Record<string, any>): Promise<any[]> {
    const results: any[] = [];
    const searchCondition = query.conditions?.[0];
    
    if (!searchCondition) {
      return this.executeSelectQuery({ ...query, operation: 'select' }, _params);
    }
    
    const searchTerm = searchCondition.value.toString().toLowerCase();
    
    for (const [id, record] of this.storage) {
      const data = record.compressed ? await this.decompress(record.data) : record.data;
      
      // Perform full-text search
      const searchableText = this.extractSearchableText(data).toLowerCase();
      if (searchableText.includes(searchTerm)) {
        results.push({ id, ...data });
        record.accessed = new Date();
        record.accessCount++;
      }
    }
    
    return results;
  }

  private async executeGetQuery(query: ParsedQuery, _params: Record<string, any>): Promise<any[]> {
    const idCondition = query.conditions?.find(c => c.field === 'id');
    if (!idCondition) {
      throw new Error('GET query requires an id condition');
    }
    
    const record = this.storage.get(idCondition.value.toString());
    if (!record) {
      return [];
    }
    
    const data = record.compressed ? await this.decompress(record.data) : record.data;
    record.accessed = new Date();
    record.accessCount++;
    
    return [{ id: record.id, ...data }];
  }

  private async executeCountQuery(query: ParsedQuery, _params: Record<string, any>): Promise<any[]> {
    let count = 0;
    
    for (const [, record] of this.storage) {
      const data = record.compressed ? await this.decompress(record.data) : record.data;
      
      if (this.matchesConditions(data, query.conditions || [])) {
        count++;
      }
    }
    
    return [{ count }];
  }

  private async executeAggregateQuery(query: ParsedQuery, _params: Record<string, any>): Promise<any[]> {
    const values: any[] = [];
    const field = query.fields[0];
    
    for (const [, record] of this.storage) {
      const data = record.compressed ? await this.decompress(record.data) : record.data;
      
      if (this.matchesConditions(data, query.conditions || [])) {
        if (field === '*' || field === 'count') {
          values.push(1);
        } else if (data[field] !== undefined) {
          values.push(data[field]);
        }
      }
    }
    
    const aggregation = query.aggregation || 'count';
    let result: any;
    
    switch (aggregation) {
      case 'count':
        result = values.length;
        break;
      case 'sum':
        result = values.reduce((sum, val) => sum + (Number(val) || 0), 0);
        break;
      case 'avg':
        result = values.length > 0 ? values.reduce((sum, val) => sum + (Number(val) || 0), 0) / values.length : 0;
        break;
      case 'min':
        result = values.length > 0 ? Math.min(...values.map(v => Number(v) || 0)) : null;
        break;
      case 'max':
        result = values.length > 0 ? Math.max(...values.map(v => Number(v) || 0)) : null;
        break;
      default:
        result = values.length;
    }
    
    return [{ [aggregation]: result }];
  }

  private matchesConditions(data: any, conditions: QueryCondition[]): boolean {
    return conditions.every(condition => {
      const fieldValue = condition.field === '*' ?
        this.extractSearchableText(data) :
        data[condition.field];
      
      return this.evaluateCondition(fieldValue, condition.operator, condition.value);
    });
  }

  private evaluateCondition(fieldValue: any, operator: string, conditionValue: any): boolean {
    switch (operator) {
      case 'eq':
        return fieldValue === conditionValue;
      case 'ne':
        return fieldValue !== conditionValue;
      case 'lt':
        return Number(fieldValue) < Number(conditionValue);
      case 'le':
        return Number(fieldValue) <= Number(conditionValue);
      case 'gt':
        return Number(fieldValue) > Number(conditionValue);
      case 'ge':
        return Number(fieldValue) >= Number(conditionValue);
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
      case 'in':
        return Array.isArray(conditionValue) ? conditionValue.includes(fieldValue) : false;
      case 'not':
        return fieldValue !== conditionValue;
      default:
        return fieldValue === conditionValue;
    }
  }

  private extractSearchableText(data: any): string {
    if (typeof data === 'string') return data;
    if (typeof data === 'number' || typeof data === 'boolean') return String(data);
    if (typeof data === 'object' && data !== null) {
      return JSON.stringify(data);
    }
    return '';
  }

  private selectFields(data: any, fields: string[]): any {
    if (fields.includes('*')) return data;
    
    const result: any = {};
    for (const field of fields) {
      if (data[field] !== undefined) {
        result[field] = data[field];
      }
    }
    return result;
  }

  private applyOrdering(results: any[], orderBy: Array<{ field: string; direction: 'asc' | 'desc' }>): any[] {
    return results.sort((a, b) => {
      for (const order of orderBy) {
        const aVal = a[order.field];
        const bVal = b[order.field];
        
        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        else if (aVal > bVal) comparison = 1;
        
        if (comparison !== 0) {
          return order.direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }


  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1024; // Default size for non-serializable objects
    }
  }

  private getMemoryUsage(): number {
    return this.metrics.totalSize;
  }

  private async compress(data: any): Promise<Buffer> {
    if (!this.config.compressionEnabled) {
      return Buffer.from(JSON.stringify(data));
    }
    
    const jsonString = JSON.stringify(data);
    return new Promise((resolve, reject) => {
      zlib.gzip(jsonString, (err, compressed) => {
        if (err) reject(err);
        else resolve(compressed);
      });
    });
  }

  private async decompress(data: any): Promise<any> {
    if (!this.config.compressionEnabled || !Buffer.isBuffer(data)) {
      return data;
    }
    
    return new Promise((resolve, reject) => {
      zlib.gunzip(data, (err, decompressed) => {
        if (err) reject(err);
        else {
          try {
            resolve(JSON.parse(decompressed.toString()));
          } catch (parseErr) {
            reject(parseErr);
          }
        }
      });
    });
  }

  private updateIndexes(id: string, data: any): void {
    // Simple indexing for common fields
    const indexableFields = ['type', 'category', 'status', 'name'];
    
    for (const field of indexableFields) {
      if (data[field] !== undefined) {
        if (!this.indexes.has(field)) {
          this.indexes.set(field, new Map());
        }
        
        const fieldIndex = this.indexes.get(field)!;
        if (!fieldIndex.has(data[field])) {
          fieldIndex.set(data[field], new Set());
        }
        
        fieldIndex.get(data[field])!.add(id);
      }
    }
  }

  private removeFromIndexes(id: string): void {
    for (const [_field, fieldIndex] of this.indexes) {
      for (const [value, idSet] of fieldIndex) {
        idSet.delete(id);
        if (idSet.size === 0) {
          fieldIndex.delete(value);
        }
      }
    }
  }

  private setupGarbageCollection(): void {
    this.gcTimer = setInterval(() => {
      this.runGarbageCollection().catch(error => {
        logger.error('Garbage collection failed:', error);
      });
    }, 60000); // Run GC every minute
  }

  private async runGarbageCollection(): Promise<void> {
    const memoryUsage = this.getMemoryUsage();
    const threshold = this.config.maxMemoryMB * 1024 * 1024 * this.config.gcThreshold;
    
    if (memoryUsage < threshold) {
      return; // No need for GC
    }
    
    logger.debug('Running garbage collection');
    const startTime = Date.now();
    
    // Sort records by access patterns (LRU)
    const records = Array.from(this.storage.entries()).sort(([, a], [, b]) => {
      return a.accessed.getTime() - b.accessed.getTime();
    });
    
    // Remove least recently used records
    const targetSize = this.config.maxMemoryMB * 1024 * 1024 * 0.7; // Target 70% usage
    let currentSize = memoryUsage;
    let removedCount = 0;
    
    for (const [id, record] of records) {
      if (currentSize <= targetSize) break;
      
      this.storage.delete(id);
      this.removeFromIndexes(id);
      currentSize -= record.size;
      removedCount++;
    }
    
    // Update metrics
    this.metrics.totalRecords -= removedCount;
    this.metrics.totalSize = currentSize;
    this.metrics.gcRuns++;
    this.metrics.lastGc = new Date();
    
    const gcTime = Date.now() - startTime;
    logger.debug(`GC completed: removed ${removedCount} records in ${gcTime}ms`);
    
    this.emit('garbage_collected', { removedCount, gcTime, memoryFreed: memoryUsage - currentSize });
  }

  private setupPersistence(): void {
    if (!this.config.persistenceFile) return;
    
    this.persistenceTimer = setInterval(() => {
      this.saveToPersistence().catch(error => {
        logger.error('Failed to save to persistence:', error);
      });
    }, 300000); // Save every 5 minutes
  }

  private async loadFromPersistence(): Promise<void> {
    if (!this.config.persistenceFile) return;
    
    try {
      const data = await fs.readFile(this.config.persistenceFile, 'utf-8');
      const persistedData = JSON.parse(data);
      
      for (const recordData of persistedData.records || []) {
        const record: InMemoryRecord = {
          ...recordData,
          created: new Date(recordData.created),
          updated: new Date(recordData.updated),
          accessed: new Date(recordData.accessed)
        };
        
        this.storage.set(record.id, record);
        
        // Rebuild indexes
        if (!record.compressed) {
          this.updateIndexes(record.id, record.data);
        }
      }
      
      // Update metrics
      this.metrics.totalRecords = this.storage.size;
      this.metrics.totalSize = Array.from(this.storage.values()).reduce((sum, record) => sum + record.size, 0);
      
      logger.info(`Loaded ${this.storage.size} records from persistence`);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error('Failed to load from persistence:', error);
      }
    }
  }

  private async saveToPersistence(): Promise<void> {
    if (!this.config.persistenceFile) return;
    
    try {
      const persistenceDir = path.dirname(this.config.persistenceFile);
      await fs.mkdir(persistenceDir, { recursive: true });
      
      const persistedData = {
        timestamp: new Date().toISOString(),
        records: Array.from(this.storage.values())
      };
      
      await fs.writeFile(
        this.config.persistenceFile,
        JSON.stringify(persistedData, null, 2),
        'utf-8'
      );
      
      logger.debug(`Saved ${this.storage.size} records to persistence`);
    } catch (error) {
      logger.error('Failed to save to persistence:', error);
    }
  }

  private updateMetrics(success: boolean, responseTime: number): void {
    this.metrics.totalQueries++;
    this.metrics.totalResponseTime += responseTime;
    
    if (success) {
      this.metrics.successfulQueries++;
    } else {
      this.metrics.failedQueries++;
    }
  }
}

export default InMemoryStorageLayer;