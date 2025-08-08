# Project Analysis Service

The **Project Analysis Service** is the core orchestrator for automatic project analysis and TTL knowledge file generation in the AASWE system. It provides comprehensive project understanding and context generation capabilities.

## Overview

This service bridges the gap between raw source code and meaningful knowledge representation by:

- **Discovering Project Structure**: Automatically detects project type, frameworks, and organization
- **Multi-Language Analysis**: Supports TypeScript, JavaScript, Python, Java, Go, Rust, and C++
- **TTL Knowledge Generation**: Creates semantic knowledge files for enhanced IDE context
- **Real-time Monitoring**: Watches for file changes and updates knowledge incrementally
- **Integration Ready**: Seamlessly integrates with the MCP server and knowledge management system

## Key Features

### 🔍 **Comprehensive Project Discovery**
- Detects project type (web, API, library, CLI, etc.)
- Identifies frameworks and build tools
- Maps directory structure and file organization
- Extracts dependencies from package files

### 🧠 **Intelligent Code Analysis**
- Multi-language AST parsing and analysis
- Function and class extraction
- Dependency relationship mapping
- Complexity metrics calculation

### 📄 **TTL Knowledge File Generation**
- Automatic generation of `.module-knowledge.ttl` files
- Preserves business context during updates
- Validates RDF syntax and semantics
- Supports incremental updates

### 👀 **Real-time File Watching**
- Monitors source code changes
- Incremental analysis and TTL updates
- Conflict detection and resolution
- Event-driven architecture

## Usage

### Basic Project Analysis

```typescript
import { ProjectAnalysisService } from './services/project-analysis';

const analysisService = new ProjectAnalysisService({
  rootPath: '/path/to/project',
  languages: ['typescript', 'javascript', 'python'],
  generateTTL: true,
  enableWatching: true
});

await analysisService.initialize();
const result = await analysisService.analyzeProject();

console.log(`Analyzed ${result.summary.analyzedFiles} files`);
console.log(`Generated ${result.summary.ttlFilesGenerated} TTL files`);
```

### CLI Usage

```bash
# Analyze current project
aaswe analyze

# Custom configuration
aaswe analyze --languages typescript,python --depth comprehensive --output ./knowledge

# Enable file watching
aaswe analyze --watch

# Debug mode
aaswe analyze --debug
```

### Configuration Options

```typescript
interface ProjectAnalysisConfig {
  rootPath: string;                    // Project root directory
  outputDirectory?: string;            // TTL output directory (default: .aaswe/knowledge)
  languages?: string[];                // Languages to analyze
  includePatterns?: string[];          // File patterns to include
  excludePatterns?: string[];          // File patterns to exclude
  generateTTL?: boolean;               // Enable TTL generation (default: true)
  enableWatching?: boolean;            // Enable file watching (default: true)
  preserveBusinessContext?: boolean;   // Preserve business context in TTL files
  analysisDepth?: 'basic' | 'detailed' | 'comprehensive';
}
```

## Analysis Results

The service provides comprehensive analysis results:

```typescript
interface ProjectAnalysisResult {
  projectPath: string;
  analysisId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  summary: {
    totalFiles: number;
    analyzedFiles: number;
    skippedFiles: number;
    errorFiles: number;
    ttlFilesGenerated: number;
    languageBreakdown: Record<string, number>;
  };
  files: Array<{
    filePath: string;
    language: string;
    status: 'success' | 'error' | 'skipped';
    ttlGenerated: boolean;
    error?: string;
  }>;
  errors: Array<{
    filePath: string;
    error: string;
    phase: 'discovery' | 'analysis' | 'ttl_generation';
  }>;
  warnings: string[];
  recommendations: string[];
}
```

## Project Structure Detection

The service automatically detects and classifies:

### Project Types
- **Web**: React, Vue, Angular applications
- **API**: Express, FastAPI, Spring Boot services
- **Library**: Reusable code packages
- **CLI**: Command-line tools
- **Desktop**: Desktop applications
- **Mobile**: Mobile applications
- **Mixed**: Multi-purpose projects

### Frameworks
- Frontend: React, Vue, Angular, Svelte
- Backend: Express, FastAPI, Django, Spring
- Build Tools: Webpack, Vite, Rollup
- Testing: Jest, Mocha, Pytest

### Directory Classification
- **Source**: `src/`, `lib/`, main code directories
- **Test**: `test/`, `tests/`, `__tests__/`, `spec/`
- **Config**: `config/`, configuration files
- **Docs**: `docs/`, `documentation/`
- **Build**: `build/`, `dist/`, output directories

## Event System

The service emits events for real-time monitoring:

```typescript
analysisService.on('structureDiscovered', ({ structure }) => {
  console.log('Project structure:', structure.projectType);
});

analysisService.on('analysisProgress', ({ processed, total }) => {
  console.log(`Progress: ${processed}/${total} files`);
});

analysisService.on('analysisCompleted', (result) => {
  console.log('Analysis completed:', result.summary);
});

analysisService.on('ttlFileUpdated', (event) => {
  console.log('TTL file updated:', event.payload.filePath);
});
```

## Integration with AASWE System

### MCP Server Integration
- Provides project context to IDE LLMs
- Enables intelligent code assistance
- Supports real-time context updates

### Knowledge Management
- Integrates with ModuleKnowledgeManager
- Preserves business context during updates
- Validates and manages TTL files

### Code Ingestion Service
- Uses CodeIngestionService for file monitoring
- Supports Git integration and webhooks
- Handles batch processing and queuing

## Performance Considerations

### Batch Processing
- Processes files in configurable batches (default: 10)
- Prevents memory overflow on large projects
- Provides progress feedback

### Incremental Updates
- Only analyzes changed files
- Preserves existing business context
- Minimizes processing overhead

### Caching
- Caches analysis results
- Avoids redundant processing
- Supports checksum-based validation

## Error Handling

The service provides robust error handling:

- **Graceful Degradation**: Continues analysis even if some files fail
- **Detailed Error Reporting**: Provides specific error messages and file paths
- **Recovery Mechanisms**: Attempts to recover from transient errors
- **Validation**: Validates TTL syntax and semantics

## Best Practices

### Project Setup
1. Run `aaswe init` to create configuration files
2. Customize language and pattern settings
3. Use `--depth comprehensive` for initial analysis
4. Enable watching for active development

### TTL File Management
1. Review generated TTL files for accuracy
2. Add business context to enhance LLM understanding
3. Use version control to track knowledge evolution
4. Validate TTL files regularly

### Performance Optimization
1. Use appropriate exclude patterns
2. Limit analysis to relevant languages
3. Use incremental analysis for large projects
4. Monitor memory usage during analysis

## Troubleshooting

### Common Issues

**Analysis Fails to Start**
- Check file permissions in project directory
- Ensure Node.js version compatibility
- Verify configuration file syntax

**TTL Generation Errors**
- Check RDF syntax in existing TTL files
- Verify file encoding (UTF-8 required)
- Review exclude patterns

**Performance Issues**
- Reduce batch size for memory-constrained environments
- Use more specific include/exclude patterns
- Consider analysis depth settings

### Debug Mode
Enable debug logging for detailed troubleshooting:

```bash
aaswe analyze --debug
```

## Architecture

```
ProjectAnalysisService
├── Project Structure Discovery
│   ├── Package File Detection
│   ├── Source File Discovery
│   └── Directory Classification
├── Multi-Language Analysis
│   ├── TypeScript/JavaScript Analyzer
│   ├── Python Analyzer
│   ├── Java Analyzer
│   └── Other Language Analyzers
├── TTL Generation Pipeline
│   ├── AST to RDF Conversion
│   ├── Business Context Preservation
│   └── Validation and Quality Checks
└── Real-time Monitoring
    ├── File System Watching
    ├── Incremental Updates
    └── Event Broadcasting
```

## Future Enhancements

- **AI-Powered Analysis**: Enhanced code understanding using LLMs
- **Cross-Project Analysis**: Dependency analysis across multiple projects
- **Custom Analyzers**: Plugin system for custom language support
- **Performance Metrics**: Detailed performance monitoring and optimization
- **Cloud Integration**: Support for cloud-based project analysis

---

The Project Analysis Service is a cornerstone of the AASWE system, providing the foundation for intelligent code assistance and enhanced developer productivity.