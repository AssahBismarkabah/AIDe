#!/bin/bash

# AASWE Docker Build and Publish Script
# This script builds and publishes Docker images to Docker Hub

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
IMAGE_NAME="assah/codebase-ai"

echo -e "${BLUE}🐳 AASWE Docker Build and Publish Script${NC}"
echo -e "${BLUE}================================================${NC}"
echo -e "Version: ${GREEN}$VERSION${NC}"
echo -e "Image: ${GREEN}$IMAGE_NAME${NC}"
echo ""

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo -e "${YELLOW}💡 Please install Docker: https://docs.docker.com/get-docker/${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo -e "${YELLOW}💡 Please start Docker and try again${NC}"
    exit 1
fi

# Check if user is logged in to Docker Hub
if ! docker info | grep -q "Username:"; then
    echo -e "${YELLOW}⚠️  Not logged in to Docker Hub${NC}"
    echo -e "${YELLOW}🔐 Please log in first: docker login${NC}"
    read -p "Do you want to continue with login? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker login
    else
        echo -e "${RED}❌ Aborted - please login and try again${NC}"
        exit 1
    fi
fi

# Parse command line arguments
BUILD_ONLY=false
PUSH_ONLY=false
NO_CACHE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --build-only)
            BUILD_ONLY=true
            shift
            ;;
        --push-only)
            PUSH_ONLY=true
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --build-only    Only build the image, don't push"
            echo "  --push-only     Only push existing image, don't build"
            echo "  --no-cache      Build without using Docker cache"
            echo "  -h, --help      Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate that build-only and push-only are not both set
if [[ "$BUILD_ONLY" == true && "$PUSH_ONLY" == true ]]; then
    echo -e "${RED}❌ Cannot use --build-only and --push-only together${NC}"
    exit 1
fi

# Build phase
if [[ "$PUSH_ONLY" != true ]]; then
    echo -e "${BLUE}🏗️  Step 1: Building Docker image...${NC}"
    
    # Prepare build arguments
    BUILD_ARGS=""
    if [[ "$NO_CACHE" == true ]]; then
        BUILD_ARGS="--no-cache"
    fi
    
    # Build the image with both latest and version tags
    echo -e "Building: ${GREEN}$IMAGE_NAME:latest${NC} and ${GREEN}$IMAGE_NAME:$VERSION${NC}"
    
    if docker build $BUILD_ARGS \
        -t "$IMAGE_NAME:latest" \
        -t "$IMAGE_NAME:$VERSION" \
        .; then
        echo -e "${GREEN}✅ Build completed successfully${NC}"
    else
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    fi
    
    # Show image info
    echo -e "${BLUE}📊 Image Information:${NC}"
    docker images "$IMAGE_NAME" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    echo ""
fi

# Push phase
if [[ "$BUILD_ONLY" != true ]]; then
    echo -e "${BLUE}🚀 Step 2: Pushing to Docker Hub...${NC}"
    
    # Push both tags
    echo -e "Pushing: ${GREEN}$IMAGE_NAME:latest${NC}"
    if docker push "$IMAGE_NAME:latest"; then
        echo -e "${GREEN}✅ Pushed latest tag${NC}"
    else
        echo -e "${RED}❌ Failed to push latest tag${NC}"
        exit 1
    fi
    
    echo -e "Pushing: ${GREEN}$IMAGE_NAME:$VERSION${NC}"
    if docker push "$IMAGE_NAME:$VERSION"; then
        echo -e "${GREEN}✅ Pushed version tag${NC}"
    else
        echo -e "${RED}❌ Failed to push version tag${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}🎉 Successfully published to Docker Hub!${NC}"
    echo -e "${BLUE}📦 Available images:${NC}"
    echo -e "  • ${GREEN}$IMAGE_NAME:latest${NC}"
    echo -e "  • ${GREEN}$IMAGE_NAME:$VERSION${NC}"
    echo ""
    echo -e "${BLUE}💡 Users can now run:${NC}"
    echo -e "  ${YELLOW}docker pull $IMAGE_NAME:latest${NC}"
    echo -e "  ${YELLOW}codebase-ai full-start${NC} (uses pre-built image)"
fi

echo -e "${GREEN}✅ Docker publish process completed!${NC}"