/**
 * Project Analysis Service
 * 
 * Core orchestrator for automatic project analysis and TTL generation.
 * This service coordinates between AST analysis, RDF generation, and knowledge management
 * to provide comprehensive project understanding and context generation.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import logger from '../../utils/logger';
import { CodeIngestionService } from '../layer1/code-ingestion/CodeIngestionService';
import { ModuleKnowledgeManager } from '../layer1/module-knowledge/ModuleKnowledgeManager';
import { BaseAnalyzer } from '../layer1/ast-analyzer/BaseAnalyzer';
import { TypeScriptAnalyzer } from '../layer1/ast-analyzer/TypeScriptAnalyzer';
import { PythonAnalyzer } from '../layer1/ast-analyzer/PythonAnalyzer';
import { JavaAnalyzer } from '../layer1/ast-analyzer/JavaAnalyzer';
import { GoAnalyzer } from '../layer1/ast-analyzer/GoAnalyzer';
import { RustAnalyzer } from '../layer1/ast-analyzer/RustAnalyzer';
import { CppAnalyzer } from '../layer1/ast-analyzer/CppAnalyzer';

export interface ProjectAnalysisConfig {
  rootPath: string;
  outputDirectory?: string;
  languages?: string[];
  includePatterns?: string[];
  excludePatterns?: string[];
  generateTTL?: boolean;
  enableWatching?: boolean;
  preserveBusinessContext?: boolean;
  analysisDepth?: 'basic' | 'detailed' | 'comprehensive';
}

export interface ProjectAnalysisResult {
  projectPath: string;
  analysisId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  summary: {
    totalFiles: number;
    analyzedFiles: number;
    skippedFiles: number;
    errorFiles: number;
    ttlFilesGenerated: number;
    languageBreakdown: Record<string, number>;
  };
  files: Array<{
    filePath: string;
    language: string;
    status: 'success' | 'error' | 'skipped';
    ttlGenerated: boolean;
    error?: string;
  }>;
  errors: Array<{
    filePath: string;
    error: string;
    phase: 'discovery' | 'analysis' | 'ttl_generation';
  }>;
  warnings: string[];
  recommendations: string[];
}

export interface ProjectStructure {
  rootPath: string;
  packageFiles: Array<{
    path: string;
    type: 'package.json' | 'requirements.txt' | 'pom.xml' | 'go.mod' | 'Cargo.toml' | 'CMakeLists.txt';
    dependencies: string[];
  }>;
  sourceFiles: Array<{
    path: string;
    language: string;
    size: number;
    lastModified: Date;
  }>;
  directories: Array<{
    path: string;
    type: 'source' | 'test' | 'config' | 'docs' | 'build' | 'other';
    fileCount: number;
  }>;
  projectType: 'web' | 'api' | 'library' | 'cli' | 'desktop' | 'mobile' | 'mixed' | 'unknown';
  frameworks: string[];
  buildTools: string[];
}

/**
 * Project Analysis Service
 * 
 * Provides comprehensive project analysis capabilities including:
 * - Project structure detection and analysis
 * - Multi-language code analysis and AST generation
 * - Automatic TTL knowledge file generation
 * - Real-time file watching and incremental updates
 * - Integration with knowledge management system
 */
export class ProjectAnalysisService extends EventEmitter {
  private codeIngestionService: CodeIngestionService;
  private moduleKnowledgeManager: ModuleKnowledgeManager;
  private analyzers: Map<string, BaseAnalyzer>;
  private config: ProjectAnalysisConfig;
  private isInitialized = false;

  constructor(config: ProjectAnalysisConfig) {
    super();
    
    this.config = {
      outputDirectory: '.aaswe/knowledge',
      languages: ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'cpp'],
      includePatterns: ['**/*.ts', '**/*.js', '**/*.py', '**/*.java', '**/*.go', '**/*.rs', '**/*.cpp', '**/*.hpp'],
      excludePatterns: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/coverage/**',
        '**/.next/**',
        '**/.nuxt/**',
        '**/venv/**',
        '**/env/**',
        '**/.venv/**',
        '**/.env/**',
        '**/__pycache__/**',
        '**/*.pyc',
        '**/.pytest_cache/**',
        '**/target/**',
        '**/vendor/**'
      ],
      generateTTL: true,
      enableWatching: true,
      preserveBusinessContext: true,
      analysisDepth: 'detailed',
      ...config
    };

    // Initialize analyzers
    this.analyzers = new Map();
    this.setupAnalyzers();

    // Initialize services
    this.moduleKnowledgeManager = new ModuleKnowledgeManager({
      autoValidate: true,
      preserveBusinessContext: this.config.preserveBusinessContext || true,
      enableConflictResolution: true,
      enableLLMPreview: true
    });

    // Use TypeScript analyzer as primary for code ingestion
    const primaryAnalyzer = this.analyzers.get('typescript') || this.analyzers.get('javascript')!;
    this.codeIngestionService = new CodeIngestionService(primaryAnalyzer, {
      supportedLanguages: this.config.languages || ['typescript', 'javascript'],
      defaultExcludePatterns: this.config.excludePatterns || []
    });

    this.setupEventHandlers();
  }

  /**
   * Initialize the Project Analysis Service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Project Analysis Service', {
        rootPath: this.config.rootPath,
        languages: this.config.languages,
        analysisDepth: this.config.analysisDepth
      });

      // Initialize sub-services
      await this.moduleKnowledgeManager.initialize();
      await this.codeIngestionService.initialize();

      // Ensure output directory exists
      if (this.config.outputDirectory) {
        await fs.mkdir(path.resolve(this.config.rootPath, this.config.outputDirectory), { recursive: true });
      }

      this.isInitialized = true;
      logger.info('Project Analysis Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Project Analysis Service', { error });
      throw error;
    }
  }

  /**
   * Analyze entire project and generate TTL files
   */
  async analyzeProject(): Promise<ProjectAnalysisResult> {
    this.ensureInitialized();

    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();

    logger.info('Starting comprehensive project analysis', {
      analysisId,
      rootPath: this.config.rootPath,
      analysisDepth: this.config.analysisDepth
    });

    try {
      // Phase 1: Project Structure Discovery
      logger.info('Phase 1: Discovering project structure');
      const projectStructure = await this.discoverProjectStructure();
      this.emit('structureDiscovered', { analysisId, structure: projectStructure });

      // Phase 2: File Discovery and Filtering
      logger.info('Phase 2: Discovering and filtering source files');
      const sourceFiles = await this.discoverSourceFiles();
      
      // Phase 3: Code Analysis
      logger.info('Phase 3: Analyzing source code', { fileCount: sourceFiles.length });
      const analysisResults = await this.analyzeSourceFiles(sourceFiles, analysisId);

      // Phase 4: TTL Generation (if enabled)
      let ttlResults: any[] = [];
      if (this.config.generateTTL) {
        logger.info('Phase 4: Generating TTL knowledge files');
        ttlResults = await this.generateTTLFiles(analysisResults, analysisId);
      }

      // Phase 5: Setup Watching (if enabled)
      if (this.config.enableWatching) {
        logger.info('Phase 5: Setting up file watching');
        await this.setupProjectWatching();
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Compile final results
      const result: ProjectAnalysisResult = {
        projectPath: this.config.rootPath,
        analysisId,
        startTime,
        endTime,
        duration,
        summary: this.compileSummary(analysisResults, ttlResults),
        files: analysisResults.map(result => ({
          filePath: result.filePath,
          language: result.language,
          status: result.success ? 'success' : 'error',
          ttlGenerated: result.ttlGenerated || false,
          error: result.error
        })),
        errors: analysisResults
          .filter(result => !result.success)
          .map(result => ({
            filePath: result.filePath,
            error: result.error || 'Unknown error',
            phase: 'analysis' as const
          })),
        warnings: [],
        recommendations: this.generateRecommendations(projectStructure, analysisResults)
      };

      logger.info('Project analysis completed successfully', {
        analysisId,
        duration,
        totalFiles: result.summary.totalFiles,
        analyzedFiles: result.summary.analyzedFiles,
        ttlFilesGenerated: result.summary.ttlFilesGenerated
      });

      this.emit('analysisCompleted', result);
      return result;

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      logger.error('Project analysis failed', { analysisId, error, duration });
      
      const errorResult: ProjectAnalysisResult = {
        projectPath: this.config.rootPath,
        analysisId,
        startTime,
        endTime,
        duration,
        summary: {
          totalFiles: 0,
          analyzedFiles: 0,
          skippedFiles: 0,
          errorFiles: 1,
          ttlFilesGenerated: 0,
          languageBreakdown: {}
        },
        files: [],
        errors: [{
          filePath: this.config.rootPath,
          error: error instanceof Error ? error.message : 'Unknown error',
          phase: 'discovery'
        }],
        warnings: [],
        recommendations: []
      };

      this.emit('analysisFailed', { analysisId, error, result: errorResult });
      return errorResult;
    }
  }

  /**
   * Analyze specific files (incremental analysis)
   */
  async analyzeFiles(filePaths: string[]): Promise<ProjectAnalysisResult> {
    this.ensureInitialized();

    const analysisId = `incremental_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();

    logger.info('Starting incremental file analysis', {
      analysisId,
      fileCount: filePaths.length,
      files: filePaths
    });

    try {
      // Filter and validate file paths
      const validFiles = await this.validateFilePaths(filePaths);
      
      // Analyze files
      const analysisResults = await this.analyzeSourceFiles(validFiles, analysisId);

      // Generate TTL files if enabled
      let ttlResults: any[] = [];
      if (this.config.generateTTL) {
        ttlResults = await this.generateTTLFiles(analysisResults, analysisId);
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const result: ProjectAnalysisResult = {
        projectPath: this.config.rootPath,
        analysisId,
        startTime,
        endTime,
        duration,
        summary: this.compileSummary(analysisResults, ttlResults),
        files: analysisResults.map(result => ({
          filePath: result.filePath,
          language: result.language,
          status: result.success ? 'success' : 'error',
          ttlGenerated: result.ttlGenerated || false,
          error: result.error
        })),
        errors: analysisResults
          .filter(result => !result.success)
          .map(result => ({
            filePath: result.filePath,
            error: result.error || 'Unknown error',
            phase: 'analysis' as const
          })),
        warnings: [],
        recommendations: []
      };

      logger.info('Incremental analysis completed', {
        analysisId,
        duration,
        analyzedFiles: result.summary.analyzedFiles
      });

      this.emit('incrementalAnalysisCompleted', result);
      return result;

    } catch (error) {
      logger.error('Incremental analysis failed', { analysisId, error });
      throw error;
    }
  }

  /**
   * Get project structure information
   */
  async getProjectStructure(): Promise<ProjectStructure> {
    this.ensureInitialized();
    return await this.discoverProjectStructure();
  }

  /**
   * Get analysis status and metrics
   */
  getAnalysisMetrics(): any {
    return {
      codeIngestion: this.codeIngestionService.getMetrics(),
      knowledgeFiles: {
        totalFiles: 0, // Would be populated from module knowledge manager
        validFiles: 0,
        businessContextEnhanced: 0
      },
      analyzers: Array.from(this.analyzers.keys()),
      lastAnalysis: new Date()
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Project Analysis Service');

    try {
      await this.codeIngestionService.shutdown();
      this.removeAllListeners();
      this.isInitialized = false;
      
      logger.info('Project Analysis Service shutdown completed');
    } catch (error) {
      logger.error('Error during Project Analysis Service shutdown', { error });
      throw error;
    }
  }

  // Private methods

  private setupAnalyzers(): void {
    this.analyzers.set('typescript', new TypeScriptAnalyzer());
    this.analyzers.set('javascript', new TypeScriptAnalyzer()); // TypeScript analyzer handles JS too
    this.analyzers.set('python', new PythonAnalyzer());
    this.analyzers.set('java', new JavaAnalyzer());
    this.analyzers.set('go', new GoAnalyzer());
    this.analyzers.set('rust', new RustAnalyzer());
    this.analyzers.set('cpp', new CppAnalyzer());
  }

  private setupEventHandlers(): void {
    // Code ingestion events
    this.codeIngestionService.on('analysisCompleted', (result) => {
      this.emit('codeAnalysisCompleted', result);
    });

    this.codeIngestionService.on('jobCompleted', (job) => {
      this.emit('analysisJobCompleted', job);
    });

    this.codeIngestionService.on('jobFailed', (job) => {
      this.emit('analysisJobFailed', job);
    });

    // Module knowledge events
    this.moduleKnowledgeManager.on('file_updated', (event) => {
      this.emit('ttlFileUpdated', event);
    });

    this.moduleKnowledgeManager.on('file_validated', (event) => {
      this.emit('ttlFileValidated', event);
    });
  }

  private async discoverProjectStructure(): Promise<ProjectStructure> {
    const rootPath = this.config.rootPath;
    
    try {
      // Discover package files
      const packageFiles = await this.discoverPackageFiles(rootPath);
      
      // Discover source files
      const sourceFiles = await this.discoverSourceFiles();
      
      // Discover directories
      const directories = await this.discoverDirectories(rootPath);
      
      // Determine project type
      const projectType = this.determineProjectType(packageFiles, sourceFiles);
      
      // Detect frameworks
      const frameworks = this.detectFrameworks(packageFiles, sourceFiles);
      
      // Detect build tools
      const buildTools = this.detectBuildTools(packageFiles);

      return {
        rootPath,
        packageFiles,
        sourceFiles,
        directories,
        projectType,
        frameworks,
        buildTools
      };
    } catch (error) {
      logger.error('Failed to discover project structure', { rootPath, error });
      throw error;
    }
  }

  private async discoverPackageFiles(rootPath: string): Promise<ProjectStructure['packageFiles']> {
    const packageFiles: ProjectStructure['packageFiles'] = [];
    
    const packageFilePatterns = [
      { pattern: 'package.json', type: 'package.json' as const },
      { pattern: 'requirements.txt', type: 'requirements.txt' as const },
      { pattern: 'pom.xml', type: 'pom.xml' as const },
      { pattern: 'go.mod', type: 'go.mod' as const },
      { pattern: 'Cargo.toml', type: 'Cargo.toml' as const },
      { pattern: 'CMakeLists.txt', type: 'CMakeLists.txt' as const }
    ];

    for (const { pattern, type } of packageFilePatterns) {
      const filePath = path.join(rootPath, pattern);
      
      try {
        await fs.access(filePath);
        const dependencies = await this.extractDependencies(filePath, type);
        packageFiles.push({ path: filePath, type, dependencies });
      } catch {
        // File doesn't exist, continue
      }
    }

    return packageFiles;
  }

  private async discoverSourceFiles(): Promise<ProjectStructure['sourceFiles']> {
    const { glob } = await import('glob');
    const sourceFiles: ProjectStructure['sourceFiles'] = [];

    for (const pattern of this.config.includePatterns!) {
      try {
        const files = await glob(pattern, {
          cwd: this.config.rootPath,
          ignore: this.config.excludePatterns || [],
          absolute: true
        });

        for (const filePath of files) {
          try {
            const stats = await fs.stat(filePath);
            const language = this.getLanguageFromFile(filePath);
            
            sourceFiles.push({
              path: filePath,
              language,
              size: stats.size,
              lastModified: stats.mtime
            });
          } catch (error) {
            logger.warn('Failed to stat source file', { filePath, error });
          }
        }
      } catch (error) {
        logger.warn('Failed to glob pattern', { pattern, error });
      }
    }

    return sourceFiles;
  }

  private async discoverDirectories(rootPath: string): Promise<ProjectStructure['directories']> {
    const directories: ProjectStructure['directories'] = [];
    
    try {
      const entries = await fs.readdir(rootPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const dirPath = path.join(rootPath, entry.name);
          const type = this.classifyDirectory(entry.name);
          const fileCount = await this.countFilesInDirectory(dirPath);
          
          directories.push({
            path: dirPath,
            type,
            fileCount
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to discover directories', { rootPath, error });
    }

    return directories;
  }

  private async analyzeSourceFiles(sourceFiles: ProjectStructure['sourceFiles'], analysisId: string): Promise<any[]> {
    const results: any[] = [];
    const batchSize = 10; // Process files in batches

    logger.info('Analyzing source files', { 
      totalFiles: sourceFiles.length, 
      batchSize,
      analysisId 
    });

    for (let i = 0; i < sourceFiles.length; i += batchSize) {
      const batch = sourceFiles.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (file) => {
        try {
          const analyzer = this.analyzers.get(file.language);
          if (!analyzer) {
            return {
              filePath: file.path,
              language: file.language,
              success: false,
              error: `No analyzer available for language: ${file.language}`
            };
          }

          logger.debug('Analyzing file', { filePath: file.path, language: file.language });
          const analysisResult = await analyzer.analyzeFile(file.path);
          
          return {
            filePath: file.path,
            language: file.language,
            success: true,
            analysisResult,
            ttlGenerated: false
          };
        } catch (error) {
          logger.error('Failed to analyze file', { filePath: file.path, error });
          return {
            filePath: file.path,
            language: file.language,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Emit progress
      this.emit('analysisProgress', {
        analysisId,
        processed: Math.min(i + batchSize, sourceFiles.length),
        total: sourceFiles.length,
        currentBatch: batchResults
      });
    }

    return results;
  }

  private async generateTTLFiles(analysisResults: any[], analysisId: string): Promise<any[]> {
    const ttlResults: any[] = [];

    logger.info('Generating TTL knowledge files', { 
      fileCount: analysisResults.filter(r => r.success).length,
      analysisId 
    });

    for (const result of analysisResults) {
      if (!result.success || !result.analysisResult) {
        continue;
      }

      try {
        const ttlResult = await this.moduleKnowledgeManager.updateKnowledgeFileFromCode(
          result.filePath,
          result.analysisResult
        );

        if (ttlResult.success) {
          result.ttlGenerated = true;
          ttlResults.push({
            sourceFile: result.filePath,
            ttlFile: ttlResult.data?.filePath,
            success: true
          });
        } else {
          ttlResults.push({
            sourceFile: result.filePath,
            success: false,
            error: ttlResult.error
          });
        }
      } catch (error) {
        logger.error('Failed to generate TTL file', { 
          sourceFile: result.filePath, 
          error 
        });
        
        ttlResults.push({
          sourceFile: result.filePath,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return ttlResults;
  }

  private async setupProjectWatching(): Promise<void> {
    try {
      // Add the project as a repository to the code ingestion service
      await this.codeIngestionService.addRepository({
        name: path.basename(this.config.rootPath),
        path: this.config.rootPath,
        enableFileWatcher: true,
        includePatterns: this.config.includePatterns || [],
        excludePatterns: this.config.excludePatterns || [],
        languages: this.config.languages || []
      });

      logger.info('Project watching setup completed', {
        rootPath: this.config.rootPath
      });
    } catch (error) {
      logger.error('Failed to setup project watching', { error });
      throw error;
    }
  }

  private async validateFilePaths(filePaths: string[]): Promise<ProjectStructure['sourceFiles']> {
    const validFiles: ProjectStructure['sourceFiles'] = [];

    for (const filePath of filePaths) {
      try {
        const stats = await fs.stat(filePath);
        const language = this.getLanguageFromFile(filePath);
        
        if (this.config.languages!.includes(language)) {
          validFiles.push({
            path: filePath,
            language,
            size: stats.size,
            lastModified: stats.mtime
          });
        }
      } catch (error) {
        logger.warn('Invalid file path', { filePath, error });
      }
    }

    return validFiles;
  }

  private compileSummary(analysisResults: any[], ttlResults: any[]): ProjectAnalysisResult['summary'] {
    const languageBreakdown: Record<string, number> = {};
    
    for (const result of analysisResults) {
      languageBreakdown[result.language] = (languageBreakdown[result.language] || 0) + 1;
    }

    return {
      totalFiles: analysisResults.length,
      analyzedFiles: analysisResults.filter(r => r.success).length,
      skippedFiles: 0,
      errorFiles: analysisResults.filter(r => !r.success).length,
      ttlFilesGenerated: ttlResults.filter(r => r.success).length,
      languageBreakdown
    };
  }

  private generateRecommendations(structure: ProjectStructure, analysisResults: any[]): string[] {
    const recommendations: string[] = [];

    // Check for missing package files
    if (structure.packageFiles.length === 0) {
      recommendations.push('Consider adding a package management file (package.json, requirements.txt, etc.)');
    }

    // Check for test coverage
    const hasTests = analysisResults.some(r => 
      r.filePath.includes('test') || r.filePath.includes('spec')
    );
    if (!hasTests) {
      recommendations.push('Consider adding test files to improve code quality and documentation');
    }

    // Check for documentation
    const hasReadme = structure.sourceFiles.some(f => 
      path.basename(f.path).toLowerCase().includes('readme')
    );
    if (!hasReadme) {
      recommendations.push('Consider adding a README.md file to document your project');
    }

    return recommendations;
  }

  // Utility methods

  private getLanguageFromFile(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.hpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp'
    };
    
    return languageMap[ext] || 'unknown';
  }

  private async extractDependencies(filePath: string, type: ProjectStructure['packageFiles'][0]['type']): Promise<string[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      switch (type) {
        case 'package.json':
          const pkg = JSON.parse(content);
          return [
            ...Object.keys(pkg.dependencies || {}),
            ...Object.keys(pkg.devDependencies || {})
          ];
        
        case 'requirements.txt':
          return content.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(line => line.split('==')[0].split('>=')[0].split('<=')[0]);
        
        default:
          return [];
      }
    } catch (error) {
      logger.warn('Failed to extract dependencies', { filePath, type, error });
      return [];
    }
  }

  private determineProjectType(packageFiles: ProjectStructure['packageFiles'], sourceFiles: ProjectStructure['sourceFiles']): ProjectStructure['projectType'] {
    // Simple heuristics for project type detection
    const hasWebFiles = sourceFiles.some(f =>
      f.path.includes('html') || f.path.includes('css') || f.path.includes('react') || f.path.includes('vue')
    );
    
    const hasApiFiles = sourceFiles.some(f =>
      f.path.includes('api') || f.path.includes('server') || f.path.includes('route')
    );
    
    const hasCliFiles = sourceFiles.some(f =>
      f.path.includes('cli') || f.path.includes('bin')
    );

    // Check package files for additional context
    const hasWebDependencies = packageFiles.some(pkg =>
      pkg.dependencies.some(dep => ['react', 'vue', 'angular', 'svelte'].includes(dep.toLowerCase()))
    );

    if ((hasWebFiles || hasWebDependencies) && hasApiFiles) return 'mixed';
    if (hasWebFiles || hasWebDependencies) return 'web';
    if (hasApiFiles) return 'api';
    if (hasCliFiles) return 'cli';
    
    return 'library';
  }

  private detectFrameworks(packageFiles: ProjectStructure['packageFiles'], sourceFiles: ProjectStructure['sourceFiles']): string[] {
    const frameworks: string[] = [];
    
    // Check package dependencies
    for (const pkgFile of packageFiles) {
      const deps = pkgFile.dependencies.join(' ').toLowerCase();
      
      if (deps.includes('react')) frameworks.push('React');
      if (deps.includes('vue')) frameworks.push('Vue');
      if (deps.includes('angular')) frameworks.push('Angular');
      if (deps.includes('express')) frameworks.push('Express');
      if (deps.includes('fastapi')) frameworks.push('FastAPI');
      if (deps.includes('django')) frameworks.push('Django');
      if (deps.includes('spring')) frameworks.push('Spring');
    }
    
    // Check source files for framework indicators
    const sourceContent = sourceFiles.map(f => f.path.toLowerCase()).join(' ');
    if (sourceContent.includes('react') && !frameworks.includes('React')) frameworks.push('React');
    if (sourceContent.includes('vue') && !frameworks.includes('Vue')) frameworks.push('Vue');
    if (sourceContent.includes('angular') && !frameworks.includes('Angular')) frameworks.push('Angular');
    
    return [...new Set(frameworks)];
  }

  private detectBuildTools(packageFiles: ProjectStructure['packageFiles']): string[] {
    const buildTools: string[] = [];
    
    for (const pkgFile of packageFiles) {
      switch (pkgFile.type) {
        case 'package.json':
          buildTools.push('npm/yarn');
          break;
        case 'pom.xml':
          buildTools.push('Maven');
          break;
        case 'go.mod':
          buildTools.push('Go Modules');
          break;
        case 'Cargo.toml':
          buildTools.push('Cargo');
          break;
        case 'CMakeLists.txt':
          buildTools.push('CMake');
          break;
      }
    }
    
    return buildTools;
  }

  private classifyDirectory(dirName: string): ProjectStructure['directories'][0]['type'] {
    const name = dirName.toLowerCase();
    
    if (name.includes('test') || name.includes('spec')) return 'test';
    if (name.includes('src') || name.includes('lib')) return 'source';
    if (name.includes('config') || name.includes('conf')) return 'config';
    if (name.includes('doc') || name.includes('readme')) return 'docs';
    if (name.includes('build') || name.includes('dist')) return 'build';
    
    return 'other';
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Project Analysis Service not initialized. Call initialize() first.');
    }
  }

  private async countFilesInDirectory(dirPath: string): Promise<number> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let count = 0;
      
      for (const entry of entries) {
        if (entry.isFile()) {
          count++;
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          count += await this.countFilesInDirectory(path.join(dirPath, entry.name));
        }
      }
      
      return count;
    } catch (error) {
      logger.warn('Failed to count files in directory', { dirPath, error });
      return 0;
    }
  }
}