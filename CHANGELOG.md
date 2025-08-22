# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2025-08-22

### Critical TTL Directory Isolation Fix + Visual Documentation

### Critical Fixes
- **TTL Directory Restriction Bug**: Fixed critical issue causing MCP server to load data from multiple projects simultaneously
  - **Root Cause**: TTLContextLoader used global glob patterns (`**/*.module-knowledge.ttl`) that searched entire filesystem
  - **Impact**: Before fix: 82 TTL files loaded (41 AIDe + 41 target project), After fix: 41 TTL files (target project only)
  - **Technical Solution**: Updated `loadAllTTLFiles()` and `initializeFileWatcher()` methods in `TTLContextLoader.ts`
  - **CLI Integration**: Added missing `directories: ttlDirectories` configuration at line 650 in `cli/index.ts`
  - **Docker Configuration**: Enhanced `Dockerfile` with `--ttl-directories ./knowledge` parameter

### Validation Results
- **TTL Context Loader**: `Successfully loaded 41/41 TTL files` (target project only)
- **WebSocket MCP Server**: `Successfully loaded 41 TTL files` (clean data isolation)
- **Stdio MCP Server**: `Loaded 41 TTL files in stdio server` (no cross-project contamination)
- **MCP Data Verification**: Confirmed serving correct Java code data from keycloak project only

### Documentation Enhancements
- **Visual Overview**: Added Neo4j knowledge graph visualization to README
  - Interactive module nodes with dependency relationships
  - Entity metrics and architectural patterns visualization
- **Technical Architecture**: Complete documentation of 5-layer AASWE system
- **Multi-Project Support**: Clear project isolation and data boundaries

### System Reliability
- **Project Data Isolation**: Complete separation between different analyzed codebases
- **MCP Server Integrity**: All three TTL loading mechanisms now respect directory restrictions
- **Docker Volume Mapping**: Proper `${ANALYSIS_PROJECT_PATH:-./}/knowledge:/app/knowledge` configuration
- **Container Health**: Validated full system operation with Neo4j + Redis + MCP server stack

---

## [1.1.1] - 2025-08-22

### 🔒 Security & Reliability Release - CodeRabbit Fixes

### Security Fixes
- **SQL/Cypher Injection Prevention**: Added input validation and sanitization in `MCPStdioServer.ts`
  - Strict type checking for filePath parameters
  - Regex-based parameter sanitization to prevent injection attacks
  - Proper validation with MCPServerError responses
- **Error Response ID Correlation**: Fixed error response handling in MCP protocol
  - Updated `sendError()` method to accept and use proper request IDs
  - All error responses now correlate with originating requests
  - Maintains JSON-RPC protocol specification compliance

### Performance & Reliability Improvements
- **Memory Leak Prevention**: Fixed memory accumulation in CLI process management
  - Replaced infinite promise with heartbeat intervals in `cli/index.ts`
  - Proper SIGINT/SIGTERM signal handling and cleanup mechanisms
  - Prevents long-running process memory leaks
- **Metrics Division by Zero**: Fixed calculation errors in server metrics
  - Proper edge case handling when totalRequests = 0
  - Accurate average response time calculation from first request
  - Reliable performance monitoring metrics

### Build & Infrastructure Fixes
- **Docker Native Module Compilation**: Fixed container build issues
  - Removed `--ignore-scripts` flag to allow proper native module builds
  - Fixed source file copy sequence in Dockerfile
  - All dependencies now compile correctly in containerized environments
- **Docker Context Optimization**: Improved build performance
  - Excludes local `dist/` directory to prevent stale artifacts
  - Added `!docs/**/*.md` inclusion for complete documentation
  - Optimized context size for faster builds

### Code Quality Enhancements
- **Path Normalization**: Enhanced cross-platform compatibility
  - Robust Windows/Linux path handling with `toPosix()` helper function
  - Efficient deduplication using `Set` instead of array filtering
  - Cleaner, more maintainable path variation generation
- **Package Lock Synchronization**: Updated package-lock.json to version 1.1.1

### Known Non-Critical Issues
- **RDF Storage Layer Warning**: Non-critical `baseDirectory` initialization error during startup
  - System continues to function normally despite warning
  - TTL files load successfully (38/38 files loaded)
  - MCP server starts and operates correctly
  - Will be addressed in future release

### Testing & Validation
- **Docker Build Success**: All security fixes validated with successful container builds
- **TypeScript Compilation**: No errors during build process
- **NPM Dependencies**: All packages install correctly with synchronized lock file
- **System Functionality**: Complete MCP server operation confirmed (4 tools, 38 TTL files)

---

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
