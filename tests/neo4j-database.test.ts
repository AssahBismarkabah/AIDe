/**
 * Neo4j Database Service Tests
 * 
 * Comprehensive test suite for Neo4j database integration including
 * connection management, TTL ingestion, query optimization, and health monitoring.
 */

import { Neo4jDatabaseService } from '../src/services/layer2/neo4j-database';
import type {
  Neo4jConfig,
  IngestionResult,
  BatchIngestionResult,
  ValidationResult,
  QueryPerformance,
  HealthStatus,
  DatabaseMetrics
} from '../src/services/layer2/neo4j-database';

// Mock Neo4j driver
jest.mock('neo4j-driver', () => ({
  driver: jest.fn(),
  auth: {
    basic: jest.fn()
  }
}));

describe('Neo4jDatabaseService', () => {
  let service: Neo4jDatabaseService;
  let mockDriver: any;
  let mockSession: any;
  let mockResult: any;

  beforeEach(() => {
    // Setup mocks
    mockResult = {
      records: [
        {
          get: jest.fn().mockReturnValue({ toNumber: () => 42 })
        }
      ],
      summary: {
        profile: {
          operatorType: 'NodeIndexSeek',
          dbHits: 100,
          rows: 10,
          time: 50
        },
        plan: {
          operatorType: 'NodeIndexSeek',
          cost: 1.5,
          rows: 10,
          arguments: {
            EstimatedRows: 10,
            index: 'test_index',
            properties: ['id']
          }
        }
      }
    };

    mockSession = {
      run: jest.fn().mockResolvedValue(mockResult),
      close: jest.fn().mockResolvedValue(undefined),
      executeWrite: jest.fn().mockResolvedValue(mockResult)
    };

    mockDriver = {
      session: jest.fn().mockReturnValue(mockSession),
      close: jest.fn().mockResolvedValue(undefined)
    };

    const neo4j = require('neo4j-driver');
    neo4j.driver.mockReturnValue(mockDriver);
    neo4j.auth.basic.mockReturnValue({ username: 'neo4j', password: 'password' });

    service = new Neo4jDatabaseService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    const testConfig: Neo4jConfig = {
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'password',
      database: 'neo4j'
    };

    test('should connect to Neo4j database successfully', async () => {
      const driver = await service.connect(testConfig);
      
      expect(driver).toBe(mockDriver);
      expect(service.isConnected()).toBe(true);
      expect(service.getDriver()).toBe(mockDriver);
    });

    test('should test connection successfully', async () => {
      await service.connect(testConfig);
      const isConnected = await service.testConnection();
      
      expect(isConnected).toBe(true);
      expect(mockSession.run).toHaveBeenCalledWith('RETURN 1 as test');
    });

    test('should handle connection failure', async () => {
      const neo4j = require('neo4j-driver');
      neo4j.driver.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await expect(service.connect(testConfig)).rejects.toThrow('Connection failed');
    });

    test('should disconnect from database', async () => {
      await service.connect(testConfig);
      await service.disconnect();
      
      expect(mockDriver.close).toHaveBeenCalled();
      expect(service.isConnected()).toBe(false);
    });

    test('should get session with correct database', async () => {
      await service.connect(testConfig);
      service.getSession('test_db');
      
      expect(mockDriver.session).toHaveBeenCalledWith({ database: 'test_db' });
    });

    test('should execute transaction successfully', async () => {
      await service.connect(testConfig);
      
      const workFunction = jest.fn().mockResolvedValue('transaction_result');
      mockSession.executeWrite.mockResolvedValue('transaction_result');
      
      const result = await service.executeTransaction(workFunction);
      
      expect(result).toBe('transaction_result');
      expect(mockSession.executeWrite).toHaveBeenCalled();
    });
  });

  describe('TTL Ingestion Pipeline', () => {
    const sampleTTL = `
      @prefix ex: <http://example.org/> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      
      ex:Module1 rdf:type ex:Module .
      ex:Module1 ex:hasFunction ex:Function1 .
      ex:Function1 rdf:type ex:Function .
    `;

    beforeEach(async () => {
      const testConfig: Neo4jConfig = {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'password'
      };
      await service.connect(testConfig);
    });

    test('should validate TTL content successfully', async () => {
      const validation: ValidationResult = await service.validateTTLBeforeIngestion(sampleTTL);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.tripleCount).toBeGreaterThan(0);
    });

    test('should detect invalid TTL syntax', async () => {
      const invalidTTL = `
        invalid syntax here
        missing prefixes
      `;
      
      const validation: ValidationResult = await service.validateTTLBeforeIngestion(invalidTTL);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should ingest TTL content successfully', async () => {
      const result: IngestionResult = await service.ingestTTLContent(sampleTTL, 'test.ttl');
      
      expect(result.success).toBe(true);
      expect(result.sourceFile).toBe('test.ttl');
      expect(result.nodesCreated).toBeGreaterThan(0);
      expect(result.cypherQueries.length).toBeGreaterThan(0);
    });

    test('should handle TTL ingestion errors gracefully', async () => {
      mockSession.run.mockRejectedValue(new Error('Cypher execution failed'));
      
      const result: IngestionResult = await service.ingestTTLContent(sampleTTL, 'test.ttl');
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('CYPHER_ERROR');
    });

    test('should batch ingest multiple TTL files', async () => {
      // Mock file system
      const fs = require('fs/promises');
      jest.spyOn(fs, 'readFile').mockResolvedValue(sampleTTL);

      const filePaths = ['file1.ttl', 'file2.ttl', 'file3.ttl'];
      const result: BatchIngestionResult = await service.batchIngestTTLFiles(filePaths);
      
      expect(result.totalFiles).toBe(3);
      expect(result.successfulFiles).toBe(3);
      expect(result.failedFiles).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    test('should create nodes from RDF triples', async () => {
      const triples = [
        {
          subject: 'ex:Module1',
          predicate: 'rdf:type',
          object: 'ex:Module',
          objectType: 'uri' as const,
          sourceFile: 'test.ttl',
          lineNumber: 1
        }
      ];

      const result = await service.createNodesFromTriples(triples);
      
      expect(result.nodesCreated).toBe(1);
      expect(result.nodesByLabel).toHaveProperty('ex:Module');
      expect(result.nodesByLabel['ex:Module']).toBe(1);
      expect(result.cypherQueries.length).toBeGreaterThan(0);
    });

    test('should create relationships from RDF triples', async () => {
      const triples = [
        {
          subject: 'ex:Module1',
          predicate: 'ex:hasFunction',
          object: 'ex:Function1',
          objectType: 'uri' as const,
          sourceFile: 'test.ttl',
          lineNumber: 2
        }
      ];

      const result = await service.createRelationshipsFromTriples(triples);
      
      expect(result.relationshipsCreated).toBe(1);
      expect(result.relationshipsByType).toHaveProperty('ex:hasFunction');
      expect(result.relationshipsByType['ex:hasFunction']).toBe(1);
      expect(result.cypherQueries.length).toBeGreaterThan(0);
    });
  });

  describe('Query Optimization', () => {
    beforeEach(async () => {
      const testConfig: Neo4jConfig = {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'password'
      };
      await service.connect(testConfig);
    });

    test('should optimize query with index hints', async () => {
      const query = "MATCH (n:Node) WHERE n.id = 'test' RETURN n";
      const optimized = await service.optimizeQuery(query);
      
      expect(optimized.originalQuery).toBe(query);
      expect(optimized.optimizations.length).toBeGreaterThan(0);
      expect(optimized.estimatedImprovement).toBeGreaterThan(0);
    });

    test('should analyze query performance', async () => {
      const query = "MATCH (n:Node) RETURN count(n)";
      
      // Mock the session.run to simulate PROFILE query execution
      mockSession.run.mockImplementation(() => {
        // Simulate some execution time
        return Promise.resolve({
          ...mockResult,
          summary: {
            profile: {
              operatorType: 'NodeIndexSeek',
              dbHits: 100,
              rows: 10,
              time: 50
            },
            plan: mockResult.summary.plan
          }
        });
      });
      
      const performance: QueryPerformance = await service.analyzeQueryPerformance(query);
      
      expect(performance.executionTime).toBeGreaterThanOrEqual(0);
      expect(performance.dbHits).toBe(100);
      expect(performance.rows).toBe(1);
      expect(performance.profile).toBeDefined();
    });

    test('should suggest indexes for query', async () => {
      const query = "MATCH (n:Node) WHERE n.name = 'test' RETURN n";
      const suggestions = await service.suggestIndexes(query);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].type).toBe('BTREE');
      expect(suggestions[0].cypherCommand).toContain('CREATE INDEX');
    });

    test('should validate query syntax', async () => {
      const validQuery = "MATCH (n:Node) RETURN n";
      const validation = await service.validateQuery(validQuery);
      
      expect(validation.valid).toBe(true);
      expect(validation.syntax.valid).toBe(true);
      expect(validation.semantics.valid).toBe(true);
    });

    test('should detect invalid query syntax', async () => {
      const invalidQuery = "INVALID CYPHER SYNTAX";
      const validation = await service.validateQuery(invalidQuery);
      
      expect(validation.valid).toBe(false);
      expect(validation.syntax.valid).toBe(false);
    });

    test('should explain query execution plan', async () => {
      const query = "MATCH (n:Node) RETURN n";
      const explanation = await service.explainQuery(query);
      
      expect(explanation.query).toBe(query);
      expect(explanation.executionPlan).toBeDefined();
      expect(explanation.estimatedCost).toBe(10);
      expect(explanation.estimatedRows).toBe(10);
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      const testConfig: Neo4jConfig = {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'password'
      };
      await service.connect(testConfig);
    });

    test('should check overall health status', async () => {
      const health: HealthStatus = await service.checkHealth();
      
      expect(health.status).toBe('HEALTHY');
      expect(health.checks.length).toBeGreaterThan(0);
      expect(health.lastChecked).toBeInstanceOf(Date);
    });

    test('should get database metrics', async () => {
      // Mock additional queries for metrics
      mockSession.run
        .mockResolvedValueOnce({ records: [{ get: () => ({ toNumber: () => 100 }) }] }) // node count
        .mockResolvedValueOnce({ records: [{ get: () => ({ toNumber: () => 50 }) }] })  // relationship count
        .mockResolvedValueOnce({ records: [{ get: (key: string) => key === 'label' ? 'TestLabel' : ({ toNumber: () => 25 }) }] }) // label counts
        .mockResolvedValueOnce({ records: [{ get: (key: string) => key === 'relationshipType' ? 'TEST_REL' : ({ toNumber: () => 15 }) }] }); // rel type counts

      const metrics: DatabaseMetrics = await service.getMetrics();
      
      expect(metrics.nodeCount).toBe(100);
      expect(metrics.relationshipCount).toBe(50);
      expect(metrics.labelCounts).toBeDefined();
      expect(metrics.relationshipTypeCounts).toBeDefined();
    });

    test('should get constraints information', async () => {
      mockSession.run.mockResolvedValue({
        records: [
          {
            get: (key: string) => {
              switch (key) {
                case 'name': return 'test_constraint';
                case 'type': return 'UNIQUE';
                case 'state': return 'ONLINE';
                case 'labelsOrTypes': return ['TestLabel'];
                case 'properties': return ['id'];
                default: return null;
              }
            }
          }
        ]
      });

      const constraints = await service.getConstraints();
      
      expect(constraints).toHaveLength(1);
      expect(constraints[0].name).toBe('test_constraint');
      expect(constraints[0].type).toBe('UNIQUE');
      expect(constraints[0].state).toBe('ONLINE');
    });

    test('should get indexes information', async () => {
      mockSession.run.mockResolvedValue({
        records: [
          {
            get: (key: string) => {
              switch (key) {
                case 'name': return 'test_index';
                case 'type': return 'BTREE';
                case 'state': return 'ONLINE';
                case 'labelsOrTypes': return ['TestLabel'];
                case 'properties': return ['name'];
                case 'populationPercent': return 100.0;
                default: return null;
              }
            }
          }
        ]
      });

      const indexes = await service.getIndexes();
      
      expect(indexes).toHaveLength(1);
      expect(indexes[0].name).toBe('test_index');
      expect(indexes[0].type).toBe('BTREE');
      expect(indexes[0].state).toBe('ONLINE');
    });

    test('should handle health check failures', async () => {
      mockSession.run.mockRejectedValue(new Error('Database unavailable'));
      
      const health: HealthStatus = await service.checkHealth();
      
      expect(health.status).toBe('UNHEALTHY');
      expect(health.checks.some(check => check.status === 'FAIL')).toBe(true);
    });
  });

  describe('Event Handling', () => {
    test('should emit database events', async () => {
      const eventListener = jest.fn();
      service.on('database_event', eventListener);

      const testConfig: Neo4jConfig = {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'password'
      };

      await service.connect(testConfig);
      
      expect(eventListener).toHaveBeenCalled();
      const event = eventListener.mock.calls[0][0];
      expect(event.type).toBe('CONNECTION');
      expect(event.severity).toBe('INFO');
    });

    test('should emit error events', async () => {
      const eventListener = jest.fn();
      service.on('database_event', eventListener);

      const neo4j = require('neo4j-driver');
      neo4j.driver.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const testConfig: Neo4jConfig = {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'password'
      };

      try {
        await service.connect(testConfig);
      } catch (error) {
        // Expected to fail
      }
      
      expect(eventListener).toHaveBeenCalled();
      const event = eventListener.mock.calls[0][0];
      expect(event.type).toBe('ERROR');
      expect(event.severity).toBe('ERROR');
    });
  });

  describe('Error Handling', () => {
    test('should handle driver initialization errors', async () => {
      const testConfig: Neo4jConfig = {
        uri: 'invalid://uri',
        username: 'neo4j',
        password: 'password'
      };

      const neo4j = require('neo4j-driver');
      neo4j.driver.mockImplementation(() => {
        throw new Error('Invalid URI');
      });

      await expect(service.connect(testConfig)).rejects.toThrow('Invalid URI');
    });

    test('should handle session creation errors', async () => {
      const testConfig: Neo4jConfig = {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'password'
      };

      await service.connect(testConfig);
      
      mockDriver.session.mockImplementation(() => {
        throw new Error('Session creation failed');
      });

      expect(() => service.getSession()).toThrow('Session creation failed');
    });

    test('should handle query execution errors', async () => {
      const testConfig: Neo4jConfig = {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'password'
      };

      await service.connect(testConfig);
      
      mockSession.run.mockRejectedValue(new Error('Query failed'));

      await expect(service.analyzeQueryPerformance('INVALID QUERY')).rejects.toThrow('Query performance analysis failed');
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete TTL ingestion workflow', async () => {
      const testConfig: Neo4jConfig = {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'password'
      };

      await service.connect(testConfig);

      const sampleTTL = `
        @prefix ex: <http://example.org/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        
        ex:Module1 rdf:type ex:Module .
        ex:Module1 ex:hasFunction ex:Function1 .
        ex:Function1 rdf:type ex:Function .
        ex:Function1 ex:hasParameter "param1" .
      `;

      // Validate TTL
      const validation = await service.validateTTLBeforeIngestion(sampleTTL);
      expect(validation.valid).toBe(true);

      // Ingest TTL
      const ingestionResult = await service.ingestTTLContent(sampleTTL, 'test-module.ttl');
      expect(ingestionResult.success).toBe(true);
      expect(ingestionResult.nodesCreated).toBeGreaterThanOrEqual(0);
      expect(ingestionResult.relationshipsCreated).toBeGreaterThanOrEqual(0);

      // Check health after ingestion
      const health = await service.checkHealth();
      expect(health.status).toBe('HEALTHY');

      // Get metrics
      const metrics = await service.getMetrics();
      expect(metrics.nodeCount).toBeGreaterThan(0);
    });

    test('should handle query optimization workflow', async () => {
      const testConfig: Neo4jConfig = {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'password'
      };

      await service.connect(testConfig);

      const query = "MATCH (n:Module) WHERE n.name = 'TestModule' RETURN n";

      // Validate query
      const validation = await service.validateQuery(query);
      expect(validation.valid).toBe(true);

      // Optimize query
      const optimization = await service.optimizeQuery(query);
      expect(optimization.originalQuery).toBe(query);

      // Analyze performance
      const performance = await service.analyzeQueryPerformance(query);
      expect(performance.executionTime).toBeGreaterThanOrEqual(0);

      // Get index suggestions
      const suggestions = await service.suggestIndexes(query);
      expect(suggestions.length).toBeGreaterThan(0);

      // Explain query
      const explanation = await service.explainQuery(query);
      expect(explanation.executionPlan).toBeDefined();
    });
  });
});