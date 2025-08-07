/**
 * Query Router
 * 
 * Implements intelligent query routing for the Hybrid Storage Manager
 * to optimize query performance across different storage layers.
 */

import { EventEmitter } from 'events';
import logger from '../../../utils/logger';
import {
  QueryRouterConfig,
  QueryRequest,
  QueryRoute,
  QueryMetrics,
  StorageLayer,
  QueryType,
  QueryComplexity,
  RoutingDecision,
  QueryError
} from './types';

export class QueryRouter extends EventEmitter {
  private routingRules: Map<string, QueryRoute> = new Map();
  private performanceMetrics: Map<StorageLayer, QueryMetrics> = new Map();
  private metricsCollectionTimer?: NodeJS.Timeout | undefined;

  constructor(_config: QueryRouterConfig) {
    super();
    this.initializeRoutingRules();
    this.initializeMetrics();
    this.setupMetricsCollection();
  }

  /**
   * Initialize the query router
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Query Router');
      
      // Initialize performance metrics for all storage layers
      for (const layer of Object.values(StorageLayer)) {
        this.performanceMetrics.set(layer, this.createEmptyMetrics());
      }
      
      logger.info('Query Router initialized successfully');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize Query Router:', error);
      throw error;
    }
  }

  /**
   * Route a query to the optimal storage layer
   */
  async routeQuery(request: QueryRequest): Promise<RoutingDecision> {
    try {
      const startTime = Date.now();
      
      // Analyze query characteristics
      const queryAnalysis = this.analyzeQuery(request);
      
      // Determine optimal storage layer
      const optimalLayer = this.selectOptimalLayer(queryAnalysis, request);
      
      // Create routing decision
      const decision: RoutingDecision = {
        primaryLayer: optimalLayer,
        fallbackLayers: this.getFallbackLayers(optimalLayer, queryAnalysis),
        reasoning: this.generateRoutingReasoning(optimalLayer, queryAnalysis),
        estimatedLatency: this.estimateLatency(optimalLayer, queryAnalysis),
        cacheStrategy: this.determineCacheStrategy(queryAnalysis),
        queryId: this.generateQueryId(request)
      };
      
      // Update routing metrics
      this.updateRoutingMetrics(decision, Date.now() - startTime);
      
      this.emit('query_routed', { request, decision });
      
      return decision;
    } catch (error) {
      logger.error('Failed to route query:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new QueryError(`Query routing failed: ${errorMessage}`, request.query, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Update performance metrics for a storage layer
   */
  updatePerformanceMetrics(
    layer: StorageLayer,
    latency: number,
    success: boolean,
    resultSize?: number
  ): void {
    const metrics = this.performanceMetrics.get(layer);
    if (!metrics) return;

    metrics.totalQueries++;
    metrics.totalLatency += latency;
    metrics.averageLatency = metrics.totalLatency / metrics.totalQueries;
    
    if (success) {
      metrics.successfulQueries++;
    } else {
      metrics.failedQueries++;
    }
    
    metrics.successRate = metrics.successfulQueries / metrics.totalQueries;
    
    if (resultSize !== undefined) {
      metrics.totalResultSize += resultSize;
      metrics.averageResultSize = metrics.totalResultSize / metrics.successfulQueries;
    }
    
    // Update min/max latency
    if (latency < metrics.minLatency || metrics.minLatency === 0) {
      metrics.minLatency = latency;
    }
    if (latency > metrics.maxLatency) {
      metrics.maxLatency = latency;
    }
    
    this.emit('metrics_updated', { layer, metrics });
  }

  /**
   * Get performance metrics for all storage layers
   */
  getPerformanceMetrics(): Map<StorageLayer, QueryMetrics> {
    return new Map(this.performanceMetrics);
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [layer, metrics] of this.performanceMetrics) {
      stats[layer] = {
        totalQueries: metrics.totalQueries,
        successRate: metrics.successRate,
        averageLatency: metrics.averageLatency,
        minLatency: metrics.minLatency,
        maxLatency: metrics.maxLatency,
        averageResultSize: metrics.averageResultSize
      };
    }
    
    return stats;
  }

  /**
   * Add custom routing rule
   */
  addRoutingRule(ruleId: string, route: QueryRoute): void {
    this.routingRules.set(ruleId, route);
    logger.debug(`Added routing rule: ${ruleId}`);
    this.emit('routing_rule_added', { ruleId, route });
  }

  /**
   * Remove routing rule
   */
  removeRoutingRule(ruleId: string): boolean {
    const removed = this.routingRules.delete(ruleId);
    if (removed) {
      logger.debug(`Removed routing rule: ${ruleId}`);
      this.emit('routing_rule_removed', { ruleId });
    }
    return removed;
  }

  /**
   * Shutdown the query router
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Query Router');
      
      if (this.metricsCollectionTimer) {
        clearInterval(this.metricsCollectionTimer);
        this.metricsCollectionTimer = undefined;
      }
      
      this.routingRules.clear();
      this.performanceMetrics.clear();
      
      logger.info('Query Router shutdown completed');
      this.emit('shutdown');
    } catch (error) {
      logger.error('Query Router shutdown failed:', error);
      throw error;
    }
  }

  // Private helper methods

  private initializeRoutingRules(): void {
    // Default routing rules based on query types
    
    // Simple lookups go to cache first, then in-memory
    this.routingRules.set('simple_lookup', {
      condition: (req) => req.type === QueryType.SIMPLE_LOOKUP,
      primaryLayer: StorageLayer.CACHE,
      fallbackLayers: [StorageLayer.IN_MEMORY, StorageLayer.NEO4J],
      priority: 1
    });
    
    // Complex graph queries go to Neo4j
    this.routingRules.set('graph_traversal', {
      condition: (req) => req.type === QueryType.GRAPH_TRAVERSAL,
      primaryLayer: StorageLayer.NEO4J,
      fallbackLayers: [StorageLayer.IN_MEMORY],
      priority: 1
    });
    
    // Full-text search goes to appropriate layer
    this.routingRules.set('full_text_search', {
      condition: (req) => req.type === QueryType.FULL_TEXT_SEARCH,
      primaryLayer: StorageLayer.NEO4J,
      fallbackLayers: [StorageLayer.RDF_FILES],
      priority: 1
    });
    
    // Aggregation queries go to Neo4j
    this.routingRules.set('aggregation', {
      condition: (req) => req.type === QueryType.AGGREGATION,
      primaryLayer: StorageLayer.NEO4J,
      fallbackLayers: [StorageLayer.IN_MEMORY],
      priority: 1
    });
    
    // Pattern matching goes to in-memory for speed
    this.routingRules.set('pattern_matching', {
      condition: (req) => req.type === QueryType.PATTERN_MATCHING,
      primaryLayer: StorageLayer.IN_MEMORY,
      fallbackLayers: [StorageLayer.NEO4J],
      priority: 1
    });
  }

  private initializeMetrics(): void {
    for (const layer of Object.values(StorageLayer)) {
      this.performanceMetrics.set(layer, this.createEmptyMetrics());
    }
  }

  private createEmptyMetrics(): QueryMetrics {
    return {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      totalLatency: 0,
      averageLatency: 0,
      minLatency: 0,
      maxLatency: 0,
      successRate: 0,
      totalResultSize: 0,
      averageResultSize: 0
    };
  }

  private setupMetricsCollection(): void {
    this.metricsCollectionTimer = setInterval(() => {
      this.collectAndEmitMetrics();
    }, 30000); // Collect every 30 seconds
    
    // Ensure timer doesn't keep Node.js process alive
    this.metricsCollectionTimer.unref();
  }

  private collectAndEmitMetrics(): void {
    const allMetrics = this.getPerformanceMetrics();
    this.emit('metrics_collected', { metrics: allMetrics, timestamp: new Date() });
  }

  private analyzeQuery(request: QueryRequest): {
    complexity: QueryComplexity;
    estimatedResultSize: number;
    requiresJoins: boolean;
    requiresAggregation: boolean;
    isCacheable: boolean;
  } {
    const query = request.query.toLowerCase();
    
    // Analyze query complexity
    let complexity = QueryComplexity.LOW;
    if (query.includes('join') || query.includes('match') && query.includes('where')) {
      complexity = QueryComplexity.MEDIUM;
    }
    if (query.includes('collect') || query.includes('count') || query.includes('sum') || 
        query.includes('avg') || query.includes('max') || query.includes('min')) {
      complexity = QueryComplexity.HIGH;
    }
    
    // Estimate result size based on query patterns
    let estimatedResultSize = 100; // Default
    if (query.includes('limit')) {
      const limitMatch = query.match(/limit\s+(\d+)/);
      if (limitMatch) {
        estimatedResultSize = parseInt(limitMatch[1]);
      }
    } else if (query.includes('*') || query.includes('all')) {
      estimatedResultSize = 10000; // Large result set
    }
    
    // Check for joins and aggregations
    const requiresJoins = query.includes('join') || (query.includes('match') && query.includes('-'));
    const requiresAggregation = query.includes('collect') || query.includes('count') || 
                               query.includes('sum') || query.includes('avg');
    
    // Determine if cacheable
    const isCacheable = !query.includes('now()') && !query.includes('rand()') && 
                       !query.includes('timestamp') && complexity !== QueryComplexity.HIGH;
    
    return {
      complexity,
      estimatedResultSize,
      requiresJoins,
      requiresAggregation,
      isCacheable
    };
  }

  private selectOptimalLayer(
    analysis: ReturnType<typeof this.analyzeQuery>,
    request: QueryRequest
  ): StorageLayer {
    // Check custom routing rules first
    for (const [ruleId, rule] of this.routingRules) {
      if (rule.condition(request)) {
        logger.debug(`Query matched routing rule: ${ruleId}`);
        return rule.primaryLayer;
      }
    }
    
    // Default routing logic based on analysis
    if (analysis.isCacheable && analysis.complexity === QueryComplexity.LOW) {
      return StorageLayer.CACHE;
    }
    
    if (analysis.requiresAggregation || analysis.complexity === QueryComplexity.HIGH) {
      return StorageLayer.NEO4J;
    }
    
    if (analysis.requiresJoins || request.type === QueryType.GRAPH_TRAVERSAL) {
      return StorageLayer.NEO4J;
    }
    
    if (analysis.estimatedResultSize < 1000 && analysis.complexity === QueryComplexity.LOW) {
      return StorageLayer.IN_MEMORY;
    }
    
    // Default to Neo4j for complex queries
    return StorageLayer.NEO4J;
  }

  private getFallbackLayers(
    primaryLayer: StorageLayer,
    analysis: ReturnType<typeof this.analyzeQuery>
  ): StorageLayer[] {
    const fallbacks: StorageLayer[] = [];
    
    switch (primaryLayer) {
      case StorageLayer.CACHE:
        fallbacks.push(StorageLayer.IN_MEMORY, StorageLayer.NEO4J);
        break;
      case StorageLayer.IN_MEMORY:
        fallbacks.push(StorageLayer.NEO4J);
        if (analysis.isCacheable) {
          fallbacks.unshift(StorageLayer.CACHE);
        }
        break;
      case StorageLayer.NEO4J:
        if (analysis.complexity === QueryComplexity.LOW) {
          fallbacks.push(StorageLayer.IN_MEMORY);
        }
        break;
      case StorageLayer.RDF_FILES:
        fallbacks.push(StorageLayer.NEO4J, StorageLayer.IN_MEMORY);
        break;
    }
    
    return fallbacks;
  }

  private generateRoutingReasoning(
    layer: StorageLayer,
    analysis: ReturnType<typeof this.analyzeQuery>
  ): string {
    const reasons: string[] = [];
    
    switch (layer) {
      case StorageLayer.CACHE:
        reasons.push('Query is cacheable and has low complexity');
        break;
      case StorageLayer.IN_MEMORY:
        reasons.push('Query has low complexity and small result set');
        break;
      case StorageLayer.NEO4J:
        if (analysis.requiresAggregation) {
          reasons.push('Query requires aggregation operations');
        }
        if (analysis.requiresJoins) {
          reasons.push('Query requires complex joins');
        }
        if (analysis.complexity === QueryComplexity.HIGH) {
          reasons.push('Query has high complexity');
        }
        break;
      case StorageLayer.RDF_FILES:
        reasons.push('Query requires direct RDF file access');
        break;
    }
    
    return reasons.join('; ');
  }

  private estimateLatency(
    layer: StorageLayer,
    analysis: ReturnType<typeof this.analyzeQuery>
  ): number {
    const metrics = this.performanceMetrics.get(layer);
    const baseLatency = metrics?.averageLatency || this.getDefaultLatency(layer);
    
    // Adjust based on complexity
    let multiplier = 1;
    switch (analysis.complexity) {
      case QueryComplexity.LOW:
        multiplier = 1;
        break;
      case QueryComplexity.MEDIUM:
        multiplier = 2;
        break;
      case QueryComplexity.HIGH:
        multiplier = 4;
        break;
    }
    
    // Adjust based on result size
    if (analysis.estimatedResultSize > 1000) {
      multiplier *= 1.5;
    }
    
    return Math.round(baseLatency * multiplier);
  }

  private getDefaultLatency(layer: StorageLayer): number {
    switch (layer) {
      case StorageLayer.CACHE:
        return 1; // 1ms
      case StorageLayer.IN_MEMORY:
        return 5; // 5ms
      case StorageLayer.NEO4J:
        return 50; // 50ms
      case StorageLayer.RDF_FILES:
        return 100; // 100ms
      default:
        return 50;
    }
  }

  private determineCacheStrategy(
    analysis: ReturnType<typeof this.analyzeQuery>
  ): 'none' | 'short' | 'medium' | 'long' {
    if (!analysis.isCacheable) {
      return 'none';
    }
    
    if (analysis.complexity === QueryComplexity.LOW && analysis.estimatedResultSize < 100) {
      return 'long';
    }
    
    if (analysis.complexity === QueryComplexity.MEDIUM) {
      return 'medium';
    }
    
    return 'short';
  }

  private generateQueryId(request: QueryRequest): string {
    const hash = require('crypto')
      .createHash('md5')
      .update(request.query + JSON.stringify(request.parameters || {}))
      .digest('hex');
    return `query_${hash.substring(0, 8)}`;
  }

  private updateRoutingMetrics(decision: RoutingDecision, routingTime: number): void {
    // This could be expanded to track routing-specific metrics
    logger.debug(`Query routed to ${decision.primaryLayer} in ${routingTime}ms`);
  }
}

export default QueryRouter;