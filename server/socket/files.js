const chokidar = require('chokidar');
const path = require('path');
const containerManager = require('../services/containerManager');

const workspaceWatchers = new Map(); // workspaceId -> watcher

module.exports = function setupFileHandlers(io, socket) {
    // Client wants to start watching a workspace
    socket.on('workspace:join', ({ workspaceId }) => {
        socket.join(`workspace:${workspaceId}`);
        
        // Ensure only one file watcher exists per workspace
        if (!workspaceWatchers.has(workspaceId)) {
            const workspaceDir = path.resolve(`./workspaces/${workspaceId}`);
            
            try {
                const watcher = chokidar.watch(workspaceDir, {
                    ignored: /(^|[\/\\])\../, // ignore dotfiles
                    persistent: true,
                    ignoreInitial: true
                });
                
                watcher.on('all', (event, filePath) => {
                    // Send to everyone in the workspace room
                    io.to(`workspace:${workspaceId}`).emit('file:refresh', { event, filePath: filePath.replace(workspaceDir, '') });
                });
                
                workspaceWatchers.set(workspaceId, watcher);
                console.log(`Started watching workspace ${workspaceId}`);
            } catch (error) {
                console.error(`Failed to watch workspace ${workspaceId}:`, error);
            }
        }
    });

    return { workspaceWatchers };
};
