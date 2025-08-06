/**
 * RDF Validator
 * 
 * Production-quality validator for RDF/TTL files ensuring syntax correctness,
 * semantic consistency, and compliance with the AASWE ontology schema.
 */

import { Parser, Store, DataFactory } from 'n3';
import * as fs from 'fs/promises';
import {
  RDFValidationResult,
  RDFValidationError,
  RDFValidationWarning,
  RDFStatistics
} from './types';
import {
  ONTOLOGY_CLASSES,
  ONTOLOGY_PROPERTIES,
  VALIDATION_RULES,
  RDF_NAMESPACES
} from './ontology';

const { namedNode } = DataFactory;

/**
 * Production-Quality RDF Validator
 * 
 * Validates RDF content for syntax, semantics, and schema compliance
 * with comprehensive error reporting and suggestions.
 */
export class RDFValidator {
  private readonly parser: Parser;
  private readonly store: Store;
  private errors: RDFValidationError[] = [];
  private warnings: RDFValidationWarning[] = [];

  constructor() {
    this.parser = new Parser({ format: 'text/turtle' });
    this.store = new Store();
  }

  /**
   * Validate RDF Content
   */
  async validateContent(rdfContent: string): Promise<RDFValidationResult> {
    this.resetValidation();

    try {
      // Parse RDF content
      await this.parseRDF(rdfContent);
      
      // Validate syntax and structure
      this.validateSyntax();
      
      // Validate against ontology schema
      this.validateSchema();
      
      // Validate semantic consistency
      this.validateSemantics();
      
      // Check best practices
      this.checkBestPractices();
      
      return {
        isValid: this.errors.length === 0,
        errors: [...this.errors],
        warnings: [...this.warnings],
        statistics: this.calculateStatistics()
      };
      
    } catch (error) {
      this.addError('syntax', `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      
      return {
        isValid: false,
        errors: [...this.errors],
        warnings: [...this.warnings],
        statistics: this.calculateStatistics()
      };
    }
  }

  /**
   * Validate RDF File
   */
  async validateFile(filePath: string): Promise<RDFValidationResult> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return await this.validateContent(content);
    } catch (error) {
      this.addError('syntax', `File read error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      
      return {
        isValid: false,
        errors: [...this.errors],
        warnings: [...this.warnings],
        statistics: this.calculateStatistics()
      };
    }
  }

  /**
   * Parse RDF Content
   */
  private async parseRDF(rdfContent: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const quads: any[] = [];
      
      this.parser.parse(rdfContent, (error, quad) => {
        if (error) {
          reject(error);
          return;
        }
        
        if (quad) {
          quads.push(quad);
        } else {
          // Parsing complete
          this.store.addQuads(quads);
          resolve();
        }
      });
    });
  }

  /**
   * Validate Syntax
   */
  private validateSyntax(): void {
    const quads = this.store.getQuads(null, null, null, null);
    
    if (quads.length === 0) {
      this.addError('syntax', 'No RDF triples found in content', 'error');
      return;
    }

    // Check for required namespaces
    this.validateNamespaces();
    
    // Check URI validity
    this.validateURIs();
    
    // Check literal types
    this.validateLiterals();
  }

  /**
   * Validate Namespaces
   */
  private validateNamespaces(): void {
    const quads = this.store.getQuads(null, null, null, null);
    const usedNamespaces = new Set<string>();
    
    quads.forEach(quad => {
      if (quad.subject.termType === 'NamedNode') {
        const namespace = this.extractNamespace(quad.subject.value);
        if (namespace) usedNamespaces.add(namespace);
      }
      
      if (quad.predicate.termType === 'NamedNode') {
        const namespace = this.extractNamespace(quad.predicate.value);
        if (namespace) usedNamespaces.add(namespace);
      }
      
      if (quad.object.termType === 'NamedNode') {
        const namespace = this.extractNamespace(quad.object.value);
        if (namespace) usedNamespaces.add(namespace);
      }
    });

    // Check for required AASWE namespaces
    const requiredNamespaces = Object.values(RDF_NAMESPACES);
    const missingNamespaces = requiredNamespaces.filter(ns => !usedNamespaces.has(ns));
    
    if (missingNamespaces.length > 0) {
      this.addWarning(
        'best_practice',
        `Missing recommended namespaces: ${missingNamespaces.join(', ')}`,
        'Consider using AASWE ontology namespaces for better compatibility'
      );
    }
  }

  /**
   * Validate URIs
   */
  private validateURIs(): void {
    const quads = this.store.getQuads(null, null, null, null);
    
    quads.forEach(quad => {
      // Validate subject URIs
      if (quad.subject.termType === 'NamedNode') {
        this.validateURI(quad.subject.value, 'subject');
      }
      
      // Validate predicate URIs
      if (quad.predicate.termType === 'NamedNode') {
        this.validateURI(quad.predicate.value, 'predicate');
      }
      
      // Validate object URIs
      if (quad.object.termType === 'NamedNode') {
        this.validateURI(quad.object.value, 'object');
      }
    });
  }

  /**
   * Validate Single URI
   */
  private validateURI(uri: string, position: string): void {
    try {
      new URL(uri);
    } catch {
      this.addError('syntax', `Invalid URI in ${position}: ${uri}`, 'error');
    }
    
    // Check for common URI issues
    if (uri.includes(' ')) {
      this.addError('syntax', `Invalid URI in ${position}: ${uri}`, 'error');
    }
    
    if (uri.length > 2000) {
      this.addWarning('performance', `Very long URI in ${position}: ${uri.substring(0, 50)}...`, 'Consider using shorter URIs for better performance');
    }
  }

  /**
   * Validate Literals
   */
  private validateLiterals(): void {
    const quads = this.store.getQuads(null, null, null, null);
    
    quads.forEach(quad => {
      if (quad.object.termType === 'Literal') {
        this.validateLiteral(quad.object, quad.predicate.value);
      }
    });
  }

  /**
   * Validate Single Literal
   */
  private validateLiteral(literal: any, predicate: string): void {
    const value = literal.value;
    const datatype = literal.datatype?.value;
    
    // Check string length constraints
    if (datatype === 'http://www.w3.org/2001/XMLSchema#string' || !datatype) {
      if (value.length > VALIDATION_RULES.constraints.maxStringLength) {
        this.addWarning(
          'performance',
          `Very long string literal: ${value.substring(0, 50)}...`,
          'Consider breaking down large text into smaller chunks'
        );
      }
    }
    
    // Validate specific datatypes
    if (datatype) {
      this.validateDatatypeLiteral(value, datatype, predicate);
    }
  }

  /**
   * Validate Datatype Literals
   */
  private validateDatatypeLiteral(value: string, datatype: string, _predicate: string): void {
    switch (datatype) {
      case 'http://www.w3.org/2001/XMLSchema#integer':
        if (!/^-?\d+$/.test(value)) {
          this.addError('semantic', `Invalid integer value: ${value}`, 'error');
        }
        break;
        
      case 'http://www.w3.org/2001/XMLSchema#decimal':
      case 'http://www.w3.org/2001/XMLSchema#double':
        if (!/^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(value)) {
          this.addError('semantic', `Invalid numeric value: ${value}`, 'error');
        }
        break;
        
      case 'http://www.w3.org/2001/XMLSchema#boolean':
        if (!['true', 'false', '1', '0'].includes(value)) {
          this.addError('semantic', `Invalid boolean value: ${value}`, 'error');
        }
        break;
        
      case 'http://www.w3.org/2001/XMLSchema#dateTime':
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
          this.addError('semantic', `Invalid dateTime value: ${value}`, 'error');
        }
        break;
    }
  }

  /**
   * Validate Schema Compliance
   */
  private validateSchema(): void {
    this.validateRequiredProperties();
    this.validatePropertyDomains();
    this.validatePropertyRanges();
    this.validateClassHierarchy();
  }

  /**
   * Validate Required Properties
   */
  private validateRequiredProperties(): void {
    const classes = Object.keys(VALIDATION_RULES.required);
    
    classes.forEach(classUri => {
      const instances = this.store.getQuads(
        null,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode(classUri),
        null
      );
      
      instances.forEach(instance => {
        const requiredProps = VALIDATION_RULES.required[classUri];
        
        requiredProps.forEach(propUri => {
          const hasProperty = this.store.getQuads(instance.subject, namedNode(propUri), null, null);
          
          if (hasProperty.length === 0) {
            this.addError(
              'schema',
              `Missing required property ${propUri} for instance ${instance.subject.value}`,
              'error'
            );
          }
        });
      });
    });
  }

  /**
   * Validate Property Domains
   */
  private validatePropertyDomains(): void {
    const propertyQuads = this.store.getQuads(null, null, null, null);
    
    propertyQuads.forEach(quad => {
      const predicate = quad.predicate.value;
      
      if (predicate === ONTOLOGY_PROPERTIES.hasMethod) {
        const subjectType = this.store.getQuads(quad.subject, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null, null);
        const isClass = subjectType.some(t => t.object.equals(namedNode(ONTOLOGY_CLASSES.Class)));
        
        if (!isClass) {
          this.addError('schema', `Property ${predicate} used with incorrect subject type`, 'error');
        }
      }
    });
  }

  /**
   * Validate Property Ranges
   */
  private validatePropertyRanges(): void {
    const propertyQuads = this.store.getQuads(null, null, null, null);
    
    propertyQuads.forEach(quad => {
      const predicate = quad.predicate.value;
      
      if (predicate === ONTOLOGY_PROPERTIES.extends && quad.object.termType === 'NamedNode') {
        const objectType = this.store.getQuads(quad.object, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null, null);
        const isClass = objectType.some(t => t.object.equals(namedNode(ONTOLOGY_CLASSES.Class)));
        
        if (!isClass) {
          this.addError('schema', `Property ${predicate} has incorrect object type`, 'error');
        }
      }
    });
  }

  /**
   * Validate Class Hierarchy
   */
  private validateClassHierarchy(): void {
    // Check for circular inheritance
    const inheritanceQuads = this.store.getQuads(null, namedNode(ONTOLOGY_PROPERTIES.extends), null, null);
    
    inheritanceQuads.forEach(quad => {
      if (this.hasCircularInheritance(quad.subject.value, quad.object.value)) {
        this.addError(
          'semantic',
          `Circular inheritance detected: ${quad.subject.value} -> ${quad.object.value}`,
          'error'
        );
      }
    });
  }

  /**
   * Check for Circular Inheritance
   */
  private hasCircularInheritance(child: string, parent: string, visited: Set<string> = new Set()): boolean {
    if (visited.has(child)) {
      return true;
    }
    
    if (child === parent) {
      return true;
    }
    
    visited.add(child);
    
    const parentQuads = this.store.getQuads(namedNode(parent), namedNode(ONTOLOGY_PROPERTIES.extends), null, null);
    
    for (const quad of parentQuads) {
      if (this.hasCircularInheritance(child, quad.object.value, new Set(visited))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Validate Semantic Consistency
   */
  private validateSemantics(): void {
    this.validateUniqueIdentifiers();
    this.validateReferentialIntegrity();
    this.validateBusinessRules();
  }

  /**
   * Validate Unique Identifiers
   */
  private validateUniqueIdentifiers(): void {
    const nameQuads = this.store.getQuads(null, namedNode(ONTOLOGY_PROPERTIES.fullyQualifiedName), null, null);
    const names = new Map<string, string[]>();
    
    nameQuads.forEach(quad => {
      const name = quad.object.value;
      if (!names.has(name)) {
        names.set(name, []);
      }
      names.get(name)!.push(quad.subject.value);
    });
    
    names.forEach((subjects, name) => {
      if (subjects.length > 1) {
        this.addWarning(
          'best_practice',
          `Duplicate fully qualified name: ${name} used by ${subjects.join(', ')}`,
          'Consider using unique identifiers for better clarity'
        );
      }
    });
  }

  /**
   * Validate Referential Integrity
   */
  private validateReferentialIntegrity(): void {
    // Check that all referenced entities exist
    const referenceProperties = [
      ONTOLOGY_PROPERTIES.extends,
      ONTOLOGY_PROPERTIES.implements,
      ONTOLOGY_PROPERTIES.dependsOn
    ];
    
    referenceProperties.forEach(prop => {
      const refs = this.store.getQuads(null, namedNode(prop), null, null);
      
      refs.forEach(ref => {
        if (ref.object.termType === 'NamedNode') {
          const exists = this.store.getQuads(ref.object, null, null, null);
          
          if (exists.length === 0) {
            this.addWarning(
              'best_practice',
              `Reference to undefined entity: ${ref.object.value}`,
              'Ensure all referenced entities are defined in the knowledge graph'
            );
          }
        }
      });
    });
  }

  /**
   * Validate Business Rules
   */
  private validateBusinessRules(): void {
    // Validate business rule consistency across the knowledge graph
    const businessRuleQuads = this.store.getQuads(null, namedNode(`${RDF_NAMESPACES.business}implementsRule`), null, null);
    
    businessRuleQuads.forEach(quad => {
      // Ensure business rules are properly defined and consistent
      const ruleExists = this.store.getQuads(quad.object, null, null, null);
      if (ruleExists.length === 0) {
        this.addWarning(
          'business',
          `Business rule ${quad.object.value} is referenced but not defined`,
          'Define the business rule or remove the reference'
        );
      }
    });
  }

  /**
   * Check Best Practices
   */
  private checkBestPractices(): void {
    this.checkDocumentation();
    this.checkNamingConventions();
    this.checkComplexityMetrics();
  }

  /**
   * Check Documentation Coverage
   */
  private checkDocumentation(): void {
    const classes = this.store.getQuads(null, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(ONTOLOGY_CLASSES.Class), null);
    
    classes.forEach(classQuad => {
      const hasDoc = this.store.getQuads(classQuad.subject, namedNode(ONTOLOGY_PROPERTIES.summary), null, null);
      
      if (hasDoc.length === 0) {
        this.addWarning(
          'best_practice',
          `Class ${classQuad.subject.value} lacks documentation`,
          'Add summary and description for better LLM understanding'
        );
      }
    });
  }

  /**
   * Check Naming Conventions
   */
  private checkNamingConventions(): void {
    const nameQuads = this.store.getQuads(null, namedNode(ONTOLOGY_PROPERTIES.name), null, null);
    
    nameQuads.forEach(quad => {
      const name = quad.object.value;
      
      // Check naming patterns
      if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
        this.addWarning(
          'best_practice',
          `Non-standard naming convention: ${name}`,
          'Consider using PascalCase for class names'
        );
      }
    });
  }

  /**
   * Check Complexity Metrics
   */
  private checkComplexityMetrics(): void {
    const complexityQuads = this.store.getQuads(null, namedNode(ONTOLOGY_PROPERTIES.cyclomaticComplexity), null, null);
    
    complexityQuads.forEach(quad => {
      const complexity = parseInt(quad.object.value);
      
      if (complexity > 10) {
        this.addWarning(
          'best_practice',
          `High cyclomatic complexity: ${complexity} for ${quad.subject.value}`,
          'Consider refactoring to reduce complexity'
        );
      }
    });
  }

  /**
   * Helper Methods
   */
  private resetValidation(): void {
    this.errors = [];
    this.warnings = [];
    this.store.removeQuads(this.store.getQuads(null, null, null, null));
  }

  private addError(type: string, message: string, severity: 'error' | 'warning', line?: number, column?: number): void {
    this.errors.push({
      type: type as any,
      message,
      ...(line !== undefined && { line }),
      ...(column !== undefined && { column }),
      severity
    });
  }

  private addWarning(type: string, message: string, suggestion: string): void {
    this.warnings.push({
      type: type as any,
      message,
      suggestion
    });
  }

  private extractNamespace(uri: string): string | null {
    const match = uri.match(/^(https?:\/\/[^\/]+\/[^#]*[#\/])/);
    return match ? match[1] : null;
  }

  private calculateStatistics(): RDFStatistics {
    const quads = this.store.getQuads(null, null, null, null);
    
    return {
      totalTriples: quads.length,
      classCount: this.store.getQuads(null, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(ONTOLOGY_CLASSES.Class), null).length,
      methodCount: this.store.getQuads(null, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(ONTOLOGY_CLASSES.Method), null).length,
      propertyCount: this.store.getQuads(null, namedNode(ONTOLOGY_PROPERTIES.hasProperty), null, null).length,
      dependencyCount: this.store.getQuads(null, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(ONTOLOGY_CLASSES.Dependency), null).length,
      documentationTriples: this.store.getQuads(null, namedNode(ONTOLOGY_PROPERTIES.summary), null, null).length +
                           this.store.getQuads(null, namedNode(ONTOLOGY_PROPERTIES.description), null, null).length,
      businessContextTriples: quads.filter(q => q.predicate.value.includes(RDF_NAMESPACES.business)).length,
      qualityMetricTriples: quads.filter(q => q.predicate.value.includes(RDF_NAMESPACES.quality)).length
    };
  }
}