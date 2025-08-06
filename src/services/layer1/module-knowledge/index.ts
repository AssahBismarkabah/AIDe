/**
 * Module Knowledge Management System
 * 
 * Entry point for the dual-purpose TTL file management system that serves both
 * Neo4j knowledge graph population and direct LLM context enhancement.
 * 
 * This system bridges automated code analysis with developer business context,
 * ensuring knowledge files remain accurate and valuable for both graph queries
 * and LLM interactions.
 */

export { ModuleKnowledgeManager } from './ModuleKnowledgeManager';
export * from './types';

// Re-export commonly used types for convenience
export type {
  ModuleKnowledgeFile,
  ModuleKnowledgeManagerOptions,
  ValidationStatus,
  ConflictResolution,
  BusinessContextEnhancement,
  LLMContextPreview,
  DeveloperTooling,
  ModuleKnowledgeResult,
  BatchOperationResult
} from './types';