# 📦 Publication Guide for @aaswe/codebase-ai

## Overview

This guide covers multiple ways to distribute the `@aaswe/codebase-ai` package to developers worldwide.

## 🚀 Method 1: NPM Registry Publication (Recommended)

### Prerequisites
1. **NPM Account**: Create account at [npmjs.com](https://npmjs.com)
2. **Organization**: Create `@aaswe` organization (or use existing)
3. **Authentication**: Login via CLI

### Step-by-Step Publication

```bash
# 1. Login to NPM
npm login
# Enter your NPM credentials

# 2. Verify login
npm whoami

# 3. Publish the package
npm publish

# 4. Verify publication
npm view @aaswe/codebase-ai
```

### Post-Publication
Once published, developers can install globally:
```bash
npm install -g @aaswe/codebase-ai
codebase-ai --help
```

## 🔄 Method 2: GitHub Packages (Alternative)

### Setup GitHub Packages
```bash
# 1. Create .npmrc in project root
echo "@aaswe:registry=https://npm.pkg.github.com" > .npmrc

# 2. Login to GitHub Packages
npm login --scope=@aaswe --registry=https://npm.pkg.github.com

# 3. Publish to GitHub
npm publish
```

### Installation from GitHub Packages
```bash
# Users need to configure registry
echo "@aaswe:registry=https://npm.pkg.github.com" >> ~/.npmrc
npm install -g @aaswe/codebase-ai
```

## 📁 Method 3: Direct Tarball Distribution

### Create Distribution Package
```bash
# Package is already created
ls -la aaswe-codebase-ai-1.0.0.tgz
```

### Distribution Options

#### Option A: GitHub Releases
1. Create GitHub release
2. Upload `aaswe-codebase-ai-1.0.0.tgz` as asset
3. Users download and install:
```bash
# Download from GitHub release
curl -L -o codebase-ai.tgz https://github.com/aaswe/codebase-ai/releases/download/v1.0.0/aaswe-codebase-ai-1.0.0.tgz

# Install globally
npm install -g ./codebase-ai.tgz
```

#### Option B: Direct File Sharing
```bash
# Install from local tarball
npm install -g ./aaswe-codebase-ai-1.0.0.tgz
```

## 🐳 Method 4: Docker Hub Distribution

### Build and Push Docker Image
```bash
# Build image
docker build -t aaswe/codebase-ai:1.0.0 .
docker build -t aaswe/codebase-ai:latest .

# Push to Docker Hub
docker push aaswe/codebase-ai:1.0.0
docker push aaswe/codebase-ai:latest
```

### Usage via Docker
```bash
# Run analysis via Docker
docker run --rm -v $(pwd):/workspace aaswe/codebase-ai:latest analyze /workspace
```

## 🌐 Method 5: CDN Distribution (jsDelivr)

### After NPM Publication
Package automatically available via CDN:
```html
<!-- Direct browser usage -->
<script src="https://cdn.jsdelivr.net/npm/@aaswe/codebase-ai@1.0.0/dist/index.js"></script>
```

## 📋 Distribution Comparison

| Method | Pros | Cons | Best For |
|--------|------|------|----------|
| **NPM Registry** | ✅ Standard, Easy install | ❌ Requires NPM account | Production use |
| **GitHub Packages** | ✅ Free, Git integration | ❌ Extra config needed | Open source |
| **Tarball** | ✅ No account needed | ❌ Manual distribution | Testing |
| **Docker Hub** | ✅ Containerized | ❌ Larger download | Enterprise |
| **CDN** | ✅ Browser ready | ❌ Limited CLI use | Web apps |

## 🎯 Recommended Approach

### For Maximum Reach:
1. **Primary**: Publish to NPM Registry
2. **Backup**: GitHub Releases with tarball
3. **Enterprise**: Docker Hub images
4. **Documentation**: Include all installation methods

### User Installation Options:
```bash
# Method 1: NPM (Recommended)
npm install -g @aaswe/codebase-ai

# Method 2: GitHub Release
curl -L https://github.com/aaswe/codebase-ai/releases/latest/download/aaswe-codebase-ai-1.0.0.tgz | npm install -g

# Method 3: Docker
docker run --rm -v $(pwd):/workspace aaswe/codebase-ai analyze /workspace

# Method 4: Direct from repo
git clone https://github.com/aaswe/codebase-ai.git
cd codebase-ai
npm install -g .
```

## 🔧 Package Features Available to Users

### Core Features (No Setup Required)
- ✅ **TTL Generation**: `codebase-ai analyze /path/to/project`
- ✅ **Multi-Language Support**: TypeScript, JavaScript, Python, Java, Go, Rust, C++, C#, PHP, Ruby, Kotlin, Scala, Swift
- ✅ **CLI Commands**: 30+ commands for project analysis
- ✅ **Automatic Analysis**: npm install hooks
- ✅ **Git Integration**: Commit hooks and tracking

### Advanced Features (Docker Compose Required)
- 🐳 **Neo4j Graph Database**: Source code relationships
- 🐳 **MCP Server**: LLM context integration
- 🐳 **Triple Context System**: TTL + Neo4j + MCP unified queries
- 🐳 **Web Dashboard**: Visual project exploration

## 📖 User Documentation

### Quick Start (TTL Only)
```bash
# Install
npm install -g @aaswe/codebase-ai

# Analyze project
codebase-ai analyze ./my-project

# View generated TTL files
ls ./my-project/.aaswe/ttl/
```

### Full System (Docker Compose)
```bash
# Install
npm install -g @aaswe/codebase-ai

# Setup full system
codebase-ai setup docker

# Start services
docker-compose up -d

# Analyze with Neo4j storage
codebase-ai analyze ./my-project --neo4j
```

## 🚀 Next Steps

1. **Choose distribution method** based on your needs
2. **Setup NPM account** for registry publication (recommended)
3. **Create GitHub repository** for backup distribution
4. **Update documentation** with installation instructions
5. **Test installation** on clean system

The package is ready for distribution via any of these methods!