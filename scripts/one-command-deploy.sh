#!/bin/bash

# AASWE Codebase AI - One Command Complete Deployment
# This script installs and starts the complete AASWE system with all containers

set -e

echo "🚀 AASWE Codebase AI - Complete System Deployment"
echo "=================================================="
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js and npm first."
    echo "💡 Visit: https://nodejs.org/"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop first."
    echo "💡 Visit: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Install AASWE globally
echo "📦 Installing AASWE Codebase AI globally..."
npm install -g @aaswe/codebase-ai

echo "✅ AASWE installed successfully"
echo ""

# Initialize in current directory
echo "🔧 Initializing AASWE in current directory..."
codebase-ai init --mode full --force

echo "✅ AASWE initialized"
echo ""

# Start complete system
echo "🐳 Starting complete AASWE system with all containers..."
echo "📊 This will start:"
echo "   - Neo4j Database (Graph storage with source code)"
echo "   - Redis Cache (Performance optimization)"
echo "   - AASWE MCP Server (LLM integration)"
echo ""

codebase-ai full-start --detach --build

echo ""
echo "🎉 AASWE Complete System Deployed Successfully!"
echo ""
echo "🔗 Access Points:"
echo "   📡 MCP Server: ws://localhost:3001 (for IDE integration)"
echo "   🗄️  Neo4j Browser: http://localhost:7474 (neo4j/aaswe-password)"
echo "   ⚡ Redis Cache: localhost:6379"
echo ""
echo "🎯 Next Steps:"
echo "   1. Run: codebase-ai analyze (to populate the knowledge graph)"
echo "   2. Configure your IDE to connect to: ws://localhost:3001"
echo "   3. Visit http://localhost:7474 to explore the Neo4j graph database"
echo ""
echo "📚 Documentation:"
echo "   - Local usage: codebase-ai --help"
echo "   - Neo4j browser: http://localhost:7474"
echo "   - Graph visualization guide: docs/NEO4J_CODEBASE_VISUALIZATION.md"
echo ""
echo "🛑 To stop all services: codebase-ai docker down"
echo ""
echo "✨ Your AI-powered development environment is ready!"