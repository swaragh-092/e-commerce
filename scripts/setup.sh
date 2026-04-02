#!/bin/bash

# Default values
STORE_NAME="My Store"
PRIMARY_COLOR="#6366f1"
DB_NAME="ecommerce"
DB_USER="postgres"
DB_PASS=""

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --name) STORE_NAME="$2"; shift ;;
        --primary) PRIMARY_COLOR="$2"; shift ;;
        --db-name) DB_NAME="$2"; shift ;;
        --db-user) DB_USER="$2"; shift ;;
        --db-pass) DB_PASS="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

echo "🚀 Starting setup for $STORE_NAME..."

# 1. Create .env if it doesn't exist
if [ ! -f server/.env ]; then
    echo "Creating server/.env from .env.example..."
    cp server/.env.example server/.env
    # Simple sed to update some values
    sed -i "s/DB_NAME=ecommerce/DB_NAME=$DB_NAME/" server/.env
    sed -i "s/DB_USER=postgres/DB_USER=$DB_USER/" server/.env
    # Avoid sed issues with empty passwords or special chars for now, but in a real script we'd handle it
fi

# 2. Update config/default.json or equivalent if needed
# (Assuming the system uses the DB settings we implemented in Phase 5 for settings)

# 3. DB Setup (this requires postgres to be installed locally if not using docker)
echo "Checking database $DB_NAME..."
if ! psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "Creating database $DB_NAME..."
    createdb "$DB_NAME"
fi

# 4. Install dependencies and run migrations
echo "Installing server dependencies..."
cd server && npm install
echo "Running migrations..."
npx sequelize-cli db:migrate
echo "Running seeders..."
npx sequelize-cli db:seed:all
cd ..

echo "Installing client dependencies..."
cd client && npm install
cd ..

echo "✅ Setup complete! Run: docker-compose up --build"
