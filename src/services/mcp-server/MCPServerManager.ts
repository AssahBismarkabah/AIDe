/**
 * MCP Server Manager
 * 
 * Unified manager that supports both WebSocket and stdio transports
 * for maximum compatibility with different MCP clients.
 */

import { EventEmitter } from 'events';
import logger from '../../utils/logger';
import { MCPServer } from './MCPServer';
import { MCPStdioServer } from './MCPStdioServer';
import { TTLContextLoader } from './TTLContextLoader';
import { Layer3AIService } from '../layer3/index';
import { HybridStorageManager } from '../layer2/hybrid-storage/HybridStorageManager';
import {
  MCPServerConfig,
  MCPServerStatus,
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

export type TransportType = 'websocket' | 'stdio' | 'both';

export interface MCPServerManagerConfig extends MCPServerConfig {
  transport: TransportType;
}

/**
 * MCP Server Manager
 * 
 * Manages both WebSocket and stdio MCP servers to support all client types
 */
export class MCPServerManager extends EventEmitter {
  private config: MCPServerManagerConfig;
  private layer3Service: Layer3AIService;
  private hybridStorage: HybridStorageManager;
  private ttlContextLoader: TTLContextLoader;
  
  private webSocketServer: MCPServer | undefined;
  private stdioServer: MCPStdioServer | undefined;
  
  private isInitialized = false;
  private startTime = 0;

  constructor(
    config: MCPServerManagerConfig,
    layer3Service: Layer3AIService,
    hybridStorage: HybridStorageManager,
    ttlContextLoader: TTLContextLoader
  ) {
    super();
    
    // Ensure version is automatically resolved
    this.config = {
      ...config,
      server: {
        ...config.server,
        version: packageVersion
      }
    };
    
    this.layer3Service = layer3Service;
    this.hybridStorage = hybridStorage;
    this.ttlContextLoader = ttlContextLoader;
    
    logger.info('MCPServerManager initialized', {
      name: this.config.server.name,
      version: packageVersion,
      transport: this.config.transport
    });
  }

  /**
   * Start MCP servers based on transport configuration
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting MCP Server Manager', {
        transport: this.config.transport,
        version: this.config.server.version
      });
      
      this.startTime = Date.now();
      
      // Start TTL context loader first
      if (!this.ttlContextLoader) {
        throw new Error('TTL Context Loader is required');
      }
      
      if (this.config.transport === 'websocket' || this.config.transport === 'both') {
        logger.info('Starting WebSocket MCP Server...');
        this.webSocketServer = new MCPServer(
          this.config,
          this.layer3Service,
          this.hybridStorage
        );
        
        await this.webSocketServer.start();
        this.setupWebSocketEventHandlers();
        
        logger.info('WebSocket MCP Server started successfully', {
          port: this.config.server.port,
          host: this.config.server.host
        });
      }
      
      if (this.config.transport === 'stdio' || this.config.transport === 'both') {
        logger.info('Starting Stdio MCP Server...');
        this.stdioServer = new MCPStdioServer(
          this.config,
          this.layer3Service,
          this.hybridStorage,
          this.ttlContextLoader
        );
        
        await this.stdioServer.start();
        this.setupStdioEventHandlers();
        
        logger.info('Stdio MCP Server started successfully');
      }
      
      this.isInitialized = true;
      
      logger.info('MCP Server Manager started successfully', {
        transport: this.config.transport,
        webSocketEnabled: !!this.webSocketServer,
        stdioEnabled: !!this.stdioServer,
        version: this.config.server.version
      });
      
      this.emit('started');
      
    } catch (error) {
      logger.error('Failed to start MCP Server Manager', { error });
      throw error;
    }
  }

  /**
   * Stop MCP servers
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping MCP Server Manager...');
      
      if (this.webSocketServer) {
        await this.webSocketServer.stop();
        this.webSocketServer = undefined;
        logger.info('WebSocket MCP Server stopped');
      }
      
      if (this.stdioServer) {
        await this.stdioServer.stop();
        this.stdioServer = undefined;
        logger.info('Stdio MCP Server stopped');
      }
      
      this.isInitialized = false;
      
      logger.info('MCP Server Manager stopped successfully');
      this.emit('stopped');
      
    } catch (error) {
      logger.error('Failed to stop MCP Server Manager', { error });
      throw error;
    }
  }

  /**
   * Get combined status from all active servers
   */
  getStatus(): MCPServerStatus {
    const baseStatus: MCPServerStatus = {
      status: 'stopped',
      uptime: this.isInitialized ? Date.now() - this.startTime : 0,
      connections: 0,
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        contextCacheHits: 0,
        contextCacheMisses: 0
      }
    };

    if (!this.isInitialized) {
      return baseStatus;
    }

    // Combine status from active servers
    let combinedStatus: MCPServerStatus['status'] = 'running';
    let totalConnections = 0;
    let combinedMetrics = { ...baseStatus.metrics };

    if (this.webSocketServer) {
      const wsStatus = this.webSocketServer.getStatus();
      totalConnections += wsStatus.connections;
      
      // Combine metrics
      combinedMetrics.totalRequests += wsStatus.metrics.totalRequests;
      combinedMetrics.successfulRequests += wsStatus.metrics.successfulRequests;
      combinedMetrics.failedRequests += wsStatus.metrics.failedRequests;
      combinedMetrics.contextCacheHits += wsStatus.metrics.contextCacheHits;
      combinedMetrics.contextCacheMisses += wsStatus.metrics.contextCacheMisses;
      
      if (wsStatus.status !== 'running') {
        combinedStatus = 'error';
      }
    }

    if (this.stdioServer) {
      const stdioStatus = this.stdioServer.getStatus();
      totalConnections += stdioStatus.connections;
      
      // Combine metrics
      combinedMetrics.totalRequests += stdioStatus.metrics.totalRequests;
      combinedMetrics.successfulRequests += stdioStatus.metrics.successfulRequests;
      combinedMetrics.failedRequests += stdioStatus.metrics.failedRequests;
      combinedMetrics.contextCacheHits += stdioStatus.metrics.contextCacheHits;
      combinedMetrics.contextCacheMisses += stdioStatus.metrics.contextCacheMisses;
      
      if (stdioStatus.status !== 'running') {
        combinedStatus = 'error';
      }
    }

    // Calculate combined averages
    const totalMetricRequests = combinedMetrics.totalRequests;
    if (totalMetricRequests > 0) {
      let totalResponseTime = 0;
      let responseTimeCount = 0;
      
      if (this.webSocketServer) {
        const wsMetrics = this.webSocketServer.getMetrics();
        totalResponseTime += wsMetrics.server.averageResponseTime * wsMetrics.server.totalRequests;
        responseTimeCount += wsMetrics.server.totalRequests;
      }
      
      if (this.stdioServer) {
        const stdioMetrics = this.stdioServer.getMetrics();
        totalResponseTime += stdioMetrics.server.averageResponseTime * stdioMetrics.server.totalRequests;
        responseTimeCount += stdioMetrics.server.totalRequests;
      }
      
      combinedMetrics.averageResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;
    }

    return {
      status: combinedStatus,
      uptime: Date.now() - this.startTime,
      connections: totalConnections,
      metrics: combinedMetrics
    };
  }

  /**
   * Get combined metrics from all active servers
   */
  getMetrics(): {
    combined: MCPServerMetrics;
    websocket?: MCPServerMetrics;
    stdio?: MCPServerMetrics;
  } {
    const result: any = {
      combined: this.initializeCombinedMetrics()
    };

    if (this.webSocketServer) {
      result.websocket = this.webSocketServer.getMetrics();
      this.combineMetrics(result.combined, result.websocket);
    }

    if (this.stdioServer) {
      result.stdio = this.stdioServer.getMetrics();
      this.combineMetrics(result.combined, result.stdio);
    }

    return result;
  }

  /**
   * Get transport-specific server instance
   */
  getServer(transport: 'websocket' | 'stdio'): MCPServer | MCPStdioServer | undefined {
    switch (transport) {
      case 'websocket':
        return this.webSocketServer;
      case 'stdio':
        return this.stdioServer;
      default:
        return undefined;
    }
  }

  /**
   * Check if a specific transport is active
   */
  isTransportActive(transport: 'websocket' | 'stdio'): boolean {
    switch (transport) {
      case 'websocket':
        return !!this.webSocketServer;
      case 'stdio':
        return !!this.stdioServer;
      default:
        return false;
    }
  }

  /**
   * Get active transports
   */
  getActiveTransports(): Array<'websocket' | 'stdio'> {
    const active: Array<'websocket' | 'stdio'> = [];
    
    if (this.webSocketServer) {
      active.push('websocket');
    }
    
    if (this.stdioServer) {
      active.push('stdio');
    }
    
    return active;
  }

  // Private helper methods

  private setupWebSocketEventHandlers(): void {
    if (!this.webSocketServer) return;

    this.webSocketServer.on('client_connected', (data) => {
      logger.info('WebSocket client connected', data);
      this.emit('client_connected', { transport: 'websocket', ...data });
    });

    this.webSocketServer.on('client_disconnected', (data) => {
      logger.info('WebSocket client disconnected', data);
      this.emit('client_disconnected', { transport: 'websocket', ...data });
    });

    this.webSocketServer.on('query_completed', (data) => {
      this.emit('query_completed', { transport: 'websocket', ...data });
    });

    this.webSocketServer.on('query_failed', (data) => {
      this.emit('query_failed', { transport: 'websocket', ...data });
    });
  }

  private setupStdioEventHandlers(): void {
    if (!this.stdioServer) return;

    this.stdioServer.on('client_connected', (data) => {
      logger.info('Stdio client connected', data);
      this.emit('client_connected', { transport: 'stdio', ...data });
    });

    this.stdioServer.on('client_disconnected', (data) => {
      logger.info('Stdio client disconnected', data);
      this.emit('client_disconnected', { transport: 'stdio', ...data });
    });

    this.stdioServer.on('query_completed', (data) => {
      this.emit('query_completed', { transport: 'stdio', ...data });
    });

    this.stdioServer.on('query_failed', (data) => {
      this.emit('query_failed', { transport: 'stdio', ...data });
    });

    this.stdioServer.on('ttl_file_changed', (data) => {
      this.emit('ttl_file_changed', { transport: 'stdio', ...data });
    });
  }

  private initializeCombinedMetrics(): MCPServerMetrics {
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

  private combineMetrics(combined: MCPServerMetrics, metrics: MCPServerMetrics): void {
    // Combine server metrics
    combined.server.connections += metrics.server.connections;
    combined.server.totalRequests += metrics.server.totalRequests;
    combined.server.uptime = Math.max(combined.server.uptime, metrics.server.uptime);
    
    // Average response time (weighted by request count)
    const totalRequests = combined.server.totalRequests;
    if (totalRequests > 0) {
      const prevTotal = totalRequests - metrics.server.totalRequests;
      const prevAvg = combined.server.averageResponseTime;
      const newAvg = metrics.server.averageResponseTime;
      const newCount = metrics.server.totalRequests;
      
      combined.server.averageResponseTime = 
        ((prevAvg * prevTotal) + (newAvg * newCount)) / totalRequests;
    }
    
    // Error rate (weighted average)
    if (totalRequests > 0) {
      const prevTotal = totalRequests - metrics.server.totalRequests;
      const prevRate = combined.server.errorRate;
      const newRate = metrics.server.errorRate;
      const newCount = metrics.server.totalRequests;
      
      combined.server.errorRate = 
        ((prevRate * prevTotal) + (newRate * newCount)) / totalRequests;
    }

    // Combine context metrics
    combined.context.totalContextRequests += metrics.context.totalContextRequests;
    combined.context.ttlFilesWatched += metrics.context.ttlFilesWatched;
    combined.context.ttlFilesLoaded += metrics.context.ttlFilesLoaded;
    
    // Average context size and relevance (weighted by request count)
    const contextRequests = combined.context.totalContextRequests;
    if (contextRequests > 0) {
      const prevContextTotal = contextRequests - metrics.context.totalContextRequests;
      
      // Average context size
      const prevContextSize = combined.context.averageContextSize;
      const newContextSize = metrics.context.averageContextSize;
      const newContextCount = metrics.context.totalContextRequests;
      
      combined.context.averageContextSize = 
        ((prevContextSize * prevContextTotal) + (newContextSize * newContextCount)) / contextRequests;
      
      // Average relevance score
      const prevRelevance = combined.context.averageRelevanceScore;
      const newRelevance = metrics.context.averageRelevanceScore;
      
      combined.context.averageRelevanceScore = 
        ((prevRelevance * prevContextTotal) + (newRelevance * newContextCount)) / contextRequests;
    }

    // Cache hit rate (weighted average)
    const totalCacheRequests = combined.context.totalContextRequests;
    if (totalCacheRequests > 0) {
      const prevCacheTotal = totalCacheRequests - metrics.context.totalContextRequests;
      const prevHitRate = combined.context.cacheHitRate;
      const newHitRate = metrics.context.cacheHitRate;
      const newCacheCount = metrics.context.totalContextRequests;
      
      combined.context.cacheHitRate = 
        ((prevHitRate * prevCacheTotal) + (newHitRate * newCacheCount)) / totalCacheRequests;
    }

    // Combine performance metrics (sum for additive metrics)
    combined.performance.memoryUsage += metrics.performance.memoryUsage;
    combined.performance.cpuUsage = Math.max(combined.performance.cpuUsage, metrics.performance.cpuUsage);
    combined.performance.diskUsage += metrics.performance.diskUsage;
    combined.performance.networkBytesIn += metrics.performance.networkBytesIn;
    combined.performance.networkBytesOut += metrics.performance.networkBytesOut;
  }
}