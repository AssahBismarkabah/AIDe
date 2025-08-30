import { Document } from '@langchain/core/documents';
import logger from '../../../utils/logger';
import { RAGEngine } from '../langchain-rag/RAGEngine';
import type { QueryContext, RAGConfig } from '../langchain-rag/types';
import { SPARQLQueryEngine } from '../sparql-query-engine/SPARQLQueryEngine';
import type { SPARQLEngineConfig, SPARQLQueryResponse } from '../sparql-query-engine/types';
import { InMemoryRDFStore } from '../../layer2/in-memory-rdf';
import { PassthroughNL2SPARQLTranslator, RAGSparqlRequest, RAGSparqlAnswer, RAGSparqlOptions, rowsToDocuments } from './types';

/**
 * RAGSparqlService orchestrates: NL question -> SPARQL over RDF -> RAG answer
 */
export class RAGSparqlService {
  private rag: RAGEngine;
  private sparql: SPARQLQueryEngine;

  constructor(options: RAGSparqlOptions = {}) {
    // Initialize SPARQL engine
    if (options.sparqlEngine) {
      this.sparql = options.sparqlEngine;
    } else {
      const rdfStore = new InMemoryRDFStore({
        persistence: { enabled: false }
      } as any);
      const sparqlConfig: SPARQLEngineConfig = {
        rdf: { timeout: 30000, maxResults: 1000 },
        llm: { provider: 'openai', model: 'gpt-4', maxTokens: 1000 },
        queryGeneration: { maxRetries: 2, timeoutMs: 15000, validateSyntax: true, optimizeQuery: true, usePatterns: true },
        prefixes: {
          'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
          'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
          'owl': 'http://www.w3.org/2002/07/owl#',
          'xsd': 'http://www.w3.org/2001/XMLSchema#',
          'aaswe': 'http://aaswe.org/ontology#'
        },
        response: { includeQuery: true, includeExplanation: true, formatResults: true, maxResults: 100 },
        caching: { enabled: true, ttl: 300000, maxSize: 1000 }
      };
      this.sparql = new SPARQLQueryEngine(sparqlConfig, rdfStore);
    }

    // Initialize RAG engine
    if (options.ragEngine) {
      this.rag = options.ragEngine;
    } else {
      const ragConfig: RAGConfig = {
        vectorStore: { type: 'memory', dimensions: 1536, similarity: 'cosine' },
        retrieval: { topK: 5, scoreThreshold: 0.7, maxTokens: 4000, contextWindow: 8000 },
        llm: { provider: 'openai', model: 'gpt-4', maxTokens: 1000 },
        embeddings: { provider: 'openai', model: 'text-embedding-ada-002', dimensions: 1536 },
        cache: { enabled: true, ttl: 300000, maxSize: 1000 }
      };
      this.rag = new RAGEngine(ragConfig);
    }
  }

  /**
   * Ask a natural language question and get an enriched answer using RDF + RAG
   */
  async ask(req: RAGSparqlRequest): Promise<RAGSparqlAnswer> {
    const start = Date.now();
    const translator = new PassthroughNL2SPARQLTranslator();

    try {
      // Step 1: Translate question (hint) and execute SPARQL via engine
      const hint = await translator.translate(req.question);
      logger.debug('RAGSparqlService: NL2SPARQL hint generated', { hint });

      if ((this.sparql as any).initialize) {
        await (this.sparql as any).initialize();
      }

      const sparqlResp: SPARQLQueryResponse = await this.sparql.query(hint);

      // Step 2: Convert RDF results to Documents
      const docs: Document[] = rowsToDocuments(sparqlResp, req.maxContextDocs || 20);
      if (docs.length > 0) {
        await this.rag.addDocuments(docs);
      }

      // Step 3: RAG answer using RDF-backed context
      const qc: QueryContext = { query: req.question, intent: 'documentation', scope: 'project' } as any;
      const ragResp = await this.rag.query(qc);

      const processingTime = Date.now() - start;
      const answer: RAGSparqlAnswer = {
        question: req.question,
        answer: ragResp.answer,
        confidence: ragResp.reasoning?.confidence || (ragResp.sources?.length ? 0.8 : 0.4),
        contextDocs: docs.length,
        sparql: {
          query: sparqlResp.generatedSPARQL?.sparql || 'N/A',
          explanation: sparqlResp.explanation
        },
        rdfSummary: sparqlResp.formattedResponse,
        metadata: {
          processingTime,
          rdfResultCount: sparqlResp.executionResult?.summary?.resultCount || 0,
          cacheHit: Boolean(sparqlResp.metadata?.cacheHit)
        }
      };

      logger.info('RAGSparqlService: Answer generated', {
        question: req.question,
        contextDocs: docs.length,
        rdfResultCount: sparqlResp.executionResult?.summary?.resultCount || 0,
        processingTime
      });

      return answer;
    } catch (error) {
      logger.error('RAGSparqlService: Failed to generate answer', { error });
      return {
        question: req.question,
        answer: `Error: ${error instanceof Error ? error.message : String(error)}`,
        confidence: 0,
        contextDocs: 0,
        metadata: { error: true }
      };
    }
  }
}
