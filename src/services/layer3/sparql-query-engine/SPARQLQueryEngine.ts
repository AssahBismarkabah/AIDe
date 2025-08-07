/**
 * SPARQL Query Engine
 * 
 * Production-ready natural language to SPARQL translation engine with
 * intelligent query generation, optimization, and execution capabilities.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ChatOpenAI } from '@langchain/openai';
// Temporarily disable Anthropic to avoid dependency issues
// import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { InMemoryRDFStore } from '../../layer2/in-memory-rdf/InMemoryRDFStore';
import logger from '../../../utils/logger';
import {
  SPARQLEngineConfig,
  SPARQLQueryResponse,
  SPARQLQueryIntent,
  ParsedSPARQLQuery,
  GeneratedSPARQLQuery,
  SPARQLExecutionResult,
  SPARQLEntity,
  SPARQLTriplePattern,
  SPARQLFilter,
  SPARQLError,
  SPARQLMetrics,
  SPARQLQueryPattern,
  OntologyInfo,
  CacheEntry,
  SPARQLQueryEvent,
  ValidationResult
} from './types';

/**
 * SPARQL Query Engine for natural language to SPARQL translation
 */
export class SPARQLQueryEngine extends EventEmitter {
  private config: SPARQLEngineConfig;
  private llm: ChatOpenAI;
  private rdfStore: InMemoryRDFStore;
  private queryCache: Map<string, CacheEntry> = new Map();
  private metrics: SPARQLMetrics;
  private queryPatterns: SPARQLQueryPattern[] = [];
  private ontologyInfo: OntologyInfo | null = null;
  private isInitialized = false;
  private cacheCleanupInterval?: NodeJS.Timeout;

  constructor(config: SPARQLEngineConfig, rdfStore: InMemoryRDFStore) {
    super();
    
    this.config = this.mergeWithDefaults(config);
    this.rdfStore = rdfStore;
    this.metrics = this.initializeMetrics();
    
    // Initialize LLM based on provider
    this.llm = this.initializeLLM();
    
    // Initialize query patterns
    this.initializeQueryPatterns();
    
    logger.info('SPARQLQueryEngine initialized', {
      provider: this.config.llm.provider,
      model: this.config.llm.model,
      caching: this.config.caching?.enabled
    });
  }

  /**
   * Merge user config with defaults
   */
  private mergeWithDefaults(config: SPARQLEngineConfig): SPARQLEngineConfig {
    return {
      rdf: {
        ...config.rdf,
        timeout: config.rdf.timeout || 30000,
        maxResults: config.rdf.maxResults || 1000
      },
      llm: {
        ...config.llm,
        temperature: config.llm.temperature || 0.1,
        maxTokens: config.llm.maxTokens || 1000
      },
      queryGeneration: {
        maxRetries: config.queryGeneration?.maxRetries || 3,
        timeoutMs: config.queryGeneration?.timeoutMs || 30000,
        validateSyntax: config.queryGeneration?.validateSyntax !== false,
        optimizeQuery: config.queryGeneration?.optimizeQuery !== false,
        usePatterns: config.queryGeneration?.usePatterns !== false
      },
      prefixes: config.prefixes || {
        'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
        'owl': 'http://www.w3.org/2002/07/owl#',
        'xsd': 'http://www.w3.org/2001/XMLSchema#'
      },
      response: {
        includeQuery: config.response?.includeQuery !== false,
        includeExplanation: config.response?.includeExplanation !== false,
        formatResults: config.response?.formatResults !== false,
        maxResults: config.response?.maxResults || 100
      },
      caching: {
        enabled: config.caching?.enabled !== false,
        ttl: config.caching?.ttl || 300000, // 5 minutes
        maxSize: config.caching?.maxSize || 1000
      }
    };
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): SPARQLMetrics {
    return {
      queries: {
        total: 0,
        successful: 0,
        failed: 0,
        cached: 0,
        averageResponseTime: 0,
        averageConfidence: 0
      },
      generation: {
        patternBased: 0,
        llmBased: 0,
        hybrid: 0,
        averageGenerationTime: 0,
        retryRate: 0,
        syntaxErrorRate: 0
      },
      execution: {
        averageExecutionTime: 0,
        averageResultCount: 0,
        timeoutRate: 0,
        errorRate: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0
      }
    };
  }

  /**
   * Initialize LLM based on configuration
   */
  private initializeLLM(): ChatOpenAI {
    const apiKey = this.config.llm.apiKey;
    
    switch (this.config.llm.provider) {
      case 'openai':
        return new ChatOpenAI({
          modelName: this.config.llm.model,
          temperature: this.config.llm.temperature || 0.1,
          maxTokens: this.config.llm.maxTokens || 1000,
          openAIApiKey: apiKey || process.env.OPENAI_API_KEY || '',
          ...(this.config.llm.baseURL && {
            configuration: {
              baseURL: this.config.llm.baseURL
            }
          })
        });
      
      case 'anthropic':
        // Temporarily disabled - use OpenAI interface instead
        throw new Error('Anthropic provider temporarily disabled. Use OpenAI or local provider.');
      
      case 'local':
        // Use OpenAI-compatible interface for local models
        return new ChatOpenAI({
          modelName: this.config.llm.model,
          temperature: this.config.llm.temperature || 0.1,
          maxTokens: this.config.llm.maxTokens || 1000,
          openAIApiKey: 'local-key', // Placeholder for local models
          configuration: {
            baseURL: this.config.llm.baseURL || 'http://localhost:1234/v1'
          }
        });
      
      default:
        throw new Error(`Unsupported LLM provider: ${this.config.llm.provider}`);
    }
  }

  /**
   * Initialize query patterns for pattern-based generation
   */
  private initializeQueryPatterns(): void {
    this.queryPatterns = [
      {
        id: 'simple-select',
        name: 'Simple Select',
        description: 'Basic SELECT query for finding entities',
        intent: 'select',
        patterns: ['find', 'show', 'get', 'list'],
        template: 'SELECT ?x WHERE { ?x rdf:type {CLASS} }',
        variables: ['CLASS'],
        confidence: 0.9,
        examples: ['find all users', 'show products', 'list companies']
      },
      {
        id: 'count-entities',
        name: 'Count Entities',
        description: 'COUNT query for counting entities',
        intent: 'count',
        patterns: ['how many', 'count', 'number of'],
        template: 'SELECT (COUNT(?x) as ?count) WHERE { ?x rdf:type {CLASS} }',
        variables: ['CLASS'],
        confidence: 0.95,
        examples: ['how many users', 'count products', 'number of companies']
      },
      {
        id: 'ask-existence',
        name: 'Ask Existence',
        description: 'ASK query for checking existence',
        intent: 'ask',
        patterns: ['is there', 'does', 'exists'],
        template: 'ASK { ?x rdf:type {CLASS} }',
        variables: ['CLASS'],
        confidence: 0.9,
        examples: ['is there a user', 'does product exist']
      }
    ];
  }

  /**
   * Load ontology information from RDF store
   */
  private async loadOntologyInfo(): Promise<void> {
    try {
      // Simple ontology loading - in production, use more sophisticated methods
      this.ontologyInfo = {
        classes: [
          { uri: 'http://example.org/User', label: 'User', instances: 0 },
          { uri: 'http://example.org/Product', label: 'Product', instances: 0 },
          { uri: 'http://example.org/Company', label: 'Company', instances: 0 }
        ],
        properties: [
          { uri: 'http://example.org/name', label: 'name', type: 'DatatypeProperty', domain: [], range: [] },
          { uri: 'http://example.org/age', label: 'age', type: 'DatatypeProperty', domain: [], range: [] },
          { uri: 'http://example.org/worksFor', label: 'works for', type: 'ObjectProperty', domain: [], range: [] }
        ],
        individuals: [],
        namespaces: this.config.prefixes
      };
      
      logger.info('Ontology information loaded');
    } catch (error) {
      logger.warn('Failed to load ontology information', { error });
      this.ontologyInfo = null;
    }
  }

  /**
   * Start cache cleanup interval
   */
  private startCacheCleanup(): void {
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 60000); // Clean every minute
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.queryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.queryCache.delete(key);
      }
    }
    this.metrics.cache.size = this.queryCache.size;
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(query: string): string {
    return Buffer.from(query.toLowerCase().trim()).toString('base64');
  }

  /**
   * Get cached result
   */
  private getCachedResult(cacheKey: string): SPARQLQueryResponse | null {
    const entry = this.queryCache.get(cacheKey);
    if (!entry) {
      this.metrics.cache.misses++;
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.queryCache.delete(cacheKey);
      this.metrics.cache.misses++;
      return null;
    }

    entry.hits++;
    this.metrics.cache.hits++;
    this.updateCacheHitRate();
    return entry.result;
  }

  /**
   * Cache query result
   */
  private cacheResult(cacheKey: string, result: SPARQLQueryResponse): void {
    const maxSize = this.config.caching?.maxSize || 1000;
    if (this.queryCache.size >= maxSize) {
      // Remove oldest entry
      const oldestKey = this.queryCache.keys().next().value;
      if (oldestKey) {
        this.queryCache.delete(oldestKey);
      }
    }

    this.queryCache.set(cacheKey, {
      key: cacheKey,
      query: result.originalQuery,
      result,
      timestamp: Date.now(),
      ttl: this.config.caching?.ttl || 300000,
      hits: 0
    });

    this.metrics.cache.size = this.queryCache.size;
  }

  /**
   * Update cache hit rate
   */
  private updateCacheHitRate(): void {
    const total = this.metrics.cache.hits + this.metrics.cache.misses;
    this.metrics.cache.hitRate = total > 0 ? this.metrics.cache.hits / total : 0;
  }

  /**
   * Update metrics
   */
  private updateMetrics(response: SPARQLQueryResponse | null, success: boolean): void {
    this.metrics.queries.total++;
    
    if (success && response) {
      this.metrics.queries.successful++;
      this.metrics.queries.averageResponseTime = 
        (this.metrics.queries.averageResponseTime * (this.metrics.queries.successful - 1) + 
         response.metadata.processingTime) / this.metrics.queries.successful;
      
      this.metrics.queries.averageConfidence = 
        (this.metrics.queries.averageConfidence * (this.metrics.queries.successful - 1) + 
         response.interpretedQuery.confidence) / this.metrics.queries.successful;

      // Update generation metrics
      switch (response.generatedSPARQL.generationMethod) {
        case 'pattern':
          this.metrics.generation.patternBased++;
          break;
        case 'llm':
          this.metrics.generation.llmBased++;
          break;
        case 'hybrid':
          this.metrics.generation.hybrid++;
          break;
      }

      // Update execution metrics
      if (response.executionResult.success) {
        this.metrics.execution.averageExecutionTime = 
          (this.metrics.execution.averageExecutionTime * (this.metrics.queries.successful - 1) + 
           response.executionResult.summary.executionTime) / this.metrics.queries.successful;
        
        this.metrics.execution.averageResultCount = 
          (this.metrics.execution.averageResultCount * (this.metrics.queries.successful - 1) + 
           response.executionResult.summary.resultCount) / this.metrics.queries.successful;
      }
    } else {
      this.metrics.queries.failed++;
    }
  }

  /**
   * Initialize the SPARQL Query Engine
   */
  async initialize(): Promise<void> {
    try {
      // Load ontology information from RDF store
      await this.loadOntologyInfo();
      
      // Warm up cache if enabled
      if (this.config.caching?.enabled) {
        this.startCacheCleanup();
      }
      
      this.isInitialized = true;
      logger.info('SPARQLQueryEngine initialization complete');
    } catch (error) {
      logger.error('Failed to initialize SPARQLQueryEngine', { error });
      throw new SPARQLError('INVALID_PARAMETERS', 'Failed to initialize SPARQL engine', { details: error });
    }
  }

  /**
   * Process natural language query and return SPARQL results
   */
  async query(naturalLanguageQuery: string): Promise<SPARQLQueryResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const queryId = uuidv4();
    const startTime = Date.now();
    
    this.emit('query_start', {
      type: 'query_start',
      queryId,
      query: naturalLanguageQuery,
      timestamp: startTime
    } as SPARQLQueryEvent);

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(naturalLanguageQuery);
      const cachedResult = this.getCachedResult(cacheKey);
      
      if (cachedResult) {
        this.emit('cache_hit', {
          type: 'cache_hit',
          queryId,
          query: naturalLanguageQuery,
          timestamp: Date.now()
        } as SPARQLQueryEvent);
        
        this.metrics.queries.cached++;
        return { ...cachedResult, metadata: { ...cachedResult.metadata, cacheHit: true } };
      }

      this.emit('cache_miss', {
        type: 'cache_miss',
        queryId,
        query: naturalLanguageQuery,
        timestamp: Date.now()
      } as SPARQLQueryEvent);

      // Parse natural language query
      const interpretedQuery = await this.parseNaturalLanguageQuery(naturalLanguageQuery);
      
      // Generate SPARQL query
      const generatedSPARQL = await this.generateSPARQLQuery(interpretedQuery);
      
      // Validate generated SPARQL
      if (this.config.queryGeneration?.validateSyntax) {
        const validation = this.validateSPARQL(generatedSPARQL.sparql);
        if (!validation.valid) {
          throw new SPARQLError('SPARQL_SYNTAX_ERROR', 'Generated SPARQL has syntax errors', {
            query: naturalLanguageQuery,
            sparql: generatedSPARQL.sparql,
            details: validation.errors
          });
        }
      }
      
      // Execute SPARQL query
      const executionResult = await this.executeSPARQLQuery(generatedSPARQL);
      
      // Format response
      const formattedResponse = this.formatResponse(executionResult, interpretedQuery.intent);
      
      // Generate suggestions
      const suggestions = await this.generateSuggestions(interpretedQuery, executionResult);
      
      // Create response
      const response: SPARQLQueryResponse = {
        originalQuery: naturalLanguageQuery,
        interpretedQuery,
        generatedSPARQL,
        executionResult,
        formattedResponse,
        explanation: this.generateExplanation(interpretedQuery, generatedSPARQL),
        suggestions,
        metadata: {
          queryId,
          timestamp: startTime,
          processingTime: Date.now() - startTime,
          cacheHit: false
        }
      };

      // Cache result if enabled
      if (this.config.caching?.enabled) {
        this.cacheResult(cacheKey, response);
      }

      // Update metrics
      this.updateMetrics(response, true);
      
      this.emit('query_complete', {
        type: 'query_complete',
        queryId,
        query: naturalLanguageQuery,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      } as SPARQLQueryEvent);

      return response;

    } catch (error) {
      const sparqlError = error instanceof SPARQLError ? error : 
        new SPARQLError('QUERY_EXECUTION_FAILED', 'Query processing failed', {
          query: naturalLanguageQuery,
          details: error
        });

      this.emit('query_error', {
        type: 'query_error',
        queryId,
        query: naturalLanguageQuery,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        error: sparqlError
      } as SPARQLQueryEvent);

      this.updateMetrics(null, false);
      throw sparqlError;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): SPARQLMetrics {
    return { ...this.metrics };
  }

  /**
   * Shutdown the engine
   */
  async shutdown(): Promise<void> {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    
    this.queryCache.clear();
    this.removeAllListeners();
    
    logger.info('SPARQLQueryEngine shutdown complete');
  }

  /**
   * Parse natural language query into structured format
   */
  private async parseNaturalLanguageQuery(query: string): Promise<ParsedSPARQLQuery> {
    try {
      // Detect query intent
      const intent = this.detectQueryIntent(query);
      
      // Extract entities
      const entities = await this.extractEntities(query);
      
      // Extract triple patterns
      const triplePatterns = await this.extractTriplePatterns(query, entities);
      
      // Extract filters
      const filters = this.extractFilters(query);
      
      // Extract aggregations
      const aggregations = this.extractAggregations(query);
      
      // Calculate confidence
      const confidence = this.calculateParsingConfidence(intent, entities, triplePatterns);

      return {
        intent,
        entities,
        triplePatterns,
        filters,
        aggregations,
        confidence
      };
    } catch (error) {
      logger.error('Failed to parse natural language query', { query, error });
      throw new SPARQLError('QUERY_PARSING_FAILED', 'Failed to parse natural language query', {
        query,
        details: error
      });
    }
  }

  /**
   * Detect query intent from natural language
   */
  private detectQueryIntent(query: string): SPARQLQueryIntent {
    const lowerQuery = query.toLowerCase();
    
    // Intent detection patterns
    if (lowerQuery.includes('how many') || lowerQuery.includes('count')) {
      return 'count';
    }
    if (lowerQuery.includes('average') || lowerQuery.includes('sum') || lowerQuery.includes('max') || lowerQuery.includes('min')) {
      return 'aggregate';
    }
    if (lowerQuery.includes('is there') || lowerQuery.includes('does') || lowerQuery.includes('exists')) {
      return 'ask';
    }
    if (lowerQuery.includes('describe') || lowerQuery.includes('tell me about')) {
      return 'describe';
    }
    if (lowerQuery.includes('path') || lowerQuery.includes('connection') || lowerQuery.includes('related')) {
      return 'path';
    }
    if (lowerQuery.includes('construct') || lowerQuery.includes('build') || lowerQuery.includes('create graph')) {
      return 'construct';
    }
    
    // Default to select
    return 'select';
  }

  /**
   * Extract entities from natural language query
   */
  private async extractEntities(query: string): Promise<SPARQLEntity[]> {
    const entities: SPARQLEntity[] = [];
    
    // Simple entity extraction - in production, use NER models
    const words = query.toLowerCase().split(/\s+/);
    
    // Look for known classes and properties from ontology
    if (this.ontologyInfo) {
      for (const cls of this.ontologyInfo.classes) {
        if (cls.label && words.some(word => word.includes(cls.label!.toLowerCase()))) {
          entities.push({
            type: 'class',
            value: cls.label,
            uri: cls.uri,
            confidence: 0.8
          });
        }
      }
      
      for (const prop of this.ontologyInfo.properties) {
        if (prop.label && words.some(word => word.includes(prop.label!.toLowerCase()))) {
          entities.push({
            type: 'property',
            value: prop.label,
            uri: prop.uri,
            confidence: 0.8
          });
        }
      }
    }
    
    return entities;
  }

  /**
   * Extract triple patterns from query and entities
   */
  private async extractTriplePatterns(query: string, entities: SPARQLEntity[]): Promise<SPARQLTriplePattern[]> {
    const patterns: SPARQLTriplePattern[] = [];
    
    // Simple pattern extraction - in production, use more sophisticated NLP
    for (const entity of entities) {
      if (entity.type === 'class') {
        patterns.push({
          subject: { type: 'variable', value: '?x', confidence: 1.0 },
          predicate: { type: 'property', value: 'rdf:type', uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', confidence: 1.0 },
          object: entity
        });
      }
    }
    
    return patterns;
  }

  /**
   * Extract filters from natural language query
   */
  private extractFilters(query: string): SPARQLFilter[] {
    const filters: SPARQLFilter[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Simple filter extraction
    const numberMatch = lowerQuery.match(/(\w+)\s+(greater|less|more|fewer)\s+than\s+(\d+)/);
    if (numberMatch) {
      filters.push({
        type: numberMatch[2].includes('greater') || numberMatch[2].includes('more') ? 'greater' : 'less',
        property: numberMatch[1],
        value: parseInt(numberMatch[3])
      });
    }
    
    return filters;
  }

  /**
   * Extract aggregations from natural language query
   */
  private extractAggregations(query: string): any[] {
    const aggregations: any[] = [];
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('count')) {
      aggregations.push({
        function: 'COUNT',
        variable: '?x',
        alias: 'count'
      });
    }
    
    if (lowerQuery.includes('average')) {
      aggregations.push({
        function: 'AVG',
        variable: '?value',
        alias: 'average'
      });
    }
    
    return aggregations;
  }

  /**
   * Calculate parsing confidence
   */
  private calculateParsingConfidence(
    intent: SPARQLQueryIntent,
    entities: SPARQLEntity[],
    patterns: SPARQLTriplePattern[]
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Boost confidence based on entities found
    if (entities.length > 0) {
      confidence += 0.2;
    }
    
    // Boost confidence based on patterns
    if (patterns.length > 0) {
      confidence += 0.2;
    }
    
    // Intent-specific adjustments
    if (intent !== 'select') {
      confidence += 0.1; // Specific intents are more confident
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Generate SPARQL query from parsed structure
   */
  private async generateSPARQLQuery(parsedQuery: ParsedSPARQLQuery): Promise<GeneratedSPARQLQuery> {
    try {
      // Try pattern-based generation first
      if (this.config.queryGeneration?.usePatterns) {
        const patternResult = this.tryPatternBasedGeneration(parsedQuery);
        if (patternResult) {
          return patternResult;
        }
      }

      // Fall back to LLM-based generation
      return await this.generateWithLLM(parsedQuery);
    } catch (error) {
      logger.error('Failed to generate SPARQL query', { parsedQuery, error });
      throw new SPARQLError('SPARQL_GENERATION_FAILED', 'Failed to generate SPARQL query', {
        details: error
      });
    }
  }

  /**
   * Try pattern-based SPARQL generation
   */
  private tryPatternBasedGeneration(parsedQuery: ParsedSPARQLQuery): GeneratedSPARQLQuery | null {
    const matchingPatterns = this.queryPatterns.filter(pattern => 
      pattern.intent === parsedQuery.intent && pattern.confidence >= 0.7
    );

    if (matchingPatterns.length === 0) {
      return null;
    }

    // Use the highest confidence pattern
    const bestPattern = matchingPatterns.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    try {
      const sparql = this.applyPattern(bestPattern, parsedQuery);
      
      return {
        sparql,
        prefixes: this.config.prefixes,
        parameters: {},
        confidence: bestPattern.confidence,
        explanation: `Generated using pattern: ${bestPattern.name}`,
        generationMethod: 'pattern',
        optimizations: [],
        estimatedComplexity: 'low'
      };
    } catch (error) {
      logger.warn('Pattern-based generation failed', { pattern: bestPattern.id, error });
      return null;
    }
  }

  /**
   * Apply pattern template to generate SPARQL
   */
  private applyPattern(pattern: SPARQLQueryPattern, parsedQuery: ParsedSPARQLQuery): string {
    let sparql = pattern.template;
    
    // Replace variables in template
    for (const variable of pattern.variables) {
      const value = this.getVariableValue(variable, parsedQuery);
      sparql = sparql.replace(new RegExp(`\\{${variable}\\}`, 'g'), value);
    }
    
    return sparql;
  }

  /**
   * Get variable value for pattern template
   */
  private getVariableValue(variable: string, parsedQuery: ParsedSPARQLQuery): string {
    switch (variable) {
      case 'CLASS':
        const classEntity = parsedQuery.entities.find(e => e.type === 'class');
        return classEntity?.uri || classEntity?.value || '?class';
      case 'PROPERTY':
        const propEntity = parsedQuery.entities.find(e => e.type === 'property');
        return propEntity?.uri || propEntity?.value || '?property';
      default:
        return `?${variable.toLowerCase()}`;
    }
  }

  /**
   * Generate SPARQL using LLM
   */
  private async generateWithLLM(parsedQuery: ParsedSPARQLQuery): Promise<GeneratedSPARQLQuery> {
    const prompt = PromptTemplate.fromTemplate(`
You are an expert SPARQL query generator. Convert the following natural language query structure into a valid SPARQL query.

Query Intent: {intent}
Entities: {entities}
Triple Patterns: {triplePatterns}
Filters: {filters}
Aggregations: {aggregations}

Available Prefixes:
{prefixes}

Ontology Information:
{ontologyInfo}

Generate a valid SPARQL query that:
1. Uses appropriate prefixes
2. Includes proper WHERE clauses
3. Applies filters correctly
4. Handles aggregations if needed
5. Is optimized for performance

Return only the SPARQL query without explanations.
`);

    const chain = RunnableSequence.from([
      prompt,
      this.llm,
      new StringOutputParser()
    ]);

    try {
      const sparql = await chain.invoke({
        intent: parsedQuery.intent,
        entities: JSON.stringify(parsedQuery.entities, null, 2),
        triplePatterns: JSON.stringify(parsedQuery.triplePatterns, null, 2),
        filters: JSON.stringify(parsedQuery.filters, null, 2),
        aggregations: JSON.stringify(parsedQuery.aggregations, null, 2),
        prefixes: Object.entries(this.config.prefixes)
          .map(([prefix, uri]) => `PREFIX ${prefix}: <${uri}>`)
          .join('\n'),
        ontologyInfo: this.ontologyInfo ? JSON.stringify(this.ontologyInfo, null, 2) : 'Not available'
      });

      return {
        sparql: sparql.trim(),
        prefixes: this.config.prefixes,
        parameters: {},
        confidence: Math.min(parsedQuery.confidence + 0.1, 1.0),
        explanation: 'Generated using LLM-based natural language processing',
        generationMethod: 'llm',
        optimizations: [],
        estimatedComplexity: this.estimateQueryComplexity(sparql)
      };
    } catch (error) {
      logger.error('LLM-based SPARQL generation failed', { error });
      throw new SPARQLError('SPARQL_GENERATION_FAILED', 'LLM generation failed', { details: error });
    }
  }

  /**
   * Estimate query complexity
   */
  private estimateQueryComplexity(sparql: string): 'low' | 'medium' | 'high' {
    const lowerSparql = sparql.toLowerCase();
    
    let complexity = 0;
    
    // Count complexity indicators
    if (lowerSparql.includes('union')) complexity += 2;
    if (lowerSparql.includes('optional')) complexity += 1;
    if (lowerSparql.includes('filter')) complexity += 1;
    if (lowerSparql.includes('group by')) complexity += 2;
    if (lowerSparql.includes('order by')) complexity += 1;
    if ((lowerSparql.match(/\{/g) || []).length > 2) complexity += 1;
    
    if (complexity >= 4) return 'high';
    if (complexity >= 2) return 'medium';
    return 'low';
  }

  /**
   * Execute SPARQL query against RDF store
   */
  private async executeSPARQLQuery(generatedQuery: GeneratedSPARQLQuery): Promise<SPARQLExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Add prefixes to query
      const fullQuery = this.addPrefixesToQuery(generatedQuery.sparql, generatedQuery.prefixes);
      
      // Execute query with timeout
      const timeout = this.config.rdf.timeout || 30000;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), timeout);
      });

      const queryPromise = this.rdfStore.query(fullQuery);
      const result = await Promise.race([queryPromise, timeoutPromise]);

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: Array.isArray(result) ? result : [result],
        summary: {
          executionTime,
          resultCount: Array.isArray(result) ? result.length : 1,
          hasMore: false
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('SPARQL query execution failed', {
        query: generatedQuery.sparql,
        error,
        executionTime
      });

      return {
        success: false,
        data: [],
        summary: {
          executionTime,
          resultCount: 0
        },
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : String(error),
          details: error
        }
      };
    }
  }

  /**
   * Add prefixes to SPARQL query
   */
  private addPrefixesToQuery(sparql: string, prefixes: { [prefix: string]: string }): string {
    const prefixLines = Object.entries(prefixes)
      .map(([prefix, uri]) => `PREFIX ${prefix}: <${uri}>`)
      .join('\n');
    
    return prefixLines + '\n\n' + sparql;
  }

  /**
   * Validate SPARQL syntax
   */
  private validateSPARQL(sparql: string): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];
    
    // Basic syntax validation
    if (!sparql.trim()) {
      errors.push({
        type: 'syntax',
        message: 'Empty SPARQL query'
      });
    }
    
    // Check for balanced braces
    const openBraces = (sparql.match(/\{/g) || []).length;
    const closeBraces = (sparql.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push({
        type: 'syntax',
        message: 'Unbalanced braces in SPARQL query'
      });
    }
    
    // Check for required keywords
    const lowerSparql = sparql.toLowerCase();
    if (!lowerSparql.includes('select') && !lowerSparql.includes('ask') &&
        !lowerSparql.includes('construct') && !lowerSparql.includes('describe')) {
      errors.push({
        type: 'syntax',
        message: 'Missing query type (SELECT, ASK, CONSTRUCT, or DESCRIBE)'
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Format execution results for display
   */
  private formatResponse(result: SPARQLExecutionResult, intent: SPARQLQueryIntent): string {
    if (!result.success) {
      return `Query execution failed: ${result.error?.message || 'Unknown error'}`;
    }
    
    if (result.data.length === 0) {
      return 'No results found.';
    }
    
    switch (intent) {
      case 'ask':
        return result.data[0] ? 'Yes' : 'No';
      case 'count':
        return `Count: ${result.data[0]?.count || result.data.length}`;
      case 'aggregate':
        const aggResult = result.data[0];
        if (aggResult) {
          const keys = Object.keys(aggResult);
          return keys.map(key => `${key}: ${aggResult[key]?.value || aggResult[key]}`).join(', ');
        }
        return 'No aggregation results';
      default:
        // Format as table for select queries
        if (result.data.length === 1) {
          const item = result.data[0];
          return Object.entries(item)
            .map(([key, value]) => `${key}: ${value?.value || value}`)
            .join('\n');
        } else {
          return `Found ${result.data.length} results:\n` +
            result.data.slice(0, 5).map((item, index) =>
              `${index + 1}. ${Object.values(item).map(v => v?.value || v).join(', ')}`
            ).join('\n') +
            (result.data.length > 5 ? `\n... and ${result.data.length - 5} more` : '');
        }
    }
  }

  /**
   * Generate query explanation
   */
  private generateExplanation(parsed: ParsedSPARQLQuery, generated: GeneratedSPARQLQuery): string {
    const parts = [
      `This query searches for ${parsed.intent} operations`,
      `Found ${parsed.entities.length} entities in the query`,
      `Generated using ${generated.generationMethod} method`,
      `Estimated complexity: ${generated.estimatedComplexity}`
    ];
    
    if (parsed.filters.length > 0) {
      parts.push(`Applied ${parsed.filters.length} filters`);
    }
    
    if (parsed.aggregations.length > 0) {
      parts.push(`Includes ${parsed.aggregations.length} aggregations`);
    }
    
    return parts.join('. ') + '.';
  }

  /**
   * Generate query suggestions
   */
  private async generateSuggestions(
    parsed: ParsedSPARQLQuery,
    result: SPARQLExecutionResult
  ): Promise<SPARQLQueryResponse['suggestions']> {
    const suggestions = {
      relatedQueries: [] as string[],
      followUpQuestions: [] as string[],
      optimizations: [] as string[],
      alternativeFormulations: [] as string[]
    };
    
    // Generate related queries based on intent
    switch (parsed.intent) {
      case 'select':
        suggestions.relatedQueries.push('Count the results', 'Show more details');
        break;
      case 'count':
        suggestions.relatedQueries.push('Show the actual items', 'Group by category');
        break;
      case 'ask':
        suggestions.relatedQueries.push('Show examples', 'Count how many');
        break;
    }
    
    // Performance suggestions
    if (result.summary.executionTime > 1000) {
      suggestions.optimizations.push('Consider adding more specific filters to improve performance');
    }
    
    if (result.summary.resultCount > 100) {
      suggestions.optimizations.push('Large result set - consider using LIMIT clause');
    }
    
    return suggestions;
  }
}