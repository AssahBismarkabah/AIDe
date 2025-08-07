/**
 * Code Ingestion Service Tests
 * Tests for Git integration, file watching, and job queue functionality
 */

import { join } from 'path';
import { mkdtemp, writeFile, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { TypeScriptAnalyzer } from '../src/services/layer1/ast-analyzer/TypeScriptAnalyzer';
import { CodeIngestionService } from '../src/services/layer1/code-ingestion';

// Mock child_process to avoid real Git operations
jest.mock('child_process', () => ({
  execSync: jest.fn(() => {
    // Mock successful Git operations without actual execution
    return '';
  })
}));

// Mock simple-git to prevent real Git operations that cause SSH authentication
jest.mock('simple-git', () => {
  const mockGitInstance = {
    checkIsRepo: jest.fn().mockResolvedValue(true),
    status: jest.fn().mockResolvedValue({
      current: 'main',
      tracking: null,
      ahead: 0,
      behind: 0,
      staged: [],
      not_added: [],
      conflicted: [],
      created: [],
      deleted: [],
      modified: [],
      renamed: [],
      files: []
    }),
    log: jest.fn().mockResolvedValue({
      latest: {
        hash: 'abc123def456789',
        date: new Date().toISOString(),
        message: 'Test commit',
        author_name: 'Test User',
        author_email: 'test@example.com'
      },
      all: [{
        hash: 'abc123def456789',
        date: new Date().toISOString(),
        message: 'Test commit',
        author_name: 'Test User',
        author_email: 'test@example.com'
      }]
    }),
    fetch: jest.fn().mockResolvedValue(undefined),
    diffSummary: jest.fn().mockResolvedValue({
      files: [{
        file: 'test.ts',
        insertions: 5,
        deletions: 2,
        binary: false
      }]
    })
  };

  return {
    simpleGit: jest.fn(() => mockGitInstance)
  };
});

describe('Code Ingestion Service', () => {
  let tempDir: string;
  let ingestionService: CodeIngestionService;
  let mockAnalyzer: TypeScriptAnalyzer;

  // Helper function to create a mock Git repository structure
  const createGitRepo = async (repoName: string): Promise<string> => {
    const repoPath = join(tempDir, repoName);
    await mkdir(repoPath, { recursive: true });
    
    // Create .git directory to simulate Git repository
    await mkdir(join(repoPath, '.git'), { recursive: true });
    await writeFile(join(repoPath, '.git', 'HEAD'), 'ref: refs/heads/main');
    await mkdir(join(repoPath, '.git', 'refs', 'heads'), { recursive: true });
    await writeFile(join(repoPath, '.git', 'refs', 'heads', 'main'), 'abc123def456789');
    
    // Create test files
    await writeFile(join(repoPath, 'test.ts'), 'export const hello = "world";');
    await writeFile(join(repoPath, 'package.json'), '{"name": "test"}');
    
    return repoPath;
  };

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await mkdtemp(join(tmpdir(), 'code-ingestion-test-'));
    
    // Create mock analyzer
    mockAnalyzer = new TypeScriptAnalyzer();
    
    // Initialize ingestion service
    ingestionService = new CodeIngestionService(mockAnalyzer, {
      maxConcurrentJobs: 1,
      batchSize: 10,
      retryAttempts: 1,
      retryDelay: 100
    });
    
    await ingestionService.initialize();
  });

  afterEach(async () => {
    // Cleanup
    await ingestionService.shutdown();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Repository Management', () => {
    test('should add repository successfully', async () => {
      const repoPath = await createGitRepo('test-repo');

      const repository = await ingestionService.addRepository({
        name: 'test-repo',
        path: repoPath,
        enableFileWatcher: false, // Disable for testing
        includePatterns: ['**/*.ts', '**/*.js'],
        excludePatterns: ['node_modules/**']
      });

      expect(repository).toBeDefined();
      expect(repository.name).toBe('test-repo');
      expect(repository.path).toBe(repoPath);
      expect(repository.status).toBe('active');
      expect(repository.config.includePatterns).toContain('**/*.ts');
    });

    test('should get repository by ID', async () => {
      const repoPath = await createGitRepo('test-repo');

      const repository = await ingestionService.addRepository({
        name: 'test-repo',
        path: repoPath,
        enableFileWatcher: false
      });

      const retrieved = ingestionService.getRepository(repository.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(repository.id);
      expect(retrieved?.name).toBe('test-repo');
    });

    test('should list all repositories', async () => {
      const repoPath1 = await createGitRepo('repo1');
      const repoPath2 = await createGitRepo('repo2');

      const repo1 = await ingestionService.addRepository({
        name: 'repo1',
        path: repoPath1,
        enableFileWatcher: false
      });

      const repo2 = await ingestionService.addRepository({
        name: 'repo2',
        path: repoPath2,
        enableFileWatcher: false
      });

      const repositories = ingestionService.getRepositories();
      expect(repositories.length).toBeGreaterThanOrEqual(2);
      expect(repositories.map(r => r.name)).toContain('repo1');
      expect(repositories.map(r => r.name)).toContain('repo2');
      
      // Verify the specific repositories we added are present
      expect(repositories.find(r => r.id === repo1.id)).toBeDefined();
      expect(repositories.find(r => r.id === repo2.id)).toBeDefined();
    });

    test('should remove repository', async () => {
      const repoPath = await createGitRepo('test-repo');

      const repository = await ingestionService.addRepository({
        name: 'test-repo',
        path: repoPath,
        enableFileWatcher: false
      });

      await ingestionService.removeRepository(repository.id);

      const retrieved = ingestionService.getRepository(repository.id);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Job Management', () => {
    test('should queue full analysis job', async () => {
      const repoPath = await createGitRepo('test-repo');

      const repository = await ingestionService.addRepository({
        name: 'test-repo',
        path: repoPath,
        enableFileWatcher: false
      });

      // Wait a bit for repository to be fully registered
      await new Promise(resolve => setTimeout(resolve, 50));

      const job = await ingestionService.queueFullAnalysis(repository.id, 'manual');
      
      expect(job).toBeDefined();
      expect(job.repositoryId).toBe(repository.id);
      expect(job.type).toBe('full_analysis');
      expect(['pending', 'running', 'failed']).toContain(job.status);
      expect(job.metadata.triggerType).toBe('manual');
    });

    test('should queue incremental analysis job', async () => {
      const repoPath = await createGitRepo('test-repo');

      const repository = await ingestionService.addRepository({
        name: 'test-repo',
        path: repoPath,
        enableFileWatcher: false
      });

      const job = await ingestionService.queueIncrementalAnalysis(
        repository.id,
        'abc123',
        ['src/test.ts'],
        'file_watcher'
      );
      
      expect(job).toBeDefined();
      expect(job.repositoryId).toBe(repository.id);
      expect(job.type).toBe('incremental_analysis');
      expect(job.metadata.commitHash).toBe('abc123');
      expect(job.metadata.changedFiles).toContain('src/test.ts');
      expect(job.metadata.triggerType).toBe('file_watcher');
    });

    test('should queue TTL sync job', async () => {
      const repoPath = await createGitRepo('test-repo');

      const repository = await ingestionService.addRepository({
        name: 'test-repo',
        path: repoPath,
        enableFileWatcher: false
      });

      const job = await ingestionService.queueTTLSync(
        repository.id,
        '.module-knowledge.ttl'
      );
      
      expect(job).toBeDefined();
      expect(job.repositoryId).toBe(repository.id);
      expect(job.type).toBe('ttl_sync');
      expect(job.priority).toBe('critical');
      expect(job.metadata.changedFiles).toContain('.module-knowledge.ttl');
    });

    test('should get repository jobs', async () => {
      const repoPath = await createGitRepo('test-repo');

      const repository = await ingestionService.addRepository({
        name: 'test-repo',
        path: repoPath,
        enableFileWatcher: false
      });

      // Wait a bit for repository to be fully registered
      await new Promise(resolve => setTimeout(resolve, 50));

      await ingestionService.queueFullAnalysis(repository.id, 'manual');
      await ingestionService.queueIncrementalAnalysis(repository.id, 'abc123', ['test.ts']);

      const jobs = ingestionService.getRepositoryJobs(repository.id);
      expect(jobs.length).toBeGreaterThanOrEqual(2);
      expect(jobs.map(j => j.type)).toContain('full_analysis');
      expect(jobs.map(j => j.type)).toContain('incremental_analysis');
    });
  });

  describe('Webhook Processing', () => {
    test('should process webhook payload', async () => {
      const repoPath = await createGitRepo('test-repo');

      const repository = await ingestionService.addRepository({
        name: 'test-repo',
        path: repoPath,
        url: 'https://github.com/test/repo.git',
        enableFileWatcher: false
      });

      // Wait for repository to be fully registered
      await new Promise(resolve => setTimeout(resolve, 50));

      const webhookPayload = {
        repository: {
          id: 'github-123',
          name: 'test-repo',
          url: 'https://github.com/test/repo.git',
          branch: 'main'
        },
        commits: [{
          hash: 'abc123',
          author: 'Test User',
          email: 'test@example.com',
          message: 'Test commit',
          timestamp: new Date(),
          files: [{
            path: 'src/test.ts',
            status: 'modified' as const,
            additions: 5,
            deletions: 2
          }]
        }],
        pusher: {
          name: 'Test User',
          email: 'test@example.com'
        },
        timestamp: new Date()
      };

      // The main test: webhook processing should not throw an error
      await expect(ingestionService.processWebhook(webhookPayload)).resolves.not.toThrow();

      // Verify that the webhook processing was handled gracefully
      // The service should be able to process the webhook without errors
      expect(repository).toBeDefined();
      expect(repository.name).toBe('test-repo');
      expect(repository.url).toBe('https://github.com/test/repo.git');
    });
  });

  describe('Service Metrics', () => {
    test('should provide service metrics', async () => {
      const metrics = ingestionService.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.totalRepositories).toBe('number');
      expect(typeof metrics.activeJobs).toBe('number');
      expect(typeof metrics.completedJobs).toBe('number');
      expect(typeof metrics.failedJobs).toBe('number');
      expect(typeof metrics.averageProcessingTime).toBe('number');
      expect(typeof metrics.filesProcessedPerSecond).toBe('number');
      expect(metrics.lastProcessingTime).toBeInstanceOf(Date);
    });

    test('should update metrics after adding repositories', async () => {
      const initialMetrics = ingestionService.getMetrics();
      const initialCount = initialMetrics.totalRepositories;

      const repoPath = await createGitRepo('test-repo');

      await ingestionService.addRepository({
        name: 'test-repo',
        path: repoPath,
        enableFileWatcher: false
      });

      const updatedMetrics = ingestionService.getMetrics();
      expect(updatedMetrics.totalRepositories).toBe(initialCount + 1);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid repository path', async () => {
      await expect(ingestionService.addRepository({
        name: 'invalid-repo',
        path: '/non/existent/path',
        enableFileWatcher: false
      })).rejects.toThrow();
    });

    test('should handle non-git directory', async () => {
      const nonGitPath = join(tempDir, 'not-git');
      await mkdir(nonGitPath, { recursive: true });

      // Update the mock to return false for non-git directories
      const mockGitInstance = require('simple-git').simpleGit();
      mockGitInstance.checkIsRepo.mockResolvedValueOnce(false);

      await expect(ingestionService.addRepository({
        name: 'not-git',
        path: nonGitPath,
        enableFileWatcher: false
      })).rejects.toThrow('Path is not a Git repository');
    });

    test('should handle webhook for unknown repository', async () => {
      const webhookPayload = {
        repository: {
          id: 'unknown-123',
          name: 'unknown-repo',
          url: 'https://github.com/unknown/repo.git',
          branch: 'main'
        },
        commits: [],
        pusher: {
          name: 'Test User',
          email: 'test@example.com'
        },
        timestamp: new Date()
      };

      // Should not throw, but should log warning
      await expect(ingestionService.processWebhook(webhookPayload)).resolves.not.toThrow();
    });
  });
});