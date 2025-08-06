import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load environment variables
config();

export interface DatabaseConfig {
  neo4j: {
    uri: string;
    user: string;
    password: string;
  };
  redis: {
    url: string;
  };
}

export interface LLMConfig {
  providers: {
    openai?: {
      apiKey: string;
      model: string;
    };
    anthropic?: {
      apiKey: string;
      model: string;
    };
  };
  defaultProvider: 'openai' | 'anthropic';
  temperature: number;
  maxTokens: number;
}

export interface AnalysisConfig {
  enabled: boolean;
  incremental: boolean;
  excludePaths: string[];
  includePaths: string[];
  supportedLanguages: string[];
  complexityThreshold: number;
}

export interface IntegrationConfig {
  jira?: {
    enabled: boolean;
    url: string;
    username: string;
    apiToken: string;
    projectKey: string;
  };
  confluence?: {
    enabled: boolean;
    url: string;
    username: string;
    apiToken: string;
    spaceKey: string;
  };
}

export interface Config {
  project: {
    name: string;
    description: string;
    mainLanguage: string;
    version: string;
  };
  database: DatabaseConfig;
  llm: LLMConfig;
  analysis: AnalysisConfig;
  integrations: IntegrationConfig;
  rdf: {
    format: 'turtle' | 'rdf-xml' | 'n3';
    versioning: 'git-aligned' | 'timestamp';
    storagePath: string;
  };
  mcp: {
    port: number;
    contextSizeLimit: number;
    relevanceThreshold: number;
  };
}

class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfiguration(): Config {
    // Default configuration
    const defaultConfig: Config = {
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
        defaultProvider: (process.env.DEFAULT_LLM_PROVIDER as 'openai' | 'anthropic') || 'openai',
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
        format: (process.env.RDF_FORMAT as 'turtle' | 'rdf-xml' | 'n3') || 'turtle',
        versioning: (process.env.RDF_VERSIONING as 'git-aligned' | 'timestamp') || 'git-aligned',
        storagePath: process.env.RDF_STORAGE_PATH || '.aaswe/rdf'
      },
      mcp: {
        port: parseInt(process.env.MCP_PORT || '8000'),
        contextSizeLimit: parseInt(process.env.MCP_CONTEXT_SIZE_LIMIT || '100000'),
        relevanceThreshold: parseFloat(process.env.MCP_RELEVANCE_THRESHOLD || '0.7')
      }
    };

    // Try to load project-specific configuration
    const configPath = join(process.cwd(), '.aaswe', 'config.json');
    if (existsSync(configPath)) {
      try {
        const projectConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
        return this.mergeConfigs(defaultConfig, projectConfig);
      } catch (error) {
        console.warn(`Failed to load project configuration from ${configPath}:`, error);
      }
    }

    return defaultConfig;
  }

  private mergeConfigs(defaultConfig: Config, projectConfig: Partial<Config>): Config {
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

  public getConfig(): Config {
    return this.config;
  }

  public updateConfig(updates: Partial<Config>): void {
    this.config = this.mergeConfigs(this.config, updates);
  }

  public getDatabaseConfig(): DatabaseConfig {
    return this.config.database;
  }

  public getLLMConfig(): LLMConfig {
    return this.config.llm;
  }

  public getAnalysisConfig(): AnalysisConfig {
    return this.config.analysis;
  }

  public getMCPConfig() {
    return this.config.mcp;
  }

  public getRDFConfig() {
    return this.config.rdf;
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();
export default configManager;