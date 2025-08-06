/**
 * RDF Service
 * 
 * Main orchestrator for RDF generation, validation, and management.
 * Provides high-level interface for creating and maintaining .module-knowledge.ttl files.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import logger from '../../../utils/logger';
import { RDFGenerator } from './RDFGenerator';
import { RDFValidator } from './RDFValidator';
import { 
  RDFGenerationOptions, 
  RDFGenerationResult, 
  RDFValidationResult,
  ModuleDetectionResult,
  DetectedModule,
  ModuleDetectionError
} from './types';
import { AnalysisResult } from '../ast-analyzer/types';

/**
 * Production-Quality RDF Service
 * 
 * Orchestrates the complete RDF generation workflow from AST analysis
 * to validated TTL files with comprehensive error handling and logging.
 */
export class RDFService {
  private readonly generator: RDFGenerator;
  private readonly validator: RDFValidator;

  constructor(options: Partial<RDFGenerationOptions> = {}) {
    this.generator = new RDFGenerator(options);
    this.validator = new RDFValidator();
  }

  /**
   * Generate RDF from AST Analysis Result
   */
  async generateRDF(
    astResult: AnalysisResult,
    modulePath: string,
    options: Partial<RDFGenerationOptions> = {}
  ): Promise<RDFGenerationResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting RDF generation', { 
        modulePath, 
        language: astResult.language,
        classCount: astResult.classes.length,
        functionCount: astResult.functions.length
      });

      // Generate RDF content
      const result = await this.generator.generateFromAST(astResult, modulePath);
      
      // Validate generated RDF
      if (options.validateOutput !== false) {
        const validationResult = await this.validator.validateContent(result.rdfContent);
        
        if (!validationResult.isValid) {
          logger.warn('RDF validation failed', {
            modulePath,
            errors: validationResult.errors.length,
            warnings: validationResult.warnings.length
          });
          
          // Add validation warnings to result
          result.warnings.push(...validationResult.errors.map(error => ({
            type: 'invalid_uri' as const,
            message: `Validation error: ${error.message}`,
            suggestion: 'Fix RDF syntax or schema compliance issues'
          })));
        }
      }

      const totalTime = Date.now() - startTime;
      
      logger.info('RDF generation completed', {
        modulePath,
        size: result.size,
        triples: result.statistics.totalTriples,
        generationTime: result.generationTime,
        totalTime,
        warnings: result.warnings.length
      });

      return result;
      
    } catch (error) {
      logger.error('RDF generation failed', { error, modulePath });
      throw new Error(`RDF generation failed for ${modulePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate RDF for Multiple Modules
   */
  async generateBatchRDF(
    astResults: Map<string, AnalysisResult>,
    options: Partial<RDFGenerationOptions> = {}
  ): Promise<Map<string, RDFGenerationResult>> {
    const results = new Map<string, RDFGenerationResult>();
    const errors: Array<{ path: string; error: Error }> = [];

    logger.info('Starting batch RDF generation', { 
      moduleCount: astResults.size 
    });

    // Process modules in parallel with concurrency limit
    const concurrency = options.batchConcurrency || 5;
    const entries = Array.from(astResults.entries());
    
    for (let i = 0; i < entries.length; i += concurrency) {
      const batch = entries.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async ([modulePath, astResult]) => {
        try {
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('RDF generation timeout')), 5000);
          });
          
          // Add small delay between generations to prevent N3 Writer conflicts
          await new Promise(resolve => setTimeout(resolve, 10));
          
          const generationPromise = this.generateRDF(astResult, modulePath, options);
          const result = await Promise.race([generationPromise, timeoutPromise]);
          results.set(modulePath, result);
        } catch (error) {
          logger.error('Batch generation error for module', {
            modulePath,
            error: error instanceof Error ? error.message : String(error),
            errorName: error instanceof Error ? error.name : 'Unknown',
            stack: error instanceof Error ? error.stack : undefined
          });
          errors.push({
            path: modulePath,
            error: error instanceof Error ? error : new Error('Unknown error')
          });
        }
      });

      await Promise.all(batchPromises);
    }

    if (errors.length > 0) {
      logger.warn('Batch RDF generation completed with errors', {
        successful: results.size,
        failed: errors.length,
        errors: errors.map(e => ({ path: e.path, message: e.error.message }))
      });
    } else {
      logger.info('Batch RDF generation completed successfully', {
        moduleCount: results.size
      });
    }

    return results;
  }

  /**
   * Validate Existing TTL File
   */
  async validateTTLFile(filePath: string): Promise<RDFValidationResult> {
    try {
      logger.info('Validating TTL file', { filePath });
      
      const result = await this.validator.validateFile(filePath);
      
      logger.info('TTL validation completed', {
        filePath,
        isValid: result.isValid,
        errors: result.errors.length,
        warnings: result.warnings.length,
        triples: result.statistics.totalTriples
      });

      return result;
      
    } catch (error) {
      logger.error('TTL validation failed', { error, filePath });
      throw new Error(`TTL validation failed for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect Modules in Directory
   */
  async detectModules(rootPath: string): Promise<ModuleDetectionResult> {
    const modules: DetectedModule[] = [];
    const errors: ModuleDetectionError[] = [];
    let totalFiles = 0;
    let supportedFiles = 0;
    const skippedFiles: string[] = [];

    try {
      logger.info('Starting module detection', { rootPath });
      
      await this.scanDirectory(rootPath, modules, errors, {
        totalFiles: () => totalFiles++,
        supportedFiles: () => supportedFiles++,
        skippedFiles: (file: string) => skippedFiles.push(file)
      });

      logger.info('Module detection completed', {
        rootPath,
        modulesFound: modules.length,
        totalFiles,
        supportedFiles,
        skippedFiles: skippedFiles.length,
        errors: errors.length
      });

      return {
        modules,
        totalFiles,
        supportedFiles,
        skippedFiles,
        errors
      };
      
    } catch (error) {
      logger.error('Module detection failed', { error, rootPath });
      throw new Error(`Module detection failed for ${rootPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update Existing TTL File with New Data
   */
  async updateTTLFile(
    filePath: string,
    astResult: AnalysisResult,
    preserveBusinessContext: boolean = true
  ): Promise<RDFGenerationResult> {
    try {
      logger.info('Updating TTL file', { filePath, preserveBusinessContext });

      let existingBusinessContext: string | null = null;
      
      // Extract existing business context if preserving
      if (preserveBusinessContext) {
        try {
          const existingContent = await fs.readFile(filePath, 'utf8');
          existingBusinessContext = this.extractBusinessContext(existingContent);
        } catch (error) {
          logger.warn('Could not read existing TTL file for context preservation', { filePath, error });
        }
      }

      // Generate new RDF
      const result = await this.generateRDF(astResult, path.dirname(filePath));
      
      // Merge with existing business context if available
      let finalContent = result.rdfContent;
      if (existingBusinessContext) {
        finalContent = this.mergeBusinessContext(result.rdfContent, existingBusinessContext);
      }

      // Write updated content
      await fs.writeFile(filePath, finalContent, 'utf8');
      
      // Return updated result
      const updatedResult: RDFGenerationResult = {
        ...result,
        rdfContent: finalContent,
        size: Buffer.byteLength(finalContent, 'utf8')
      };
      
      logger.info('TTL file updated successfully', {
        filePath,
        size: result.size,
        preservedContext: !!existingBusinessContext
      });

      return updatedResult;
      
    } catch (error) {
      logger.error('TTL file update failed', { error, filePath });
      throw new Error(`TTL file update failed for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Synchronize TTL Files with Code Changes
   */
  async synchronizeTTLFiles(
    changedFiles: string[],
    astResults: Map<string, AnalysisResult>
  ): Promise<Map<string, RDFGenerationResult>> {
    const results = new Map<string, RDFGenerationResult>();
    
    logger.info('Starting TTL synchronization', { 
      changedFiles: changedFiles.length 
    });

    for (const filePath of changedFiles) {
      const astResult = astResults.get(filePath);
      if (!astResult) {
        logger.warn('No AST result found for changed file', { filePath });
        continue;
      }

      try {
        const ttlPath = this.getTTLPath(filePath);
        const result = await this.updateTTLFile(ttlPath, astResult, true);
        results.set(filePath, result);
      } catch (error) {
        logger.error('Failed to synchronize TTL file', { error, filePath });
      }
    }

    logger.info('TTL synchronization completed', {
      synchronized: results.size,
      requested: changedFiles.length
    });

    return results;
  }

  /**
   * Generate Module Summary Report
   */
  async generateSummaryReport(results: Map<string, RDFGenerationResult>): Promise<string> {
    const totalModules = results.size;
    const totalTriples = Array.from(results.values()).reduce((sum, result) => sum + result.statistics.totalTriples, 0);
    const totalSize = Array.from(results.values()).reduce((sum, result) => sum + result.size, 0);
    const totalWarnings = Array.from(results.values()).reduce((sum, result) => sum + result.warnings.length, 0);
    
    const avgTriplesPerModule = totalModules > 0 ? Math.round(totalTriples / totalModules) : 0;
    const avgSizePerModule = totalModules > 0 ? Math.round(totalSize / totalModules) : 0;

    const report = `# RDF Generation Summary Report

## Overview
- Total Modules: ${totalModules}
- Total RDF Triples: ${totalTriples.toLocaleString()}
- Total Size: ${(totalSize / 1024).toFixed(2)} KB
- Total Warnings: ${totalWarnings}

## Averages
- Triples per Module: ${avgTriplesPerModule}
- Size per Module: ${(avgSizePerModule / 1024).toFixed(2)} KB

## Module Details
${Array.from(results.entries()).map(([path, result]) => `
### ${path}
- Triples: ${result.statistics.totalTriples}
- Classes: ${result.statistics.classCount}
- Methods: ${result.statistics.methodCount}
- Size: ${(result.size / 1024).toFixed(2)} KB
- Generation Time: ${result.generationTime}ms
- Warnings: ${result.warnings.length}
`).join('')}

## Quality Metrics
- Documentation Coverage: ${this.calculateDocumentationCoverage(results)}%
- Business Context Coverage: ${this.calculateBusinessContextCoverage(results)}%
- Average Complexity: ${this.calculateAverageComplexity(results)}

Generated at: ${new Date().toISOString()}`;

    return report.trim();
  }

  // Private helper methods
  private async scanDirectory(
    dirPath: string,
    modules: DetectedModule[],
    errors: ModuleDetectionError[],
    counters: {
      totalFiles: () => void;
      supportedFiles: () => void;
      skippedFiles: (file: string) => void;
    }
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip node_modules and other common directories
          if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
            await this.scanDirectory(fullPath, modules, errors, counters);
          }
        } else if (entry.isFile()) {
          counters.totalFiles();
          
          if (this.isSupportedFile(entry.name)) {
            counters.supportedFiles();
            
            // Detect if this is a module entry point
            const module = await this.detectModule(fullPath);
            if (module) {
              modules.push(module);
            }
          } else {
            counters.skippedFiles(fullPath);
          }
        }
      }
    } catch (error) {
      errors.push({
        file: dirPath,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'access_denied'
      });
    }
  }

  private isSupportedFile(filename: string): boolean {
    const supportedExtensions = ['.ts', '.js', '.py', '.java', '.go', '.rs', '.cpp', '.hpp', '.c', '.h'];
    return supportedExtensions.some(ext => filename.endsWith(ext));
  }

  private async detectModule(filePath: string): Promise<DetectedModule | null> {
    try {
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath);
      const basename = path.basename(filePath, ext);
      
      // Simple heuristics for module detection
      const isEntryPoint = ['index', 'main', 'app'].includes(basename.toLowerCase()) ||
                          filePath.includes('src/') ||
                          filePath.includes('lib/');
      
      if (isEntryPoint) {
        return {
          path: filePath,
          name: basename,
          type: this.inferModuleType(filePath),
          language: this.getLanguageFromExtension(ext),
          entryPoints: [filePath],
          configFiles: [],
          dependencies: [],
          estimatedSize: stats.size
        };
      }
      
      return null;
    } catch {
      return null;
    }
  }

  private inferModuleType(filePath: string): 'library' | 'application' | 'service' | 'utility' | 'test' {
    if (filePath.includes('test') || filePath.includes('spec')) return 'test';
    if (filePath.includes('util') || filePath.includes('helper')) return 'utility';
    if (filePath.includes('service') || filePath.includes('api')) return 'service';
    if (filePath.includes('lib') || filePath.includes('package')) return 'library';
    return 'application';
  }

  private getLanguageFromExtension(ext: string): string {
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'cpp'
    };
    return languageMap[ext] || 'unknown';
  }

  private extractBusinessContext(ttlContent: string): string | null {
    // Extract business context comments and triples
    const businessContextRegex = /# Business[\s\S]*?(?=\n\n|\n@|\ncode:)/g;
    const matches = ttlContent.match(businessContextRegex);
    return matches ? matches.join('\n\n') : null;
  }

  private mergeBusinessContext(newContent: string, existingContext: string): string {
    // Replace placeholder business context with existing context
    return newContent.replace(
      /# Business Domain: \[BUSINESS_DOMAIN\][\s\S]*?(?=\n\n|\n@|\ncode:)/g,
      existingContext
    );
  }

  private getTTLPath(sourceFilePath: string): string {
    const dir = path.dirname(sourceFilePath);
    return path.join(dir, '.module-knowledge.ttl');
  }

  private calculateDocumentationCoverage(results: Map<string, RDFGenerationResult>): number {
    const totalElements = Array.from(results.values()).reduce(
      (sum, result) => sum + result.statistics.classCount + result.statistics.methodCount, 0
    );
    const documentedElements = Array.from(results.values()).reduce(
      (sum, result) => sum + result.statistics.documentationTriples, 0
    );
    
    return totalElements > 0 ? Math.round((documentedElements / totalElements) * 100) : 0;
  }

  private calculateBusinessContextCoverage(results: Map<string, RDFGenerationResult>): number {
    const totalModules = results.size;
    const modulesWithContext = Array.from(results.values()).filter(
      result => result.statistics.businessContextTriples > 0
    ).length;
    
    return totalModules > 0 ? Math.round((modulesWithContext / totalModules) * 100) : 0;
  }

  private calculateAverageComplexity(results: Map<string, RDFGenerationResult>): number {
    const complexityValues: number[] = [];
    
    results.forEach(result => {
      // Extract complexity from RDF statistics
      const totalElements = result.statistics.classCount + result.statistics.methodCount;
      if (totalElements > 0) {
        // Calculate average complexity based on quality metrics
        const avgComplexity = result.statistics.qualityMetricTriples / totalElements;
        complexityValues.push(avgComplexity);
      }
    });
    
    if (complexityValues.length === 0) return 0;
    
    const sum = complexityValues.reduce((acc, val) => acc + val, 0);
    return Math.round((sum / complexityValues.length) * 100) / 100;
  }
}

// Extend RDFGenerationOptions to include batch processing options
declare module './types' {
  interface RDFGenerationOptions {
    validateOutput?: boolean;
    batchConcurrency?: number;
  }
}