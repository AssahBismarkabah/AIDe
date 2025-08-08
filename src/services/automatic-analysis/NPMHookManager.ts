/**
 * NPM Hook Manager
 * 
 * Manages NPM lifecycle hooks to automatically trigger project analysis
 * when packages are installed or updated.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import logger from '../../utils/logger';

export interface NPMHookConfig {
  enablePostInstall: boolean;
  enablePreInstall: boolean;
  enablePostUpdate: boolean;
  hookScriptPath?: string;
  projectRoot: string;
  analysisDelay: number; // Delay in ms before triggering analysis
}

export interface NPMHookEvent {
  type: 'postinstall' | 'preinstall' | 'postupdate';
  timestamp: Date;
  packageName?: string;
  version?: string;
  projectRoot: string;
  triggeredBy: 'npm' | 'yarn' | 'pnpm' | 'manual';
}

/**
 * NPM Hook Manager
 * 
 * Provides automatic triggering of project analysis when npm packages
 * are installed, updated, or when dependencies change.
 */
export class NPMHookManager extends EventEmitter {
  private config: NPMHookConfig;
  private isInitialized = false;
  private hookScriptContent: string;
  private packageJsonWatcher?: any;

  constructor(config: Partial<NPMHookConfig> = {}) {
    super();
    
    this.config = {
      enablePostInstall: true,
      enablePreInstall: false,
      enablePostUpdate: true,
      projectRoot: process.cwd(),
      analysisDelay: 2000, // 2 second delay to allow npm to finish
      ...config
    };

    this.hookScriptContent = this.generateHookScript();
  }

  /**
   * Initialize NPM hooks
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing NPM Hook Manager', {
        projectRoot: this.config.projectRoot,
        enablePostInstall: this.config.enablePostInstall
      });

      // Ensure project root exists
      await this.validateProjectRoot();

      // Install NPM hooks
      if (this.config.enablePostInstall) {
        await this.installPostInstallHook();
      }

      if (this.config.enablePreInstall) {
        await this.installPreInstallHook();
      }

      if (this.config.enablePostUpdate) {
        await this.installPostUpdateHook();
      }

      // Setup package.json watcher for dependency changes
      await this.setupPackageJsonWatcher();

      this.isInitialized = true;
      logger.info('NPM Hook Manager initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize NPM Hook Manager', { error });
      throw error;
    }
  }

  /**
   * Manually trigger analysis (for testing or manual execution)
   */
  async triggerAnalysis(reason: string = 'manual'): Promise<void> {
    const event: NPMHookEvent = {
      type: 'postinstall',
      timestamp: new Date(),
      projectRoot: this.config.projectRoot,
      triggeredBy: 'manual'
    };

    logger.info('Manually triggering project analysis', { reason, event });
    
    // Add delay to simulate npm completion
    setTimeout(() => {
      this.emit('analysis_triggered', event);
    }, this.config.analysisDelay);
  }

  /**
   * Check if hooks are properly installed
   */
  async validateHooks(): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      const packageJsonPath = path.join(this.config.projectRoot, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);

      // Check postinstall script
      if (this.config.enablePostInstall) {
        const postinstallScript = packageJson.scripts?.postinstall;
        if (!postinstallScript || !postinstallScript.includes('aaswe-analysis')) {
          issues.push('postinstall hook not found or invalid');
        }
      }

      // Check if hook script exists
      const hookScriptPath = this.getHookScriptPath();
      try {
        await fs.access(hookScriptPath);
      } catch {
        issues.push('hook script file not found');
      }

      return {
        isValid: issues.length === 0,
        issues
      };

    } catch (error) {
      issues.push(`validation error: ${error instanceof Error ? error.message : 'unknown'}`);
      return { isValid: false, issues };
    }
  }

  /**
   * Remove installed hooks
   */
  async removeHooks(): Promise<void> {
    try {
      logger.info('Removing NPM hooks');

      // Remove from package.json
      await this.removeFromPackageJson();

      // Remove hook script file
      const hookScriptPath = this.getHookScriptPath();
      try {
        await fs.unlink(hookScriptPath);
        logger.debug('Hook script file removed', { path: hookScriptPath });
      } catch (error) {
        logger.warn('Failed to remove hook script file', { path: hookScriptPath, error });
      }

      // Stop package.json watcher
      if (this.packageJsonWatcher) {
        this.packageJsonWatcher.close();
        this.packageJsonWatcher = undefined;
      }

      this.isInitialized = false;
      logger.info('NPM hooks removed successfully');

    } catch (error) {
      logger.error('Failed to remove NPM hooks', { error });
      throw error;
    }
  }

  /**
   * Get hook installation status
   */
  getStatus(): {
    isInitialized: boolean;
    config: NPMHookConfig;
    hookScriptPath: string;
  } {
    return {
      isInitialized: this.isInitialized,
      config: { ...this.config },
      hookScriptPath: this.getHookScriptPath()
    };
  }

  // Private methods

  private async validateProjectRoot(): Promise<void> {
    try {
      const packageJsonPath = path.join(this.config.projectRoot, 'package.json');
      await fs.access(packageJsonPath);
    } catch {
      throw new Error(`Invalid project root: package.json not found in ${this.config.projectRoot}`);
    }
  }

  private async installPostInstallHook(): Promise<void> {
    logger.debug('Installing postinstall hook');
    
    // Create hook script
    await this.createHookScript();
    
    // Update package.json
    await this.updatePackageJson('postinstall', 'node .aaswe/hooks/postinstall.js');
    
    logger.debug('Postinstall hook installed successfully');
  }

  private async installPreInstallHook(): Promise<void> {
    logger.debug('Installing preinstall hook');
    
    await this.updatePackageJson('preinstall', 'node .aaswe/hooks/preinstall.js');
    
    logger.debug('Preinstall hook installed successfully');
  }

  private async installPostUpdateHook(): Promise<void> {
    logger.debug('Installing postupdate hook');
    
    await this.updatePackageJson('postupdate', 'node .aaswe/hooks/postupdate.js');
    
    logger.debug('Postupdate hook installed successfully');
  }

  private async createHookScript(): Promise<void> {
    const hookScriptPath = this.getHookScriptPath();
    const hookDir = path.dirname(hookScriptPath);
    
    // Ensure directory exists
    await fs.mkdir(hookDir, { recursive: true });
    
    // Write hook script
    await fs.writeFile(hookScriptPath, this.hookScriptContent, 'utf8');
    
    // Make executable (Unix systems)
    if (process.platform !== 'win32') {
      await fs.chmod(hookScriptPath, 0o755);
    }
    
    logger.debug('Hook script created', { path: hookScriptPath });
  }

  private async updatePackageJson(scriptName: string, scriptCommand: string): Promise<void> {
    const packageJsonPath = path.join(this.config.projectRoot, 'package.json');
    
    try {
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      
      // Initialize scripts object if it doesn't exist
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }
      
      // Check if script already exists
      const existingScript = packageJson.scripts[scriptName];
      if (existingScript && existingScript.includes('aaswe-analysis')) {
        logger.debug(`${scriptName} script already exists, skipping`);
        return;
      }
      
      // Add or append to existing script
      if (existingScript) {
        packageJson.scripts[scriptName] = `${existingScript} && ${scriptCommand}`;
      } else {
        packageJson.scripts[scriptName] = scriptCommand;
      }
      
      // Write back to package.json
      await fs.writeFile(
        packageJsonPath, 
        JSON.stringify(packageJson, null, 2) + '\n', 
        'utf8'
      );
      
      logger.debug(`Updated package.json with ${scriptName} script`);
      
    } catch (error) {
      logger.error(`Failed to update package.json with ${scriptName} script`, { error });
      throw error;
    }
  }

  private async removeFromPackageJson(): Promise<void> {
    const packageJsonPath = path.join(this.config.projectRoot, 'package.json');
    
    try {
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      
      if (!packageJson.scripts) {
        return;
      }
      
      // Remove or clean scripts
      const scriptsToClean = ['postinstall', 'preinstall', 'postupdate'];
      
      for (const scriptName of scriptsToClean) {
        const script = packageJson.scripts[scriptName];
        if (script && script.includes('aaswe-analysis')) {
          // Remove the entire script if it only contains our hook
          if (script.trim() === 'node .aaswe/hooks/postinstall.js' || 
              script.trim().startsWith('node .aaswe/hooks/')) {
            delete packageJson.scripts[scriptName];
          } else {
            // Remove our part from the script
            packageJson.scripts[scriptName] = script
              .replace(/\s*&&\s*node \.aaswe\/hooks\/\w+\.js/, '')
              .replace(/node \.aaswe\/hooks\/\w+\.js\s*&&\s*/, '')
              .trim();
          }
        }
      }
      
      // Write back to package.json
      await fs.writeFile(
        packageJsonPath, 
        JSON.stringify(packageJson, null, 2) + '\n', 
        'utf8'
      );
      
      logger.debug('Cleaned package.json scripts');
      
    } catch (error) {
      logger.error('Failed to clean package.json scripts', { error });
      throw error;
    }
  }

  private async setupPackageJsonWatcher(): Promise<void> {
    try {
      const chokidar = await import('chokidar');
      const packageJsonPath = path.join(this.config.projectRoot, 'package.json');
      
      this.packageJsonWatcher = chokidar.watch(packageJsonPath, {
        persistent: false,
        ignoreInitial: true
      });
      
      this.packageJsonWatcher.on('change', () => {
        logger.debug('package.json changed, checking for dependency updates');
        
        const event: NPMHookEvent = {
          type: 'postupdate',
          timestamp: new Date(),
          projectRoot: this.config.projectRoot,
          triggeredBy: 'npm'
        };
        
        // Delay to allow file system to settle
        setTimeout(() => {
          this.emit('analysis_triggered', event);
        }, this.config.analysisDelay);
      });
      
      logger.debug('Package.json watcher setup completed');
      
    } catch (error) {
      logger.warn('Failed to setup package.json watcher', { error });
      // Don't throw - watcher is optional
    }
  }

  private getHookScriptPath(): string {
    if (this.config.hookScriptPath) {
      return this.config.hookScriptPath;
    }
    return path.join(this.config.projectRoot, '.aaswe', 'hooks', 'postinstall.js');
  }

  private generateHookScript(): string {
    return `#!/usr/bin/env node
/**
 * AASWE Automatic Analysis Hook
 * 
 * This script is automatically executed after npm install to trigger
 * project analysis and TTL generation.
 */

const { spawn } = require('child_process');
const path = require('path');

async function triggerAnalysis() {
  console.log('🔍 AASWE: Starting automatic project analysis...');
  
  try {
    // Check if AASWE is available
    const aasweCommand = process.platform === 'win32' ? 'aaswe.cmd' : 'aaswe';
    
    // Trigger analysis with automatic flag
    const analysisProcess = spawn(aasweCommand, ['analyze', '--auto', '--quiet'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    analysisProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ AASWE: Project analysis completed successfully');
      } else {
        console.log('⚠️  AASWE: Project analysis completed with warnings');
      }
    });
    
    analysisProcess.on('error', (error) => {
      console.log('ℹ️  AASWE: Analysis will be available after installation completes');
      console.log('   Run "npx aaswe analyze" manually to generate knowledge files');
    });
    
  } catch (error) {
    console.log('ℹ️  AASWE: Manual analysis available with "npx aaswe analyze"');
  }
}

// Add small delay to ensure npm has finished
setTimeout(triggerAnalysis, 1000);
`;
  }
}