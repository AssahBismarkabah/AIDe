/**
 * AIDe Setup Script
 * Handles initial setup and configuration of the AIDe system
 */
export interface SetupOptions {
    projectPath?: string;
    skipDocker?: boolean;
    skipGitHooks?: boolean;
    ideIntegration?: 'vscode' | 'intellij' | 'vim' | 'none';
    verbose?: boolean;
}
export declare class AIDeSetup {
    private projectPath;
    private options;
    constructor(options?: SetupOptions);
    /**
     * Run the complete setup process
     */
    setup(): Promise<void>;
    /**
     * Validate the environment and prerequisites
     */
    private validateEnvironment;
    /**
     * Create the required directory structure
     */
    private createDirectoryStructure;
    /**
     * Generate configuration files
     */
    private generateConfiguration;
    /**
     * Setup Git integration
     */
    private setupGitIntegration;
    /**
     * Setup IDE integration
     */
    private setupIDEIntegration;
    /**
     * Validate Docker setup
     */
    private validateDockerSetup;
    /**
     * Create example files
     */
    private createExampleFiles;
    /**
     * Update .gitignore file
     */
    private updateGitignore;
    /**
     * Generate environment template
     */
    private generateEnvTemplate;
    /**
     * Generate pre-commit hook
     */
    private generatePreCommitHook;
    /**
     * Generate post-commit hook
     */
    private generatePostCommitHook;
    /**
     * Setup VSCode integration
     */
    private setupVSCodeIntegration;
    /**
     * Setup IntelliJ integration
     */
    private setupIntelliJIntegration;
    /**
     * Setup Vim integration
     */
    private setupVimIntegration;
    /**
     * Generate example RDF file
     */
    private generateExampleRDF;
    /**
     * Generate example configuration
     */
    private generateExampleConfig;
    /**
     * Print next steps for the user
     */
    private printNextSteps;
}
/**
 * Run setup with command line options
 */
export declare function runSetup(options?: SetupOptions): Promise<void>;
export default AIDeSetup;
//# sourceMappingURL=setup.d.ts.map