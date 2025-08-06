#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const logger_1 = __importDefault(require("./utils/logger"));
const config_1 = require("./config");
const program = new commander_1.Command();
program
    .name('aide')
    .description('AIDe - AI-Assisted Software Engineering with local Docker stack')
    .version('1.0.0');
program
    .command('init')
    .description('Initialize AIDe in the current project')
    .option('--auto-hooks', 'Install Git hooks automatically', true)
    .option('--no-auto-hooks', 'Skip Git hooks installation')
    .option('--ide <ide>', 'IDE integrations to install (vscode, intellij, vim)', 'vscode')
    .action(async (options) => {
    try {
        logger_1.default.info(' Initializing AIDe in current project...');
        // Create .aaswe directory structure
        const aasweDir = (0, path_1.join)(process.cwd(), '.aaswe');
        const dirs = [
            aasweDir,
            (0, path_1.join)(aasweDir, 'rdf'),
            (0, path_1.join)(aasweDir, 'logs'),
            (0, path_1.join)(aasweDir, 'cache'),
            (0, path_1.join)(aasweDir, 'config')
        ];
        dirs.forEach(dir => {
            if (!(0, fs_1.existsSync)(dir)) {
                (0, fs_1.mkdirSync)(dir, { recursive: true });
                logger_1.default.info(` Created directory: ${dir}`);
            }
        });
        // Generate project configuration
        const config = config_1.configManager.getConfig();
        const configPath = (0, path_1.join)(aasweDir, 'config.json');
        (0, fs_1.writeFileSync)(configPath, JSON.stringify(config, null, 2));
        logger_1.default.info(`Generated configuration: ${configPath}`);
        // Install Git hooks if requested
        if (options.autoHooks) {
            await installGitHooks();
        }
        // Setup IDE integration
        await setupIDEIntegration(options.ide);
        logger_1.default.info('AIDe initialized successfully!');
        logger_1.default.info('Next steps:');
        logger_1.default.info('   1. Run "aide start" to launch the Docker stack');
        logger_1.default.info('   2. Run "aide analyze" to analyze your codebase');
        logger_1.default.info('   3. Your IDE LLM will now have enhanced codebase context!');
    }
    catch (error) {
        logger_1.default.error(' Failed to initialize AIDe:', error);
        process.exit(1);
    }
});
program
    .command('start')
    .description('Start AIDe Docker services')
    .option('--detach', 'Run in detached mode', true)
    .action(async (options) => {
    try {
        logger_1.default.info('🐳Starting AIDe Docker services...');
        const dockerComposeFile = (0, path_1.join)(__dirname, '..', 'docker-compose.local.yml');
        const command = `docker-compose -f ${dockerComposeFile} up ${options.detach ? '-d' : ''}`;
        (0, child_process_1.execSync)(command, { stdio: 'inherit' });
        if (options.detach) {
            logger_1.default.info('AIDe services started in background!');
            logger_1.default.info('Access points:');
            logger_1.default.info('   - Neo4j Browser: http://localhost:7474');
            logger_1.default.info('   - Web Interface: http://localhost:3000');
            logger_1.default.info('   - API Gateway: http://localhost:8080');
            logger_1.default.info('   - MCP Server: http://localhost:8000');
        }
    }
    catch (error) {
        logger_1.default.error(' Failed to start Docker services:', error);
        process.exit(1);
    }
});
program
    .command('stop')
    .description('Stop AIDe Docker services')
    .action(async () => {
    try {
        logger_1.default.info('🛑 Stopping AIDe Docker services...');
        const dockerComposeFile = (0, path_1.join)(__dirname, '..', 'docker-compose.local.yml');
        const command = `docker-compose -f ${dockerComposeFile} down`;
        (0, child_process_1.execSync)(command, { stdio: 'inherit' });
        logger_1.default.info('AIDe services stopped successfully!');
    }
    catch (error) {
        logger_1.default.error('Failed to stop Docker services:', error);
        process.exit(1);
    }
});
program
    .command('status')
    .description('Show status of AIDe Docker services')
    .action(async () => {
    try {
        const dockerComposeFile = (0, path_1.join)(__dirname, '..', 'docker-compose.local.yml');
        const command = `docker-compose -f ${dockerComposeFile} ps`;
        (0, child_process_1.execSync)(command, { stdio: 'inherit' });
    }
    catch (error) {
        logger_1.default.error('Failed to get service status:', error);
        process.exit(1);
    }
});
program
    .command('logs')
    .description('Show logs from AIDe Docker services')
    .option('-f, --follow', 'Follow log output', false)
    .option('-s, --service <service>', 'Show logs for specific service')
    .action(async (options) => {
    try {
        const dockerComposeFile = (0, path_1.join)(__dirname, '..', 'docker-compose.local.yml');
        let command = `docker-compose -f ${dockerComposeFile} logs`;
        if (options.follow)
            command += ' -f';
        if (options.service)
            command += ` ${options.service}`;
        (0, child_process_1.execSync)(command, { stdio: 'inherit' });
    }
    catch (error) {
        logger_1.default.error(' Failed to show logs:', error);
        process.exit(1);
    }
});
program
    .command('analyze')
    .description('Analyze current codebase and generate knowledge graph')
    .option('--incremental', 'Perform incremental analysis', true)
    .option('--full', 'Perform full analysis')
    .action(async (_options) => {
    try {
        logger_1.default.info('🔍 Starting codebase analysis...');
        // This will be implemented in later tasks
        logger_1.default.info(' Analysis functionality will be available after implementing Layer 1 components');
        logger_1.default.info(' For now, the Docker services will handle analysis automatically');
    }
    catch (error) {
        logger_1.default.error('Failed to analyze codebase:', error);
        process.exit(1);
    }
});
async function installGitHooks() {
    try {
        const gitHooksDir = (0, path_1.join)(process.cwd(), '.git', 'hooks');
        if (!(0, fs_1.existsSync)(gitHooksDir)) {
            logger_1.default.warn(' No .git directory found, skipping Git hooks installation');
            return;
        }
        // Create pre-commit hook for automatic analysis
        const preCommitHook = `#!/bin/sh
# AIDe pre-commit hook
echo "🔍 AIDe: Analyzing changes..."
aide analyze --incremental
`;
        const preCommitPath = (0, path_1.join)(gitHooksDir, 'pre-commit');
        (0, fs_1.writeFileSync)(preCommitPath, preCommitHook, { mode: 0o755 });
        logger_1.default.info('🪝 Git hooks installed successfully');
    }
    catch (error) {
        logger_1.default.warn(' Failed to install Git hooks:', error);
    }
}
async function setupIDEIntegration(ide) {
    try {
        logger_1.default.info(` Setting up ${ide} integration...`);
        // This will be implemented in later tasks
        logger_1.default.info(' IDE integration setup will be completed in Layer 5 implementation');
        logger_1.default.info('For now, ensure your IDE supports MCP protocol for enhanced LLM context');
    }
    catch (error) {
        logger_1.default.warn(' Failed to setup IDE integration:', error);
    }
}
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger_1.default.error('Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.default.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
program.parse();
//# sourceMappingURL=cli.js.map