require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;
const http = require('http');
const { Server: SocketServer } = require('socket.io');
const session = require('express-session');
const passport = require('./config/passport');
const cors = require('cors');
const chokidar = require('chokidar');
const path = require('path');
const { execSync } = require('child_process');

const { authenticateToken, authenticateSocket } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const containerManager = require('./services/containerManager');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true in production with HTTPS
}));
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authRoutes);

// Health check route
app.get('/', (req, res) => {
    res.json({
        message: 'Cloud IDE Backend API',
        status: 'running',
        endpoints: {
            auth: '/auth/google',
            files: '/files',
            websocket: 'ws://localhost:8000'
        }
    });
});

const io = new SocketServer(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        credentials: true
    }
});

// Socket.IO with authentication
io.use(authenticateSocket);

const userPtyProcesses = new Map(); // userId -> ptyProcess
const userSockets = new Map(); // userId -> Set of socket IDs
const userWatchers = new Map(); // userId -> watcher

// Clean up inactive PTY processes every 5 minutes
setInterval(() => {
    for (const [userId, ptyProcess] of userPtyProcesses.entries()) {
        if (!userSockets.has(userId) || userSockets.get(userId).size === 0) {
            console.log(`Cleaning up inactive PTY for user ${userId}`);
            if (ptyProcess && !ptyProcess.killed) {
                ptyProcess.kill();
            }
            userPtyProcesses.delete(userId);
        }
    }
}, 5 * 60 * 1000);

io.on('connection', async (socket) => {
    console.log('User connected:', socket.user.email);
    
    // Track user sockets
    if (!userSockets.has(socket.user.id)) {
        userSockets.set(socket.user.id, new Set());
    }
    userSockets.get(socket.user.id).add(socket.id);

    try {
        // Create or get user container (skip in development)
        if (process.env.NODE_ENV === 'production') {
            await containerManager.createUserContainer(socket.user.id);
        }
        containerManager.updateUserActivity(socket.user.id);

        // Create user directory if it doesn't exist
        const userDir = path.resolve(`./users/${socket.user.id}`);
        await fs.mkdir(userDir, { recursive: true });

        // Get or create PTY process for this user
        let ptyProcess = userPtyProcesses.get(socket.user.id);
        
        if (!ptyProcess || ptyProcess.killed) {
            const pty = require('node-pty');

            // Use bash if available, fallback to sh
            let shell = 'bash';
            try {
                execSync('which bash', { stdio: 'ignore' });
            } catch (e) {
                shell = 'sh';
                console.log('Bash not found, using sh');
            }

            console.log(`Creating new PTY process for user ${socket.user.email}`);

            try {
                ptyProcess = pty.spawn(shell, [], {
                    name: 'xterm-color',
                    cols: 80,
                    rows: 30,
                    cwd: userDir,
                    env: {
                        PATH: process.env.PATH,
                        HOME: userDir,
                        USER: `user_${socket.user.id}`,
                        SHELL: shell,
                        TERM: 'xterm-256color',
                        PWD: userDir
                    }
                });

                // Set up data handler - broadcast to all user's sockets
                ptyProcess.onData((data) => {
                    const userSocketSet = userSockets.get(socket.user.id);
                    if (userSocketSet) {
                        userSocketSet.forEach(socketId => {
                            const userSocket = io.sockets.sockets.get(socketId);
                            if (userSocket) {
                                userSocket.emit('terminal:data', data);
                            }
                        });
                    }
                });

                // Handle PTY errors and exit
                ptyProcess.onExit((exitCode, signal) => {
                    console.log(`PTY process exited for user ${socket.user.email}: code ${JSON.stringify(exitCode)}, signal ${signal}`);
                    userPtyProcesses.delete(socket.user.id);
                    
                    // Notify all user's sockets
                    const userSocketSet = userSockets.get(socket.user.id);
                    if (userSocketSet) {
                        userSocketSet.forEach(socketId => {
                            const userSocket = io.sockets.sockets.get(socketId);
                            if (userSocket) {
                                userSocket.emit('terminal:data', '\r\nTerminal session ended. Reconnecting...\r\n');
                            }
                        });
                    }
                });

                userPtyProcesses.set(socket.user.id, ptyProcess);
                console.log(`Created PTY process for user ${socket.user.email}`);

                // Send welcome message
                setTimeout(() => {
                    if (!ptyProcess.killed) {
                        socket.emit('terminal:data', `Welcome to your workspace!\r\nDirectory: ${userDir}\r\n`);
                    }
                }, 500);

            } catch (error) {
                console.error('Error creating PTY process:', error);
                socket.emit('terminal:data', `Error creating terminal: ${error.message}\r\n`);
            }
        } else {
            // PTY exists, just send welcome message to this socket
            socket.emit('terminal:data', 'Terminal reconnected!\r\n');
        }

        socket.on('terminal:write', (data) => {
            const currentPty = userPtyProcesses.get(socket.user.id);
            
            if (currentPty && !currentPty.killed) {
                try {
                    currentPty.write(data);
                    containerManager.updateUserActivity(socket.user.id);
                } catch (error) {
                    console.error('Error writing to PTY:', error);
                    socket.emit('terminal:data', 'Terminal error occurred. Reconnecting...\r\n');
                    // Remove the broken PTY so it gets recreated
                    userPtyProcesses.delete(socket.user.id);
                }
            } else {
                socket.emit('terminal:data', 'Terminal not ready. Please refresh.\r\n');
            }
        });

        socket.on('file:change', async ({ path, content }) => {
            await fs.writeFile(`${userDir}${path}`, content, 'utf-8');
            containerManager.updateUserActivity(socket.user.id);
        });

        // Set up file watcher (one per user, not per socket)
        if (!userWatchers.has(socket.user.id)) {
            const watcher = chokidar.watch(userDir);
            watcher.on('all', (_, filePath) => {
                // Broadcast to all user's sockets
                const userSocketSet = userSockets.get(socket.user.id);
                if (userSocketSet) {
                    userSocketSet.forEach(socketId => {
                        const userSocket = io.sockets.sockets.get(socketId);
                        if (userSocket) {
                            userSocket.emit('file:refresh', filePath);
                        }
                    });
                }
            });
            userWatchers.set(socket.user.id, watcher);
        }

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.user.email);
            
            // Remove this socket from user's socket set
            const userSocketSet = userSockets.get(socket.user.id);
            if (userSocketSet) {
                userSocketSet.delete(socket.id);
                
                // If no more sockets for this user, clean up watcher
                if (userSocketSet.size === 0) {
                    const watcher = userWatchers.get(socket.user.id);
                    if (watcher) {
                        watcher.close();
                        userWatchers.delete(socket.user.id);
                    }
                    
                    // Keep PTY alive for 2 minutes for potential reconnection
                    setTimeout(() => {
                        const currentSocketSet = userSockets.get(socket.user.id);
                        if (!currentSocketSet || currentSocketSet.size === 0) {
                            const ptyProcess = userPtyProcesses.get(socket.user.id);
                            if (ptyProcess && !ptyProcess.killed) {
                                console.log(`Cleaning up PTY for inactive user ${socket.user.email}`);
                                ptyProcess.kill();
                                userPtyProcesses.delete(socket.user.id);
                            }
                        }
                    }, 2 * 60 * 1000); // 2 minutes
                }
            }
        });

    } catch (error) {
        console.error('Error setting up user session:', error);
        socket.emit('error', 'Failed to initialize workspace');
    }
});

// Protected routes
app.get('/files', authenticateToken, async (req, res) => {
    const userDir = `./users/${req.user.id}`;
    await fs.mkdir(userDir, { recursive: true });
    const filetree = await generatefile(userDir);
    containerManager.updateUserActivity(req.user.id);
    return res.json({ tree: filetree });
});

app.get('/files/content', authenticateToken, async (req, res) => {
    const filePath = req.query.path;

    if (!filePath) {
        return res.status(400).json({ error: 'Path parameter is required' });
    }

    const fullPath = `./users/${req.user.id}${filePath}`;

    try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
            return res.status(400).json({ error: 'Cannot read directory content' });
        }

        const content = await fs.readFile(fullPath, 'utf-8');
        containerManager.updateUserActivity(req.user.id);
        return res.json({ content });
    } catch (error) {
        return res.status(404).json({ error: 'File not found' });
    }
});

app.post('/files/create', authenticateToken, async (req, res) => {
    const { path: filePath, type } = req.body;

    if (!filePath) {
        return res.status(400).json({ error: 'Path parameter is required' });
    }

    const fullPath = `./users/${req.user.id}${filePath}`;

    try {
        if (type === 'folder') {
            await fs.mkdir(fullPath, { recursive: true });
        } else {
            await fs.writeFile(fullPath, '', 'utf-8');
        }
        containerManager.updateUserActivity(req.user.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/files/delete', authenticateToken, async (req, res) => {
    const { path: filePath } = req.body;
    if (!filePath) {
        return res.status(400).json({ error: 'Path parameter is required' });
    }

    const fullPath = `./users/${req.user.id}${filePath}`;

    try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
            await fs.rmdir(fullPath, { recursive: true });
        } else {
            await fs.unlink(fullPath);
        }
        containerManager.updateUserActivity(req.user.id);
        res.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'File or Folder not found' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

app.use(express.static(path.join(__dirname, '..', 'client/build')));

// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '..', 'client/build', 'index.html'));
// });

const PORT = process.env.PORT || 8000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT}`)
})

async function generatefile(directory) {
    const tree = {};

    async function buildtree(currentDirectory, currentTree) {
        const files = await fs.readdir(currentDirectory)

        for (const file of files) {
            const filePath = path.join(currentDirectory, file);
            const stat = await fs.stat(filePath);
            if (stat.isDirectory()) {
                currentTree[file] = {};
                await buildtree(filePath, currentTree[file]);
            }
            else {
                currentTree[file] = null;
            }
        }

    }
    await buildtree(directory, tree);
    return tree;
}