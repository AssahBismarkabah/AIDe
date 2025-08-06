/**
 * AST Analyzer Tests
 * Tests for the AST analysis functionality
 */

import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import ASTAnalyzerFactory from '../src/services/layer1/ast-analyzer';

describe('AST Analyzer', () => {
  const testFilePath = join(__dirname, 'test-file.ts');
  
  beforeEach(() => {
    // Create a test TypeScript file
    const testCode = `
import { readFileSync } from 'fs';
import logger from './logger';

export interface User {
  id: string;
  name: string;
  email?: string;
}

export class UserService {
  private users: User[] = [];

  constructor(private logger: any) {}

  async createUser(name: string, email?: string): Promise<User> {
    const user: User = {
      id: Math.random().toString(36),
      name,
      email
    };
    
    this.users.push(user);
    this.logger.info('User created', { userId: user.id });
    
    return user;
  }

  getUserById(id: string): User | undefined {
    return this.users.find(user => user.id === id);
  }

  private validateEmail(email: string): boolean {
    return email.includes('@');
  }
}

export function processUsers(users: User[]): number {
  let count = 0;
  
  for (const user of users) {
    if (user.email && user.email.includes('@')) {
      count++;
    }
  }
  
  return count;
}

export default UserService;
`;
    
    writeFileSync(testFilePath, testCode);
  });

  afterEach(() => {
    // Clean up test file
    try {
      unlinkSync(testFilePath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Language Detection', () => {
    it('should detect TypeScript from .ts extension', () => {
      const language = ASTAnalyzerFactory.detectLanguage('test.ts');
      expect(language).toBe('typescript');
    });

    it('should detect JavaScript from .js extension', () => {
      const language = ASTAnalyzerFactory.detectLanguage('test.js');
      expect(language).toBe('javascript');
    });

    it('should throw error for unsupported extension', () => {
      expect(() => {
        ASTAnalyzerFactory.detectLanguage('test.unknown');
      }).toThrow('Cannot detect language for file: test.unknown');
    });
  });

  describe('Analyzer Factory', () => {
    it('should return TypeScript analyzer for typescript language', () => {
      const analyzer = ASTAnalyzerFactory.getAnalyzer('typescript');
      expect(analyzer).toBeDefined();
    });

    it('should return same analyzer instance for multiple calls', () => {
      const analyzer1 = ASTAnalyzerFactory.getAnalyzer('typescript');
      const analyzer2 = ASTAnalyzerFactory.getAnalyzer('typescript');
      expect(analyzer1).toBe(analyzer2);
    });

    it('should return Python analyzer for python language', () => {
      const analyzer = ASTAnalyzerFactory.getAnalyzer('python');
      expect(analyzer).toBeDefined();
    });

    it('should return Java analyzer for java language', () => {
      const analyzer = ASTAnalyzerFactory.getAnalyzer('java');
      expect(analyzer).toBeDefined();
    });

    it('should return Go analyzer for go language', () => {
      const analyzer = ASTAnalyzerFactory.getAnalyzer('go');
      expect(analyzer).toBeDefined();
    });

    it('should return Rust analyzer for rust language', () => {
      const analyzer = ASTAnalyzerFactory.getAnalyzer('rust');
      expect(analyzer).toBeDefined();
    });

    it('should return C++ analyzer for cpp language', () => {
      const analyzer = ASTAnalyzerFactory.getAnalyzer('cpp');
      expect(analyzer).toBeDefined();
    });
  });

  describe('File Analysis', () => {
    it('should analyze TypeScript file successfully', async () => {
      const result = await ASTAnalyzerFactory.analyzeFile(testFilePath);
      
      expect(result).toBeDefined();
      expect(result.filePath).toBe(testFilePath);
      expect(result.language).toBe('typescript');
      expect(result.errors).toHaveLength(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should extract functions from TypeScript file', async () => {
      const result = await ASTAnalyzerFactory.analyzeFile(testFilePath);
      
      expect(result.functions.length).toBeGreaterThan(0);
      
      // Check for specific functions
      const createUserFunc = result.functions.find(f => f.name === 'createUser');
      expect(createUserFunc).toBeDefined();
      expect(createUserFunc?.isAsync).toBe(true);
      expect(createUserFunc?.parameters).toHaveLength(2);
      
      const processUsersFunc = result.functions.find(f => f.name === 'processUsers');
      expect(processUsersFunc).toBeDefined();
      expect(processUsersFunc?.isExported).toBe(true);
    });

    it('should extract classes from TypeScript file', async () => {
      const result = await ASTAnalyzerFactory.analyzeFile(testFilePath);
      
      expect(result.classes.length).toBeGreaterThan(0);
      
      const userServiceClass = result.classes.find(c => c.name === 'UserService');
      expect(userServiceClass).toBeDefined();
      expect(userServiceClass?.isExported).toBe(true);
      expect(userServiceClass?.properties.length).toBeGreaterThan(0);
    });

    it('should extract imports from TypeScript file', async () => {
      const result = await ASTAnalyzerFactory.analyzeFile(testFilePath);
      
      expect(result.imports.length).toBeGreaterThan(0);
      
      const fsImport = result.imports.find(i => i.source === 'fs');
      expect(fsImport).toBeDefined();
      expect(fsImport?.imports).toHaveLength(1);
      expect(fsImport?.imports[0].name).toBe('readFileSync');
    });

    it('should extract exports from TypeScript file', async () => {
      const result = await ASTAnalyzerFactory.analyzeFile(testFilePath);
      
      expect(result.exports.length).toBeGreaterThan(0);
      
      const defaultExport = result.exports.find(e => e.isDefault);
      expect(defaultExport).toBeDefined();
      expect(defaultExport?.name).toBe('UserService');
    });

    it('should calculate complexity metrics', async () => {
      const result = await ASTAnalyzerFactory.analyzeFile(testFilePath);
      
      expect(result.complexity).toBeDefined();
      expect(result.complexity.cyclomaticComplexity).toBeGreaterThan(0);
      expect(result.complexity.linesOfCode).toBeGreaterThan(0);
      expect(result.complexity.maintainabilityIndex).toBeGreaterThan(0);
    });
  });

  describe('Multiple File Analysis', () => {
    it('should analyze multiple files', async () => {
      const results = await ASTAnalyzerFactory.analyzeFiles([testFilePath]);
      
      expect(results).toHaveLength(1);
      expect(results[0].filePath).toBe(testFilePath);
    });

    it('should handle mixed file types', async () => {
      // Create a JavaScript test file
      const jsTestFile = join(__dirname, 'test-file.js');
      writeFileSync(jsTestFile, 'function test() { return "hello"; }');
      
      try {
        const results = await ASTAnalyzerFactory.analyzeFiles([testFilePath, jsTestFile]);
        
        expect(results).toHaveLength(2);
        expect(results.find(r => r.language === 'typescript')).toBeDefined();
        expect(results.find(r => r.language === 'javascript')).toBeDefined();
      } finally {
        unlinkSync(jsTestFile);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent file gracefully', async () => {
      const result = await ASTAnalyzerFactory.analyzeFile('non-existent-file.ts');
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('analysis');
      expect(result.errors[0].severity).toBe('error');
    });

    it('should handle invalid TypeScript syntax', async () => {
      const invalidFile = join(__dirname, 'invalid.ts');
      writeFileSync(invalidFile, 'invalid typescript syntax {{{');
      
      try {
        const result = await ASTAnalyzerFactory.analyzeFile(invalidFile);
        expect(result.errors.length).toBeGreaterThan(0);
      } finally {
        unlinkSync(invalidFile);
      }
    });
  });
});