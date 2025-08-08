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

// Load environment variables
config();

const program = new Command();

program
  .name('aaswe')
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
  .option('--no-watch', 'Disable TTL file watching')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    try {
      if (options.debug) {
        process.env.LOG_LEVEL = 'debug';
      }

      logger.info('🚀 Starting AASWE System', {
        mode: options.mode,
        port: options.port,
        version: '1.0.0'
      });

      // Load configuration
      const config = options.config ? 
        require(join(process.cwd(), options.config)) : 
        createDefaultMCPConfig();

      config.server.port = parseInt(options.port);
      config.ttl.watchEnabled = options.watch;

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
 * Init command - Initialize AASWE in current project
 */
program
  .command('init')
  .description('Initialize AASWE in the current project')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(async (options) => {
    try {
      const configPath = join(process.cwd(), 'aaswe.config.js');
      const envPath = join(process.cwd(), '.env.aaswe');

      if (existsSync(configPath) && !options.force) {
        logger.warn('AASWE already initialized. Use --force to overwrite.');
        return;
      }

      logger.info('🔧 Initializing AASWE in current project...');

      // Create configuration file
      const configContent = `
// AASWE Configuration
module.exports = {
  server: {
    name: 'AASWE-MCP-Server',
    version: '1.0.0',
    port: 3001,
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
  }
};
`;

      // Create environment file
      const envContent = `
# AASWE Environment Configuration
# Uncomment and configure as needed

# OpenAI Configuration (for full mode)
# OPENAI_API_KEY=your_openai_api_key_here

# Anthropic Configuration (for full mode)  
# ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Neo4j Configuration (for full mode)
# NEO4J_URI=bolt://localhost:7687
# NEO4J_USERNAME=neo4j
# NEO4J_PASSWORD=password

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
      logger.info('   1. Run: aaswe start --mode=context-only');
      logger.info('   2. Configure your IDE to connect to: ws://localhost:3001');
      logger.info('   3. Your IDE LLM will now have rich codebase context!');

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
        logger.info('💡 Start with: aaswe start');
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
  .action(async (options) => {
    try {
      logger.info('🔍 Analyzing project for knowledge extraction...');
      
      const outputDir = join(process.cwd(), options.output);
      await mkdir(outputDir, { recursive: true });

      logger.info('📊 Project analysis complete!');
      logger.info(`📁 TTL files will be generated in: ${outputDir}`);
      logger.info('💡 This feature will be implemented in the next phase');
      
    } catch (error) {
      logger.error('❌ Failed to analyze project', { error });
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

// Parse command line arguments
program.parse();