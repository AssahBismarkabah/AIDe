/**
 * Module Knowledge Management System Tests
 * 
 * Comprehensive test suite for the dual-purpose TTL file management system
 * that serves both Neo4j knowledge graph population and direct LLM context enhancement.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import { ModuleKnowledgeManager } from '../src/services/layer1/module-knowledge/ModuleKnowledgeManager';
import {
  ModuleKnowledgeManagerOptions
} from '../src/services/layer1/module-knowledge/types';
import { AnalysisResult } from '../src/services/layer1/ast-analyzer/types';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../src/services/layer1/rdf-generator/RDFService');
jest.mock('../src/services/layer1/rdf-generator/RDFValidator');
jest.mock('../src/services/layer1/code-ingestion/CodeIngestionService');
jest.mock('../src/services/layer1/ast-analyzer/TypeScriptAnalyzer');

const mockFs = fs as jest.Mocked<typeof fs>;

// Create proper mock implementations
const mockRdfService = {
  detectModules: jest.fn() as jest.MockedFunction<any>,
  generateRDF: jest.fn() as jest.MockedFunction<any>
};

const mockRdfValidator = {
  validateContent: jest.fn() as jest.MockedFunction<any>
};

describe('ModuleKnowledgeManager', () => {
  let manager: ModuleKnowledgeManager;
  let testOptions: Partial<ModuleKnowledgeManagerOptions>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    testOptions = {
      autoValidate: true,
      preserveBusinessContext: true,
      enableConflictResolution: true,
      enableLLMPreview: true,
      validationLevel: 'moderate',
      backupEnabled: true,
      backupRetention: 30
    };

    manager = new ModuleKnowledgeManager(testOptions);

    // Mock file system operations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('mock file content');
    mockFs.writeFile.mockResolvedValue(undefined);

    // Setup service mocks
    (manager as any).rdfService = mockRdfService;
    (manager as any).rdfValidator = mockRdfValidator;
  });

  afterEach(async () => {
    // Cleanup any event listeners
    manager.removeAllListeners();
  });

  describe('Initialization', () => {
    it('should initialize successfully with default options', async () => {
      const result = await manager.initialize();
      
      expect(result.success).toBe(true);
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.aaswe/backups'),
        { recursive: true }
      );
    });

    it('should handle initialization errors gracefully', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));
      
      const result = await manager.initialize();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    it('should apply custom options correctly', () => {
      const customOptions: Partial<ModuleKnowledgeManagerOptions> = {
        autoValidate: false,
        preserveBusinessContext: false,
        validationLevel: 'strict'
      };

      const customManager = new ModuleKnowledgeManager(customOptions);
      
      // Access private options through type assertion for testing
      const options = (customManager as any).options;
      expect(options.autoValidate).toBe(false);
      expect(options.preserveBusinessContext).toBe(false);
      expect(options.validationLevel).toBe('strict');
    });
  });

  describe('Initial Knowledge File Generation', () => {
    it('should generate initial knowledge files successfully', async () => {
      const mockModuleDetection = {
        modules: [
          { path: '/test/module1.ts', name: 'module1' },
          { path: '/test/module2.ts', name: 'module2' }
        ]
      };

      // Mock RDF service
      (mockRdfService.detectModules as any).mockResolvedValue(mockModuleDetection);

      const result = await manager.generateInitialKnowledgeFiles('/test/project');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.totalFiles).toBe(2);
      expect(mockRdfService.detectModules).toHaveBeenCalledWith('/test/project');
    });

    it('should handle module detection errors', async () => {
      (mockRdfService.detectModules as any).mockRejectedValue(new Error('Detection failed'));

      const result = await manager.generateInitialKnowledgeFiles('/test/project');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Detection failed');
    });

    it('should track generation metrics correctly', async () => {
      const mockModuleDetection = {
        modules: [
          { path: '/test/module1.ts', name: 'module1' },
          { path: '/test/module2.ts', name: 'module2' },
          { path: '/test/module3.ts', name: 'module3' }
        ]
      };

      (mockRdfService.detectModules as any).mockResolvedValue(mockModuleDetection);

      // Mock generateKnowledgeFileForModule to simulate some failures
      const generateSpy = jest.spyOn(manager as any, 'generateKnowledgeFileForModule');
      generateSpy
        .mockResolvedValueOnce(undefined) // Success
        .mockRejectedValueOnce(new Error('Generation failed')) // Failure
        .mockResolvedValueOnce(undefined); // Success

      const result = await manager.generateInitialKnowledgeFiles('/test/project');

      expect(result.success).toBe(true);
      expect(result.data!.totalFiles).toBe(3);
      expect(result.data!.successful).toBe(2);
      expect(result.data!.failed).toBe(1);
      expect(result.data!.errors).toHaveLength(1);
      expect(result.data!.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Knowledge File Updates from Code Changes', () => {
    const mockAstResult: AnalysisResult = {
      filePath: '/test/module.ts',
      language: 'typescript',
      nodes: [],
      classes: [],
      functions: [],
      imports: [],
      exports: [],
      dependencies: [],
      complexity: {
        cyclomaticComplexity: 5,
        cognitiveComplexity: 3,
        linesOfCode: 100,
        maintainabilityIndex: 80,
        technicalDebt: 2
      },
      errors: [],
      timestamp: new Date()
    };

    it('should update knowledge file from code changes successfully', async () => {
      (mockRdfService.generateRDF as any).mockResolvedValue({
        rdfContent: '@prefix test: <http://test.com/> .\ntest:module a test:Module .'
      });

      const result = await manager.updateKnowledgeFileFromCode('/test/module.ts', mockAstResult);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.filePath).toBe('/test/.module-knowledge.ttl');
      expect(result.data!.modulePath).toBe('/test/module.ts');
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should preserve existing business context when enabled', async () => {
      mockFs.access.mockResolvedValue(undefined); // File exists
      
      (mockRdfService.generateRDF as any).mockResolvedValue({
        rdfContent: '@prefix test: <http://test.com/> .\ntest:module a test:Module .'
      });

      const extractSpy = jest.spyOn(manager as any, 'extractBusinessContext');
      extractSpy.mockResolvedValue({ businessDomain: 'E-commerce' });

      const mergeSpy = jest.spyOn(manager as any, 'mergeBusinessContext');
      mergeSpy.mockResolvedValue('merged content');

      const result = await manager.updateKnowledgeFileFromCode('/test/module.ts', mockAstResult);

      expect(result.success).toBe(true);
      expect(extractSpy).toHaveBeenCalled();
      expect(mergeSpy).toHaveBeenCalled();
      expect(result.data!.businessContextEnhanced).toBe(true);
    });

    it('should create backup when enabled', async () => {
      mockFs.access.mockResolvedValue(undefined); // File exists
      
      (mockRdfService.generateRDF as any).mockResolvedValue({
        rdfContent: '@prefix test: <http://test.com/> .\ntest:module a test:Module .'
      });

      const backupSpy = jest.spyOn(manager as any, 'createBackup');
      backupSpy.mockResolvedValue({
        filePath: '/test/.module-knowledge.ttl',
        backupPath: '/backups/backup.ttl',
        timestamp: new Date(),
        reason: 'auto_update',
        checksum: 'abc123'
      });

      const result = await manager.updateKnowledgeFileFromCode('/test/module.ts', mockAstResult);

      expect(result.success).toBe(true);
      expect(backupSpy).toHaveBeenCalledWith('/test/.module-knowledge.ttl', 'auto_update');
    });

    it('should emit file update events', async () => {
      (mockRdfService.generateRDF as any).mockResolvedValue({
        rdfContent: '@prefix test: <http://test.com/> .\ntest:module a test:Module .'
      });

      const eventSpy = jest.fn();
      manager.on('file_updated', eventSpy);

      await manager.updateKnowledgeFileFromCode('/test/module.ts', mockAstResult);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'file_updated',
          payload: expect.objectContaining({
            filePath: '/test/.module-knowledge.ttl',
            updateType: 'code_change'
          })
        })
      );
    });
  });

  describe('Knowledge File Validation', () => {
    it('should validate knowledge file successfully', async () => {
      const mockContent = '@prefix test: <http://test.com/> .\ntest:module a test:Module .';
      mockFs.readFile.mockResolvedValue(mockContent);

      (mockRdfValidator.validateContent as any).mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const result = await manager.validateKnowledgeFile('/test/.module-knowledge.ttl');

      expect(result.isValid).toBe(true);
      expect(result.syntaxErrors).toHaveLength(0);
      expect(result.semanticWarnings).toHaveLength(0);
      expect(result.lastValidated).toBeInstanceOf(Date);
    });

    it('should handle validation errors correctly', async () => {
      const mockContent = 'invalid ttl content';
      mockFs.readFile.mockResolvedValue(mockContent);

      (mockRdfValidator.validateContent as any).mockResolvedValue({
        isValid: false,
        errors: [{
          type: 'syntax',
          message: 'Invalid syntax',
          line: 1,
          severity: 'error'
        }],
        warnings: []
      });

      const result = await manager.validateKnowledgeFile('/test/.module-knowledge.ttl');

      expect(result.isValid).toBe(false);
      expect(result.syntaxErrors).toHaveLength(1);
      expect(result.syntaxErrors[0].message).toBe('Invalid syntax');
      expect(result.syntaxErrors[0].line).toBe(1);
    });

    it('should emit validation events', async () => {
      const mockContent = '@prefix test: <http://test.com/> .\ntest:module a test:Module .';
      mockFs.readFile.mockResolvedValue(mockContent);

      (mockRdfValidator.validateContent as any).mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const eventSpy = jest.fn();
      manager.on('file_validated', eventSpy);

      await manager.validateKnowledgeFile('/test/.module-knowledge.ttl');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'file_validated',
          payload: expect.objectContaining({
            isValid: true
          })
        })
      );
    });
  });

  describe('LLM Context Preview Generation', () => {
    it('should generate LLM context preview successfully', async () => {
      const mockRelevantFiles = ['/test/.module-knowledge.ttl', '/test/other/.module-knowledge.ttl'];
      const mockContent = '@prefix test: <http://test.com/> .\ntest:module a test:Module .';
      
      mockFs.readFile.mockResolvedValue(mockContent);
      
      const findRelevantSpy = jest.spyOn(manager as any, 'findRelevantKnowledgeFiles');
      findRelevantSpy.mockResolvedValue(mockRelevantFiles);

      const result = await manager.generateLLMContextPreview('/test/current.ts', 'test query');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.filePath).toBe('/test/current.ts');
      expect(result.data!.relevantFiles).toEqual(mockRelevantFiles);
      expect(result.data!.contextContent).toContain('test:module');
      expect(result.data!.tokenCount).toBeGreaterThan(0);
      expect(result.data!.relevanceScore).toBeGreaterThan(0);
    });

    it('should handle empty relevant files gracefully', async () => {
      const findRelevantSpy = jest.spyOn(manager as any, 'findRelevantKnowledgeFiles');
      findRelevantSpy.mockResolvedValue([]);

      const result = await manager.generateLLMContextPreview('/test/current.ts');

      expect(result.success).toBe(true);
      expect(result.data!.relevantFiles).toHaveLength(0);
      expect(result.data!.contextContent).toBe('');
      expect(result.data!.tokenCount).toBe(0);
    });
  });

  describe('Developer Tooling Generation', () => {
    it('should generate developer tooling information successfully', async () => {
      const mockContent = '@prefix test: <http://test.com/> .\ntest:module a test:Module .';
      mockFs.readFile.mockResolvedValue(mockContent);

      const enhancementSpy = jest.spyOn(manager as any, 'generateEnhancementSuggestions');
      enhancementSpy.mockReturnValue([
        { type: 'business_context', suggestion: 'Add business domain information' }
      ]);

      const completionSpy = jest.spyOn(manager as any, 'calculateCompletionStatus');
      completionSpy.mockReturnValue({
        businessDomain: false,
        businessRules: false,
        overallCompleteness: 0.3
      });

      const impactSpy = jest.spyOn(manager as any, 'performImpactAnalysis');
      impactSpy.mockResolvedValue({
        llmContextImpact: 'high',
        graphQueryImpact: 'medium',
        estimatedBenefit: 'Improved understanding'
      });

      const result = await manager.generateDeveloperTooling('/test/.module-knowledge.ttl');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.enhancementSuggestions).toHaveLength(1);
      expect(result.data!.completionStatus.overallCompleteness).toBe(0.3);
      expect(result.data!.impactAnalysis.llmContextImpact).toBe('high');
    });
  });

  describe('Conflict Detection and Resolution', () => {
    it('should detect no conflicts when file is unchanged', async () => {
      const mockContent = 'test content';
      const mockChecksum = 'abc123';
      
      // Mock internal knowledge file tracking
      const knowledgeFiles = (manager as any).knowledgeFiles;
      knowledgeFiles.set('/test/.module-knowledge.ttl', {
        filePath: '/test/.module-knowledge.ttl',
        content: mockContent,
        checksum: mockChecksum
      });

      mockFs.readFile.mockResolvedValue(mockContent);
      
      // Mock checksum calculation
      const checksumSpy = jest.spyOn(manager as any, 'calculateChecksum');
      checksumSpy.mockReturnValue(mockChecksum);

      const result = await manager.detectAndResolveConflicts('/test/.module-knowledge.ttl');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should detect and attempt to resolve conflicts', async () => {
      const originalContent = 'original content';
      const modifiedContent = 'modified content';
      const originalChecksum = 'abc123';
      const modifiedChecksum = 'def456';
      
      // Mock internal knowledge file tracking
      const knowledgeFiles = (manager as any).knowledgeFiles;
      knowledgeFiles.set('/test/.module-knowledge.ttl', {
        filePath: '/test/.module-knowledge.ttl',
        content: originalContent,
        checksum: originalChecksum
      });

      mockFs.readFile.mockResolvedValue(modifiedContent);
      
      // Mock checksum calculation
      const checksumSpy = jest.spyOn(manager as any, 'calculateChecksum');
      checksumSpy.mockReturnValue(modifiedChecksum);

      // Mock auto resolution
      const resolutionSpy = jest.spyOn(manager as any, 'attemptAutoResolution');
      resolutionSpy.mockResolvedValue('resolved content');

      const result = await manager.detectAndResolveConflicts('/test/.module-knowledge.ttl');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.conflictType).toBe('concurrent_edit');
      expect(result.data!.resolution).toBe('auto');
      expect(result.data!.resolvedContent).toBe('resolved content');
    });

    it('should emit conflict detection events', async () => {
      const originalContent = 'original content';
      const modifiedContent = 'modified content';
      
      const knowledgeFiles = (manager as any).knowledgeFiles;
      knowledgeFiles.set('/test/.module-knowledge.ttl', {
        filePath: '/test/.module-knowledge.ttl',
        content: originalContent,
        checksum: 'abc123'
      });

      mockFs.readFile.mockResolvedValue(modifiedContent);
      
      const checksumSpy = jest.spyOn(manager as any, 'calculateChecksum');
      checksumSpy.mockReturnValue('def456');

      const eventSpy = jest.fn();
      manager.on('conflict_detected', eventSpy);

      await manager.detectAndResolveConflicts('/test/.module-knowledge.ttl');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conflict_detected',
          payload: expect.objectContaining({
            conflictType: 'concurrent_edit'
          })
        })
      );
    });
  });

  describe('Event Handling', () => {
    it('should handle file update events correctly', async () => {
      const queueSpy = jest.spyOn(manager as any, 'queueForSync');
      queueSpy.mockResolvedValue(undefined);

      const event = {
        type: 'file_updated' as const,
        payload: {
          filePath: '/test/.module-knowledge.ttl',
          updateType: 'code_change' as const,
          changes: [],
          preserveBusinessContext: true,
          timestamp: new Date()
        }
      };

      // Trigger the event handler directly
      await (manager as any).handleFileUpdate(event);

      expect(queueSpy).toHaveBeenCalledWith('/test/.module-knowledge.ttl', 'both');
    });

    it('should handle validation events correctly', async () => {
      const event = {
        type: 'file_validated' as const,
        payload: {
          isValid: true,
          syntaxErrors: [],
          semanticWarnings: [],
          businessContextCompleteness: 0.8,
          lastValidated: new Date()
        }
      };

      // Should not throw when handling validation events
      await expect((manager as any).handleFileValidation(event)).resolves.toBeUndefined();
    });

    it('should handle conflict detection events correctly', async () => {
      const event = {
        type: 'conflict_detected' as const,
        payload: {
          conflictId: 'test-conflict',
          filePath: '/test/.module-knowledge.ttl',
          conflictType: 'concurrent_edit' as const,
          baseContent: 'base',
          localChanges: 'local',
          remoteChanges: 'remote',
          resolution: 'manual' as const,
          timestamp: new Date()
        }
      };

      // Should not throw when handling conflict events
      await expect((manager as any).handleConflictDetection(event)).resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await manager.validateKnowledgeFile('/nonexistent/.module-knowledge.ttl');

      expect(result.isValid).toBe(false);
      expect(result.syntaxErrors).toHaveLength(1);
      expect(result.syntaxErrors[0].message).toContain('File not found');
    });

    it('should handle RDF service errors gracefully', async () => {
      (mockRdfService.generateRDF as any).mockRejectedValue(new Error('RDF generation failed'));

      const mockAstResult: AnalysisResult = {
        filePath: '/test/module.ts',
        language: 'typescript',
        nodes: [],
        classes: [],
        functions: [],
        imports: [],
        exports: [],
        dependencies: [],
        complexity: {
          cyclomaticComplexity: 5,
          cognitiveComplexity: 3,
          linesOfCode: 100,
          maintainabilityIndex: 80,
          technicalDebt: 2
        },
        errors: [],
        timestamp: new Date()
      };

      const result = await manager.updateKnowledgeFileFromCode('/test/module.ts', mockAstResult);

      expect(result.success).toBe(false);
      expect(result.error).toContain('RDF generation failed');
    });
  });

  describe('Utility Methods', () => {
    it('should calculate knowledge file path correctly', () => {
      const sourceFilePath = '/project/src/module.ts';
      const expectedPath = '/project/src/.module-knowledge.ttl';
      
      const actualPath = (manager as any).getKnowledgeFilePath(sourceFilePath);
      
      expect(actualPath).toBe(expectedPath);
    });

    it('should calculate checksums consistently', () => {
      const content = 'test content';
      
      const checksum1 = (manager as any).calculateChecksum(content);
      const checksum2 = (manager as any).calculateChecksum(content);
      
      expect(checksum1).toBe(checksum2);
      expect(checksum1).toHaveLength(16); // Truncated to 16 characters
    });

    it('should detect file existence correctly', async () => {
      mockFs.access.mockResolvedValue(undefined);
      
      const exists = await (manager as any).fileExists('/test/file.ttl');
      
      expect(exists).toBe(true);
      expect(mockFs.access).toHaveBeenCalledWith('/test/file.ttl');
    });

    it('should handle file non-existence correctly', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));
      
      const exists = await (manager as any).fileExists('/test/nonexistent.ttl');
      
      expect(exists).toBe(false);
    });
  });
});