/**
 * MCP Stdio Server Implementation
 * 
 * Complete stdio transport implementation of the Model Context Protocol server
 * that provides the same rich codebase context as the WebSocket server.
 * Supports all MCP clients that use stdio transport (not just Cline/RooCode).
 */

import { EventEmitter } from 'events';
import { readFile, stat } from 'fs/promises';
import { watch, FSWatcher } from 'chokidar';
import { glob } from 'glob';
import { relative, resolve, sep } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { stdin, stdout } from 'process';
import logger from '../../utils/logger';
import { Layer3AIService } from '../layer3/index';
import { HybridStorageManager } from '../layer2/hybrid-storage/HybridStorageManager';
import { TTLContextLoader } from './TTLContextLoader';
import {
  MCPServerConfig,
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPNotification,
  ContextRequest,
  ContextResponse,
  TTLFile,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MCPResource,
  MCPResourceContent,
  MCPServerStatus,
  MCPClient,
  ContextCache,
  FileWatchEvent,
  MCPServerError,
  MCPServerMetrics
} from './types';

// Get version from package.json automatically
let packageVersion = '1.0.0';
try {
  const packageJsonPath = require.resolve('../../../package.json');
  const packageJson = require(packageJsonPath);
  packageVersion = packageJson.version || '1.0.0';
} catch (error) {
  logger.warn('Could not read package.json version, using default', { error });
}

/**
 * MCP Stdio Server for CLI Integration
 * 
 * Provides the same functionality as MCPServer but uses stdio transport
 * for compatibility with CLI tools and IDEs that prefer stdio communication.
 */
export class MCPStdioServer extends EventEmitter {
  private config: MCPServerConfig;
  private layer3Service: Layer3AIService;
  private hybridStorage: HybridStorageManager;
  private ttlContextLoader: TTLContextLoader;
  
  private client: MCPClient | null = null;
  private ttlFiles: Map<string, TTLFile> = new Map();
  private contextCache: Map<string, ContextCache> = new Map();
  private fileWatcher: FSWatcher | null = null;
  
  private status: MCPServerStatus['status'] = 'stopped';
  private startTime: number = 0;
  private metrics: MCPServerMetrics;
  
  private cacheCleanupInterval?: NodeJS.Timeout;
  private messageBuffer: string = '';
  private isRunning: boolean = false;

  constructor(
    config: MCPServerConfig,
    layer3Service: Layer3AIService,
    hybridStorage: HybridStorageManager,
    ttlContextLoader: TTLContextLoader
  ) {
    super();
    
    this.config = {
      ...config,
      server: {
        ...config.server,
        version: packageVersion // Use automatic version resolution
      }
    };
    
    this.layer3Service = layer3Service;
    this.hybridStorage = hybridStorage;
    this.ttlContextLoader = ttlContextLoader;
    this.metrics = this.initializeMetrics();
    
    // Setup stdio handlers
    this.setupStdioHandlers();
    
    logger.info('MCPStdioServer initialized', {
      name: this.config.server.name,
      version: packageVersion,
      transport: 'stdio'
    });
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): MCPServerMetrics {
    return {
      server: {
        uptime: 0,
        connections: 0,
        totalRequests: 0,
        requestsPerSecond: 0,
        averageResponseTime: 0,
        errorRate: 0
      },
      context: {
        totalContextRequests: 0,
        averageContextSize: 0,
        cacheHitRate: 0,
        averageRelevanceScore: 0,
        ttlFilesWatched: 0,
        ttlFilesLoaded: 0
      },
      performance: {
        memoryUsage: 0,
        cpuUsage: 0,
        diskUsage: 0,
        networkBytesIn: 0,
        networkBytesOut: 0
      }
    };
  }

  /**
   * Setup stdio handlers for MCP communication
   */
  private setupStdioHandlers(): void {
    // Setup stdin for receiving messages
    stdin.setEncoding('utf8');
    stdin.on('data', (data: string) => {
      this.handleStdinData(data);
    });

    stdin.on('end', () => {
      logger.info('Stdin ended, shutting down MCP stdio server');
      this.stop();
    });

    stdin.on('error', (error) => {
      logger.error('Stdin error', { error });
    });

    // Handle process termination
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
    process.on('exit', () => this.stop());
  }

  /**
   * Handle incoming stdin data
   */
  private handleStdinData(data: string): void {
    this.messageBuffer += data;
    
    // Process complete messages (separated by newlines)
    const lines = this.messageBuffer.split('\n');
    this.messageBuffer = lines.pop() || ''; // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (line.trim()) {
        this.processMessage(line.trim());
      }
    }
  }

  /**
   * Process a complete MCP message
   */
  private async processMessage(messageStr: string): Promise<void> {
    try {
      const message = JSON.parse(messageStr) as MCPRequest;
      await this.handleMessage(message);
      
      // Update metrics
      this.metrics.server.totalRequests++;
      this.metrics.performance.networkBytesIn += messageStr.length;
      
    } catch (error) {
      logger.error('Failed to process MCP message', { message: messageStr, error });
      // Note: Parse errors don't have an ID to reference
      this.sendError(-32700, 'Parse error', { error: String(error) }, 0);
    }
  }

  /**
   * Handle incoming MCP message
   */
  private async handleMessage(message: MCPRequest): Promise<void> {
    const startTime = Date.now();
    
    try {
      let result: any;

      switch (message.method) {
        case 'initialize':
          result = await this.handleInitialize(message.params);
          break;
        case 'tools/list':
          result = await this.handleToolsList();
          break;
        case 'tools/call':
          result = await this.handleToolCall(message.params);
          break;
        case 'resources/list':
          result = await this.handleResourcesList();
          break;
        case 'resources/read':
          result = await this.handleResourceRead(message.params);
          break;
        case 'context/request':
          result = await this.handleContextRequest(message.params);
          break;
        case 'ping':
          result = { pong: true };
          break;
        default:
          throw new MCPServerError('METHOD_NOT_FOUND', `Method not found: ${message.method}`);
      }

      this.sendResponse(message.id, result);
      
      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeMetrics(responseTime);
      
    } catch (error) {
      logger.error('MCP method error', { method: message.method, error });
      
      if (error instanceof MCPServerError) {
        this.sendError(this.getErrorCode(error.code), error.message, error.data);
      } else {
        this.sendError(-32603, 'Internal error', { error: String(error) });
      }
    }
  }

  /**
   * Handle initialize request
   */
  private async handleInitialize(params: any): Promise<any> {
    if (params.clientInfo) {
      this.client = {
        id: uuidv4(),
        name: params.clientInfo.name || 'Unknown Stdio Client',
        version: params.clientInfo.version || '1.0.0',
        capabilities: params.capabilities || {},
        connected: new Date(),
        lastActivity: new Date()
      };
      
      this.metrics.server.connections = 1;
      
      logger.info('MCP stdio client connected', {
        name: this.client.name,
        version: this.client.version
      });
    }

    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true },
        prompts: { listChanged: true },
        logging: {}
      },
      serverInfo: {
        name: this.config.server.name,
        version: this.config.server.version
      }
    };
  }

  /**
   * Handle tools list request
   */
  private async handleToolsList(): Promise<{ tools: MCPTool[] }> {
    const tools: MCPTool[] = [
      {
        name: 'get_context',
        description: 'Get rich codebase context for a specific file and cursor position',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Path to the current file' },
            cursorPosition: {
              type: 'object',
              properties: {
                line: { type: 'number' },
                column: { type: 'number' }
              },
              required: ['line', 'column']
            },
            selection: {
              type: 'object',
              properties: {
                start: {
                  type: 'object',
                  properties: { line: { type: 'number' }, column: { type: 'number' } }
                },
                end: {
                  type: 'object',
                  properties: { line: { type: 'number' }, column: { type: 'number' } }
                },
                text: { type: 'string' }
              }
            },
            query: { type: 'string', description: 'Optional query or question' },
            intent: { 
              type: 'string', 
              enum: ['explanation', 'completion', 'refactoring', 'debugging', 'documentation'],
              description: 'Intent of the context request'
            },
            maxTokens: { type: 'number', description: 'Maximum tokens in response' },
            includeRelated: { type: 'boolean', description: 'Include related files and context' }
          },
          required: ['filePath', 'cursorPosition']
        }
      },
      {
        name: 'query_knowledge',
        description: 'Query the knowledge graph using natural language or structured queries',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Natural language or structured query' },
            type: { 
              type: 'string', 
              enum: ['rag', 'cypher', 'sparql', 'auto'],
              description: 'Query type (auto-detected if not specified)'
            },
            maxResults: { type: 'number', description: 'Maximum number of results' },
            includeSourceFiles: { type: 'boolean', description: 'Include source file references' }
          },
          required: ['query']
        }
      },
      {
        name: 'analyze_code',
        description: 'Analyze code structure, dependencies, and relationships',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Path to file to analyze' },
            includeMetrics: { type: 'boolean', description: 'Include complexity metrics' },
            includeDependencies: { type: 'boolean', description: 'Include dependency analysis' },
            includeArchitecture: { type: 'boolean', description: 'Include architectural patterns' }
          },
          required: ['filePath']
        }
      },
      {
        name: 'get_file_content',
        description: 'Get the content of a specific file with context',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Path to the file' },
            includeMetadata: { type: 'boolean', description: 'Include file metadata' },
            lineRange: {
              type: 'object',
              properties: {
                start: { type: 'number' },
                end: { type: 'number' }
              },
              description: 'Optional line range to return'
            }
          },
          required: ['filePath']
        }
      }
    ];

    return { tools };
  }

  /**
   * Handle tool call
   */
  private async handleToolCall(params: MCPToolCall): Promise<MCPToolResult> {
    switch (params.name) {
      case 'get_context':
        return await this.handleGetContext(params.arguments);
      case 'query_knowledge':
        return await this.handleQueryKnowledge(params.arguments);
      case 'analyze_code':
        return await this.handleAnalyzeCode(params.arguments);
      case 'get_file_content':
        return await this.handleGetFileContent(params.arguments);
      default:
        throw new MCPServerError('METHOD_NOT_FOUND', `Tool not found: ${params.name}`);
    }
  }

  /**
   * Handle get context tool call
   */
  private async handleGetContext(args: any): Promise<MCPToolResult> {
    try {
      const contextRequest: ContextRequest = {
        filePath: args.filePath,
        cursorPosition: args.cursorPosition,
        selection: args.selection,
        query: args.query,
        intent: args.intent,
        maxTokens: args.maxTokens || this.config.context.maxTokens,
        includeRelated: args.includeRelated !== false
      };

      // Use TTL context loader for enhanced context
      const context = await this.ttlContextLoader.loadContext(contextRequest);
      
      this.metrics.context.totalContextRequests++;
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(context, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Get context failed', { error });
      return {
        content: [{
          type: 'text',
          text: `Error generating context: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }

  /**
   * Handle query knowledge tool call
   */
  private async handleQueryKnowledge(args: any): Promise<MCPToolResult> {
    try {
      const raw: any = await this.layer3Service.query({
        query: args.query,
        type: args.type || 'auto',
        ...(args.includeSourceFiles && {
          context: {
            currentFile: 'source_files_included'
          }
        })
      });

      // Normalize response to ensure consistent schema
      const response = 'response' in raw
        ? raw
        : {
            query: raw?.query ?? String(args.query),
            type: (raw?.type === 'auto' ? 'rag' : raw?.type) as any,
            response: String(raw?.answer ?? raw?.response ?? ''),
            confidence: typeof raw?.confidence === 'number' ? raw.confidence : 0,
            sources: Array.isArray(raw?.sources) ? raw.sources : [],
            executionTime: typeof raw?.executionTime === 'number' ? raw.executionTime : (raw?.metadata?.processingTime ?? 0),
            metadata: raw?.metadata ?? {}
          };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Query knowledge failed', { error });
      return {
        content: [{
          type: 'text',
          text: `Error querying knowledge: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }

  /**
   * Handle analyze code tool call
   */
  private async handleAnalyzeCode(args: any): Promise<MCPToolResult> {
    try {
      // Validate and sanitize the file path
      if (!args.filePath || typeof args.filePath !== 'string') {
        throw new MCPServerError('INVALID_PARAMS', 'Invalid filePath parameter');
      }
      
      // Sanitize the file path to prevent injection
      const sanitizedFilePath = args.filePath.replace(/["'\\]/g, '\\$&');
      
      const analysisQuery = `
        MATCH (f:File)-[:CONTAINS]->(entity)
        WHERE f.filePath CONTAINS "${sanitizedFilePath}"
        RETURN f, collect(entity) as entities
      `;
      
      const analysisResult = await this.hybridStorage.query(analysisQuery);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(analysisResult, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Analyze code failed', { error });
      return {
        content: [{
          type: 'text',
          text: `Error analyzing code: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }

  /**
   * Handle get file content tool call
   */
  private async handleGetFileContent(args: any): Promise<MCPToolResult> {
    try {
      if (!args.filePath || typeof args.filePath !== 'string') {
        throw new Error('filePath must be a string');
      }

      const resolvedPath = resolve(args.filePath);
      const projectRoot = process.cwd();

      if (!resolvedPath.startsWith(projectRoot + sep)) {
        throw new Error('Access outside project root is not allowed');
      }

      const stats = await stat(resolvedPath);
      const maxSize = 1024 * 1024; // 1MB default

      if (stats.size > maxSize) {
        throw new Error(`File exceeds size limit (${maxSize} bytes)`);
      }

      const content = await readFile(resolvedPath, 'utf-8');
      
      let responseContent = content;
      
      // Apply line range if specified
      if (args.lineRange) {
        const lines = content.split('\n');
        const start = Math.max(0, (args.lineRange.start || 1) - 1);
        const end = Math.min(lines.length, args.lineRange.end || lines.length);
        responseContent = lines.slice(start, end).join('\n');
      }
      
      const result: any = {
        filePath: resolvedPath,
        content: responseContent
      };

      if (args.includeMetadata) {
        result.metadata = {
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          language: this.detectLanguage(resolvedPath),
          lineCount: content.split('\n').length
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Get file content failed', { error });
      return {
        content: [{
          type: 'text',
          text: `Error reading file: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }

  /**
   * Handle resources list request
   */
  private async handleResourcesList(): Promise<{ resources: MCPResource[] }> {
    const resources: MCPResource[] = [];
    
    // Add TTL files as resources
    const ttlFiles = this.ttlContextLoader.getTTLFiles();
    for (const [path, ttlFile] of ttlFiles) {
      resources.push({
        uri: `ttl://${path}`,
        name: `TTL: ${relative(process.cwd(), path)}`,
        description: `Module knowledge file for ${ttlFile.metadata.module}`,
        mimeType: 'text/turtle'
      });
    }
    
    // Add target project source files as a comprehensive codebase index
    // This creates the "augmented code context engine": TTL + Neo4j + Source Code
    try {
      const directories = this.config.ttl.directories || [];
      const projectFiles: string[] = [];
      
      for (const ttlDirectory of directories) {
        // Infer the target project root from TTL directory structure
        // Example: "./keycloak-config-cli/knowledge" -> "./keycloak-config-cli"
        const projectRoot = ttlDirectory.replace(/\/knowledge\s*$/, '').replace(/\/ttl\s*$/, '');
        
        // Only scan the actual target project directory (not the TTL directory or AASWE tool)
        if (projectRoot &&
            projectRoot !== ttlDirectory &&
            projectRoot !== '.' &&
            projectRoot !== './' &&
            !projectRoot.includes('AIDe')) {
          
          logger.debug('Scanning target project for source code index', {
            ttlDirectory,
            projectRoot
          });
          
          const files = await glob(`${projectRoot}/**/*.{ts,js,py,java,kt,scala,swift,go,rs,cpp,c,php,rb,cs,fs,vb,dart,lua,perl,sh,bash,zsh,fish,ps1,bat,cmd,r,R,matlab,m,sol,move,cairo,vy,clarity,scilla}`, {
            ignore: [
              // Package managers and dependencies
              '**/node_modules/**',
              '**/bower_components/**',
              '**/vendor/**',
              '**/packages/**',
              '**/deps/**',
              '**/.pnpm-store/**',
              '**/.yarn/**',
              
              // Build outputs and artifacts
              '**/dist/**',
              '**/build/**',
              '**/out/**',
              '**/bin/**',
              '**/obj/**',
              '**/target/**',
              '**/release/**',
              '**/debug/**',
              '**/__pycache__/**',
              '**/*.pyc',
              '**/.pytest_cache/**',
              '**/coverage/**',
              '**/.nyc_output/**',
              '**/public/**',
              '**/static/**',
              
              // IDE and editor files
              '**/.vscode/**',
              '**/.idea/**',
              '**/.vs/**',
              '**/*.swp',
              '**/*.swo',
              '**/*~',
              
              // Version control
              '**/.git/**',
              '**/.svn/**',
              '**/.hg/**',
              '**/.bzr/**',
              
              // OS specific
              '**/.DS_Store',
              '**/Thumbs.db',
              '**/desktop.ini',
              
              // Language specific build artifacts
              '**/*.class',         // Java
              '**/*.jar',           // Java
              '**/*.war',           // Java
              '**/*.ear',           // Java
              '**/.gradle/**',      // Gradle
              '**/gradle/**',       // Gradle
              '**/gradlew*',        // Gradle
              '**/*.iml',           // IntelliJ
              '**/cmake-build-*/**', // CMake
              '**/.cmake/**',       // CMake
              '**/CMakeFiles/**',   // CMake
              '**/*.o',             // C/C++
              '**/*.so',            // C/C++
              '**/*.dll',           // Windows
              '**/*.exe',           // Windows
              '**/*.app',           // macOS
              '**/*.dSYM/**',       // macOS debugging
              '**/Cargo.lock',      // Rust (keep Cargo.toml)
              '**/Pipfile.lock',    // Python (keep Pipfile)
              '**/poetry.lock',     // Python (keep pyproject.toml)
              '**/.tox/**',         // Python
              '**/.venv/**',        // Python
              '**/venv/**',         // Python
              '**/env/**',          // Python
              '**/site-packages/**', // Python
              '**/go.sum',          // Go (keep go.mod)
              '**/composer.lock',   // PHP (keep composer.json)
              '**/yarn.lock',       // Node (keep package.json)
              '**/package-lock.json', // Node (keep package.json)
              '**/Gemfile.lock',    // Ruby (keep Gemfile)
              
              // AASWE knowledge directories
              '**/knowledge/**',    // Skip TTL knowledge directories
              '**/ttl/**',          // Skip TTL directories
              '**/.aaswe/**',       // Skip AASWE metadata
              
              // Temporary and cache files
              '**/tmp/**',
              '**/temp/**',
              '**/.cache/**',
              '**/logs/**',
              '**/*.log',
              
              // Documentation that's usually generated
              '**/docs/build/**',
              '**/site/**',
              '**/_site/**',
              
              // Test output directories
              '**/test-results/**',
              '**/allure-results/**',
              '**/cypress/videos/**',
              '**/cypress/screenshots/**'
            ],
            absolute: true
          });
          
          projectFiles.push(...files);
        }
      }
      
      // Add source files as resources (codebase index)
      for (const filePath of projectFiles.slice(0, 200)) { // Allow more files for comprehensive index
        resources.push({
          uri: `file://${filePath}`,
          name: `Source: ${relative(process.cwd(), filePath)}`,
          description: `Target project source file`,
          mimeType: this.getMimeType(filePath)
        });
      }
      
      logger.debug('Added target project source files to augmented context engine', {
        ttlFiles: this.ttlContextLoader.getTTLFiles().size,
        sourceFiles: projectFiles.length,
        ttlDirectories: directories,
        totalResources: resources.length
      });
      
    } catch (error) {
      logger.warn('Failed to build source code index for augmented context engine', { error });
    }

    return { resources };
  }

  /**
   * Handle resource read request
   */
  private async handleResourceRead(params: { uri: string }): Promise<MCPResourceContent> {
    if (params.uri.startsWith('ttl://')) {
      const path = params.uri.replace('ttl://', '');
      const ttlFile = this.ttlContextLoader.getTTLFile(path);
      
      if (!ttlFile) {
        throw new MCPServerError('FILE_NOT_FOUND', `TTL file not found: ${path}`);
      }

      return {
        uri: params.uri,
        mimeType: 'text/turtle',
        text: ttlFile.content
      };
    }
    
    if (params.uri.startsWith('file://')) {
      const filePath = params.uri.replace('file://', '');
      try {
        const content = await readFile(filePath, 'utf-8');
        return {
          uri: params.uri,
          mimeType: this.getMimeType(filePath),
          text: content
        };
      } catch (error) {
        throw new MCPServerError('FILE_NOT_FOUND', `File not found: ${filePath}`);
      }
    }

    throw new MCPServerError('INVALID_PARAMS', `Unsupported resource URI: ${params.uri}`);
  }

  /**
   * Handle context request
   */
  private async handleContextRequest(params: ContextRequest): Promise<ContextResponse> {
    return await this.ttlContextLoader.loadContext(params);
  }

  /**
   * Start the MCP stdio server
   */
  async start(): Promise<void> {
    try {
      this.status = 'starting';
      this.startTime = Date.now();
      this.isRunning = true;

      // Initialize TTL context loader
      await this.ttlContextLoader.start();

      // Initialize TTL file watching
      if (this.config.ttl.watchEnabled) {
        await this.initializeTTLWatcher();
      }

      // Load existing TTL files
      await this.loadTTLFiles();

      // Start cache cleanup
      if (this.config.context.cacheEnabled) {
        this.startCacheCleanup();
      }

      this.status = 'running';
      
      // Send initialization notification
      this.sendNotification('initialized', {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: true, listChanged: true },
          prompts: { listChanged: true },
          logging: {}
        },
        serverInfo: {
          name: this.config.server.name,
          version: this.config.server.version
        }
      });
      
      logger.info('MCP Stdio Server started', {
        version: this.config.server.version,
        ttlFiles: this.ttlFiles.size,
        transport: 'stdio'
      });

    } catch (error) {
      this.status = 'error';
      logger.error('Failed to start MCP Stdio Server', { error });
      throw error;
    }
  }

  /**
   * Stop the MCP stdio server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.status = 'stopping';
    this.isRunning = false;

    // Stop TTL context loader
    await this.ttlContextLoader.stop();

    // Stop file watcher
    if (this.fileWatcher) {
      await this.fileWatcher.close();
    }

    // Stop cache cleanup
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }

    this.status = 'stopped';
    this.metrics.server.connections = 0;
    
    logger.info('MCP Stdio Server stopped');
  }

  /**
   * Send response via stdout
   */
  private sendResponse(id: string | number, result: any): void {
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id,
      result
    };

    this.sendMessage(response);
  }

  /**
   * Send error via stdout
   */
  private sendError(code: number, message: string, data?: any, id: string | number = 0): void {
    const error: MCPError = { code, message, data };
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id,
      error
    };

    this.sendMessage(response);
  }

  /**
   * Send notification via stdout
   */
  private sendNotification(method: string, params?: any): void {
    const notification: MCPNotification = {
      jsonrpc: '2.0',
      method,
      params
    };

    this.sendMessage(notification);
  }

  /**
   * Send message via stdout
   */
  private sendMessage(message: any): void {
    try {
      const messageStr = JSON.stringify(message);
      stdout.write(messageStr + '\n');
      this.metrics.performance.networkBytesOut += messageStr.length;
    } catch (error) {
      logger.error('Failed to send stdio message', { error });
    }
  }

  // Helper methods (similar to MCPServer but adapted for stdio)
  
  private async initializeTTLWatcher(): Promise<void> {
    const directories = this.config.ttl.directories || ['./'];
    const patterns = this.config.ttl.patterns || ['**/*.module-knowledge.ttl'];
    
    const watchPatterns: string[] = [];
    for (const directory of directories) {
      for (const pattern of patterns) {
        const watchPattern = directory === './' ? pattern : `${directory}/${pattern}`;
        watchPatterns.push(watchPattern);
      }
    }
    
    this.fileWatcher = watch(watchPatterns, {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: false
    });

    this.fileWatcher.on('add', (path) => this.handleFileEvent('created', path));
    this.fileWatcher.on('change', (path) => this.handleFileEvent('modified', path));
    this.fileWatcher.on('unlink', (path) => this.handleFileEvent('deleted', path));

    logger.info('TTL file watcher initialized for stdio server', { patterns: watchPatterns });
  }

  private async handleFileEvent(type: FileWatchEvent['type'], path: string): Promise<void> {
    try {
      // Refresh TTL file in context loader
      if (type === 'created' || type === 'modified') {
        await this.ttlContextLoader.refreshTTLFile(path);
      }
      
      this.emit('ttl_file_changed', { type, path });
      
    } catch (error) {
      logger.error('Failed to handle file event in stdio server', { type, path, error });
    }
  }

  private async loadTTLFiles(): Promise<void> {
    // Delegate to TTL context loader
    const ttlFiles = this.ttlContextLoader.getTTLFiles();
    this.ttlFiles = ttlFiles;
    
    this.metrics.context.ttlFilesLoaded = this.ttlFiles.size;
    this.metrics.context.ttlFilesWatched = this.ttlFiles.size;
    
    logger.info(`Loaded ${this.ttlFiles.size} TTL files in stdio server`);
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': return 'typescript';
      case 'js': return 'javascript';
      case 'py': return 'python';
      case 'java': return 'java';
      case 'cpp': case 'cc': case 'cxx': return 'cpp';
      case 'c': return 'c';
      case 'go': return 'go';
      case 'rs': return 'rust';
      case 'php': return 'php';
      case 'rb': return 'ruby';
      default: return 'text';
    }
  }

  private getMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': return 'application/typescript';
      case 'js': return 'application/javascript';
      case 'py': return 'text/x-python';
      case 'java': return 'text/x-java-source';
      case 'json': return 'application/json';
      case 'md': return 'text/markdown';
      case 'txt': return 'text/plain';
      case 'ttl': return 'text/turtle';
      default: return 'text/plain';
    }
  }

  private getErrorCode(code: string): number {
    const errorCodes: { [key: string]: number } = {
      'INVALID_REQUEST': -32600,
      'METHOD_NOT_FOUND': -32601,
      'INVALID_PARAMS': -32602,
      'INTERNAL_ERROR': -32603,
      'CONTEXT_GENERATION_FAILED': -32000,
      'TTL_PARSING_FAILED': -32001,
      'FILE_NOT_FOUND': -32002,
      'PERMISSION_DENIED': -32003,
      'RATE_LIMITED': -32004,
      'SERVICE_UNAVAILABLE': -32005
    };

    return errorCodes[code] || -32603;
  }

  private updateResponseTimeMetrics(responseTime: number): void {
    const total = this.metrics.server.totalRequests;
    this.metrics.server.averageResponseTime =
      (this.metrics.server.averageResponseTime * (total - 1) + responseTime) / total;
  }

  private startCacheCleanup(): void {
    this.cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.contextCache.entries()) {
        if (now - cached.timestamp > cached.ttl) {
          this.contextCache.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }

  /**
   * Get server status
   */
  getStatus(): MCPServerStatus {
    return {
      status: this.status,
      uptime: this.status === 'running' ? Date.now() - this.startTime : 0,
      connections: this.client ? 1 : 0,
      metrics: {
        totalRequests: this.metrics.server.totalRequests,
        successfulRequests: this.metrics.server.totalRequests - Math.floor(this.metrics.server.totalRequests * this.metrics.server.errorRate),
        failedRequests: Math.floor(this.metrics.server.totalRequests * this.metrics.server.errorRate),
        averageResponseTime: this.metrics.server.averageResponseTime,
        contextCacheHits: Array.from(this.contextCache.values()).reduce((sum, c) => sum + c.hits, 0),
        contextCacheMisses: this.metrics.context.totalContextRequests - Array.from(this.contextCache.values()).reduce((sum, c) => sum + c.hits, 0)
      }
    };
  }

  /**
   * Get server metrics
   */
  getMetrics(): MCPServerMetrics {
    this.metrics.server.uptime = this.status === 'running' ? Date.now() - this.startTime : 0;
    this.metrics.server.connections = this.client ? 1 : 0;
    
    // Update cache hit rate
    const totalCacheRequests = this.metrics.context.totalContextRequests;
    const cacheHits = Array.from(this.contextCache.values()).reduce((sum, c) => sum + c.hits, 0);
    this.metrics.context.cacheHitRate = totalCacheRequests > 0 ? cacheHits / totalCacheRequests : 0;

    return { ...this.metrics };
  }
}