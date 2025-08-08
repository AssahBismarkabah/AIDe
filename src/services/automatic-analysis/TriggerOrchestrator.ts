/**
 * Trigger Orchestrator
 * 
 * Orchestrates automatic project analysis triggers from various sources
 * including NPM hooks, file system changes, and manual triggers.
 */

import { EventEmitter } from 'events';
import logger from '../../utils/logger';
import { NPMHookManager, NPMHookEvent } from './NPMHookManager';
import { InstallationDetector, InstallationEvent } from './InstallationDetector';
import { ProjectAnalysisService } from '../project-analysis/ProjectAnalysisService';

export interface TriggerConfig {
  projectRoot: string;
  enableNPMHooks: boolean;
  enableInstallationDetection: boolean;
  enableFileWatching: boolean;
  analysisDelay: number;
  maxConcurrentAnalyses: number;
  cooldownPeriod: number; // Minimum time between analyses in ms
}

export interface AnalysisTrigger {
  id: string;
  type: 'npm_hook' | 'installation' | 'file_change' | 'manual' | 'api';
  timestamp: Date;
  source: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  metadata?: any;
}

export interface TriggerResult {
  triggerId: string;
  success: boolean;
  analysisId?: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  error?: string;
}

/**
 * Trigger Orchestrator
 * 
 * Central coordinator for all automatic analysis triggers.
 * Manages trigger sources, queuing, and execution coordination.
 */
export class TriggerOrchestrator extends EventEmitter {
  private config: TriggerConfig;
  private npmHookManager?: NPMHookManager;
  private installationDetector?: InstallationDetector;
  private projectAnalysisService?: ProjectAnalysisService;
  private isInitialized = false;
  private triggerQueue: AnalysisTrigger[] = [];
  private activeTriggers = new Set<string>();
  private lastAnalysisTime?: Date;
  private triggerHistory: TriggerResult[] = [];

  constructor(config: Partial<TriggerConfig> = {}) {
    super();
    
    this.config = {
      projectRoot: process.cwd(),
      enableNPMHooks: true,
      enableInstallationDetection: true,
      enableFileWatching: true,
      analysisDelay: 2000,
      maxConcurrentAnalyses: 1,
      cooldownPeriod: 10000, // 10 seconds
      ...config
    };
  }

  /**
   * Initialize the trigger orchestrator
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Trigger Orchestrator', {
        projectRoot: this.config.projectRoot,
        enableNPMHooks: this.config.enableNPMHooks,
        enableInstallationDetection: this.config.enableInstallationDetection
      });

      // Initialize project analysis service
      this.projectAnalysisService = new ProjectAnalysisService({
        rootPath: this.config.projectRoot,
        generateTTL: true,
        enableWatching: this.config.enableFileWatching,
        preserveBusinessContext: true
      });
      await this.projectAnalysisService.initialize();

      // Initialize NPM hook manager
      if (this.config.enableNPMHooks) {
        this.npmHookManager = new NPMHookManager({
          projectRoot: this.config.projectRoot,
          analysisDelay: this.config.analysisDelay
        });
        await this.npmHookManager.initialize();
        this.setupNPMHookListeners();
      }

      // Initialize installation detector
      if (this.config.enableInstallationDetection) {
        this.installationDetector = new InstallationDetector({
          projectRoot: this.config.projectRoot,
          debounceDelay: this.config.analysisDelay
        });
        await this.installationDetector.startMonitoring();
        this.setupInstallationDetectorListeners();
      }

      // Setup project analysis service listeners
      this.setupProjectAnalysisListeners();

      // Start processing trigger queue
      this.startTriggerProcessing();

      this.isInitialized = true;
      logger.info('Trigger Orchestrator initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Trigger Orchestrator', { error });
      throw error;
    }
  }

  /**
   * Manually trigger analysis
   */
  async triggerAnalysis(
    reason: string = 'manual',
    priority: AnalysisTrigger['priority'] = 'medium',
    metadata?: any
  ): Promise<string> {
    const trigger: AnalysisTrigger = {
      id: this.generateTriggerId(),
      type: 'manual',
      timestamp: new Date(),
      source: 'manual',
      reason,
      priority,
      metadata
    };

    logger.info('Manual analysis trigger requested', {
      triggerId: trigger.id,
      reason,
      priority
    });

    this.queueTrigger(trigger);
    return trigger.id;
  }

  /**
   * Get trigger status and statistics
   */
  getStatus(): {
    isInitialized: boolean;
    config: TriggerConfig;
    queueLength: number;
    activeTriggers: number;
    lastAnalysis?: Date | undefined;
    recentTriggers: TriggerResult[];
  } {
    return {
      isInitialized: this.isInitialized,
      config: { ...this.config },
      queueLength: this.triggerQueue.length,
      activeTriggers: this.activeTriggers.size,
      lastAnalysis: this.lastAnalysisTime,
      recentTriggers: this.triggerHistory.slice(-10)
    };
  }

  /**
   * Shutdown the orchestrator
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Trigger Orchestrator');

    try {
      // Stop NPM hook manager
      if (this.npmHookManager) {
        await this.npmHookManager.removeHooks();
      }

      // Stop installation detector
      if (this.installationDetector) {
        await this.installationDetector.stopMonitoring();
      }

      // Shutdown project analysis service
      if (this.projectAnalysisService) {
        await this.projectAnalysisService.shutdown();
      }

      // Clear queues and active triggers
      this.triggerQueue = [];
      this.activeTriggers.clear();

      this.isInitialized = false;
      logger.info('Trigger Orchestrator shutdown completed');

    } catch (error) {
      logger.error('Error during Trigger Orchestrator shutdown', { error });
      throw error;
    }
  }

  // Private methods

  private setupNPMHookListeners(): void {
    if (!this.npmHookManager) return;

    this.npmHookManager.on('analysis_triggered', (event: NPMHookEvent) => {
      const trigger: AnalysisTrigger = {
        id: this.generateTriggerId(),
        type: 'npm_hook',
        timestamp: event.timestamp,
        source: `npm_${event.triggeredBy}`,
        reason: `NPM ${event.type} hook triggered`,
        priority: 'high',
        metadata: event
      };

      logger.debug('NPM hook trigger received', { trigger });
      this.queueTrigger(trigger);
    });
  }

  private setupInstallationDetectorListeners(): void {
    if (!this.installationDetector) return;

    this.installationDetector.on('installation_detected', (event: InstallationEvent) => {
      if (!event.triggerAnalysis) {
        logger.debug('Installation detected but analysis not triggered', {
          type: event.type,
          changeCount: event.changes.length
        });
        return;
      }

      const trigger: AnalysisTrigger = {
        id: this.generateTriggerId(),
        type: 'installation',
        timestamp: event.timestamp,
        source: `${event.packageManager}_${event.type}`,
        reason: `Package ${event.type}: ${event.changes.length} changes`,
        priority: this.determinePriority(event),
        metadata: event
      };

      logger.debug('Installation trigger received', { trigger });
      this.queueTrigger(trigger);
    });
  }

  private setupProjectAnalysisListeners(): void {
    if (!this.projectAnalysisService) return;

    this.projectAnalysisService.on('analysisCompleted', (result) => {
      logger.info('Analysis completed', {
        analysisId: result.analysisId,
        duration: result.duration,
        analyzedFiles: result.summary.analyzedFiles
      });

      this.lastAnalysisTime = result.endTime;
      this.emit('analysis_completed', result);
    });

    this.projectAnalysisService.on('analysisFailed', (event) => {
      logger.error('Analysis failed', {
        analysisId: event.analysisId,
        error: event.error
      });

      this.emit('analysis_failed', event);
    });
  }

  private queueTrigger(trigger: AnalysisTrigger): void {
    // Check cooldown period
    if (this.lastAnalysisTime && this.isInCooldownPeriod()) {
      logger.debug('Trigger queued due to cooldown period', {
        triggerId: trigger.id,
        cooldownRemaining: this.getCooldownRemaining()
      });
    }

    // Add to queue with priority sorting
    this.triggerQueue.push(trigger);
    this.triggerQueue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    this.emit('trigger_queued', trigger);
    logger.debug('Trigger queued', {
      triggerId: trigger.id,
      queueLength: this.triggerQueue.length,
      priority: trigger.priority
    });
  }

  private startTriggerProcessing(): void {
    // Process triggers every second
    setInterval(() => {
      this.processTriggerQueue();
    }, 1000);
  }

  private async processTriggerQueue(): Promise<void> {
    if (this.triggerQueue.length === 0) {
      return;
    }

    // Check if we can process more triggers
    if (this.activeTriggers.size >= this.config.maxConcurrentAnalyses) {
      return;
    }

    // Check cooldown period
    if (this.isInCooldownPeriod()) {
      return;
    }

    // Get next trigger
    const trigger = this.triggerQueue.shift();
    if (!trigger) {
      return;
    }

    // Process trigger
    await this.processTrigger(trigger);
  }

  private async processTrigger(trigger: AnalysisTrigger): Promise<void> {
    const startTime = new Date();
    this.activeTriggers.add(trigger.id);

    logger.info('Processing trigger', {
      triggerId: trigger.id,
      type: trigger.type,
      reason: trigger.reason,
      priority: trigger.priority
    });

    try {
      this.emit('trigger_processing', trigger);

      // Execute analysis
      const analysisResult = await this.projectAnalysisService!.analyzeProject();

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const result: TriggerResult = {
        triggerId: trigger.id,
        success: true,
        analysisId: analysisResult.analysisId,
        startTime,
        endTime,
        duration
      };

      this.triggerHistory.push(result);
      this.emit('trigger_completed', { trigger, result });

      logger.info('Trigger processed successfully', {
        triggerId: trigger.id,
        analysisId: analysisResult.analysisId,
        duration
      });

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const result: TriggerResult = {
        triggerId: trigger.id,
        success: false,
        startTime,
        endTime,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.triggerHistory.push(result);
      this.emit('trigger_failed', { trigger, result, error });

      logger.error('Trigger processing failed', {
        triggerId: trigger.id,
        error,
        duration
      });

    } finally {
      this.activeTriggers.delete(trigger.id);
    }
  }

  private isInCooldownPeriod(): boolean {
    if (!this.lastAnalysisTime) {
      return false;
    }

    const timeSinceLastAnalysis = Date.now() - this.lastAnalysisTime.getTime();
    return timeSinceLastAnalysis < this.config.cooldownPeriod;
  }

  private getCooldownRemaining(): number {
    if (!this.lastAnalysisTime) {
      return 0;
    }

    const timeSinceLastAnalysis = Date.now() - this.lastAnalysisTime.getTime();
    return Math.max(0, this.config.cooldownPeriod - timeSinceLastAnalysis);
  }

  private determinePriority(event: InstallationEvent): AnalysisTrigger['priority'] {
    // High priority for new package installations
    if (event.type === 'package_installed') {
      return 'high';
    }

    // Medium priority for updates
    if (event.type === 'package_updated') {
      return 'medium';
    }

    // Low priority for other changes
    return 'low';
  }

  private generateTriggerId(): string {
    return `trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}