/**
 * Ingestion Job Queue
 * Manages batch processing and job scheduling for code ingestion
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../../utils/logger';
import {
  IngestionJob,
  IngestionJobType,
  JobStatus,
  JobPriority,
  JobProgress,
  IngestionJobMetadata,
  IngestionConfig
} from './types';

export class IngestionJobQueue extends EventEmitter {
  private jobs: Map<string, IngestionJob> = new Map();
  private runningJobs: Set<string> = new Set();
  private config: IngestionConfig;
  private processingInterval?: NodeJS.Timeout;

  constructor(config: Partial<IngestionConfig> = {}) {
    super();
    
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
  }

  /**
   * Initialize the job queue
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Ingestion Job Queue');
    
    try {
      // Start job processing
      this.startProcessing();
      
      // Set up cleanup interval
      this.setupCleanup();
      
      logger.info(`Job queue initialized with max ${this.config.maxConcurrentJobs} concurrent jobs`);
    } catch (error) {
      logger.error('Failed to initialize job queue:', error);
      throw error;
    }
  }

  /**
   * Add a new ingestion job to the queue
   */
  async addJob(
    repositoryId: string,
    type: IngestionJobType,
    metadata: IngestionJobMetadata,
    priority: JobPriority = 'normal'
  ): Promise<IngestionJob> {
    const jobId = uuidv4();
    
    const job: IngestionJob = {
      id: jobId,
      repositoryId,
      type,
      status: 'pending',
      priority,
      createdAt: new Date(),
      progress: {
        totalFiles: 0,
        processedFiles: 0,
        percentage: 0
      },
      metadata
    };

    this.jobs.set(jobId, job);
    
    logger.info(`Job added to queue: ${jobId} (${type}) for repository ${repositoryId}`);
    
    this.emit('jobAdded', job);
    
    // Trigger processing
    this.processNextJob();
    
    return job;
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status === 'running') {
      // Mark for cancellation - the actual processing will handle this
      job.status = 'cancelled';
      logger.info(`Job marked for cancellation: ${jobId}`);
    } else if (job.status === 'pending') {
      job.status = 'cancelled';
      job.completedAt = new Date();
      logger.info(`Pending job cancelled: ${jobId}`);
    }

    this.emit('jobCancelled', job);
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): IngestionJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs for a repository
   */
  getRepositoryJobs(repositoryId: string): IngestionJob[] {
    return Array.from(this.jobs.values())
      .filter(job => job.repositoryId === repositoryId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: JobStatus): IngestionJob[] {
    return Array.from(this.jobs.values())
      .filter(job => job.status === status)
      .sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const jobs = Array.from(this.jobs.values());
    
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      running: jobs.filter(j => j.status === 'running').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      cancelled: jobs.filter(j => j.status === 'cancelled').length
    };
  }

  /**
   * Update job progress
   */
  updateJobProgress(jobId: string, progress: Partial<JobProgress>): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    job.progress = { ...job.progress, ...progress };
    
    // Calculate percentage if not provided
    if (progress.totalFiles !== undefined || progress.processedFiles !== undefined) {
      job.progress.percentage = job.progress.totalFiles > 0 
        ? Math.round((job.progress.processedFiles / job.progress.totalFiles) * 100)
        : 0;
    }

    this.emit('jobProgress', job);
  }

  /**
   * Mark job as completed
   */
  completeJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    job.status = 'completed';
    job.completedAt = new Date();
    job.progress.percentage = 100;
    
    this.runningJobs.delete(jobId);
    
    logger.info(`Job completed: ${jobId}`);
    this.emit('jobCompleted', job);
    
    // Process next job
    this.processNextJob();
  }

  /**
   * Mark job as failed
   */
  failJob(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    job.status = 'failed';
    job.completedAt = new Date();
    job.error = error;
    
    this.runningJobs.delete(jobId);
    
    logger.error(`Job failed: ${jobId} - ${error}`);
    this.emit('jobFailed', job);
    
    // Process next job
    this.processNextJob();
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'failed') {
      throw new Error(`Cannot retry job ${jobId}: not in failed state`);
    }

    // Reset job state
    job.status = 'pending';
    delete job.startedAt;
    delete job.completedAt;
    delete job.error;
    job.progress = {
      totalFiles: 0,
      processedFiles: 0,
      percentage: 0
    };

    logger.info(`Job queued for retry: ${jobId}`);
    this.emit('jobRetried', job);
    
    // Trigger processing
    this.processNextJob();
  }

  /**
   * Clear completed and failed jobs older than specified time
   */
  cleanup(olderThanHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    const jobsToRemove: string[] = [];

    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
        job.completedAt &&
        job.completedAt < cutoffTime
      ) {
        jobsToRemove.push(jobId);
      }
    }

    for (const jobId of jobsToRemove) {
      this.jobs.delete(jobId);
    }

    if (jobsToRemove.length > 0) {
      logger.info(`Cleaned up ${jobsToRemove.length} old jobs`);
    }
  }

  /**
   * Shutdown the job queue
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Ingestion Job Queue');
    
    // Stop processing
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Wait for running jobs to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.runningJobs.size > 0 && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.runningJobs.size > 0) {
      logger.warn(`Shutdown with ${this.runningJobs.size} jobs still running`);
    }

    this.removeAllListeners();
    logger.info('Job queue shutdown completed');
  }

  // Private methods

  private startProcessing(): void {
    // Process jobs immediately and then every 5 seconds
    this.processNextJob();
    
    this.processingInterval = setInterval(() => {
      this.processNextJob();
    }, 5000);
  }

  private async processNextJob(): Promise<void> {
    // Check if we can start more jobs
    if (this.runningJobs.size >= this.config.maxConcurrentJobs) {
      return;
    }

    // Get next pending job by priority
    const pendingJobs = this.getJobsByStatus('pending');
    if (pendingJobs.length === 0) {
      return;
    }

    const nextJob = pendingJobs[0];
    
    // Start the job
    await this.startJob(nextJob);
  }

  private async startJob(job: IngestionJob): Promise<void> {
    job.status = 'running';
    job.startedAt = new Date();
    this.runningJobs.add(job.id);
    
    logger.info(`Starting job: ${job.id} (${job.type})`);
    this.emit('jobStarted', job);
    
    try {
      // Emit job for processing by external handlers
      this.emit('processJob', job);
    } catch (error) {
      this.failJob(job.id, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private getPriorityWeight(priority: JobPriority): number {
    const weights = {
      'critical': 4,
      'high': 3,
      'normal': 2,
      'low': 1
    };
    return weights[priority];
  }

  private setupCleanup(): void {
    // Clean up old jobs every hour
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }
}

export default IngestionJobQueue;