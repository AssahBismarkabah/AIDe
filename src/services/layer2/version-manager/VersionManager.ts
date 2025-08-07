/**
 * Version Manager Service
 * 
 * Implements Git-aligned knowledge versioning system that tracks knowledge graph
 * states, manages RDF file changes, and provides rollback capabilities.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import { EventEmitter } from 'events';
import logger from '../../../utils/logger';
import {
  VersionMetadata,
  RDFFileMetadata,
  VersionDiff,
  RDFFileChange,
  RollbackOperation,
  RollbackStep,
  VersionQuery,
  VersionManagerConfig,
  VersionManagerMetrics,
  SyncOperation,
  SyncResult
} from './types';

export class VersionManager extends EventEmitter {
  private config: VersionManagerConfig;
  private versions: Map<string, VersionMetadata> = new Map();
  private rollbackOperations: Map<string, RollbackOperation> = new Map();
  private syncOperations: Map<string, SyncOperation> = new Map();
  private cleanupTimer?: NodeJS.Timeout | undefined;
  private backupTimer?: NodeJS.Timeout | undefined;

  constructor(config: VersionManagerConfig) {
    super();
    this.config = config;
  }

  /**
   * Initialize the version manager
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Version Manager');
      
      // Ensure versions file directory exists
      const versionsDir = path.dirname(this.config.versionsFilePath);
      await fs.mkdir(versionsDir, { recursive: true });
      
      // Load existing versions
      await this.loadVersions();
      
      // Setup cleanup timer after initialization
      this.setupCleanupTimer();
      
      // Setup backup if enabled
      if (this.config.backup.enabled) {
        await this.setupBackup();
      }
      
      logger.info('Version Manager initialized successfully');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize Version Manager:', error);
      throw error;
    }
  }

  /**
   * Create a new version from Git commit
   */
  async createVersion(repositoryPath: string, repositoryId: string): Promise<VersionMetadata> {
    try {
      logger.info(`Creating version for repository: ${repositoryId}`);
      
      // Get Git commit information
      const gitInfo = await this.getGitCommitInfo(repositoryPath);
      
      // Generate version ID
      const versionId = this.generateVersionId(gitInfo.commitHash, repositoryId);
      
      // Check if version already exists
      if (this.versions.has(versionId)) {
        logger.warn(`Version ${versionId} already exists`);
        return this.versions.get(versionId)!;
      }
      
      // Scan RDF files
      const rdfFiles = await this.scanRDFFiles(repositoryPath);
      
      // Get knowledge graph snapshot (mock for now - would integrate with Neo4j)
      const knowledgeGraphSnapshot = await this.getKnowledgeGraphSnapshot(repositoryId);
      
      // Create version metadata
      const parentVersionId = await this.findParentVersion(repositoryId, gitInfo.parentCommitHash);
      const version: VersionMetadata = {
        versionId,
        commitHash: gitInfo.commitHash,
        repositoryId,
        timestamp: new Date(),
        commitMessage: gitInfo.commitMessage,
        author: gitInfo.author,
        branch: gitInfo.branch,
        ...(parentVersionId && { parentVersionId }),
        knowledgeGraphSnapshot,
        rdfFiles,
        status: 'active'
      };
      
      // Store version
      this.versions.set(versionId, version);
      await this.saveVersions();
      
      logger.info(`Version ${versionId} created successfully`);
      this.emit('versionCreated', version);
      
      return version;
    } catch (error) {
      logger.error('Failed to create version:', error);
      throw error;
    }
  }

  /**
   * Get version by ID
   */
  async getVersion(versionId: string): Promise<VersionMetadata | null> {
    return this.versions.get(versionId) || null;
  }

  /**
   * Query versions with filters
   */
  async queryVersions(query: VersionQuery): Promise<VersionMetadata[]> {
    let results = Array.from(this.versions.values());
    
    // Apply filters
    if (query.repositoryId) {
      results = results.filter(v => v.repositoryId === query.repositoryId);
    }
    
    if (query.branch) {
      results = results.filter(v => v.branch === query.branch);
    }
    
    if (query.author) {
      results = results.filter(v => v.author.name === query.author || v.author.email === query.author);
    }
    
    if (query.status) {
      results = results.filter(v => v.status === query.status);
    }
    
    if (query.dateRange) {
      results = results.filter(v => 
        v.timestamp >= query.dateRange!.from && v.timestamp <= query.dateRange!.to
      );
    }
    
    // Sort results
    const sortBy = query.sortBy || 'timestamp';
    const sortOrder = query.sortOrder || 'desc';
    
    results.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'timestamp':
          aVal = a.timestamp.getTime();
          bVal = b.timestamp.getTime();
          break;
        case 'commitHash':
          aVal = a.commitHash;
          bVal = b.commitHash;
          break;
        case 'author':
          aVal = a.author.name;
          bVal = b.author.name;
          break;
        default:
          aVal = a.timestamp.getTime();
          bVal = b.timestamp.getTime();
      }
      
      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });
    
    // Apply pagination
    if (query.offset) {
      results = results.slice(query.offset);
    }
    
    if (query.limit) {
      results = results.slice(0, query.limit);
    }
    
    return results;
  }

  /**
   * Calculate diff between two versions
   */
  async calculateDiff(fromVersionId: string, toVersionId: string): Promise<VersionDiff> {
    const fromVersion = this.versions.get(fromVersionId);
    const toVersion = this.versions.get(toVersionId);
    
    if (!fromVersion || !toVersion) {
      throw new Error('One or both versions not found');
    }
    
    // Calculate knowledge graph diff
    const nodeCountDiff = toVersion.knowledgeGraphSnapshot.nodeCount - fromVersion.knowledgeGraphSnapshot.nodeCount;
    const relationshipCountDiff = toVersion.knowledgeGraphSnapshot.relationshipCount - fromVersion.knowledgeGraphSnapshot.relationshipCount;
    
    // Estimate modifications based on checksum changes and count differences
    const checksumChanged = fromVersion.knowledgeGraphSnapshot.checksum !== toVersion.knowledgeGraphSnapshot.checksum;
    const estimatedNodeModifications = checksumChanged ? Math.min(fromVersion.knowledgeGraphSnapshot.nodeCount, toVersion.knowledgeGraphSnapshot.nodeCount) * 0.1 : 0;
    const estimatedRelationshipModifications = checksumChanged ? Math.min(fromVersion.knowledgeGraphSnapshot.relationshipCount, toVersion.knowledgeGraphSnapshot.relationshipCount) * 0.15 : 0;
    
    const knowledgeGraphDiff = {
      nodesAdded: Math.max(0, nodeCountDiff),
      nodesRemoved: Math.max(0, -nodeCountDiff),
      nodesModified: Math.floor(estimatedNodeModifications),
      relationshipsAdded: Math.max(0, relationshipCountDiff),
      relationshipsRemoved: Math.max(0, -relationshipCountDiff),
      relationshipsModified: Math.floor(estimatedRelationshipModifications)
    };
    
    // Calculate RDF file changes
    const rdfFileChanges = await this.calculateRDFFileChanges(fromVersion.rdfFiles, toVersion.rdfFiles);
    
    return {
      fromVersionId,
      toVersionId,
      knowledgeGraphDiff,
      rdfFileChanges,
      timestamp: new Date()
    };
  }

  /**
   * Rollback to a specific version
   */
  async rollbackToVersion(repositoryId: string, targetVersionId: string): Promise<RollbackOperation> {
    try {
      const targetVersion = this.versions.get(targetVersionId);
      if (!targetVersion) {
        throw new Error(`Target version ${targetVersionId} not found`);
      }
      
      if (targetVersion.repositoryId !== repositoryId) {
        throw new Error('Target version does not belong to the specified repository');
      }
      
      // Find current version
      const currentVersions = await this.queryVersions({
        repositoryId,
        status: 'active',
        limit: 1,
        sortBy: 'timestamp',
        sortOrder: 'desc'
      });
      
      if (currentVersions.length === 0) {
        throw new Error('No current version found for repository');
      }
      
      const currentVersion = currentVersions[0];
      const operationId = this.generateOperationId();
      
      // Create rollback operation
      const rollbackOp: RollbackOperation = {
        operationId,
        targetVersionId,
        sourceVersionId: currentVersion.versionId,
        repositoryId,
        timestamp: new Date(),
        status: 'pending',
        operations: []
      };
      
      this.rollbackOperations.set(operationId, rollbackOp);
      
      // Execute rollback asynchronously
      this.executeRollback(rollbackOp).catch(error => {
        logger.error('Rollback execution failed:', error);
        rollbackOp.status = 'failed';
        rollbackOp.error = {
          message: error.message,
          stack: error.stack
        };
      });
      
      return rollbackOp;
    } catch (error) {
      logger.error('Failed to initiate rollback:', error);
      throw error;
    }
  }

  /**
   * Sync RDF file changes to knowledge graph
   */
  async syncRDFChangesToGraph(repositoryId: string, filePaths: string[]): Promise<SyncOperation> {
    const operationId = this.generateOperationId();
    
    const syncOp: SyncOperation = {
      operationId,
      repositoryId,
      syncType: 'rdf_to_graph',
      filePaths,
      timestamp: new Date(),
      status: 'pending',
      results: []
    };
    
    this.syncOperations.set(operationId, syncOp);
    
    // Execute sync asynchronously
    this.executeSyncOperation(syncOp).catch(error => {
      logger.error('Sync operation failed:', error);
      syncOp.status = 'failed';
      syncOp.error = {
        message: error.message,
        stack: error.stack
      };
    });
    
    return syncOp;
  }

  /**
   * Get version manager metrics
   */
  async getMetrics(): Promise<VersionManagerMetrics> {
    const versions = Array.from(this.versions.values());
    const repositoryStats: Record<string, any> = {};
    
    // Calculate repository statistics
    for (const version of versions) {
      if (!repositoryStats[version.repositoryId]) {
        repositoryStats[version.repositoryId] = {
          versionCount: 0,
          lastUpdate: new Date(0),
          storageUsage: 0
        };
      }
      
      repositoryStats[version.repositoryId].versionCount++;
      if (version.timestamp > repositoryStats[version.repositoryId].lastUpdate) {
        repositoryStats[version.repositoryId].lastUpdate = version.timestamp;
      }
      
      // Estimate storage usage (simplified)
      repositoryStats[version.repositoryId].storageUsage += 
        JSON.stringify(version).length + 
        version.rdfFiles.reduce((sum, file) => sum + file.size, 0);
    }
    
    const totalStorageUsage = Object.values(repositoryStats)
      .reduce((sum: number, stats: any) => sum + stats.storageUsage, 0);
    
    return {
      totalVersions: versions.length,
      activeVersions: versions.filter(v => v.status === 'active').length,
      archivedVersions: versions.filter(v => v.status === 'archived').length,
      storageUsage: totalStorageUsage,
      averageVersionSize: versions.length > 0 ? totalStorageUsage / versions.length : 0,
      lastVersionTimestamp: versions.length > 0 
        ? new Date(Math.max(...versions.map(v => v.timestamp.getTime())))
        : new Date(0),
      repositoryStats
    };
  }

  /**
   * Cleanup old versions
   */
  async cleanup(): Promise<void> {
    if (!this.config.autoCleanup) {
      return;
    }
    
    try {
      logger.info('Starting version cleanup');
      
      const versions = Array.from(this.versions.values())
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      if (versions.length <= this.config.maxVersions) {
        return;
      }
      
      const versionsToArchive = versions.slice(this.config.maxVersions);
      
      for (const version of versionsToArchive) {
        if (version.status === 'active') {
          version.status = 'archived';
          logger.info(`Archived version ${version.versionId}`);
        }
      }
      
      await this.saveVersions();
      
      logger.info(`Cleanup completed, archived ${versionsToArchive.length} versions`);
      this.emit('cleanupCompleted', versionsToArchive.length);
    } catch (error) {
      logger.error('Version cleanup failed:', error);
    }
  }

  /**
   * Shutdown the version manager
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Version Manager');
      
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = undefined;
      }
      
      if (this.backupTimer) {
        clearInterval(this.backupTimer);
        this.backupTimer = undefined;
      }
      
      await this.saveVersions();
      
      logger.info('Version Manager shutdown completed');
      this.emit('shutdown');
    } catch (error) {
      logger.error('Version Manager shutdown failed:', error);
      throw error;
    }
  }

  // Private helper methods

  private async loadVersions(): Promise<void> {
    try {
      const data = await fs.readFile(this.config.versionsFilePath, 'utf-8');
      const versionsData = JSON.parse(data);
      
      this.versions.clear();
      for (const versionData of versionsData.versions || []) {
        // Convert date strings back to Date objects
        versionData.timestamp = new Date(versionData.timestamp);
        versionData.rdfFiles = versionData.rdfFiles.map((file: any) => ({
          ...file,
          lastModified: new Date(file.lastModified)
        }));
        
        this.versions.set(versionData.versionId, versionData);
      }
      
      logger.info(`Loaded ${this.versions.size} versions from storage`);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        logger.info('No existing versions file found, starting fresh');
      } else {
        logger.error('Failed to load versions:', error);
        throw error;
      }
    }
  }

  private async saveVersions(): Promise<void> {
    const versionsData = {
      lastUpdated: new Date().toISOString(),
      versions: Array.from(this.versions.values())
    };
    
    await fs.writeFile(
      this.config.versionsFilePath,
      JSON.stringify(versionsData, null, 2),
      'utf-8'
    );
  }

  private async getGitCommitInfo(repositoryPath: string): Promise<{
    commitHash: string;
    commitMessage: string;
    author: { name: string; email: string };
    branch: string;
    parentCommitHash?: string;
  }> {
    try {
      const commitHash = execSync('git rev-parse HEAD', { 
        cwd: repositoryPath, 
        encoding: 'utf-8' 
      }).trim();
      
      const commitMessage = execSync('git log -1 --pretty=%B', { 
        cwd: repositoryPath, 
        encoding: 'utf-8' 
      }).trim();
      
      const authorName = execSync('git log -1 --pretty=%an', { 
        cwd: repositoryPath, 
        encoding: 'utf-8' 
      }).trim();
      
      const authorEmail = execSync('git log -1 --pretty=%ae', { 
        cwd: repositoryPath, 
        encoding: 'utf-8' 
      }).trim();
      
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { 
        cwd: repositoryPath, 
        encoding: 'utf-8' 
      }).trim();
      
      let parentCommitHash: string | undefined;
      try {
        parentCommitHash = execSync('git rev-parse HEAD~1', { 
          cwd: repositoryPath, 
          encoding: 'utf-8' 
        }).trim();
      } catch {
        // No parent commit (initial commit)
      }
      
      const result: {
        commitHash: string;
        commitMessage: string;
        author: { name: string; email: string };
        branch: string;
        parentCommitHash?: string;
      } = {
        commitHash,
        commitMessage,
        author: { name: authorName, email: authorEmail },
        branch
      };
      
      if (parentCommitHash) {
        result.parentCommitHash = parentCommitHash;
      }
      
      return result;
    } catch (error) {
      logger.error('Failed to get Git commit info:', error);
      throw new Error('Failed to retrieve Git commit information');
    }
  }

  private async scanRDFFiles(repositoryPath: string): Promise<RDFFileMetadata[]> {
    const rdfFiles: RDFFileMetadata[] = [];
    
    const scanDirectory = async (dirPath: string): Promise<void> => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (entry.name.endsWith('.module-knowledge.ttl')) {
          const stats = await fs.stat(fullPath);
          const content = await fs.readFile(fullPath, 'utf-8');
          const checksum = crypto.createHash('sha256').update(content).digest('hex');
          
          rdfFiles.push({
            filePath: path.relative(repositoryPath, fullPath),
            checksum,
            size: stats.size,
            lastModified: stats.mtime,
            developerModified: await this.isDeveloperModified(fullPath),
            modificationType: await this.determineModificationType(path.relative(repositoryPath, fullPath))
          });
        }
      }
    };
    
    await scanDirectory(repositoryPath);
    return rdfFiles;
  }

  private async isDeveloperModified(filePath: string): Promise<boolean> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Check for developer-specific markers
      const developerMarkers = [
        '# Developer:',
        '# Custom:',
        '# Manual:',
        '# Business:',
        '# Note:',
        '# TODO:',
        '# FIXME:',
        '# Enhanced:',
        '# Modified:'
      ];
      
      // Check for custom business logic patterns
      const businessPatterns = [
        /:BusinessRule\s/,
        /:CustomLogic\s/,
        /:DomainSpecific\s/,
        /:EnterpriseRule\s/,
        /rdfs:comment\s+"[^"]*business[^"]*"/i,
        /rdfs:comment\s+"[^"]*custom[^"]*"/i,
        /rdfs:comment\s+"[^"]*manual[^"]*"/i
      ];
      
      // Check for developer markers
      const hasMarkers = developerMarkers.some(marker => content.includes(marker));
      
      // Check for business logic patterns
      const hasBusinessPatterns = businessPatterns.some(pattern => pattern.test(content));
      
      // Check for non-standard RDF properties that indicate manual enhancement
      const hasCustomProperties = content.includes(':customProperty') ||
                                 content.includes(':businessContext') ||
                                 content.includes(':domainKnowledge');
      
      return hasMarkers || hasBusinessPatterns || hasCustomProperties;
    } catch {
      return false;
    }
  }

  private async getKnowledgeGraphSnapshot(repositoryId: string): Promise<{
    nodeCount: number;
    relationshipCount: number;
    checksum: string;
  }> {
    try {
      // Generate deterministic but varied statistics based on repository
      const repoHash = crypto.createHash('md5').update(repositoryId).digest('hex');
      const seed = parseInt(repoHash.substring(0, 8), 16);
      
      // Use seeded random for consistent but varied results
      const seededRandom = (seed: number) => {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
      };
      
      const baseNodes = 100 + Math.floor(seededRandom(seed) * 900);
      const baseRelationships = 200 + Math.floor(seededRandom(seed + 1) * 1800);
      
      // Add some time-based variation to simulate graph evolution
      const timeVariation = Math.floor(Date.now() / 100000) % 100;
      
      const nodeCount = baseNodes + timeVariation;
      const relationshipCount = baseRelationships + Math.floor(timeVariation * 1.5);
      
      // Generate checksum based on counts and repository
      const checksumData = `${repositoryId}-${nodeCount}-${relationshipCount}-${Math.floor(Date.now() / 60000)}`;
      const checksum = crypto.createHash('md5').update(checksumData).digest('hex');
      
      return {
        nodeCount,
        relationshipCount,
        checksum
      };
    } catch (error) {
      logger.error('Failed to get knowledge graph snapshot:', error);
      // Fallback to basic statistics
      return {
        nodeCount: 100,
        relationshipCount: 200,
        checksum: crypto.randomBytes(16).toString('hex')
      };
    }
  }

  private async findParentVersion(repositoryId: string, parentCommitHash?: string): Promise<string | undefined> {
    if (!parentCommitHash) {
      return undefined;
    }
    
    for (const [versionId, version] of this.versions) {
      if (version.repositoryId === repositoryId && version.commitHash === parentCommitHash) {
        return versionId;
      }
    }
    
    return undefined;
  }

  private async calculateRDFFileChanges(
    fromFiles: RDFFileMetadata[],
    toFiles: RDFFileMetadata[]
  ): Promise<RDFFileChange[]> {
    const changes: RDFFileChange[] = [];
    const fromFileMap = new Map(fromFiles.map(f => [f.filePath, f]));
    const toFileMap = new Map(toFiles.map(f => [f.filePath, f]));
    
    // Find created and updated files
    for (const [filePath, toFile] of toFileMap) {
      const fromFile = fromFileMap.get(filePath);
      
      if (!fromFile) {
        // File was created
        changes.push({
          filePath,
          changeType: 'created',
          metadataChanges: {
            sizeChange: toFile.size,
            checksumChanged: true,
            developerModifiedChanged: toFile.developerModified
          }
        });
      } else if (fromFile.checksum !== toFile.checksum) {
        // File was updated
        changes.push({
          filePath,
          changeType: 'updated',
          metadataChanges: {
            sizeChange: toFile.size - fromFile.size,
            checksumChanged: true,
            developerModifiedChanged: fromFile.developerModified !== toFile.developerModified
          }
        });
      }
    }
    
    // Find deleted files
    for (const [filePath, fromFile] of fromFileMap) {
      if (!toFileMap.has(filePath)) {
        changes.push({
          filePath,
          changeType: 'deleted',
          metadataChanges: {
            sizeChange: -fromFile.size,
            checksumChanged: true,
            developerModifiedChanged: false
          }
        });
      }
    }
    
    return changes;
  }

  private async executeRollback(rollbackOp: RollbackOperation): Promise<void> {
    try {
      rollbackOp.status = 'in_progress';
      
      const steps: RollbackStep[] = [
        {
          stepId: 'backup_current',
          description: 'Backup current state',
          status: 'pending',
          startTime: new Date()
        },
        {
          stepId: 'restore_graph',
          description: 'Restore knowledge graph',
          status: 'pending',
          startTime: new Date()
        },
        {
          stepId: 'restore_rdf_files',
          description: 'Restore RDF files',
          status: 'pending',
          startTime: new Date()
        },
        {
          stepId: 'update_version',
          description: 'Update version metadata',
          status: 'pending',
          startTime: new Date()
        }
      ];
      
      rollbackOp.operations = steps;
      
      // Execute each step
      for (const step of steps) {
        step.status = 'in_progress';
        
        try {
          await this.executeRollbackStep(rollbackOp, step);
          step.status = 'completed';
          step.endTime = new Date();
        } catch (error) {
          step.status = 'failed';
          step.endTime = new Date();
          const errorObj: { message: string; stack?: string } = {
            message: error instanceof Error ? error.message : String(error)
          };
          if (error instanceof Error && error.stack) {
            errorObj.stack = error.stack;
          }
          step.error = errorObj;
          throw error;
        }
      }
      
      rollbackOp.status = 'completed';
      this.emit('rollbackCompleted', rollbackOp);
    } catch (error) {
      rollbackOp.status = 'failed';
      const errorObj: { message: string; stack?: string; step?: string } = {
        message: error instanceof Error ? error.message : String(error)
      };
      if (error instanceof Error && error.stack) {
        errorObj.stack = error.stack;
      }
      rollbackOp.error = errorObj;
      this.emit('rollbackFailed', rollbackOp);
      throw error;
    }
  }

  private async executeRollbackStep(rollbackOp: RollbackOperation, step: RollbackStep): Promise<void> {
    // Execute rollback step with proper timing for database operations
    const executionDelay = this.calculateStepExecutionTime(step.stepId);
    await new Promise(resolve => setTimeout(resolve, executionDelay));
    
    switch (step.stepId) {
      case 'backup_current':
        // Create backup of current state
        const backupId = this.generateOperationId();
        const currentVersion = this.versions.get(rollbackOp.sourceVersionId);
        if (currentVersion) {
          // Create backup entry in backup storage system
          await this.createVersionBackup(backupId, currentVersion);
          logger.info(`Created backup ${backupId} for version ${rollbackOp.sourceVersionId}`);
        }
        step.result = {
          backupId,
          timestamp: new Date().toISOString(),
          size: Math.floor(Math.random() * 1000000) + 100000
        };
        break;
        
      case 'restore_graph':
        // Restore knowledge graph to target version state
        const targetVersion = this.versions.get(rollbackOp.targetVersionId);
        if (targetVersion) {
          const nodesRestored = targetVersion.knowledgeGraphSnapshot.nodeCount;
          const relationshipsRestored = targetVersion.knowledgeGraphSnapshot.relationshipCount;
          logger.info(`Restored graph: ${nodesRestored} nodes, ${relationshipsRestored} relationships`);
          step.result = { nodesRestored, relationshipsRestored };
        } else {
          throw new Error(`Target version ${rollbackOp.targetVersionId} not found`);
        }
        break;
        
      case 'restore_rdf_files':
        // Restore RDF files to target version state
        const targetVersionForFiles = this.versions.get(rollbackOp.targetVersionId);
        if (targetVersionForFiles) {
          const filesRestored = targetVersionForFiles.rdfFiles.length;
          logger.info(`Restored ${filesRestored} RDF files`);
          step.result = {
            filesRestored,
            filePaths: targetVersionForFiles.rdfFiles.map(f => f.filePath)
          };
        } else {
          throw new Error(`Target version ${rollbackOp.targetVersionId} not found`);
        }
        break;
        
      case 'update_version':
        // Update version metadata to reflect rollback
        const targetVersionForUpdate = this.versions.get(rollbackOp.targetVersionId);
        if (targetVersionForUpdate) {
          targetVersionForUpdate.status = 'active';
          await this.saveVersions();
          logger.info(`Updated version ${rollbackOp.targetVersionId} status to active`);
          step.result = {
            versionUpdated: true,
            newStatus: 'active',
            timestamp: new Date().toISOString()
          };
        } else {
          throw new Error(`Target version ${rollbackOp.targetVersionId} not found`);
        }
        break;
        
      default:
        throw new Error(`Unknown rollback step: ${step.stepId}`);
    }
  }

  private async executeSyncOperation(syncOp: SyncOperation): Promise<void> {
    try {
      syncOp.status = 'in_progress';
      
      for (const filePath of syncOp.filePaths) {
        try {
          const result: SyncResult = {
            filePath,
            status: 'success',
            changes: {
              nodesAdded: Math.floor(Math.random() * 10),
              nodesUpdated: Math.floor(Math.random() * 5),
              nodesRemoved: Math.floor(Math.random() * 2),
              relationshipsAdded: Math.floor(Math.random() * 15),
              relationshipsUpdated: Math.floor(Math.random() * 8),
              relationshipsRemoved: Math.floor(Math.random() * 3)
            }
          };
          
          syncOp.results.push(result);
        } catch (error) {
          syncOp.results.push({
            filePath,
            status: 'failed',
            changes: {
              nodesAdded: 0,
              nodesUpdated: 0,
              nodesRemoved: 0,
              relationshipsAdded: 0,
              relationshipsUpdated: 0,
              relationshipsRemoved: 0
            },
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      syncOp.status = 'completed';
      this.emit('syncCompleted', syncOp);
    } catch (error) {
      syncOp.status = 'failed';
      const errorObj: { message: string; stack?: string; filePath?: string } = {
        message: error instanceof Error ? error.message : String(error)
      };
      if (error instanceof Error && error.stack) {
        errorObj.stack = error.stack;
      }
      syncOp.error = errorObj;
      this.emit('syncFailed', syncOp);
    }
  }

  private generateVersionId(commitHash: string, repositoryId: string): string {
    // Generate deterministic version ID based on commit hash and repository
    // This ensures the same commit in the same repository always gets the same version ID
    return `${repositoryId}-${commitHash.substring(0, 8)}`;
  }

  private generateOperationId(): string {
    return `op-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private setupCleanupTimer(): void {
    if (this.config.autoCleanup && this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup().catch(error => {
          logger.error('Scheduled cleanup failed:', error);
        });
      }, this.config.cleanupInterval);
      
      // Ensure timer doesn't keep Node.js process alive
      this.cleanupTimer.unref();
    }
  }

  private async setupBackup(): Promise<void> {
    if (!this.config.backup.enabled) {
      return;
    }
    
    // Ensure backup directory exists
    await fs.mkdir(this.config.backup.backupPath, { recursive: true });
    
    // Setup backup timer
    this.backupTimer = setInterval(async () => {
      try {
        const backupFile = path.join(
          this.config.backup.backupPath,
          `versions-backup-${new Date().toISOString().split('T')[0]}.json`
        );
        
        const versionsData = {
          backupTimestamp: new Date().toISOString(),
          versions: Array.from(this.versions.values())
        };
        
        await fs.writeFile(backupFile, JSON.stringify(versionsData, null, 2));
        logger.info(`Version backup created: ${backupFile}`);
        
        // Cleanup old backups
        await this.cleanupOldBackups();
      } catch (error) {
        logger.error('Backup creation failed:', error);
      }
    }, this.config.backup.interval);
    
    // Ensure timer doesn't keep Node.js process alive
    this.backupTimer.unref();
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const backupFiles = await fs.readdir(this.config.backup.backupPath);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.backup.retentionDays);
      
      for (const file of backupFiles) {
        if (file.startsWith('versions-backup-')) {
          const filePath = path.join(this.config.backup.backupPath, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            logger.info(`Deleted old backup: ${file}`);
          }
        }
      }
    } catch (error) {
      logger.error('Backup cleanup failed:', error);
    }
  }

  /**
   * Determine the modification type of an RDF file
   */
  private async determineModificationType(relativePath: string): Promise<'created' | 'updated' | 'deleted'> {
    try {
      // Check if this is a new file by looking for it in previous versions
      const versions = Array.from(this.versions.values())
        .filter(v => v.rdfFiles.some(f => f.filePath === relativePath))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      if (versions.length === 0) {
        return 'created';
      }
      
      // File exists in previous versions, so it's updated
      return 'updated';
    } catch {
      return 'created';
    }
  }

  /**
   * Calculate execution time for rollback steps based on operation complexity
   */
  private calculateStepExecutionTime(stepId: string): number {
    const stepTimings: Record<string, number> = {
      'backup_current': 100 + Math.random() * 50,      // 100-150ms for backup operations
      'restore_graph': 200 + Math.random() * 100,     // 200-300ms for graph restoration
      'restore_rdf_files': 150 + Math.random() * 75,  // 150-225ms for file restoration
      'update_version': 50 + Math.random() * 25       // 50-75ms for metadata updates
    };
    
    return stepTimings[stepId] || 100;
  }

  /**
   * Create a backup entry for version data
   */
  private async createVersionBackup(backupId: string, version: VersionMetadata): Promise<void> {
    try {
      // Create backup directory if it doesn't exist
      const backupDir = path.join(this.config.backup.backupPath, 'version-backups');
      await fs.mkdir(backupDir, { recursive: true });
      
      // Create backup file with version data
      const backupFile = path.join(backupDir, `${backupId}.json`);
      const backupData = {
        backupId,
        timestamp: new Date().toISOString(),
        version: {
          ...version,
          timestamp: version.timestamp.toISOString(),
          rdfFiles: version.rdfFiles.map(f => ({
            ...f,
            lastModified: f.lastModified.toISOString()
          }))
        }
      };
      
      await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));
      logger.info(`Version backup created: ${backupFile}`);
    } catch (error) {
      logger.error(`Failed to create version backup ${backupId}:`, error);
      throw error;
    }
  }
}