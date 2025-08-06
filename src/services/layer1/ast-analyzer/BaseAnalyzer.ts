/**
 * Base AST Analyzer
 * Abstract base class for language-specific AST analyzers
 */

import { readFileSync } from 'fs';
import logger from '../../../utils/logger';
import {
  AnalysisResult,
  AnalysisContext,
  AnalysisOptions,
  SupportedLanguage,
  ASTNode,
  CodeFunction,
  CodeClass,
  ImportDeclaration,
  ExportDeclaration,
  ComplexityMetrics,
  DependencyGraph
} from './types';

export abstract class BaseAnalyzer {
  protected language: SupportedLanguage;
  protected defaultOptions: AnalysisOptions = {
    includeComments: false,
    calculateComplexity: true,
    extractDependencies: true,
    includePrivateMembers: true,
    maxDepth: 10,
    timeout: 30000
  };

  constructor(language: SupportedLanguage) {
    this.language = language;
  }

  /**
   * Analyze a single file
   */
  async analyzeFile(filePath: string, options?: Partial<AnalysisOptions>): Promise<AnalysisResult> {
    const startTime = Date.now();
    const context = this.createContext(filePath, options);
    
    try {
      logger.debug(`Starting AST analysis for ${filePath}`);
      
      // Read file content
      const content = readFileSync(filePath, 'utf-8');
      
      // Parse AST
      const ast = await this.parseAST(content, context);
      
      // Extract information
      const nodes = await this.extractNodes(ast, context);
      const functions = await this.extractFunctions(ast, context);
      const classes = await this.extractClasses(ast, context);
      const imports = await this.extractImports(ast, context);
      const exports = await this.extractExports(ast, context);
      const dependencies = await this.extractDependencies(ast, context);
      
      // Calculate complexity
      const complexity = context.options.calculateComplexity 
        ? await this.calculateComplexity(ast, context)
        : this.getDefaultComplexity();

      const result: AnalysisResult = {
        filePath,
        language: context.language,
        nodes,
        functions,
        classes,
        imports,
        exports,
        dependencies,
        complexity,
        errors: [],
        timestamp: new Date()
      };

      const processingTime = Date.now() - startTime;
      logger.debug(`AST analysis completed for ${filePath} in ${processingTime}ms`);
      
      return result;
      
    } catch (error) {
      logger.error(`AST analysis failed for ${filePath}:`, error);
      
      return {
        filePath,
        language: context.language,
        nodes: [],
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        dependencies: [],
        complexity: this.getDefaultComplexity(),
        errors: [{
          type: 'analysis',
          message: error instanceof Error ? error.message : 'Unknown analysis error',
          severity: 'error'
        }],
        timestamp: new Date()
      };
    }
  }

  /**
   * Analyze multiple files
   */
  async analyzeFiles(filePaths: string[], options?: Partial<AnalysisOptions>): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    
    for (const filePath of filePaths) {
      try {
        const result = await this.analyzeFile(filePath, options);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to analyze ${filePath}:`, error);
        const context = this.createContext(filePath, options);
        results.push({
          filePath,
          language: context.language,
          nodes: [],
          functions: [],
          classes: [],
          imports: [],
          exports: [],
          dependencies: [],
          complexity: this.getDefaultComplexity(),
          errors: [{
            type: 'analysis',
            message: error instanceof Error ? error.message : 'Unknown analysis error',
            severity: 'error'
          }],
          timestamp: new Date()
        });
      }
    }
    
    return results;
  }

  /**
   * Build dependency graph from analysis results
   */
  buildDependencyGraph(results: AnalysisResult[]): DependencyGraph {
    const nodes = new Map();
    const edges: any[] = [];

    // Create nodes for each file, function, and class
    for (const result of results) {
      // File node
      nodes.set(result.filePath, {
        id: result.filePath,
        name: result.filePath.split('/').pop() || result.filePath,
        type: 'file',
        filePath: result.filePath,
        exported: result.exports.length > 0
      });

      // Function nodes
      for (const func of result.functions) {
        nodes.set(func.id, {
          id: func.id,
          name: func.name,
          type: 'function',
          filePath: result.filePath,
          exported: func.isExported
        });
      }

      // Class nodes
      for (const cls of result.classes) {
        nodes.set(cls.id, {
          id: cls.id,
          name: cls.name,
          type: 'class',
          filePath: result.filePath,
          exported: cls.isExported
        });
      }
    }

    // Create edges for dependencies
    for (const result of results) {
      // Import edges
      for (const imp of result.imports) {
        edges.push({
          from: result.filePath,
          to: imp.source,
          type: 'imports' as const,
          weight: imp.imports.length
        });
      }

      // Function call edges
      for (const func of result.functions) {
        for (const call of func.calls) {
          edges.push({
            from: func.id,
            to: call,
            type: 'calls' as const,
            weight: 1
          });
        }
      }

      // Class inheritance edges
      for (const cls of result.classes) {
        if (cls.extends) {
          edges.push({
            from: cls.id,
            to: cls.extends,
            type: 'extends' as const,
            weight: 1
          });
        }

        for (const impl of cls.implements) {
          edges.push({
            from: cls.id,
            to: impl,
            type: 'implements' as const,
            weight: 1
          });
        }
      }
    }

    return {
      nodes: Array.from(nodes.values()),
      edges
    };
  }

  /**
   * Create analysis context
   */
  protected createContext(filePath: string, options?: Partial<AnalysisOptions>): AnalysisContext {
    // Detect language from file extension instead of using hardcoded language
    const detectedLanguage = this.detectLanguageFromPath(filePath);
    
    return {
      filePath,
      projectRoot: process.cwd(),
      language: detectedLanguage,
      options: { ...this.defaultOptions, ...options },
      config: this.getParserConfig()
    };
  }

  /**
   * Detect language from file path
   */
  private detectLanguageFromPath(filePath: string): SupportedLanguage {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      
      case 'js':
      case 'jsx':
      case 'mjs':
        return 'javascript';
      
      case 'py':
        return 'python';
      
      case 'java':
        return 'java';
      
      case 'go':
        return 'go';
      
      case 'rs':
        return 'rust';
      
      case 'cpp':
      case 'cc':
      case 'cxx':
      case 'c++':
      case 'hpp':
      case 'h':
        return 'cpp';
      
      default:
        // Fallback to analyzer's language if detection fails
        return this.language;
    }
  }

  /**
   * Generate unique ID
   */
  protected generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  /**
   * Get default complexity metrics
   */
  protected getDefaultComplexity(): ComplexityMetrics {
    return {
      cyclomaticComplexity: 0,
      cognitiveComplexity: 0,
      linesOfCode: 0,
      maintainabilityIndex: 100,
      technicalDebt: 0
    };
  }

  // Abstract methods to be implemented by language-specific analyzers
  protected abstract parseAST(content: string, context: AnalysisContext): Promise<any>;
  protected abstract extractNodes(ast: any, context: AnalysisContext): Promise<ASTNode[]>;
  protected abstract extractFunctions(ast: any, context: AnalysisContext): Promise<CodeFunction[]>;
  protected abstract extractClasses(ast: any, context: AnalysisContext): Promise<CodeClass[]>;
  protected abstract extractImports(ast: any, context: AnalysisContext): Promise<ImportDeclaration[]>;
  protected abstract extractExports(ast: any, context: AnalysisContext): Promise<ExportDeclaration[]>;
  protected abstract extractDependencies(ast: any, context: AnalysisContext): Promise<string[]>;
  protected abstract calculateComplexity(ast: any, context: AnalysisContext): Promise<ComplexityMetrics>;
  protected abstract getParserConfig(): any;
}