FROM node:20-alpine

WORKDIR /app

# Install dependencies first for efficient layer caching
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

# Ensure slash commands are deployed on startup before launching bot
CMD ["sh", "-c", "node deploy-commands.js && node index.js"]