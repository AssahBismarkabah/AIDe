# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-08-22

### 🎉 Major Release - Complete MCP Integration & Bug Fixes

### Added
- **Dual MCP Transport Support**: Full Model Context Protocol integration with both WebSocket and stdio transports
- **RooCode/Cline IDE Integration**: Direct CLI IDE support via stdio MCP transport
- **Enhanced TTL Context Loading**: Recursive TTL file discovery and loading (38+ files for keycloak-config-cli)
- **Docker Health Check Dependencies**: Proper container startup orchestration
- **Comprehensive Resource Discovery**: 146+ resources accessible via MCP protocol
- **4 MCP Tools Available**: `get_context`, `query_knowledge`, `analyze_code`, `get_file_content`

### Fixed
- **Critical TTL Aggregation Bug**: Fixed Neo4j Cypher query syntax in `AutoAnalysisWorkflow.ts` (line 247)
  - TTL files now show real entity counts instead of zeros
  - Replaced invalid `ANY()` clauses with direct string interpolation
- **Container Startup Race Conditions**: Neo4j now starts before AASWE server
- **RDF Storage Configuration Issues**: Disabled problematic monitoring that caused recurring "baseDirectory" errors
- **Docker Volume Mounting**: Proper `ANALYSIS_PROJECT_PATH` environment variable support
- **Neo4j Connection Reliability**: Eliminated connection refused errors during startup

### Changed
- **Version Bump**: 1.0.19 → 1.1.0
- **Repository URLs**: Updated to `https://github.com/AssahBismarkabah/AIDe.git`
- **README Documentation**: Comprehensive setup and MCP integration instructions
- **Package Self-Dependency**: Updated to version 1.1.0

### Technical Improvements
- **TTL File Processing**: Complete recursive directory scanning for knowledge files
- **MCP Server Architecture**: Unified server manager supporting dual transports
- **Container Health Monitoring**: Proper health check implementations
- **CLI Enhanced Detection**: Prefers local docker-compose over NPM package versions
- **Error Handling**: Improved error messages and graceful failure handling

### Testing & Validation
-  **End-to-End Testing**: Complete system tested with keycloak-config-cli Java project
-  **MCP Connectivity**: Confirmed working with 4 tools and 146 resources
-  **Docker Orchestration**: Full containerized deployment operational
-  **IDE Integration**: RooCode configuration tested and validated
-  **Multi-Language Support**: Validated with Java, TypeScript, and configuration files

### Dependencies
- All dependencies maintained at current stable versions
- No breaking changes introduced
- Backward compatible with existing configurations

---

## [1.0.19] - Previous Release
- Initial stable release with basic functionality
