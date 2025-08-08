# AASWE Deployment Guide

This guide covers different deployment options for the AI-Assisted Software Engineering (AASWE) system.

## Quick Start

### Option 1: NPM Global Installation (Recommended)

```bash
# Install globally
npm install -g @aaswe/codebase-ai

# Navigate to your project
cd /path/to/your/project

# Initialize AASWE
aaswe init

# Start in context-only mode (recommended)
aaswe start --mode=context-only

# Or start with full AI capabilities
aaswe start --mode=full
```

### Option 2: Docker Compose (Full System)

```bash
# Clone the repository
git clone <repository-url>
cd aaswe-eng

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f aaswe-server
```

## Deployment Modes

### Context-Only Mode (Recommended)

**What it does:**
- Analyzes your codebase and generates TTL knowledge files
- Provides rich context to your existing IDE LLM
- No additional AI models required
- Lightweight and fast

**Best for:**
- Developers who already have IDE LLMs (Claude, GPT-4, etc.)
- Teams wanting enhanced code context
- Quick setup and minimal resource usage

```bash
aaswe start --mode=context-only --port=3001
```

### Full Mode (Advanced)

**What it does:**
- Everything from context-only mode
- Additional AI analysis capabilities
- RAG-based question answering
- Graph-based code queries
- SPARQL knowledge queries

**Best for:**
- Teams wanting comprehensive AI analysis
- Advanced code intelligence features
- Research and development environments

```bash
aaswe start --mode=full --port=3001
```

## Environment Setup

### Required Environment Variables

Create a `.env` file in your project root:

```bash
# Basic Configuration
NODE_ENV=production
LOG_LEVEL=info
PORT=3001

# Database Configuration (for full mode)
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password

# AI API Keys (for full mode)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

### Docker Environment

For Docker deployments, copy and modify the environment template:

```bash
cp .env.example .env
# Edit .env with your configuration
```

## Architecture Overview

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

## Service Configuration

### AASWE Server

- **Port:** 3001 (configurable)
- **Health Check:** `http://localhost:3001/health`
- **MCP Protocol:** Stdio and HTTP transport
- **Data Storage:** `./data` and `./knowledge` directories

### Neo4j Database (Full Mode)

- **Web Interface:** http://localhost:7474
- **Bolt Protocol:** bolt://localhost:7687
- **Default Credentials:** neo4j/aaswe-password
- **Memory:** 2GB heap, 1GB page cache

### Redis Cache (Full Mode)

- **Port:** 6379
- **Memory Limit:** 256MB
- **Persistence:** AOF enabled
- **Eviction:** LRU policy

## CLI Commands

### Basic Commands

```bash
# Start the server
aaswe start [options]

# Initialize project
aaswe init [options]

# Check status
aaswe status

# Analyze project
aaswe analyze [options]

# Docker management
aaswe docker up
aaswe docker down
aaswe docker logs
```

### Command Options

```bash
# Start command options
aaswe start --mode=context-only    # Context-only mode
aaswe start --mode=full            # Full AI capabilities
aaswe start --port=3001            # Custom port
aaswe start --project-path=/path   # Custom project path

# Init command options
aaswe init --mode=context-only     # Initialize for context-only
aaswe init --force                 # Force reinitialize

# Analyze command options
aaswe analyze --output=./knowledge # Custom output directory
aaswe analyze --languages=ts,js    # Specific languages only
```

## Docker Compose Services

### Production Deployment

```yaml
# docker-compose.yml
version: '3.8'
services:
  aaswe-server:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - NEO4J_URI=bolt://neo4j:7687
    depends_on:
      - neo4j
      - redis
    volumes:
      - ./data:/app/data
      - ./knowledge:/app/knowledge

  neo4j:
    image: neo4j:5.15-community
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      - NEO4J_AUTH=neo4j/aaswe-password
    volumes:
      - neo4j-data:/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
```

### Development Deployment

```yaml
# docker-compose.local.yml
version: '3.8'
services:
  aaswe-server:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
    volumes:
      - .:/app
      - /app/node_modules
```

## Monitoring and Logging

### Health Checks

```bash
# Check AASWE server health
curl http://localhost:3001/health

# Check Neo4j health
curl http://localhost:7474/db/data/

# Check Redis health
redis-cli ping
```

### Log Management

```bash
# View AASWE logs
aaswe docker logs aaswe-server

# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f neo4j
docker-compose logs -f redis
```

### Performance Monitoring

```bash
# Check resource usage
docker stats

# Monitor Neo4j performance
# Access Neo4j Browser at http://localhost:7474
# Run: CALL dbms.queryJmx("org.neo4j:instance=kernel#0,name=Transactions")

# Monitor Redis performance
redis-cli info memory
redis-cli info stats
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using the port
   lsof -i :3001
   
   # Use different port
   aaswe start --port=3002
   ```

2. **Neo4j Connection Failed**
   ```bash
   # Check Neo4j status
   docker-compose ps neo4j
   
   # Check Neo4j logs
   docker-compose logs neo4j
   
   # Restart Neo4j
   docker-compose restart neo4j
   ```

3. **Memory Issues**
   ```bash
   # Check Docker memory usage
   docker stats
   
   # Increase Neo4j memory limits in docker-compose.yml
   NEO4J_dbms_memory_heap_max__size: 4g
   ```

4. **Permission Issues**
   ```bash
   # Fix data directory permissions
   sudo chown -R $USER:$USER ./data ./knowledge
   chmod -R 755 ./data ./knowledge
   ```

### Debug Mode

```bash
# Start with debug logging
LOG_LEVEL=debug aaswe start

# Enable Docker debug mode
DOCKER_BUILDKIT=1 docker-compose build --progress=plain
```

## Security Considerations

### Production Security

1. **Change Default Passwords**
   ```bash
   # Update Neo4j password
   NEO4J_AUTH=neo4j/your-secure-password
   ```

2. **Network Security**
   ```bash
   # Bind to localhost only
   ports:
     - "127.0.0.1:3001:3001"
   ```

3. **API Key Management**
   ```bash
   # Use environment variables, never commit keys
   export OPENAI_API_KEY="your-key"
   export ANTHROPIC_API_KEY="your-key"
   ```

4. **File Permissions**
   ```bash
   # Secure data directories
   chmod 700 ./data ./knowledge
   ```

## Scaling and Performance

### Horizontal Scaling

```yaml
# docker-compose.yml
services:
  aaswe-server:
    deploy:
      replicas: 3
    ports:
      - "3001-3003:3001"
```

### Performance Tuning

```yaml
# Optimize Neo4j for large codebases
environment:
  - NEO4J_dbms_memory_heap_max__size=8g
  - NEO4J_dbms_memory_pagecache_size=4g
  - NEO4J_dbms_tx_log_rotation_retention__policy=1G size

# Optimize Redis for caching
command: >
  redis-server
  --maxmemory 1gb
  --maxmemory-policy allkeys-lru
  --save 900 1
```

## Backup and Recovery

### Data Backup

```bash
# Backup Neo4j data
docker-compose exec neo4j neo4j-admin dump --database=neo4j --to=/backups/neo4j-backup.dump

# Backup Redis data
docker-compose exec redis redis-cli BGSAVE

# Backup knowledge files
tar -czf knowledge-backup.tar.gz ./knowledge
```

### Data Recovery

```bash
# Restore Neo4j data
docker-compose exec neo4j neo4j-admin load --from=/backups/neo4j-backup.dump --database=neo4j --force

# Restore knowledge files
tar -xzf knowledge-backup.tar.gz
```

## Integration Examples

### VS Code Integration

```json
// .vscode/settings.json
{
  "mcp.servers": {
    "aaswe": {
      "command": "npx",
      "args": ["@aaswe/codebase-ai", "start", "--mode=context-only"],
      "env": {
        "PROJECT_PATH": "${workspaceFolder}"
      }
    }
  }
}
```

### Claude Desktop Integration

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

## Support and Documentation

- **GitHub Issues:** Report bugs and feature requests
- **Documentation:** Comprehensive guides and API reference
- **Community:** Join discussions and get help
- **Examples:** Sample projects and integrations

For more detailed information, see the main [README.md](README.md) and service-specific documentation in the `src/services/` directories.