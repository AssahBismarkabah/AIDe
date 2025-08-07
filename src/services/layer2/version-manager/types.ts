/**
 * Version Manager Types
 * 
 * Defines types for Git-aligned knowledge versioning system that tracks
 * knowledge graph states, RDF file changes, and provides rollback capabilities.
 */

export interface VersionMetadata {
  /** Unique version identifier (Git commit hash) */
  versionId: string;
  /** Git commit hash this version is based on */
  commitHash: string;
  /** Repository name/identifier */
  repositoryId: string;
  /** Timestamp when version was created */
  timestamp: Date;
  /** Commit message from Git */
  commitMessage: string;
  /** Author information from Git commit */
  author: {
    name: string;
    email: string;
  };
  /** Branch name where commit was made */
  branch: string;
  /** Parent version ID (previous commit) */
  parentVersionId?: string;
  /** Knowledge graph snapshot metadata */
  knowledgeGraphSnapshot: {
    nodeCount: number;
    relationshipCount: number;
    checksum: string;
  };
  /** RDF files tracked in this version */
  rdfFiles: RDFFileMetadata[];
  /** Version status */
  status: 'active' | 'archived' | 'rollback';
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface RDFFileMetadata {
  /** Relative path to RDF file */
  filePath: string;
  /** File content checksum */
  checksum: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp */
  lastModified: Date;
  /** Whether file was modified by developer */
  developerModified: boolean;
  /** Modification type */
  modificationType: 'created' | 'updated' | 'deleted';
}

export interface VersionDiff {
  /** Source version ID */
  fromVersionId: string;
  /** Target version ID */
  toVersionId: string;
  /** Knowledge graph changes */
  knowledgeGraphDiff: {
    nodesAdded: number;
    nodesRemoved: number;
    nodesModified: number;
    relationshipsAdded: number;
    relationshipsRemoved: number;
    relationshipsModified: number;
  };
  /** RDF file changes */
  rdfFileChanges: RDFFileChange[];
  /** Diff generation timestamp */
  timestamp: Date;
}

export interface RDFFileChange {
  /** File path */
  filePath: string;
  /** Change type */
  changeType: 'created' | 'updated' | 'deleted' | 'moved';
  /** Old file path (for moves) */
  oldFilePath?: string;
  /** Content diff (for updates) */
  contentDiff?: string;
  /** File metadata changes */
  metadataChanges: {
    sizeChange: number;
    checksumChanged: boolean;
    developerModifiedChanged: boolean;
  };
}

export interface RollbackOperation {
  /** Rollback operation ID */
  operationId: string;
  /** Target version to rollback to */
  targetVersionId: string;
  /** Current version before rollback */
  sourceVersionId: string;
  /** Repository ID */
  repositoryId: string;
  /** Rollback timestamp */
  timestamp: Date;
  /** Rollback status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  /** Operations performed during rollback */
  operations: RollbackStep[];
  /** Error information if rollback failed */
  error?: {
    message: string;
    stack?: string;
    step?: string;
  };
}

export interface RollbackStep {
  /** Step identifier */
  stepId: string;
  /** Step description */
  description: string;
  /** Step status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  /** Step start time */
  startTime: Date;
  /** Step end time */
  endTime?: Date;
  /** Step result data */
  result?: any;
  /** Error information if step failed */
  error?: {
    message: string;
    stack?: string;
  };
}

export interface VersionQuery {
  /** Repository ID filter */
  repositoryId?: string;
  /** Branch filter */
  branch?: string;
  /** Date range filter */
  dateRange?: {
    from: Date;
    to: Date;
  };
  /** Author filter */
  author?: string;
  /** Status filter */
  status?: VersionMetadata['status'];
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort order */
  sortBy?: 'timestamp' | 'commitHash' | 'author';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

export interface VersionManagerConfig {
  /** Storage path for version metadata */
  versionsFilePath: string;
  /** Maximum number of versions to keep */
  maxVersions: number;
  /** Enable automatic cleanup of old versions */
  autoCleanup: boolean;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
  /** Enable version compression */
  enableCompression: boolean;
  /** Backup configuration */
  backup: {
    enabled: boolean;
    interval: number;
    retentionDays: number;
    backupPath: string;
  };
}

export interface VersionManagerMetrics {
  /** Total number of versions */
  totalVersions: number;
  /** Number of active versions */
  activeVersions: number;
  /** Number of archived versions */
  archivedVersions: number;
  /** Storage usage in bytes */
  storageUsage: number;
  /** Average version size */
  averageVersionSize: number;
  /** Most recent version timestamp */
  lastVersionTimestamp: Date;
  /** Repository statistics */
  repositoryStats: Record<string, {
    versionCount: number;
    lastUpdate: Date;
    storageUsage: number;
  }>;
}

export interface SyncOperation {
  /** Sync operation ID */
  operationId: string;
  /** Repository ID */
  repositoryId: string;
  /** Sync type */
  syncType: 'rdf_to_graph' | 'graph_to_rdf' | 'bidirectional';
  /** Files to sync */
  filePaths: string[];
  /** Sync timestamp */
  timestamp: Date;
  /** Sync status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  /** Sync results */
  results: SyncResult[];
  /** Error information if sync failed */
  error?: {
    message: string;
    stack?: string;
    filePath?: string;
  };
}

export interface SyncResult {
  /** File path */
  filePath: string;
  /** Sync status for this file */
  status: 'success' | 'failed' | 'skipped';
  /** Changes made */
  changes: {
    nodesAdded: number;
    nodesUpdated: number;
    nodesRemoved: number;
    relationshipsAdded: number;
    relationshipsUpdated: number;
    relationshipsRemoved: number;
  };
  /** Error message if sync failed */
  error?: string;
}