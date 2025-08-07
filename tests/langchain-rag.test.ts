import { RAGEngine, RAGError, ContextManager } from '../src/services/layer3/langchain-rag';
import { Document } from '@langchain/core/documents';
import type { 
  RAGConfig, 
  QueryContext, 
  CodeContext, 
  DocumentMetadata,
  ContextManagerConfig 
} from '../src/services/layer3/langchain-rag';

// Mock LangChain components
jest.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedDocuments: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3])
  })),
  ChatOpenAI: jest.fn().mockImplementation(() => {
    const mockLLM = {
      invoke: jest.fn().mockResolvedValue({
        content: 'This is a mock response from the LLM explaining the code.'
      }),
      pipe: jest.fn().mockReturnThis(),
      stream: jest.fn(),
      batch: jest.fn()
    };
    
    // Mock RunnableSequence chain behavior
    mockLLM.pipe = jest.fn().mockReturnValue({
      invoke: jest.fn().mockResolvedValue('This is a mock response from the LLM explaining the code.')
    });
    
    return mockLLM;
  })
}));

jest.mock('langchain/vectorstores/memory', () => ({
  MemoryVectorStore: jest.fn().mockImplementation((_embeddings) => ({
    addDocuments: jest.fn().mockResolvedValue(undefined),
    asRetriever: jest.fn().mockReturnValue({
      getRelevantDocuments: jest.fn().mockResolvedValue([
        new Document({
          pageContent: 'function calculateSum(a, b) { return a + b; }',
          metadata: { source: 'test.js', type: 'code', language: 'javascript' }
        }),
        new Document({
          pageContent: 'This function adds two numbers together.',
          metadata: { source: 'test.js', type: 'documentation' }
        })
      ])
    })
  }))
}));

// Mock RunnableSequence to prevent hanging
jest.mock('@langchain/core/runnables', () => ({
  RunnableSequence: {
    from: jest.fn().mockImplementation((_steps) => ({
      invoke: jest.fn().mockResolvedValue('This is a mock response from the LLM explaining the code.')
    }))
  }
}));

// Mock StringOutputParser
jest.mock('@langchain/core/output_parsers', () => ({
  StringOutputParser: jest.fn().mockImplementation(() => ({
    parse: jest.fn().mockReturnValue('This is a mock response from the LLM explaining the code.')
  }))
}));

describe('RAGEngine', () => {
  let ragEngine: RAGEngine;
  let mockConfig: RAGConfig;

  beforeEach(async () => {
    mockConfig = {
      vectorStore: {
        type: 'memory',
        dimensions: 1536,
        similarity: 'cosine'
      },
      retrieval: {
        topK: 5,
        scoreThreshold: 0.7,
        maxTokens: 4000,
        contextWindow: 8000
      },
      llm: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        temperature: 0.1,
        maxTokens: 2000
      },
      embeddings: {
        provider: 'openai',
        model: 'text-embedding-ada-002',
        dimensions: 1536
      },
      cache: {
        enabled: true,
        ttl: 300000, // 5 minutes
        maxSize: 100
      }
    };

    ragEngine = new RAGEngine(mockConfig);
    // Wait for initialization to complete with proper async handling
    await ragEngine.waitForInitialization();
  });

  afterEach(async () => {
    await ragEngine.shutdown();
  });

  describe('Document Management', () => {
    test('should add documents successfully', async () => {
      const documents = [
        new Document({
          pageContent: 'function add(a, b) { return a + b; }',
          metadata: { source: 'math.js', type: 'code', language: 'javascript' }
        }),
        new Document({
          pageContent: 'This function performs addition of two numbers.',
          metadata: { source: 'math.js', type: 'documentation' }
        })
      ];

      const metadata: DocumentMetadata[] = [
        {
          source: 'math.js',
          type: 'code',
          language: 'javascript',
          filePath: '/src/math.js',
          lastModified: new Date(),
          size: 1024,
          hash: 'abc123',
          tags: ['function', 'math'],
          relationships: []
        },
        {
          source: 'math.js',
          type: 'documentation',
          filePath: '/docs/math.md',
          lastModified: new Date(),
          size: 512,
          hash: 'def456',
          tags: ['documentation'],
          relationships: []
        }
      ];

      await expect(ragEngine.addDocuments(documents, metadata)).resolves.not.toThrow();
    });

    test('should handle document addition errors gracefully', async () => {
      // Mock vector store to throw error
      const mockVectorStore = {
        addDocuments: jest.fn().mockRejectedValue(new Error('Vector store error'))
      };
      
      // Replace the vector store with our mock
      (ragEngine as any).vectorStore = mockVectorStore;

      const documents = [
        new Document({
          pageContent: 'test content',
          metadata: { source: 'test.js' }
        })
      ];

      await expect(ragEngine.addDocuments(documents)).rejects.toThrow(RAGError);
    });
  });

  describe('Query Processing', () => {
    beforeEach(async () => {
      // Add some test documents
      const documents = [
        new Document({
          pageContent: 'function calculateSum(numbers) { return numbers.reduce((a, b) => a + b, 0); }',
          metadata: { source: 'calculator.js', type: 'code', language: 'javascript' }
        }),
        new Document({
          pageContent: 'The calculateSum function takes an array of numbers and returns their sum.',
          metadata: { source: 'calculator.js', type: 'documentation' }
        })
      ];

      await ragEngine.addDocuments(documents);
      // Wait for documents to be processed
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    test('should process code explanation query successfully', async () => {
      const queryContext: QueryContext = {
        query: 'How does the calculateSum function work?',
        intent: 'code_explanation',
        scope: 'file',
        language: 'javascript',
        filePath: '/src/calculator.js'
      };

      const response = await ragEngine.query(queryContext);

      expect(response).toBeDefined();
      expect(response.answer).toBeTruthy();
      expect(response.sources.length).toBeGreaterThanOrEqual(1); // Allow for 1 or more sources
      expect(response.context.retrievedDocuments).toBeGreaterThan(0);
      expect(response.reasoning.steps).toHaveLength(4);
      expect(response.suggestions?.followUpQuestions).toBeDefined();
    });

    test('should process bug fix query successfully', async () => {
      const queryContext: QueryContext = {
        query: 'There is a bug in the calculateSum function when passed an empty array',
        intent: 'bug_fix',
        scope: 'file',
        language: 'javascript',
        codeSelection: {
          startLine: 1,
          endLine: 1,
          content: 'function calculateSum(numbers) { return numbers.reduce((a, b) => a + b, 0); }'
        }
      };

      const response = await ragEngine.query(queryContext);

      expect(response).toBeDefined();
      expect(response.answer).toBeTruthy();
      expect(response.suggestions?.actionItems).toContain('Fix the identified issue');
    });

    test('should handle query errors gracefully', async () => {
      // Mock retriever to throw error
      const mockRetriever = {
        getRelevantDocuments: jest.fn().mockRejectedValue(new Error('Retrieval error'))
      };
      
      (ragEngine as any).retriever = mockRetriever;

      const queryContext: QueryContext = {
        query: 'test query',
        intent: 'code_explanation',
        scope: 'file'
      };

      await expect(ragEngine.query(queryContext)).rejects.toThrow(RAGError);
    });

    test('should use cache for repeated queries', async () => {
      const queryContext: QueryContext = {
        query: 'Explain the calculateSum function',
        intent: 'code_explanation',
        scope: 'file',
        language: 'javascript'
      };

      // First query
      const response1 = await ragEngine.query(queryContext);
      expect(response1.context.cacheHit).toBe(false);

      // Second identical query should hit cache
      const response2 = await ragEngine.query(queryContext);
      expect(response2.context.cacheHit).toBe(true);
    });
  });

  describe('Metrics and Monitoring', () => {
    test('should track query metrics', async () => {
      const queryContext: QueryContext = {
        query: 'Test query for metrics',
        intent: 'code_explanation',
        scope: 'file'
      };

      await ragEngine.query(queryContext);

      const metrics = await ragEngine.getMetrics();
      
      expect(metrics.queries.total).toBe(1);
      expect(metrics.queries.successful).toBe(1);
      expect(metrics.queries.failed).toBe(0);
      expect(metrics.queries.averageResponseTime).toBeGreaterThanOrEqual(0); // Allow for 0 or greater
    });

    test('should track failed queries in metrics', async () => {
      // Mock retriever to fail
      (ragEngine as any).retriever = null;

      const queryContext: QueryContext = {
        query: 'This will fail',
        intent: 'code_explanation',
        scope: 'file'
      };

      try {
        await ragEngine.query(queryContext);
      } catch (error) {
        // Expected to fail
      }

      const metrics = await ragEngine.getMetrics();
      expect(metrics.queries.failed).toBe(1);
    });
  });

  describe('Cache Management', () => {
    test('should clear cache successfully', async () => {
      const queryContext: QueryContext = {
        query: 'Test query for cache',
        intent: 'code_explanation',
        scope: 'file'
      };

      // Make a query to populate cache
      await ragEngine.query(queryContext);

      // Clear cache
      await ragEngine.clearCache();

      // Query again - should not hit cache
      const response = await ragEngine.query(queryContext);
      expect(response.context.cacheHit).toBe(false);
    });
  });
});

describe('ContextManager', () => {
  let contextManager: ContextManager;
  let mockConfig: ContextManagerConfig;

  beforeEach(() => {
    mockConfig = {
      maxContextWindows: 10,
      maxTokensPerWindow: 4000,
      defaultChunkSize: 1000,
      chunkOverlap: 200,
      priorityDecayRate: 0.01,
      cleanupInterval: 60000 // 1 minute
    };

    contextManager = new ContextManager(mockConfig);
  });

  afterEach(async () => {
    await contextManager.shutdown();
  });

  describe('Code Context Management', () => {
    test('should add code context successfully', async () => {
      const codeContext: CodeContext = {
        filePath: '/src/example.js',
        language: 'javascript',
        content: 'function hello() { console.log("Hello, World!"); }',
        functions: [
          {
            name: 'hello',
            signature: 'function hello()',
            docstring: 'Prints hello world to console',
            startLine: 1,
            endLine: 1
          }
        ],
        classes: [],
        imports: [],
        dependencies: [],
        metadata: {
          lastModified: new Date(),
          size: 1024,
          complexity: 1,
          testCoverage: 85
        }
      };

      const contextId = await contextManager.addCodeContext(codeContext, 1);
      
      expect(contextId).toBeTruthy();
      expect(typeof contextId).toBe('string');
    });

    test('should retrieve relevant context for queries', async () => {
      const codeContext: CodeContext = {
        filePath: '/src/math.js',
        language: 'javascript',
        content: 'function add(a, b) { return a + b; } function multiply(a, b) { return a * b; }',
        functions: [
          {
            name: 'add',
            signature: 'function add(a, b)',
            startLine: 1,
            endLine: 1
          },
          {
            name: 'multiply',
            signature: 'function multiply(a, b)',
            startLine: 1,
            endLine: 1
          }
        ],
        classes: [],
        imports: [],
        dependencies: [],
        metadata: {
          lastModified: new Date(),
          size: 2048,
          complexity: 2
        }
      };

      await contextManager.addCodeContext(codeContext, 1);

      const queryContext: QueryContext = {
        query: 'How does the add function work?',
        intent: 'code_explanation',
        scope: 'file',
        language: 'javascript',
        filePath: '/src/math.js'
      };

      const relevantDocs = await contextManager.getRelevantContext(queryContext, 2000);
      
      expect(relevantDocs).toBeDefined();
      expect(relevantDocs.length).toBeGreaterThan(0);
    });

    test('should manage context capacity', async () => {
      // Add contexts beyond the limit
      for (let i = 0; i < 15; i++) {
        const codeContext: CodeContext = {
          filePath: `/src/file${i}.js`,
          language: 'javascript',
          content: `function test${i}() { return ${i}; }`,
          functions: [],
          classes: [],
          imports: [],
          dependencies: [],
          metadata: {
            lastModified: new Date(),
            size: 100,
            complexity: 1
          }
        };

        await contextManager.addCodeContext(codeContext, 1);
      }

      const stats = contextManager.getContextStats();
      expect(stats.totalContexts).toBeLessThanOrEqual(mockConfig.maxContextWindows);
    });
  });

  describe('Context Chain Management', () => {
    test('should update context chain successfully', async () => {
      const sessionId = 'test-session';
      const queryContext: QueryContext = {
        query: 'Explain this function',
        intent: 'code_explanation',
        scope: 'file',
        filePath: '/src/test.js'
      };

      await contextManager.updateContextChain(sessionId, queryContext, 'This function does...');

      const chain = contextManager.getContextChain(sessionId);
      
      expect(chain).toBeDefined();
      expect(chain!.messages).toHaveLength(2); // User + Assistant
      expect(chain!.context.codeFiles).toContain('/src/test.js');
    });

    test('should limit context chain message history', async () => {
      const sessionId = 'test-session-long';
      
      // Add many messages
      for (let i = 0; i < 25; i++) {
        const queryContext: QueryContext = {
          query: `Query ${i}`,
          intent: 'code_explanation',
          scope: 'file'
        };

        await contextManager.updateContextChain(sessionId, queryContext, `Response ${i}`);
      }

      const chain = contextManager.getContextChain(sessionId);
      expect(chain!.messages.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Context Statistics', () => {
    test('should provide accurate context statistics', async () => {
      const codeContext: CodeContext = {
        filePath: '/src/stats.js',
        language: 'javascript',
        content: 'function test() { return "test"; }',
        functions: [],
        classes: [],
        imports: [],
        dependencies: [],
        metadata: {
          lastModified: new Date(),
          size: 500,
          complexity: 1
        }
      };

      await contextManager.addCodeContext(codeContext, 1);

      const stats = contextManager.getContextStats();
      
      expect(stats.totalContexts).toBe(1);
      expect(stats.totalDocuments).toBeGreaterThan(0);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.averageTokensPerContext).toBeGreaterThan(0);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Context Cleanup', () => {
    test('should remove expired contexts', async () => {
      const codeContext: CodeContext = {
        filePath: '/src/expired.js',
        language: 'javascript',
        content: 'function expired() { return "old"; }',
        functions: [],
        classes: [],
        imports: [],
        dependencies: [],
        metadata: {
          lastModified: new Date(),
          size: 200,
          complexity: 1
        }
      };

      const contextId = await contextManager.addCodeContext(codeContext, 1);
      
      // Manually set last accessed time to be old
      const contextWindow = (contextManager as any).contextWindows.get(contextId);
      if (contextWindow) {
        contextWindow.lastAccessed = new Date(Date.now() - 35 * 60 * 1000); // 35 minutes ago
      }

      const clearedCount = await contextManager.clearExpiredContexts();
      expect(clearedCount).toBe(1);
    });

    test('should remove specific context', async () => {
      const codeContext: CodeContext = {
        filePath: '/src/remove.js',
        language: 'javascript',
        content: 'function remove() { return "remove"; }',
        functions: [],
        classes: [],
        imports: [],
        dependencies: [],
        metadata: {
          lastModified: new Date(),
          size: 300,
          complexity: 1
        }
      };

      const contextId = await contextManager.addCodeContext(codeContext, 1);
      
      const removed = await contextManager.removeContext(contextId);
      expect(removed).toBe(true);

      const removedAgain = await contextManager.removeContext(contextId);
      expect(removedAgain).toBe(false);
    });
  });
});

describe('RAGError', () => {
  test('should create error with correct properties', () => {
    const error = new RAGError(
      'RETRIEVAL_FAILED',
      { reason: 'Network timeout' },
      new Date(),
      'test query',
      { context: 'test' }
    );

    expect(error.name).toBe('RAGError');
    expect(error.code).toBe('RETRIEVAL_FAILED');
    expect(error.details.reason).toBe('Network timeout');
    expect(error.query).toBe('test query');
    expect(error.context.context).toBe('test');
    expect(error.message).toContain('RETRIEVAL_FAILED');
  });

  test('should handle optional parameters', () => {
    const error = new RAGError(
      'LLM_ERROR',
      { reason: 'API limit exceeded' },
      new Date()
    );

    expect(error.code).toBe('LLM_ERROR');
    expect(error.query).toBeUndefined();
    expect(error.context).toBeUndefined();
  });
});