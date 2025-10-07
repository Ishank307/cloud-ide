# Stage 1: The 'builder' stage to build the React client
FROM node:18-alpine AS builder

WORKDIR /app

# Copy client package files and install dependencies
COPY client/package*.json ./client/
RUN cd client && npm install

# Copy the rest of the client source code
COPY client/ ./client/

# Build the client application
# This creates a 'dist' folder inside /app/client/
RUN cd client && npm run build


# Stage 2: The 'final' stage for the production server
FROM node:18-alpine

# We need build tools for node-pty to compile its native addons and bash for terminal
RUN apk add --no-cache python3 make g++ bash

WORKDIR /app

# Copy server package files and install production dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --production

# Copy the server source code
COPY server/ ./server/

# Create the /user directory that the application logic requires
# This is where the in-container terminal will operate
RUN mkdir -p /app/server/user

# Copy the built client files from the 'builder' stage
COPY --from=builder /app/client/dist ./client/dist

# Expose the port the server runs on
EXPOSE 8000

# The command to start the server
# We set the working directory to the server folder
WORKDIR /app/server
CMD ["node", "index.js"]