/**
 * Enhanced RDF Generator
 * 
 * Generates TTL files with concrete information extracted from actual code analysis.
 * Produces comprehensive knowledge graphs with real class names, method signatures,
 * dependencies, and business context placeholders.
 */

import { Store, DataFactory, Writer } from 'n3';
import * as path from 'path';
import * as fs from 'fs/promises';
import logger from '../../../utils/logger';
import { RDFGenerator } from './RDFGenerator';
import { ConcreteInformationExtractor, ConcreteCodeStructure } from './ConcreteInformationExtractor';
import { AnalysisResult } from '../ast-analyzer/types';
import {
  RDFGenerationOptions,
  RDFGenerationResult,
  RDFStatistics
} from './types';
import {
  RDF_NAMESPACES,
  ONTOLOGY_CLASSES,
  ONTOLOGY_PROPERTIES
} from './ontology';

const { namedNode, literal, quad } = DataFactory;

/**
 * Enhanced RDF Generator
 * 
 * Extends the base RDFGenerator with concrete information extraction
 * and comprehensive TTL generation with actual code details.
 */
export class EnhancedRDFGenerator extends RDFGenerator {
  private concreteExtractor: ConcreteInformationExtractor;

  constructor(options: Partial<RDFGenerationOptions> = {}) {
    super(options);
    this.concreteExtractor = new ConcreteInformationExtractor();
  }

  /**
   * Generate enhanced RDF with concrete information
   */
  async generateEnhancedRDF(
    astResult: AnalysisResult,
    modulePath: string,
    outputPath?: string
  ): Promise<RDFGenerationResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting enhanced RDF generation with concrete information', {
        modulePath,
        language: astResult.language,
        classCount: astResult.classes.length,
        functionCount: astResult.functions.length
      });

      // Extract concrete code structure
      const concreteStructure = this.concreteExtractor.extractConcreteStructure(astResult);
      
      // Generate enhanced TTL content
      const rdfContent = await this.generateConcreteRDFContent(astResult, concreteStructure, modulePath);
      
      // Calculate output path
      const finalOutputPath = outputPath || this.calculateOutputPathInternal(modulePath);
      
      // Write to file if path provided
      if (finalOutputPath && rdfContent) {
        await this.writeEnhancedTTLFile(finalOutputPath, rdfContent, astResult, concreteStructure);
      }
      
      const generationTime = Date.now() - startTime;
      
      const result: RDFGenerationResult = {
        moduleId: this.generateModuleIdInternal(modulePath),
        filePath: finalOutputPath || '',
        rdfContent: rdfContent || '',
        format: 'turtle',
        size: rdfContent ? Buffer.byteLength(rdfContent, 'utf8') : 0,
        generationTime,
        warnings: [],
        statistics: this.calculateEnhancedStatistics(concreteStructure)
      };

      logger.info('Enhanced RDF generation completed', {
        modulePath,
        size: result.size,
        generationTime,
        classes: concreteStructure.actualClasses.length,
        functions: concreteStructure.actualFunctions.length,
        patterns: concreteStructure.architecturalPatterns.length
      });

      return result;

    } catch (error) {
      logger.error('Enhanced RDF generation failed', { error, modulePath });
      throw error;
    }
  }

  /**
   * Generate concrete RDF content with actual code information
   */
  private async generateConcreteRDFContent(
    astResult: AnalysisResult,
    concreteStructure: ConcreteCodeStructure,
    modulePath: string
  ): Promise<string> {
    const store = new Store();
    const moduleId = this.generateModuleIdInternal(modulePath);
    const moduleUri = namedNode(`${RDF_NAMESPACES.module}${moduleId}`);

    // Generate module metadata
    this.addModuleMetadata(store, moduleUri, moduleId, astResult, concreteStructure);
    
    // Generate concrete class information
    this.addConcreteClasses(store, moduleUri, concreteStructure.actualClasses);
    
    // Generate concrete function information
    this.addConcreteFunctions(store, moduleUri, concreteStructure.actualFunctions);
    
    // Generate concrete dependency information
    this.addConcreteDependencies(store, moduleUri, concreteStructure.actualDependencies);
    
    // Generate architectural patterns
    this.addArchitecturalPatterns(store, moduleUri, concreteStructure.architecturalPatterns);
    
    // Generate business domain indicators
    this.addBusinessDomainIndicators(store, moduleUri, concreteStructure.businessDomainIndicators);
    
    // Generate quality metrics
    this.addQualityMetrics(store, moduleUri, concreteStructure.qualityMetrics);
    
    // Note: Business context placeholders removed - only concrete code information needed

    // Serialize to TTL
    return await this.serializeStoreToTTL(store);
  }

  /**
   * Add module metadata with concrete information
   */
  private addModuleMetadata(
    store: Store,
    moduleUri: any,
    moduleId: string,
    astResult: AnalysisResult,
    concreteStructure: ConcreteCodeStructure
  ): void {
    // Basic module properties
    store.addQuad(quad(moduleUri, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(ONTOLOGY_CLASSES.Module)));
    store.addQuad(quad(moduleUri, namedNode(ONTOLOGY_PROPERTIES.name), literal(moduleId)));
    store.addQuad(quad(moduleUri, namedNode(ONTOLOGY_PROPERTIES.language), literal(astResult.language)));
    store.addQuad(quad(moduleUri, namedNode(ONTOLOGY_PROPERTIES.version), literal('1.0.0')));
    store.addQuad(quad(moduleUri, namedNode(`${RDF_NAMESPACES.code}filePath`), literal(astResult.filePath)));
    store.addQuad(quad(moduleUri, namedNode(`${RDF_NAMESPACES.code}timestamp`), literal(astResult.timestamp.toISOString())));
    
    // Concrete statistics
    store.addQuad(quad(moduleUri, namedNode(`${RDF_NAMESPACES.code}classCount`), literal(concreteStructure.actualClasses.length)));
    store.addQuad(quad(moduleUri, namedNode(`${RDF_NAMESPACES.code}functionCount`), literal(concreteStructure.actualFunctions.length)));
    store.addQuad(quad(moduleUri, namedNode(`${RDF_NAMESPACES.code}dependencyCount`), literal(concreteStructure.actualDependencies.length)));
    store.addQuad(quad(moduleUri, namedNode(`${RDF_NAMESPACES.code}exportCount`), literal(concreteStructure.actualExports.length)));
  }

  /**
   * Add concrete class information
   */
  private addConcreteClasses(store: Store, moduleUri: any, classes: any[]): void {
    for (const concreteClass of classes) {
      const classUri = namedNode(`${RDF_NAMESPACES.code}${concreteClass.fullyQualifiedName}`);
      
      // Basic class properties
      store.addQuad(quad(classUri, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(ONTOLOGY_CLASSES.Class)));
      store.addQuad(quad(classUri, namedNode(ONTOLOGY_PROPERTIES.name), literal(concreteClass.name)));
      store.addQuad(quad(classUri, namedNode(ONTOLOGY_PROPERTIES.fullyQualifiedName), literal(concreteClass.fullyQualifiedName)));
      store.addQuad(quad(classUri, namedNode(ONTOLOGY_PROPERTIES.visibility), literal(concreteClass.visibility)));
      store.addQuad(quad(classUri, namedNode(ONTOLOGY_PROPERTIES.isAbstract), literal(concreteClass.isAbstract)));
      
      // Module relationship
      store.addQuad(quad(moduleUri, namedNode(ONTOLOGY_PROPERTIES.hasClass), classUri));
      
      // Inheritance relationships
      if (concreteClass.inheritance.extends) {
        const superClassUri = namedNode(`${RDF_NAMESPACES.code}${concreteClass.inheritance.extends}`);
        store.addQuad(quad(classUri, namedNode(ONTOLOGY_PROPERTIES.extends), superClassUri));
      }
      
      for (const interfaceName of concreteClass.inheritance.implements) {
        const interfaceUri = namedNode(`${RDF_NAMESPACES.code}${interfaceName}`);
        store.addQuad(quad(classUri, namedNode(ONTOLOGY_PROPERTIES.implements), interfaceUri));
      }
      
      // Business purpose
      if (concreteClass.businessPurpose) {
        store.addQuad(quad(classUri, namedNode(`${RDF_NAMESPACES.business}purpose`), literal(concreteClass.businessPurpose)));
      }
      
      // Design patterns
      for (const pattern of concreteClass.designPatterns) {
        store.addQuad(quad(classUri, namedNode(`${RDF_NAMESPACES.arch}implementsPattern`), literal(pattern)));
      }
      
      // Source location
      store.addQuad(quad(classUri, namedNode(ONTOLOGY_PROPERTIES.sourceFile), literal(concreteClass.sourceLocation.file)));
      store.addQuad(quad(classUri, namedNode(ONTOLOGY_PROPERTIES.startLine), literal(concreteClass.sourceLocation.startLine)));
      store.addQuad(quad(classUri, namedNode(ONTOLOGY_PROPERTIES.endLine), literal(concreteClass.sourceLocation.endLine)));
      
      // Add methods
      this.addConcreteMethods(store, classUri, concreteClass.methods);
      
      // Add properties
      this.addConcreteProperties(store, classUri, concreteClass.properties);
    }
  }

  /**
   * Add concrete method information
   */
  private addConcreteMethods(store: Store, classUri: any, methods: any[]): void {
    for (const method of methods) {
      const methodUri = namedNode(`${RDF_NAMESPACES.code}${method.name}_${this.generateHashInternal(method.signature)}`);
      
      // Basic method properties
      store.addQuad(quad(methodUri, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(ONTOLOGY_CLASSES.Method)));
      store.addQuad(quad(methodUri, namedNode(ONTOLOGY_PROPERTIES.name), literal(method.name)));
      store.addQuad(quad(methodUri, namedNode(ONTOLOGY_PROPERTIES.signature), literal(method.signature)));
      store.addQuad(quad(methodUri, namedNode(ONTOLOGY_PROPERTIES.visibility), literal(method.visibility)));
      store.addQuad(quad(methodUri, namedNode(ONTOLOGY_PROPERTIES.isStatic), literal(method.isStatic)));
      store.addQuad(quad(methodUri, namedNode(ONTOLOGY_PROPERTIES.isAsync), literal(method.isAsync)));
      store.addQuad(quad(methodUri, namedNode(`${RDF_NAMESPACES.code}returnType`), literal(method.returnType)));
      store.addQuad(quad(methodUri, namedNode(`${RDF_NAMESPACES.quality}complexity`), literal(method.complexity)));
      
      // Class relationship
      store.addQuad(quad(classUri, namedNode(ONTOLOGY_PROPERTIES.hasMethod), methodUri));
      
      // Business purpose
      if (method.businessPurpose) {
        store.addQuad(quad(methodUri, namedNode(`${RDF_NAMESPACES.business}purpose`), literal(method.businessPurpose)));
      }
      
      // Side effects
      for (const sideEffect of method.sideEffects) {
        store.addQuad(quad(methodUri, namedNode(`${RDF_NAMESPACES.code}hasSideEffect`), literal(sideEffect)));
      }
      
      // Parameters
      for (const param of method.parameters) {
        const paramUri = namedNode(`${RDF_NAMESPACES.code}${param.name}_${this.generateHashInternal(param.name)}`);
        store.addQuad(quad(paramUri, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(ONTOLOGY_CLASSES.Parameter)));
        store.addQuad(quad(paramUri, namedNode(ONTOLOGY_PROPERTIES.name), literal(param.name)));
        store.addQuad(quad(paramUri, namedNode(ONTOLOGY_PROPERTIES.type), literal(param.type)));
        store.addQuad(quad(paramUri, namedNode(ONTOLOGY_PROPERTIES.isOptional), literal(param.isOptional)));
        
        if (param.defaultValue) {
          store.addQuad(quad(paramUri, namedNode(`${RDF_NAMESPACES.code}defaultValue`), literal(param.defaultValue)));
        }
        
        if (param.businessMeaning) {
          store.addQuad(quad(paramUri, namedNode(`${RDF_NAMESPACES.business}meaning`), literal(param.businessMeaning)));
        }
        
        store.addQuad(quad(methodUri, namedNode(ONTOLOGY_PROPERTIES.hasParameter), paramUri));
      }
    }
  }

  /**
   * Add concrete function information
   */
  private addConcreteFunctions(store: Store, moduleUri: any, functions: any[]): void {
    for (const func of functions) {
      const functionUri = namedNode(`${RDF_NAMESPACES.code}${func.name}_${this.generateHashInternal(func.signature)}`);
      
      // Basic function properties
      store.addQuad(quad(functionUri, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(ONTOLOGY_CLASSES.Function)));
      store.addQuad(quad(functionUri, namedNode(ONTOLOGY_PROPERTIES.name), literal(func.name)));
      store.addQuad(quad(functionUri, namedNode(ONTOLOGY_PROPERTIES.signature), literal(func.signature)));
      store.addQuad(quad(functionUri, namedNode(ONTOLOGY_PROPERTIES.isAsync), literal(func.isAsync)));
      store.addQuad(quad(functionUri, namedNode(`${RDF_NAMESPACES.code}isExported`), literal(func.isExported)));
      store.addQuad(quad(functionUri, namedNode(`${RDF_NAMESPACES.code}returnType`), literal(func.returnType)));
      store.addQuad(quad(functionUri, namedNode(`${RDF_NAMESPACES.quality}complexity`), literal(func.complexity)));
      
      // Module relationship
      store.addQuad(quad(moduleUri, namedNode(`${RDF_NAMESPACES.code}hasFunction`), functionUri));
      
      // Business purpose
      if (func.businessPurpose) {
        store.addQuad(quad(functionUri, namedNode(`${RDF_NAMESPACES.business}purpose`), literal(func.businessPurpose)));
      }
      
      // Dependencies
      for (const dep of func.dependencies) {
        store.addQuad(quad(functionUri, namedNode(ONTOLOGY_PROPERTIES.dependsOn), literal(dep)));
      }
      
      // Parameters
      for (const param of func.parameters) {
        const paramUri = namedNode(`${RDF_NAMESPACES.code}${param.name}_${this.generateHashInternal(param.name)}`);
        store.addQuad(quad(paramUri, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(ONTOLOGY_CLASSES.Parameter)));
        store.addQuad(quad(paramUri, namedNode(ONTOLOGY_PROPERTIES.name), literal(param.name)));
        store.addQuad(quad(paramUri, namedNode(ONTOLOGY_PROPERTIES.type), literal(param.type)));
        store.addQuad(quad(paramUri, namedNode(ONTOLOGY_PROPERTIES.isOptional), literal(param.isOptional)));
        
        if (param.businessMeaning) {
          store.addQuad(quad(paramUri, namedNode(`${RDF_NAMESPACES.business}meaning`), literal(param.businessMeaning)));
        }
        
        store.addQuad(quad(functionUri, namedNode(ONTOLOGY_PROPERTIES.hasParameter), paramUri));
      }
    }
  }

  /**
   * Add concrete dependency information
   */
  private addConcreteDependencies(store: Store, moduleUri: any, dependencies: any[]): void {
    for (const dep of dependencies) {
      const depUri = namedNode(`${RDF_NAMESPACES.code}dependency_${this.generateHashInternal(dep.name)}`);
      
      // Basic dependency properties
      store.addQuad(quad(depUri, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(ONTOLOGY_CLASSES.Dependency)));
      store.addQuad(quad(depUri, namedNode(ONTOLOGY_PROPERTIES.name), literal(dep.name)));
      store.addQuad(quad(depUri, namedNode(`${RDF_NAMESPACES.code}dependencyType`), literal(dep.type)));
      store.addQuad(quad(depUri, namedNode(`${RDF_NAMESPACES.code}usage`), literal(dep.usage)));
      
      if (dep.version) {
        store.addQuad(quad(depUri, namedNode(ONTOLOGY_PROPERTIES.version), literal(dep.version)));
      }
      
      // Business justification
      if (dep.businessJustification) {
        store.addQuad(quad(depUri, namedNode(`${RDF_NAMESPACES.business}justification`), literal(dep.businessJustification)));
      }
      
      // Used symbols
      for (const symbol of dep.usedSymbols) {
        store.addQuad(quad(depUri, namedNode(`${RDF_NAMESPACES.code}usesSymbol`), literal(symbol)));
      }
      
      // Module relationship
      store.addQuad(quad(moduleUri, namedNode(ONTOLOGY_PROPERTIES.dependsOn), depUri));
    }
  }

  /**
   * Add architectural patterns
   */
  private addArchitecturalPatterns(store: Store, moduleUri: any, patterns: any[]): void {
    for (const pattern of patterns) {
      const patternUri = namedNode(`${RDF_NAMESPACES.arch}pattern_${this.generateHashInternal(pattern.name)}`);
      
      store.addQuad(quad(patternUri, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(`${RDF_NAMESPACES.arch}ArchitecturalPattern`)));
      store.addQuad(quad(patternUri, namedNode(ONTOLOGY_PROPERTIES.name), literal(pattern.name)));
      store.addQuad(quad(patternUri, namedNode(`${RDF_NAMESPACES.arch}confidence`), literal(pattern.confidence)));
      
      if (pattern.businessBenefit) {
        store.addQuad(quad(patternUri, namedNode(`${RDF_NAMESPACES.business}benefit`), literal(pattern.businessBenefit)));
      }
      
      // Evidence
      for (const evidence of pattern.evidence) {
        store.addQuad(quad(patternUri, namedNode(`${RDF_NAMESPACES.arch}evidence`), literal(evidence)));
      }
      
      store.addQuad(quad(moduleUri, namedNode(`${RDF_NAMESPACES.arch}implementsPattern`), patternUri));
    }
  }

  /**
   * Add business domain indicators
   */
  private addBusinessDomainIndicators(store: Store, moduleUri: any, indicators: any[]): void {
    for (const indicator of indicators) {
      const domainUri = namedNode(`${RDF_NAMESPACES.business}domain_${this.generateHashInternal(indicator.domain)}`);
      
      store.addQuad(quad(domainUri, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(`${RDF_NAMESPACES.business}BusinessDomain`)));
      store.addQuad(quad(domainUri, namedNode(ONTOLOGY_PROPERTIES.name), literal(indicator.domain)));
      store.addQuad(quad(domainUri, namedNode(`${RDF_NAMESPACES.business}confidence`), literal(indicator.confidence)));
      
      // Evidence and keywords
      for (const evidence of indicator.evidence) {
        store.addQuad(quad(domainUri, namedNode(`${RDF_NAMESPACES.business}evidence`), literal(evidence)));
      }
      
      for (const keyword of indicator.keywords) {
        store.addQuad(quad(domainUri, namedNode(`${RDF_NAMESPACES.business}keyword`), literal(keyword)));
      }
      
      store.addQuad(quad(moduleUri, namedNode(`${RDF_NAMESPACES.business}belongsToDomain`), domainUri));
    }
  }

  /**
   * Add quality metrics
   */
  private addQualityMetrics(store: Store, moduleUri: any, metrics: any): void {
    const metricsUri = namedNode(`${RDF_NAMESPACES.quality}metrics_${this.generateHashInternal('metrics')}`);
    
    store.addQuad(quad(metricsUri, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(`${RDF_NAMESPACES.quality}QualityMetrics`)));
    
    // Complexity metrics
    store.addQuad(quad(metricsUri, namedNode(`${RDF_NAMESPACES.quality}cyclomaticComplexity`), literal(metrics.complexity.cyclomatic)));
    store.addQuad(quad(metricsUri, namedNode(`${RDF_NAMESPACES.quality}cognitiveComplexity`), literal(metrics.complexity.cognitive)));
    store.addQuad(quad(metricsUri, namedNode(`${RDF_NAMESPACES.quality}maintainability`), literal(metrics.complexity.maintainability)));
    
    // Testability metrics
    store.addQuad(quad(metricsUri, namedNode(`${RDF_NAMESPACES.quality}testabilityScore`), literal(metrics.testability.score)));
    for (const factor of metrics.testability.factors) {
      store.addQuad(quad(metricsUri, namedNode(`${RDF_NAMESPACES.quality}testabilityFactor`), literal(factor)));
    }
    
    // Reusability metrics
    store.addQuad(quad(metricsUri, namedNode(`${RDF_NAMESPACES.quality}reusabilityScore`), literal(metrics.reusability.score)));
    for (const factor of metrics.reusability.factors) {
      store.addQuad(quad(metricsUri, namedNode(`${RDF_NAMESPACES.quality}reusabilityFactor`), literal(factor)));
    }
    
    // Documentation metrics
    store.addQuad(quad(metricsUri, namedNode(`${RDF_NAMESPACES.quality}documentationCoverage`), literal(metrics.documentation.coverage)));
    store.addQuad(quad(metricsUri, namedNode(`${RDF_NAMESPACES.quality}documentationQuality`), literal(metrics.documentation.quality)));
    
    store.addQuad(quad(moduleUri, namedNode(`${RDF_NAMESPACES.quality}hasMetrics`), metricsUri));
  }

  /**
   * Add concrete properties
   */
  private addConcreteProperties(store: Store, classUri: any, properties: any[]): void {
    for (const prop of properties) {
      const propUri = namedNode(`${RDF_NAMESPACES.code}${prop.name}_${this.generateHashInternal(prop.name)}`);
      
      store.addQuad(quad(propUri, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(ONTOLOGY_CLASSES.Property)));
      store.addQuad(quad(propUri, namedNode(ONTOLOGY_PROPERTIES.name), literal(prop.name)));
      store.addQuad(quad(propUri, namedNode(ONTOLOGY_PROPERTIES.type), literal(prop.type)));
      store.addQuad(quad(propUri, namedNode(ONTOLOGY_PROPERTIES.visibility), literal(prop.visibility)));
      store.addQuad(quad(propUri, namedNode(ONTOLOGY_PROPERTIES.isStatic), literal(prop.isStatic)));
      store.addQuad(quad(propUri, namedNode(ONTOLOGY_PROPERTIES.isReadonly), literal(prop.isReadonly)));
      
      if (prop.defaultValue) {
        store.addQuad(quad(propUri, namedNode(`${RDF_NAMESPACES.code}defaultValue`), literal(prop.defaultValue)));
      }
      
      if (prop.businessPurpose) {
        store.addQuad(quad(propUri, namedNode(`${RDF_NAMESPACES.business}purpose`), literal(prop.businessPurpose)));
      }
      
      store.addQuad(quad(classUri, namedNode(ONTOLOGY_PROPERTIES.hasProperty), propUri));
    }
  }

  /**
   * Serialize store to TTL with enhanced formatting
   */
  private async serializeStoreToTTL(store: Store): Promise<string> {
    return new Promise((resolve, reject) => {
      const quads = store.getQuads(null, null, null, null);
      
      if (quads.length === 0) {
        resolve(this.generateEmptyTTL());
        return;
      }

      const writer = new Writer({
        format: 'text/turtle',
        prefixes: {
          code: RDF_NAMESPACES.code,
          module: RDF_NAMESPACES.module,
          arch: RDF_NAMESPACES.arch,
          business: RDF_NAMESPACES.business,
          quality: RDF_NAMESPACES.quality,
          rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
          owl: 'http://www.w3.org/2002/07/owl#',
          xsd: 'http://www.w3.org/2001/XMLSchema#'
        }
      });

      writer.addQuads(quads);
      
      writer.end((error, result) => {
        if (error) {
          reject(error);
        } else {
          const enhancedTTL = this.addEnhancedComments(result || '');
          resolve(enhancedTTL);
        }
      });
    });
  }

  /**
   * Add enhanced comments for LLM and developer understanding
   */
  private addEnhancedComments(ttlContent: string): string {
    const header = `# Enhanced Module Knowledge Graph
# Generated by AASWE Enhanced RDF Generator
# 
# This file contains concrete code structure information extracted from actual source code analysis.
# It includes real class names, method signatures, dependencies, and architectural patterns
# detected in the codebase, along with placeholders for business context enhancement.
#
# BUSINESS CONTEXT ENHANCEMENT INSTRUCTIONS:
# 1. Replace placeholder values (marked with [PLACEHOLDER]) with actual business information
# 2. Add domain-specific knowledge in the business context sections
# 3. Enhance method and class descriptions with business purpose and meaning
# 4. Document business rules, constraints, and use cases relevant to this module
# 5. Maintain RDF syntax when making manual edits
#
# CONCRETE INFORMATION INCLUDED:
# - Actual class names and hierarchies from source code
# - Real method signatures with parameter types and return types
# - Concrete dependency relationships and used symbols
# - Detected architectural patterns with confidence scores
# - Business domain indicators based on naming analysis
# - Quality metrics including complexity and maintainability scores
#
# Generated at: ${new Date().toISOString()}
#

`;
    
    return header + ttlContent;
  }

  /**
   * Generate empty TTL with placeholders
   */
  private generateEmptyTTL(): string {
    return `@prefix code: <${RDF_NAMESPACES.code}> .
@prefix module: <${RDF_NAMESPACES.module}> .
@prefix arch: <${RDF_NAMESPACES.arch}> .
@prefix business: <${RDF_NAMESPACES.business}> .
@prefix quality: <${RDF_NAMESPACES.quality}> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# No concrete code structure found - this may indicate an analysis issue
# or an empty/unsupported file type.
`;
  }

  /**
   * Write enhanced TTL file with metadata
   */
  private async writeEnhancedTTLFile(
    filePath: string,
    content: string,
    astResult: AnalysisResult,
    concreteStructure: ConcreteCodeStructure
  ): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      // Create enhanced metadata
      const metadata = `# Enhanced TTL Metadata:
# Generated: ${new Date().toISOString()}
# Source: ${astResult.filePath}
# Language: ${astResult.language}
# Classes: ${concreteStructure.actualClasses.length}
# Functions: ${concreteStructure.actualFunctions.length}
# Dependencies: ${concreteStructure.actualDependencies.length}
# Patterns: ${concreteStructure.architecturalPatterns.length}
#

`;
      
      const finalContent = metadata + content;
      
      // Write file
      await fs.writeFile(filePath, finalContent, 'utf8');
      
      logger.info('Enhanced TTL file written successfully', {
        filePath,
        size: Buffer.byteLength(finalContent, 'utf8'),
        classes: concreteStructure.actualClasses.length,
        functions: concreteStructure.actualFunctions.length
      });
      
    } catch (error) {
      logger.error('Failed to write enhanced TTL file', { error, filePath });
      throw error;
    }
  }

  /**
   * Internal helper methods to avoid accessing private base class methods
   */
  private generateModuleIdInternal(modulePath: string): string {
    return path.basename(modulePath, path.extname(modulePath));
  }

  private generateHashInternal(content: string): string {
    return require('crypto').createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private calculateOutputPathInternal(modulePath: string): string {
    const dir = path.dirname(modulePath);
    return path.join(dir, '.module-knowledge.ttl');
  }

  private calculateEnhancedStatistics(concreteStructure: ConcreteCodeStructure): RDFStatistics {
    return {
      totalTriples: 0, // Will be calculated after RDF generation
      classCount: concreteStructure.actualClasses.length,
      methodCount: concreteStructure.actualClasses.reduce((sum, cls) => sum + cls.methods.length, 0) + concreteStructure.actualFunctions.length,
      propertyCount: concreteStructure.actualClasses.reduce((sum, cls) => sum + cls.properties.length, 0),
      dependencyCount: concreteStructure.actualDependencies.length,
      documentationTriples: 0, // Will be calculated after RDF generation
      businessContextTriples: 0, // Will be calculated after RDF generation
      qualityMetricTriples: 0 // Will be calculated after RDF generation
    };
  }
}