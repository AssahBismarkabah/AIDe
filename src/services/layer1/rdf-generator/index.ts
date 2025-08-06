/**
 * RDF Generator Module
 * 
 *  RDF generation system for creating .module-knowledge.ttl files
 * from AST analysis results, optimized for both Neo4j ingestion and LLM consumption.
 */

export { RDFGenerator } from './RDFGenerator';
export { RDFValidator } from './RDFValidator';
export { RDFService } from './RDFService';

export * from './types';
export * from './ontology';

// Re-export commonly used types for convenience
export type {
  ModuleKnowledge,
  RDFGenerationOptions,
  RDFGenerationResult,
  RDFValidationResult,
  ClassKnowledge,
  MethodKnowledge,
  FunctionKnowledge,
  TTLFileMetadata
} from './types';

// Re-export ontology constants
export {
  RDF_NAMESPACES,
  ONTOLOGY_CLASSES,
  ONTOLOGY_PROPERTIES,
  BUSINESS_CONTEXT_PLACEHOLDERS,
  NEO4J_OPTIMIZATION
} from './ontology';