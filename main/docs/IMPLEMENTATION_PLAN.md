# AI-Assisted Software Engineering System: Complete Implementation Plan

## Overview

Based on your updated architecture with RDF versioning and local-first approach, this implementation plan provides concrete, executable steps to build the AI-assisted software engineering system with multiple installation methods, flexible Git integration, and comprehensive IDE support.

## Tool Usage & Installation Strategy

### **Primary Usage Pattern: Existing Repository Integration**

- Install AASWE in existing projects via `.aaswe/` directory
- Non-intrusive integration preserving existing project structure
- Support for all installation methods and IDE integrations

### **Installation Methods (All Supported):**

1. **CLI Installer**: `curl -sSL https://install.aaswe.org | bash`
2. **Package Manager**: `npm install -g @aaswe/cli` / `pip install aaswe`
3. **Docker-based**: `docker run -v $(pwd):/workspace aaswe/cli init`
4. **Manual Setup**: Git clone with setup scripts

### **Git Integration (Both Options):**

- **Automatic**: Git hooks for seamless analysis on commits
- **Manual**: Developer-triggered analysis commands

### **IDE Support (All Platforms):**

- VS Code extension via MCP protocol
- IntelliJ IDEA plugin with real-time analysis
- Vim/Neovim integration through Language Server Protocol
- Universal MCP server for any IDE

## Phase 0: Installation & Setup Infrastructure (Week 0)

### Task 0.1: CLI Tool Development

**Status**: Ready to Execute
**Priority**: Critical
**Estimated Time**: 3-4 days

**Steps**:

1. Create CLI tool with multiple installation methods
2. Implement project detection and auto-configuration
3. Add Git hooks management (automatic/manual options)
4. Build IDE integration setup

**Deliverables**:

- CLI tool supporting all installation methods
- Auto-detection for project types (Python, Java, JavaScript, etc.)
- Git hooks installer with both automatic and manual options
- IDE plugin installers for VS Code, IntelliJ, Vim/Neovim

### Task 0.2: RDF Infrastructure Setup

**Status**: Ready to Execute
**Priority**: Critical
**Estimated Time**: 2-3 days

**Steps**:

1. Create RDF ontology schema for code representation
2. Implement RDF generator for AST-to-RDF conversion
3. Build version manager with Git integration
4. Set up hybrid storage manager

**Deliverables**:

- Complete RDF ontology in Turtle format
- RDF generator service
- Git-aligned version management system
- Hybrid storage coordination (Neo4j + RDF files + in-memory)

### Task 0.3: Developer-Editable Module Knowledge System

**Status**: Ready to Execute
**Priority**: Critical
**Estimated Time**: 3-4 days

**Steps**:

1. Implement complete codebase analysis for initial RDF generation
2. Create module-knowledge.ttl files in each module directory
3. Build smart RDF merging system to preserve developer annotations
4. Add file watcher for automatic graph synchronization
5. Create CLI tools for RDF validation and management

**Deliverables**:

- Complete initial codebase analysis engine
- Auto-generated module-knowledge.ttl files with full code mapping
- Smart RDF merger preserving developer annotations
- File watcher system for auto-sync to Neo4j
- Developer CLI tools for RDF management
- RDF validation and syntax checking

## Phase 1: Foundation Setup (Weeks 1-4)

### Week 1: Infrastructure Foundation

#### Task 1.1: Set up Development Environment

**Status**: Ready to Execute
**Priority**: Critical
**Estimated Time**: 2-3 days

**Steps**:

1. Create project structure
2. Set up Docker Compose for local development
3. Initialize Neo4j database
4. Configure basic monitoring

**Deliverables**:

- Working Docker environment
- Neo4j instance with basic schema
- Project skeleton with proper structure

#### Task 1.2: Neo4j Graph Database Foundation

**Status**: Ready to Execute  
**Priority**: Critical
**Estimated Time**: 3-4 days

**Steps**:

1. Implement core graph schema from `design.md`
2. Create constraints and indexes
3. Build GraphSchemaManager class
4. Write unit tests for schema operations

**Deliverables**:

- Complete Neo4j schema implementation
- Schema migration system
- Unit tests with 80%+ coverage

### Week 2: Code Ingestion Service

#### Task 1.3: Basic Code Ingestion Service

**Status**: Ready to Execute
**Priority**: High
**Estimated Time**: 4-5 days

**Steps**:

1. Build FastAPI service for code ingestion
2. Implement Git webhook support
3. Add file system monitoring
4. Create async job queue with Kafka

**Deliverables**:

- REST API for repository ingestion
- Webhook endpoints for Git integration
- Async processing pipeline

### Week 3: AST Analysis Engine

#### Task 1.4: AST Analysis Engine Foundation

**Status**: Ready to Execute
**Priority**: High  
**Estimated Time**: 5-6 days

**Steps**:

1. Integrate CodeGraph Analyzer
2. Implement multi-language AST parsing
3. Build entity extraction for classes, methods, variables
4. Add relationship detection

**Deliverables**:

- Multi-language AST parser
- Entity and relationship extraction
- Direct Neo4j integration

### Week 4: Basic LLM Integration

#### Task 2.1: LLM Integration and Semantic Analysis

**Status**: Ready to Execute
**Priority**: High
**Estimated Time**: 4-5 days

**Steps**:

1. Set up LangChain with OpenAI/Anthropic
2. Create LLMAnalysisService
3. Implement caching with Redis
4. Add fallback mechanisms

**Deliverables**:

- LLM service with multiple providers
- Caching layer for responses
- Error handling and fallbacks

## Phase 2: AI Integration (Weeks 5-8)

### Week 5: GraphRAG Query System

#### Task 2.2: Build GraphRAG Query System

**Status**: Ready to Execute
**Priority**: High
**Estimated Time**: 5-6 days

**Steps**:

1. Implement GraphCypherQAChain
2. Create custom prompts for software engineering
3. Add query validation and error handling
4. Build result formatting

**Deliverables**:

- Natural language to Cypher translation
- Query validation system
- Formatted response generation

### Week 6: Knowledge Graph Enrichment

#### Task 2.3: Create Knowledge Graph Enrichment Pipeline

**Status**: Ready to Execute
**Priority**: High
**Estimated Time**: 5-6 days

**Steps**:

1. Implement semantic enrichment using LLMs
2. Add pattern detection for design patterns
3. Create batch processing pipeline
4. Implement incremental updates

**Deliverables**:

- Semantic enrichment pipeline
- Pattern detection system
- Batch processing capabilities

### Week 7-8: CrewAI Orchestration

#### Task 2.4: Implement CrewAI Orchestration Engine

**Status**: Ready to Execute
**Priority**: High
**Estimated Time**: 8-10 days

**Steps**:

1. Set up CrewAI framework
2. Create specialist agents (Analyzer, Architect, Reviewer, Tester)
3. Implement agent collaboration
4. Add workflow state management

**Deliverables**:

- Multi-agent system with 5 specialized agents
- Agent coordination and delegation
- Workflow tracking and management

## Phase 3: Artifact Generation (Weeks 9-12)

### Week 9: Documentation Generation

#### Task 3.1: Build Documentation Generation System

**Status**: Ready to Execute
**Priority**: High
**Estimated Time**: 5-6 days

**Steps**:

1. Create DocumentationGenerator service
2. Implement arc42 template support
3. Add AsciiDoc generation
4. Integrate docToolchain

**Deliverables**:

- Automated arc42 documentation
- Multi-format publishing (HTML, PDF, Confluence)
- Template-based generation

### Week 10: Diagram Generation

#### Task 3.2: Implement Diagram Generation

**Status**: Ready to Execute
**Priority**: Medium
**Estimated Time**: 4-5 days

**Steps**:

1. Create Mermaid diagram generation
2. Add PlantUML support
3. Implement automatic layout optimization
4. Add diagram embedding

**Deliverables**:

- Automated diagram generation
- Multiple diagram formats
- Integration with documentation

### Week 11: Test Generation

#### Task 4.1: Implement Test Generation System

**Status**: Ready to Execute
**Priority**: High
**Estimated Time**: 5-6 days

**Steps**:

1. Create TestGenerator service
2. Implement unit test generation
3. Add mock generation using graph analysis
4. Support multiple testing frameworks

**Deliverables**:

- Automated unit test generation
- Mock generation system
- Multi-framework support (JUnit, PyTest, Jest)

### Week 12: Ticket Generation

#### Task 5.1: Build Automated Ticket Generation System

**Status**: Ready to Execute
**Priority**: High
**Estimated Time**: 5-6 days

**Steps**:

1. Create TicketGenerator service with Jira API
2. Implement issue detection
3. Add automatic ticket creation with context
4. Implement code owner detection

**Deliverables**:

- Automated Jira ticket creation
- Issue classification and prioritization
- Contextual ticket descriptions with code snippets

## Implementation Commands and Scripts

### Quick Start Commands

````bash
# 1. Clone and setup project
git clone <repository-url>
cd ai-software-engineering-system
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# 2. Start infrastructure
docker-compose up -d neo4j redis kafka
```#
 3. Initialize Neo4j schema
python scripts/init_schema.py

# 4. Run tests
python -m pytest tests/ -v

# 5. Start services
python -m uvicorn app.main:app --reload
````

### Project Structure

```
ai-software-engineering-system/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application
│   ├── core/
│   │   ├── config.py          # Configuration management
│   │   ├── database.py        # Neo4j connection
│   │   └── security.py        # Authentication
│   ├── services/
│   │   ├── ingestion.py       # Code ingestion service
│   │   ├── ast_analysis.py    # AST analysis engine
│   │   ├── llm_service.py     # LLM integration
│   │   ├── orchestration.py   # CrewAI orchestration
│   │   ├── documentation.py   # Doc generation
│   │   ├── test_generation.py # Test generation
│   │   └── ticket_generation.py # Ticket generation
│   ├── models/
│   │   ├── entities.py        # Pydantic models
│   │   └── schemas.py         # Graph schemas
│   └── api/
│       ├── v1/
│       │   ├── ingestion.py   # Ingestion endpoints
│       │   ├── analysis.py    # Analysis endpoints
│       │   └── artifacts.py   # Artifact endpoints
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/
│   ├── init_schema.py         # Schema initialization
│   └── setup_dev.py           # Development setup
├── docker-compose.yml         # Local development
├── requirements.txt           # Python dependencies
└── README.md
```

## Detailed Implementation Steps

### Step 1: Initialize Project Structure

```bash
# Create project directories
mkdir -p app/{core,services,models,api/v1}
mkdir -p tests/{unit,integration,e2e}
mkdir -p scripts
mkdir -p config

# Create __init__.py files
touch app/__init__.py
touch app/core/__init__.py
touch app/services/__init__.py
touch app/models/__init__.py
touch app/api/__init__.py
touch app/api/v1/__init__.py
```

### Step 2: Create Core Configuration

**File: `app/core/config.py`**

```python
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "password"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # LLM APIs
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None

    # Jira
    jira_url: Optional[str] = None
    jira_username: Optional[str] = None
    jira_api_token: Optional[str] = None

    class Config:
        env_file = ".env"

settings = Settings()
```

### Step 3: Neo4j Database Connection

**File: `app/core/database.py`**

```python
from neo4j import GraphDatabase
from app.core.config import settings

class Neo4jConnection:
    def __init__(self):
        self.driver = GraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password)
        )

    def close(self):
        self.driver.close()

    def execute_query(self, query: str, parameters: dict = None):
        with self.driver.session() as session:
            return session.run(query, parameters)

# Global connection instance
neo4j_db = Neo4jConnection()
```

### Step 4: Graph Schema Implementation

**File: `scripts/init_schema.py`**

```python
from app.core.database import neo4j_db

def create_constraints():
    """Create Neo4j constraints as defined in design.md"""
    constraints = [
        "CREATE CONSTRAINT FOR (f:File) REQUIRE f.path IS UNIQUE",
        "CREATE CONSTRAINT FOR (c:Class) REQUIRE (c.name, c.file_path) IS UNIQUE",
        "CREATE CONSTRAINT FOR (m:Method) REQUIRE (m.name, m.class_name, m.file_path) IS UNIQUE",
        "CREATE CONSTRAINT FOR (p:Project) REQUIRE p.name IS UNIQUE"
    ]

    for constraint in constraints:
        try:
            neo4j_db.execute_query(constraint)
            print(f"Created constraint: {constraint}")
        except Exception as e:
            print(f"Constraint already exists or error: {e}")

def create_indexes():
    """Create performance indexes"""
    indexes = [
        "CREATE INDEX file_path_index FOR (f:File) ON (f.path)",
        "CREATE INDEX class_name_index FOR (c:Class) ON (c.name)",
        "CREATE INDEX method_signature_index FOR (m:Method) ON (m.signature)"
    ]

    for index in indexes:
        try:
            neo4j_db.execute_query(index)
            print(f"Created index: {index}")
        except Exception as e:
            print(f"Index already exists or error: {e}")

if __name__ == "__main__":
    create_constraints()
    create_indexes()
    print("Schema initialization complete!")
```

### Step 5: Docker Compose Setup

**File: `docker-compose.yml`**

```yaml
version: "3.8"
services:
  neo4j:
    image: neo4j:5.15-enterprise
    environment:
      NEO4J_AUTH: neo4j/password
      NEO4J_PLUGINS: '["apoc", "graph-data-science"]'
      NEO4J_ACCEPT_LICENSE_AGREEMENT: "yes"
    ports:
      - "7474:7474"
      - "7687:7687"
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  kafka:
    image: confluentinc/cp-kafka:latest
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    ports:
      - "9092:9092"
    depends_on:
      - zookeeper

  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"

volumes:
  neo4j_data:
  neo4j_logs:
  redis_data:
```

### Step 6: CLI Tool Implementation

**File: `cli/aaswe_cli.py`**

```python
#!/usr/bin/env python3
import click
import os
import subprocess
import json
from pathlib import Path

@click.group()
def cli():
    """AASWE - AI-Assisted Software Engineering CLI"""
    pass

@cli.command()
@click.option('--auto-hooks/--no-auto-hooks', default=True, help='Install Git hooks automatically')
@click.option('--ide', multiple=True, help='IDE integrations to install (vscode, intellij, vim)')
def init(auto_hooks, ide):
    """Initialize AASWE in current project"""
    project_root = Path.cwd()
    aaswe_dir = project_root / '.aaswe'

    # Create .aaswe directory structure
    (aaswe_dir / 'rdf').mkdir(parents=True, exist_ok=True)
    (aaswe_dir / 'system').mkdir(exist_ok=True)
    (aaswe_dir / 'config').mkdir(exist_ok=True)

    # Detect project type
    project_type = detect_project_type(project_root)
    click.echo(f"Detected project type: {project_type}")

    # Generate configuration
    config = generate_config(project_type, project_root)
    with open(aaswe_dir / 'config.json', 'w') as f:
        json.dump(config, f, indent=2)

    # Install Git hooks if requested
    if auto_hooks:
        install_git_hooks(project_root)
        click.echo("✅ Git hooks installed for automatic analysis")

    # Install IDE integrations
    for ide_name in ide:
        install_ide_integration(ide_name)
        click.echo(f"✅ {ide_name} integration installed")

    # Initialize Docker environment
    setup_docker_environment(aaswe_dir)

    click.echo("🎉 AASWE initialized successfully!")
    click.echo("Run 'aaswe start' to begin analysis")

@cli.command()
def start():
    """Start AASWE services locally"""
    aaswe_dir = Path.cwd() / '.aaswe'

    # Start Docker services
    subprocess.run(['docker-compose', '-f', str(aaswe_dir / 'docker-compose.yml'), 'up', '-d'])

    # Initialize schema
    subprocess.run(['python', str(aaswe_dir / 'scripts/init_schema.py')])

    click.echo("🚀 AASWE services started!")
    click.echo("Neo4j: http://localhost:7474")
    click.echo("API: http://localhost:8000")

@cli.command()
@click.option('--incremental/--full', default=True, help='Incremental or full analysis')
def analyze(incremental):
    """Analyze current codebase"""
    from app.services.analysis_orchestrator import AnalysisOrchestrator

    orchestrator = AnalysisOrchestrator()
    if incremental:
        result = orchestrator.analyze_incremental()
    else:
        result = orchestrator.analyze_full()

    click.echo(f"Analysis complete: {result['summary']}")

def detect_project_type(project_root: Path) -> str:
    """Auto-detect project type based on files present"""
    if (project_root / 'package.json').exists():
        return 'javascript'
    elif (project_root / 'pom.xml').exists() or (project_root / 'build.gradle').exists():
        return 'java'
    elif (project_root / 'requirements.txt').exists() or (project_root / 'pyproject.toml').exists():
        return 'python'
    elif (project_root / 'Cargo.toml').exists():
        return 'rust'
    elif (project_root / 'go.mod').exists():
        return 'go'
    else:
        return 'generic'

def generate_config(project_type: str, project_root: Path) -> dict:
    """Generate project-specific configuration"""
    config = {
        "project_type": project_type,
        "project_root": str(project_root),
        "analysis": {
            "languages": get_languages_for_project_type(project_type),
            "exclude_patterns": [".git", "node_modules", "__pycache__", ".aaswe"],
            "include_patterns": ["**/*.py", "**/*.js", "**/*.java", "**/*.ts"]
        },
        "integrations": {
            "neo4j": {"uri": "bolt://localhost:7687"},
            "redis": {"url": "redis://localhost:6379"},
            "jira": {"enabled": False},
            "confluence": {"enabled": False}
        },
        "rdf": {
            "format": "turtle",
            "versioning": "git-aligned",
            "storage_path": ".aaswe/rdf"
        }
    }
    return config

if __name__ == '__main__':
    cli()
```

### Step 7: RDF Infrastructure Components

**File: `app/services/rdf_generator.py`**

```python
from rdflib import Graph, Namespace, URIRef, Literal, RDF, RDFS
from rdflib.namespace import XSD
from typing import List, Dict, Any
import os
from datetime import datetime
import hashlib

class RDFGenerator:
    def __init__(self):
        self.aaswe = Namespace("http://aaswe.org/ontology#")
        self.code = Namespace("http://aaswe.org/code#")

    def generate_module_rdf(self, module_data: Dict[str, Any], version: str) -> str:
        """Generate RDF for a code module"""
        g = Graph()
        g.bind("aaswe", self.aaswe)
        g.bind("code", self.code)

        # Create module URI
        module_uri = self.code[f"module/{module_data['name']}"]

        # Add module metadata
        g.add((module_uri, RDF.type, self.aaswe.Module))
        g.add((module_uri, RDFS.label, Literal(module_data['name'])))
        g.add((module_uri, self.aaswe.version, Literal(version)))
        g.add((module_uri, self.aaswe.timestamp, Literal(datetime.now(), datatype=XSD.dateTime)))
        g.add((module_uri, self.aaswe.path, Literal(module_data.get('path', ''))))

        # Add files
        for file_data in module_data.get('files', []):
            file_uri = self.code[f"file/{self._hash_path(file_data['path'])}"]
            g.add((file_uri, RDF.type, self.aaswe.File))
            g.add((file_uri, RDFS.label, Literal(file_data['name'])))
            g.add((file_uri, self.aaswe.path, Literal(file_data['path'])))
            g.add((file_uri, self.aaswe.language, Literal(file_data.get('language', 'unknown'))))
            g.add((module_uri, self.aaswe.contains, file_uri))

            # Add classes
            for class_data in file_data.get('classes', []):
                class_uri = self.code[f"class/{self._hash_name(class_data['name'], file_data['path'])}"]
                g.add((class_uri, RDF.type, self.aaswe.Class))
                g.add((class_uri, RDFS.label, Literal(class_data['name'])))
                g.add((class_uri, self.aaswe.complexity, Literal(class_data.get('complexity', 0))))
                g.add((file_uri, self.aaswe.defines, class_uri))

                # Add methods
                for method_data in class_data.get('methods', []):
                    method_uri = self.code[f"method/{self._hash_name(method_data['name'], class_data['name'])}"]
                    g.add((method_uri, RDF.type, self.aaswe.Method))
                    g.add((method_uri, RDFS.label, Literal(method_data['name'])))
                    g.add((method_uri, self.aaswe.complexity, Literal(method_data.get('complexity', 0))))
                    g.add((method_uri, self.aaswe.lineCount, Literal(method_data.get('line_count', 0))))
                    g.add((class_uri, self.aaswe.hasMethod, method_uri))

                    # Add method calls
                    for call in method_data.get('calls', []):
                        called_method_uri = self.code[f"method/{self._hash_name(call, 'unknown')}"]
                        g.add((method_uri, self.aaswe.calls, called_method_uri))

        return g.serialize(format='turtle')

    def _hash_path(self, path: str) -> str:
        """Create hash for file path"""
        return hashlib.md5(path.encode()).hexdigest()[:8]

    def _hash_name(self, name: str, context: str) -> str:
        """Create hash for name with context"""
        return hashlib.md5(f"{context}::{name}".encode()).hexdigest()[:8]

    def save_module_rdf(self, module_name: str, rdf_content: str, version: str) -> str:
        """Save RDF module to versioned file"""
        rdf_dir = Path(f".aaswe/rdf/{version}")
        rdf_dir.mkdir(parents=True, exist_ok=True)

        file_path = rdf_dir / f"{module_name}.ttl"
        with open(file_path, 'w') as f:
            f.write(rdf_content)

        return str(file_path)
```

### Step 8: IDE Integration Components

**File: `ide/vscode/extension.js`**

```javascript
const vscode = require("vscode");
const { LanguageClient, TransportKind } = require("vscode-languageclient/node");

let client;

function activate(context) {
  // MCP Server configuration
  const serverOptions = {
    run: {
      command: "aaswe",
      args: ["mcp-server"],
      transport: TransportKind.stdio,
    },
    debug: {
      command: "aaswe",
      args: ["mcp-server", "--debug"],
      transport: TransportKind.stdio,
    },
  };

  const clientOptions = {
    documentSelector: [
      { scheme: "file", language: "python" },
      { scheme: "file", language: "javascript" },
      { scheme: "file", language: "java" },
      { scheme: "file", language: "typescript" },
    ],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher(
        "**/*.{py,js,java,ts}"
      ),
    },
  };

  client = new LanguageClient(
    "aaswe",
    "AASWE Language Server",
    serverOptions,
    clientOptions
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("aaswe.analyze", analyzeCurrentFile),
    vscode.commands.registerCommand("aaswe.generateTests", generateTests),
    vscode.commands.registerCommand("aaswe.generateDocs", generateDocs),
    vscode.commands.registerCommand("aaswe.explainCode", explainCode)
  );

  // Start the client
  client.start();
}

async function analyzeCurrentFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const document = editor.document;
  const result = await client.sendRequest("aaswe/analyze", {
    uri: document.uri.toString(),
    content: document.getText(),
  });

  // Show analysis results
  vscode.window.showInformationMessage(`Analysis complete: ${result.summary}`);
}

async function generateTests() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  const result = await client.sendRequest("aaswe/generateTests", {
    code: selectedText,
    language: editor.document.languageId,
  });

  // Create new document with generated tests
  const testDoc = await vscode.workspace.openTextDocument({
    content: result.tests,
    language: editor.document.languageId,
  });
  vscode.window.showTextDocument(testDoc);
}

function deactivate() {
  if (!client) return undefined;
  return client.stop();
}

module.exports = { activate, deactivate };
```

### Step 9: Updated Requirements File

**File: `requirements.txt`**

```
# Core Framework
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
pydantic-settings==2.1.0

# Database & Storage
neo4j==5.15.0
redis==5.0.1
rdflib==7.0.0

# AI & LLM Integration
langchain==0.0.350
langchain-openai==0.0.2
langchain-anthropic==0.0.1
crewai==0.1.0

# Code Analysis
tree-sitter==0.20.4
tree-sitter-python==0.20.4
tree-sitter-javascript==0.20.1
tree-sitter-java==0.20.2

# Message Queue & Processing
kafka-python==2.0.2
celery==5.3.4

# CLI & Utilities
click==8.1.7
rich==13.7.0
python-multipart==0.0.6
requests==2.31.0
python-dotenv==1.0.0
gitpython==3.1.40

# Testing
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-mock==3.12.0

# Documentation
sphinx==7.2.6
myst-parser==2.0.0

# IDE Integration
pygls==1.2.1
lsprotocol==2023.0.1
```

### Step 10: Complete Codebase Analysis Engine

**File: `app/services/complete_analysis.py`**

```python
import os
import ast
from pathlib import Path
from typing import Dict, List, Any
from tree_sitter import Language, Parser
import tree_sitter_python as tspython
import tree_sitter_java as tsjava
import tree_sitter_javascript as tsjavascript

class CompleteCodebaseAnalyzer:
    def __init__(self):
        self.parsers = {
            'python': self._setup_python_parser(),
            'java': self._setup_java_parser(),
            'javascript': self._setup_javascript_parser()
        }

    def analyze_entire_codebase(self, project_root: str) -> Dict[str, Any]:
        """Perform complete analysis of entire codebase"""
        print("🔍 Starting complete codebase analysis...")

        # 1. Discover all modules
        modules = self.discover_modules(project_root)
        print(f"📁 Found {len(modules)} modules")

        # 2. Analyze each module completely
        analysis_results = {}
        for module in modules:
            print(f"🔬 Analyzing module: {module['name']}")
            module_analysis = self.analyze_module_completely(module)
            analysis_results[module['name']] = module_analysis

        # 3. Detect cross-module relationships
        cross_module_relationships = self.detect_cross_module_relationships(analysis_results)

        return {
            'modules': analysis_results,
            'relationships': cross_module_relationships,
            'summary': {
                'total_modules': len(modules),
                'total_files': sum(len(m['files']) for m in analysis_results.values()),
                'total_classes': sum(len(m['classes']) for m in analysis_results.values()),
                'total_methods': sum(len(m['methods']) for m in analysis_results.values())
            }
        }

    def discover_modules(self, project_root: str) -> List[Dict[str, Any]]:
        """Discover all logical modules in the codebase"""
        modules = []
        project_path = Path(project_root)

        # Look for common module patterns
        for item in project_path.rglob('*'):
            if item.is_dir() and not self._should_exclude_directory(item):
                # Check if directory contains code files
                code_files = list(item.glob('**/*.py')) + list(item.glob('**/*.java')) + list(item.glob('**/*.js'))
                if code_files:
                    modules.append({
                        'name': item.name,
                        'path': str(item),
                        'files': [str(f) for f in code_files],
                        'type': self._detect_module_type(item)
                    })

        return modules

    def analyze_module_completely(self, module: Dict[str, Any]) -> Dict[str, Any]:
        """Complete analysis of a single module"""
        module_data = {
            'name': module['name'],
            'path': module['path'],
            'type': module['type'],
            'files': [],
            'classes': [],
            'methods': [],
            'dependencies': [],
            'exports': []
        }

        # Analyze each file in the module
        for file_path in module['files']:
            file_analysis = self.analyze_file_completely(file_path)
            module_data['files'].append(file_analysis)

            # Aggregate classes and methods
            module_data['classes'].extend(file_analysis['classes'])
            module_data['methods'].extend(file_analysis['methods'])
            module_data['dependencies'].extend(file_analysis['dependencies'])

        return module_data

    def analyze_file_completely(self, file_path: str) -> Dict[str, Any]:
        """Complete analysis of a single file"""
        file_ext = Path(file_path).suffix
        language = self._get_language_from_extension(file_ext)

        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        if language == 'python':
            return self._analyze_python_file(file_path, content)
        elif language == 'java':
            return self._analyze_java_file(file_path, content)
        elif language == 'javascript':
            return self._analyze_javascript_file(file_path, content)
        else:
            return self._analyze_generic_file(file_path, content)

    def _analyze_python_file(self, file_path: str, content: str) -> Dict[str, Any]:
        """Detailed Python file analysis"""
        try:
            tree = ast.parse(content)

            classes = []
            methods = []
            dependencies = []

            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef):
                    class_info = {
                        'name': node.name,
                        'line_start': node.lineno,
                        'line_end': node.end_lineno,
                        'methods': [m.name for m in node.body if isinstance(m, ast.FunctionDef)],
                        'bases': [base.id if isinstance(base, ast.Name) else str(base) for base in node.bases],
                        'complexity': self._calculate_complexity(node)
                    }
                    classes.append(class_info)

                elif isinstance(node, ast.FunctionDef):
                    method_info = {
                        'name': node.name,
                        'line_start': node.lineno,
                        'line_end': node.end_lineno,
                        'parameters': [arg.arg for arg in node.args.args],
                        'calls': self._extract_function_calls(node),
                        'complexity': self._calculate_complexity(node)
                    }
                    methods.append(method_info)

                elif isinstance(node, ast.Import):
                    for alias in node.names:
                        dependencies.append({
                            'type': 'import',
                            'module': alias.name,
                            'alias': alias.asname
                        })

                elif isinstance(node, ast.ImportFrom):
                    dependencies.append({
                        'type': 'from_import',
                        'module': node.module,
                        'names': [alias.name for alias in node.names]
                    })

            return {
                'path': file_path,
                'language': 'python',
                'classes': classes,
                'methods': methods,
                'dependencies': dependencies,
                'lines_of_code': len(content.splitlines())
            }

        except Exception as e:
            print(f"Error analyzing Python file {file_path}: {e}")
            return self._analyze_generic_file(file_path, content)
```

### Step 11: Smart RDF Merger

**File: `app/services/smart_rdf_merger.py`**

```python
from rdflib import Graph, Namespace, URIRef, Literal, RDF, RDFS
from typing import Dict, List, Any, Tuple
import os

class SmartRDFMerger:
    def __init__(self):
        self.aaswe = Namespace("http://aaswe.org/ontology#")
        self.code = Namespace("http://aaswe.org/code#")

        # Properties that are developer-editable
        self.developer_properties = {
            self.aaswe.businessRule,
            self.aaswe.securityLevel,
            self.aaswe.dependencyReason,
            self.aaswe.businessContext,
            self.aaswe.owner,
            self.aaswe.description,
            self.aaswe.purpose,
            self.aaswe.rateLimit
        }

    def merge_with_existing_rdf(self, new_analysis: Dict[str, Any], existing_rdf_path: str) -> str:
        """Merge new code analysis with existing developer-annotated RDF"""

        # Load existing RDF if it exists
        existing_annotations = {}
        if os.path.exists(existing_rdf_path):
            existing_annotations = self._extract_developer_annotations(existing_rdf_path)

        # Generate new RDF from code analysis
        new_rdf_graph = self._generate_rdf_from_analysis(new_analysis)

        # Merge developer annotations back in
        merged_graph = self._merge_annotations(new_rdf_graph, existing_annotations)

        return merged_graph.serialize(format='turtle')

    def _extract_developer_annotations(self, rdf_file_path: str) -> Dict[str, List[Tuple]]:
        """Extract developer-added annotations from existing RDF"""
        g = Graph()
        g.parse(rdf_file_path, format='turtle')

        annotations = {}

        for subject, predicate, obj in g:
            if predicate in self.developer_properties:
                if subject not in annotations:
                    annotations[subject] = []
                annotations[subject].append((predicate, obj))

        return annotations

    def _generate_rdf_from_analysis(self, analysis: Dict[str, Any]) -> Graph:
        """Generate RDF from fresh code analysis"""
        g = Graph()
        g.bind("aaswe", self.aaswe)
        g.bind("code", self.code)

        # Create module URI
        module_uri = self.code[f"module/{analysis['name']}"]
        g.add((module_uri, RDF.type, self.aaswe.Module))
        g.add((module_uri, RDFS.label, Literal(analysis['name'])))
        g.add((module_uri, self.aaswe.path, Literal(analysis['path'])))

        # Add classes
        for class_info in analysis['classes']:
            class_uri = self.code[f"class/{class_info['name']}"]
            g.add((class_uri, RDF.type, self.aaswe.Class))
            g.add((class_uri, RDFS.label, Literal(class_info['name'])))
            g.add((class_uri, self.aaswe.complexity, Literal(class_info['complexity'])))
            g.add((class_uri, self.aaswe.lineStart, Literal(class_info['line_start'])))
            g.add((class_uri, self.aaswe.lineEnd, Literal(class_info['line_end'])))
            g.add((module_uri, self.aaswe.contains, class_uri))

            # Add methods for this class
            for method_name in class_info['methods']:
                method_info = next((m for m in analysis['methods'] if m['name'] == method_name), None)
                if method_info:
                    method_uri = self.code[f"method/{method_info['name']}"]
                    g.add((method_uri, RDF.type, self.aaswe.Method))
                    g.add((method_uri, RDFS.label, Literal(method_info['name'])))
                    g.add((method_uri, self.aaswe.complexity, Literal(method_info['complexity'])))
                    g.add((class_uri, self.aaswe.hasMethod, method_uri))

                    # Add method calls
                    for call in method_info.get('calls', []):
                        called_method_uri = self.code[f"method/{call}"]
                        g.add((method_uri, self.aaswe.calls, called_method_uri))

        return g

    def _merge_annotations(self, new_graph: Graph, annotations: Dict[str, List[Tuple]]) -> Graph:
        """Merge developer annotations back into the new graph"""

        for subject_str, annotation_list in annotations.items():
            subject = URIRef(subject_str)

            # Check if this subject still exists in the new graph
            if (subject, None, None) in new_graph:
                # Add back the developer annotations
                for predicate, obj in annotation_list:
                    new_graph.add((subject, predicate, obj))

        return new_graph
```

### Step 12: File Watcher System

**File: `app/services/file_watcher.py`**

```python
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from pathlib import Path
import threading

class ModuleRDFWatcher:
    def __init__(self, neo4j_syncer):
        self.observer = Observer()
        self.neo4j_syncer = neo4j_syncer
        self.watched_files = set()

    def start_watching(self, project_root: str):
        """Start watching all module-knowledge.ttl files"""
        project_path = Path(project_root)

        # Find all module-knowledge.ttl files
        for rdf_file in project_path.rglob('module-knowledge.ttl'):
            self.watch_file(str(rdf_file))

        self.observer.start()
        print(f"🔍 Watching {len(self.watched_files)} module knowledge files for changes")

    def watch_file(self, file_path: str):
        """Watch a specific RDF file for changes"""
        if file_path not in self.watched_files:
            handler = RDFFileHandler(file_path, self.neo4j_syncer)
            self.observer.schedule(handler, path=str(Path(file_path).parent), recursive=False)
            self.watched_files.add(file_path)

    def stop_watching(self):
        """Stop the file watcher"""
        self.observer.stop()
        self.observer.join()

class RDFFileHandler(FileSystemEventHandler):
    def __init__(self, target_file: str, neo4j_syncer):
        self.target_file = target_file
        self.neo4j_syncer = neo4j_syncer
        self.last_modified = 0

    def on_modified(self, event):
        if not event.is_directory and event.src_path == self.target_file:
            # Debounce rapid file changes
            current_time = time.time()
            if current_time - self.last_modified > 1:  # 1 second debounce
                self.last_modified = current_time
                self._handle_rdf_change()

    def _handle_rdf_change(self):
        """Handle RDF file change"""
        try:
            print(f"📝 Detected change in {self.target_file}")

            # Validate RDF syntax
            if self._validate_rdf_syntax():
                # Sync to Neo4j
                self.neo4j_syncer.sync_rdf_file(self.target_file)
                print(f"✅ Successfully synced {self.target_file} to knowledge graph")
            else:
                print(f"❌ Invalid RDF syntax in {self.target_file}")

        except Exception as e:
            print(f"❌ Error processing RDF change: {e}")

    def _validate_rdf_syntax(self) -> bool:
        """Validate RDF file syntax"""
        try:
            from rdflib import Graph
            g = Graph()
            g.parse(self.target_file, format='turtle')
            return True
        except Exception as e:
            print(f"RDF validation error: {e}")
            return False
```

### Step 13: Developer CLI Tools

**File: `cli/knowledge_commands.py`**

```python
import click
from pathlib import Path
from rdflib import Graph
import json

@click.group()
def knowledge():
    """Commands for managing module knowledge"""
    pass

@knowledge.command()
@click.argument('module_path')
def init_module(module_path):
    """Initialize module-knowledge.ttl for a module"""
    module_path = Path(module_path)

    if not module_path.exists():
        click.echo(f"❌ Module path {module_path} does not exist")
        return

    # Analyze the module
    from app.services.complete_analysis import CompleteCodebaseAnalyzer
    analyzer = CompleteCodebaseAnalyzer()

    module_data = {
        'name': module_path.name,
        'path': str(module_path),
        'files': list(module_path.glob('**/*.py')) + list(module_path.glob('**/*.java'))
    }

    analysis = analyzer.analyze_module_completely(module_data)

    # Generate RDF
    from app.services.rdf_generator import RDFGenerator
    rdf_gen = RDFGenerator()
    rdf_content = rdf_gen.generate_module_rdf(analysis, "initial")

    # Save to module directory
    rdf_file = module_path / 'module-knowledge.ttl'
    with open(rdf_file, 'w') as f:
        f.write(rdf_content)

    click.echo(f"✅ Created {rdf_file}")
    click.echo("You can now edit this file to add business context and annotations")

@knowledge.command()
@click.argument('rdf_file')
def validate(rdf_file):
    """Validate RDF syntax"""
    try:
        g = Graph()
        g.parse(rdf_file, format='turtle')
        click.echo(f"✅ {rdf_file} is valid RDF")

        # Show some stats
        triples_count = len(g)
        click.echo(f"📊 Contains {triples_count} triples")

    except Exception as e:
        click.echo(f"❌ Invalid RDF in {rdf_file}: {e}")

@knowledge.command()
def sync_all():
    """Sync all module knowledge to graph database"""
    project_root = Path.cwd()
    rdf_files = list(project_root.rglob('module-knowledge.ttl'))

    if not rdf_files:
        click.echo("❌ No module-knowledge.ttl files found")
        return

    from app.services.neo4j_syncer import Neo4jSyncer
    syncer = Neo4jSyncer()

    for rdf_file in rdf_files:
        try:
            syncer.sync_rdf_file(str(rdf_file))
            click.echo(f"✅ Synced {rdf_file}")
        except Exception as e:
            click.echo(f"❌ Failed to sync {rdf_file}: {e}")

@knowledge.command()
@click.argument('module_name')
def show_context(module_name):
    """Show what the LLM knows about a module"""
    from app.services.llm_context import LLMContextProvider
    context_provider = LLMContextProvider()

    context = context_provider.get_module_context(module_name)

    click.echo(f"🧠 LLM Context for module '{module_name}':")
    click.echo("=" * 50)
    click.echo(context)

# Add to main CLI
if __name__ == '__main__':
    knowledge()
```

### Step 14: Installation Scripts

**File: `scripts/install.sh`**

```bash
#!/bin/bash
set -e

echo "🚀 Installing AASWE - AI-Assisted Software Engineering"

# Detect installation method preference
if command -v npm &> /dev/null; then
    echo "📦 Installing via npm..."
    npm install -g @aaswe/cli
elif command -v pip &> /dev/null; then
    echo "🐍 Installing via pip..."
    pip install aaswe-cli
else
    echo "📥 Installing via direct download..."
    curl -sSL https://github.com/aaswe/releases/latest/download/aaswe-linux -o /usr/local/bin/aaswe
    chmod +x /usr/local/bin/aaswe
fi

echo "✅ AASWE CLI installed successfully!"
echo ""
echo "Next steps:"
echo "1. Navigate to your project directory"
echo "2. Run 'aaswe init' to initialize AASWE"
echo "3. Run 'aaswe start' to begin analysis"
echo ""
echo "For IDE integration:"
echo "- VS Code: Install 'AASWE' extension from marketplace"
echo "- IntelliJ: Install 'AASWE' plugin from JetBrains marketplace"
echo "- Vim/Neovim: Run 'aaswe install-vim-plugin'"
```

## Next Steps

1. **Execute Phase 1, Week 1** by running the setup commands above
2. **Validate infrastructure** by accessing Neo4j browser at http://localhost:7474
3. **Run schema initialization** with `python scripts/init_schema.py`
4. **Begin implementing** the Code Ingestion Service as outlined in Task 1.3

## Success Metrics for Phase 1

- ✅ Neo4j database running with proper schema
- ✅ Redis cache operational
- ✅ Kafka message queue functional
- ✅ Basic FastAPI application responding
- ✅ Unit tests passing with 80%+ coverage
- ✅ Docker environment stable

This implementation plan is directly executable and builds upon your excellent architecture. Each task has clear deliverables and success criteria, making it easy to track progress and ensure quality at each step.
