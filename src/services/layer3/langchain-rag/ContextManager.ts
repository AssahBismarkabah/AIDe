import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { createHash } from 'crypto';
import logger from '../../../utils/logger';
import {
  CodeContext,
  QueryContext,
  ContextChain
} from './types';

export interface ContextWindow {
  id: string;
  documents: Document[];
  totalTokens: number;
  maxTokens: number;
  priority: number;
  createdAt: Date;
  lastAccessed: Date;
}

export interface ContextManagerConfig {
  maxContextWindows: number;
  maxTokensPerWindow: number;
  defaultChunkSize: number;
  chunkOverlap: number;
  priorityDecayRate: number;
  cleanupInterval: number;
}

export class ContextManager {
  private config: ContextManagerConfig;
  private contextWindows: Map<string, ContextWindow> = new Map();
  private contextChains: Map<string, ContextChain> = new Map();
  private textSplitter: RecursiveCharacterTextSplitter;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: ContextManagerConfig) {
    this.config = config;
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: config.defaultChunkSize,
      chunkOverlap: config.chunkOverlap,
      separators: ['\n\n', '\n', ' ', '']
    });
    
    this.startCleanupTimer();
  }

  async addCodeContext(codeContext: CodeContext, priority: number = 1): Promise<string> {
    try {
      const contextId = this.generateContextId(codeContext);
      
      // Convert code context to documents
      const documents = await this.codeContextToDocuments(codeContext);
      
      // Calculate total tokens (rough estimation)
      const totalTokens = documents.reduce((sum, doc) => 
        sum + Math.ceil(doc.pageContent.length / 4), 0
      );
      
      // Create context window
      const contextWindow: ContextWindow = {
        id: contextId,
        documents,
        totalTokens,
        maxTokens: this.config.maxTokensPerWindow,
        priority,
        createdAt: new Date(),
        lastAccessed: new Date()
      };
      
      // Check if we need to evict old contexts
      await this.manageContextCapacity();
      
      // Store context window
      this.contextWindows.set(contextId, contextWindow);
      
      logger.info('Code context added', {
        contextId,
        filePath: codeContext.filePath,
        documentsCount: documents.length,
        totalTokens,
        priority
      });
      
      return contextId;
      
    } catch (error) {
      logger.error('Failed to add code context', { error, filePath: codeContext.filePath });
      throw error;
    }
  }

  async getRelevantContext(queryContext: QueryContext, maxTokens: number): Promise<Document[]> {
    try {
      const relevantDocuments: Document[] = [];
      let currentTokens = 0;
      
      // Get contexts sorted by relevance and priority
      const sortedContexts = this.getSortedContexts(queryContext);
      
      for (const contextWindow of sortedContexts) {
        // Update last accessed time
        contextWindow.lastAccessed = new Date();
        
        // Filter documents by relevance to query
        const relevantDocs = await this.filterDocumentsByRelevance(
          contextWindow.documents, 
          queryContext
        );
        
        for (const doc of relevantDocs) {
          const docTokens = Math.ceil(doc.pageContent.length / 4);
          
          if (currentTokens + docTokens <= maxTokens) {
            relevantDocuments.push(doc);
            currentTokens += docTokens;
          } else {
            // Try to fit a truncated version
            const remainingTokens = maxTokens - currentTokens;
            if (remainingTokens > 100) { // Only if we have meaningful space left
              const truncatedContent = doc.pageContent.substring(0, remainingTokens * 4);
              relevantDocuments.push(new Document({
                pageContent: truncatedContent + '...',
                metadata: { ...doc.metadata, truncated: true }
              }));
              currentTokens = maxTokens;
            }
            break;
          }
        }
        
        if (currentTokens >= maxTokens) break;
      }
      
      logger.debug('Retrieved relevant context', {
        documentsCount: relevantDocuments.length,
        totalTokens: currentTokens,
        maxTokens,
        query: queryContext.query
      });
      
      return relevantDocuments;
      
    } catch (error) {
      logger.error('Failed to get relevant context', { error, query: queryContext.query });
      throw error;
    }
  }

  async updateContextChain(sessionId: string, queryContext: QueryContext, response: string): Promise<void> {
    try {
      if (!this.contextChains.has(sessionId)) {
        this.contextChains.set(sessionId, {
          id: sessionId,
          messages: [],
          context: {
            codeFiles: [],
            relevantDocs: [],
            userIntent: queryContext.intent,
            sessionId
          },
          reasoning: {
            chain: [],
            confidence: 0,
            sources: []
          }
        });
      }
      
      const chain = this.contextChains.get(sessionId)!;
      
      // Add user message
      chain.messages.push({
        role: 'user',
        content: queryContext.query,
        timestamp: new Date(),
        metadata: {
          intent: queryContext.intent,
          scope: queryContext.scope,
          filePath: queryContext.filePath
        }
      });
      
      // Add assistant response
      chain.messages.push({
        role: 'assistant',
        content: response,
        timestamp: new Date()
      });
      
      // Update context information
      if (queryContext.filePath && !chain.context.codeFiles.includes(queryContext.filePath)) {
        chain.context.codeFiles.push(queryContext.filePath);
      }
      
      // Keep only last 20 messages to prevent memory bloat
      if (chain.messages.length > 20) {
        chain.messages = chain.messages.slice(-20);
      }
      
      logger.debug('Context chain updated', {
        sessionId,
        messagesCount: chain.messages.length,
        codeFilesCount: chain.context.codeFiles.length
      });
      
    } catch (error) {
      logger.error('Failed to update context chain', { error, sessionId });
      throw error;
    }
  }

  getContextChain(sessionId: string): ContextChain | undefined {
    return this.contextChains.get(sessionId);
  }

  async removeContext(contextId: string): Promise<boolean> {
    const removed = this.contextWindows.delete(contextId);
    if (removed) {
      logger.info('Context removed', { contextId });
    }
    return removed;
  }

  async clearExpiredContexts(): Promise<number> {
    const now = new Date();
    const expiredContexts: string[] = [];
    
    for (const [contextId, contextWindow] of this.contextWindows) {
      const ageInMinutes = (now.getTime() - contextWindow.lastAccessed.getTime()) / (1000 * 60);
      
      // Remove contexts not accessed for more than 30 minutes
      if (ageInMinutes > 30) {
        expiredContexts.push(contextId);
      }
    }
    
    expiredContexts.forEach(contextId => {
      this.contextWindows.delete(contextId);
    });
    
    if (expiredContexts.length > 0) {
      logger.info('Expired contexts cleared', { count: expiredContexts.length });
    }
    
    return expiredContexts.length;
  }

  getContextStats(): {
    totalContexts: number;
    totalDocuments: number;
    totalTokens: number;
    averageTokensPerContext: number;
    memoryUsage: number;
  } {
    let totalDocuments = 0;
    let totalTokens = 0;
    
    for (const contextWindow of this.contextWindows.values()) {
      totalDocuments += contextWindow.documents.length;
      totalTokens += contextWindow.totalTokens;
    }
    
    return {
      totalContexts: this.contextWindows.size,
      totalDocuments,
      totalTokens,
      averageTokensPerContext: this.contextWindows.size > 0 ? totalTokens / this.contextWindows.size : 0,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  private async codeContextToDocuments(codeContext: CodeContext): Promise<Document[]> {
    const documents: Document[] = [];
    
    // Main file content
    const mainDoc = new Document({
      pageContent: codeContext.content,
      metadata: {
        source: codeContext.filePath,
        type: 'code',
        language: codeContext.language,
        filePath: codeContext.filePath,
        lastModified: codeContext.metadata.lastModified,
        size: codeContext.metadata.size,
        complexity: codeContext.metadata.complexity,
        testCoverage: codeContext.metadata.testCoverage
      }
    });
    
    // Split main content if it's too large
    const splitDocs = await this.textSplitter.splitDocuments([mainDoc]);
    documents.push(...splitDocs);
    
    // Function documentation
    for (const func of codeContext.functions) {
      const funcDoc = new Document({
        pageContent: `Function: ${func.name}\nSignature: ${func.signature}\n${func.docstring || ''}`,
        metadata: {
          source: codeContext.filePath,
          type: 'function',
          language: codeContext.language,
          functionName: func.name,
          startLine: func.startLine,
          endLine: func.endLine
        }
      });
      documents.push(funcDoc);
    }
    
    // Class documentation
    for (const cls of codeContext.classes) {
      const classDoc = new Document({
        pageContent: `Class: ${cls.name}\nMethods: ${cls.methods.join(', ')}\nProperties: ${cls.properties.join(', ')}`,
        metadata: {
          source: codeContext.filePath,
          type: 'class',
          language: codeContext.language,
          className: cls.name,
          startLine: cls.startLine,
          endLine: cls.endLine
        }
      });
      documents.push(classDoc);
    }
    
    // Import/dependency information
    if (codeContext.imports.length > 0 || codeContext.dependencies.length > 0) {
      const importsContent = [
        'Imports:',
        ...codeContext.imports.map(imp => `- ${imp.module}: ${imp.items.join(', ')}${imp.alias ? ` as ${imp.alias}` : ''}`),
        'Dependencies:',
        ...codeContext.dependencies.map(dep => `- ${dep}`)
      ].join('\n');
      
      const importsDoc = new Document({
        pageContent: importsContent,
        metadata: {
          source: codeContext.filePath,
          type: 'imports',
          language: codeContext.language
        }
      });
      documents.push(importsDoc);
    }
    
    return documents;
  }

  private getSortedContexts(queryContext: QueryContext): ContextWindow[] {
    const contexts = Array.from(this.contextWindows.values());
    
    return contexts.sort((a, b) => {
      // Calculate relevance score
      let scoreA = a.priority;
      let scoreB = b.priority;
      
      // Boost score for file-specific queries
      if (queryContext.filePath) {
        const hasFileA = a.documents.some(doc => doc.metadata.filePath === queryContext.filePath);
        const hasFileB = b.documents.some(doc => doc.metadata.filePath === queryContext.filePath);
        
        if (hasFileA) scoreA += 10;
        if (hasFileB) scoreB += 10;
      }
      
      // Boost score for language-specific queries
      if (queryContext.language) {
        const hasLangA = a.documents.some(doc => doc.metadata.language === queryContext.language);
        const hasLangB = b.documents.some(doc => doc.metadata.language === queryContext.language);
        
        if (hasLangA) scoreA += 5;
        if (hasLangB) scoreB += 5;
      }
      
      // Apply time decay
      const now = new Date().getTime();
      const ageA = (now - a.lastAccessed.getTime()) / (1000 * 60); // minutes
      const ageB = (now - b.lastAccessed.getTime()) / (1000 * 60);
      
      scoreA *= Math.exp(-ageA * this.config.priorityDecayRate);
      scoreB *= Math.exp(-ageB * this.config.priorityDecayRate);
      
      return scoreB - scoreA; // Higher score first
    });
  }

  private async filterDocumentsByRelevance(documents: Document[], queryContext: QueryContext): Promise<Document[]> {
    // Simple relevance filtering based on metadata and content
    return documents.filter(doc => {
      // Always include if file path matches
      if (queryContext.filePath && doc.metadata.filePath === queryContext.filePath) {
        return true;
      }
      
      // Include if language matches
      if (queryContext.language && doc.metadata.language === queryContext.language) {
        return true;
      }
      
      // Include if content seems relevant (simple keyword matching)
      const queryLower = queryContext.query.toLowerCase();
      const contentLower = doc.pageContent.toLowerCase();
      
      // Check for query terms in content
      const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);
      const relevantTerms = queryTerms.filter(term => contentLower.includes(term));
      
      return relevantTerms.length > 0;
    });
  }

  private async manageContextCapacity(): Promise<void> {
    if (this.contextWindows.size >= this.config.maxContextWindows) {
      // Remove least recently used contexts
      const contexts = Array.from(this.contextWindows.entries())
        .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());
      
      const toRemove = contexts.slice(0, Math.ceil(this.config.maxContextWindows * 0.2)); // Remove 20%
      
      toRemove.forEach(([contextId]) => {
        this.contextWindows.delete(contextId);
      });
      
      logger.info('Context capacity managed', {
        removed: toRemove.length,
        remaining: this.contextWindows.size
      });
    }
  }

  private generateContextId(codeContext: CodeContext): string {
    const data = {
      filePath: codeContext.filePath,
      lastModified: codeContext.metadata.lastModified.toISOString(),
      size: codeContext.metadata.size
    };
    return createHash('md5').update(JSON.stringify(data)).digest('hex');
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.clearExpiredContexts();
      } catch (error) {
        logger.error('Context cleanup failed', { error });
      }
    }, this.config.cleanupInterval);
    
    // Ensure timer doesn't prevent process exit
    this.cleanupTimer.unref();
  }

  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.contextWindows.clear();
    this.contextChains.clear();
    
    logger.info('Context manager shutdown complete');
  }
}