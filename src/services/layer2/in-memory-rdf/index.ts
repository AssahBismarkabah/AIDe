/**
 * In-Memory RDF Store - Index
 * 
 * Exports all components of the In-Memory RDF Store system
 * for high-performance RDF storage optimized for LLM queries and MCP context.
 */

// Main Store
export { default as InMemoryRDFStore } from './InMemoryRDFStore';

// Types and Interfaces
export * from './types';

// Default configuration
export { defaultInMemoryRDFConfig } from './types';