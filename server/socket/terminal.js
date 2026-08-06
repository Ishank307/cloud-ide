const containerManager = require('../services/containerManager');
const path = require('path');
const fs = require('fs').promises;
const { execSync } = require('child_process');

const workspacePtyProcesses = new Map(); // workspaceId -> ptyProcess

module.exports = function setupTerminalHandlers(io, socket) {
    socket.on('terminal:start', async ({ workspaceId }) => {
        try {
            // Join workspace room
            socket.join(`workspace:${workspaceId}`);
            
            // Create or get container
            // Enforce Docker for isolation
            await containerManager.createWorkspaceContainer(workspaceId);
            containerManager.updateWorkspaceActivity(workspaceId);

            const workspaceDir = path.resolve(`./workspaces/${workspaceId}`);
            await fs.mkdir(workspaceDir, { recursive: true });

            let ptyProcess = workspacePtyProcesses.get(workspaceId);
            
            if (!ptyProcess || ptyProcess.killed) {
                const pty = require('node-pty');
                
                console.log(`Creating new PTY process for workspace ${workspaceId}`);
                
                // We connect the PTY to the docker container via docker exec
                const containerInfo = containerManager.getWorkspaceContainer(workspaceId);
                let command = 'bash';
                let args = [];
                
                if (containerInfo && containerInfo.id !== 'local-mode' && containerInfo.id !== 'dev-mode') {
                    // Use Docker exec to run bash inside the container
                    command = 'docker';
                    args = ['exec', '-it', '-u', 'workspace', containerInfo.id, 'bash'];
                } else {
                    // Fallback to local bash
                    try {
                        execSync('which bash', { stdio: 'ignore' });
                    } catch (e) {
                        command = 'sh';
                    }
                }

                try {
                    ptyProcess = pty.spawn(command, args, {
                        name: 'xterm-color',
                        cols: 80,
                        rows: 30,
                        cwd: workspaceDir,
                        env: process.env // For docker exec, host env is fine, container has its own env
                    });

                    // Broadcast to everyone in the workspace room
                    ptyProcess.onData((data) => {
                        io.to(`workspace:${workspaceId}`).emit('terminal:data', data);
                    });

                    ptyProcess.onExit((exitCode, signal) => {
                        console.log(`PTY exited for workspace ${workspaceId}: code ${JSON.stringify(exitCode)}, signal ${signal}`);
                        workspacePtyProcesses.delete(workspaceId);
                        io.to(`workspace:${workspaceId}`).emit('terminal:data', '\r\nTerminal session ended. Reconnecting...\r\n');
                    });

                    workspacePtyProcesses.set(workspaceId, ptyProcess);
                    
                    setTimeout(() => {
                        if (!ptyProcess.killed) {
                            socket.emit('terminal:data', `Welcome to workspace ${workspaceId}!\r\n`);
                        }
                    }, 500);

                } catch (error) {
                    console.error('Error creating PTY process:', error);
                    socket.emit('terminal:data', `Error creating terminal: ${error.message}\r\n`);
                }
            } else {
                // Just send a welcome message to this socket, as PTY is already running
                socket.emit('terminal:data', 'Terminal connected!\r\n');
            }
        } catch (error) {
            console.error(error);
            socket.emit('terminal:data', 'Failed to initialize workspace terminal\r\n');
        }
    });

    socket.on('terminal:write', ({ workspaceId, data }) => {
        const currentPty = workspacePtyProcesses.get(workspaceId);
        
        if (currentPty && !currentPty.killed) {
            try {
                currentPty.write(data);
                containerManager.updateWorkspaceActivity(workspaceId);
            } catch (error) {
                console.error('Error writing to PTY:', error);
                socket.emit('terminal:data', 'Terminal error occurred. Reconnecting...\r\n');
                workspacePtyProcesses.delete(workspaceId);
            }
        }
    });
    
    return { workspacePtyProcesses };
};
