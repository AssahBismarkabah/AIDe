/**
 * File Watcher Service
 * Handles real-time file system monitoring for code changes and TTL file synchronization
 */

import { watch, FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { join, extname, basename } from 'path';
import { stat } from 'fs/promises';
import { Stats } from 'fs';
import { glob } from 'glob';
import { minimatch } from 'minimatch';
import logger from '../../../utils/logger';
import {
  FileWatchEvent,
  FileStats,
  Repository,
  TTLFileChange,
  FileWatcherConfig
} from './types';

export class FileWatcher extends EventEmitter {
  private watchers: Map<string, FSWatcher> = new Map();
  private repositories: Map<string, Repository> = new Map();
  private config: FileWatcherConfig;

  constructor(config: Partial<FileWatcherConfig> = {}) {
    super();
    
    this.config = {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/coverage/**',
        '**/*.log',
        '**/.DS_Store',
        '**/Thumbs.db'
      ],
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      depth: 10,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 10
      },
      usePolling: false,
      interval: 100,
      binaryInterval: 300,
      ...config
    };
  }

  /**
   * Initialize file watcher service
   */
  async initialize(): Promise<void> {
    logger.info('Initializing File Watcher service');
    
    try {
      // Set up global error handling
      this.setupErrorHandling();
      
      logger.info('File Watcher service initialized');
    } catch (error) {
      logger.error('Failed to initialize File Watcher service:', error);
      throw error;
    }
  }

  /**
   * Start watching a repository
   */
  async startWatching(repository: Repository): Promise<void> {
    const watcherId = repository.id;
    
    logger.info(`Starting file watcher for repository: ${repository.name} at ${repository.path}`);
    
    try {
      // Stop existing watcher if any
      await this.stopWatching(watcherId);
      
      // Create patterns for watching
      const watchPatterns = this.createWatchPatterns(repository);
      
      // Initialize chokidar watcher
      const watcher = watch(watchPatterns, {
        ...this.config,
        cwd: repository.path,
        ignored: [
          ...this.config.ignored,
          ...repository.config.excludePatterns
        ]
      });

      // Set up event handlers
      this.setupWatcherEvents(watcher, repository);
      
      // Store watcher and repository
      this.watchers.set(watcherId, watcher);
      this.repositories.set(watcherId, repository);
      
      // Wait for watcher to be ready
      await new Promise<void>((resolve, reject) => {
        watcher.on('ready', () => {
          logger.info(`File watcher ready for repository: ${repository.name}`);
          resolve();
        });
        
        watcher.on('error', (error) => {
          logger.error(`File watcher error for repository ${repository.name}:`, error);
          reject(error);
        });
        
        // Timeout after 30 seconds
        setTimeout(() => {
          reject(new Error(`File watcher initialization timeout for repository: ${repository.name}`));
        }, 30000);
      });
      
    } catch (error) {
      logger.error(`Failed to start file watcher for repository ${repository.name}:`, error);
      throw error;
    }
  }

  /**
   * Stop watching a repository
   */
  async stopWatching(watcherId: string): Promise<void> {
    const watcher = this.watchers.get(watcherId);
    const repository = this.repositories.get(watcherId);
    
    if (watcher) {
      logger.info(`Stopping file watcher for repository: ${repository?.name || watcherId}`);
      
      try {
        await watcher.close();
        this.watchers.delete(watcherId);
        this.repositories.delete(watcherId);
        
        logger.info(`File watcher stopped for repository: ${repository?.name || watcherId}`);
      } catch (error) {
        logger.error(`Error stopping file watcher for repository ${repository?.name || watcherId}:`, error);
        throw error;
      }
    }
  }

  /**
   * Get watched files for a repository
   */
  async getWatchedFiles(repositoryId: string): Promise<string[]> {
    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      throw new Error(`Repository not found: ${repositoryId}`);
    }

    try {
      const patterns = repository.config.includePatterns;
      const files: string[] = [];
      
      for (const pattern of patterns) {
        const matches = await glob(pattern, {
          cwd: repository.path,
          ignore: [
            ...this.config.ignored,
            ...repository.config.excludePatterns
          ],
          absolute: false,
          dot: false
        });
        
        files.push(...matches);
      }
      
      // Remove duplicates and sort
      return [...new Set(files)].sort();
    } catch (error) {
      logger.error(`Error getting watched files for repository ${repository.name}:`, error);
      throw error;
    }
  }

  /**
   * Check if a file should be watched based on repository configuration
   */
  shouldWatchFile(repositoryId: string, filePath: string): boolean {
    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      return false;
    }

    // Check include patterns
    const included = repository.config.includePatterns.some(pattern =>
      minimatch(filePath, pattern)
    );
    
    if (!included) {
      return false;
    }

    // Check exclude patterns
    const excluded = repository.config.excludePatterns.some(pattern =>
      minimatch(filePath, pattern)
    );
    
    return !excluded;
  }

  /**
   * Get file statistics
   */
  async getFileStats(filePath: string): Promise<FileStats> {
    try {
      const stats = await stat(filePath);
      
      return {
        size: stats.size,
        mtime: stats.mtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile()
      };
    } catch (error) {
      logger.error(`Error getting file stats for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Cleanup all watchers
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up File Watcher service');
    
    const watcherIds = Array.from(this.watchers.keys());
    
    for (const watcherId of watcherIds) {
      try {
        await this.stopWatching(watcherId);
      } catch (error) {
        logger.error(`Error stopping watcher ${watcherId} during cleanup:`, error);
      }
    }
    
    this.removeAllListeners();
    logger.info('File Watcher service cleanup completed');
  }

  // Private helper methods

  private createWatchPatterns(repository: Repository): string[] {
    const patterns: string[] = [];
    
    // Add include patterns
    patterns.push(...repository.config.includePatterns);
    
    // Add TTL file pattern for knowledge graph synchronization
    patterns.push('**/.module-knowledge.ttl');
    
    return patterns;
  }

  private setupWatcherEvents(watcher: FSWatcher, repository: Repository): void {
    // File added
    watcher.on('add', async (path: string, stats?: Stats) => {
      try {
        const event = await this.createFileWatchEvent('add', path, repository, stats);
        this.handleFileEvent(event, repository);
      } catch (error) {
        logger.error(`Error handling file add event for ${path}:`, error);
      }
    });

    // File changed
    watcher.on('change', async (path: string, stats?: Stats) => {
      try {
        const event = await this.createFileWatchEvent('change', path, repository, stats);
        this.handleFileEvent(event, repository);
      } catch (error) {
        logger.error(`Error handling file change event for ${path}:`, error);
      }
    });

    // File removed
    watcher.on('unlink', async (path: string) => {
      try {
        const event = await this.createFileWatchEvent('unlink', path, repository);
        this.handleFileEvent(event, repository);
      } catch (error) {
        logger.error(`Error handling file unlink event for ${path}:`, error);
      }
    });

    // Directory added
    watcher.on('addDir', async (path: string, stats?: Stats) => {
      try {
        const event = await this.createFileWatchEvent('addDir', path, repository, stats);
        this.emit('directoryAdded', { repository, event });
      } catch (error) {
        logger.error(`Error handling directory add event for ${path}:`, error);
      }
    });

    // Directory removed
    watcher.on('unlinkDir', async (path: string) => {
      try {
        const event = await this.createFileWatchEvent('unlinkDir', path, repository);
        this.emit('directoryRemoved', { repository, event });
      } catch (error) {
        logger.error(`Error handling directory unlink event for ${path}:`, error);
      }
    });

    // Watcher errors
    watcher.on('error', (error: unknown) => {
      logger.error(`File watcher error for repository ${repository.name}:`, error);
      this.emit('watcherError', { repository, error });
    });
  }

  private async createFileWatchEvent(
    type: FileWatchEvent['type'],
    path: string,
    repository: Repository,
    stats?: Stats
  ): Promise<FileWatchEvent> {
    const absolutePath = join(repository.path, path);
    
    let fileStats: FileStats | undefined;
    
    if (stats) {
      fileStats = {
        size: stats.size,
        mtime: stats.mtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile()
      };
    } else if (type !== 'unlink' && type !== 'unlinkDir') {
      try {
        fileStats = await this.getFileStats(absolutePath);
      } catch (error) {
        // File might have been deleted between event and stat call
        logger.debug(`Could not get stats for ${absolutePath}:`, error);
      }
    }

    const event: FileWatchEvent = {
      type,
      path,
      timestamp: new Date()
    };
    
    if (fileStats !== undefined) {
      event.stats = fileStats;
    }
    
    return event;
  }

  private async handleFileEvent(event: FileWatchEvent, repository: Repository): Promise<void> {
    const filePath = event.path;
    
    // Check if it's a TTL file
    if (basename(filePath) === '.module-knowledge.ttl') {
      await this.handleTTLFileChange(event, repository);
      return;
    }

    // Check if file should be watched
    if (!this.shouldWatchFile(repository.id, filePath)) {
      return;
    }

    // Determine file language
    const language = this.detectFileLanguage(filePath);
    if (!language || !repository.config.languages.includes(language)) {
      return;
    }

    logger.debug(`File ${event.type} detected: ${filePath} (${language})`);
    
    // Emit file change event
    this.emit('fileChanged', {
      repository,
      event,
      language
    });
  }

  private async handleTTLFileChange(event: FileWatchEvent, repository: Repository): Promise<void> {
    logger.info(`TTL file ${event.type} detected: ${event.path}`);
    
    const ttlChange: TTLFileChange = {
      repositoryId: repository.id,
      filePath: event.path,
      changeType: event.type === 'unlink' ? 'deleted' :
                  event.type === 'add' ? 'created' : 'modified',
      timestamp: event.timestamp
    };
    
    if (event.stats !== undefined) {
      ttlChange.fileStats = event.stats;
    }

    this.emit('ttlFileChanged', ttlChange);
  }

  private detectFileLanguage(filePath: string): string | null {
    const ext = extname(filePath).toLowerCase();
    
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.c': 'cpp',
      '.h': 'cpp',
      '.hpp': 'cpp'
    };

    return languageMap[ext] || null;
  }

  private setupErrorHandling(): void {
    // Handle uncaught errors from watchers
    this.on('watcherError', ({ repository, error }) => {
      logger.error(`Watcher error for repository ${repository.name}:`, error);
      
      // Attempt to restart the watcher
      setTimeout(async () => {
        try {
          logger.info(`Attempting to restart watcher for repository: ${repository.name}`);
          await this.startWatching(repository);
        } catch (restartError) {
          logger.error(`Failed to restart watcher for repository ${repository.name}:`, restartError);
        }
      }, 5000);
    });
  }
}

export default FileWatcher;