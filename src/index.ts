/**
 * AIDe - AI-Assisted Software Engineering System
 * Main application entry point for programmatic usage
 */

import { EventEmitter } from 'events';
import logger from './utils/logger';
import { configManager } from './config';
import type { Config } from './config';

export interface AIDeOptions {
  projectPath?: string;
  config?: Partial<Config>;
  autoStart?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

export interface AnalysisResult {
  success: boolean;
  timestamp: Date;
  filesAnalyzed: number;
  nodesCreated: number;
  relationshipsCreated: number;
  errors?: string[];
}

export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error' | 'starting' | 'stopping';
  health: 'healthy' | 'unhealthy' | 'unknown';
  uptime?: number | undefined;
  lastCheck: Date;
}

/**
 * Main AIDe class for programmatic usage
 */
export class AIDe extends EventEmitter {
  private config: Config;
  private projectPath: string;
  private isInitialized: boolean = false;
  private services: Map<string, ServiceStatus> = new Map();

  constructor(options: AIDeOptions = {}) {
    super();
    
    this.projectPath = options.projectPath || process.cwd();
    this.config = configManager.getConfig();
    
    // Override config with provided options
    if (options.config) {
      this.config = { ...this.config, ...options.config };
    }
    
    // Set log level if provided
    if (options.logLevel) {
      logger.level = options.logLevel;
    }
    
    logger.info('AIDe instance created', { projectPath: this.projectPath });
    
    // Auto-start if requested
    if (options.autoStart) {
      this.initialize().catch(error => {
        logger.error('Failed to auto-start AIDe:', error);
        this.emit('error', error);
      });
    }
  }

  /**
   * Initialize AIDe for the current project
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing AIDe...');
      
      // Validate project structure
      await this.validateProject();
      
      // Setup project directories
      await this.setupDirectories();
      
      // Initialize configuration
      await this.initializeConfig();
      
      this.isInitialized = true;
      logger.info('AIDe initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      logger.error('Failed to initialize AIDe:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Start all AIDe services
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      logger.info('Starting AIDe services...');
      this.emit('starting');
      
      // This will be implemented when Docker services are ready
      // For now, we'll simulate the startup process
      const serviceNames = [
        'neo4j',
        'redis',
        'code-ingestion',
        'ast-analyzer',
        'rdf-generator',
        'llm-gateway',
        'langchain-rag',
        'code-assistant',
        'mcp-server',
        'api-gateway',
        'web-interface'
      ];
      
      for (const serviceName of serviceNames) {
        this.services.set(serviceName, {
          name: serviceName,
          status: 'starting',
          health: 'unknown',
          lastCheck: new Date()
        });
      }
      
      // Simulate startup delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mark services as running (this will be replaced with actual Docker checks)
      for (const [name, status] of this.services) {
        this.services.set(name, {
          ...status,
          status: 'running',
          health: 'healthy',
          uptime: 0,
          lastCheck: new Date()
        });
      }
      
      logger.info('All AIDe services started successfully');
      this.emit('started');
      
    } catch (error) {
      logger.error('Failed to start AIDe services:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop all AIDe services
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping AIDe services...');
      this.emit('stopping');
      
      // Update service statuses
      for (const [name, status] of this.services) {
        this.services.set(name, {
          ...status,
          status: 'stopping'
        });
      }
      
      // Simulate shutdown delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mark services as stopped
      for (const [name, status] of this.services) {
        this.services.set(name, {
          ...status,
          status: 'stopped',
          health: 'unknown',
          lastCheck: new Date()
        });
      }
      
      logger.info('All AIDe services stopped');
      this.emit('stopped');
      
    } catch (error) {
      logger.error('Failed to stop AIDe services:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Analyze the current codebase
   */
  async analyze(options: { incremental?: boolean } = {}): Promise<AnalysisResult> {
    if (!this.isInitialized) {
      throw new Error('AIDe must be initialized before analysis');
    }
    
    try {
      logger.info('Starting codebase analysis...', options);
      this.emit('analysisStarted', options);
      
      // This will be implemented in Layer 1 tasks
      // For now, return a mock result
      const result: AnalysisResult = {
        success: true,
        timestamp: new Date(),
        filesAnalyzed: 0,
        nodesCreated: 0,
        relationshipsCreated: 0
      };
      
      logger.info('Analysis completed', result);
      this.emit('analysisCompleted', result);
      
      return result;
      
    } catch (error) {
      logger.error('Analysis failed:', error);
      const result: AnalysisResult = {
        success: false,
        timestamp: new Date(),
        filesAnalyzed: 0,
        nodesCreated: 0,
        relationshipsCreated: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      };
      
      this.emit('analysisError', error);
      return result;
    }
  }

  /**
   * Get status of all services
   */
  getServiceStatus(): ServiceStatus[] {
    return Array.from(this.services.values());
  }

  /**
   * Get current configuration
   */
  getConfig(): Config {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<Config>): void {
    this.config = { ...this.config, ...updates };
    logger.info('Configuration updated');
    this.emit('configUpdated', this.config);
  }

  private async validateProject(): Promise<void> {
    // Basic project validation
    logger.debug('Validating project structure...');
    // This will be expanded in later implementations
  }

  private async setupDirectories(): Promise<void> {
    // Setup required directories
    logger.debug('Setting up project directories...');
    // This will be implemented to create .aaswe directory structure
  }

  private async initializeConfig(): Promise<void> {
    // Initialize configuration files
    logger.debug('Initializing configuration...');
    // This will be implemented to create config files
  }
}

/**
 * Factory function to create a AIDe instance
 */
export function createAIDe(options?: AIDeOptions): AIDe {
  return new AIDe(options);
}

/**
 * Default export for convenience
 */
export default AIDe;

// Re-export types and utilities
export type { Config } from './config';
export { configManager } from './config';
export { default as logger } from './utils/logger';