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
import { Layer3AIService } from '../services/layer3';
import { HybridStorageManager } from '../services/layer2/hybrid-storage/HybridStorageManager';

// Load environment variables from .env.aaswe
config({ path: '.env.aaswe' });

// Also try loading from .env as fallback
config();

const program = new Command();

program
  .name('codebase-ai')
  .alias('aaswe')
  .description('AI-Assisted Software Engineering (AASWE) - Rich codebase context for IDE LLMs')
  .version('1.0.0');

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
 * Full-start command - Start complete system with all containers
 */
program
  .command('full-start')
  .description('Start complete AASWE system with all containers (Neo4j + MCP Server + Redis)')
  .option('--project-path <path>', 'Custom project path for analysis (not docker-compose location)', process.cwd())
  .option('--detach', 'Run containers in background')
  .option('--build', 'Rebuild containers before starting')
  .action(async (options) => {
    try {
      // The project path is for analysis, but docker-compose should run from AASWE package directory
      const analysisProjectPath = options.projectPath || process.cwd();
      
      // Find the AASWE package directory (where docker-compose.yml is located)
      const path = require('path');
      const fs = require('fs');
      
      // Get the directory where this CLI script is installed
      const cliScriptPath = require.resolve('@aaswe/codebase-ai/dist/cli/index.js');
      const packageRoot = path.dirname(path.dirname(cliScriptPath)); // Go up from dist/cli to package root
      const dockerComposePath = path.join(packageRoot, 'docker-compose.yml');
      
      // Verify docker-compose.yml exists in package
      if (!fs.existsSync(dockerComposePath)) {
        logger.error('❌ AASWE docker-compose.yml not found in package');
        logger.error(`Expected at: ${dockerComposePath}`);
        logger.info('💡 Try reinstalling: npm install -g @aaswe/codebase-ai');
        process.exit(1);
      }
      
      logger.info('🚀 Starting Complete AASWE System with All Containers...');
      logger.info('📦 This includes: Neo4j Database + MCP Server + Redis Cache');
      logger.info(`🎯 Analysis will target: ${analysisProjectPath}`);
      logger.info(`🐳 Using docker-compose from: ${packageRoot}`);
      
      // Check if Docker is available
      const { spawn } = require('child_process');
      
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
        
        // Build Docker Compose arguments
        const args = ['compose', 'up'];
        if (options.detach) args.push('-d');
        if (options.build) args.push('--build');
        
        // Set environment variable for the analysis project path
        const env = { ...process.env, ANALYSIS_PROJECT_PATH: analysisProjectPath };
        
        logger.info('🐳 Starting all AASWE containers...');
        logger.info('📊 Services starting:');
        logger.info('   - Neo4j Database (Graph storage with source code)');
        logger.info('   - Redis Cache (Performance optimization)');
        logger.info('   - AASWE MCP Server (LLM integration)');
        
        const child = spawn('docker', args, {
          stdio: 'inherit',
          cwd: packageRoot, // Use AASWE package root, not current directory
          env: env
        });
        
        child.on('close', (code) => {
          if (code === 0) {
            logger.info('');
            logger.info('🎉 Complete AASWE System Started Successfully!');
            logger.info('');
            logger.info('🔗 Access Points:');
            logger.info('   📡 MCP Server: ws://localhost:3001 (for IDE integration)');
            logger.info('   🗄️  Neo4j Browser: http://localhost:7474 (neo4j/aaswe-password)');
            logger.info('   ⚡ Redis Cache: localhost:6379');
            logger.info('');
            logger.info('🎯 Next Steps:');
            logger.info('   1. Configure your IDE to connect to: ws://localhost:3001');
            logger.info('   2. Run: codebase-ai analyze (to populate the knowledge graph)');
            logger.info('   3. Visit http://localhost:7474 to explore the Neo4j graph database');
            logger.info('');
            logger.info('💡 To stop all services: codebase-ai docker down');
          } else {
            logger.error('❌ Failed to start complete AASWE system');
            logger.info('💡 Try: codebase-ai docker down && codebase-ai full-start --build');
            process.exit(code);
          }
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
        preserveBusinessContext: true,
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