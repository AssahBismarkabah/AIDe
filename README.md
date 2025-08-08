# AASWE - AI-Assisted Software Engineering

AI-Assisted Software Engineering with enhanced IDE LLM context through knowledge graphs and semantic code analysis.

## Overview

AASWE analyzes codebases to create comprehensive knowledge graphs that enhance LLM interactions in your IDE. It combines Abstract Syntax Tree (AST) analysis with semantic relationships and business context to provide intelligent code assistance through the Model Context Protocol (MCP).

## Quick Start

### NPM Installation (Recommended)

```bash
# Install globally
npm install -g @aaswe/codebase-ai

# Navigate to your project
cd your-project

# Initialize AASWE
aaswe init

# Start in context-only mode (recommended)
aaswe start --mode=context-only
```

### Docker Compose (Full System)

```bash
# Clone and start
git clone <repository-url>
cd aaswe-eng
docker-compose up -d
```

## Features

### Core Capabilities
- **🔍 Deep Code Analysis**: Multi-language AST parsing with semantic relationship mapping
- **🧠 Knowledge Graph**: Neo4j-powered graph database for complex code queries
- **🔌 IDE Integration**: Model Context Protocol (MCP) for seamless LLM enhancement
- **🏠 Local-First**: Complete Docker-based stack runs locally
- **🌐 Multi-Language**: TypeScript, JavaScript, Python, Java, Go, Rust, C++ support
- **📚 Business Context**: RDF/TTL files for domain knowledge integration

### Two Deployment Modes

#### Context-Only Mode (Recommended)
- ✅ Complete code analysis with Neo4j knowledge graph
- ✅ Generates TTL knowledge files for IDE LLM context
- ✅ Version management and hybrid storage
- ✅ Uses your existing IDE LLM (no additional API keys needed)
- ✅ Full Layers 1-2 functionality

#### Full Mode (Advanced)
- ✅ Everything from context-only mode (Layers 1-2)
- ✅ Additional Layer 3 AI services (RAG, GraphCypher, SPARQL)
- ✅ Advanced code intelligence and natural language queries
- ⚠️ Requires AI API keys for Layer 3 services
- ⚠️ Higher resource usage

## Architecture

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

### 5-Layer Architecture

1. **Layer 1: Code Analysis & Knowledge Extraction**
   - AST Analysis Engine (multi-language support)
   - RDF Generator (semantic knowledge representation)
   - Code Ingestion Service (Git integration)
   - Module Knowledge Management (TTL file generation)

2. **Layer 2: Versioned Knowledge Graph Core**
   - Neo4j Database Service (graph storage)
   - Version Manager (code evolution tracking)
   - Hybrid Storage (Neo4j + in-memory RDF)
   - In-Memory RDF Store (fast queries)

3. **Layer 3: AI/LLM Integration & Reasoning**
   - LangChain RAG Engine (context-aware responses)
   - GraphCypher QA Chain (natural language to Cypher)
   - SPARQL Query Engine (RDF knowledge queries)

4. **Layer 4: Code Assistant (Future)**
   - Intelligent code suggestions
   - Automated refactoring recommendations

5. **Layer 5: Integration & Interface**
   - MCP Server (IDE integration)
   - API Gateway (REST endpoints)
   - Web Interface (management dashboard)

## Installation

### Prerequisites

- Node.js ≥18.0.0
- Docker & Docker Compose (for full mode)
- Git (recommended)

### Global Installation

```bash
npm install -g @aaswe/codebase-ai
```

### Project Setup

```bash
cd your-project
aaswe init --mode=context-only
aaswe start
```

## Usage

### CLI Commands

```bash
# Core commands
aaswe start [options]           # Start the MCP server
aaswe init [options]            # Initialize project
aaswe status                    # Check server status
aaswe analyze [options]         # Analyze project and generate TTL

# Docker management
aaswe docker up                 # Start Docker services
aaswe docker down               # Stop Docker services
aaswe docker logs [service]     # View service logs
```

### Command Options

```bash
# Start options
aaswe start --mode=context-only    # Context-only mode (recommended)
aaswe start --mode=full            # Full AI capabilities
aaswe start --port=3001            # Custom port
aaswe start --project-path=/path   # Custom project path

# Init options
aaswe init --mode=context-only     # Initialize for context-only
aaswe init --force                 # Force reinitialize

# Analyze options
aaswe analyze --output=./knowledge # Custom output directory
aaswe analyze --languages=ts,js    # Specific languages only
```

### Business Context with TTL Files

Add `.module-knowledge.ttl` files for domain knowledge:

```turtle
@prefix aaswe: <http://aaswe.dev/ontology#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

aaswe:UserModule a aaswe:Module ;
    aaswe:purpose "User authentication and management system" ;
    aaswe:criticality "high" ;
    aaswe:maintainer "auth-team@company.com" ;
    aaswe:dependencies "database, security, logging" ;
    rdfs:comment "Core authentication module handling user login, registration, and session management" .

aaswe:AuthService a aaswe:Service ;
    aaswe:implements aaswe:UserModule ;
    aaswe:endpoint "/api/auth" ;
    aaswe:methods "POST, GET, DELETE" ;
    rdfs:comment "REST API service for authentication operations" .
```

## Configuration

### Environment Variables

Create a `.env` file in your project root:

```bash
# Basic Configuration
NODE_ENV=production
LOG_LEVEL=info
PORT=3001

# Database Configuration (for full mode)
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=aaswe-password

# AI API Keys (for full mode)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# Analysis Configuration
SUPPORTED_LANGUAGES=typescript,javascript,python,java,go,rust,cpp
ANALYSIS_DEPTH=deep
INCREMENTAL_ANALYSIS=true
```

## Development

### Build from Source

```bash
git clone https://github.com/aaswe/codebase-ai.git
cd aaswe-eng
npm install
npm run build
```

### Testing

```bash
npm test                # Run all tests (281 tests)
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
npm run test:layer1     # Test Layer 1 services
npm run test:layer2     # Test Layer 2 services
npm run test:layer3     # Test Layer 3 services
```

### Docker Development

```bash
npm run docker:up       # Start development stack
npm run docker:down     # Stop stack
npm run docker:logs     # View logs
npm run docker:build    # Rebuild images
```

## Service Endpoints

| Service | Port | Description | Mode |
|---------|------|-------------|------|
| AASWE MCP Server | 3001 | Main MCP server | Both |
| Neo4j Browser | 7474 | Graph database UI | Full |
| Neo4j Bolt | 7687 | Database connection | Full |
| Redis | 6379 | Caching layer | Full |
| Web Interface | 3000 | Management dashboard | Optional |

## IDE Integration

### VS Code with Claude

```json
// .vscode/settings.json
{
  "mcp.servers": {
    "aaswe": {
      "command": "aaswe",
      "args": ["start", "--mode=context-only"],
      "env": {
        "PROJECT_PATH": "${workspaceFolder}"
      }
    }
  }
}
```

### Claude Desktop

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "aaswe": {
      "command": "aaswe",
      "args": ["start", "--mode=context-only"],
      "env": {
        "PROJECT_PATH": "/path/to/your/project"
      }
    }
  }
}
```

## Deployment

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Quick Deployment Options

1. **NPM Global** (Recommended for most users)
   ```bash
   npm install -g @aaswe/codebase-ai
   aaswe init && aaswe start
   ```

2. **Docker Compose** (Full system with database)
   ```bash
   docker-compose up -d
   ```

3. **Development** (Source code)
   ```bash
   git clone <repo> && cd aaswe-eng
   npm install && npm run build
   npm start
   ```

## Monitoring and Health Checks

```bash
# Check AASWE server health
curl http://localhost:3001/health

# Check service status
aaswe status

# View logs
aaswe docker logs -f aaswe-server

# Monitor resource usage
docker stats
```

## Performance and Scaling

### Recommended System Requirements

- **Context-Only Mode**: 2GB RAM, 1 CPU core
- **Full Mode**: 8GB RAM, 4 CPU cores
- **Storage**: 5GB for knowledge graphs (large codebases)

### Performance Tuning

```bash
# Optimize Neo4j memory (docker-compose.yml)
NEO4J_dbms_memory_heap_max__size=4g
NEO4J_dbms_memory_pagecache_size=2g

# Optimize Redis cache
redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru
```

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Make changes and add tests
4. Ensure all tests pass: `npm test`
5. Commit changes: `git commit -am 'Add feature'`
6. Push branch: `git push origin feature-name`
7. Submit pull request

### Development Guidelines

- Follow TypeScript best practices
- Add tests for new features
- Update documentation
- Ensure Docker builds work
- Test both deployment modes

## Troubleshooting

### Common Issues

1. **Port conflicts**: Use `--port` option or check `lsof -i :3001`
2. **Docker issues**: Ensure Docker is running and has sufficient memory
3. **Neo4j connection**: Check Docker logs and network connectivity
4. **Permission errors**: Fix with `chmod -R 755 ./data ./knowledge`

### Debug Mode

```bash
LOG_LEVEL=debug aaswe start --mode=context-only
```

## Roadmap

- ✅ **Layer 1-3**: Core analysis and AI integration (Completed)
- ✅ **MCP Server**: IDE integration (Completed)
- ✅ **NPM Package**: Easy deployment (Completed)
- 🔄 **Automatic Analysis**: Project scanning and TTL generation (In Progress)
- ⏳ **Layer 4**: Advanced code assistance
- ⏳ **Web Interface**: Management dashboard
- ⏳ **Plugin System**: Extensible architecture

## License

MIT License. See [LICENSE](LICENSE) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/aaswe/codebase-ai/issues)
- **Documentation**: [Wiki](https://github.com/aaswe/codebase-ai/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/aaswe/codebase-ai/discussions)
- **Deployment Guide**: [DEPLOYMENT.md](DEPLOYMENT.md)

---

Built with ❤️ for developers who want intelligent, context-aware code assistance.