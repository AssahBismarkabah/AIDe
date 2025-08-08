// AASWE Configuration - context-only mode
module.exports = {
  mode: 'context-only',
  server: {
    name: 'AASWE-MCP-Server',
    version: '1.0.0',
    port: 3001,
    host: 'localhost'
  },
  context: {
    maxTokens: 8000,
    maxFiles: 10,
    relevanceThreshold: 0.3,
    cacheEnabled: true,
    cacheTtl: 300000
  },
  ttl: {
    watchEnabled: true,
    watchDebounce: 1000,
    maxFileSize: 1024 * 1024,
    encoding: 'utf-8'
  }
};