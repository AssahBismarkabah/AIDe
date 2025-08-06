# RDF Generator

Production-quality RDF generation system that transforms AST analysis results into `.module-knowledge.ttl` files optimized for both Neo4j ingestion and direct LLM consumption.

## 📚 Documentation

- **[Complete Developer Guide](../../../../docs/MODULE_KNOWLEDGE_FILES.md)** - Comprehensive guide on how module knowledge files work
- **[Quick Reference](../../../../docs/QUICK_REFERENCE.md)** - Essential commands and editing guidelines

## Components

- **RDFGenerator** - Core generation engine that transforms AST to RDF triples
- **RDFValidator** - Validates RDF syntax, semantics, and schema compliance  
- **RDFService** - High-level orchestration with batch processing and module detection

## Usage

```typescript
import { RDFService } from './rdf-generator';

const rdfService = new RDFService({
  format: 'turtle',
  includeBusinessContext: true,
  optimizeForLLM: true,
  optimizeForNeo4j: true
});

// Generate RDF from AST analysis
const result = await rdfService.generateRDF(astResult, '/path/to/module.ts');

// Batch processing
const results = await rdfService.generateBatchRDF(astResultsMap);

// Validation
const validation = await rdfService.validateTTLFile('/path/to/.module-knowledge.ttl');
```

## Generated TTL Structure

```turtle
@prefix code: <https://aaswe.ai/ontology/code#> .
@prefix business: <https://aaswe.ai/ontology/business#> .

module:UserService a code:Module ;
    code:name "UserService" ;
    code:language "typescript" ;
    code:hasClass code:UserService.User .

code:UserService.User a code:Class ;
    code:name "User" ;
    code:fullyQualifiedName "UserService.User" ;
    code:hasMethod code:UserService.User.authenticate .

# Business context placeholders for developer enhancement
module:UserService business:belongsToDomain "[BUSINESS_DOMAIN]" ;
    business:hasBusinessRules "[BUSINESS_RULES]" .
```

## Key Features

- **Concrete Code Extraction** - Real classes, methods, dependencies from AST
- **Dual Optimization** - Both Neo4j graph storage and LLM consumption
- **Business Context Placeholders** - Guided enhancement areas for developers
- **Comprehensive Validation** - Syntax, semantics, and schema compliance
- **Batch Processing** - Concurrent generation with configurable limits
- **Quality Metrics** - Complexity, technical debt, test coverage integration

## Ontology Schema

### Core Classes
- `code:Module` - Code module/package
- `code:Class` - Class definition  
- `code:Method` - Method/function
- `code:Property` - Class property

### Key Properties
- `code:hasClass` - Module contains class
- `code:hasMethod` - Class contains method
- `code:extends` - Class inheritance
- `code:dependsOn` - Dependency relationship
- `business:belongsToDomain` - Business domain association

## Configuration

```typescript
interface RDFGenerationOptions {
  format: 'turtle' | 'n3' | 'rdf-xml' | 'json-ld';
  includeBusinessContext: boolean;
  includeQualityMetrics: boolean;
  optimizeForLLM: boolean;
  optimizeForNeo4j: boolean;
  validateOutput: boolean;
  batchConcurrency: number;
}
```

## Integration

Works seamlessly with AST Analyzer and Code Ingestion services to provide real-time TTL file generation and updates with business context preservation.