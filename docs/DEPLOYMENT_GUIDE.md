# AASWE Deployment Guide

## Overview

This guide covers deploying the AI-Assisted Software Engineering (AASWE) system for production use and distribution via NPM.

## Table of Contents

1. [NPM Package Distribution](#npm-package-distribution)
2. [Docker Compose Deployment](#docker-compose-deployment)
3. [Local Development Setup](#local-development-setup)
4. [Production Deployment](#production-deployment)
5. [Configuration Management](#configuration-management)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)

## NPM Package Distribution

### Package Structure

The AASWE system is distributed as a global NPM package with the following structure:

```
@aaswe/codebase-ai/
├── package.json
├── README.md
├── bin/
│   └── aaswe                    # Global CLI executable
├── dist/                        # Compiled TypeScript
├── docker-compose.yml           # Complete system deployment
├── .env.example                 # Environment template
└── docs/                        # Documentation
```

### Publishing to NPM

#### Prerequisites

1. **NPM Account**: Ensure you have an NPM account with publishing permissions
2. **Organization Setup**: Create `@aaswe` organization on NPM
3. **Build System**: Ensure TypeScript compilation works correctly

#### Publishing Steps

1. **Prepare Package**:
```bash
# Build the project
npm run build

# Update version
npm version patch|minor|major

# Test package locally
npm pack
npm install -g ./aaswe-codebase-ai-*.tgz
```

2. **Publish Package**:
```bash
# Login to NPM
npm login

# Publish to NPM registry
npm publish --access public

# Verify publication
npm view @aaswe/codebase-ai
```

3. **Post-Publication**:
```bash
# Test global installation
npm install -g @aaswe/codebase-ai

# Verify CLI works
aaswe --version
aaswe --help
```

### Package Configuration

#### package.json Configuration

```json
{
  "name": "@aaswe/codebase-ai",
  "version": "1.0.0",
  "description": "AI-Assisted Software Engineering with automatic codebase analysis",
  "main": "dist/index.js",
  "bin": {
    "aaswe": "bin/aaswe"
  },
  "files": [
    "dist/",
    "bin/",
    "docker-compose.yml",
    ".env.example",
    "docs/",
    "README.md"
  ],
  "keywords": [
    "ai",
    "software-engineering",
    "code-analysis",
    "llm",
    "neo4j",
    "ttl",
    "mcp"
  ],
  "engines": {
    "node": ">=18.0.0"
  },
  "os": ["darwin", "linux", "win32"],
  "preferGlobal": true
}
```

#### CLI Executable (bin/aaswe)

```bash
#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');

// Get the installation directory
const installDir = path.dirname(__dirname);
const cliPath = path.join(installDir, 'dist', 'cli', 'index.js');

// Execute the CLI with all arguments
const child = spawn('node', [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: process.cwd()
});

child.on('exit', (code) => {
  process.exit(code);
});
```

## Docker Compose Deployment

### Complete System Deployment

The system includes a comprehensive Docker Compose setup for easy deployment:

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Neo4j Database
  neo4j:
    image: neo4j:5.15-community
    container_name: aaswe-neo4j
    ports:
      - "7474:7474"  # HTTP
      - "7687:7687"  # Bolt
    environment:
      NEO4J_AUTH: neo4j/aaswe-password
      NEO4J_PLUGINS: '["apoc"]'
      NEO4J_dbms_security_procedures_unrestricted: apoc.*
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
    healthcheck:
      test: ["CMD-SHELL", "cypher-shell -u neo4j -p aaswe-password 'RETURN 1'"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: aaswe-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # AASWE Server
  aaswe-server:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: aaswe-server
    ports:
      - "3001:3001"  # MCP Server
      - "8080:8080"  # Health/Admin
    environment:
      - NODE_ENV=production
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USERNAME=neo4j
      - NEO4J_PASSWORD=aaswe-password
      - REDIS_URL=redis://redis:6379
      - MCP_SERVER_PORT=3001
      - ADMIN_PORT=8080
    volumes:
      - ./projects:/app/projects  # Mount project directories
      - aaswe_logs:/app/logs
    depends_on:
      neo4j:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  neo4j_data:
  neo4j_logs:
  redis_data:
  aaswe_logs:

networks:
  default:
    name: aaswe-network
```

### Deployment Commands

```bash
# Deploy complete system
docker-compose up -d

# Check service health
docker-compose ps
docker-compose logs -f aaswe-server

# Scale services (if needed)
docker-compose up -d --scale aaswe-server=2

# Update services
docker-compose pull
docker-compose up -d --force-recreate

# Backup data
docker-compose exec neo4j neo4j-admin dump --database=neo4j --to=/data/backup.dump
docker cp aaswe-neo4j:/data/backup.dump ./backups/

# Restore data
docker cp ./backups/backup.dump aaswe-neo4j:/data/
docker-compose exec neo4j neo4j-admin load --from=/data/backup.dump --database=neo4j --force
```

## Local Development Setup

### Quick Start

```bash
# Install globally
npm install -g @aaswe/codebase-ai

# Initialize in project directory
cd /path/to/your/project
aaswe init

# Start services
aaswe start

# Analyze codebase
aaswe analyze

# View results
aaswe status
```

### Manual Setup

```bash
# Clone repository
git clone https://github.com/your-org/aaswe-eng.git
cd aaswe-eng

# Install dependencies
npm install

# Setup environment
cp .env.example .env.aaswe
# Edit .env.aaswe with your configuration

# Build project
npm run build

# Start development services
docker-compose -f docker-compose.dev.yml up -d

# Run CLI
npm run cli -- analyze --project ./test-project
```

### Development Environment Variables

```bash
# .env.aaswe (Development)
NODE_ENV=development
LOG_LEVEL=debug

# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=aaswe-password
NEO4J_DATABASE=neo4j

# Redis Configuration
REDIS_URL=redis://localhost:6379

# MCP Server Configuration
MCP_SERVER_PORT=3001
MCP_SERVER_HOST=localhost

# Analysis Configuration
ANALYSIS_CONCURRENCY=4
ANALYSIS_TIMEOUT=300000
TTL_OUTPUT_DIR=./knowledge

# Git Integration
GIT_HOOKS_ENABLED=true
AUTO_ANALYSIS_ON_COMMIT=true
```

## Production Deployment

### System Requirements

#### Minimum Requirements
- **CPU**: 2 cores
- **RAM**: 4GB
- **Disk**: 20GB SSD
- **Network**: 100Mbps
- **OS**: Linux (Ubuntu 20.04+), macOS, Windows 10+

#### Recommended Requirements
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Disk**: 50GB+ SSD
- **Network**: 1Gbps
- **OS**: Linux (Ubuntu 22.04 LTS)

### Production Configuration

```bash
# .env.aaswe (Production)
NODE_ENV=production
LOG_LEVEL=info

# Security
JWT_SECRET=your-secure-jwt-secret
API_KEY=your-secure-api-key
CORS_ORIGINS=https://your-domain.com

# Database Configuration
NEO4J_URI=bolt://neo4j-cluster:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-secure-password
NEO4J_DATABASE=production

# Redis Configuration
REDIS_URL=redis://redis-cluster:6379
REDIS_PASSWORD=your-redis-password

# Performance Tuning
ANALYSIS_CONCURRENCY=8
MAX_FILE_SIZE=10485760  # 10MB
CACHE_TTL=3600
CONNECTION_POOL_SIZE=20

# Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000
LOG_RETENTION_DAYS=30
```

### Production Deployment Steps

1. **Server Preparation**:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Node.js (for CLI)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install AASWE globally
sudo npm install -g @aaswe/codebase-ai
```

2. **Service Deployment**:
```bash
# Create deployment directory
sudo mkdir -p /opt/aaswe
cd /opt/aaswe

# Copy configuration
sudo cp /path/to/.env.aaswe .
sudo cp /path/to/docker-compose.yml .

# Set permissions
sudo chown -R $USER:$USER /opt/aaswe

# Deploy services
docker-compose up -d

# Verify deployment
docker-compose ps
curl http://localhost:8080/health
```

3. **SSL/TLS Setup** (with Let's Encrypt):
```bash
# Install Certbot
sudo apt install certbot

# Get SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Update Docker Compose with SSL
# Add nginx reverse proxy with SSL termination
```

### Load Balancing and High Availability

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # Load Balancer
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - aaswe-server-1
      - aaswe-server-2

  # AASWE Server Instances
  aaswe-server-1:
    extends:
      file: docker-compose.yml
      service: aaswe-server
    container_name: aaswe-server-1

  aaswe-server-2:
    extends:
      file: docker-compose.yml
      service: aaswe-server
    container_name: aaswe-server-2

  # Neo4j Cluster
  neo4j-core-1:
    image: neo4j:5.15-enterprise
    environment:
      NEO4J_AUTH: neo4j/aaswe-password
      NEO4J_dbms_mode: CORE
      NEO4J_causal__clustering_initial__discovery__members: neo4j-core-1:5000,neo4j-core-2:5000,neo4j-core-3:5000

  # Redis Cluster
  redis-master:
    image: redis:7-alpine
    command: redis-server --appendonly yes --replica-announce-ip redis-master

  redis-replica:
    image: redis:7-alpine
    command: redis-server --slaveof redis-master 6379
```

## Configuration Management

### Environment Configuration

The system supports multiple configuration methods:

1. **Environment Files**: `.env.aaswe`, `.env`
2. **Environment Variables**: Direct system environment
3. **CLI Arguments**: Command-line overrides
4. **Configuration Files**: JSON/YAML configuration

### Configuration Hierarchy

```
CLI Arguments (highest priority)
↓
Environment Variables
↓
.env.aaswe file
↓
.env file
↓
Default values (lowest priority)
```

### Configuration Validation

```typescript
// Configuration validation schema
const configSchema = {
  neo4j: {
    uri: { required: true, type: 'string' },
    username: { required: true, type: 'string' },
    password: { required: true, type: 'string' }
  },
  mcp: {
    port: { required: true, type: 'number', min: 1024, max: 65535 },
    host: { required: false, type: 'string', default: 'localhost' }
  },
  analysis: {
    concurrency: { required: false, type: 'number', min: 1, max: 16, default: 4 },
    timeout: { required: false, type: 'number', min: 30000, default: 300000 }
  }
};
```

## Monitoring and Maintenance

### Health Monitoring

```bash
# Check system health
aaswe health

# Check individual services
curl http://localhost:8080/health
curl http://localhost:7474/db/system/tx/commit  # Neo4j
redis-cli ping  # Redis
```

### Metrics Collection

The system provides comprehensive metrics:

```typescript
// Available metrics endpoints
GET /metrics/system      // System performance
GET /metrics/analysis    // Analysis statistics
GET /metrics/neo4j       // Database metrics
GET /metrics/mcp         // MCP server metrics
```

### Log Management

```bash
# View logs
docker-compose logs -f aaswe-server
aaswe logs --tail 100

# Log rotation configuration
# /etc/logrotate.d/aaswe
/opt/aaswe/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 aaswe aaswe
}
```

### Backup and Recovery

```bash
# Automated backup script
#!/bin/bash
BACKUP_DIR="/opt/aaswe/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Neo4j backup
docker-compose exec neo4j neo4j-admin dump --database=neo4j --to=/data/backup_${DATE}.dump
docker cp aaswe-neo4j:/data/backup_${DATE}.dump ${BACKUP_DIR}/

# Configuration backup
tar -czf ${BACKUP_DIR}/config_${DATE}.tar.gz .env.aaswe docker-compose.yml

# Cleanup old backups (keep 30 days)
find ${BACKUP_DIR} -name "*.dump" -mtime +30 -delete
find ${BACKUP_DIR} -name "*.tar.gz" -mtime +30 -delete
```

### Performance Tuning

#### Neo4j Optimization

```bash
# Neo4j configuration tuning
NEO4J_dbms_memory_heap_initial__size=2G
NEO4J_dbms_memory_heap_max__size=4G
NEO4J_dbms_memory_pagecache_size=2G
NEO4J_dbms_tx__log_rotation_retention__policy=100M size
```

#### Application Optimization

```bash
# Node.js optimization
NODE_OPTIONS="--max-old-space-size=4096"
UV_THREADPOOL_SIZE=16

# Analysis optimization
ANALYSIS_BATCH_SIZE=50
ANALYSIS_PARALLEL_FILES=10
TTL_CACHE_SIZE=1000
```

### Troubleshooting

#### Common Issues

1. **Neo4j Connection Issues**:
```bash
# Check Neo4j status
docker-compose exec neo4j cypher-shell -u neo4j -p aaswe-password "RETURN 1"

# Reset Neo4j password
docker-compose exec neo4j cypher-shell -u neo4j -p neo4j "ALTER CURRENT USER SET PASSWORD 'aaswe-password'"
```

2. **Memory Issues**:
```bash
# Check memory usage
docker stats
free -h

# Increase container memory limits
# In docker-compose.yml:
deploy:
  resources:
    limits:
      memory: 4G
```

3. **Analysis Performance**:
```bash
# Check analysis logs
aaswe logs --level debug --component analysis

# Reduce concurrency
export ANALYSIS_CONCURRENCY=2

# Increase timeout
export ANALYSIS_TIMEOUT=600000
```

### Support and Updates

#### Getting Support

1. **Documentation**: Check docs/ directory
2. **GitHub Issues**: Report bugs and feature requests
3. **Community**: Join discussions and forums
4. **Enterprise Support**: Contact for commercial support

#### Updates and Upgrades

```bash
# Update NPM package
npm update -g @aaswe/codebase-ai

# Update Docker images
docker-compose pull
docker-compose up -d --force-recreate

# Database migrations (if needed)
aaswe migrate --from-version 1.0.0 --to-version 1.1.0
```

This deployment guide provides comprehensive instructions for deploying AASWE in various environments, from local development to production clusters. The system is designed to be scalable, maintainable, and production-ready.