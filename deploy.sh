#!/bin/bash

# Astibot Deployment Script for Raspberry Pi
# This script automates the deployment process

set -e

echo "🚀 Starting Astibot deployment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

echo -e "${BLUE}🔨 Building frontend...${NC}"
npm run build

# Create logs directory
mkdir -p logs

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${BLUE}📥 Installing PM2 globally...${NC}"
    sudo npm install -g pm2
fi

# Setup environment file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${BLUE}📝 Creating .env file from template...${NC}"
    cp .env.example .env
    echo -e "${RED}⚠️  Please edit .env file with your configuration!${NC}"
fi

echo -e "${BLUE}🔄 Starting application with PM2...${NC}"
pm2 delete astibot 2>/dev/null || true
pm2 start ecosystem.config.js

echo -e "${BLUE}💾 Saving PM2 configuration...${NC}"
pm2 save

echo -e "${BLUE}⚙️  Setting up PM2 to start on boot...${NC}"
pm2 startup systemd -u $USER --hp $HOME

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📊 Application Status:"
pm2 status

echo ""
echo "🌐 Access the application at:"
echo "   Local: http://localhost:3000"
echo "   Network: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "📝 Useful commands:"
echo "   pm2 status        - Check application status"
echo "   pm2 logs astibot  - View logs"
echo "   pm2 restart astibot - Restart application"
echo "   pm2 stop astibot  - Stop application"
echo "   pm2 monit         - Monitor resources"
