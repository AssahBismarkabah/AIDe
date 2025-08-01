<!-- Slide number: 1 -->

![preencoded.png](Image0.jpg)

 AI-Assisted Software Engineering
 A Knowledge Graph-Centric Approach to Modernization and Development
 Transforming software systems through intelligent knowledge graphs, AI-powered analysis, and automated development workflows

### Notes:

<!-- Slide number: 2 -->

![preencoded.png](Image0.jpg)

PART I
 The Foundational Architecture
 From Source Code to a Queryable Knowledge Graph
 Exploring the evolution of software engineering towards AI-assisted development, where codebases become dynamic, queryable knowledge bases that serve as digital twins of software systems for automated analysis, reasoning, and generation capabilities.

### Notes:

<!-- Slide number: 3 -->

![preencoded.png](Image0.jpg)
1.1 Principles of Software Intelligence
The Codebase as a Knowledge Graph

![preencoded.png](Image1.jpg)
Core Ontology Components
A structured representation of all entities, relationships, and dependencies within a software codebase

![preencoded.png](Image2.jpg)
Nodes (Entities)
Fundamental building blocks representing every component of the software system
Examples:
 File, Directory, Class, Interface, Function, Method, Variable, Parameter,
Module, Component

![preencoded.png](Image3.jpg)
Edges (Relationships)
Semantic connections defining structure and behavior between nodes
Examples:
 IMPORTS, EXPORTS, CALLS, IMPLEMENTS, EXTENDS, HAS_METHOD,
DEPENDS_ON

![preencoded.png](Image4.jpg)
Properties (Attributes)
Key-value pairs enriching nodes and edges with critical metadata
Examples:
 code_snippet, cyclomatic_complexity, author, commit_hash,
access_modifier, embedding

### Notes:

<!-- Slide number: 4 -->

![preencoded.png](Image0.jpg)
1.2 The Integrated AI-Powered Toolchain
Four-Layer Architecture for Code Intelligence

![preencoded.png](Image1.jpg)

1
AI-Powered Fact Extraction & Orchestration
AI-driven workflow using hybrid approach: AST + LLM analysis
Tech:
 LangChain, crewAI, MCP, CodeGraph Analyzer

![preencoded.png](Image2.jpg)

2
Graph Database
Central repository storing extracted facts and relationships
Tech:
 Neo4j, Cypher query language

![preencoded.png](Image3.jpg)

3
AI/LLM Integration Layer
Reasoning engine translating natural language to Cypher queries
Tech:
 GPT-4, Claude, GraphCypherQAChain

![preencoded.png](Image4.jpg)

4
Artifact Generation & Workflow Automation
Output layer translating insights into development artifacts
Tech:
 docToolchain, Jira REST API, arc42

### Notes:

<!-- Slide number: 5 -->

![preencoded.png](Image0.jpg)
1.3 The Role of Generative AI and RAG
Graph RAG Workflow for Software Engineering

![preencoded.png](Image1.jpg)
Graph RAG Workflow
Connecting LLMs to Code Knowledge Graphs for accurate, context-aware responses

1
User Query
Developer poses natural language question about codebase

2
Text-to-Cypher Translation
LLM translates query into precise Cypher query using schema context

3
Knowledge Graph Query Execution
Cypher query executed against Neo4j to retrieve relevant subgraph

4
Augmentation Step
Subgraph serialized and prepended to original query as context

5
Generation Step
LLM generates accurate answer using structured factual context

Key Benefit:
 Relevance compression - provides dense, structured context instead of
noisy source code chunks

### Notes:

<!-- Slide number: 6 -->

![preencoded.png](Image0.jpg)

PART II
 Case Study: Analyzing Existing Systems
 for Modernization
 Demonstrating the practical application of knowledge graph-centric approaches through reverse engineering, fact extraction, and systematic analysis of legacy systems to identify modernization opportunities and refactoring strategies.

### Notes:

<!-- Slide number: 7 -->

![preencoded.png](Image0.jpg)
2.1 Phase 1: Reverse Engineering and Fact Extraction
Analyzing Legacy Systems for Modernization

Two-Pronged Approach

![preencoded.png](Image1.jpg)
Static Analysis
Parse source code to generate Abstract Syntax Tree (AST)
• Declared relationships
• Compile-time architecture
• Code structure analysis

![preencoded.png](Image2.jpg)
Dynamic Analysis
LLMs analyze runtime logs and behavior
• Operational dependencies
• Real-world usage patterns
• Hidden runtime relationships

![preencoded.png](Image3.jpg)
Hybrid Approach
AST + LLM Analysis

 60% → 95% Accuracy
Language-Specific Parsing

COBOL
• PROGRAM-ID extraction
• COPYBOOK dependencies
• CALL statement mapping
• Business rule slicing
Impact:
 6 weeks → 2 weeks (10K lines)

C++
• Template instantiation
• Preprocessor handling
• Pointer dependency tracking
• Complex grammar parsing
Tools:
 Columbus, CodeGraph Analyzer

Java/.NET
• Bytecode analysis
• Runtime instrumentation
• Reflection handling
• Framework integration

### Notes:

<!-- Slide number: 8 -->

![preencoded.png](Image0.jpg)
2.2 Phase 2: Knowledge Graph Construction and Enrichment
From Raw Facts to Semantic Knowledge

![preencoded.png](Image1.jpg)
Two-Step Construction Process
Transforming extracted facts into a rich, queryable knowledge graph

1

Data Ingestion
Transform extracted facts into (subject, predicate, object) triples

 Example: FunctionA() inside FunctionB()
 → (FunctionB, CALLS, FunctionA)
Output:
 Structural "skeleton" in Neo4j database

![preencoded.png](Image2.jpg)

2

AI-Powered Semantic Enrichment
Add human-understandable semantics using RAG pattern
Process:
 Iterate through nodes → Retrieve code snippets → LLM summarization →
Store as summary property
Output:
 "Multi-modal" KG with structural + natural language descriptions

Key Benefits
• Machine-readable structural relationships
• Human-readable natural language descriptions
• Accessible to wider range of stakeholders
• Foundation for systematic analysis

### Notes:

<!-- Slide number: 9 -->

![preencoded.png](Image0.jpg)
2.3 Phase 3: Analysis and Refactoring Identification
Data-Driven Modernization Strategy

Identifying Modernization Candidates

![preencoded.png](Image1.jpg)
Low-Hanging Fruit
Find well-isolated components with high business value

 // Find highly-used classes with no outgoing dependencies
 MATCH (c:Class)
 WHERE NOT (c)-->() AND size((c)<--()) > 10
 RETURN c.name AS ClassName, size((c)<--()) AS IncomingCalls
 ORDER BY IncomingCalls DESC

![preencoded.png](Image2.jpg)
Key Benefits
• Data-driven vs. intuitive decisions
• Systematic vs. ad-hoc analysis
• Automated vs. manual review
• Objective vs. subjective assessment
Automated Code Smell Detection

God Class
Class with too much intelligence, many methods/fields, low cohesion

 MATCH (c:Class) WHERE size((c)-->()) > 20
 RETURN c.name, size((c)-->()) AS MethodCount

Feature Envy
Method more interested in another class than its own

 MATCH (m:Method)-->(c1:Class),
 (m)-->(other_m:Method)-->(c2:Class)
 WHERE c1 <> c2 AND foreign_calls > own_calls

High Coupling
Module with excessive dependencies on other modules

 MATCH (m:Module)-->(dep:Module)
 WITH m, count(dep) AS dependencies
 WHERE dependencies > threshold

Transformation:
 From manual, subjective architectural review to automated, objective
code quality assessment

### Notes:

<!-- Slide number: 10 -->

![preencoded.png](Image0.jpg)

PART III
 Case Study: Guiding New Application Development
 Demonstrating how knowledge graph-centric approaches guide the development of new applications through ontology-driven design, continuous CI/CD integration, and automated architectural governance to ensure consistency and quality from the ground up.

### Notes:

<!-- Slide number: 11 -->

![preencoded.png](Image0.jpg)
3.1 Ontology-Driven Design and Development
Knowledge-Graph-First Approach

Paradigm Inversion

❌ Traditional Approach
1️⃣
Write code first
2️⃣
Derive documentation later
3️⃣
Understand architecture afterward

✅ Knowledge-Graph-First
1️⃣
Define domain & architecture ontology
2️⃣
Generate code scaffolds
3️⃣
Implement within blueprint

Result:
 Machine-readable blueprint established before any implementation code is
written
Development Workflow

1
Model the Domain and Architecture
Architects, domain experts, and lead developers collaborate to construct "target state" knowledge graph
• Define key entities (Customer, Order)
• Specify logical modules (AuthenticationService)
• Establish allowed relationships
• Create architectural constraints

2
Generate Code Scaffolds
Target state ontology programmatically generates initial application scaffolding
• Class shells and interface definitions
• API contracts (OpenAPI specifications)
• Project structures
• Perfect architectural alignment from start

3
Knowledge-Driven Development
Continuous analysis and integration maintains live, accurate KG representation
• Real-time code analysis
• Automatic KG updates
• Live architectural validation
• Continuous compliance checking

### Notes:

<!-- Slide number: 12 -->

![preencoded.png](Image0.jpg)
3.2 Continuous KG Integration in CI/CD
Real-Time Knowledge Graph Maintenance

Automated Pipeline Integration

![preencoded.png](Image1.jpg)
Process Integration
Dedicated CI/CD job runs on every commit or pull request
• Triggered automatically on code changes
• Invokes CodeGraph Analyzer
• Integrated into existing workflows

![preencoded.png](Image2.jpg)

![preencoded.png](Image3.jpg)
Automated Analysis & Update
Incremental parsing and knowledge graph updates
• Parse only changed files
• Extract new/modified facts
• Update Neo4j database incrementally
• Maintain real-time isomorphic representation

![preencoded.png](Image4.jpg)

![preencoded.png](Image5.jpg)
Elimination of Documentation Debt
KG as single source of truth, never out of sync
• Living representation of code
• Accessible to humans and tools
• Always current architecture view
Key Benefits

![preencoded.png](Image6.jpg)
Real-Time Synchronization
Knowledge graph remains current with every code change, providing accurate architectural insights

![preencoded.png](Image7.jpg)
High Efficiency
Incremental updates process only changed files, minimizing computational overhead

![preencoded.png](Image8.jpg)
Single Source of Truth
Eliminates outdated documentation and architectural diagrams permanently

Integration Flow
📝
Commit/PR
 → Trigger Analysis
🔍
Parse Changes
 → Extract Facts
📊
Update KG
 → Maintain Sync
✅
Validate
 → Ready for Merge

### Notes:

<!-- Slide number: 13 -->

![preencoded.png](Image0.jpg)
3.3 Automated Architectural Governance
Self-Healing Architecture Through KG Validation

Automated Validation Process

![preencoded.png](Image1.jpg)
Architectural Drift Detection
CI/CD pipeline executes Cypher queries to detect rule violations

 // Check for illegal calls from UI layer to DataAccess layer
 MATCH (ui_comp:Component {layer:'UI'})-->
 (db_method:Method)-->(db_comp:Component {layer:'DataAccess'})
 RETURN ui_comp.name AS ViolatingComponent,
 db_method.name AS IllegalCall

![preencoded.png](Image2.jpg)
Automated Feedback Loop
1. Violation Detected:
 Query returns results
2. Build Fails:
 CI build stops immediately
3. Specific Feedback:
 Comment posted on PR
4. Team Alert:
 Development team notified
5. Prevention:
 Code blocked from merge
Architect Role Evolution

Traditional Model ❌
• Manual periodic reviews
• Slow, infrequent, error-prone
• Architect as gatekeeper
• Late feedback → costly rework
Knowledge Graph Model ✅
• Automated continuous validation
• Real-time, accurate, consistent
• Architect as "rulesmith"
• Immediate feedback → prevention

Self-Healing Architecture
System actively enforces its own design principles

Scalable Expertise
Architect's intent scales across entire organization

Continuous Integrity
Architectural integrity maintained automatically as team grows

Result:
 Architecture becomes active, automated participant in development process

### Notes:

<!-- Slide number: 14 -->

![preencoded.png](Image0.jpg)

PART IV
 Automated Artifact Generation
 from the Knowledge Graph
 Transforming knowledge graph insights into tangible development artifacts including architectural documentation, test cases, and automated project management workflows to streamline the entire software development lifecycle.

### Notes:

<!-- Slide number: 15 -->

![preencoded.png](Image0.jpg)
4.1 Automated Documentation Generation
Living Architecture Documentation with arc42

Technical Workflow

1
Define Queries for arc42 Sections
Create library of Cypher queries for each arc42 template section

Section 5 (Building Block View)
Query: Module/Component nodes + DEPENDS_ON relationships

Section 6 (Runtime View)
Query: Trace user interactions through CALLS graph

Section 8 (Cross-cutting Concepts)
Query: Find nodes by concern (Logging, Authentication)

2
Programmatic AsciiDoc Generation
Python script executes queries and constructs .adoc file
• Execute Cypher queries against live KG
• Generate AsciiDoc syntax (headings, lists, tables)
• Export graph data for Mermaid/PlantUML diagrams
• Embed diagrams directly into AsciiDoc source

3
docToolchain Processing
Process "golden master" .adoc file into final formats
• Resolve includes and render diagrams
• Compile to HTML, PDF, Confluence pages
• Fully-formatted arc42 documentation
• Ready for distribution and consumption
Key Benefits

![preencoded.png](Image1.jpg)
Always Current
Documentation never out of sync with implementation - generated from live KG updated on every code change

![preencoded.png](Image2.jpg)
Automated Asset
Transforms documentation from manual chore to automated, valuable asset generated as part of development process

![preencoded.png](Image3.jpg)
Reliable & Accurate
Documentation becomes reliable reflection of system's current state, not lagging behind development

Technical Stack
Queries:
 Cypher
Generation:
 Python + Neo4j driver
Format:
 AsciiDoc
Diagrams:
 Mermaid, PlantUML
Processing:
 docToolchain
Output:
 HTML, PDF, Confluence

Transformation:
 From burdensome manual task to natural part of development
workflow

### Notes:

<!-- Slide number: 16 -->

![preencoded.png](Image0.jpg)
4.2 Deriving Test Cases
AI-Powered Test Generation from Knowledge Graph

AI-Powered Test Generation

![preencoded.png](Image1.jpg)
Unit Test Generation
Contextual Profile Building:

Function node

Source code

Parameters & types

Return type

Dependencies

Process:
 KG query → Complete context → LLM prompt → Generate unit test file
(JUnit/PyTest) → Create mock objects for dependencies
Result:
 True unit test that isolates function logic

![preencoded.png](Image2.jpg)
Integration Test Scenario Identification
End-to-End Path Tracing:
Query CALLS graph from API endpoint to database to identify all involved components

Process:
 Trace transaction paths → Identify services/modules/components →
Suggest high-value scenarios → Scaffold integration tests
Result:
 Verify correct interaction between components in multi-service workflows
Key Benefits

![preencoded.png](Image3.jpg)
Improved Quality
Detailed contextual information from KG enables more accurate and comprehensive test generation

![preencoded.png](Image4.jpg)
Better Coverage
KG's complete dependency mapping ensures all critical paths and interactions are tested

![preencoded.png](Image5.jpg)
Automated Efficiency
Reduces manual test writing effort while maintaining high-quality test standards

Technical Foundation
Data Source:
Rich contextual information from KG
AI Integration:
LLM-powered test generation with context
Test Frameworks:
JUnit (Java), PyTest (Python), etc.
Coverage Types:
Unit tests, Integration scenarios

Impact:
 Transform testing from manual effort to AI-assisted, context-aware
automation

### Notes:

<!-- Slide number: 17 -->

![preencoded.png](Image0.jpg)
4.3 Automating Project Management Workflows (Jira)
Closed-Loop Feedback from Code Quality to Development Workflow

Technical Workflow

1
Trigger Event
Scheduled job or CI/CD step executes analytical query
Security scans, deprecated API detection, architectural checks

2
Context Extraction
Script extracts all relevant context from KG

 File path, line number, function name, dependency chain, code owner

3
Jira API Integration
Format contextual data into JSON payload
REST API call to Jira create issue endpoint

4
Automated Ticket Creation
Pre-populated Jira issue with complete information

 Title: "Critical SQL Injection in PaymentService.java"
 Auto-assigned to code owner with labels and priority
Dramatic Impact

![preencoded.png](Image1.jpg)
Shortened Feedback Loop
Before:
 Hours/days discovery → action
After:
 Seconds discovery → notification

![preencoded.png](Image2.jpg)
Eliminated Manual Steps
❌ Manual discovery, context-switching, copy-paste
✅ Fully automated workflow

![preencoded.png](Image3.jpg)
Systematic Quality Management
 Critical issues never lost, transparent tracking, efficient technical debt management

Key Benefits
🔄 Closed-loop feedback from code to workflow
⚡ Real-time issue tracking and assignment
🎯 Context-rich tickets with actionable information
🔒 Zero-loss critical issue management

### Notes:

<!-- Slide number: 18 -->

![preencoded.png](Image0.jpg)

PART V
 Synthesis and Technical Recommendations
 Providing comprehensive analysis of available tooling options, implementation strategies, and practical roadmaps for organizations looking to adopt knowledge graph-centric approaches to AI-assisted software engineering.

### Notes:

<!-- Slide number: 19 -->

![preencoded.png](Image0.jpg)
5.1 Comparative Analysis of Open Source and LLM-Based Tooling
Modular, Flexible Ecosystem Centered on LLMs

Core Component Categories

![preencoded.png](Image1.jpg)
LLM Orchestration Frameworks
The "brains" managing complex workflows between LLMs, data sources, and external tools

LangChain
RAG support, extensive LLM integration, LangGraph for agentic systems
Key Functions:
 Prompt management, chaining LLM calls, data preprocessing

![preencoded.png](Image2.jpg)
Multi-Agent Systems
Autonomous AI agents collaborating to solve complex problems

crewAI
Role-based agent design, autonomous task delegation, hierarchical processes

AutoGen
Multi-agent conversation framework, local/Docker code executors
Use Case:
 Coder Agent + Reviewer Agent + Tester Agent collaboration
Specialized Tools

![preencoded.png](Image3.jpg)
Code-to-Graph Analyzers
Foundational layer parsing source code into structured, queryable knowledge graphs

CodeGraph Analyzer
Direct-to-Neo4j parsing, multi-language support (C++), MCP server for IDE integration

Cntxt
Token reduction (up to 75%), lightweight, generates concise KG file
Goal:
 Reduce token usage vs. feeding raw code to LLMs

![preencoded.png](Image4.jpg)
Data Frameworks for LLMs
Advanced data ingestion and indexing for LLM applications

LlamaIndex
Advanced data ingestion and indexing, specialized for LLM data processing

Modern Ecosystem Characteristics
•
Modular & Flexible:
 Unlike legacy monolithic platforms
•
LLM-Centered:
 Built around predictive power of Large Language Models
•
Open Source:
 Vibrant community-driven development
•
Interoperable:
 Components work together seamlessly
•
Lightweight:
 Focus on efficiency and token optimization

### Notes:

<!-- Slide number: 20 -->

![preencoded.png](Image0.jpg)
5.2 Implementation Prerequisites and Roadmap
Phased Approach to Knowledge Graph Adoption

Prerequisites

![preencoded.png](Image1.jpg)
Technical Skills
• Graph databases (Neo4j, Cypher)
• Data engineering (ETL pipelines)
• AI/ML (prompt engineering, LLM fine-tuning)
• Text-to-Cypher translation

![preencoded.png](Image2.jpg)
Infrastructure
• Scalable graph database instance
• LLM API access (commercial/self-hosted)
• Mature CI/CD pipeline infrastructure
• Automated analysis and governance jobs

![preencoded.png](Image3.jpg)
Cultural Shift
• "Docs as Code" mentality
• "Architecture as Code" approach
• Version-controlled artifacts
• Automated validation in CI/CD
Phased Implementation Roadmap

1
Assessment & Proof of Concept
Single legacy application analysis, first Code KG
Goal:
 Demonstrate value with arc42 docs & technical debt identification

2
Integration & Governance
Greenfield project pilot, CI/CD integration
Goal:
 Prove KG value in preventing technical debt & architectural drift

3
Automation & Workflow
Full artifact generation, Jira integration
Goal:
 Improve developer workflow & reduce mean time to remediation

4
Scale & Enterprise Adoption
Multi-team rollout, center of excellence
Goal:
 Unified enterprise knowledge graph for strategic decision-making

Key Principle:
 Gradual, phased approach to build expertise, demonstrate value, and
mitigate risk

### Notes:

<!-- Slide number: 21 -->

![preencoded.png](Image0.jpg)

The Future of AI-Assisted Software Engineering
 Transforming software development through intelligent knowledge graphs and AI-powered automation

![preencoded.png](Image1.jpg)
Knowledge Graph Foundation
Transform codebases into queryable, living knowledge graphs that serve as digital twins of software systems

![preencoded.png](Image2.jpg)
AI-Powered Toolchain
Integrate LLMs with graph databases through RAG patterns for accurate, context-aware software intelligence

![preencoded.png](Image3.jpg)
Legacy Modernization
Systematic reverse engineering and fact extraction enable data-driven modernization strategies

![preencoded.png](Image4.jpg)
Automated Artifacts
Generate documentation, test cases, and project management workflows automatically from knowledge graphs

![preencoded.png](Image5.jpg)
Phased Implementation
4-phase roadmap from proof of concept to enterprise-scale adoption with clear prerequisites and milestones

![preencoded.png](Image6.jpg)
Measurable Impact
Proven efficiency gains: 60% accuracy improvement, 6 weeks to 2 weeks analysis time, 60,000 person-days saved
Ready to Transform Your Software Engineering?
Start with a single legacy application and build your knowledge graph foundation today

### Notes:
