import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import logger from '../../utils/logger';

export interface MemoryConfiguration {
  heapSize: string;
  pageCacheSize: string;
  category: string;
  estimatedFiles: number;
}

export class MemoryScalingService {
  private static readonly SOURCE_EXTENSIONS = [
    '.js', '.ts', '.tsx', '.jsx',
    '.java', '.kt', '.scala',
    '.py', '.rb', '.php',
    '.go', '.rs', '.cpp', '.c', '.h', '.hpp',
    '.cs', '.vb', '.swift', '.m', '.mm'
  ];

  private static readonly IGNORE_PATTERNS = [
    'node_modules', '.git', 'build', 'dist', 'target',
    '.gradle', 'vendor', '__pycache__', '.next',
    '.nuxt', 'coverage', '.nyc_output', 'tmp', 'temp'
  ];

  /**
   * Automatically detects codebase size and returns optimal Neo4j memory configuration
   */
  public static async detectOptimalMemoryConfiguration(projectPath: string): Promise<MemoryConfiguration> {
    try {
      logger.info(`🔍 Analyzing project size for memory optimization: ${projectPath}`);
      
      const fileCount = await this.countSourceFiles(projectPath);
      const config = this.getMemoryConfigurationForSize(fileCount);
      
      logger.info(`📊 Project Analysis Complete:`);
      logger.info(`   📁 Source files detected: ${fileCount.toLocaleString()}`);
      logger.info(`   🏷️  Project category: ${config.category}`);
      logger.info(`   💾 Neo4j heap size: ${config.heapSize}`);
      logger.info(`   🗄️  Neo4j page cache: ${config.pageCacheSize}`);
      
      return config;
    } catch (error) {
      logger.error(`❌ Error analyzing project size:`, error);
      // Return safe default configuration
      return {
        heapSize: '2g',
        pageCacheSize: '1g',
        category: 'Default (Error Fallback)',
        estimatedFiles: 0
      };
    }
  }

  /**
   * Recursively counts source code files in project
   */
  private static async countSourceFiles(projectPath: string): Promise<number> {
    let fileCount = 0;
    
    const countFilesRecursive = (dirPath: string): void => {
      try {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = path.join(dirPath, item.name);
          
          // Skip ignored directories
          if (item.isDirectory()) {
            if (!this.shouldIgnoreDirectory(item.name)) {
              countFilesRecursive(fullPath);
            }
          } else if (item.isFile()) {
            // Count source code files
            if (this.isSourceCodeFile(item.name)) {
              fileCount++;
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read (permissions, etc.)
        logger.debug(`Skipping directory due to read error: ${dirPath}`);
      }
    };

    countFilesRecursive(projectPath);
    return fileCount;
  }

  /**
   * Checks if a file is a source code file based on extension
   */
  private static isSourceCodeFile(fileName: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    return this.SOURCE_EXTENSIONS.includes(ext);
  }

  /**
   * Checks if a directory should be ignored during file counting
   */
  private static shouldIgnoreDirectory(dirName: string): boolean {
    return this.IGNORE_PATTERNS.some(pattern => 
      dirName === pattern || dirName.startsWith('.')
    );
  }

  /**
   * Maps file count to appropriate memory configuration
   */
  private static getMemoryConfigurationForSize(fileCount: number): MemoryConfiguration {
    if (fileCount < 500) {
      return {
        heapSize: '1g',
        pageCacheSize: '512m',
        category: 'Micro Project',
        estimatedFiles: fileCount
      };
    } else if (fileCount < 2000) {
      return {
        heapSize: '2g',
        pageCacheSize: '1g',
        category: 'Small Project',
        estimatedFiles: fileCount
      };
    } else if (fileCount < 10000) {
      return {
        heapSize: '4g',
        pageCacheSize: '2g',
        category: 'Medium Project',
        estimatedFiles: fileCount
      };
    } else if (fileCount < 50000) {
      return {
        heapSize: '8g',
        pageCacheSize: '4g',
        category: 'Large Project',
        estimatedFiles: fileCount
      };
    } else if (fileCount < 100000) {
      return {
        heapSize: '12g',
        pageCacheSize: '6g',
        category: 'Enterprise Project',
        estimatedFiles: fileCount
      };
    } else {
      return {
        heapSize: '16g',
        pageCacheSize: '8g',
        category: 'Massive Codebase',
        estimatedFiles: fileCount
      };
    }
  }

  /**
   * Sets environment variables for Docker Compose
   */
  public static setMemoryEnvironmentVariables(config: MemoryConfiguration): void {
    process.env.NEO4J_HEAP_SIZE = config.heapSize;
    process.env.NEO4J_PAGECACHE_SIZE = config.pageCacheSize;
    
    logger.info(`✅ Neo4j memory configuration applied:`);
    logger.info(`   NEO4J_HEAP_SIZE=${config.heapSize}`);
    logger.info(`   NEO4J_PAGECACHE_SIZE=${config.pageCacheSize}`);
  }

  /**
   * Gets current memory configuration from environment or defaults
   */
  public static getCurrentMemoryConfiguration(): {heapSize: string, pageCacheSize: string} {
    return {
      heapSize: process.env.NEO4J_HEAP_SIZE || '2g',
      pageCacheSize: process.env.NEO4J_PAGECACHE_SIZE || '1g'
    };
  }

  /**
   * Validates if system has enough RAM for the configuration
   */
  public static validateSystemMemory(config: MemoryConfiguration): boolean {
    try {
      const totalRAM = os.totalmem();
      const totalGB = Math.round(totalRAM / (1024 * 1024 * 1024));
      
      // Extract numeric value from heap size (e.g., '8g' -> 8)
      const requiredGB = parseInt(config.heapSize.replace('g', ''));
      
      // Neo4j needs heap + pagecache + OS overhead (recommend 25% buffer)
      const totalRequired = requiredGB * 1.5; // 50% overhead for pagecache + OS
      
      if (totalGB < totalRequired) {
        logger.warn(`⚠️  System has ${totalGB}GB RAM, but configuration requires ~${Math.ceil(totalRequired)}GB`);
        logger.warn(`⚠️  Consider upgrading system memory or the system will use swap`);
        return false;
      }
      
      logger.info(`✅ System memory validation passed: ${totalGB}GB available, ${Math.ceil(totalRequired)}GB required`);
      return true;
    } catch (error) {
      logger.debug('Unable to validate system memory, proceeding with configuration');
      return true;
    }
  }

  /**
   * Provides memory scaling recommendations
   */
  public static getScalingRecommendations(fileCount: number): string[] {
    const recommendations: string[] = [];
    
    if (fileCount > 50000) {
      recommendations.push('Consider using incremental analysis for faster processing');
      recommendations.push('Enable Redis caching for improved query performance');
      recommendations.push('Consider running Neo4j on a dedicated server for production');
    }
    
    if (fileCount > 100000) {
      recommendations.push('Use SSD storage for optimal Neo4j performance');
      recommendations.push('Consider Neo4j Enterprise for clustering capabilities');
      recommendations.push('Implement batch processing for initial analysis');
    }
    
    return recommendations;
  }
}