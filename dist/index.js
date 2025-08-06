"use strict";
/**
 * AIDe - AI-Assisted Software Engineering System
 * Main application entry point for programmatic usage
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.configManager = exports.AIDe = void 0;
exports.createAIDe = createAIDe;
const events_1 = require("events");
const logger_1 = __importDefault(require("./utils/logger"));
const config_1 = require("./config");
/**
 * Main AIDe class for programmatic usage
 */
class AIDe extends events_1.EventEmitter {
    config;
    projectPath;
    isInitialized = false;
    services = new Map();
    constructor(options = {}) {
        super();
        this.projectPath = options.projectPath || process.cwd();
        this.config = config_1.configManager.getConfig();
        // Override config with provided options
        if (options.config) {
            this.config = { ...this.config, ...options.config };
        }
        // Set log level if provided
        if (options.logLevel) {
            logger_1.default.level = options.logLevel;
        }
        logger_1.default.info('AIDe instance created', { projectPath: this.projectPath });
        // Auto-start if requested
        if (options.autoStart) {
            this.initialize().catch(error => {
                logger_1.default.error('Failed to auto-start AIDe:', error);
                this.emit('error', error);
            });
        }
    }
    /**
     * Initialize AIDe for the current project
     */
    async initialize() {
        try {
            logger_1.default.info('Initializing AIDe...');
            // Validate project structure
            await this.validateProject();
            // Setup project directories
            await this.setupDirectories();
            // Initialize configuration
            await this.initializeConfig();
            this.isInitialized = true;
            logger_1.default.info('AIDe initialized successfully');
            this.emit('initialized');
        }
        catch (error) {
            logger_1.default.error('Failed to initialize AIDe:', error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Start all AIDe services
     */
    async start() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            logger_1.default.info('Starting AIDe services...');
            this.emit('starting');
            // This will be implemented when Docker services are ready
            // For now, we'll simulate the startup process
            const serviceNames = [
                'neo4j',
                'redis',
                'code-ingestion',
                'ast-analyzer',
                'rdf-generator',
                'llm-gateway',
                'langchain-rag',
                'code-assistant',
                'mcp-server',
                'api-gateway',
                'web-interface'
            ];
            for (const serviceName of serviceNames) {
                this.services.set(serviceName, {
                    name: serviceName,
                    status: 'starting',
                    health: 'unknown',
                    lastCheck: new Date()
                });
            }
            // Simulate startup delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Mark services as running (this will be replaced with actual Docker checks)
            for (const [name, status] of this.services) {
                this.services.set(name, {
                    ...status,
                    status: 'running',
                    health: 'healthy',
                    uptime: 0,
                    lastCheck: new Date()
                });
            }
            logger_1.default.info('All AIDe services started successfully');
            this.emit('started');
        }
        catch (error) {
            logger_1.default.error('Failed to start AIDe services:', error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Stop all AIDe services
     */
    async stop() {
        try {
            logger_1.default.info('Stopping AIDe services...');
            this.emit('stopping');
            // Update service statuses
            for (const [name, status] of this.services) {
                this.services.set(name, {
                    ...status,
                    status: 'stopping'
                });
            }
            // Simulate shutdown delay
            await new Promise(resolve => setTimeout(resolve, 500));
            // Mark services as stopped
            for (const [name, status] of this.services) {
                this.services.set(name, {
                    ...status,
                    status: 'stopped',
                    health: 'unknown',
                    lastCheck: new Date()
                });
            }
            logger_1.default.info('All AIDe services stopped');
            this.emit('stopped');
        }
        catch (error) {
            logger_1.default.error('Failed to stop AIDe services:', error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Analyze the current codebase
     */
    async analyze(options = {}) {
        if (!this.isInitialized) {
            throw new Error('AIDe must be initialized before analysis');
        }
        try {
            logger_1.default.info('Starting codebase analysis...', options);
            this.emit('analysisStarted', options);
            // This will be implemented in Layer 1 tasks
            // For now, return a mock result
            const result = {
                success: true,
                timestamp: new Date(),
                filesAnalyzed: 0,
                nodesCreated: 0,
                relationshipsCreated: 0
            };
            logger_1.default.info('Analysis completed', result);
            this.emit('analysisCompleted', result);
            return result;
        }
        catch (error) {
            logger_1.default.error('Analysis failed:', error);
            const result = {
                success: false,
                timestamp: new Date(),
                filesAnalyzed: 0,
                nodesCreated: 0,
                relationshipsCreated: 0,
                errors: [error instanceof Error ? error.message : String(error)]
            };
            this.emit('analysisError', error);
            return result;
        }
    }
    /**
     * Get status of all services
     */
    getServiceStatus() {
        return Array.from(this.services.values());
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update configuration
     */
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        logger_1.default.info('Configuration updated');
        this.emit('configUpdated', this.config);
    }
    async validateProject() {
        // Basic project validation
        logger_1.default.debug('Validating project structure...');
        // This will be expanded in later implementations
    }
    async setupDirectories() {
        // Setup required directories
        logger_1.default.debug('Setting up project directories...');
        // This will be implemented to create .aaswe directory structure
    }
    async initializeConfig() {
        // Initialize configuration files
        logger_1.default.debug('Initializing configuration...');
        // This will be implemented to create config files
    }
}
exports.AIDe = AIDe;
/**
 * Factory function to create a AIDe instance
 */
function createAIDe(options) {
    return new AIDe(options);
}
/**
 * Default export for convenience
 */
exports.default = AIDe;
var config_2 = require("./config");
Object.defineProperty(exports, "configManager", { enumerable: true, get: function () { return config_2.configManager; } });
var logger_2 = require("./utils/logger");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return __importDefault(logger_2).default; } });
//# sourceMappingURL=index.js.map