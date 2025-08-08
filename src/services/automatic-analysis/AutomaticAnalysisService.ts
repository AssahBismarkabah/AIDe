/**
 * Automatic Analysis Service
 * 
 * Main orchestration service for automatic project analysis and TTL generation.
 * Coordinates all automatic analysis components and provides a unified interface.
 */

import { EventEmitter } from 'events';
import logger from '../../utils/logger';
import { TriggerOrchestrator, TriggerConfig } from './TriggerOrchestrator';
import { ProjectAnalysisResult } from '../project-analysis/ProjectAnalysisService';

export interface AutomaticAnalysisConfig {
  projectRoot: string;
  enableAutoTriggers: boolean;
  enableNPMHooks: boolean;
  enableInstallationDetection: boolean;
  enableFileWatching: boolean;
  analysisDelay: number;
  preserveBusinessContext: boolean;
  generateTTL: boolean;
  populateKnowledgeGraph: boolean;
  updateMCPContext: boolean;
}

export interface AutomaticAnalysisStatus {
  isActive: boolean;
  isInitialized: boolean;
  config: AutomaticAnalysisConfig;
  triggerOrchestrator: any;
  lastAnalysis?: Date | undefined;
  totalAnalyses: number;
  successfulAnalyses: number;
  failedAnalyses: number;
}

/**
 * Automatic Analysis Service
 * 
 * Provides a unified interface for automatic project analysis and TTL generation.
 * Manages the complete lifecycle from trigger detection to knowledge graph population.
 */
export class AutomaticAnalysisService extends EventEmitter {
  private config: AutomaticAnalysisConfig;
  private triggerOrchestrator?: TriggerOrchestrator;
  private isInitialized = false;
  private isActive = false;
  private analysisStats = {
    total: 0,
    successful: 0,
    failed: 0
  };

  constructor(config: Partial<AutomaticAnalysisConfig> = {}) {
    super();
    
    this.config = {
      projectRoot: process.cwd(),
      enableAutoTriggers: true,
      enableNPMHooks: true,
      enableInstallationDetection: true,
      enableFileWatching: true,
      analysisDelay: 2000,
      preserveBusinessContext: true,
      generateTTL: true,
      populateKnowledgeGraph: true,
      updateMCPContext: true,
      ...config
    };
  }

  /**
   * Initialize the automatic analysis system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Automatic Analysis Service', {
        projectRoot: this.config.projectRoot,
        enableAutoTriggers: this.config.enableAutoTriggers
      });

      // Initialize trigger orchestrator
      const triggerConfig: Partial<TriggerConfig> = {
        projectRoot: this.config.projectRoot,
        enableNPMHooks: this.config.enableNPMHooks,
        enableInstallationDetection: this.config.enableInstallationDetection,
        enableFileWatching: this.config.enableFileWatching,
        analysisDelay: this.config.analysisDelay
      };

      this.triggerOrchestrator = new TriggerOrchestrator(triggerConfig);
      await this.triggerOrchestrator.initialize();

      // Setup event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      logger.info('Automatic Analysis Service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Automatic Analysis Service', { error });
      throw error;
    }
  }

  /**
   * Start automatic analysis
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isActive) {
      logger.warn('Automatic analysis is already active');
      return;
    }

    try {
      logger.info('Starting automatic analysis');
      
      this.isActive = true;
      this.emit('service_started');
      
      logger.info('Automatic analysis started successfully');

    } catch (error) {
      logger.error('Failed to start automatic analysis', { error });
      this.isActive = false;
      throw error;
    }
  }

  /**
   * Stop automatic analysis
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    try {
      logger.info('Stopping automatic analysis');
      
      this.isActive = false;
      this.emit('service_stopped');
      
      logger.info('Automatic analysis stopped successfully');

    } catch (error) {
      logger.error('Failed to stop automatic analysis', { error });
      throw error;
    }
  }

  /**
   * Manually trigger analysis
   */
  async triggerAnalysis(reason: string = 'manual'): Promise<string> {
    if (!this.triggerOrchestrator) {
      throw new Error('Automatic Analysis Service not initialized');
    }

    logger.info('Manual analysis trigger requested', { reason });
    return await this.triggerOrchestrator.triggerAnalysis(reason, 'high');
  }

  /**
   * Perform initial project analysis (for setup)
   */
  async performInitialAnalysis(): Promise<ProjectAnalysisResult> {
    if (!this.triggerOrchestrator) {
      throw new Error('Automatic Analysis Service not initialized');
    }

    logger.info('Performing initial project analysis');
    
    try {
      const triggerId = await this.triggerOrchestrator.triggerAnalysis('initial_setup', 'high');
      logger.debug('Initial setup analysis triggered', { triggerId });
      
      // Wait for analysis to complete
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Initial analysis timeout'));
        }, 300000); // 5 minute timeout

        const onCompleted = (result: ProjectAnalysisResult) => {
          clearTimeout(timeout);
          this.removeListener('analysis_failed', onFailed);
          resolve(result);
        };

        const onFailed = (event: any) => {
          clearTimeout(timeout);
          this.removeListener('analysis_completed', onCompleted);
          reject(new Error(`Initial analysis failed: ${event.error}`));
        };

        this.once('analysis_completed', onCompleted);
        this.once('analysis_failed', onFailed);
      });

    } catch (error) {
      logger.error('Failed to perform initial analysis', { error });
      throw error;
    }
  }

  /**
   * Get service status
   */
  getStatus(): AutomaticAnalysisStatus {
    return {
      isActive: this.isActive,
      isInitialized: this.isInitialized,
      config: { ...this.config },
      triggerOrchestrator: this.triggerOrchestrator?.getStatus(),
      lastAnalysis: this.triggerOrchestrator?.getStatus().lastAnalysis,
      totalAnalyses: this.analysisStats.total,
      successfulAnalyses: this.analysisStats.successful,
      failedAnalyses: this.analysisStats.failed
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Automatic Analysis Service');

    try {
      // Stop if active
      if (this.isActive) {
        await this.stop();
      }

      // Shutdown trigger orchestrator
      if (this.triggerOrchestrator) {
        await this.triggerOrchestrator.shutdown();
      }

      // Remove all listeners
      this.removeAllListeners();

      this.isInitialized = false;
      logger.info('Automatic Analysis Service shutdown completed');

    } catch (error) {
      logger.error('Error during Automatic Analysis Service shutdown', { error });
      throw error;
    }
  }

  // Private methods

  private setupEventListeners(): void {
    if (!this.triggerOrchestrator) return;

    // Analysis completion events
    this.triggerOrchestrator.on('analysis_completed', (result: ProjectAnalysisResult) => {
      this.analysisStats.total++;
      this.analysisStats.successful++;
      
      logger.info('Automatic analysis completed', {
        analysisId: result.analysisId,
        duration: result.duration,
        analyzedFiles: result.summary.analyzedFiles,
        ttlFilesGenerated: result.summary.ttlFilesGenerated
      });

      this.emit('analysis_completed', result);
    });

    this.triggerOrchestrator.on('analysis_failed', (event: any) => {
      this.analysisStats.total++;
      this.analysisStats.failed++;
      
      logger.error('Automatic analysis failed', {
        analysisId: event.analysisId,
        error: event.error
      });

      this.emit('analysis_failed', event);
    });

    // Trigger events
    this.triggerOrchestrator.on('trigger_queued', (trigger: any) => {
      logger.debug('Analysis trigger queued', {
        triggerId: trigger.id,
        type: trigger.type,
        reason: trigger.reason
      });

      this.emit('trigger_queued', trigger);
    });

    this.triggerOrchestrator.on('trigger_processing', (trigger: any) => {
      logger.debug('Processing analysis trigger', {
        triggerId: trigger.id,
        type: trigger.type
      });

      this.emit('trigger_processing', trigger);
    });

    this.triggerOrchestrator.on('trigger_completed', (event: any) => {
      logger.debug('Analysis trigger completed', {
        triggerId: event.trigger.id,
        success: event.result.success,
        duration: event.result.duration
      });

      this.emit('trigger_completed', event);
    });

    this.triggerOrchestrator.on('trigger_failed', (event: any) => {
      logger.warn('Analysis trigger failed', {
        triggerId: event.trigger.id,
        error: event.error
      });

      this.emit('trigger_failed', event);
    });
  }

  /**
   * Static method to create and initialize service
   */
  static async create(config: Partial<AutomaticAnalysisConfig> = {}): Promise<AutomaticAnalysisService> {
    const service = new AutomaticAnalysisService(config);
    await service.initialize();
    return service;
  }

  /**
   * Static method for quick setup (used by CLI and postinstall)
   */
  static async quickSetup(projectRoot: string = process.cwd()): Promise<{
    service: AutomaticAnalysisService;
    result: ProjectAnalysisResult;
  }> {
    logger.info('Performing quick automatic analysis setup', { projectRoot });

    try {
      // Create and initialize service
      const service = await AutomaticAnalysisService.create({
        projectRoot,
        enableAutoTriggers: true,
        enableNPMHooks: true,
        enableInstallationDetection: true,
        enableFileWatching: true
      });

      // Start the service
      await service.start();

      // Perform initial analysis
      const result = await service.performInitialAnalysis();

      logger.info('Quick setup completed successfully', {
        projectRoot,
        analysisId: result.analysisId,
        analyzedFiles: result.summary.analyzedFiles,
        ttlFilesGenerated: result.summary.ttlFilesGenerated
      });

      return { service, result };

    } catch (error) {
      logger.error('Quick setup failed', { projectRoot, error });
      throw error;
    }
  }
}