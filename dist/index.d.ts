/**
 * AIDe - AI-Assisted Software Engineering System
 * Main application entry point for programmatic usage
 */
import { EventEmitter } from 'events';
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
export declare class AIDe extends EventEmitter {
    private config;
    private projectPath;
    private isInitialized;
    private services;
    constructor(options?: AIDeOptions);
    /**
     * Initialize AIDe for the current project
     */
    initialize(): Promise<void>;
    /**
     * Start all AIDe services
     */
    start(): Promise<void>;
    /**
     * Stop all AIDe services
     */
    stop(): Promise<void>;
    /**
     * Analyze the current codebase
     */
    analyze(options?: {
        incremental?: boolean;
    }): Promise<AnalysisResult>;
    /**
     * Get status of all services
     */
    getServiceStatus(): ServiceStatus[];
    /**
     * Get current configuration
     */
    getConfig(): Config;
    /**
     * Update configuration
     */
    updateConfig(updates: Partial<Config>): void;
    private validateProject;
    private setupDirectories;
    private initializeConfig;
}
/**
 * Factory function to create a AIDe instance
 */
export declare function createAIDe(options?: AIDeOptions): AIDe;
/**
 * Default export for convenience
 */
export default AIDe;
export type { Config } from './config';
export { configManager } from './config';
export { default as logger } from './utils/logger';
//# sourceMappingURL=index.d.ts.map