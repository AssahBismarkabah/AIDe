/**
 * Business Context Preserver
 * 
 * System to preserve developer enhancements and business context during re-analysis.
 * Handles conflict resolution, context merging, and enhancement tracking.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import logger from '../../utils/logger';

export interface BusinessContextConfig {
  preservationEnabled: boolean;
  backupEnabled: boolean;
  backupDirectory: string;
  conflictResolution: 'preserve' | 'merge' | 'prompt';
  enhancementMarkers: string[];
  businessContextPatterns: RegExp[];
  maxBackupVersions: number;
}

export interface EnhancementMetadata {
  id: string;
  filePath: string;
  type: 'business_context' | 'documentation' | 'custom_property' | 'relationship';
  content: string;
  author?: string;
  timestamp: Date;
  version: string;
  hash: string;
  preservationPriority: 'high' | 'medium' | 'low';
}

export interface ConflictResolution {
  conflictId: string;
  filePath: string;
  conflictType: 'content_mismatch' | 'structure_change' | 'property_conflict';
  originalContent: string;
  newContent: string;
  enhancedContent: string;
  resolution: 'keep_original' | 'keep_new' | 'merge' | 'manual';
  resolvedContent?: string | undefined;
  timestamp: Date;
}

export interface PreservationResult {
  success: boolean;
  preservedEnhancements: number;
  conflictsDetected: number;
  conflictsResolved: number;
  backupsCreated: number;
  errors: PreservationError[];
  warnings: string[];
  processingTime: number;
  statistics: PreservationStatistics;
}

export interface PreservationError {
  type: 'EXTRACTION_ERROR' | 'MERGE_ERROR' | 'BACKUP_ERROR' | 'VALIDATION_ERROR';
  message: string;
  filePath?: string;
  enhancementId?: string;
  details?: any;
}

export interface PreservationStatistics {
  totalFilesProcessed: number;
  enhancementsExtracted: number;
  enhancementsPreserved: number;
  enhancementsLost: number;
  conflictsAutoResolved: number;
  conflictsRequiringManualResolution: number;
  backupFilesCreated: number;
}

/**
 * Business Context Preserver
 * 
 * Preserves developer enhancements and business context during automatic re-analysis
 * with intelligent conflict resolution and enhancement tracking.
 */
export class BusinessContextPreserver extends EventEmitter {
  private config: BusinessContextConfig;
  private enhancementCache = new Map<string, EnhancementMetadata[]>();
  private conflictQueue: ConflictResolution[] = [];
  private backupFilesCreated = 0;
  private isInitialized = false;

  constructor(config: Partial<BusinessContextConfig> = {}) {
    super();
    
    this.config = {
      preservationEnabled: true,
      backupEnabled: true,
      backupDirectory: './backups/business-context',
      conflictResolution: 'merge',
      enhancementMarkers: [
        '# Business Context:',
        '# Developer Note:',
        '# Custom Enhancement:',
        'aide:businessContext',
        'aide:developerNote',
        'aide:customProperty'
      ],
      businessContextPatterns: [
        /aide:businessContext\s+"([^"]+)"/g,
        /aide:businessDomain\s+"([^"]+)"/g,
        /aide:developerNote\s+"([^"]+)"/g,
        /aide:customProperty\s+"([^"]+)"/g,
        /#\s*Business Context:\s*(.+)/g,
        /#\s*Developer Note:\s*(.+)/g
      ],
      maxBackupVersions: 10,
      ...config
    };
  }

  /**
   * Initialize the business context preserver
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Business Context Preserver', {
        preservationEnabled: this.config.preservationEnabled,
        backupEnabled: this.config.backupEnabled,
        conflictResolution: this.config.conflictResolution
      });

      // Create backup directory if enabled
      if (this.config.backupEnabled) {
        await fs.mkdir(this.config.backupDirectory, { recursive: true });
      }

      this.isInitialized = true;
      logger.info('Business Context Preserver initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Business Context Preserver', { error });
      throw error;
    }
  }

  /**
   * Preserve business context before re-analysis
   */
  async preserveContext(filePaths: string[]): Promise<PreservationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const result: PreservationResult = {
      success: false,
      preservedEnhancements: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
      backupsCreated: 0,
      errors: [],
      warnings: [],
      processingTime: 0,
      statistics: this.initializeStats()
    };

    try {
      logger.info('Starting business context preservation', {
        totalFiles: filePaths.length,
        preservationEnabled: this.config.preservationEnabled
      });

      if (!this.config.preservationEnabled) {
        result.success = true;
        result.processingTime = Date.now() - startTime;
        return result;
      }

      // Process each file
      for (const filePath of filePaths) {
        try {
          const fileResult = await this.preserveFileContext(filePath);
          
          result.statistics.totalFilesProcessed++;
          result.statistics.enhancementsExtracted += fileResult.enhancementsExtracted;
          result.preservedEnhancements += fileResult.enhancementsExtracted;

          if (fileResult.backupCreated) {
            result.backupsCreated++;
            result.statistics.backupFilesCreated++;
          }

          this.emit('file_processed', {
            filePath,
            enhancementsExtracted: fileResult.enhancementsExtracted,
            backupCreated: fileResult.backupCreated
          });

        } catch (error) {
          logger.error('Failed to preserve context for file', { filePath, error });
          result.errors.push({
            type: 'EXTRACTION_ERROR',
            message: `Failed to preserve context: ${(error as Error).message}`,
            filePath,
            details: error
          });
        }
      }

      result.statistics.enhancementsPreserved = result.preservedEnhancements;
      result.processingTime = Date.now() - startTime;
      result.success = result.errors.length === 0 || result.preservedEnhancements > 0;

      logger.info('Business context preservation completed', {
        success: result.success,
        preservedEnhancements: result.preservedEnhancements,
        backupsCreated: result.backupsCreated,
        processingTime: result.processingTime
      });

      this.emit('preservation_completed', result);
      return result;

    } catch (error) {
      logger.error('Business context preservation failed', { error });
      result.errors.push({
        type: 'EXTRACTION_ERROR',
        message: `Preservation failed: ${(error as Error).message}`,
        details: error
      });
      result.processingTime = Date.now() - startTime;
      this.emit('preservation_failed', { error, result });
      return result;
    }
  }

  /**
   * Restore business context after re-analysis
   */
  async restoreContext(filePaths: string[]): Promise<PreservationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const result: PreservationResult = {
      success: false,
      preservedEnhancements: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
      backupsCreated: 0,
      errors: [],
      warnings: [],
      processingTime: 0,
      statistics: this.initializeStats()
    };

    try {
      logger.info('Starting business context restoration', {
        totalFiles: filePaths.length,
        cachedEnhancements: this.enhancementCache.size
      });

      // Process each file
      for (const filePath of filePaths) {
        try {
          const fileResult = await this.restoreFileContext(filePath);
          
          result.statistics.totalFilesProcessed++;
          result.statistics.enhancementsPreserved += fileResult.enhancementsRestored;
          result.statistics.conflictsAutoResolved += fileResult.conflictsResolved;
          result.conflictsDetected += fileResult.conflictsDetected;
          result.conflictsResolved += fileResult.conflictsResolved;

          this.emit('file_restored', {
            filePath,
            enhancementsRestored: fileResult.enhancementsRestored,
            conflictsResolved: fileResult.conflictsResolved
          });

        } catch (error) {
          logger.error('Failed to restore context for file', { filePath, error });
          result.errors.push({
            type: 'MERGE_ERROR',
            message: `Failed to restore context: ${(error as Error).message}`,
            filePath,
            details: error
          });
        }
      }

      result.processingTime = Date.now() - startTime;
      result.success = result.errors.length === 0 || result.statistics.enhancementsPreserved > 0;

      logger.info('Business context restoration completed', {
        success: result.success,
        enhancementsRestored: result.statistics.enhancementsPreserved,
        conflictsResolved: result.conflictsResolved,
        processingTime: result.processingTime
      });

      this.emit('restoration_completed', result);
      return result;

    } catch (error) {
      logger.error('Business context restoration failed', { error });
      result.errors.push({
        type: 'MERGE_ERROR',
        message: `Restoration failed: ${(error as Error).message}`,
        details: error
      });
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Get pending conflicts requiring manual resolution
   */
  getPendingConflicts(): ConflictResolution[] {
    return this.conflictQueue.filter(conflict => conflict.resolution === 'manual');
  }

  /**
   * Resolve a conflict manually
   */
  async resolveConflict(conflictId: string, resolution: 'keep_original' | 'keep_new' | 'merge', resolvedContent?: string): Promise<boolean> {
    try {
      const conflict = this.conflictQueue.find(c => c.conflictId === conflictId);
      if (!conflict) {
        throw new Error(`Conflict not found: ${conflictId}`);
      }

      conflict.resolution = resolution;
      if (resolvedContent !== undefined) {
        conflict.resolvedContent = resolvedContent;
      }

      // Apply the resolution
      if (resolvedContent) {
        await fs.writeFile(conflict.filePath, resolvedContent, 'utf-8');
      }

      // Remove from queue
      this.conflictQueue = this.conflictQueue.filter(c => c.conflictId !== conflictId);

      logger.info('Conflict resolved manually', {
        conflictId,
        filePath: conflict.filePath,
        resolution
      });

      this.emit('conflict_resolved', { conflictId, resolution });
      return true;

    } catch (error) {
      logger.error('Failed to resolve conflict', { conflictId, error });
      return false;
    }
  }

  /**
   * Get preservation statistics
   */
  getStatistics(): PreservationStatistics {
    const totalEnhancements = Array.from(this.enhancementCache.values())
      .reduce((total, enhancements) => total + enhancements.length, 0);

    return {
      totalFilesProcessed: this.enhancementCache.size,
      enhancementsExtracted: totalEnhancements,
      enhancementsPreserved: totalEnhancements,
      enhancementsLost: 0,
      conflictsAutoResolved: 0,
      conflictsRequiringManualResolution: this.conflictQueue.length,
      backupFilesCreated: this.backupFilesCreated
    };
  }

  /**
   * Preserve business context (alias for preserveContext)
   */
  async preserveBusinessContext(filePaths: string[]): Promise<PreservationResult> {
    return this.preserveContext(filePaths);
  }

  // Private helper methods

  private async preserveFileContext(filePath: string): Promise<{
    enhancementsExtracted: number;
    backupCreated: boolean;
  }> {
    try {
      // Check if file exists
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!fileExists) {
        return { enhancementsExtracted: 0, backupCreated: false };
      }

      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Extract enhancements
      const enhancements = await this.extractEnhancements(filePath, content);
      
      // Cache enhancements
      if (enhancements.length > 0) {
        this.enhancementCache.set(filePath, enhancements);
      }

      // Create backup if enabled
      let backupCreated = false;
      if (this.config.backupEnabled && enhancements.length > 0) {
        await this.createBackup(filePath, content);
        backupCreated = true;
        this.backupFilesCreated++;
      }

      return {
        enhancementsExtracted: enhancements.length,
        backupCreated
      };

    } catch (error) {
      logger.error('Failed to preserve file context', { filePath, error });
      throw error;
    }
  }

  private async restoreFileContext(filePath: string): Promise<{
    enhancementsRestored: number;
    conflictsDetected: number;
    conflictsResolved: number;
  }> {
    try {
      const cachedEnhancements = this.enhancementCache.get(filePath);
      if (!cachedEnhancements || cachedEnhancements.length === 0) {
        return { enhancementsRestored: 0, conflictsDetected: 0, conflictsResolved: 0 };
      }

      // Read current file content
      const currentContent = await fs.readFile(filePath, 'utf-8');
      
      // Merge enhancements
      const mergeResult = await this.mergeEnhancements(filePath, currentContent, cachedEnhancements);
      
      // Write merged content
      if (mergeResult.mergedContent !== currentContent) {
        await fs.writeFile(filePath, mergeResult.mergedContent, 'utf-8');
      }

      return {
        enhancementsRestored: mergeResult.enhancementsRestored,
        conflictsDetected: mergeResult.conflictsDetected,
        conflictsResolved: mergeResult.conflictsResolved
      };

    } catch (error) {
      logger.error('Failed to restore file context', { filePath, error });
      throw error;
    }
  }

  private async extractEnhancements(filePath: string, content: string): Promise<EnhancementMetadata[]> {
    const enhancements: EnhancementMetadata[] = [];

    try {
      // Extract business context patterns
      for (const pattern of this.config.businessContextPatterns) {
        const matches = content.matchAll(pattern);
        
        for (const match of matches) {
          const enhancement: EnhancementMetadata = {
            id: this.generateEnhancementId(filePath, match[0]),
            filePath,
            type: this.determineEnhancementType(match[0]),
            content: match[0],
            timestamp: new Date(),
            version: '1.0.0',
            hash: this.generateHash(match[0]),
            preservationPriority: this.determinePriority(match[0])
          };

          enhancements.push(enhancement);
        }
      }

      // Extract comment-based enhancements
      const commentEnhancements = this.extractCommentEnhancements(filePath, content);
      enhancements.push(...commentEnhancements);

      logger.debug('Extracted enhancements from file', {
        filePath,
        enhancementCount: enhancements.length
      });

      return enhancements;

    } catch (error) {
      logger.error('Failed to extract enhancements', { filePath, error });
      return [];
    }
  }

  private async mergeEnhancements(
    filePath: string, 
    currentContent: string, 
    enhancements: EnhancementMetadata[]
  ): Promise<{
    mergedContent: string;
    enhancementsRestored: number;
    conflictsDetected: number;
    conflictsResolved: number;
  }> {
    let mergedContent = currentContent;
    let enhancementsRestored = 0;
    let conflictsDetected = 0;
    let conflictsResolved = 0;

    try {
      for (const enhancement of enhancements) {
        const mergeResult = await this.mergeEnhancement(mergedContent, enhancement);
        
        if (mergeResult.conflict) {
          conflictsDetected++;
          
          if (mergeResult.autoResolved) {
            conflictsResolved++;
            mergedContent = mergeResult.content;
            enhancementsRestored++;
          } else {
            // Add to conflict queue for manual resolution
            this.conflictQueue.push({
              conflictId: this.generateConflictId(),
              filePath,
              conflictType: 'content_mismatch',
              originalContent: currentContent,
              newContent: mergedContent,
              enhancedContent: enhancement.content,
              resolution: 'manual',
              timestamp: new Date()
            });
          }
        } else {
          mergedContent = mergeResult.content;
          enhancementsRestored++;
        }
      }

      return {
        mergedContent,
        enhancementsRestored,
        conflictsDetected,
        conflictsResolved
      };

    } catch (error) {
      logger.error('Failed to merge enhancements', { filePath, error });
      throw error;
    }
  }

  private async mergeEnhancement(content: string, enhancement: EnhancementMetadata): Promise<{
    content: string;
    conflict: boolean;
    autoResolved: boolean;
  }> {
    // Simple merge strategy - append enhancement if not already present
    if (content.includes(enhancement.content)) {
      return { content, conflict: false, autoResolved: false };
    }

    // Try to find appropriate insertion point
    const insertionPoint = this.findInsertionPoint(content, enhancement);
    
    if (insertionPoint !== -1) {
      const beforeContent = content.substring(0, insertionPoint);
      const afterContent = content.substring(insertionPoint);
      const mergedContent = beforeContent + '\n' + enhancement.content + afterContent;
      
      return { content: mergedContent, conflict: false, autoResolved: false };
    }

    // If no good insertion point, append at end
    const mergedContent = content + '\n\n' + enhancement.content;
    return { content: mergedContent, conflict: false, autoResolved: false };
  }

  private extractCommentEnhancements(filePath: string, content: string): EnhancementMetadata[] {
    const enhancements: EnhancementMetadata[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      for (const marker of this.config.enhancementMarkers) {
        if (line.startsWith(marker)) {
          const enhancement: EnhancementMetadata = {
            id: this.generateEnhancementId(filePath, line),
            filePath,
            type: 'documentation',
            content: line,
            timestamp: new Date(),
            version: '1.0.0',
            hash: this.generateHash(line),
            preservationPriority: 'medium'
          };

          enhancements.push(enhancement);
        }
      }
    }

    return enhancements;
  }

  private async createBackup(filePath: string, content: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = path.basename(filePath);
      const backupFileName = `${fileName}.backup.${timestamp}`;
      const backupPath = path.join(this.config.backupDirectory, backupFileName);

      await fs.writeFile(backupPath, content, 'utf-8');
      
      // Clean up old backups
      await this.cleanupOldBackups(fileName);

      logger.debug('Created backup file', { originalPath: filePath, backupPath });

    } catch (error) {
      logger.error('Failed to create backup', { filePath, error });
      throw error;
    }
  }

  private async cleanupOldBackups(fileName: string): Promise<void> {
    try {
      const files = await fs.readdir(this.config.backupDirectory);
      const backupFiles = files
        .filter(file => file.startsWith(fileName + '.backup.'))
        .sort()
        .reverse();

      if (backupFiles.length > this.config.maxBackupVersions) {
        const filesToDelete = backupFiles.slice(this.config.maxBackupVersions);
        
        for (const file of filesToDelete) {
          await fs.unlink(path.join(this.config.backupDirectory, file));
        }
      }

    } catch (error) {
      logger.warn('Failed to cleanup old backups', { fileName, error });
    }
  }

  private findInsertionPoint(content: string, enhancement: EnhancementMetadata): number {
    // Try to find a logical insertion point based on enhancement type
    const lines = content.split('\n');
    
    if (enhancement.type === 'business_context') {
      // Insert after module declaration or at the beginning
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('aide:Module') || lines[i].includes('@prefix')) {
          return content.indexOf(lines[i]) + lines[i].length;
        }
      }
    }

    return -1; // No specific insertion point found
  }

  private determineEnhancementType(content: string): EnhancementMetadata['type'] {
    if (content.includes('businessContext') || content.includes('Business Context')) {
      return 'business_context';
    }
    if (content.includes('developerNote') || content.includes('Developer Note')) {
      return 'documentation';
    }
    if (content.includes('customProperty')) {
      return 'custom_property';
    }
    return 'documentation';
  }

  private determinePriority(content: string): EnhancementMetadata['preservationPriority'] {
    if (content.includes('businessContext') || content.includes('businessDomain')) {
      return 'high';
    }
    if (content.includes('customProperty') || content.includes('relationship')) {
      return 'medium';
    }
    return 'low';
  }

  private generateEnhancementId(filePath: string, content: string): string {
    const hash = this.generateHash(filePath + content);
    return `enhancement_${hash.substring(0, 8)}`;
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private generateHash(content: string): string {
    // Simple hash function for demonstration
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private initializeStats(): PreservationStatistics {
    return {
      totalFilesProcessed: 0,
      enhancementsExtracted: 0,
      enhancementsPreserved: 0,
      enhancementsLost: 0,
      conflictsAutoResolved: 0,
      conflictsRequiringManualResolution: 0,
      backupFilesCreated: 0
    };
  }
}