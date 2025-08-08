/**
 * Knowledge Graph Populator
 * 
 * Automatic knowledge graph population system that ingests TTL files
 * into Neo4j database with intelligent entity creation and relationship mapping.
 */

import * as path from 'path';
import { EventEmitter } from 'events';
import logger from '../../utils/logger';
import { Neo4jDatabaseService } from '../layer2/neo4j-database/Neo4jDatabaseService';
import { BatchIngestionResult } from '../layer2/neo4j-database/types';

export interface KnowledgeGraphConfig {
  neo4jUri: string;
  neo4jUsername: string;
  neo4jPassword: string;
  neo4jDatabase?: string;
  batchSize: number;
  enableIndexCreation: boolean;
  enableConstraintCreation: boolean;
  preserveExistingData: boolean;
  conflictResolution: 'merge' | 'replace' | 'skip';
}

export interface PopulationResult {
  success: boolean;
  totalTTLFiles: number;
  processedFiles: number;
  failedFiles: number;
  totalNodesCreated: number;
  totalRelationshipsCreated: number;
  totalPropertiesSet: number;
  processingTime: number;
  errors: PopulationError[];
  warnings: string[];
  statistics: PopulationStatistics;
}

export interface PopulationError {
  type: 'CONNECTION_ERROR' | 'INGESTION_ERROR' | 'SCHEMA_ERROR' | 'VALIDATION_ERROR';
  message: string;
  sourceFile?: string;
  details?: any;
}

export interface PopulationStatistics {
  moduleNodes: number;
  classNodes: number;
  methodNodes: number;
  functionNodes: number;
  dependencyRelationships: number;
  inheritanceRelationships: number;
  containmentRelationships: number;
  businessContextNodes: number;
}

export interface ModuleEntity {
  id: string;
  name: string;
  filePath: string;
  language: string;
  businessDomain?: string;
  architecturalPatterns: string[];
  qualityMetrics: {
    complexity: number;
    maintainability: number;
    testCoverage: number;
    documentation: number;
  };
  lastUpdated: Date;
}

export interface CodeEntity {
  id: string;
  name: string;
  type: 'class' | 'method' | 'function' | 'interface' | 'enum';
  moduleId: string;
  signature?: string;
  visibility?: 'public' | 'private' | 'protected';
  isAbstract?: boolean;
  parameters?: string[];
  returnType?: string;
  businessContext?: string;
  technicalContext?: string;
}

export interface EntityRelationship {
  sourceId: string;
  targetId: string;
  type: 'DEPENDS_ON' | 'EXTENDS' | 'IMPLEMENTS' | 'CONTAINS' | 'CALLS' | 'USES' | 'PART_OF';
  properties?: Record<string, any>;
}

/**
 * Knowledge Graph Populator
 * 
 * Orchestrates automatic population of Neo4j knowledge graph from TTL files
 * with intelligent entity extraction, relationship mapping, and conflict resolution.
 */
export class KnowledgeGraphPopulator extends EventEmitter {
  private config: KnowledgeGraphConfig;
  private neo4jService: Neo4jDatabaseService;
  private isInitialized = false;

  constructor(config: Partial<KnowledgeGraphConfig> = {}) {
    super();
    
    this.config = {
      neo4jUri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      neo4jUsername: process.env.NEO4J_USERNAME || 'neo4j',
      neo4jPassword: process.env.NEO4J_PASSWORD || 'password',
      neo4jDatabase: process.env.NEO4J_DATABASE || 'neo4j',
      batchSize: 50,
      enableIndexCreation: true,
      enableConstraintCreation: true,
      preserveExistingData: true,
      conflictResolution: 'merge',
      ...config
    };

    this.neo4jService = new Neo4jDatabaseService();
  }

  /**
   * Initialize the knowledge graph populator
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Knowledge Graph Populator', {
        neo4jUri: this.config.neo4jUri,
        database: this.config.neo4jDatabase,
        batchSize: this.config.batchSize
      });

      // Connect to Neo4j
      await this.neo4jService.connect({
        uri: this.config.neo4jUri,
        username: this.config.neo4jUsername,
        password: this.config.neo4jPassword,
        database: this.config.neo4jDatabase || 'neo4j'
      });

      // Test connection
      const isConnected = await this.neo4jService.testConnection();
      if (!isConnected) {
        throw new Error('Failed to establish Neo4j connection');
      }

      // Create schema if enabled
      if (this.config.enableConstraintCreation) {
        await this.createKnowledgeGraphSchema();
      }

      // Create indexes if enabled
      if (this.config.enableIndexCreation) {
        await this.createKnowledgeGraphIndexes();
      }

      this.isInitialized = true;
      logger.info('Knowledge Graph Populator initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Knowledge Graph Populator', { error });
      throw error;
    }
  }

  /**
   * Populate knowledge graph from TTL files
   */
  async populateFromTTLFiles(ttlFilePaths: string[]): Promise<PopulationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const result: PopulationResult = {
      success: false,
      totalTTLFiles: ttlFilePaths.length,
      processedFiles: 0,
      failedFiles: 0,
      totalNodesCreated: 0,
      totalRelationshipsCreated: 0,
      totalPropertiesSet: 0,
      processingTime: 0,
      errors: [],
      warnings: [],
      statistics: this.initializeStats()
    };

    try {
      logger.info('Starting knowledge graph population', {
        totalFiles: ttlFilePaths.length,
        batchSize: this.config.batchSize
      });

      // Process TTL files in batches
      const batches = this.createBatches(ttlFilePaths, this.config.batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        logger.info(`Processing batch ${i + 1}/${batches.length}`, {
          batchSize: batch.length
        });

        try {
          const batchResult = await this.processTTLBatch(batch);
          
          // Aggregate results
          result.processedFiles += batchResult.successfulFiles;
          result.failedFiles += batchResult.failedFiles;
          result.totalNodesCreated += batchResult.totalNodesCreated;
          result.totalRelationshipsCreated += batchResult.totalRelationshipsCreated;
          result.errors.push(...batchResult.errors.map(err => ({
            type: 'INGESTION_ERROR' as const,
            message: err.message,
            sourceFile: err.sourceFile,
            details: err
          })));

          this.emit('batch_processed', {
            batchIndex: i + 1,
            totalBatches: batches.length,
            batchResult
          });

        } catch (error) {
          logger.error(`Failed to process batch ${i + 1}`, { error });
          result.errors.push({
            type: 'INGESTION_ERROR',
            message: `Batch processing failed: ${(error as Error).message}`,
            details: { batchIndex: i + 1, batchSize: batch.length }
          });
          result.failedFiles += batch.length;
        }
      }

      // Calculate final statistics
      result.statistics = await this.calculatePopulationStatistics();
      result.processingTime = Date.now() - startTime;
      result.success = result.errors.length === 0 || result.processedFiles > 0;

      logger.info('Knowledge graph population completed', {
        success: result.success,
        processedFiles: result.processedFiles,
        failedFiles: result.failedFiles,
        totalNodes: result.totalNodesCreated,
        totalRelationships: result.totalRelationshipsCreated,
        processingTime: result.processingTime
      });

      this.emit('population_completed', result);
      return result;

    } catch (error) {
      logger.error('Knowledge graph population failed', { error });
      result.errors.push({
        type: 'CONNECTION_ERROR',
        message: `Population failed: ${(error as Error).message}`,
        details: error
      });
      result.processingTime = Date.now() - startTime;
      this.emit('population_failed', { error, result });
      return result;
    }
  }

  /**
   * Populate knowledge graph from TTL content map
   */
  async populateFromTTLContent(ttlContentMap: Map<string, any>): Promise<PopulationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const result: PopulationResult = {
      success: false,
      totalTTLFiles: ttlContentMap.size,
      processedFiles: 0,
      failedFiles: 0,
      totalNodesCreated: 0,
      totalRelationshipsCreated: 0,
      totalPropertiesSet: 0,
      processingTime: 0,
      errors: [],
      warnings: [],
      statistics: this.initializeStats()
    };

    try {
      logger.info('Starting knowledge graph population from content', {
        totalModules: ttlContentMap.size
      });

      for (const [ttlPath, ttlData] of ttlContentMap) {
        try {
          // Extract entities from TTL content
          const entities = await this.extractEntitiesFromTTL(ttlPath, ttlData);
          
          // Create knowledge graph entities
          const creationResult = await this.createKnowledgeGraphEntities(entities);
          
          result.processedFiles++;
          result.totalNodesCreated += creationResult.nodesCreated;
          result.totalRelationshipsCreated += creationResult.relationshipsCreated;
          result.totalPropertiesSet += creationResult.propertiesSet;

          logger.debug('Processed TTL module', {
            ttlPath,
            nodesCreated: creationResult.nodesCreated,
            relationshipsCreated: creationResult.relationshipsCreated
          });

        } catch (error) {
          logger.error('Failed to process TTL content', { ttlPath, error });
          result.failedFiles++;
          result.errors.push({
            type: 'INGESTION_ERROR',
            message: `Failed to process ${ttlPath}: ${(error as Error).message}`,
            sourceFile: ttlPath,
            details: error
          });
        }
      }

      // Calculate final statistics
      result.statistics = await this.calculatePopulationStatistics();
      result.processingTime = Date.now() - startTime;
      result.success = result.errors.length === 0 || result.processedFiles > 0;

      logger.info('Knowledge graph population from content completed', {
        success: result.success,
        processedFiles: result.processedFiles,
        failedFiles: result.failedFiles,
        totalNodes: result.totalNodesCreated,
        totalRelationships: result.totalRelationshipsCreated
      });

      this.emit('population_completed', result);
      return result;

    } catch (error) {
      logger.error('Knowledge graph population from content failed', { error });
      result.errors.push({
        type: 'CONNECTION_ERROR',
        message: `Population failed: ${(error as Error).message}`,
        details: error
      });
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Update knowledge graph incrementally for specific modules
   */
  async updateModules(moduleUpdates: Map<string, any>): Promise<PopulationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    logger.info('Starting incremental knowledge graph update', {
      modulesToUpdate: moduleUpdates.size
    });

    const result: PopulationResult = {
      success: false,
      totalTTLFiles: moduleUpdates.size,
      processedFiles: 0,
      failedFiles: 0,
      totalNodesCreated: 0,
      totalRelationshipsCreated: 0,
      totalPropertiesSet: 0,
      processingTime: 0,
      errors: [],
      warnings: [],
      statistics: this.initializeStats()
    };

    try {
      for (const [moduleId, moduleData] of moduleUpdates) {
        try {
          // Remove existing module data if conflict resolution is 'replace'
          if (this.config.conflictResolution === 'replace') {
            await this.removeModuleFromGraph(moduleId);
          }

          // Extract and create updated entities
          const entities = await this.extractEntitiesFromTTL(moduleId, moduleData);
          const creationResult = await this.createKnowledgeGraphEntities(entities);

          result.processedFiles++;
          result.totalNodesCreated += creationResult.nodesCreated;
          result.totalRelationshipsCreated += creationResult.relationshipsCreated;
          result.totalPropertiesSet += creationResult.propertiesSet;

          logger.debug('Updated module in knowledge graph', {
            moduleId,
            nodesCreated: creationResult.nodesCreated,
            relationshipsCreated: creationResult.relationshipsCreated
          });

        } catch (error) {
          logger.error('Failed to update module', { moduleId, error });
          result.failedFiles++;
          result.errors.push({
            type: 'INGESTION_ERROR',
            message: `Failed to update module ${moduleId}: ${(error as Error).message}`,
            sourceFile: moduleId,
            details: error
          });
        }
      }

      result.statistics = await this.calculatePopulationStatistics();
      result.processingTime = Date.now() - startTime;
      result.success = result.errors.length === 0 || result.processedFiles > 0;

      logger.info('Incremental knowledge graph update completed', {
        success: result.success,
        processedModules: result.processedFiles,
        failedModules: result.failedFiles
      });

      return result;

    } catch (error) {
      logger.error('Incremental knowledge graph update failed', { error });
      result.errors.push({
        type: 'CONNECTION_ERROR',
        message: `Update failed: ${(error as Error).message}`,
        details: error
      });
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Get knowledge graph health status
   */
  async getHealthStatus(): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Knowledge Graph Populator not initialized');
    }

    try {
      const healthStatus = await this.neo4jService.checkHealth();
      const metrics = await this.neo4jService.getMetrics();
      const constraints = await this.neo4jService.getConstraints();
      const indexes = await this.neo4jService.getIndexes();

      return {
        neo4jHealth: healthStatus,
        databaseMetrics: metrics,
        schemaConstraints: constraints,
        schemaIndexes: indexes,
        populationStatistics: await this.calculatePopulationStatistics()
      };

    } catch (error) {
      logger.error('Failed to get knowledge graph health status', { error });
      throw error;
    }
  }

  /**
   * Shutdown the knowledge graph populator
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Knowledge Graph Populator');
      
      if (this.neo4jService) {
        await this.neo4jService.disconnect();
      }

      this.isInitialized = false;
      logger.info('Knowledge Graph Populator shutdown completed');

    } catch (error) {
      logger.error('Failed to shutdown Knowledge Graph Populator', { error });
      throw error;
    }
  }

  // Private helper methods

  private initializeStats(): PopulationStatistics {
    return {
      moduleNodes: 0,
      classNodes: 0,
      methodNodes: 0,
      functionNodes: 0,
      dependencyRelationships: 0,
      inheritanceRelationships: 0,
      containmentRelationships: 0,
      businessContextNodes: 0
    };
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async processTTLBatch(ttlFilePaths: string[]): Promise<BatchIngestionResult> {
    try {
      // Use Neo4j service's batch ingestion capability
      return await this.neo4jService.batchIngestTTLFiles(ttlFilePaths);
    } catch (error) {
      logger.error('Failed to process TTL batch', { error, batchSize: ttlFilePaths.length });
      throw error;
    }
  }

  private async extractEntitiesFromTTL(ttlPath: string, ttlData: any): Promise<{
    modules: ModuleEntity[];
    codeEntities: CodeEntity[];
    relationships: EntityRelationship[];
  }> {
    const entities = {
      modules: [] as ModuleEntity[],
      codeEntities: [] as CodeEntity[],
      relationships: [] as EntityRelationship[]
    };

    try {
      const content = ttlData.rdfContent || ttlData.content || ttlData;
      
      // Basic TTL validation
      if (!content || typeof content !== 'string') {
        throw new Error('Invalid TTL content: content is empty or not a string');
      }
      
      // Check for basic TTL syntax
      if (!content.includes('@prefix') && !content.includes('aide:')) {
        throw new Error('Invalid TTL content: missing required prefixes or aide namespace');
      }
      
      // Extract module information
      const moduleId = this.extractModuleIdFromTTL(content);
      const businessDomain = this.extractBusinessDomainFromTTL(content);
      const moduleEntity: ModuleEntity = {
        id: moduleId,
        name: path.basename(ttlPath, '.module-knowledge.ttl'),
        filePath: ttlPath,
        language: this.extractLanguageFromTTL(content),
        architecturalPatterns: this.extractArchitecturalPatternsFromTTL(content),
        qualityMetrics: this.extractQualityMetricsFromTTL(content),
        lastUpdated: new Date(),
        ...(businessDomain && { businessDomain })
      };
      entities.modules.push(moduleEntity);

      // Extract classes
      const classMatches = content.match(/aide:(\w+)\s+a\s+aide:Class/g) || [];
      for (const match of classMatches) {
        const classNameMatch = match.match(/aide:(\w+)/);
        if (classNameMatch) {
          const className = classNameMatch[1];
          const businessContext = this.extractEntityBusinessContext(content, className);
          const technicalContext = this.extractEntityTechnicalContext(content, className);
          entities.codeEntities.push({
            id: `${moduleId}_${className}`,
            name: className,
            type: 'class',
            moduleId,
            ...(businessContext && { businessContext }),
            ...(technicalContext && { technicalContext })
          });
        }
      }

      // Extract methods
      const methodMatches = content.match(/aide:(\w+)\s+a\s+aide:Method/g) || [];
      for (const match of methodMatches) {
        const methodNameMatch = match.match(/aide:(\w+)/);
        if (methodNameMatch) {
          const methodName = methodNameMatch[1];
          const signature = this.extractMethodSignature(content, methodName);
          const businessContext = this.extractEntityBusinessContext(content, methodName);
          entities.codeEntities.push({
            id: `${moduleId}_${methodName}`,
            name: methodName,
            type: 'method',
            moduleId,
            ...(signature && { signature }),
            ...(businessContext && { businessContext })
          });
        }
      }

      // Extract functions
      const functionMatches = content.match(/aide:(\w+)\s+a\s+aide:Function/g) || [];
      for (const match of functionMatches) {
        const functionNameMatch = match.match(/aide:(\w+)/);
        if (functionNameMatch) {
          const functionName = functionNameMatch[1];
          const signature = this.extractFunctionSignature(content, functionName);
          const businessContext = this.extractEntityBusinessContext(content, functionName);
          entities.codeEntities.push({
            id: `${moduleId}_${functionName}`,
            name: functionName,
            type: 'function',
            moduleId,
            ...(signature && { signature }),
            ...(businessContext && { businessContext })
          });
        }
      }

      // Extract relationships
      const dependencyMatches = content.match(/aide:(\w+)\s+aide:dependsOn\s+aide:(\w+)/g) || [];
      for (const match of dependencyMatches) {
        const relationshipMatch = match.match(/aide:(\w+)\s+aide:dependsOn\s+aide:(\w+)/);
        if (relationshipMatch) {
          entities.relationships.push({
            sourceId: `${moduleId}_${relationshipMatch[1]}`,
            targetId: `${moduleId}_${relationshipMatch[2]}`,
            type: 'DEPENDS_ON'
          });
        }
      }

      // Extract inheritance relationships
      const extendsMatches = content.match(/aide:(\w+)\s+aide:extends\s+aide:(\w+)/g) || [];
      for (const match of extendsMatches) {
        const relationshipMatch = match.match(/aide:(\w+)\s+aide:extends\s+aide:(\w+)/);
        if (relationshipMatch) {
          entities.relationships.push({
            sourceId: `${moduleId}_${relationshipMatch[1]}`,
            targetId: `${moduleId}_${relationshipMatch[2]}`,
            type: 'EXTENDS'
          });
        }
      }

      return entities;

    } catch (error) {
      logger.error('Failed to extract entities from TTL', { ttlPath, error });
      throw error;
    }
  }

  private async createKnowledgeGraphEntities(entities: {
    modules: ModuleEntity[];
    codeEntities: CodeEntity[];
    relationships: EntityRelationship[];
  }): Promise<{ nodesCreated: number; relationshipsCreated: number; propertiesSet: number }> {
    let nodesCreated = 0;
    let relationshipsCreated = 0;
    let propertiesSet = 0;

    try {
      // Create module nodes
      for (const module of entities.modules) {
        const moduleQuery = `
          MERGE (m:Module {id: $id})
          SET m.name = $name,
              m.filePath = $filePath,
              m.language = $language,
              m.businessDomain = $businessDomain,
              m.architecturalPatterns = $architecturalPatterns,
              m.complexityScore = $complexityScore,
              m.maintainabilityScore = $maintainabilityScore,
              m.documentationScore = $documentationScore,
              m.lastUpdated = datetime()
          RETURN m
        `;

        const session = this.neo4jService.getSession();
        try {
          const result = await session.run(moduleQuery, {
            id: module.id,
            name: module.name,
            filePath: module.filePath,
            language: module.language,
            businessDomain: module.businessDomain || null,
            architecturalPatterns: module.architecturalPatterns,
            complexityScore: module.qualityMetrics.complexity,
            maintainabilityScore: module.qualityMetrics.maintainability,
            documentationScore: module.qualityMetrics.documentation
          });

          if (result.records.length > 0) {
            nodesCreated++;
            propertiesSet += 9; // Number of properties set
          }
        } finally {
          await session.close();
        }
      }

      // Create code entity nodes
      for (const entity of entities.codeEntities) {
        const entityQuery = `
          MERGE (e:CodeEntity {id: $id})
          SET e.name = $name,
              e.type = $type,
              e.moduleId = $moduleId,
              e.signature = $signature,
              e.businessContext = $businessContext,
              e.technicalContext = $technicalContext,
              e.lastUpdated = datetime()
          WITH e
          MATCH (m:Module {id: $moduleId})
          MERGE (m)-[:CONTAINS]->(e)
          RETURN e
        `;

        const session = this.neo4jService.getSession();
        try {
          const result = await session.run(entityQuery, {
            id: entity.id,
            name: entity.name,
            type: entity.type,
            moduleId: entity.moduleId,
            signature: entity.signature || null,
            businessContext: entity.businessContext || null,
            technicalContext: entity.technicalContext || null
          });

          if (result.records.length > 0) {
            nodesCreated++;
            relationshipsCreated++; // CONTAINS relationship
            propertiesSet += 7;
          }
        } finally {
          await session.close();
        }
      }

      // Create relationships
      for (const relationship of entities.relationships) {
        const relationshipQuery = `
          MATCH (source:CodeEntity {id: $sourceId})
          MATCH (target:CodeEntity {id: $targetId})
          MERGE (source)-[r:${relationship.type}]->(target)
          SET r.lastUpdated = datetime()
          RETURN r
        `;

        const session = this.neo4jService.getSession();
        try {
          const result = await session.run(relationshipQuery, {
            sourceId: relationship.sourceId,
            targetId: relationship.targetId
          });

          if (result.records.length > 0) {
            relationshipsCreated++;
            propertiesSet += 1;
          }
        } finally {
          await session.close();
        }
      }

      return { nodesCreated, relationshipsCreated, propertiesSet };

    } catch (error) {
      logger.error('Failed to create knowledge graph entities', { error });
      throw error;
    }
  }

  private async createKnowledgeGraphSchema(): Promise<void> {
    try {
      logger.info('Creating knowledge graph schema constraints');

      const constraints = [
        'CREATE CONSTRAINT module_id_unique IF NOT EXISTS FOR (m:Module) REQUIRE m.id IS UNIQUE',
        'CREATE CONSTRAINT code_entity_id_unique IF NOT EXISTS FOR (e:CodeEntity) REQUIRE e.id IS UNIQUE',
        'CREATE CONSTRAINT module_name_exists IF NOT EXISTS FOR (m:Module) REQUIRE m.name IS NOT NULL',
        'CREATE CONSTRAINT code_entity_name_exists IF NOT EXISTS FOR (e:CodeEntity) REQUIRE e.name IS NOT NULL'
      ];

      for (const constraint of constraints) {
        const session = this.neo4jService.getSession();
        try {
          await session.run(constraint);
          logger.debug('Created constraint', { constraint });
        } catch (error) {
          // Constraint might already exist, log as warning
          logger.warn('Failed to create constraint (might already exist)', { constraint, error });
        } finally {
          await session.close();
        }
      }

    } catch (error) {
      logger.error('Failed to create knowledge graph schema', { error });
      throw error;
    }
  }

  private async createKnowledgeGraphIndexes(): Promise<void> {
    try {
      logger.info('Creating knowledge graph indexes');

      const indexes = [
        'CREATE INDEX module_name_idx IF NOT EXISTS FOR (m:Module) ON (m.name)',
        'CREATE INDEX module_language_idx IF NOT EXISTS FOR (m:Module) ON (m.language)',
        'CREATE INDEX module_business_domain_idx IF NOT EXISTS FOR (m:Module) ON (m.businessDomain)',
        'CREATE INDEX code_entity_name_idx IF NOT EXISTS FOR (e:CodeEntity) ON (e.name)',
        'CREATE INDEX code_entity_type_idx IF NOT EXISTS FOR (e:CodeEntity) ON (e.type)',
        'CREATE INDEX code_entity_module_idx IF NOT EXISTS FOR (e:CodeEntity) ON (e.moduleId)',
        'CREATE FULLTEXT INDEX business_context_fulltext IF NOT EXISTS FOR (e:CodeEntity) ON EACH [e.businessContext]',
        'CREATE FULLTEXT INDEX technical_context_fulltext IF NOT EXISTS FOR (e:CodeEntity) ON EACH [e.technicalContext]'
      ];

      for (const index of indexes) {
        const session = this.neo4jService.getSession();
        try {
          await session.run(index);
          logger.debug('Created index', { index });
        } catch (error) {
          // Index might already exist, log as warning
          logger.warn('Failed to create index (might already exist)', { index, error });
        } finally {
          await session.close();
        }
      }

    } catch (error) {
      logger.error('Failed to create knowledge graph indexes', { error });
      throw error;
    }
  }

  private async calculatePopulationStatistics(): Promise<PopulationStatistics> {
    try {
      const session = this.neo4jService.getSession();
      
      try {
        // Count different types of nodes and relationships
        const statsQuery = `
          MATCH (m:Module)
          OPTIONAL MATCH (e:CodeEntity)
          OPTIONAL MATCH ()-[r:DEPENDS_ON]->()
          OPTIONAL MATCH ()-[r2:EXTENDS]->()
          OPTIONAL MATCH ()-[r3:CONTAINS]->()
          RETURN
            count(DISTINCT m) as moduleNodes,
            count(DISTINCT CASE WHEN e.type = 'class' THEN e END) as classNodes,
            count(DISTINCT CASE WHEN e.type = 'method' THEN e END) as methodNodes,
            count(DISTINCT CASE WHEN e.type = 'function' THEN e END) as functionNodes,
            count(DISTINCT r) as dependencyRelationships,
            count(DISTINCT r2) as inheritanceRelationships,
            count(DISTINCT r3) as containmentRelationships,
            count(DISTINCT CASE WHEN e.businessContext IS NOT NULL THEN e END) as businessContextNodes
        `;

        const result = await session.run(statsQuery);
        
        if (result.records.length > 0) {
          const record = result.records[0];
          return {
            moduleNodes: record.get('moduleNodes').toNumber(),
            classNodes: record.get('classNodes').toNumber(),
            methodNodes: record.get('methodNodes').toNumber(),
            functionNodes: record.get('functionNodes').toNumber(),
            dependencyRelationships: record.get('dependencyRelationships').toNumber(),
            inheritanceRelationships: record.get('inheritanceRelationships').toNumber(),
            containmentRelationships: record.get('containmentRelationships').toNumber(),
            businessContextNodes: record.get('businessContextNodes').toNumber()
          };
        }

        return this.initializeStats();

      } finally {
        await session.close();
      }

    } catch (error) {
      logger.error('Failed to calculate population statistics', { error });
      return this.initializeStats();
    }
  }

  private async removeModuleFromGraph(moduleId: string): Promise<void> {
    try {
      const session = this.neo4jService.getSession();
      
      try {
        // Remove module and all its contained entities
        const removeQuery = `
          MATCH (m:Module {id: $moduleId})
          OPTIONAL MATCH (m)-[:CONTAINS]->(e:CodeEntity)
          DETACH DELETE m, e
        `;

        await session.run(removeQuery, { moduleId });
        logger.debug('Removed module from knowledge graph', { moduleId });

      } finally {
        await session.close();
      }

    } catch (error) {
      logger.error('Failed to remove module from graph', { moduleId, error });
      throw error;
    }
  }

  private extractModuleIdFromTTL(content: string): string {
    const moduleMatch = content.match(/aide:(\w+)\s+a\s+aide:Module/);
    return moduleMatch ? moduleMatch[1] : `module_${Date.now()}`;
  }

  private extractLanguageFromTTL(content: string): string {
    const languageMatch = content.match(/aide:language\s+"([^"]+)"/);
    return languageMatch ? languageMatch[1] : 'unknown';
  }

  private extractBusinessDomainFromTTL(content: string): string | undefined {
    const domainMatch = content.match(/aide:businessDomain\s+"([^"]+)"/);
    return domainMatch ? domainMatch[1] : undefined;
  }

  private extractArchitecturalPatternsFromTTL(content: string): string[] {
    const patternMatches = content.match(/aide:architecturalPattern\s+"([^"]+)"/g) || [];
    return patternMatches.map(match =>
      match.replace(/aide:architecturalPattern\s+"([^"]+)"/, '$1')
    );
  }

  private extractQualityMetricsFromTTL(content: string): {
    complexity: number;
    maintainability: number;
    testCoverage: number;
    documentation: number;
  } {
    const complexityMatch = content.match(/aide:complexity\s+(\d+(?:\.\d+)?)/);
    const maintainabilityMatch = content.match(/aide:maintainability\s+(\d+(?:\.\d+)?)/);
    const testCoverageMatch = content.match(/aide:testCoverage\s+(\d+(?:\.\d+)?)/);
    const documentationMatch = content.match(/aide:documentation\s+(\d+(?:\.\d+)?)/);

    return {
      complexity: complexityMatch ? parseFloat(complexityMatch[1]) : 0,
      maintainability: maintainabilityMatch ? parseFloat(maintainabilityMatch[1]) : 100,
      testCoverage: testCoverageMatch ? parseFloat(testCoverageMatch[1]) : 0,
      documentation: documentationMatch ? parseFloat(documentationMatch[1]) : 0
    };
  }

  private extractEntityBusinessContext(content: string, entityName: string): string | undefined {
    // Try multiple patterns for business context extraction
    const patterns = [
      new RegExp(`aide:${entityName}\\s+aide:businessContext\\s+"([^"]+)"`),
      new RegExp(`aide:${entityName}[^;]*aide:businessContext\\s+"([^"]+)"`),
      new RegExp(`aide:${entityName}[\\s\\S]*?aide:businessContext\\s+"([^"]+)"`)
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return undefined;
  }

  private extractEntityTechnicalContext(content: string, entityName: string): string | undefined {
    const contextMatch = content.match(new RegExp(`aide:${entityName}\\s+aide:technicalContext\\s+"([^"]+)"`));
    return contextMatch ? contextMatch[1] : undefined;
  }

  private extractMethodSignature(content: string, methodName: string): string | undefined {
    // Try multiple patterns for signature extraction
    const patterns = [
      new RegExp(`aide:${methodName}\\s+aide:signature\\s+"([^"]+)"`),
      new RegExp(`aide:${methodName}[^;]*aide:signature\\s+"([^"]+)"`),
      new RegExp(`aide:${methodName}[\\s\\S]*?aide:signature\\s+"([^"]+)"`)
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return undefined;
  }

  private extractFunctionSignature(content: string, functionName: string): string | undefined {
    // Try multiple patterns for signature extraction
    const patterns = [
      new RegExp(`aide:${functionName}\\s+aide:signature\\s+"([^"]+)"`),
      new RegExp(`aide:${functionName}[^;]*aide:signature\\s+"([^"]+)"`),
      new RegExp(`aide:${functionName}[\\s\\S]*?aide:signature\\s+"([^"]+)"`)
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return undefined;
  }
}