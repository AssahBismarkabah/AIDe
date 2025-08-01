# AI-Assisted Software Engineering System: Updated Architecture with RDF Versioning

## Overview

Updated architecture incorporating local-first database approach, versioned RDF modules, and hybrid storage for optimal developer experience and future cloud scalability.

## Updated 5-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Layer 5: Integration & APIs                  │
│  API Gateway | Authentication | Monitoring | Web UI | MCP   │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│              Layer 4: Artifact Generation                   │
│  Documentation | Test Generation | Ticket Creation | CI/CD  │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│               Layer 3: AI/LLM Integration                   │
│  LangChain RAG | GraphCypher QA | LLM Gateway | RDF Query   │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│          Layer 2: Versioned Knowledge Graph Core            │
│  Local Neo4j | RDF Modules | Version Manager | In-Memory   │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│           Layer 1: Data Ingestion & Analysis                │
│  Code Ingestion | AST Analysis | RDF Generation | CrewAI    │
└─────────────────────────────────────────────────────────────┘
```

## Key Architectural Changes

### 1. Layer 2: Versioned Knowledge Graph Core

**New Components:**

#### **RDF Module System**
- **Purpose**: Create versioned, modular RDF representations of code
- **Format**: Turtle (.ttl) files for readability and tooling support
- **Structure**: One RDF module per code module/package
- **Versioning**: Git-aligned versioning with semantic tags

#### **Hybrid Storage Manager**
- **Local Neo4j**: Primary persistence for complex queries
- **RDF Files**: Versioned modules stored in `.aaswe/rdf/` directory
- **In-Memory Store**: Fast LLM queries using RDFLib
- **Version Manager**: Git-like versioning for graph states

#### **Updated Data Flow**

```
Code Repository
    ↓
AST Analysis Engine
    ↓
RDF Generator (NEW)
    ↓
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  RDF Modules    │───→│  Local Neo4j     │───→│  LLM In-Memory  │
│  (.ttl files)   │    │  (Persistence)   │    │  (Fast Queries) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
    ↓
Version Control System
```

### 2. RDF Schema Design (Best Practices)

**File: `schemas/code-ontology.ttl`**
```turtle
@prefix aaswe: <http://aaswe.org/ontology#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# Core Classes
aaswe:Project a owl:Class ;
    rdfs:label "Software Project" ;
    rdfs:comment "A software project containing modules and components" .

aaswe:Module a owl:Class ;
    rdfs:label "Code Module" ;
    rdfs:comment "A logical grouping of related code files" .

aaswe:Class a owl:Class ;
    rdfs:label "Code Class" ;
    rdfs:comment "A class definition in source code" .

aaswe:Method a owl:Class ;
    rdfs:label "Code Method" ;
    rdfs:comment "A method or function definition" .

# Properties
aaswe:hasModule a owl:ObjectProperty ;
    rdfs:domain aaswe:Project ;
    rdfs:range aaswe:Module .

aaswe:contains a owl:ObjectProperty ;
    rdfs:domain aaswe:Module ;
    rdfs:range aaswe:Class .

aaswe:calls a owl:ObjectProperty ;
    rdfs:domain aaswe:Method ;
    rdfs:range aaswe:Method .

aaswe:complexity a owl:DatatypeProperty ;
    rdfs:domain aaswe:Method ;
    rdfs:range xsd:integer .
```

### 3. Local-First Deployment Architecture

```yaml
# docker-compose.local.yml
version: '3.8'
services:
  # Local Neo4j for developers
  neo4j-local:
    image: neo4j:5.15-community  # Community edition for local dev
    environment:
      NEO4J_AUTH: neo4j/dev123
      NEO4J_PLUGINS: '["apoc"]'
    ports:
      - "7474:7474"
      - "7687:7687"
    volumes:
      - ./data/neo4j:/data
      - ./data/logs:/logs
    
  # Local Redis for caching
  redis-local:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - ./data/redis:/data
    
  # RDF Processing Service
  rdf-processor:
    build: ./services/rdf-processor
    environment:
      - RDF_STORE_PATH=./data/rdf
      - NEO4J_URI=bolt://neo4j-local:7687
    volumes:
      - ./data/rdf:/app/data/rdf
      - ./.aaswe:/app/.aaswe
```

## Updated Implementation Components

### 1. RDF Generator Service

**File: `app/services/rdf_generator.py`**
```python
from rdflib import Graph, Namespace, URIRef, Literal, RDF, RDFS
from rdflib.namespace import XSD
from typing import List, Dict
import os
from datetime import datetime

class RDFGenerator:
    def __init__(self):
        self.aaswe = Namespace("http://aaswe.org/ontology#")
        self.graph = Graph()
        self.graph.bind("aaswe", self.aaswe)
        
    def generate_module_rdf(self, module_data: Dict, version: str) -> str:
        """Generate RDF for a code module"""
        g = Graph()
        g.bind("aaswe", self.aaswe)
        
        # Create module URI
        module_uri = URIRef(f"http://aaswe.org/modules/{module_data['name']}")
        
        # Add module metadata
        g.add((module_uri, RDF.type, self.aaswe.Module))
        g.add((module_uri, RDFS.label, Literal(module_data['name'])))
        g.add((module_uri, self.aaswe.version, Literal(version)))
        g.add((module_uri, self.aaswe.timestamp, Literal(datetime.now(), datatype=XSD.dateTime)))
        
        # Add classes and methods
        for class_data in module_data.get('classes', []):
            class_uri = URIRef(f"http://aaswe.org/classes/{class_data['name']}")
            g.add((class_uri, RDF.type, self.aaswe.Class))
            g.add((class_uri, RDFS.label, Literal(class_data['name'])))
            g.add((module_uri, self.aaswe.contains, class_uri))
            
            for method_data in class_data.get('methods', []):
                method_uri = URIRef(f"http://aaswe.org/methods/{method_data['name']}")
                g.add((method_uri, RDF.type, self.aaswe.Method))
                g.add((method_uri, RDFS.label, Literal(method_data['name'])))
                g.add((method_uri, self.aaswe.complexity, Literal(method_data.get('complexity', 0))))
                g.add((class_uri, self.aaswe.hasMethod, method_uri))
        
        return g.serialize(format='turtle')
    
    def save_module_rdf(self, module_name: str, rdf_content: str, version: str):
        """Save RDF module to versioned file"""
        rdf_dir = f".aaswe/rdf/{version}"
        os.makedirs(rdf_dir, exist_ok=True)
        
        file_path = f"{rdf_dir}/{module_name}.ttl"
        with open(file_path, 'w') as f:
            f.write(rdf_content)
        
        return file_path
```

### 2. Version Manager

**File: `app/services/version_manager.py`**
```python
import git
import os
import json
from typing import Dict, List, Optional
from datetime import datetime

class GraphVersionManager:
    def __init__(self, repo_path: str = "."):
        self.repo_path = repo_path
        self.aaswe_dir = os.path.join(repo_path, ".aaswe")
        self.rdf_dir = os.path.join(self.aaswe_dir, "rdf")
        self.versions_file = os.path.join(self.aaswe_dir, "versions.json")
        
        # Initialize .aaswe directory
        os.makedirs(self.rdf_dir, exist_ok=True)
        
    def get_current_version(self) -> str:
        """Get current Git commit hash as version"""
        try:
            repo = git.Repo(self.repo_path)
            return repo.head.commit.hexsha[:8]
        except:
            return "local-dev"
    
    def create_version_snapshot(self, modules: List[str]) -> str:
        """Create a versioned snapshot of RDF modules"""
        version = self.get_current_version()
        version_dir = os.path.join(self.rdf_dir, version)
        os.makedirs(version_dir, exist_ok=True)
        
        # Update versions metadata
        versions_data = self.load_versions()
        versions_data[version] = {
            "timestamp": datetime.now().isoformat(),
            "modules": modules,
            "git_commit": version
        }
        self.save_versions(versions_data)
        
        return version
    
    def load_versions(self) -> Dict:
        """Load versions metadata"""
        if os.path.exists(self.versions_file):
            with open(self.versions_file, 'r') as f:
                return json.load(f)
        return {}
    
    def save_versions(self, versions_data: Dict):
        """Save versions metadata"""
        with open(self.versions_file, 'w') as f:
            json.dump(versions_data, f, indent=2)
    
    def get_version_modules(self, version: str) -> List[str]:
        """Get list of RDF modules for a specific version"""
        version_dir = os.path.join(self.rdf_dir, version)
        if os.path.exists(version_dir):
            return [f for f in os.listdir(version_dir) if f.endswith('.ttl')]
        return []
```

### 3. Hybrid Storage Manager

**File: `app/services/hybrid_storage.py`**
```python
from rdflib import Graph
from neo4j import GraphDatabase
from typing import Dict, List, Optional
import os

class HybridStorageManager:
    def __init__(self, neo4j_uri: str, neo4j_auth: tuple, rdf_base_path: str = ".aaswe/rdf"):
        self.neo4j_driver = GraphDatabase.driver(neo4j_uri, auth=neo4j_auth)
        self.rdf_base_path = rdf_base_path
        self.in_memory_graph = Graph()
        
    def load_rdf_version(self, version: str) -> Graph:
        """Load RDF modules for a specific version into memory"""
        version_path = os.path.join(self.rdf_base_path, version)
        graph = Graph()
        
        if os.path.exists(version_path):
            for rdf_file in os.listdir(version_path):
                if rdf_file.endswith('.ttl'):
                    file_path = os.path.join(version_path, rdf_file)
                    graph.parse(file_path, format='turtle')
        
        return graph
    
    def sync_rdf_to_neo4j(self, version: str):
        """Sync RDF modules to Neo4j for complex queries"""
        graph = self.load_rdf_version(version)
        
        with self.neo4j_driver.session() as session:
            # Clear existing data for this version
            session.run("MATCH (n {version: $version}) DETACH DELETE n", version=version)
            
            # Convert RDF triples to Cypher
            for subject, predicate, obj in graph:
                # Simplified conversion - would need more sophisticated mapping
                cypher = """
                MERGE (s:Entity {uri: $subject, version: $version})
                MERGE (o:Entity {uri: $object, version: $version})
                MERGE (s)-[r:RELATION {type: $predicate, version: $version}]->(o)
                """
                session.run(cypher, 
                           subject=str(subject), 
                           predicate=str(predicate), 
                           object=str(obj),
                           version=version)
    
    def query_in_memory(self, sparql_query: str, version: str) -> List[Dict]:
        """Execute SPARQL query on in-memory RDF graph"""
        graph = self.load_rdf_version(version)
        results = graph.query(sparql_query)
        return [dict(row.asdict()) for row in results]
    
    def query_neo4j(self, cypher_query: str, parameters: Dict = None) -> List[Dict]:
        """Execute Cypher query on Neo4j"""
        with self.neo4j_driver.session() as session:
            result = session.run(cypher_query, parameters or {})
            return [record.data() for record in result]
```

## Updated Project Structure

```
ai-software-engineering-system/
├── .aaswe/                    # NEW: AASWE metadata directory
│   ├── rdf/                   # Versioned RDF modules
│   │   ├── abc123ef/          # Version directory (git commit hash)
│   │   │   ├── user-service.ttl
│   │   │   ├── auth-module.ttl
│   │   │   └── data-layer.ttl
│   │   └── def456gh/          # Another version
│   ├── versions.json          # Version metadata
│   └── config.json           # AASWE configuration
├── schemas/
│   └── code-ontology.ttl     # RDF ontology definition
├── app/
│   ├── services/
│   │   ├── rdf_generator.py   # NEW: RDF generation
│   │   ├── version_manager.py # NEW: Version management
│   │   ├── hybrid_storage.py  # NEW: Hybrid storage
│   │   └── ... (existing services)
├── docker-compose.local.yml   # Local development
├── docker-compose.cloud.yml   # Future cloud deployment
└── ... (existing structure)
```

## Benefits of Updated Architecture

### 1. **Developer Experience**
- ✅ Local database for fast development
- ✅ No cloud dependencies for basic functionality
- ✅ Git-aligned versioning familiar to developers

### 2. **Flexibility**
- ✅ RDF modules can be queried by LLMs directly
- ✅ Neo4j for complex graph traversals
- ✅ Easy migration to cloud when needed

### 3. **Version Control**
- ✅ Graph states aligned with code versions
- ✅ Rollback capabilities
- ✅ Diff capabilities between versions

### 4. **Performance**
- ✅ In-memory RDF for fast LLM queries
- ✅ Local Neo4j for complex analysis
- ✅ Hybrid approach optimizes for different use cases

## Migration Path to Cloud

When ready for cloud deployment:

1. **Replace local Neo4j** with managed Neo4j (AuraDB)
2. **Add RDF storage** to cloud object storage (S3/GCS)
3. **Scale processing** with Kubernetes
4. **Keep local development** unchanged

This architecture gives you the best of both worlds - local development efficiency with cloud scalability when needed.