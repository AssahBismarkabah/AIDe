/**
 * RDF Generator Types
 * 
 * Comprehensive type definitions for RDF generation from AST data,
 * optimized for both Neo4j ingestion and direct LLM consumption.
 */

import { ComplexityMetrics } from '../ast-analyzer/types';

/**
 * RDF Ontology Namespaces
 */
export interface RDFNamespaces {
  readonly code: string;
  readonly module: string;
  readonly arch: string;
  readonly business: string;
  readonly quality: string;
  readonly rdfs: string;
  readonly owl: string;
  readonly xsd: string;
}

/**
 * Module Knowledge Structure
 * Represents the complete knowledge extracted from a code module
 */
export interface ModuleKnowledge {
  readonly moduleId: string;
  readonly modulePath: string;
  readonly language: string;
  readonly version: string;
  readonly timestamp: Date;
  readonly classes: ClassKnowledge[];
  readonly functions: FunctionKnowledge[];
  readonly interfaces: InterfaceKnowledge[];
  readonly dependencies: ModuleDependency[];
  readonly exports: ExportKnowledge[];
  readonly imports: ImportKnowledge[];
  readonly complexity: ComplexityMetrics;
  readonly architecture: ArchitecturalPattern[];
  readonly businessContext: BusinessContext;
  readonly qualityMetrics: QualityMetrics;
}

/**
 * Class Knowledge Representation
 */
export interface ClassKnowledge {
  readonly name: string;
  readonly fullyQualifiedName: string;
  readonly visibility: 'public' | 'private' | 'protected' | 'internal';
  readonly isAbstract: boolean;
  readonly isInterface: boolean;
  readonly superClass?: string | undefined;
  readonly interfaces: string[];
  readonly methods: MethodKnowledge[];
  readonly properties: PropertyKnowledge[];
  readonly annotations: AnnotationKnowledge[];
  readonly documentation: DocumentationKnowledge;
  readonly sourceLocation: SourceLocation;
  readonly complexity: ComplexityMetrics;
  readonly responsibilities: string[];
  readonly designPatterns: string[];
}

/**
 * Method/Function Knowledge Representation
 */
export interface MethodKnowledge {
  readonly name: string;
  readonly signature: string;
  readonly visibility: 'public' | 'private' | 'protected' | 'internal';
  readonly isStatic: boolean;
  readonly isAsync: boolean;
  readonly returnType: TypeKnowledge;
  readonly parameters: ParameterKnowledge[];
  readonly exceptions: string[];
  readonly annotations: AnnotationKnowledge[];
  readonly documentation: DocumentationKnowledge;
  readonly sourceLocation: SourceLocation;
  readonly complexity: ComplexityMetrics;
  readonly sideEffects: SideEffect[];
  readonly testCoverage?: number;
}

/**
 * Function Knowledge (for non-OOP languages)
 */
export interface FunctionKnowledge extends Omit<MethodKnowledge, 'visibility'> {
  readonly isExported: boolean;
  readonly isDefault: boolean;
}

/**
 * Interface Knowledge Representation
 */
export interface InterfaceKnowledge {
  readonly name: string;
  readonly fullyQualifiedName: string;
  readonly extends: string[];
  readonly methods: MethodSignature[];
  readonly properties: PropertySignature[];
  readonly documentation: DocumentationKnowledge;
  readonly sourceLocation: SourceLocation;
  readonly usagePatterns: string[];
}

/**
 * Property Knowledge Representation
 */
export interface PropertyKnowledge {
  readonly name: string;
  readonly type: TypeKnowledge;
  readonly visibility: 'public' | 'private' | 'protected' | 'internal';
  readonly isStatic: boolean;
  readonly isReadonly: boolean;
  readonly defaultValue?: string;
  readonly annotations: AnnotationKnowledge[];
  readonly documentation: DocumentationKnowledge;
  readonly sourceLocation: SourceLocation;
}

/**
 * Type Knowledge Representation
 */
export interface TypeKnowledge {
  readonly name: string;
  readonly fullyQualifiedName: string;
  readonly isPrimitive: boolean;
  readonly isGeneric: boolean;
  readonly genericParameters: TypeKnowledge[];
  readonly isArray: boolean;
  readonly isOptional: boolean;
  readonly constraints: string[];
}

/**
 * Parameter Knowledge Representation
 */
export interface ParameterKnowledge {
  readonly name: string;
  readonly type: TypeKnowledge;
  readonly isOptional: boolean;
  readonly defaultValue?: string;
  readonly annotations: AnnotationKnowledge[];
  readonly documentation: string;
}

/**
 * Method/Property Signatures for Interfaces
 */
export interface MethodSignature {
  readonly name: string;
  readonly signature: string;
  readonly returnType: TypeKnowledge;
  readonly parameters: ParameterKnowledge[];
  readonly documentation: string;
}

export interface PropertySignature {
  readonly name: string;
  readonly type: TypeKnowledge;
  readonly isReadonly: boolean;
  readonly documentation: string;
}

/**
 * Annotation/Decorator Knowledge
 */
export interface AnnotationKnowledge {
  readonly name: string;
  readonly parameters: Record<string, any>;
  readonly target: 'class' | 'method' | 'property' | 'parameter';
  readonly framework?: string;
}

/**
 * Documentation Knowledge
 */
export interface DocumentationKnowledge {
  readonly summary: string;
  readonly description: string;
  readonly examples: CodeExample[];
  readonly seeAlso: string[];
  readonly since?: string;
  readonly deprecated?: DeprecationInfo;
  readonly tags: DocumentationTag[];
}

/**
 * Code Example for Documentation
 */
export interface CodeExample {
  readonly title: string;
  readonly code: string;
  readonly language: string;
  readonly description: string;
}

/**
 * Documentation Tag
 */
export interface DocumentationTag {
  readonly name: string;
  readonly value: string;
  readonly description?: string;
}

/**
 * Deprecation Information
 */
export interface DeprecationInfo {
  readonly since: string;
  readonly reason: string;
  readonly replacement?: string;
  readonly removalVersion?: string;
}

/**
 * Source Location Information
 */
export interface SourceLocation {
  readonly file: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly startColumn: number;
  readonly endColumn: number;
}

/**
 * Module Dependency Information
 */
export interface ModuleDependency {
  readonly name: string;
  readonly version?: string;
  readonly type: 'internal' | 'external' | 'builtin';
  readonly scope: 'runtime' | 'development' | 'peer' | 'optional';
  readonly usageType: 'import' | 'require' | 'dynamic';
  readonly usedSymbols: string[];
  readonly sourceLocation: SourceLocation;
}

/**
 * Export Knowledge
 */
export interface ExportKnowledge {
  readonly name: string;
  readonly type: 'class' | 'function' | 'interface' | 'type' | 'constant' | 'default';
  readonly isDefault: boolean;
  readonly alias?: string;
  readonly sourceLocation: SourceLocation;
}

/**
 * Import Knowledge
 */
export interface ImportKnowledge {
  readonly source: string;
  readonly imports: ImportedSymbol[];
  readonly isNamespaceImport: boolean;
  readonly isDynamicImport: boolean;
  readonly sourceLocation: SourceLocation;
}

/**
 * Imported Symbol
 */
export interface ImportedSymbol {
  readonly name: string;
  readonly alias?: string;
  readonly isDefault: boolean;
}

/**
 * Architectural Pattern Recognition
 */
export interface ArchitecturalPattern {
  readonly name: string;
  readonly confidence: number;
  readonly description: string;
  readonly components: string[];
  readonly benefits: string[];
  readonly tradeoffs: string[];
}

/**
 * Business Context Information
 */
export interface BusinessContext {
  readonly domain: string;
  readonly purpose: string;
  readonly stakeholders: string[];
  readonly businessRules: BusinessRule[];
  readonly useCases: UseCase[];
  readonly qualityAttributes: QualityAttribute[];
  readonly constraints: Constraint[];
  readonly assumptions: string[];
}

/**
 * Business Rule
 */
export interface BusinessRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: 'validation' | 'calculation' | 'workflow' | 'authorization';
  readonly priority: 'high' | 'medium' | 'low';
  readonly source: string;
  readonly implementedBy: string[];
}

/**
 * Use Case
 */
export interface UseCase {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly actors: string[];
  readonly preconditions: string[];
  readonly postconditions: string[];
  readonly mainFlow: string[];
  readonly alternativeFlows: AlternativeFlow[];
  readonly implementedBy: string[];
}

/**
 * Alternative Flow for Use Cases
 */
export interface AlternativeFlow {
  readonly name: string;
  readonly condition: string;
  readonly steps: string[];
}

/**
 * Quality Attribute
 */
export interface QualityAttribute {
  readonly name: string;
  readonly description: string;
  readonly measurableGoal: string;
  readonly currentValue?: string;
  readonly targetValue: string;
  readonly strategies: string[];
}

/**
 * Constraint
 */
export interface Constraint {
  readonly type: 'technical' | 'business' | 'regulatory' | 'performance';
  readonly description: string;
  readonly rationale: string;
  readonly impact: string;
  readonly mitigation?: string;
}

/**
 * Quality Metrics
 */
export interface QualityMetrics {
  readonly maintainabilityIndex: number;
  readonly technicalDebt: TechnicalDebt;
  readonly testCoverage: TestCoverage;
  readonly codeSmells: CodeSmell[];
  readonly securityIssues: SecurityIssue[];
  readonly performanceMetrics: PerformanceMetrics;
}

/**
 * Technical Debt
 */
export interface TechnicalDebt {
  readonly totalMinutes: number;
  readonly rating: 'A' | 'B' | 'C' | 'D' | 'E';
  readonly issues: TechnicalDebtIssue[];
}

/**
 * Technical Debt Issue
 */
export interface TechnicalDebtIssue {
  readonly type: string;
  readonly severity: 'blocker' | 'critical' | 'major' | 'minor' | 'info';
  readonly description: string;
  readonly location: SourceLocation;
  readonly estimatedMinutes: number;
  readonly rule: string;
}

/**
 * Test Coverage
 */
export interface TestCoverage {
  readonly linesCovered: number;
  readonly totalLines: number;
  readonly branchesCovered: number;
  readonly totalBranches: number;
  readonly functionsCovered: number;
  readonly totalFunctions: number;
  readonly percentage: number;
}

/**
 * Code Smell
 */
export interface CodeSmell {
  readonly type: string;
  readonly description: string;
  readonly location: SourceLocation;
  readonly severity: 'high' | 'medium' | 'low';
  readonly suggestion: string;
}

/**
 * Security Issue
 */
export interface SecurityIssue {
  readonly type: string;
  readonly description: string;
  readonly location: SourceLocation;
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  readonly cwe?: string;
  readonly recommendation: string;
}

/**
 * Performance Metrics
 */
export interface PerformanceMetrics {
  readonly executionTime?: number;
  readonly memoryUsage?: number;
  readonly cpuUsage?: number;
  readonly ioOperations?: number;
  readonly networkCalls?: number;
  readonly databaseQueries?: number;
}

/**
 * Side Effect
 */
export interface SideEffect {
  readonly type: 'io' | 'network' | 'database' | 'filesystem' | 'state_mutation' | 'logging';
  readonly description: string;
  readonly scope: 'local' | 'global' | 'external';
}

/**
 * RDF Generation Options
 */
export interface RDFGenerationOptions {
  readonly format: 'turtle' | 'n3' | 'rdf-xml' | 'json-ld';
  readonly includeBusinessContext: boolean;
  readonly includeQualityMetrics: boolean;
  readonly includeDocumentation: boolean;
  readonly includeSourceLocations: boolean;
  readonly generatePlaceholders: boolean;
  readonly optimizeForLLM: boolean;
  readonly optimizeForNeo4j: boolean;
  readonly compressionLevel: 'none' | 'basic' | 'aggressive';
}

/**
 * RDF Generation Result
 */
export interface RDFGenerationResult {
  readonly moduleId: string;
  readonly filePath: string;
  readonly rdfContent: string;
  readonly format: string;
  readonly size: number;
  readonly generationTime: number;
  readonly warnings: RDFWarning[];
  readonly statistics: RDFStatistics;
}

/**
 * RDF Warning
 */
export interface RDFWarning {
  readonly type: 'missing_data' | 'invalid_uri' | 'incomplete_mapping' | 'performance';
  readonly message: string;
  readonly location?: SourceLocation;
  readonly suggestion?: string;
}

/**
 * RDF Statistics
 */
export interface RDFStatistics {
  readonly totalTriples: number;
  readonly classCount: number;
  readonly methodCount: number;
  readonly propertyCount: number;
  readonly dependencyCount: number;
  readonly documentationTriples: number;
  readonly businessContextTriples: number;
  readonly qualityMetricTriples: number;
}

/**
 * TTL File Metadata
 */
export interface TTLFileMetadata {
  readonly version: string;
  readonly generatedAt: Date;
  readonly generatedBy: string;
  readonly sourceFiles: string[];
  readonly lastModified: Date;
  readonly checksum: string;
  readonly dependencies: string[];
  readonly schema: string;
}

/**
 * RDF Validation Result
 */
export interface RDFValidationResult {
  readonly isValid: boolean;
  readonly errors: RDFValidationError[];
  readonly warnings: RDFValidationWarning[];
  readonly statistics: RDFStatistics;
}

/**
 * RDF Validation Error
 */
export interface RDFValidationError {
  readonly type: 'syntax' | 'semantic' | 'schema' | 'consistency';
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly severity: 'error' | 'warning';
}

/**
 * RDF Validation Warning
 */
export interface RDFValidationWarning {
  readonly type: 'best_practice' | 'performance' | 'compatibility';
  readonly message: string;
  readonly suggestion: string;
}

/**
 * Module Detection Result
 */
export interface ModuleDetectionResult {
  readonly modules: DetectedModule[];
  readonly totalFiles: number;
  readonly supportedFiles: number;
  readonly skippedFiles: string[];
  readonly errors: ModuleDetectionError[];
}

/**
 * Detected Module
 */
export interface DetectedModule {
  readonly path: string;
  readonly name: string;
  readonly type: 'library' | 'application' | 'service' | 'utility' | 'test';
  readonly language: string;
  readonly entryPoints: string[];
  readonly configFiles: string[];
  readonly dependencies: string[];
  readonly estimatedSize: number;
}

/**
 * Module Detection Error
 */
export interface ModuleDetectionError {
  readonly file: string;
  readonly error: string;
  readonly type: 'parse_error' | 'unsupported_language' | 'access_denied' | 'corrupted_file';
}