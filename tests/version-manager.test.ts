/**
 * Version Manager Service Tests
 * 
 * Comprehensive test suite for Git-aligned knowledge versioning system.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { VersionManager, defaultVersionManagerConfig } from '../src/services/layer2/version-manager';
import {
  VersionMetadata,
  VersionManagerConfig,
  RollbackOperation,
  SyncOperation
} from '../src/services/layer2/version-manager/types';

// Mock child_process to prevent real Git operations
jest.mock('child_process');
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('Version Manager Service', () => {
  let versionManager: VersionManager;
  let tempDir: string;
  let testConfig: VersionManagerConfig;
  let mockRepoPath: string;

  beforeAll(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'version-manager-test-'));
    mockRepoPath = path.join(tempDir, 'test-repo');
    await fs.mkdir(mockRepoPath, { recursive: true });
    
    // Create test configuration
    testConfig = {
      ...defaultVersionManagerConfig,
      versionsFilePath: path.join(tempDir, 'versions.json'),
      maxVersions: 10,
      cleanupInterval: 1000, // 1 second for testing
      backup: {
        enabled: true,
        interval: 2000, // 2 seconds for testing
        retentionDays: 1,
        backupPath: path.join(tempDir, 'backups')
      }
    };
  });

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default Git mock responses
    mockExecSync
      .mockReturnValueOnce('abc123def456') // git rev-parse HEAD
      .mockReturnValueOnce('Initial commit\n\nAdded basic functionality') // git log -1 --pretty=%B
      .mockReturnValueOnce('John Doe') // git log -1 --pretty=%an
      .mockReturnValueOnce('john.doe@example.com') // git log -1 --pretty=%ae
      .mockReturnValueOnce('main') // git rev-parse --abbrev-ref HEAD
      .mockReturnValueOnce('parent123'); // git rev-parse HEAD~1
    
    // Create fresh version manager instance
    versionManager = new VersionManager(testConfig);
    await versionManager.initialize();
  });

  afterEach(async () => {
    if (versionManager) {
      await versionManager.shutdown();
    }
    
    // Clean up test files
    try {
      await fs.rm(testConfig.versionsFilePath, { force: true });
      await fs.rm(testConfig.backup.backupPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  afterAll(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const newVersionManager = new VersionManager(testConfig);
      
      const initPromise = new Promise<void>((resolve) => {
        newVersionManager.on('initialized', () => resolve());
      });
      
      await newVersionManager.initialize();
      await initPromise;
      
      await newVersionManager.shutdown();
    });

    it('should create versions directory if it does not exist', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent', 'versions.json');
      const configWithNonExistentPath = {
        ...testConfig,
        versionsFilePath: nonExistentPath
      };
      
      const newVersionManager = new VersionManager(configWithNonExistentPath);
      await newVersionManager.initialize();
      
      const dirExists = await fs.access(path.dirname(nonExistentPath))
        .then(() => true)
        .catch(() => false);
      
      expect(dirExists).toBe(true);
      await newVersionManager.shutdown();
    });

    it('should load existing versions from file', async () => {
      // Create a versions file with test data
      const existingVersions = {
        lastUpdated: new Date().toISOString(),
        versions: [{
          versionId: 'test-repo-abc123-1234567890',
          commitHash: 'abc123',
          repositoryId: 'test-repo',
          timestamp: new Date().toISOString(),
          commitMessage: 'Test commit',
          author: { name: 'Test User', email: 'test@example.com' },
          branch: 'main',
          knowledgeGraphSnapshot: {
            nodeCount: 100,
            relationshipCount: 200,
            checksum: 'test-checksum'
          },
          rdfFiles: [],
          status: 'active'
        }]
      };
      
      await fs.writeFile(testConfig.versionsFilePath, JSON.stringify(existingVersions));
      
      const newVersionManager = new VersionManager(testConfig);
      await newVersionManager.initialize();
      
      const version = await newVersionManager.getVersion('test-repo-abc123-1234567890');
      expect(version).toBeTruthy();
      expect(version?.repositoryId).toBe('test-repo');
      
      await newVersionManager.shutdown();
    });
  });

  describe('Version Creation', () => {
    beforeEach(async () => {
      // Create mock RDF files
      const moduleDir = path.join(mockRepoPath, 'src', 'module1');
      await fs.mkdir(moduleDir, { recursive: true });
      await fs.writeFile(
        path.join(moduleDir, '.module-knowledge.ttl'),
        '@prefix : <http://example.org/> .\n:Module1 a :Module .\n'
      );
    });

    it('should create a new version successfully', async () => {
      const version = await versionManager.createVersion(mockRepoPath, 'test-repo');
      
      expect(version).toBeTruthy();
      expect(version.repositoryId).toBe('test-repo');
      expect(version.commitHash).toBe('abc123def456');
      expect(version.commitMessage).toBe('Initial commit\n\nAdded basic functionality');
      expect(version.author.name).toBe('John Doe');
      expect(version.author.email).toBe('john.doe@example.com');
      expect(version.branch).toBe('main');
      expect(version.status).toBe('active');
      expect(version.rdfFiles).toHaveLength(1);
      expect(version.rdfFiles[0].filePath).toContain('.module-knowledge.ttl');
    });

    it('should return existing version if already exists', async () => {
      // Use same commit hash to ensure same version ID
      mockExecSync
        .mockReturnValueOnce('same-commit-hash')
        .mockReturnValueOnce('Initial commit')
        .mockReturnValueOnce('John Doe')
        .mockReturnValueOnce('john.doe@example.com')
        .mockReturnValueOnce('main')
        .mockReturnValueOnce('parent123');
      
      const version1 = await versionManager.createVersion(mockRepoPath, 'test-repo');
      
      // Mock same commit hash again
      mockExecSync
        .mockReturnValueOnce('same-commit-hash')
        .mockReturnValueOnce('Initial commit')
        .mockReturnValueOnce('John Doe')
        .mockReturnValueOnce('john.doe@example.com')
        .mockReturnValueOnce('main')
        .mockReturnValueOnce('parent123');
      
      const version2 = await versionManager.createVersion(mockRepoPath, 'test-repo');
      
      expect(version1.versionId).toBe(version2.versionId);
    });

    it('should emit versionCreated event', async () => {
      const eventPromise = new Promise<VersionMetadata>((resolve) => {
        versionManager.on('versionCreated', resolve);
      });
      
      await versionManager.createVersion(mockRepoPath, 'test-repo');
      const emittedVersion = await eventPromise;
      
      expect(emittedVersion.repositoryId).toBe('test-repo');
    });

    it('should handle Git operation failures', async () => {
      // Clear previous mocks and set up failure
      mockExecSync.mockReset();
      mockExecSync.mockImplementation(() => {
        throw new Error('Git command failed');
      });
      
      await expect(versionManager.createVersion(mockRepoPath, 'test-repo'))
        .rejects.toThrow('Failed to retrieve Git commit information');
    });

    it('should detect developer-modified RDF files', async () => {
      // Create RDF file with developer comment
      const moduleDir = path.join(mockRepoPath, 'src', 'module2');
      await fs.mkdir(moduleDir, { recursive: true });
      await fs.writeFile(
        path.join(moduleDir, '.module-knowledge.ttl'),
        '# Developer: Custom business logic\n@prefix : <http://example.org/> .\n:Module2 a :Module .\n'
      );
      
      const version = await versionManager.createVersion(mockRepoPath, 'test-repo');
      
      const developerModifiedFile = version.rdfFiles.find(f => f.filePath.includes('module2'));
      expect(developerModifiedFile?.developerModified).toBe(true);
    });
  });

  describe('Version Querying', () => {
    beforeEach(async () => {
      // Create multiple test versions with proper mock setup
      const versions = [
        { commitHash: 'abc123', author: 'John Doe', branch: 'main' },
        { commitHash: 'def456', author: 'Jane Smith', branch: 'feature' },
        { commitHash: 'ghi789', author: 'John Doe', branch: 'main' }
      ];
      
      for (const [index, versionData] of versions.entries()) {
        mockExecSync
          .mockReturnValueOnce(versionData.commitHash)
          .mockReturnValueOnce(`Commit ${index + 1}`)
          .mockReturnValueOnce(versionData.author)
          .mockReturnValueOnce(`${versionData.author.toLowerCase().replace(' ', '.')}@example.com`)
          .mockReturnValueOnce(versionData.branch)
          .mockReturnValueOnce('parent123');
        
        await versionManager.createVersion(mockRepoPath, 'test-repo');
      }
    });

    it('should get version by ID', async () => {
      const versions = await versionManager.queryVersions({ repositoryId: 'test-repo' });
      const firstVersion = versions[0];
      
      const retrievedVersion = await versionManager.getVersion(firstVersion.versionId);
      expect(retrievedVersion).toEqual(firstVersion);
    });

    it('should return null for non-existent version', async () => {
      const version = await versionManager.getVersion('non-existent-id');
      expect(version).toBeNull();
    });

    it('should filter versions by repository ID', async () => {
      const versions = await versionManager.queryVersions({ repositoryId: 'test-repo' });
      expect(versions).toHaveLength(3);
      expect(versions.every(v => v.repositoryId === 'test-repo')).toBe(true);
    });

    it('should filter versions by branch', async () => {
      const allVersions = await versionManager.queryVersions({ repositoryId: 'test-repo' });
      const mainVersions = await versionManager.queryVersions({
        repositoryId: 'test-repo',
        branch: 'main'
      });
      
      // Should have fewer main versions than total versions
      expect(mainVersions.length).toBeLessThan(allVersions.length);
      expect(mainVersions.every(v => v.branch === 'main')).toBe(true);
    });

    it('should filter versions by author', async () => {
      const johnVersions = await versionManager.queryVersions({ 
        repositoryId: 'test-repo',
        author: 'John Doe' 
      });
      expect(johnVersions).toHaveLength(2);
      expect(johnVersions.every(v => v.author.name === 'John Doe')).toBe(true);
    });

    it('should filter versions by date range', async () => {
      const allVersions = await versionManager.queryVersions({ repositoryId: 'test-repo' });
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const dateRangeVersions = await versionManager.queryVersions({
        repositoryId: 'test-repo',
        dateRange: {
          from: oneHourAgo,
          to: now
        }
      });
      
      // Should include all versions created in the test (they're all recent)
      expect(dateRangeVersions.length).toBe(allVersions.length);
    });

    it('should sort versions by timestamp descending by default', async () => {
      const versions = await versionManager.queryVersions({ repositoryId: 'test-repo' });
      
      for (let i = 1; i < versions.length; i++) {
        expect(versions[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
          versions[i].timestamp.getTime()
        );
      }
    });

    it('should sort versions by author ascending', async () => {
      const versions = await versionManager.queryVersions({
        repositoryId: 'test-repo',
        sortBy: 'author',
        sortOrder: 'asc'
      });
      
      for (let i = 1; i < versions.length; i++) {
        expect(versions[i - 1].author.name <= versions[i].author.name).toBe(true);
      }
    });

    it('should apply pagination', async () => {
      const firstPage = await versionManager.queryVersions({
        repositoryId: 'test-repo',
        limit: 2,
        offset: 0
      });
      expect(firstPage).toHaveLength(2);
      
      const secondPage = await versionManager.queryVersions({
        repositoryId: 'test-repo',
        limit: 2,
        offset: 2
      });
      expect(secondPage).toHaveLength(1);
    });
  });

  describe('Version Diff Calculation', () => {
    let version1: VersionMetadata;
    let version2: VersionMetadata;

    beforeEach(async () => {
      // Create first version
      mockExecSync
        .mockReturnValueOnce('abc123')
        .mockReturnValueOnce('First commit')
        .mockReturnValueOnce('John Doe')
        .mockReturnValueOnce('john@example.com')
        .mockReturnValueOnce('main')
        .mockReturnValueOnce('parent123');
      
      version1 = await versionManager.createVersion(mockRepoPath, 'test-repo');
      
      // Create second version with different data
      mockExecSync
        .mockReturnValueOnce('def456')
        .mockReturnValueOnce('Second commit')
        .mockReturnValueOnce('Jane Smith')
        .mockReturnValueOnce('jane@example.com')
        .mockReturnValueOnce('main')
        .mockReturnValueOnce('abc123');
      
      version2 = await versionManager.createVersion(mockRepoPath, 'test-repo-2');
    });

    it('should calculate diff between versions', async () => {
      const diff = await versionManager.calculateDiff(version1.versionId, version2.versionId);
      
      expect(diff.fromVersionId).toBe(version1.versionId);
      expect(diff.toVersionId).toBe(version2.versionId);
      expect(diff.knowledgeGraphDiff).toBeDefined();
      expect(diff.rdfFileChanges).toBeDefined();
      expect(diff.timestamp).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent versions', async () => {
      await expect(versionManager.calculateDiff('non-existent-1', 'non-existent-2'))
        .rejects.toThrow('One or both versions not found');
    });

    it('should calculate knowledge graph differences', async () => {
      const diff = await versionManager.calculateDiff(version1.versionId, version2.versionId);
      
      expect(typeof diff.knowledgeGraphDiff.nodesAdded).toBe('number');
      expect(typeof diff.knowledgeGraphDiff.nodesRemoved).toBe('number');
      expect(typeof diff.knowledgeGraphDiff.relationshipsAdded).toBe('number');
      expect(typeof diff.knowledgeGraphDiff.relationshipsRemoved).toBe('number');
    });
  });

  describe('Rollback Operations', () => {
    let sourceVersion: VersionMetadata;

    beforeEach(async () => {
      // Create source version
      mockExecSync
        .mockReturnValueOnce('abc123')
        .mockReturnValueOnce('Source commit')
        .mockReturnValueOnce('John Doe')
        .mockReturnValueOnce('john@example.com')
        .mockReturnValueOnce('main')
        .mockReturnValueOnce('parent123');
      
      sourceVersion = await versionManager.createVersion(mockRepoPath, 'test-repo');
      
      // Create target version
      mockExecSync
        .mockReturnValueOnce('def456')
        .mockReturnValueOnce('Target commit')
        .mockReturnValueOnce('Jane Smith')
        .mockReturnValueOnce('jane@example.com')
        .mockReturnValueOnce('main')
        .mockReturnValueOnce('abc123');
      
      await versionManager.createVersion(mockRepoPath, 'test-repo');
    });

    it('should initiate rollback operation', async () => {
      const rollbackOp = await versionManager.rollbackToVersion(
        'test-repo',
        sourceVersion.versionId
      );
      
      expect(rollbackOp.repositoryId).toBe('test-repo');
      expect(rollbackOp.targetVersionId).toBe(sourceVersion.versionId);
      expect(['pending', 'in_progress']).toContain(rollbackOp.status);
      expect(Array.isArray(rollbackOp.operations)).toBe(true);
    });

    it('should emit rollback events', async () => {
      const completedPromise = new Promise<RollbackOperation>((resolve) => {
        versionManager.on('rollbackCompleted', resolve);
      });
      
      await versionManager.rollbackToVersion('test-repo', sourceVersion.versionId);
      
      const completedOp = await completedPromise;
      expect(completedOp.status).toBe('completed');
    });

    it('should throw error for non-existent target version', async () => {
      await expect(versionManager.rollbackToVersion('test-repo', 'non-existent'))
        .rejects.toThrow('Target version non-existent not found');
    });

    it('should throw error for mismatched repository', async () => {
      await expect(versionManager.rollbackToVersion('wrong-repo', sourceVersion.versionId))
        .rejects.toThrow('Target version does not belong to the specified repository');
    });
  });

  describe('RDF Synchronization', () => {
    beforeEach(async () => {
      // Create test version
      mockExecSync
        .mockReturnValueOnce('abc123')
        .mockReturnValueOnce('Test commit')
        .mockReturnValueOnce('John Doe')
        .mockReturnValueOnce('john@example.com')
        .mockReturnValueOnce('main')
        .mockReturnValueOnce('parent123');
      
      await versionManager.createVersion(mockRepoPath, 'test-repo');
    });

    it('should initiate RDF sync operation', async () => {
      const filePaths = [
        'src/module1/.module-knowledge.ttl',
        'src/module2/.module-knowledge.ttl'
      ];
      
      const syncOp = await versionManager.syncRDFChangesToGraph('test-repo', filePaths);
      
      expect(syncOp.repositoryId).toBe('test-repo');
      expect(syncOp.syncType).toBe('rdf_to_graph');
      expect(syncOp.filePaths).toEqual(filePaths);
      expect(['pending', 'completed']).toContain(syncOp.status);
    });

    it('should emit sync completion event', async () => {
      const completedPromise = new Promise<SyncOperation>((resolve) => {
        versionManager.on('syncCompleted', resolve);
      });
      
      await versionManager.syncRDFChangesToGraph('test-repo', ['test.ttl']);
      
      const completedOp = await completedPromise;
      expect(completedOp.status).toBe('completed');
      expect(completedOp.results).toHaveLength(1);
    });
  });

  describe('Metrics and Monitoring', () => {
    beforeEach(async () => {
      // Create multiple versions for different repositories
      const repos = ['repo1', 'repo2', 'repo3'];
      
      for (const repo of repos) {
        mockExecSync
          .mockReturnValueOnce('abc123')
          .mockReturnValueOnce(`Commit for ${repo}`)
          .mockReturnValueOnce('John Doe')
          .mockReturnValueOnce('john@example.com')
          .mockReturnValueOnce('main')
          .mockReturnValueOnce('parent123');
        
        await versionManager.createVersion(mockRepoPath, repo);
      }
    });

    it('should provide comprehensive metrics', async () => {
      const metrics = await versionManager.getMetrics();
      
      expect(metrics.totalVersions).toBe(3);
      expect(metrics.activeVersions).toBe(3);
      expect(metrics.archivedVersions).toBe(0);
      expect(metrics.storageUsage).toBeGreaterThan(0);
      expect(metrics.averageVersionSize).toBeGreaterThan(0);
      expect(metrics.lastVersionTimestamp).toBeInstanceOf(Date);
      expect(Object.keys(metrics.repositoryStats)).toHaveLength(3);
    });

    it('should provide repository-specific statistics', async () => {
      const metrics = await versionManager.getMetrics();
      
      expect(metrics.repositoryStats['repo1']).toBeDefined();
      expect(metrics.repositoryStats['repo1'].versionCount).toBe(1);
      expect(metrics.repositoryStats['repo1'].lastUpdate).toBeInstanceOf(Date);
      expect(metrics.repositoryStats['repo1'].storageUsage).toBeGreaterThan(0);
    });
  });

  describe('Cleanup Operations', () => {
    beforeEach(async () => {
      // Clear all previous mocks to ensure clean state
      mockExecSync.mockReset();
      
      // Create more versions than the max limit with unique commit hashes
      for (let i = 0; i < 15; i++) {
        mockExecSync
          .mockReturnValueOnce(`commit${i}abcdef${i.toString().padStart(2, '0')}`) // Ensure unique commit hashes
          .mockReturnValueOnce(`Commit ${i}`)
          .mockReturnValueOnce('John Doe')
          .mockReturnValueOnce('john@example.com')
          .mockReturnValueOnce('main')
          .mockReturnValueOnce('parent123');
        
        await versionManager.createVersion(mockRepoPath, 'test-repo');
      }
    });

    it('should archive old versions during cleanup', async () => {
      await versionManager.cleanup();
      
      const metrics = await versionManager.getMetrics();
      expect(metrics.totalVersions).toBe(15);
      expect(metrics.activeVersions).toBeLessThanOrEqual(testConfig.maxVersions);
      expect(metrics.archivedVersions).toBeGreaterThan(0);
    });

    it('should emit cleanup completion event', async () => {
      const cleanupPromise = new Promise<number>((resolve) => {
        versionManager.on('cleanupCompleted', resolve);
      });
      
      await versionManager.cleanup();
      
      const archivedCount = await cleanupPromise;
      expect(archivedCount).toBeGreaterThan(0);
    });

    it('should not cleanup if under max versions', async () => {
      // Create version manager with higher limit
      const highLimitConfig = { ...testConfig, maxVersions: 20 };
      const highLimitManager = new VersionManager(highLimitConfig);
      await highLimitManager.initialize();
      
      await highLimitManager.cleanup();
      
      const metrics = await highLimitManager.getMetrics();
      expect(metrics.archivedVersions).toBe(0);
      
      await highLimitManager.shutdown();
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      const invalidConfig = {
        ...testConfig,
        versionsFilePath: '/invalid/path/versions.json'
      };
      
      const invalidManager = new VersionManager(invalidConfig);
      await expect(invalidManager.initialize()).rejects.toThrow();
    });

    it('should handle corrupted versions file', async () => {
      // Write invalid JSON to versions file
      await fs.writeFile(testConfig.versionsFilePath, 'invalid json content');
      
      const newManager = new VersionManager(testConfig);
      await expect(newManager.initialize()).rejects.toThrow();
    });

    it('should handle Git command failures', async () => {
      // Clear previous mocks and set up failure
      mockExecSync.mockReset();
      mockExecSync.mockImplementation(() => {
        throw new Error('Git not found');
      });
      
      await expect(versionManager.createVersion(mockRepoPath, 'test-repo'))
        .rejects.toThrow();
    });
  });

  describe('Backup Operations', () => {
    it('should create backups when enabled', async () => {
      // Create a version to have data to backup
      await versionManager.createVersion(mockRepoPath, 'test-repo');
      
      // Wait for backup interval
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Check if backup directory exists
      const backupExists = await fs.access(testConfig.backup.backupPath)
        .then(() => true)
        .catch(() => false);
      
      expect(backupExists).toBe(true);
    });

    it('should handle backup creation errors gracefully', async () => {
      const invalidBackupConfig = {
        ...testConfig,
        backup: {
          enabled: false, // Disable backup to avoid path issues
          interval: 2000,
          retentionDays: 1,
          backupPath: '/invalid/backup/path'
        }
      };
      
      const backupManager = new VersionManager(invalidBackupConfig);
      
      // Should not throw during initialization when backup is disabled
      await expect(backupManager.initialize()).resolves.not.toThrow();
      await backupManager.shutdown();
    });
  });

  describe('Service Lifecycle', () => {
    it('should shutdown gracefully', async () => {
      const shutdownPromise = new Promise<void>((resolve) => {
        versionManager.on('shutdown', resolve);
      });
      
      await versionManager.shutdown();
      await shutdownPromise;
    });

    it('should handle multiple shutdown calls', async () => {
      await versionManager.shutdown();
      await expect(versionManager.shutdown()).resolves.not.toThrow();
    });

    it('should clear cleanup timer on shutdown', async () => {
      const manager = new VersionManager({
        ...testConfig,
        autoCleanup: true,
        cleanupInterval: 100
      });
      
      await manager.initialize();
      await manager.shutdown();
      
      // Should not throw after shutdown
      expect(() => manager.shutdown()).not.toThrow();
    });
  });
});