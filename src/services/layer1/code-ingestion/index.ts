/**
 * Code Ingestion Service - Main Export
 * Provides Git integration, file watching, and batch processing for code analysis
 */

export { default as CodeIngestionService } from './CodeIngestionService';
export { default as GitService } from './GitService';
export { default as FileWatcher } from './FileWatcher';
export { default as IngestionJobQueue } from './IngestionJobQueue';

export * from './types';