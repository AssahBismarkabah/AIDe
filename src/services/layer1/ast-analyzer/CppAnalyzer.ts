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
 * C++ AST Analyzer
 * Analyzes C++ source code using regex-based parsing
 * Handles C++ specific constructs like classes, namespaces, templates, and preprocessor directives
 */
export class CppAnalyzer extends BaseAnalyzer {
  constructor() {
    super('cpp' as SupportedLanguage);
  }

  /**
   * Parse C++ source code (regex-based approach)
   */
  protected async parseAST(content: string, context: AnalysisContext): Promise<any> {
    return {
      content,
      lines: content.split('\n'),
      filePath: context.filePath
    };
  }

  /**
   * Extract AST nodes from C++ code
   */
  protected async extractNodes(ast: any, context: AnalysisContext): Promise<ASTNode[]> {
    const nodes: ASTNode[] = [];
    const { content, lines } = ast;

    // Parse namespaces
    nodes.push(...this.parseNamespaces(content, lines, context.filePath));
    
    // Parse preprocessor directives
    nodes.push(...this.parsePreprocessorDirectives(content, lines, context.filePath));
    
    // Parse typedefs and using declarations
    nodes.push(...this.parseTypeDeclarations(content, lines, context.filePath));
    
    // Parse global variables
    nodes.push(...this.parseGlobalVariables(content, lines, context.filePath));

    return nodes;
  }

  /**
   * Extract functions from C++ code
   */
  protected async extractFunctions(ast: any, context: AnalysisContext): Promise<CodeFunction[]> {
    const functions: CodeFunction[] = [];
    const { content, lines } = ast;
    
    // Parse regular functions (including member functions)
    const functionRegex = /^(\s*)(?:(virtual|static|inline|explicit|friend)\s+)*(?:(template\s*<[^>]*>\s+))?(?:(\w+(?:::\w+)*)\s+)?(\w+)\s*\(([^)]*)\)(?:\s*(const|volatile|noexcept|override|final))*\s*(?::\s*[^{]*)?(?:\s*\{|;)/gm;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const [fullMatch, , modifiers, , returnType, name, params, ] = match;
      
      // Skip constructors and destructors in this pass (handled in class parsing)
      if (name.startsWith('~') || (!returnType && !modifiers?.includes('explicit'))) {
        continue;
      }
      
      const startLine = this.getLineNumber(content, match.index);
      
      // Find function end if it has a body
      let endLine = startLine;
      if (fullMatch.endsWith('{')) {
        endLine = this.findBlockEnd(content, match.index + fullMatch.length - 1, lines);
      }
      
      // Parse parameters
      const parameters = this.parseCppParameters(params);
      
      // Determine visibility and other properties
      // const isStatic = modifiers?.includes('static') || false;
      // const isVirtual = modifiers?.includes('virtual') || false;
      // const isInline = modifiers?.includes('inline') || false;
      // const isConst = qualifiers?.includes('const') || false;
      
      // Calculate complexity if function has body
      let complexity = 1;
      if (fullMatch.endsWith('{')) {
        const functionCode = lines.slice(startLine - 1, endLine).join('\n');
        const complexityMetrics = await this.calculateFunctionComplexity(functionCode);
        complexity = complexityMetrics.cyclomaticComplexity;
      }

      functions.push({
        id: this.generateId(),
        name,
        parameters,
        returnType: returnType?.trim() || 'void',
        complexity,
        startLine,
        endLine,
        filePath: context.filePath,
        isAsync: false, // C++ doesn't have native async like JS/TS
        isExported: true, // Assume exported unless in anonymous namespace
        visibility: 'public', // Default, will be refined in class context
        dependencies: [],
        calls: this.extractFunctionCalls(fullMatch.endsWith('{') ? lines.slice(startLine - 1, endLine).join('\n') : '')
      });
    }

    return functions;
  }

  /**
   * Extract classes from C++ code
   */
  protected async extractClasses(ast: any, context: AnalysisContext): Promise<CodeClass[]> {
    const classes: CodeClass[] = [];
    const { content, lines } = ast;

    // Parse classes and structs
    const classRegex = /^(\s*)(?:(template\s*<[^>]*>\s+))?(class|struct)\s+(?:(\w+)\s+)?(\w+)(?:\s*:\s*([^{]+))?\s*\{/gm;
    let match;

    while ((match = classRegex.exec(content)) !== null) {
      const [fullMatch, , , , , name, inheritance] = match;
      const startLine = this.getLineNumber(content, match.index);
      const endLine = this.findBlockEnd(content, match.index + fullMatch.length - 1, lines);
      
      // Parse class body
      const classCode = lines.slice(startLine - 1, endLine).join('\n');
      const methods = await this.parseClassMethods(classCode, context.filePath, name);
      const properties = this.parseClassProperties(classCode);
      
      // Parse inheritance
      const baseClasses: string[] = [];
      
      if (inheritance) {
        const inheritanceList = inheritance.split(',').map(i => i.trim());
        inheritanceList.forEach(base => {
          // Remove access specifiers (public, private, protected, virtual)
          const cleanBase = base.replace(/^(public|private|protected|virtual)\s+/, '').trim();
          baseClasses.push(cleanBase);
        });
      }

      classes.push({
        id: this.generateId(),
        name,
        methods,
        properties,
        extends: baseClasses[0] || undefined,
        implements: baseClasses.slice(1), // Additional base classes treated as interfaces
        startLine,
        endLine,
        filePath: context.filePath,
        isExported: true,
        visibility: 'public',
        isAbstract: this.isAbstractClass(classCode)
      });
    }

    return classes;
  }

  /**
   * Extract imports (#include directives) from C++ code
   */
  protected async extractImports(ast: any, context: AnalysisContext): Promise<ImportDeclaration[]> {
    const imports: ImportDeclaration[] = [];
    const { content } = ast;
    
    const includeRegex = /^#include\s*([<"]([^>"]+)[>"])/gm;
    let match;

    while ((match = includeRegex.exec(content)) !== null) {
      const lineNumber = this.getLineNumber(content, match.index);
      const includePath = match[2];
      // const isSystemHeader = match[1].startsWith('<');
      
      imports.push({
        id: this.generateId(),
        source: includePath,
        imports: [{
          name: includePath.split('/').pop()?.replace(/\.[^.]*$/, '') || includePath,
          alias: undefined,
          isDefault: true,
          isNamespace: false
        }],
        filePath: context.filePath,
        startLine: lineNumber,
        endLine: lineNumber
      });
    }

    return imports;
  }

  /**
   * Extract exports from C++ code
   */
  protected async extractExports(ast: any, context: AnalysisContext): Promise<ExportDeclaration[]> {
    const exports: ExportDeclaration[] = [];
    const { content } = ast;
    
    // In C++, exports are typically determined by header files and linkage
    // For simplicity, we'll consider public class members and global functions as exports
    
    // Export global functions
    const functionRegex = /^(?!.*static)(?:(?:inline|extern)\s+)?(?:\w+(?:::\w+)*\s+)?(\w+)\s*\([^)]*\)\s*(?:\{|;)/gm;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const lineNumber = this.getLineNumber(content, match.index);
      const name = match[1];
      
      exports.push({
        id: this.generateId(),
        name,
        type: 'function',
        isDefault: false,
        filePath: context.filePath,
        startLine: lineNumber,
        endLine: lineNumber
      });
    }

    // Export classes and structs
    const classRegex = /^(?:class|struct)\s+(?:\w+\s+)?(\w+)/gm;
    while ((match = classRegex.exec(content)) !== null) {
      const lineNumber = this.getLineNumber(content, match.index);
      const name = match[1];
      
      exports.push({
        id: this.generateId(),
        name,
        type: 'class',
        isDefault: false,
        filePath: context.filePath,
        startLine: lineNumber,
        endLine: lineNumber
      });
    }

    return exports;
  }

  /**
   * Extract dependencies from C++ code
   */
  protected async extractDependencies(ast: any, _context: AnalysisContext): Promise<string[]> {
    const dependencies = new Set<string>();
    const { content } = ast;
    
    // Extract from #include directives
    const includeRegex = /^#include\s*[<"]([^>"]+)[>"]/gm;
    let match;

    while ((match = includeRegex.exec(content)) !== null) {
      const includePath = match[1];
      // Extract the base name without extension
      const baseName = includePath.split('/').pop()?.replace(/\.[^.]*$/, '');
      if (baseName) {
        dependencies.add(baseName);
      }
    }

    return Array.from(dependencies);
  }

  /**
   * Calculate complexity metrics for C++ code
   */
  protected async calculateComplexity(ast: any, _context: AnalysisContext): Promise<ComplexityMetrics> {
    const { content, lines } = ast;
    const linesOfCode = lines.filter((line: string) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
    }).length;
    
    let cyclomaticComplexity = 1; // Base complexity
    let cognitiveComplexity = 0;
    
    // C++ specific complexity patterns
    const complexityPatterns = [
      /\bif\b/g,           // if statements
      /\belse\s+if\b/g,    // else if
      /\bwhile\b/g,        // while loops
      /\bfor\b/g,          // for loops
      /\bdo\b/g,           // do-while loops
      /\bswitch\b/g,       // switch statements
      /\bcase\b/g,         // case labels
      /\bcatch\b/g,        // exception handling
      /\bthrow\b/g,        // throw statements
      /&&|\|\|/g,          // logical operators
      /\?.*:/g,            // ternary operators
    ];

    complexityPatterns.forEach((pattern, index) => {
      const matches = content.match(pattern) || [];
      if (index === 6) { // case labels
        cyclomaticComplexity += Math.max(0, matches.length - 1); // First case doesn't add complexity
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
      /\btry\b.*\{[\s\S]*?\btry\b/g,
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
   * Get parser configuration for C++
   */
  protected getParserConfig(): any {
    return {
      language: 'cpp',
      sourceType: 'module',
      allowImportExportEverywhere: false,
      allowReturnOutsideFunction: false,
      strictMode: false,
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
   * Parse C++ namespaces
   */
  private parseNamespaces(content: string, _lines: string[], filePath: string): ASTNode[] {
    const nodes: ASTNode[] = [];
    const namespaceRegex = /^(\s*)namespace\s+(\w+)?\s*\{/gm;
    let match;

    while ((match = namespaceRegex.exec(content)) !== null) {
      const lineNumber = this.getLineNumber(content, match.index);
      const name = match[2] || 'anonymous';
      
      nodes.push({
        id: this.generateId(),
        type: 'namespace',
        name,
        startLine: lineNumber,
        endLine: lineNumber,
        startColumn: 0,
        endColumn: match[0].length,
        filePath,
        parent: undefined,
        children: [],
        properties: {
          language: 'cpp'
        }
      });
    }

    return nodes;
  }

  /**
   * Parse preprocessor directives
   */
  private parsePreprocessorDirectives(content: string, _lines: string[], filePath: string): ASTNode[] {
    const nodes: ASTNode[] = [];
    const directiveRegex = /^#(\w+)(?:\s+(.*))?$/gm;
    let match;

    while ((match = directiveRegex.exec(content)) !== null) {
      const lineNumber = this.getLineNumber(content, match.index);
      const directive = match[1];
      const value = match[2] || '';
      
      // Skip include directives as they're handled separately
      if (directive === 'include') continue;
      
      nodes.push({
        id: this.generateId(),
        type: 'preprocessor',
        name: `#${directive}`,
        startLine: lineNumber,
        endLine: lineNumber,
        startColumn: 0,
        endColumn: match[0].length,
        filePath,
        parent: undefined,
        children: [],
        properties: {
          directive,
          value,
          language: 'cpp'
        }
      });
    }

    return nodes;
  }

  /**
   * Parse type declarations (typedef, using)
   */
  private parseTypeDeclarations(content: string, _lines: string[], filePath: string): ASTNode[] {
    const nodes: ASTNode[] = [];
    
    // Parse typedef
    const typedefRegex = /^(\s*)typedef\s+(.+?)\s+(\w+)\s*;/gm;
    let match;

    while ((match = typedefRegex.exec(content)) !== null) {
      const lineNumber = this.getLineNumber(content, match.index);
      const originalType = match[2];
      const aliasName = match[3];
      
      nodes.push({
        id: this.generateId(),
        type: 'typedef',
        name: aliasName,
        startLine: lineNumber,
        endLine: lineNumber,
        startColumn: 0,
        endColumn: match[0].length,
        filePath,
        parent: undefined,
        children: [],
        properties: {
          originalType,
          language: 'cpp'
        }
      });
    }

    // Parse using declarations
    const usingRegex = /^(\s*)using\s+(\w+)\s*=\s*(.+?)\s*;/gm;
    while ((match = usingRegex.exec(content)) !== null) {
      const lineNumber = this.getLineNumber(content, match.index);
      const aliasName = match[2];
      const originalType = match[3];
      
      nodes.push({
        id: this.generateId(),
        type: 'using',
        name: aliasName,
        startLine: lineNumber,
        endLine: lineNumber,
        startColumn: 0,
        endColumn: match[0].length,
        filePath,
        parent: undefined,
        children: [],
        properties: {
          originalType,
          language: 'cpp'
        }
      });
    }

    return nodes;
  }

  /**
   * Parse global variables
   */
  private parseGlobalVariables(content: string, _lines: string[], filePath: string): ASTNode[] {
    const nodes: ASTNode[] = [];
    const globalVarRegex = /^(\s*)(?:(extern|static|const|constexpr)\s+)*(\w+(?:::\w+)*(?:\s*[*&]+)?)\s+(\w+)(?:\s*=\s*[^;]+)?\s*;/gm;
    let match;

    while ((match = globalVarRegex.exec(content)) !== null) {
      const lineNumber = this.getLineNumber(content, match.index);
      const modifiers = match[2] || '';
      const type = match[3];
      const name = match[4];
      
      nodes.push({
        id: this.generateId(),
        type: 'variable',
        name,
        startLine: lineNumber,
        endLine: lineNumber,
        startColumn: 0,
        endColumn: match[0].length,
        filePath,
        parent: undefined,
        children: [],
        properties: {
          dataType: type,
          modifiers,
          isGlobal: true,
          language: 'cpp'
        }
      });
    }

    return nodes;
  }

  /**
   * Parse C++ function parameters
   */
  private parseCppParameters(params: string): Parameter[] {
    if (!params.trim()) return [];
    
    return params.split(',').map(param => {
      const trimmed = param.trim();
      if (!trimmed) return null;
      
      // Handle parameter with default value: type name = value
      const defaultMatch = trimmed.match(/^(.+?)\s+(\w+)\s*=\s*(.+)$/);
      if (defaultMatch) {
        return {
          name: defaultMatch[2],
          type: defaultMatch[1].trim(),
          optional: true,
          defaultValue: defaultMatch[3].trim()
        };
      }
      
      // Handle regular parameter: type name
      const regularMatch = trimmed.match(/^(.+?)\s+(\w+)$/);
      if (regularMatch) {
        return {
          name: regularMatch[2],
          type: regularMatch[1].trim(),
          optional: false
        };
      }
      
      // Handle type-only parameter (in function declarations)
      return {
        name: 'param',
        type: trimmed,
        optional: false
      };
    }).filter(p => p !== null) as Parameter[];
  }

  /**
   * Parse class methods
   */
  private async parseClassMethods(classCode: string, filePath: string, className: string): Promise<CodeFunction[]> {
    const methods: CodeFunction[] = [];
    const methodRegex = /^(\s*)(public|private|protected)?\s*:?\s*(?:(virtual|static|inline|explicit)\s+)*(?:(\w+(?:::\w+)*)\s+)?(\w+|~\w+)\s*\(([^)]*)\)(?:\s*(const|volatile|noexcept|override|final))*\s*(?::\s*[^{]*)?(?:\s*\{|;)/gm;
    let match;

    while ((match = methodRegex.exec(classCode)) !== null) {
      const [fullMatch, , visibility, , returnType, name, params, ] = match;
      const startLine = this.getLineNumber(classCode, match.index);
      
      // Skip if this looks like a class declaration line
      if (name === className) continue;
      
      let endLine = startLine;
      if (fullMatch.endsWith('{')) {
        endLine = this.findBlockEnd(classCode, match.index + fullMatch.length - 1, classCode.split('\n'));
      }
      
      const parameters = this.parseCppParameters(params);
      const isConstructor = name === className;
      const isDestructor = name.startsWith('~');
      // const isStatic = modifiers?.includes('static') || false;
      // const isVirtual = modifiers?.includes('virtual') || false;
      
      let complexity = 1;
      if (fullMatch.endsWith('{')) {
        const methodCode = classCode.split('\n').slice(startLine - 1, endLine).join('\n');
        const complexityMetrics = await this.calculateFunctionComplexity(methodCode);
        complexity = complexityMetrics.cyclomaticComplexity;
      }

      methods.push({
        id: this.generateId(),
        name,
        parameters,
        returnType: isConstructor || isDestructor ? 'void' : (returnType?.trim() || 'void'),
        complexity,
        startLine,
        endLine,
        filePath,
        isAsync: false,
        isExported: visibility !== 'private',
        visibility: (visibility as 'public' | 'private' | 'protected') || 'private',
        dependencies: [],
        calls: fullMatch.endsWith('{') ? this.extractFunctionCalls(classCode.split('\n').slice(startLine - 1, endLine).join('\n')) : []
      });
    }

    return methods;
  }

  /**
   * Parse class properties
   */
  private parseClassProperties(classCode: string): ClassProperty[] {
    const properties: ClassProperty[] = [];
    const propertyRegex = /^(\s*)(public|private|protected)?\s*:?\s*(?:(static|const|mutable)\s+)*(\w+(?:::\w+)*(?:\s*[*&]+)?)\s+(\w+)(?:\s*=\s*[^;]+)?\s*;/gm;
    let match;

    while ((match = propertyRegex.exec(classCode)) !== null) {
      const [, , visibility, modifiers, type, name] = match;
      const isStatic = modifiers?.includes('static') || false;
      const isConst = modifiers?.includes('const') || false;
      // const isMutable = modifiers?.includes('mutable') || false;
      
      properties.push({
        name,
        type: type.trim(),
        visibility: (visibility as 'public' | 'private' | 'protected') || 'private',
        isStatic,
        isReadonly: isConst,
        defaultValue: undefined
      });
    }

    return properties;
  }

  /**
   * Check if class is abstract (has pure virtual functions)
   */
  private isAbstractClass(classCode: string): boolean {
    return /virtual\s+\w+.*=\s*0\s*;/.test(classCode);
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
      if (functionName && !['if', 'while', 'for', 'switch', 'catch', 'sizeof', 'typeof'].includes(functionName)) {
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
    
    // C++ specific complexity patterns
    const complexityPatterns = [
      /\bif\b/g,           // if statements
      /\belse\s+if\b/g,    // else if
      /\bwhile\b/g,        // while loops
      /\bfor\b/g,          // for loops
      /\bdo\b/g,           // do-while loops
      /\bswitch\b/g,       // switch statements
      /\bcase\b/g,         // case labels
      /\bcatch\b/g,        // exception handling
      /&&|\|\|/g,          // logical operators
      /\?.*:/g,            // ternary operators
    ];

    complexityPatterns.forEach((pattern, index) => {
      const matches = code.match(pattern) || [];
      if (index === 6) { // case labels
        cyclomaticComplexity += Math.max(0, matches.length - 1);
        cognitiveComplexity += matches.length;
      } else {
        cyclomaticComplexity += matches.length;
        cognitiveComplexity += matches.length;
      }
    });

    const linesOfCode = code.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
    }).length;
    
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