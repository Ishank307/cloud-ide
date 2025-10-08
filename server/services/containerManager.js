const Docker = require('dockerode');
const docker = new Docker();

class ContainerManager {
    constructor() {
        this.userContainers = new Map(); // userId -> containerInfo
        this.userTimers = new Map(); // userId -> timeout
    }

    async createUserContainer(userId) {
        try {
            // Check if Docker is available
            try {
                await docker.ping();
                console.log('Docker is available, creating container...');
            } catch (dockerError) {
                console.log('Docker not available, using local environment');
                return { id: 'local-mode', userId, createdAt: new Date(), lastActivity: new Date() };
            }

            // Enable container creation in development for testing
            // if (process.env.NODE_ENV !== 'production') {
            //     console.log(`Skipping container creation for user ${userId} in development mode`);
            //     return { id: 'dev-mode', userId, createdAt: new Date(), lastActivity: new Date() };
            // }

            // Check if container already exists
            if (this.userContainers.has(userId)) {
                const containerInfo = this.userContainers.get(userId);
                const container = docker.getContainer(containerInfo.id);
                
                // Check if container is running
                const inspect = await container.inspect();
                if (inspect.State.Running) {
                    console.log(`Container for user ${userId} already running`);
                    return containerInfo;
                }
            }

            // Create new container for user
            const container = await docker.createContainer({
                Image: 'node:18-alpine',
                Cmd: ['sh', '-c', 'apk add --no-cache bash && tail -f /dev/null'],
                WorkingDir: `/workspace/${userId}`,
                Tty: true,
                OpenStdin: true,
                AttachStdin: true,
                AttachStdout: true,
                AttachStderr: true,
                Env: [`USER_ID=${userId}`],
                HostConfig: {
                    Memory: 512 * 1024 * 1024, // 512MB limit
                    CpuShares: 512, // CPU limit
                }
            });

            await container.start();
            
            const containerInfo = {
                id: container.id,
                userId: userId,
                createdAt: new Date(),
                lastActivity: new Date()
            };

            this.userContainers.set(userId, containerInfo);
            console.log(`Created container ${container.id} for user ${userId}`);
            
            return containerInfo;
        } catch (error) {
            console.error('Error creating container:', error);
            // In development, don't throw error, just log it
            if (process.env.NODE_ENV !== 'production') {
                console.log('Container creation failed, continuing in development mode');
                return { id: 'dev-mode', userId, createdAt: new Date(), lastActivity: new Date() };
            }
            throw error;
        }
    }

    async stopUserContainer(userId) {
        try {
            const containerInfo = this.userContainers.get(userId);
            if (!containerInfo) return;

            const container = docker.getContainer(containerInfo.id);
            await container.stop();
            await container.remove();
            
            this.userContainers.delete(userId);
            this.clearUserTimer(userId);
            
            console.log(`Stopped and removed container for user ${userId}`);
        } catch (error) {
            console.error('Error stopping container:', error);
        }
    }

    updateUserActivity(userId) {
        const containerInfo = this.userContainers.get(userId);
        if (containerInfo) {
            containerInfo.lastActivity = new Date();
        }

        // Clear existing timer
        this.clearUserTimer(userId);

        // Set new timer for 10 minutes
        const timer = setTimeout(() => {
            console.log(`User ${userId} inactive for 10 minutes, stopping container`);
            this.stopUserContainer(userId);
        }, 10 * 60 * 1000); // 10 minutes

        this.userTimers.set(userId, timer);
    }

    clearUserTimer(userId) {
        const timer = this.userTimers.get(userId);
        if (timer) {
            clearTimeout(timer);
            this.userTimers.delete(userId);
        }
    }

    getUserContainer(userId) {
        return this.userContainers.get(userId);
    }

    async executeCommand(userId, command) {
        const containerInfo = this.userContainers.get(userId);
        if (!containerInfo) {
            throw new Error('No container found for user');
        }

        const container = docker.getContainer(containerInfo.id);
        const exec = await container.exec({
            Cmd: ['sh', '-c', command],
            AttachStdout: true,
            AttachStderr: true,
        });

        const stream = await exec.start();
        this.updateUserActivity(userId);
        
        return stream;
    }
}

module.exports = new ContainerManager();