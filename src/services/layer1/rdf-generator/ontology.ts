/**
 * RDF Ontology Schema
 * 
 * Defines the comprehensive ontology schema for code knowledge representation,
 * optimized for both Neo4j ingestion and direct LLM consumption.
 */

import { RDFNamespaces } from './types';

/**
 * Standard RDF Namespaces
 */
export const RDF_NAMESPACES: RDFNamespaces = {
  code: 'https://aaswe.ai/ontology/code#',
  module: 'https://aaswe.ai/ontology/module#',
  arch: 'https://aaswe.ai/ontology/architecture#',
  business: 'https://aaswe.ai/ontology/business#',
  quality: 'https://aaswe.ai/ontology/quality#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  xsd: 'http://www.w3.org/2001/XMLSchema#'
} as const;

/**
 * Core Ontology Classes
 */
export const ONTOLOGY_CLASSES = {
  // Core Code Elements
  Module: `${RDF_NAMESPACES.code}Module`,
  Class: `${RDF_NAMESPACES.code}Class`,
  Interface: `${RDF_NAMESPACES.code}Interface`,
  Method: `${RDF_NAMESPACES.code}Method`,
  Function: `${RDF_NAMESPACES.code}Function`,
  Property: `${RDF_NAMESPACES.code}Property`,
  Parameter: `${RDF_NAMESPACES.code}Parameter`,
  Type: `${RDF_NAMESPACES.code}Type`,
  Annotation: `${RDF_NAMESPACES.code}Annotation`,
  
  // Dependencies and Relationships
  Dependency: `${RDF_NAMESPACES.code}Dependency`,
  Import: `${RDF_NAMESPACES.code}Import`,
  Export: `${RDF_NAMESPACES.code}Export`,
  Inheritance: `${RDF_NAMESPACES.code}Inheritance`,
  Implementation: `${RDF_NAMESPACES.code}Implementation`,
  Composition: `${RDF_NAMESPACES.code}Composition`,
  Association: `${RDF_NAMESPACES.code}Association`,
  
  // Documentation and Knowledge
  Documentation: `${RDF_NAMESPACES.code}Documentation`,
  CodeExample: `${RDF_NAMESPACES.code}CodeExample`,
  Comment: `${RDF_NAMESPACES.code}Comment`,
  
  // Architecture and Patterns
  ArchitecturalPattern: `${RDF_NAMESPACES.arch}Pattern`,
  DesignPattern: `${RDF_NAMESPACES.arch}DesignPattern`,
  Component: `${RDF_NAMESPACES.arch}Component`,
  Layer: `${RDF_NAMESPACES.arch}Layer`,
  Service: `${RDF_NAMESPACES.arch}Service`,
  
  // Business Context
  BusinessDomain: `${RDF_NAMESPACES.business}Domain`,
  BusinessRule: `${RDF_NAMESPACES.business}Rule`,
  UseCase: `${RDF_NAMESPACES.business}UseCase`,
  Stakeholder: `${RDF_NAMESPACES.business}Stakeholder`,
  QualityAttribute: `${RDF_NAMESPACES.business}QualityAttribute`,
  Constraint: `${RDF_NAMESPACES.business}Constraint`,
  
  // Quality and Metrics
  ComplexityMetric: `${RDF_NAMESPACES.quality}ComplexityMetric`,
  QualityMetric: `${RDF_NAMESPACES.quality}QualityMetric`,
  TechnicalDebt: `${RDF_NAMESPACES.quality}TechnicalDebt`,
  CodeSmell: `${RDF_NAMESPACES.quality}CodeSmell`,
  SecurityIssue: `${RDF_NAMESPACES.quality}SecurityIssue`,
  TestCoverage: `${RDF_NAMESPACES.quality}TestCoverage`,
  PerformanceMetric: `${RDF_NAMESPACES.quality}PerformanceMetric`
} as const;

/**
 * Core Ontology Properties
 */
export const ONTOLOGY_PROPERTIES = {
  // Basic Properties
  name: `${RDF_NAMESPACES.code}name`,
  fullyQualifiedName: `${RDF_NAMESPACES.code}fullyQualifiedName`,
  signature: `${RDF_NAMESPACES.code}signature`,
  visibility: `${RDF_NAMESPACES.code}visibility`,
  type: `${RDF_NAMESPACES.code}type`,
  version: `${RDF_NAMESPACES.code}version`,
  language: `${RDF_NAMESPACES.code}language`,
  
  // Structural Properties
  hasClass: `${RDF_NAMESPACES.code}hasClass`,
  hasMethod: `${RDF_NAMESPACES.code}hasMethod`,
  hasProperty: `${RDF_NAMESPACES.code}hasProperty`,
  hasParameter: `${RDF_NAMESPACES.code}hasParameter`,
  hasAnnotation: `${RDF_NAMESPACES.code}hasAnnotation`,
  hasDocumentation: `${RDF_NAMESPACES.code}hasDocumentation`,
  
  // Relationship Properties
  extends: `${RDF_NAMESPACES.code}extends`,
  implements: `${RDF_NAMESPACES.code}implements`,
  dependsOn: `${RDF_NAMESPACES.code}dependsOn`,
  imports: `${RDF_NAMESPACES.code}imports`,
  exports: `${RDF_NAMESPACES.code}exports`,
  calls: `${RDF_NAMESPACES.code}calls`,
  uses: `${RDF_NAMESPACES.code}uses`,
  contains: `${RDF_NAMESPACES.code}contains`,
  
  // Behavioral Properties
  isAbstract: `${RDF_NAMESPACES.code}isAbstract`,
  isStatic: `${RDF_NAMESPACES.code}isStatic`,
  isAsync: `${RDF_NAMESPACES.code}isAsync`,
  isOptional: `${RDF_NAMESPACES.code}isOptional`,
  isReadonly: `${RDF_NAMESPACES.code}isReadonly`,
  isDeprecated: `${RDF_NAMESPACES.code}isDeprecated`,
  
  // Location Properties
  sourceFile: `${RDF_NAMESPACES.code}sourceFile`,
  startLine: `${RDF_NAMESPACES.code}startLine`,
  endLine: `${RDF_NAMESPACES.code}endLine`,
  startColumn: `${RDF_NAMESPACES.code}startColumn`,
  endColumn: `${RDF_NAMESPACES.code}endColumn`,
  
  // Documentation Properties
  summary: `${RDF_NAMESPACES.code}summary`,
  description: `${RDF_NAMESPACES.code}description`,
  example: `${RDF_NAMESPACES.code}example`,
  seeAlso: `${RDF_NAMESPACES.code}seeAlso`,
  since: `${RDF_NAMESPACES.code}since`,
  deprecated: `${RDF_NAMESPACES.code}deprecated`,
  
  // Architecture Properties
  followsPattern: `${RDF_NAMESPACES.arch}followsPattern`,
  belongsToLayer: `${RDF_NAMESPACES.arch}belongsToLayer`,
  providesService: `${RDF_NAMESPACES.arch}providesService`,
  consumesService: `${RDF_NAMESPACES.arch}consumesService`,
  
  // Business Properties
  belongsToDomain: `${RDF_NAMESPACES.business}belongsToDomain`,
  implementsRule: `${RDF_NAMESPACES.business}implementsRule`,
  supportsUseCase: `${RDF_NAMESPACES.business}supportsUseCase`,
  hasStakeholder: `${RDF_NAMESPACES.business}hasStakeholder`,
  satisfiesAttribute: `${RDF_NAMESPACES.business}satisfiesAttribute`,
  subjectToConstraint: `${RDF_NAMESPACES.business}subjectToConstraint`,
  
  // Quality Properties
  hasComplexity: `${RDF_NAMESPACES.quality}hasComplexity`,
  hasQualityMetric: `${RDF_NAMESPACES.quality}hasQualityMetric`,
  hasTechnicalDebt: `${RDF_NAMESPACES.quality}hasTechnicalDebt`,
  hasCodeSmell: `${RDF_NAMESPACES.quality}hasCodeSmell`,
  hasSecurityIssue: `${RDF_NAMESPACES.quality}hasSecurityIssue`,
  hasTestCoverage: `${RDF_NAMESPACES.quality}hasTestCoverage`,
  hasPerformanceMetric: `${RDF_NAMESPACES.quality}hasPerformanceMetric`,
  
  // Metric Values
  cyclomaticComplexity: `${RDF_NAMESPACES.quality}cyclomaticComplexity`,
  cognitiveComplexity: `${RDF_NAMESPACES.quality}cognitiveComplexity`,
  linesOfCode: `${RDF_NAMESPACES.quality}linesOfCode`,
  maintainabilityIndex: `${RDF_NAMESPACES.quality}maintainabilityIndex`,
  technicalDebtMinutes: `${RDF_NAMESPACES.quality}technicalDebtMinutes`,
  coveragePercentage: `${RDF_NAMESPACES.quality}coveragePercentage`,
  
  // Timestamps and Metadata
  createdAt: `${RDF_NAMESPACES.code}createdAt`,
  modifiedAt: `${RDF_NAMESPACES.code}modifiedAt`,
  generatedAt: `${RDF_NAMESPACES.code}generatedAt`,
  checksum: `${RDF_NAMESPACES.code}checksum`
} as const;

/**
 * Ontology Schema Definition
 * 
 * Defines the complete schema with class hierarchies, property domains/ranges,
 * and constraints for validation.
 */
export const ONTOLOGY_SCHEMA = {
  classes: {
    // Core hierarchy
    [ONTOLOGY_CLASSES.Module]: {
      subClassOf: [`${RDF_NAMESPACES.owl}Thing`],
      properties: [
        ONTOLOGY_PROPERTIES.name,
        ONTOLOGY_PROPERTIES.version,
        ONTOLOGY_PROPERTIES.language,
        ONTOLOGY_PROPERTIES.hasClass,
        ONTOLOGY_PROPERTIES.hasDocumentation,
        ONTOLOGY_PROPERTIES.dependsOn
      ]
    },
    
    [ONTOLOGY_CLASSES.Class]: {
      subClassOf: [`${RDF_NAMESPACES.code}CodeElement`],
      properties: [
        ONTOLOGY_PROPERTIES.name,
        ONTOLOGY_PROPERTIES.fullyQualifiedName,
        ONTOLOGY_PROPERTIES.visibility,
        ONTOLOGY_PROPERTIES.isAbstract,
        ONTOLOGY_PROPERTIES.extends,
        ONTOLOGY_PROPERTIES.implements,
        ONTOLOGY_PROPERTIES.hasMethod,
        ONTOLOGY_PROPERTIES.hasProperty
      ]
    },
    
    [ONTOLOGY_CLASSES.Method]: {
      subClassOf: [`${RDF_NAMESPACES.code}CodeElement`],
      properties: [
        ONTOLOGY_PROPERTIES.name,
        ONTOLOGY_PROPERTIES.signature,
        ONTOLOGY_PROPERTIES.visibility,
        ONTOLOGY_PROPERTIES.isStatic,
        ONTOLOGY_PROPERTIES.isAsync,
        ONTOLOGY_PROPERTIES.hasParameter,
        ONTOLOGY_PROPERTIES.calls
      ]
    }
  },
  
  properties: {
    [ONTOLOGY_PROPERTIES.name]: {
      domain: [`${RDF_NAMESPACES.code}CodeElement`],
      range: [`${RDF_NAMESPACES.xsd}string`],
      functional: true
    },
    
    [ONTOLOGY_PROPERTIES.extends]: {
      domain: [ONTOLOGY_CLASSES.Class],
      range: [ONTOLOGY_CLASSES.Class],
      functional: true
    },
    
    [ONTOLOGY_PROPERTIES.implements]: {
      domain: [ONTOLOGY_CLASSES.Class],
      range: [ONTOLOGY_CLASSES.Interface],
      functional: false
    },
    
    [ONTOLOGY_PROPERTIES.hasComplexity]: {
      domain: [`${RDF_NAMESPACES.code}CodeElement`],
      range: [ONTOLOGY_CLASSES.ComplexityMetric],
      functional: true
    }
  }
} as const;

/**
 * LLM-Optimized Prefixes
 * 
 * Human-readable prefixes for better LLM understanding
 */
export const LLM_PREFIXES = {
  '@prefix': {
    'code': RDF_NAMESPACES.code,
    'module': RDF_NAMESPACES.module,
    'arch': RDF_NAMESPACES.arch,
    'business': RDF_NAMESPACES.business,
    'quality': RDF_NAMESPACES.quality,
    'rdfs': RDF_NAMESPACES.rdfs,
    'owl': RDF_NAMESPACES.owl,
    'xsd': RDF_NAMESPACES.xsd
  }
} as const;

/**
 * Business Context Placeholders
 * 
 * Template placeholders to guide developer enhancement of TTL files
 */
export const BUSINESS_CONTEXT_PLACEHOLDERS = {
  domain: {
    template: `# Business Domain: [REPLACE_WITH_DOMAIN]
# Purpose: [DESCRIBE_BUSINESS_PURPOSE]
# Key Stakeholders: [LIST_STAKEHOLDERS]`,
    example: `# Business Domain: E-commerce Order Management
# Purpose: Handles customer order processing and fulfillment
# Key Stakeholders: Customers, Sales Team, Fulfillment Team`
  },
  
  businessRules: {
    template: `# Business Rules:
# - [RULE_1]: [DESCRIPTION]
# - [RULE_2]: [DESCRIPTION]`,
    example: `# Business Rules:
# - Order Validation: Orders must have valid payment before processing
# - Inventory Check: Items must be in stock before order confirmation`
  },
  
  useCases: {
    template: `# Use Cases:
# - [USE_CASE_1]: [DESCRIPTION]
# - [USE_CASE_2]: [DESCRIPTION]`,
    example: `# Use Cases:
# - Place Order: Customer creates new order with items
# - Process Payment: System validates and processes payment`
  },
  
  qualityAttributes: {
    template: `# Quality Attributes:
# - Performance: [TARGET_RESPONSE_TIME]
# - Reliability: [AVAILABILITY_TARGET]
# - Security: [SECURITY_REQUIREMENTS]`,
    example: `# Quality Attributes:
# - Performance: Order processing < 2 seconds
# - Reliability: 99.9% uptime
# - Security: PCI DSS compliance for payment data`
  },
  
  constraints: {
    template: `# Constraints:
# - Technical: [TECHNICAL_CONSTRAINTS]
# - Business: [BUSINESS_CONSTRAINTS]
# - Regulatory: [COMPLIANCE_REQUIREMENTS]`,
    example: `# Constraints:
# - Technical: Must integrate with legacy ERP system
# - Business: Maximum 5% cart abandonment rate
# - Regulatory: GDPR compliance for customer data`
  }
} as const;

/**
 * Neo4j Optimization Hints
 * 
 * Properties and structures optimized for Neo4j graph database ingestion
 */
export const NEO4J_OPTIMIZATION = {
  indexedProperties: [
    ONTOLOGY_PROPERTIES.name,
    ONTOLOGY_PROPERTIES.fullyQualifiedName,
    ONTOLOGY_PROPERTIES.type,
    ONTOLOGY_PROPERTIES.sourceFile
  ],
  
  relationshipTypes: {
    EXTENDS: 'EXTENDS',
    IMPLEMENTS: 'IMPLEMENTS',
    DEPENDS_ON: 'DEPENDS_ON',
    HAS_METHOD: 'HAS_METHOD',
    HAS_PROPERTY: 'HAS_PROPERTY',
    CALLS: 'CALLS',
    USES: 'USES',
    BELONGS_TO: 'BELONGS_TO'
  },
  
  nodeLabels: {
    Module: 'Module',
    Class: 'Class',
    Interface: 'Interface',
    Method: 'Method',
    Property: 'Property',
    Dependency: 'Dependency'
  }
} as const;

/**
 * Validation Rules
 * 
 * Rules for validating RDF content and ensuring consistency
 */
export const VALIDATION_RULES = {
  required: {
    [ONTOLOGY_CLASSES.Module]: [
      ONTOLOGY_PROPERTIES.name,
      ONTOLOGY_PROPERTIES.language,
      ONTOLOGY_PROPERTIES.version
    ],
    [ONTOLOGY_CLASSES.Class]: [
      ONTOLOGY_PROPERTIES.name,
      ONTOLOGY_PROPERTIES.fullyQualifiedName,
      ONTOLOGY_PROPERTIES.visibility
    ],
    [ONTOLOGY_CLASSES.Method]: [
      ONTOLOGY_PROPERTIES.name,
      ONTOLOGY_PROPERTIES.signature,
      ONTOLOGY_PROPERTIES.visibility
    ]
  },
  
  patterns: {
    fullyQualifiedName: /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/,
    version: /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/,
    visibility: /^(public|private|protected|internal)$/
  },
  
  constraints: {
    maxStringLength: 1000,
    maxArraySize: 100,
    requiredNamespaces: Object.values(RDF_NAMESPACES)
  }
} as const;