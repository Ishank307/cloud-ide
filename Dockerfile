# Backend-only Dockerfile for the new split architecture
FROM node:18-alpine

# Install system dependencies for node-pty, Docker, and bash
RUN apk add --no-cache python3 make g++ bash docker-cli

WORKDIR /app

# Copy server package files and install dependencies
COPY server/package*.json ./
RUN npm install

# Copy the server source code
COPY server/ ./

# Create directories for user workspaces
RUN mkdir -p /app/users

# Create .env file if it doesn't exist (for Docker builds)
RUN touch .env

# Expose the port the server runs on
EXPOSE 8000

# The command to start the server
CMD ["node", "index.js"]