/**
 * MCP Server Tests
 * 
 * Comprehensive tests for the Model Context Protocol server
 * that provides IDE integration capabilities.
 */

import { MCPServer, createDefaultMCPConfig, validateMCPConfig } from '../src/services/mcp-server';
import { Layer3AIService } from '../src/services/layer3';
import { HybridStorageManager } from '../src/services/layer2/hybrid-storage/HybridStorageManager';
import { MCPServerConfig, ContextRequest, MCPToolCall } from '../src/services/mcp-server/types';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock dependencies
jest.mock('../src/services/layer3');
jest.mock('../src/services/layer2/hybrid-storage/HybridStorageManager');
jest.mock('chokidar');

describe('MCP Server', () => {
  let mcpServer: MCPServer;
  let mockLayer3Service: jest.Mocked<Layer3AIService>;
  let mockHybridStorage: jest.Mocked<HybridStorageManager>;
  let config: MCPServerConfig;
  let testDir: string;

  beforeEach(async () => {
    // Create test directory
    testDir = join(tmpdir(), `mcp-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Mock Layer3AIService
    mockLayer3Service = {
      query: jest.fn(),
      initialize: jest.fn(),
      shutdown: jest.fn(),
      getStatus: jest.fn(),
      getMetrics: jest.fn()
    } as any;

    // Mock HybridStorageManager
    mockHybridStorage = {
      initialize: jest.fn(),
      shutdown: jest.fn(),
      query: jest.fn(),
      store: jest.fn(),
      getStatus: jest.fn()
    } as any;

    // Create test configuration
    config = createDefaultMCPConfig();
    config.server.port = 0; // Use random port for testing
    config.ttl.watchEnabled = false; // Disable file watching in tests

    // Create MCP server instance
    mcpServer = new MCPServer(config, mockLayer3Service, mockHybridStorage);
  });

  afterEach(async () => {
    // Clean up
    if (mcpServer) {
      await mcpServer.stop();
    }
    
    // Remove test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Configuration', () => {
    it('should create default configuration', () => {
      const defaultConfig = createDefaultMCPConfig();
      
      expect(defaultConfig.server.name).toBe('AASWE-MCP-Server');
      expect(defaultConfig.server.version).toBe('1.0.0');
      expect(defaultConfig.server.port).toBe(3001);
      expect(defaultConfig.context.maxTokens).toBe(8000);
      expect(defaultConfig.context.maxFiles).toBe(10);
      expect(defaultConfig.ttl.watchEnabled).toBe(true);
    });

    it('should validate configuration correctly', () => {
      const validConfig = createDefaultMCPConfig();
      const validation = validateMCPConfig(validConfig);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid configuration', () => {
      const invalidConfig = createDefaultMCPConfig();
      invalidConfig.server.name = '';
      invalidConfig.server.port = 99999;
      invalidConfig.context.maxTokens = 100;
      
      const validation = validateMCPConfig(invalidConfig);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Server name is required');
      expect(validation.errors).toContain('Valid server port (1-65535) is required');
      expect(validation.errors).toContain('Context maxTokens should be at least 1000');
    });
  });

  describe('Server Lifecycle', () => {
    it('should initialize correctly', () => {
      expect(mcpServer).toBeDefined();
      expect(mcpServer.getStatus().status).toBe('stopped');
    });

    it('should start and stop server', async () => {
      await mcpServer.start();
      expect(mcpServer.getStatus().status).toBe('running');
      
      await mcpServer.stop();
      expect(mcpServer.getStatus().status).toBe('stopped');
    });

    it('should handle start errors gracefully', async () => {
      // Use invalid port to force error
      const invalidConfig = createDefaultMCPConfig();
      invalidConfig.server.port = -1;
      
      const invalidServer = new MCPServer(invalidConfig, mockLayer3Service, mockHybridStorage);
      
      await expect(invalidServer.start()).rejects.toThrow();
      expect(invalidServer.getStatus().status).toBe('error');
    });
  });

  describe('MCP Tools', () => {
    beforeEach(async () => {
      await mcpServer.start();
    });

    it('should list available tools', async () => {
      const tools = await (mcpServer as any).handleToolsList();
      
      expect(tools.tools).toHaveLength(3);
      expect(tools.tools.map(t => t.name)).toContain('get_context');
      expect(tools.tools.map(t => t.name)).toContain('query_knowledge');
      expect(tools.tools.map(t => t.name)).toContain('analyze_code');
    });

    it('should handle get_context tool call', async () => {
      const toolCall: MCPToolCall = {
        name: 'get_context',
        arguments: {
          filePath: '/test/file.ts',
          cursorPosition: { line: 10, column: 5 },
          query: 'test query',
          intent: 'explanation'
        }
      };

      const result = await (mcpServer as any).handleToolCall(toolCall);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.isError).toBeUndefined();
    });

    it('should handle query_knowledge tool call', async () => {
      mockLayer3Service.query.mockResolvedValue({
        query: 'test query',
        type: 'rag',
        response: 'test answer',
        confidence: 0.9,
        sources: [],
        executionTime: 100,
        metadata: {
          processingTime: 100
        }
      });

      const toolCall: MCPToolCall = {
        name: 'query_knowledge',
        arguments: {
          query: 'test query',
          type: 'rag'
        }
      };

      const result = await (mcpServer as any).handleToolCall(toolCall);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(mockLayer3Service.query).toHaveBeenCalledWith({
        query: 'test query',
        type: 'rag'
      });
    });

    it('should handle analyze_code tool call', async () => {
      const toolCall: MCPToolCall = {
        name: 'analyze_code',
        arguments: {
          filePath: '/test/file.ts',
          includeMetrics: true,
          includeDependencies: true
        }
      };

      const result = await (mcpServer as any).handleToolCall(toolCall);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const analysis = JSON.parse(result.content[0].text!);
      expect(analysis.filePath).toBe('/test/file.ts');
      expect(analysis.metrics).toBeDefined();
      expect(analysis.dependencies).toBeDefined();
    });

    it('should handle unknown tool calls', async () => {
      const toolCall: MCPToolCall = {
        name: 'unknown_tool',
        arguments: {}
      };

      await expect((mcpServer as any).handleToolCall(toolCall)).rejects.toThrow('Tool not found: unknown_tool');
    });
  });

  describe('Context Generation', () => {
    beforeEach(async () => {
      await mcpServer.start();
      
      // Create test TTL file
      const ttlContent = `
@prefix aaswe: <http://aaswe.org/ontology#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

# Module: TestModule
# Language: typescript
# Dependencies: TestDep

aaswe:TestModule a aaswe:Module ;
    rdfs:label "Test Module" ;
    rdfs:comment "A test module for MCP server testing" .
`;
      
      const ttlPath = join(testDir, 'test.module-knowledge.ttl');
      await writeFile(ttlPath, ttlContent);
      
      // Load the TTL file into the server
      await (mcpServer as any).loadTTLFile(ttlPath);
    });

    it('should generate context for a request', async () => {
      const request: ContextRequest = {
        filePath: join(testDir, 'test.ts'),
        cursorPosition: { line: 10, column: 5 },
        query: 'test query',
        intent: 'explanation',
        maxTokens: 4000,
        includeRelated: true
      };

      const context = await (mcpServer as any).generateContext(request);
      
      expect(context.context).toBeDefined();
      expect(context.sources).toBeDefined();
      expect(context.metadata.totalTokens).toBeGreaterThan(0);
      expect(context.metadata.processingTime).toBeGreaterThan(0);
      expect(context.suggestions).toBeDefined();
    });

    it('should cache context responses', async () => {
      const request: ContextRequest = {
        filePath: join(testDir, 'test.ts'),
        cursorPosition: { line: 10, column: 5 },
        maxTokens: 4000
      };

      // First request
      const context1 = await (mcpServer as any).generateContext(request);
      expect(context1.metadata.cached).toBe(false);

      // Second request (should be cached)
      const context2 = await (mcpServer as any).generateContext(request);
      expect(context2.metadata.cached).toBe(true);
    });

    it('should select relevant context based on file proximity', async () => {
      // Create additional TTL files
      const nearTtlContent = `
@prefix aaswe: <http://aaswe.org/ontology#> .
# Module: NearModule
# Language: typescript
aaswe:NearModule rdfs:label "Near Module" .
`;
      
      const farTtlContent = `
@prefix aaswe: <http://aaswe.org/ontology#> .
# Module: FarModule  
# Language: java
aaswe:FarModule rdfs:label "Far Module" .
`;

      const nearPath = join(testDir, 'near.module-knowledge.ttl');
      const farPath = join(testDir, 'subdir', 'far.module-knowledge.ttl');
      
      await mkdir(join(testDir, 'subdir'), { recursive: true });
      await writeFile(nearPath, nearTtlContent);
      await writeFile(farPath, farTtlContent);
      
      await (mcpServer as any).loadTTLFile(nearPath);
      await (mcpServer as any).loadTTLFile(farPath);

      const request: ContextRequest = {
        filePath: join(testDir, 'test.ts'),
        cursorPosition: { line: 10, column: 5 },
        maxTokens: 4000
      };

      const selection = await (mcpServer as any).selectRelevantContext(request);
      
      expect(selection.selectedFiles).toBeDefined();
      expect(selection.relevanceScores).toBeDefined();
      expect(selection.reasoning).toContain('proximity');
    });
  });

  describe('TTL File Management', () => {
    it('should parse TTL content', () => {
      const content = `
@prefix aaswe: <http://aaswe.org/ontology#> .
# Test content
aaswe:Test rdfs:label "Test" .
`;

      const parsed = (mcpServer as any).parseTTLContent(content);
      
      expect(parsed.triples).toBeDefined();
      expect(parsed.prefixes).toBeDefined();
      expect(parsed.classes).toBeDefined();
      expect(parsed.properties).toBeDefined();
      expect(parsed.individuals).toBeDefined();
    });

    it('should extract metadata from TTL content', () => {
      const content = `
# Module: TestModule
# Language: typescript
# Dependencies: dep1, dep2
# Business context comment
@prefix aaswe: <http://aaswe.org/ontology#> .
`;

      const metadata = (mcpServer as any).extractTTLMetadata(content, '/test/path/test.module-knowledge.ttl');
      
      expect(metadata.module).toBe('path');
      expect(metadata.language).toBe('typescript');
      expect(metadata.dependencies).toContain('dep1');
      expect(metadata.businessContext).toContain('Module: TestModule');
    });

    it('should extract module name from path', () => {
      const moduleName1 = (mcpServer as any).extractModuleName('/src/services/auth/auth.module-knowledge.ttl');
      const moduleName2 = (mcpServer as any).extractModuleName('simple.module-knowledge.ttl');
      
      expect(moduleName1).toBe('auth');
      expect(moduleName2).toBe('unknown');
    });

    it('should detect language from path and content', () => {
      const lang1 = (mcpServer as any).extractLanguage('/src/java/Service.java', 'java code');
      const lang2 = (mcpServer as any).extractLanguage('/src/python/service.py', 'python code');
      const lang3 = (mcpServer as any).extractLanguage('/src/js/service.js', 'javascript code');
      const lang4 = (mcpServer as any).extractLanguage('/src/ts/service.ts', 'typescript code');
      const lang5 = (mcpServer as any).extractLanguage('/src/unknown/file.txt', 'unknown content');
      
      expect(lang1).toBe('java');
      expect(lang2).toBe('python');
      expect(lang3).toBe('javascript');
      expect(lang4).toBe('typescript');
      expect(lang5).toBe('unknown');
    });

    it('should extract dependencies from content', () => {
      const content = `
# imports: "dependency1"
# depends: 'dependency2'
Some other content
`;

      const deps = (mcpServer as any).extractDependencies(content);
      
      expect(deps).toContain('dependency1');
      expect(deps).toContain('dependency2');
    });
  });

  describe('Resources', () => {
    beforeEach(async () => {
      await mcpServer.start();
      
      // Create test TTL file
      const ttlContent = `@prefix aaswe: <http://aaswe.org/ontology#> .`;
      const ttlPath = join(testDir, 'resource.module-knowledge.ttl');
      await writeFile(ttlPath, ttlContent);
      await (mcpServer as any).loadTTLFile(ttlPath);
    });

    it('should list TTL files as resources', async () => {
      const resources = await (mcpServer as any).handleResourcesList();
      
      expect(resources.resources).toBeDefined();
      expect(resources.resources.length).toBeGreaterThan(0);
      
      const ttlResource = resources.resources.find(r => r.uri.includes('resource.module-knowledge.ttl'));
      expect(ttlResource).toBeDefined();
      expect(ttlResource!.mimeType).toBe('text/turtle');
    });

    it('should read TTL file resources', async () => {
      const ttlPath = join(testDir, 'resource.module-knowledge.ttl');
      const uri = `ttl://${ttlPath}`;
      
      const content = await (mcpServer as any).handleResourceRead({ uri });
      
      expect(content.uri).toBe(uri);
      expect(content.mimeType).toBe('text/turtle');
      expect(content.text).toContain('@prefix aaswe:');
    });

    it('should handle invalid resource URIs', async () => {
      await expect((mcpServer as any).handleResourceRead({ uri: 'invalid://uri' }))
        .rejects.toThrow('Unsupported resource URI');
    });

    it('should handle missing TTL files', async () => {
      const uri = 'ttl:///nonexistent/file.ttl';
      
      await expect((mcpServer as any).handleResourceRead({ uri }))
        .rejects.toThrow('TTL file not found');
    });
  });

  describe('Metrics and Status', () => {
    beforeEach(async () => {
      await mcpServer.start();
    });

    it('should provide server status', () => {
      const status = mcpServer.getStatus();
      
      expect(status.status).toBe('running');
      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.connections).toBe(0);
      expect(status.metrics).toBeDefined();
      expect(status.metrics.totalRequests).toBe(0);
    });

    it('should provide detailed metrics', () => {
      const metrics = mcpServer.getMetrics();
      
      expect(metrics.server).toBeDefined();
      expect(metrics.context).toBeDefined();
      expect(metrics.performance).toBeDefined();
      
      expect(metrics.server.uptime).toBeGreaterThanOrEqual(0);
      expect(metrics.server.connections).toBe(0);
      expect(metrics.context.totalContextRequests).toBe(0);
    });

    it('should update metrics after operations', async () => {
      const initialMetrics = mcpServer.getMetrics();
      const initialCount = initialMetrics.context.totalContextRequests;
      
      // Perform context generations
      const request: ContextRequest = {
        filePath: '/test/file.ts',
        cursorPosition: { line: 1, column: 1 },
        maxTokens: 1000
      };
      
      // Make two calls to ensure metrics increment properly
      await (mcpServer as any).generateContext(request);
      await (mcpServer as any).generateContext({ ...request, filePath: '/test/file2.ts' });
      
      const updatedMetrics = mcpServer.getMetrics();
      expect(updatedMetrics.context.totalContextRequests)
        .toBe(initialCount + 2);
    });
  });

  describe('Error Handling', () => {
    it('should handle context generation errors', async () => {
      const request: ContextRequest = {
        filePath: '/nonexistent/file.ts',
        cursorPosition: { line: 1, column: 1 },
        maxTokens: 1000
      };

      // This should not throw but handle gracefully
      const context = await (mcpServer as any).generateContext(request);
      expect(context).toBeDefined();
    });

    it('should handle Layer3 service errors', async () => {
      mockLayer3Service.query.mockRejectedValue(new Error('Layer3 service error'));

      const toolCall: MCPToolCall = {
        name: 'query_knowledge',
        arguments: { query: 'test query' }
      };

      const result = await (mcpServer as any).handleToolCall(toolCall);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error querying knowledge');
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await mcpServer.start();
    });

    it('should generate consistent cache keys', () => {
      const request1: ContextRequest = {
        filePath: '/test/file.ts',
        cursorPosition: { line: 1, column: 1 },
        maxTokens: 1000
      };

      const request2: ContextRequest = {
        filePath: '/test/file.ts',
        cursorPosition: { line: 1, column: 1 },
        maxTokens: 1000
      };

      const key1 = (mcpServer as any).generateCacheKey(request1);
      const key2 = (mcpServer as any).generateCacheKey(request2);
      
      expect(key1).toBe(key2);
    });

    it('should estimate tokens correctly', () => {
      const text = 'This is a test string with multiple words';
      const tokens = (mcpServer as any).estimateTokens(text);
      
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBe(Math.ceil(text.length / 4));
    });

    it('should clear related cache when files change', async () => {
      const filePath = '/test/file.ttl';
      
      // Add some cache entries
      const request: ContextRequest = {
        filePath: '/test/related.ts',
        cursorPosition: { line: 1, column: 1 },
        maxTokens: 1000
      };
      
      await (mcpServer as any).generateContext(request);
      
      // Clear cache for the file
      (mcpServer as any).clearRelatedCache(filePath);
      
      // Cache should be cleared (this is hard to test directly, but method should not throw)
      expect(() => (mcpServer as any).clearRelatedCache(filePath)).not.toThrow();
    });
  });

  describe('Utility Functions', () => {
    it('should format TTL for LLM consumption', () => {
      const ttlFile = {
        metadata: {
          module: 'TestModule',
          language: 'typescript',
          dependencies: ['dep1', 'dep2'],
          businessContext: ['Context line 1', 'Context line 2']
        },
        content: '@prefix test: <http://test.org#> .',
        lastModified: new Date('2023-01-01')
      };

      const formatted = (mcpServer as any).formatTTLForLLM(ttlFile);
      
      expect(formatted).toContain('# Module: TestModule');
      expect(formatted).toContain('# Language: typescript');
      expect(formatted).toContain('# Dependencies: dep1, dep2');
      expect(formatted).toContain('# Knowledge Content:');
      expect(formatted).toContain('# Business Context:');
      expect(formatted).toContain('@prefix test:');
    });

    it('should build context string from sources', () => {
      const sources = [{
        type: 'ttl' as const,
        path: '/test/file.ttl',
        content: 'TTL content',
        relevanceScore: 0.8,
        metadata: {
          lastModified: new Date(),
          size: 100,
          module: 'TestModule'
        }
      }];

      const request: ContextRequest = {
        filePath: '/test/current.ts',
        cursorPosition: { line: 10, column: 5 },
        query: 'test query',
        intent: 'explanation'
      };

      const context = (mcpServer as any).buildContextString(sources, request);
      
      expect(context).toContain('# Codebase Context');
      expect(context).toContain('# Current File: /test/current.ts');
      expect(context).toContain('# Cursor Position: Line 10, Column 5');
      expect(context).toContain('# Query: test query');
      expect(context).toContain('# Intent: explanation');
      expect(context).toContain('## TestModule (TTL)');
      expect(context).toContain('Relevance: 80.0%');
    });

    it('should generate follow-up queries based on intent', () => {
      const request: ContextRequest = {
        filePath: '/test/file.ts',
        cursorPosition: { line: 1, column: 1 },
        intent: 'debugging'
      };

      const sources = [];
      const queries = (mcpServer as any).generateFollowUpQueries(request, sources);
      
      expect(queries).toContain('What are common issues in this type of code?');
      expect(queries.length).toBeLessThanOrEqual(3);
    });

    it('should generate improvement suggestions', () => {
      const sources = [{
        type: 'ttl' as const,
        path: '/test/file.ttl',
        content: 'content',
        relevanceScore: 0.5,
        metadata: {
          lastModified: new Date(),
          size: 15000, // Large file
          module: 'TestModule'
        }
      }];

      const improvements = (mcpServer as any).generateImprovements(sources);
      
      expect(improvements).toContain('Large TTL files detected - consider splitting for better performance');
      expect(improvements).toContain('Enhance TTL files with more architectural insights');
    });
  });
});

describe('MCP Server Integration', () => {
  it('should integrate with Layer3 and HybridStorage services', () => {
    const config = createDefaultMCPConfig();
    const mockLayer3 = {} as Layer3AIService;
    const mockStorage = {} as HybridStorageManager;
    
    const server = new MCPServer(config, mockLayer3, mockStorage);
    
    expect(server).toBeDefined();
    expect(server.getStatus().status).toBe('stopped');
  });

  it('should handle service initialization errors', async () => {
    const config = createDefaultMCPConfig();
    config.server.port = -1; // Invalid port
    
    const mockLayer3 = {} as Layer3AIService;
    const mockStorage = {} as HybridStorageManager;
    
    const server = new MCPServer(config, mockLayer3, mockStorage);
    
    await expect(server.start()).rejects.toThrow();
  });
});