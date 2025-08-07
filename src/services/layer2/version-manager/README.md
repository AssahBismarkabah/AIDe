# Version Manager Service

The Version Manager service provides Git-aligned knowledge versioning capabilities for the AI-Assisted Software Engineering system. It tracks knowledge graph states, manages RDF file changes, and provides rollback capabilities synchronized with Git commits.

## Features

- **Git-Aligned Versioning**: Creates knowledge graph versions based on Git commit hashes
- **Version Metadata Management**: Stores comprehensive version information in `versions.json`
- **Diff Operations**: Calculates differences between knowledge graph versions and RDF files
- **Rollback Capabilities**: Provides rollback functionality to restore previous knowledge states
- **RDF File Tracking**: Monitors changes to `.module-knowledge.ttl` files
- **Automatic Synchronization**: Syncs RDF file changes back to the knowledge graph
- **Backup and Cleanup**: Automated backup creation and version cleanup

## Architecture

```
Version Manager
├── VersionManager.ts     # Main service implementation
├── types.ts             # TypeScript type definitions
├── index.ts             # Service exports and configuration
└── README.md           # Documentation
```

## Core Components

### VersionManager Class

The main service class that handles all versioning operations:

```typescript
import { VersionManager, defaultVersionManagerConfig } from './version-manager';

const versionManager = new VersionManager(defaultVersionManagerConfig);
await versionManager.initialize();
```

### Key Methods

#### Version Creation
```typescript
// Create a new version from Git commit
const version = await versionManager.createVersion('/path/to/repo', 'repo-id');
```

#### Version Querying
```typescript
// Query versions with filters
const versions = await versionManager.queryVersions({
  repositoryId: 'my-repo',
  branch: 'main',
  limit: 10
});
```

#### Diff Calculation
```typescript
// Calculate differences between versions
const diff = await versionManager.calculateDiff('version1', 'version2');
```

#### Rollback Operations
```typescript
// Rollback to a specific version
const rollbackOp = await versionManager.rollbackToVersion('repo-id', 'target-version');
```

#### RDF Synchronization
```typescript
// Sync RDF file changes to knowledge graph
const syncOp = await versionManager.syncRDFChangesToGraph('repo-id', [
  'src/module1/.module-knowledge.ttl',
  'src/module2/.module-knowledge.ttl'
]);
```

## Data Structures

### VersionMetadata
Comprehensive metadata for each version:
- Version ID and Git commit hash
- Repository information
- Author and timestamp details
- Knowledge graph snapshot
- RDF file metadata
- Version status

### VersionDiff
Detailed comparison between versions:
- Knowledge graph changes (nodes/relationships added/removed/modified)
- RDF file changes with content diffs
- Metadata changes

### RollbackOperation
Tracks rollback operations:
- Operation status and progress
- Individual rollback steps
- Error handling and recovery

## Configuration

### VersionManagerConfig
```typescript
interface VersionManagerConfig {
  versionsFilePath: string;      // Path to versions.json
  maxVersions: number;           // Maximum versions to keep
  autoCleanup: boolean;          // Enable automatic cleanup
  cleanupInterval: number;       // Cleanup interval in ms
  enableCompression: boolean;    // Enable version compression
  backup: {
    enabled: boolean;
    interval: number;            // Backup interval in ms
    retentionDays: number;       // Backup retention period
    backupPath: string;          // Backup directory path
  };
}
```

### Default Configuration
```typescript
const defaultConfig = {
  versionsFilePath: '.aaswe/versions.json',
  maxVersions: 100,
  autoCleanup: true,
  cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
  enableCompression: false,
  backup: {
    enabled: true,
    interval: 7 * 24 * 60 * 60 * 1000,  // 7 days
    retentionDays: 30,
    backupPath: '.aaswe/backups'
  }
};
```

## Usage Examples

### Basic Version Management
```typescript
import { VersionManager, defaultVersionManagerConfig } from './version-manager';

const versionManager = new VersionManager(defaultVersionManagerConfig);
await versionManager.initialize();

// Create version from current Git state
const version = await versionManager.createVersion('/path/to/repo', 'my-repo');
console.log(`Created version: ${version.versionId}`);

// Query recent versions
const recentVersions = await versionManager.queryVersions({
  repositoryId: 'my-repo',
  limit: 5,
  sortBy: 'timestamp',
  sortOrder: 'desc'
});

// Calculate diff between versions
if (recentVersions.length >= 2) {
  const diff = await versionManager.calculateDiff(
    recentVersions[1].versionId,
    recentVersions[0].versionId
  );
  console.log('Knowledge graph changes:', diff.knowledgeGraphDiff);
  console.log('RDF file changes:', diff.rdfFileChanges.length);
}
```

### Rollback Operations
```typescript
// Rollback to a previous version
const rollbackOp = await versionManager.rollbackToVersion(
  'my-repo',
  'target-version-id'
);

// Monitor rollback progress
versionManager.on('rollbackCompleted', (operation) => {
  console.log(`Rollback completed: ${operation.operationId}`);
});

versionManager.on('rollbackFailed', (operation) => {
  console.error(`Rollback failed: ${operation.error?.message}`);
});
```

### RDF File Synchronization
```typescript
// Sync specific RDF files to knowledge graph
const syncOp = await versionManager.syncRDFChangesToGraph('my-repo', [
  'src/auth/.module-knowledge.ttl',
  'src/api/.module-knowledge.ttl'
]);

// Monitor sync progress
versionManager.on('syncCompleted', (operation) => {
  console.log('Sync results:', operation.results);
});
```

### Metrics and Monitoring
```typescript
// Get version manager metrics
const metrics = await versionManager.getMetrics();
console.log(`Total versions: ${metrics.totalVersions}`);
console.log(`Storage usage: ${metrics.storageUsage} bytes`);
console.log('Repository stats:', metrics.repositoryStats);
```

## Events

The Version Manager emits the following events:

- `initialized`: Service initialization completed
- `versionCreated`: New version created
- `rollbackCompleted`: Rollback operation completed
- `rollbackFailed`: Rollback operation failed
- `syncCompleted`: RDF sync operation completed
- `syncFailed`: RDF sync operation failed
- `cleanupCompleted`: Version cleanup completed
- `shutdown`: Service shutdown completed

## Integration

### With Git Service
The Version Manager integrates with Git repositories to:
- Extract commit information (hash, message, author, branch)
- Track parent-child relationships between versions
- Align knowledge graph versions with Git history

### With Neo4j Database
Integration with Neo4j for:
- Knowledge graph snapshot creation
- Graph state restoration during rollbacks
- Diff calculation between graph states

### With RDF Generator
Coordination with RDF services for:
- RDF file change detection
- Content synchronization
- Developer modification tracking

## Error Handling

The service includes comprehensive error handling:
- Git operation failures
- File system errors
- Version corruption detection
- Rollback failure recovery
- Sync operation errors

## Performance Considerations

- **Lazy Loading**: Versions are loaded on-demand
- **Incremental Diffs**: Only changed elements are compared
- **Background Operations**: Cleanup and backup run asynchronously
- **Memory Management**: Large version histories are paginated
- **Caching**: Frequently accessed versions are cached

## Security

- **File Permissions**: Proper file system permissions for version data
- **Backup Encryption**: Optional encryption for backup files
- **Access Control**: Integration with authentication systems
- **Audit Logging**: All version operations are logged

## Testing

The service includes comprehensive tests for:
- Version creation and management
- Diff calculation accuracy
- Rollback operation reliability
- RDF file synchronization
- Error handling scenarios
- Performance under load

## Future Enhancements

- **Distributed Versioning**: Support for multi-repository versioning
- **Version Compression**: Reduce storage usage for large histories
- **Advanced Diff Algorithms**: More sophisticated change detection
- **Real-time Sync**: Live synchronization of RDF changes
- **Version Analytics**: Insights into version patterns and usage