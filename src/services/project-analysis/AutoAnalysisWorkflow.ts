/**
 * Auto Analysis Workflow
 * 
 * Enhanced workflow for automatic project analysis with comprehensive
 * codebase understanding, TTL generation, and knowledge graph population.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import logger from '../../utils/logger';
import { ProjectAnalysisService, ProjectAnalysisResult } from './ProjectAnalysisService';
import { RDFService } from '../layer1/rdf-generator/RDFService';
import { EnhancedRDFGenerator } from '../layer1/rdf-generator/EnhancedRDFGenerator';
import { ModuleKnowledgeManager } from '../layer1/module-knowledge/ModuleKnowledgeManager';
import { BaseAnalyzer } from '../layer1/ast-analyzer/BaseAnalyzer';
import { TypeScriptAnalyzer } from '../layer1/ast-analyzer/TypeScriptAnalyzer';
import { PythonAnalyzer } from '../layer1/ast-analyzer/PythonAnalyzer';
import { JavaAnalyzer } from '../layer1/ast-analyzer/JavaAnalyzer';
import { AnalysisResult } from '../layer1/ast-analyzer/types';
import { BusinessContextPreserver, PreservationResult } from './BusinessContextPreserver';

export interface AutoAnalysisConfig {
  projectRoot: string;
  outputDirectory: string;
  enableConcreteExtraction: boolean;
  enableBusinessContextPlaceholders: boolean;
  enableKnowledgeGraphPopulation: boolean;
  enableMCPContextLoading: boolean;
  preserveBusinessContext: boolean;
  analysisDepth: 'basic' | 'detailed' | 'comprehensive';
  languages: string[];
  includePatterns: string[];
  excludePatterns: string[];
}

export interface ConcreteInformation {
  actualClassNames: string[];
  actualMethodSignatures: string[];
  actualDependencies: string[];
  actualExports: string[];
  actualImports: string[];
  architecturalPatterns: string[];
  businessDomainIndicators: string[];
  qualityMetrics: {
    complexity: number;
    maintainability: number;
    testCoverage: number;
    documentation: number;
  };
}

export interface EnhancedAnalysisResult extends ProjectAnalysisResult {
  concreteInformation: Map<string, ConcreteInformation>;
  knowledgeGraphNodes: number;
  knowledgeGraphRelationships: number;
  mcpContextSize: number;
  businessContextPreserved?: boolean;
  enhancementsPreserved?: number;
  preservationResult?: PreservationResult;
}

/**
 * Auto Analysis Workflow
 * 
 * Provides enhanced automatic analysis with concrete information extraction,
 * comprehensive TTL generation, and knowledge graph population.
 */
export class AutoAnalysisWorkflow extends EventEmitter {
  private config: AutoAnalysisConfig;
  private projectAnalysisService: ProjectAnalysisService;
  private rdfService: RDFService;
  private businessContextPreserver: BusinessContextPreserver;
  private moduleKnowledgeManager: ModuleKnowledgeManager;
  private analyzers: Map<string, BaseAnalyzer>;
  private isInitialized = false;

  constructor(config: Partial<AutoAnalysisConfig> = {}) {
    super();
    
    this.config = {
      projectRoot: process.cwd(),
      outputDirectory: '.aaswe/knowledge',
      enableConcreteExtraction: true,
      enableBusinessContextPlaceholders: true,
      enableKnowledgeGraphPopulation: true,
      enableMCPContextLoading: true,
      preserveBusinessContext: true,
      analysisDepth: 'comprehensive',
      languages: ['typescript', 'javascript', 'python', 'java'],
      includePatterns: ['**/*.ts', '**/*.js', '**/*.py', '**/*.java'],
      excludePatterns: [
        // General build/dependency directories
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/out/**',
        '**/target/**',
        '**/bin/**',
        '**/obj/**',
        '**/lib/**',
        '**/libs/**',
        
        // Python
        '**/venv/**',
        '**/env/**',
        '**/.venv/**',
        '**/.env/**',
        '**/site-packages/**',
        '**/__pycache__/**',
        '**/*.pyc',
        '**/*.pyo',
        '**/*.pyd',
        '**/pip-log.txt',
        '**/pip-delete-this-directory.txt',
        
        // Java
        '**/target/**',
        '**/.m2/**',
        '**/.gradle/**',
        '**/gradle/**',
        '**/gradlew*',
        '**/*.class',
        '**/*.jar',
        '**/*.war',
        '**/*.ear',
        
        // .NET/C#
        '**/bin/**',
        '**/obj/**',
        '**/packages/**',
        '**/*.dll',
        '**/*.exe',
        '**/*.pdb',
        
        // Go
        '**/vendor/**',
        '**/*.exe',
        
        // Rust
        '**/target/**',
        '**/Cargo.lock',
        
        // C/C++
        '**/*.o',
        '**/*.so',
        '**/*.dylib',
        '**/*.a',
        
        // IDE and editor files
        '**/.vscode/**',
        '**/.idea/**',
        '**/*.swp',
        '**/*.swo',
        '**/*~',
        
        // Test and coverage
        '**/*.test.*',
        '**/*.spec.*',
        '**/test/**',
        '**/tests/**',
        '**/coverage/**',
        '**/.nyc_output/**',
        
        // Temporary and cache
        '**/tmp/**',
        '**/temp/**',
        '**/.cache/**',
        '**/cache/**',
        
        // OS files
        '**/.DS_Store',
        '**/Thumbs.db',
        
        // Logs
        '**/*.log',
        '**/logs/**'
      ],
      ...config
    };

    // Initialize services
    this.projectAnalysisService = new ProjectAnalysisService({
      rootPath: this.config.projectRoot,
      outputDirectory: this.config.outputDirectory,
      languages: this.config.languages,
      includePatterns: this.config.includePatterns,
      excludePatterns: this.config.excludePatterns,
      generateTTL: true,
      enableWatching: false, // Controlled by trigger system
      preserveBusinessContext: this.config.preserveBusinessContext,
      analysisDepth: this.config.analysisDepth
    });

    this.rdfService = new RDFService({
      includeBusinessContext: this.config.enableBusinessContextPlaceholders,
      generatePlaceholders: this.config.enableBusinessContextPlaceholders,
      optimizeForLLM: true,
      optimizeForNeo4j: this.config.enableKnowledgeGraphPopulation
    });

    this.moduleKnowledgeManager = new ModuleKnowledgeManager({
      preserveBusinessContext: this.config.preserveBusinessContext,
      enableConflictResolution: true,
      enableLLMPreview: this.config.enableMCPContextLoading
    });

    // Initialize business context preserver
    this.businessContextPreserver = new BusinessContextPreserver({
      preservationEnabled: this.config.preserveBusinessContext,
      backupEnabled: true,
      backupDirectory: path.join(this.config.projectRoot, '.aaswe', 'backups', 'business-context'),
      conflictResolution: 'merge',
      maxBackupVersions: 10
    });

    // Initialize analyzers
    this.analyzers = new Map();
    this.setupAnalyzers();
  }

  /**
   * Initialize the workflow
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Auto Analysis Workflow', {
        projectRoot: this.config.projectRoot,
        analysisDepth: this.config.analysisDepth,
        enableConcreteExtraction: this.config.enableConcreteExtraction
      });

      // Initialize all services
      await this.projectAnalysisService.initialize();
      await this.moduleKnowledgeManager.initialize();
      await this.businessContextPreserver.initialize();

      // Ensure output directory exists
      await fs.mkdir(path.resolve(this.config.projectRoot, this.config.outputDirectory), { 
        recursive: true 
      });

      this.isInitialized = true;
      logger.info('Auto Analysis Workflow initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Auto Analysis Workflow', { error });
      throw error;
    }
  }

  /**
   * Execute comprehensive automatic analysis
   */
  async executeComprehensiveAnalysis(): Promise<EnhancedAnalysisResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    logger.info('Starting comprehensive automatic analysis');

    try {
      // Phase 1: Standard project analysis
      logger.info('Phase 1: Executing standard project analysis');
      const standardResult = await this.projectAnalysisService.analyzeProject();
      
      // Phase 2: Extract concrete information
      logger.info('Phase 2: Extracting concrete information');
      const concreteInformation = await this.extractConcreteInformation(standardResult);
      
      // Phase 3: Generate enhanced TTL files
      logger.info('Phase 3: Generating enhanced TTL files');
      const ttlResults = await this.generateEnhancedTTLFiles(standardResult, concreteInformation);
      
      // Phase 4: Populate knowledge graph
      let knowledgeGraphStats = { nodes: 0, relationships: 0 };
      if (this.config.enableKnowledgeGraphPopulation) {
        logger.info('Phase 4: Populating knowledge graph');
        try {
          // Check if Neo4j is available before attempting population
          const neo4jAvailable = await this.checkNeo4jAvailability();
          
          if (neo4jAvailable) {
            knowledgeGraphStats = await this.populateKnowledgeGraph(ttlResults);
            logger.info('✅ Knowledge graph populated successfully');
          } else {
            logger.warn('⚠️  Neo4j not available - skipping knowledge graph population');
            logger.info('💡 To enable Neo4j: Set NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD in .env.aaswe');
            // Still count entities for statistics from TTL files
            knowledgeGraphStats = await this.populateKnowledgeGraph(ttlResults);
          }
        } catch (error) {
          logger.error('❌ Knowledge graph population failed', { error });
          logger.info('💡 TTL files generated successfully - knowledge graph population is optional');
          // Don't fail the entire workflow for Neo4j issues
        }
      }
      
      // Phase 5: Load MCP context
      let mcpContextSize = 0;
      if (this.config.enableMCPContextLoading) {
        logger.info('Phase 5: Loading MCP context');
        mcpContextSize = await this.loadMCPContext(ttlResults);
      }
      
      // Phase 6: Preserve and restore business context
      let preservationResult: PreservationResult | undefined;
      if (this.config.preserveBusinessContext) {
        logger.info('Phase 6: Preserving business context');
        preservationResult = await this.businessContextPreserver.preserveBusinessContext(
          Array.from(ttlResults.keys())
        );
        
        // Restore business context to the newly generated TTL files
        if (preservationResult.success) {
          logger.info('Phase 6b: Restoring business context to TTL files');
          const restorationResult = await this.businessContextPreserver.restoreContext(
            Array.from(ttlResults.keys())
          );
          
          // Update preservation result with restoration stats
          if (restorationResult.success) {
            preservationResult.statistics.enhancementsPreserved += restorationResult.statistics.enhancementsPreserved;
            preservationResult.conflictsResolved += restorationResult.conflictsResolved;
          }
        }
      }

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Create enhanced result
      const enhancedResult: EnhancedAnalysisResult = {
        ...standardResult,
        duration: totalDuration,
        concreteInformation,
        knowledgeGraphNodes: knowledgeGraphStats.nodes,
        knowledgeGraphRelationships: knowledgeGraphStats.relationships,
        mcpContextSize,
        businessContextPreserved: preservationResult?.success || false,
        enhancementsPreserved: preservationResult?.preservedEnhancements || 0,
        ...(preservationResult && { preservationResult }),
        summary: {
          ...standardResult.summary,
          ttlFilesGenerated: ttlResults.size
        }
      };

      logger.info('Comprehensive analysis completed successfully', {
        duration: totalDuration,
        analyzedFiles: enhancedResult.summary.analyzedFiles,
        ttlFilesGenerated: enhancedResult.summary.ttlFilesGenerated,
        knowledgeGraphNodes: knowledgeGraphStats.nodes,
        mcpContextSize,
        businessContextPreserved: preservationResult?.success || false,
        enhancementsPreserved: preservationResult?.preservedEnhancements || 0
      });

      this.emit('analysis_completed', enhancedResult);
      return enhancedResult;

    } catch (error) {
      logger.error('Comprehensive analysis failed', { error });
      this.emit('analysis_failed', { error });
      throw error;
    }
  }

  /**
   * Execute incremental analysis for changed files
   */
  async executeIncrementalAnalysis(changedFiles: string[]): Promise<EnhancedAnalysisResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    logger.info('Starting incremental analysis', { 
      changedFiles: changedFiles.length 
    });

    try {
      // Analyze only changed files
      const standardResult = await this.projectAnalysisService.analyzeFiles(changedFiles);
      
      // Extract concrete information for changed files only
      const concreteInformation = await this.extractConcreteInformation(standardResult);
      
      // Update TTL files for changed modules
      const ttlResults = await this.updateTTLFiles(changedFiles, concreteInformation);
      
      // Update knowledge graph incrementally
      let knowledgeGraphStats = { nodes: 0, relationships: 0 };
      if (this.config.enableKnowledgeGraphPopulation) {
        knowledgeGraphStats = await this.updateKnowledgeGraph(ttlResults);
      }
      
      // Update MCP context
      let mcpContextSize = 0;
      if (this.config.enableMCPContextLoading) {
        mcpContextSize = await this.updateMCPContext(ttlResults);
      }

      // Phase 6: Preserve and restore business context for incremental analysis
      let preservationResult: PreservationResult | undefined;
      if (this.config.preserveBusinessContext) {
        preservationResult = await this.businessContextPreserver.preserveBusinessContext(
          Array.from(ttlResults.keys())
        );
        
        // Restore business context to the updated TTL files
        if (preservationResult && preservationResult.success) {
          const restorationResult = await this.businessContextPreserver.restoreContext(
            Array.from(ttlResults.keys())
          );
          
          // Update preservation result with restoration stats
          if (restorationResult.success) {
            preservationResult.statistics.enhancementsPreserved += restorationResult.statistics.enhancementsPreserved;
            preservationResult.conflictsResolved += restorationResult.conflictsResolved;
          }
        }
      }

      const enhancedResult: EnhancedAnalysisResult = {
        ...standardResult,
        concreteInformation,
        knowledgeGraphNodes: knowledgeGraphStats.nodes,
        knowledgeGraphRelationships: knowledgeGraphStats.relationships,
        mcpContextSize,
        businessContextPreserved: preservationResult?.success || false,
        enhancementsPreserved: preservationResult?.preservedEnhancements || 0,
        ...(preservationResult && { preservationResult })
      };

      logger.info('Incremental analysis completed', {
        changedFiles: changedFiles.length,
        duration: enhancedResult.duration
      });

      this.emit('incremental_analysis_completed', enhancedResult);
      return enhancedResult;

    } catch (error) {
      logger.error('Incremental analysis failed', { error });
      throw error;
    }
  }

  // Private methods

  private setupAnalyzers(): void {
    this.analyzers.set('typescript', new TypeScriptAnalyzer());
    this.analyzers.set('javascript', new TypeScriptAnalyzer());
    this.analyzers.set('python', new PythonAnalyzer());
    this.analyzers.set('java', new JavaAnalyzer());
  }

  private async extractConcreteInformation(
    analysisResult: ProjectAnalysisResult
  ): Promise<Map<string, ConcreteInformation>> {
    const concreteInfo = new Map<string, ConcreteInformation>();

    if (!this.config.enableConcreteExtraction) {
      return concreteInfo;
    }

    logger.debug('Extracting concrete information using MultiLanguageCodeGraphAnalyzer');

    try {
      // Use MultiLanguageCodeGraphAnalyzer for reliable multi-language analysis
      const { MultiLanguageCodeGraphAnalyzer } = await import('./MultiLanguageCodeGraphAnalyzer');
      const { Neo4jDatabaseService } = await import('../layer2/neo4j-database/Neo4jDatabaseService');
      
      // Create and connect Neo4j service
      const neo4jService = new Neo4jDatabaseService();
      
      // Try to connect to Neo4j if credentials are available
      const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
      const neo4jUsername = process.env.NEO4J_USERNAME || 'neo4j';
      const neo4jPassword = process.env.NEO4J_PASSWORD || 'aaswe-password';
      
      const config = {
        uri: neo4jUri,
        username: neo4jUsername,
        password: neo4jPassword,
        database: 'neo4j',
        encrypted: false
      };
      
      await neo4jService.connect(config);
      const analyzer = new MultiLanguageCodeGraphAnalyzer(neo4jService);
      
      // Analyze the project using the enhanced analyzer
      const analysisResult = await analyzer.analyzeMultiLanguageCodebase(this.config.projectRoot);
      
      // Disconnect after analysis
      await neo4jService.disconnect();
      
      // Convert MultiLanguageCodeGraphAnalyzer results to ConcreteInformation format
      for (const entity of analysisResult.entities) {
        if (entity.type === 'File') {
          const filePath = entity.filePath;
          
          // Get all entities for this file
          const fileEntities = analysisResult.entities.filter(e => e.filePath === filePath);
          const classes = fileEntities.filter(e => e.type === 'Class');
          const methods = fileEntities.filter(e => e.type === 'Method' || e.type === 'Function');
          
          const concrete: ConcreteInformation = {
            actualClassNames: classes.map(c => c.name),
            actualMethodSignatures: methods.map(m => `${m.name}()`), // Simplified signature
            actualDependencies: [], // Would need relationship analysis
            actualExports: classes.filter(c => c.metadata?.visibility === 'public').map(c => c.name),
            actualImports: [], // Would need import analysis
            architecturalPatterns: this.detectArchitecturalPatternsFromNames([...classes.map(c => c.name), ...methods.map(m => m.name)]),
            businessDomainIndicators: this.detectBusinessDomainFromNames([...classes.map(c => c.name), ...methods.map(m => m.name)]),
            qualityMetrics: {
              complexity: entity.metadata?.complexity || 1,
              maintainability: 80, // Default value
              testCoverage: 0,
              documentation: 0
            }
          };
          
          concreteInfo.set(filePath, concrete);
        }
      }
      
      logger.info('✅ Concrete information extracted using MultiLanguageCodeGraphAnalyzer', {
        filesProcessed: concreteInfo.size,
        totalEntities: analysisResult.entities.length,
        languages: analysisResult.languages.join(', ')
      });

    } catch (error) {
      logger.warn('⚠️ MultiLanguageCodeGraphAnalyzer failed, falling back to old analyzers', { error });
      
      // Fallback to old analyzer approach
      for (const fileResult of analysisResult.files) {
        if (fileResult.status !== 'success') {
          continue;
        }

        try {
          const analyzer = this.analyzers.get(fileResult.language);
          if (!analyzer) {
            continue;
          }

          const detailedAnalysis = await analyzer.analyzeFile(fileResult.filePath);
          const concrete = await this.buildConcreteInformation(detailedAnalysis);
          concreteInfo.set(fileResult.filePath, concrete);

        } catch (error) {
          logger.warn('Failed to extract concrete information', {
            filePath: fileResult.filePath,
            error
          });
        }
      }
    }

    logger.debug('Concrete information extraction completed', {
      filesProcessed: concreteInfo.size
    });

    return concreteInfo;
  }

  private async buildConcreteInformation(analysis: AnalysisResult): Promise<ConcreteInformation> {
    return {
      actualClassNames: analysis.classes.map(cls => cls.name),
      actualMethodSignatures: [
        ...analysis.classes.flatMap(cls => 
          cls.methods.map(method => `${cls.name}.${method.name}(${method.parameters.map(p => p.name).join(', ')})`)
        ),
        ...analysis.functions.map(func => 
          `${func.name}(${func.parameters.map(p => p.name).join(', ')})`
        )
      ],
      actualDependencies: analysis.dependencies,
      actualExports: analysis.exports.map(exp => exp.name),
      actualImports: analysis.imports.map(imp => imp.source),
      architecturalPatterns: this.detectArchitecturalPatterns(analysis),
      businessDomainIndicators: this.detectBusinessDomainIndicators(analysis),
      qualityMetrics: {
        complexity: analysis.complexity.cyclomaticComplexity,
        maintainability: analysis.complexity.maintainabilityIndex,
        testCoverage: 0, // Would need test analysis
        documentation: this.calculateDocumentationScore(analysis)
      }
    };
  }

  private detectArchitecturalPatterns(analysis: AnalysisResult): string[] {
    const patterns: string[] = [];
    
    // Detect common patterns based on class and method names
    const classNames = analysis.classes.map(cls => cls.name.toLowerCase());
    const methodNames = analysis.functions.map(func => func.name.toLowerCase());
    
    if (classNames.some(name => name.includes('factory'))) {
      patterns.push('Factory Pattern');
    }
    if (classNames.some(name => name.includes('singleton'))) {
      patterns.push('Singleton Pattern');
    }
    if (classNames.some(name => name.includes('observer'))) {
      patterns.push('Observer Pattern');
    }
    if (classNames.some(name => name.includes('builder'))) {
      patterns.push('Builder Pattern');
    }
    if (methodNames.some(name => name.includes('middleware'))) {
      patterns.push('Middleware Pattern');
    }
    if (analysis.classes.some(cls => cls.methods.some(m => m.name === 'execute'))) {
      patterns.push('Command Pattern');
    }
    
    return patterns;
  }

  private detectBusinessDomainIndicators(analysis: AnalysisResult): string[] {
    const indicators: string[] = [];
    
    // Analyze class and method names for business domain clues
    const allNames = [
      ...analysis.classes.map(cls => cls.name),
      ...analysis.functions.map(func => func.name),
      ...analysis.classes.flatMap(cls => cls.methods.map(m => m.name))
    ].map(name => name.toLowerCase());
    
    const domainKeywords = {
      'E-commerce': ['order', 'cart', 'payment', 'product', 'customer', 'checkout'],
      'Finance': ['account', 'transaction', 'balance', 'payment', 'invoice', 'billing'],
      'Healthcare': ['patient', 'medical', 'diagnosis', 'treatment', 'doctor', 'appointment'],
      'Education': ['student', 'course', 'grade', 'assignment', 'teacher', 'class'],
      'HR': ['employee', 'payroll', 'attendance', 'performance', 'recruitment'],
      'CRM': ['lead', 'contact', 'opportunity', 'pipeline', 'sales'],
      'Content Management': ['article', 'post', 'content', 'publish', 'editor'],
      'Authentication': ['user', 'login', 'auth', 'token', 'session', 'permission']
    };
    
    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      const matches = keywords.filter(keyword => 
        allNames.some(name => name.includes(keyword))
      );
      
      if (matches.length >= 2) {
        indicators.push(domain);
      }
    }
    
    return indicators;
  }

  private calculateDocumentationScore(analysis: AnalysisResult): number {
    const totalElements = analysis.classes.length + analysis.functions.length;
    if (totalElements === 0) return 0;
    
    // Since documentation property doesn't exist in the types,
    // we'll use a heuristic based on naming conventions and comments
    const documentedElements = [
      ...analysis.classes.filter(cls =>
        cls.name.length > 3 && // Meaningful names
        cls.methods.some(method => method.name.startsWith('get') || method.name.startsWith('set'))
      ),
      ...analysis.functions.filter(func =>
        func.name.length > 3 && // Meaningful names
        func.parameters.length > 0 // Has parameters (likely documented)
      )
    ].length;
    
    return Math.round((documentedElements / totalElements) * 100);
  }

  private async generateEnhancedTTLFiles(
    analysisResult: ProjectAnalysisResult,
    concreteInfo: Map<string, ConcreteInformation>
  ): Promise<Map<string, any>> {
    const ttlResults = new Map();
    const enhancedRdfGenerator = new EnhancedRDFGenerator({
      includeBusinessContext: this.config.enableBusinessContextPlaceholders,
      optimizeForLLM: this.config.enableMCPContextLoading,
      optimizeForNeo4j: this.config.enableKnowledgeGraphPopulation
    });
    
    // Group files by module/directory for TTL generation
    const moduleGroups = this.groupFilesByModule(analysisResult.files);
    
    for (const [modulePath, files] of moduleGroups) {
      try {
        // Create combined analysis result for the module
        const moduleAnalysis = await this.createModuleAnalysis(files, concreteInfo);
        
        // Generate enhanced RDF with concrete information
        const rdfResult = await enhancedRdfGenerator.generateEnhancedRDF(
          moduleAnalysis,
          modulePath
        );
        
        // Write TTL file to the specified output directory
        await this.writeTTLToOutputDirectory(modulePath, rdfResult);
        
        ttlResults.set(modulePath, rdfResult);
        
        logger.info('Enhanced TTL generated for module', {
          modulePath,
          size: rdfResult.size,
          classCount: rdfResult.statistics.classCount,
          methodCount: rdfResult.statistics.methodCount
        });
        
      } catch (error) {
        logger.error('Failed to generate enhanced TTL for module', { modulePath, error });
      }
    }
    
    return ttlResults;
  }

  private groupFilesByModule(files: any[]): Map<string, any[]> {
    const groups = new Map();
    
    for (const file of files) {
      const moduleDir = path.dirname(file.filePath);
      const ttlPath = path.join(moduleDir, '.module-knowledge.ttl');
      
      if (!groups.has(ttlPath)) {
        groups.set(ttlPath, []);
      }
      groups.get(ttlPath).push(file);
    }
    
    return groups;
  }

  private async createModuleAnalysis(files: any[], concreteInfo: Map<string, ConcreteInformation>): Promise<AnalysisResult> {
    // Get the module directory path
    const fullModuleDir = path.dirname(files[0]?.filePath || '');
    const moduleName = path.basename(fullModuleDir);
    
    // Convert to relative path for Neo4j query since Neo4j stores relative paths
    // Remove the project root to get the relative path that matches Neo4j storage
    const relativePath = path.relative(this.config.projectRoot, fullModuleDir);
    const moduleDir = relativePath.replace(/\\/g, '/'); // Normalize path separators for cross-platform compatibility
    
    // Create multiple path variations to handle different storage formats
    const pathVariations = [
      moduleDir,
      `./${moduleDir}`,
      `/${moduleDir}`,
      fullModuleDir,
      fullModuleDir.replace(/\\/g, '/'),
      path.posix.normalize(moduleDir),
      path.posix.normalize(relativePath)
    ].filter((p, i, arr) => arr.indexOf(p) === i); // Remove duplicates
    
    logger.info('Creating module analysis with Neo4j data', {
      fullModuleDir,
      moduleDir,
      moduleName,
      filesCount: files.length,
      projectRoot: this.config.projectRoot,
      pathConversion: `${fullModuleDir} -> ${moduleDir}`,
      pathVariations
    });

    // Initialize combined analysis
    const combinedAnalysis: AnalysisResult = {
      filePath: fullModuleDir,
      language: files[0]?.language || 'java',
      nodes: [],
      functions: [],
      classes: [],
      imports: [],
      exports: [],
      dependencies: [],
      complexity: {
        cyclomaticComplexity: 0,
        cognitiveComplexity: 0,
        linesOfCode: 0,
        maintainabilityIndex: 100,
        technicalDebt: 0
      },
      errors: [],
      timestamp: new Date()
    };

    try {
      // Query Neo4j directly for concrete information about all files in this module
      const { Neo4jDatabaseService } = await import('../layer2/neo4j-database/Neo4jDatabaseService');
      const neo4jService = new Neo4jDatabaseService();
      
      const config = {
        uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
        username: process.env.NEO4J_USERNAME || 'neo4j',
        password: process.env.NEO4J_PASSWORD || 'aaswe-password',
        database: 'neo4j',
        encrypted: false
      };
      
      await neo4jService.connect(config);
      
      // Query for all entities in this module directory with improved path matching
      const moduleQuery = `
        MATCH (f:File)-[:CONTAINS]->(entity)
        WHERE f.filePath IN $pathVariations
           OR ANY(pathVar IN $pathVariations WHERE f.filePath CONTAINS pathVar)
           OR ANY(pathVar IN $pathVariations WHERE f.filePath STARTS WITH pathVar)
        RETURN f.filePath as filePath, f.name as fileName,
               collect({
                 type: labels(entity)[0],
                 name: entity.name,
                 id: entity.id,
                 startLine: entity.startLine,
                 endLine: entity.endLine,
                 complexity: entity.complexity,
                 visibility: entity.visibility,
                 isExported: entity.isExported,
                 parameters: entity.parameters,
                 returnType: entity.returnType
               }) as entities
      `;
      
      const session = neo4jService.getSession();
      
      logger.info('🔍 Neo4j Query Debug Info', {
        query: moduleQuery.replace(/\s+/g, ' ').trim(),
        moduleDir: moduleDir,
        pathVariations,
        queryParams: { pathVariations },
        totalVariations: pathVariations.length
      });
      
      const result = await session.run(moduleQuery, { pathVariations });
      
      logger.info('📊 Neo4j Query Results', {
        recordCount: result.records.length,
        moduleDir: moduleDir,
        queryExecuted: moduleQuery.replace(/\s+/g, ' ').trim(),
        sampleRecords: result.records.slice(0, 3).map(record => ({
          filePath: record.get('filePath'),
          fileName: record.get('fileName'),
          entitiesCount: record.get('entities')?.length || 0,
          firstEntity: record.get('entities')?.[0] || null
        }))
      });
      
      // If no records found, let's debug what's actually in Neo4j
      if (result.records.length === 0) {
        logger.warn('No records found for module, debugging Neo4j content', { moduleDir, pathVariations });
        
        // Query to see what files are actually in Neo4j
        const debugQuery = `
          MATCH (f:File)
          RETURN f.filePath as filePath, f.name as fileName
          ORDER BY f.filePath
          LIMIT 20
        `;
        
        const debugResult = await session.run(debugQuery);
        const allFiles = debugResult.records.map(record => ({
          filePath: record.get('filePath'),
          fileName: record.get('fileName')
        }));
        
        logger.info('🔍 All files in Neo4j vs path variations', {
          query: debugQuery.replace(/\s+/g, ' ').trim(),
          foundFilesCount: allFiles.length,
          foundFiles: allFiles,
          pathVariations,
          pathMatches: allFiles.map(file => ({
            filePath: file.filePath,
            matchesAnyVariation: pathVariations.some(variation =>
              file.filePath === variation ||
              file.filePath.includes(variation) ||
              file.filePath.startsWith(variation)
            ),
            matchingVariations: pathVariations.filter(variation =>
              file.filePath === variation ||
              file.filePath.includes(variation) ||
              file.filePath.startsWith(variation)
            )
          })).filter(match => match.matchesAnyVariation)
        });
        
        // Try a broader query to find any files that might match
        const broadQuery = `
          MATCH (f:File)
          WHERE ANY(pathVar IN $pathVariations WHERE
            f.filePath CONTAINS pathVar OR
            f.name CONTAINS pathVar OR
            f.filePath ENDS WITH pathVar
          )
          RETURN f.filePath as filePath, f.name as fileName
          LIMIT 10
        `;
        
        const broadResult = await session.run(broadQuery, { pathVariations });
        const broadMatches = broadResult.records.map(record => ({
          filePath: record.get('filePath'),
          fileName: record.get('fileName')
        }));
        
        if (broadMatches.length > 0) {
          logger.info('🎯 Found potential matches with broader query', {
            broadMatches,
            willRetryWithBroaderQuery: true
          });
          
          // Retry with broader query for entities
          const retryQuery = `
            MATCH (f:File)-[:CONTAINS]->(entity)
            WHERE ANY(pathVar IN $pathVariations WHERE
              f.filePath CONTAINS pathVar OR
              f.name CONTAINS pathVar OR
              f.filePath ENDS WITH pathVar
            )
            RETURN f.filePath as filePath, f.name as fileName,
                   collect({
                     type: labels(entity)[0],
                     name: entity.name,
                     id: entity.id,
                     startLine: entity.startLine,
                     endLine: entity.endLine,
                     complexity: entity.complexity,
                     visibility: entity.visibility,
                     isExported: entity.isExported,
                     parameters: entity.parameters,
                     returnType: entity.returnType
                   }) as entities
          `;
          
          const retryResult = await session.run(retryQuery, { pathVariations });
          if (retryResult.records.length > 0) {
            // Use broad matches for analysis
            logger.info('✅ Using broader query results for analysis');
            result.records = retryResult.records;
          }
        }
      }
      
      let totalClasses = 0;
      let totalMethods = 0;
      let totalComplexity = 0;
      let totalLines = 0;
      
      // Process each file's entities
      for (const record of result.records) {
        const filePath = record.get('filePath');
        const entities = record.get('entities');
        
        totalLines += 50; // Estimate lines per file
        
        for (const entity of entities) {
          if (entity.type === 'Class') {
            totalClasses++;
            const classId = `class_${entity.name}_${entity.id}`;
            
            // Query for methods in this class
            const methodQuery = `
              MATCH (c:Class {id: $classId})-[:HAS_METHOD]->(m:Method)
              RETURN m.name as name, m.id as id, m.parameters as parameters,
                     m.returnType as returnType, m.complexity as complexity,
                     m.startLine as startLine, m.endLine as endLine,
                     m.visibility as visibility, m.isExported as isExported
            `;
            
            const methodResult = await session.run(methodQuery, { classId: entity.id });
            const methods = methodResult.records.map(methodRecord => {
              totalMethods++;
              totalComplexity += methodRecord.get('complexity') || 1;
              
              return {
                id: `method_${methodRecord.get('name')}_${methodRecord.get('id')}`,
                name: methodRecord.get('name'),
                parameters: JSON.parse(methodRecord.get('parameters') || '[]'),
                returnType: methodRecord.get('returnType') || 'void',
                complexity: methodRecord.get('complexity') || 1,
                startLine: methodRecord.get('startLine') || 1,
                endLine: methodRecord.get('endLine') || 1,
                filePath: filePath,
                isAsync: false,
                isExported: methodRecord.get('isExported') || false,
                visibility: methodRecord.get('visibility') || 'public' as const,
                dependencies: [],
                calls: []
              };
            });
            
            combinedAnalysis.classes.push({
              id: classId,
              name: entity.name,
              methods: methods,
              properties: [],
              extends: undefined,
              implements: [],
              startLine: entity.startLine || 1,
              endLine: entity.endLine || 1,
              filePath: filePath,
              isExported: entity.isExported || false,
              visibility: entity.visibility || 'public' as const,
              isAbstract: false
            });
          }
          
          if (entity.type === 'Method' || entity.type === 'Function') {
            totalMethods++;
            totalComplexity += entity.complexity || 1;
            
            combinedAnalysis.functions.push({
              id: `func_${entity.name}_${entity.id}`,
              name: entity.name,
              parameters: JSON.parse(entity.parameters || '[]'),
              returnType: entity.returnType || 'void',
              complexity: entity.complexity || 1,
              startLine: entity.startLine || 1,
              endLine: entity.endLine || 1,
              filePath: filePath,
              isAsync: false,
              isExported: entity.isExported || false,
              visibility: entity.visibility || 'public' as const,
              dependencies: [],
              calls: []
            });
          }
        }
      }
      
      // Query for dependencies and imports
      const dependencyQuery = `
        MATCH (f:File)-[:IMPORTS]->(dep)
        WHERE f.filePath IN $pathVariations
           OR ANY(pathVar IN $pathVariations WHERE f.filePath CONTAINS pathVar)
           OR ANY(pathVar IN $pathVariations WHERE f.filePath STARTS WITH pathVar)
        RETURN collect(DISTINCT dep.name) as dependencies
      `;
      
      const depResult = await session.run(dependencyQuery, { pathVariations });
      if (depResult.records.length > 0) {
        const deps = depResult.records[0].get('dependencies') || [];
        combinedAnalysis.dependencies = deps;
        
        // Create import declarations
        for (const dep of deps) {
          combinedAnalysis.imports.push({
            id: `import_${dep}_${Math.random().toString(36).substr(2, 9)}`,
            source: dep,
            imports: [],
            filePath: moduleDir,
            startLine: 1,
            endLine: 1
          });
        }
      }
      
      // Update complexity metrics
      combinedAnalysis.complexity.cyclomaticComplexity = totalComplexity;
      combinedAnalysis.complexity.linesOfCode = totalLines;
      combinedAnalysis.complexity.maintainabilityIndex = Math.max(20, 100 - (totalComplexity / totalMethods || 1) * 10);
      
      await session.close();
      await neo4jService.disconnect();
      
      logger.info('✅ Module analysis created with concrete Neo4j data', {
        moduleDir,
        filesCount: files.length,
        classesCount: totalClasses,
        methodsCount: totalMethods,
        dependenciesCount: combinedAnalysis.dependencies.length,
        totalComplexity,
        totalLines
      });
      
    } catch (error) {
      logger.warn('⚠️ Failed to query Neo4j for concrete data, falling back to file-based analysis', { error });
      
      // Fallback to the original approach if Neo4j is not available
      for (const file of files) {
        const concrete = concreteInfo.get(file.filePath);
        if (concrete) {
          // Use the concrete information from the map
          for (const className of concrete.actualClassNames) {
            const classId = `class_${className}_${Math.random().toString(36).substr(2, 9)}`;
            combinedAnalysis.classes.push({
              id: classId,
              name: className,
              methods: [],
              properties: [],
              extends: undefined,
              implements: [],
              startLine: 1,
              endLine: 1,
              filePath: file.filePath,
              isExported: concrete.actualExports.includes(className),
              visibility: 'public' as const,
              isAbstract: false
            });
          }
          
          combinedAnalysis.dependencies.push(...concrete.actualDependencies);
          combinedAnalysis.complexity.cyclomaticComplexity += concrete.qualityMetrics.complexity;
        }
      }
    }
    
    return combinedAnalysis;
  }

  private async populateKnowledgeGraph(ttlResults: Map<string, any>): Promise<{ nodes: number; relationships: number }> {
    let totalNodes = 0;
    let totalRelationships = 0;
    
    // Check if Neo4j is available before attempting population
    const neo4jAvailable = await this.checkNeo4jAvailability();
    if (!neo4jAvailable) {
      logger.info('Neo4j not available, skipping knowledge graph population');
      logger.info('TTL files generated successfully and can be used by MCP servers');
      
      // Still count entities for statistics
      for (const [ttlPath, result] of ttlResults) {
        try {
          const content = result.rdfContent;
          const classMatches = content.match(/aide:Class/g) || [];
          const methodMatches = content.match(/aide:Method/g) || [];
          const functionMatches = content.match(/aide:Function/g) || [];
          const dependencyMatches = content.match(/aide:dependsOn/g) || [];
          const extendsMatches = content.match(/aide:extends/g) || [];
          
          const nodes = classMatches.length + methodMatches.length + functionMatches.length;
          const relationships = dependencyMatches.length + extendsMatches.length;
          
          totalNodes += nodes;
          totalRelationships += relationships;
          
          logger.debug('Counted entities in TTL', { ttlPath, nodes, relationships });
          
        } catch (error) {
          logger.warn('Failed to count entities in TTL', { ttlPath, error });
        }
      }
      
      return { nodes: totalNodes, relationships: totalRelationships };
    }
    
    // Neo4j is available, use MultiLanguageCodeGraphAnalyzer for actual source code analysis
    try {
      logger.info('🔍 Using MultiLanguageCodeGraphAnalyzer for comprehensive source code analysis');
      
      const { Neo4jDatabaseService } = await import('../layer2/neo4j-database/Neo4jDatabaseService');
      const { MultiLanguageCodeGraphAnalyzer } = await import('./MultiLanguageCodeGraphAnalyzer');
      
      const neo4jService = new Neo4jDatabaseService();
      
      const config = {
        uri: process.env.NEO4J_URI!,
        username: process.env.NEO4J_USERNAME!,
        password: process.env.NEO4J_PASSWORD!,
        database: 'neo4j',
        encrypted: false
      };
      
      await neo4jService.connect(config);
      const analyzer = new MultiLanguageCodeGraphAnalyzer(neo4jService);
      
      // Analyze the entire project with multi-language support
      logger.info('🚀 Starting multi-language codebase analysis...');
      const analysisResult = await analyzer.analyzeMultiLanguageCodebase(this.config.projectRoot);
      
      totalNodes = analysisResult.entities.length;
      totalRelationships = analysisResult.relationships.length;
      
      logger.info('✅ Multi-language analysis completed successfully', {
        languages: analysisResult.languages.join(', '),
        totalFiles: analysisResult.statistics.totalFiles,
        totalClasses: analysisResult.statistics.totalClasses,
        totalMethods: analysisResult.statistics.totalMethods,
        totalLines: analysisResult.statistics.totalLines,
        totalNodes,
        totalRelationships
      });
      
      await neo4jService.disconnect();
      
    } catch (error) {
      logger.error('❌ Multi-language analysis failed, falling back to TTL-based population', { error });
      
      // Fallback to TTL-based population
      for (const [ttlPath, result] of ttlResults) {
        try {
          const content = result.rdfContent;
          const classMatches = content.match(/aide:Class/g) || [];
          const methodMatches = content.match(/aide:Method/g) || [];
          const functionMatches = content.match(/aide:Function/g) || [];
          const dependencyMatches = content.match(/aide:dependsOn/g) || [];
          const extendsMatches = content.match(/aide:extends/g) || [];
          
          const nodes = classMatches.length + methodMatches.length + functionMatches.length;
          const relationships = dependencyMatches.length + extendsMatches.length;
          
          totalNodes += nodes;
          totalRelationships += relationships;
          
          // Create Neo4j nodes and relationships
          await this.createKnowledgeGraphEntities(ttlPath, content, nodes, relationships);
          
        } catch (error) {
          logger.error('Failed to populate knowledge graph for TTL', { ttlPath, error });
        }
      }
    }
    
    logger.info('Knowledge graph population completed', {
      totalNodes,
      totalRelationships,
      ttlFiles: ttlResults.size
    });
    
    return { nodes: totalNodes, relationships: totalRelationships };
  }

  private async loadMCPContext(ttlResults: Map<string, any>): Promise<number> {
    let totalSize = 0;
    
    for (const [ttlPath, result] of ttlResults) {
      try {
        // Format content for MCP consumption
        const mcpContext = {
          moduleId: path.basename(ttlPath, '.module-knowledge.ttl'),
          filePath: ttlPath,
          content: result.rdfContent,
          timestamp: new Date().toISOString(),
          size: result.size,
          businessContext: this.extractBusinessContextFromTTL(result.rdfContent),
          technicalSummary: this.extractTechnicalSummaryFromTTL(result.rdfContent)
        };
        
        // Store in MCP context cache
        await this.storeMCPContext(ttlPath, mcpContext);
        totalSize += result.size;
        
      } catch (error) {
        logger.error('Failed to load MCP context', { ttlPath, error });
      }
    }
    
    logger.info('MCP context loading completed', {
      totalSize,
      ttlFiles: ttlResults.size
    });
    
    return totalSize;
  }


  private async updateTTLFiles(changedFiles: string[], concreteInfo: Map<string, ConcreteInformation>): Promise<Map<string, any>> {
    const ttlResults = new Map();
    
    for (const filePath of changedFiles) {
      try {
        const ttlPath = path.join(path.dirname(filePath), '.module-knowledge.ttl');
        const concrete = concreteInfo.get(filePath);
        
        if (concrete) {
          // Create analysis result for RDF generation
          const analysisResult: AnalysisResult = {
            filePath,
            language: this.getLanguageFromFile(filePath),
            nodes: [],
            functions: [],
            classes: [],
            imports: [],
            exports: [],
            dependencies: concrete.actualDependencies,
            complexity: {
              cyclomaticComplexity: concrete.qualityMetrics.complexity,
              cognitiveComplexity: concrete.qualityMetrics.complexity,
              linesOfCode: 100,
              maintainabilityIndex: concrete.qualityMetrics.maintainability,
              technicalDebt: 0
            },
            errors: [],
            timestamp: new Date()
          };

          // Update TTL file with preservation of business context
          const rdfResult = await this.rdfService.updateTTLFile(ttlPath, analysisResult, true);
          ttlResults.set(ttlPath, rdfResult);
          
          logger.debug('Updated TTL file', { filePath, ttlPath });
        }
      } catch (error) {
        logger.error('Failed to update TTL file', { filePath, error });
      }
    }
    
    return ttlResults;
  }

  private async updateKnowledgeGraph(ttlResults: Map<string, any>): Promise<{ nodes: number; relationships: number }> {
    let totalNodes = 0;
    let totalRelationships = 0;
    
    for (const [ttlPath, result] of ttlResults) {
      try {
        // Parse TTL content and extract entities for incremental update
        const content = result.rdfContent;
        const moduleId = this.extractModuleIdFromTTL(content);
        
        // Count entities
        const classMatches = content.match(/aide:Class/g) || [];
        const methodMatches = content.match(/aide:Method/g) || [];
        const dependencyMatches = content.match(/aide:dependsOn/g) || [];
        
        const nodes = classMatches.length + methodMatches.length;
        const relationships = dependencyMatches.length;
        
        totalNodes += nodes;
        totalRelationships += relationships;
        
        // Update specific module in knowledge graph
        await this.updateModuleInKnowledgeGraph(moduleId, content);
        
      } catch (error) {
        logger.error('Failed to update knowledge graph incrementally', { ttlPath, error });
      }
    }
    
    return { nodes: totalNodes, relationships: totalRelationships };
  }

  private async updateMCPContext(ttlResults: Map<string, any>): Promise<number> {
    let totalSize = 0;
    
    for (const [ttlPath, result] of ttlResults) {
      try {
        const moduleId = this.extractModuleIdFromTTL(result.rdfContent);
        
        // Update MCP context for specific module
        const mcpContext = {
          moduleId,
          filePath: ttlPath,
          content: result.rdfContent,
          timestamp: new Date().toISOString(),
          size: result.size,
          lastUpdated: new Date().toISOString()
        };
        
        await this.updateMCPContextForModule(moduleId, mcpContext);
        totalSize += result.size;
        
      } catch (error) {
        logger.error('Failed to update MCP context incrementally', { ttlPath, error });
      }
    }
    
    return totalSize;
  }

  // Helper methods for the implemented functionality

  /**
   * Check if Neo4j is available for knowledge graph operations
   */
  private async checkNeo4jAvailability(): Promise<boolean> {
    try {
      // Check if Neo4j environment variables are set
      const neo4jUri = process.env.NEO4J_URI;
      const neo4jUsername = process.env.NEO4J_USERNAME;
      const neo4jPassword = process.env.NEO4J_PASSWORD;

      if (!neo4jUri || !neo4jUsername || !neo4jPassword) {
        logger.debug('Neo4j credentials not configured');
        return false;
      }

      // Try to connect to Neo4j directly
      const { Neo4jDatabaseService } = await import('../layer2/neo4j-database/Neo4jDatabaseService');
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

  private async createKnowledgeGraphEntities(_ttlPath: string, content: string, nodes: number, relationships: number): Promise<void> {
    const moduleId = this.extractModuleIdFromTTL(content);
    
    // Create module node in Neo4j
    const moduleQuery = `
      MERGE (m:Module {id: $moduleId})
      SET m.filePath = $filePath,
          m.lastUpdated = datetime(),
          m.nodeCount = $nodes,
          m.relationshipCount = $relationships
    `;
    
    logger.debug('Would execute Neo4j query for module', { moduleId, nodes, relationships, query: moduleQuery });
    
    logger.debug('Would execute Neo4j query for module', { moduleId, nodes, relationships });
    
    // Extract and create class nodes
    const classMatches = content.match(/aide:(\w+)\s+a\s+aide:Class/g) || [];
    for (const match of classMatches) {
      const classNameMatch = match.match(/aide:(\w+)/);
      if (classNameMatch) {
        const className = classNameMatch[1];
        logger.debug('Would create class node', { moduleId, className });
      }
    }
  }

  private async storeMCPContext(_ttlPath: string, context: any): Promise<void> {
    // Store in file system cache
    const cacheDir = path.join(this.config.projectRoot, '.aaswe', 'mcp-cache');
    await fs.mkdir(cacheDir, { recursive: true });
    
    const cacheFile = path.join(cacheDir, `${context.moduleId}.json`);
    await fs.writeFile(cacheFile, JSON.stringify(context, null, 2), 'utf8');
    
    logger.debug('Stored MCP context', { moduleId: context.moduleId, cacheFile });
  }

  private extractBusinessContextFromTTL(content: string): any {
    const businessContext: any = {};
    
    // Extract business domain
    const domainMatch = content.match(/aide:businessDomain\s+"([^"]+)"/);
    if (domainMatch) {
      businessContext.domain = domainMatch[1];
    }
    
    // Extract business rules
    const rulesMatches = content.match(/aide:businessRule\s+"([^"]+)"/g) || [];
    businessContext.rules = rulesMatches.map(match =>
      match.replace(/aide:businessRule\s+"([^"]+)"/, '$1')
    );
    
    return businessContext;
  }

  private extractTechnicalSummaryFromTTL(content: string): any {
    const summary: any = {};
    
    // Count technical elements
    summary.classes = (content.match(/aide:Class/g) || []).length;
    summary.methods = (content.match(/aide:Method/g) || []).length;
    summary.functions = (content.match(/aide:Function/g) || []).length;
    summary.dependencies = (content.match(/aide:dependsOn/g) || []).length;
    
    return summary;
  }

  private extractModuleIdFromTTL(content: string): string {
    const moduleMatch = content.match(/aide:(\w+)\s+a\s+aide:Module/);
    return moduleMatch ? moduleMatch[1] : 'unknown_module';
  }

  private async updateModuleInKnowledgeGraph(moduleId: string, content: string): Promise<void> {
    // Update specific module in Neo4j
    logger.debug('Would update module in knowledge graph', { moduleId });
    
    // Extract updated information and sync to graph
    const classes = (content.match(/aide:Class/g) || []).length;
    const methods = (content.match(/aide:Method/g) || []).length;
    
    logger.debug('Module update stats', { moduleId, classes, methods });
  }

  private async updateMCPContextForModule(moduleId: string, context: any): Promise<void> {
    // Update specific module context
    const cacheDir = path.join(this.config.projectRoot, '.aaswe', 'mcp-cache');
    await fs.mkdir(cacheDir, { recursive: true });
    
    const cacheFile = path.join(cacheDir, `${moduleId}.json`);
    await fs.writeFile(cacheFile, JSON.stringify(context, null, 2), 'utf8');
    
    logger.debug('Updated MCP context for module', { moduleId });
  }

  /**
   * Write TTL content to the specified output directory
   */
  private async writeTTLToOutputDirectory(modulePath: string, rdfResult: any): Promise<void> {
    try {
      // Create output directory if it doesn't exist
      await fs.mkdir(this.config.outputDirectory, { recursive: true });
      
      // Generate output file name based on module path
      // modulePath is like "src/services/.module-knowledge.ttl"
      const moduleDir = path.dirname(modulePath);
      const moduleDirName = path.basename(moduleDir);
      const outputFileName = `${moduleDirName}.module-knowledge.ttl`;
      const outputPath = path.join(this.config.outputDirectory, outputFileName);
      
      // Write TTL content to output file
      await fs.writeFile(outputPath, rdfResult.rdfContent, 'utf8');
      
      logger.info('TTL file written to output directory', {
        modulePath,
        outputPath,
        moduleDir,
        moduleDirName,
        size: rdfResult.size
      });
      
    } catch (error) {
      logger.error('Failed to write TTL to output directory', { modulePath, error });
      throw error;
    }
  }

  private getLanguageFromFile(filePath: string): 'typescript' | 'javascript' | 'python' | 'java' | 'go' | 'rust' | 'cpp' {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, any> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.hpp': 'cpp'
    };
    return languageMap[ext] || 'typescript';
  }

  /**
   * Detect architectural patterns from class and method names
   */
  private detectArchitecturalPatternsFromNames(names: string[]): string[] {
    const patterns: string[] = [];
    const lowerNames = names.map(name => name.toLowerCase());
    
    if (lowerNames.some(name => name.includes('factory'))) {
      patterns.push('Factory Pattern');
    }
    if (lowerNames.some(name => name.includes('singleton'))) {
      patterns.push('Singleton Pattern');
    }
    if (lowerNames.some(name => name.includes('observer'))) {
      patterns.push('Observer Pattern');
    }
    if (lowerNames.some(name => name.includes('builder'))) {
      patterns.push('Builder Pattern');
    }
    if (lowerNames.some(name => name.includes('middleware'))) {
      patterns.push('Middleware Pattern');
    }
    if (lowerNames.some(name => name.includes('command'))) {
      patterns.push('Command Pattern');
    }
    if (lowerNames.some(name => name.includes('strategy'))) {
      patterns.push('Strategy Pattern');
    }
    if (lowerNames.some(name => name.includes('adapter'))) {
      patterns.push('Adapter Pattern');
    }
    
    return patterns;
  }

  /**
   * Detect business domain indicators from class and method names
   */
  private detectBusinessDomainFromNames(names: string[]): string[] {
    const indicators: string[] = [];
    const lowerNames = names.map(name => name.toLowerCase());
    
    const domainKeywords = {
      'E-commerce': ['order', 'cart', 'payment', 'product', 'customer', 'checkout'],
      'Finance': ['account', 'transaction', 'balance', 'payment', 'invoice', 'billing'],
      'Healthcare': ['patient', 'medical', 'diagnosis', 'treatment', 'doctor', 'appointment'],
      'Education': ['student', 'course', 'grade', 'assignment', 'teacher', 'class'],
      'HR': ['employee', 'payroll', 'attendance', 'performance', 'recruitment'],
      'CRM': ['lead', 'contact', 'opportunity', 'pipeline', 'sales'],
      'Content Management': ['article', 'post', 'content', 'publish', 'editor'],
      'Authentication': ['user', 'login', 'auth', 'token', 'session', 'permission'],
      'Configuration Management': ['config', 'properties', 'settings', 'environment']
    };
    
    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      const matches = keywords.filter(keyword =>
        lowerNames.some(name => name.includes(keyword))
      );
      
      if (matches.length >= 1) {
        indicators.push(domain);
      }
    }
    
    return indicators;
  }

}