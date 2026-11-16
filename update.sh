#!/bin/bash
# ==============================================================================
# Royal Canadian Military (RCM) Bot - Automated Docker / Native Updater
# Checks for updates on GitHub, pulls changes, and rebuilds/restarts containers.
# ==============================================================================

set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

# Determine Docker Compose command
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    DOCKER_COMPOSE_CMD=""
fi

# 1. Fetch remote changes from GitHub
git fetch origin main

# 2. Compare local HEAD with remote origin/main
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/main)

if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
    # Already up to date
    exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] New update detected on GitHub ($LOCAL_COMMIT -> $REMOTE_COMMIT)"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pulling changes..."
git pull origin main

# 3. Check if Docker is being used
if [ -n "$DOCKER_COMPOSE_CMD" ] && [ -f "docker-compose.yml" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Rebuilding and restarting Docker containers..."
    $DOCKER_COMPOSE_CMD down
    $DOCKER_COMPOSE_CMD up -d --build
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Docker containers successfully updated and restarted."
    exit 0
fi

# 4. Fallback to native Node.js / PM2 if Docker is not in use
if command -v npm >/dev/null 2>&1; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Installing dependencies..."
    npm install --omit=dev
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deploying slash commands..."
    npm run deploy

    if command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q "rcm-bot"; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restarting via PM2..."
        pm2 restart rcm-bot
    fi
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Update complete."
