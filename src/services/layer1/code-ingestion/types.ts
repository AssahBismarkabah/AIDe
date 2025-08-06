/**
 * Code Ingestion Service Types
 * Defines interfaces and types for code ingestion, Git integration, and file monitoring
 */

export interface Repository {
  id: string;
  name: string;
  path: string;
  url?: string;
  branch: string;
  lastCommitHash?: string;
  lastAnalyzed?: Date;
  status: RepositoryStatus;
  config: RepositoryConfig;
}

export type RepositoryStatus = 'active' | 'inactive' | 'analyzing' | 'error';

export interface RepositoryConfig {
  includePatterns: string[];
  excludePatterns: string[];
  languages: string[];
  enableWebhooks: boolean;
  enableFileWatcher: boolean;
  batchSize: number;
  analysisDepth: number;
}

export interface GitCommit {
  hash: string;
  author: string;
  email: string;
  message: string;
  timestamp: Date;
  files: GitFileChange[];
}

export interface GitFileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;
  additions: number;
  deletions: number;
}

export interface FileWatchEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  timestamp: Date;
  stats?: FileStats;
}

export interface FileStats {
  size: number;
  mtime: Date;
  isDirectory: boolean;
  isFile: boolean;
}

export interface IngestionJob {
  id: string;
  repositoryId: string;
  type: IngestionJobType;
  status: JobStatus;
  priority: JobPriority;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress: JobProgress;
  metadata: IngestionJobMetadata;
  error?: string;
}

export type IngestionJobType = 'full_analysis' | 'incremental_analysis' | 'file_change' | 'ttl_sync';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

export interface JobProgress {
  totalFiles: number;
  processedFiles: number;
  currentFile?: string;
  percentage: number;
  estimatedTimeRemaining?: number;
}

export interface IngestionJobMetadata {
  commitHash?: string;
  changedFiles?: string[];
  triggerType: 'manual' | 'webhook' | 'file_watcher' | 'scheduled';
  batchId?: string;
}

export interface WebhookPayload {
  repository: {
    id: string;
    name: string;
    url: string;
    branch: string;
  };
  commits: GitCommit[];
  pusher: {
    name: string;
    email: string;
  };
  timestamp: Date;
}

export interface AnalysisResult {
  repositoryId: string;
  commitHash: string;
  files: FileAnalysisResult[];
  summary: AnalysisSummary;
  timestamp: Date;
}

export interface FileAnalysisResult {
  path: string;
  language: string;
  size: number;
  linesOfCode: number;
  complexity: number;
  dependencies: string[];
  exports: string[];
  errors: string[];
  ttlGenerated: boolean;
  ttlPath?: string;
}

export interface AnalysisSummary {
  totalFiles: number;
  languageBreakdown: Record<string, number>;
  complexityMetrics: {
    average: number;
    max: number;
    min: number;
  };
  dependencyCount: number;
  errorCount: number;
  ttlFilesGenerated: number;
}

export interface TTLFileChange {
  repositoryId: string;
  filePath: string;
  changeType: 'created' | 'modified' | 'deleted';
  timestamp: Date;
  fileStats?: FileStats;
}

export interface IngestionConfig {
  maxConcurrentJobs: number;
  batchSize: number;
  retryAttempts: number;
  retryDelay: number;
  webhookSecret?: string;
  fileWatcherDebounce: number;
  supportedLanguages: string[];
  defaultExcludePatterns: string[];
}

export interface IngestionMetrics {
  totalRepositories: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  filesProcessedPerSecond: number;
  lastProcessingTime: Date;
}

export interface FileWatcherConfig {
  ignored: string[];
  persistent: boolean;
  ignoreInitial: boolean;
  followSymlinks: boolean;
  depth: number;
  awaitWriteFinish: {
    stabilityThreshold: number;
    pollInterval: number;
  };
  usePolling: boolean;
  interval: number;
  binaryInterval: number;
}