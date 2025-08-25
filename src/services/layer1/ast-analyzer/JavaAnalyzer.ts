/**
 * Java AST Analyzer
 * Implements AST analysis for Java files using java-parser
 */

import { parse } from 'java-parser';
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
  ParserConfig
} from './types';

export class JavaAnalyzer extends BaseAnalyzer {
  constructor() {
    super('java');
  }

  protected async parseAST(content: string, _context: AnalysisContext): Promise<any> {
    try {
      // Use proper Java parser for production-quality AST analysis
      const cst = parse(content);
      return this.convertCSTToAST(cst);
    } catch (error) {
      throw new Error(`Failed to parse Java AST: ${error}`);
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
        name: imp.name,
        startLine: imp.line,
        endLine: imp.line,
        startColumn: 0,
        endColumn: 0,
        filePath: context.filePath,
        parent: undefined,
        children: [],
        properties: { importName: imp.name, isStatic: imp.isStatic }
      });
    }
    
    // Extract class declarations
    for (const cls of ast.classes || []) {
      const classNode: ASTNode = {
        id: this.generateId(),
        type: 'ClassDeclaration',
        name: cls.name,
        startLine: cls.startLine,
        endLine: cls.endLine,
        startColumn: 0,
        endColumn: 0,
        filePath: context.filePath,
        parent: undefined,
        children: [],
        properties: {
          modifiers: cls.modifiers,
          superClass: cls.superClass,
          interfaces: cls.interfaces
        }
      };
      nodes.push(classNode);
      
      // Extract methods
      for (const method of cls.methods || []) {
        nodes.push({
          id: this.generateId(),
          type: 'MethodDeclaration',
          name: method.name,
          startLine: method.startLine,
          endLine: method.endLine,
          startColumn: 0,
          endColumn: 0,
          filePath: context.filePath,
          parent: classNode.id,
          children: [],
          properties: {
            modifiers: method.modifiers,
            returnType: method.returnType,
            parameters: method.parameters
          }
        });
      }
      
      // Extract fields
      for (const field of cls.fields || []) {
        nodes.push({
          id: this.generateId(),
          type: 'FieldDeclaration',
          name: field.name,
          startLine: field.line,
          endLine: field.line,
          startColumn: 0,
          endColumn: 0,
          filePath: context.filePath,
          parent: classNode.id,
          children: [],
          properties: {
            modifiers: field.modifiers,
            type: field.type
          }
        });
      }
    }
    
    return nodes;
  }

  protected async extractFunctions(_ast: any, _context: AnalysisContext): Promise<CodeFunction[]> {
    // CRITICAL FIX: Methods are now properly nested in classes, so top-level functions should only contain
    // standalone functions (which don't exist in Java). This prevents duplication and data structure conflicts.
    const functions: CodeFunction[] = [];
    
    // In Java, all methods belong to classes, so we don't extract them here to avoid duplication
    // The methods are now properly extracted and assigned in extractClasses()
    
    return functions;
  }

  protected async extractClasses(ast: any, context: AnalysisContext): Promise<CodeClass[]> {
    const classes: CodeClass[] = [];
    
    for (const cls of ast.classes || []) {
      // Extract methods for this specific class
      const classMethods: CodeFunction[] = [];
      
      console.log(`DEBUG JavaAnalyzer: Processing class "${cls.name}" with ${(cls.methods || []).length} methods`);
      
      for (const method of cls.methods || []) {
        const func: CodeFunction = {
          id: this.generateId(),
          name: method.name,
          parameters: this.extractJavaParameters(method.parameters || []),
          returnType: method.returnType || undefined,
          complexity: this.calculateJavaMethodComplexity(method),
          startLine: method.startLine,
          endLine: method.endLine,
          filePath: context.filePath,
          isAsync: false, // Java doesn't have async/await like JS/TS
          isExported: this.isJavaPublic(method.modifiers),
          visibility: this.getJavaVisibility(method.modifiers),
          dependencies: this.extractJavaMethodDependencies(method),
          calls: this.extractJavaMethodCalls(method)
        };
        
        console.log(`DEBUG JavaAnalyzer: Extracted method "${func.name}" with complexity ${func.complexity}`);
        classMethods.push(func);
      }
      
      console.log(`DEBUG JavaAnalyzer: Class "${cls.name}" final method count: ${classMethods.length}`);
      
      const classObj: CodeClass = {
        id: this.generateId(),
        name: cls.name,
        methods: classMethods, // CRITICAL FIX: Assign actual methods instead of empty array
        properties: this.extractJavaClassProperties(cls),
        extends: cls.superClass || undefined,
        implements: cls.interfaces || [],
        startLine: cls.startLine,
        endLine: cls.endLine,
        filePath: context.filePath,
        isExported: this.isJavaPublic(cls.modifiers),
        visibility: this.getJavaVisibility(cls.modifiers),
        isAbstract: this.isJavaAbstract(cls.modifiers)
      };
      
      classes.push(classObj);
    }
    
    return classes;
  }

  protected async extractImports(ast: any, context: AnalysisContext): Promise<ImportDeclaration[]> {
    const imports: ImportDeclaration[] = [];
    
    for (const imp of ast.imports || []) {
      const importDecl: ImportDeclaration = {
        id: this.generateId(),
        source: imp.name,
        imports: [{
          name: this.getJavaImportName(imp.name),
          alias: undefined,
          isDefault: false,
          isNamespace: imp.name.endsWith('.*')
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
    
    // In Java, public classes are effectively "exported"
    for (const cls of ast.classes || []) {
      if (this.isJavaPublic(cls.modifiers)) {
        exports.push({
          id: this.generateId(),
          name: cls.name,
          type: 'class',
          isDefault: false,
          filePath: context.filePath,
          startLine: cls.startLine,
          endLine: cls.endLine
        });
      }
      
      // Public methods are also exported
      for (const method of cls.methods || []) {
        if (this.isJavaPublic(method.modifiers)) {
          exports.push({
            id: this.generateId(),
            name: `${cls.name}.${method.name}`,
            type: 'function',
            isDefault: false,
            filePath: context.filePath,
            startLine: method.startLine,
            endLine: method.endLine
          });
        }
      }
    }
    
    return exports;
  }

  protected async extractDependencies(ast: any, _context: AnalysisContext): Promise<string[]> {
    const dependencies = new Set<string>();
    
    // Add imports as dependencies
    for (const imp of ast.imports || []) {
      const packageName = imp.name.split('.')[0];
      if (packageName !== 'java' && packageName !== 'javax') {
        dependencies.add(packageName);
      }
    }
    
    return Array.from(dependencies);
  }

  protected async calculateComplexity(ast: any, _context: AnalysisContext): Promise<ComplexityMetrics> {
    let cyclomaticComplexity = 1;
    let cognitiveComplexity = 0;
    let linesOfCode = 0;
    
    for (const cls of ast.classes || []) {
      linesOfCode += cls.endLine - cls.startLine + 1;
      
      for (const method of cls.methods || []) {
        cyclomaticComplexity += this.calculateJavaMethodComplexity(method);
        cognitiveComplexity += this.calculateJavaCognitiveComplexity(method);
      }
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
      language: 'java',
      sourceType: 'module',
      allowImportExportEverywhere: false,
      allowReturnOutsideFunction: false,
      strictMode: true,
      plugins: []
    };
  }

  // Helper methods for CST to AST conversion
  private convertCSTToAST(cst: any): any {
    const result: any = {
      packageDeclaration: null,
      imports: [],
      classes: []
    };

    if (cst.children?.ordinaryCompilationUnit) {
      const compilationUnit = cst.children.ordinaryCompilationUnit[0];
      
      // Extract package declaration
      if (compilationUnit.children?.packageDeclaration) {
        const packageDecl = compilationUnit.children.packageDeclaration[0];
        result.packageDeclaration = this.extractPackageDeclaration(packageDecl);
      }

      // Extract imports
      if (compilationUnit.children?.importDeclaration) {
        result.imports = compilationUnit.children.importDeclaration.map((imp: any) =>
          this.extractImportDeclaration(imp)
        );
      }

      // Extract type declarations (classes, interfaces, enums)
      if (compilationUnit.children?.typeDeclaration) {
        for (const typeDecl of compilationUnit.children.typeDeclaration) {
          if (typeDecl.children?.classDeclaration) {
            result.classes.push(this.extractClassDeclaration(typeDecl.children.classDeclaration[0]));
          }
          if (typeDecl.children?.interfaceDeclaration) {
            result.classes.push(this.extractInterfaceDeclaration(typeDecl.children.interfaceDeclaration[0]));
          }
          if (typeDecl.children?.enumDeclaration) {
            result.classes.push(this.extractEnumDeclaration(typeDecl.children.enumDeclaration[0]));
          }
        }
      }
    }

    return result;
  }

  private extractPackageDeclaration(packageDecl: any): any {
    const packageName = this.extractQualifiedName(packageDecl.children?.qualifiedName?.[0]);
    return {
      name: packageName,
      line: packageDecl.location?.startLine || 1
    };
  }

  private extractImportDeclaration(importDecl: any): any {
    const qualifiedName = this.extractQualifiedName(importDecl.children?.qualifiedName?.[0]);
    const isStatic = !!importDecl.children?.Static;
    const isWildcard = !!importDecl.children?.Star;
    
    return {
      name: qualifiedName + (isWildcard ? '.*' : ''),
      isStatic,
      line: importDecl.location?.startLine || 1
    };
  }

  private extractClassDeclaration(classDecl: any): any {
    const className = this.extractIdentifier(classDecl.children?.normalClassDeclaration?.[0]?.children?.typeIdentifier?.[0]);
    const modifiers = this.extractModifiers(classDecl.children?.normalClassDeclaration?.[0]?.children?.classModifier);
    
    const classBody = classDecl.children?.normalClassDeclaration?.[0]?.children?.classBody?.[0];
    const methods = this.extractMethods(classBody);
    const fields = this.extractFields(classBody);
    
    // Extract superclass and interfaces
    const superClass = this.extractSuperClass(classDecl.children?.normalClassDeclaration?.[0]);
    const interfaces = this.extractInterfaces(classDecl.children?.normalClassDeclaration?.[0]);

    return {
      name: className,
      modifiers,
      superClass,
      interfaces,
      startLine: classDecl.location?.startLine || 1,
      endLine: classDecl.location?.endLine || 1,
      methods,
      fields
    };
  }

  private extractInterfaceDeclaration(interfaceDecl: any): any {
    const interfaceName = this.extractIdentifier(interfaceDecl.children?.normalInterfaceDeclaration?.[0]?.children?.typeIdentifier?.[0]);
    const modifiers = this.extractModifiers(interfaceDecl.children?.normalInterfaceDeclaration?.[0]?.children?.interfaceModifier);
    
    const interfaceBody = interfaceDecl.children?.normalInterfaceDeclaration?.[0]?.children?.interfaceBody?.[0];
    const methods = this.extractInterfaceMethods(interfaceBody);

    return {
      name: interfaceName,
      modifiers: [...modifiers, 'interface'],
      superClass: null,
      interfaces: [],
      startLine: interfaceDecl.location?.startLine || 1,
      endLine: interfaceDecl.location?.endLine || 1,
      methods,
      fields: []
    };
  }

  private extractEnumDeclaration(enumDecl: any): any {
    const enumName = this.extractIdentifier(enumDecl.children?.typeIdentifier?.[0]);
    const modifiers = this.extractModifiers(enumDecl.children?.classModifier);

    return {
      name: enumName,
      modifiers: [...modifiers, 'enum'],
      superClass: null,
      interfaces: [],
      startLine: enumDecl.location?.startLine || 1,
      endLine: enumDecl.location?.endLine || 1,
      methods: [],
      fields: []
    };
  }

  private extractMethods(classBody: any): any[] {
    const methods: any[] = [];
    
    if (classBody?.children?.classBodyDeclaration) {
      for (const bodyDecl of classBody.children.classBodyDeclaration) {
        if (bodyDecl.children?.classMemberDeclaration?.[0]?.children?.methodDeclaration) {
          const methodDecl = bodyDecl.children.classMemberDeclaration[0].children.methodDeclaration[0];
          methods.push(this.extractMethodDeclaration(methodDecl, bodyDecl));
        }
        if (bodyDecl.children?.classMemberDeclaration?.[0]?.children?.constructorDeclaration) {
          const constructorDecl = bodyDecl.children.classMemberDeclaration[0].children.constructorDeclaration[0];
          methods.push(this.extractConstructorDeclaration(constructorDecl, bodyDecl));
        }
      }
    }

    return methods;
  }

  private extractInterfaceMethods(interfaceBody: any): any[] {
    const methods: any[] = [];
    
    if (interfaceBody?.children?.interfaceMemberDeclaration) {
      for (const memberDecl of interfaceBody.children.interfaceMemberDeclaration) {
        if (memberDecl.children?.interfaceMethodDeclaration) {
          const methodDecl = memberDecl.children.interfaceMethodDeclaration[0];
          methods.push(this.extractInterfaceMethodDeclaration(methodDecl, memberDecl));
        }
      }
    }

    return methods;
  }

  private extractFields(classBody: any): any[] {
    const fields: any[] = [];
    
    if (classBody?.children?.classBodyDeclaration) {
      for (const bodyDecl of classBody.children.classBodyDeclaration) {
        if (bodyDecl.children?.classMemberDeclaration?.[0]?.children?.fieldDeclaration) {
          const fieldDecl = bodyDecl.children.classMemberDeclaration[0].children.fieldDeclaration[0];
          const extractedFields = this.extractFieldDeclaration(fieldDecl, bodyDecl);
          fields.push(...extractedFields);
        }
      }
    }

    return fields;
  }

  private extractMethodDeclaration(methodDecl: any, bodyDecl: any): any {
    // CRITICAL FIX: Extract method name directly from methodDeclarator.children.Identifier[0].image
    const methodDeclarator = methodDecl.children?.methodHeader?.[0]?.children?.methodDeclarator?.[0];
    let methodName = '';
    
    if (methodDeclarator?.children?.Identifier?.[0]?.image) {
      methodName = methodDeclarator.children.Identifier[0].image;
    }
    
    console.log('DEBUG JavaAnalyzer: Extracted method name:', methodName);
    
    const returnType = this.extractType(methodDecl.children?.methodHeader?.[0]?.children?.result?.[0]);
    const modifiers = this.extractModifiers(bodyDecl.children?.modifier);
    const parameters = this.extractMethodParameters(methodDecl.children?.methodHeader?.[0]?.children?.methodDeclarator?.[0]);
    const body = this.extractMethodBodyFromCST(methodDecl.children?.methodBody?.[0]);

    return {
      name: methodName,
      returnType,
      parameters,
      modifiers,
      startLine: methodDecl.location?.startLine || 1,
      endLine: methodDecl.location?.endLine || 1,
      body
    };
  }

  private extractConstructorDeclaration(constructorDecl: any, bodyDecl: any): any {
    // CRITICAL FIX: Constructor names follow similar pattern
    const constructorDeclarator = constructorDecl.children?.constructorDeclarator?.[0];
    let constructorName = '';
    
    if (constructorDeclarator?.children?.simpleTypeName?.[0]?.children?.typeIdentifier?.[0]?.children?.Identifier?.[0]?.image) {
      constructorName = constructorDeclarator.children.simpleTypeName[0].children.typeIdentifier[0].children.Identifier[0].image;
    }
    
    const modifiers = this.extractModifiers(bodyDecl.children?.modifier);
    const parameters = this.extractMethodParameters(constructorDecl.children?.constructorDeclarator?.[0]);
    const body = this.extractMethodBodyFromCST(constructorDecl.children?.constructorBody?.[0]);

    return {
      name: constructorName,
      returnType: 'void',
      parameters,
      modifiers,
      startLine: constructorDecl.location?.startLine || 1,
      endLine: constructorDecl.location?.endLine || 1,
      body
    };
  }

  private extractInterfaceMethodDeclaration(methodDecl: any, memberDecl: any): any {
    // CRITICAL FIX: Interface method names follow same pattern as regular methods
    const methodDeclarator = methodDecl.children?.methodHeader?.[0]?.children?.methodDeclarator?.[0];
    let methodName = '';
    
    if (methodDeclarator?.children?.Identifier?.[0]?.image) {
      methodName = methodDeclarator.children.Identifier[0].image;
    }
    
    const returnType = this.extractType(methodDecl.children?.methodHeader?.[0]?.children?.result?.[0]);
    const modifiers = this.extractModifiers(memberDecl.children?.interfaceMethodModifier);
    const parameters = this.extractMethodParameters(methodDecl.children?.methodHeader?.[0]?.children?.methodDeclarator?.[0]);

    return {
      name: methodName,
      returnType,
      parameters,
      modifiers: [...modifiers, 'abstract'],
      startLine: methodDecl.location?.startLine || 1,
      endLine: methodDecl.location?.endLine || 1,
      body: ''
    };
  }

  private extractFieldDeclaration(fieldDecl: any, bodyDecl: any): any[] {
    const type = this.extractType(fieldDecl.children?.unannType?.[0]);
    const modifiers = this.extractModifiers(bodyDecl.children?.modifier);
    const fields: any[] = [];

    if (fieldDecl.children?.variableDeclaratorList?.[0]?.children?.variableDeclarator) {
      for (const varDecl of fieldDecl.children.variableDeclaratorList[0].children.variableDeclarator) {
        const fieldName = this.extractIdentifier(varDecl.children?.variableDeclaratorId?.[0]?.children?.identifier?.[0]);
        fields.push({
          name: fieldName,
          type,
          modifiers,
          line: fieldDecl.location?.startLine || 1
        });
      }
    }

    return fields;
  }

  private extractMethodParameters(methodDeclarator: any): any[] {
    const parameters: any[] = [];
    
    if (methodDeclarator?.children?.formalParameterList?.[0]?.children?.formalParameter) {
      for (const param of methodDeclarator.children.formalParameterList[0].children.formalParameter) {
        const paramType = this.extractType(param.children?.unannType?.[0]);
        const paramName = this.extractIdentifier(param.children?.variableDeclaratorId?.[0]?.children?.identifier?.[0]);
        
        parameters.push({
          type: paramType,
          name: paramName
        });
      }
    }

    return parameters;
  }

  private extractMethodBodyFromCST(methodBody: any): string {
    // For complexity analysis, we'll extract a simplified representation
    if (methodBody?.children?.block?.[0]) {
      return this.extractBlockStatements(methodBody.children.block[0]);
    }
    return '';
  }

  private extractBlockStatements(block: any): string {
    // Extract block statements for complexity analysis
    let statements = '';
    if (block?.children?.blockStatements?.[0]?.children?.blockStatement) {
      for (const stmt of block.children.blockStatements[0].children.blockStatement) {
        statements += this.extractStatementType(stmt) + ' ';
      }
    }
    return statements;
  }

  private extractStatementType(statement: any): string {
    if (statement.children?.statement?.[0]) {
      const stmt = statement.children.statement[0];
      if (stmt.children?.ifThenStatement || stmt.children?.ifThenElseStatement) return 'if';
      if (stmt.children?.whileStatement) return 'while';
      if (stmt.children?.forStatement) return 'for';
      if (stmt.children?.switchStatement) return 'switch';
      if (stmt.children?.tryStatement) return 'try';
      if (stmt.children?.throwStatement) return 'throw';
      if (stmt.children?.returnStatement) return 'return';
    }
    return 'statement';
  }

  private extractModifiers(modifierList: any[]): string[] {
    const modifiers: string[] = [];
    if (!modifierList) return modifiers;

    for (const modifier of modifierList) {
      if (modifier.children?.Public) modifiers.push('public');
      if (modifier.children?.Private) modifiers.push('private');
      if (modifier.children?.Protected) modifiers.push('protected');
      if (modifier.children?.Static) modifiers.push('static');
      if (modifier.children?.Final) modifiers.push('final');
      if (modifier.children?.Abstract) modifiers.push('abstract');
      if (modifier.children?.Synchronized) modifiers.push('synchronized');
    }

    return modifiers;
  }

  private extractQualifiedName(qualifiedName: any): string {
    if (!qualifiedName) return '';
    
    if (qualifiedName.children?.identifier) {
      return qualifiedName.children.identifier.map((id: any) => this.extractIdentifier(id)).join('.');
    }
    
    return '';
  }

  private extractIdentifier(identifier: any): string {
    if (!identifier) return '';
    
    // Try direct image first (for leaf nodes)
    if (identifier.image) {
      return identifier.image;
    }
    
    // Navigate CST structure for java-parser nested identifiers
    if (identifier.children?.Identifier?.[0]?.image) {
      return identifier.children.Identifier[0].image;
    }
    
    // Handle typeIdentifier and other nested structures
    if (identifier.children?.typeIdentifier?.[0]) {
      return this.extractIdentifier(identifier.children.typeIdentifier[0]);
    }
    
    // Handle identifier nested in children
    if (identifier.children?.identifier?.[0]) {
      return this.extractIdentifier(identifier.children.identifier[0]);
    }
    
    // Additional handling for method identifiers which might be nested differently
    if (identifier.children?.Identifier && Array.isArray(identifier.children.Identifier)) {
      for (const id of identifier.children.Identifier) {
        if (id?.image) {
          return id.image;
        }
      }
    }
    
    // Fallback to empty string if no identifier found
    return '';
  }

  private extractType(typeNode: any): string {
    if (!typeNode) return 'void';
    
    if (typeNode.children?.primitiveType?.[0]) {
      const primitiveType = typeNode.children.primitiveType[0];
      if (primitiveType.children?.Int) return 'int';
      if (primitiveType.children?.Boolean) return 'boolean';
      if (primitiveType.children?.Char) return 'char';
      if (primitiveType.children?.Byte) return 'byte';
      if (primitiveType.children?.Short) return 'short';
      if (primitiveType.children?.Long) return 'long';
      if (primitiveType.children?.Float) return 'float';
      if (primitiveType.children?.Double) return 'double';
    }
    
    if (typeNode.children?.referenceType?.[0]?.children?.classOrInterfaceType?.[0]) {
      return this.extractQualifiedName(typeNode.children.referenceType[0].children.classOrInterfaceType[0].children?.classType?.[0]?.children?.identifier?.[0]);
    }
    
    return 'Object';
  }

  private extractSuperClass(classDecl: any): string | null {
    if (classDecl?.children?.superclass?.[0]?.children?.classType?.[0]) {
      return this.extractQualifiedName(classDecl.children.superclass[0].children.classType[0].children?.identifier?.[0]);
    }
    return null;
  }

  private extractInterfaces(classDecl: any): string[] {
    const interfaces: string[] = [];
    
    if (classDecl?.children?.superinterfaces?.[0]?.children?.interfaceTypeList?.[0]?.children?.interfaceType) {
      for (const interfaceType of classDecl.children.superinterfaces[0].children.interfaceTypeList[0].children.interfaceType) {
        const interfaceName = this.extractQualifiedName(interfaceType.children?.classType?.[0]?.children?.identifier?.[0]);
        if (interfaceName) interfaces.push(interfaceName);
      }
    }
    
    return interfaces;
  }

  private extractJavaParameters(javaParams: any[]): Parameter[] {
    return javaParams.map(param => ({
      name: param.name,
      type: param.type || undefined,
      optional: false,
      defaultValue: undefined
    }));
  }

  private calculateJavaMethodComplexity(method: any): number {
    if (!method.body) return 1;
    
    let complexity = 1;
    const body = method.body;
    
    // Count decision points
    complexity += (body.match(/\bif\b/g) || []).length;
    complexity += (body.match(/\belse\b/g) || []).length;
    complexity += (body.match(/\bwhile\b/g) || []).length;
    complexity += (body.match(/\bfor\b/g) || []).length;
    complexity += (body.match(/\bswitch\b/g) || []).length;
    complexity += (body.match(/\bcase\b/g) || []).length;
    complexity += (body.match(/\bcatch\b/g) || []).length;
    complexity += (body.match(/\b\?\b/g) || []).length; // Ternary operator
    
    return complexity;
  }

  private calculateJavaCognitiveComplexity(method: any): number {
    // Calculate cognitive complexity using established 0.8 multiplier for Java
    return Math.floor(this.calculateJavaMethodComplexity(method) * 0.8);
  }

  private isJavaPublic(modifiers: string[]): boolean {
    return modifiers.includes('public');
  }

  private getJavaVisibility(modifiers: string[]): 'public' | 'private' | 'protected' {
    if (modifiers.includes('private')) return 'private';
    if (modifiers.includes('protected')) return 'protected';
    return 'public';
  }

  private isJavaAbstract(modifiers: string[]): boolean {
    return modifiers.includes('abstract');
  }

  private getJavaImportName(importPath: string): string {
    const parts = importPath.split('.');
    return parts[parts.length - 1].replace('*', '');
  }

  private extractJavaClassProperties(cls: any): ClassProperty[] {
    return (cls.fields || []).map((field: any) => ({
      name: field.name,
      type: field.type || undefined,
      visibility: this.getJavaVisibility(field.modifiers),
      isStatic: field.modifiers.includes('static'),
      isReadonly: field.modifiers.includes('final'),
      defaultValue: undefined
    }));
  }

  private extractJavaMethodDependencies(method: any): string[] {
    if (!method.body) return [];
    
    const dependencies = new Set<string>();
    const body = method.body;
    
    // Extract class names (simplified)
    const classMatches = body.match(/\b[A-Z]\w+\b/g) || [];
    classMatches.forEach((match: string) => dependencies.add(match));
    
    return Array.from(dependencies);
  }

  private extractJavaMethodCalls(method: any): string[] {
    if (!method.body) return [];
    
    const calls = new Set<string>();
    const body = method.body;
    
    // Extract method calls (simplified)
    const callMatches = body.match(/\b\w+\s*\(/g) || [];
    callMatches.forEach((match: string) => {
      const methodName = match.replace(/\s*\($/, '');
      calls.add(methodName);
    });
    
    return Array.from(calls);
  }
}