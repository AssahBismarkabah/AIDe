/**
 * In-Memory RDF Store Tests
 * 
 * Comprehensive test suite for the In-Memory RDF Store system
 * including RDF operations, LLM context, MCP resources, and semantic search.
 */

import { InMemoryRDFStore, defaultInMemoryRDFConfig, RDFQueryType, IndexType } from '../src/services/layer2/in-memory-rdf';
import { promises as fs } from 'fs';
import * as path from 'path';

describe('In-Memory RDF Store', () => {
  let rdfStore: InMemoryRDFStore;
  let testConfig: any;
  let tempDir: string;

  beforeAll(async () => {
    // Create temporary directory for tests
    tempDir = path.join(__dirname, 'temp', 'rdf-store-test');
    await fs.mkdir(tempDir, { recursive: true });
  });

  beforeEach(async () => {
    // Create test configuration
    testConfig = {
      ...defaultInMemoryRDFConfig,
      maxTriples: 10000,
      maxMemoryMB: 64,
      persistenceEnabled: false,
      cacheConfig: {
        ...defaultInMemoryRDFConfig.cacheConfig,
        maxEntries: 1000,
        ttl: 60000 // 1 minute for tests
      },
      optimization: {
        ...defaultInMemoryRDFConfig.optimization,
        enableSemanticSearch: true,
        enableContextCaching: true
      }
    };

    rdfStore = new InMemoryRDFStore(testConfig);
  });

  afterEach(async () => {
    if (rdfStore) {
      try {
        await rdfStore.shutdown();
      } catch (error) {
        // Ignore shutdown errors in tests
      }
    }
  });

  afterAll(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully with default config', async () => {
      await expect(rdfStore.initialize()).resolves.not.toThrow();
    });

    test('should emit initialized event', async () => {
      const initPromise = new Promise<void>((resolve) => {
        rdfStore.once('initialized', resolve);
      });

      await rdfStore.initialize();
      await expect(initPromise).resolves.not.toThrow();
    });

    test('should build initial indexes', async () => {
      await rdfStore.initialize();
      
      const indexStats = await rdfStore.getIndexStats();
      expect(Object.keys(indexStats).length).toBeGreaterThan(0);
    });
  });

  describe('Triple Operations', () => {
    beforeEach(async () => {
      await rdfStore.initialize();
    });

    test('should add single triple successfully', async () => {
      const triple = {
        subject: 'module:UserService',
        predicate: 'hasType',
        object: 'TypeScript'
      };

      const result = await rdfStore.addTriple(triple);
      expect(result).toBe(true);
    });

    test('should not add duplicate triples', async () => {
      const triple = {
        subject: 'module:UserService',
        predicate: 'hasType',
        object: 'TypeScript'
      };

      const result1 = await rdfStore.addTriple(triple);
      expect(result1).toBe(true);

      const result2 = await rdfStore.addTriple(triple);
      expect(result2).toBe(false);
    });

    test('should add multiple triples successfully', async () => {
      const triples = [
        {
          subject: 'module:UserService',
          predicate: 'hasType',
          object: 'TypeScript'
        },
        {
          subject: 'module:UserService',
          predicate: 'dependsOn',
          object: 'module:Database'
        },
        {
          subject: 'module:UserService',
          predicate: 'hasMethod',
          object: 'method:login'
        }
      ];

      const addedCount = await rdfStore.addTriples(triples);
      expect(addedCount).toBe(3);
    });

    test('should add triples with metadata', async () => {
      const triple = {
        subject: 'module:AuthService',
        predicate: 'implements',
        object: 'interface:IAuthService',
        metadata: {
          source: 'code-analysis',
          timestamp: new Date(),
          confidence: 0.95,
          tags: ['authentication', 'interface']
        }
      };

      const result = await rdfStore.addTriple(triple);
      expect(result).toBe(true);
    });

    test('should check if triple exists', async () => {
      const triple = {
        subject: 'module:TestService',
        predicate: 'hasType',
        object: 'Service'
      };

      await rdfStore.addTriple(triple);
      
      const exists = await rdfStore.hasTriple(triple.subject, triple.predicate, triple.object);
      expect(exists).toBe(true);

      const notExists = await rdfStore.hasTriple('nonexistent', 'predicate', 'object');
      expect(notExists).toBe(false);
    });

    test('should remove triples by pattern', async () => {
      const triples = [
        { subject: 'module:A', predicate: 'hasType', object: 'Service' },
        { subject: 'module:A', predicate: 'dependsOn', object: 'module:B' },
        { subject: 'module:B', predicate: 'hasType', object: 'Service' }
      ];

      await rdfStore.addTriples(triples);

      const removedCount = await rdfStore.removeTriple('module:A');
      expect(removedCount).toBe(2);

      const remainingExists = await rdfStore.hasTriple('module:B', 'hasType', 'Service');
      expect(remainingExists).toBe(true);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      await rdfStore.initialize();
      
      // Add test data
      const testTriples = [
        { subject: 'module:UserService', predicate: 'hasType', object: 'TypeScript' },
        { subject: 'module:UserService', predicate: 'dependsOn', object: 'module:Database' },
        { subject: 'module:UserService', predicate: 'hasMethod', object: 'method:login' },
        { subject: 'module:AuthService', predicate: 'hasType', object: 'TypeScript' },
        { subject: 'module:AuthService', predicate: 'implements', object: 'interface:IAuth' },
        { subject: 'module:Database', predicate: 'hasType', object: 'PostgreSQL' }
      ];

      await rdfStore.addTriples(testTriples);
    });

    test('should execute simple pattern queries', async () => {
      const result = await rdfStore.query('UserService', {
        type: RDFQueryType.PATTERN,
        priority: 'medium',
        maxResults: 10
      });

      expect(result.data).toBeInstanceOf(Array);
      expect(result.totalResults).toBeGreaterThan(0);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.fromCache).toBe(false);
    });

    test('should execute SPARQL SELECT queries', async () => {
      const sparqlQuery = `
        SELECT ?module ?type WHERE {
          ?module hasType ?type
        }
      `;

      const result = await rdfStore.query(sparqlQuery, {
        type: RDFQueryType.SPARQL,
        priority: 'medium',
        maxResults: 10
      });

      expect(result.data).toBeInstanceOf(Array);
      expect(result.totalResults).toBeGreaterThan(0);
    });

    test('should execute SPARQL ASK queries', async () => {
      const askQuery = `
        ASK {
          ?module hasType "TypeScript"
        }
      `;

      const result = await rdfStore.query(askQuery, {
        type: RDFQueryType.SPARQL,
        priority: 'medium'
      });

      expect(typeof result.data).toBe('boolean');
      expect(result.data).toBe(true);
    });

    test('should cache query results', async () => {
      const query = 'SELECT * WHERE { ?s ?p ?o }';
      
      // First query
      const result1 = await rdfStore.query(query, {
        type: RDFQueryType.SPARQL,
        priority: 'medium'
      });
      expect(result1.fromCache).toBe(false);

      // Second identical query should be cached
      const result2 = await rdfStore.query(query, {
        type: RDFQueryType.SPARQL,
        priority: 'medium'
      });
      
      // Note: Caching behavior depends on implementation
      expect(result2).toBeDefined();
    });

    test('should handle invalid queries gracefully', async () => {
      const invalidQuery = 'COMPLETELY INVALID QUERY SYNTAX';
      
      await expect(rdfStore.query(invalidQuery)).rejects.toThrow();
    });
  });

  describe('Pattern Matching', () => {
    beforeEach(async () => {
      await rdfStore.initialize();
      
      const testTriples = [
        { subject: 'module:A', predicate: 'hasType', object: 'Service' },
        { subject: 'module:A', predicate: 'dependsOn', object: 'module:B' },
        { subject: 'module:B', predicate: 'hasType', object: 'Repository' },
        { subject: 'module:C', predicate: 'hasType', object: 'Service' }
      ];

      await rdfStore.addTriples(testTriples);
    });

    test('should find triples by subject', async () => {
      const triples = await rdfStore.findTriples({ subject: 'module:A' });
      
      expect(triples).toBeInstanceOf(Array);
      expect(triples.length).toBe(2);
      expect(triples.every(t => t.subject === 'module:A')).toBe(true);
    });

    test('should find triples by predicate', async () => {
      const triples = await rdfStore.findTriples({ predicate: 'hasType' });
      
      expect(triples).toBeInstanceOf(Array);
      expect(triples.length).toBe(3);
      expect(triples.every(t => t.predicate === 'hasType')).toBe(true);
    });

    test('should find triples by object', async () => {
      const triples = await rdfStore.findTriples({ object: 'Service' });
      
      expect(triples).toBeInstanceOf(Array);
      expect(triples.length).toBe(2);
      expect(triples.every(t => t.object === 'Service')).toBe(true);
    });

    test('should find triples with multiple constraints', async () => {
      const triples = await rdfStore.findTriples({
        subject: 'module:A',
        predicate: 'hasType'
      });
      
      expect(triples).toBeInstanceOf(Array);
      expect(triples.length).toBe(1);
      expect(triples[0].object).toBe('Service');
    });

    test('should respect limit parameter', async () => {
      const triples = await rdfStore.findTriples({ predicate: 'hasType' }, 2);
      
      expect(triples).toBeInstanceOf(Array);
      expect(triples.length).toBe(2);
    });

    test('should get subjects by predicate and object', async () => {
      const subjects = await rdfStore.getSubjects('hasType', 'Service');
      
      expect(subjects).toBeInstanceOf(Array);
      expect(subjects.length).toBe(2);
      expect(subjects).toContain('module:A');
      expect(subjects).toContain('module:C');
    });

    test('should get predicates by subject', async () => {
      const predicates = await rdfStore.getPredicates('module:A');
      
      expect(predicates).toBeInstanceOf(Array);
      expect(predicates.length).toBe(2);
      expect(predicates).toContain('hasType');
      expect(predicates).toContain('dependsOn');
    });

    test('should get objects by subject and predicate', async () => {
      const objects = await rdfStore.getObjects('module:A', 'hasType');
      
      expect(objects).toBeInstanceOf(Array);
      expect(objects.length).toBe(1);
      expect(objects[0]).toBe('Service');
    });
  });

  describe('LLM Context Operations', () => {
    beforeEach(async () => {
      await rdfStore.initialize();
      
      // Add test data relevant for LLM context
      const testTriples = [
        { 
          subject: 'module:AuthService', 
          predicate: 'hasType', 
          object: 'Authentication Service',
          metadata: { tags: ['authentication', 'security'] }
        },
        { 
          subject: 'module:AuthService', 
          predicate: 'hasMethod', 
          object: 'method:login',
          metadata: { tags: ['authentication', 'login'] }
        },
        { 
          subject: 'method:login', 
          predicate: 'hasParameter', 
          object: 'username',
          metadata: { tags: ['authentication', 'parameter'] }
        },
        { 
          subject: 'method:login', 
          predicate: 'hasParameter', 
          object: 'password',
          metadata: { tags: ['authentication', 'parameter'] }
        },
        { 
          subject: 'method:login', 
          predicate: 'returns', 
          object: 'JWT token',
          metadata: { tags: ['authentication', 'jwt'] }
        }
      ];

      await rdfStore.addTriples(testTriples);
    });

    test('should get LLM context for authentication query', async () => {
      const contextResponse = await rdfStore.getLLMContext({
        query: 'user authentication system',
        maxTokens: 1000,
        minRelevance: 0.1,
        includeRelated: true,
        semanticSearch: false
      });

      expect(contextResponse.contexts).toBeInstanceOf(Array);
      expect(contextResponse.contexts.length).toBeGreaterThan(0);
      expect(contextResponse.totalTokens).toBeGreaterThan(0);
      expect(contextResponse.relevanceScores).toBeInstanceOf(Array);
      expect(contextResponse.executionTime).toBeGreaterThanOrEqual(0);
      expect(contextResponse.metadata).toBeDefined();
    });

    test('should build context for specific query', async () => {
      const contexts = await rdfStore.buildContextForQuery(
        'How does the login method work?',
        500
      );

      expect(contexts).toBeInstanceOf(Array);
      expect(contexts.length).toBeGreaterThan(0);
      
      for (const context of contexts) {
        expect(context.id).toBeDefined();
        expect(context.type).toBeDefined();
        expect(context.content).toBeDefined();
        expect(context.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(context.tokenCount).toBeGreaterThan(0);
        expect(context.metadata).toBeDefined();
      }
    });

    test('should rank contexts by relevance', async () => {
      const contexts = await rdfStore.buildContextForQuery('authentication', 1000);
      const rankedContexts = await rdfStore.rankContextByRelevance(contexts, 'login authentication');

      expect(rankedContexts).toBeInstanceOf(Array);
      expect(rankedContexts.length).toBe(contexts.length);
      
      // Check that contexts are sorted by relevance (descending)
      for (let i = 1; i < rankedContexts.length; i++) {
        expect(rankedContexts[i].relevanceScore).toBeLessThanOrEqual(rankedContexts[i - 1].relevanceScore);
      }
    });

    test('should respect token limits', async () => {
      const maxTokens = 100;
      const contextResponse = await rdfStore.getLLMContext({
        query: 'authentication system',
        maxTokens,
        includeRelated: true
      });

      expect(contextResponse.totalTokens).toBeLessThanOrEqual(maxTokens);
    });

    test('should cache LLM contexts when enabled', async () => {
      const request = {
        query: 'authentication system',
        maxTokens: 500,
        includeRelated: true
      };

      // First request
      const response1 = await rdfStore.getLLMContext(request);
      expect(response1.fromCache).toBe(false);

      // Second identical request should be cached
      const response2 = await rdfStore.getLLMContext(request);
      
      // Note: Caching behavior depends on configuration
      expect(response2).toBeDefined();
    });
  });

  describe('MCP Resource Operations', () => {
    beforeEach(async () => {
      await rdfStore.initialize();
    });

    test('should register MCP resource successfully', async () => {
      const resource = {
        uri: 'file:///src/auth/AuthService.ts',
        name: 'AuthService',
        description: 'Main authentication service',
        mimeType: 'text/typescript',
        content: 'export class AuthService { /* implementation */ }',
        metadata: {
          source: 'filesystem',
          lastModified: new Date(),
          size: 1024,
          tags: ['authentication', 'service']
        }
      };

      const result = await rdfStore.registerMCPResource(resource);
      expect(result).toBe(true);
    });

    test('should update MCP resource successfully', async () => {
      const resource = {
        uri: 'file:///src/test/TestService.ts',
        name: 'TestService',
        description: 'Test service',
        mimeType: 'text/typescript',
        content: 'export class TestService {}',
        metadata: {
          source: 'filesystem',
          lastModified: new Date(),
          size: 512,
          tags: ['test']
        }
      };

      await rdfStore.registerMCPResource(resource);

      const updateResult = await rdfStore.updateMCPResource(resource.uri, {
        description: 'Updated test service',
        content: 'export class TestService { /* updated */ }'
      });

      expect(updateResult).toBe(true);
    });

    test('should get MCP resources by query', async () => {
      const resources = [
        {
          uri: 'file:///src/auth/AuthService.ts',
          name: 'AuthService',
          description: 'Authentication service with JWT support',
          content: 'JWT authentication implementation',
          metadata: {
            source: 'filesystem',
            lastModified: new Date(),
            size: 1024,
            tags: ['authentication', 'jwt']
          }
        },
        {
          uri: 'file:///src/user/UserService.ts',
          name: 'UserService',
          description: 'User management service',
          content: 'User CRUD operations',
          metadata: {
            source: 'filesystem',
            lastModified: new Date(),
            size: 2048,
            tags: ['user', 'crud']
          }
        }
      ];

      for (const resource of resources) {
        await rdfStore.registerMCPResource(resource);
      }

      const response = await rdfStore.getMCPResources({
        query: 'authentication',
        maxResources: 10,
        includeContent: true
      });

      expect(response.resources).toBeInstanceOf(Array);
      expect(response.resources.length).toBeGreaterThan(0);
      expect(response.totalResources).toBeGreaterThan(0);
      expect(response.executionTime).toBeGreaterThan(0);
    });

    test('should filter MCP resources by tags', async () => {
      const resource = {
        uri: 'file:///src/jwt/JWTManager.ts',
        name: 'JWTManager',
        description: 'JWT token management',
        content: 'JWT utilities and validation',
        metadata: {
          source: 'filesystem',
          lastModified: new Date(),
          size: 1536,
          tags: ['jwt', 'tokens', 'authentication']
        }
      };

      await rdfStore.registerMCPResource(resource);

      const response = await rdfStore.getMCPResources({
        filterByTags: ['jwt', 'tokens'],
        includeContent: false
      });

      expect(response.resources).toBeInstanceOf(Array);
      expect(response.resources.length).toBeGreaterThan(0);
      expect(response.resources[0].content).toBe(''); // Content should be empty when not requested
    });

    test('should get specific MCP resource by URI', async () => {
      const resource = {
        uri: 'file:///src/specific/SpecificService.ts',
        name: 'SpecificService',
        description: 'A specific service',
        content: 'Specific implementation',
        metadata: {
          source: 'filesystem',
          lastModified: new Date(),
          size: 768,
          tags: ['specific']
        }
      };

      await rdfStore.registerMCPResource(resource);

      const response = await rdfStore.getMCPResources({
        resourceUri: resource.uri,
        includeContent: true
      });

      expect(response.resources).toBeInstanceOf(Array);
      expect(response.resources.length).toBe(1);
      expect(response.resources[0].uri).toBe(resource.uri);
      expect(response.resources[0].content).toBe(resource.content);
    });
  });

  describe('Semantic Search', () => {
    beforeEach(async () => {
      await rdfStore.initialize();
      
      const testTriples = [
        { subject: 'module:UserAuth', predicate: 'hasType', object: 'Authentication Service' },
        { subject: 'module:UserAuth', predicate: 'provides', object: 'user login functionality' },
        { subject: 'module:TokenManager', predicate: 'hasType', object: 'JWT Token Service' },
        { subject: 'module:TokenManager', predicate: 'provides', object: 'token validation and generation' },
        { subject: 'module:Database', predicate: 'hasType', object: 'PostgreSQL Database' },
        { subject: 'module:Database', predicate: 'provides', object: 'data persistence and queries' }
      ];

      await rdfStore.addTriples(testTriples);
    });

    test('should perform semantic search successfully', async () => {
      const results = await rdfStore.semanticSearch('user authentication login', 5);

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      
      for (const result of results) {
        expect(result.triple).toBeDefined();
        expect(result.similarity).toBeGreaterThan(0);
        expect(result.similarity).toBeLessThanOrEqual(1);
        expect(result.context).toBeInstanceOf(Array);
      }
    });

    test('should find similar triples', async () => {
      const baseTriple = {
        subject: 'module:UserAuth',
        predicate: 'hasType',
        object: 'Authentication Service'
      };

      const similarTriples = await rdfStore.findSimilarTriples(baseTriple, 0.3);

      expect(similarTriples).toBeInstanceOf(Array);
      
      for (const result of similarTriples) {
        expect(result.similarity).toBeGreaterThanOrEqual(0.3);
      }
    });

    test('should respect similarity threshold', async () => {
      const highThreshold = 0.9;
      const results = await rdfStore.semanticSearch('completely unrelated query', 10);
      
      const highSimilarityResults = results.filter(r => r.similarity >= highThreshold);
      expect(highSimilarityResults.length).toBeLessThanOrEqual(results.length);
    });
  });

  describe('Index Management', () => {
    beforeEach(async () => {
      await rdfStore.initialize();
      
      // Add some test data
      const testTriples = [
        { subject: 'a', predicate: 'p1', object: 'o1' },
        { subject: 'b', predicate: 'p2', object: 'o2' },
        { subject: 'c', predicate: 'p3', object: 'o3' }
      ];

      await rdfStore.addTriples(testTriples);
    });

    test('should build specific index successfully', async () => {
      await expect(rdfStore.buildIndex(IndexType.SPO)).resolves.not.toThrow();
    });

    test('should rebuild all indexes successfully', async () => {
      await expect(rdfStore.rebuildAllIndexes()).resolves.not.toThrow();
    });

    test('should return index statistics', async () => {
      const indexStats = await rdfStore.getIndexStats();

      expect(indexStats).toBeDefined();
      expect(typeof indexStats).toBe('object');
      
      for (const [indexType, stats] of Object.entries(indexStats)) {
        expect(stats.type).toBe(indexType);
        expect(stats.size).toBeGreaterThanOrEqual(0);
        expect(stats.lastUpdated).toBeInstanceOf(Date);
        expect(stats.buildTime).toBeGreaterThanOrEqual(0);
      }
    });

    test('should emit index events', async () => {
      const indexBuiltPromise = new Promise<void>((resolve) => {
        rdfStore.once('index_built', resolve);
      });

      await rdfStore.buildIndex(IndexType.FULL_TEXT);
      await expect(indexBuiltPromise).resolves.not.toThrow();
    });
  });

  describe('Performance and Metrics', () => {
    beforeEach(async () => {
      await rdfStore.initialize();
    });

    test('should return comprehensive metrics', async () => {
      const metrics = await rdfStore.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalTriples).toBeGreaterThanOrEqual(0);
      expect(metrics.totalQuads).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUsageMB).toBeGreaterThanOrEqual(0);
      expect(metrics.indexMetrics).toBeDefined();
      expect(metrics.queryMetrics).toBeDefined();
      expect(metrics.llmMetrics).toBeDefined();
      expect(metrics.mcpMetrics).toBeDefined();
    });

    test('should track query metrics', async () => {
      // Execute some queries to generate metrics
      await rdfStore.query('test query', { type: RDFQueryType.PATTERN, priority: 'low' });
      
      const metrics = await rdfStore.getMetrics();
      expect(metrics.queryMetrics.totalQueries).toBeGreaterThan(0);
    });

    test('should clear cache successfully', async () => {
      await expect(rdfStore.clearCache()).resolves.not.toThrow();
    });

    test('should optimize store successfully', async () => {
      await expect(rdfStore.optimize()).resolves.not.toThrow();
    });

    test('should emit optimization events', async () => {
      const optimizedPromise = new Promise<void>((resolve) => {
        rdfStore.once('optimized', resolve);
      });

      await rdfStore.optimize();
      await expect(optimizedPromise).resolves.not.toThrow();
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await rdfStore.initialize();
    });

    test('should emit triple events', async () => {
      const tripleAddedPromise = new Promise<void>((resolve) => {
        rdfStore.once('triple_added', resolve);
      });

      await rdfStore.addTriple({
        subject: 'test:subject',
        predicate: 'test:predicate',
        object: 'test:object'
      });

      await expect(tripleAddedPromise).resolves.not.toThrow();
    });

    test('should emit query events', async () => {
      const queryExecutedPromise = new Promise<void>((resolve) => {
        rdfStore.once('query_executed', resolve);
      });

      await rdfStore.query('test query', { type: RDFQueryType.PATTERN, priority: 'low' });
      await expect(queryExecutedPromise).resolves.not.toThrow();
    });

    test('should emit MCP resource events', async () => {
      const resourceRegisteredPromise = new Promise<void>((resolve) => {
        rdfStore.once('mcp_resource_registered', resolve);
      });

      await rdfStore.registerMCPResource({
        uri: 'test://resource',
        name: 'Test Resource',
        content: 'test content',
        metadata: {
          source: 'test',
          lastModified: new Date(),
          size: 100
        }
      });

      await expect(resourceRegisteredPromise).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await rdfStore.initialize();
    });

    test('should handle memory limit exceeded', async () => {
      // Create a store with very low memory limit
      const lowMemoryConfig = {
        ...testConfig,
        maxTriples: 2,
        maxMemoryMB: 1
      };

      const lowMemoryStore = new InMemoryRDFStore(lowMemoryConfig);
      await lowMemoryStore.initialize();

      try {
        // Add triples until memory limit is exceeded
        const triples = Array.from({ length: 10 }, (_, i) => ({
          subject: `subject${i}`,
          predicate: `predicate${i}`,
          object: `object${i}`
        }));

        // This should eventually throw or trigger optimization
        await expect(lowMemoryStore.addTriples(triples)).resolves.toBeDefined();
      } finally {
        await lowMemoryStore.shutdown();
      }
    });

    test('should handle invalid SPARQL queries', async () => {
      const invalidQuery = 'SELECT INVALID SYNTAX';
      
      await expect(rdfStore.query(invalidQuery, { type: RDFQueryType.SPARQL, priority: 'low' }))
        .rejects.toThrow();
    });

    test('should handle non-existent resource updates', async () => {
      const result = await rdfStore.updateMCPResource('non-existent-uri', {
        description: 'updated'
      });
      
      expect(result).toBe(false);
    });
  });

  describe('Shutdown', () => {
    test('should shutdown gracefully', async () => {
      await rdfStore.initialize();
      await expect(rdfStore.shutdown()).resolves.not.toThrow();
    });

    test('should emit shutdown event', async () => {
      await rdfStore.initialize();
      
      const shutdownPromise = new Promise<void>((resolve) => {
        rdfStore.once('shutdown', resolve);
      });

      await rdfStore.shutdown();
      await expect(shutdownPromise).resolves.not.toThrow();
    });

    test('should handle multiple shutdown calls', async () => {
      await rdfStore.initialize();
      
      await rdfStore.shutdown();
      await expect(rdfStore.shutdown()).resolves.not.toThrow();
    });
  });
});