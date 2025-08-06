"use strict";
/**
 * AIDe Setup Script
 * Handles initial setup and configuration of the AIDe system
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIDeSetup = void 0;
exports.runSetup = runSetup;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const logger_1 = __importDefault(require("./utils/logger"));
const config_1 = require("./config");
class AIDeSetup {
    projectPath;
    options;
    constructor(options = {}) {
        this.projectPath = options.projectPath || process.cwd();
        this.options = options;
        if (options.verbose) {
            logger_1.default.level = 'debug';
        }
    }
    /**
     * Run the complete setup process
     */
    async setup() {
        try {
            logger_1.default.info('🚀 Starting AIDe setup...');
            await this.validateEnvironment();
            await this.createDirectoryStructure();
            await this.generateConfiguration();
            await this.setupGitIntegration();
            await this.setupIDEIntegration();
            await this.validateDockerSetup();
            await this.createExampleFiles();
            logger_1.default.info('✅ AIDe setup completed successfully!');
            this.printNextSteps();
        }
        catch (error) {
            logger_1.default.error('❌ Setup failed:', error);
            throw error;
        }
    }
    /**
     * Validate the environment and prerequisites
     */
    async validateEnvironment() {
        logger_1.default.info('🔍 Validating environment...');
        // Check Node.js version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        if (majorVersion < 18) {
            throw new Error(`Node.js 18+ is required. Current version: ${nodeVersion}`);
        }
        logger_1.default.debug(`✓ Node.js version: ${nodeVersion}`);
        // Check if we're in a Git repository
        try {
            (0, child_process_1.execSync)('git rev-parse --git-dir', { stdio: 'ignore' });
            logger_1.default.debug('✓ Git repository detected');
        }
        catch {
            logger_1.default.warn('⚠️ Not in a Git repository. Some features may be limited.');
        }
        // Check Docker availability (if not skipped)
        if (!this.options.skipDocker) {
            try {
                (0, child_process_1.execSync)('docker --version', { stdio: 'ignore' });
                (0, child_process_1.execSync)('docker-compose --version', { stdio: 'ignore' });
                logger_1.default.debug('✓ Docker and Docker Compose available');
            }
            catch {
                logger_1.default.warn('⚠️ Docker not available. Run with --skip-docker to continue without Docker.');
                throw new Error('Docker is required for AIDe. Install Docker or use --skip-docker flag.');
            }
        }
    }
    /**
     * Create the required directory structure
     */
    async createDirectoryStructure() {
        logger_1.default.info('📁 Creating directory structure...');
        const directories = [
            '.aaswe',
            '.aaswe/config',
            '.aaswe/rdf',
            '.aaswe/logs',
            '.aaswe/cache',
            '.aaswe/temp',
            '.aaswe/backups',
            '.aaswe/examples'
        ];
        for (const dir of directories) {
            const fullPath = (0, path_1.join)(this.projectPath, dir);
            if (!(0, fs_1.existsSync)(fullPath)) {
                (0, fs_1.mkdirSync)(fullPath, { recursive: true });
                logger_1.default.debug(`Created directory: ${dir}`);
            }
        }
        // Create .gitignore entries for AIDe
        await this.updateGitignore();
    }
    /**
     * Generate configuration files
     */
    async generateConfiguration() {
        logger_1.default.info('⚙️ Generating configuration...');
        const config = config_1.configManager.getConfig();
        const configPath = (0, path_1.join)(this.projectPath, '.aaswe', 'config.json');
        (0, fs_1.writeFileSync)(configPath, JSON.stringify(config, null, 2));
        logger_1.default.debug(`Configuration written to: ${configPath}`);
        // Create environment template
        const envTemplate = this.generateEnvTemplate();
        const envPath = (0, path_1.join)(this.projectPath, '.aaswe', '.env.example');
        (0, fs_1.writeFileSync)(envPath, envTemplate);
        logger_1.default.debug(`Environment template created: ${envPath}`);
        // Create local environment file if it doesn't exist
        const localEnvPath = (0, path_1.join)(this.projectPath, '.env');
        if (!(0, fs_1.existsSync)(localEnvPath)) {
            (0, fs_1.writeFileSync)(localEnvPath, envTemplate);
            logger_1.default.debug(`Local environment file created: ${localEnvPath}`);
        }
    }
    /**
     * Setup Git integration
     */
    async setupGitIntegration() {
        if (this.options.skipGitHooks) {
            logger_1.default.info('⏭️ Skipping Git hooks setup');
            return;
        }
        logger_1.default.info('🪝 Setting up Git integration...');
        try {
            const gitHooksDir = (0, path_1.join)(this.projectPath, '.git', 'hooks');
            if (!(0, fs_1.existsSync)(gitHooksDir)) {
                logger_1.default.warn('⚠️ No .git directory found, skipping Git hooks');
                return;
            }
            // Create pre-commit hook
            const preCommitHook = this.generatePreCommitHook();
            const preCommitPath = (0, path_1.join)(gitHooksDir, 'pre-commit');
            (0, fs_1.writeFileSync)(preCommitPath, preCommitHook, { mode: 0o755 });
            // Create post-commit hook
            const postCommitHook = this.generatePostCommitHook();
            const postCommitPath = (0, path_1.join)(gitHooksDir, 'post-commit');
            (0, fs_1.writeFileSync)(postCommitPath, postCommitHook, { mode: 0o755 });
            logger_1.default.debug('✓ Git hooks installed');
        }
        catch (error) {
            logger_1.default.warn('⚠️ Failed to setup Git hooks:', error);
        }
    }
    /**
     * Setup IDE integration
     */
    async setupIDEIntegration() {
        if (this.options.ideIntegration === 'none') {
            logger_1.default.info('⏭️ Skipping IDE integration');
            return;
        }
        logger_1.default.info(`🔧 Setting up ${this.options.ideIntegration || 'VSCode'} integration...`);
        switch (this.options.ideIntegration || 'vscode') {
            case 'vscode':
                await this.setupVSCodeIntegration();
                break;
            case 'intellij':
                await this.setupIntelliJIntegration();
                break;
            case 'vim':
                await this.setupVimIntegration();
                break;
        }
    }
    /**
     * Validate Docker setup
     */
    async validateDockerSetup() {
        if (this.options.skipDocker) {
            logger_1.default.info('⏭️ Skipping Docker validation');
            return;
        }
        logger_1.default.info('🐳 Validating Docker setup...');
        const dockerComposePath = (0, path_1.join)(__dirname, '..', 'docker-compose.local.yml');
        if (!(0, fs_1.existsSync)(dockerComposePath)) {
            throw new Error('Docker Compose file not found');
        }
        try {
            // Validate Docker Compose file
            (0, child_process_1.execSync)(`docker-compose -f ${dockerComposePath} config`, { stdio: 'ignore' });
            logger_1.default.debug('✓ Docker Compose configuration valid');
        }
        catch (error) {
            throw new Error('Invalid Docker Compose configuration');
        }
    }
    /**
     * Create example files
     */
    async createExampleFiles() {
        logger_1.default.info('📝 Creating example files...');
        // Create example RDF file
        const exampleRDF = this.generateExampleRDF();
        const rdfPath = (0, path_1.join)(this.projectPath, '.aaswe', 'examples', 'example.module-knowledge.ttl');
        (0, fs_1.writeFileSync)(rdfPath, exampleRDF);
        // Create example configuration
        const exampleConfig = this.generateExampleConfig();
        const configPath = (0, path_1.join)(this.projectPath, '.aaswe', 'examples', 'config.example.json');
        (0, fs_1.writeFileSync)(configPath, JSON.stringify(exampleConfig, null, 2));
        logger_1.default.debug('✓ Example files created');
    }
    /**
     * Update .gitignore file
     */
    async updateGitignore() {
        const gitignorePath = (0, path_1.join)(this.projectPath, '.gitignore');
        const codeMindEntries = [
            '',
            '# AIDe',
            '.aaswe/logs/',
            '.aaswe/cache/',
            '.aaswe/temp/',
            '.aaswe/backups/',
            '.env.local'
        ].join('\n');
        if ((0, fs_1.existsSync)(gitignorePath)) {
            const content = (0, fs_1.readFileSync)(gitignorePath, 'utf-8');
            if (!content.includes('# AIDe')) {
                (0, fs_1.writeFileSync)(gitignorePath, content + codeMindEntries);
            }
        }
        else {
            (0, fs_1.writeFileSync)(gitignorePath, codeMindEntries);
        }
    }
    /**
     * Generate environment template
     */
    generateEnvTemplate() {
        return `# AIDe Configuration
# Copy this file to .env and update the values

# Project Configuration
PROJECT_NAME=my-aide-project
PROJECT_DESCRIPTION=AI-Assisted Software Engineering Project
MAIN_LANGUAGE=typescript

# Database Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=dev123
REDIS_URL=redis://localhost:6379

# LLM Configuration
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_MODEL=claude-3-sonnet-20240229
DEFAULT_LLM_PROVIDER=openai
LLM_TEMPERATURE=0.1
LLM_MAX_TOKENS=4000

# Analysis Configuration
ANALYSIS_ENABLED=true
ANALYSIS_INCREMENTAL=true
ANALYSIS_EXCLUDE_PATHS=node_modules,dist,build,.git,.aaswe/cache
ANALYSIS_INCLUDE_PATHS=**/*.ts,**/*.js,**/*.py,**/*.java
SUPPORTED_LANGUAGES=typescript,javascript,python,java
COMPLEXITY_THRESHOLD=10

# Integration Configuration
JIRA_ENABLED=false
JIRA_URL=
JIRA_USERNAME=
JIRA_API_TOKEN=
JIRA_PROJECT_KEY=

CONFLUENCE_ENABLED=false
CONFLUENCE_URL=
CONFLUENCE_USERNAME=
CONFLUENCE_API_TOKEN=
CONFLUENCE_SPACE_KEY=

# RDF Configuration
RDF_FORMAT=turtle
RDF_VERSIONING=git-aligned
RDF_STORAGE_PATH=.aaswe/rdf

# MCP Configuration
MCP_PORT=8000
MCP_CONTEXT_SIZE_LIMIT=100000
MCP_RELEVANCE_THRESHOLD=0.7

# Logging
LOG_LEVEL=info
`;
    }
    /**
     * Generate pre-commit hook
     */
    generatePreCommitHook() {
        return `#!/bin/sh
# AIDe pre-commit hook
echo "🔍 AIDe: Analyzing changes..."

# Check if AIDe is available
if command -v aide >/dev/null 2>&1; then
    aide analyze --incremental
else
    echo "⚠️ AIDe CLI not found, skipping analysis"
fi
`;
    }
    /**
     * Generate post-commit hook
     */
    generatePostCommitHook() {
        return `#!/bin/sh
# AIDe post-commit hook
echo "📊 AIDe: Updating knowledge graph..."

# Check if AIDe is available
if command -v aide >/dev/null 2>&1; then
    aide analyze --incremental
else
    echo "⚠️ AIDe CLI not found, skipping analysis"
fi
`;
    }
    /**
     * Setup VSCode integration
     */
    async setupVSCodeIntegration() {
        const vscodeDir = (0, path_1.join)(this.projectPath, '.vscode');
        if (!(0, fs_1.existsSync)(vscodeDir)) {
            (0, fs_1.mkdirSync)(vscodeDir);
        }
        // Create settings.json with MCP configuration
        const settingsPath = (0, path_1.join)(vscodeDir, 'settings.json');
        const settings = {
            "mcp.servers": {
                "aide": {
                    "command": "aide",
                    "args": ["mcp-server"],
                    "env": {}
                }
            }
        };
        (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(settings, null, 2));
        logger_1.default.debug('✓ VSCode settings configured');
    }
    /**
     * Setup IntelliJ integration
     */
    async setupIntelliJIntegration() {
        logger_1.default.debug('IntelliJ integration will be available in future versions');
    }
    /**
     * Setup Vim integration
     */
    async setupVimIntegration() {
        logger_1.default.debug('Vim integration will be available in future versions');
    }
    /**
     * Generate example RDF file
     */
    generateExampleRDF() {
        return `@prefix cm: <http://aide.dev/ontology#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# Example module knowledge for a user authentication module
cm:UserAuthModule a cm:Module ;
    rdfs:label "User Authentication Module" ;
    cm:purpose "Handles user authentication and authorization" ;
    cm:businessContext "Critical security component for user access control" ;
    cm:complexity "high" ;
    cm:maintainer "security-team@company.com" ;
    cm:lastUpdated "2024-01-15"^^xsd:date .

cm:LoginFunction a cm:Function ;
    rdfs:label "User Login Function" ;
    cm:belongsToModule cm:UserAuthModule ;
    cm:purpose "Authenticates user credentials and creates session" ;
    cm:securityLevel "critical" ;
    cm:inputValidation "email and password validation required" .
`;
    }
    /**
     * Generate example configuration
     */
    generateExampleConfig() {
        return {
            project: {
                name: "example-project",
                description: "Example AIDe project configuration",
                mainLanguage: "typescript",
                version: "1.0.0"
            },
            analysis: {
                enabled: true,
                incremental: true,
                excludePaths: ["node_modules", "dist", ".git"],
                includePaths: ["src/**/*.ts", "lib/**/*.js"],
                supportedLanguages: ["typescript", "javascript"],
                complexityThreshold: 15
            },
            rdf: {
                format: "turtle",
                versioning: "git-aligned",
                storagePath: ".aaswe/rdf"
            }
        };
    }
    /**
     * Print next steps for the user
     */
    printNextSteps() {
        logger_1.default.info('\n🎉 Setup complete! Next steps:');
        logger_1.default.info('   1. Review and update .env file with your API keys');
        logger_1.default.info('   2. Run "aide start" to launch the Docker stack');
        logger_1.default.info('   3. Run "aide analyze" to analyze your codebase');
        logger_1.default.info('   4. Check .aaswe/examples/ for sample configurations');
        logger_1.default.info('   5. Your IDE LLM will now have enhanced codebase context!');
        logger_1.default.info('\n📚 Documentation: https://github.com/your-org/aide');
        logger_1.default.info('🐛 Issues: https://github.com/your-org/aide/issues');
    }
}
exports.AIDeSetup = AIDeSetup;
/**
 * Run setup with command line options
 */
async function runSetup(options = {}) {
    const setup = new AIDeSetup(options);
    await setup.setup();
}
exports.default = AIDeSetup;
//# sourceMappingURL=setup.js.map