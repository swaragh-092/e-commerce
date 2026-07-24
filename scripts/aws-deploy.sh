#!/bin/bash

# E-Commerce Platform — Flexible AWS EC2 Deployment Script
# Supports: Docker Mode AND Non-Docker (Node.js + PM2 + PostgreSQL + Nginx) Mode
# Compatible with: Amazon Linux 2023, Amazon Linux 2, Ubuntu 20.04/22.04/24.04

set -e # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}🚀 E-Commerce Platform — Deployment Assistant${NC}"
echo -e "${BLUE}====================================================${NC}"

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME=$NAME
    OS_ID=$ID
else
    OS_NAME="Unknown Linux"
    OS_ID="unknown"
fi

echo -e "${GREEN}System Detected:${NC} $OS_NAME ($OS_ID)"

# Determine Deployment Mode
DEPLOY_MODE=""

if [[ "$1" == "--docker" ]]; then
    DEPLOY_MODE="docker"
elif [[ "$1" == "--no-docker" ]] || [[ "$1" == "--pm2" ]]; then
    DEPLOY_MODE="no-docker"
elif [ -t 0 ]; then
    echo ""
    echo -e "${YELLOW}Choose Deployment Mode:${NC}"
    echo "1) Docker Deployment (Containers for DB, API, and Nginx Frontend) [Recommended]"
    echo "2) Non-Docker Deployment (Native Node.js 20 + PM2 + PostgreSQL + Nginx)"
    read -p "Select option (1 or 2) [Default: 1]: " CHOICE
    if [[ "$CHOICE" == "2" ]]; then
        DEPLOY_MODE="no-docker"
    else
        DEPLOY_MODE="docker"
    fi
else
    DEPLOY_MODE="docker"
fi

echo -e "${GREEN}Selected Mode:${NC} ${DEPLOY_MODE^^}"
echo -e "${BLUE}----------------------------------------------------${NC}"

# 1. Environment Setup (Common for both modes)
if [ ! -f .env ]; then
    echo -e "${BLUE}📄 Creating .env from .env.example...${NC}"
    cp .env.example .env
    
    JWT_ACCESS_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)
    CREDENTIAL_ENCRYPTION_KEY=$(openssl rand -base64 32)
    DB_PASSWORD=$(openssl rand -base64 16)
    
    sed -i "s|JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET|" .env
    sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET|" .env
    sed -i "s|CREDENTIAL_ENCRYPTION_KEY=.*|CREDENTIAL_ENCRYPTION_KEY=$CREDENTIAL_ENCRYPTION_KEY|" .env
    sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=$DB_PASSWORD|" .env
    sed -i "s|NODE_ENV=development|NODE_ENV=production|" .env
    
    echo -e "${GREEN}✅ Generated .env with secure random secrets.${NC}"
fi

cp -f .env server/.env

# ==============================================================================
# MODE 1: DOCKER DEPLOYMENT
# ==============================================================================
if [[ "$DEPLOY_MODE" == "docker" ]]; then

    if ! [ -x "$(command -v docker)" ]; then
        echo -e "${BLUE}📦 Installing Docker...${NC}"
        if [[ "$OS_ID" == "amzn" ]]; then
            if command -v dnf &>/dev/null; then
                sudo dnf update -y
                sudo dnf install -y docker docker-compose-plugin
            else
                sudo yum update -y
                sudo amazon-linux-extras install docker -y || sudo yum install -y docker
                sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
                sudo chmod +x /usr/local/bin/docker-compose
            fi
            sudo systemctl enable --now docker
            sudo usermod -aG docker $USER 2>/dev/null || true
        else
            sudo apt-get update
            sudo apt-get install -y ca-certificates curl gnupg
            sudo install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            sudo chmod a+r /etc/apt/keyrings/docker.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
            sudo apt-get update
            sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            sudo usermod -aG docker $USER 2>/dev/null || true
        fi
        echo -e "${GREEN}✅ Docker installed.${NC}"
    else
        echo -e "${GREEN}✅ Docker is already installed.${NC}"
        sudo systemctl start docker 2>/dev/null || true
    fi

    echo -e "${BLUE}🏗️ Building and starting Docker containers...${NC}"
    docker compose up --build -d

    echo -e "${BLUE}🗄️ Waiting for database initialization...${NC}"
    sleep 10

    echo -e "${BLUE}🏃 Running database migrations...${NC}"
    docker compose exec -T server npm run migrate

    echo -e "${BLUE}🌱 Seeding default database records...${NC}"
    docker compose exec -T server npm run seed

    echo -e "${BLUE}🔍 Checking backend health...${NC}"
    HEALTH_CHECK=$(curl -s http://localhost:5000/api/health || echo "fail")

    if [[ "$HEALTH_CHECK" == *"OK"* ]] || [[ "$HEALTH_CHECK" == *"success"* ]]; then
        echo -e "${GREEN}✅ Docker Deployment Successful!${NC}"
        echo -e "${BLUE}Storefront: http://localhost (Port 80)${NC}"
        echo -e "${BLUE}API Server: http://localhost:5000${NC}"
    else
        echo -e "${RED}⚠️ Health check failed. Inspect logs: 'docker compose logs -f'${NC}"
    fi

# ==============================================================================
# MODE 2: NON-DOCKER DEPLOYMENT (Node.js + PM2 + PostgreSQL + Nginx)
# ==============================================================================
else
    echo -e "${BLUE}📦 Installing Native Dependencies (Node 20, PostgreSQL, Nginx)...${NC}"

    if [[ "$OS_ID" == "amzn" ]]; then
        if command -v dnf &>/dev/null; then
            sudo dnf update -y
            sudo dnf install -y nodejs20 postgresql15 postgresql15-server postgresql15-contrib nginx git 2>/dev/null || sudo dnf install -y nodejs20 postgresql postgresql-server postgresql15-contrib nginx git
            sudo postgresql-setup --initdb 2>/dev/null || true
        else
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo yum install -y nodejs git
            sudo amazon-linux-extras install -y nginx1 postgresql14 2>/dev/null || sudo yum install -y nginx postgresql-server postgresql-contrib
            sudo yum install -y postgresql-contrib postgresql14-contrib 2>/dev/null || true
            sudo postgresql-setup initdb 2>/dev/null || true
        fi
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs postgresql postgresql-contrib nginx git
    fi

    # Enable Services
    sudo systemctl enable --now postgresql
    sudo systemctl enable --now nginx

    # Fix PostgreSQL Ident Authentication issue on Amazon Linux / RedHat / Ubuntu
    PG_HBA=$(sudo find /etc /var/lib/pgsql -name "pg_hba.conf" 2>/dev/null | head -n 1)
    if [ -n "$PG_HBA" ]; then
        echo -e "${BLUE}🔧 Configuring PostgreSQL authentication in ${PG_HBA}...${NC}"
        sudo sed -i 's/\bident\b/trust/g' "$PG_HBA"
        sudo sed -i 's/\bpeer\b/trust/g' "$PG_HBA"
        sudo systemctl restart postgresql
    fi

    # Install PM2 globally
    if ! command -v pm2 &>/dev/null; then
        echo -e "${BLUE}📦 Installing PM2 process manager...${NC}"
        sudo npm install -g pm2
    fi

    # Configure PostgreSQL Database
    DB_NAME=$(grep -E "^DB_NAME=" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ' || echo "ecommerce")
    DB_USER=$(grep -E "^DB_USER=" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ' || echo "postgres")
    DB_PASS=$(grep -E "^DB_PASSWORD=" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ' || echo "postgres")

    echo -e "${BLUE}🗄️ Setting up PostgreSQL database '${DB_NAME}'...${NC}"
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true
    sudo -u postgres psql -c "ALTER USER ${DB_USER} CREATEDB;" 2>/dev/null || true

    # Update DB_HOST to localhost in .env for non-docker
    sed -i "s|DB_HOST=.*|DB_HOST=localhost|" .env
    cp -f .env server/.env

    # Setup Backend
    echo -e "${BLUE}⚙️ Installing Backend Dependencies & Migrating DB...${NC}"
    cd server
    npm install
    npx sequelize-cli db:migrate
    npm run seed || true
    
    # Start API with PM2
    echo -e "${BLUE}🚀 Starting Backend Server with PM2...${NC}"
    pm2 delete ecommerce-api 2>/dev/null || true
    pm2 start index.js --name "ecommerce-api"
    pm2 save
    cd ..

    # Setup Frontend
    echo -e "${BLUE}🎨 Installing Frontend Dependencies & Building UI...${NC}"
    cd client
    npm install
    NODE_OPTIONS="--max-old-space-size=2048" npm run build
    CLIENT_BUILD_DIR=$(pwd)/dist
    cd ..

    # Configure Nginx
    echo -e "${BLUE}🌐 Configuring Nginx Web Server...${NC}"
    NGINX_CONF="/etc/nginx/conf.d/ecommerce.conf"
    if [ ! -d /etc/nginx/conf.d ]; then
        NGINX_CONF="/etc/nginx/sites-available/ecommerce"
        sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
    fi

    cat << EOF | sudo tee "${NGINX_CONF}" > /dev/null
server {
    listen 80;
    server_name _;

    location / {
        root ${CLIENT_BUILD_DIR};
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /uploads/ {
        proxy_pass http://localhost:5000/uploads/;
    }
}
EOF

    if [ -d /etc/nginx/sites-enabled ]; then
        sudo ln -sf /etc/nginx/sites-available/ecommerce /etc/nginx/sites-enabled/default
    fi

    # Set directory permissions for Nginx user
    chmod 755 "$(dirname "$CLIENT_BUILD_DIR")" 2>/dev/null || true
    chmod 755 "$CLIENT_BUILD_DIR" 2>/dev/null || true
    chmod -R 755 "$HOME" 2>/dev/null || true

    sudo nginx -t
    sudo systemctl restart nginx

    echo -e "${GREEN}✅ Non-Docker (PM2 + Nginx) Deployment Successful!${NC}"
    echo -e "${BLUE}Storefront: http://localhost (Port 80)${NC}"
    echo -e "${BLUE}API Server: http://localhost:5000 (PM2 process: ecommerce-api)${NC}"

fi

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}====================================================${NC}"
