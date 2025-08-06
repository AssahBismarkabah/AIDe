/**
 * Go AST Analyzer
 * Implements AST analysis for Go files using regex-based parsing
 */

import { BaseAnalyzer } from './BaseAnalyzer';
import {
  AnalysisContext,
  ASTNode,
  CodeFunction,
  CodeClass,
  ImportDeclaration,
  ExportDeclaration,
  ComplexityMetrics,
  Parameter,
  ClassProperty,
  // ImportSpecifier,
  ParserConfig
} from './types';

export class GoAnalyzer extends BaseAnalyzer {
  constructor() {
    super('go');
  }

  protected async parseAST(content: string, _context: AnalysisContext): Promise<any> {
    try {
      return this.parseGoWithRegex(content);
    } catch (error) {
      throw new Error(`Failed to parse Go AST: ${error}`);
    }
  }

  protected async extractNodes(ast: any, context: AnalysisContext): Promise<ASTNode[]> {
    const nodes: ASTNode[] = [];
    
    // Extract package declaration
    if (ast.packageDeclaration) {
      nodes.push({
        id: this.generateId(),
        type: 'PackageDeclaration',
        name: ast.packageDeclaration.name,
        startLine: ast.packageDeclaration.line,
        endLine: ast.packageDeclaration.line,
        startColumn: 0,
        endColumn: 0,
        filePath: context.filePath,
        parent: undefined,
        children: [],
        properties: { packageName: ast.packageDeclaration.name }
      });
    }
    
    // Extract import declarations
    for (const imp of ast.imports || []) {
      nodes.push({
        id: this.generateId(),
        type: 'ImportDeclaration',
        name: imp.path,
        startLine: imp.line,
        endLine: imp.line,
        startColumn: 0,
        endColumn: 0,
        filePath: context.filePath,
        parent: undefined,
        children: [],
        properties: { importPath: imp.path, alias: imp.alias }
      });
    }
    
    // Extract function declarations
    for (const func of ast.functions || []) {
      nodes.push({
        id: this.generateId(),
        type: 'FunctionDeclaration',
        name: func.name,
        startLine: func.startLine,
        endLine: func.endLine,
        startColumn: 0,
        endColumn: 0,
        filePath: context.filePath,
        parent: undefined,
        children: [],
        properties: {
          parameters: func.parameters,
          returnTypes: func.returnTypes,
          receiver: func.receiver
        }
      });
    }
    
    // Extract struct declarations (Go's equivalent to classes)
    for (const struct of ast.structs || []) {
      const structNode: ASTNode = {
        id: this.generateId(),
        type: 'StructDeclaration',
        name: struct.name,
        startLine: struct.startLine,
        endLine: struct.endLine,
        startColumn: 0,
        endColumn: 0,
        filePath: context.filePath,
        parent: undefined,
        children: [],
        properties: { fields: struct.fields }
      };
      nodes.push(structNode);
      
      // Extract struct fields
      for (const field of struct.fields || []) {
        nodes.push({
          id: this.generateId(),
          type: 'FieldDeclaration',
          name: field.name,
          startLine: field.line,
          endLine: field.line,
          startColumn: 0,
          endColumn: 0,
          filePath: context.filePath,
          parent: structNode.id,
          children: [],
          properties: { type: field.type, tags: field.tags }
        });
      }
    }
    
    // Extract interface declarations
    for (const iface of ast.interfaces || []) {
      const interfaceNode: ASTNode = {
        id: this.generateId(),
        type: 'InterfaceDeclaration',
        name: iface.name,
        startLine: iface.startLine,
        endLine: iface.endLine,
        startColumn: 0,
        endColumn: 0,
        filePath: context.filePath,
        parent: undefined,
        children: [],
        properties: { methods: iface.methods }
      };
      nodes.push(interfaceNode);
    }
    
    return nodes;
  }

  protected async extractFunctions(ast: any, context: AnalysisContext): Promise<CodeFunction[]> {
    const functions: CodeFunction[] = [];
    
    for (const func of ast.functions || []) {
      const goFunc: CodeFunction = {
        id: this.generateId(),
        name: func.name,
        parameters: this.extractGoParameters(func.parameters || []),
        returnType: func.returnTypes ? func.returnTypes.join(', ') : undefined,
        complexity: this.calculateGoFunctionComplexity(func),
        startLine: func.startLine,
        endLine: func.endLine,
        filePath: context.filePath,
        isAsync: false, // Go uses goroutines, not async/await
        isExported: this.isGoExported(func.name),
        visibility: this.isGoExported(func.name) ? 'public' : 'private',
        dependencies: this.extractGoFunctionDependencies(func),
        calls: this.extractGoFunctionCalls(func)
      };
      
      functions.push(goFunc);
    }
    
    return functions;
  }

  protected async extractClasses(ast: any, context: AnalysisContext): Promise<CodeClass[]> {
    const classes: CodeClass[] = [];
    
    // In Go, structs are the closest equivalent to classes
    for (const struct of ast.structs || []) {
      const structClass: CodeClass = {
        id: this.generateId(),
        name: struct.name,
        methods: this.extractGoStructMethods(ast.functions || [], struct.name),
        properties: this.extractGoStructProperties(struct),
        extends: undefined, // Go doesn't have inheritance
        implements: this.extractGoStructInterfaces(ast.interfaces || [], struct.name),
        startLine: struct.startLine,
        endLine: struct.endLine,
        filePath: context.filePath,
        isExported: this.isGoExported(struct.name),
        visibility: this.isGoExported(struct.name) ? 'public' : 'private',
        isAbstract: false // Go doesn't have abstract structs
      };
      
      classes.push(structClass);
    }
    
    return classes;
  }

  protected async extractImports(ast: any, context: AnalysisContext): Promise<ImportDeclaration[]> {
    const imports: ImportDeclaration[] = [];
    
    for (const imp of ast.imports || []) {
      const importDecl: ImportDeclaration = {
        id: this.generateId(),
        source: imp.path,
        imports: [{
          name: imp.alias || this.getGoPackageName(imp.path),
          alias: imp.alias || undefined,
          isDefault: false,
          isNamespace: true
        }],
        filePath: context.filePath,
        startLine: imp.line,
        endLine: imp.line
      };
      
      imports.push(importDecl);
    }
    
    return imports;
  }

  protected async extractExports(ast: any, context: AnalysisContext): Promise<ExportDeclaration[]> {
    const exports: ExportDeclaration[] = [];
    
    // In Go, exported items start with capital letters
    
    // Exported functions
    for (const func of ast.functions || []) {
      if (this.isGoExported(func.name)) {
        exports.push({
          id: this.generateId(),
          name: func.name,
          type: 'function',
          isDefault: false,
          filePath: context.filePath,
          startLine: func.startLine,
          endLine: func.endLine
        });
      }
    }
    
    // Exported structs
    for (const struct of ast.structs || []) {
      if (this.isGoExported(struct.name)) {
        exports.push({
          id: this.generateId(),
          name: struct.name,
          type: 'class',
          isDefault: false,
          filePath: context.filePath,
          startLine: struct.startLine,
          endLine: struct.endLine
        });
      }
    }
    
    // Exported interfaces
    for (const iface of ast.interfaces || []) {
      if (this.isGoExported(iface.name)) {
        exports.push({
          id: this.generateId(),
          name: iface.name,
          type: 'interface',
          isDefault: false,
          filePath: context.filePath,
          startLine: iface.startLine,
          endLine: iface.endLine
        });
      }
    }
    
    return exports;
  }

  protected async extractDependencies(ast: any, _context: AnalysisContext): Promise<string[]> {
    const dependencies = new Set<string>();
    
    // Add imports as dependencies
    for (const imp of ast.imports || []) {
      const packageName = this.getGoPackageName(imp.path);
      dependencies.add(packageName);
    }
    
    return Array.from(dependencies);
  }

  protected async calculateComplexity(ast: any, _context: AnalysisContext): Promise<ComplexityMetrics> {
    let cyclomaticComplexity = 1;
    let cognitiveComplexity = 0;
    let linesOfCode = 0;
    
    for (const func of ast.functions || []) {
      cyclomaticComplexity += this.calculateGoFunctionComplexity(func);
      cognitiveComplexity += this.calculateGoCognitiveComplexity(func);
      linesOfCode += func.endLine - func.startLine + 1;
    }
    
    const maintainabilityIndex = Math.max(0, 171 - 5.2 * Math.log(linesOfCode) - 0.23 * cyclomaticComplexity);
    const technicalDebt = Math.max(0, (cyclomaticComplexity - 10) * 0.5 + (cognitiveComplexity - 15) * 0.3);
    
    return {
      cyclomaticComplexity,
      cognitiveComplexity,
      linesOfCode,
      maintainabilityIndex,
      technicalDebt
    };
  }

  protected getParserConfig(): ParserConfig {
    return {
      language: 'go',
      sourceType: 'module',
      allowImportExportEverywhere: false,
      allowReturnOutsideFunction: false,
      strictMode: true,
      plugins: []
    };
  }

  // Helper methods
  private parseGoWithRegex(content: string): any {
    const result: any = {
      packageDeclaration: null,
      imports: [],
      functions: [],
      structs: [],
      interfaces: []
    };
    
    // Parse package declaration
    const packageMatch = content.match(/package\s+(\w+)/);
    if (packageMatch) {
      result.packageDeclaration = {
        name: packageMatch[1],
        line: this.findLineNumber(content, packageMatch.index || 0)
      };
    }
    
    // Parse imports
    const importRegex = /import\s+(?:(\w+)\s+)?"([^"]+)"/g;
    let importMatch;
    while ((importMatch = importRegex.exec(content)) !== null) {
      result.imports.push({
        path: importMatch[2],
        alias: importMatch[1] || null,
        line: this.findLineNumber(content, importMatch.index)
      });
    }
    
    // Parse import blocks
    const importBlockRegex = /import\s*\(\s*([\s\S]*?)\s*\)/g;
    let importBlockMatch;
    while ((importBlockMatch = importBlockRegex.exec(content)) !== null) {
      const importBlock = importBlockMatch[1];
      const importLineRegex = /(?:(\w+)\s+)?"([^"]+)"/g;
      let importLineMatch;
      while ((importLineMatch = importLineRegex.exec(importBlock)) !== null) {
        result.imports.push({
          path: importLineMatch[2],
          alias: importLineMatch[1] || null,
          line: this.findLineNumber(content, importBlockMatch.index + importLineMatch.index)
        });
      }
    }
    
    // Parse functions
    const funcRegex = /func\s+(?:\(([^)]*)\)\s+)?(\w+)\s*\(([^)]*)\)\s*(?:\(([^)]*)\)|(\w+(?:\[\])*))?\s*\{/g;
    let funcMatch;
    while ((funcMatch = funcRegex.exec(content)) !== null) {
      const receiver = funcMatch[1];
      const name = funcMatch[2];
      const params = funcMatch[3];
      const returnTypes = funcMatch[4] || funcMatch[5];
      
      const startLine = this.findLineNumber(content, funcMatch.index);
      const endLine = this.findGoFunctionEndLine(content, funcMatch.index);
      
      result.functions.push({
        name,
        receiver,
        parameters: this.parseGoParameters(params),
        returnTypes: returnTypes ? this.parseGoReturnTypes(returnTypes) : [],
        startLine,
        endLine,
        body: this.extractGoFunctionBody(content, funcMatch.index)
      });
    }
    
    // Parse structs
    const structRegex = /type\s+(\w+)\s+struct\s*\{([^}]*)\}/g;
    let structMatch;
    while ((structMatch = structRegex.exec(content)) !== null) {
      const name = structMatch[1];
      const fieldsStr = structMatch[2];
      
      result.structs.push({
        name,
        startLine: this.findLineNumber(content, structMatch.index),
        endLine: this.findLineNumber(content, structMatch.index + structMatch[0].length),
        fields: this.parseGoStructFields(fieldsStr)
      });
    }
    
    // Parse interfaces
    const interfaceRegex = /type\s+(\w+)\s+interface\s*\{([^}]*)\}/g;
    let interfaceMatch;
    while ((interfaceMatch = interfaceRegex.exec(content)) !== null) {
      const name = interfaceMatch[1];
      const methodsStr = interfaceMatch[2];
      
      result.interfaces.push({
        name,
        startLine: this.findLineNumber(content, interfaceMatch.index),
        endLine: this.findLineNumber(content, interfaceMatch.index + interfaceMatch[0].length),
        methods: this.parseGoInterfaceMethods(methodsStr)
      });
    }
    
    return result;
  }

  private findLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private findGoFunctionEndLine(content: string, startIndex: number): number {
    let braceCount = 0;
    let inString = false;
    let inComment = false;
    
    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];
      const nextChar = content[i + 1];
      
      if (!inString && !inComment) {
        if (char === '/' && nextChar === '/') {
          inComment = true;
          continue;
        }
        if (char === '/' && nextChar === '*') {
          inComment = true;
          continue;
        }
        if (char === '"' || char === '`') {
          inString = true;
          continue;
        }
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            return this.findLineNumber(content, i);
          }
        }
      } else if (inString && (char === '"' || char === '`') && content[i - 1] !== '\\') {
        inString = false;
      } else if (inComment && char === '\n') {
        inComment = false;
      } else if (inComment && char === '*' && nextChar === '/') {
        inComment = false;
        i++; // Skip the '/'
      }
    }
    
    return this.findLineNumber(content, content.length);
  }

  private parseGoParameters(paramStr: string): any[] {
    if (!paramStr.trim()) return [];
    
    const params: any[] = [];
    const paramParts = paramStr.split(',').map(p => p.trim());
    
    for (const part of paramParts) {
      const match = part.match(/(\w+)\s+(.+)/);
      if (match) {
        params.push({
          name: match[1],
          type: match[2]
        });
      }
    }
    
    return params;
  }

  private parseGoReturnTypes(returnStr: string): string[] {
    if (!returnStr.trim()) return [];
    
    // Handle multiple return types in parentheses
    if (returnStr.startsWith('(') && returnStr.endsWith(')')) {
      return returnStr.slice(1, -1).split(',').map(t => t.trim());
    }
    
    return [returnStr.trim()];
  }

  private parseGoStructFields(fieldsStr: string): any[] {
    const fields: any[] = [];
    const lines = fieldsStr.split('\n').map(l => l.trim()).filter(l => l);
    
    for (const line of lines) {
      const match = line.match(/(\w+)\s+(.+?)(?:\s+`([^`]*)`)?/);
      if (match) {
        fields.push({
          name: match[1],
          type: match[2],
          tags: match[3] || null,
          line: 0 // Line numbers extracted from regex parsing context
        });
      }
    }
    
    return fields;
  }

  private parseGoInterfaceMethods(methodsStr: string): any[] {
    const methods: any[] = [];
    const lines = methodsStr.split('\n').map(l => l.trim()).filter(l => l);
    
    for (const line of lines) {
      const match = line.match(/(\w+)\s*\(([^)]*)\)\s*(.+)?/);
      if (match) {
        methods.push({
          name: match[1],
          parameters: match[2],
          returnType: match[3] || null
        });
      }
    }
    
    return methods;
  }

  private extractGoFunctionBody(content: string, startIndex: number): string {
    const braceIndex = content.indexOf('{', startIndex);
    if (braceIndex === -1) return '';
    
    let braceCount = 1;
    let i = braceIndex + 1;
    
    while (i < content.length && braceCount > 0) {
      if (content[i] === '{') braceCount++;
      else if (content[i] === '}') braceCount--;
      i++;
    }
    
    return content.substring(braceIndex + 1, i - 1);
  }

  private extractGoParameters(goParams: any[]): Parameter[] {
    return goParams.map(param => ({
      name: param.name,
      type: param.type || undefined,
      optional: false,
      defaultValue: undefined
    }));
  }

  private calculateGoFunctionComplexity(func: any): number {
    if (!func.body) return 1;
    
    let complexity = 1;
    const body = func.body;
    
    // Count decision points
    complexity += (body.match(/\bif\b/g) || []).length;
    complexity += (body.match(/\belse\b/g) || []).length;
    complexity += (body.match(/\bfor\b/g) || []).length;
    complexity += (body.match(/\bswitch\b/g) || []).length;
    complexity += (body.match(/\bcase\b/g) || []).length;
    complexity += (body.match(/\bselect\b/g) || []).length; // Go-specific
    
    return complexity;
  }

  private calculateGoCognitiveComplexity(func: any): number {
    // Calculate cognitive complexity using established 0.8 multiplier for Go
    return Math.floor(this.calculateGoFunctionComplexity(func) * 0.8);
  }

  private isGoExported(name: string): boolean {
    // In Go, exported identifiers start with capital letters
    return name.length > 0 && name[0] === name[0].toUpperCase();
  }

  private getGoPackageName(importPath: string): string {
    const parts = importPath.split('/');
    return parts[parts.length - 1];
  }

  private extractGoStructMethods(functions: any[], structName: string): CodeFunction[] {
    // Find methods that have this struct as receiver
    return functions
      .filter(func => func.receiver && func.receiver.includes(structName))
      .map(func => ({
        id: this.generateId(),
        name: func.name,
        parameters: this.extractGoParameters(func.parameters || []),
        returnType: func.returnTypes ? func.returnTypes.join(', ') : undefined,
        complexity: this.calculateGoFunctionComplexity(func),
        startLine: func.startLine,
        endLine: func.endLine,
        filePath: '',
        isAsync: false,
        isExported: this.isGoExported(func.name),
        visibility: this.isGoExported(func.name) ? 'public' : 'private',
        dependencies: [],
        calls: []
      }));
  }

  private extractGoStructProperties(struct: any): ClassProperty[] {
    return (struct.fields || []).map((field: any) => ({
      name: field.name,
      type: field.type || undefined,
      visibility: this.isGoExported(field.name) ? 'public' : 'private',
      isStatic: false,
      isReadonly: false,
      defaultValue: undefined
    }));
  }

  private extractGoStructInterfaces(_interfaces: any[], _structName: string): string[] {
    // Go uses implicit interface satisfaction, so this is complex to determine statically
    return [];
  }

  private extractGoFunctionDependencies(func: any): string[] {
    if (!func.body) return [];
    
    const dependencies = new Set<string>();
    const body = func.body;
    
    // Extract package references (simplified)
    const packageMatches = body.match(/\b\w+\.\w+/g) || [];
    packageMatches.forEach((match: string) => {
      const packageName = match.split('.')[0];
      dependencies.add(packageName);
    });
    
    return Array.from(dependencies);
  }

  private extractGoFunctionCalls(func: any): string[] {
    if (!func.body) return [];
    
    const calls = new Set<string>();
    const body = func.body;
    
    // Extract function calls (simplified)
    const callMatches = body.match(/\b\w+\s*\(/g) || [];
    callMatches.forEach((match: string) => {
      const functionName = match.replace(/\s*\($/, '');
      calls.add(functionName);
    });
    
    return Array.from(calls);
  }
}