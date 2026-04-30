#!/bin/bash

# E-Commerce Platform — AWS EC2 Deployment Script
# Targeted for Ubuntu 22.04 LTS

set -e # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting AWS Deployment...${NC}"

# 1. Check for Docker
if ! [ -x "$(command -v docker)" ]; then
    echo -e "${BLUE}📦 Docker not found. Installing Docker...${NC}"
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✅ Docker installed.${NC}"
else
    echo -e "${GREEN}✅ Docker is already installed.${NC}"
fi

# 2. Setup Environment
if [ ! -f .env ]; then
    echo -e "${BLUE}📄 No .env found. Creating from .env.example...${NC}"
    cp .env.example .env
    
    # Generate random secrets for security
    JWT_ACCESS_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)
    DB_PASSWORD=$(openssl rand -base64 16)
    
    sed -i "s/JWT_ACCESS_SECRET=.*/JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET/" .env
    sed -i "s/JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET/" .env
    sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" .env
    sed -i "s/NODE_ENV=development/NODE_ENV=production/" .env
    
    echo -e "${GREEN}✅ Generated .env with secure secrets.${NC}"
fi

# Ensure server module has the .env link if needed (based on docker-compose context)
if [ ! -f server/.env ]; then
    cp .env server/.env
fi

# 3. Pull/Build and Start Containers
echo -e "${BLUE}🏗️ Building and starting containers...${NC}"
docker compose up --build -d

# 4. Initialize Database
echo -e "${BLUE}🗄️ Waiting for database to be ready...${NC}"
sleep 10 # Give PG a moment to initialize even with healthcheck

echo -e "${BLUE}🏃 Running migrations...${NC}"
docker compose exec server npm run migrate

echo -e "${BLUE}🌱 Seeding default data...${NC}"
docker compose exec server npm run seed

# 5. Final Health Check
echo -e "${BLUE}🔍 Performing health check...${NC}"
HEALTH_CHECK=$(curl -s http://localhost:5000/api/health || echo "fail")

if [[ "$HEALTH_CHECK" == *"OK"* ]] || [[ "$HEALTH_CHECK" == *"success"* ]]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo -e "${BLUE}Storefront is available on port 80${NC}"
    echo -e "${BLUE}API is available on port 5000${NC}"
else
    echo -e "${RED}⚠️ Health check failed. Check logs with 'docker compose logs -f'${NC}"
fi

echo -e "${GREEN}--------------------------------------------------${NC}"
echo -e "${BLUE}IMPORTANT:${NC} If this is your first time running Docker,"
echo -e "you may need to log out and log back in for group"
echo -e "permissions to take effect."
echo -e "${GREEN}--------------------------------------------------${NC}"
