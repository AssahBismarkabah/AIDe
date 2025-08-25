# AASWE Scaling Guide for Large Codebases

## Neo4j Memory Configuration by Project Size

### Small Projects (< 1K files)
**Current Default Configuration:**
```yaml
NEO4J_dbms_memory_heap_max__size=2g
NEO4J_dbms_memory_pagecache_size=1g
```

### Medium Projects (1K - 10K files)
```yaml
NEO4J_dbms_memory_heap_max__size=4g
NEO4J_dbms_memory_pagecache_size=2g
```

### Large Projects (10K - 100K files)
```yaml
NEO4J_dbms_memory_heap_max__size=8g
NEO4J_dbms_memory_pagecache_size=4g
```

### Enterprise Projects (100K+ files)
```yaml
NEO4J_dbms_memory_heap_max__size=16g
NEO4J_dbms_memory_pagecache_size=8g
```

## Memory Requirements by Codebase Type

| Project Type | Files | Estimated Memory | Recommended Config |
|--------------|-------|------------------|-------------------|
| Mobile App | 500-2K | 2-4GB | Default |
| Web App | 2K-10K | 4-8GB | Medium |
| Microservices | 5K-50K | 8-16GB | Large |
| Monolith | 10K-100K | 16-32GB | Enterprise |
| Linux Kernel | 70K+ | 32GB+ | Custom |

## Multi-Tier Resilience Architecture

AASWE provides **graceful degradation** across 3 tiers:

### Tier 1: Neo4j Graph Database (Primary)
- **Purpose**: Complex relationship queries, graph traversal
- **Fallback**: When memory limits hit, system automatically falls back to Tier 2

### Tier 2: TTL Knowledge Files (Secondary)
- **Purpose**: Structured RDF knowledge, semantic queries
- **Reliability**: Always available, no memory limits
- **Performance**: Fast file-based access

### Tier 3: Source Code Indexing (Tertiary)
- **Purpose**: Raw source code access, full-text search
- **Coverage**: Complete codebase regardless of size

## Configuration Examples

### For Large Codebases (modify docker-compose.yml):

```yaml
# Neo4j with 16GB configuration
neo4j:
  image: neo4j:5.15-community
  environment:
    - NEO4J_dbms_memory_heap_initial__size=2g
    - NEO4J_dbms_memory_heap_max__size=16g
    - NEO4J_dbms_memory_pagecache_size=8g
    - NEO4J_dbms_tx_log_rotation_retention__policy=100M size
```

### Environment Variable Override:
```bash
# Set before running docker-compose
export NEO4J_HEAP_SIZE=16g
export NEO4J_PAGECACHE_SIZE=8g

# Or inline
NEO4J_HEAP_SIZE=16g NEO4J_PAGECACHE_SIZE=8g docker-compose up
```

## Batch Processing for Massive Codebases

For codebases with 100K+ files, AASWE supports:

### 1. Incremental Analysis
```bash
# Process in chunks
codebase-ai analyze --chunk-size 1000 --max-chunks 10
```

### 2. Module-based Processing
```bash
# Process specific modules
codebase-ai analyze --modules "core,api,ui" 
```

### 3. Parallel Processing
```bash
# Use multiple workers
codebase-ai analyze --workers 4 --memory-per-worker 4g
```

## Production Deployment Recommendations

### Dedicated Neo4j Instance
For production with very large codebases:

```yaml
# Standalone Neo4j with enterprise features
version: '3.8'
services:
  neo4j-enterprise:
    image: neo4j:5.15-enterprise
    environment:
      - NEO4J_ACCEPT_LICENSE_AGREEMENT=yes
      - NEO4J_dbms_memory_heap_max__size=32g
      - NEO4J_dbms_memory_pagecache_size=16g
      - NEO4J_dbms_cluster_discovery_type=LIST
    deploy:
      resources:
        limits:
          memory: 48g
        reservations:
          memory: 32g
```

### Hardware Recommendations

| Codebase Size | RAM | CPU | Storage |
|---------------|-----|-----|---------|
| < 10K files | 8GB | 4 cores | 100GB SSD |
| 10K-50K files | 16GB | 8 cores | 500GB SSD |
| 50K-100K files | 32GB | 16 cores | 1TB SSD |
| 100K+ files | 64GB+ | 32+ cores | 2TB+ NVMe |

## Monitoring and Alerts

Set up monitoring for:
- Neo4j heap usage
- Page cache hit ratio
- Query performance
- Fallback trigger frequency

```yaml
# Add to docker-compose.yml
  neo4j-exporter:
    image: neo4j/neo4j-prometheus-exporter
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USERNAME=neo4j
      - NEO4J_PASSWORD=aaswe-password
```

## Key Takeaways

1. **Current 2GB limit is conservative** - easily scalable to 16GB+ 
2. **Graceful fallback** ensures system never fails completely
3. **TTL files provide reliable backup** for any size codebase
4. **Memory requirements scale linearly** with codebase complexity
5. **Production deployments** can handle enterprise-scale projects

The beauty of AASWE's architecture is that it **never loses functionality** - even if Neo4j hits limits, you still get comprehensive analysis through TTL knowledge files and source code indexing.