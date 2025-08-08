/**
 * MCP Analysis Integration Service
 * 
 * Integrates the automatic analysis system with the MCP server to provide
 * seamless TTL context loading and real-time updates.
 */

import { EventEmitter } from 'events';
import logger from '../../utils/logger';
import { EnhancedMCPServer } from './EnhancedMCPServer';
import { AutomaticAnalysisService } from '../automatic-analysis/AutomaticAnalysisService';
import { KnowledgeGraphPopulator } from '../project-analysis/KnowledgeGraphPopulator';
import { EnhancedRDFGenerator } from '../layer1/rdf-generator/EnhancedRDFGenerator';
import { ConcreteInformationExtractor } from '../layer1/rdf-generator/ConcreteInformationExtractor';
import { Layer3AIService } from '../layer3/index';
import { HybridStorageManager } from '../layer2/hybrid-storage/HybridStorageManager';
import {
  EnhancedMCPServerConfig,
  MCPAnalysisIntegrationConfig,
  IntegrationMetrics
} from './types';

/**
 * MCP Analysis Integration Service
 * 
 * Coordinates between automatic analysis and MCP server for seamless
 * TTL context loading and real-time updates.
 */
export class MCPAnalysisIntegration extends EventEmitter {
  private config: MCPAnalysisIntegrationConfig;
  private enhancedMCPServer: EnhancedMCPServer;
  private automaticAnalysisService: AutomaticAnalysisService;
  private knowledgeGraphPopulator: KnowledgeGraphPopulator;
  private _rdfGenerator: EnhancedRDFGenerator;
  private _informationExtractor: ConcreteInformationExtractor;
  
  private metrics: IntegrationMetrics;
  private isRunning: boolean = false;
  private syncInterval?: NodeJS.Timeout;

  constructor(
    config: MCPAnalysisIntegrationConfig,
    layer3Service: Layer3AIService,
    hybridStorage: HybridStorageManager,
    automaticAnalysisService: AutomaticAnalysisService,
    knowledgeGraphPopulator: KnowledgeGraphPopulator,
    rdfGenerator: EnhancedRDFGenerator,
    informationExtractor: ConcreteInformationExtractor
  ) {
    super();
    
    this.config = config;
    this.automaticAnalysisService = automaticAnalysisService;
    this.knowledgeGraphPopulator = knowledgeGraphPopulator;
    this._rdfGenerator = rdfGenerator;
    this._informationExtractor = informationExtractor;
    
    // Create enhanced MCP server configuration
    const enhancedConfig: EnhancedMCPServerConfig = {
      mcpServer: config.mcpServer,
      ttlContextLoader: config.ttlContextLoader,
      integration: {
        autoRefreshInterval: config.autoRefreshInterval || 300000, // 5 minutes
        performanceOptimization: config.performanceOptimization || true,
        healthCheckInterval: config.healthCheckInterval || 60000 // 1 minute
      }
    };
    
    // Initialize enhanced MCP server
    this.enhancedMCPServer = new EnhancedMCPServer(
      enhancedConfig,
      layer3Service,
      hybridStorage,
      knowledgeGraphPopulator,
      this._rdfGenerator,
      this._informationExtractor
    );
    
    this.metrics = this.initializeMetrics();
    this.setupEventHandlers();
    
    logger.info('MCPAnalysisIntegration initialized', {
      autoRefreshInterval: enhancedConfig.integration.autoRefreshInterval,
      performanceOptimization: enhancedConfig.integration.performanceOptimization
    });
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): IntegrationMetrics {
    return {
      integration: {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        lastSyncTime: new Date(),
        averageSyncTime: 0
      },
      analysis: {
        triggeredAnalyses: 0,
        completedAnalyses: 0,
        ttlFilesGenerated: 0,
        knowledgeGraphUpdates: 0
      },
      mcp: {
        contextRequests: 0,
        enhancedContextRequests: 0,
        cacheHitRate: 0,
        averageResponseTime: 0
      }
    };
  }

  /**
   * Setup event handlers for integration
   */
  private setupEventHandlers(): void {
    // Handle automatic analysis events
    this.automaticAnalysisService.on('analysis_completed', (event) => {
      this.handleAnalysisCompleted(event);
    });
    
    this.automaticAnalysisService.on('ttl_generated', (event) => {
      this.handleTTLGenerated(event);
    });
    
    // Handle knowledge graph events
    this.knowledgeGraphPopulator.on('population_completed', (event) => {
      this.handleKnowledgeGraphUpdate(event);
    });
    
    // Handle MCP server events
    this.enhancedMCPServer.on('ttl_integration_update', (event) => {
      this.handleMCPIntegrationUpdate(event);
    });
  }

  /**
   * Start the integration service
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting MCP Analysis Integration...');
      
      // Start automatic analysis service
      await this.automaticAnalysisService.start();
      
      // Start enhanced MCP server
      await this.enhancedMCPServer.start();
      
      // Start periodic sync if enabled
      if (this.config.autoRefreshInterval && this.config.autoRefreshInterval > 0) {
        this.startPeriodicSync();
      }
      
      this.isRunning = true;
      
      logger.info('MCP Analysis Integration started successfully');
      
    } catch (error) {
      logger.error('Failed to start MCP Analysis Integration', { error });
      throw error;
    }
  }

  /**
   * Stop the integration service
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping MCP Analysis Integration...');
      
      this.isRunning = false;
      
      // Stop periodic sync
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = undefined as any;
      }
      
      // Stop enhanced MCP server
      await this.enhancedMCPServer.stop();
      
      // Stop automatic analysis service
      await this.automaticAnalysisService.stop();
      
      logger.info('MCP Analysis Integration stopped');
      
    } catch (error) {
      logger.error('Failed to stop MCP Analysis Integration', { error });
      throw error;
    }
  }

  /**
   * Trigger manual sync between analysis and MCP server
   */
  async triggerSync(): Promise<void> {
    const startTime = Date.now();
    this.metrics.integration.totalSyncs++;
    
    try {
      logger.info('Triggering manual sync...');
      
      // Refresh TTL context in MCP server
      await this.enhancedMCPServer.refreshTTLContext();
      
      // Update metrics
      const syncTime = Date.now() - startTime;
      this.updateSyncMetrics(syncTime, true);
      
      // Emit sync event
      this.emit('sync_completed', {
        type: 'manual_sync',
        success: true,
        duration: syncTime,
        timestamp: Date.now()
      });
      
      logger.info('Manual sync completed', { duration: syncTime });
      
    } catch (error) {
      this.updateSyncMetrics(Date.now() - startTime, false);
      logger.error('Manual sync failed', { error });
      
      this.emit('sync_failed', {
        type: 'manual_sync',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      });
      
      throw error;
    }
  }

  /**
   * Get integration status
   */
  getStatus(): {
    isRunning: boolean;
    services: Record<string, any>;
    metrics: IntegrationMetrics;
    lastSync: Date;
  } {
    const mcpStatus = this.enhancedMCPServer.getStatus();
    const analysisStatus = this.automaticAnalysisService.getStatus();
    
    return {
      isRunning: this.isRunning,
      services: {
        mcpServer: mcpStatus,
        automaticAnalysis: analysisStatus
      },
      metrics: this.metrics,
      lastSync: this.metrics.integration.lastSyncTime
    };
  }

  /**
   * Get integration metrics
   */
  getMetrics(): IntegrationMetrics {
    // Update MCP metrics from enhanced server
    const mcpMetrics = this.enhancedMCPServer.getMetrics();
    this.metrics.mcp.contextRequests = mcpMetrics.server.totalRequests;
    this.metrics.mcp.enhancedContextRequests = mcpMetrics.server.enhancedContextRequests;
    this.metrics.mcp.averageResponseTime = mcpMetrics.server.averageResponseTime;
    
    // Calculate cache hit rate
    const totalCacheRequests = mcpMetrics.ttlIntegration.contextCacheHits + mcpMetrics.ttlIntegration.contextCacheMisses;
    this.metrics.mcp.cacheHitRate = totalCacheRequests > 0 
      ? mcpMetrics.ttlIntegration.contextCacheHits / totalCacheRequests 
      : 0;
    
    return { ...this.metrics };
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    try {
      const mcpHealth = await this.enhancedMCPServer.healthCheck();
      // Get analysis service status
      const analysisStatus = this.automaticAnalysisService.getStatus();
      const analysisHealth = {
        status: analysisStatus.isActive ? 'healthy' as const : 'unhealthy' as const,
        details: {
          isActive: analysisStatus.isActive,
          isInitialized: analysisStatus.isInitialized,
          totalAnalyses: analysisStatus.totalAnalyses
        }
      };
      
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      // Determine overall status
      if (mcpHealth.status === 'unhealthy' || analysisHealth.status === 'unhealthy') {
        overallStatus = 'unhealthy';
      } else if (mcpHealth.status === 'degraded') {
        overallStatus = 'degraded';
      }
      
      return {
        status: overallStatus,
        details: {
          integration: {
            isRunning: this.isRunning,
            lastSync: this.metrics.integration.lastSyncTime,
            syncSuccessRate: this.calculateSyncSuccessRate()
          },
          mcpServer: mcpHealth,
          automaticAnalysis: analysisHealth
        }
      };
      
    } catch (error) {
      logger.error('Integration health check failed', { error });
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Handle analysis completed event
   */
  private handleAnalysisCompleted(event: any): void {
    this.metrics.analysis.completedAnalyses++;
    
    logger.debug('Analysis completed, triggering MCP sync', {
      projectPath: event.projectPath,
      analysisId: event.analysisId
    });
    
    // Trigger automatic sync
    this.triggerSync().catch(error => {
      logger.error('Auto-sync after analysis failed', { error });
    });
    
    this.emit('integration_event', {
      type: 'analysis_completed',
      data: event,
      timestamp: Date.now()
    });
  }

  /**
   * Handle TTL generated event
   */
  private handleTTLGenerated(event: any): void {
    this.metrics.analysis.ttlFilesGenerated++;
    
    logger.debug('TTL file generated', {
      filePath: event.filePath,
      module: event.module
    });
    
    this.emit('integration_event', {
      type: 'ttl_generated',
      data: event,
      timestamp: Date.now()
    });
  }

  /**
   * Handle knowledge graph update event
   */
  private handleKnowledgeGraphUpdate(event: any): void {
    this.metrics.analysis.knowledgeGraphUpdates++;
    
    logger.debug('Knowledge graph updated', {
      entitiesCreated: event.entitiesCreated,
      relationshipsCreated: event.relationshipsCreated
    });
    
    this.emit('integration_event', {
      type: 'knowledge_graph_updated',
      data: event,
      timestamp: Date.now()
    });
  }

  /**
   * Handle MCP integration update event
   */
  private handleMCPIntegrationUpdate(event: any): void {
    logger.debug('MCP integration update', {
      type: event.type,
      data: event.data
    });
    
    this.emit('integration_event', {
      type: 'mcp_integration_update',
      data: event,
      timestamp: Date.now()
    });
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    this.syncInterval = setInterval(async () => {
      try {
        await this.triggerSync();
      } catch (error) {
        logger.error('Periodic sync failed', { error });
      }
    }, this.config.autoRefreshInterval);
    
    logger.info('Periodic sync started', {
      interval: this.config.autoRefreshInterval
    });
  }

  /**
   * Update sync metrics
   */
  private updateSyncMetrics(syncTime: number, success: boolean): void {
    if (success) {
      this.metrics.integration.successfulSyncs++;
    } else {
      this.metrics.integration.failedSyncs++;
    }
    
    this.metrics.integration.lastSyncTime = new Date();
    
    // Update average sync time
    const totalSyncs = this.metrics.integration.totalSyncs;
    this.metrics.integration.averageSyncTime =
      (this.metrics.integration.averageSyncTime * (totalSyncs - 1) + syncTime) / totalSyncs;
  }

  /**
   * Calculate sync success rate
   */
  private calculateSyncSuccessRate(): number {
    const total = this.metrics.integration.totalSyncs;
    return total > 0 ? this.metrics.integration.successfulSyncs / total : 0;
  }
}