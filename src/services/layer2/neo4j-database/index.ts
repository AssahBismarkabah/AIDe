/**
 * Neo4j Database Service - Entry Point
 * 
 * Exports all Neo4j database integration components including
 * the main service, types, and utility functions.
 */

export { Neo4jDatabaseService } from './Neo4jDatabaseService';
export * from './types';

// Re-export commonly used types for convenience
export type {
  Neo4jConfig,
  IngestionResult,
  BatchIngestionResult,
  ValidationResult,
  QueryPerformance,
  HealthStatus,
  DatabaseMetrics
} from './types';