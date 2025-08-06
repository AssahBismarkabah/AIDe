/**
 * TypeScript/JavaScript AST Analyzer
 * Implements AST analysis for TypeScript and JavaScript files
 */

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
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
  ImportSpecifier,
  ParserConfig
} from './types';

export class TypeScriptAnalyzer extends BaseAnalyzer {
  constructor() {
    super('typescript');
  }

  protected async parseAST(content: string, _context: AnalysisContext): Promise<any> {
    try {
      return parse(content, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: false,
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'functionBind',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport',
          'nullishCoalescingOperator',
          'optionalChaining'
        ]
      });
    } catch (error) {
      throw new Error(`Failed to parse TypeScript/JavaScript: ${error}`);
    }
  }

  protected async extractNodes(ast: any, context: AnalysisContext): Promise<ASTNode[]> {
    const nodes: ASTNode[] = [];

    traverse(ast, {
      enter: (path) => {
        const node = path.node;
        if (!node.loc) return;

        const astNode: ASTNode = {
          id: this.generateId(),
          type: node.type,
          name: this.getNodeName(node),
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          startColumn: node.loc.start.column,
          endColumn: node.loc.end.column,
          filePath: context.filePath,
          parent: path.parent ? this.generateId() : undefined,
          children: [],
          properties: this.extractNodeProperties(node)
        };

        nodes.push(astNode);
      }
    });

    return nodes;
  }

  protected async extractFunctions(ast: any, context: AnalysisContext): Promise<CodeFunction[]> {
    const functions: CodeFunction[] = [];

    traverse(ast, {
      FunctionDeclaration: (path) => {
        const node = path.node;
        if (!node.loc) return;

        const func: CodeFunction = {
          id: this.generateId(),
          name: node.id?.name || 'anonymous',
          parameters: this.extractParameters(node.params),
          returnType: this.extractReturnType(node) || undefined,
          complexity: this.calculateFunctionComplexity(path),
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          filePath: context.filePath,
          isAsync: node.async || false,
          isExported: this.isExported(path),
          visibility: 'public',
          dependencies: this.extractFunctionDependencies(path),
          calls: this.extractFunctionCalls(path)
        };

        functions.push(func);
      },

      ArrowFunctionExpression: (path) => {
        const node = path.node;
        if (!node.loc) return;

        // Only include named arrow functions or those assigned to variables
        const name = this.getArrowFunctionName(path);
        if (!name) return;

        const func: CodeFunction = {
          id: this.generateId(),
          name,
          parameters: this.extractParameters(node.params),
          returnType: this.extractReturnType(node) || undefined,
          complexity: this.calculateFunctionComplexity(path),
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          filePath: context.filePath,
          isAsync: node.async || false,
          isExported: this.isExported(path),
          visibility: 'public',
          dependencies: this.extractFunctionDependencies(path),
          calls: this.extractFunctionCalls(path)
        };

        functions.push(func);
      },

      ClassMethod: (path) => {
        const node = path.node;
        if (!node.loc || !t.isIdentifier(node.key)) return;

        const func: CodeFunction = {
          id: this.generateId(),
          name: node.key.name,
          parameters: this.extractParameters(node.params || []),
          returnType: this.extractReturnType(node) || undefined,
          complexity: this.calculateFunctionComplexity(path),
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          filePath: context.filePath,
          isAsync: node.async || false,
          isExported: false,
          visibility: this.getMethodVisibility(node),
          dependencies: this.extractFunctionDependencies(path),
          calls: this.extractFunctionCalls(path)
        };

        functions.push(func);
      }
    });

    return functions;
  }

  protected async extractClasses(ast: any, context: AnalysisContext): Promise<CodeClass[]> {
    const classes: CodeClass[] = [];

    traverse(ast, {
      ClassDeclaration: (path) => {
        const node = path.node;
        if (!node.loc) return;

        const cls: CodeClass = {
          id: this.generateId(),
          name: node.id?.name || 'anonymous',
          methods: [],
          properties: this.extractClassProperties(node),
          extends: node.superClass && t.isIdentifier(node.superClass) ? node.superClass.name : undefined,
          implements: this.extractImplements(node),
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          filePath: context.filePath,
          isExported: this.isExported(path),
          visibility: 'public',
          isAbstract: this.isAbstractClass(node)
        };

        // Extract methods (handled separately in extractFunctions)
        classes.push(cls);
      }
    });

    return classes;
  }

  protected async extractImports(ast: any, context: AnalysisContext): Promise<ImportDeclaration[]> {
    const imports: ImportDeclaration[] = [];

    traverse(ast, {
      ImportDeclaration: (path) => {
        const node = path.node;
        if (!node.loc) return;

        const importDecl: ImportDeclaration = {
          id: this.generateId(),
          source: node.source.value,
          imports: this.extractImportSpecifiers(node.specifiers),
          filePath: context.filePath,
          startLine: node.loc.start.line,
          endLine: node.loc.end.line
        };

        imports.push(importDecl);
      }
    });

    return imports;
  }

  protected async extractExports(ast: any, context: AnalysisContext): Promise<ExportDeclaration[]> {
    const exports: ExportDeclaration[] = [];

    traverse(ast, {
      ExportNamedDeclaration: (path) => {
        const node = path.node;
        if (!node.loc) return;

        if (node.declaration) {
          const exportDecl = this.createExportFromDeclaration(node.declaration, context, node.loc);
          if (exportDecl) exports.push(exportDecl);
        }

        // Handle export { name } from 'module'
        if (node.specifiers) {
          for (const spec of node.specifiers) {
            if (t.isExportSpecifier(spec) && t.isIdentifier(spec.exported)) {
              exports.push({
                id: this.generateId(),
                name: spec.exported.name,
                type: 'variable',
                isDefault: false,
                filePath: context.filePath,
                startLine: node.loc.start.line,
                endLine: node.loc.end.line
              });
            }
          }
        }
      },

      ExportDefaultDeclaration: (path) => {
        const node = path.node;
        if (!node.loc) return;

        const name = this.getDefaultExportName(node.declaration);
        exports.push({
          id: this.generateId(),
          name,
          type: this.getExportType(node.declaration),
          isDefault: true,
          filePath: context.filePath,
          startLine: node.loc.start.line,
          endLine: node.loc.end.line
        });
      }
    });

    return exports;
  }

  protected async extractDependencies(ast: any, _context: AnalysisContext): Promise<string[]> {
    const dependencies = new Set<string>();

    traverse(ast, {
      ImportDeclaration: (path) => {
        dependencies.add(path.node.source.value);
      },
      CallExpression: (path) => {
        // Handle require() calls
        if (t.isIdentifier(path.node.callee) && path.node.callee.name === 'require') {
          const arg = path.node.arguments[0];
          if (t.isStringLiteral(arg)) {
            dependencies.add(arg.value);
          }
        }
      }
    });

    return Array.from(dependencies);
  }

  protected async calculateComplexity(ast: any, _context: AnalysisContext): Promise<ComplexityMetrics> {
    let cyclomaticComplexity = 1; // Base complexity
    let cognitiveComplexity = 0;
    let linesOfCode = 0;

    traverse(ast, {
      enter: (path) => {
        const node = path.node;

        // Cyclomatic complexity
        if (this.isComplexityNode(node)) {
          cyclomaticComplexity++;
        }

        // Cognitive complexity (simplified)
        if (this.isCognitiveComplexityNode(node)) {
          cognitiveComplexity += this.getCognitiveComplexityWeight(node, path.getFunctionParent()?.node);
        }

        // Lines of code
        if (node.loc) {
          linesOfCode = Math.max(linesOfCode, node.loc.end.line);
        }
      }
    });

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
      language: 'typescript',
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: false,
      strictMode: false,
      plugins: [
        'typescript',
        'jsx',
        'decorators-legacy',
        'classProperties',
        'objectRestSpread',
        'functionBind',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'dynamicImport',
        'nullishCoalescingOperator',
        'optionalChaining'
      ]
    };
  }

  // Helper methods
  private getNodeName(node: any): string | undefined {
    if (t.isIdentifier(node)) return node.name;
    if (t.isFunctionDeclaration(node) && node.id) return node.id.name;
    if (t.isClassDeclaration(node) && node.id) return node.id.name;
    if (t.isVariableDeclarator(node) && t.isIdentifier(node.id)) return node.id.name;
    return undefined;
  }

  private extractNodeProperties(node: any): Record<string, any> {
    const properties: Record<string, any> = {};
    
    if (t.isFunction(node)) {
      properties.async = node.async;
      properties.generator = node.generator;
    }
    
    if (t.isClass(node)) {
      properties.abstract = (node as any).abstract;
    }
    
    return properties;
  }

  private extractParameters(params: any[]): Parameter[] {
    return params.map(param => {
      if (t.isIdentifier(param)) {
        return {
          name: param.name,
          type: param.typeAnnotation ? this.extractTypeAnnotation(param.typeAnnotation) : undefined,
          optional: false,
          defaultValue: undefined
        };
      }
      
      if (t.isAssignmentPattern(param) && t.isIdentifier(param.left)) {
        return {
          name: param.left.name,
          type: param.left.typeAnnotation ? this.extractTypeAnnotation(param.left.typeAnnotation) : undefined,
          optional: true,
          defaultValue: this.extractDefaultValue(param.right)
        };
      }
      
      return {
        name: 'unknown',
        type: undefined,
        optional: false,
        defaultValue: undefined
      };
    });
  }

  private extractReturnType(node: any): string | undefined {
    if (node.returnType) {
      return this.extractTypeAnnotation(node.returnType);
    }
    return undefined;
  }

  private extractTypeAnnotation(typeAnnotation: any): string {
    // Extract TypeScript type annotations from AST nodes
    if (typeAnnotation.typeAnnotation) {
      const type = typeAnnotation.typeAnnotation;
      if (t.isTSStringKeyword(type)) return 'string';
      if (t.isTSNumberKeyword(type)) return 'number';
      if (t.isTSBooleanKeyword(type)) return 'boolean';
      if (t.isTSTypeReference(type) && t.isIdentifier(type.typeName)) {
        return type.typeName.name;
      }
    }
    return 'any';
  }

  private extractDefaultValue(node: any): string {
    if (t.isStringLiteral(node)) return `"${node.value}"`;
    if (t.isNumericLiteral(node)) return node.value.toString();
    if (t.isBooleanLiteral(node)) return node.value.toString();
    if (t.isNullLiteral(node)) return 'null';
    return 'unknown';
  }

  private calculateFunctionComplexity(path: any): number {
    let complexity = 1;
    
    path.traverse({
      IfStatement: () => { complexity++; },
      ConditionalExpression: () => { complexity++; },
      LogicalExpression: () => { complexity++; },
      SwitchCase: () => { complexity++; },
      WhileStatement: () => { complexity++; },
      DoWhileStatement: () => { complexity++; },
      ForStatement: () => { complexity++; },
      ForInStatement: () => { complexity++; },
      ForOfStatement: () => { complexity++; }
    });
    
    return complexity;
  }

  private isExported(path: any): boolean {
    let currentPath = path;
    const visited = new Set();
    
    while (currentPath && currentPath.parent) {
      // Prevent infinite loops
      const pathKey = currentPath.toString();
      if (visited.has(pathKey)) {
        break;
      }
      visited.add(pathKey);
      
      if (t.isExportNamedDeclaration(currentPath.parent) || t.isExportDefaultDeclaration(currentPath.parent)) {
        return true;
      }
      currentPath = currentPath.parentPath;
    }
    return false;
  }

  private getMethodVisibility(node: any): 'public' | 'private' | 'protected' {
    // TypeScript specific visibility
    if (node.accessibility) {
      return node.accessibility;
    }
    return 'public';
  }

  private getArrowFunctionName(path: any): string | undefined {
    const parent = path.parent;
    if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
      return parent.id.name;
    }
    if (t.isAssignmentExpression(parent) && t.isIdentifier(parent.left)) {
      return parent.left.name;
    }
    return undefined;
  }

  private extractClassProperties(node: any): ClassProperty[] {
    const properties: ClassProperty[] = [];
    
    if (node.body && node.body.body) {
      for (const member of node.body.body) {
        if (t.isClassProperty(member) && t.isIdentifier(member.key)) {
          properties.push({
            name: member.key.name,
            type: member.typeAnnotation ? this.extractTypeAnnotation(member.typeAnnotation) : undefined,
            visibility: (member as any).accessibility || 'public',
            isStatic: member.static || false,
            isReadonly: (member as any).readonly || false,
            defaultValue: member.value ? this.extractDefaultValue(member.value) : undefined
          });
        }
      }
    }
    
    return properties;
  }

  private extractImplements(node: any): string[] {
    if (node.implements) {
      return node.implements.map((impl: any) => {
        if (t.isIdentifier(impl.id)) return impl.id.name;
        return 'unknown';
      });
    }
    return [];
  }

  private isAbstractClass(node: any): boolean {
    return node.abstract || false;
  }

  private extractImportSpecifiers(specifiers: any[]): ImportSpecifier[] {
    return specifiers.map(spec => {
      if (t.isImportDefaultSpecifier(spec)) {
        return {
          name: spec.local.name,
          alias: undefined,
          isDefault: true,
          isNamespace: false
        };
      }
      
      if (t.isImportNamespaceSpecifier(spec)) {
        return {
          name: spec.local.name,
          alias: undefined,
          isDefault: false,
          isNamespace: true
        };
      }
      
      if (t.isImportSpecifier(spec)) {
        const importedName = t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value;
        return {
          name: importedName,
          alias: spec.local.name !== importedName ? spec.local.name : undefined,
          isDefault: false,
          isNamespace: false
        };
      }
      
      return {
        name: 'unknown',
        alias: undefined,
        isDefault: false,
        isNamespace: false
      };
    });
  }

  private createExportFromDeclaration(declaration: any, context: AnalysisContext, loc: any): ExportDeclaration | null {
    if (t.isFunctionDeclaration(declaration) && declaration.id) {
      return {
        id: this.generateId(),
        name: declaration.id.name,
        type: 'function',
        isDefault: false,
        filePath: context.filePath,
        startLine: loc.start.line,
        endLine: loc.end.line
      };
    }
    
    if (t.isClassDeclaration(declaration) && declaration.id) {
      return {
        id: this.generateId(),
        name: declaration.id.name,
        type: 'class',
        isDefault: false,
        filePath: context.filePath,
        startLine: loc.start.line,
        endLine: loc.end.line
      };
    }
    
    return null;
  }

  private getDefaultExportName(declaration: any): string {
    if (t.isIdentifier(declaration)) return declaration.name;
    if (t.isFunctionDeclaration(declaration) && declaration.id) return declaration.id.name;
    if (t.isClassDeclaration(declaration) && declaration.id) return declaration.id.name;
    return 'default';
  }

  private getExportType(declaration: any): 'function' | 'class' | 'variable' | 'type' | 'interface' {
    if (t.isFunction(declaration)) return 'function';
    if (t.isClass(declaration)) return 'class';
    if (t.isTSInterfaceDeclaration(declaration)) return 'interface';
    if (t.isTSTypeAliasDeclaration(declaration)) return 'type';
    return 'variable';
  }

  private extractFunctionDependencies(path: any): string[] {
    const dependencies = new Set<string>();
    
    path.traverse({
      Identifier: (identifierPath: any) => {
        if (identifierPath.isReferencedIdentifier()) {
          dependencies.add(identifierPath.node.name);
        }
      }
    });
    
    return Array.from(dependencies);
  }

  private extractFunctionCalls(path: any): string[] {
    const calls = new Set<string>();
    
    path.traverse({
      CallExpression: (callPath: any) => {
        const callee = callPath.node.callee;
        if (t.isIdentifier(callee)) {
          calls.add(callee.name);
        } else if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
          calls.add(callee.property.name);
        }
      }
    });
    
    return Array.from(calls);
  }

  private isComplexityNode(node: any): boolean {
    return t.isIfStatement(node) ||
           t.isConditionalExpression(node) ||
           t.isLogicalExpression(node) ||
           t.isSwitchCase(node) ||
           t.isWhileStatement(node) ||
           t.isDoWhileStatement(node) ||
           t.isForStatement(node) ||
           t.isForInStatement(node) ||
           t.isForOfStatement(node);
  }

  private isCognitiveComplexityNode(node: any): boolean {
    return this.isComplexityNode(node) ||
           t.isTryStatement(node) ||
           t.isCatchClause(node);
  }

  private getCognitiveComplexityWeight(node: any, _functionParent: any): number {
    // Calculate cognitive complexity weight based on node type
    if (t.isIfStatement(node) || t.isConditionalExpression(node)) return 1;
    if (t.isLogicalExpression(node)) return 1;
    if (t.isSwitchCase(node)) return 1;
    if (t.isWhileStatement(node) || t.isDoWhileStatement(node)) return 1;
    if (t.isForStatement(node) || t.isForInStatement(node) || t.isForOfStatement(node)) return 1;
    if (t.isTryStatement(node) || t.isCatchClause(node)) return 1;
    return 0;
  }
}