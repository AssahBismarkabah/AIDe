/**
 * Installation Detector
 * 
 * Detects package installations, updates, and dependency changes
 * to trigger appropriate analysis workflows.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import logger from '../../utils/logger';

export interface PackageChange {
  name: string;
  oldVersion?: string;
  newVersion: string;
  changeType: 'added' | 'updated' | 'removed';
  isDev: boolean;
}

export interface InstallationEvent {
  type: 'package_installed' | 'package_updated' | 'package_removed' | 'lockfile_changed';
  timestamp: Date;
  projectRoot: string;
  changes: PackageChange[];
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'unknown';
  triggerAnalysis: boolean;
}

export interface DetectorConfig {
  projectRoot: string;
  watchLockFiles: boolean;
  watchPackageJson: boolean;
  debounceDelay: number;
  ignoreDevDependencies: boolean;
}

/**
 * Installation Detector
 * 
 * Monitors package installations and dependency changes to trigger
 * automatic project analysis when significant changes occur.
 */
export class InstallationDetector extends EventEmitter {
  private config: DetectorConfig;
  private isActive = false;
  private watchers: any[] = [];
  private lastPackageSnapshot?: Map<string, string>;
  private debounceTimer?: NodeJS.Timeout | undefined;

  constructor(config: Partial<DetectorConfig> = {}) {
    super();
    
    this.config = {
      projectRoot: process.cwd(),
      watchLockFiles: true,
      watchPackageJson: true,
      debounceDelay: 3000, // 3 seconds
      ignoreDevDependencies: false,
      ...config
    };
  }

  /**
   * Start monitoring for installation events
   */
  async startMonitoring(): Promise<void> {
    if (this.isActive) {
      return;
    }

    try {
      logger.info('Starting installation monitoring', {
        projectRoot: this.config.projectRoot,
        watchLockFiles: this.config.watchLockFiles,
        watchPackageJson: this.config.watchPackageJson
      });

      // Take initial snapshot
      this.lastPackageSnapshot = await this.createPackageSnapshot();

      // Setup file watchers
      if (this.config.watchPackageJson) {
        await this.setupPackageJsonWatcher();
      }

      if (this.config.watchLockFiles) {
        await this.setupLockFileWatchers();
      }

      this.isActive = true;
      logger.info('Installation monitoring started successfully');

    } catch (error) {
      logger.error('Failed to start installation monitoring', { error });
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    logger.info('Stopping installation monitoring');

    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined as NodeJS.Timeout | undefined;
    }

    // Close all watchers
    for (const watcher of this.watchers) {
      try {
        watcher.close();
      } catch (error) {
        logger.warn('Failed to close watcher', { error });
      }
    }
    this.watchers = [];

    this.isActive = false;
    logger.info('Installation monitoring stopped');
  }

  /**
   * Manually detect changes (for testing or one-time checks)
   */
  async detectChanges(): Promise<InstallationEvent | null> {
    try {
      const currentSnapshot = await this.createPackageSnapshot();
      
      if (!this.lastPackageSnapshot) {
        this.lastPackageSnapshot = currentSnapshot;
        return null;
      }

      const changes = this.compareSnapshots(this.lastPackageSnapshot, currentSnapshot);
      
      if (changes.length === 0) {
        return null;
      }

      const event: InstallationEvent = {
        type: this.determineEventType(changes),
        timestamp: new Date(),
        projectRoot: this.config.projectRoot,
        changes,
        packageManager: await this.detectPackageManager(),
        triggerAnalysis: this.shouldTriggerAnalysis(changes)
      };

      this.lastPackageSnapshot = currentSnapshot;
      
      logger.info('Package changes detected', {
        changeCount: changes.length,
        triggerAnalysis: event.triggerAnalysis,
        changes: changes.map(c => `${c.name}: ${c.changeType}`)
      });

      return event;

    } catch (error) {
      logger.error('Failed to detect package changes', { error });
      return null;
    }
  }

  /**
   * Get current monitoring status
   */
  getStatus(): {
    isActive: boolean;
    config: DetectorConfig;
    watcherCount: number;
    lastSnapshot?: Date | undefined;
  } {
    return {
      isActive: this.isActive,
      config: { ...this.config },
      watcherCount: this.watchers.length,
      lastSnapshot: this.lastPackageSnapshot ? new Date() : undefined
    };
  }

  // Private methods

  private async setupPackageJsonWatcher(): Promise<void> {
    try {
      const chokidar = await import('chokidar');
      const packageJsonPath = path.join(this.config.projectRoot, 'package.json');
      
      const watcher = chokidar.watch(packageJsonPath, {
        persistent: false,
        ignoreInitial: true
      });
      
      watcher.on('change', () => {
        logger.debug('package.json changed');
        this.scheduleChangeDetection();
      });
      
      watcher.on('error', (error) => {
        logger.warn('Package.json watcher error', { error });
      });
      
      this.watchers.push(watcher);
      logger.debug('Package.json watcher setup completed');
      
    } catch (error) {
      logger.warn('Failed to setup package.json watcher', { error });
    }
  }

  private async setupLockFileWatchers(): Promise<void> {
    try {
      const chokidar = await import('chokidar');
      
      const lockFiles = [
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml'
      ];
      
      for (const lockFile of lockFiles) {
        const lockFilePath = path.join(this.config.projectRoot, lockFile);
        
        try {
          await fs.access(lockFilePath);
          
          const watcher = chokidar.watch(lockFilePath, {
            persistent: false,
            ignoreInitial: true
          });
          
          watcher.on('change', () => {
            logger.debug(`${lockFile} changed`);
            this.scheduleChangeDetection();
          });
          
          watcher.on('add', () => {
            logger.debug(`${lockFile} created`);
            this.scheduleChangeDetection();
          });
          
          watcher.on('error', (error) => {
            logger.warn(`${lockFile} watcher error`, { error });
          });
          
          this.watchers.push(watcher);
          logger.debug(`${lockFile} watcher setup completed`);
          
        } catch {
          // Lock file doesn't exist, skip
        }
      }
      
    } catch (error) {
      logger.warn('Failed to setup lock file watchers', { error });
    }
  }

  private scheduleChangeDetection(): void {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Schedule detection with debounce
    this.debounceTimer = setTimeout(async () => {
      try {
        const event = await this.detectChanges();
        if (event) {
          this.emit('installation_detected', event);
        }
      } catch (error) {
        logger.error('Failed to detect changes in scheduled detection', { error });
      }
    }, this.config.debounceDelay);
  }

  private async createPackageSnapshot(): Promise<Map<string, string>> {
    const snapshot = new Map<string, string>();
    
    try {
      const packageJsonPath = path.join(this.config.projectRoot, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      
      // Add production dependencies
      if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(packageJson.dependencies)) {
          snapshot.set(name, `prod:${version}`);
        }
      }
      
      // Add dev dependencies if not ignored
      if (!this.config.ignoreDevDependencies && packageJson.devDependencies) {
        for (const [name, version] of Object.entries(packageJson.devDependencies)) {
          snapshot.set(name, `dev:${version}`);
        }
      }
      
    } catch (error) {
      logger.warn('Failed to create package snapshot', { error });
    }
    
    return snapshot;
  }

  private compareSnapshots(
    oldSnapshot: Map<string, string>, 
    newSnapshot: Map<string, string>
  ): PackageChange[] {
    const changes: PackageChange[] = [];
    
    // Check for added and updated packages
    for (const [name, newVersionInfo] of newSnapshot) {
      const [newType, newVersion] = newVersionInfo.split(':');
      const isDev = newType === 'dev';
      
      if (!oldSnapshot.has(name)) {
        // Package added
        changes.push({
          name,
          newVersion,
          changeType: 'added',
          isDev
        });
      } else {
        const oldVersionInfo = oldSnapshot.get(name)!;
        const [, oldVersion] = oldVersionInfo.split(':');
        
        if (oldVersion !== newVersion) {
          // Package updated
          changes.push({
            name,
            oldVersion,
            newVersion,
            changeType: 'updated',
            isDev
          });
        }
      }
    }
    
    // Check for removed packages
    for (const [name, oldVersionInfo] of oldSnapshot) {
      if (!newSnapshot.has(name)) {
        const [oldType, oldVersion] = oldVersionInfo.split(':');
        const isDev = oldType === 'dev';
        
        changes.push({
          name,
          oldVersion,
          newVersion: '',
          changeType: 'removed',
          isDev
        });
      }
    }
    
    return changes;
  }

  private determineEventType(changes: PackageChange[]): InstallationEvent['type'] {
    const hasAdded = changes.some(c => c.changeType === 'added');
    const hasUpdated = changes.some(c => c.changeType === 'updated');
    const hasRemoved = changes.some(c => c.changeType === 'removed');
    
    if (hasAdded && !hasUpdated && !hasRemoved) {
      return 'package_installed';
    } else if (hasUpdated && !hasAdded && !hasRemoved) {
      return 'package_updated';
    } else if (hasRemoved && !hasAdded && !hasUpdated) {
      return 'package_removed';
    } else {
      return 'lockfile_changed';
    }
  }

  private shouldTriggerAnalysis(changes: PackageChange[]): boolean {
    // Don't trigger for dev dependencies if ignored
    if (this.config.ignoreDevDependencies) {
      const nonDevChanges = changes.filter(c => !c.isDev);
      if (nonDevChanges.length === 0) {
        return false;
      }
    }
    
    // Trigger analysis for any significant changes
    return changes.some(c => 
      c.changeType === 'added' || 
      c.changeType === 'updated' ||
      (c.changeType === 'removed' && !c.isDev)
    );
  }

  private async detectPackageManager(): Promise<InstallationEvent['packageManager']> {
    const lockFiles = [
      { file: 'package-lock.json', manager: 'npm' as const },
      { file: 'yarn.lock', manager: 'yarn' as const },
      { file: 'pnpm-lock.yaml', manager: 'pnpm' as const }
    ];
    
    for (const { file, manager } of lockFiles) {
      try {
        const lockFilePath = path.join(this.config.projectRoot, file);
        await fs.access(lockFilePath);
        return manager;
      } catch {
        // File doesn't exist, continue
      }
    }
    
    return 'unknown';
  }
}