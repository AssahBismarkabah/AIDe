/**
 * Code Ingestion Service
 * Main orchestrator for code ingestion, Git monitoring, and file watching
 */

import { EventEmitter } from 'events';
import { join } from 'path';
import logger from '../../../utils/logger';
import GitService from './GitService';
import FileWatcher from './FileWatcher';
import IngestionJobQueue from './IngestionJobQueue';
import { BaseAnalyzer } from '../ast-analyzer/BaseAnalyzer';
import {
  Repository,
  RepositoryConfig,
  IngestionJob,
  IngestionJobMetadata,
  AnalysisResult,
  FileAnalysisResult,
  AnalysisSummary,
  WebhookPayload,
  TTLFileChange,
  IngestionConfig,
  IngestionMetrics
} from './types';

export class CodeIngestionService extends EventEmitter {
  private gitService: GitService;
  private fileWatcher: FileWatcher;
  private jobQueue: IngestionJobQueue;
  private astAnalyzer: BaseAnalyzer;
  private config: IngestionConfig;
  private metrics: IngestionMetrics;
  private isInitialized = false;

  constructor(
    astAnalyzer: BaseAnalyzer,
    config: Partial<IngestionConfig> = {}
  ) {
    super();
    
    this.astAnalyzer = astAnalyzer;
    this.config = {
      maxConcurrentJobs: 3,
      batchSize: 50,
      retryAttempts: 3,
      retryDelay: 5000,
      fileWatcherDebounce: 1000,
      supportedLanguages: ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'cpp'],
      defaultExcludePatterns: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/*.test.*',
        '**/*.spec.*'
      ],
      ...config
    };

    this.metrics = {
      totalRepositories: 0,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageProcessingTime: 0,
      filesProcessedPerSecond: 0,
      lastProcessingTime: new Date()
    };

    // Initialize services
    this.gitService = new GitService();
    this.fileWatcher = new FileWatcher();
    this.jobQueue = new IngestionJobQueue(this.config);
  }

  /**
   * Initialize the code ingestion service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.info('Initializing Code Ingestion Service');

    try {
      // Initialize sub-services
      await this.gitService.initialize();
      await this.fileWatcher.initialize();
      await this.jobQueue.initialize();

      // Set up event handlers
      this.setupEventHandlers();

      this.isInitialized = true;
      logger.info('Code Ingestion Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Code Ingestion Service:', error);
      throw error;
    }
  }

  /**
   * Add a repository for monitoring and analysis
   */
  async addRepository(config: {
    name: string;
    path: string;
    url?: string;
    branch?: string;
    enableWebhooks?: boolean;
    enableFileWatcher?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
    languages?: string[];
  }): Promise<Repository> {
    this.ensureInitialized();

    logger.info(`Adding repository: ${config.name}`);

    try {
      // Add repository to Git service
      const repoConfig: {
        name: string;
        path: string;
        url?: string;
        branch?: string;
        config?: Partial<RepositoryConfig>;
      } = {
        name: config.name,
        path: config.path,
        config: {
          includePatterns: config.includePatterns || ['**/*.ts', '**/*.js', '**/*.py', '**/*.java', '**/*.go', '**/*.rs', '**/*.cpp'],
          excludePatterns: config.excludePatterns || this.config.defaultExcludePatterns,
          languages: config.languages || this.config.supportedLanguages,
          enableWebhooks: config.enableWebhooks || false,
          enableFileWatcher: config.enableFileWatcher !== false, // Default to true
          batchSize: this.config.batchSize,
          analysisDepth: 10
        }
      };

      if (config.url !== undefined) {
        repoConfig.url = config.url;
      }
      if (config.branch !== undefined) {
        repoConfig.branch = config.branch;
      }

      const repository = await this.gitService.addRepository(repoConfig);

      // Start file watching if enabled
      if (repository.config.enableFileWatcher) {
        await this.fileWatcher.startWatching(repository);
      }

      // Queue initial analysis
      await this.queueFullAnalysis(repository.id, 'manual');

      this.metrics.totalRepositories++;
      this.emit('repositoryAdded', repository);

      logger.info(`Repository added successfully: ${repository.name} (${repository.id})`);
      return repository;
    } catch (error) {
      logger.error(`Failed to add repository ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Remove a repository from monitoring
   */
  async removeRepository(repositoryId: string): Promise<void> {
    this.ensureInitialized();

    logger.info(`Removing repository: ${repositoryId}`);

    try {
      // Stop file watching
      await this.fileWatcher.stopWatching(repositoryId);

      // Remove from Git service
      await this.gitService.removeRepository(repositoryId);

      // Cancel pending jobs
      const pendingJobs = this.jobQueue.getRepositoryJobs(repositoryId)
        .filter(job => job.status === 'pending');
      
      for (const job of pendingJobs) {
        await this.jobQueue.cancelJob(job.id);
      }

      this.metrics.totalRepositories--;
      this.emit('repositoryRemoved', { repositoryId });

      logger.info(`Repository removed: ${repositoryId}`);
    } catch (error) {
      logger.error(`Failed to remove repository ${repositoryId}:`, error);
      throw error;
    }
  }

  /**
   * Process webhook payload from Git providers
   */
  async processWebhook(payload: WebhookPayload): Promise<void> {
    this.ensureInitialized();

    logger.info(`Processing webhook for repository: ${payload.repository.name}`);

    try {
      // Find repository by URL or name
      const repositories = this.gitService.getRepositories();
      const repository = repositories.find(repo => 
        repo.url === payload.repository.url || 
        repo.name === payload.repository.name
      );

      if (!repository) {
        logger.warn(`Repository not found for webhook: ${payload.repository.name}`);
        return;
      }

      // Extract changed files from commits
      const changedFiles = payload.commits.flatMap(commit => 
        commit.files.map(file => file.path)
      );

      // Queue incremental analysis
      await this.queueIncrementalAnalysis(
        repository.id,
        payload.commits[0]?.hash,
        changedFiles,
        'webhook'
      );

      this.emit('webhookProcessed', { repository, payload });
    } catch (error) {
      logger.error('Failed to process webhook:', error);
      throw error;
    }
  }

  /**
   * Queue full repository analysis
   */
  async queueFullAnalysis(
    repositoryId: string,
    triggerType: 'manual' | 'webhook' | 'file_watcher' | 'scheduled' = 'manual'
  ): Promise<IngestionJob> {
    const metadata: IngestionJobMetadata = {
      triggerType,
      batchId: `full-${Date.now()}`
    };

    return await this.jobQueue.addJob(
      repositoryId,
      'full_analysis',
      metadata,
      'normal'
    );
  }

  /**
   * Queue incremental analysis for specific files
   */
  async queueIncrementalAnalysis(
    repositoryId: string,
    commitHash?: string,
    changedFiles?: string[],
    triggerType: 'manual' | 'webhook' | 'file_watcher' | 'scheduled' = 'manual'
  ): Promise<IngestionJob> {
    const metadata: IngestionJobMetadata = {
      triggerType,
      batchId: `incremental-${Date.now()}`
    };

    if (commitHash !== undefined) {
      metadata.commitHash = commitHash;
    }
    if (changedFiles !== undefined) {
      metadata.changedFiles = changedFiles;
    }

    return await this.jobQueue.addJob(
      repositoryId,
      'incremental_analysis',
      metadata,
      'high'
    );
  }

  /**
   * Queue TTL file synchronization
   */
  async queueTTLSync(
    repositoryId: string,
    ttlFilePath: string
  ): Promise<IngestionJob> {
    const metadata: IngestionJobMetadata = {
      changedFiles: [ttlFilePath],
      triggerType: 'file_watcher',
      batchId: `ttl-sync-${Date.now()}`
    };

    return await this.jobQueue.addJob(
      repositoryId,
      'ttl_sync',
      metadata,
      'critical'
    );
  }

  /**
   * Get repository by ID
   */
  getRepository(repositoryId: string): Repository | undefined {
    return this.gitService.getRepository(repositoryId);
  }

  /**
   * Get all repositories
   */
  getRepositories(): Repository[] {
    return this.gitService.getRepositories();
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): IngestionJob | undefined {
    return this.jobQueue.getJob(jobId);
  }

  /**
   * Get jobs for a repository
   */
  getRepositoryJobs(repositoryId: string): IngestionJob[] {
    return this.jobQueue.getRepositoryJobs(repositoryId);
  }

  /**
   * Get service metrics
   */
  getMetrics(): IngestionMetrics {
    const queueStats = this.jobQueue.getQueueStats();
    
    return {
      ...this.metrics,
      activeJobs: queueStats.running,
      completedJobs: queueStats.completed,
      failedJobs: queueStats.failed
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Code Ingestion Service');

    try {
      // Shutdown sub-services
      await this.fileWatcher.cleanup();
      await this.gitService.cleanup();
      await this.jobQueue.shutdown();

      this.removeAllListeners();
      this.isInitialized = false;

      logger.info('Code Ingestion Service shutdown completed');
    } catch (error) {
      logger.error('Error during Code Ingestion Service shutdown:', error);
      throw error;
    }
  }

  // Private methods

  private setupEventHandlers(): void {
    // Git service events
    this.gitService.on('commitsDetected', async ({ repository, commits }) => {
      logger.info(`New commits detected in ${repository.name}: ${commits.length} commits`);
      
      const changedFiles = commits.flatMap(commit => 
        commit.files.map(file => file.path)
      );

      await this.queueIncrementalAnalysis(
        repository.id,
        commits[0]?.hash,
        changedFiles,
        'file_watcher'
      );
    });

    // File watcher events
    this.fileWatcher.on('fileChanged', async ({ repository, event, language }) => {
      logger.debug(`File changed in ${repository.name}: ${event.path} (${language})`);
      
      await this.queueIncrementalAnalysis(
        repository.id,
        undefined,
        [event.path],
        'file_watcher'
      );
    });

    this.fileWatcher.on('ttlFileChanged', async (ttlChange: TTLFileChange) => {
      logger.info(`TTL file changed: ${ttlChange.filePath}`);
      
      await this.queueTTLSync(
        ttlChange.repositoryId,
        ttlChange.filePath
      );
    });

    // Job queue events
    this.jobQueue.on('processJob', async (job: IngestionJob) => {
      await this.processJob(job);
    });

    this.jobQueue.on('jobCompleted', (job: IngestionJob) => {
      this.updateMetrics(job);
      this.emit('jobCompleted', job);
    });

    this.jobQueue.on('jobFailed', (job: IngestionJob) => {
      this.updateMetrics(job);
      this.emit('jobFailed', job);
    });
  }

  private async processJob(job: IngestionJob): Promise<void> {
    const repository = this.getRepository(job.repositoryId);
    if (!repository) {
      this.jobQueue.failJob(job.id, `Repository not found: ${job.repositoryId}`);
      return;
    }

    try {
      logger.info(`Processing job ${job.id} (${job.type}) for repository ${repository.name}`);

      switch (job.type) {
        case 'full_analysis':
          await this.processFullAnalysis(job, repository);
          break;
        case 'incremental_analysis':
          await this.processIncrementalAnalysis(job, repository);
          break;
        case 'file_change':
          await this.processFileChange(job, repository);
          break;
        case 'ttl_sync':
          await this.processTTLSync(job, repository);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      this.jobQueue.completeJob(job.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Job ${job.id} failed:`, error);
      this.jobQueue.failJob(job.id, errorMessage);
    }
  }

  private async processFullAnalysis(job: IngestionJob, repository: Repository): Promise<void> {
    // Get all files to analyze
    const files = await this.fileWatcher.getWatchedFiles(repository.id);
    
    this.jobQueue.updateJobProgress(job.id, {
      totalFiles: files.length,
      processedFiles: 0
    });

    const results: FileAnalysisResult[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      const absolutePath = join(repository.path, filePath);
      
      this.jobQueue.updateJobProgress(job.id, {
        processedFiles: i,
        currentFile: filePath
      });

      try {
        const result = await this.astAnalyzer.analyzeFile(absolutePath);
        
        results.push({
          path: filePath,
          language: result.language,
          size: 0, // File size would need to be calculated separately
          linesOfCode: result.complexity.linesOfCode,
          complexity: result.complexity.cyclomaticComplexity,
          dependencies: result.dependencies,
          exports: result.exports.map(exp => exp.name),
          errors: result.errors.map(err => err.message),
          ttlGenerated: false // Will be updated by RDF generator
        });
      } catch (error) {
        logger.error(`Error analyzing file ${filePath}:`, error);
        results.push({
          path: filePath,
          language: 'unknown',
          size: 0,
          linesOfCode: 0,
          complexity: 0,
          dependencies: [],
          exports: [],
          errors: [error instanceof Error ? error.message : 'Analysis failed'],
          ttlGenerated: false
        });
      }
    }

    // Create analysis result
    const analysisResult: AnalysisResult = {
      repositoryId: repository.id,
      commitHash: repository.lastCommitHash || 'unknown',
      files: results,
      summary: this.createAnalysisSummary(results),
      timestamp: new Date()
    };

    this.emit('analysisCompleted', analysisResult);
  }

  private async processIncrementalAnalysis(job: IngestionJob, repository: Repository): Promise<void> {
    const changedFiles = job.metadata.changedFiles || [];
    
    this.jobQueue.updateJobProgress(job.id, {
      totalFiles: changedFiles.length,
      processedFiles: 0
    });

    const results: FileAnalysisResult[] = [];
    
    for (let i = 0; i < changedFiles.length; i++) {
      const filePath = changedFiles[i];
      const absolutePath = join(repository.path, filePath);
      
      this.jobQueue.updateJobProgress(job.id, {
        processedFiles: i,
        currentFile: filePath
      });

      try {
        const result = await this.astAnalyzer.analyzeFile(absolutePath);
        
        results.push({
          path: filePath,
          language: result.language,
          size: 0, // File size would need to be calculated separately
          linesOfCode: result.complexity.linesOfCode,
          complexity: result.complexity.cyclomaticComplexity,
          dependencies: result.dependencies,
          exports: result.exports.map(exp => exp.name),
          errors: result.errors.map(err => err.message),
          ttlGenerated: false
        });
      } catch (error) {
        logger.error(`Error analyzing file ${filePath}:`, error);
      }
    }

    const analysisResult: AnalysisResult = {
      repositoryId: repository.id,
      commitHash: job.metadata.commitHash || repository.lastCommitHash || 'unknown',
      files: results,
      summary: this.createAnalysisSummary(results),
      timestamp: new Date()
    };

    this.emit('analysisCompleted', analysisResult);
  }

  private async processFileChange(job: IngestionJob, repository: Repository): Promise<void> {
    // Similar to incremental analysis but for single file changes
    await this.processIncrementalAnalysis(job, repository);
  }

  private async processTTLSync(job: IngestionJob, repository: Repository): Promise<void> {
    const ttlFiles = job.metadata.changedFiles || [];
    
    this.jobQueue.updateJobProgress(job.id, {
      totalFiles: ttlFiles.length,
      processedFiles: 0
    });

    const syncResults: Array<{
      filePath: string;
      status: 'success' | 'error';
      error?: string;
      triplesCount?: number;
    }> = [];

    for (let i = 0; i < ttlFiles.length; i++) {
      const ttlFile = ttlFiles[i];
      const absolutePath = join(repository.path, ttlFile);
      
      this.jobQueue.updateJobProgress(job.id, {
        processedFiles: i,
        currentFile: ttlFile
      });

      try {
        logger.info(`Processing TTL file: ${ttlFile}`);
        
        // Read TTL file content
        const { readFile } = await import('fs/promises');
        const { existsSync } = await import('fs');
        
        if (!existsSync(absolutePath)) {
          logger.warn(`TTL file not found: ${absolutePath}`);
          syncResults.push({
            filePath: ttlFile,
            status: 'error',
            error: 'File not found'
          });
          continue;
        }

        const ttlContent = await readFile(absolutePath, 'utf-8');
        
        // Parse and validate TTL content
        const parseResult = await this.parseTTLContent(ttlContent, ttlFile);
        
        if (!parseResult.valid) {
          logger.error(`Invalid TTL content in ${ttlFile}: ${parseResult.error}`);
          const errorResult: typeof syncResults[0] = {
            filePath: ttlFile,
            status: 'error'
          };
          if (parseResult.error !== undefined) {
            errorResult.error = parseResult.error;
          }
          syncResults.push(errorResult);
          continue;
        }

        // Store TTL metadata for knowledge graph integration
        await this.storeTTLMetadata(repository.id, ttlFile, {
          content: ttlContent,
          triplesCount: parseResult.triplesCount,
          lastModified: new Date(),
          checksum: await this.calculateChecksum(ttlContent)
        });

        syncResults.push({
          filePath: ttlFile,
          status: 'success',
          triplesCount: parseResult.triplesCount
        });

        logger.info(`Successfully synced TTL file: ${ttlFile} (${parseResult.triplesCount} triples)`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error syncing TTL file ${ttlFile}:`, error);
        
        syncResults.push({
          filePath: ttlFile,
          status: 'error',
          error: errorMessage
        });
      }
    }

    // Emit completion event with detailed results
    this.emit('ttlSyncCompleted', {
      repositoryId: repository.id,
      files: ttlFiles,
      results: syncResults,
      successCount: syncResults.filter(r => r.status === 'success').length,
      errorCount: syncResults.filter(r => r.status === 'error').length
    });
  }

  private createAnalysisSummary(results: FileAnalysisResult[]): AnalysisSummary {
    const languageBreakdown: Record<string, number> = {};
    let totalComplexity = 0;
    let maxComplexity = 0;
    let minComplexity = Number.MAX_SAFE_INTEGER;
    let totalDependencies = 0;
    let totalErrors = 0;
    let ttlFilesGenerated = 0;

    for (const result of results) {
      // Language breakdown
      languageBreakdown[result.language] = (languageBreakdown[result.language] || 0) + 1;
      
      // Complexity metrics
      totalComplexity += result.complexity;
      maxComplexity = Math.max(maxComplexity, result.complexity);
      minComplexity = Math.min(minComplexity, result.complexity);
      
      // Other metrics
      totalDependencies += result.dependencies.length;
      totalErrors += result.errors.length;
      if (result.ttlGenerated) ttlFilesGenerated++;
    }

    return {
      totalFiles: results.length,
      languageBreakdown,
      complexityMetrics: {
        average: results.length > 0 ? totalComplexity / results.length : 0,
        max: maxComplexity === 0 ? 0 : maxComplexity,
        min: minComplexity === Number.MAX_SAFE_INTEGER ? 0 : minComplexity
      },
      dependencyCount: totalDependencies,
      errorCount: totalErrors,
      ttlFilesGenerated
    };
  }

  private updateMetrics(job: IngestionJob): void {
    if (job.completedAt && job.startedAt) {
      const processingTime = job.completedAt.getTime() - job.startedAt.getTime();
      
      // Update average processing time
      this.metrics.averageProcessingTime = 
        (this.metrics.averageProcessingTime + processingTime) / 2;
      
      // Update files processed per second
      if (job.progress.totalFiles > 0) {
        const filesPerSecond = job.progress.totalFiles / (processingTime / 1000);
        this.metrics.filesProcessedPerSecond = 
          (this.metrics.filesProcessedPerSecond + filesPerSecond) / 2;
      }
    }

    this.metrics.lastProcessingTime = new Date();
  }

  private async parseTTLContent(content: string, _filePath: string): Promise<{
    valid: boolean;
    error?: string;
    triplesCount: number;
  }> {
    try {
      // Basic TTL validation - check for common TTL patterns
      const lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
      
      // Count potential triples (lines ending with .)
      const triplesCount = lines.filter(line => line.trim().endsWith('.')).length;
      
      // Basic syntax validation
      const hasValidPrefixes = content.includes('@prefix') || content.includes('PREFIX');
      const hasTriples = triplesCount > 0;
      
      // Check for basic TTL syntax errors
      const invalidChars = /[^\w\s\-_:.<>@#"'()[\]{}|\\\/\n\r\t]/g;
      const suspiciousContent = content.match(invalidChars);
      
      if (suspiciousContent && suspiciousContent.length > 10) {
        return {
          valid: false,
          error: 'Content contains suspicious characters that may indicate invalid TTL syntax',
          triplesCount: 0
        };
      }

      // Validate basic structure
      if (!hasValidPrefixes && !hasTriples) {
        return {
          valid: false,
          error: 'TTL file appears to be empty or missing required prefixes and triples',
          triplesCount: 0
        };
      }

      return {
        valid: true,
        triplesCount
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
        triplesCount: 0
      };
    }
  }

  private async storeTTLMetadata(repositoryId: string, filePath: string, metadata: {
    content: string;
    triplesCount: number;
    lastModified: Date;
    checksum: string;
  }): Promise<void> {
    try {
      const { writeFile, mkdir } = await import('fs/promises');
      const { existsSync } = await import('fs');
      
      const metadataDir = `.aaswe/ttl-metadata/${repositoryId}`;
      const metadataFile = `${metadataDir}/${filePath.replace(/[\/\\]/g, '_')}.json`;
      
      // Ensure metadata directory exists
      if (!existsSync(metadataDir)) {
        await mkdir(metadataDir, { recursive: true });
      }

      const metadataRecord = {
        repositoryId,
        filePath,
        triplesCount: metadata.triplesCount,
        lastModified: metadata.lastModified.toISOString(),
        checksum: metadata.checksum,
        contentLength: metadata.content.length,
        syncedAt: new Date().toISOString()
      };

      await writeFile(metadataFile, JSON.stringify(metadataRecord, null, 2), 'utf-8');
      
      // Also store a registry of all TTL files for this repository
      const registryFile = `${metadataDir}/registry.json`;
      let registry: any = { files: [] };
      
      if (existsSync(registryFile)) {
        const { readFile } = await import('fs/promises');
        const registryContent = await readFile(registryFile, 'utf-8');
        registry = JSON.parse(registryContent);
      }

      // Update or add file entry
      const existingIndex = registry.files.findIndex((f: any) => f.filePath === filePath);
      if (existingIndex >= 0) {
        registry.files[existingIndex] = {
          filePath,
          triplesCount: metadata.triplesCount,
          lastModified: metadata.lastModified.toISOString(),
          checksum: metadata.checksum
        };
      } else {
        registry.files.push({
          filePath,
          triplesCount: metadata.triplesCount,
          lastModified: metadata.lastModified.toISOString(),
          checksum: metadata.checksum
        });
      }

      registry.lastUpdated = new Date().toISOString();
      registry.totalFiles = registry.files.length;
      registry.totalTriples = registry.files.reduce((sum: number, f: any) => sum + f.triplesCount, 0);

      await writeFile(registryFile, JSON.stringify(registry, null, 2), 'utf-8');
      
      logger.debug(`Stored TTL metadata for ${filePath} in repository ${repositoryId}`);
    } catch (error) {
      logger.error(`Failed to store TTL metadata for ${filePath}:`, error);
      throw error;
    }
  }

  private async calculateChecksum(content: string): Promise<string> {
    const { createHash } = await import('crypto');
    return createHash('sha256').update(content, 'utf-8').digest('hex');
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Code Ingestion Service not initialized. Call initialize() first.');
    }
  }
}

export default CodeIngestionService;