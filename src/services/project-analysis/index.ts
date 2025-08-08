/**
 * Project Analysis Services - Entry Point
 * 
 * Exports all project analysis services including automatic analysis workflow,
 * knowledge graph population, and project analysis service.
 */

export { ProjectAnalysisService } from './ProjectAnalysisService';
export { AutoAnalysisWorkflow } from './AutoAnalysisWorkflow';
export { KnowledgeGraphPopulator } from './KnowledgeGraphPopulator';

export type {
  ProjectAnalysisConfig,
  ProjectAnalysisResult
} from './ProjectAnalysisService';

export type {
  AutoAnalysisConfig,
  ConcreteInformation,
  EnhancedAnalysisResult
} from './AutoAnalysisWorkflow';

export type {
  KnowledgeGraphConfig,
  PopulationResult,
  PopulationError,
  PopulationStatistics,
  ModuleEntity,
  CodeEntity,
  EntityRelationship
} from './KnowledgeGraphPopulator';