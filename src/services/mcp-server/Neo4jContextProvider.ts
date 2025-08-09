/**
 * Neo4j Context Provider for MCP Server
 * 
 * Provides source code context from Neo4j database to complement TTL metadata,
 * creating a comprehensive triple context system for LLM interactions.
 */

import logger from '../../utils/logger';
import { Neo4jDatabaseService } from '../layer2/neo4j-database/Neo4jDatabaseService';
import {
  ContextRequest,
  ContextSource,
  Neo4jContextResult,
  SourceCodeContext,
  Neo4jContextProviderConfig
} from './types';

/**
 * Neo4j Context Provider
 * 
 * Queries Neo4j database for source code content and relationships
 * to provide rich context alongside TTL metadata files.
 */
export class Neo4jContextProvider {
  private neo4jService: Neo4jDatabaseService;
  private config: Neo4jContextProviderConfig;

  constructor(
    neo4jService: Neo4jDatabaseService,
    config: Neo4jContextProviderConfig
  ) {
    this.neo4jService = neo4jService;
    this.config = config;
    
    logger.info('Neo4jContextProvider initialized', {
      maxResults: config.maxResults,
      includeSourceCode: config.includeSourceCode
    });
  }

  /**
   * Get source code context from Neo4j for a specific request
   */
  async getSourceCodeContext(request: ContextRequest): Promise<Neo4jContextResult> {
    try {
      const startTime = Date.now();
      
      // Extract language and file information
      const language = this.detectLanguageFromPath(request.filePath);
      const fileName = this.extractFileName(request.filePath);
      const directory = this.extractDirectory(request.filePath);
      
      // Build comprehensive Neo4j queries
      const queries = this.buildContextQueries(request, language, fileName, directory);
      
      // Execute queries in parallel
      const results = await Promise.allSettled(
        queries.map(query => this.executeContextQuery(query))
      );
      
      // Process and combine results
      const sourceCodeSources = this.processQueryResults(results, request);
      
      const processingTime = Date.now() - startTime;
      
      return {
        sources: sourceCodeSources,
        metadata: {
          totalFiles: sourceCodeSources.length,
          languages: [...new Set(sourceCodeSources.map(s => s.metadata.language).filter(Boolean))] as string[],
          processingTime,
          queryCount: queries.length
        },
        statistics: {
          classesFound: sourceCodeSources.reduce((sum, s) => sum + (s.metadata.classes || 0), 0),
          methodsFound: sourceCodeSources.reduce((sum, s) => sum + (s.metadata.methods || 0), 0),
          relationshipsFound: sourceCodeSources.reduce((sum, s) => sum + (s.metadata.relationships || 0), 0)
        }
      };
      
    } catch (error) {
      logger.error('Failed to get Neo4j source code context', { request, error });
      return {
        sources: [],
        metadata: {
          totalFiles: 0,
          languages: [],
          processingTime: 0,
          queryCount: 0,
          error: error instanceof Error ? error.message : String(error)
        },
        statistics: {
          classesFound: 0,
          methodsFound: 0,
          relationshipsFound: 0
        }
      };
    }
  }

  /**
   * Search for related source code based on query
   */
  async searchSourceCode(query: string, language?: string): Promise<SourceCodeContext[]> {
    try {
      const searchQueries = this.buildSearchQueries(query, language);
      
      const results = await Promise.allSettled(
        searchQueries.map(q => this.executeContextQuery(q))
      );
      
      const sourceCodeResults: SourceCodeContext[] = [];
      
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.records) {
          for (const record of result.value.records) {
            const sourceCode = this.extractSourceCodeFromRecord(record);
            if (sourceCode) {
              sourceCodeResults.push(sourceCode);
            }
          }
        }
      }
      
      // Sort by relevance and limit results
      return sourceCodeResults
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .slice(0, this.config.maxResults);
        
    } catch (error) {
      logger.error('Failed to search source code', { query, language, error });
      return [];
    }
  }

  /**
   * Get code relationships and dependencies
   */
  async getCodeRelationships(filePath: string): Promise<{
    dependencies: SourceCodeContext[];
    dependents: SourceCodeContext[];
    related: SourceCodeContext[];
  }> {
    try {
      const fileName = this.extractFileName(filePath);
      
      // Query for dependencies (files this file imports/uses)
      const dependenciesQuery = `
        MATCH (file:File {name: $fileName})-[:IMPORTS|USES|DEPENDS_ON]->(dep:File)
        RETURN dep.name as name, dep.path as path, dep.language as language, 
               dep.sourceCode as sourceCode, dep.classes as classes, dep.methods as methods
        LIMIT ${this.config.maxResults}
      `;
      
      // Query for dependents (files that import/use this file)
      const dependentsQuery = `
        MATCH (dependent:File)-[:IMPORTS|USES|DEPENDS_ON]->(file:File {name: $fileName})
        RETURN dependent.name as name, dependent.path as path, dependent.language as language,
               dependent.sourceCode as sourceCode, dependent.classes as classes, dependent.methods as methods
        LIMIT ${this.config.maxResults}
      `;
      
      // Query for related files (same package/module)
      const relatedQuery = `
        MATCH (file:File {name: $fileName})-[:IN_PACKAGE|IN_MODULE]->(pkg)
        MATCH (related:File)-[:IN_PACKAGE|IN_MODULE]->(pkg)
        WHERE related.name <> $fileName
        RETURN related.name as name, related.path as path, related.language as language,
               related.sourceCode as sourceCode, related.classes as classes, related.methods as methods
        LIMIT ${this.config.maxResults}
      `;
      
      const [depResult, dependentResult, relatedResult] = await Promise.allSettled([
        this.executeNeo4jQuery(dependenciesQuery, { fileName }),
        this.executeNeo4jQuery(dependentsQuery, { fileName }),
        this.executeNeo4jQuery(relatedQuery, { fileName })
      ]);
      
      return {
        dependencies: this.extractSourceCodeContexts(depResult),
        dependents: this.extractSourceCodeContexts(dependentResult),
        related: this.extractSourceCodeContexts(relatedResult)
      };
      
    } catch (error) {
      logger.error('Failed to get code relationships', { filePath, error });
      return {
        dependencies: [],
        dependents: [],
        related: []
      };
    }
  }

  /**
   * Build context queries based on request
   */
  private buildContextQueries(
    request: ContextRequest,
    language: string,
    fileName: string,
    directory: string
  ): Array<{ cypher: string; params: Record<string, any>; type: string }> {
    // 1. Exact file match
    const queryList: Array<{ cypher: string; params: Record<string, any>; type: string }> = [];
    
    queryList.push({
      cypher: `
        MATCH (file:File)
        WHERE file.name = $fileName OR file.path CONTAINS $fileName
        RETURN file.name as name, file.path as path, file.language as language,
               file.sourceCode as sourceCode, file.classes as classes, file.methods as methods,
               file.complexity as complexity, file.lastModified as lastModified
        LIMIT 1
      `,
      params: { fileName },
      type: 'exact_match'
    });
    
    // 2. Same directory files
    queryList.push({
      cypher: `
        MATCH (file:File)
        WHERE file.path CONTAINS $directory AND file.language = $language
        RETURN file.name as name, file.path as path, file.language as language,
               file.sourceCode as sourceCode, file.classes as classes, file.methods as methods,
               file.complexity as complexity, file.lastModified as lastModified
        ORDER BY file.lastModified DESC
        LIMIT $maxResults
      `,
      params: { directory, language, maxResults: this.config.maxResults },
      type: 'same_directory'
    });
    
    // 3. Query-based search (if query provided)
    if (request.query) {
      queryList.push({
        cypher: `
          MATCH (file:File)
          WHERE file.sourceCode CONTAINS $query OR 
                any(class in file.classes WHERE class CONTAINS $query) OR
                any(method in file.methods WHERE method CONTAINS $query)
          RETURN file.name as name, file.path as path, file.language as language,
                 file.sourceCode as sourceCode, file.classes as classes, file.methods as methods,
                 file.complexity as complexity, file.lastModified as lastModified
          ORDER BY file.lastModified DESC
          LIMIT $maxResults
        `,
        params: { query: request.query, maxResults: this.config.maxResults },
        type: 'query_search'
      });
    }
    
    // 4. Language-specific files
    if (language !== 'unknown') {
      queryList.push({
        cypher: `
          MATCH (file:File)
          WHERE file.language = $language
          RETURN file.name as name, file.path as path, file.language as language,
                 file.sourceCode as sourceCode, file.classes as classes, file.methods as methods,
                 file.complexity as complexity, file.lastModified as lastModified
          ORDER BY file.complexity DESC
          LIMIT $maxResults
        `,
        params: { language, maxResults: Math.min(5, this.config.maxResults) },
        type: 'language_match'
      });
    }
    
    return queryList;
  }

  /**
   * Build search queries for source code search
   */
  private buildSearchQueries(query: string, language?: string): Array<{ cypher: string; params: Record<string, any> }> {
    const queryList: Array<{ cypher: string; params: Record<string, any> }> = [];
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    
    // Full-text search in source code
    queryList.push({
      cypher: `
        MATCH (file:File)
        WHERE ${language ? 'file.language = $language AND' : ''}
              (file.sourceCode CONTAINS $query OR 
               any(class in file.classes WHERE toLower(class) CONTAINS $queryLower) OR
               any(method in file.methods WHERE toLower(method) CONTAINS $queryLower))
        RETURN file.name as name, file.path as path, file.language as language,
               file.sourceCode as sourceCode, file.classes as classes, file.methods as methods,
               file.complexity as complexity, file.lastModified as lastModified
        ORDER BY file.lastModified DESC
        LIMIT $maxResults
      `,
      params: { 
        query, 
        queryLower: query.toLowerCase(),
        ...(language && { language }),
        maxResults: this.config.maxResults 
      }
    });
    
    // Search by individual terms
    if (searchTerms.length > 1) {
      queryList.push({
        cypher: `
          MATCH (file:File)
          WHERE ${language ? 'file.language = $language AND' : ''}
                any(term in $searchTerms WHERE 
                  file.sourceCode CONTAINS term OR
                  any(class in file.classes WHERE toLower(class) CONTAINS term) OR
                  any(method in file.methods WHERE toLower(method) CONTAINS term))
          RETURN file.name as name, file.path as path, file.language as language,
                 file.sourceCode as sourceCode, file.classes as classes, file.methods as methods,
                 file.complexity as complexity, file.lastModified as lastModified
          ORDER BY file.lastModified DESC
          LIMIT $maxResults
        `,
        params: { 
          searchTerms,
          ...(language && { language }),
          maxResults: this.config.maxResults 
        }
      });
    }
    
    return queryList;
  }

  /**
   * Execute Neo4j query with error handling
   */
  private async executeNeo4jQuery(cypher: string, params: Record<string, any>) {
    try {
      const session = this.neo4jService.getSession();
      const result = await session.run(cypher, params);
      await session.close();
      return result;
    } catch (error) {
      logger.error('Neo4j query execution failed', { cypher, params, error });
      throw error;
    }
  }

  /**
   * Execute a context query
   */
  private async executeContextQuery(query: { cypher: string; params: Record<string, any>; type?: string }) {
    try {
      return await this.executeNeo4jQuery(query.cypher, query.params);
    } catch (error) {
      logger.error('Neo4j context query failed', { query: query.type || 'unknown', error });
      throw error;
    }
  }

  /**
   * Process query results into context sources
   */
  private processQueryResults(
    results: PromiseSettledResult<any>[],
    request: ContextRequest
  ): ContextSource[] {
    const sources: ContextSource[] = [];
    const seenPaths = new Set<string>();
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.records) {
        for (const record of result.value.records) {
          const path = record.get('path');
          
          // Avoid duplicates
          if (seenPaths.has(path)) continue;
          seenPaths.add(path);
          
          const sourceCode = record.get('sourceCode');
          const classes = record.get('classes') || [];
          const methods = record.get('methods') || [];
          
          // Format source code for LLM consumption
          const formattedContent = this.formatSourceCodeForLLM({
            name: record.get('name'),
            path,
            language: record.get('language'),
            sourceCode: this.config.includeSourceCode ? sourceCode : undefined,
            classes,
            methods,
            complexity: record.get('complexity'),
            lastModified: record.get('lastModified')
          });
          
          const source: ContextSource = {
            type: 'neo4j_source',
            path,
            content: formattedContent,
            relevanceScore: this.calculateRelevanceScore(record, request),
            metadata: {
              lastModified: new Date(record.get('lastModified')),
              size: sourceCode ? sourceCode.length : 0,
              language: record.get('language'),
              module: record.get('name'),
              classes: classes.length,
              methods: methods.length,
              complexity: record.get('complexity')
            }
          };
          
          sources.push(source);
        }
      }
    }
    
    return sources.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Extract source code contexts from query results
   */
  private extractSourceCodeContexts(result: PromiseSettledResult<any>): SourceCodeContext[] {
    if (result.status !== 'fulfilled' || !result.value.records) {
      return [];
    }
    
    return result.value.records.map((record: any) => this.extractSourceCodeFromRecord(record)).filter(Boolean);
  }

  /**
   * Extract source code context from a Neo4j record
   */
  private extractSourceCodeFromRecord(record: any): SourceCodeContext | null {
    try {
      return {
        name: record.get('name'),
        path: record.get('path'),
        language: record.get('language'),
        sourceCode: record.get('sourceCode'),
        classes: record.get('classes') || [],
        methods: record.get('methods') || [],
        complexity: record.get('complexity') || 0,
        lastModified: new Date(record.get('lastModified')),
        relevanceScore: 0.5 // Default relevance
      };
    } catch (error) {
      logger.error('Failed to extract source code from record', { error });
      return null;
    }
  }

  /**
   * Format source code for LLM consumption
   */
  private formatSourceCodeForLLM(context: {
    name: string;
    path: string;
    language: string;
    sourceCode?: string;
    classes: string[];
    methods: string[];
    complexity: number;
    lastModified: string;
  }): string {
    const lines = [
      `# Source Code: ${context.name}`,
      `# Language: ${context.language?.toUpperCase()}`,
      `# Path: ${context.path}`,
      `# Classes: ${context.classes.length} (${context.classes.slice(0, 5).join(', ')})`,
      `# Methods: ${context.methods.length} (${context.methods.slice(0, 10).join(', ')})`,
      `# Complexity: ${context.complexity}/10`,
      `# Last Modified: ${context.lastModified}`,
      ''
    ];
    
    if (this.config.includeSourceCode && context.sourceCode) {
      lines.push(
        '# Full Source Code:',
        '```' + context.language,
        context.sourceCode,
        '```',
        ''
      );
    } else {
      lines.push(
        '# Code Structure Summary:',
        `Classes: ${context.classes.join(', ')}`,
        `Key Methods: ${context.methods.slice(0, 10).join(', ')}`,
        ''
      );
    }
    
    return lines.join('\n');
  }

  /**
   * Calculate relevance score for a record
   */
  private calculateRelevanceScore(record: any, request: ContextRequest): number {
    let score = 0.5; // Base score
    
    const path = record.get('path');
    const sourceCode = record.get('sourceCode') || '';
    const classes = record.get('classes') || [];
    const methods = record.get('methods') || [];
    
    // Path proximity
    if (path === request.filePath) score += 0.4;
    else if (path.includes(this.extractDirectory(request.filePath))) score += 0.2;
    
    // Query matching
    if (request.query) {
      const queryLower = request.query.toLowerCase();
      if (sourceCode.toLowerCase().includes(queryLower)) score += 0.3;
      if (classes.some((c: string) => c.toLowerCase().includes(queryLower))) score += 0.2;
      if (methods.some((m: string) => m.toLowerCase().includes(queryLower))) score += 0.1;
    }
    
    // Language matching
    const requestLanguage = this.detectLanguageFromPath(request.filePath);
    if (record.get('language') === requestLanguage) score += 0.2;
    
    return Math.min(1.0, score);
  }

  /**
   * Detect language from file path
   */
  private detectLanguageFromPath(filePath: string): string {
    if (filePath.endsWith('.ts')) return 'typescript';
    if (filePath.endsWith('.js')) return 'javascript';
    if (filePath.endsWith('.py')) return 'python';
    if (filePath.endsWith('.java')) return 'java';
    if (filePath.endsWith('.go')) return 'go';
    if (filePath.endsWith('.rs')) return 'rust';
    if (filePath.endsWith('.cpp') || filePath.endsWith('.cc')) return 'cpp';
    if (filePath.endsWith('.cs')) return 'csharp';
    if (filePath.endsWith('.php')) return 'php';
    if (filePath.endsWith('.rb')) return 'ruby';
    if (filePath.endsWith('.kt')) return 'kotlin';
    if (filePath.endsWith('.scala')) return 'scala';
    if (filePath.endsWith('.swift')) return 'swift';
    return 'unknown';
  }

  /**
   * Extract file name from path
   */
  private extractFileName(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }

  /**
   * Extract directory from path
   */
  private extractDirectory(filePath: string): string {
    const parts = filePath.split('/');
    return parts.slice(0, -1).join('/');
  }
}