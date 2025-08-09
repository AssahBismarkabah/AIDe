# Neo4j Codebase Visualization Guide

This guide shows you exactly how to view and explore your codebase relationships in Neo4j Browser.

## 🌐 Accessing Neo4j Browser

1. **Open Neo4j Browser**: http://localhost:7474
2. **Login Credentials**:
   - Username: `neo4j`
   - Password: `aaswe-password`
   - Database: `neo4j`

## 🔍 Essential Cypher Queries for Codebase Exploration

### 1. **View All Languages in Your Codebase**
```cypher
MATCH (v:MultiLanguageVersion)
RETURN v.languages as languages, 
       v.entityCount as totalEntities,
       v.timestamp as analysisTime
ORDER BY v.timestamp DESC
LIMIT 1
```

### 2. **See All Source Files by Language**
```cypher
MATCH (f:File)
RETURN f.language as language, 
       count(f) as fileCount,
       sum(f.lineCount) as totalLines
ORDER BY fileCount DESC
```

### 3. **View TypeScript Files with Source Code**
```cypher
MATCH (f:File:Typescript)
RETURN f.name as fileName,
       f.filePath as path,
       f.lineCount as lines,
       substring(f.sourceCode, 0, 200) as preview
ORDER BY f.lineCount DESC
LIMIT 10
```

### 4. **Find All Classes in the Codebase**
```cypher
MATCH (c:Class)
RETURN c.name as className,
       c.language as language,
       c.filePath as filePath,
       c.startLine as startLine
ORDER BY c.language, c.name
```

### 5. **Search for Specific Code Patterns**
```cypher
// Find all files containing "Neo4j"
MATCH (f:File)
WHERE f.sourceCode CONTAINS "Neo4j"
RETURN f.name as fileName,
       f.language as language,
       f.filePath as path,
       substring(f.sourceCode, 0, 300) as preview
```

### 6. **View File-Class Relationships**
```cypher
MATCH (f:File)-[r:CONTAINS]->(c:Class)
RETURN f.name as fileName,
       c.name as className,
       c.language as language,
       r.metadata as relationshipData
LIMIT 20
```

### 7. **Explore Method Relationships**
```cypher
MATCH (c:Class)-[r:HAS_METHOD]->(m:Method)
RETURN c.name as className,
       m.name as methodName,
       m.complexity as complexity,
       m.startLine as startLine
ORDER BY m.complexity DESC
LIMIT 15
```

### 8. **Find Import Dependencies**
```cypher
MATCH (f1:File)-[r:IMPORTS]->(f2:File)
RETURN f1.name as fromFile,
       f2.name as toFile,
       f1.language as fromLanguage,
       f2.language as toLanguage,
       r.metadata as importDetails
LIMIT 25
```

## 🎨 Visual Graph Queries

### 9. **Visualize File Dependencies**
```cypher
MATCH (f1:File)-[r:IMPORTS|DEPENDS_ON]->(f2:File)
WHERE f1.language = 'typescript'
RETURN f1, r, f2
LIMIT 50
```

### 10. **Show Class Hierarchy**
```cypher
MATCH (c1:Class)-[r:EXTENDS|IMPLEMENTS]->(c2:Class)
RETURN c1, r, c2
LIMIT 30
```

### 11. **Complete Codebase Overview**
```cypher
MATCH (f:File)-[r1:CONTAINS]->(c:Class)-[r2:HAS_METHOD]->(m:Method)
WHERE f.language = 'typescript'
RETURN f, r1, c, r2, m
LIMIT 20
```

## 🔍 Advanced Search Queries

### 12. **Find Complex Methods**
```cypher
MATCH (m:Method)
WHERE m.complexity > 10
RETURN m.name as methodName,
       m.className as className,
       m.complexity as complexity,
       m.filePath as filePath,
       substring(m.sourceCode, 0, 200) as preview
ORDER BY m.complexity DESC
```

### 13. **Search Across All Languages**
```cypher
MATCH (n)
WHERE n.sourceCode CONTAINS "async"
RETURN labels(n)[0] as nodeType,
       n.name as name,
       n.language as language,
       n.filePath as path
LIMIT 25
```

### 14. **Find Error Handling Patterns**
```cypher
MATCH (n)
WHERE n.sourceCode CONTAINS "try" 
   OR n.sourceCode CONTAINS "catch"
   OR n.sourceCode CONTAINS "throw"
RETURN labels(n)[0] as nodeType,
       n.name as name,
       n.language as language,
       substring(n.sourceCode, 0, 300) as preview
LIMIT 15
```

## 📊 Statistics and Analysis

### 15. **Language Statistics**
```cypher
MATCH (n)
RETURN labels(n)[0] as nodeType,
       n.language as language,
       count(n) as count
ORDER BY language, nodeType
```

### 16. **Largest Files by Language**
```cypher
MATCH (f:File)
RETURN f.language as language,
       f.name as fileName,
       f.lineCount as lines,
       f.size as bytes
ORDER BY f.lineCount DESC
LIMIT 20
```

### 17. **Most Connected Files**
```cypher
MATCH (f:File)
OPTIONAL MATCH (f)-[r]->()
WITH f, count(r) as outgoing
OPTIONAL MATCH ()-[r2]->(f)
WITH f, outgoing, count(r2) as incoming
RETURN f.name as fileName,
       f.language as language,
       outgoing + incoming as totalConnections
ORDER BY totalConnections DESC
LIMIT 15
```

## 🎯 How to Use These Queries

1. **Copy any query** from above
2. **Paste it into Neo4j Browser** query box
3. **Click the play button** or press Ctrl+Enter
4. **Switch between Table and Graph views** using the icons
5. **Click on nodes and relationships** to explore details

## 🌟 Pro Tips

- **Use LIMIT** to avoid overwhelming results
- **Click on nodes** in graph view to see properties
- **Use WHERE clauses** to filter results
- **Combine multiple patterns** for complex queries
- **Export results** using the download button

## 🔧 Troubleshooting

If you don't see data:
1. Make sure Docker containers are running: `docker-compose up -d`
2. Run the analysis: `npm run analyze` or use the MultiLanguageCodeGraphAnalyzer
3. Check Neo4j connection in browser
4. Verify data exists: `MATCH (n) RETURN count(n)`

## 📈 Understanding the Graph Structure

Your codebase is stored as:
- **Files** (`:File:Typescript`, `:File:Python`, etc.) - Complete source code
- **Classes** (`:Class`) - Class definitions with source code
- **Methods** (`:Method`) - Method implementations with source code
- **Relationships** - CONTAINS, HAS_METHOD, IMPORTS, EXTENDS, etc.

Each node contains the actual source code in the `sourceCode` property, making it searchable and accessible for LLM context.