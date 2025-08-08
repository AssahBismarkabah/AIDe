/**
 * Project Analysis Service Tests
 * Simplified tests focusing on core functionality
 */

import { ProjectAnalysisService } from '../src/services/project-analysis/ProjectAnalysisService';
import { jest } from '@jest/globals';

// Mock all external dependencies to prevent memory issues
jest.mock('../src/services/layer1/code-ingestion/CodeIngestionService', () => ({
  CodeIngestionService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockImplementation(() => Promise.resolve()),
    shutdown: jest.fn().mockImplementation(() => Promise.resolve()),
    getMetrics: jest.fn().mockReturnValue({}),
    addRepository: jest.fn().mockImplementation(() => Promise.resolve()),
    on: jest.fn()
  }))
}));

jest.mock('../src/services/layer1/module-knowledge/ModuleKnowledgeManager', () => ({
  ModuleKnowledgeManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockImplementation(() => Promise.resolve()),
    updateKnowledgeFileFromCode: jest.fn().mockImplementation(() => Promise.resolve({ success: true })),
    on: jest.fn()
  }))
}));

jest.mock('../src/services/layer1/ast-analyzer/TypeScriptAnalyzer', () => ({
  TypeScriptAnalyzer: jest.fn().mockImplementation(() => ({
    analyzeFile: jest.fn().mockImplementation(() => Promise.resolve({ success: true }))
  }))
}));

jest.mock('glob', () => ({
  glob: jest.fn().mockImplementation(() => Promise.resolve([]))
}));

jest.mock('fs/promises', () => ({
  readdir: jest.fn().mockImplementation(() => Promise.resolve([])),
  access: jest.fn().mockImplementation(() => Promise.resolve()),
  readFile: jest.fn().mockImplementation(() => Promise.resolve('{}')),
  stat: jest.fn().mockImplementation(() => Promise.resolve({ size: 1000, mtime: new Date() })),
  mkdir: jest.fn().mockImplementation(() => Promise.resolve()),
  writeFile: jest.fn().mockImplementation(() => Promise.resolve()),
  rm: jest.fn().mockImplementation(() => Promise.resolve())
}));

describe('ProjectAnalysisService', () => {
  let analysisService: ProjectAnalysisService;
  let mockRootPath: string;

  beforeEach(() => {
    mockRootPath = '/tmp/test-project';
    
    analysisService = new ProjectAnalysisService({
      rootPath: mockRootPath,
      languages: ['typescript', 'javascript'],
      generateTTL: true,
      enableWatching: false
    });

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (analysisService) {
      await analysisService.shutdown();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(analysisService.initialize()).resolves.not.toThrow();
    });

    it('should throw error when analyzing before initialization', async () => {
      await expect(analysisService.analyzeProject()).rejects.toThrow(
        'Project Analysis Service not initialized'
      );
    });
  });

  describe('configuration', () => {
    it('should use default configuration values', () => {
      const service = new ProjectAnalysisService({
        rootPath: mockRootPath
      });

      expect(service['config']).toMatchObject({
        rootPath: mockRootPath,
        outputDirectory: '.aaswe/knowledge',
        languages: expect.arrayContaining(['typescript', 'javascript']),
        generateTTL: true,
        enableWatching: true,
        analysisDepth: 'detailed'
      });
    });

    it('should override default configuration', () => {
      const service = new ProjectAnalysisService({
        rootPath: mockRootPath,
        outputDirectory: './custom',
        languages: ['python'],
        generateTTL: false,
        enableWatching: false,
        analysisDepth: 'basic'
      });

      expect(service['config']).toMatchObject({
        rootPath: mockRootPath,
        outputDirectory: './custom',
        languages: ['python'],
        generateTTL: false,
        enableWatching: false,
        analysisDepth: 'basic'
      });
    });
  });

  describe('utility methods', () => {
    it('should classify directories correctly', () => {
      const service = analysisService as any;
      
      expect(service.classifyDirectory('src')).toBe('source');
      expect(service.classifyDirectory('test')).toBe('test');
      expect(service.classifyDirectory('tests')).toBe('test');
      expect(service.classifyDirectory('config')).toBe('config');
      expect(service.classifyDirectory('docs')).toBe('docs');
      expect(service.classifyDirectory('build')).toBe('build');
      expect(service.classifyDirectory('dist')).toBe('build');
      expect(service.classifyDirectory('random')).toBe('other');
    });

    it('should detect language from file extension', () => {
      const service = analysisService as any;
      
      expect(service.getLanguageFromFile('test.ts')).toBe('typescript');
      expect(service.getLanguageFromFile('test.tsx')).toBe('typescript');
      expect(service.getLanguageFromFile('test.js')).toBe('javascript');
      expect(service.getLanguageFromFile('test.jsx')).toBe('javascript');
      expect(service.getLanguageFromFile('test.py')).toBe('python');
      expect(service.getLanguageFromFile('test.java')).toBe('java');
      expect(service.getLanguageFromFile('test.go')).toBe('go');
      expect(service.getLanguageFromFile('test.rs')).toBe('rust');
      expect(service.getLanguageFromFile('test.cpp')).toBe('cpp');
      expect(service.getLanguageFromFile('test.unknown')).toBe('unknown');
    });

    it('should determine project type correctly', () => {
      const service = analysisService as any;
      
      const webProject = service.determineProjectType(
        [{ dependencies: ['react', 'vue'] }],
        [{ path: '/src/component.tsx' }]
      );
      expect(webProject).toBe('web');

      const apiProject = service.determineProjectType(
        [{ dependencies: ['express'] }],
        [{ path: '/src/api/routes.ts' }]
      );
      expect(apiProject).toBe('api');

      const cliProject = service.determineProjectType(
        [],
        [{ path: '/src/cli/index.ts' }]
      );
      expect(cliProject).toBe('cli');

      const libraryProject = service.determineProjectType(
        [],
        [{ path: '/src/utils.ts' }]
      );
      expect(libraryProject).toBe('library');
    });
  });

  describe('basic functionality', () => {
    beforeEach(async () => {
      await analysisService.initialize();
    });

    it('should provide analysis metrics', () => {
      const metrics = analysisService.getAnalysisMetrics();

      expect(metrics).toMatchObject({
        codeIngestion: expect.any(Object),
        knowledgeFiles: expect.any(Object),
        analyzers: expect.any(Array),
        lastAnalysis: expect.any(Date)
      });
    });

    it('should handle project analysis with mocked dependencies', async () => {
      const result = await analysisService.analyzeProject();

      expect(result).toMatchObject({
        projectPath: mockRootPath,
        analysisId: expect.any(String),
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        duration: expect.any(Number),
        summary: expect.any(Object),
        files: expect.any(Array),
        errors: expect.any(Array),
        warnings: expect.any(Array),
        recommendations: expect.any(Array)
      });
    });
  });
});