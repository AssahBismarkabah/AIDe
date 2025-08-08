#!/bin/bash

# AASWE Quick Start Script
# This script helps you get started with AASWE quickly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[AASWE]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_nodejs() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)
    
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        print_error "Node.js version $NODE_VERSION is too old. Please upgrade to Node.js 18+"
        exit 1
    fi
    
    print_success "Node.js $NODE_VERSION detected"
}

# Check if npm is installed
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm"
        exit 1
    fi
    
    NPM_VERSION=$(npm --version)
    print_success "npm $NPM_VERSION detected"
}

# Install AASWE globally
install_aaswe() {
    print_status "Installing AASWE globally..."
    
    if npm list -g @aaswe/codebase-ai &> /dev/null; then
        print_warning "AASWE is already installed globally"
        read -p "Do you want to reinstall? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            npm uninstall -g @aaswe/codebase-ai
            npm install -g @aaswe/codebase-ai
        fi
    else
        npm install -g @aaswe/codebase-ai
    fi
    
    print_success "AASWE installed successfully"
}

# Initialize AASWE in current directory
init_aaswe() {
    print_status "Initializing AASWE in current directory..."
    
    if [ -d ".aaswe" ]; then
        print_warning "AASWE is already initialized in this directory"
        read -p "Do you want to reinitialize? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf .aaswe
            aaswe init
        fi
    else
        aaswe init
    fi
    
    print_success "AASWE initialized"
}

# Create environment file
create_env_file() {
    if [ ! -f ".env" ]; then
        print_status "Creating environment file..."
        cat > .env << EOF
# AASWE Configuration
# Copy this file and customize as needed

# API Keys (optional - for enhanced LLM features)
# OPENAI_API_KEY=your_openai_key_here
# ANTHROPIC_API_KEY=your_anthropic_key_here

# Server Configuration
PORT=3001
LOG_LEVEL=info
NODE_ENV=development

# Neo4j Configuration (for full system mode)
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=aaswe-password

# Analysis Configuration
ANALYSIS_DEPTH=comprehensive
PRESERVE_BUSINESS_CONTEXT=true
ENABLE_INCREMENTAL_ANALYSIS=true
EOF
        print_success "Environment file created (.env)"
    else
        print_warning "Environment file already exists"
    fi
}

# Run initial analysis
run_analysis() {
    print_status "Running initial project analysis..."
    
    # Create knowledge directory
    mkdir -p ./knowledge
    
    # Run analysis
    aaswe analyze --output ./knowledge
    
    print_success "Initial analysis completed"
}

# Start AASWE server
start_server() {
    print_status "Starting AASWE server..."
    print_status "Server will start on http://localhost:3001"
    print_status "Press Ctrl+C to stop the server"
    print_status ""
    print_status "Configure your IDE to connect to the MCP server:"
    print_status "  - VS Code (Continue): Add server to config.json"
    print_status "  - Cursor: Add in Settings → Model Context Protocol"
    print_status "  - Other IDEs: Connect to http://localhost:3001"
    print_status ""
    
    # Start server with debug output
    aaswe start --port 3001 --debug
}

# Main execution
main() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    AASWE Quick Start                         ║"
    echo "║          AI-Assisted Software Engineering Setup              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Check prerequisites
    print_status "Checking prerequisites..."
    check_nodejs
    check_npm
    
    # Install AASWE
    install_aaswe
    
    # Initialize in current directory
    init_aaswe
    
    # Create environment file
    create_env_file
    
    # Run initial analysis
    run_analysis
    
    # Ask if user wants to start server immediately
    echo
    read -p "Do you want to start the AASWE server now? (Y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        print_success "Setup completed! Run 'aaswe start' when ready."
        print_status "Next steps:"
        print_status "  1. Configure your IDE to connect to AASWE"
        print_status "  2. Run 'aaswe start' to start the server"
        print_status "  3. Enjoy enhanced IDE context!"
    else
        start_server
    fi
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "AASWE Quick Start Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --check        Check prerequisites only"
        echo "  --install      Install AASWE only"
        echo "  --init         Initialize AASWE only"
        echo "  --analyze      Run analysis only"
        echo "  --start        Start server only"
        echo ""
        exit 0
        ;;
    --check)
        check_nodejs
        check_npm
        print_success "All prerequisites met!"
        ;;
    --install)
        check_nodejs
        check_npm
        install_aaswe
        ;;
    --init)
        init_aaswe
        create_env_file
        ;;
    --analyze)
        run_analysis
        ;;
    --start)
        start_server
        ;;
    "")
        main
        ;;
    *)
        print_error "Unknown option: $1"
        print_status "Use --help for usage information"
        exit 1
        ;;
esac