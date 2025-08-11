# AASWE - AI-Assisted Engineering

[![npm version](https://badge.fury.io/js/@aaswe/codebase-ai.svg)](https://badge.fury.io/js/@aaswe/codebase-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/aaswe/codebase-ai/workflows/Node.js%20CI/badge.svg)](https://github.com/aaswe/codebase-ai/actions)

**Rich codebase context for IDE LLMs through automatic analysis and knowledge graph generation.**

AASWE transforms your codebase into structured knowledge that enhances your IDE's AI capabilities. Get better code suggestions, more accurate refactoring, and deeper insights by providing your LLM with comprehensive project context.

##  Quick Start

> ** Package Status**: Ready for NPM publication! Currently available as tarball for testing.

### Option 1: One-Command Complete Setup  (Recommended)
```bash
# Install, setup, and start complete system with all containers
curl -fsSL https://raw.githubusercontent.com/aaswe/codebase-ai/main/scripts/one-command-deploy.sh | bash
```
**This gives you everything**: Neo4j database + MCP server + Redis cache

### Option 2: NPM Installation (Coming Soon)
```bash
# Will be available after NPM publication
npm install -g @aaswe/codebase-ai

# For lightweight mode (TTL files only)
codebase-ai start

# For complete system (all containers)
codebase-ai full-start
```

### Option 3: Direct Installation (Current)
```bash
# Download and install from tarball
curl -L -o codebase-ai.tgz https://github.com/aaswe/codebase-ai/releases/latest/download/aaswe-codebase-ai-1.0.0.tgz
npm install -g ./codebase-ai.tgz

# Initialize and start complete system
cd your-project
codebase-ai init --mode full
codebase-ai full-start
```

### Option 3: Docker Compose (Full System)
```bash
# Clone and start
git clone https://github.com/aaswe/codebase-ai.git
cd codebase-ai
docker-compose up -d
```

##  Features

###  **Triple Context System**
- **TTL Metadata**: Structured semantic knowledge in RDF/TTL format
- **Neo4j Source Code**: Complete source code + relationships in graph database
- **MCP Integration**: Universal IDE compatibility with unified context delivery

###  **Multi-Language Code Analysis**
- **12 Languages**: TypeScript, JavaScript, Python, Java, Go, Rust, C++, C#, PHP, Ruby, Kotlin, Scala, Swift
- **Complete Source Storage**: Full source code stored in Neo4j for LLM queries
- **Concrete Information**: Real class names, method signatures, dependencies
- **Architectural Patterns**: Factory, Singleton, Observer, Builder pattern detection

###  **Automatic Synchronization**
- **Git Integration**: Auto-updates on commits and merges
- **TTL File Changes**: Automatic Neo4j knowledge graph updates
- **Source Code Changes**: Automatic TTL regeneration + graph updates
- **Business Context Preservation**: Maintains developer annotations during re-analysis

### **Universal IDE Integration**
- **Model Context Protocol (MCP)**: Works with any MCP-compatible IDE
- **VS Code + Continue**: Native integration
- **Cursor**: Built-in MCP support
- **Real-time Context**: Always-current codebase knowledge

###  **One-Command Deployment**
- **Complete System**: Neo4j + MCP Server + Redis with single command
- **Lightweight Mode**: TTL-only mode for individual developers
- **Docker Compose**: Full containerized deployment
- **Neo4j Browser**: Built-in graph visualization and exploration

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

# With debug logging
codebase-ai start --debug
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

#### VS Code with Continue
1. Install the [Continue extension](https://marketplace.visualstudio.com/items?itemName=Continue.continue)
2. Add to your Continue `config.json`:
```json
{
  "mcpServers": {
    "aaswe": {
      "command": "codebase-ai",
      "args": ["start", "--port", "3001"],
      "env": {}
    }
  }
}
```

#### Cursor
1. Go to **Settings → Features → Model Context Protocol**
2. Add server:
   - **Name**: AASWE
   - **Command**: `codebase-ai`
   - **Args**: `["start", "--port", "3001"]`

#### Other IDEs
Connect to the MCP server at `ws://localhost:3001`

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
git clone https://github.com/aaswe/codebase-ai.git
cd codebase-ai

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

- **GitHub**: https://github.com/aaswe/codebase-ai
- **NPM Package**: https://www.npmjs.com/package/@aaswe/codebase-ai
- **Documentation**: https://aaswe.github.io/codebase-ai
- **Issues**: https://github.com/aaswe/codebase-ai/issues
- **Discussions**: https://github.com/aaswe/codebase-ai/discussions

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