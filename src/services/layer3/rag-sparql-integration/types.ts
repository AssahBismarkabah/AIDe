import { Document } from '@langchain/core/documents';
import { RAGEngine } from '../langchain-rag/RAGEngine';
import { SPARQLQueryEngine } from '../sparql-query-engine/SPARQLQueryEngine';
import type { SPARQLQueryResponse } from '../sparql-query-engine/types';
import logger from '../../../utils/logger';

export interface RAGSparqlOptions {
  // If provided, the service will use these engines; otherwise it will create defaults
  ragEngine?: RAGEngine;
  sparqlEngine?: SPARQLQueryEngine;
}

export interface RAGSparqlRequest {
  question: string;
  maxContextDocs?: number;
}

export interface RAGSparqlAnswer {
  question: string;
  answer: string;
  confidence: number;
  contextDocs: number;
  sparql?: {
    query: string;
    explanation?: string;
  };
  rdfSummary?: string;
  metadata?: Record<string, any>;
}

export interface NL2SPARQLTranslator {
  translate(question: string): Promise<string>;
}

export class PassthroughNL2SPARQLTranslator implements NL2SPARQLTranslator {
  // We rely on SPARQLQueryEngine's internal NL2SPARQL generation,
  // so this translator simply returns the original question as a hint.
  async translate(question: string): Promise<string> {
    logger.debug('PassthroughNL2SPARQLTranslator used');
    return question;
  }
}

export function rowsToDocuments(resp: SPARQLQueryResponse, limit = 20): Document[] {
  const docs: Document[] = [];
  const rows = resp.executionResult?.data || [];
  const max = Math.min(limit, rows.length);
  for (let i = 0; i < max; i++) {
    const row = rows[i];
    const content = Object.entries(row)
      .map(([k, v]) => `${k}: ${v.value}${v.datatype ? `^^${v.datatype}` : ''}`)
      .join('\n');
    docs.push(new Document({
      pageContent: `SPARQL Row ${i + 1}:\n${content}`,
      metadata: {
        source: 'rdf/sparql',
        rowIndex: i,
        queryId: resp.metadata?.queryId,
        intent: resp.interpretedQuery?.intent,
      }
    }));
  }
  // If no rows, still include the formatted response as a single doc for context
  if (docs.length === 0 && resp.formattedResponse) {
    docs.push(new Document({
      pageContent: `SPARQL Results Summary:\n${resp.formattedResponse}`,
      metadata: {
        source: 'rdf/sparql-summary',
        queryId: resp.metadata?.queryId,
        intent: resp.interpretedQuery?.intent,
      }
    }));
  }
  return docs;
}
