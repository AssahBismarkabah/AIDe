/**
 * AIDe Setup Script
 * Handles initial setup and configuration of the AIDe system
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import logger from './utils/logger';
import { configManager } from './config';

export interface SetupOptions {
  projectPath?: string;
  skipDocker?: boolean;
  skipGitHooks?: boolean;
  ideIntegration?: 'vscode' | 'intellij' | 'vim' | 'none';
  verbose?: boolean;
}

export class AIDeSetup {
  private projectPath: string;
  private options: SetupOptions;

  constructor(options: SetupOptions = {}) {
    this.projectPath = options.projectPath || process.cwd();
    this.options = options;
    
    if (options.verbose) {
      logger.level = 'debug';
    }
  }

  /**
   * Run the complete setup process
   */
  async setup(): Promise<void> {
    try {
      logger.info('🚀 Starting AIDe setup...');
      
      await this.validateEnvironment();
      await this.createDirectoryStructure();
      await this.generateConfiguration();
      await this.setupGitIntegration();
      await this.setupIDEIntegration();
      await this.validateDockerSetup();
      await this.createExampleFiles();
      
      logger.info('✅ AIDe setup completed successfully!');
      this.printNextSteps();
      
    } catch (error) {
      logger.error('❌ Setup failed:', error);
      throw error;
    }
  }

  /**
   * Validate the environment and prerequisites
   */
  private async validateEnvironment(): Promise<void> {
    logger.info('🔍 Validating environment...');
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 18) {
      throw new Error(`Node.js 18+ is required. Current version: ${nodeVersion}`);
    }
    logger.debug(`✓ Node.js version: ${nodeVersion}`);
    
    // Check if we're in a Git repository
    try {
      execSync('git rev-parse --git-dir', { stdio: 'ignore' });
      logger.debug('✓ Git repository detected');
    } catch {
      logger.warn('⚠️ Not in a Git repository. Some features may be limited.');
    }
    
    // Check Docker availability (if not skipped)
    if (!this.options.skipDocker) {
      try {
        execSync('docker --version', { stdio: 'ignore' });
        execSync('docker-compose --version', { stdio: 'ignore' });
        logger.debug('✓ Docker and Docker Compose available');
      } catch {
        logger.warn('⚠️ Docker not available. Run with --skip-docker to continue without Docker.');
        throw new Error('Docker is required for AIDe. Install Docker or use --skip-docker flag.');
      }
    }
  }

  /**
   * Create the required directory structure
   */
  private async createDirectoryStructure(): Promise<void> {
    logger.info('📁 Creating directory structure...');
    
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
      const fullPath = join(this.projectPath, dir);
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true });
        logger.debug(`Created directory: ${dir}`);
      }
    }
    
    // Create .gitignore entries for AIDe
    await this.updateGitignore();
  }

  /**
   * Generate configuration files
   */
  private async generateConfiguration(): Promise<void> {
    logger.info('⚙️ Generating configuration...');
    
    const config = configManager.getConfig();
    const configPath = join(this.projectPath, '.aaswe', 'config.json');
    
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    logger.debug(`Configuration written to: ${configPath}`);
    
    // Create environment template
    const envTemplate = this.generateEnvTemplate();
    const envPath = join(this.projectPath, '.aaswe', '.env.example');
    writeFileSync(envPath, envTemplate);
    logger.debug(`Environment template created: ${envPath}`);
    
    // Create local environment file if it doesn't exist
    const localEnvPath = join(this.projectPath, '.env');
    if (!existsSync(localEnvPath)) {
      writeFileSync(localEnvPath, envTemplate);
      logger.debug(`Local environment file created: ${localEnvPath}`);
    }
  }

  /**
   * Setup Git integration
   */
  private async setupGitIntegration(): Promise<void> {
    if (this.options.skipGitHooks) {
      logger.info('⏭️ Skipping Git hooks setup');
      return;
    }
    
    logger.info('🪝 Setting up Git integration...');
    
    try {
      const gitHooksDir = join(this.projectPath, '.git', 'hooks');
      if (!existsSync(gitHooksDir)) {
        logger.warn('⚠️ No .git directory found, skipping Git hooks');
        return;
      }
      
      // Create pre-commit hook
      const preCommitHook = this.generatePreCommitHook();
      const preCommitPath = join(gitHooksDir, 'pre-commit');
      writeFileSync(preCommitPath, preCommitHook, { mode: 0o755 });
      
      // Create post-commit hook
      const postCommitHook = this.generatePostCommitHook();
      const postCommitPath = join(gitHooksDir, 'post-commit');
      writeFileSync(postCommitPath, postCommitHook, { mode: 0o755 });
      
      logger.debug('✓ Git hooks installed');
      
    } catch (error) {
      logger.warn('⚠️ Failed to setup Git hooks:', error);
    }
  }

  /**
   * Setup IDE integration
   */
  private async setupIDEIntegration(): Promise<void> {
    if (this.options.ideIntegration === 'none') {
      logger.info('⏭️ Skipping IDE integration');
      return;
    }
    
    logger.info(`🔧 Setting up ${this.options.ideIntegration || 'VSCode'} integration...`);
    
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
  private async validateDockerSetup(): Promise<void> {
    if (this.options.skipDocker) {
      logger.info('⏭️ Skipping Docker validation');
      return;
    }
    
    logger.info('🐳 Validating Docker setup...');
    
    const dockerComposePath = join(__dirname, '..', 'docker-compose.local.yml');
    if (!existsSync(dockerComposePath)) {
      throw new Error('Docker Compose file not found');
    }
    
    try {
      // Validate Docker Compose file
      execSync(`docker-compose -f ${dockerComposePath} config`, { stdio: 'ignore' });
      logger.debug('✓ Docker Compose configuration valid');
    } catch (error) {
      throw new Error('Invalid Docker Compose configuration');
    }
  }

  /**
   * Create example files
   */
  private async createExampleFiles(): Promise<void> {
    logger.info('📝 Creating example files...');
    
    // Create example RDF file
    const exampleRDF = this.generateExampleRDF();
    const rdfPath = join(this.projectPath, '.aaswe', 'examples', 'example.module-knowledge.ttl');
    writeFileSync(rdfPath, exampleRDF);
    
    // Create example configuration
    const exampleConfig = this.generateExampleConfig();
    const configPath = join(this.projectPath, '.aaswe', 'examples', 'config.example.json');
    writeFileSync(configPath, JSON.stringify(exampleConfig, null, 2));
    
    logger.debug('✓ Example files created');
  }

  /**
   * Update .gitignore file
   */
  private async updateGitignore(): Promise<void> {
    const gitignorePath = join(this.projectPath, '.gitignore');
    const codeMindEntries = [
      '',
      '# AIDe',
      '.aaswe/logs/',
      '.aaswe/cache/',
      '.aaswe/temp/',
      '.aaswe/backups/',
      '.env.local'
    ].join('\n');
    
    if (existsSync(gitignorePath)) {
      const content = readFileSync(gitignorePath, 'utf-8');
      if (!content.includes('# AIDe')) {
        writeFileSync(gitignorePath, content + codeMindEntries);
      }
    } else {
      writeFileSync(gitignorePath, codeMindEntries);
    }
  }

  /**
   * Generate environment template
   */
  private generateEnvTemplate(): string {
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
  private generatePreCommitHook(): string {
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
  private generatePostCommitHook(): string {
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
  private async setupVSCodeIntegration(): Promise<void> {
    const vscodeDir = join(this.projectPath, '.vscode');
    if (!existsSync(vscodeDir)) {
      mkdirSync(vscodeDir);
    }
    
    // Create settings.json with MCP configuration
    const settingsPath = join(vscodeDir, 'settings.json');
    const settings = {
      "mcp.servers": {
        "aide": {
          "command": "aide",
          "args": ["mcp-server"],
          "env": {}
        }
      }
    };
    
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    logger.debug('✓ VSCode settings configured');
  }

  /**
   * Setup IntelliJ integration
   */
  private async setupIntelliJIntegration(): Promise<void> {
    logger.debug('IntelliJ integration will be available in future versions');
  }

  /**
   * Setup Vim integration
   */
  private async setupVimIntegration(): Promise<void> {
    logger.debug('Vim integration will be available in future versions');
  }

  /**
   * Generate example RDF file
   */
  private generateExampleRDF(): string {
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
  private generateExampleConfig(): any {
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
  private printNextSteps(): void {
    logger.info('\n🎉 Setup complete! Next steps:');
    logger.info('   1. Review and update .env file with your API keys');
    logger.info('   2. Run "aide start" to launch the Docker stack');
    logger.info('   3. Run "aide analyze" to analyze your codebase');
    logger.info('   4. Check .aaswe/examples/ for sample configurations');
    logger.info('   5. Your IDE LLM will now have enhanced codebase context!');
    logger.info('\n📚 Documentation: https://github.com/your-org/aide');
    logger.info('🐛 Issues: https://github.com/your-org/aide/issues');
  }
}

/**
 * Run setup with command line options
 */
export async function runSetup(options: SetupOptions = {}): Promise<void> {
  const setup = new AIDeSetup(options);
  await setup.setup();
}

export default AIDeSetup;