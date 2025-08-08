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

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies without running prepare script
RUN npm install --legacy-peer-deps --ignore-scripts

# Copy source code
COPY src/ ./src/
COPY . .

# Build the application explicitly
RUN npx tsc --project tsconfig.json

# Remove dev dependencies to reduce image size
RUN npm prune --omit=dev

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

# Start the application
CMD ["node", "dist/cli/index.js", "start"]