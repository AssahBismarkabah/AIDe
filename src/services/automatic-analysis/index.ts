/**
 * Automatic Analysis System
 * 
 * Entry point for the automatic project analysis and TTL generation system.
 * Provides a unified interface for all automatic analysis components.
 */

export { NPMHookManager } from './NPMHookManager';
export { InstallationDetector } from './InstallationDetector';
export { TriggerOrchestrator } from './TriggerOrchestrator';
export { AutomaticAnalysisService } from './AutomaticAnalysisService';

export * from './types';

// Re-export commonly used types
export type {
  NPMHookConfig,
  NPMHookEvent,
  PackageChange,
  InstallationEvent,
  DetectorConfig,
  TriggerConfig,
  AnalysisTrigger,
  TriggerResult,
  AutomaticAnalysisConfig,
  AutomaticAnalysisStatus,
  AutomaticAnalysisOptions
} from './types';