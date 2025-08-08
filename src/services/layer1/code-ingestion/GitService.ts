/**
 * Git Service
 * Handles Git repository operations, monitoring, and change detection
 */

import { simpleGit, StatusResult } from 'simple-git';
import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import * as path from 'path';
import logger from '../../../utils/logger';
import {
  Repository,
  GitCommit,
  GitFileChange,
  RepositoryConfig
} from './types';

export class GitService extends EventEmitter {
  private repositories: Map<string, Repository> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
  }

  /**
   * Initialize Git service and load existing repositories
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Git service');
    
    try {
      // Load repositories from configuration or database
      await this.loadRepositories();
      
      // Start monitoring active repositories
      for (const repo of this.repositories.values()) {
        if (repo.status === 'active') {
          await this.startMonitoring(repo.id);
        }
      }
      
      logger.info(`Git service initialized with ${this.repositories.size} repositories`);
    } catch (error) {
      logger.error('Failed to initialize Git service:', error);
      throw error;
    }
  }

  /**
   * Add a new repository for monitoring
   */
  async addRepository(config: {
    name: string;
    path: string;
    url?: string;
    branch?: string;
    config?: Partial<RepositoryConfig>;
  }): Promise<Repository> {
    const id = this.generateRepositoryId(config.name, config.path);
    
    logger.info(`Adding repository: ${config.name} at ${config.path}`);
    
    try {
      // Validate repository path
      if (!existsSync(config.path)) {
        throw new Error(`Repository path does not exist: ${config.path}`);
      }

      // Initialize Git instance for this repository
      const repoGit = simpleGit(config.path);
      
      // Check if it's a valid Git repository
      const isRepo = await repoGit.checkIsRepo();
      if (!isRepo) {
        throw new Error(`Path is not a Git repository: ${config.path}`);
      }

      // Get current branch and commit
      const status = await repoGit.status();
      const currentBranch = config.branch || status.current || 'main';
      const log = await repoGit.log(['-1']);
      const lastCommitHash = log.latest?.hash;

      // Create repository object
      const repository: Repository = {
        id,
        name: config.name,
        path: config.path,
        branch: currentBranch,
        status: 'active',
        config: {
          includePatterns: ['**/*.ts', '**/*.js', '**/*.py', '**/*.java', '**/*.go', '**/*.rs', '**/*.cpp'],
          excludePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '**/*.test.*'],
          languages: ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'cpp'],
          enableWebhooks: false,
          enableFileWatcher: true,
          batchSize: 100,
          analysisDepth: 10,
          ...config.config
        }
      };

      if (config.url !== undefined) {
        repository.url = config.url;
      }
      if (lastCommitHash !== undefined) {
        repository.lastCommitHash = lastCommitHash;
      }

      this.repositories.set(id, repository);
      
      // Save to persistent storage
      await this.saveRepositories();
      
      // Start monitoring if active
      if (repository.status === 'active') {
        await this.startMonitoring(id);
      }

      this.emit('repositoryAdded', repository);
      logger.info(`Repository added successfully: ${repository.name} (${id})`);
      
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
    logger.info(`Removing repository: ${repositoryId}`);
    
    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      throw new Error(`Repository not found: ${repositoryId}`);
    }

    // Stop monitoring
    await this.stopMonitoring(repositoryId);
    
    // Remove from collection
    this.repositories.delete(repositoryId);
    
    // Save to persistent storage
    await this.saveRepositories();
    
    this.emit('repositoryRemoved', repository);
    logger.info(`Repository removed: ${repository.name}`);
  }

  /**
   * Start monitoring a repository for changes
   */
  async startMonitoring(repositoryId: string): Promise<void> {
    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      throw new Error(`Repository not found: ${repositoryId}`);
    }

    // Stop existing monitoring if any
    await this.stopMonitoring(repositoryId);

    logger.info(`Starting Git monitoring for repository: ${repository.name}`);

    // Set up periodic polling for changes
    const interval = setInterval(async () => {
      try {
        await this.checkForChanges(repositoryId);
      } catch (error) {
        logger.error(`Error checking changes for repository ${repository.name}:`, error);
      }
    }, 30000); // Check every 30 seconds

    this.monitoringIntervals.set(repositoryId, interval);
    
    // Update repository status
    repository.status = 'active';
    this.repositories.set(repositoryId, repository);
  }

  /**
   * Stop monitoring a repository
   */
  async stopMonitoring(repositoryId: string): Promise<void> {
    const interval = this.monitoringIntervals.get(repositoryId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(repositoryId);
    }

    const repository = this.repositories.get(repositoryId);
    if (repository) {
      repository.status = 'inactive';
      this.repositories.set(repositoryId, repository);
      logger.info(`Stopped monitoring repository: ${repository.name}`);
    }
  }

  /**
   * Check for changes in a repository
   */
  async checkForChanges(repositoryId: string): Promise<void> {
    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      return;
    }

    try {
      const repoGit = simpleGit(repository.path);
      
      // Fetch latest changes
      await repoGit.fetch();
      
      // Get current commit
      const log = await repoGit.log(['-1']);
      const currentCommitHash = log.latest?.hash;
      
      // Check if there are new commits
      if (currentCommitHash && currentCommitHash !== repository.lastCommitHash) {
        logger.info(`New commits detected in repository: ${repository.name}`);
        
        // Get commits since last known commit
        const commits = await this.getCommitsSince(repository, repository.lastCommitHash);
        
        // Update repository
        repository.lastCommitHash = currentCommitHash;
        this.repositories.set(repositoryId, repository);
        
        // Emit change event
        this.emit('commitsDetected', {
          repository,
          commits
        });
      }
    } catch (error) {
      logger.error(`Error checking changes for repository ${repository.name}:`, error);
    }
  }

  /**
   * Get commits since a specific commit hash
   */
  async getCommitsSince(repository: Repository, sinceCommit?: string): Promise<GitCommit[]> {
    const repoGit = simpleGit(repository.path);
    const commits: GitCommit[] = [];

    try {
      const logOptions = sinceCommit ? [`${sinceCommit}..HEAD`] : ['-10']; // Last 10 commits if no since commit
      const log = await repoGit.log(logOptions);

      for (const commit of log.all) {
        // Get file changes for this commit
        const diffSummary = await repoGit.diffSummary([`${commit.hash}^`, commit.hash]);
        
        const files: GitFileChange[] = diffSummary.files.map(file => ({
          path: file.file,
          status: this.mapGitStatus(file),
          additions: 'insertions' in file ? file.insertions : 0,
          deletions: 'deletions' in file ? file.deletions : 0
        }));

        commits.push({
          hash: commit.hash,
          author: commit.author_name,
          email: commit.author_email,
          message: commit.message,
          timestamp: new Date(commit.date),
          files
        });
      }

      return commits;
    } catch (error) {
      logger.error(`Error getting commits for repository ${repository.name}:`, error);
      return [];
    }
  }

  /**
   * Get file changes between two commits
   */
  async getFileChanges(repositoryId: string, fromCommit: string, toCommit: string): Promise<GitFileChange[]> {
    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      throw new Error(`Repository not found: ${repositoryId}`);
    }

    try {
      const repoGit = simpleGit(repository.path);
      const diffSummary = await repoGit.diffSummary([fromCommit, toCommit]);
      
      return diffSummary.files.map(file => ({
        path: file.file,
        status: this.mapGitStatus(file),
        additions: 'insertions' in file ? file.insertions : 0,
        deletions: 'deletions' in file ? file.deletions : 0
      }));
    } catch (error) {
      logger.error(`Error getting file changes for repository ${repository.name}:`, error);
      throw error;
    }
  }

  /**
   * Get repository status
   */
  async getRepositoryStatus(repositoryId: string): Promise<StatusResult> {
    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      throw new Error(`Repository not found: ${repositoryId}`);
    }

    try {
      const repoGit = simpleGit(repository.path);
      return await repoGit.status();
    } catch (error) {
      logger.error(`Error getting status for repository ${repository.name}:`, error);
      throw error;
    }
  }

  /**
   * Get all repositories
   */
  getRepositories(): Repository[] {
    return Array.from(this.repositories.values());
  }

  /**
   * Get repository by ID
   */
  getRepository(repositoryId: string): Repository | undefined {
    return this.repositories.get(repositoryId);
  }

  /**
   * Update repository configuration
   */
  async updateRepositoryConfig(repositoryId: string, config: Partial<RepositoryConfig>): Promise<Repository> {
    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      throw new Error(`Repository not found: ${repositoryId}`);
    }

    repository.config = { ...repository.config, ...config };
    this.repositories.set(repositoryId, repository);
    
    // Save to persistent storage
    await this.saveRepositories();
    
    this.emit('repositoryUpdated', repository);
    logger.info(`Repository configuration updated: ${repository.name}`);
    
    return repository;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up Git service');
    
    // Stop all monitoring
    for (const repositoryId of this.repositories.keys()) {
      await this.stopMonitoring(repositoryId);
    }
    
    this.repositories.clear();
    this.removeAllListeners();
  }

  // Private helper methods

  private async loadRepositories(): Promise<void> {
    try {
      const { readFile } = await import('fs/promises');
      const { existsSync } = await import('fs');
      
      const configPath = '.aaswe/repositories.json';
      
      if (!existsSync(configPath)) {
        logger.debug('No repository configuration file found, auto-detecting current project');
        await this.autoDetectCurrentProject();
        return;
      }

      const configData = await readFile(configPath, 'utf-8');
      const repositoriesData = JSON.parse(configData);
      
      // Only load repositories that still exist on disk
      for (const repoData of repositoriesData.repositories || []) {
        // Validate repository data and check if path exists
        if (!repoData.id || !repoData.name || !repoData.path) {
          logger.debug(`Invalid repository data found in config: ${JSON.stringify(repoData)}`);
          continue;
        }

        // Check if repository path still exists
        if (!existsSync(repoData.path)) {
          logger.debug(`Repository path no longer exists, skipping: ${repoData.path}`);
          continue;
        }

        // Only load if it's the current project directory or a subdirectory
        const currentDir = process.cwd();
        if (!repoData.path.startsWith(currentDir) && !currentDir.startsWith(repoData.path)) {
          logger.debug(`Repository not related to current project, skipping: ${repoData.path}`);
          continue;
        }

        // Reconstruct repository object
        const repository: Repository = {
          id: repoData.id,
          name: repoData.name,
          path: repoData.path,
          branch: repoData.branch,
          status: repoData.status || 'inactive',
          config: {
            includePatterns: repoData.config?.includePatterns || ['**/*.ts', '**/*.js', '**/*.py', '**/*.java', '**/*.go', '**/*.rs', '**/*.cpp'],
            excludePatterns: repoData.config?.excludePatterns || ['node_modules/**', '.git/**', 'dist/**', 'build/**', '**/*.test.*'],
            languages: repoData.config?.languages || ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'cpp'],
            enableWebhooks: repoData.config?.enableWebhooks || false,
            enableFileWatcher: repoData.config?.enableFileWatcher !== false,
            batchSize: repoData.config?.batchSize || 100,
            analysisDepth: repoData.config?.analysisDepth || 10
          }
        };

        // Add optional fields if they exist
        if (repoData.url) repository.url = repoData.url;
        if (repoData.lastCommitHash) repository.lastCommitHash = repoData.lastCommitHash;
        if (repoData.lastAnalyzed) repository.lastAnalyzed = new Date(repoData.lastAnalyzed);

        this.repositories.set(repository.id, repository);
      }

      logger.info(`Loaded ${this.repositories.size} valid repositories from configuration`);
      
      // If no valid repositories found, auto-detect current project
      if (this.repositories.size === 0) {
        await this.autoDetectCurrentProject();
      }
    } catch (error) {
      logger.error('Failed to load repositories from storage:', error);
      // Fallback to auto-detection
      await this.autoDetectCurrentProject();
    }
  }

  private async saveRepositories(): Promise<void> {
    try {
      const { writeFile, mkdir } = await import('fs/promises');
      const { existsSync } = await import('fs');
      
      const configDir = '.aaswe';
      const configPath = `${configDir}/repositories.json`;
      
      // Only save if we have repositories and they're valid
      if (this.repositories.size === 0) {
        logger.debug('No repositories to save');
        return;
      }

      // Ensure config directory exists
      if (!existsSync(configDir)) {
        await mkdir(configDir, { recursive: true });
      }

      // Only save repositories that are related to the current project
      const currentDir = process.cwd();
      const validRepos = Array.from(this.repositories.values()).filter(repo =>
        repo.path.startsWith(currentDir) || currentDir.startsWith(repo.path)
      );

      const repositoriesData = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        projectRoot: currentDir,
        repositories: validRepos.map(repo => ({
          id: repo.id,
          name: repo.name,
          path: repo.path,
          url: repo.url,
          branch: repo.branch,
          lastCommitHash: repo.lastCommitHash,
          lastAnalyzed: repo.lastAnalyzed?.toISOString(),
          status: repo.status,
          config: repo.config
        }))
      };

      await writeFile(configPath, JSON.stringify(repositoriesData, null, 2), 'utf-8');
      logger.debug(`Saved ${validRepos.length} project repositories to configuration`);
    } catch (error) {
      logger.error('Failed to save repositories to storage:', error);
    }
  }

  /**
   * Auto-detect and add the current project as a repository
   */
  private async autoDetectCurrentProject(): Promise<void> {
    try {
      const currentDir = process.cwd();
      const repoGit = simpleGit(currentDir);
      
      // Check if current directory is a Git repository
      const isRepo = await repoGit.checkIsRepo();
      if (!isRepo) {
        logger.debug('Current directory is not a Git repository, skipping auto-detection');
        return;
      }

      // Get repository information
      const status = await repoGit.status();
      const log = await repoGit.log(['-1']);
      const remotes = await repoGit.getRemotes(true);
      
      const projectName = path.basename(currentDir);
      const originUrl = remotes.find(r => r.name === 'origin')?.refs?.fetch;
      
      const repository: Repository = {
        id: `${projectName}-${Date.now()}`,
        name: projectName,
        path: currentDir,
        branch: status.current || 'main',
        status: 'active',
        config: {
          includePatterns: ['**/*.ts', '**/*.js', '**/*.py', '**/*.java', '**/*.go', '**/*.rs', '**/*.cpp'],
          excludePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '**/*.test.*', '**/*.spec.*'],
          languages: ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'cpp'],
          enableWebhooks: false,
          enableFileWatcher: true,
          batchSize: 100,
          analysisDepth: 10
        }
      };

      // Add optional fields if they exist
      if (originUrl) {
        repository.url = originUrl;
      }
      if (log.latest?.hash) {
        repository.lastCommitHash = log.latest.hash;
      }

      this.repositories.set(repository.id, repository);
      await this.saveRepositories();
      
      logger.info('Auto-detected current project as repository', {
        name: repository.name,
        path: repository.path,
        branch: repository.branch
      });
    } catch (error) {
      logger.debug('Failed to auto-detect current project', { error });
    }
  }

  private generateRepositoryId(name: string, _path: string): string {
    const { v4: uuidv4 } = require('uuid');
    return `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${uuidv4().substring(0, 8)}`;
  }

  private mapGitStatus(file: any): 'added' | 'modified' | 'deleted' | 'renamed' {
    // Map Git file status to our enum
    if (file.binary) return 'modified';
    if (file.insertions > 0 && file.deletions === 0) return 'added';
    if (file.insertions === 0 && file.deletions > 0) return 'deleted';
    return 'modified';
  }
}

export default GitService;