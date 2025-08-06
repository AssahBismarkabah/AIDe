import { BaseAnalyzer } from './BaseAnalyzer';
import {
  ASTNode,
  CodeFunction,
  CodeClass,
  ImportDeclaration,
  ExportDeclaration,
  AnalysisContext,
  ComplexityMetrics,
  SupportedLanguage,
  Parameter,
  ClassProperty
} from './types';

/**
 * Rust AST Analyzer
 * Analyzes Rust source code using regex-based parsing
 * Handles Rust-specific constructs like traits, impls, modules, and ownership
 */
export class RustAnalyzer extends BaseAnalyzer {
  constructor() {
    super('rust' as SupportedLanguage);
  }

  /**
   * Parse Rust source code (regex-based approach)
   */
  protected async parseAST(content: string, context: AnalysisContext): Promise<any> {
    return {
      content,
      lines: content.split('\n'),
      filePath: context.filePath
    };
  }

  /**
   * Extract AST nodes from Rust code
   */
  protected async extractNodes(ast: any, context: AnalysisContext): Promise<ASTNode[]> {
    const nodes: ASTNode[] = [];
    const { content, lines } = ast;

    // Parse modules
    nodes.push(...this.parseModules(content, lines, context.filePath));
    
    // Parse constants
    nodes.push(...this.parseConstants(content, lines, context.filePath));
    
    // Parse static variables
    nodes.push(...this.parseStatics(content, lines, context.filePath));

    return nodes;
  }

  /**
   * Extract functions from Rust code
   */
  protected async extractFunctions(ast: any, context: AnalysisContext): Promise<CodeFunction[]> {
    const functions: CodeFunction[] = [];
    const { content, lines } = ast;
    const functionRegex = /^(\s*)(?:(pub(?:\([^)]*\))?)\s+)?(?:(async)\s+)?(?:(unsafe)\s+)?fn\s+(\w+)(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*([^{]+?))?\s*\{/gm;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const [fullMatch, , visibility, isAsync, , name, params, returnType] = match;
      const startLine = this.getLineNumber(content, match.index);
      
      // Find function end
      const endLine = this.findBlockEnd(content, match.index + fullMatch.length - 1, lines);
      
      // Parse parameters
      const parameters = this.parseRustParameters(params);
      
      // Determine visibility
      const isPublic = visibility?.includes('pub') || false;
      
      // Calculate complexity
      const functionCode = lines.slice(startLine - 1, endLine).join('\n');
      const complexity = await this.calculateFunctionComplexity(functionCode);

      functions.push({
        id: this.generateId(),
        name,
        parameters,
        returnType: returnType?.trim() || 'void',
        complexity: complexity.cyclomaticComplexity,
        startLine,
        endLine,
        filePath: context.filePath,
        isAsync: !!isAsync,
        isExported: isPublic,
        visibility: isPublic ? 'public' : 'private',
        dependencies: [],
        calls: this.extractFunctionCalls(functionCode)
      });
    }

    return functions;
  }

  /**
   * Extract classes (structs, enums, traits) from Rust code
   */
  protected async extractClasses(ast: any, context: AnalysisContext): Promise<CodeClass[]> {
    const classes: CodeClass[] = [];
    const { content, lines } = ast;

    // Parse structs
    classes.push(...await this.parseStructs(content, lines, context.filePath));
    
    // Parse enums
    classes.push(...await this.parseEnums(content, lines, context.filePath));
    
    // Parse traits
    classes.push(...await this.parseTraits(content, lines, context.filePath));

    return classes;
  }

  /**
   * Extract imports (use statements) from Rust code
   */
  protected async extractImports(ast: any, context: AnalysisContext): Promise<ImportDeclaration[]> {
    const imports: ImportDeclaration[] = [];
    const { content } = ast;
    const useRegex = /^(?:pub\s+)?use\s+([^;]+);/gm;
    let match;

    while ((match = useRegex.exec(content)) !== null) {
      const lineNumber = this.getLineNumber(content, match.index);
      const usePath = match[1].trim();
      // const isPublic = match[0].includes('pub');
      
      // Parse different use patterns
      let modulePath = '';
      let importedItems: string[] = [];
      
      if (usePath.includes('{')) {
        // use std::collections::{HashMap, HashSet};
        const pathMatch = usePath.match(/^([^{]+)\{([^}]+)\}/);
        if (pathMatch) {
          modulePath = pathMatch[1].replace(/::$/, '');
          importedItems = pathMatch[2].split(',').map(item => item.trim());
        }
      } else if (usePath.includes('::*')) {
        // use std::collections::*;
        modulePath = usePath.replace(/::?\*$/, '');
        importedItems = ['*'];
      } else if (usePath.includes(' as ')) {
        // use std::collections::HashMap as Map;
        const asMatch = usePath.match(/^(.+)\s+as\s+(\w+)$/);
        if (asMatch) {
          modulePath = asMatch[1];
          importedItems = [asMatch[2]];
        }
      } else {
        // use std::collections::HashMap;
        const parts = usePath.split('::');
        if (parts.length > 1) {
          modulePath = parts.slice(0, -1).join('::');
          importedItems = [parts[parts.length - 1]];
        } else {
          modulePath = usePath;
          importedItems = [usePath];
        }
      }

      imports.push({
        id: this.generateId(),
        source: modulePath,
        imports: importedItems.map(item => ({
          name: item,
          alias: undefined,
          isDefault: false,
          isNamespace: item === '*'
        })),
        filePath: context.filePath,
        startLine: lineNumber,
        endLine: lineNumber
      });
    }

    return imports;
  }

  /**
   * Extract exports from Rust code
   */
  protected async extractExports(ast: any, context: AnalysisContext): Promise<ExportDeclaration[]> {
    const exports: ExportDeclaration[] = [];
    const { content } = ast;
    
    // In Rust, exports are determined by pub visibility
    const pubRegex = /^(\s*)pub\s+(?:(fn|struct|enum|trait|const|static|mod)\s+(\w+)|use\s+([^;]+);)/gm;
    let match;

    while ((match = pubRegex.exec(content)) !== null) {
      const lineNumber = this.getLineNumber(content, match.index);
      const itemType = match[2];
      const name = match[3] || match[4] || 'unknown';
      
      let exportType: 'function' | 'class' | 'variable' | 'type' | 'interface' = 'variable';
      
      switch (itemType) {
        case 'fn':
          exportType = 'function';
          break;
        case 'struct':
        case 'enum':
          exportType = 'class';
          break;
        case 'trait':
          exportType = 'interface';
          break;
        case 'const':
        case 'static':
          exportType = 'variable';
          break;
        default:
          exportType = 'type';
      }
      
      exports.push({
        id: this.generateId(),
        name,
        type: exportType,
        isDefault: false,
        filePath: context.filePath,
        startLine: lineNumber,
        endLine: lineNumber
      });
    }

    return exports;
  }

  /**
   * Extract dependencies from Rust code
   */
  protected async extractDependencies(ast: any, _context: AnalysisContext): Promise<string[]> {
    const dependencies = new Set<string>();
    const { content } = ast;
    
    // Extract from use statements
    const useRegex = /^use\s+([^;]+);/gm;
    let match;

    while ((match = useRegex.exec(content)) !== null) {
      const usePath = match[1].trim();
      const rootModule = usePath.split('::')[0];
      if (rootModule && !rootModule.startsWith('self') && !rootModule.startsWith('super')) {
        dependencies.add(rootModule);
      }
    }

    return Array.from(dependencies);
  }

  /**
   * Calculate complexity metrics for Rust code
   */
  protected async calculateComplexity(ast: any, _context: AnalysisContext): Promise<ComplexityMetrics> {
    const { content, lines } = ast;
    const linesOfCode = lines.filter((line: string) => line.trim() && !line.trim().startsWith('//')).length;
    
    let cyclomaticComplexity = 1; // Base complexity
    let cognitiveComplexity = 0;
    
    // Rust-specific complexity patterns
    const complexityPatterns = [
      /\bif\b/g,           // if statements
      /\belse\s+if\b/g,    // else if
      /\bwhile\b/g,        // while loops
      /\bfor\b/g,          // for loops
      /\bloop\b/g,         // infinite loops
      /\bmatch\b/g,        // match expressions
      /\b=>\b/g,           // match arms (subtract 1 since match adds 1)
      /\?\s*;/g,           // error propagation
      /\bunwrap\(\)/g,     // unwrap calls
      /\bexpect\(/g,       // expect calls
      /&&|\|\|/g,          // logical operators
    ];

    complexityPatterns.forEach((pattern, index) => {
      const matches = content.match(pattern) || [];
      if (index === 6) { // match arms
        cyclomaticComplexity += Math.max(0, matches.length - 1);
        cognitiveComplexity += matches.length;
      } else {
        cyclomaticComplexity += matches.length;
        cognitiveComplexity += matches.length;
      }
    });

    // Additional cognitive complexity for nesting
    const nestingPatterns = [
      /\bif\b.*\{[\s\S]*?\bif\b/g,
      /\bfor\b.*\{[\s\S]*?\bfor\b/g,
      /\bwhile\b.*\{[\s\S]*?\bwhile\b/g,
      /\bmatch\b.*\{[\s\S]*?\bmatch\b/g,
    ];

    nestingPatterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      cognitiveComplexity += matches.length * 2; // Nesting penalty
    });

    // Calculate maintainability index (simplified)
    const maintainabilityIndex = Math.max(0, 
      171 - 5.2 * Math.log(linesOfCode) - 0.23 * cyclomaticComplexity
    );

    // Calculate technical debt (simplified)
    const technicalDebt = Math.max(0, cyclomaticComplexity - 10) * 0.5;

    return {
      cyclomaticComplexity,
      cognitiveComplexity,
      linesOfCode,
      maintainabilityIndex: Math.round(maintainabilityIndex),
      technicalDebt: Math.round(technicalDebt)
    };
  }

  /**
   * Get parser configuration for Rust
   */
  protected getParserConfig(): any {
    return {
      language: 'rust',
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: false,
      strictMode: true,
      plugins: []
    };
  }

  // Helper methods

  /**
   * Get line number from character index
   */
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Find the end of a code block
   */
  private findBlockEnd(content: string, startIndex: number, _lines: string[]): number {
    let braceCount = 1;
    let currentIndex = startIndex + 1;
    
    while (currentIndex < content.length && braceCount > 0) {
      const char = content[currentIndex];
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
      }
      currentIndex++;
    }
    
    return this.getLineNumber(content, currentIndex - 1);
  }

  /**
   * Parse Rust modules
   */
  private parseModules(content: string, _lines: string[], filePath: string): ASTNode[] {
    const nodes: ASTNode[] = [];
    const moduleRegex = /^(?:pub\s+)?mod\s+(\w+)(?:\s*\{|\s*;)/gm;
    let match;

    while ((match = moduleRegex.exec(content)) !== null) {
      const lineNumber = this.getLineNumber(content, match.index);
      const isPublic = match[0].includes('pub');
      
      nodes.push({
        id: this.generateId(),
        type: 'module',
        name: match[1],
        startLine: lineNumber,
        endLine: lineNumber,
        startColumn: 0,
        endColumn: match[0].length,
        filePath,
        parent: undefined,
        children: [],
        properties: {
          isPublic,
          language: 'rust'
        }
      });
    }

    return nodes;
  }

  /**
   * Parse Rust constants
   */
  private parseConstants(content: string, _lines: string[], filePath: string): ASTNode[] {
    const constants: ASTNode[] = [];
    const constRegex = /^(\s*)(?:(pub(?:\([^)]*\))?)\s+)?const\s+(\w+)\s*:\s*([^=]+)\s*=\s*([^;]+);/gm;
    let match;

    while ((match = constRegex.exec(content)) !== null) {
      const [fullMatch, , visibility, name, type, value] = match;
      const lineNumber = this.getLineNumber(content, match.index);
      const isPublic = visibility?.includes('pub') || false;

      constants.push({
        id: this.generateId(),
        type: 'constant',
        name,
        startLine: lineNumber,
        endLine: lineNumber,
        startColumn: 0,
        endColumn: fullMatch.length,
        filePath,
        parent: undefined,
        children: [],
        properties: {
          isPublic,
          isConst: true,
          dataType: type.trim(),
          value: value.trim(),
          visibility: visibility || 'private',
          language: 'rust'
        }
      });
    }

    return constants;
  }

  /**
   * Parse Rust static variables
   */
  private parseStatics(content: string, _lines: string[], filePath: string): ASTNode[] {
    const statics: ASTNode[] = [];
    const staticRegex = /^(\s*)(?:(pub(?:\([^)]*\))?)\s+)?static\s+(?:(mut)\s+)?(\w+)\s*:\s*([^=]+)\s*=\s*([^;]+);/gm;
    let match;

    while ((match = staticRegex.exec(content)) !== null) {
      const [fullMatch, , visibility, isMut, name, type, value] = match;
      const lineNumber = this.getLineNumber(content, match.index);
      const isPublic = visibility?.includes('pub') || false;

      statics.push({
        id: this.generateId(),
        type: 'static',
        name,
        startLine: lineNumber,
        endLine: lineNumber,
        startColumn: 0,
        endColumn: fullMatch.length,
        filePath,
        parent: undefined,
        children: [],
        properties: {
          isPublic,
          isStatic: true,
          isMutable: !!isMut,
          dataType: type.trim(),
          value: value.trim(),
          visibility: visibility || 'private',
          language: 'rust'
        }
      });
    }

    return statics;
  }

  /**
   * Parse Rust function parameters
   */
  private parseRustParameters(params: string): Parameter[] {
    if (!params.trim()) return [];
    
    return params.split(',').map(param => {
      const trimmed = param.trim();
      if (!trimmed) return null;
      
      // Handle self parameter
      if (trimmed === 'self' || trimmed === '&self' || trimmed === '&mut self') {
        return { name: 'self', type: 'Self', optional: false };
      }
      
      // Handle regular parameters: name: type
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex !== -1) {
        const name = trimmed.substring(0, colonIndex).trim();
        const type = trimmed.substring(colonIndex + 1).trim();
        return { name, type, optional: false };
      }
      
      return { name: trimmed, type: 'unknown', optional: false };
    }).filter(p => p !== null) as Parameter[];
  }

  /**
   * Parse Rust structs
   */
  private async parseStructs(content: string, lines: string[], filePath: string): Promise<CodeClass[]> {
    const structs: CodeClass[] = [];
    const structRegex = /^(\s*)(?:(pub(?:\([^)]*\))?)\s+)?struct\s+(\w+)(?:<[^>]*>)?\s*(?:\{|;|\()/gm;
    let match;

    while ((match = structRegex.exec(content)) !== null) {
      const [fullMatch, , visibility, name] = match;
      const startLine = this.getLineNumber(content, match.index);
      const isPublic = visibility?.includes('pub') || false;
      
      let endLine = startLine;
      let properties: ClassProperty[] = [];
      
      // Handle different struct types
      if (fullMatch.endsWith('{')) {
        // Regular struct with fields
        endLine = this.findBlockEnd(content, match.index + fullMatch.length - 1, lines);
        const structCode = lines.slice(startLine - 1, endLine).join('\n');
        properties = this.parseStructFields(structCode);
      } else if (fullMatch.endsWith('(')) {
        // Tuple struct
        const tupleEnd = content.indexOf(')', match.index + fullMatch.length);
        if (tupleEnd !== -1) {
          endLine = this.getLineNumber(content, tupleEnd);
          const tupleContent = content.substring(match.index + fullMatch.length, tupleEnd);
          properties = this.parseTupleFields(tupleContent);
        }
      }
      // Unit struct (ends with ;) - no fields

      structs.push({
        id: this.generateId(),
        name,
        methods: [],
        properties,
        extends: undefined,
        implements: [],
        startLine,
        endLine,
        filePath,
        isExported: isPublic,
        visibility: isPublic ? 'public' : 'private',
        isAbstract: false
      });
    }

    return structs;
  }

  /**
   * Parse Rust enums
   */
  private async parseEnums(content: string, lines: string[], filePath: string): Promise<CodeClass[]> {
    const enums: CodeClass[] = [];
    const enumRegex = /^(\s*)(?:(pub(?:\([^)]*\))?)\s+)?enum\s+(\w+)(?:<[^>]*>)?\s*\{/gm;
    let match;

    while ((match = enumRegex.exec(content)) !== null) {
      const [fullMatch, , visibility, name] = match;
      const startLine = this.getLineNumber(content, match.index);
      const endLine = this.findBlockEnd(content, match.index + fullMatch.length - 1, lines);
      const isPublic = visibility?.includes('pub') || false;
      
      // Parse enum variants
      const enumCode = lines.slice(startLine - 1, endLine).join('\n');
      const properties = this.parseEnumVariants(enumCode);

      enums.push({
        id: this.generateId(),
        name,
        methods: [],
        properties,
        extends: undefined,
        implements: [],
        startLine,
        endLine,
        filePath,
        isExported: isPublic,
        visibility: isPublic ? 'public' : 'private',
        isAbstract: false
      });
    }

    return enums;
  }

  /**
   * Parse Rust traits
   */
  private async parseTraits(content: string, lines: string[], filePath: string): Promise<CodeClass[]> {
    const traits: CodeClass[] = [];
    const traitRegex = /^(\s*)(?:(pub(?:\([^)]*\))?)\s+)?trait\s+(\w+)(?:<[^>]*>)?(?:\s*:\s*([^{]+))?\s*\{/gm;
    let match;

    while ((match = traitRegex.exec(content)) !== null) {
      const [fullMatch, , visibility, name, bounds] = match;
      const startLine = this.getLineNumber(content, match.index);
      const endLine = this.findBlockEnd(content, match.index + fullMatch.length - 1, lines);
      const isPublic = visibility?.includes('pub') || false;
      
      // Parse trait methods
      const traitCode = lines.slice(startLine - 1, endLine).join('\n');
      const methods = await this.parseTraitMethods(traitCode, filePath);
      
      // Parse supertraits
      const supertraits = bounds ? bounds.split('+').map(b => b.trim()) : [];

      traits.push({
        id: this.generateId(),
        name,
        methods,
        properties: [],
        extends: undefined,
        implements: supertraits,
        startLine,
        endLine,
        filePath,
        isExported: isPublic,
        visibility: isPublic ? 'public' : 'private',
        isAbstract: true
      });
    }

    return traits;
  }

  /**
   * Parse struct fields
   */
  private parseStructFields(structCode: string): ClassProperty[] {
    const fields: ClassProperty[] = [];
    const fieldRegex = /^\s*(?:(pub(?:\([^)]*\))?)\s+)?(\w+)\s*:\s*([^,\n}]+)/gm;
    let match;

    while ((match = fieldRegex.exec(structCode)) !== null) {
      const [, visibility, name, type] = match;
      const isPublic = visibility?.includes('pub') || false;
      
      fields.push({
        name,
        type: type.trim(),
        visibility: isPublic ? 'public' : 'private',
        isStatic: false,
        isReadonly: false,
        defaultValue: undefined
      });
    }

    return fields;
  }

  /**
   * Parse tuple struct fields
   */
  private parseTupleFields(tupleContent: string): ClassProperty[] {
    const fields: ClassProperty[] = [];
    const types = tupleContent.split(',').map(t => t.trim()).filter(t => t);
    
    types.forEach((type, index) => {
      const isPublic = type.startsWith('pub ');
      const cleanType = isPublic ? type.substring(4) : type;
      
      fields.push({
        name: `field_${index}`,
        type: cleanType,
        visibility: isPublic ? 'public' : 'private',
        isStatic: false,
        isReadonly: false,
        defaultValue: undefined
      });
    });

    return fields;
  }

  /**
   * Parse enum variants
   */
  private parseEnumVariants(enumCode: string): ClassProperty[] {
    const variants: ClassProperty[] = [];
    const variantRegex = /^\s*(\w+)(?:\([^)]*\)|\s*\{[^}]*\})?/gm;
    let match;

    while ((match = variantRegex.exec(enumCode)) !== null) {
      if (match[1] !== 'enum') { // Skip the enum keyword itself
        variants.push({
          name: match[1],
          type: 'variant',
          visibility: 'public',
          isStatic: false,
          isReadonly: true,
          defaultValue: undefined
        });
      }
    }

    return variants;
  }

  /**
   * Parse trait methods
   */
  private async parseTraitMethods(traitCode: string, filePath: string): Promise<CodeFunction[]> {
    const methods: CodeFunction[] = [];
    const methodRegex = /^\s*fn\s+(\w+)(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*([^{;]+))?(?:\s*\{|\s*;)/gm;
    let match;

    while ((match = methodRegex.exec(traitCode)) !== null) {
      const [, name, params, returnType] = match;
      const startLine = this.getLineNumber(traitCode, match.index);
      
      methods.push({
        id: this.generateId(),
        name,
        parameters: this.parseRustParameters(params),
        returnType: returnType?.trim() || 'void',
        complexity: 1,
        startLine,
        endLine: startLine,
        filePath,
        isAsync: false,
        isExported: true,
        visibility: 'public',
        dependencies: [],
        calls: []
      });
    }

    return methods;
  }

  /**
   * Extract function calls from code
   */
  private extractFunctionCalls(code: string): string[] {
    const calls: string[] = [];
    const callRegex = /(\w+)\s*\(/g;
    let match;

    while ((match = callRegex.exec(code)) !== null) {
      const functionName = match[1];
      if (functionName && !['if', 'while', 'for', 'match', 'loop'].includes(functionName)) {
        calls.push(functionName);
      }
    }

    return [...new Set(calls)]; // Remove duplicates
  }

  /**
   * Calculate complexity for a single function
   */
  private async calculateFunctionComplexity(code: string): Promise<ComplexityMetrics> {
    let cyclomaticComplexity = 1; // Base complexity
    let cognitiveComplexity = 0;
    
    // Rust-specific complexity patterns
    const complexityPatterns = [
      /\bif\b/g,           // if statements
      /\belse\s+if\b/g,    // else if
      /\bwhile\b/g,        // while loops
      /\bfor\b/g,          // for loops
      /\bloop\b/g,         // infinite loops
      /\bmatch\b/g,        // match expressions
      /\b=>\b/g,           // match arms (subtract 1 since match adds 1)
      /\?\s*;/g,           // error propagation
      /&&|\|\|/g,          // logical operators
    ];

    complexityPatterns.forEach((pattern, index) => {
      const matches = code.match(pattern) || [];
      if (index === 6) { // match arms
        cyclomaticComplexity += Math.max(0, matches.length - 1);
        cognitiveComplexity += matches.length;
      } else {
        cyclomaticComplexity += matches.length;
        cognitiveComplexity += matches.length;
      }
    });

    const linesOfCode = code.split('\n').filter(line => line.trim() && !line.trim().startsWith('//')).length;
    const maintainabilityIndex = Math.max(0, 171 - 5.2 * Math.log(linesOfCode) - 0.23 * cyclomaticComplexity);
    const technicalDebt = Math.max(0, cyclomaticComplexity - 10) * 0.5;

    return {
      cyclomaticComplexity,
      cognitiveComplexity,
      linesOfCode,
      maintainabilityIndex: Math.round(maintainabilityIndex),
      technicalDebt: Math.round(technicalDebt)
    };
  }
}