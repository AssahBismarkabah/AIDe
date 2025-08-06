/**
 * AST Analyzer Factory
 * Main entry point for AST analysis functionality
 */

import { BaseAnalyzer } from './BaseAnalyzer';
import { TypeScriptAnalyzer } from './TypeScriptAnalyzer';
import { PythonAnalyzer } from './PythonAnalyzer';
import { JavaAnalyzer } from './JavaAnalyzer';
import { GoAnalyzer } from './GoAnalyzer';
import { RustAnalyzer } from './RustAnalyzer';
import { CppAnalyzer } from './CppAnalyzer';
import { SupportedLanguage, AnalysisResult, AnalysisOptions } from './types';
import logger from '../../../utils/logger';

export class ASTAnalyzerFactory {
  private static analyzers: Map<SupportedLanguage, BaseAnalyzer> = new Map();

  /**
   * Get analyzer for specific language
   */
  static getAnalyzer(language: SupportedLanguage): BaseAnalyzer {
    if (!this.analyzers.has(language)) {
      this.analyzers.set(language, this.createAnalyzer(language));
    }
    return this.analyzers.get(language)!;
  }

  /**
   * Create analyzer instance for language
   */
  private static createAnalyzer(language: SupportedLanguage): BaseAnalyzer {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return new TypeScriptAnalyzer();
      
      case 'python':
        return new PythonAnalyzer();
      
      case 'java':
        return new JavaAnalyzer();
      
      case 'go':
        return new GoAnalyzer();
      
      case 'rust':
        return new RustAnalyzer();
      
      case 'cpp':
        return new CppAnalyzer();
      
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  /**
   * Detect language from file extension
   */
  static detectLanguage(filePath: string): SupportedLanguage {
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
        throw new Error(`Cannot detect language for file: ${filePath}`);
    }
  }

  /**
   * Analyze single file with automatic language detection
   */
  static async analyzeFile(
    filePath: string, 
    options?: Partial<AnalysisOptions>
  ): Promise<AnalysisResult> {
    try {
      const language = this.detectLanguage(filePath);
      const analyzer = this.getAnalyzer(language);
      
      logger.debug(`Analyzing ${filePath} as ${language}`);
      return await analyzer.analyzeFile(filePath, options);
      
    } catch (error) {
      logger.error(`Failed to analyze file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Analyze multiple files with automatic language detection
   */
  static async analyzeFiles(
    filePaths: string[],
    options?: Partial<AnalysisOptions>
  ): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    
    // Analyze each file individually to ensure correct language detection
    for (const filePath of filePaths) {
      try {
        const result = await this.analyzeFile(filePath, options);
        results.push(result);
      } catch (error) {
        logger.warn(`Skipping file ${filePath}: ${error}`);
      }
    }
    
    return results;
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages(): SupportedLanguage[] {
    return ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'cpp'];
  }

  /**
   * Check if language is supported
   */
  static isLanguageSupported(language: string): language is SupportedLanguage {
    return this.getSupportedLanguages().includes(language as SupportedLanguage);
  }

  /**
   * Get file extensions for language
   */
  static getLanguageExtensions(language: SupportedLanguage): string[] {
    switch (language) {
      case 'typescript':
        return ['ts', 'tsx'];
      case 'javascript':
        return ['js', 'jsx', 'mjs'];
      case 'python':
        return ['py'];
      case 'java':
        return ['java'];
      case 'go':
        return ['go'];
      case 'rust':
        return ['rs'];
      case 'cpp':
        return ['cpp', 'cc', 'cxx', 'c++', 'hpp', 'h'];
      default:
        return [];
    }
  }
}

// Export types and classes
export * from './types';
export { BaseAnalyzer } from './BaseAnalyzer';
export { TypeScriptAnalyzer } from './TypeScriptAnalyzer';
export { PythonAnalyzer } from './PythonAnalyzer';
export { JavaAnalyzer } from './JavaAnalyzer';
export { GoAnalyzer } from './GoAnalyzer';
export { RustAnalyzer } from './RustAnalyzer';
export { CppAnalyzer } from './CppAnalyzer';

// Default export
export default ASTAnalyzerFactory;