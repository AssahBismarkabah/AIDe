# Module Knowledge Management System

The Module Knowledge Management System is a sophisticated dual-purpose TTL file management system that serves both Neo4j knowledge graph population and direct LLM context enhancement. This system bridges the gap between automated code analysis and developer business context enhancement, ensuring knowledge files remain accurate and valuable for both graph queries and LLM interactions.

## Overview

The Module Knowledge Management System manages the complete lifecycle of `.module-knowledge.ttl` files, providing:

- **Initial generation** from code analysis
- **Developer business context enhancement**
- **Validation and conflict resolution**
- **Knowledge graph and MCP context synchronization**
- **Developer tooling and preview capabilities**


## Key Features

### 1. Dual-Purpose TTL Files

The system generates TTL files that serve two primary purposes:

- **Neo4j Knowledge Graph**: Structured data for graph database queries and analysis
- **LLM Context Enhancement**: Rich semantic context for improved AI understanding

### 2. Business Context Preservation

- Automatically preserves developer-added business context during code updates
- Merges technical analysis with business domain knowledge
- Maintains clear boundaries between auto-generated and developer-enhanced content

### 3. Intelligent Validation

- **Syntax Validation**: Ensures TTL files conform to RDF standards
- **Semantic Validation**: Validates against ontology schemas
- **Business Context Analysis**: Measures completeness of business information

### 4. Conflict Resolution

- **Automatic Resolution**: Attempts to resolve conflicts automatically when possible
- **Manual Resolution Support**: Provides tools for manual conflict resolution
- **Change Tracking**: Maintains history of modifications and conflicts

### 5. Developer Tooling

- **Enhancement Suggestions**: AI-powered suggestions for improving knowledge files
- **Completion Status**: Tracks completeness of business context
- **Impact Analysis**: Shows how changes affect LLM understanding and graph queries

## Core Components

### ModuleKnowledgeManager

The main orchestrator class that manages the entire system:

```typescript
import { ModuleKnowledgeManager } from './ModuleKnowledgeManager';

const manager = new ModuleKnowledgeManager({
  autoValidate: true,
  preserveBusinessContext: true,
  enableConflictResolution: true,
  enableLLMPreview: true,
  validationLevel: 'moderate',
  backupEnabled: true,
  backupRetention: 30
});

await manager.initialize();
```

### Key Methods

#### Initial Generation
```typescript
// Generate knowledge files for entire codebase
const result = await manager.generateInitialKnowledgeFiles('/path/to/project', {
  overwriteExisting: false,
  preserveBusinessContext: true
});
```

#### Code Change Updates
```typescript
// Update knowledge file when code changes
const result = await manager.updateKnowledgeFileFromCode(
  '/path/to/source.ts',
  astAnalysisResult
);
```

#### Validation
```typescript
// Validate knowledge file
const validation = await manager.validateKnowledgeFile('/path/to/.module-knowledge.ttl');
```

#### LLM Context Preview
```typescript
// Generate LLM context preview
const preview = await manager.generateLLMContextPreview(
  '/current/file.ts',
  'optional query context'
);
```

#### Developer Tooling
```typescript
// Get developer tooling information
const tooling = await manager.generateDeveloperTooling('/path/to/.module-knowledge.ttl');
```

#### Conflict Resolution
```typescript
// Detect and resolve conflicts
const conflict = await manager.detectAndResolveConflicts('/path/to/.module-knowledge.ttl');
```

## Configuration Options

### ModuleKnowledgeManagerOptions

```typescript
interface ModuleKnowledgeManagerOptions {
  // Automatically validate files after changes
  autoValidate: boolean;
  
  // Preserve business context during updates
  preserveBusinessContext: boolean;
  
  // Enable automatic conflict resolution
  enableConflictResolution: boolean;
  
  // Enable LLM context preview generation
  enableLLMPreview: boolean;
  
  // Validation strictness level
  validationLevel: 'strict' | 'moderate' | 'lenient';
  
  // Enable automatic backups
  backupEnabled: boolean;
  
  // Backup retention period in days
  backupRetention: number;
}
```

## Event System

The system emits various events for monitoring and integration:

```typescript
manager.on('file_updated', (event) => {
  console.log('Knowledge file updated:', event.payload.filePath);
});

manager.on('file_validated', (event) => {
  console.log('Validation result:', event.payload.isValid);
});

manager.on('conflict_detected', (event) => {
  console.log('Conflict detected:', event.payload.conflictType);
});

manager.on('backup_created', (event) => {
  console.log('Backup created:', event.payload.backupPath);
});
```

## File Structure

### Knowledge File Location
Knowledge files are created as `.module-knowledge.ttl` in the same directory as the source code file:

```
src/
├── components/
│   ├── Button.tsx
│   └── .module-knowledge.ttl  # Knowledge file for Button.tsx
├── services/
│   ├── UserService.ts
│   └── .module-knowledge.ttl  # Knowledge file for UserService.ts
└── utils/
    ├── helpers.ts
    └── .module-knowledge.ttl  # Knowledge file for helpers.ts
```

### Backup Structure
Backups are stored in the `.aaswe/backups` directory:

```
.aaswe/
└── backups/
    ├── .module-knowledge.ttl.1641234567890.backup
    ├── .module-knowledge.ttl.1641234567891.backup
    └── ...
```

## Integration

### With RDF Generator
The system integrates with the RDF Generator to create initial TTL content from AST analysis:

```typescript
// RDF Generator creates the technical content
const rdfResult = await rdfService.generateRDF(astResult, sourceFilePath);

// Module Knowledge Manager enhances with business context
const enhancedContent = await manager.mergeBusinessContext(
  rdfResult.rdfContent,
  existingBusinessContext
);
```

### With Knowledge Graph
Knowledge files are automatically synchronized with the Neo4j knowledge graph:

```typescript
// Files are queued for synchronization
await manager.queueForSync(filePath, 'knowledge_graph');
```

### With MCP Context
Files provide enhanced context for MCP (Model Context Protocol) interactions:

```typescript
// Generate context for LLM interactions
const context = await manager.generateLLMContextPreview(currentFile, queryContext);
```

## Best Practices

### 1. Business Context Enhancement
- Add business domain information to the `# Business Context` section
- Document business rules and constraints
- Include use case descriptions
- Maintain clear separation from auto-generated content

### 2. Validation
- Enable auto-validation for immediate feedback
- Use appropriate validation levels based on project requirements
- Address validation errors promptly to maintain data quality

### 3. Conflict Resolution
- Enable automatic conflict resolution for simple cases
- Review manual conflicts carefully before resolution
- Use backup system for safety during complex merges

### 4. Performance
- Use batch operations for large codebases
- Monitor sync queue status for performance optimization
- Configure appropriate backup retention periods

## Error Handling

The system provides comprehensive error handling:

```typescript
const result = await manager.updateKnowledgeFileFromCode(filePath, astResult);

if (!result.success) {
  console.error('Update failed:', result.error);
  // Handle error appropriately
} else {
  console.log('Update successful:', result.data);
}
```

## Testing

Comprehensive test suite with 28 test cases covering:

- Initialization and configuration
- Initial knowledge file generation
- Code change updates
- Validation system
- LLM context preview
- Developer tooling
- Conflict detection and resolution
- Event handling
- Error scenarios
- Utility functions

Run tests:
```bash
npm test -- tests/module-knowledge.test.ts
```

## Monitoring and Observability

The system provides detailed logging and metrics:

```typescript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Monitor events
manager.on('file_updated', (event) => {
  metrics.increment('knowledge_files.updated');
});

manager.on('conflict_detected', (event) => {
  metrics.increment('knowledge_files.conflicts');
});
```

## Future Enhancements

- **Machine Learning Integration**: AI-powered business context suggestions
- **Version Control Integration**: Git-aware conflict resolution
- **Real-time Collaboration**: Multi-developer editing support
- **Advanced Analytics**: Usage patterns and optimization recommendations
- **Plugin System**: Extensible architecture for custom enhancements

## Contributing

When contributing to the Module Knowledge Management System:

1. Follow the established patterns for error handling and logging
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Consider backward compatibility for configuration options
5. Test integration with RDF Generator and Knowledge Graph systems

## License

This module is part of the AI-Assisted Software Engineering (AIDe) system and follows the same licensing terms as the parent project.