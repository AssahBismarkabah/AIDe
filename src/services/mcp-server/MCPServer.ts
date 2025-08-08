/**
 * MCP Server Implementation
 * 
 * Model Context Protocol server that provides rich codebase context
 * to IDE LLMs using TTL files and knowledge graphs.
 */

import { EventEmitter } from 'events';
import { createServer, Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { watch, FSWatcher } from 'chokidar';
import { glob } from 'glob';
import { readFile, stat } from 'fs/promises';
import { relative, dirname } from 'path';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import { Layer3AIService } from '../layer3/index';
import { HybridStorageManager } from '../layer2/hybrid-storage/HybridStorageManager';
import {
  MCPServerConfig,
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPNotification,
  ContextRequest,
  ContextResponse,
  ContextSource,
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
  MCPServerMetrics,
  ContextSelectionResult
} from './types';

/**
 * MCP Server for IDE Integration
 */
export class MCPServer extends EventEmitter {
  private config: MCPServerConfig;
  private server: Server;
  private wsServer: WebSocketServer;
  private layer3Service: Layer3AIService;
  // private _hybridStorage: HybridStorageManager;
  
  private clients: Map<string, MCPClient> = new Map();
  private connections: Map<string, WebSocket> = new Map();
  private ttlFiles: Map<string, TTLFile> = new Map();
  private contextCache: Map<string, ContextCache> = new Map();
  private fileWatcher: FSWatcher | null = null;
  
  private status: MCPServerStatus['status'] = 'stopped';
  private startTime: number = 0;
  private metrics: MCPServerMetrics;
  
  private cacheCleanupInterval?: NodeJS.Timeout;

  constructor(
    config: MCPServerConfig,
    layer3Service: Layer3AIService,
    hybridStorage: HybridStorageManager
  ) {
    super();
    
    this.config = config;
    this.layer3Service = layer3Service;
    // this._hybridStorage = hybridStorage;
    // Store for future use when needed
    hybridStorage;
    this.metrics = this.initializeMetrics();
    
    // Create HTTP server with health endpoint
    this.server = createServer((req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          uptime: this.status === 'running' ? Date.now() - this.startTime : 0,
          connections: this.connections.size,
          ttlFiles: this.ttlFiles.size,
          timestamp: new Date().toISOString()
        }));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });
    
    // Create WebSocket server
    this.wsServer = new WebSocketServer({
      server: this.server,
      maxPayload: 1024 * 1024 // 1MB max payload
    });
    
    this.setupWebSocketHandlers();
    
    logger.info('MCPServer initialized', {
      name: config.server.name,
      version: config.server.version,
      port: config.server.port
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
   * Setup WebSocket handlers
   */
  private setupWebSocketHandlers(): void {
    this.wsServer.on('connection', (ws: WebSocket, request) => {
      const clientId = uuidv4();
      const clientInfo: MCPClient = {
        id: clientId,
        name: 'Unknown',
        version: '1.0.0',
        capabilities: {},
        connected: new Date(),
        lastActivity: new Date()
      };

      this.clients.set(clientId, clientInfo);
      this.connections.set(clientId, ws);
      this.metrics.server.connections++;

      logger.info('MCP client connected', { clientId, ip: request.socket.remoteAddress });

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as MCPRequest;
          await this.handleMessage(clientId, message);
          
          // Update client activity
          const client = this.clients.get(clientId);
          if (client) {
            client.lastActivity = new Date();
          }
          
          this.metrics.server.totalRequests++;
        } catch (error) {
          logger.error('Failed to handle MCP message', { clientId, error });
          this.sendError(clientId, -32700, 'Parse error', { error: String(error) });
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        this.connections.delete(clientId);
        this.metrics.server.connections--;
        logger.info('MCP client disconnected', { clientId });
      });

      ws.on('error', (error) => {
        logger.error('MCP WebSocket error', { clientId, error });
      });

      // Send initialization
      this.sendNotification(clientId, 'initialized', {
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
    });
  }

  /**
   * Handle incoming MCP message
   */
  private async handleMessage(clientId: string, message: MCPRequest): Promise<void> {
    const startTime = Date.now();
    
    try {
      let result: any;

      switch (message.method) {
        case 'initialize':
          result = await this.handleInitialize(clientId, message.params);
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

      this.sendResponse(clientId, message.id, result);
      
      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeMetrics(responseTime);
      
    } catch (error) {
      logger.error('MCP method error', { method: message.method, error });
      
      if (error instanceof MCPServerError) {
        this.sendError(clientId, this.getErrorCode(error.code), error.message, error.data);
      } else {
        this.sendError(clientId, -32603, 'Internal error', { error: String(error) });
      }
    }
  }

  /**
   * Handle initialize request
   */
  private async handleInitialize(clientId: string, params: any): Promise<any> {
    const client = this.clients.get(clientId);
    if (client) {
      client.name = params.clientInfo?.name || 'Unknown';
      client.version = params.clientInfo?.version || '1.0.0';
      client.capabilities = params.capabilities || {};
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
        description: 'Query the knowledge graph using natural language',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Natural language query' },
            type: { 
              type: 'string', 
              enum: ['rag', 'cypher', 'sparql', 'auto'],
              description: 'Query type (auto-detected if not specified)'
            },
            maxResults: { type: 'number', description: 'Maximum number of results' }
          },
          required: ['query']
        }
      },
      {
        name: 'analyze_code',
        description: 'Analyze code structure and relationships',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Path to file to analyze' },
            includeMetrics: { type: 'boolean', description: 'Include complexity metrics' },
            includeDependencies: { type: 'boolean', description: 'Include dependency analysis' }
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

      const context = await this.generateContext(contextRequest);
      
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
      const response = await this.layer3Service.query({
        query: args.query,
        type: args.type || 'auto'
      });

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
      // This would integrate with Layer 1 services for code analysis
      const analysis = {
        filePath: args.filePath,
        structure: 'Code structure analysis would go here',
        metrics: args.includeMetrics ? 'Complexity metrics would go here' : undefined,
        dependencies: args.includeDependencies ? 'Dependency analysis would go here' : undefined
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(analysis, null, 2)
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
   * Handle resources list request
   */
  private async handleResourcesList(): Promise<{ resources: MCPResource[] }> {
    const resources: MCPResource[] = [];
    
    // Add TTL files as resources
    for (const [path, ttlFile] of this.ttlFiles) {
      resources.push({
        uri: `ttl://${path}`,
        name: `TTL: ${relative(process.cwd(), path)}`,
        description: `Module knowledge file for ${ttlFile.metadata.module}`,
        mimeType: 'text/turtle'
      });
    }

    return { resources };
  }

  /**
   * Handle resource read request
   */
  private async handleResourceRead(params: { uri: string }): Promise<MCPResourceContent> {
    if (params.uri.startsWith('ttl://')) {
      const path = params.uri.replace('ttl://', '');
      const ttlFile = this.ttlFiles.get(path);
      
      if (!ttlFile) {
        throw new MCPServerError('FILE_NOT_FOUND', `TTL file not found: ${path}`);
      }

      return {
        uri: params.uri,
        mimeType: 'text/turtle',
        text: ttlFile.content
      };
    }

    throw new MCPServerError('INVALID_PARAMS', `Unsupported resource URI: ${params.uri}`);
  }

  /**
   * Handle context request
   */
  private async handleContextRequest(params: ContextRequest): Promise<ContextResponse> {
    return await this.generateContext(params);
  }

  /**
   * Generate context for a request
   */
  private async generateContext(request: ContextRequest): Promise<ContextResponse> {
    const startTime = Date.now();
    
    // Update metrics first
    this.metrics.context.totalContextRequests++;
    
    // Check cache first
    const cacheKey = this.generateCacheKey(request);
    const cached = this.getCachedContext(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Select relevant TTL files and context
      const selection = await this.selectRelevantContext(request);
      
      // Load and process selected files
      const sources: ContextSource[] = [];
      let totalTokens = 0;
      let relevanceScore = 0;

      for (const filePath of selection.selectedFiles) {
        if (totalTokens >= request.maxTokens!) break;

        const ttlFile = this.ttlFiles.get(filePath);
        if (ttlFile) {
          const source: ContextSource = {
            type: 'ttl',
            path: filePath,
            content: this.formatTTLForLLM(ttlFile),
            relevanceScore: selection.relevanceScores[filePath] || 0,
            metadata: {
              lastModified: ttlFile.lastModified,
              size: ttlFile.size,
              language: ttlFile.metadata.language,
              module: ttlFile.metadata.module
            }
          };

          sources.push(source);
          totalTokens += this.estimateTokens(source.content);
          relevanceScore += source.relevanceScore;
        }
      }

      // Generate final context
      const context = this.buildContextString(sources, request);
      
      // Ensure processing time is > 0
      const processingTime = Math.max(1, Date.now() - startTime);
      
      const response: ContextResponse = {
        context,
        sources,
        metadata: {
          totalTokens,
          processingTime,
          relevanceScore: sources.length > 0 ? relevanceScore / sources.length : 0,
          cached: false
        },
        suggestions: {
          relatedFiles: selection.alternatives[0]?.files || [],
          followUpQueries: this.generateFollowUpQueries(request, sources),
          improvements: this.generateImprovements(sources)
        }
      };

      // Cache the response
      if (this.config.context.cacheEnabled) {
        this.cacheContext(cacheKey, response);
      }

      this.metrics.context.averageContextSize =
        (this.metrics.context.averageContextSize * (this.metrics.context.totalContextRequests - 1) +
         totalTokens) / this.metrics.context.totalContextRequests;

      return response;
      
    } catch (error) {
      logger.error('Context generation failed', { request, error });
      throw new MCPServerError('CONTEXT_GENERATION_FAILED', 'Failed to generate context', { error });
    }
  }

  /**
   * Select relevant context based on request
   */
  private async selectRelevantContext(request: ContextRequest): Promise<ContextSelectionResult> {
    // Simple relevance scoring based on file proximity and content
    const relevanceScores: { [filePath: string]: number } = {};
    const selectedFiles: string[] = [];

    const requestDir = dirname(request.filePath);
    
    for (const [filePath, ttlFile] of this.ttlFiles) {
      let score = 0;

      // File proximity scoring
      const fileDir = dirname(filePath);
      if (fileDir === requestDir) score += 0.5;
      else if (fileDir.startsWith(requestDir) || requestDir.startsWith(fileDir)) score += 0.3;

      // Language matching
      if (ttlFile.metadata.language && request.filePath.includes(ttlFile.metadata.language)) {
        score += 0.3;
      }

      // Query matching (if provided)
      if (request.query && ttlFile.content.toLowerCase().includes(request.query.toLowerCase())) {
        score += 0.4;
      }

      // Dependency matching
      if (ttlFile.metadata.dependencies.some(dep => request.filePath.includes(dep))) {
        score += 0.2;
      }

      relevanceScores[filePath] = score;
      
      if (score > this.config.context.relevanceThreshold) {
        selectedFiles.push(filePath);
      }
    }

    // Sort by relevance and limit
    selectedFiles.sort((a, b) => relevanceScores[b] - relevanceScores[a]);
    const limitedFiles = selectedFiles.slice(0, this.config.context.maxFiles);

    return {
      selectedFiles: limitedFiles,
      relevanceScores,
      reasoning: `Selected ${limitedFiles.length} files based on proximity, language, and content relevance`,
      alternatives: [{
        files: selectedFiles.slice(this.config.context.maxFiles),
        score: 0.5,
        reason: 'Alternative files with lower relevance scores'
      }]
    };
  }

  /**
   * Format TTL file content for LLM consumption
   */
  private formatTTLForLLM(ttlFile: TTLFile): string {
    const lines = [
      `# Module: ${ttlFile.metadata.module}`,
      `# Language: ${ttlFile.metadata.language}`,
      `# Dependencies: ${ttlFile.metadata.dependencies.join(', ')}`,
      `# Last Modified: ${ttlFile.lastModified.toISOString()}`,
      '',
      '# Knowledge Content:',
      ttlFile.content,
      '',
      '# Business Context:',
      ...ttlFile.metadata.businessContext.map(ctx => `# ${ctx}`)
    ];

    return lines.join('\n');
  }

  /**
   * Build context string from sources
   */
  private buildContextString(sources: ContextSource[], request: ContextRequest): string {
    const lines = [
      '# Codebase Context',
      `# Current File: ${request.filePath}`,
      `# Cursor Position: Line ${request.cursorPosition.line}, Column ${request.cursorPosition.column}`,
      ''
    ];

    if (request.query) {
      lines.push(`# Query: ${request.query}`, '');
    }

    if (request.intent) {
      lines.push(`# Intent: ${request.intent}`, '');
    }

    lines.push('# Relevant Knowledge:');

    for (const source of sources) {
      lines.push(
        '',
        `## ${source.metadata.module} (${source.type.toUpperCase()})`,
        `Relevance: ${(source.relevanceScore * 100).toFixed(1)}%`,
        `Path: ${source.path}`,
        '',
        source.content
      );
    }

    return lines.join('\n');
  }

  /**
   * Generate follow-up queries
   */
  private generateFollowUpQueries(request: ContextRequest, _sources: ContextSource[]): string[] {
    const queries = [
      'What are the main dependencies of this module?',
      'How does this code relate to other parts of the system?',
      'What are the key architectural patterns used here?'
    ];

    if (request.intent === 'debugging') {
      queries.unshift('What are common issues in this type of code?');
    }

    if (request.intent === 'refactoring') {
      queries.push('What refactoring opportunities exist here?');
    }

    return queries.slice(0, 3);
  }

  /**
   * Generate improvement suggestions
   */
  private generateImprovements(sources: ContextSource[]): string[] {
    const improvements: string[] = [];

    if (sources.length < 3) {
      improvements.push('Consider adding more detailed business context to TTL files');
    }

    if (sources.some(s => s.metadata.size > 10000)) {
      improvements.push('Large TTL files detected - consider splitting for better performance');
    }

    improvements.push('Enhance TTL files with more architectural insights');

    return improvements;
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    try {
      this.status = 'starting';
      this.startTime = Date.now();

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

      // Start HTTP server
      await new Promise<void>((resolve, reject) => {
        this.server.listen(this.config.server.port, this.config.server.host, (error?: Error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      this.status = 'running';
      
      logger.info('MCP Server started', {
        host: this.config.server.host,
        port: this.config.server.port,
        ttlFiles: this.ttlFiles.size
      });

    } catch (error) {
      this.status = 'error';
      logger.error('Failed to start MCP Server', { error });
      throw error;
    }
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    this.status = 'stopping';

    // Close all connections
    for (const [_clientId, ws] of this.connections) {
      ws.close();
    }

    // Stop file watcher
    if (this.fileWatcher) {
      await this.fileWatcher.close();
    }

    // Stop cache cleanup
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }

    // Close servers
    this.wsServer.close();
    await new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });

    this.status = 'stopped';
    logger.info('MCP Server stopped');
  }

  /**
   * Initialize TTL file watcher
   */
  private async initializeTTLWatcher(): Promise<void> {
    this.fileWatcher = watch('**/*.module-knowledge.ttl', {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: false
    });

    this.fileWatcher.on('add', (path) => this.handleFileEvent('created', path));
    this.fileWatcher.on('change', (path) => this.handleFileEvent('modified', path));
    this.fileWatcher.on('unlink', (path) => this.handleFileEvent('deleted', path));

    logger.info('TTL file watcher initialized');
  }

  /**
   * Handle file system events
   */
  private async handleFileEvent(type: FileWatchEvent['type'], path: string): Promise<void> {
    try {
      switch (type) {
        case 'created':
        case 'modified':
          await this.loadTTLFile(path);
          this.clearRelatedCache(path);
          break;
        case 'deleted':
          this.ttlFiles.delete(path);
          this.clearRelatedCache(path);
          break;
      }

      this.emit('ttl_file_changed', { type, path });
      
      // Notify clients
      this.broadcastNotification('resources/list_changed', {});
      
    } catch (error) {
      logger.error('Failed to handle file event', { type, path, error });
    }
  }

  /**
   * Load all TTL files
   */
  private async loadTTLFiles(): Promise<void> {
    try {
      logger.info('Loading TTL files...');
      
      // Scan for TTL files in the project
      const ttlPattern = '**/*.module-knowledge.ttl';
      const ttlFiles = await glob(ttlPattern, {
        ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
        absolute: true
      });
      
      logger.info(`Found ${ttlFiles.length} TTL files to load`);
      
      // Load each TTL file
      const loadPromises = ttlFiles.map(filePath => this.loadTTLFile(filePath));
      await Promise.allSettled(loadPromises);
      
      this.metrics.context.ttlFilesLoaded = this.ttlFiles.size;
      this.metrics.context.ttlFilesWatched = this.ttlFiles.size;
      
      logger.info(`Successfully loaded ${this.ttlFiles.size} TTL files`);
      
    } catch (error) {
      logger.error('Failed to load TTL files', { error });
    }
  }

  /**
   * Load a single TTL file
   */
  private async loadTTLFile(path: string): Promise<void> {
    try {
      const content = await readFile(path, 'utf-8');
      const stats = await stat(path);
      const hash = createHash('md5').update(content).digest('hex');

      const ttlFile: TTLFile = {
        path,
        content,
        lastModified: stats.mtime,
        size: stats.size,
        hash,
        parsed: this.parseTTLContent(content),
        metadata: this.extractTTLMetadata(content, path)
      };

      this.ttlFiles.set(path, ttlFile);
      this.metrics.context.ttlFilesWatched = this.ttlFiles.size;
      
      logger.debug('TTL file loaded', { path, size: stats.size });
      
    } catch (error) {
      logger.error('Failed to load TTL file', { path, error });
    }
  }

  /**
   * Parse TTL content (simplified)
   */
  private parseTTLContent(_content: string): TTLFile['parsed'] {
    // This is a simplified parser - in production, use a proper RDF library
    return {
      triples: [],
      prefixes: {},
      classes: [],
      properties: [],
      individuals: []
    };
  }

  /**
   * Extract metadata from TTL content
   */
  private extractTTLMetadata(content: string, path: string): TTLFile['metadata'] {
    // Extract metadata from comments and content
    const lines = content.split('\n');
    const comments = lines.filter(line => line.trim().startsWith('#'));
    
    // Extract language from comments first, then fallback to path/content
    let language = this.extractLanguage(path, content);
    const langComment = comments.find(c => c.toLowerCase().includes('language:'));
    if (langComment) {
      const match = langComment.match(/language:\s*(\w+)/i);
      if (match) {
        language = match[1].toLowerCase();
      }
    }
    
    // Extract dependencies from comments
    let dependencies = this.extractDependencies(content);
    const depComment = comments.find(c => c.toLowerCase().includes('dependencies:'));
    if (depComment) {
      const match = depComment.match(/dependencies:\s*(.+)/i);
      if (match) {
        dependencies = match[1].split(',').map(d => d.trim()).filter(Boolean);
      }
    }
    
    return {
      module: this.extractModuleName(path),
      language,
      dependencies,
      businessContext: comments.map(c => c.replace('#', '').trim()).filter(Boolean),
      architecturalPatterns: [],
      qualityMetrics: {},
      extractedAt: new Date()
    };
  }

  /**
   * Extract module name from path
   */
  private extractModuleName(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 2] || 'unknown';
  }

  /**
   * Extract language from path/content
   */
  private extractLanguage(path: string, content: string): string {
    // Check file extensions first
    if (path.endsWith('.java') || path.includes('/java/')) return 'java';
    if (path.endsWith('.py') || path.includes('/python/')) return 'python';
    if (path.endsWith('.js') || path.includes('/js/')) return 'javascript';
    if (path.endsWith('.ts') || path.includes('/ts/')) return 'typescript';
    
    // Check content for language hints
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('typescript')) return 'typescript';
    if (lowerContent.includes('javascript')) return 'javascript';
    if (lowerContent.includes('python')) return 'python';
    if (lowerContent.includes('java') && !lowerContent.includes('javascript')) return 'java';
    
    return 'unknown';
  }

  /**
   * Extract dependencies from content
   */
  private extractDependencies(content: string): string[] {
    // Simple dependency extraction from TTL content
    const dependencies: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Look for various dependency patterns
      if (line.includes('imports:') || line.includes('depends:') || line.includes('Dependencies:')) {
        // Extract quoted strings
        const quotedMatches = line.match(/["']([^"']+)["']/g);
        if (quotedMatches) {
          quotedMatches.forEach(match => {
            const dep = match.replace(/["']/g, '');
            if (dep && !dependencies.includes(dep)) {
              dependencies.push(dep);
            }
          });
        }
        
        // Extract comma-separated values after colon
        const colonMatch = line.match(/(?:imports|depends|Dependencies):\s*(.+)/i);
        if (colonMatch) {
          const deps = colonMatch[1].split(',').map(d => d.trim().replace(/["']/g, '')).filter(Boolean);
          deps.forEach(dep => {
            if (!dependencies.includes(dep)) {
              dependencies.push(dep);
            }
          });
        }
      }
    }
    
    return dependencies;
  }

  /**
   * Send response to client
   */
  private sendResponse(clientId: string, id: string | number, result: any): void {
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id,
      result
    };

    this.sendMessage(clientId, response);
  }

  /**
   * Send error to client
   */
  private sendError(clientId: string, code: number, message: string, data?: any): void {
    const error: MCPError = { code, message, data };
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: 0, // Error responses may not have an ID
      error
    };

    this.sendMessage(clientId, response);
  }

  /**
   * Send notification to client
   */
  private sendNotification(clientId: string, method: string, params?: any): void {
    const notification: MCPNotification = {
      jsonrpc: '2.0',
      method,
      params
    };

    this.sendMessage(clientId, notification);
  }

  /**
   * Broadcast notification to all clients
   */
  private broadcastNotification(method: string, params?: any): void {
    for (const clientId of this.clients.keys()) {
      this.sendNotification(clientId, method, params);
    }
  }

  /**
   * Send message to client
   */
  private sendMessage(clientId: string, message: any): void {
    const connection = this.connections.get(clientId);
    if (connection) {
      try {
        connection.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Failed to send message to client', { clientId, error });
      }
    }
  }

  /**
   * Get error code for MCP error
   */
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

  /**
   * Update response time metrics
   */
  private updateResponseTimeMetrics(responseTime: number): void {
    const total = this.metrics.server.totalRequests;
    this.metrics.server.averageResponseTime =
      (this.metrics.server.averageResponseTime * (total - 1) + responseTime) / total;
  }

  /**
   * Generate cache key for context request
   */
  private generateCacheKey(request: ContextRequest): string {
    const key = JSON.stringify({
      filePath: request.filePath,
      cursorPosition: request.cursorPosition,
      query: request.query,
      intent: request.intent,
      maxTokens: request.maxTokens
    });
    
    return createHash('md5').update(key).digest('hex');
  }

  /**
   * Get cached context
   */
  private getCachedContext(cacheKey: string): ContextResponse | null {
    const cached = this.contextCache.get(cacheKey);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.contextCache.delete(cacheKey);
      return null;
    }

    cached.hits++;
    cached.context.metadata.cached = true;
    return cached.context;
  }

  /**
   * Cache context response
   */
  private cacheContext(cacheKey: string, response: ContextResponse): void {
    const cached: ContextCache = {
      key: cacheKey,
      context: response,
      timestamp: Date.now(),
      ttl: this.config.context.cacheTtl,
      hits: 0
    };

    this.contextCache.set(cacheKey, cached);

    // Limit cache size
    if (this.contextCache.size > 1000) {
      const oldestKey = this.contextCache.keys().next().value;
      if (oldestKey) {
        this.contextCache.delete(oldestKey);
      }
    }
  }

  /**
   * Clear cache related to a file
   */
  private clearRelatedCache(filePath: string): void {
    for (const [key, cached] of this.contextCache.entries()) {
      if (cached.context.sources.some(s => s.path === filePath)) {
        this.contextCache.delete(key);
      }
    }
  }

  /**
   * Estimate tokens in text
   */
  private estimateTokens(text: string): number {
    // Simple token estimation (roughly 4 characters per token)
    return Math.ceil(text.length / 4);
  }

  /**
   * Start cache cleanup interval
   */
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
      connections: this.connections.size,
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
    this.metrics.server.connections = this.connections.size;
    
    // Update cache hit rate
    const totalCacheRequests = this.metrics.context.totalContextRequests;
    const cacheHits = Array.from(this.contextCache.values()).reduce((sum, c) => sum + c.hits, 0);
    this.metrics.context.cacheHitRate = totalCacheRequests > 0 ? cacheHits / totalCacheRequests : 0;

    return { ...this.metrics };
  }
}