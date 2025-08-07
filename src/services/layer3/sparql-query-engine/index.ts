/**
 * SPARQL Query Engine Module
 * 
 * Natural language to SPARQL translation with intelligent query generation,
 * optimization, and execution capabilities for RDF knowledge queries.
 */

export { SPARQLQueryEngine } from './SPARQLQueryEngine';
export * from './types';

// Re-export commonly used types for convenience
export type {
  SPARQLEngineConfig,
  SPARQLQueryResponse,
  SPARQLQueryIntent,
  ParsedSPARQLQuery,
  GeneratedSPARQLQuery,
  SPARQLExecutionResult,
  SPARQLEntity,
  SPARQLTriplePattern,
  SPARQLFilter,
  SPARQLError,
  SPARQLMetrics,
  SPARQLQueryPattern,
  OntologyInfo
} from './types';