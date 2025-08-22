# AASWE - AI-Assisted Software Engineering

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Rich codebase context for IDE LLMs through automatic analysis and TTL knowledge generation.**

AASWE transforms your codebase into structured semantic knowledge (RDF/TTL format) that enhances your IDE's AI capabilities. Get better code suggestions, more accurate refactoring, and deeper insights by providing your LLM with comprehensive project context through the Model Context Protocol (MCP).

##  Quick Start

> **Package Status**: Available on NPM Registry https://www.npmjs.com/package/@aaswe/codebase-ai

### Option 1: NPM Installation (Recommended)
```bash
# Install from NPM registry
npm install -g @aaswe/codebase-ai

# Navigate to your project and start
cd your-project

# For lightweight mode (TTL files only)
codebase-ai start

# For complete system (Neo4j + MCP Server + Redis)
codebase-ai full-start --build

# Start MCP server for IDE integration
codebase-ai mcp --transport both
```

### Option 2: Docker Compose (Full System)
```bash
# Clone and start
git clone https://github.com/AssahBismarkabah/AIDe.git
cd AIDe
docker-compose up -d
```

### Option 3: Local Development
```bash
# Clone repository for development
git clone https://github.com/AssahBismarkabah/AIDe.git
cd AIDe
npm install
npm run build

# Run locally
node dist/cli/index.js full-start --build
```

##  Visual Overview

![Neo4j Knowledge Graph](main/docs/Screenshot%20from%202025-08-22%2016-24-47.png)

**Live Knowledge Graph Visualization** - AASWE automatically generates comprehensive Neo4j graph databases showing your codebase structure. The example above shows a  Java java codebase:

- ** Module Nodes**: Each directory/module represented as connected nodes
- ** Dependency Relationships**: Clear visualization of how modules depend on each other
- ** Entity Metrics**: Real class, method, and function counts displayed on nodes
- ** Architecture Patterns**: Visual detection of architectural layers and patterns
- **Interactive Exploration**: Click and explore your codebase structure in real-time

##  Features

###  **Semantic Knowledge Generation**
- **TTL Files**: Structured semantic knowledge in RDF/TTL format for each module
- **Real Entity Counts**: Actual class, function, and dependency statistics
- **Module-Level Context**: Comprehensive analysis of code structure and relationships
- **Business Context**: Preserves developer annotations and domain knowledge

###  **Multi-Language Code Analysis**
- **12 Languages**: TypeScript, JavaScript, Python, Java, Go, Rust, C++, C#, PHP, Ruby, Kotlin, Scala, Swift
- **Recursive Discovery**: Finds and analyzes all source files throughout project tree
- **Concrete Information**: Real class names, method signatures, dependencies, imports
- **Architectural Patterns**: Detects common design patterns and code structures

### **Universal IDE Integration via MCP**
- **Model Context Protocol**: Works with any MCP-compatible IDE
- **Dual Transport**: WebSocket and Stdio support for maximum compatibility
- **RooCode/Cline**: Stdio transport for CLI-based IDEs
- **VS Code/Cursor**: WebSocket transport for GUI IDEs
- **Real-time Updates**: File watching and automatic context refresh

###  **Flexible Deployment Options**
- **Context-Only Mode**: TTL files only (recommended for most users)
- **Full System Mode**: Neo4j + MCP Server + Redis for advanced features
- **Docker Compose**: Complete containerized deployment
- **Local Installation**: NPM package for easy setup

##  System Requirements

### Minimum (Context-Only Mode)
- **Node.js**: 18.0.0+
- **Memory**: 512MB RAM
- **Disk**: 100MB free space

### Recommended (Full System)
- **Node.js**: 20.0.0+
- **Memory**: 2GB RAM
- **Disk**: 1GB free space
- **Docker**: 20.0.0+ (for full system)

##  Installation & Setup

### Global Installation
```bash
npm install -g @aaswe/codebase-ai
```

### Project Initialization
```bash
# Navigate to your project
cd your-project

# Initialize AASWE
codebase-ai init

# For full system mode
codebase-ai init --mode full
```

### Configuration
AASWE creates these files:
- `aaswe.config.js` - Main configuration
- `.env.aaswe` - Environment variables
- `.aaswe/` - Analysis cache and knowledge files

##  Usage

### Basic Commands

#### Start the System
```bash
# Context-only mode (recommended)
codebase-ai start

# Full system mode
codebase-ai start --mode full --port 8000

# Complete system with all containers (Neo4j + MCP + Redis)
codebase-ai full-start --build

# With debug logging
codebase-ai start --debug
```

#### MCP Server Commands (NEW)
```bash
# Start MCP server with stdio transport (for RooCode/Cline)
codebase-ai mcp --transport stdio

# Start MCP server with WebSocket transport (for VS Code/Cursor)
codebase-ai mcp --transport websocket --port 3001

# Start both transports (maximum compatibility)
codebase-ai mcp --transport both --port 3001

# With Neo4j integration
codebase-ai mcp --transport both --neo4j-uri bolt://localhost:7687 --neo4j-username neo4j --neo4j-password aaswe-password

# With debug logging
codebase-ai mcp --transport stdio --debug
```

#### Analyze Your Project
```bash
# Basic analysis
codebase-ai analyze

# Custom output directory
codebase-ai analyze --output ./knowledge

# Specific languages
codebase-ai analyze --languages typescript,python
```

#### Check Status
```bash
# Check if server is running
codebase-ai status

# Check specific port
codebase-ai status --port 3001
```

#### Docker Commands
```bash
# Start with Docker
codebase-ai docker up -d

# View logs
codebase-ai docker logs -f

# Stop services
codebase-ai docker down
```

### IDE Configuration

AASWE provides **dual-transport MCP support** for maximum IDE compatibility:

#### RooCode / Cline (Stdio Transport)
1. **Start AASWE System** (in your project directory):
```bash
# Option 1: Full system with containers
node dist/cli/index.js full-start --project-path ./your-project --build

# Option 2: Standalone MCP server (TTL files only)
node dist/cli/index.js mcp --transport stdio --ttl-directories ./your-project
```

2. **Add to RooCode/Cline MCP Settings**:
```json
{
  "mcpServers": {
    "aaswe": {
      "command": "node",
      "args": [
        "/path/to/aaswe/dist/cli/index.js",
        "mcp",
        "--transport",
        "stdio",
        "--ttl-directories",
        "/path/to/your/project"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**Global Installation (NPM):**
```json
{
  "mcpServers": {
    "aaswe": {
      "command": "codebase-ai",
      "args": ["mcp", "--transport", "stdio", "--ttl-directories", "/path/to/your/project"]
    }
  }
}
```

#### VS Code with Continue (WebSocket)
1. Install the [Continue extension](https://marketplace.visualstudio.com/items?itemName=Continue.continue)
2. **Start AASWE WebSocket Server**:
```bash
node dist/cli/index.js mcp --transport websocket --port 3001
```
3. Add to your Continue `config.json`:
```json
{
  "mcpServers": {
    "aaswe": {
      "command": "codebase-ai",
      "args": ["mcp", "--transport", "websocket", "--port", "3001"],
      "env": {}
    }
  }
}
```

#### Cursor (WebSocket)
1. **Start AASWE WebSocket Server**:
```bash
node dist/cli/index.js mcp --transport websocket --port 3001
```
2. Go to **Settings → Features → Model Context Protocol**
3. Add server:
   - **Name**: AASWE
   - **Command**: `codebase-ai`
   - **Args**: `["mcp", "--transport", "websocket", "--port", "3001"]`

#### Both Transports (Maximum Compatibility)
```bash
# Start both WebSocket and Stdio transports
node dist/cli/index.js mcp --transport both --port 3001
```

#### Other IDEs
- **WebSocket**: Connect to `ws://localhost:3001`
- **Stdio**: Use command-line MCP client with stdio transport

##  Project Structure

```
your-project/
├── aaswe.config.js          # AASWE configuration
├── .env.aaswe              # Environment variables
├── .aaswe/                 # AASWE data directory
│   ├── knowledge/          # Generated TTL files
│   ├── cache/              # Analysis cache
│   └── backups/            # Business context backups
└── knowledge/              # Custom output directory
    ├── src.module-knowledge.ttl
    ├── services.module-knowledge.ttl
    └── ...
```

##  Configuration

### Basic Configuration (`aaswe.config.js`)
```javascript
module.exports = {
  mode: 'context-only', // or 'full'
  server: {
    port: 3001,
    host: 'localhost'
  },
  context: {
    maxTokens: 8000,
    maxFiles: 10,
    relevanceThreshold: 0.3
  },
  ttl: {
    watchEnabled: true,
    watchDebounce: 1000
  }
};
```

### Environment Variables (`.env.aaswe`)
```bash
# API Keys (optional)
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# Neo4j (full mode only)
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=aaswe-password

# Analysis settings
ANALYSIS_DEPTH=comprehensive
PRESERVE_BUSINESS_CONTEXT=true
```

## 🔧 Advanced Usage

### Custom Analysis Patterns
```javascript
// aaswe.config.js
module.exports = {
  analysis: {
    includePatterns: ['**/*.ts', '**/*.js', '**/*.py'],
    excludePatterns: ['**/test/**', '**/node_modules/**'],
    languages: ['typescript', 'javascript', 'python'],
    depth: 'comprehensive'
  }
};
```

### Business Context Enhancement
```turtle
# Add business context to generated TTL files
@prefix biz: <http://aaswe.org/business#> .

aide:UserService a aide:Class ;
    biz:businessDomain "User Management" ;
    biz:businessRule "Users must have unique email addresses" ;
    biz:businessProcess "User registration and authentication" .
```

### Docker Customization
```yaml
# docker-compose.override.yml
version: '3.8'
services:
  aaswe-server:
    environment:
      - CUSTOM_SETTING=value
    volumes:
      - ./custom-config:/app/config
```

##  Monitoring & Health Checks

### Health Check Endpoint
```bash
curl http://localhost:3001/health
```

### System Status
```bash
# Check all services
codebase-ai status

# Docker services
codebase-ai docker logs aaswe-server
```

### Metrics (Full Mode)
- **Web Interface**: http://localhost:3000
- **Neo4j Browser**: http://localhost:7474
- **Metrics Endpoint**: http://localhost:9090/metrics

##  Troubleshooting

### Common Issues

#### "Command not found: aaswe"
```bash
# Reinstall globally
npm uninstall -g @aaswe/codebase-ai
npm install -g @aaswe/codebase-ai

# Or use npx
npx @aaswe/codebase-ai --version
```

#### "Port already in use"
```bash
# Use different port
aaswe start --port 3002

# Or kill existing process
lsof -ti:3001 | xargs kill -9
```

#### "TTL files not found"
```bash
# Re-analyze project
codebase-ai analyze --output ./knowledge

# Check permissions
ls -la ./knowledge/
```

#### "Neo4j connection failed"
```bash
# Check Neo4j status
docker-compose ps neo4j

# Restart Neo4j
docker-compose restart neo4j

# Start full system properly
codebase-ai full-start --build
```

#### "MCP Server Connection Issues"
```bash
# Test MCP stdio connection
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | codebase-ai mcp --transport stdio

# Check if MCP server is running
codebase-ai status --port 3001

# Restart with debug logging
codebase-ai mcp --transport both --debug

# For RooCode: Ensure correct path in MCP settings
ls -la /path/to/your/project/dist/cli/index.js
```

#### "TTL files showing zero counts"
```bash
# This was a known bug - now resolved!
# Re-analyze to get real entity counts
codebase-ai analyze --output ./knowledge

# Check if TTL files contain real data
grep -E "(classCount|functionCount|methodCount)" ./knowledge/*.ttl
```

### Performance Optimization

#### Large Projects
```bash
# Exclude unnecessary files
codebase-ai analyze --exclude "**/node_modules/**,**/dist/**"

# Use incremental analysis
codebase-ai analyze --incremental

# Limit analysis depth
codebase-ai analyze --depth basic
```

#### Memory Issues
```bash
# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"
codebase-ai start
```

##  Architecture

### Deployment Modes

#### Context-Only Mode
```

```

#### Full System Mode
```

```

### Technology Stack
- **Backend**: Node.js, TypeScript
- **Knowledge**: RDF/TTL, SPARQL
- **Database**: Neo4j (optional)
- **Protocol**: Model Context Protocol (MCP)
- **Deployment**: Docker, Docker Compose

##  Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Setup
```bash
# Clone repository
git clone https://github.com/AssahBismarkabah/AIDe.git
cd AIDe

# Install dependencies
npm install

# Build project
npm run build

# Run tests
npm test

# Start development server
npm run dev
```

### Running Tests
```bash
# All tests
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 📚 Documentation

- **[Installation Guide](./INSTALLATION.md)** - Detailed setup instructions
- **[API Documentation](./docs/API.md)** - MCP server API reference
- **[Architecture Guide](./docs/ARCHITECTURE.md)** - System design and components
- **[Development Guide](./DEVELOPMENT.md)** - Contributing and development setup

##  Links

- **GitHub**: https://github.com/AssahBismarkabah/AIDe
- **NPM Package**: https://www.npmjs.com/package/@aaswe/codebase-ai
- **Issues**: https://github.com/AssahBismarkabah/AIDe/issues
- **Discussions**: https://github.com/AssahBismarkabah/AIDe/discussions

##  License

MIT License - see [LICENSE](./LICENSE) file for details.

##  Acknowledgments

- **Model Context Protocol**: For the universal IDE integration standard
- **Neo4j**: For the powerful graph database
- **RDF/SPARQL**: For semantic web standards
- **TypeScript**: For type-safe development
- **Docker**: For containerization and easy deployment

---

**Made with ❤️ by the AASWE Team**

*Transform your codebase into intelligent context for better AI-assisted development.*