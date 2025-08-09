import { Project, SourceFile, ClassDeclaration, MethodDeclaration, ImportDeclaration } from 'ts-morph';
import { cruise } from 'dependency-cruiser';
import * as path from 'path';
import * as fs from 'fs';
import { Neo4jDatabaseService } from '../layer2/neo4j-database/Neo4jDatabaseService';

export interface CodeEntity {
  id: string;
  name: string;
  type: 'File' | 'Class' | 'Method' | 'Interface' | 'Function';
  sourceCode: string;
  filePath: string;
  startLine: number;
  endLine: number;
  version: string;
  lastModified: Date;
  metadata: Record<string, any>;
}

export interface CodeRelationship {
  from: string;
  to: string;
  type: 'IMPORTS' | 'EXTENDS' | 'IMPLEMENTS' | 'CALLS' | 'USES' | 'CONTAINS' | 'DEPENDS_ON';
  metadata: Record<string, any>;
  version: string;
}

export interface VersionedCodeGraph {
  version: string;
  timestamp: Date;
  entities: CodeEntity[];
  relationships: CodeRelationship[];
  ttlSyncHash: string;
  gitCommit?: string | undefined;
}

/**
 * CodeGraphAnalyzer - Advanced code graph analysis with versioning and TTL synchronization
 * 
 * This service creates a comprehensive code graph by:
 * 1. Using ts-morph for TypeScript AST analysis
 * 2. Using dependency-cruiser for module dependency analysis
 * 3. Storing actual source code content in Neo4j
 * 4. Maintaining version synchronization with TTL files
 * 5. Providing rich context for LLM queries
 */
export class CodeGraphAnalyzer {
  private project: Project;
  private neo4jService: Neo4jDatabaseService;
  private currentVersion: string;

  constructor(neo4jService: Neo4jDatabaseService) {
    this.neo4jService = neo4jService;
    this.project = new Project({
      tsConfigFilePath: 'tsconfig.json',
      skipAddingFilesFromTsConfig: false
    });
    this.currentVersion = this.generateVersion();
  }

  /**
   * Analyze entire codebase and create versioned code graph
   */
  async analyzeCodebase(projectPath: string): Promise<VersionedCodeGraph> {
    console.log('🔍 Starting comprehensive code graph analysis...');
    
    const startTime = Date.now();
    const entities: CodeEntity[] = [];
    const relationships: CodeRelationship[] = [];

    try {
      // 1. Analyze TypeScript/JavaScript files with ts-morph
      console.log('📝 Analyzing TypeScript/JavaScript files...');
      const tsEntities = await this.analyzeTypeScriptFiles();
      entities.push(...tsEntities.entities);
      relationships.push(...tsEntities.relationships);

      // 2. Analyze module dependencies with dependency-cruiser
      console.log('🔗 Analyzing module dependencies...');
      const depEntities = await this.analyzeDependencies(projectPath);
      relationships.push(...depEntities);

      // 3. Store in Neo4j with versioning
      console.log('💾 Storing code graph in Neo4j...');
      await this.storeVersionedGraph(entities, relationships);

      // 4. Generate TTL sync hash
      const ttlSyncHash = await this.generateTTLSyncHash();

      const codeGraph: VersionedCodeGraph = {
        version: this.currentVersion,
        timestamp: new Date(),
        entities,
        relationships,
        ttlSyncHash,
        gitCommit: await this.getCurrentGitCommit()
      };

      const duration = Date.now() - startTime;
      console.log(`✅ Code graph analysis completed in ${duration}ms`);
      console.log(`📊 Entities: ${entities.length}, Relationships: ${relationships.length}`);

      return codeGraph;

    } catch (error) {
      console.error('❌ Code graph analysis failed:', error);
      throw error;
    }
  }

  /**
   * Analyze TypeScript files using ts-morph
   */
  private async analyzeTypeScriptFiles(): Promise<{
    entities: CodeEntity[];
    relationships: CodeRelationship[];
  }> {
    const entities: CodeEntity[] = [];
    const relationships: CodeRelationship[] = [];

    const sourceFiles = this.project.getSourceFiles();
    
    for (const sourceFile of sourceFiles) {
      // Skip node_modules and test files
      if (sourceFile.getFilePath().includes('node_modules') || 
          sourceFile.getFilePath().includes('.test.') ||
          sourceFile.getFilePath().includes('.spec.')) {
        continue;
      }

      // Create file entity
      const fileEntity = await this.createFileEntity(sourceFile);
      entities.push(fileEntity);

      // Analyze classes
      const classes = sourceFile.getClasses();
      for (const classDecl of classes) {
        const classEntity = await this.createClassEntity(classDecl, sourceFile);
        entities.push(classEntity);

        // Create file-class relationship
        relationships.push({
          from: fileEntity.id,
          to: classEntity.id,
          type: 'CONTAINS',
          metadata: { line: classDecl.getStartLineNumber() },
          version: this.currentVersion
        });

        // Analyze methods
        const methods = classDecl.getMethods();
        for (const method of methods) {
          const methodEntity = await this.createMethodEntity(method, classDecl, sourceFile);
          entities.push(methodEntity);

          // Create class-method relationship
          relationships.push({
            from: classEntity.id,
            to: methodEntity.id,
            type: 'CONTAINS',
            metadata: { 
              line: method.getStartLineNumber(),
              visibility: method.getModifiers().map(m => m.getText()).join(' ')
            },
            version: this.currentVersion
          });
        }

        // Analyze inheritance
        const heritage = classDecl.getHeritageClauses();
        for (const clause of heritage) {
          const types = clause.getTypeNodes();
          for (const type of types) {
            const typeName = type.getText();
            relationships.push({
              from: classEntity.id,
              to: `class:${typeName}`,
              type: clause.getToken().toString().includes('extends') ? 'EXTENDS' : 'IMPLEMENTS',
              metadata: { typeName },
              version: this.currentVersion
            });
          }
        }
      }

      // Analyze imports
      const imports = sourceFile.getImportDeclarations();
      for (const importDecl of imports) {
        const importRel = await this.createImportRelationship(importDecl, fileEntity);
        if (importRel) {
          relationships.push(importRel);
        }
      }

      // Analyze function calls (simplified)
      const callRelationships = await this.analyzeFunctionCalls(sourceFile, fileEntity);
      relationships.push(...callRelationships);
    }

    return { entities, relationships };
  }

  /**
   * Create file entity from source file
   */
  private async createFileEntity(sourceFile: SourceFile): Promise<CodeEntity> {
    const filePath = sourceFile.getFilePath();
    const relativePath = path.relative(process.cwd(), filePath);
    const sourceCode = sourceFile.getFullText();
    const lines = sourceCode.split('\n');

    return {
      id: `file:${relativePath}`,
      name: path.basename(filePath),
      type: 'File',
      sourceCode,
      filePath: relativePath,
      startLine: 1,
      endLine: lines.length,
      version: this.currentVersion,
      lastModified: new Date(),
      metadata: {
        language: 'TypeScript',
        size: sourceCode.length,
        lineCount: lines.length,
        extension: path.extname(filePath)
      }
    };
  }

  /**
   * Create class entity from class declaration
   */
  private async createClassEntity(classDecl: ClassDeclaration, sourceFile: SourceFile): Promise<CodeEntity> {
    const className = classDecl.getName() || 'Anonymous';
    const sourceCode = classDecl.getFullText();
    const filePath = path.relative(process.cwd(), sourceFile.getFilePath());

    return {
      id: `class:${filePath}:${className}`,
      name: className,
      type: 'Class',
      sourceCode,
      filePath,
      startLine: classDecl.getStartLineNumber(),
      endLine: classDecl.getEndLineNumber(),
      version: this.currentVersion,
      lastModified: new Date(),
      metadata: {
        isExported: classDecl.isExported(),
        isAbstract: classDecl.isAbstract(),
        modifiers: classDecl.getModifiers().map(m => m.getText()),
        methodCount: classDecl.getMethods().length,
        propertyCount: classDecl.getProperties().length
      }
    };
  }

  /**
   * Create method entity from method declaration
   */
  private async createMethodEntity(
    method: MethodDeclaration, 
    classDecl: ClassDeclaration, 
    sourceFile: SourceFile
  ): Promise<CodeEntity> {
    const methodName = method.getName();
    const className = classDecl.getName() || 'Anonymous';
    const sourceCode = method.getFullText();
    const filePath = path.relative(process.cwd(), sourceFile.getFilePath());

    return {
      id: `method:${filePath}:${className}:${methodName}`,
      name: methodName,
      type: 'Method',
      sourceCode,
      filePath,
      startLine: method.getStartLineNumber(),
      endLine: method.getEndLineNumber(),
      version: this.currentVersion,
      lastModified: new Date(),
      metadata: {
        className,
        isAsync: method.isAsync(),
        isStatic: method.isStatic(),
        visibility: method.getModifiers().map(m => m.getText()).join(' '),
        returnType: method.getReturnTypeNode()?.getText(),
        parameters: method.getParameters().map(p => ({
          name: p.getName(),
          type: p.getTypeNode()?.getText(),
          isOptional: p.isOptional()
        })),
        complexity: this.calculateCyclomaticComplexity(sourceCode)
      }
    };
  }

  /**
   * Create import relationship
   */
  private async createImportRelationship(
    importDecl: ImportDeclaration, 
    fileEntity: CodeEntity
  ): Promise<CodeRelationship | null> {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    
    // Skip external modules (node_modules)
    if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) {
      return null;
    }

    return {
      from: fileEntity.id,
      to: `file:${moduleSpecifier}`,
      type: 'IMPORTS',
      metadata: {
        moduleSpecifier,
        importClause: importDecl.getImportClause()?.getText(),
        line: importDecl.getStartLineNumber()
      },
      version: this.currentVersion
    };
  }

  /**
   * Analyze function calls (simplified pattern matching)
   */
  private async analyzeFunctionCalls(
    sourceFile: SourceFile, 
    fileEntity: CodeEntity
  ): Promise<CodeRelationship[]> {
    const relationships: CodeRelationship[] = [];
    const sourceCode = sourceFile.getFullText();
    
    // Simple regex patterns for common call patterns
    const callPatterns = [
      /(\w+)\.(\w+)\(/g,  // object.method()
      /new\s+(\w+)\(/g,   // new Constructor()
      /(\w+)\(/g          // function()
    ];

    for (const pattern of callPatterns) {
      let match;
      while ((match = pattern.exec(sourceCode)) !== null) {
        const [fullMatch, object, method] = match;
        
        relationships.push({
          from: fileEntity.id,
          to: method ? `method:${object}:${method}` : `function:${object}`,
          type: 'CALLS',
          metadata: {
            callExpression: fullMatch,
            line: this.getLineNumber(sourceCode, match.index)
          },
          version: this.currentVersion
        });
      }
    }

    return relationships;
  }

  /**
   * Analyze module dependencies using dependency-cruiser
   */
  private async analyzeDependencies(_projectPath: string): Promise<CodeRelationship[]> {
    const relationships: CodeRelationship[] = [];

    try {
      const cruiseResult = await cruise(
        ['src/**/*.ts', 'src/**/*.js'],
        {
          exclude: {
            path: 'node_modules|test|spec'
          },
          outputType: 'json'
        },
        {
          bustTheCache: true
        }
      );

      if (cruiseResult && typeof cruiseResult === 'object') {
        const modules = (cruiseResult as any).modules || [];
        
        for (const module of modules) {
          const fromId = `file:${module.source}`;
          
          for (const dependency of module.dependencies || []) {
            relationships.push({
              from: fromId,
              to: `file:${dependency.resolved}`,
              type: 'DEPENDS_ON',
              metadata: {
                dependencyType: dependency.dependencyTypes?.join(','),
                circular: dependency.circular,
                dynamic: dependency.dynamic
              },
              version: this.currentVersion
            });
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Dependency analysis failed:', error instanceof Error ? error.message : String(error));
    }

    return relationships;
  }

  /**
   * Store versioned graph in Neo4j
   */
  private async storeVersionedGraph(
    entities: CodeEntity[], 
    relationships: CodeRelationship[]
  ): Promise<void> {
    const session = this.neo4jService.getSession();

    try {
      // Create version node
      await session.run(`
        MERGE (v:Version {version: $version})
        SET v.timestamp = datetime($timestamp),
            v.entityCount = $entityCount,
            v.relationshipCount = $relationshipCount
      `, {
        version: this.currentVersion,
        timestamp: new Date().toISOString(),
        entityCount: entities.length,
        relationshipCount: relationships.length
      });

      // Store entities
      for (const entity of entities) {
        await session.run(`
          MERGE (e:${entity.type} {id: $id, version: $version})
          SET e.name = $name,
              e.sourceCode = $sourceCode,
              e.filePath = $filePath,
              e.startLine = $startLine,
              e.endLine = $endLine,
              e.lastModified = datetime($lastModified),
              e.metadata = $metadata
          
          WITH e
          MATCH (v:Version {version: $version})
          MERGE (v)-[:CONTAINS]->(e)
        `, {
          id: entity.id,
          version: entity.version,
          name: entity.name,
          sourceCode: entity.sourceCode,
          filePath: entity.filePath,
          startLine: entity.startLine,
          endLine: entity.endLine,
          lastModified: entity.lastModified.toISOString(),
          metadata: JSON.stringify(entity.metadata)
        });
      }

      // Store relationships
      for (const rel of relationships) {
        await session.run(`
          MATCH (from {id: $fromId, version: $version})
          MATCH (to {id: $toId, version: $version})
          MERGE (from)-[r:${rel.type} {version: $version}]->(to)
          SET r.metadata = $metadata
        `, {
          fromId: rel.from,
          toId: rel.to,
          version: rel.version,
          metadata: JSON.stringify(rel.metadata)
        });
      }

    } finally {
      await session.close();
    }
  }

  /**
   * Generate TTL sync hash for version correlation
   */
  private async generateTTLSyncHash(): Promise<string> {
    // Find all TTL files
    const ttlFiles = await this.findTTLFiles();
    let combinedContent = '';

    for (const ttlFile of ttlFiles) {
      if (fs.existsSync(ttlFile)) {
        combinedContent += fs.readFileSync(ttlFile, 'utf8');
      }
    }

    // Simple hash generation (could use crypto for production)
    return Buffer.from(combinedContent).toString('base64').slice(0, 16);
  }

  /**
   * Find all TTL files in the project
   */
  private async findTTLFiles(): Promise<string[]> {
    const ttlFiles: string[] = [];
    
    const searchDirs = ['src', 'scripts', '.aaswe'];
    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        const files = this.findFilesRecursive(dir, '.ttl');
        ttlFiles.push(...files);
      }
    }

    return ttlFiles;
  }

  /**
   * Find files recursively
   */
  private findFilesRecursive(dir: string, extension: string): string[] {
    const files: string[] = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          files.push(...this.findFilesRecursive(fullPath, extension));
        } else if (entry.name.endsWith(extension)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore permission errors
    }

    return files;
  }

  /**
   * Get current Git commit hash
   */
  private async getCurrentGitCommit(): Promise<string | undefined> {
    try {
      const { execSync } = require('child_process');
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return undefined;
    }
  }

  /**
   * Generate version string
   */
  private generateVersion(): string {
    return `v${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate cyclomatic complexity (simplified)
   */
  private calculateCyclomaticComplexity(code: string): number {
    const complexityKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch', '&&', '||', '?'];
    let complexity = 1;

    for (const keyword of complexityKeywords) {
      const matches = code.match(new RegExp(`\\b${keyword}\\b`, 'g'));
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Get line number from character index
   */
  private getLineNumber(text: string, index: number): number {
    return text.substring(0, index).split('\n').length;
  }

  /**
   * Query code graph
   */
  async queryCodeGraph(query: string, version?: string): Promise<any[]> {
    const session = this.neo4jService.getSession();
    
    try {
      const versionFilter = version ? `{version: "${version}"}` : '';
      const cypherQuery = query.replace(/\{version\}/g, versionFilter);
      
      const result = await session.run(cypherQuery);
      return result.records.map(record => record.toObject());
      
    } finally {
      await session.close();
    }
  }

  /**
   * Get source code for entity
   */
  async getSourceCode(entityId: string, version?: string): Promise<string | null> {
    const session = this.neo4jService.getSession();
    
    try {
      const query = `
        MATCH (e {id: $entityId${version ? ', version: $version' : ''}})
        RETURN e.sourceCode as sourceCode
        ORDER BY e.lastModified DESC
        LIMIT 1
      `;
      
      const result = await session.run(query, { entityId, version });
      return result.records.length > 0 ? result.records[0].get('sourceCode') : null;
      
    } finally {
      await session.close();
    }
  }

  /**
   * Search code patterns across versions
   */
  async searchCodePatterns(
    pattern: string, 
    entityType?: string, 
    version?: string
  ): Promise<any[]> {
    const session = this.neo4jService.getSession();
    
    try {
      let query = `
        MATCH (e${entityType ? `:${entityType}` : ''}${version ? ' {version: $version}' : ''})
        WHERE e.sourceCode CONTAINS $pattern 
           OR e.name CONTAINS $pattern
        RETURN e.id as id, 
               e.name as name,
               labels(e)[0] as type,
               e.filePath as filePath,
               e.startLine as startLine,
               e.endLine as endLine,
               substring(e.sourceCode, 0, 300) as preview,
               e.version as version
        ORDER BY e.lastModified DESC
        LIMIT 20
      `;
      
      const result = await session.run(query, { pattern, version });
      return result.records.map(record => record.toObject());
      
    } finally {
      await session.close();
    }
  }
}