# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    curl \
    git \
    python3 \
    make \
    g++

# Set working directory
WORKDIR /app

# Copy package files and source code
COPY package*.json ./
COPY tsconfig.json ./
COPY src/ ./src/

# Install all dependencies (including dev deps for building)
RUN npm ci --legacy-peer-deps

# Build TypeScript -> dist
RUN npm run build

COPY docker-compose.yml ./
COPY .env.example ./
COPY docs/ ./docs/
COPY scripts/ ./scripts/

# Remove dev dependencies to reduce image size
RUN npm prune --production --legacy-peer-deps

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S aaswe -u 1001

# Change ownership of the app directory
RUN chown -R aaswe:nodejs /app

# Switch to non-root user
USER aaswe

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application (read sensitive values from env)
SHELL ["/bin/sh", "-c"]
CMD node dist/cli/index.js mcp \
  --transport both \
  --ttl-directories ./knowledge \
  --neo4j-uri "${NEO4J_URI:-bolt://neo4j:7687}" \
  --neo4j-username "${NEO4J_USERNAME:-neo4j}" \
  --neo4j-password "${NEO4J_PASSWORD:?NEO4J_PASSWORD not set}"