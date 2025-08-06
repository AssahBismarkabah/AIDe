"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configManager = void 0;
const dotenv_1 = require("dotenv");
const fs_1 = require("fs");
const path_1 = require("path");
// Load environment variables
(0, dotenv_1.config)();
class ConfigManager {
    static instance;
    config;
    constructor() {
        this.config = this.loadConfiguration();
    }
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    loadConfiguration() {
        // Default configuration
        const defaultConfig = {
            project: {
                name: process.env.PROJECT_NAME || 'aide-project',
                description: process.env.PROJECT_DESCRIPTION || 'AI-Assisted Software Engineering Project',
                mainLanguage: process.env.MAIN_LANGUAGE || 'typescript',
                version: '1.0.0'
            },
            database: {
                neo4j: {
                    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
                    user: process.env.NEO4J_USER || 'neo4j',
                    password: process.env.NEO4J_PASSWORD || 'dev123'
                },
                redis: {
                    url: process.env.REDIS_URL || 'redis://localhost:6379'
                }
            },
            llm: {
                providers: {
                    ...(process.env.OPENAI_API_KEY && {
                        openai: {
                            apiKey: process.env.OPENAI_API_KEY,
                            model: process.env.OPENAI_MODEL || 'gpt-4'
                        }
                    }),
                    ...(process.env.ANTHROPIC_API_KEY && {
                        anthropic: {
                            apiKey: process.env.ANTHROPIC_API_KEY,
                            model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229'
                        }
                    })
                },
                defaultProvider: process.env.DEFAULT_LLM_PROVIDER || 'openai',
                temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.1'),
                maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '4000')
            },
            analysis: {
                enabled: process.env.ANALYSIS_ENABLED !== 'false',
                incremental: process.env.ANALYSIS_INCREMENTAL !== 'false',
                excludePaths: (process.env.ANALYSIS_EXCLUDE_PATHS || 'node_modules,dist,build,.git,.aaswe/cache').split(','),
                includePaths: (process.env.ANALYSIS_INCLUDE_PATHS || '**/*.ts,**/*.js,**/*.py,**/*.java').split(','),
                supportedLanguages: (process.env.SUPPORTED_LANGUAGES || 'typescript,javascript,python,java').split(','),
                complexityThreshold: parseInt(process.env.COMPLEXITY_THRESHOLD || '10')
            },
            integrations: {
                ...(process.env.JIRA_URL && {
                    jira: {
                        enabled: process.env.JIRA_ENABLED === 'true',
                        url: process.env.JIRA_URL,
                        username: process.env.JIRA_USERNAME || '',
                        apiToken: process.env.JIRA_API_TOKEN || '',
                        projectKey: process.env.JIRA_PROJECT_KEY || ''
                    }
                }),
                ...(process.env.CONFLUENCE_URL && {
                    confluence: {
                        enabled: process.env.CONFLUENCE_ENABLED === 'true',
                        url: process.env.CONFLUENCE_URL,
                        username: process.env.CONFLUENCE_USERNAME || '',
                        apiToken: process.env.CONFLUENCE_API_TOKEN || '',
                        spaceKey: process.env.CONFLUENCE_SPACE_KEY || ''
                    }
                })
            },
            rdf: {
                format: process.env.RDF_FORMAT || 'turtle',
                versioning: process.env.RDF_VERSIONING || 'git-aligned',
                storagePath: process.env.RDF_STORAGE_PATH || '.aaswe/rdf'
            },
            mcp: {
                port: parseInt(process.env.MCP_PORT || '8000'),
                contextSizeLimit: parseInt(process.env.MCP_CONTEXT_SIZE_LIMIT || '100000'),
                relevanceThreshold: parseFloat(process.env.MCP_RELEVANCE_THRESHOLD || '0.7')
            }
        };
        // Try to load project-specific configuration
        const configPath = (0, path_1.join)(process.cwd(), '.aaswe', 'config.json');
        if ((0, fs_1.existsSync)(configPath)) {
            try {
                const projectConfig = JSON.parse((0, fs_1.readFileSync)(configPath, 'utf-8'));
                return this.mergeConfigs(defaultConfig, projectConfig);
            }
            catch (error) {
                console.warn(`Failed to load project configuration from ${configPath}:`, error);
            }
        }
        return defaultConfig;
    }
    mergeConfigs(defaultConfig, projectConfig) {
        return {
            project: { ...defaultConfig.project, ...projectConfig.project },
            database: {
                neo4j: { ...defaultConfig.database.neo4j, ...projectConfig.database?.neo4j },
                redis: { ...defaultConfig.database.redis, ...projectConfig.database?.redis }
            },
            llm: {
                providers: { ...defaultConfig.llm.providers, ...projectConfig.llm?.providers },
                defaultProvider: projectConfig.llm?.defaultProvider || defaultConfig.llm.defaultProvider,
                temperature: projectConfig.llm?.temperature ?? defaultConfig.llm.temperature,
                maxTokens: projectConfig.llm?.maxTokens ?? defaultConfig.llm.maxTokens
            },
            analysis: { ...defaultConfig.analysis, ...projectConfig.analysis },
            integrations: {
                ...(defaultConfig.integrations.jira && {
                    jira: { ...defaultConfig.integrations.jira, ...projectConfig.integrations?.jira }
                }),
                ...(defaultConfig.integrations.confluence && {
                    confluence: { ...defaultConfig.integrations.confluence, ...projectConfig.integrations?.confluence }
                }),
                ...(projectConfig.integrations?.jira && !defaultConfig.integrations.jira && {
                    jira: projectConfig.integrations.jira
                }),
                ...(projectConfig.integrations?.confluence && !defaultConfig.integrations.confluence && {
                    confluence: projectConfig.integrations.confluence
                })
            },
            rdf: { ...defaultConfig.rdf, ...projectConfig.rdf },
            mcp: { ...defaultConfig.mcp, ...projectConfig.mcp }
        };
    }
    getConfig() {
        return this.config;
    }
    updateConfig(updates) {
        this.config = this.mergeConfigs(this.config, updates);
    }
    getDatabaseConfig() {
        return this.config.database;
    }
    getLLMConfig() {
        return this.config.llm;
    }
    getAnalysisConfig() {
        return this.config.analysis;
    }
    getMCPConfig() {
        return this.config.mcp;
    }
    getRDFConfig() {
        return this.config.rdf;
    }
}
// Export singleton instance
exports.configManager = ConfigManager.getInstance();
exports.default = exports.configManager;
//# sourceMappingURL=index.js.map