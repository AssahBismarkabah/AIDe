/**
 * Enhanced TTL Generation Tests
 * 
 * Tests for the enhanced TTL file generation with concrete information
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { EnhancedRDFGenerator } from '../src/services/layer1/rdf-generator/EnhancedRDFGenerator';
import { ConcreteInformationExtractor } from '../src/services/layer1/rdf-generator/ConcreteInformationExtractor';
import { AnalysisResult } from '../src/services/layer1/ast-analyzer/types';

describe('Enhanced TTL Generation', () => {
  let enhancedGenerator: EnhancedRDFGenerator;
  let mockAnalysisResult: AnalysisResult;

  beforeEach(() => {
    enhancedGenerator = new EnhancedRDFGenerator({
      includeBusinessContext: true,
      optimizeForLLM: true,
      optimizeForNeo4j: true
    });

    mockAnalysisResult = {
      filePath: './src/test/example.ts',
      language: 'typescript',
      nodes: [],
      functions: [
        {
          id: 'calculateTotal_func',
          name: 'calculateTotal',
          parameters: [
            { name: 'items', type: 'number[]', optional: false },
            { name: 'taxRate', type: 'number', optional: true }
          ],
          returnType: 'number',
          isAsync: false,
          complexity: 3,
          startLine: 10,
          endLine: 15,
          filePath: './src/test/example.ts',
          isExported: true,
          visibility: 'public',
          dependencies: [],
          calls: []
        }
      ],
      classes: [
        {
          name: 'OrderProcessor',
          methods: [
            {
              id: 'processOrder_method',
              name: 'processOrder',
              parameters: [{ name: 'order', type: 'Order', optional: false }],
              returnType: 'Promise<OrderResult>',
              isAsync: true,
              complexity: 5,
              startLine: 20,
              endLine: 35,
              filePath: './src/test/example.ts',
              isExported: false,
              visibility: 'public',
              dependencies: [],
              calls: []
            }
          ],
          properties: [
            {
              name: 'config',
              type: 'ProcessorConfig',
              visibility: 'private',
              isStatic: false,
              isReadonly: true
            }
          ],
          extends: 'BaseProcessor',
          implements: ['IOrderProcessor'],
          startLine: 18,
          endLine: 50,
          filePath: './src/test/example.ts',
          isExported: true,
          visibility: 'public',
          isAbstract: false,
          id: 'OrderProcessor_class'
        }
      ],
      imports: [
        {
          id: 'lodash_import',
          source: 'lodash',
          imports: [
            { name: 'map', isDefault: false, alias: undefined, isNamespace: false },
            { name: 'filter', isDefault: false, alias: undefined, isNamespace: false }
          ],
          filePath: './src/test/example.ts',
          startLine: 1,
          endLine: 1
        }
      ],
      exports: [
        {
          id: 'OrderProcessor_export',
          name: 'OrderProcessor',
          type: 'class',
          isDefault: false,
          filePath: './src/test/example.ts',
          startLine: 18,
          endLine: 50
        },
        {
          id: 'calculateTotal_export',
          name: 'calculateTotal',
          type: 'function',
          isDefault: false,
          filePath: './src/test/example.ts',
          startLine: 10,
          endLine: 15
        }
      ],
      dependencies: ['lodash', 'moment'],
      complexity: {
        cyclomaticComplexity: 8,
        cognitiveComplexity: 6,
        linesOfCode: 42,
        maintainabilityIndex: 75,
        technicalDebt: 2
      },
      errors: [],
      timestamp: new Date()
    };
  });

  describe('generateEnhancedRDF', () => {
    it('should generate TTL with concrete information', async () => {
      const result = await enhancedGenerator.generateEnhancedRDF(
        mockAnalysisResult,
        mockAnalysisResult.filePath
      );

      expect(result).toBeDefined();
      expect(result.moduleId).toBe('example');
      expect(result.rdfContent).toBeTruthy();
      expect(result.size).toBeGreaterThan(0);
      expect(result.format).toBe('turtle');
    });

    it('should include actual class names in TTL', async () => {
      const result = await enhancedGenerator.generateEnhancedRDF(
        mockAnalysisResult,
        mockAnalysisResult.filePath
      );

      expect(result.rdfContent).toContain('OrderProcessor');
    });

    it('should include actual method names in TTL', async () => {
      const result = await enhancedGenerator.generateEnhancedRDF(
        mockAnalysisResult,
        mockAnalysisResult.filePath
      );

      expect(result.rdfContent).toContain('processOrder');
    });

    it('should include actual function names in TTL', async () => {
      const result = await enhancedGenerator.generateEnhancedRDF(
        mockAnalysisResult,
        mockAnalysisResult.filePath
      );

      expect(result.rdfContent).toContain('calculateTotal');
    });

    it('should include dependency information in TTL', async () => {
      const result = await enhancedGenerator.generateEnhancedRDF(
        mockAnalysisResult,
        mockAnalysisResult.filePath
      );

      expect(result.rdfContent).toContain('lodash');
    });

    it('should include proper TTL syntax', async () => {
      const result = await enhancedGenerator.generateEnhancedRDF(
        mockAnalysisResult,
        mockAnalysisResult.filePath
      );

      expect(result.rdfContent).toContain('@prefix');
      expect(result.rdfContent).toContain('code:');
      expect(result.rdfContent).toContain('module:');
    });

    it('should include business context placeholders', async () => {
      const result = await enhancedGenerator.generateEnhancedRDF(
        mockAnalysisResult,
        mockAnalysisResult.filePath
      );

      const content = result.rdfContent;
      const hasBusinessContext = content.includes('business:') || 
                                content.includes('BUSINESS_DOMAIN') ||
                                content.includes('businessRules') ||
                                content.includes('useCases');
      
      expect(hasBusinessContext).toBe(true);
    });

    it('should include quality metrics information', async () => {
      const result = await enhancedGenerator.generateEnhancedRDF(
        mockAnalysisResult,
        mockAnalysisResult.filePath
      );

      const content = result.rdfContent;
      const hasQualityMetrics = content.includes('quality:') || 
                               content.includes('complexity') ||
                               content.includes('maintainability');
      
      expect(hasQualityMetrics).toBe(true);
    });

    it('should provide accurate statistics', async () => {
      const result = await enhancedGenerator.generateEnhancedRDF(
        mockAnalysisResult,
        mockAnalysisResult.filePath
      );

      expect(result.statistics.classCount).toBe(1);
      expect(result.statistics.methodCount).toBeGreaterThan(0);
      expect(result.statistics.dependencyCount).toBe(2);
    });

    it('should handle empty analysis results gracefully', async () => {
      const emptyResult: AnalysisResult = {
        filePath: './src/test/empty.ts',
        language: 'typescript',
        nodes: [],
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        dependencies: [],
        complexity: {
          cyclomaticComplexity: 0,
          cognitiveComplexity: 0,
          linesOfCode: 0,
          maintainabilityIndex: 100,
          technicalDebt: 0
        },
        errors: [],
        timestamp: new Date()
      };

      const result = await enhancedGenerator.generateEnhancedRDF(
        emptyResult,
        emptyResult.filePath
      );

      expect(result).toBeDefined();
      expect(result.rdfContent).toBeTruthy();
      expect(result.statistics.classCount).toBe(0);
      expect(result.statistics.methodCount).toBe(0);
    });

    it('should generate different content for different modules', async () => {
      const result1 = await enhancedGenerator.generateEnhancedRDF(
        mockAnalysisResult,
        './src/module1.ts'
      );

      const differentAnalysis = {
        ...mockAnalysisResult,
        filePath: './src/module2.ts',
        classes: [
          {
            ...mockAnalysisResult.classes[0],
            name: 'PaymentProcessor'
          }
        ]
      };

      const result2 = await enhancedGenerator.generateEnhancedRDF(
        differentAnalysis,
        './src/module2.ts'
      );

      expect(result1.moduleId).not.toBe(result2.moduleId);
      expect(result1.rdfContent).toContain('OrderProcessor');
      expect(result2.rdfContent).toContain('PaymentProcessor');
    });
  });

  describe('ConcreteInformationExtractor integration', () => {
    it('should work with ConcreteInformationExtractor', () => {
      const extractor = new ConcreteInformationExtractor();
      const concreteStructure = extractor.extractConcreteStructure(mockAnalysisResult);

      expect(concreteStructure).toBeDefined();
      expect(concreteStructure.actualClasses).toHaveLength(1);
      expect(concreteStructure.actualFunctions).toHaveLength(1);
      expect(concreteStructure.actualDependencies).toHaveLength(2);
      expect(concreteStructure.actualClasses[0].name).toBe('OrderProcessor');
      expect(concreteStructure.actualFunctions[0].name).toBe('calculateTotal');
    });
  });
});