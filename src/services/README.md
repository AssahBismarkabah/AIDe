# AIDe Services

This directory contains the implementation of all AIDe services organized by the 5-layer architecture.

## Architecture Overview

```
Layer 5: Integration & APIs
├── mcp-server/          # Model Context Protocol server for IDE integration
├── api-gateway/         # REST API gateway for external access
└── web-interface/       # Web-based management interface

Layer 4: Developer Assistance
└── code-assistant/      # AI-powered code assistance and recommendations

Layer 3: AI/LLM Integration
├── llm-gateway/         # LLM provider abstraction and routing
└── langchain-rag/       # RAG implementation using LangChain

Layer 2: Knowledge Graph Core
└── knowledge-graph-core/ # Neo4j operations and graph management

Layer 1: Data Ingestion
├── code-ingestion/      # File system monitoring and code ingestion
├── ast-analyzer/        # Abstract Syntax Tree analysis
└── rdf-generator/       # RDF/TTL file processing and generation
```

## Service Communication

Services communicate through:
- **Redis**: Message queuing and caching
- **Neo4j**: Shared knowledge graph database
- **HTTP APIs**: RESTful service-to-service communication
- **Docker Networks**: Container-to-container networking

## Development

Each service is designed to be:
- **Independently deployable**: Can run standalone or as part of the stack
- **Horizontally scalable**: Multiple instances can run behind load balancers
- **Health monitored**: Includes health check endpoints
- **Logged centrally**: Uses structured logging with correlation IDs

## Getting Started

1. Start the entire stack: `aide start`
2. View service status: `aide status`
3. View logs: `aide logs [service-name]`
4. Stop services: `aide stop`

For individual service development, see the README in each service directory.