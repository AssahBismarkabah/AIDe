# AASWE - AI-Assisted Software Engineering

AI-Assisted Software Engineering with enhanced IDE LLM context through automatic codebase analysis, knowledge graphs, and semantic code understanding.

## Overview

AASWE automatically analyzes your codebase to create comprehensive knowledge graphs and TTL files that enhance LLM interactions in your IDE. It combines Abstract Syntax Tree (AST) analysis with semantic relationships and business context to provide intelligent code assistance through the Model Context Protocol (MCP).

## 🚀 Quick Start

### Context-Only Mode (Recommended)
Perfect for individual developers who want enhanced IDE context without complex setup.

```bash
# Install globally
npm install -g @aaswe/codebase-ai

# Navigate to your project
cd your-project

# Initialize AASWE
aaswe init

# Start the system
aaswe start --mode=context-only

# Configure your IDE to connect to: ws://localhost:3001
```

### Full Mode (Advanced Development)
For teams and advanced users who want the complete 5-layer architecture with all services.

```bash
# Clone the repository
git clone https://github.com/aaswe/codebase-ai.git
cd aaswe-eng

# Start the complete Docker stack
aaswe docker up

# Access services:
# - MCP Server: ws://localhost:8000
# - Web Interface: http://localhost:3000
# - Neo4j Browser: http://localhost:7474
```

## ✨ Key Features

###  Automatic Project Analysis
- **NPM Install Trigger**: Automatically analyzes your codebase when packages are installed
- **Multi-Language Support**: TypeScript, JavaScript, Python, Java, Go, Rust, C++
- **Concrete Information**: Extracts real class names, method signatures, dependencies
- **Business Context Preservation**: Maintains developer enhancements during re-analysis

###  Knowledge Graph & Context
- **Neo4j Knowledge Graph**: Stores code relationships and semantic connections
- **TTL Files**: `.module-knowledge.ttl` files with concrete code information
- **MCP Integration**: Seamless IDE LLM enhancement via Model Context Protocol
- **Real-time Updates**: File watching and automatic context refresh

###  Local-First Architecture
- **No Cloud Dependencies**: Everything runs locally on your machine
- **Docker Integration**: Complete containerized deployment
- **Privacy Focused**: Your code never leaves your environment
- **Production Ready**: 389 tests with 100% success rate

##  Two Deployment Modes

| Feature | Context-Only Mode | Full Mode |
|---------|------------------|-----------|
| **Installation** | `npm install -g @aaswe/codebase-ai` | Git clone + Docker Compose |
| **Setup Complexity** | Simple (single command) | Advanced (Docker stack) |
| **Resource Usage** | 4GB RAM, 2 CPU cores | 8GB RAM, 4 CPU cores |
| **Services** | MCP Server + Neo4j | 15+ microservices |
| **Use Case** | Individual developers | Teams & enterprises |
| **AI Requirements** | Uses your existing IDE LLM | Advanced AI analysis |

### Context-Only Mode Architecture

```

```

### Full Mode Architecture (5-Layer System)

```

```

## 🛠️ Installation & Setup

### Prerequisites

- **Node.js** ≥18.0.0
- **Docker & Docker Compose** (for Full Mode only)
- **Git** (recommended)

### Context-Only Mode Setup

```bash
# 1. Install AASWE globally
npm install -g @aaswe/codebase-ai

# 2. Navigate to your project
cd your-project

# 3. Initialize AASWE (creates config files)
aaswe init

# 4. Start the system
aaswe start --mode=context-only

# 5. Configure your IDE to connect to: ws://localhost:3001
```

### Full Mode Setup

```bash
# 1. Clone the repository
git clone https://github.com/aaswe/codebase-ai.git
cd aaswe-eng

# 2. Set up environment variables (optional)
cp .env.example .env
# Edit .env with your API keys if needed

# 3. Start the complete Docker stack
docker-compose up -d

# 4. Access services:
# - MCP Server: ws://localhost:8000
# - Web Interface: http://localhost:3000
# - Neo4j Browser: http://localhost:7474
```

## 📋 CLI Commands

### Core Commands

```bash
# Start the AASWE system
aaswe start [options]

# Initialize AASWE in current project
aaswe init [options]

# Check server status
aaswe status

# Manually analyze project
aaswe analyze [options]
```

### Docker Commands (Full Mode)

```bash
# Start Docker services
aaswe docker up

# Stop Docker services
aaswe docker down

# View service logs
docker-compose logs -f [service-name]
```

### Command Options

```bash
# Start options
aaswe start --mode=context-only    # Context-only mode (recommended)
aaswe start --port=3001            # Custom port
aaswe start --debug                # Enable debug logging

# Init options
aaswe init --force                 # Force reinitialize

# Analyze options
aaswe analyze --output=./knowledge # Custom output directory
aaswe analyze --languages=ts,js    # Specific languages only
```

## 🔧 Automatic Analysis Workflow

AASWE automatically analyzes your codebase through a 7-phase process:

1. **Trigger Detection**: NPM install hooks detect package installations
2. **Project Discovery**: Identifies project structure and source files
3. **AST Analysis**: Multi-language code parsing and structure extraction
4. **TTL Generation**: Creates `.module-knowledge.ttl` files with concrete information
5. **Knowledge Graph Population**: Updates Neo4j with code relationships
6. **Business Context Preservation**: Maintains developer enhancements during re-analysis
7. **MCP Context Loading**: Prepares context for IDE LLM consumption

### Generated TTL Files

AASWE creates `.module-knowledge.ttl` files in your source directories:

```
src/
├── components/
│   ├── UserService.ts
│   └── .module-knowledge.ttl    ← Generated automatically
├── utils/
│   ├── helpers.ts
│   └── .module-knowledge.ttl    ← Generated automatically
```

### Business Context Enhancement

You can enhance the generated TTL files with business context:

```turtle
@prefix business: <https://aaswe.ai/ontology/business#> .
@prefix code: <https://aaswe.ai/ontology/code#> .

# Replace placeholders with actual business context
module:UserService 
    business:belongsToDomain "User Authentication and Authorization" ;
    business:hasBusinessRules "
    - Users must verify email before activation
    - Password must meet complexity requirements  
    - Failed login attempts trigger account lockout
    " ;
    business:supportsUseCases "
    - User Registration
    - User Login
    - Password Reset
    - Profile Updates
    " .
```

## 🔌 IDE Integration

### VS Code with Claude

Add to your VS Code settings:

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

Add to your Claude Desktop config:

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

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in your project root:

```bash
# Basic Configuration
NODE_ENV=production
LOG_LEVEL=info
PORT=3001

# Database Configuration (automatically configured)
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=aaswe-password

# Analysis Configuration
SUPPORTED_LANGUAGES=typescript,javascript,python,java,go,rust,cpp
ANALYSIS_DEPTH=deep
INCREMENTAL_ANALYSIS=true

# Skip automatic analysis (if needed)
AASWE_SKIP_POSTINSTALL=false
```

### Configuration File

AASWE creates an `aaswe.config.js` file when you run `aaswe init`:

```javascript
// aaswe.config.js
module.exports = {
  server: {
    name: 'AASWE-MCP-Server',
    version: '1.0.0',
    port: 3001,
    host: 'localhost'
  },
  context: {
    maxTokens: 8000,
    maxFiles: 10,
    relevanceThreshold: 0.3,
    cacheEnabled: true,
    cacheTtl: 300000
  },
  ttl: {
    watchEnabled: true,
    watchDebounce: 1000,
    maxFileSize: 1024 * 1024,
    encoding: 'utf-8'
  }
};
```

## 🔍 Service Endpoints

### Context-Only Mode
| Service | Port | Description |
|---------|------|-------------|
| AASWE MCP Server | 3001 | Main MCP server for IDE integration |
| Neo4j Browser | 7474 | Graph database web interface |
| Neo4j Bolt | 7687 | Database connection |

### Full Mode (Additional Services)
| Service | Port | Description |
|---------|------|-------------|
| MCP Server | 8000 | Enhanced MCP server |
| API Gateway | 8080 | REST API endpoints |
| Web Interface | 3000 | Management dashboard |
| LLM Gateway | 8001 | AI service coordination |
| RAG Engine | 8002 | Retrieval-Augmented Generation |
| Code Assistant | 8003 | Advanced code assistance |
| Redis Cache | 6379 | Caching layer |

## 🧪 Development & Testing

### Build from Source

```bash
git clone https://github.com/aaswe/codebase-ai.git
cd aaswe-eng
npm install
npm run build
```

### Testing

```bash
npm test                # Run all tests (389 tests)
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

### Current Test Status
- ✅ **16/16 test suites passing (100%)**
- ✅ **389/389 tests passing (100%)**
- ✅ **Clean TypeScript compilation**
- ✅ **Production-ready error handling**

## 📈 Performance & System Requirements

### Context-Only Mode (Recommended)
- **RAM**: 4GB minimum, 8GB recommended
- **CPU**: 2 cores minimum
- **Storage**: 2GB for knowledge graphs
- **Network**: Local only (no external dependencies)

### Full Mode (Advanced)
- **RAM**: 8GB minimum, 16GB recommended
- **CPU**: 4 cores minimum
- **Storage**: 5GB for complete system
- **Network**: Optional API keys for advanced AI features

### Performance Benchmarks
- **TTL Generation**: < 2 seconds for typical projects
- **Knowledge Graph Population**: < 5 seconds
- **MCP Context Loading**: < 1 second
- **Business Context Preservation**: 100% success rate

## 🔧 Troubleshooting

### Common Issues

1. **Port conflicts**
   ```bash
   # Check what's using port 3001
   lsof -i :3001
   
   # Use different port
   aaswe start --port=3002
   ```

2. **Docker issues** (Full Mode)
   ```bash
   # Check Docker status
   docker ps
   
   # View logs
   docker-compose logs -f aaswe-server
   
   # Restart services
   docker-compose restart
   ```

3. **Analysis not triggering**
   ```bash
   # Check if postinstall hook is working
   npm run postinstall
   
   # Manual analysis
   aaswe analyze
   
   # Debug mode
   AASWE_DEBUG=true aaswe start --debug
   ```

4. **Permission errors**
   ```bash
   # Fix permissions
   chmod -R 755 ./data ./knowledge
   
   # Check disk space
   df -h
   ```

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug aaswe start --debug

# Check server health
curl http://localhost:3001/health

# View detailed logs
aaswe status --verbose
```

## 🗺️ Roadmap

### ✅ Completed (Current Version)
- **Layer 1-3**: Complete code analysis and AI integration
- **MCP Server**: Full IDE integration with context enhancement
- **NPM Package**: Easy deployment and installation
- **Automatic Analysis**: 7-phase analysis pipeline with business context preservation
- **Docker Integration**: Complete containerized deployment
- **Multi-language Support**: TypeScript, JavaScript, Python, Java, Go, Rust, C++

### 🔄 In Progress
- **Web Interface**: Management dashboard and visualization
- **Final Integration Testing**: End-to-end system validation

### ⏳ Planned
- **Layer 4**: Advanced code assistance and suggestions
- **Plugin System**: Extensible architecture for custom analyzers
- **Team Features**: Multi-user collaboration and shared knowledge
- **Cloud Deployment**: SaaS offering with enterprise features

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Make changes and add tests
4. Ensure all tests pass: `npm test`
5. Commit changes: `git commit -am 'Add feature'`
6. Push branch: `git push origin feature-name`
7. Submit pull request

### Development Guidelines

- Follow TypeScript best practices
- Add tests for new features (maintain 100% test success rate)
- Update documentation
- Test both Context-Only and Full deployment modes
- Ensure Docker builds work correctly

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/AssahBismarkabah/AIDe/issues)
- **Documentation**: [Complete Architecture Guide](main/docs/FINAL_SYSTEM_ARCHITECTURE.md)
- **Discussions**: [GitHub Discussions](https://github.com/AssahBismarkabah/AIDe/discussions)
- **Quick Reference**: [TTL Files Guide](docs/QUICK_REFERENCE.md)

---

**Built with ❤️ for developers who want intelligent, context-aware code assistance that runs locally and respects privacy.**

🚀 **Get started in 2 minutes**: `npm install -g @aaswe/codebase-ai && aaswe init && aaswe start`