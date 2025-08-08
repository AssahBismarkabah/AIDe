# AASWE Architecture Overview

## Architecture Clarification

Based on your architecture diagram, AASWE supports **TWO DEPLOYMENT MODES** that align with the 5-layer architecture:

### Mode 1: Context-Only Mode (Recommended)
**What it provides:**
- Layers 1-2: Complete code analysis and knowledge graph
- Neo4j database for storing code relationships
- TTL file generation for IDE LLM context enhancement
- Version management and hybrid storage
- Lightweight MCP server integration

**Architecture:**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Your IDE      │    │   AASWE MCP     │    │   Knowledge     │
│   (Claude/GPT)  │◄──►│     Server      │◄──►│   Graph DB      │
│                 │    │   (Port 3001)   │    │   (Neo4j)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   TTL Files     │
                       │   (Knowledge)   │
                       └─────────────────┘
```

### Mode 2: Full Mode (Advanced)
**What it provides:**
- All 5 layers of the architecture
- Complete Docker Compose stack
- Advanced AI capabilities (RAG, GraphCypher, SPARQL)
- Additional Layer 3 AI services for complex queries

**Architecture (Your Diagram):**
```
┌─────────────────┐    ┌─────────────────────────────────────────────────────────┐
│ Developer       │    │                Docker Compose Stack                     │
│ Machine         │    │                    (5 Layers)                          │
│                 │    │                                                         │
│ ┌─────────────┐ │    │ ┌─────────────────────────────────────────────────────┐ │
│ │ IDE + LLM   │◄┼────┼►│ Layer 5: Integration & APIs                         │ │
│ │ (Claude/GPT)│ │    │ │ • MCP Server :8000                                  │ │
│ └─────────────┘ │    │ │ • API Gateway :8080                                 │ │
│                 │    │ │ • Web Interface :3000                               │ │
│ ┌─────────────┐ │    │ └─────────────────────────────────────────────────────┘ │
│ │ Project     │ │    │ ┌─────────────────────────────────────────────────────┐ │
│ │ Files       │◄┼────┼►│ Layer 4: Developer Assistance                       │ │
│ │ • Source    │ │    │ │ • Code Assistant                                    │ │
│ │ • TTL Files │ │    │ │ • Documentation Assistant                           │ │
│ │ • Config    │ │    │ │ • Test Assistant                                    │ │
│ └─────────────┘ │    │ │ • Refactoring Assistant                             │ │
└─────────────────┘    │ └─────────────────────────────────────────────────────┘ │
                       │ ┌─────────────────────────────────────────────────────┐ │
                       │ │ Layer 3: AI/LLM Integration                         │ │
                       │ │ • LangChain RAG Engine                              │ │
                       │ │ • GraphCypher QA Chain                              │ │
                       │ │ • SPARQL Query Engine                               │ │
                       │ │ • LLM Gateway Service                               │ │
                       │ └─────────────────────────────────────────────────────┘ │
                       │ ┌─────────────────────────────────────────────────────┐ │
                       │ │ Layer 2: Knowledge Graph Core                       │ │
                       │ │ • Neo4j Database :7687                              │ │
                       │ │ • Redis Cache :6379                                 │ │
                       │ │ • Version Manager                                   │ │
                       │ │ • RDF Module Store                                  │ │
                       │ └─────────────────────────────────────────────────────┘ │
                       │ ┌─────────────────────────────────────────────────────┐ │
                       │ │ Layer 1: Data Ingestion & Analysis                  │ │
                       │ │ • Code Ingestion Service                            │ │
                       │ │ • AST Analysis Engine                               │ │
                       │ │ • RDF Generator                                     │ │
                       │ │ • CrewAI Orchestration                              │ │
                       │ └─────────────────────────────────────────────────────┘ │
                       └─────────────────────────────────────────────────────────┘
```

## Layer-by-Layer Breakdown

### Layer 1: Data Ingestion & Analysis
**Purpose:** Extract and analyze code structure
**Components:**
- **Code Ingestion Service:** Monitors and processes source files
- **AST Analysis Engine:** Multi-language parsing (TS, JS, Python, Java, Go, Rust, C++)
- **RDF Generator:** Converts code structure to semantic knowledge
- **CrewAI Orchestration:** Coordinates analysis workflows

**Status:** ✅ **COMPLETED** - All components implemented and tested

### Layer 2: Knowledge Graph Core
**Purpose:** Store and manage versioned knowledge
**Components:**
- **Neo4j Database:** Graph storage for complex relationships
- **Redis Cache:** Fast access to frequently used data
- **Version Manager:** Track code evolution and changes
- **RDF Module Store:** Manage TTL files and semantic data

**Status:** ✅ **COMPLETED** - All components implemented and tested

### Layer 3: AI/LLM Integration & Reasoning
**Purpose:** Provide intelligent analysis and querying
**Components:**
- **LangChain RAG Engine:** Context-aware responses using vector embeddings
- **GraphCypher QA Chain:** Natural language to Cypher query translation
- **SPARQL Query Engine:** RDF knowledge queries
- **LLM Gateway Service:** Unified interface for multiple LLM providers

**Status:** ✅ **COMPLETED** - All components implemented and tested

### Layer 4: Developer Assistance (Future)
**Purpose:** Intelligent code assistance and automation
**Components:**
- **Code Assistant:** Smart suggestions and completions
- **Documentation Assistant:** Auto-generate and maintain docs
- **Test Assistant:** Generate and maintain test suites
- **Refactoring Assistant:** Safe code transformations

**Status:** ⏳ **PLANNED** - Architecture designed, implementation pending

### Layer 5: Integration & APIs
**Purpose:** External interfaces and user interaction
**Components:**
- **MCP Server:** IDE integration via Model Context Protocol
- **API Gateway:** REST endpoints for external access
- **Web Interface:** Management dashboard and monitoring

**Status:** 🔄 **PARTIAL** - MCP Server completed, others in progress

## Deployment Modes Comparison

| Feature | Context-Only Mode | Full Mode |
|---------|------------------|-----------|
| **Layers Used** | 1-2 + MCP Server | All 5 Layers |
| **Resource Usage** | Medium (4GB RAM) | High (8GB RAM) |
| **Setup Complexity** | Moderate | Complex |
| **AI Requirements** | Uses existing IDE LLM | Uses IDE LLM + API keys |
| **Database** | Neo4j + file storage | Neo4j + Redis + file storage |
| **TTL Files** | ✅ Generated | ✅ Generated |
| **Knowledge Graph** | ✅ Full graph | ✅ Full graph + AI analysis |
| **Use Case** | Enhanced IDE context | Full AI analysis + context |
| **Deployment** | Docker Compose (basic) | Docker Compose (full) |

## Current Implementation Status

### ✅ Completed Components (318 tests passing)
1. **Layer 1:** AST Analysis, RDF Generation, Code Ingestion, Module Knowledge
2. **Layer 2:** Neo4j Database, Version Manager, Hybrid Storage, In-Memory RDF
3. **Layer 3:** LangChain RAG, GraphCypher QA, SPARQL Query Engine
4. **Layer 5:** MCP Server with full IDE integration
5. **Infrastructure:** NPM Package, Docker Compose, CLI Interface

### 🔄 In Progress
1. **NPM Package Finalization:** CLI testing and Docker integration
2. **Automatic Project Analysis:** TTL generation workflow

### ⏳ Pending
1. **Layer 4:** Developer assistance components
2. **Web Interface:** Management dashboard
3. **Complete Integration Testing:** End-to-end validation

## Technical Architecture Details

### Data Flow
```
Source Code → AST Analysis → RDF Generation → Knowledge Graph → AI Analysis → IDE Context
     ↓              ↓              ↓              ↓              ↓              ↓
Project Files → Parsed AST → TTL Files → Neo4j/Redis → LLM Queries → Enhanced LLM
```

### Service Communication
- **MCP Protocol:** IDE ↔ AASWE Server
- **HTTP/REST:** Web Interface ↔ API Gateway
- **Bolt Protocol:** Services ↔ Neo4j Database
- **Redis Protocol:** Services ↔ Cache Layer
- **File System:** TTL Files ↔ Knowledge Store

### Scalability Considerations
- **Horizontal:** Multiple AASWE instances with shared database
- **Vertical:** Resource allocation per layer
- **Caching:** Multi-level caching strategy
- **Load Balancing:** API Gateway with multiple backends

## Integration Points

### IDE Integration
```json
// VS Code settings.json
{
  "mcp.servers": {
    "aaswe": {
      "command": "aaswe",
      "args": ["start", "--mode=context-only"]
    }
  }
}
```

### Docker Integration
```bash
# Context-only mode
aaswe start --mode=context-only

# Full mode with Docker
aaswe docker up
```

### API Integration
```bash
# REST API endpoints
GET /api/v1/knowledge/modules
POST /api/v1/analysis/project
GET /api/v1/graph/query
```

## Security Architecture

### Authentication & Authorization
- **API Keys:** Secure LLM provider access
- **Network Security:** Container isolation
- **Data Privacy:** Local-first processing
- **Access Control:** Role-based permissions

### Data Protection
- **Encryption:** At-rest and in-transit
- **Backup:** Automated version backups
- **Audit:** Comprehensive logging
- **Compliance:** GDPR/SOC2 considerations

## Performance Architecture

### Optimization Strategies
- **Incremental Analysis:** Only process changed files
- **Caching:** Multi-layer caching strategy
- **Indexing:** Optimized database queries
- **Compression:** Efficient data storage

### Monitoring & Metrics
- **Health Checks:** Service availability
- **Performance Metrics:** Response times, throughput
- **Resource Usage:** CPU, memory, disk
- **Error Tracking:** Comprehensive error handling

## Future Architecture Evolution

### Planned Enhancements
1. **Plugin System:** Extensible architecture
2. **Multi-Repository:** Support for monorepos
3. **Real-time Collaboration:** Team-based features
4. **Advanced AI:** Custom model training
5. **Cloud Deployment:** SaaS offering

### Migration Path
- **Phase 1:** Context-only mode adoption
- **Phase 2:** Full mode deployment
- **Phase 3:** Advanced features rollout
- **Phase 4:** Enterprise features

This architecture provides a clear separation of concerns, scalable deployment options, and a path for future enhancements while maintaining simplicity for basic use cases.