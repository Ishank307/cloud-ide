const Docker = require('dockerode');
const docker = new Docker();

class ContainerManager {
    constructor() {
        this.workspaceContainers = new Map(); // workspaceId -> containerInfo
        this.workspaceTimers = new Map(); // workspaceId -> timeout
    }

    async createWorkspaceContainer(workspaceId) {
        // In development, skip Docker entirely — just use local shell
        if (process.env.NODE_ENV !== 'production') {
            if (!this.workspaceContainers.has(workspaceId)) {
                const containerInfo = { id: 'dev-mode', workspaceId, createdAt: new Date(), lastActivity: new Date() };
                this.workspaceContainers.set(workspaceId, containerInfo);
            }
            return this.workspaceContainers.get(workspaceId);
        }

        try {
            // Check if Docker is available
            try {
                await docker.ping();
                console.log('Docker is available, creating container...');
            } catch (dockerError) {
                console.log('Docker not available, using local environment');
                return { id: 'local-mode', workspaceId, createdAt: new Date(), lastActivity: new Date() };
            }

            // Check if container already exists
            if (this.workspaceContainers.has(workspaceId)) {
                const containerInfo = this.workspaceContainers.get(workspaceId);
                const container = docker.getContainer(containerInfo.id);
                
                // Check if container is running
                const inspect = await container.inspect();
                if (inspect.State.Running) {
                    console.log(`Container for workspace ${workspaceId} already running`);
                    return containerInfo;
                }
            }

            // Create new container for workspace
            const container = await docker.createContainer({
                Image: 'node:18-alpine',
                Cmd: ['sh', '-c', 'apk add --no-cache bash && addgroup -g 1000 workspace && adduser -u 1000 -G workspace -h /workspace -D workspace && chown -R workspace:workspace /workspace && su workspace -c "cd /workspace && tail -f /dev/null"'],
                WorkingDir: `/workspace`,
                Tty: true,
                OpenStdin: true,
                AttachStdin: true,
                AttachStdout: true,
                AttachStderr: true,
                Env: [`WORKSPACE_ID=${workspaceId}`],
                HostConfig: {
                    Memory: 512 * 1024 * 1024, // 512MB limit
                    CpuShares: 512,
                    PidsLimit: 100,
                    NetworkMode: 'none',
                    Binds: [
                        `${require('path').resolve('./workspaces/' + workspaceId)}:/workspace`
                    ]
                }
            });

            await container.start();
            
            const containerInfo = {
                id: container.id,
                workspaceId: workspaceId,
                createdAt: new Date(),
                lastActivity: new Date()
            };

            this.workspaceContainers.set(workspaceId, containerInfo);
            console.log(`Created container ${container.id} for workspace ${workspaceId}`);
            
            return containerInfo;
        } catch (error) {
            console.error('Error creating container:', error);
            throw error;
        }
    }

    async stopWorkspaceContainer(workspaceId) {
        try {
            const containerInfo = this.workspaceContainers.get(workspaceId);
            if (!containerInfo) return;

            const container = docker.getContainer(containerInfo.id);
            await container.stop();
            await container.remove();
            
            this.workspaceContainers.delete(workspaceId);
            this.clearWorkspaceTimer(workspaceId);
            
            console.log(`Stopped and removed container for workspace ${workspaceId}`);
        } catch (error) {
            console.error('Error stopping container:', error);
        }
    }

    updateWorkspaceActivity(workspaceId) {
        const containerInfo = this.workspaceContainers.get(workspaceId);
        if (containerInfo) {
            containerInfo.lastActivity = new Date();
        }

        // Clear existing timer
        this.clearWorkspaceTimer(workspaceId);

        // Set new timer for 30 minutes
        const timer = setTimeout(() => {
            console.log(`Workspace ${workspaceId} inactive for 30 minutes, stopping container`);
            this.stopWorkspaceContainer(workspaceId);
        }, 30 * 60 * 1000); // 30 minutes

        this.workspaceTimers.set(workspaceId, timer);
    }

    clearWorkspaceTimer(workspaceId) {
        const timer = this.workspaceTimers.get(workspaceId);
        if (timer) {
            clearTimeout(timer);
            this.workspaceTimers.delete(workspaceId);
        }
    }

    getWorkspaceContainer(workspaceId) {
        return this.workspaceContainers.get(workspaceId);
    }

    async executeCommand(workspaceId, command) {
        const containerInfo = this.workspaceContainers.get(workspaceId);
        if (!containerInfo) {
            throw new Error('No container found for workspace');
        }

        const container = docker.getContainer(containerInfo.id);
        const exec = await container.exec({
            Cmd: ['sh', '-c', command],
            AttachStdout: true,
            AttachStderr: true,
        });

        const stream = await exec.start();
        this.updateWorkspaceActivity(workspaceId);
        
        return stream;
    }
}

module.exports = new ContainerManager();