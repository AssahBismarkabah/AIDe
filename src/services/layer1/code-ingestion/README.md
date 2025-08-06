# Code Ingestion Service

Monitors Git repositories and processes code changes for AI analysis.

## Usage

When AIDe is initialized in a repository:

```bash
aide init  # Automatically detects and monitors the Git repository
```

## What It Does

1. **Monitors** - Watches for file changes and Git commits
2. **Processes** - Queues analysis jobs for changed code
3. **Integrates** - Handles webhooks from GitHub/GitLab
4. **Syncs** - Updates `.module-knowledge.ttl` files

## Components

- **GitService** - Git repository monitoring and change detection
- **FileWatcher** - Real-time file system monitoring
- **IngestionJobQueue** - Batch processing with priority handling
- **CodeIngestionService** - Main orchestrator

## Files Created

```
your-project/
├── .aaswe/repositories.json     # Repository config
├── .module-knowledge.ttl        # Generated knowledge graph
└── your code...
```

The service runs continuously, keeping your codebase analysis up-to-date.