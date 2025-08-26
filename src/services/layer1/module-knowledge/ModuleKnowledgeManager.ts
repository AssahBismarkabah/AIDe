/**
 * Module Knowledge Manager
 * 
 * Core orchestrator for managing dual-purpose TTL files that serve both
 * Neo4j knowledge graph population and direct LLM context enhancement.
 * 
 * This system bridges the gap between automated code analysis and developer
 * business context enhancement, ensuring knowledge files remain accurate
 * and valuable for both graph queries and LLM interactions.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import logger from '../../../utils/logger';
import { RDFService } from '../rdf-generator/RDFService';
import { RDFValidator } from '../rdf-generator/RDFValidator';
import { AnalysisResult } from '../ast-analyzer/types';
import {
  ModuleKnowledgeFile,
  ModuleKnowledgeManagerOptions,
  ValidationStatus,
  ConflictResolution,
  BusinessContextEnhancement,
  LLMContextPreview,
  DeveloperTooling,
  ModuleKnowledgeResult,
  BatchOperationResult,
  KnowledgeFileEvent,
  BackupMetadata,
  SyncStatus
} from './types';

/**
 *  Module Knowledge Manager
 * 
 * Manages the complete lifecycle of .module-knowledge.ttl files including:
 * - Initial generation from code analysis
 * - Developer business context enhancement
 * - Validation and conflict resolution
 * - Knowledge graph and MCP context synchronization
 * - Developer tooling and preview capabilities
 */
export class ModuleKnowledgeManager extends EventEmitter {
  private readonly rdfService: RDFService;
  private readonly rdfValidator: RDFValidator;
  private readonly options: ModuleKnowledgeManagerOptions;
  private readonly knowledgeFiles: Map<string, ModuleKnowledgeFile> = new Map();
  private readonly backupDirectory: string;
  private readonly syncQueue: Map<string, SyncStatus> = new Map();
  private neo4jDriver: any;
  private mcpContextCache: Map<string, any>;
  private mcpClients: Set<any>;
  private notificationQueue: any[] = [];

  constructor(options: Partial<ModuleKnowledgeManagerOptions> = {}) {
    super();
    
    this.options = {
      autoValidate: true,
      preserveBusinessContext: true,
      enableConflictResolution: true,
      enableLLMPreview: true,
      validationLevel: 'moderate',
      backupEnabled: true,
      backupRetention: 30,
      ...options
    };

    // CRITICAL FIX: Create RDFService with proper configuration to prevent business context placeholders
    this.rdfService = new RDFService(this.options.rdfGenerationOptions || {
      includeBusinessContext: false,
      generatePlaceholders: false, // CRITICAL: Prevent mock "E-commerce" placeholders
      optimizeForLLM: true,
      optimizeForNeo4j: true
    });
    this.rdfValidator = new RDFValidator();
    this.backupDirectory = path.join(process.cwd(), '.aaswe', 'backups');
    this.mcpContextCache = new Map();
    this.mcpClients = new Set();
    
    this.setupEventHandlers();
  }

  /**
   * Initialize Module Knowledge Management System
   */
  async initialize(): Promise<ModuleKnowledgeResult<void>> {
    try {
      logger.info('Initializing Module Knowledge Management System');

      // Ensure backup directory exists
      await fs.mkdir(this.backupDirectory, { recursive: true });

      // Discover existing knowledge files
      await this.discoverExistingKnowledgeFiles();

      // Setup file watchers for real-time updates
      await this.setupFileWatchers();

      // Cleanup old backups
      if (this.options.backupEnabled) {
        await this.cleanupOldBackups();
      }

      logger.info('Module Knowledge Management System initialized successfully');
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to initialize Module Knowledge Management System', { error });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Generate Initial Knowledge Files from Codebase
   */
  async generateInitialKnowledgeFiles(
    rootPath: string,
    options: { 
      overwriteExisting?: boolean;
      preserveBusinessContext?: boolean;
    } = {}
  ): Promise<ModuleKnowledgeResult<BatchOperationResult>> {
    const startTime = Date.now();
    const results: BatchOperationResult = {
      totalFiles: 0,
      successful: 0,
      failed: 0,
      errors: [],
      warnings: [],
      duration: 0
    };

    try {
      logger.info('Starting initial knowledge file generation', { rootPath });

      // Detect modules in the codebase
      const moduleDetection = await this.rdfService.detectModules(rootPath);
      results.totalFiles = moduleDetection.modules.length;

      // Process each detected module
      for (const module of moduleDetection.modules) {
        try {
          await this.generateKnowledgeFileForModule(
            module.path,
            options.overwriteExisting || false,
            options.preserveBusinessContext !== false
          );
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            filePath: module.path,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      results.duration = Date.now() - startTime;

      logger.info('Initial knowledge file generation completed', {
        totalFiles: results.totalFiles,
        successful: results.successful,
        failed: results.failed,
        duration: results.duration
      });

      return { success: true, data: results };
    } catch (error) {
      logger.error('Failed to generate initial knowledge files', { error, rootPath });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: results
      };
    }
  }

  /**
   * Update Knowledge File from Code Changes
   */
  async updateKnowledgeFileFromCode(
    sourceFilePath: string,
    astResult: AnalysisResult
  ): Promise<ModuleKnowledgeResult<ModuleKnowledgeFile>> {
    try {
      const knowledgeFilePath = this.getKnowledgeFilePath(sourceFilePath);
      
      logger.debug('Received AST result for knowledge file update', {
        sourceFilePath,
        astResultKeys: Object.keys(astResult || {}),
        classCount: astResult?.classes?.length || 0,
        functionCount: astResult?.functions?.length || 0,
        firstClassName: astResult?.classes?.[0]?.name,
        firstClassMethodCount: astResult?.classes?.[0]?.methods?.length || 0
      });
      
      logger.info('Updating knowledge file from code changes', {
        sourceFile: sourceFilePath,
        knowledgeFile: knowledgeFilePath
      });

      // Create backup if file exists and backup is enabled
      if (this.options.backupEnabled && await this.fileExists(knowledgeFilePath)) {
        await this.createBackup(knowledgeFilePath, 'auto_update');
      }

      // Extract existing business context if preservation is enabled
      let existingBusinessContext: BusinessContextEnhancement | undefined;
      if (this.options.preserveBusinessContext && await this.fileExists(knowledgeFilePath)) {
        existingBusinessContext = await this.extractBusinessContext(knowledgeFilePath);
      }

      // Generate new RDF content
      const rdfResult = await this.rdfService.generateRDF(astResult, sourceFilePath);

      // Merge with existing business context if available
      let finalContent = rdfResult.rdfContent;
      if (existingBusinessContext) {
        finalContent = await this.mergeBusinessContext(finalContent, existingBusinessContext);
      }

      // Create knowledge file object
      const knowledgeFile: ModuleKnowledgeFile = {
        filePath: knowledgeFilePath,
        modulePath: sourceFilePath,
        content: finalContent,
        checksum: this.calculateChecksum(finalContent),
        lastModified: new Date(),
        generatedAt: new Date(),
        version: '1.0.0',
        businessContextEnhanced: !!existingBusinessContext,
        validationStatus: { 
          isValid: true, 
          syntaxErrors: [], 
          semanticWarnings: [], 
          businessContextCompleteness: 0,
          lastValidated: new Date()
        }
      };

      // Write to file
      await fs.writeFile(knowledgeFilePath, finalContent, 'utf8');

      // Validate if auto-validation is enabled
      if (this.options.autoValidate) {
        knowledgeFile.validationStatus = await this.validateKnowledgeFile(knowledgeFilePath);
      }

      // Update internal tracking
      this.knowledgeFiles.set(knowledgeFilePath, knowledgeFile);

      // Emit update event
      this.emit('file_updated', {
        type: 'file_updated',
        payload: {
          filePath: knowledgeFilePath,
          updateType: 'code_change',
          changes: [],
          preserveBusinessContext: this.options.preserveBusinessContext,
          timestamp: new Date()
        }
      } as KnowledgeFileEvent);

      // Queue for synchronization
      await this.queueForSync(knowledgeFilePath, 'both');

      logger.info('Knowledge file updated successfully', {
        filePath: knowledgeFilePath,
        businessContextPreserved: !!existingBusinessContext
      });

      return { success: true, data: knowledgeFile };
    } catch (error) {
      logger.error('Failed to update knowledge file from code', { error, sourceFilePath });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate Knowledge File
   */
  async validateKnowledgeFile(filePath: string): Promise<ValidationStatus> {
    try {
      logger.debug('Validating knowledge file', { filePath });

      const content = await fs.readFile(filePath, 'utf8');
      
      // RDF syntax and semantic validation
      const rdfValidation = await this.rdfValidator.validateContent(content);
      
      // Business context completeness analysis
      const businessCompleteness = this.analyzeBusinessContextCompleteness(content);

      const validationStatus: ValidationStatus = {
        isValid: rdfValidation.isValid,
        syntaxErrors: rdfValidation.errors.map(error => ({
          type: error.type as 'syntax' | 'schema' | 'reference',
          message: error.message,
          line: error.line || 0,
          severity: error.severity as 'error' | 'warning',
          suggestion: 'Check RDF syntax and ontology compliance'
        })),
        semanticWarnings: rdfValidation.warnings.map(warning => ({
          type: 'best_practice' as const,
          message: warning.message,
          suggestion: warning.suggestion
        })),
        businessContextCompleteness: businessCompleteness,
        lastValidated: new Date()
      };

      // Update knowledge file tracking
      const knowledgeFile = this.knowledgeFiles.get(filePath);
      if (knowledgeFile) {
        knowledgeFile.validationStatus = validationStatus;
      }

      // Emit validation event
      this.emit('file_validated', {
        type: 'file_validated',
        payload: validationStatus
      } as KnowledgeFileEvent);

      return validationStatus;
    } catch (error) {
      logger.error('Failed to validate knowledge file', { error, filePath });
      
      return {
        isValid: false,
        syntaxErrors: [{
          type: 'syntax',
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error'
        }],
        semanticWarnings: [],
        businessContextCompleteness: 0,
        lastValidated: new Date()
      };
    }
  }

  /**
   * Generate LLM Context Preview
   */
  async generateLLMContextPreview(
    currentFilePath: string,
    queryContext?: string
  ): Promise<ModuleKnowledgeResult<LLMContextPreview>> {
    try {
      logger.debug('Generating LLM context preview', { currentFilePath, queryContext });

      // Find relevant knowledge files
      const relevantFiles = await this.findRelevantKnowledgeFiles(currentFilePath, queryContext);
      
      // Aggregate context content
      let contextContent = '';
      let totalTokens = 0;
      let businessContextRatio = 0;
      let technicalContextRatio = 0;

      for (const filePath of relevantFiles) {
        const content = await fs.readFile(filePath, 'utf8');
        contextContent += `\n# Knowledge from ${path.relative(process.cwd(), filePath)}\n`;
        contextContent += content;
        
        // Analyze content composition
        const analysis = this.analyzeContentComposition(content);
        businessContextRatio += analysis.businessRatio;
        technicalContextRatio += analysis.technicalRatio;
      }

      // Estimate token count (rough approximation)
      totalTokens = Math.ceil(contextContent.length / 4);

      const preview: LLMContextPreview = {
        filePath: currentFilePath,
        relevantFiles,
        contextContent,
        tokenCount: totalTokens,
        relevanceScore: this.calculateRelevanceScore(currentFilePath, relevantFiles),
        businessContextRatio: relevantFiles.length > 0 ? businessContextRatio / relevantFiles.length : 0,
        technicalContextRatio: relevantFiles.length > 0 ? technicalContextRatio / relevantFiles.length : 0
      };

      return { success: true, data: preview };
    } catch (error) {
      logger.error('Failed to generate LLM context preview', { error, currentFilePath });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate Developer Tooling Information
   */
  async generateDeveloperTooling(filePath: string): Promise<ModuleKnowledgeResult<DeveloperTooling>> {
    try {
      logger.debug('Generating developer tooling information', { filePath });

      const content = await fs.readFile(filePath, 'utf8');
      
      // Generate enhancement suggestions
      const enhancementSuggestions = this.generateEnhancementSuggestions(content);
      
      // Calculate completion status
      const completionStatus = this.calculateCompletionStatus(content);
      
      // Perform impact analysis
      const impactAnalysis = await this.performImpactAnalysis(filePath);

      const tooling: DeveloperTooling = {
        enhancementSuggestions,
        completionStatus,
        impactAnalysis
      };

      return { success: true, data: tooling };
    } catch (error) {
      logger.error('Failed to generate developer tooling', { error, filePath });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Detect and Resolve Conflicts
   */
  async detectAndResolveConflicts(filePath: string): Promise<ModuleKnowledgeResult<ConflictResolution | null>> {
    try {
      logger.debug('Detecting conflicts for knowledge file', { filePath });

      // Check if file has been modified externally
      const knowledgeFile = this.knowledgeFiles.get(filePath);
      if (!knowledgeFile) {
        return { success: true, data: null };
      }

      const currentContent = await fs.readFile(filePath, 'utf8');
      const currentChecksum = this.calculateChecksum(currentContent);

      if (currentChecksum === knowledgeFile.checksum) {
        return { success: true, data: null };
      }

      // Conflict detected - attempt automatic resolution
      const conflict: ConflictResolution = {
        conflictId: crypto.randomUUID(),
        filePath,
        conflictType: 'concurrent_edit',
        baseContent: knowledgeFile.content,
        localChanges: currentContent,
        remoteChanges: this.generateRemoteChangesSimulation(knowledgeFile.content, currentContent),
        resolution: 'auto',
        timestamp: new Date()
      };

      // Attempt automatic resolution if enabled
      if (this.options.enableConflictResolution) {
        const resolved = await this.attemptAutoResolution(conflict);
        if (resolved) {
          conflict.resolvedContent = resolved;
          conflict.resolution = 'auto';
          
          // Update file with resolved content
          await fs.writeFile(filePath, resolved, 'utf8');
          
          // Update tracking
          knowledgeFile.content = resolved;
          knowledgeFile.checksum = this.calculateChecksum(resolved);
          knowledgeFile.lastModified = new Date();
        } else {
          conflict.resolution = 'manual';
        }
      }

      // Emit conflict event
      this.emit('conflict_detected', {
        type: 'conflict_detected',
        payload: conflict
      } as KnowledgeFileEvent);

      return { success: true, data: conflict };
    } catch (error) {
      logger.error('Failed to detect/resolve conflicts', { error, filePath });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Private helper methods

  private setupEventHandlers(): void {
    this.on('file_updated', this.handleFileUpdate.bind(this));
    this.on('file_validated', this.handleFileValidation.bind(this));
    this.on('conflict_detected', this.handleConflictDetection.bind(this));
  }

  private async handleFileUpdate(event: Extract<KnowledgeFileEvent, { type: 'file_updated' }>): Promise<void> {
    const { filePath } = event.payload;
    logger.debug('Handling file update event', { filePath });
    
    // Queue for synchronization
    await this.queueForSync(filePath, 'both');
  }

  private async handleFileValidation(event: Extract<KnowledgeFileEvent, { type: 'file_validated' }>): Promise<void> {
    const validation = event.payload;
    logger.debug('Handling file validation event', { 
      isValid: validation.isValid,
      errorCount: validation.syntaxErrors.length 
    });
  }

  private async handleConflictDetection(event: Extract<KnowledgeFileEvent, { type: 'conflict_detected' }>): Promise<void> {
    const conflict = event.payload;
    logger.warn('Conflict detected in knowledge file', {
      filePath: conflict.filePath,
      conflictType: conflict.conflictType,
      resolution: conflict.resolution
    });
  }

  private async discoverExistingKnowledgeFiles(): Promise<void> {
    logger.debug('Discovering existing knowledge files');
    
    try {
      const { glob } = await import('glob');
      const knowledgeFiles = await glob('**/.module-knowledge.ttl', {
        cwd: process.cwd(),
        ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
      });

      for (const filePath of knowledgeFiles) {
        const absolutePath = path.resolve(process.cwd(), filePath);
        
        try {
          const content = await fs.readFile(absolutePath, 'utf8');
          const stats = await fs.stat(absolutePath);
          
          const knowledgeFile: ModuleKnowledgeFile = {
            filePath: absolutePath,
            modulePath: this.getSourceFilePathFromKnowledge(absolutePath),
            content,
            checksum: this.calculateChecksum(content),
            lastModified: stats.mtime,
            generatedAt: stats.birthtime,
            version: this.extractVersionFromContent(content),
            businessContextEnhanced: this.hasBusinessContext(content),
            validationStatus: {
              isValid: true,
              syntaxErrors: [],
              semanticWarnings: [],
              businessContextCompleteness: this.analyzeBusinessContextCompleteness(content),
              lastValidated: new Date()
            }
          };

          this.knowledgeFiles.set(absolutePath, knowledgeFile);
          logger.debug('Discovered knowledge file', { filePath: absolutePath });
        } catch (error) {
          logger.warn('Failed to process knowledge file', { filePath: absolutePath, error });
        }
      }

      logger.info('Knowledge file discovery completed', {
        totalFiles: this.knowledgeFiles.size
      });
    } catch (error) {
      logger.error('Failed to discover existing knowledge files', { error });
      throw error;
    }
  }

  private async setupFileWatchers(): Promise<void> {
    logger.debug('Setting up file watchers');
    
    // Skip file watchers in test environment
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      logger.debug('Skipping file watchers in test environment');
      logger.info('File watchers setup completed');
      return;
    }
    
    try {
      const chokidar = await import('chokidar');
      
      // Watch for changes to .module-knowledge.ttl files
      const knowledgeWatcher = chokidar.watch('**/.module-knowledge.ttl', {
        cwd: process.cwd(),
        ignored: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
        persistent: false, // Don't keep process alive in tests
        ignoreInitial: true
      });

      knowledgeWatcher.on('error', (error) => {
        logger.warn('Knowledge file watcher error', { error });
      });

      knowledgeWatcher.on('change', async (filePath: string) => {
        const absolutePath = path.resolve(process.cwd(), filePath);
        logger.debug('Knowledge file changed', { filePath: absolutePath });
        
        try {
          // Detect and resolve conflicts
          await this.detectAndResolveConflicts(absolutePath);
          
          // Re-validate the file
          if (this.options.autoValidate) {
            await this.validateKnowledgeFile(absolutePath);
          }
          
          // Queue for synchronization
          await this.queueForSync(absolutePath, 'both');
        } catch (error) {
          logger.error('Failed to handle knowledge file change', { filePath: absolutePath, error });
        }
      });

      knowledgeWatcher.on('unlink', (filePath: string) => {
        const absolutePath = path.resolve(process.cwd(), filePath);
        this.knowledgeFiles.delete(absolutePath);
        this.syncQueue.delete(absolutePath);
        logger.debug('Knowledge file removed', { filePath: absolutePath });
      });

      // Watch for changes to source code files
      const sourceWatcher = chokidar.watch('**/*.{ts,js,py,java,go,rs,cpp,hpp}', {
        cwd: process.cwd(),
        ignored: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '**/*.test.*', '**/*.spec.*'],
        persistent: false, // Don't keep process alive in tests
        ignoreInitial: true
      });

      sourceWatcher.on('error', (error) => {
        logger.warn('Source file watcher error', { error });
      });

      sourceWatcher.on('change', async (filePath: string) => {
        const absolutePath = path.resolve(process.cwd(), filePath);
        const knowledgeFilePath = this.getKnowledgeFilePath(absolutePath);
        
        // Only process if knowledge file exists
        if (await this.fileExists(knowledgeFilePath)) {
          logger.debug('Source file changed, updating knowledge file', {
            sourceFile: absolutePath,
            knowledgeFile: knowledgeFilePath
          });
          
          try {
            // Perform AST analysis and update knowledge file with changes
            await this.analyzeAndUpdateFromSourceChange(absolutePath, knowledgeFilePath);
          } catch (error) {
            logger.error('Failed to handle source file change', { filePath: absolutePath, error });
          }
        }
      });

      logger.info('File watchers setup completed');
    } catch (error) {
      logger.error('Failed to setup file watchers', { error });
      // Don't throw in production - file watchers are not critical
      if (process.env.NODE_ENV !== 'production') {
        throw error;
      }
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    logger.debug('Cleaning up old backups');
    
    try {
      const backupFiles = await fs.readdir(this.backupDirectory);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.options.backupRetention);

      let cleanedCount = 0;
      
      for (const fileName of backupFiles) {
        if (fileName.endsWith('.backup')) {
          const filePath = path.join(this.backupDirectory, fileName);
          
          try {
            const stats = await fs.stat(filePath);
            
            if (stats.mtime < cutoffDate) {
              await fs.unlink(filePath);
              cleanedCount++;
              logger.debug('Removed old backup', { filePath });
            }
          } catch (error) {
            logger.warn('Failed to process backup file', { filePath, error });
          }
        }
      }

      logger.info('Backup cleanup completed', {
        cleanedCount,
        retentionDays: this.options.backupRetention
      });
    } catch (error) {
      logger.error('Failed to cleanup old backups', { error });
      // Don't throw - this is not critical
    }
  }

  private async generateKnowledgeFileForModule(
    modulePath: string,
    overwriteExisting: boolean,
    preserveBusinessContext: boolean
  ): Promise<void> {
    logger.debug('Generating knowledge file for module', { modulePath, overwriteExisting, preserveBusinessContext });
    
    const knowledgeFilePath = this.getKnowledgeFilePath(modulePath);
    
    // Check if file exists and handle accordingly
    if (!overwriteExisting && await this.fileExists(knowledgeFilePath)) {
      logger.debug('Knowledge file already exists, skipping', { knowledgeFilePath });
      return;
    }

    try {
      // Extract existing business context if preservation is enabled
      let existingBusinessContext: BusinessContextEnhancement | undefined;
      if (preserveBusinessContext && await this.fileExists(knowledgeFilePath)) {
        existingBusinessContext = await this.extractBusinessContext(knowledgeFilePath);
      }

      // Generate basic RDF content from file analysis
      const basicContent = await this.generateBasicRDFContent(modulePath);
      
      // Merge with existing business context if available
      let finalContent = basicContent;
      if (existingBusinessContext) {
        finalContent = await this.mergeBusinessContext(basicContent, existingBusinessContext);
      }

      // Create knowledge file object
      const knowledgeFile: ModuleKnowledgeFile = {
        filePath: knowledgeFilePath,
        modulePath,
        content: finalContent,
        checksum: this.calculateChecksum(finalContent),
        lastModified: new Date(),
        generatedAt: new Date(),
        version: '1.0.0',
        businessContextEnhanced: !!existingBusinessContext,
        validationStatus: {
          isValid: true,
          syntaxErrors: [],
          semanticWarnings: [],
          businessContextCompleteness: this.analyzeBusinessContextCompleteness(finalContent),
          lastValidated: new Date()
        }
      };

      // Write to file
      await fs.writeFile(knowledgeFilePath, finalContent, 'utf8');

      // Validate if auto-validation is enabled
      if (this.options.autoValidate) {
        knowledgeFile.validationStatus = await this.validateKnowledgeFile(knowledgeFilePath);
      }

      // Update internal tracking
      this.knowledgeFiles.set(knowledgeFilePath, knowledgeFile);

      // Queue for synchronization
      await this.queueForSync(knowledgeFilePath, 'both');

      logger.debug('Knowledge file generated successfully', { knowledgeFilePath });
    } catch (error) {
      logger.error('Failed to generate knowledge file for module', { modulePath, error });
      throw error;
    }
  }

  private getKnowledgeFilePath(sourceFilePath: string): string {
    const dir = path.dirname(sourceFilePath);
    return path.join(dir, '.module-knowledge.ttl');
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private async createBackup(filePath: string, reason: string): Promise<BackupMetadata> {
    const content = await fs.readFile(filePath, 'utf8');
    const timestamp = new Date();
    const backupFileName = `${path.basename(filePath)}.${timestamp.getTime()}.backup`;
    const backupPath = path.join(this.backupDirectory, backupFileName);
    
    await fs.writeFile(backupPath, content, 'utf8');
    
    const backup: BackupMetadata = {
      filePath,
      backupPath,
      timestamp,
      reason: reason as any,
      checksum: this.calculateChecksum(content)
    };

    this.emit('backup_created', {
      type: 'backup_created',
      payload: backup
    } as KnowledgeFileEvent);

    return backup;
  }

  private async extractBusinessContext(filePath: string): Promise<BusinessContextEnhancement> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const businessContext: BusinessContextEnhancement = {};
      
      // Extract business domain information
      const domainMatch = content.match(/aide:businessDomain\s+"([^"]+)"/);
      if (domainMatch) {
        businessContext.domain = domainMatch[1];
      }
      
      // Extract business rules
      const rulesMatches = content.match(/aide:businessRule\s+"([^"]+)"/g);
      if (rulesMatches) {
        businessContext.businessRules = rulesMatches.map(match =>
          match.replace(/aide:businessRule\s+"([^"]+)"/, '$1')
        );
      }
      
      // Extract use cases
      const useCaseMatches = content.match(/aide:useCase\s+"([^"]+)"/g);
      if (useCaseMatches) {
        businessContext.useCases = useCaseMatches.map(match =>
          match.replace(/aide:useCase\s+"([^"]+)"/, '$1')
        );
      }
      
      // Extract constraints
      const constraintMatches = content.match(/aide:constraint\s+"([^"]+)"/g);
      if (constraintMatches) {
        businessContext.constraints = constraintMatches.map(match =>
          match.replace(/aide:constraint\s+"([^"]+)"/, '$1')
        );
      }
      
      logger.debug('Extracted business context', { filePath, contextKeys: Object.keys(businessContext) });
      return businessContext;
    } catch (error) {
      logger.error('Failed to extract business context', { filePath, error });
      return {};
    }
  }

  private async mergeBusinessContext(
    newContent: string,
    businessContext: BusinessContextEnhancement
  ): Promise<string> {
    try {
      let mergedContent = newContent;
      
      // Find the business context section
      const businessSectionStart = mergedContent.indexOf('# Business Context Section');
      if (businessSectionStart === -1) {
        logger.warn('Business context section not found in content');
        return newContent;
      }
      
      const technicalSectionStart = mergedContent.indexOf('# Technical Analysis Section');
      if (technicalSectionStart === -1) {
        logger.warn('Technical analysis section not found in content');
        return newContent;
      }
      
      // Extract the parts
      const beforeBusiness = mergedContent.substring(0, businessSectionStart);
      const afterTechnical = mergedContent.substring(technicalSectionStart);
      
      // Build business context content
      let businessContent = '# Business Context Section\n';
      businessContent += '# Add business domain information, rules, and use cases below\n';
      businessContent += '# This section is preserved during automatic updates\n\n';
      
      if (businessContext.domain) {
        businessContent += `aide:businessDomain "${businessContext.domain}" .\n`;
      }
      
      if (businessContext.businessRules && businessContext.businessRules.length > 0) {
        businessContext.businessRules.forEach(rule => {
          businessContent += `aide:businessRule "${rule}" .\n`;
        });
      }
      
      if (businessContext.useCases && businessContext.useCases.length > 0) {
        businessContext.useCases.forEach(useCase => {
          businessContent += `aide:useCase "${useCase}" .\n`;
        });
      }
      
      if (businessContext.constraints && businessContext.constraints.length > 0) {
        businessContext.constraints.forEach(constraint => {
          businessContent += `aide:constraint "${constraint}" .\n`;
        });
      }
      
      businessContent += '\n';
      
      // Merge everything together
      mergedContent = beforeBusiness + businessContent + afterTechnical;
      
      logger.debug('Successfully merged business context');
      return mergedContent;
    } catch (error) {
      logger.error('Failed to merge business context', { error });
      return newContent;
    }
  }

  private analyzeBusinessContextCompleteness(content: string): number {
    const businessMarkers = [
      'aide:businessDomain',
      'aide:businessRule',
      'aide:useCase',
      'aide:constraint',
      'aide:stakeholder',
      'aide:businessProcess'
    ];
    
    let foundMarkers = 0;
    businessMarkers.forEach(marker => {
      if (content.includes(marker)) {
        foundMarkers++;
      }
    });
    
    // Calculate completeness as percentage
    const completeness = foundMarkers / businessMarkers.length;
    
    logger.debug('Analyzed business context completeness', {
      foundMarkers,
      totalMarkers: businessMarkers.length,
      completeness
    });
    
    return completeness;
  }

  private async findRelevantKnowledgeFiles(
    currentFilePath: string,
    queryContext?: string
  ): Promise<string[]> {
    try {
      const relevantFiles: string[] = [];
      const currentDir = path.dirname(currentFilePath);
      
      // Get all knowledge files
      const allKnowledgeFiles = Array.from(this.knowledgeFiles.keys());
      
      // Score files based on relevance
      const scoredFiles = allKnowledgeFiles.map(filePath => {
        let score = 0;
        
        // Same directory gets higher score
        if (path.dirname(filePath) === currentDir) {
          score += 10;
        }
        
        // Parent/child directory relationship
        const relativePath = path.relative(currentDir, path.dirname(filePath));
        const depth = relativePath.split(path.sep).length;
        if (depth <= 2) {
          score += Math.max(0, 5 - depth);
        }
        
        // Query context matching
        if (queryContext) {
          const knowledgeFile = this.knowledgeFiles.get(filePath);
          if (knowledgeFile && knowledgeFile.content.toLowerCase().includes(queryContext.toLowerCase())) {
            score += 15;
          }
        }
        
        // Business context enhancement bonus
        const knowledgeFile = this.knowledgeFiles.get(filePath);
        if (knowledgeFile && knowledgeFile.businessContextEnhanced) {
          score += 5;
        }
        
        return { filePath, score };
      });
      
      // Sort by score and take top 5
      const topFiles = scoredFiles
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(item => item.filePath);
      
      relevantFiles.push(...topFiles);
      
      logger.debug('Found relevant knowledge files', {
        currentFilePath,
        queryContext,
        relevantCount: relevantFiles.length
      });
      
      return relevantFiles;
    } catch (error) {
      logger.error('Failed to find relevant knowledge files', { currentFilePath, error });
      return [];
    }
  }

  private analyzeContentComposition(content: string): { businessRatio: number; technicalRatio: number } {
    const businessKeywords = [
      'businessDomain', 'businessRule', 'useCase', 'constraint',
      'stakeholder', 'businessProcess', 'requirement', 'workflow'
    ];
    
    const technicalKeywords = [
      'function', 'class', 'method', 'property', 'parameter',
      'return', 'import', 'export', 'dependency', 'complexity'
    ];
    
    let businessCount = 0;
    let technicalCount = 0;
    
    businessKeywords.forEach(keyword => {
      const matches = content.match(new RegExp(keyword, 'gi'));
      if (matches) {
        businessCount += matches.length;
      }
    });
    
    technicalKeywords.forEach(keyword => {
      const matches = content.match(new RegExp(keyword, 'gi'));
      if (matches) {
        technicalCount += matches.length;
      }
    });
    
    const total = businessCount + technicalCount;
    if (total === 0) {
      return { businessRatio: 0.5, technicalRatio: 0.5 };
    }
    
    const businessRatio = businessCount / total;
    const technicalRatio = technicalCount / total;
    
    return { businessRatio, technicalRatio };
  }

  private calculateRelevanceScore(currentFilePath: string, relevantFiles: string[]): number {
    if (relevantFiles.length === 0) {
      return 0;
    }
    
    const currentDir = path.dirname(currentFilePath);
    let totalScore = 0;
    
    relevantFiles.forEach(filePath => {
      let fileScore = 0.5; // Base score
      
      // Same directory bonus
      if (path.dirname(filePath) === currentDir) {
        fileScore += 0.3;
      }
      
      // Business context bonus
      const knowledgeFile = this.knowledgeFiles.get(filePath);
      if (knowledgeFile && knowledgeFile.businessContextEnhanced) {
        fileScore += 0.2;
      }
      
      // Validation status bonus
      if (knowledgeFile && knowledgeFile.validationStatus.isValid) {
        fileScore += 0.1;
      }
      
      totalScore += Math.min(fileScore, 1.0); // Cap at 1.0
    });
    
    return Math.min(totalScore / relevantFiles.length, 1.0);
  }

  private generateEnhancementSuggestions(content: string): any[] {
    const suggestions: any[] = [];
    
    // Check for missing business domain
    if (!content.includes('aide:businessDomain')) {
      suggestions.push({
        type: 'business_context',
        priority: 'high',
        suggestion: 'Add business domain information to provide context about the module\'s purpose',
        example: 'aide:businessDomain "E-commerce" .'
      });
    }
    
    // Check for missing business rules
    if (!content.includes('aide:businessRule')) {
      suggestions.push({
        type: 'business_context',
        priority: 'medium',
        suggestion: 'Add business rules that govern this module\'s behavior',
        example: 'aide:businessRule "Orders must be validated before processing" .'
      });
    }
    
    // Check for missing use cases
    if (!content.includes('aide:useCase')) {
      suggestions.push({
        type: 'business_context',
        priority: 'medium',
        suggestion: 'Document the primary use cases for this module',
        example: 'aide:useCase "Process customer orders" .'
      });
    }
    
    // Check for missing constraints
    if (!content.includes('aide:constraint')) {
      suggestions.push({
        type: 'business_context',
        priority: 'low',
        suggestion: 'Add any business constraints or limitations',
        example: 'aide:constraint "Maximum 100 items per order" .'
      });
    }
    
    // Check for technical documentation completeness
    const functionCount = (content.match(/aide:Function/g) || []).length;
    const classCount = (content.match(/aide:Class/g) || []).length;
    
    if ((functionCount > 0 || classCount > 0) && !content.includes('rdfs:comment')) {
      suggestions.push({
        type: 'technical_documentation',
        priority: 'medium',
        suggestion: 'Add comments/descriptions to functions and classes',
        example: 'rdfs:comment "Processes user authentication" .'
      });
    }
    
    return suggestions;
  }

  private calculateCompletionStatus(content: string): any {
    const status = {
      businessDomain: content.includes('aide:businessDomain'),
      businessRules: content.includes('aide:businessRule'),
      useCases: content.includes('aide:useCase'),
      constraints: content.includes('aide:constraint'),
      methodDocumentation: 0,
      classDocumentation: 0,
      overallCompleteness: 0
    };
    
    // Calculate method documentation completeness
    const functionMatches = content.match(/aide:Function/g);
    const functionCommentMatches = content.match(/aide:Function[^}]*rdfs:comment/g);
    if (functionMatches) {
      status.methodDocumentation = functionCommentMatches ?
        functionCommentMatches.length / functionMatches.length : 0;
    }
    
    // Calculate class documentation completeness
    const classMatches = content.match(/aide:Class/g);
    const classCommentMatches = content.match(/aide:Class[^}]*rdfs:comment/g);
    if (classMatches) {
      status.classDocumentation = classCommentMatches ?
        classCommentMatches.length / classMatches.length : 0;
    }
    
    // Calculate overall completeness
    const businessItems = [
      status.businessDomain,
      status.businessRules,
      status.useCases,
      status.constraints
    ];
    const businessCompleteness = businessItems.filter(Boolean).length / businessItems.length;
    const technicalCompleteness = (status.methodDocumentation + status.classDocumentation) / 2;
    
    status.overallCompleteness = (businessCompleteness + technicalCompleteness) / 2;
    
    return status;
  }

  private async performImpactAnalysis(filePath: string): Promise<any> {
    try {
      const knowledgeFile = this.knowledgeFiles.get(filePath);
      if (!knowledgeFile) {
        return {
          llmContextImpact: 'unknown',
          graphQueryImpact: 'unknown',
          affectedFiles: [],
          dependentModules: [],
          estimatedBenefit: 'Unable to analyze - file not found'
        };
      }
      
      const content = knowledgeFile.content;
      const completionStatus = this.calculateCompletionStatus(content);
      
      // Determine LLM context impact
      let llmContextImpact = 'low';
      if (completionStatus.overallCompleteness > 0.7) {
        llmContextImpact = 'high';
      } else if (completionStatus.overallCompleteness > 0.4) {
        llmContextImpact = 'medium';
      }
      
      // Determine graph query impact
      let graphQueryImpact = 'low';
      const hasStructuredData = content.includes('aide:Function') || content.includes('aide:Class');
      const hasRelationships = content.includes('aide:dependsOn') || content.includes('aide:uses');
      
      if (hasStructuredData && hasRelationships) {
        graphQueryImpact = 'high';
      } else if (hasStructuredData || hasRelationships) {
        graphQueryImpact = 'medium';
      }
      
      // Find affected files (files in same directory or related directories)
      const currentDir = path.dirname(filePath);
      const affectedFiles = Array.from(this.knowledgeFiles.keys())
        .filter(kfPath => {
          const kfDir = path.dirname(kfPath);
          return kfPath !== filePath && (
            kfDir === currentDir ||
            kfDir.startsWith(currentDir) ||
            currentDir.startsWith(kfDir)
          );
        })
        .slice(0, 5); // Limit to 5 files
      
      // Estimate dependent modules
      const dependentModules = content.match(/aide:dependsOn\s+"([^"]+)"/g) || [];
      
      // Generate benefit estimation
      let estimatedBenefit = 'Basic code structure understanding';
      if (knowledgeFile.businessContextEnhanced) {
        estimatedBenefit = 'Enhanced business context and improved LLM reasoning';
      }
      if (completionStatus.overallCompleteness > 0.8) {
        estimatedBenefit = 'Comprehensive understanding enabling advanced AI assistance';
      }
      
      return {
        llmContextImpact,
        graphQueryImpact,
        affectedFiles,
        dependentModules: dependentModules.map(dep =>
          dep.replace(/aide:dependsOn\s+"([^"]+)"/, '$1')
        ),
        estimatedBenefit,
        completenessScore: completionStatus.overallCompleteness,
        hasBusinessContext: knowledgeFile.businessContextEnhanced
      };
    } catch (error) {
      logger.error('Failed to perform impact analysis', { filePath, error });
      return {
        llmContextImpact: 'unknown',
        graphQueryImpact: 'unknown',
        affectedFiles: [],
        dependentModules: [],
        estimatedBenefit: 'Analysis failed due to error'
      };
    }
  }

  private async attemptAutoResolution(conflict: ConflictResolution): Promise<string | null> {
    try {
      logger.debug('Attempting automatic conflict resolution', {
        conflictId: conflict.conflictId,
        conflictType: conflict.conflictType
      });
      
      // For concurrent edits, try to merge non-conflicting sections
      if (conflict.conflictType === 'concurrent_edit') {
        const baseLines = conflict.baseContent.split('\n');
        const localLines = conflict.localChanges.split('\n');
        
        // Concrete merge strategy: preserve business context from local changes
        // and technical content from base using section-based merging
        const businessSectionStart = localLines.findIndex(line =>
          line.includes('# Business Context Section')
        );
        const technicalSectionStart = localLines.findIndex(line =>
          line.includes('# Technical Analysis Section')
        );
        
        if (businessSectionStart !== -1 && technicalSectionStart !== -1) {
          // Extract business section from local changes
          const businessSection = localLines.slice(businessSectionStart, technicalSectionStart);
          
          // Extract technical section from base content
          const baseTechnicalStart = baseLines.findIndex(line =>
            line.includes('# Technical Analysis Section')
          );
          
          if (baseTechnicalStart !== -1) {
            const baseTechnicalSection = baseLines.slice(baseTechnicalStart);
            
            // Merge: header + business from local + technical from base
            const headerSection = localLines.slice(0, businessSectionStart);
            const mergedContent = [
              ...headerSection,
              ...businessSection,
              ...baseTechnicalSection
            ].join('\n');
            
            logger.debug('Successfully auto-resolved conflict using section merge');
            return mergedContent;
          }
        }
      }
      
      // If automatic resolution fails, return null for manual resolution
      logger.debug('Automatic resolution not possible, requiring manual intervention');
      return null;
    } catch (error) {
      logger.error('Failed to attempt automatic conflict resolution', {
        conflictId: conflict.conflictId,
        error
      });
      return null;
    }
  }

  private generateRemoteChangesSimulation(baseContent: string, localContent: string): string {
    // Generate simulated remote changes for conflict resolution testing
    // This simulates what would happen in a real concurrent editing scenario
    
    const baseLines = baseContent.split('\n');
    const localLines = localContent.split('\n');
    
    // Find the technical section in base content
    const baseTechnicalStart = baseLines.findIndex(line =>
      line.includes('# Technical Analysis Section')
    );
    
    if (baseTechnicalStart === -1) {
      return baseContent; // No technical section found, return base as-is
    }
    
    // Simulate remote changes by modifying technical content
    const remoteLines = [...baseLines];
    
    // Add simulated remote technical updates based on differences with local
    const timestamp = new Date().toISOString();
    const localChangeCount = Math.abs(localLines.length - baseLines.length);
    const remoteUpdates = [
      `# Remote update at ${timestamp}`,
      `aide:remoteUpdate "Simulated concurrent modification with ${localChangeCount} local changes detected" .`,
      `aide:conflictMarker "Remote changes conflict with local modifications" .`,
      `aide:remoteTimestamp "${timestamp}"^^xsd:dateTime .`
    ];
    
    // Insert remote updates after technical section header
    remoteLines.splice(baseTechnicalStart + 2, 0, ...remoteUpdates);
    
    return remoteLines.join('\n');
  }

  private async queueForSync(filePath: string, syncType: 'knowledge_graph' | 'mcp_context' | 'both'): Promise<void> {
    const syncStatus: SyncStatus = {
      filePath,
      lastSync: new Date(),
      syncType,
      status: 'pending',
      retryCount: 0
    };

    this.syncQueue.set(filePath, syncStatus);
    
    // Process sync queue asynchronously
    setImmediate(() => this.processSyncQueue());
    
    logger.debug('Queued file for synchronization', { filePath, syncType });
  }

  private getSourceFilePathFromKnowledge(knowledgeFilePath: string): string {
    const dir = path.dirname(knowledgeFilePath);
    const files = ['index.ts', 'index.js', 'main.ts', 'main.js'];
    
    // Try to find the main source file in the same directory
    for (const file of files) {
      const sourcePath = path.join(dir, file);
      try {
        require('fs').accessSync(sourcePath);
        return sourcePath;
      } catch {
        // File doesn't exist, continue
      }
    }
    
    // If no main file found, return the directory path
    return dir;
  }

  private extractVersionFromContent(content: string): string {
    // Look for version information in TTL content
    const versionMatch = content.match(/@version\s+"([^"]+)"/);
    return versionMatch ? versionMatch[1] : '1.0.0';
  }

  private hasBusinessContext(content: string): boolean {
    // Check for business context markers in TTL content
    const businessMarkers = [
      'businessDomain',
      'businessRule',
      'useCase',
      'businessContext',
      'domainConcept'
    ];
    
    return businessMarkers.some(marker => content.includes(marker));
  }

  private async generateBasicRDFContent(modulePath: string): Promise<string> {
    try {
      // Get file stats and basic information
      const stats = await fs.stat(modulePath);
      const fileName = path.basename(modulePath);
      const fileExtension = path.extname(modulePath);
      const baseName = path.basename(modulePath, fileExtension);
      
      // Generate basic TTL content
      const content = `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix aide: <http://aide.dev/ontology#> .
@version "1.0.0" .

# Module Information
aide:${baseName} a aide:Module ;
    aide:fileName "${fileName}" ;
    aide:filePath "${modulePath}" ;
    aide:fileExtension "${fileExtension}" ;
    aide:lastModified "${stats.mtime.toISOString()}"^^xsd:dateTime ;
    aide:fileSize ${stats.size} ;
    rdfs:label "${baseName} Module" ;
    rdfs:comment "Auto-generated knowledge file for ${fileName}" .

# Business Context Section
# Add business domain information, rules, and use cases below
# This section is preserved during automatic updates

# Technical Analysis Section
# This section is automatically updated from code analysis
aide:${baseName} aide:analysisTimestamp "${new Date().toISOString()}"^^xsd:dateTime .
`;

      return content;
    } catch (error) {
      logger.error('Failed to generate basic RDF content', { modulePath, error });
      throw error;
    }
  }

  private async processSyncQueue(): Promise<void> {
    const pendingItems = Array.from(this.syncQueue.entries())
      .filter(([, status]) => status.status === 'pending')
      .slice(0, 5); // Process up to 5 items at a time

    if (pendingItems.length === 0) {
      return;
    }

    logger.debug('Processing sync queue', { itemCount: pendingItems.length });

    for (const [filePath, syncStatus] of pendingItems) {
      try {
        syncStatus.status = 'pending';
        
        // Read the knowledge file content
        const content = await fs.readFile(filePath, 'utf8');
        
        // Simulate synchronization based on sync type
        if (syncStatus.syncType === 'knowledge_graph' || syncStatus.syncType === 'both') {
          await this.syncToKnowledgeGraph(filePath, content);
        }
        
        if (syncStatus.syncType === 'mcp_context' || syncStatus.syncType === 'both') {
          await this.syncToMCPContext(filePath, content);
        }
        
        // Mark as completed
        syncStatus.status = 'success';
        syncStatus.lastSync = new Date();
        
        logger.debug('Sync completed successfully', { filePath, syncType: syncStatus.syncType });
        
        // Remove from queue after successful sync
        this.syncQueue.delete(filePath);
        
      } catch (error) {
        syncStatus.status = 'failed';
        syncStatus.retryCount++;
        
        logger.error('Sync failed', {
          filePath,
          error,
          retryCount: syncStatus.retryCount
        });
        
        // Remove from queue if max retries exceeded
        if (syncStatus.retryCount >= 3) {
          this.syncQueue.delete(filePath);
          logger.warn('Max retries exceeded, removing from sync queue', { filePath });
        }
      }
    }
  }

  private async syncToKnowledgeGraph(filePath: string, content: string): Promise<void> {
    logger.debug('Syncing to knowledge graph', { filePath, contentLength: content.length });
    
    try {
      // Check if Neo4j is available before attempting sync
      const neo4jAvailable = await this.checkNeo4jAvailability();
      
      if (!neo4jAvailable) {
        logger.debug('Neo4j not available, skipping knowledge graph sync', { filePath });
        return;
      }
      
      // Parse TTL content to extract triples
      const triples = await this.parseTTLContent(content);
      const moduleId = this.extractModuleId(content, filePath);
      
      // Connect to Neo4j and create/update nodes and relationships
      const neo4j = await this.getNeo4jDriver();
      const session = neo4j.session();
      
      try {
        await session.writeTransaction(async (tx: any) => {
          // Create or update module node
          await tx.run(
            `MERGE (m:Module {id: $moduleId, filePath: $filePath})
             SET m.lastUpdated = datetime(),
                 m.content = $content,
                 m.checksum = $checksum`,
            {
              moduleId,
              filePath,
              content,
              checksum: this.calculateChecksum(content)
            }
          );
          
          // Process each triple to create graph relationships
          for (const triple of triples) {
            await this.createGraphTriple(tx, triple, moduleId);
          }
        });
        
        logger.debug('Successfully synced to knowledge graph', {
          filePath,
          moduleId,
          tripleCount: triples.length
        });
      } finally {
        await session.close();
      }
    } catch (error) {
      logger.debug('Knowledge graph sync failed, continuing without Neo4j', { filePath, error: error instanceof Error ? error.message : 'Unknown error' });
      // Don't throw error - knowledge graph sync is optional
    }
  }

  private async syncToMCPContext(filePath: string, content: string): Promise<void> {
      logger.debug('Syncing to MCP context', { filePath, contentLength: content.length });
      
      try {
        // Format content for MCP consumption
        const mcpContext = await this.formatForMCP(content, filePath);
        const moduleId = this.extractModuleId(content, filePath);
        
        // Update context cache
        await this.updateContextCache(moduleId, mcpContext);
        
        // Notify MCP clients of updates
        await this.notifyMCPClients(moduleId, mcpContext);
        
        logger.debug('Successfully synced to MCP context', {
          filePath,
          moduleId,
          contextSize: mcpContext.content.length
        });
      } catch (error) {
        logger.error('Failed to sync to MCP context', { filePath, error });
        throw error;
      }
    }

  private async parseTTLContent(content: string): Promise<Array<{subject: string, predicate: string, object: string}>> {
      const triples: Array<{subject: string, predicate: string, object: string}> = [];
      
      // Parse TTL content line by line to extract RDF triples
      const lines = content.split('\n');
      let currentSubject = '';
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip comments and empty lines
        if (trimmedLine.startsWith('#') || trimmedLine.startsWith('@') || !trimmedLine) {
          continue;
        }
        
        // Parse triple patterns
        const tripleMatch = trimmedLine.match(/^(\S+)\s+(\S+)\s+(.+?)\s*[;.]?\s*$/);
        if (tripleMatch) {
          const [, subject, predicate, object] = tripleMatch;
          
          // Update current subject if it's a new one
          if (!subject.startsWith('aide:') && !subject.startsWith('rdfs:')) {
            currentSubject = subject;
          }
          
          triples.push({
            subject: subject.startsWith('aide:') ? subject : currentSubject || subject,
            predicate,
            object: object.replace(/[";]$/, '').trim()
          });
        }
      }
      
      return triples;
    }

  private extractModuleId(content: string, filePath: string): string {
      // Try to extract module ID from TTL content
      const moduleMatch = content.match(/aide:(\w+)\s+a\s+aide:Module/);
      if (moduleMatch) {
        return moduleMatch[1];
      }
      
      // Fallback to file-based ID
      const fileName = path.basename(filePath, path.extname(filePath));
      return fileName.replace(/[^a-zA-Z0-9]/g, '_');
    }

  /**
   * Check if Neo4j is available for knowledge graph operations
   */
  private async checkNeo4jAvailability(): Promise<boolean> {
    try {
      // Check if Neo4j environment variables are set
      const neo4jUri = process.env.NEO4J_URI;
      const neo4jUsername = process.env.NEO4J_USERNAME || process.env.NEO4J_USER;
      const neo4jPassword = process.env.NEO4J_PASSWORD;

      if (!neo4jUri || !neo4jUsername || !neo4jPassword) {
        logger.debug('Neo4j credentials not configured');
        return false;
      }

      // Try to connect to Neo4j
      const { Neo4jDatabaseService } = await import('../../layer2/neo4j-database/Neo4jDatabaseService');
      const neo4jService = new Neo4jDatabaseService();

      const config = {
        uri: neo4jUri,
        username: neo4jUsername,
        password: neo4jPassword,
        database: 'neo4j'
      };

      await neo4jService.connect(config);
      const isHealthy = await neo4jService.testConnection();
      await neo4jService.disconnect();

      return isHealthy;
    } catch (error) {
      logger.debug('Neo4j availability check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }

  private async getNeo4jDriver(): Promise<any> {
      // Initialize Neo4j driver if not already done
      if (!this.neo4jDriver) {
        const neo4j = await import('neo4j-driver');
        this.neo4jDriver = neo4j.driver(
          process.env.NEO4J_URI || 'bolt://localhost:7687',
          neo4j.auth.basic(
            process.env.NEO4J_USERNAME || process.env.NEO4J_USER || 'neo4j',
            process.env.NEO4J_PASSWORD || 'password'
          )
        );
      }
      return this.neo4jDriver;
    }

  private async createGraphTriple(tx: any, triple: {subject: string, predicate: string, object: string}, moduleId: string): Promise<void> {
      const { predicate, object } = triple;
      
      // Handle different types of relationships
      if (predicate.includes('dependsOn')) {
        await tx.run(
          `MATCH (m:Module {id: $moduleId})
           MERGE (dep:Module {id: $depId})
           MERGE (m)-[:DEPENDS_ON]->(dep)`,
          { moduleId, depId: object.replace(/['"]/g, '') }
        );
      } else if (predicate.includes('hasFunction')) {
        await tx.run(
          `MATCH (m:Module {id: $moduleId})
           MERGE (f:Function {name: $functionName, module: $moduleId})
           MERGE (m)-[:HAS_FUNCTION]->(f)`,
          { moduleId, functionName: object.replace(/['"]/g, '') }
        );
      } else if (predicate.includes('hasClass')) {
        await tx.run(
          `MATCH (m:Module {id: $moduleId})
           MERGE (c:Class {name: $className, module: $moduleId})
           MERGE (m)-[:HAS_CLASS]->(c)`,
          { moduleId, className: object.replace(/['"]/g, '') }
        );
      } else if (predicate.includes('businessDomain')) {
        await tx.run(
          `MATCH (m:Module {id: $moduleId})
           MERGE (d:Domain {name: $domainName})
           MERGE (m)-[:BELONGS_TO_DOMAIN]->(d)`,
          { moduleId, domainName: object.replace(/['"]/g, '') }
        );
      } else {
        // Generic property assignment
        const propertyName = predicate.replace(/aide:|rdfs:/, '').replace(/[^a-zA-Z0-9]/g, '_');
        await tx.run(
          `MATCH (m:Module {id: $moduleId})
           SET m.${propertyName} = $value`,
          { moduleId, value: object.replace(/['"]/g, '') }
        );
      }
    }

  private async formatForMCP(content: string, filePath: string): Promise<{content: string, metadata: any}> {
      const moduleId = this.extractModuleId(content, filePath);
      
      // Extract business context for enhanced LLM understanding
      const businessContext = await this.extractBusinessContext(filePath);
      
      // Format content for MCP consumption with enhanced context
      const mcpContent = {
        moduleId,
        filePath,
        timestamp: new Date().toISOString(),
        businessContext,
        technicalContent: this.extractTechnicalContent(content),
        relationships: this.extractRelationships(content),
        summary: this.generateContentSummary(content, businessContext)
      };
      
      return {
        content: JSON.stringify(mcpContent, null, 2),
        metadata: {
          moduleId,
          lastUpdated: new Date(),
          contentType: 'module-knowledge',
          version: '1.0.0'
        }
      };
    }

  private extractTechnicalContent(content: string): any {
      const technical: any = {
        functions: [],
        classes: [],
        dependencies: [],
        exports: []
      };
      
      // Extract functions
      const functionMatches = content.match(/aide:Function[^}]*/g) || [];
      technical.functions = functionMatches.map(match => {
        const nameMatch = match.match(/aide:functionName\s+"([^"]+)"/);
        const commentMatch = match.match(/rdfs:comment\s+"([^"]+)"/);
        return {
          name: nameMatch ? nameMatch[1] : 'unknown',
          description: commentMatch ? commentMatch[1] : ''
        };
      });
      
      // Extract classes
      const classMatches = content.match(/aide:Class[^}]*/g) || [];
      technical.classes = classMatches.map(match => {
        const nameMatch = match.match(/aide:className\s+"([^"]+)"/);
        const commentMatch = match.match(/rdfs:comment\s+"([^"]+)"/);
        return {
          name: nameMatch ? nameMatch[1] : 'unknown',
          description: commentMatch ? commentMatch[1] : ''
        };
      });
      
      // Extract dependencies
      const depMatches = content.match(/aide:dependsOn\s+"([^"]+)"/g) || [];
      technical.dependencies = depMatches.map(match =>
        match.replace(/aide:dependsOn\s+"([^"]+)"/, '$1')
      );
      
      return technical;
    }

  private extractRelationships(content: string): Array<{type: string, target: string}> {
      const relationships: Array<{type: string, target: string}> = [];
      
      // Extract various relationship types
      const relationshipPatterns = [
        { pattern: /aide:dependsOn\s+"([^"]+)"/g, type: 'depends_on' },
        { pattern: /aide:uses\s+"([^"]+)"/g, type: 'uses' },
        { pattern: /aide:implements\s+"([^"]+)"/g, type: 'implements' },
        { pattern: /aide:extends\s+"([^"]+)"/g, type: 'extends' }
      ];
      
      relationshipPatterns.forEach(({ pattern, type }) => {
        const matches = content.match(pattern) || [];
        matches.forEach(match => {
          const target = match.replace(pattern, '$1');
          relationships.push({ type, target });
        });
      });
      
      return relationships;
    }

  private generateContentSummary(content: string, businessContext: BusinessContextEnhancement): string {
      const moduleMatch = content.match(/aide:(\w+)\s+a\s+aide:Module/);
      const moduleName = moduleMatch ? moduleMatch[1] : 'Unknown Module';
      
      let summary = `Module: ${moduleName}\n`;
      
      if (businessContext.domain) {
        summary += `Business Domain: ${businessContext.domain}\n`;
      }
      
      if (businessContext.businessRules && businessContext.businessRules.length > 0) {
        summary += `Business Rules: ${businessContext.businessRules.join(', ')}\n`;
      }
      
      if (businessContext.useCases && businessContext.useCases.length > 0) {
        summary += `Use Cases: ${businessContext.useCases.join(', ')}\n`;
      }
      
      const technical = this.extractTechnicalContent(content);
      if (technical.functions.length > 0) {
        summary += `Functions: ${technical.functions.map((f: any) => f.name).join(', ')}\n`;
      }
      
      if (technical.classes.length > 0) {
        summary += `Classes: ${technical.classes.map((c: any) => c.name).join(', ')}\n`;
      }
      
      return summary;
    }

  private async updateContextCache(moduleId: string, mcpContext: {content: string, metadata: any}): Promise<void> {
      // Update cache with new context
      this.mcpContextCache.set(moduleId, {
        ...mcpContext,
        lastUpdated: new Date()
      });
      
      // Persist cache to disk for durability
      const cacheDir = path.join(process.cwd(), '.aaswe', 'mcp-cache');
      await fs.mkdir(cacheDir, { recursive: true });
      
      const cacheFile = path.join(cacheDir, `${moduleId}.json`);
      await fs.writeFile(cacheFile, mcpContext.content, 'utf8');
      
      logger.debug('Updated MCP context cache', { moduleId, cacheFile });
    }

  private async notifyMCPClients(moduleId: string, mcpContext: {content: string, metadata: any}): Promise<void> {
      const notification = {
        type: 'module_knowledge_updated',
        moduleId,
        timestamp: new Date().toISOString(),
        metadata: mcpContext.metadata,
        content: mcpContext.content
      };
      
      // Notify via multiple channels for comprehensive coverage
      const notificationPromises: Promise<void>[] = [];
      
      // 1. WebSocket notifications for real-time clients
      if (process.env.MCP_WEBSOCKET_ENABLED === 'true') {
        notificationPromises.push(this.sendWebSocketNotification(notification));
      }
      
      // 2. HTTP webhook notifications for external integrations
      if (process.env.MCP_WEBHOOK_URL) {
        notificationPromises.push(this.sendWebhookNotification(notification));
      }
      
      // 3. Message queue for reliable delivery
      if (process.env.MCP_QUEUE_ENABLED === 'true') {
        notificationPromises.push(this.sendQueueNotification(notification));
      }
      
      // 4. Event emission for local subscribers
      this.emit('mcp_context_updated', notification);
      
      // 5. Direct client notifications for registered MCP clients
      for (const client of this.mcpClients) {
        notificationPromises.push(this.notifyDirectClient(client, notification));
      }
      
      // Execute all notifications concurrently
      try {
        await Promise.allSettled(notificationPromises);
        logger.debug('Successfully notified MCP clients', {
          moduleId,
          clientCount: this.mcpClients.size,
          notificationChannels: notificationPromises.length
        });
      } catch (error) {
        logger.error('Failed to notify some MCP clients', { moduleId, error });
      }
    }

  private async sendWebSocketNotification(notification: any): Promise<void> {
    try {
      // Concrete WebSocket notification implementation using HTTP fallback
      const notificationData = {
        type: notification.type,
        moduleId: notification.moduleId,
        timestamp: notification.timestamp,
        payload: notification.content
      };
      
      // Use HTTP POST as WebSocket alternative for reliable delivery
      if (process.env.MCP_WEBSOCKET_ENABLED === 'true') {
        const webhookEndpoint = process.env.MCP_WEBSOCKET_FALLBACK_URL || 'http://localhost:3001/ws-fallback';
        
        try {
          const response = await fetch(webhookEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Notification-Type': 'websocket-fallback'
            },
            body: JSON.stringify(notificationData)
          });
          
          if (response.ok) {
            logger.info('WebSocket fallback notification sent successfully', {
              endpoint: webhookEndpoint,
              status: response.status,
              moduleId: notification.moduleId
            });
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (error) {
          // Fallback to local event emission
          this.emit('websocket_fallback_failed', { notification: notificationData, error });
          logger.warn('WebSocket fallback failed, using local event emission', {
            error: error instanceof Error ? error.message : 'Unknown error',
            moduleId: notification.moduleId
          });
        }
      } else {
        logger.debug('WebSocket notifications disabled, skipping', {
          moduleId: notification.moduleId
        });
      }
    } catch (error) {
      logger.error('Failed to send WebSocket notification', { error });
      throw error;
    }
  }

  private async sendWebhookNotification(notification: any): Promise<void> {
      try {
        const webhookUrl = process.env.MCP_WEBHOOK_URL!;
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'AASWE-ModuleKnowledge/1.0',
            'X-MCP-Event-Type': notification.type
          },
          body: JSON.stringify(notification)
        });
        
        if (!response.ok) {
          throw new Error(`Webhook failed with status ${response.status}`);
        }
        
        logger.debug('Webhook notification sent successfully', {
          url: webhookUrl,
          status: response.status
        });
      } catch (error) {
        logger.error('Failed to send webhook notification', { error });
        throw error;
      }
    }

  private async sendQueueNotification(notification: any): Promise<void> {
    try {
      // Simplified queue notification without Redis dependency
      this.notificationQueue.push(notification);
      
      // Process queue asynchronously
      setImmediate(() => this.processNotificationQueue());
      logger.debug('Queue notification added to in-memory queue', {
        queueSize: this.notificationQueue.length,
        notificationType: notification.type
      });
    } catch (error) {
      logger.error('Failed to send queue notification', { error });
      throw error;
    }
  }

  private async notifyDirectClient(client: any, notification: any): Promise<void> {
      try {
        if (typeof client.notify === 'function') {
          await client.notify(notification);
        } else if (typeof client.send === 'function') {
          await client.send(JSON.stringify(notification));
        } else if (client.socket && client.socket.write) {
          client.socket.write(JSON.stringify(notification) + '\n');
        }
        
        logger.debug('Direct client notification sent', { clientId: client.id });
      } catch (error) {
        logger.error('Failed to notify direct client', { clientId: client.id, error });
        throw error;
      }
    }


  private async processNotificationQueue(): Promise<void> {
    if (!this.notificationQueue || this.notificationQueue.length === 0) {
      return;
    }
    
    const notifications = this.notificationQueue.splice(0, 10); // Process up to 10 at a time
    
    for (const notification of notifications) {
      try {
        // Process notification with concrete implementation
        logger.debug('Processing queued notification', {
          moduleId: notification.moduleId,
          type: notification.type,
          timestamp: notification.timestamp
        });
        
        // Concrete processing: persist notification metadata to database
        const notificationRecord = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          moduleId: notification.moduleId,
          type: notification.type,
          timestamp: notification.timestamp,
          processed: new Date().toISOString(),
          content: notification.content ? JSON.stringify(notification.content).substring(0, 1000) : null,
          metadata: notification.metadata || {}
        };
        
        // Persist to Neo4j database for audit trail and analytics
        await this.persistNotificationToDatabase(notificationRecord);
        
        logger.info('Notification processed and persisted to database', {
          id: notificationRecord.id,
          moduleId: notificationRecord.moduleId,
          type: notificationRecord.type
        });
        
      } catch (error) {
        logger.error('Failed to process queued notification', { notification, error });
      }
    }
  }

  private async persistNotificationToDatabase(notificationRecord: any): Promise<void> {
    try {
      // Use Neo4j to persist notification records for audit trail and analytics
      const neo4j = await this.getNeo4jDriver();
      const session = neo4j.session();
      
      try {
        await session.writeTransaction(async (tx: any) => {
          // Create notification node with full audit information
          await tx.run(
            `CREATE (n:NotificationRecord {
              id: $id,
              moduleId: $moduleId,
              type: $type,
              timestamp: $timestamp,
              processed: $processed,
              content: $content,
              metadata: $metadata
            })
            WITH n
            MATCH (m:Module {id: $moduleId})
            CREATE (m)-[:HAS_NOTIFICATION]->(n)
            RETURN n.id as notificationId`,
            {
              id: notificationRecord.id,
              moduleId: notificationRecord.moduleId,
              type: notificationRecord.type,
              timestamp: notificationRecord.timestamp,
              processed: notificationRecord.processed,
              content: notificationRecord.content,
              metadata: JSON.stringify(notificationRecord.metadata)
            }
          );
          
          // Update module statistics
          await tx.run(
            `MATCH (m:Module {id: $moduleId})
             SET m.lastNotification = $timestamp,
                 m.notificationCount = COALESCE(m.notificationCount, 0) + 1`,
            {
              moduleId: notificationRecord.moduleId,
              timestamp: notificationRecord.processed
            }
          );
        });
        
        logger.debug('Notification persisted to Neo4j database', {
          id: notificationRecord.id,
          moduleId: notificationRecord.moduleId
        });
      } finally {
        await session.close();
      }
    } catch (error) {
      logger.error('Failed to persist notification to database', {
        notificationId: notificationRecord.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Fallback: persist to local file system for reliability
      await this.persistNotificationToFileSystem(notificationRecord);
    }
  }

  private async persistNotificationToFileSystem(notificationRecord: any): Promise<void> {
    try {
      const notificationsDir = path.join(process.cwd(), '.aaswe', 'notifications');
      await fs.mkdir(notificationsDir, { recursive: true });
      
      const fileName = `${notificationRecord.id}.json`;
      const filePath = path.join(notificationsDir, fileName);
      
      await fs.writeFile(filePath, JSON.stringify(notificationRecord, null, 2), 'utf8');
      
      logger.debug('Notification persisted to file system as fallback', {
        id: notificationRecord.id,
        filePath
      });
    } catch (error) {
      logger.error('Failed to persist notification to file system', {
        notificationId: notificationRecord.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async analyzeAndUpdateFromSourceChange(sourceFilePath: string, knowledgeFilePath: string): Promise<void> {
    try {
      logger.debug('Analyzing source file changes and updating knowledge file', {
        sourceFile: sourceFilePath,
        knowledgeFile: knowledgeFilePath
      });

      // Read and analyze the source file
      const sourceContent = await fs.readFile(sourceFilePath, 'utf8');
      const fileExtension = path.extname(sourceFilePath);
      
      // Create a mock AST analysis result based on file content
      const astResult = await this.performLightweightAST(sourceContent, fileExtension);
      
      // Update the knowledge file using the existing method
      const updateResult = await this.updateKnowledgeFileFromCode(sourceFilePath, astResult);
      
      if (updateResult.success) {
        logger.debug('Successfully updated knowledge file from source changes', {
          sourceFile: sourceFilePath,
          knowledgeFile: knowledgeFilePath
        });
      } else {
        logger.warn('Failed to update knowledge file from source changes', {
          sourceFile: sourceFilePath,
          error: updateResult.error
        });
        
        // Fallback: just queue for sync
        await this.queueForSync(knowledgeFilePath, 'both');
      }
    } catch (error) {
      logger.error('Failed to analyze and update from source change', {
        sourceFile: sourceFilePath,
        knowledgeFile: knowledgeFilePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Fallback: queue for sync
      await this.queueForSync(knowledgeFilePath, 'both');
    }
  }

  private async performLightweightAST(content: string, fileExtension: string): Promise<any> {
    // Lightweight AST analysis without external dependencies
    const analysis = {
      filePath: '',
      language: this.getLanguageFromExtension(fileExtension),
      functions: this.extractFunctions(content),
      classes: this.extractClasses(content),
      imports: this.extractImports(content),
      exports: this.extractExports(content),
      complexity: this.calculateComplexity(content),
      dependencies: this.extractDependencies(content)
    };

    return analysis;
  }

  private getLanguageFromExtension(extension: string): string {
    const languageMap: { [key: string]: string } = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.hpp': 'cpp'
    };
    
    return languageMap[extension] || 'unknown';
  }

  private extractFunctions(content: string): Array<{ name: string; line: number; parameters: string[] }> {
    const functions: Array<{ name: string; line: number; parameters: string[] }> = [];
    const lines = content.split('\n');
    
    // Regex patterns for different function declarations
    const patterns = [
      /(?:function\s+|const\s+|let\s+|var\s+)(\w+)\s*[=:]?\s*(?:\([^)]*\)|function\s*\([^)]*\))/g,
      /(\w+)\s*\([^)]*\)\s*[{:]/g,
      /def\s+(\w+)\s*\([^)]*\):/g, // Python
      /(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)*(\w+)\s*\([^)]*\)\s*{/g // Java/C++
    ];
    
    lines.forEach((line, index) => {
      patterns.forEach(pattern => {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          if (match[1] && !functions.some(f => f.name === match[1])) {
            functions.push({
              name: match[1],
              line: index + 1,
              parameters: this.extractParameters(line)
            });
          }
        }
      });
    });
    
    return functions;
  }

  private extractClasses(content: string): Array<{ name: string; line: number; methods: string[] }> {
    const classes: Array<{ name: string; line: number; methods: string[] }> = [];
    const lines = content.split('\n');
    
    const classPatterns = [
      /class\s+(\w+)/g,
      /interface\s+(\w+)/g,
      /type\s+(\w+)/g
    ];
    
    lines.forEach((line, index) => {
      classPatterns.forEach(pattern => {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            classes.push({
              name: match[1],
              line: index + 1,
              methods: this.extractClassMethods(content, match[1], index)
            });
          }
        }
      });
    });
    
    return classes;
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importPatterns = [
      /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      /import\s+['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /from\s+(\w+)\s+import/g, // Python
      /import\s+(\w+(?:\.\w+)*)/g // Java
    ];
    
    importPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && !imports.includes(match[1])) {
          imports.push(match[1]);
        }
      }
    });
    
    return imports;
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];
    const exportPatterns = [
      /export\s+(?:default\s+)?(?:class\s+|function\s+|const\s+|let\s+|var\s+)?(\w+)/g,
      /module\.exports\s*=\s*(\w+)/g
    ];
    
    exportPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && !exports.includes(match[1])) {
          exports.push(match[1]);
        }
      }
    });
    
    return exports;
  }

  private calculateComplexity(content: string): number {
    // Simple cyclomatic complexity calculation
    const complexityKeywords = [
      'if', 'else', 'elif', 'while', 'for', 'switch', 'case',
      'try', 'catch', 'finally', '&&', '||', '?'
    ];
    
    let complexity = 1; // Base complexity
    
    complexityKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = content.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }

  private extractDependencies(content: string): string[] {
    // Extract dependencies from import statements
    return this.extractImports(content).filter(imp =>
      !imp.startsWith('.') && !imp.startsWith('/') // External dependencies only
    );
  }

  private extractParameters(line: string): string[] {
    const paramMatch = line.match(/\(([^)]*)\)/);
    if (!paramMatch || !paramMatch[1]) {
      return [];
    }
    
    return paramMatch[1]
      .split(',')
      .map(param => param.trim().split(/[:\s]/)[0])
      .filter(param => param.length > 0);
  }

  private extractClassMethods(content: string, className: string, classStartLine: number): string[] {
    const methods: string[] = [];
    const lines = content.split('\n');
    
    // Find the class body boundaries
    let braceCount = 0;
    let inClass = false;
    
    for (let i = classStartLine; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes(className) && (line.includes('class') || line.includes('interface'))) {
        inClass = true;
      }
      
      if (inClass) {
        // Count braces to find class boundaries
        const openBraces = (line.match(/{/g) || []).length;
        const closeBraces = (line.match(/}/g) || []).length;
        braceCount += openBraces - closeBraces;
        
        // Look for method patterns within the class
        const methodPatterns = [
          /(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*[{:]/g,
          /(\w+)\s*:\s*(?:function\s*)?\([^)]*\)\s*=>/g, // Arrow functions
          /(\w+)\s*\([^)]*\)\s*{/g // Simple function declarations
        ];
        
        methodPatterns.forEach(pattern => {
          const matches = line.matchAll(pattern);
          for (const match of matches) {
            if (match[1] &&
                match[1] !== className && // Not constructor
                !methods.includes(match[1]) &&
                !['constructor', 'if', 'for', 'while', 'switch'].includes(match[1])) {
              methods.push(match[1]);
            }
          }
        });
        
        // Exit when we've closed all braces (end of class)
        if (braceCount === 0 && i > classStartLine) {
          break;
        }
      }
    }
    
    return methods;
  }
}