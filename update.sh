#!/bin/bash
# ==============================================================================
# Royal Canadian Military (RCM) Bot - Automated Update & Restart Script
# Checks for updates on GitHub, pulls changes, installs dependencies,
# redeploys slash commands, and restarts the process manager.
# ==============================================================================

set -e

# Navigate to the directory containing this script
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

# 1. Fetch remote changes without modifying working directory
git fetch origin main

# 2. Compare local HEAD with remote origin/main
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/main)

if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
    # Everything is already up to date; exit silently
    exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] New update detected on origin/main!"
echo "Local commit:  $LOCAL_COMMIT"
echo "Remote commit: $REMOTE_COMMIT"

# 3. Pull latest changes
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pulling changes..."
git pull origin main

# 4. Install updated dependencies
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Installing dependencies..."
npm install --omit=dev

# 5. Redeploy slash commands to Discord
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deploying slash commands..."
npm run deploy

# 6. Restart the bot based on available process manager
if command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q "rcm-bot"; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restarting via PM2..."
    pm2 restart rcm-bot
elif command -v docker >/dev/null 2>&1 && [ -f "docker-compose.yml" ] && docker compose ps -q | grep -q .; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restarting Docker Compose containers..."
    docker compose down && docker compose up -d --build
elif command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet rcm-bot 2>/dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restarting systemd service..."
    sudo systemctl restart rcm-bot
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Bot files updated. Restart your bot process (e.g. pm2 restart rcm-bot or npm start)."
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Update and restart successfully executed."
