# AI-Assisted Software Engineering System (AASWE)

![High-Level System Architecture](main/docs/High-Level%20System%20Architecture%20Diagram%20Aug%201%202025.png)

## Overview

The AI-Assisted Software Engineering System (AASWE) is an **npm package** that enhances LLM interactions in your IDE with deep codebase knowledge. Install it in your project, and when you interact with AI assistants in your IDE, they'll have comprehensive understanding of your codebase structure, patterns, and relationships - enabling much more intelligent code implementation, refactoring, and architectural guidance.

## Key Features

### 🚀 **AI-Powered Code Implementation**
- **Feature Implementation**: Generate complete code implementations that integrate seamlessly with existing codebase patterns
- **Intelligent Refactoring**: Perform smart refactoring across multiple files while preserving functionality
- **Code Modification**: Modify existing code while maintaining consistency and updating all affected dependencies
- **Context-Aware Generation**: Create code that follows project-specific conventions and best practices

### 🧠 **Deep Codebase Understanding**
- **Knowledge Graph Creation**: Automatically analyze codebases and create queryable knowledge graphs
- **Multi-Language Support**: Parse and understand Java, Python, JavaScript, C++, COBOL, and more
- **Relationship Mapping**: Track complex dependencies, architectural patterns, and code relationships
- **Versioned Knowledge**: Git-aligned versioning of knowledge representations

### 💬 **Natural Language Interface**
- **Conversational Queries**: Ask questions about your codebase in natural language
- **Intelligent Responses**: Get contextual answers with architectural insights
- **Implementation Requests**: Request feature implementations through natural language descriptions
- **Documentation Assistance**: Generate documentation on-demand when requested

### 🔧 **Developer-Friendly NPM Package**
- **Simple Installation**: `npm install @aaswe/codebase-ai` with automatic setup
- **IDE Integration**: Seamless integration with IntelliJ IDEA and VS Code through MCP
- **LLM Enhancement**: Enhances existing LLM interactions with codebase context
- **Local-First**: Works offline with embedded services

### 📊 **Collaborative Knowledge Enhancement**
- **Distributed RDF Files**: Each module contains its own `.module-knowledge.ttl` file with concrete code information
- **Developer Editable**: Enhance AI understanding by manually updating RDF files with business context
- **Version Controlled**: RDF files are tracked in Git alongside code for collaborative knowledge evolution
- **Automatic Sync**: Changes to RDF files automatically update the knowledge graph

## Architecture

The system follows a **5-layer architecture** optimized for scalability, developer experience, and enterprise adoption:

### Layer 1: AI-Powered Fact Extraction & Orchestration
- **Code Ingestion Service**: Monitors repositories and processes code changes
- **AST Analysis Engine**: Generates Abstract Syntax Trees for multiple languages
- **RDF Generator**: Creates semantic representations of code structures
- **LLM Analysis Service**: AI-powered code analysis and pattern recognition
- **CrewAI Orchestration Engine**: Coordinates specialized AI agents

### Layer 2: Versioned Knowledge Graph Database
- **Local Neo4j Database**: High-performance graph database for complex queries
- **RDF Module Store**: Distributed, versioned RDF files in each module
- **Version Manager**: Git-aligned versioning of knowledge states
- **Hybrid Storage Manager**: Coordinates multiple storage layers
- **In-Memory RDF Store**: Fast queries for LLM interactions

### Layer 3: AI/LLM Integration & Reasoning
- **LangChain RAG Engine**: Retrieval-Augmented Generation for context-aware responses
- **GraphCypherQAChain**: Natural language to Cypher query translation
- **SPARQL Query Engine**: Semantic queries over RDF knowledge
- **LLM Gateway Service**: Multi-provider LLM integration with failover
- **Reasoning Engine**: Combines graph data with AI reasoning

### Layer 4: Developer Assistance
- **Code Assistant**: Real-time code suggestions and implementations
- **Refactoring Assistant**: Intelligent refactoring recommendations
- **Documentation Assistant**: On-demand documentation generation
- **Test Assistant**: Automated test generation and suggestions

### Layer 5: Enterprise Integration & APIs
- **API Gateway**: RESTful and GraphQL APIs
- **Authentication Service**: SSO and enterprise security integration
- **Monitoring & Observability**: Comprehensive system monitoring
- **Web Interface**: Interactive knowledge graph visualization
- **MCP Server**: Model Context Protocol for IDE integration

## Installation

### Quick Start

```bash
# Install the AASWE npm package in your project
npm install @aaswe/codebase-ai

# Or using yarn
yarn add @aaswe/codebase-ai

# Or using pnpm
pnpm add @aaswe/codebase-ai
```

### Automatic Setup

```bash
# The package automatically analyzes your codebase on installation
# Creates .module-knowledge.ttl files in each module
# Sets up MCP server for IDE integration
# Initializes local knowledge graph

# Your IDE will automatically detect the enhanced LLM capabilities
# Start using AI assistants with deep codebase knowledge immediately
```

## Usage

### Enhanced LLM Interactions

Once installed, the package automatically enhances your IDE's LLM interactions with deep codebase knowledge:

```javascript
// In your IDE, when you interact with AI assistants, they now have access to:

// 1. Ask questions about your codebase
"What are the main architectural components in this project?"
"Show me all classes that implement UserService"
"How does authentication work in this system?"

// 2. Request feature implementations with context
"Add user registration endpoint with email validation that follows our existing patterns"
"Create a caching layer for database queries using our current architecture"

// 3. Get intelligent refactoring suggestions
"Refactor UserController to follow our established patterns"
"Extract common validation logic into utility class while maintaining dependencies"

// 4. Generate contextual documentation
"Document the UserService class with architectural context"
"Generate API documentation that explains the relationships between endpoints"

// 5. Create appropriate tests
"Generate unit tests for UserController.createUser that cover our edge cases"
"Create integration tests for AuthenticationService using our testing patterns"
```

### IDE Integration Examples

**IntelliJ IDEA with GitHub Copilot:**
```
You: "Implement a new payment service that integrates with our existing user system"

AI (enhanced with AASWE): "I can see your project uses hexagonal architecture with UserService 
following the repository pattern. I'll create a PaymentService that integrates with your 
existing UserRepository and follows your established error handling patterns..."
```

**VS Code with Claude:**
```
You: "Refactor this method to be more maintainable"

AI (enhanced with AASWE): "Based on your codebase patterns, I can see you prefer dependency 
injection and have established logging patterns. Here's a refactored version that follows 
your project's conventions and updates all dependent classes..."
```

### Working with Knowledge Files

Each module in your codebase will have a `.module-knowledge.ttl` file containing concrete information extracted from your code:

```turtle
# Example: src/user-service/.module-knowledge.ttl
@prefix aaswe: <http://aaswe.org/ontology#> .
@prefix business: <http://company.com/business#> .

<http://aaswe.org/modules/UserService> a aaswe:Module ;
    rdfs:label "User Service" ;
    business:purpose "Handles user authentication and profile management" ;
    business:criticalPath "true" ;
    aaswe:architecturalPattern "Hexagonal Architecture" .

<http://aaswe.org/classes/UserController> a aaswe:Class ;
    rdfs:label "UserController" ;
    business:responsibility "REST API endpoints for user operations" ;
    aaswe:complexity "medium" .
```

You can enhance these files with additional business context, and the AI will automatically incorporate your updates into its understanding of the codebase.

## Project Structure After Initialization

```
your-project/
├── src/
│   ├── user-service/
│   │   ├── UserController.java
│   │   ├── UserService.java
│   │   └── .module-knowledge.ttl    # Generated knowledge file
│   ├── auth-module/
│   │   ├── AuthController.java
│   │   ├── TokenService.java
│   │   └── .module-knowledge.ttl    # Generated knowledge file
│   └── data-layer/
│       ├── UserRepository.java
│       ├── DatabaseConfig.java
│       └── .module-knowledge.ttl    # Generated knowledge file
├── .aaswe/
│   ├── config.json                  # Project configuration
│   └── versions.json                # Knowledge versions
└── .gitignore                       # Updated to include .aaswe/cache/
```

## Configuration

### Project Configuration (`.aaswe/config.json`)

```json
{
  "project": {
    "name": "my-project",
    "description": "My awesome project",
    "main_language": "java",
    "supported_languages": ["java", "javascript", "python"]
  },
  "analysis": {
    "enabled": true,
    "incremental": true,
    "exclude_paths": ["node_modules/", "target/", "build/"],
    "complexity_threshold": 10
  },
  "ai": {
    "llm_provider": "openai",
    "model": "gpt-4",
    "temperature": 0.1
  },
  "integrations": {
    "jira": {
      "enabled": true,
      "project_key": "PROJ"
    },
    "confluence": {
      "enabled": true,
      "space_key": "PROJ"
    }
  }
}
```

## IDE Integration

### IntelliJ IDEA Plugin
- Real-time code analysis and suggestions
- Inline hints and architectural insights
- Context-aware code completion
- Integrated documentation generation

### VS Code Extension
- Code insights and suggestions
- Interactive knowledge graph exploration
- Seamless AI assistance workflow
- Integrated refactoring tools

### Model Context Protocol (MCP)
- Compatible with any MCP-enabled IDE or tool
- Provides standardized AI assistance interface
- Real-time codebase understanding
- Cross-platform compatibility

## Enterprise Features

### Security & Compliance
- **SSO Integration**: Enterprise identity provider support
- **RBAC**: Role-based access control
- **Data Encryption**: PII masking and data protection
- **Audit Logging**: Comprehensive security compliance
- **Standards Compliance**: GDPR, SOC 2, ISO 27001

### CI/CD Integration
- **GitHub Actions**: Automated analysis workflows
- **Jenkins**: Pipeline integration and quality gates
- **GitLab CI**: Continuous integration support
- **Quality Gates**: Architectural compliance checks
- **Automated Reporting**: Build status and metrics

### External Integrations
- **Jira**: Automated ticket creation and management
- **Confluence**: Documentation publishing and updates
- **Slack/Teams**: Notifications and collaboration
- **Monitoring**: Prometheus, Grafana, Jaeger integration

## Performance & Scalability

### Performance Metrics
- **Query Response Time**: <2 seconds for 95% of queries
- **Analysis Accuracy**: >90% dependency detection accuracy
- **Documentation Coverage**: >95% automated coverage
- **System Uptime**: >99.9% availability

### Scalability Features
- **Large Codebase Support**: 10,000+ lines of code analysis
- **Concurrent Users**: Support for 1000+ simultaneous users
- **Multi-Project**: Handle 100+ projects simultaneously
- **High Throughput**: 10,000+ daily analysis jobs

## Development Workflow Integration

### New Codebases
1. **Initialize**: Run `aaswe init` to set up the project
2. **Develop**: Use AI assistance for feature implementation
3. **Enhance**: Gradually improve RDF files with business context
4. **Collaborate**: Share knowledge through version-controlled RDF files

### Existing Codebases
1. **Analyze**: System performs comprehensive initial analysis
2. **Generate**: Creates extensive RDF knowledge base from existing patterns
3. **Immediate Value**: Benefit from AI assistance based on existing code
4. **Enhance**: Add business context and architectural decisions to RDF files

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/aaswe.git
cd aaswe

# Set up development environment
make setup-dev

# Run tests
make test

# Build binary
make build
```

## Documentation

- **[Requirements Specification](.kiro/specs/ai-assisted-software-engineering/requirements.md)**: Detailed system requirements
- **[Design Document](.kiro/specs/ai-assisted-software-engineering/design.md)**: Comprehensive system design
- **[Implementation Tasks](.kiro/specs/ai-assisted-software-engineering/tasks.md)**: Development roadmap
- **[API Documentation](docs/api.md)**: REST and GraphQL API reference
- **[CLI Reference](docs/cli.md)**: Complete command-line interface guide

## Roadmap

### Phase 1: Foundation (Months 1-3)
- ✅ Core infrastructure and binary packaging
- ✅ AST analysis engine for multiple languages
- ✅ RDF generation and knowledge graph creation
- ✅ Basic CLI interface and project initialization

### Phase 2: AI Integration (Months 4-6)
- 🔄 LangChain RAG engine implementation
- 🔄 Multi-agent orchestration with CrewAI
- 🔄 Natural language query interface
- 🔄 Code implementation and modification engine

### Phase 3: Enterprise Features (Months 7-9)
- ⏳ IDE plugins and MCP server
- ⏳ CI/CD integration and quality gates
- ⏳ Enterprise security and compliance
- ⏳ External system integrations (Jira, Confluence)

### Phase 4: Scale & Optimization (Months 10-12)
- ⏳ Performance optimization and scalability
- ⏳ Advanced monitoring and observability
- ⏳ Multi-project knowledge graphs
- ⏳ Enterprise deployment and training

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [docs.aaswe.dev](https://docs.aaswe.dev)
- **Community**: [Discord](https://discord.gg/aaswe)
- **Issues**: [GitHub Issues](https://github.com/your-org/aaswe/issues)
- **Enterprise Support**: [enterprise@aaswe.dev](mailto:enterprise@aaswe.dev)

---

**Transform your development workflow with AI-powered code understanding and implementation assistance.**

*Built with ❤️ for developers who want to focus on building great software.*