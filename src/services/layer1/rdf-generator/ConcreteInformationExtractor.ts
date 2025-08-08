/**
 * Concrete Information Extractor
 * 
 * Extracts concrete, actual information from code analysis results
 * to generate TTL files with real class names, method signatures,
 * dependencies, and business context indicators.
 */

import * as path from 'path';
import logger from '../../../utils/logger';
import { AnalysisResult, CodeClass, CodeFunction } from '../ast-analyzer/types';

export interface ConcreteCodeStructure {
  actualClasses: ConcreteClass[];
  actualFunctions: ConcreteFunction[];
  actualDependencies: ConcreteDependency[];
  actualExports: ConcreteExport[];
  actualImports: ConcreteImport[];
  architecturalPatterns: ArchitecturalPattern[];
  businessDomainIndicators: BusinessDomainIndicator[];
  qualityMetrics: ConcreteQualityMetrics;
}

export interface ConcreteClass {
  name: string;
  fullyQualifiedName: string;
  methods: ConcreteMethod[];
  properties: ConcreteProperty[];
  inheritance: {
    extends?: string | undefined;
    implements: string[];
  };
  visibility: 'public' | 'private' | 'protected';
  isAbstract: boolean;
  sourceLocation: SourceLocation;
  businessPurpose?: string;
  designPatterns: string[];
}

export interface ConcreteMethod {
  name: string;
  signature: string;
  parameters: ConcreteParameter[];
  returnType: string;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isAsync: boolean;
  complexity: number;
  sourceLocation: SourceLocation;
  businessPurpose?: string;
  sideEffects: string[];
}

export interface ConcreteFunction {
  name: string;
  signature: string;
  parameters: ConcreteParameter[];
  returnType: string;
  isAsync: boolean;
  isExported: boolean;
  complexity: number;
  sourceLocation: SourceLocation;
  businessPurpose?: string;
  dependencies: string[];
}

export interface ConcreteParameter {
  name: string;
  type: string;
  isOptional: boolean;
  defaultValue?: string;
  businessMeaning?: string;
}

export interface ConcreteProperty {
  name: string;
  type: string;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isReadonly: boolean;
  defaultValue?: string | undefined;
  businessPurpose?: string;
}

export interface ConcreteDependency {
  name: string;
  version?: string;
  type: 'external' | 'internal' | 'builtin';
  usage: 'import' | 'require' | 'dynamic';
  usedSymbols: string[];
  businessJustification?: string;
}

export interface ConcreteExport {
  name: string;
  type: 'function' | 'class' | 'variable' | 'type' | 'interface';
  isDefault: boolean;
  businessValue?: string;
}

export interface ConcreteImport {
  source: string;
  imports: {
    name: string;
    alias?: string;
    isDefault: boolean;
    isNamespace: boolean;
  }[];
  businessReason?: string;
}

export interface ArchitecturalPattern {
  name: string;
  confidence: number;
  evidence: string[];
  businessBenefit?: string;
}

export interface BusinessDomainIndicator {
  domain: string;
  confidence: number;
  evidence: string[];
  keywords: string[];
}

export interface ConcreteQualityMetrics {
  complexity: {
    cyclomatic: number;
    cognitive: number;
    maintainability: number;
  };
  testability: {
    score: number;
    factors: string[];
  };
  reusability: {
    score: number;
    factors: string[];
  };
  documentation: {
    coverage: number;
    quality: number;
  };
}

export interface SourceLocation {
  file: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

/**
 * Concrete Information Extractor
 * 
 * Analyzes code structure to extract concrete, actionable information
 * for generating comprehensive TTL files with real implementation details.
 */
export class ConcreteInformationExtractor {
  
  /**
   * Extract concrete code structure from analysis result
   */
  extractConcreteStructure(analysisResult: AnalysisResult): ConcreteCodeStructure {
    logger.debug('Extracting concrete code structure', {
      filePath: analysisResult.filePath,
      language: analysisResult.language,
      classCount: analysisResult.classes.length,
      functionCount: analysisResult.functions.length
    });

    try {
      const structure: ConcreteCodeStructure = {
        actualClasses: this.extractConcreteClasses(analysisResult),
        actualFunctions: this.extractConcreteFunctions(analysisResult),
        actualDependencies: this.extractConcreteDependencies(analysisResult),
        actualExports: this.extractConcreteExports(analysisResult),
        actualImports: this.extractConcreteImports(analysisResult),
        architecturalPatterns: this.detectArchitecturalPatterns(analysisResult),
        businessDomainIndicators: this.detectBusinessDomainIndicators(analysisResult),
        qualityMetrics: this.calculateConcreteQualityMetrics(analysisResult)
      };

      logger.debug('Concrete structure extraction completed', {
        classCount: structure.actualClasses.length,
        functionCount: structure.actualFunctions.length,
        dependencyCount: structure.actualDependencies.length,
        patternCount: structure.architecturalPatterns.length,
        domainIndicators: structure.businessDomainIndicators.length
      });

      return structure;

    } catch (error) {
      logger.error('Failed to extract concrete structure', {
        filePath: analysisResult.filePath,
        error
      });
      throw error;
    }
  }

  /**
   * Extract concrete class information
   */
  private extractConcreteClasses(analysisResult: AnalysisResult): ConcreteClass[] {
    return analysisResult.classes.map(cls => ({
      name: cls.name,
      fullyQualifiedName: this.buildFullyQualifiedName(cls.name, analysisResult.filePath),
      methods: this.extractConcreteMethods(cls),
      properties: this.extractConcreteProperties(cls),
      inheritance: {
        extends: cls.extends,
        implements: cls.implements
      },
      visibility: cls.visibility,
      isAbstract: cls.isAbstract,
      sourceLocation: {
        file: cls.filePath,
        startLine: cls.startLine,
        endLine: cls.endLine,
        startColumn: 0,
        endColumn: 0
      },
      businessPurpose: this.inferBusinessPurpose(cls.name),
      designPatterns: this.detectClassDesignPatterns(cls)
    }));
  }

  /**
   * Extract concrete method information from class
   */
  private extractConcreteMethods(cls: CodeClass): ConcreteMethod[] {
    return cls.methods.map(method => ({
      name: method.name,
      signature: this.buildMethodSignature(method),
      parameters: this.extractConcreteParameters(method.parameters),
      returnType: method.returnType || 'void',
      visibility: method.visibility,
      isStatic: false, // Not available in current type
      isAsync: method.isAsync,
      complexity: method.complexity,
      sourceLocation: {
        file: method.filePath,
        startLine: method.startLine,
        endLine: method.endLine,
        startColumn: 0,
        endColumn: 0
      },
      businessPurpose: this.inferBusinessPurpose(method.name),
      sideEffects: this.analyzeSideEffects(method)
    }));
  }

  /**
   * Extract concrete function information
   */
  private extractConcreteFunctions(analysisResult: AnalysisResult): ConcreteFunction[] {
    return analysisResult.functions.map(func => ({
      name: func.name,
      signature: this.buildMethodSignature(func),
      parameters: this.extractConcreteParameters(func.parameters),
      returnType: func.returnType || 'void',
      isAsync: func.isAsync,
      isExported: func.isExported,
      complexity: func.complexity,
      sourceLocation: {
        file: func.filePath,
        startLine: func.startLine,
        endLine: func.endLine,
        startColumn: 0,
        endColumn: 0
      },
      businessPurpose: this.inferBusinessPurpose(func.name),
      dependencies: func.dependencies
    }));
  }

  /**
   * Extract concrete dependencies
   */
  private extractConcreteDependencies(analysisResult: AnalysisResult): ConcreteDependency[] {
    const dependencies: ConcreteDependency[] = [];
    
    // Process imports to create dependencies
    for (const importDecl of analysisResult.imports) {
      const dependency: ConcreteDependency = {
        name: importDecl.source,
        type: this.classifyDependencyType(importDecl.source),
        usage: 'import',
        usedSymbols: importDecl.imports.map(imp => imp.name),
        businessJustification: this.inferDependencyJustification(importDecl.source)
      };
      dependencies.push(dependency);
    }

    // Add string dependencies
    for (const dep of analysisResult.dependencies) {
      if (!dependencies.some(d => d.name === dep)) {
        dependencies.push({
          name: dep,
          type: this.classifyDependencyType(dep),
          usage: 'require',
          usedSymbols: [],
          businessJustification: this.inferDependencyJustification(dep)
        });
      }
    }

    return dependencies;
  }

  /**
   * Extract concrete exports
   */
  private extractConcreteExports(analysisResult: AnalysisResult): ConcreteExport[] {
    return analysisResult.exports.map(exp => ({
      name: exp.name,
      type: exp.type,
      isDefault: exp.isDefault,
      businessValue: this.inferBusinessValue(exp.name, exp.type)
    }));
  }

  /**
   * Extract concrete imports
   */
  private extractConcreteImports(analysisResult: AnalysisResult): ConcreteImport[] {
    return analysisResult.imports.map(imp => ({
      source: imp.source,
      imports: imp.imports.map(spec => ({
        name: spec.name,
        ...(spec.alias ? { alias: spec.alias } : {}),
        isDefault: spec.isDefault,
        isNamespace: spec.isNamespace
      })),
      businessReason: this.inferImportReason(imp.source)
    }));
  }

  /**
   * Detect architectural patterns
   */
  private detectArchitecturalPatterns(analysisResult: AnalysisResult): ArchitecturalPattern[] {
    const patterns: ArchitecturalPattern[] = [];
    
    // Analyze class and function names for patterns
    const allNames = [
      ...analysisResult.classes.map(cls => cls.name),
      ...analysisResult.functions.map(func => func.name)
    ];

    // Factory Pattern
    const factoryEvidence = allNames.filter(name => 
      name.toLowerCase().includes('factory') || 
      name.toLowerCase().includes('create')
    );
    if (factoryEvidence.length > 0) {
      patterns.push({
        name: 'Factory Pattern',
        confidence: Math.min(factoryEvidence.length * 0.3, 1.0),
        evidence: factoryEvidence,
        businessBenefit: 'Provides flexible object creation and reduces coupling'
      });
    }

    // Observer Pattern
    const observerEvidence = allNames.filter(name =>
      name.toLowerCase().includes('observer') ||
      name.toLowerCase().includes('listener') ||
      name.toLowerCase().includes('subscribe') ||
      name.toLowerCase().includes('notify')
    );
    if (observerEvidence.length > 0) {
      patterns.push({
        name: 'Observer Pattern',
        confidence: Math.min(observerEvidence.length * 0.25, 1.0),
        evidence: observerEvidence,
        businessBenefit: 'Enables loose coupling and event-driven architecture'
      });
    }

    // Repository Pattern
    const repositoryEvidence = allNames.filter(name =>
      name.toLowerCase().includes('repository') ||
      name.toLowerCase().includes('dao') ||
      name.toLowerCase().includes('store')
    );
    if (repositoryEvidence.length > 0) {
      patterns.push({
        name: 'Repository Pattern',
        confidence: Math.min(repositoryEvidence.length * 0.4, 1.0),
        evidence: repositoryEvidence,
        businessBenefit: 'Abstracts data access and improves testability'
      });
    }

    // Service Pattern
    const serviceEvidence = allNames.filter(name =>
      name.toLowerCase().includes('service') ||
      name.toLowerCase().includes('manager') ||
      name.toLowerCase().includes('handler')
    );
    if (serviceEvidence.length > 0) {
      patterns.push({
        name: 'Service Pattern',
        confidence: Math.min(serviceEvidence.length * 0.2, 1.0),
        evidence: serviceEvidence,
        businessBenefit: 'Encapsulates business logic and promotes reusability'
      });
    }

    return patterns;
  }

  /**
   * Detect business domain indicators
   */
  private detectBusinessDomainIndicators(analysisResult: AnalysisResult): BusinessDomainIndicator[] {
    const indicators: BusinessDomainIndicator[] = [];
    
    // Collect all identifiers
    const allIdentifiers = [
      ...analysisResult.classes.map(cls => cls.name),
      ...analysisResult.functions.map(func => func.name),
      ...analysisResult.classes.flatMap(cls => cls.methods.map(m => m.name)),
      ...analysisResult.classes.flatMap(cls => cls.properties.map(p => p.name))
    ].map(name => name.toLowerCase());

    // Domain keyword mappings
    const domainKeywords = {
      'E-commerce': {
        keywords: ['order', 'cart', 'payment', 'product', 'customer', 'checkout', 'inventory', 'shipping'],
        weight: 0.8
      },
      'Finance': {
        keywords: ['account', 'transaction', 'balance', 'payment', 'invoice', 'billing', 'credit', 'debit'],
        weight: 0.9
      },
      'Healthcare': {
        keywords: ['patient', 'medical', 'diagnosis', 'treatment', 'doctor', 'appointment', 'prescription'],
        weight: 0.9
      },
      'Education': {
        keywords: ['student', 'course', 'grade', 'assignment', 'teacher', 'class', 'enrollment'],
        weight: 0.8
      },
      'Authentication': {
        keywords: ['user', 'login', 'auth', 'token', 'session', 'permission', 'role', 'access'],
        weight: 0.7
      },
      'Content Management': {
        keywords: ['article', 'post', 'content', 'publish', 'editor', 'media', 'page'],
        weight: 0.7
      },
      'Communication': {
        keywords: ['message', 'chat', 'notification', 'email', 'sms', 'channel', 'conversation'],
        weight: 0.8
      }
    };

    // Analyze each domain
    for (const [domain, config] of Object.entries(domainKeywords)) {
      const matches = config.keywords.filter(keyword =>
        allIdentifiers.some(identifier => identifier.includes(keyword))
      );

      if (matches.length >= 2) {
        const confidence = Math.min((matches.length / config.keywords.length) * config.weight, 1.0);
        
        indicators.push({
          domain,
          confidence,
          evidence: matches,
          keywords: config.keywords
        });
      }
    }

    return indicators.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate concrete quality metrics
   */
  private calculateConcreteQualityMetrics(analysisResult: AnalysisResult): ConcreteQualityMetrics {
    const totalComplexity = analysisResult.functions.reduce((sum, func) => sum + func.complexity, 0);
    // Calculate average complexity for quality assessment
    const avgComplexity = analysisResult.functions.length > 0 ? totalComplexity / analysisResult.functions.length : 0;
    logger.debug('Calculated average function complexity', { avgComplexity });

    return {
      complexity: {
        cyclomatic: analysisResult.complexity.cyclomaticComplexity,
        cognitive: analysisResult.complexity.cognitiveComplexity,
        maintainability: analysisResult.complexity.maintainabilityIndex
      },
      testability: {
        score: this.calculateTestabilityScore(analysisResult),
        factors: this.getTestabilityFactors(analysisResult)
      },
      reusability: {
        score: this.calculateReusabilityScore(analysisResult),
        factors: this.getReusabilityFactors(analysisResult)
      },
      documentation: {
        coverage: this.calculateDocumentationCoverage(analysisResult),
        quality: this.calculateDocumentationQuality(analysisResult)
      }
    };
  }

  // Helper methods

  private buildFullyQualifiedName(className: string, filePath: string): string {
    const moduleName = path.basename(filePath, path.extname(filePath));
    return `${moduleName}.${className}`;
  }

  private buildMethodSignature(method: CodeFunction): string {
    const params = method.parameters.map(p => 
      `${p.name}${p.optional ? '?' : ''}: ${p.type || 'any'}`
    ).join(', ');
    return `${method.name}(${params}): ${method.returnType || 'void'}`;
  }

  private extractConcreteParameters(parameters: any[]): ConcreteParameter[] {
    return parameters.map(param => ({
      name: param.name,
      type: param.type || 'any',
      isOptional: param.optional || false,
      defaultValue: param.defaultValue,
      businessMeaning: this.inferBusinessMeaning(param.name)
    }));
  }

  private extractConcreteProperties(cls: CodeClass): ConcreteProperty[] {
    return cls.properties.map(prop => ({
      name: prop.name,
      type: prop.type || 'any',
      visibility: prop.visibility,
      isStatic: prop.isStatic,
      isReadonly: prop.isReadonly,
      defaultValue: prop.defaultValue || undefined,
      businessPurpose: this.inferBusinessPurpose(prop.name)
    }));
  }

  private classifyDependencyType(source: string): 'external' | 'internal' | 'builtin' {
    if (source.startsWith('.') || source.startsWith('/')) {
      return 'internal';
    }
    if (['fs', 'path', 'http', 'crypto', 'util'].includes(source)) {
      return 'builtin';
    }
    return 'external';
  }

  private detectClassDesignPatterns(cls: CodeClass): string[] {
    const patterns: string[] = [];
    const className = cls.name.toLowerCase();
    
    if (className.includes('factory')) patterns.push('Factory');
    if (className.includes('builder')) patterns.push('Builder');
    if (className.includes('singleton')) patterns.push('Singleton');
    if (className.includes('observer')) patterns.push('Observer');
    if (className.includes('strategy')) patterns.push('Strategy');
    if (className.includes('adapter')) patterns.push('Adapter');
    
    return patterns;
  }

  private analyzeSideEffects(method: CodeFunction): string[] {
    const sideEffects: string[] = [];
    const methodName = method.name.toLowerCase();
    
    if (methodName.includes('save') || methodName.includes('create') || methodName.includes('update')) {
      sideEffects.push('Database modification');
    }
    if (methodName.includes('delete') || methodName.includes('remove')) {
      sideEffects.push('Data deletion');
    }
    if (methodName.includes('send') || methodName.includes('notify')) {
      sideEffects.push('External communication');
    }
    if (methodName.includes('log') || methodName.includes('track')) {
      sideEffects.push('Logging/tracking');
    }
    
    return sideEffects;
  }

  private inferBusinessPurpose(name: string): string {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('user')) return 'User management and authentication';
    if (lowerName.includes('order')) return 'Order processing and management';
    if (lowerName.includes('payment')) return 'Payment processing and billing';
    if (lowerName.includes('product')) return 'Product catalog and inventory';
    if (lowerName.includes('customer')) return 'Customer relationship management';
    if (lowerName.includes('auth')) return 'Authentication and authorization';
    if (lowerName.includes('notification')) return 'Communication and notifications';
    if (lowerName.includes('report')) return 'Reporting and analytics';
    
    return 'Core business functionality';
  }

  private inferBusinessMeaning(paramName: string): string {
    const lowerName = paramName.toLowerCase();
    
    if (lowerName.includes('id')) return 'Unique identifier';
    if (lowerName.includes('name')) return 'Display name or title';
    if (lowerName.includes('email')) return 'Email address for communication';
    if (lowerName.includes('password')) return 'Authentication credential';
    if (lowerName.includes('amount')) return 'Monetary or quantity value';
    if (lowerName.includes('date')) return 'Temporal information';
    if (lowerName.includes('status')) return 'State or condition indicator';
    
    return 'Business data parameter';
  }

  private inferDependencyJustification(source: string): string {
    if (source.includes('express')) return 'Web server framework for API endpoints';
    if (source.includes('react')) return 'User interface component library';
    if (source.includes('lodash')) return 'Utility functions for data manipulation';
    if (source.includes('axios')) return 'HTTP client for external API communication';
    if (source.includes('mongoose')) return 'Database ORM for data persistence';
    if (source.includes('jwt')) return 'Authentication token management';
    
    return 'Supporting library for business functionality';
  }

  private inferBusinessValue(name: string, type: string): string {
    if (type === 'function' && name.toLowerCase().includes('api')) {
      return 'Provides external interface for business operations';
    }
    if (type === 'class' && name.toLowerCase().includes('service')) {
      return 'Encapsulates core business logic';
    }
    if (type === 'class' && name.toLowerCase().includes('model')) {
      return 'Represents business domain entity';
    }
    
    return 'Supports business functionality and operations';
  }

  private inferImportReason(source: string): string {
    return this.inferDependencyJustification(source);
  }

  private calculateTestabilityScore(analysisResult: AnalysisResult): number {
    let score = 50; // Base score
    
    // Bonus for pure functions (no side effects)
    const pureFunctions = analysisResult.functions.filter(func => 
      func.parameters.length > 0 && func.returnType && func.returnType !== 'void'
    );
    score += (pureFunctions.length / analysisResult.functions.length) * 30;
    
    // Bonus for dependency injection patterns
    const diPatterns = analysisResult.classes.filter(cls =>
      cls.methods.some(method => method.parameters.length > 0)
    );
    score += (diPatterns.length / Math.max(analysisResult.classes.length, 1)) * 20;
    
    return Math.min(score, 100);
  }

  private getTestabilityFactors(analysisResult: AnalysisResult): string[] {
    const factors: string[] = [];
    
    if (analysisResult.functions.some(f => f.parameters.length > 0)) {
      factors.push('Functions accept parameters');
    }
    if (analysisResult.functions.some(f => f.returnType && f.returnType !== 'void')) {
      factors.push('Functions return values');
    }
    if (analysisResult.classes.some(c => c.methods.length > 0)) {
      factors.push('Classes have methods');
    }
    
    return factors;
  }

  private calculateReusabilityScore(analysisResult: AnalysisResult): number {
    let score = 40; // Base score
    
    // Bonus for exported functions/classes
    const exportedItems = analysisResult.functions.filter(f => f.isExported).length +
                         analysisResult.classes.filter(c => c.isExported).length;
    const totalItems = analysisResult.functions.length + analysisResult.classes.length;
    
    if (totalItems > 0) {
      score += (exportedItems / totalItems) * 40;
    }
    
    // Bonus for generic/utility functions
    const utilityFunctions = analysisResult.functions.filter(func =>
      func.name.toLowerCase().includes('util') ||
      func.name.toLowerCase().includes('helper') ||
      func.parameters.length > 0
    );
    score += (utilityFunctions.length / Math.max(analysisResult.functions.length, 1)) * 20;
    
    return Math.min(score, 100);
  }

  private getReusabilityFactors(analysisResult: AnalysisResult): string[] {
    const factors: string[] = [];
    
    if (analysisResult.functions.some(f => f.isExported)) {
      factors.push('Exported functions available for reuse');
    }
    if (analysisResult.classes.some(c => c.isExported)) {
      factors.push('Exported classes available for reuse');
    }
    if (analysisResult.functions.some(f => f.parameters.length > 0)) {
      factors.push('Parameterized functions support different use cases');
    }
    
    return factors;
  }

  private calculateDocumentationCoverage(analysisResult: AnalysisResult): number {
    // Since we don't have documentation in the types, use naming conventions
    const totalItems = analysisResult.functions.length + analysisResult.classes.length;
    if (totalItems === 0) return 0;
    
    const wellNamedItems = [
      ...analysisResult.functions.filter(f => f.name.length > 3 && !f.name.startsWith('_')),
      ...analysisResult.classes.filter(c => c.name.length > 3 && !c.name.startsWith('_'))
    ];
    
    return Math.round((wellNamedItems.length / totalItems) * 100);
  }

  private calculateDocumentationQuality(analysisResult: AnalysisResult): number {
    // Use meaningful naming as a proxy for documentation quality
    const meaningfulNames = [
      ...analysisResult.functions.filter(f => 
        f.name.includes('get') || f.name.includes('set') || 
        f.name.includes('create') || f.name.includes('update') ||
        f.name.includes('delete') || f.name.includes('find')
      ),
      ...analysisResult.classes.filter(c => 
        c.name.endsWith('Service') || c.name.endsWith('Manager') ||
        c.name.endsWith('Controller') || c.name.endsWith('Repository')
      )
    ];
    
    const totalItems = analysisResult.functions.length + analysisResult.classes.length;
    return totalItems > 0 ? Math.round((meaningfulNames.length / totalItems) * 100) : 0;
  }
}