# Use a general-purpose base image like Ubuntu
FROM ubuntu:latest

# Set environment variables to prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Update the package list and install common development tools
# - build-essential: Includes compilers like gcc/g++ and make
# - git, curl, wget: Standard tools for source control and downloading
# - python3, python3-pip: For Python development
# - openjdk-17-jdk: For Java development
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    wget \
    python3 \
    python3-pip \
    openjdk-17-jdk \
    && rm -rf /var/lib/apt/lists/*

# --- Install Node.js using NVM (Node Version Manager) ---
# This is a flexible way to manage Node versions
ENV NVM_DIR /root/.nvm
ENV NODE_VERSION 18.17.1

# Install NVM
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
# Make nvm available in the shell
RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}

# Add NVM's binaries to the PATH so commands like `node` and `npm` are available
ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin:${PATH}"

# --- Setup the Application ---
# Set a working directory for your cloud IDE server itself
WORKDIR /app

# Copy your server's package.json and install its dependencies
COPY server/package*.json ./server/
RUN cd server && npm install

# Copy the rest of your server's code
COPY server/ ./server/

# Copy the pre-built React client (assuming you still build it separately)
# Note: You would run `npm run build` in your `client` folder on your host machine first.
COPY client/dist ./client/build

# Expose the port your server runs on
EXPOSE 8000

# The command to start your cloud IDE server
# This server will then launch a bash shell that has access to all the tools we installed.
CMD ["node", "server/index.js"]