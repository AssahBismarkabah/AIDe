# AST Analysis Engine

Parses source code into Abstract Syntax Trees and extracts structural information.

## Supported Languages

- **TypeScript/JavaScript** - Full ES6+ and TypeScript support
- **Python** - Python 3.x syntax analysis
- **Java** - Complete Java language support with CST parsing
- **Go** - Go language structure analysis
- **Rust** - Rust syntax and ownership analysis
- **C++** - C++ language parsing

## What It Extracts

- **Functions** - Parameters, return types, complexity metrics
- **Classes** - Methods, properties, inheritance relationships
- **Imports/Exports** - Module dependencies and exports
- **Complexity** - Cyclomatic and cognitive complexity
- **Dependencies** - Inter-module relationships

## Usage

```typescript
import { BaseAnalyzer } from './BaseAnalyzer';

const analyzer = new BaseAnalyzer();
const result = await analyzer.analyzeFile('src/example.ts');

console.log(result.functions);  // All functions found
console.log(result.classes);    // All classes found
console.log(result.complexity); // Complexity metrics
```

## Components

- **BaseAnalyzer** - Main analyzer factory and orchestrator
- **TypeScriptAnalyzer** - TypeScript/JavaScript parsing
- **JavaAnalyzer** - Java parsing with production-quality CST conversion
- **PythonAnalyzer** - Python syntax analysis
- **GoAnalyzer** - Go language parsing
- **RustAnalyzer** - Rust syntax analysis
- **CppAnalyzer** - C++ language parsing

All analyzers provide consistent output format for downstream processing.