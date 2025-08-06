/**
 * AST Analysis Engine Types
 * Defines interfaces and types for Abstract Syntax Tree analysis
 */

export interface ASTNode {
  id: string;
  type: string;
  name?: string | undefined;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  filePath: string;
  parent?: string | undefined;
  children: string[];
  properties: Record<string, any>;
}

export interface CodeFunction {
  id: string;
  name: string;
  parameters: Parameter[];
  returnType?: string | undefined;
  complexity: number;
  startLine: number;
  endLine: number;
  filePath: string;
  isAsync: boolean;
  isExported: boolean;
  visibility: 'public' | 'private' | 'protected';
  dependencies: string[];
  calls: string[];
}

export interface CodeClass {
  id: string;
  name: string;
  methods: CodeFunction[];
  properties: ClassProperty[];
  extends?: string | undefined;
  implements: string[];
  startLine: number;
  endLine: number;
  filePath: string;
  isExported: boolean;
  visibility: 'public' | 'private' | 'protected';
  isAbstract: boolean;
}

export interface Parameter {
  name: string;
  type?: string | undefined;
  optional: boolean;
  defaultValue?: string | undefined;
}

export interface ClassProperty {
  name: string;
  type?: string | undefined;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isReadonly: boolean;
  defaultValue?: string | undefined;
}

export interface ImportDeclaration {
  id: string;
  source: string;
  imports: ImportSpecifier[];
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface ImportSpecifier {
  name: string;
  alias?: string | undefined;
  isDefault: boolean;
  isNamespace: boolean;
}

export interface ExportDeclaration {
  id: string;
  name: string;
  type: 'function' | 'class' | 'variable' | 'type' | 'interface';
  isDefault: boolean;
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface AnalysisResult {
  filePath: string;
  language: SupportedLanguage;
  nodes: ASTNode[];
  functions: CodeFunction[];
  classes: CodeClass[];
  imports: ImportDeclaration[];
  exports: ExportDeclaration[];
  dependencies: string[];
  complexity: ComplexityMetrics;
  errors: AnalysisError[];
  timestamp: Date;
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  linesOfCode: number;
  maintainabilityIndex: number;
  technicalDebt: number;
}

export interface AnalysisError {
  type: 'parse' | 'analysis' | 'dependency';
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
}

export type SupportedLanguage = 
  | 'typescript' 
  | 'javascript' 
  | 'python' 
  | 'java' 
  | 'go' 
  | 'rust' 
  | 'cpp';

export interface AnalysisOptions {
  includeComments: boolean;
  calculateComplexity: boolean;
  extractDependencies: boolean;
  includePrivateMembers: boolean;
  maxDepth: number;
  timeout: number;
}

export interface ParserConfig {
  language: SupportedLanguage;
  sourceType: 'module' | 'script';
  allowImportExportEverywhere: boolean;
  allowReturnOutsideFunction: boolean;
  strictMode: boolean;
  plugins: string[];
}

export interface AnalysisContext {
  filePath: string;
  projectRoot: string;
  language: SupportedLanguage;
  options: AnalysisOptions;
  config: ParserConfig;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export interface DependencyNode {
  id: string;
  name: string;
  type: 'file' | 'function' | 'class' | 'variable';
  filePath: string;
  exported: boolean;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'imports' | 'calls' | 'extends' | 'implements' | 'uses';
  weight: number;
}

export interface AnalysisStats {
  totalFiles: number;
  totalNodes: number;
  totalFunctions: number;
  totalClasses: number;
  averageComplexity: number;
  processingTime: number;
  memoryUsage: number;
}