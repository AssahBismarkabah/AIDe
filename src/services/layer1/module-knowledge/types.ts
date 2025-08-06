/**
 * Module Knowledge Management System Types
 * 
 * Type definitions for managing dual-purpose TTL files that serve both
 * Neo4j knowledge graph population and direct LLM context enhancement.
 */

export interface ModuleKnowledgeFile {
  filePath: string;
  modulePath: string;
  content: string;
  checksum: string;
  lastModified: Date;
  generatedAt: Date;
  version: string;
  businessContextEnhanced: boolean;
  validationStatus: ValidationStatus;
}

export interface ValidationStatus {
  isValid: boolean;
  syntaxErrors: ValidationError[];
  semanticWarnings: ValidationWarning[];
  businessContextCompleteness: number; // 0-100 percentage
  lastValidated: Date;
}

export interface ValidationError {
  type: 'syntax' | 'schema' | 'reference';
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning';
  suggestion?: string;
}

export interface ValidationWarning {
  type: 'incomplete_context' | 'placeholder_detected' | 'best_practice';
  message: string;
  suggestion: string;
  line?: number;
}

export interface BusinessContextEnhancement {
  domain?: string;
  businessRules?: string[];
  useCases?: string[];
  stakeholders?: string[];
  qualityAttributes?: QualityAttribute[];
  constraints?: string[];
  customProperties?: Record<string, string>;
}

export interface QualityAttribute {
  name: string;
  target: string;
  measurement: string;
}

export interface ConflictResolution {
  conflictId: string;
  filePath: string;
  conflictType: 'concurrent_edit' | 'code_vs_manual' | 'merge_conflict';
  baseContent: string;
  localChanges: string;
  remoteChanges: string;
  resolvedContent?: string;
  resolution: 'auto' | 'manual' | 'pending';
  timestamp: Date;
}

export interface KnowledgeFileUpdate {
  filePath: string;
  updateType: 'code_change' | 'manual_edit' | 'business_enhancement';
  changes: FileChange[];
  preserveBusinessContext: boolean;
  timestamp: Date;
  author?: string;
}

export interface FileChange {
  type: 'added' | 'modified' | 'removed';
  section: 'technical' | 'business' | 'documentation';
  property: string;
  oldValue?: string;
  newValue?: string;
  line?: number;
}

export interface LLMContextPreview {
  filePath: string;
  relevantFiles: string[];
  contextContent: string;
  tokenCount: number;
  relevanceScore: number;
  businessContextRatio: number;
  technicalContextRatio: number;
}

export interface ModuleKnowledgeManagerOptions {
  autoValidate: boolean;
  preserveBusinessContext: boolean;
  enableConflictResolution: boolean;
  enableLLMPreview: boolean;
  validationLevel: 'strict' | 'moderate' | 'lenient';
  backupEnabled: boolean;
  backupRetention: number; // days
}

export interface KnowledgeGraphUpdate {
  filePath: string;
  updateType: 'full' | 'incremental';
  affectedNodes: string[];
  affectedRelationships: string[];
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface MCPContextUpdate {
  filePath: string;
  contextId: string;
  updateType: 'refresh' | 'invalidate';
  affectedContext: string[];
  timestamp: Date;
  success: boolean;
}

export interface DeveloperTooling {
  enhancementSuggestions: EnhancementSuggestion[];
  completionStatus: CompletionStatus;
  impactAnalysis: ImpactAnalysis;
}

export interface EnhancementSuggestion {
  type: 'business_domain' | 'business_rules' | 'use_cases' | 'documentation';
  priority: 'high' | 'medium' | 'low';
  suggestion: string;
  example?: string;
  property: string;
  line?: number;
}

export interface CompletionStatus {
  businessDomain: boolean;
  businessRules: boolean;
  useCases: boolean;
  methodDocumentation: number; // percentage
  classDocumentation: number; // percentage
  overallCompleteness: number; // percentage
}

export interface ImpactAnalysis {
  llmContextImpact: 'high' | 'medium' | 'low';
  graphQueryImpact: 'high' | 'medium' | 'low';
  affectedFiles: string[];
  dependentModules: string[];
  estimatedBenefit: string;
}

export interface BackupMetadata {
  filePath: string;
  backupPath: string;
  timestamp: Date;
  reason: 'auto_update' | 'manual_edit' | 'conflict_resolution';
  checksum: string;
}

export interface SyncStatus {
  filePath: string;
  lastSync: Date;
  syncType: 'knowledge_graph' | 'mcp_context' | 'both';
  status: 'success' | 'failed' | 'pending';
  error?: string;
  retryCount: number;
}

// Event types for the management system
export type KnowledgeFileEvent = 
  | { type: 'file_created'; payload: ModuleKnowledgeFile }
  | { type: 'file_updated'; payload: KnowledgeFileUpdate }
  | { type: 'file_validated'; payload: ValidationStatus }
  | { type: 'conflict_detected'; payload: ConflictResolution }
  | { type: 'business_context_enhanced'; payload: BusinessContextEnhancement }
  | { type: 'sync_completed'; payload: SyncStatus }
  | { type: 'backup_created'; payload: BackupMetadata };

// Result types
export interface ModuleKnowledgeResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
  metadata?: Record<string, any>;
}

export interface BatchOperationResult {
  totalFiles: number;
  successful: number;
  failed: number;
  errors: Array<{ filePath: string; error: string }>;
  warnings: Array<{ filePath: string; warning: string }>;
  duration: number;
}