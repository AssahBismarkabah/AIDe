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
declare class ConfigManager {
    private static instance;
    private config;
    private constructor();
    static getInstance(): ConfigManager;
    private loadConfiguration;
    private mergeConfigs;
    getConfig(): Config;
    updateConfig(updates: Partial<Config>): void;
    getDatabaseConfig(): DatabaseConfig;
    getLLMConfig(): LLMConfig;
    getAnalysisConfig(): AnalysisConfig;
    getMCPConfig(): {
        port: number;
        contextSizeLimit: number;
        relevanceThreshold: number;
    };
    getRDFConfig(): {
        format: "turtle" | "rdf-xml" | "n3";
        versioning: "git-aligned" | "timestamp";
        storagePath: string;
    };
}
export declare const configManager: ConfigManager;
export default configManager;
//# sourceMappingURL=index.d.ts.map