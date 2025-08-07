/**
 * RDF Files Storage Layer
 * 
 * Implements RDF file-based storage for the Hybrid Storage Manager
 * with file watching, backup capabilities, and TTL parsing.
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { glob } from 'glob';
import logger from '../../../utils/logger';
import {
  StorageInterface,
  StorageLayer,
  StorageLayerHealth,
  QueryContext,
  QueryResult,
  RDFStorageConfig,
  HybridStorageError
} from './types';

interface RDFFile {
  path: string;
  content: string;
  lastModified: Date;
  size: number;
  parsed?: any;
}

export class RDFStorageLayer extends EventEmitter implements StorageInterface {
  readonly layer = StorageLayer.RDF_FILES;
  private files: Map<string, RDFFile> = new Map();
  private watcher: chokidar.FSWatcher | undefined;
  private syncTimer: NodeJS.Timeout | undefined;
  private isInitialized = false;
  private metrics = {
    totalFiles: 0,
    totalSize: 0,
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    totalResponseTime: 0,
    lastSync: new Date(),
    fileChanges: 0
  };

  constructor(private config: RDFStorageConfig) {
    super();
  }

  /**
   * Initialize the RDF storage layer
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing RDF Storage Layer');
      
      // Ensure base directory exists
      await fs.mkdir(this.config.baseDirectory, { recursive: true });
      
      // Load existing RDF files
      await this.loadRDFFiles();
      
      // Setup file watching if enabled
      if (this.config.watchForChanges) {
        this.setupFileWatcher();
      }
      
      // Setup sync timer if configured
      if (this.config.syncInterval) {
        this.setupSyncTimer();
      }
      
      // Setup backup directory if enabled
      if (this.config.backupEnabled && this.config.backupDirectory) {
        await fs.mkdir(this.config.backupDirectory, { recursive: true });
      }
      
      this.isInitialized = true;
      logger.info('RDF Storage Layer initialized successfully');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize RDF Storage Layer:', error);
      throw new HybridStorageError(
        `RDF storage initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        StorageLayer.RDF_FILES,
        'initialize',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Execute a query against RDF files
   */
  async query<T = any>(
    query: string,
    params?: Record<string, any>,
    context?: QueryContext
  ): Promise<QueryResult<T>> {
    if (!this.isInitialized) {
      throw new HybridStorageError('RDF storage layer not initialized', StorageLayer.RDF_FILES, 'query');
    }

    const startTime = Date.now();

    try {
      // Execute query against RDF files
      const results = await this.executeRDFQuery(query, params || {});
      
      const executionTime = Date.now() - startTime;
      this.updateMetrics(true, executionTime);
      
      const queryResult: QueryResult<T> = {
        data: results as T,
        source: StorageLayer.RDF_FILES,
        executionTime,
        cached: false,
        timestamp: new Date(),
        metadata: {
          filesSearched: this.files.size,
          resultCount: Array.isArray(results) ? results.length : 1,
          totalFiles: this.metrics.totalFiles
        }
      };

      this.emit('query_executed', { query, params, result: queryResult, context });
      
      return queryResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateMetrics(false, executionTime);
      
      logger.error('RDF query failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('query_failed', { query, params, error, context });
      
      throw new HybridStorageError(
        `RDF query failed: ${errorMessage}`,
        StorageLayer.RDF_FILES,
        'query',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create a new RDF file
   */
  async create(data: any, _context?: QueryContext): Promise<QueryResult<any>> {
    const fileName = this.generateFileName(data);
    const filePath = path.join(this.config.baseDirectory, fileName);
    
    // Convert data to TTL format
    const ttlContent = this.convertToTTL(data);
    
    // Create backup if enabled
    if (this.config.backupEnabled) {
      await this.createBackup(filePath);
    }
    
    // Write file
    await fs.writeFile(filePath, ttlContent, 'utf-8');
    
    // Update internal tracking
    const stats = await fs.stat(filePath);
    const rdfFile: RDFFile = {
      path: filePath,
      content: ttlContent,
      lastModified: stats.mtime,
      size: stats.size,
      parsed: data
    };
    
    this.files.set(filePath, rdfFile);
    this.updateFileMetrics();
    
    const result: QueryResult<any> = {
      data: { filePath, ...data },
      source: StorageLayer.RDF_FILES,
      executionTime: 1,
      cached: false,
      timestamp: new Date()
    };

    this.emit('file_created', { filePath, size: stats.size });
    
    return result;
  }

  /**
   * Update an RDF file
   */
  async update(filePath: string, data: any, _context?: QueryContext): Promise<QueryResult<any>> {
    const existingFile = this.files.get(filePath);
    if (!existingFile) {
      throw new HybridStorageError(
        `RDF file not found: ${filePath}`,
        StorageLayer.RDF_FILES,
        'update'
      );
    }

    // Create backup if enabled
    if (this.config.backupEnabled) {
      await this.createBackup(filePath);
    }
    
    // Merge with existing data
    const existingData = existingFile.parsed || this.parseTTL(existingFile.content);
    const mergedData = { ...existingData, ...data };
    
    // Convert to TTL and write
    const ttlContent = this.convertToTTL(mergedData);
    await fs.writeFile(filePath, ttlContent, 'utf-8');
    
    // Update tracking
    const stats = await fs.stat(filePath);
    existingFile.content = ttlContent;
    existingFile.lastModified = stats.mtime;
    existingFile.size = stats.size;
    existingFile.parsed = mergedData;
    
    this.updateFileMetrics();

    const result: QueryResult<any> = {
      data: { filePath, ...mergedData },
      source: StorageLayer.RDF_FILES,
      executionTime: 1,
      cached: false,
      timestamp: new Date()
    };

    this.emit('file_updated', { filePath, size: stats.size });
    
    return result;
  }

  /**
   * Delete an RDF file
   */
  async delete(filePath: string, _context?: QueryContext): Promise<QueryResult<boolean>> {
    const existingFile = this.files.get(filePath);
    if (!existingFile) {
      return {
        data: false,
        source: StorageLayer.RDF_FILES,
        executionTime: 1,
        cached: false,
        timestamp: new Date()
      };
    }

    // Create backup if enabled
    if (this.config.backupEnabled) {
      await this.createBackup(filePath);
    }
    
    // Delete file
    await fs.unlink(filePath);
    
    // Remove from tracking
    this.files.delete(filePath);
    this.updateFileMetrics();

    this.emit('file_deleted', { filePath });

    return {
      data: true,
      source: StorageLayer.RDF_FILES,
      executionTime: 1,
      cached: false,
      timestamp: new Date()
    };
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<StorageLayerHealth> {
    const startTime = Date.now();
    
    try {
      // Check if base directory is accessible
      await fs.access(this.config.baseDirectory);
      
      // Check if we can read files
      const testFiles = Array.from(this.files.keys()).slice(0, 3);
      for (const filePath of testFiles) {
        await fs.access(filePath);
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        layer: StorageLayer.RDF_FILES,
        status: responseTime < 100 ? 'healthy' : responseTime < 500 ? 'degraded' : 'unhealthy',
        responseTime,
        lastCheck: new Date(),
        errorCount: this.metrics.failedQueries,
        details: {
          totalFiles: this.metrics.totalFiles,
          totalSizeMB: this.metrics.totalSize / (1024 * 1024),
          baseDirectory: this.config.baseDirectory,
          watchingEnabled: this.config.watchForChanges,
          backupEnabled: this.config.backupEnabled,
          lastSync: this.metrics.lastSync,
          fileChanges: this.metrics.fileChanges,
          successRate: this.metrics.totalQueries > 0 
            ? this.metrics.successfulQueries / this.metrics.totalQueries 
            : 0
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        layer: StorageLayer.RDF_FILES,
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date(),
        errorCount: this.metrics.failedQueries,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          baseDirectory: this.config.baseDirectory
        }
      };
    }
  }

  /**
   * Get storage metrics
   */
  async getMetrics(): Promise<Record<string, any>> {
    return {
      layer: StorageLayer.RDF_FILES,
      ...this.metrics,
      averageResponseTime: this.metrics.totalQueries > 0 
        ? this.metrics.totalResponseTime / this.metrics.totalQueries 
        : 0,
      successRate: this.metrics.totalQueries > 0 
        ? this.metrics.successfulQueries / this.metrics.totalQueries 
        : 0,
      averageFileSize: this.metrics.totalFiles > 0 
        ? this.metrics.totalSize / this.metrics.totalFiles 
        : 0,
      config: {
        baseDirectory: this.config.baseDirectory,
        filePattern: this.config.filePattern,
        watchForChanges: this.config.watchForChanges,
        syncInterval: this.config.syncInterval,
        backupEnabled: this.config.backupEnabled
      }
    };
  }

  /**
   * Shutdown the RDF storage layer
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down RDF Storage Layer');
      
      // Stop file watcher
      if (this.watcher) {
        await this.watcher.close();
        this.watcher = undefined;
      }
      
      // Clear sync timer
      if (this.syncTimer) {
        clearInterval(this.syncTimer);
        this.syncTimer = undefined;
      }
      
      // Clear file cache
      this.files.clear();
      
      this.isInitialized = false;
      
      logger.info('RDF Storage Layer shutdown completed');
      this.emit('shutdown');
    } catch (error) {
      logger.error('RDF Storage Layer shutdown failed:', error);
      throw error;
    }
  }

  // Private helper methods

  private async loadRDFFiles(): Promise<void> {
    try {
      const pattern = path.join(this.config.baseDirectory, this.config.filePattern);
      const filePaths = await glob(pattern);
      
      for (const filePath of filePaths) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const stats = await fs.stat(filePath);
          
          const rdfFile: RDFFile = {
            path: filePath,
            content,
            lastModified: stats.mtime,
            size: stats.size
          };
          
          this.files.set(filePath, rdfFile);
        } catch (error) {
          logger.warn(`Failed to load RDF file ${filePath}:`, error);
        }
      }
      
      this.updateFileMetrics();
      logger.info(`Loaded ${this.files.size} RDF files`);
    } catch (error) {
      logger.error('Failed to load RDF files:', error);
      throw error;
    }
  }

  private setupFileWatcher(): void {
    const watchPattern = path.join(this.config.baseDirectory, this.config.filePattern);
    
    this.watcher = chokidar.watch(watchPattern, {
      persistent: true,
      ignoreInitial: true
    });
    
    this.watcher.on('add', (filePath) => {
      this.handleFileChange('add', filePath);
    });
    
    this.watcher.on('change', (filePath) => {
      this.handleFileChange('change', filePath);
    });
    
    this.watcher.on('unlink', (filePath) => {
      this.handleFileChange('unlink', filePath);
    });
    
    this.watcher.on('error', (error) => {
      logger.error('File watcher error:', error);
      this.emit('watcher_error', error);
    });
    
    logger.debug('File watcher setup completed');
  }

  private async handleFileChange(event: string, filePath: string): Promise<void> {
    try {
      this.metrics.fileChanges++;
      
      if (event === 'unlink') {
        this.files.delete(filePath);
        this.emit('file_removed', { filePath });
      } else {
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);
        
        const rdfFile: RDFFile = {
          path: filePath,
          content,
          lastModified: stats.mtime,
          size: stats.size
        };
        
        this.files.set(filePath, rdfFile);
        this.emit('file_changed', { filePath, event, size: stats.size });
      }
      
      this.updateFileMetrics();
    } catch (error) {
      logger.error(`Failed to handle file change for ${filePath}:`, error);
    }
  }

  private setupSyncTimer(): void {
    if (!this.config.syncInterval) return;
    
    this.syncTimer = setInterval(() => {
      this.syncFiles().catch(error => {
        logger.error('File sync failed:', error);
      });
    }, this.config.syncInterval);
  }

  private async syncFiles(): Promise<void> {
    try {
      await this.loadRDFFiles();
      this.metrics.lastSync = new Date();
      this.emit('files_synced', { fileCount: this.files.size });
    } catch (error) {
      logger.error('Failed to sync files:', error);
    }
  }

  private async executeRDFQuery(query: string, params: Record<string, any>): Promise<any[]> {
    const results: any[] = [];
    
    // Simple query processing for RDF files
    for (const [filePath, rdfFile] of this.files) {
      try {
        // Parse RDF content if not already parsed
        if (!rdfFile.parsed) {
          rdfFile.parsed = this.parseTTL(rdfFile.content);
        }
        
        // Apply query logic
        if (this.matchesQuery(rdfFile.parsed, query, params)) {
          results.push({
            filePath,
            data: rdfFile.parsed,
            lastModified: rdfFile.lastModified,
            size: rdfFile.size
          });
        }
      } catch (error) {
        logger.warn(`Failed to process RDF file ${filePath}:`, error);
      }
    }
    
    return results;
  }

  private matchesQuery(data: any, query: string, params: Record<string, any>): boolean {
    const lowerQuery = query.toLowerCase();
    
    // Simple text-based matching
    if (lowerQuery.includes('select') || lowerQuery.includes('find')) {
      // Apply parameter filters
      for (const [key, value] of Object.entries(params)) {
        if (data[key] !== value) {
          return false;
        }
      }
      return true;
    }
    
    // Default: include all files
    return true;
  }

  private parseTTL(content: string): any {
    // Simple TTL parser - in a real implementation, use a proper RDF library
    const data: any = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed) continue;
      
      // Simple triple parsing
      const match = trimmed.match(/(\S+)\s+(\S+)\s+(.+)\s*\./);
      if (match) {
        const [, subject, predicate, object] = match;
        if (!data[subject]) data[subject] = {};
        data[subject][predicate] = object.replace(/[";]/g, '');
      }
    }
    
    return data;
  }

  private convertToTTL(data: any): string {
    // Simple TTL generation - in a real implementation, use a proper RDF library
    let ttl = '@prefix : <http://example.org/> .\n\n';
    
    for (const [subject, predicates] of Object.entries(data)) {
      if (typeof predicates === 'object' && predicates !== null) {
        for (const [predicate, object] of Object.entries(predicates)) {
          ttl += `:${subject} :${predicate} "${object}" .\n`;
        }
      }
    }
    
    return ttl;
  }

  private generateFileName(data: any): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const id = data.id || data.name || 'unknown';
    return `${id}-${timestamp}.module-knowledge.ttl`;
  }

  private async createBackup(filePath: string): Promise<void> {
    if (!this.config.backupEnabled || !this.config.backupDirectory) return;
    
    try {
      const fileName = path.basename(filePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${timestamp}-${fileName}`;
      const backupPath = path.join(this.config.backupDirectory, backupFileName);
      
      await fs.copyFile(filePath, backupPath);
      logger.debug(`Created backup: ${backupPath}`);
    } catch (error) {
      logger.warn(`Failed to create backup for ${filePath}:`, error);
    }
  }

  private updateFileMetrics(): void {
    this.metrics.totalFiles = this.files.size;
    this.metrics.totalSize = Array.from(this.files.values()).reduce((sum, file) => sum + file.size, 0);
  }

  private updateMetrics(success: boolean, responseTime: number): void {
    this.metrics.totalQueries++;
    this.metrics.totalResponseTime += responseTime;
    
    if (success) {
      this.metrics.successfulQueries++;
    } else {
      this.metrics.failedQueries++;
    }
  }
}

export default RDFStorageLayer;