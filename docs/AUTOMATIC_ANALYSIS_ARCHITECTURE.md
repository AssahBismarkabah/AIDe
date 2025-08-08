# Automatic Project Analysis and TTL Generation Architecture

## Overview

This document outlines the architecture for the automatic project analysis and TTL generation system that triggers when npm packages are installed and provides comprehensive codebase understanding for both Neo4j knowledge graphs and LLM consumption.

## Core Components

### 1. Automatic Analysis Trigger System

#### 1.1 NPM Install Hook
- **Location**: `src/services/automatic-analysis/`
- **Components**:
  - `NPMHookManager.ts` - Manages npm lifecycle hooks
  - `InstallationDetector.ts` - Detects package installations
  - `TriggerOrchestrator.ts` - Orchestrates analysis triggers

#### 1.2 Trigger Mechanisms
- **npm postinstall script** - Automatic trigger after package installation
- **File system watchers** - Detect new dependencies and code changes
- **CLI command** - Manual trigger for immediate analysis
- **API endpoint** - Programmatic trigger for CI/CD integration

### 2. Enhanced Project Analysis Pipeline

#### 2.1 Multi-Stage Analysis Process
```
Package Installation → Trigger Detection → Project Discovery → 
AST Analysis → TTL Generation → Knowledge Graph Population → 
MCP Context Loading → Validation & Notification
```

#### 2.2 Analysis Stages

**Stage 1: Project Discovery**
- Detect project structure and type
- Identify all source files and dependencies
- Determine analysis scope and priorities

**Stage 2: Comprehensive AST Analysis**
- Multi-language code analysis
- Extract classes, methods, functions, interfaces
- Calculate complexity metrics and quality indicators
- Identify architectural patterns and relationships

**Stage 3: TTL Generation with Concrete Information**
- Generate `.module-knowledge.ttl` files with actual code structure
- Include business context placeholders for developer enhancement
- Optimize for both Neo4j ingestion and LLM consumption

**Stage 4: Knowledge Graph Population**
- Automatically populate Neo4j with extracted knowledge
- Create nodes for modules, classes, functions, dependencies
- Establish relationships and semantic connections

**Stage 5: MCP Context Loading**
- Format knowledge for MCP server consumption
- Create context-rich representations for LLM interactions
- Enable real-time context updates

### 3. Business Context Preservation System

#### 3.1 Context Preservation Strategy
- **Backup System**: Automatic backups before re-analysis
- **Merge Algorithm**: Intelligent merging of technical and business content
- **Conflict Resolution**: Automatic and manual conflict resolution
- **Version Control**: Track changes and maintain history

#### 3.2 Developer Enhancement Workflow
```
Auto-Generated TTL → Developer Enhancement → 
Business Context Addition → Validation → 
Knowledge Graph Update → MCP Context Refresh
```

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTOMATIC ANALYSIS SYSTEM                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   NPM Install   │    │  File System    │    │  Manual/API  │ │
│  │     Hooks       │    │   Watchers      │    │   Triggers   │ │
│  └─────────┬───────┘    └─────────┬───────┘    └──────┬───────┘ │
│            │                      │                   │         │
│            └──────────────────────┼───────────────────┘         │
│                                   │                             │
│  ┌─────────────────────────────────▼─────────────────────────────┐ │
│  │              TRIGGER ORCHESTRATOR                           │ │
│  │  • Detects installation events                              │ │
│  │  • Manages analysis queue                                   │ │
│  │  • Coordinates multi-stage pipeline                        │ │
│  └─────────────────────────────────┬─────────────────────────────┘ │
│                                   │                             │
│  ┌─────────────────────────────────▼─────────────────────────────┐ │
│  │            PROJECT ANALYSIS SERVICE                         │ │
│  │  • Project structure discovery                              │ │
│  │  • Multi-language AST analysis                              │ │
│  │  • Dependency graph construction                            │ │
│  │  • Quality metrics calculation                              │ │
│  └─────────────────────────────────┬─────────────────────────────┘ │
│                                   │                             │
│  ┌─────────────────────────────────▼─────────────────────────────┐ │
│  │              RDF GENERATOR                                  │ │
│  │  • Concrete TTL file generation                             │ │
│  │  • Business context placeholders                           │ │
│  │  • Neo4j optimization                                       │ │
│  │  • LLM consumption optimization                             │ │
│  └─────────────────────────────────┬─────────────────────────────┘ │
│                                   │                             │
│  ┌─────────────────────────────────▼─────────────────────────────┐ │
│  │         MODULE KNOWLEDGE MANAGER                            │ │
│  │  • Business context preservation                            │ │
│  │  • Conflict resolution                                      │ │
│  │  • Version control and backups                              │ │
│  │  • Developer enhancement workflow                           │ │
│  └─────────────────────────────────┬─────────────────────────────┘ │
│                                   │                             │
└───────────────────────────────────┼─────────────────────────────────┘
                                   │
    ┌──────────────────────────────┼──────────────────────────────┐
    │                              │                              │
    ▼                              ▼                              ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   KNOWLEDGE     │    │   MCP SERVER    │    │   DEVELOPER     │
│     GRAPH       │    │    CONTEXT      │    │    TOOLING     │
│   (Neo4j)       │    │                 │    │                 │
│                 │    │ • LLM Context   │    │ • Enhancement   │
│ • Nodes/Edges   │    │ • Real-time     │    │   Suggestions   │
│ • Cypher Queries│    │   Updates       │    │ • Validation    │
│ • Analytics     │    │ • Context Cache │    │ • Preview       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Implementation Strategy

### Phase 1: Core Infrastructure
1. **NPM Hook System** - Implement automatic triggers
2. **Enhanced Analysis Pipeline** - Upgrade existing services
3. **TTL Generation** - Ensure concrete information output

### Phase 2: Knowledge Integration
1. **Knowledge Graph Population** - Automatic Neo4j updates
2. **MCP Context Loading** - Real-time context for LLMs
3. **Business Context Preservation** - Developer enhancement workflow

### Phase 3: Developer Experience
1. **Tooling and Validation** - Developer-friendly interfaces
2. **Conflict Resolution** - Intelligent merging algorithms
3. **Testing and Monitoring** - Comprehensive test coverage

## Key Features

### 1. Automatic Triggering
- **Zero Configuration**: Works out of the box after npm install
- **Smart Detection**: Only analyzes when necessary
- **Performance Optimized**: Incremental analysis for large codebases

### 2. Concrete Information Generation
- **Actual Code Structure**: Real class names, method signatures, dependencies
- **Business Context Placeholders**: Structured areas for developer enhancement
- **Dual Optimization**: Perfect for both Neo4j queries and LLM consumption

### 3. Developer-Friendly Workflow
- **Preservation Guarantee**: Business context never lost during re-analysis
- **Conflict Resolution**: Automatic and manual resolution options
- **Enhancement Suggestions**: AI-powered recommendations for improvement

### 4. Integration Ready
- **Neo4j Native**: Optimized Cypher queries and graph structure
- **MCP Protocol**: Real-time context updates for LLM interactions
- **CI/CD Compatible**: API endpoints for automated workflows

## File Structure

```
src/services/automatic-analysis/
├── NPMHookManager.ts           # NPM lifecycle hook management
├── InstallationDetector.ts     # Package installation detection
├── TriggerOrchestrator.ts      # Analysis trigger coordination
├── AutomaticAnalysisService.ts # Main orchestration service
└── types.ts                    # Type definitions

src/services/project-analysis/
├── ProjectAnalysisService.ts   # Enhanced with automatic triggers
└── AutoAnalysisWorkflow.ts     # Automatic analysis workflow

src/services/layer1/rdf-generator/
├── RDFGenerator.ts            # Enhanced with concrete information
└── ConcreteInformationExtractor.ts # Extract actual code details

src/services/layer1/module-knowledge/
├── ModuleKnowledgeManager.ts  # Enhanced preservation system
└── BusinessContextPreserver.ts # Business context preservation

scripts/
├── postinstall.js             # NPM postinstall hook
└── setup-hooks.js             # Hook installation script

tests/integration/
├── automatic-analysis.test.ts  # End-to-end testing
└── ttl-generation.test.ts     # TTL generation testing
```

## Success Metrics

1. **Automatic Trigger Success Rate**: >95% successful triggers after npm install
2. **TTL Generation Quality**: 100% valid RDF syntax, >90% semantic completeness
3. **Business Context Preservation**: 100% preservation rate during re-analysis
4. **Knowledge Graph Population**: <5 second update time for typical projects
5. **MCP Context Loading**: <1 second context refresh for LLM interactions

## Next Steps

1. Implement NPM hook system and trigger orchestrator
2. Enhance existing services with automatic analysis capabilities
3. Create comprehensive integration tests
4. Deploy and validate with real-world projects