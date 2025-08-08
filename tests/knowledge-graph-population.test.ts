/**
 * Knowledge Graph Population Tests
 * 
 * Comprehensive test suite for the automatic knowledge graph population system
 * including TTL ingestion, entity creation, and Neo4j integration.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { KnowledgeGraphPopulator } from '../src/services/project-analysis/KnowledgeGraphPopulator';
import { Neo4jDatabaseService } from '../src/services/layer2/neo4j-database/Neo4jDatabaseService';

// Mock Neo4j service
jest.mock('../src/services/layer2/neo4j-database/Neo4jDatabaseService');

describe('KnowledgeGraphPopulator', () => {
  let populator: KnowledgeGraphPopulator;
  let mockNeo4jService: jest.Mocked<Neo4jDatabaseService>;
  let mockSession: any;

  beforeEach(() => {
    // Create mock session
    mockSession = {
      run: jest.fn(),
      close: jest.fn()
    };

    // Create mock Neo4j service
    mockNeo4jService = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      testConnection: jest.fn(),
      getSession: jest.fn().mockReturnValue(mockSession),
      checkHealth: jest.fn(),
      getMetrics: jest.fn(),
      getConstraints: jest.fn(),
      getIndexes: jest.fn(),
      batchIngestTTLFiles: jest.fn()
    } as any;

    // Set up default mock return values
    mockNeo4jService.testConnection.mockResolvedValue(true);

    // Mock the constructor
    (Neo4jDatabaseService as jest.MockedClass<typeof Neo4jDatabaseService>).mockImplementation(() => mockNeo4jService);

    // Create populator instance
    populator = new KnowledgeGraphPopulator({
      neo4jUri: 'bolt://localhost:7687',
      neo4jUsername: 'neo4j',
      neo4jPassword: 'test',
      neo4jDatabase: 'test',
      batchSize: 10,
      enableIndexCreation: true,
      enableConstraintCreation: true,
      preserveExistingData: true,
      conflictResolution: 'merge'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await populator.initialize();

      expect(mockNeo4jService.connect).toHaveBeenCalledWith({
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'test',
        database: 'test'
      });
      expect(mockNeo4jService.testConnection).toHaveBeenCalled();
    });

    it('should create schema constraints during initialization', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await populator.initialize();

      // Verify constraint creation calls
      const constraintCalls = mockSession.run.mock.calls.filter(call => 
        call[0].includes('CREATE CONSTRAINT')
      );
      expect(constraintCalls.length).toBeGreaterThan(0);
    });

    it('should create indexes during initialization', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await populator.initialize();

      // Verify index creation calls
      const indexCalls = mockSession.run.mock.calls.filter(call => 
        call[0].includes('CREATE INDEX') || call[0].includes('CREATE FULLTEXT INDEX')
      );
      expect(indexCalls.length).toBeGreaterThan(0);
    });

    it('should handle connection failures gracefully', async () => {
      mockNeo4jService.testConnection.mockResolvedValue(false);

      await expect(populator.initialize()).rejects.toThrow('Failed to establish Neo4j connection');
    });
  });

  describe('TTL Content Population', () => {
    const sampleTTLContent = `
      @prefix aide: <http://aide.dev/ontology#> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

      aide:TestModule a aide:Module ;
        aide:language "typescript" ;
        aide:businessDomain "E-commerce" ;
        aide:architecturalPattern "Factory Pattern" ;
        aide:complexity 5.2 ;
        aide:maintainability 85.0 ;
        aide:documentation 75.0 .

      aide:UserService a aide:Class ;
        aide:businessContext "Manages user authentication and profiles" ;
        aide:technicalContext "Service layer class with dependency injection" .

      aide:authenticate a aide:Method ;
        aide:signature "authenticate(username: string, password: string): Promise<User>" ;
        aide:businessContext "Validates user credentials against database" .

      aide:getUserProfile a aide:Function ;
        aide:signature "getUserProfile(userId: string): Promise<UserProfile>" ;
        aide:businessContext "Retrieves user profile information" .

      aide:UserService aide:dependsOn aide:DatabaseService .
      aide:authenticate aide:extends aide:BaseAuthMethod .
    `;

    beforeEach(async () => {
      mockSession.run.mockResolvedValue({ records: [{}] });
      await populator.initialize();
    });

    it('should populate knowledge graph from TTL content successfully', async () => {
      const ttlContentMap = new Map([
        ['test-module/.module-knowledge.ttl', { rdfContent: sampleTTLContent }]
      ]);

      const result = await populator.populateFromTTLContent(ttlContentMap);

      expect(result.success).toBe(true);
      expect(result.processedFiles).toBe(1);
      expect(result.failedFiles).toBe(0);
      expect(result.totalNodesCreated).toBeGreaterThan(0);
      expect(result.totalRelationshipsCreated).toBeGreaterThan(0);
    });

    it('should extract module entities correctly from TTL', async () => {
      const ttlContentMap = new Map([
        ['test-module/.module-knowledge.ttl', { rdfContent: sampleTTLContent }]
      ]);

      await populator.populateFromTTLContent(ttlContentMap);

      // Verify module creation query
      const moduleQueries = mockSession.run.mock.calls.filter(call => 
        call[0].includes('MERGE (m:Module')
      );
      expect(moduleQueries.length).toBe(1);

      const moduleParams = moduleQueries[0][1];
      expect(moduleParams.language).toBe('typescript');
      expect(moduleParams.businessDomain).toBe('E-commerce');
      expect(moduleParams.complexityScore).toBe(5.2);
      expect(moduleParams.maintainabilityScore).toBe(85.0);
    });

    it('should extract code entities correctly from TTL', async () => {
      const ttlContentMap = new Map([
        ['test-module/.module-knowledge.ttl', { rdfContent: sampleTTLContent }]
      ]);

      await populator.populateFromTTLContent(ttlContentMap);

      // Verify code entity creation queries
      const entityQueries = mockSession.run.mock.calls.filter(call => 
        call[0].includes('MERGE (e:CodeEntity')
      );
      expect(entityQueries.length).toBe(3); // UserService, authenticate, getUserProfile

      // Check class entity
      const classEntity = entityQueries.find(call => call[1].type === 'class');
      expect(classEntity).toBeDefined();
      expect(classEntity![1].name).toBe('UserService');
      expect(classEntity![1].businessContext).toBe('Manages user authentication and profiles');

      // Check method entity
      const methodEntity = entityQueries.find(call => call[1].type === 'method');
      expect(methodEntity).toBeDefined();
      expect(methodEntity![1].name).toBe('authenticate');
      expect(methodEntity![1].signature).toBe('authenticate(username: string, password: string): Promise<User>');

      // Check function entity
      const functionEntity = entityQueries.find(call => call[1].type === 'function');
      expect(functionEntity).toBeDefined();
      expect(functionEntity![1].name).toBe('getUserProfile');
    });

    it('should create relationships correctly from TTL', async () => {
      const ttlContentMap = new Map([
        ['test-module/.module-knowledge.ttl', { rdfContent: sampleTTLContent }]
      ]);

      await populator.populateFromTTLContent(ttlContentMap);

      // Verify relationship creation queries
      const relationshipQueries = mockSession.run.mock.calls.filter(call => 
        call[0].includes('MERGE (source)-[r:')
      );
      expect(relationshipQueries.length).toBe(2); // DEPENDS_ON and EXTENDS relationships

      // Check DEPENDS_ON relationship
      const dependsOnQuery = relationshipQueries.find(call => 
        call[0].includes(':DEPENDS_ON')
      );
      expect(dependsOnQuery).toBeDefined();

      // Check EXTENDS relationship
      const extendsQuery = relationshipQueries.find(call => 
        call[0].includes(':EXTENDS')
      );
      expect(extendsQuery).toBeDefined();
    });

    it('should handle TTL parsing errors gracefully', async () => {
      const invalidTTLContent = `
        This is not valid TTL content at all
        Missing prefixes and proper syntax
        No aide namespace or proper structure
      `;

      const ttlContentMap = new Map([
        ['invalid-module/.module-knowledge.ttl', { rdfContent: invalidTTLContent }]
      ]);

      const result = await populator.populateFromTTLContent(ttlContentMap);

      expect(result.success).toBe(false);
      expect(result.failedFiles).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('INGESTION_ERROR');
    });

    it('should calculate population statistics correctly', async () => {
      // Mock statistics query response
      mockSession.run.mockImplementation((query) => {
        if (query.includes('count(DISTINCT m) as moduleNodes')) {
          return Promise.resolve({
            records: [{
              get: (key: string) => ({
                toNumber: () => {
                  const stats: Record<string, number> = {
                    moduleNodes: 1,
                    classNodes: 1,
                    methodNodes: 1,
                    functionNodes: 1,
                    dependencyRelationships: 1,
                    inheritanceRelationships: 1,
                    containmentRelationships: 3,
                    businessContextNodes: 3
                  };
                  return stats[key] || 0;
                }
              })
            }]
          });
        }
        return Promise.resolve({ records: [{}] });
      });

      const ttlContentMap = new Map([
        ['test-module/.module-knowledge.ttl', { rdfContent: sampleTTLContent }]
      ]);

      const result = await populator.populateFromTTLContent(ttlContentMap);

      expect(result.statistics.moduleNodes).toBe(1);
      expect(result.statistics.classNodes).toBe(1);
      expect(result.statistics.methodNodes).toBe(1);
      expect(result.statistics.functionNodes).toBe(1);
      expect(result.statistics.dependencyRelationships).toBe(1);
      expect(result.statistics.inheritanceRelationships).toBe(1);
      expect(result.statistics.businessContextNodes).toBe(3);
    });
  });

  describe('Incremental Updates', () => {
    beforeEach(async () => {
      mockSession.run.mockResolvedValue({ records: [{}] });
      await populator.initialize();
    });

    it('should update modules incrementally', async () => {
      const updatedTTLContent = `
        @prefix aide: <http://aide.dev/ontology#> .
        aide:UpdatedModule a aide:Module ;
          aide:language "typescript" ;
          aide:complexity 3.5 .
        aide:NewClass a aide:Class .
      `;

      const moduleUpdates = new Map([
        ['updated-module', { rdfContent: updatedTTLContent }]
      ]);

      const result = await populator.updateModules(moduleUpdates);

      expect(result.success).toBe(true);
      expect(result.processedFiles).toBe(1);
      expect(result.totalNodesCreated).toBeGreaterThan(0);
    });

    it('should handle conflict resolution with replace strategy', async () => {
      // Create populator with replace strategy
      const replacePopulator = new KnowledgeGraphPopulator({
        neo4jUri: 'bolt://localhost:7687',
        neo4jUsername: 'neo4j',
        neo4jPassword: 'test',
        conflictResolution: 'replace'
      });

      // Mock the private property access
      (replacePopulator as any).neo4jService = mockNeo4jService;
      (replacePopulator as any).isInitialized = true;

      const moduleUpdates = new Map([
        ['test-module', { rdfContent: 'aide:TestModule a aide:Module .' }]
      ]);

      await replacePopulator.updateModules(moduleUpdates);

      // Verify that removal query was called
      const removeQueries = mockSession.run.mock.calls.filter(call => 
        call[0].includes('DETACH DELETE')
      );
      expect(removeQueries.length).toBeGreaterThan(0);
    });
  });

  describe('Health Status', () => {
    beforeEach(async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await populator.initialize();
    });

    it('should return comprehensive health status', async () => {
      const mockHealthStatus = { status: 'HEALTHY' as const, checks: [], lastChecked: new Date(), uptime: 1000 };
      const mockMetrics = { nodeCount: 100, relationshipCount: 50, queryCount: 10, averageQueryTime: 50 };
      const mockConstraints = [{ name: 'test_constraint', type: 'UNIQUE', state: 'ONLINE' }];
      const mockIndexes = [{ name: 'test_index', type: 'BTREE', state: 'ONLINE' }];

      mockNeo4jService.checkHealth.mockResolvedValue(mockHealthStatus);
      mockNeo4jService.getMetrics.mockResolvedValue(mockMetrics as any);
      mockNeo4jService.getConstraints.mockResolvedValue(mockConstraints as any);
      mockNeo4jService.getIndexes.mockResolvedValue(mockIndexes as any);

      // Mock statistics query
      mockSession.run.mockResolvedValue({
        records: [{
          get: () => ({ toNumber: () => 0 })
        }]
      });

      const healthStatus = await populator.getHealthStatus();

      expect(healthStatus.neo4jHealth).toEqual(mockHealthStatus);
      expect(healthStatus.databaseMetrics).toEqual(mockMetrics);
      expect(healthStatus.schemaConstraints).toEqual(mockConstraints);
      expect(healthStatus.schemaIndexes).toEqual(mockIndexes);
      expect(healthStatus.populationStatistics).toBeDefined();
    });

    it('should handle health check failures', async () => {
      mockNeo4jService.checkHealth.mockRejectedValue(new Error('Health check failed'));

      await expect(populator.getHealthStatus()).rejects.toThrow('Health check failed');
    });
  });

  describe('Batch Processing', () => {
    beforeEach(async () => {
      mockSession.run.mockResolvedValue({ records: [{}] });
      await populator.initialize();
    });

    it('should process TTL files in batches', async () => {
      const ttlFiles = [
        '/path/to/module1/.module-knowledge.ttl',
        '/path/to/module2/.module-knowledge.ttl',
        '/path/to/module3/.module-knowledge.ttl'
      ];

      const mockBatchResult = {
        totalFiles: 3,
        successfulFiles: 3,
        failedFiles: 0,
        results: [],
        totalNodesCreated: 10,
        totalRelationshipsCreated: 5,
        totalProcessingTime: 1000,
        errors: []
      };

      mockNeo4jService.batchIngestTTLFiles.mockResolvedValue(mockBatchResult);

      const result = await populator.populateFromTTLFiles(ttlFiles);

      expect(result.success).toBe(true);
      expect(result.processedFiles).toBe(3);
      expect(result.totalNodesCreated).toBe(10);
      expect(result.totalRelationshipsCreated).toBe(5);
      expect(mockNeo4jService.batchIngestTTLFiles).toHaveBeenCalled();
    });

    it('should handle batch processing failures', async () => {
      const ttlFiles = ['/path/to/invalid/.module-knowledge.ttl'];

      mockNeo4jService.batchIngestTTLFiles.mockRejectedValue(new Error('Batch processing failed'));

      const result = await populator.populateFromTTLFiles(ttlFiles);

      expect(result.success).toBe(false);
      expect(result.failedFiles).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('INGESTION_ERROR');
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await populator.initialize();

      await populator.shutdown();

      expect(mockNeo4jService.disconnect).toHaveBeenCalled();
    });

    it('should handle shutdown errors', async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await populator.initialize();

      mockNeo4jService.disconnect.mockRejectedValue(new Error('Disconnect failed'));

      await expect(populator.shutdown()).rejects.toThrow('Disconnect failed');
    });
  });

  describe('Error Handling', () => {
    it('should handle Neo4j connection errors during initialization', async () => {
      mockNeo4jService.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(populator.initialize()).rejects.toThrow('Connection failed');
    });

    it('should handle session creation errors', async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await populator.initialize();

      mockNeo4jService.getSession.mockImplementation(() => {
        throw new Error('Session creation failed');
      });

      const ttlContentMap = new Map([
        ['test/.module-knowledge.ttl', { rdfContent: 'aide:Test a aide:Module .' }]
      ]);

      const result = await populator.populateFromTTLContent(ttlContentMap);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle query execution errors', async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await populator.initialize();

      mockSession.run.mockRejectedValue(new Error('Query execution failed'));

      const ttlContentMap = new Map([
        ['test/.module-knowledge.ttl', { rdfContent: 'aide:Test a aide:Module .' }]
      ]);

      const result = await populator.populateFromTTLContent(ttlContentMap);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});