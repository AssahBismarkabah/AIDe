/**
 * Version Manager Service - Entry Point
 * 
 * Exports the Version Manager service for Git-aligned knowledge versioning.
 */

export { VersionManager } from './VersionManager';
export * from './types';

// Default configuration
export const defaultVersionManagerConfig = {
  versionsFilePath: '.aaswe/versions.json',
  maxVersions: 100,
  autoCleanup: true,
  cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
  enableCompression: false,
  backup: {
    enabled: true,
    interval: 7 * 24 * 60 * 60 * 1000, // 7 days
    retentionDays: 30,
    backupPath: '.aaswe/backups'
  }
};