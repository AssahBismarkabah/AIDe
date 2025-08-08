# AASWE Installation Guide

## Quick Start (Recommended)

### Option 1: NPM Package Installation
```bash
# Install globally
npm install -g @aaswe/codebase-ai

# Initialize in your project
cd your-project
aaswe init

# Start the system
aaswe start
```

### Option 2: Docker Compose (Full System)
```bash
# Clone or download
git clone https://github.com/aaswe/codebase-ai.git
cd codebase-ai

# Start full system with Neo4j
docker-compose up -d

# Or start with web interface
docker-compose --profile web up -d
```

## Installation Options

### 1. Context-Only Mode (Recommended for Most Users)
This mode provides enhanced IDE context without requiring additional infrastructure.

```bash
npm install -g @aaswe/codebase-ai
cd your-project
aaswe init
aaswe start --port 3001
```

**Benefits:**
- ✅ No Docker required
- ✅ No database setup needed  
- ✅ Works with any IDE supporting MCP
- ✅ Automatic project analysis
- ✅ Rich TTL knowledge files

### 2. Full System Mode (Advanced Users)
Complete system with Neo4j knowledge graph and web interface.

```bash
# Using Docker Compose
docker-compose up -d

# Or build from source
npm install
npm run build
npm run docker:compose
```

**Additional Features:**
- 🔗 Neo4j knowledge graph
- 📊 Web dashboard
- 🔍 Advanced querying
- 📈 Analytics and insights

## System Requirements

### Minimum Requirements
- **Node.js**: 18.0.0 or higher
- **NPM**: 8.0.0 or higher
- **Memory**: 512MB RAM
- **Disk**: 100MB free space

### Recommended Requirements
- **Node.js**: 20.0.0 or higher
- **Memory**: 2GB RAM (for Neo4j)
- **Disk**: 1GB free space
- **Docker**: 20.0.0+ (for full system)

## Configuration

### Environment Variables
Create a `.env` file in your project root:

```bash
# API Keys (optional)
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# Neo4j Configuration (full system only)
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=aaswe-password

# Logging
LOG_LEVEL=info
NODE_ENV=production
```

### IDE Configuration

#### VS Code with Continue
1. Install Continue extension
2. Add to your `config.json`:
```json
{
  "mcpServers": {
    "aaswe": {
      "command": "node",
      "args": ["/path/to/aaswe/dist/cli/index.js", "start", "--port", "3001"],
      "env": {}
    }
  }
}
```

#### Cursor
1. Go to Settings → Features → Model Context Protocol
2. Add server:
   - **Name**: AASWE
   - **Command**: `node`
   - **Args**: `["/path/to/aaswe/dist/cli/index.js", "start", "--port", "3001"]`

#### Other IDEs
Any IDE supporting MCP can connect to `http://localhost:3001`

## Verification

### Test Installation
```bash
# Check version
aaswe --version

# Check system status
aaswe status

# Test analysis
aaswe analyze --output ./knowledge

# Start server
aaswe start --port 3001 --debug
```

### Health Checks
```bash
# Check server health
curl http://localhost:3001/health

# Check Neo4j (full system)
curl http://localhost:7474

# Check logs
aaswe logs
```

## Troubleshooting

### Common Issues

#### "Command not found: aaswe"
```bash
# Reinstall globally
npm uninstall -g @aaswe/codebase-ai
npm install -g @aaswe/codebase-ai

# Or use npx
npx @aaswe/codebase-ai --version
```

#### "Port 3001 already in use"
```bash
# Use different port
aaswe start --port 3002

# Or kill existing process
lsof -ti:3001 | xargs kill -9
```

#### "Neo4j connection failed"
```bash
# Check Neo4j status
docker-compose ps neo4j

# Restart Neo4j
docker-compose restart neo4j

# Check logs
docker-compose logs neo4j
```

#### "TTL files not found"
```bash
# Re-analyze project
aaswe analyze --output ./knowledge

# Check file permissions
ls -la ./knowledge/

# Verify configuration
aaswe status
```

### Performance Optimization

#### Large Projects
```bash
# Exclude unnecessary directories
aaswe analyze --exclude "**/node_modules/**" --exclude "**/dist/**"

# Use incremental analysis
aaswe analyze --incremental

# Limit analysis depth
aaswe analyze --depth basic
```

#### Memory Issues
```bash
# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"
aaswe start

# Or use Docker with memory limits
docker-compose up -d --memory 2g
```

## Advanced Configuration

### Custom Analysis Patterns
Create `.aaswe/config.json`:
```json
{
  "analysis": {
    "includePatterns": ["**/*.ts", "**/*.js", "**/*.py"],
    "excludePatterns": ["**/test/**", "**/node_modules/**"],
    "languages": ["typescript", "javascript", "python"],
    "depth": "comprehensive"
  },
  "output": {
    "directory": "./knowledge",
    "format": "ttl",
    "preserveBusinessContext": true
  },
  "server": {
    "port": 3001,
    "enableCors": true,
    "logLevel": "info"
  }
}
```

### Docker Customization
Override `docker-compose.override.yml`:
```yaml
version: '3.8'
services:
  aaswe-server:
    environment:
      - CUSTOM_VAR=value
    volumes:
      - ./custom-config:/app/config
```

## Support

### Getting Help
- 📚 [Documentation](https://github.com/aaswe/codebase-ai/docs)
- 🐛 [Issues](https://github.com/aaswe/codebase-ai/issues)
- 💬 [Discussions](https://github.com/aaswe/codebase-ai/discussions)
- 📧 [Email Support](mailto:support@aaswe.dev)

### Contributing
- 🔧 [Development Guide](./DEVELOPMENT.md)
- 🤝 [Contributing Guidelines](./CONTRIBUTING.md)
- 📋 [Code of Conduct](./CODE_OF_CONDUCT.md)

## License
MIT License - see [LICENSE](./LICENSE) file for details.