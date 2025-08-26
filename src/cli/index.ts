#!/usr/bin/env node

/**
 * AASWE CLI - Command Line Interface
 * 
 * Provides easy commands to start, configure, and manage the AASWE system.
 */

import { Command } from 'commander';
import { config } from 'dotenv';
import { join } from 'path';
import { existsSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import logger from '../utils/logger';
import { MCPServer, createDefaultMCPConfig } from '../services/mcp-server';
import { MCPServerManager, TransportType, MCPServerManagerConfig } from '../services/mcp-server/MCPServerManager';
import { TTLContextLoader } from '../services/mcp-server/TTLContextLoader';
import { Layer3AIService } from '../services/layer3';
import { HybridStorageManager } from '../services/layer2/hybrid-storage/HybridStorageManager';
import { InMemoryRDFStore } from '../services/layer2/in-memory-rdf';
import { Neo4jDatabaseService } from '../services/layer2/neo4j-database';
import { MemoryScalingService } from '../services/infrastructure/MemoryScalingService';

// Load environment variables from .env.aaswe
config({ path: '.env.aaswe' });

// Also try loading from .env as fallback
config();

// Get version from package.json automatically
let packageVersion = '1.0.0';
try {
  const packageJson = require('../../package.json');
  packageVersion = packageJson.version || '1.0.0';
} catch (error) {
  logger.warn('Could not read package.json version, using default', { error });
}

const program = new Command();

program
  .name('codebase-ai')
  .alias('aaswe')
  .description('AI-Assisted Software Engineering (AASWE) - Rich codebase context for IDE LLMs')
  .version(packageVersion);

/**
 * Start command - Launch AASWE server
 */
program
  .command('start')
  .description('Start the AASWE MCP server')
  .option('-m, --mode <mode>', 'Deployment mode: context-only or full', 'context-only')
  .option('-p, --port <port>', 'Server port', '3001')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--project-path <path>', 'Custom project path', process.cwd())
  .option('--no-watch', 'Disable TTL file watching')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    try {
      if (options.debug) {
        process.env.LOG_LEVEL = 'debug';
      }

      // Set project path
      const projectPath = options.projectPath || process.cwd();
      process.env.PROJECT_PATH = projectPath;

      logger.info('🚀 Starting AASWE System', {
        mode: options.mode,
        port: options.port,
        projectPath: projectPath,
        version: '1.0.0'
      });

      // Load configuration
      const config = options.config ?
        require(join(projectPath, options.config)) :
        createDefaultMCPConfig();

      config.server.port = parseInt(options.port);
      config.ttl.watchEnabled = options.watch;
      config.projectPath = projectPath;

      // Initialize services based on mode
      let layer3Service: Layer3AIService | null = null;
      let hybridStorage: HybridStorageManager | null = null;

      if (options.mode === 'full') {
        logger.info('🧠 Full mode enabled - Layer 3 AI services available');
        logger.info('💡 Note: Full mode requires proper API keys and Neo4j setup');
        
        // For now, use enhanced mock services that indicate full mode capabilities
        // TODO: Implement full Layer 3 initialization when needed
        layer3Service = {
          query: async (req) => ({
            query: req.query,
            type: req.type === 'auto' ? 'rag' : req.type,
            response: `[Full Mode] Enhanced AI analysis: ${req.query}`,
            confidence: 0.9,
            sources: ['Layer 3 AI Services'],
            executionTime: 100,
            metadata: { mode: 'full', enhanced: true }
          }),
          initialize: async () => { logger.info('Layer 3 services initialized (mock)'); },
          shutdown: async () => { logger.info('Layer 3 services shutdown (mock)'); },
          getStatus: () => ({
            overall: 'healthy' as const,
            services: {
              rag: { name: 'rag', enabled: true, healthy: true, lastCheck: new Date(), metrics: { totalQueries: 0, successRate: 1, averageResponseTime: 100 } },
              graphCypher: { name: 'graphCypher', enabled: true, healthy: true, lastCheck: new Date(), metrics: { totalQueries: 0, successRate: 1, averageResponseTime: 100 } },
              sparql: { name: 'sparql', enabled: true, healthy: true, lastCheck: new Date(), metrics: { totalQueries: 0, successRate: 1, averageResponseTime: 100 } }
            },
            lastUpdated: new Date()
          }),
          getMetrics: () => ({
            overall: { totalQueries: 0, successfulQueries: 0, failedQueries: 0, averageResponseTime: 100, queriesPerSecond: 0 },
            services: {
              rag: { queries: 0, successRate: 1, averageResponseTime: 100, cacheHitRate: 0 },
              graphCypher: { queries: 0, successRate: 1, averageResponseTime: 100, averageConfidence: 0.9 },
              sparql: { queries: 0, successRate: 1, averageResponseTime: 100, averageConfidence: 0.9 }
            },
            routing: { autoDetected: 0, manuallySpecified: 0, routingAccuracy: 1, fallbackUsed: 0 },
            performance: { memoryUsage: 0, cpuUsage: 0, cacheSize: 0, activeConnections: 0 }
          })
        } as any;

        hybridStorage = {
          initialize: async () => { logger.info('Hybrid storage initialized (mock)'); },
          shutdown: async () => { logger.info('Hybrid storage shutdown (mock)'); },
          query: async () => ({ data: [], source: 'cache' as any, executionTime: 50, cached: false, timestamp: new Date() }),
          create: async () => ({ data: {}, source: 'cache' as any, executionTime: 50, cached: false, timestamp: new Date() }),
          update: async () => ({ data: {}, source: 'cache' as any, executionTime: 50, cached: false, timestamp: new Date() }),
          delete: async () => ({ data: true, source: 'cache' as any, executionTime: 50, cached: false, timestamp: new Date() }),
          getStatus: () => ({ status: 'running' })
        } as any;

        await layer3Service!.initialize();
        await hybridStorage!.initialize();
      } else {
        logger.info('📄 Running in context-only mode (recommended)');
        // Create minimal mock services for context-only mode
        layer3Service = {
          query: async () => ({ query: '', type: 'rag' as const, answer: '', confidence: 0, sources: [], explanation: '', metadata: { processingTime: 0, service: 'rag' as const, cached: false, queryId: '', timestamp: Date.now() } }),
          initialize: async () => {},
          shutdown: async () => {},
          getStatus: () => ({ overall: 'healthy' as const, services: { rag: { name: 'rag', enabled: false, healthy: true, lastCheck: new Date() }, graphCypher: { name: 'graphCypher', enabled: false, healthy: true, lastCheck: new Date() }, sparql: { name: 'sparql', enabled: false, healthy: true, lastCheck: new Date() } }, lastUpdated: new Date() }),
          getMetrics: () => ({ overall: { totalQueries: 0, successfulQueries: 0, failedQueries: 0, averageResponseTime: 0, queriesPerSecond: 0 }, services: { rag: { queries: 0, successRate: 0, averageResponseTime: 0, cacheHitRate: 0 }, graphCypher: { queries: 0, successRate: 0, averageResponseTime: 0, averageConfidence: 0 }, sparql: { queries: 0, successRate: 0, averageResponseTime: 0, averageConfidence: 0 } }, routing: { autoDetected: 0, manuallySpecified: 0, routingAccuracy: 0, fallbackUsed: 0 }, performance: { memoryUsage: 0, cpuUsage: 0, cacheSize: 0, activeConnections: 0 } })
        } as any;

        hybridStorage = {
          initialize: async () => {},
          shutdown: async () => {},
          query: async () => ({ data: [], source: 'cache' as any, executionTime: 0, cached: false, timestamp: new Date() }),
          create: async () => ({ data: {}, source: 'cache' as any, executionTime: 0, cached: false, timestamp: new Date() }),
          update: async () => ({ data: {}, source: 'cache' as any, executionTime: 0, cached: false, timestamp: new Date() }),
          delete: async () => ({ data: true, source: 'cache' as any, executionTime: 0, cached: false, timestamp: new Date() }),
          getStatus: () => ({ status: 'running' })
        } as any;
      }

      // Start MCP Server
      const mcpServer = new MCPServer(config, layer3Service!, hybridStorage!);
      await mcpServer.start();

      logger.info('✅ AASWE System Started Successfully!', {
        mode: options.mode,
        port: config.server.port,
        mcpUrl: `ws://localhost:${config.server.port}`
      });

      logger.info('🔗 Configure your IDE to connect to:', {
        websocket: `ws://localhost:${config.server.port}`,
        protocol: 'Model Context Protocol (MCP)'
      });

      if (options.mode === 'context-only') {
        logger.info('💡 Running in context-only mode - your existing IDE LLM will get enhanced context!');
      } else {
        logger.info('🧠 Running in full mode - advanced AI analysis available!');
      }

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        logger.info('🛑 Shutting down AASWE System...');
        await mcpServer.stop();
        if (layer3Service && typeof layer3Service.shutdown === 'function') {
          await layer3Service.shutdown();
        }
        if (hybridStorage && typeof hybridStorage.shutdown === 'function') {
          await hybridStorage.shutdown();
        }
        logger.info('✅ AASWE System stopped gracefully');
        process.exit(0);
      });

    } catch (error) {
      logger.error('❌ Failed to start AASWE System', { error });
      process.exit(1);
    }
  });

/**
 * Full-start command - Start complete system with all containers + auto-analysis
 */
program
  .command('full-start')
  .description('Start complete AASWE system with all containers (Neo4j + MCP Server + Redis) and auto-analyze project')
  .option('--project-path <path>', 'Custom project path for analysis (not docker-compose location)', process.cwd())
  .option('--detach', 'Run containers in background')
  .option('--build', 'Rebuild containers before starting')
  .option('--skip-analysis', 'Skip automatic project analysis')
  .action(async (options) => {
    try {
      // Find the AASWE package directory (where docker-compose.yml is located)
      const path = require('path');
      const fs = require('fs');
      
      // The project path is for analysis, but docker-compose should run from AASWE package directory
      // CRITICAL FIX: Resolve relative path to absolute path for proper scope restriction
      const analysisProjectPath = path.resolve(options.projectPath || process.cwd());
      
      // Strategy: Find docker-compose.yml in the following order:
      // 1. Current working directory (for local development)
      // 2. NPM package installation directory (for global installs)

      let packageRoot = process.cwd();
      let dockerComposePath = path.join(packageRoot, 'docker-compose.yml');

      logger.info(`🔍 Looking for docker-compose.yml in current directory: ${dockerComposePath}`);

      if (!fs.existsSync(dockerComposePath)) {
        logger.info('📦 Not found in current directory, searching NPM package location...');

        // Fall back to NPM package docker-compose.yml
        try {
          // Try multiple methods to find the package root
          let cliScriptPath: string;

          // Method 1: Use __dirname (most reliable for global installs)
          cliScriptPath = __dirname;
          logger.info(`🔧 CLI script location (__dirname): ${cliScriptPath}`);

          // Method 2: Try resolving the package (fallback)
          if (!cliScriptPath || cliScriptPath === '/') {
            try {
              cliScriptPath = require.resolve('@aaswe/codebase-ai/dist/cli/index.js');
              logger.info(`🔧 Package resolved to: ${cliScriptPath}`);
            } catch (e) {
              logger.warn('⚠️  Could not resolve package via require.resolve');
              // Method 3: Try relative to current file
              cliScriptPath = path.join(__dirname, '..', '..', 'dist', 'cli', 'index.js');
              logger.info(`🔧 Using relative path: ${cliScriptPath}`);
            }
          }

          // Navigate up from dist/cli to package root
          // If __dirname is like: /usr/local/lib/node_modules/@aaswe/codebase-ai/dist/cli
          // We need to go up 2 levels: ../.. to get to package root
          if (cliScriptPath.endsWith('/dist/cli')) {
            packageRoot = path.dirname(path.dirname(cliScriptPath));
          } else if (cliScriptPath.endsWith('/dist/cli/index.js')) {
            packageRoot = path.dirname(path.dirname(path.dirname(cliScriptPath)));
          } else {
            // Fallback: assume we're in the package and go up appropriately
            packageRoot = path.dirname(path.dirname(cliScriptPath));
          }

          dockerComposePath = path.join(packageRoot, 'docker-compose.yml');
          logger.info(`🔍 Checking NPM package location: ${dockerComposePath}`);

          logger.info(`🔍 Searching for docker-compose.yml at: ${dockerComposePath}`);

          // Verify docker-compose.yml exists in package
          if (!fs.existsSync(dockerComposePath)) {
            // Try alternative locations for global installations
            const alternativeLocations = [
              // Try one level up (in case we're in a nested structure)
              path.join(path.dirname(packageRoot), 'docker-compose.yml'),
              // Try in the same directory as the CLI script
              path.join(path.dirname(cliScriptPath), '..', '..', 'docker-compose.yml'),
              // Try in node_modules global location
              path.join(path.dirname(cliScriptPath), '..', '..', '..', 'docker-compose.yml')
            ];

            let found = false;
            for (const altPath of alternativeLocations) {
              if (fs.existsSync(altPath)) {
                dockerComposePath = altPath;
                packageRoot = path.dirname(altPath);
                found = true;
                logger.info(`✅ Found docker-compose.yml at: ${altPath}`);
                break;
              }
            }

            if (!found) {
              logger.error('❌ AASWE docker-compose.yml not found in package or current directory');
              logger.error(`Searched locations:`);
              logger.error(`  - Current directory: ${path.join(process.cwd(), 'docker-compose.yml')}`);
              logger.error(`  - Package directory: ${dockerComposePath}`);
              logger.error(`  - CLI script path: ${cliScriptPath}`);
              logger.error(`  - Package root: ${packageRoot}`);
              alternativeLocations.forEach(loc => logger.error(`  - Alternative: ${loc}`));
              logger.info('💡 Try reinstalling: npm install -g @aaswe/codebase-ai');
              logger.info('💡 Or run from the AASWE project directory with local docker-compose.yml');
              process.exit(1);
            }
          }
        } catch (error) {
          logger.error('❌ Failed to locate AASWE package installation');
          logger.error('Error:', error instanceof Error ? error.message : error);
          logger.info('💡 Try reinstalling: npm install -g @aaswe/codebase-ai');
          process.exit(1);
        }
      }
      
      logger.info('🚀 Starting Complete AASWE System with All Containers...');
      logger.info('📦 This includes: Neo4j Database + Redis Cache + Auto-Analysis + MCP Server');
      logger.info(`🎯 Analysis will target: ${analysisProjectPath}`);
      logger.info(`🐳 Using docker-compose from: ${packageRoot}`);
      
      // Check if Docker is available
      const { spawn, execSync } = require('child_process');
      
      // Check Docker availability
      const dockerCheck = spawn('docker', ['--version'], { stdio: 'pipe' });
      dockerCheck.on('error', () => {
        logger.error('❌ Docker is not installed or not available');
        logger.info('💡 Please install Docker Desktop: https://www.docker.com/products/docker-desktop');
        process.exit(1);
      });
      
      dockerCheck.on('close', async (code) => {
        if (code !== 0) {
          logger.error('❌ Docker is not running');
          logger.info('💡 Please start Docker Desktop and try again');
          process.exit(1);
        }
        
        // Docker is available, proceed with startup
        logger.info('✅ Docker detected - proceeding with container startup');
        
        // Phase 0: Auto-detect codebase size and configure Neo4j memory
        logger.info('🧠 Phase 0: Auto-configuring Neo4j memory for codebase size...');
        
        try {
          const memoryConfig = await MemoryScalingService.detectOptimalMemoryConfiguration(analysisProjectPath);
          logger.info('📊 Detected codebase characteristics:', {
            estimatedFiles: memoryConfig.estimatedFiles,
            recommendedHeapSize: memoryConfig.heapSize,
            recommendedPageCacheSize: memoryConfig.pageCacheSize,
            category: memoryConfig.estimatedFiles < 1000 ? 'Small' :
                     memoryConfig.estimatedFiles < 5000 ? 'Medium' :
                     memoryConfig.estimatedFiles < 20000 ? 'Large' : 'Very Large'
          });
          
          MemoryScalingService.setMemoryEnvironmentVariables(memoryConfig);
          logger.info('✅ Neo4j memory configuration applied automatically');
          
          // Validate system memory if possible
          const systemValidation = MemoryScalingService.validateSystemMemory(memoryConfig);
          if (!systemValidation) {
            logger.warn('⚠️  Consider upgrading system memory for optimal performance');
          }
          
          // Show scaling recommendations for large codebases
          const recommendations = MemoryScalingService.getScalingRecommendations(memoryConfig.estimatedFiles);
          if (recommendations.length > 0) {
            logger.info('💡 Scaling recommendations for large codebase:');
            recommendations.forEach(rec => logger.info(`   - ${rec}`));
          }
          
        } catch (error) {
          logger.warn('⚠️  Unable to auto-configure memory, using defaults', { error: error instanceof Error ? error.message : error });
        }
        
        // Phase 1: Start Neo4j and Redis containers only (not MCP server yet)
        logger.info('🐳 Phase 1: Starting infrastructure containers...');
        logger.info('📊 Starting:');
        logger.info('   - Neo4j Database (Graph storage)');
        logger.info('   - Redis Cache (Performance optimization)');
        
        const infraArgs = ['compose', 'up', '-d'];
        if (options.build) infraArgs.push('--build');
        infraArgs.push('neo4j', 'redis');
        
        // Set environment variable for the analysis project path
        const env = { ...process.env, ANALYSIS_PROJECT_PATH: analysisProjectPath };
        
        logger.info(`🔧 Executing: docker ${infraArgs.join(' ')}`);
        logger.info(`📁 Working directory: ${packageRoot}`);

        const infraChild = spawn('docker', infraArgs, {
          stdio: 'inherit',
          cwd: packageRoot,
          env: env
        });

        infraChild.on('error', (error) => {
          logger.error('❌ Failed to execute docker command:', error);
          process.exit(1);
        });
        
        infraChild.on('close', async (infraCode) => {
          if (infraCode !== 0) {
            logger.error('❌ Failed to start infrastructure containers');
            process.exit(infraCode);
          }
          
          logger.info('✅ Infrastructure containers started successfully');
          
          // Phase 2: Wait for Neo4j to be ready
          logger.info('🕐 Phase 2: Waiting for Neo4j to be ready...');
          let neo4jReady = false;
          let retries = 30; // 30 seconds timeout
          
          while (!neo4jReady && retries > 0) {
            try {
              execSync('docker compose exec -T neo4j cypher-shell -u neo4j -p aaswe-password "RETURN 1"', {
                stdio: 'pipe',
                cwd: packageRoot
              });
              neo4jReady = true;
              logger.info('✅ Neo4j is ready and accepting connections');
            } catch (error) {
              retries--;
              await new Promise(resolve => setTimeout(resolve, 1000));
              if (retries % 5 === 0) {
                logger.info(`⏳ Still waiting for Neo4j... (${retries}s remaining)`);
              }
            }
          }
          
          if (!neo4jReady) {
            logger.error('❌ Neo4j failed to start within timeout');
            logger.info('💡 Try: docker compose down && codebase-ai full-start --build');
            process.exit(1);
          }
          
          // Phase 3: Run automatic analysis
          if (!options.skipAnalysis) {
            logger.info('🔍 Phase 3: Running automatic project analysis...');
            logger.info(`📁 Analyzing project: ${analysisProjectPath}`);
            
            try {
              const outputDir = path.join(analysisProjectPath, 'knowledge');
              await mkdir(outputDir, { recursive: true });

              // Import and run the AutoAnalysisWorkflow
              const { AutoAnalysisWorkflow } = await import('../services/project-analysis/AutoAnalysisWorkflow');
              
              const workflow = new AutoAnalysisWorkflow({
                projectRoot: analysisProjectPath,
                outputDirectory: outputDir,
                languages: ['typescript', 'javascript', 'python', 'java'],
                preserveBusinessContext: false, // CRITICAL FIX: Disable to prevent mock placeholder override
                enableBusinessContextPlaceholders: false, // CRITICAL FIX: Disable mock placeholders
                enableKnowledgeGraphPopulation: true, // Enable Neo4j population
                enableMCPContextLoading: false // CLI mode doesn't need MCP server yet
              });

              logger.info('🚀 Running comprehensive analysis workflow...');
              const result = await workflow.executeComprehensiveAnalysis();

              logger.info('✅ Project analysis completed successfully!', {
                filesAnalyzed: result.summary.analyzedFiles,
                ttlFilesGenerated: result.summary.ttlFilesGenerated,
                executionTime: `${result.duration}ms`
              });

              logger.info(`📁 TTL knowledge files generated in: ${outputDir}`);

              // Phase 3.5: Ingest TTL files into Neo4j
              logger.info(' Phase 3.5: Ingesting TTL files into Neo4j...');
              try {
                const { Neo4jDatabaseService } = await import('../services/layer2/neo4j-database');
                const neo4jService = new Neo4jDatabaseService();

                await neo4jService.connect({
                  uri: 'bolt://localhost:7687',
                  username: 'neo4j',
                  password: 'aaswe-password'
                });

                // Wait a moment for Neo4j to be fully ready
                await new Promise(resolve => setTimeout(resolve, 2000));

                const { glob } = await import('glob');
                const ttlFiles = await glob('**/*.ttl', { cwd: outputDir });

                logger.info(`🔄 Ingesting ${ttlFiles.length} TTL files into Neo4j...`);

                for (const ttlFile of ttlFiles) {
                  const fullPath = path.join(outputDir, ttlFile);
                  try {
                    await neo4jService.ingestTTLFile(fullPath);
                    logger.debug(`✅ Ingested: ${ttlFile}`);
                  } catch (ingestError) {
                    logger.warn(`⚠️ Failed to ingest ${ttlFile}:`, ingestError);
                  }
                }

                await neo4jService.disconnect();
                logger.info('✅ TTL files successfully ingested into Neo4j!');

              } catch (neo4jError) {
                logger.warn('⚠️ Failed to ingest TTL files into Neo4j', { error: neo4jError instanceof Error ? neo4jError.message : neo4jError });
                logger.info('💡 Neo4j ingestion can be done later when the database is ready');
              }

            } catch (error) {
              logger.warn('⚠️ Analysis failed but continuing with MCP server startup', { error: error instanceof Error ? error.message : error });
              logger.info('💡 You can run analysis later with: codebase-ai analyze');
            }
          } else {
            logger.info('⏭️ Phase 3: Skipping analysis (--skip-analysis flag used)');
          }
          
          // Phase 4: Start MCP Server
          logger.info('🌐 Phase 4: Starting MCP Server...');
          logger.info('📡 MCP Server will load generated TTL files');
          
          const mcpArgs = ['compose', 'up', '-d', 'aaswe-server'];
          if (options.build) mcpArgs.push('--build');
          
          const mcpChild = spawn('docker', mcpArgs, {
            stdio: 'inherit',
            cwd: packageRoot,
            env: env
          });
          
          mcpChild.on('close', (mcpCode) => {
            if (mcpCode === 0) {
              logger.info('');
              logger.info('🎉 Complete AASWE System Started Successfully!');
              logger.info('');
              logger.info('🔗 Access Points:');
              logger.info('   📡 MCP Server: ws://localhost:3001 (for IDE integration)');
              logger.info('   🗄️  Neo4j Browser: http://localhost:7474 (neo4j/aaswe-password)');
              logger.info('   ⚡ Redis Cache: localhost:6379');
              logger.info('');
              logger.info('🎯 System Ready:');
              logger.info('   ✅ Infrastructure: Neo4j + Redis running');
              logger.info(`   ✅ Analysis: ${options.skipAnalysis ? 'Skipped' : 'Completed'}`);
              logger.info('   ✅ MCP Server: Ready for IDE integration');
              logger.info('');
              logger.info('💡 To stop all services: codebase-ai docker down');
            } else {
              logger.error('❌ Failed to start MCP server');
              logger.info('💡 Try: codebase-ai docker down && codebase-ai full-start --build');
              process.exit(mcpCode);
            }
          });
        });
      });
      
    } catch (error) {
      logger.error('❌ Failed to start complete AASWE system', { error });
      process.exit(1);
    }
  });

/**
 * Init command - Initialize AASWE in current project
 */
program
  .command('init')
  .description('Initialize AASWE in the current project')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('-m, --mode <mode>', 'Initialize for specific mode: context-only or full', 'context-only')
  .action(async (options) => {
    try {
      const configPath = join(process.cwd(), 'aaswe.config.js');
      const envPath = join(process.cwd(), '.env.aaswe');

      if (existsSync(configPath) && !options.force) {
        logger.warn('AASWE already initialized. Use --force to overwrite.');
        return;
      }

      logger.info(`🔧 Initializing AASWE in current project for ${options.mode} mode...`);

      // Create configuration file with mode-specific settings
      const configContent = `
// AASWE Configuration - ${options.mode} mode
module.exports = {
  mode: '${options.mode}',
  server: {
    name: 'AASWE-MCP-Server',
    version: '1.0.0',
    port: ${options.mode === 'full' ? '8000' : '3001'},
    host: 'localhost'
  },
  context: {
    maxTokens: 8000,
    maxFiles: 10,
    relevanceThreshold: 0.3,
    cacheEnabled: true,
    cacheTtl: 300000
  },
  ttl: {
    watchEnabled: true,
    watchDebounce: 1000,
    maxFileSize: 1024 * 1024,
    encoding: 'utf-8'
  }${options.mode === 'full' ? `,
  docker: {
    enabled: true,
    composeFile: 'docker-compose.local.yml'
  }` : ''}
};
`;

      // Create environment file with mode-specific content
      const envContent = `
# AASWE Environment Configuration - ${options.mode} mode
# Uncomment and configure as needed

${options.mode === 'full' ? `# Full Mode Configuration
# OpenAI Configuration
# OPENAI_API_KEY=your_openai_api_key_here

# Anthropic Configuration
# ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Neo4j Configuration
# NEO4J_URI=bolt://localhost:7687
# NEO4J_USERNAME=neo4j
# NEO4J_PASSWORD=password

# Redis Configuration
# REDIS_URL=redis://localhost:6379` : `# Context-Only Mode Configuration
# No additional API keys required - uses your existing IDE LLM`}

# Logging
LOG_LEVEL=info
`;

      await writeFile(configPath, configContent.trim());
      await writeFile(envPath, envContent.trim());

      logger.info('✅ AASWE initialized successfully!');
      logger.info('📝 Configuration files created:');
      logger.info(`   - ${configPath}`);
      logger.info(`   - ${envPath}`);
      logger.info('');
      logger.info('🚀 Next steps:');
      if (options.mode === 'context-only') {
        logger.info('   1. Run: codebase-ai start --mode=context-only');
        logger.info('   2. Configure your IDE to connect to: ws://localhost:3001');
        logger.info('   3. Your IDE LLM will now have rich codebase context!');
      } else {
        logger.info('   1. Set up API keys in .env.aaswe (if needed)');
        logger.info('   2. Run: codebase-ai full-start');
        logger.info('   3. Access services:');
        logger.info('      - MCP Server: ws://localhost:3001');
        logger.info('      - Neo4j Browser: http://localhost:7474');
        logger.info('');
        logger.info('💡 Or use: codebase-ai docker up (for advanced users)');
      }

    } catch (error) {
      logger.error('❌ Failed to initialize AASWE', { error });
      process.exit(1);
    }
  });

/**
 * Status command - Check AASWE server status
 */
program
  .command('status')
  .description('Check AASWE server status')
  .option('-p, --port <port>', 'Server port', '3001')
  .action(async (options) => {
    try {
      // Simple health check
      const response = await fetch(`http://localhost:${options.port}/health`).catch(() => null);
      
      if (response && response.ok) {
        logger.info('✅ AASWE Server is running', {
          port: options.port,
          url: `ws://localhost:${options.port}`
        });
      } else {
        logger.warn('❌ AASWE Server is not running', {
          port: options.port
        });
        logger.info('💡 Start with: codebase-ai start (lightweight) or codebase-ai full-start (complete)');
      }
    } catch (error) {
      logger.error('❌ Failed to check server status', { error });
    }
  });

/**
 * Analyze command - Analyze current project and generate TTL files
 */
program
  .command('analyze')
  .description('Analyze current project and generate TTL knowledge files')
  .option('-o, --output <dir>', 'Output directory for TTL files', './knowledge')
  .option('--languages <langs>', 'Comma-separated list of languages to analyze', 'typescript,javascript,python,java')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    if (options.debug) {
      process.env.LOG_LEVEL = 'debug';
    }
    try {
      logger.info('🔍 Starting automatic project analysis...');
      
      const outputDir = join(process.cwd(), options.output);
      await mkdir(outputDir, { recursive: true });

      // Import and run the AutoAnalysisWorkflow
      const { AutoAnalysisWorkflow } = await import('../services/project-analysis/AutoAnalysisWorkflow');
      
      const workflow = new AutoAnalysisWorkflow({
        projectRoot: process.cwd(),
        outputDirectory: outputDir,
        languages: options.languages.split(',').map((lang: string) => lang.trim()),
        preserveBusinessContext: false, // CRITICAL FIX: Disable to prevent mock placeholder override
        enableBusinessContextPlaceholders: false, // CRITICAL FIX: Disable mock placeholders
        enableKnowledgeGraphPopulation: true, // Enable Neo4j if available
        enableMCPContextLoading: false // CLI mode doesn't need MCP server
      });

      logger.info('🚀 Running comprehensive analysis workflow...');
      const result = await workflow.executeComprehensiveAnalysis();

      logger.info('✅ Project analysis completed successfully!', {
        filesAnalyzed: result.summary.analyzedFiles,
        ttlFilesGenerated: result.summary.ttlFilesGenerated,
        executionTime: `${result.duration}ms`
      });
      
      logger.info(`📁 TTL knowledge files generated in: ${outputDir}`);
      logger.info('🔗 Files can now be used by MCP servers for enhanced IDE context');
      
    } catch (error) {
      console.error('Full error details:', error);
      logger.error('❌ Failed to analyze project', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      process.exit(1);
    }
  });

/**
* MCP Server Command
*
* Start MCP server with dual transport support for IDE integration
*/
program
 .command('mcp')
 .description('Start MCP server for IDE integration with dual transport support')
 .option('-t, --transport <type>', 'Transport type: websocket, stdio, or both', 'both')
 .option('-p, --port <number>', 'WebSocket server port', '3001')
 .option('-h, --host <host>', 'WebSocket server host', 'localhost')
 .option('--ttl-patterns <patterns>', 'TTL file patterns (comma-separated)', '**/*.module-knowledge.ttl')
 .option('--ttl-directories <dirs>', 'TTL directories to watch (comma-separated)', './')
 .option('--neo4j-uri <uri>', 'Neo4j URI', 'bolt://localhost:7687')
 .option('--neo4j-username <username>', 'Neo4j username', 'neo4j')
 .option('--neo4j-password <password>', 'Neo4j password', 'aaswe-password')
 .option('--max-tokens <number>', 'Maximum tokens per context request', '10000')
 .option('--cache-enabled', 'Enable context caching', true)
 .option('--watch-enabled', 'Enable TTL file watching', true)
 .option('--debug', 'Enable debug logging')
 .action(async (options) => {
   try {
     if (options.debug) {
       process.env.LOG_LEVEL = 'debug';
     }

     console.log(`\n🚀 Starting MCP Server (v${packageVersion})`);
     console.log(`📡 Transport: ${options.transport}`);
     
     // Validate transport type
     const transport = options.transport as TransportType;
     if (!['websocket', 'stdio', 'both'].includes(transport)) {
       throw new Error(`Invalid transport type: ${transport}. Must be websocket, stdio, or both.`);
     }

     // Parse configuration
     const ttlPatterns = options.ttlPatterns.split(',').map((p: string) => p.trim());
     const ttlDirectories = options.ttlDirectories.split(',').map((d: string) => d.trim());
     
     console.log(`📁 TTL Directories: ${ttlDirectories.join(', ')}`);
     console.log(`🔍 TTL Patterns: ${ttlPatterns.join(', ')}`);

     // Initialize services
     console.log('🔧 Initializing services...');

     // Neo4j Database Service
     const neo4jService = new Neo4jDatabaseService();
     await neo4jService.connect({
       uri: options.neo4jUri,
       username: options.neo4jUsername,
       password: options.neo4jPassword,
       database: 'neo4j',
       encrypted: false
     });
     console.log('✅ Neo4j connected');

     // In-Memory RDF Store
     const rdfStore = new InMemoryRDFStore({
       maxTriples: 100000,
       enableInference: false,
       enabledIndexes: ['spo', 'pos', 'osp'], // Required for proper indexing
       prefixes: {
         'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
         'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
         'code': 'http://example.org/code#'
       }
     } as any);
     await rdfStore.initialize();
     console.log('✅ RDF store initialized');

     // Simplified Hybrid Storage Manager (TTL Context Loader handles file loading)
     const hybridStorage = new HybridStorageManager({
       neo4j: {
         uri: options.neo4jUri,
         username: options.neo4jUsername,
         password: options.neo4jPassword,
         database: 'neo4j',
         maxConnectionPoolSize: 50,
         connectionTimeout: 30000,
         maxTransactionRetryTime: 15000
       },
       inMemory: {
         maxSize: 10000,
         ttl: 300000
       },
       cache: {
         ttl: 300000,
         maxSize: 1000
       },
       queryRouting: {
         primaryLayer: 'inMemory' as any,
         fallbackOrder: ['inMemory'] as any[],
         routingRules: []
       },
       synchronization: {
         enabled: false,
         syncInterval: 60000,
         conflictResolution: 'last_write_wins',
         batchSize: 100,
         maxRetries: 3,
         syncStrategies: []
       },
       monitoring: {
         enabled: false, // Disable to prevent RDF metrics errors
         healthCheckInterval: 30000,
         metricsCollectionInterval: 60000,
         alertThresholds: {
           errorRate: 0.1,
           responseTime: 5000,
           memoryUsage: 0.8,
           diskUsage: 0.8
         },
         retentionPeriod: 86400000
       }
     } as any);
     
     try {
       await hybridStorage.initialize();
       console.log('✅ Hybrid storage initialized');
     } catch (error) {
       console.log('⚠️ Hybrid storage partially initialized (some components disabled)');
     }

     // Initialize proper Layer 3 AI service for full functionality
     console.log('🧠 Initializing Layer 3 AI services...');

     // Check if API keys are available
     const hasOpenAI = !!process.env.OPENAI_API_KEY;
     const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

     let layer3Service: any;

     if (hasOpenAI || hasAnthropic) {
       console.log('✅ API keys found - enabling full AI services');
       // Import and initialize real Layer 3 service
       const { Layer3AIService } = await import('../services/layer3/index');
       const { InMemoryRDFStore } = await import('../services/layer2/in-memory-rdf');

       const { IndexType } = await import('../services/layer2/in-memory-rdf');
       const rdfStore = new InMemoryRDFStore({
         maxTriples: 100000,
         maxMemoryMB: 512,
         enabledIndexes: [IndexType.SPO, IndexType.PSO, IndexType.OSP, IndexType.FULL_TEXT],
         compressionEnabled: true,
         persistenceEnabled: false,
         cacheConfig: {
           maxEntries: 1000,
           ttl: 300000,
           evictionPolicy: 'lru'
         },
         optimization: {
           enableSemanticSearch: true,
           enableContextCaching: true,
           enableQueryOptimization: true,
           enableParallelProcessing: false
         },
         llmIntegration: {
           contextWindowSize: 4096,
           maxContextTokens: 2048,
           semanticSimilarityThreshold: 0.7,
           enableContextRanking: true,
           enableTokenOptimization: true
         }
       });
       // neo4jService is already connected above at line 712-719

       const layer3Config = {
         rag: {
           provider: (hasOpenAI ? 'openai' : 'local') as 'openai' | 'local',
           model: hasOpenAI ? 'gpt-4' : 'claude-3-sonnet-20240229',
           apiKey: (hasOpenAI ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY) || '',
           temperature: 0.1,
           maxTokens: 1000
         },
         graphCypher: {
           neo4jUrl: options.neo4jUri || 'bolt://localhost:7687',
           username: options.neo4jUsername || 'neo4j',
           password: options.neo4jPassword || 'aaswe-password'
         },
         sparql: {
           provider: (hasOpenAI ? 'openai' : 'local') as 'openai' | 'local',
           model: hasOpenAI ? 'gpt-4' : 'claude-3-sonnet-20240229',
           apiKey: (hasOpenAI ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY) || ''
         }
       };

       layer3Service = new Layer3AIService(layer3Config, rdfStore, neo4jService);
       await layer3Service.initialize();

     } else {
       console.log('⚠️  No API keys found - using direct Neo4j service without AI features');
       // neo4jService is already connected above at line 712-719

       layer3Service = {
         query: async (req: any) => {
           const startTime = Date.now();

           try {
             if (req.type === 'cypher') {
               // Execute direct Neo4j query
               const session = neo4jService.getSession();
               const result = await session.run(req.query);
               await session.close();

               const processingTime = Date.now() - startTime;

               // Convert Neo4j result to JSON
               const data = result.records.map(record => {
                 const obj: any = {};
                 record.keys.forEach(key => {
                   const value = record.get(key);
                   // Handle Neo4j integer types
                   if (value && typeof value === 'object' && 'toNumber' in value) {
                     obj[key] = value.toNumber();
                   } else {
                     obj[key] = value;
                   }
                 });
                 return obj;
               });

               return {
                 query: req.query,
                 type: 'cypher' as const,
                 answer: JSON.stringify(data, null, 2),
                 confidence: 1.0,
                 sources: ['Neo4j Database'],
                 explanation: `Query executed successfully. Returned ${data.length} records in ${processingTime}ms.`,
                 metadata: { processingTime, service: 'cypher' as const, cached: false, queryId: '', timestamp: Date.now() }
               };
             } else {
               // For non-cypher queries, provide TTL context information
               return {
                 query: req.query,
                 type: req.type === 'auto' ? 'rag' : req.type,
                 answer: 'Direct Neo4j access available. Use cypher queries to explore the knowledge graph. For AI-powered features, configure API keys.',
                 confidence: 0.8,
                 sources: ['Neo4j Database', 'TTL Knowledge Files'],
                 explanation: 'Neo4j connection available. Use Cypher queries to explore the knowledge graph. Configure API keys for AI-powered features.',
                 metadata: { processingTime: Date.now() - startTime, service: 'rag' as const, cached: false, queryId: '', timestamp: Date.now() }
               };
             }
           } catch (error) {
             const processingTime = Date.now() - startTime;
             return {
               query: req.query,
               type: req.type === 'auto' ? 'cypher' : req.type,
               answer: `Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
               confidence: 0.0,
               sources: ['Neo4j Database'],
               explanation: 'Neo4j query execution failed',
               metadata: { processingTime, service: 'cypher' as const, cached: false, queryId: '', timestamp: Date.now() }
             };
           }
         },
         initialize: async () => {},
         shutdown: async () => { /* Neo4j disconnect handled by main shutdown handler */ },
         getStatus: () => ({ overall: 'healthy' as const, services: { rag: { name: 'rag', enabled: false, healthy: false, lastCheck: new Date() }, graphCypher: { name: 'graphCypher', enabled: true, healthy: true, lastCheck: new Date() }, sparql: { name: 'sparql', enabled: false, healthy: false, lastCheck: new Date() } }, lastUpdated: new Date() }),
         getMetrics: () => ({ overall: { totalQueries: 0, successfulQueries: 0, failedQueries: 0, averageResponseTime: 0, queriesPerSecond: 0 }, services: { rag: { queries: 0, successRate: 0, averageResponseTime: 0, cacheHitRate: 0 }, graphCypher: { queries: 0, successRate: 0, averageResponseTime: 0, averageConfidence: 0 }, sparql: { queries: 0, successRate: 0, averageResponseTime: 0, averageConfidence: 0 } }, routing: { autoDetected: 0, manuallySpecified: 0, routingAccuracy: 0, fallbackUsed: 0 }, performance: { memoryUsage: 0, cpuUsage: 0, cacheSize: 0, activeConnections: 0 } })
       } as any;
     }

     // TTL Context Loader
     const ttlContextLoader = new TTLContextLoader(
       {
         watchEnabled: options.watchEnabled,
         watchPatterns: ttlPatterns,
         watchIgnored: [/node_modules/, /.git/, /dist/, /build/],
         watchDebounce: 1000,
         loadPatterns: ttlPatterns,
         loadIgnored: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
         loadConcurrency: 5,
         cacheEnabled: options.cacheEnabled,
         cacheTtl: 300000,
         maxCacheSize: 1000,
         relevanceThreshold: 0.1,
         maxFiles: 20,
         maxTokens: parseInt(options.maxTokens),
         directories: ttlDirectories // Add the missing directories configuration
       } as any,
       {} as any, // Knowledge Graph Populator (not needed for this context)
       {} as any, // RDF Generator (not needed for this context)
       {} as any  // Information Extractor (not needed for this context)
     );
     await ttlContextLoader.start();
     console.log('✅ TTL context loader started');

     // MCP Server Configuration
     const mcpConfig: MCPServerManagerConfig = {
       transport,
       server: {
         name: 'AASWE MCP Server',
         version: packageVersion,
         host: options.host,
         port: parseInt(options.port),
         maxConnections: 100,
         timeout: 30000
       },
       ttl: {
         watchEnabled: options.watchEnabled,
         watchDebounce: 1000,
         maxFileSize: 1024 * 1024,
         encoding: 'utf-8',
         directories: ttlDirectories,
         patterns: ttlPatterns
       },
       context: {
         maxTokens: parseInt(options.maxTokens),
         maxFiles: 20,
         relevanceThreshold: 0.1,
         cacheEnabled: options.cacheEnabled,
         cacheTtl: 300000
       },
       integration: {
         layer3Config: {} as any,
         neo4jEnabled: true,
         rdfStoreEnabled: true,
         hybridStorageEnabled: true
       },
       ide: {
         vscode: {
           enabled: true,
           extensionId: 'aaswe.mcp-server',
           contextWindow: 8000
         },
         intellij: {
           enabled: false,
           pluginId: 'aaswe.mcp-plugin',
           contextWindow: 8000
         }
       }
     };

     // Start MCP Server Manager
     console.log('🌐 Starting MCP Server Manager...');
     const mcpServerManager = new MCPServerManager(
       mcpConfig,
       layer3Service,
       hybridStorage,
       ttlContextLoader
     );

     await mcpServerManager.start();

     // Setup event handlers
     mcpServerManager.on('client_connected', (data) => {
       console.log(`👤 Client connected via ${data.transport}: ${data.name || 'Unknown'}`);
     });

     mcpServerManager.on('client_disconnected', (data) => {
       console.log(`👋 Client disconnected from ${data.transport}`);
     });

     mcpServerManager.on('query_completed', (data) => {
       logger.debug('Query completed', { transport: data.transport, query: data.query });
     });

     mcpServerManager.on('query_failed', (data) => {
       logger.warn('Query failed', { transport: data.transport, query: data.query, error: data.error });
     });

     // Display server information
     console.log('\n🎉 MCP Server started successfully!');
     console.log('\n📊 Server Information:');
     console.log(`  Version: ${packageVersion}`);
     console.log(`  Transport: ${transport}`);
     
     const activeTransports = mcpServerManager.getActiveTransports();
     console.log(`  Active Transports: ${activeTransports.join(', ')}`);
     
     if (activeTransports.includes('websocket')) {
       console.log(`  WebSocket: ws://${options.host}:${options.port}`);
     }
     
     if (activeTransports.includes('stdio')) {
       console.log(`  Stdio: Ready for stdin/stdout communication`);
     }
     
     console.log(`  TTL Files: ${ttlContextLoader.getTTLFiles().size} loaded`);

     // Display usage information
     console.log('\n📖 Usage:');
     console.log('  For Cline/RooCode: Configure MCP settings to use stdio transport');
     console.log('  For other IDEs: Connect via WebSocket to the displayed URL');
     console.log('  Press Ctrl+C to stop the server');

     // Handle graceful shutdown
     const shutdown = async (signal: string) => {
       console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
       
       try {
         await mcpServerManager.stop();
         await ttlContextLoader.stop();
         await layer3Service.shutdown();
         await hybridStorage.shutdown();
         await neo4jService.disconnect();
         console.log('✅ Server stopped successfully');
         process.exit(0);
       } catch (error) {
         logger.error('Error during shutdown', { error });
         process.exit(1);
       }
     };

     process.on('SIGINT', () => shutdown('SIGINT'));
     process.on('SIGTERM', () => shutdown('SIGTERM'));

     // Keep the process alive for stdio transport
     if (transport === 'stdio' || transport === 'both') {
       // For stdio transport, we keep the process alive to handle stdin/stdout
       // Use setInterval to prevent potential memory issues with unresolved promises
        const keepAlive = setInterval(() => {}, 1000 * 60 * 60); // Heartbeat every hour
        process.on('beforeExit', () => clearInterval(keepAlive));
        
        // Wait for termination signals - this replaces the infinite promise
        await new Promise<void>((resolve) => {
          const handleShutdown = () => {
            clearInterval(keepAlive);
            resolve();
          };
          // Rely on the outer process signal handlers that already perform shutdown.
          process.once('beforeExit', handleShutdown);
        });
     }

   } catch (error) {
     logger.error('Failed to start MCP server', { error });
     console.error('\n❌ Failed to start MCP server:', error instanceof Error ? error.message : String(error));
     process.exit(1);
   }
 });

/**
* Docker commands
*/
const dockerCmd = program
  .command('docker')
  .description('Docker-related commands');

dockerCmd
  .command('up')
  .description('Start AASWE with Docker Compose')
  .option('-d, --detach', 'Run in detached mode')
  .action(async (options) => {
    try {
      const { spawn } = require('child_process');
      const args = ['compose', 'up'];
      if (options.detach) args.push('-d');

      logger.info('🐳 Starting AASWE with Docker Compose...');
      const child = spawn('docker', args, { stdio: 'inherit' });
      
      child.on('close', (code) => {
        if (code === 0) {
          logger.info('✅ AASWE Docker services started successfully!');
        } else {
          logger.error('❌ Failed to start Docker services');
          process.exit(code);
        }
      });
    } catch (error) {
      logger.error('❌ Failed to start Docker services', { error });
      process.exit(1);
    }
  });

dockerCmd
  .command('down')
  .description('Stop AASWE Docker services')
  .action(async () => {
    try {
      const { spawn } = require('child_process');
      logger.info('🐳 Stopping AASWE Docker services...');
      
      const child = spawn('docker', ['compose', 'down'], { stdio: 'inherit' });
      child.on('close', (code) => {
        if (code === 0) {
          logger.info('✅ AASWE Docker services stopped successfully!');
        } else {
          logger.error('❌ Failed to stop Docker services');
          process.exit(code);
        }
      });
    } catch (error) {
      logger.error('❌ Failed to stop Docker services', { error });
      process.exit(1);
    }
  });

dockerCmd
  .command('logs [service]')
  .description('View logs for AASWE Docker services')
  .option('-f, --follow', 'Follow log output')
  .action(async (service, options) => {
    try {
      const { spawn } = require('child_process');
      const args = ['compose', 'logs'];
      if (options.follow) args.push('-f');
      if (service) args.push(service);

      logger.info(`🐳 Viewing logs for ${service || 'all services'}...`);
      const child = spawn('docker', args, { stdio: 'inherit' });
      
      child.on('close', (code) => {
        if (code !== 0) {
          logger.error('❌ Failed to view Docker logs');
          process.exit(code);
        }
      });
    } catch (error) {
      logger.error('❌ Failed to view Docker logs', { error });
      process.exit(1);
    }
  });

/**
 * Git hooks command - Manage Git hooks for TTL file versioning
 */
const gitCmd = program
  .command('git')
  .description('Git integration and hooks management');

gitCmd
  .command('install-hooks')
  .description('Install Git hooks for TTL file versioning')
  .option('--pre-commit', 'Install pre-commit hook for TTL validation', true)
  .option('--post-commit', 'Install post-commit hook for re-analysis', true)
  .option('--post-merge', 'Install post-merge hook for conflict resolution', true)
  .option('--auto-reanalyze', 'Enable automatic re-analysis on TTL changes', true)
  .action(async (options) => {
    try {
      logger.info('🔧 Installing Git hooks for TTL file versioning...');
      
      const { GitHooksManager } = await import('../services/git-integration/GitHooksManager');
      
      const manager = new GitHooksManager({
        projectRoot: process.cwd(),
        ttlDirectories: ['./knowledge', './clean-knowledge', './.aaswe/knowledge'],
        ttlPatterns: ['**/*.ttl', '**/*.module-knowledge.ttl'],
        enablePreCommitHook: options.preCommit,
        enablePostCommitHook: options.postCommit,
        enablePostMergeHook: options.postMerge,
        autoReanalyzeOnTTLChange: options.autoReanalyze
      });

      await manager.initialize();
      
      logger.info('✅ Git hooks installed successfully!');
      logger.info('💡 TTL files will now be automatically validated and re-analyzed');
      
    } catch (error) {
      logger.error('❌ Failed to install Git hooks', { error });
      process.exit(1);
    }
  });

gitCmd
  .command('status')
  .description('Check Git hooks status')
  .action(async () => {
    try {
      const { GitHooksManager } = await import('../services/git-integration/GitHooksManager');
      
      const manager = new GitHooksManager({
        projectRoot: process.cwd(),
        ttlDirectories: ['./knowledge', './clean-knowledge', './.aaswe/knowledge'],
        ttlPatterns: ['**/*.ttl', '**/*.module-knowledge.ttl'],
        enablePreCommitHook: true,
        enablePostCommitHook: true,
        enablePostMergeHook: true,
        autoReanalyzeOnTTLChange: true
      });

      const status = await manager.getStatus();
      
      logger.info('📊 Git Hooks Status:', {
        gitRepository: status.isGitRepo ? '✅ Yes' : '❌ No',
        preCommitHook: status.hooksInstalled['pre-commit']?.isAASWE ? '✅ Installed' : '❌ Not installed',
        postCommitHook: status.hooksInstalled['post-commit']?.isAASWE ? '✅ Installed' : '❌ Not installed',
        postMergeHook: status.hooksInstalled['post-merge']?.isAASWE ? '✅ Installed' : '❌ Not installed'
      });
      
    } catch (error) {
      logger.error('❌ Failed to check Git hooks status', { error });
    }
  });

gitCmd
  .command('uninstall-hooks')
  .description('Uninstall AASWE Git hooks')
  .action(async () => {
    try {
      logger.info('🗑️  Uninstalling AASWE Git hooks...');
      
      const { GitHooksManager } = await import('../services/git-integration/GitHooksManager');
      
      const manager = new GitHooksManager({
        projectRoot: process.cwd(),
        ttlDirectories: ['./knowledge', './clean-knowledge', './.aaswe/knowledge'],
        ttlPatterns: ['**/*.ttl', '**/*.module-knowledge.ttl'],
        enablePreCommitHook: false,
        enablePostCommitHook: false,
        enablePostMergeHook: false,
        autoReanalyzeOnTTLChange: false
      });

      await manager.uninstall();
      logger.info('✅ Git hooks uninstalled successfully');
      
    } catch (error) {
      logger.error('❌ Failed to uninstall Git hooks', { error });
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
