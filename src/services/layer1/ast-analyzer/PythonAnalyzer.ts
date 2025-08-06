/**
 * Python AST Analyzer
 * Implements AST analysis for Python files using Python's ast module via child process
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
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

export class PythonAnalyzer extends BaseAnalyzer {
  constructor() {
    super('python');
  }

  protected async parseAST(content: string, context: AnalysisContext): Promise<any> {
    try {
      // Create Python script to parse the AST using Python's ast module
      const tempScript = this.createPythonParserScript();
      const tempFile = join(__dirname, 'temp_parser.py');
      const inputFile = join(__dirname, 'temp_input.py');
      
      writeFileSync(tempFile, tempScript);
      writeFileSync(inputFile, content);
      
      try {
        // Execute Python AST parser
        const result = execSync(`python3 "${tempFile}" "${inputFile}"`, {
          encoding: 'utf-8',
          timeout: context.options.timeout
        });
        
        return JSON.parse(result);
      } finally {
        // Clean up generated files
        try {
          unlinkSync(tempFile);
          unlinkSync(inputFile);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      throw new Error(`Failed to parse Python AST: ${error}`);
    }
  }

  protected async extractNodes(ast: any, context: AnalysisContext): Promise<ASTNode[]> {
    const nodes: ASTNode[] = [];
    
    const extractNodesRecursive = (node: any, parent?: string) => {
      if (!node || typeof node !== 'object') return;
      
      const astNode: ASTNode = {
        id: this.generateId(),
        type: node._type || 'Unknown',
        name: this.getNodeName(node),
        startLine: node.lineno || 0,
        endLine: node.end_lineno || node.lineno || 0,
        startColumn: node.col_offset || 0,
        endColumn: node.end_col_offset || node.col_offset || 0,
        filePath: context.filePath,
        parent,
        children: [],
        properties: this.extractNodeProperties(node)
      };
      
      nodes.push(astNode);
      
      // Process child nodes
      if (node.body && Array.isArray(node.body)) {
        for (const child of node.body) {
          extractNodesRecursive(child, astNode.id);
        }
      }
      
      // Process other child properties
      for (const [key, value] of Object.entries(node)) {
        if (key !== 'body' && key !== '_type' && Array.isArray(value)) {
          for (const child of value) {
            if (child && typeof child === 'object' && child._type) {
              extractNodesRecursive(child, astNode.id);
            }
          }
        } else if (key !== 'body' && key !== '_type' && value && typeof value === 'object' && (value as any)._type) {
          extractNodesRecursive(value, astNode.id);
        }
      }
    };
    
    extractNodesRecursive(ast);
    return nodes;
  }

  protected async extractFunctions(ast: any, context: AnalysisContext): Promise<CodeFunction[]> {
    const functions: CodeFunction[] = [];
    
    const extractFunctionsRecursive = (node: any) => {
      if (!node || typeof node !== 'object') return;
      
      if (node._type === 'FunctionDef' || node._type === 'AsyncFunctionDef') {
        const func: CodeFunction = {
          id: this.generateId(),
          name: node.name || 'anonymous',
          parameters: this.extractPythonParameters(node.args || {}),
          returnType: this.extractPythonReturnType(node),
          complexity: this.calculatePythonFunctionComplexity(node),
          startLine: node.lineno || 0,
          endLine: node.end_lineno || node.lineno || 0,
          filePath: context.filePath,
          isAsync: node._type === 'AsyncFunctionDef',
          isExported: this.isPythonExported(node),
          visibility: this.getPythonVisibility(node.name),
          dependencies: this.extractPythonFunctionDependencies(node),
          calls: this.extractPythonFunctionCalls(node)
        };
        
        functions.push(func);
      }
      
      // Recursively process child nodes
      this.traversePythonNode(node, extractFunctionsRecursive);
    };
    
    extractFunctionsRecursive(ast);
    return functions;
  }

  protected async extractClasses(ast: any, context: AnalysisContext): Promise<CodeClass[]> {
    const classes: CodeClass[] = [];
    
    const extractClassesRecursive = (node: any) => {
      if (!node || typeof node !== 'object') return;
      
      if (node._type === 'ClassDef') {
        const cls: CodeClass = {
          id: this.generateId(),
          name: node.name || 'anonymous',
          methods: [],
          properties: this.extractPythonClassProperties(node),
          extends: this.extractPythonBaseClasses(node),
          implements: [], // Python doesn't have explicit interfaces
          startLine: node.lineno || 0,
          endLine: node.end_lineno || node.lineno || 0,
          filePath: context.filePath,
          isExported: this.isPythonExported(node),
          visibility: 'public', // Python doesn't have explicit visibility
          isAbstract: this.isPythonAbstractClass(node)
        };
        
        classes.push(cls);
      }
      
      // Recursively process child nodes
      this.traversePythonNode(node, extractClassesRecursive);
    };
    
    extractClassesRecursive(ast);
    return classes;
  }

  protected async extractImports(ast: any, context: AnalysisContext): Promise<ImportDeclaration[]> {
    const imports: ImportDeclaration[] = [];
    
    const extractImportsRecursive = (node: any) => {
      if (!node || typeof node !== 'object') return;
      
      if (node._type === 'Import') {
        for (const alias of node.names || []) {
          const importDecl: ImportDeclaration = {
            id: this.generateId(),
            source: alias.name || '',
            imports: [{
              name: alias.name || '',
              alias: alias.asname || undefined,
              isDefault: false,
              isNamespace: true
            }],
            filePath: context.filePath,
            startLine: node.lineno || 0,
            endLine: node.end_lineno || node.lineno || 0
          };
          imports.push(importDecl);
        }
      } else if (node._type === 'ImportFrom') {
        const importSpecs: ImportSpecifier[] = [];
        
        for (const alias of node.names || []) {
          importSpecs.push({
            name: alias.name || '',
            alias: alias.asname || undefined,
            isDefault: false,
            isNamespace: alias.name === '*'
          });
        }
        
        const importDecl: ImportDeclaration = {
          id: this.generateId(),
          source: node.module || '',
          imports: importSpecs,
          filePath: context.filePath,
          startLine: node.lineno || 0,
          endLine: node.end_lineno || node.lineno || 0
        };
        imports.push(importDecl);
      }
      
      // Recursively process child nodes
      this.traversePythonNode(node, extractImportsRecursive);
    };
    
    extractImportsRecursive(ast);
    return imports;
  }

  protected async extractExports(ast: any, context: AnalysisContext): Promise<ExportDeclaration[]> {
    const exports: ExportDeclaration[] = [];
    
    // Python doesn't have explicit exports, but we can identify public functions/classes
    const extractExportsRecursive = (node: any) => {
      if (!node || typeof node !== 'object') return;
      
      if (node._type === 'FunctionDef' && this.isPythonExported(node)) {
        exports.push({
          id: this.generateId(),
          name: node.name,
          type: 'function',
          isDefault: false,
          filePath: context.filePath,
          startLine: node.lineno || 0,
          endLine: node.end_lineno || node.lineno || 0
        });
      } else if (node._type === 'ClassDef' && this.isPythonExported(node)) {
        exports.push({
          id: this.generateId(),
          name: node.name,
          type: 'class',
          isDefault: false,
          filePath: context.filePath,
          startLine: node.lineno || 0,
          endLine: node.end_lineno || node.lineno || 0
        });
      }
      
      // Check for __all__ variable
      if (node._type === 'Assign') {
        for (const target of node.targets || []) {
          if (target._type === 'Name' && target.id === '__all__') {
            // Extract names from __all__ list
            if (node.value && node.value._type === 'List') {
              for (const element of node.value.elts || []) {
                if (element._type === 'Str' || element._type === 'Constant') {
                  exports.push({
                    id: this.generateId(),
                    name: element.s || element.value || '',
                    type: 'variable',
                    isDefault: false,
                    filePath: context.filePath,
                    startLine: node.lineno || 0,
                    endLine: node.end_lineno || node.lineno || 0
                  });
                }
              }
            }
          }
        }
      }
      
      // Recursively process child nodes
      this.traversePythonNode(node, extractExportsRecursive);
    };
    
    extractExportsRecursive(ast);
    return exports;
  }

  protected async extractDependencies(ast: any, _context: AnalysisContext): Promise<string[]> {
    const dependencies = new Set<string>();
    
    const extractDepsRecursive = (node: any) => {
      if (!node || typeof node !== 'object') return;
      
      if (node._type === 'Import') {
        for (const alias of node.names || []) {
          if (alias.name) {
            dependencies.add(alias.name.split('.')[0]);
          }
        }
      } else if (node._type === 'ImportFrom' && node.module) {
        dependencies.add(node.module.split('.')[0]);
      }
      
      // Recursively process child nodes
      this.traversePythonNode(node, extractDepsRecursive);
    };
    
    extractDepsRecursive(ast);
    return Array.from(dependencies);
  }

  protected async calculateComplexity(ast: any, _context: AnalysisContext): Promise<ComplexityMetrics> {
    let cyclomaticComplexity = 1;
    let cognitiveComplexity = 0;
    let linesOfCode = 0;
    
    const calculateComplexityRecursive = (node: any) => {
      if (!node || typeof node !== 'object') return;
      
      // Cyclomatic complexity
      if (this.isPythonComplexityNode(node)) {
        cyclomaticComplexity++;
      }
      
      // Cognitive complexity
      if (this.isPythonCognitiveComplexityNode(node)) {
        cognitiveComplexity++;
      }
      
      // Lines of code
      if (node.end_lineno) {
        linesOfCode = Math.max(linesOfCode, node.end_lineno);
      }
      
      // Recursively process child nodes
      this.traversePythonNode(node, calculateComplexityRecursive);
    };
    
    calculateComplexityRecursive(ast);
    
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
      language: 'python',
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: false,
      strictMode: false,
      plugins: []
    };
  }

  // Helper methods
  private createPythonParserScript(): string {
    return `
import ast
import json
import sys

def ast_to_dict(node):
    if isinstance(node, ast.AST):
        result = {'_type': node.__class__.__name__}
        for field, value in ast.iter_fields(node):
            if isinstance(value, list):
                result[field] = [ast_to_dict(item) for item in value]
            elif isinstance(value, ast.AST):
                result[field] = ast_to_dict(value)
            else:
                result[field] = value
        
        # Add position information
        if hasattr(node, 'lineno'):
            result['lineno'] = node.lineno
        if hasattr(node, 'col_offset'):
            result['col_offset'] = node.col_offset
        if hasattr(node, 'end_lineno'):
            result['end_lineno'] = node.end_lineno
        if hasattr(node, 'end_col_offset'):
            result['end_col_offset'] = node.end_col_offset
            
        return result
    else:
        return value

def main():
    if len(sys.argv) != 2:
        print("Usage: python parser.py <input_file>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            source_code = f.read()
        
        tree = ast.parse(source_code)
        result = ast_to_dict(tree)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
`;
  }

  private getNodeName(node: any): string | undefined {
    if (node.name) return node.name;
    if (node.id) return node.id;
    return undefined;
  }

  private extractNodeProperties(node: any): Record<string, any> {
    const properties: Record<string, any> = {};
    
    if (node._type === 'FunctionDef') {
      properties.async = false;
    } else if (node._type === 'AsyncFunctionDef') {
      properties.async = true;
    }
    
    if (node.decorator_list && node.decorator_list.length > 0) {
      properties.decorators = node.decorator_list.map((d: any) => d.id || d.attr || 'unknown');
    }
    
    return properties;
  }

  private extractPythonParameters(args: any): Parameter[] {
    const parameters: Parameter[] = [];
    
    // Regular arguments
    if (args.args) {
      for (const arg of args.args) {
        parameters.push({
          name: arg.arg || 'unknown',
          type: arg.annotation ? this.extractPythonTypeAnnotation(arg.annotation) : undefined,
          optional: false,
          defaultValue: undefined
        });
      }
    }
    
    // Default values
    if (args.defaults && args.args) {
      const defaultStart = args.args.length - args.defaults.length;
      for (let i = 0; i < args.defaults.length; i++) {
        const paramIndex = defaultStart + i;
        if (parameters[paramIndex]) {
          parameters[paramIndex].optional = true;
          parameters[paramIndex].defaultValue = this.extractPythonDefaultValue(args.defaults[i]);
        }
      }
    }
    
    // Keyword-only arguments
    if (args.kwonlyargs) {
      for (const arg of args.kwonlyargs) {
        parameters.push({
          name: arg.arg || 'unknown',
          type: arg.annotation ? this.extractPythonTypeAnnotation(arg.annotation) : undefined,
          optional: true,
          defaultValue: undefined
        });
      }
    }
    
    return parameters;
  }

  private extractPythonReturnType(node: any): string | undefined {
    if (node.returns) {
      return this.extractPythonTypeAnnotation(node.returns);
    }
    return undefined;
  }

  private extractPythonTypeAnnotation(annotation: any): string {
    if (!annotation) return 'Any';
    
    if (annotation._type === 'Name') {
      return annotation.id || 'Any';
    } else if (annotation._type === 'Constant') {
      return String(annotation.value);
    } else if (annotation._type === 'Attribute') {
      return `${annotation.value?.id || 'unknown'}.${annotation.attr || 'unknown'}`;
    }
    
    return 'Any';
  }

  private extractPythonDefaultValue(node: any): string {
    if (!node) return 'None';
    
    if (node._type === 'Constant') {
      if (typeof node.value === 'string') return `"${node.value}"`;
      return String(node.value);
    } else if (node._type === 'Name') {
      return node.id || 'None';
    } else if (node._type === 'List') {
      return '[]';
    } else if (node._type === 'Dict') {
      return '{}';
    }
    
    return 'None';
  }

  private calculatePythonFunctionComplexity(node: any): number {
    let complexity = 1;
    
    const countComplexity = (n: any) => {
      if (!n || typeof n !== 'object') return;
      
      if (this.isPythonComplexityNode(n)) {
        complexity++;
      }
      
      this.traversePythonNode(n, countComplexity);
    };
    
    countComplexity(node);
    return complexity;
  }

  private isPythonExported(node: any): boolean {
    // In Python, functions/classes not starting with _ are considered public
    return node.name && !node.name.startsWith('_');
  }

  private getPythonVisibility(name: string): 'public' | 'private' | 'protected' {
    if (name.startsWith('__') && name.endsWith('__')) return 'public'; // Magic methods
    if (name.startsWith('__')) return 'private';
    if (name.startsWith('_')) return 'protected';
    return 'public';
  }

  private extractPythonFunctionDependencies(node: any): string[] {
    const dependencies = new Set<string>();
    
    const extractDeps = (n: any) => {
      if (!n || typeof n !== 'object') return;
      
      if (n._type === 'Name') {
        dependencies.add(n.id);
      } else if (n._type === 'Attribute' && n.value && n.value._type === 'Name') {
        dependencies.add(n.value.id);
      }
      
      this.traversePythonNode(n, extractDeps);
    };
    
    if (node.body) {
      for (const stmt of node.body) {
        extractDeps(stmt);
      }
    }
    
    return Array.from(dependencies);
  }

  private extractPythonFunctionCalls(node: any): string[] {
    const calls = new Set<string>();
    
    const extractCalls = (n: any) => {
      if (!n || typeof n !== 'object') return;
      
      if (n._type === 'Call') {
        if (n.func._type === 'Name') {
          calls.add(n.func.id);
        } else if (n.func._type === 'Attribute') {
          calls.add(n.func.attr);
        }
      }
      
      this.traversePythonNode(n, extractCalls);
    };
    
    if (node.body) {
      for (const stmt of node.body) {
        extractCalls(stmt);
      }
    }
    
    return Array.from(calls);
  }

  private extractPythonClassProperties(node: any): ClassProperty[] {
    const properties: ClassProperty[] = [];
    
    if (node.body) {
      for (const stmt of node.body) {
        if (stmt._type === 'Assign') {
          for (const target of stmt.targets || []) {
            if (target._type === 'Name') {
              properties.push({
                name: target.id,
                type: undefined,
                visibility: this.getPythonVisibility(target.id),
                isStatic: false,
                isReadonly: false,
                defaultValue: this.extractPythonDefaultValue(stmt.value)
              });
            }
          }
        } else if (stmt._type === 'AnnAssign' && stmt.target && stmt.target._type === 'Name') {
          properties.push({
            name: stmt.target.id,
            type: this.extractPythonTypeAnnotation(stmt.annotation),
            visibility: this.getPythonVisibility(stmt.target.id),
            isStatic: false,
            isReadonly: false,
            defaultValue: stmt.value ? this.extractPythonDefaultValue(stmt.value) : undefined
          });
        }
      }
    }
    
    return properties;
  }

  private extractPythonBaseClasses(node: any): string | undefined {
    if (node.bases && node.bases.length > 0) {
      const base = node.bases[0];
      if (base._type === 'Name') {
        return base.id;
      } else if (base._type === 'Attribute') {
        return `${base.value?.id || 'unknown'}.${base.attr || 'unknown'}`;
      }
    }
    return undefined;
  }

  private isPythonAbstractClass(node: any): boolean {
    // Check for ABC inheritance or @abstractmethod decorators
    if (node.bases) {
      for (const base of node.bases) {
        if (base._type === 'Name' && (base.id === 'ABC' || base.id === 'AbstractBase')) {
          return true;
        }
      }
    }
    
    // Check for abstract methods
    if (node.body) {
      for (const stmt of node.body) {
        if (stmt._type === 'FunctionDef' && stmt.decorator_list) {
          for (const decorator of stmt.decorator_list) {
            if (decorator._type === 'Name' && decorator.id === 'abstractmethod') {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  }

  private isPythonComplexityNode(node: any): boolean {
    return ['If', 'While', 'For', 'Try', 'With', 'AsyncWith', 'AsyncFor'].includes(node._type);
  }

  private isPythonCognitiveComplexityNode(node: any): boolean {
    return this.isPythonComplexityNode(node) || ['ExceptHandler', 'ListComp', 'DictComp', 'SetComp'].includes(node._type);
  }

  private traversePythonNode(node: any, callback: (node: any) => void): void {
    if (!node || typeof node !== 'object') return;
    
    // Process all child nodes
    for (const [key, value] of Object.entries(node)) {
      if (key === '_type') continue;
      
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === 'object' && child._type) {
            callback(child);
          }
        }
      } else if (value && typeof value === 'object' && (value as any)._type) {
        callback(value);
      }
    }
  }
}