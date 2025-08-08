/**
 * TTL Context Loading Tests
 * 
 * Comprehensive tests for the MCP server TTL context loading functionality.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TTLContextLoader } from '../src/services/mcp-server/TTLContextLoader';
import { EnhancedMCPServer } from '../src/services/mcp-server/EnhancedMCPServer';
import { MCPAnalysisIntegration } from '../src/services/mcp-server/MCPAnalysisIntegration';
import { KnowledgeGraphPopulator } from '../src/services/project-analysis/KnowledgeGraphPopulator';
import { EnhancedRDFGenerator } from '../src/services/layer1/rdf-generator/EnhancedRDFGenerator';
import { ConcreteInformationExtractor } from '../src/services/layer1/rdf-generator/ConcreteInformationExtractor';
import { AutomaticAnalysisService } from '../src/services/automatic-analysis/AutomaticAnalysisService';
import { 
  TTLContextLoaderConfig, 
  EnhancedMCPServerConfig,
  MCPAnalysisIntegrationConfig,
  ContextRequest,
} from '../src/services/mcp-server/types';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('TTL Context Loading', () => {
  let testDir: string;
  let ttlContextLoader: TTLContextLoader;
  let enhancedMCPServer: EnhancedMCPServer;
  let mcpAnalysisIntegration: MCPAnalysisIntegration;
  let mockKnowledgeGraphPopulator: jest.Mocked<KnowledgeGraphPopulator>;
  let mockRDFGenerator: jest.Mocked<EnhancedRDFGenerator>;
  let mockInformationExtractor: jest.Mocked<ConcreteInformationExtractor>;
  let mockAutomaticAnalysisService: jest.Mocked<AutomaticAnalysisService>;
  let mockLayer3Service: any;
  let mockHybridStorage: any;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `ttl-context-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Create mock services
    mockKnowledgeGraphPopulator = {
      populateFromTTLFiles: jest.fn(),
      populateFromTTLContent: jest.fn(),
      updateModules: jest.fn(),
      getHealthStatus: jest.fn(),
      initialize: jest.fn(),
      shutdown: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    mockRDFGenerator = {
      generateEnhancedRDF: jest.fn(),
      generateRDF: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    mockInformationExtractor = {
      extractConcreteInformation: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    mockAutomaticAnalysisService = {
      start: jest.fn(),
      stop: jest.fn(),
      getStatus: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    mockLayer3Service = {
      query: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    };

    mockHybridStorage = {
      on: jest.fn(),
      emit: jest.fn()
    };

    // Setup mock return values
    // Mock KnowledgeGraphPopulator methods
    mockKnowledgeGraphPopulator.populateFromTTLFiles.mockResolvedValue({
      success: true,
      totalTTLFiles: 1,
      processedFiles: 1,
      failedFiles: 0,
      totalNodesCreated: 5,
      totalRelationshipsCreated: 3,
      totalPropertiesSet: 10,
      processingTime: 100,
      errors: [],
      warnings: [],
      statistics: {
        moduleNodes: 1,
        classNodes: 2,
        methodNodes: 3,
        functionNodes: 1,
        dependencyRelationships: 2,
        inheritanceRelationships: 1,
        containmentRelationships: 3,
        businessContextNodes: 1
      }
    });
    // Mock additional KnowledgeGraphPopulator methods
    mockKnowledgeGraphPopulator.getHealthStatus.mockResolvedValue({
      neo4jHealth: { status: 'healthy' },
      databaseMetrics: { nodeCount: 10, relationshipCount: 5 },
      schemaConstraints: [],
      schemaIndexes: [],
      populationStatistics: {
        moduleNodes: 1,
        classNodes: 2,
        methodNodes: 2,
        functionNodes: 0,
        dependencyRelationships: 1,
        inheritanceRelationships: 1,
        containmentRelationships: 1,
        businessContextNodes: 1
      }
    });

    // Mock RDFGenerator methods
    mockRDFGenerator.generateEnhancedRDF.mockResolvedValue({
      moduleId: 'test-module',
      filePath: 'test.ttl',
      rdfContent: '',
      format: 'turtle',
      size: 100,
      generationTime: 50,
      warnings: [],
      statistics: {
        totalTriples: 10,
        classCount: 2,
        methodCount: 3,
        propertyCount: 5,
        dependencyCount: 2,
        documentationTriples: 1,
        businessContextTriples: 1,
        qualityMetricTriples: 1
      }
    });
    // Skip the problematic mock for now - the test will focus on file operations
    // mockInformationExtractor.extractConcreteStructure.mockResolvedValue({});
    mockAutomaticAnalysisService.start.mockResolvedValue(undefined);
    mockAutomaticAnalysisService.stop.mockResolvedValue(undefined);
    mockAutomaticAnalysisService.getStatus.mockReturnValue({
      isActive: true,
      isInitialized: true,
      config: {} as any,
      triggerOrchestrator: null,
      lastAnalysis: undefined,
      totalAnalyses: 5,
      successfulAnalyses: 4,
      failedAnalyses: 1
    });
    mockLayer3Service.query.mockResolvedValue({ results: [] });
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    // Stop services if running
    try {
      if (ttlContextLoader) {
        await ttlContextLoader.stop();
      }
      if (enhancedMCPServer) {
        await enhancedMCPServer.stop();
      }
      if (mcpAnalysisIntegration) {
        await mcpAnalysisIntegration.stop();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('TTLContextLoader', () => {
    beforeEach(() => {
      const config: TTLContextLoaderConfig = {
        watchEnabled: false, // Disable watching for tests
        loadPatterns: [`${testDir}/**/*.module-knowledge.ttl`],
        loadIgnored: [],
        loadConcurrency: 2,
        cacheEnabled: true,
        maxCacheSize: 100,
        cacheTtl: 60000,
        maxTokens: 10000,
        maxFiles: 10,
        relevanceThreshold: 0.1
      };

      ttlContextLoader = new TTLContextLoader(
        config,
        mockKnowledgeGraphPopulator,
        mockRDFGenerator,
        mockInformationExtractor
      );
    });

    it('should initialize successfully', async () => {
      await ttlContextLoader.start();
      
      const metrics = ttlContextLoader.getMetrics();
      expect(metrics.ttlFiles.total).toBe(0);
      expect(metrics.ttlFiles.loaded).toBe(0);
    });

    it('should load TTL files from disk', async () => {
      // Create test TTL files
      const ttlContent1 = `
# Module: TestModule1
# Language: typescript
# Dependencies: react, lodash

@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

:TestClass a :Class ;
  :hasMethod :testMethod ;
  :hasProperty :testProperty .

:testMethod a :Method ;
  :signature "testMethod(): string" ;
  :returnType "string" .
`;

      const ttlContent2 = `
# Module: TestModule2
# Language: javascript
# Dependencies: express, mongoose

@prefix : <http://example.org/> .

:ApiController a :Class ;
  :hasMethod :handleRequest ;
  :pattern "controller" .
`;

      await writeFile(join(testDir, 'module1.module-knowledge.ttl'), ttlContent1);
      await writeFile(join(testDir, 'module2.module-knowledge.ttl'), ttlContent2);

      await ttlContextLoader.start();

      const metrics = ttlContextLoader.getMetrics();
      expect(metrics.ttlFiles.total).toBe(2);
      expect(metrics.ttlFiles.loaded).toBe(2);

      const ttlFiles = ttlContextLoader.getTTLFiles();
      expect(ttlFiles.size).toBe(2);
    });

    it('should generate context for requests', async () => {
      // Create test TTL file
      const ttlContent = `
# Module: UserService
# Language: typescript
# Dependencies: express, bcrypt
# Business Context: User authentication and management

@prefix : <http://example.org/> .

:UserService a :Class ;
  :hasMethod :authenticate, :createUser ;
  :pattern "service" .

:authenticate a :Method ;
  :signature "authenticate(email: string, password: string): Promise<User>" ;
  :returnType "Promise<User>" .
`;

      await writeFile(join(testDir, 'user-service.module-knowledge.ttl'), ttlContent);
      await ttlContextLoader.start();

      const request: ContextRequest = {
        filePath: join(testDir, 'user-service.ts'),
        cursorPosition: { line: 10, column: 5 },
        query: 'authentication',
        intent: 'explanation',
        maxTokens: 5000,
        includeRelated: true
      };

      const response = await ttlContextLoader.loadContext(request);

      expect(response.context).toContain('UserService');
      expect(response.context).toContain('authenticate');
      expect(response.context).toContain('typescript');
      expect(response.sources).toHaveLength(1);
      expect(response.sources[0].relevanceScore).toBeGreaterThan(0);
      expect(response.metadata.totalTokens).toBeGreaterThan(0);
      expect(response.metadata.cached).toBe(false);
    });

    it('should cache context responses', async () => {
      const ttlContent = `
# Module: CacheTest
# Language: typescript

@prefix : <http://example.org/> .
:TestClass a :Class .
`;

      await writeFile(join(testDir, 'cache-test.module-knowledge.ttl'), ttlContent);
      await ttlContextLoader.start();

      const request: ContextRequest = {
        filePath: join(testDir, 'cache-test.ts'),
        cursorPosition: { line: 1, column: 1 },
        maxTokens: 1000
      };

      // First request - should not be cached
      const response1 = await ttlContextLoader.loadContext(request);
      expect(response1.metadata.cached).toBe(false);

      // Second request - should be cached
      const response2 = await ttlContextLoader.loadContext(request);
      expect(response2.metadata.cached).toBe(true);

      const metrics = ttlContextLoader.getMetrics();
      expect(metrics.context.cacheHits).toBe(1);
      expect(metrics.context.cacheMisses).toBe(1);
    });

    it('should handle file refresh', async () => {
      const initialContent = `
# Module: RefreshTest
@prefix : <http://example.org/> .
:InitialClass a :Class .
`;

      const filePath = join(testDir, 'refresh-test.module-knowledge.ttl');
      await writeFile(filePath, initialContent);
      await ttlContextLoader.start();

      let ttlFile = ttlContextLoader.getTTLFile(filePath);
      expect(ttlFile?.content).toContain('InitialClass');

      // Update file content
      const updatedContent = `
# Module: RefreshTest
@prefix : <http://example.org/> .
:UpdatedClass a :Class .
`;

      await writeFile(filePath, updatedContent);
      await ttlContextLoader.refreshTTLFile(filePath);

      ttlFile = ttlContextLoader.getTTLFile(filePath);
      expect(ttlFile?.content).toContain('UpdatedClass');
      expect(ttlFile?.content).not.toContain('InitialClass');
    });

    it('should calculate relevance scores correctly', async () => {
      // Create TTL files with different relevance to request
      const highRelevanceContent = `
# Module: HighRelevance
# Language: typescript
# Dependencies: authentication, user-management

@prefix : <http://example.org/> .
:AuthService a :Class ;
  :hasMethod :login, :logout ;
  :businessDomain "authentication" .
`;

      const lowRelevanceContent = `
# Module: LowRelevance
# Language: python
# Dependencies: numpy, pandas

@prefix : <http://example.org/> .
:DataProcessor a :Class ;
  :hasMethod :processData .
`;

      await writeFile(join(testDir, 'high-relevance.module-knowledge.ttl'), highRelevanceContent);
      await writeFile(join(testDir, 'low-relevance.module-knowledge.ttl'), lowRelevanceContent);
      await ttlContextLoader.start();

      const request: ContextRequest = {
        filePath: join(testDir, 'auth-service.ts'), // TypeScript file
        cursorPosition: { line: 1, column: 1 },
        query: 'authentication login', // Matches high relevance content
        maxTokens: 5000
      };

      const response = await ttlContextLoader.loadContext(request);

      // Should prioritize high relevance file
      expect(response.sources).toHaveLength(2);
      expect(response.sources[0].relevanceScore).toBeGreaterThan(response.sources[1].relevanceScore);
      expect(response.sources[0].path).toContain('high-relevance');
    });
  });

  describe('EnhancedMCPServer', () => {
    beforeEach(() => {
      const ttlConfig: TTLContextLoaderConfig = {
        watchEnabled: false,
        loadPatterns: [`${testDir}/**/*.module-knowledge.ttl`],
        cacheEnabled: true,
        maxCacheSize: 50,
        cacheTtl: 30000,
        maxTokens: 8000,
        maxFiles: 5,
        relevanceThreshold: 0.2
      };

      const mcpConfig: any = {
        server: {
          name: 'test-mcp-server',
          version: '1.0.0',
          port: 0, // Use random port for testing
          host: 'localhost',
          maxConnections: 10,
          timeout: 30000
        },
        context: {
          maxTokens: 8000,
          maxFiles: 5,
          relevanceThreshold: 0.2,
          cacheEnabled: true,
          cacheTtl: 30000
        },
        ttl: {
          watchEnabled: false,
          watchDebounce: 1000,
          maxFileSize: 1024 * 1024,
          encoding: 'utf-8'
        },
        integration: {
          layer3Config: {},
          neo4jEnabled: false,
          rdfStoreEnabled: false,
          hybridStorageEnabled: false
        },
        ide: {
          vscode: { enabled: false, extensionId: '', contextWindow: 1000 },
          intellij: { enabled: false, pluginId: '', contextWindow: 1000 }
        }
      };

      const enhancedConfig: EnhancedMCPServerConfig = {
        mcpServer: mcpConfig,
        ttlContextLoader: ttlConfig,
        integration: {
          autoRefreshInterval: 60000,
          performanceOptimization: true,
          healthCheckInterval: 30000
        }
      };

      enhancedMCPServer = new EnhancedMCPServer(
        enhancedConfig,
        mockLayer3Service,
        mockHybridStorage,
        mockKnowledgeGraphPopulator,
        mockRDFGenerator,
        mockInformationExtractor
      );
    });

    it('should start and stop successfully', async () => {
      await enhancedMCPServer.start();
      
      const status = enhancedMCPServer.getStatus();
      expect(status.enhanced.isRunning).toBe(true);

      await enhancedMCPServer.stop();
    });

    it('should provide enhanced context', async () => {
      const ttlContent = `
# Module: EnhancedTest
# Language: typescript
# Business Context: Enhanced context testing

@prefix : <http://example.org/> .
:EnhancedClass a :Class ;
  :hasMethod :enhancedMethod .
`;

      await writeFile(join(testDir, 'enhanced-test.module-knowledge.ttl'), ttlContent);
      await enhancedMCPServer.start();

      const request: ContextRequest = {
        filePath: join(testDir, 'enhanced-test.ts'),
        cursorPosition: { line: 5, column: 10 },
        query: 'enhanced functionality',
        intent: 'explanation',
        maxTokens: 3000
      };

      const response = await enhancedMCPServer.getEnhancedContext(request);

      expect(response.context).toContain('EnhancedClass');
      expect(response.context).toContain('Enhanced context testing');
      expect(response.sources).toHaveLength(1);
      expect(response.metadata.totalTokens).toBeGreaterThan(0);
    });

    it('should refresh TTL context', async () => {
      await enhancedMCPServer.start();
      
      // Should not throw error even with no TTL files
      await expect(enhancedMCPServer.refreshTTLContext()).resolves.not.toThrow();
    });

    it('should perform health check', async () => {
      await enhancedMCPServer.start();
      
      const health = await enhancedMCPServer.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.details).toHaveProperty('mcpServer');
      expect(health.details).toHaveProperty('performance');
    });
  });

  describe('MCPAnalysisIntegration', () => {
    beforeEach(() => {
      const integrationConfig: MCPAnalysisIntegrationConfig = {
        mcpServer: {
          server: {
            name: 'integration-test-server',
            version: '1.0.0',
            port: 0,
            host: 'localhost',
            maxConnections: 5,
            timeout: 15000
          },
          context: {
            maxTokens: 5000,
            maxFiles: 3,
            relevanceThreshold: 0.3,
            cacheEnabled: true,
            cacheTtl: 15000
          },
          ttl: {
            watchEnabled: false,
            watchDebounce: 500,
            maxFileSize: 512 * 1024,
            encoding: 'utf-8'
          },
          integration: {
            layer3Config: {
              rag: { enabled: false },
              graphCypher: { enabled: false },
              sparql: { enabled: false },
              global: { maxTokens: 1000 }
            } as any,
            neo4jEnabled: false,
            rdfStoreEnabled: false,
            hybridStorageEnabled: false
          },
          ide: {
            vscode: { enabled: false, extensionId: '', contextWindow: 500 },
            intellij: { enabled: false, pluginId: '', contextWindow: 500 }
          }
        },
        ttlContextLoader: {
          watchEnabled: false,
          loadPatterns: [`${testDir}/**/*.module-knowledge.ttl`],
          cacheEnabled: true,
          maxCacheSize: 25,
          cacheTtl: 15000,
          maxTokens: 5000,
          maxFiles: 3,
          relevanceThreshold: 0.3
        },
        autoRefreshInterval: 30000,
        performanceOptimization: true,
        healthCheckInterval: 15000
      };

      mcpAnalysisIntegration = new MCPAnalysisIntegration(
        integrationConfig,
        mockLayer3Service,
        mockHybridStorage,
        mockAutomaticAnalysisService,
        mockKnowledgeGraphPopulator,
        mockRDFGenerator,
        mockInformationExtractor
      );
    });

    it('should start and stop integration successfully', async () => {
      await mcpAnalysisIntegration.start();
      
      const status = mcpAnalysisIntegration.getStatus();
      expect(status.isRunning).toBe(true);
      expect(mockAutomaticAnalysisService.start).toHaveBeenCalled();

      await mcpAnalysisIntegration.stop();
      expect(mockAutomaticAnalysisService.stop).toHaveBeenCalled();
    });

    it('should trigger manual sync', async () => {
      await mcpAnalysisIntegration.start();
      
      await expect(mcpAnalysisIntegration.triggerSync()).resolves.not.toThrow();
      
      const metrics = mcpAnalysisIntegration.getMetrics();
      expect(metrics.integration.totalSyncs).toBe(1);
      expect(metrics.integration.successfulSyncs).toBe(1);
    });

    it('should perform comprehensive health check', async () => {
      await mcpAnalysisIntegration.start();
      
      const health = await mcpAnalysisIntegration.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.details).toHaveProperty('integration');
      expect(health.details).toHaveProperty('mcpServer');
      expect(health.details).toHaveProperty('automaticAnalysis');
      expect(health.details.integration.isRunning).toBe(true);
    });

    it('should track integration metrics', async () => {
      await mcpAnalysisIntegration.start();
      
      const initialMetrics = mcpAnalysisIntegration.getMetrics();
      expect(initialMetrics.integration.totalSyncs).toBe(0);
      
      await mcpAnalysisIntegration.triggerSync();
      
      const updatedMetrics = mcpAnalysisIntegration.getMetrics();
      expect(updatedMetrics.integration.totalSyncs).toBe(1);
      expect(updatedMetrics.integration.averageSyncTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('End-to-End Integration', () => {
    it('should handle complete TTL context loading workflow', async () => {
      // Create comprehensive TTL file
      const comprehensiveTTL = `
# Module: ComprehensiveExample
# Language: typescript
# Dependencies: express, mongoose, jsonwebtoken
# Business Context: Complete user management system with authentication
# Architectural Patterns: MVC, Repository, Service Layer

@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

:UserController a :Class ;
  :hasMethod :createUser, :loginUser, :updateUser, :deleteUser ;
  :pattern "controller" ;
  :businessDomain "user-management" .

:createUser a :Method ;
  :signature "createUser(userData: CreateUserDto): Promise<User>" ;
  :returnType "Promise<User>" ;
  :complexity 3 .

:UserService a :Class ;
  :hasMethod :hashPassword, :validateUser, :generateToken ;
  :pattern "service" ;
  :businessDomain "authentication" .

:UserRepository a :Class ;
  :hasMethod :save, :findById, :findByEmail, :update, :delete ;
  :pattern "repository" ;
  :businessDomain "data-access" .
`;

      await writeFile(join(testDir, 'comprehensive.module-knowledge.ttl'), comprehensiveTTL);

      // Initialize TTL context loader
      const config: TTLContextLoaderConfig = {
        watchEnabled: false,
        loadPatterns: [`${testDir}/**/*.module-knowledge.ttl`],
        cacheEnabled: true,
        maxCacheSize: 10,
        cacheTtl: 30000,
        maxTokens: 10000,
        maxFiles: 5,
        relevanceThreshold: 0.1
      };

      const loader = new TTLContextLoader(
        config,
        mockKnowledgeGraphPopulator,
        mockRDFGenerator,
        mockInformationExtractor
      );

      await loader.start();

      // Test different types of context requests
      const requests: ContextRequest[] = [
        {
          filePath: join(testDir, 'user-controller.ts'),
          cursorPosition: { line: 15, column: 8 },
          query: 'user creation',
          intent: 'explanation',
          maxTokens: 5000
        },
        {
          filePath: join(testDir, 'auth-service.ts'),
          cursorPosition: { line: 25, column: 12 },
          query: 'authentication validation',
          intent: 'debugging',
          maxTokens: 3000
        },
        {
          filePath: join(testDir, 'user-repository.ts'),
          cursorPosition: { line: 10, column: 5 },
          intent: 'refactoring',
          maxTokens: 4000
        }
      ];

      for (const request of requests) {
        const response = await loader.loadContext(request);
        
        expect(response.context).toContain('ComprehensiveExample');
        expect(response.sources).toHaveLength(1);
        expect(response.sources[0].relevanceScore).toBeGreaterThan(0);
        expect(response.metadata.totalTokens).toBeGreaterThan(0);
        expect(response.suggestions?.followUpQueries).toBeDefined();
        expect(response.suggestions?.improvements).toBeDefined();
      }

      // Verify metrics
      const metrics = loader.getMetrics();
      expect(metrics.ttlFiles.loaded).toBe(1);
      expect(metrics.context.requests).toBe(3);
      expect(metrics.context.averageRelevanceScore).toBeGreaterThan(0);

      await loader.stop();
    });
  });
});