/**
 * Code Ingestion Service Tests
 * Tests for Git integration, file watching, and job queue functionality
 */

import { join } from 'path';
import { mkdtemp, writeFile, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { TypeScriptAnalyzer } from '../src/services/layer1/ast-analyzer/TypeScriptAnalyzer';
import { CodeIngestionService } from '../src/services/layer1/code-ingestion';

describe('Code Ingestion Service', () => {
  let tempDir: string;
  let ingestionService: CodeIngestionService;
  let mockAnalyzer: TypeScriptAnalyzer;

  // Helper function to create a proper Git repository
  const createGitRepo = async (repoName: string): Promise<string> => {
    const repoPath = join(tempDir, repoName);
    await mkdir(repoPath, { recursive: true });
    
    // Initialize proper Git repository
    const { execSync } = require('child_process');
    execSync('git init', { cwd: repoPath, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: repoPath, stdio: 'ignore' });
    execSync('git config user.name "Test User"', { cwd: repoPath, stdio: 'ignore' });
    
    // Create test files
    await writeFile(join(repoPath, 'test.ts'), 'export const hello = "world";');
    await writeFile(join(repoPath, 'package.json'), '{"name": "test"}');
    
    // Make initial commit
    execSync('git add .', { cwd: repoPath, stdio: 'ignore' });
    execSync('git commit -m "Initial commit"', { cwd: repoPath, stdio: 'ignore' });
    
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

      await ingestionService.addRepository({
        name: 'repo1',
        path: repoPath1,
        enableFileWatcher: false
      });

      await ingestionService.addRepository({
        name: 'repo2',
        path: repoPath2,
        enableFileWatcher: false
      });

      const repositories = ingestionService.getRepositories();
      expect(repositories).toHaveLength(2);
      expect(repositories.map(r => r.name)).toContain('repo1');
      expect(repositories.map(r => r.name)).toContain('repo2');
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

      const job = await ingestionService.queueFullAnalysis(repository.id, 'manual');
      
      expect(job).toBeDefined();
      expect(job.repositoryId).toBe(repository.id);
      expect(job.type).toBe('full_analysis');
      expect(job.status).toBe('pending');
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

      await ingestionService.queueFullAnalysis(repository.id, 'manual');
      await ingestionService.queueIncrementalAnalysis(repository.id, 'abc123', ['test.ts']);

      const jobs = ingestionService.getRepositoryJobs(repository.id);
      expect(jobs).toHaveLength(2);
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

      // Process webhook should not throw
      await expect(ingestionService.processWebhook(webhookPayload)).resolves.not.toThrow();

      // Should create an incremental analysis job
      const jobs = ingestionService.getRepositoryJobs(repository.id);
      const webhookJob = jobs.find(j => j.metadata.triggerType === 'webhook');
      expect(webhookJob).toBeDefined();
      expect(webhookJob?.type).toBe('incremental_analysis');
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

      await expect(ingestionService.addRepository({
        name: 'not-git',
        path: nonGitPath,
        enableFileWatcher: false
      })).rejects.toThrow();
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