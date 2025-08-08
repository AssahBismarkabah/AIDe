/**
 * Types for Automatic Analysis System
 */

export interface AutomaticAnalysisEvent {
  id: string;
  type: 'trigger' | 'analysis' | 'completion' | 'error';
  timestamp: Date;
  source: string;
  data: any;
}

export interface AnalysisMetrics {
  totalTriggers: number;
  successfulAnalyses: number;
  failedAnalyses: number;
  averageDuration: number;
  lastAnalysis?: Date;
  triggerSources: Record<string, number>;
}

export interface SystemHealth {
  isHealthy: boolean;
  components: {
    npmHooks: 'healthy' | 'warning' | 'error';
    installationDetector: 'healthy' | 'warning' | 'error';
    triggerOrchestrator: 'healthy' | 'warning' | 'error';
    projectAnalysis: 'healthy' | 'warning' | 'error';
  };
  issues: string[];
  recommendations: string[];
}

export interface AutomaticAnalysisOptions {
  projectRoot?: string;
  enableAutoTriggers?: boolean;
  enableNPMHooks?: boolean;
  enableInstallationDetection?: boolean;
  enableFileWatching?: boolean;
  analysisDelay?: number;
  preserveBusinessContext?: boolean;
  generateTTL?: boolean;
  populateKnowledgeGraph?: boolean;
  updateMCPContext?: boolean;
}

export * from './NPMHookManager';
export * from './InstallationDetector';
export * from './TriggerOrchestrator';
export * from './AutomaticAnalysisService';