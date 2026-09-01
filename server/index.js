require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;
const http = require('http');
const { Server: SocketServer } = require('socket.io');
const session = require('express-session');
const passport = require('./config/passport');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const WebSocket = require('ws');

const { authenticateToken, authenticateSocket } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const jwtAuthRoutes = require('./routes/jwtAuth');
const containerManager = require('./services/containerManager');
const Workspace = require('./models/Workspace');

const setupTerminalHandlers = require('./socket/terminal');
const setupFileHandlers = require('./socket/files');

const app = express();
const server = http.createServer(app);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cloud-ide')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true in production with HTTPS
}));
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authRoutes);        // Google OAuth routes
app.use('/api/auth', jwtAuthRoutes);  // JWT authentication routes

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

// Create Workspace endpoint (Basic stub for now)
app.post('/workspaces', authenticateToken, async (req, res) => {
    try {
        const workspace = new Workspace({
            name: req.body.name || 'Untitled Workspace',
            owner: req.user.id,
            collaborators: []
        });
        await workspace.save();
        
        const workspaceDir = path.resolve(`./workspaces/${workspace._id}`);
        await fs.mkdir(workspaceDir, { recursive: true });
        
        res.json(workspace);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get user's workspaces
app.get('/workspaces', authenticateToken, async (req, res) => {
    try {
        const workspaces = await Workspace.find({ 
            $or: [
                { owner: req.user.id },
                { 'collaborators.user': req.user.id }
            ]
        }).sort({ createdAt: -1 });
        res.json(workspaces);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Search workspaces by name or ID
app.get('/workspaces/search', authenticateToken, async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.json([]);
        }
        
        let dbQuery;
        if (mongoose.Types.ObjectId.isValid(query)) {
            dbQuery = { _id: query };
        } else {
            dbQuery = { name: { $regex: query, $options: 'i' } };
        }
        
        const workspaces = await Workspace.find(dbQuery).limit(10).sort({ createdAt: -1 });
        res.json(workspaces);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rename workspace
app.patch('/workspaces/:id', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        
        const workspace = await Workspace.findById(req.params.id);
        if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
        
        if (workspace.owner.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Only the owner can rename this workspace' });
        }
        
        workspace.name = name;
        await workspace.save();
        
        res.json(workspace);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete workspace
app.delete('/workspaces/:id', authenticateToken, async (req, res) => {
    try {
        const workspace = await Workspace.findById(req.params.id);
        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found' });
        }
        if (workspace.owner.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Only the owner can delete this workspace' });
        }
        
        await Workspace.findByIdAndDelete(req.params.id);
        
        const workspaceDir = path.resolve(`./workspaces/${req.params.id}`);
        try {
            await fs.rm(workspaceDir, { recursive: true, force: true });
        } catch (e) {
            console.error('Error deleting workspace directory:', e);
        }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Socket.IO Setup
const io = new SocketServer(server, {
    cors: {
        origin: true,
        credentials: true
    }
});

io.use(authenticateSocket);

// Socket state Maps
const userSockets = new Map(); // userId -> Set of socket IDs
let workspacePtyProcessesRef = null;
let workspaceWatchersRef = null;

io.on('connection', (socket) => {
    console.log('User connected:', socket.user.email);
    
    if (!userSockets.has(socket.user.id)) {
        userSockets.set(socket.user.id, new Set());
    }
    userSockets.get(socket.user.id).add(socket.id);

    // Initialize handlers
    const terminalHandlers = setupTerminalHandlers(io, socket);
    const fileHandlers = setupFileHandlers(io, socket);
    
    workspacePtyProcessesRef = terminalHandlers.workspacePtyProcesses;
    workspaceWatchersRef = fileHandlers.workspaceWatchers;

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.user.email);
        const userSocketSet = userSockets.get(socket.user.id);
        if (userSocketSet) {
            userSocketSet.delete(socket.id);
            if (userSocketSet.size === 0) {
                userSockets.delete(socket.user.id);
            }
        }

        // After a short grace period, clean up workspace if nobody is left in the room
        const workspaceId = socket.workspaceId;
        if (workspaceId) {
            setTimeout(() => {
                const room = io.sockets.adapter.rooms.get(`workspace:${workspaceId}`);
                if (!room || room.size === 0) {
                    console.log(`All users left workspace ${workspaceId}, cleaning up...`);

                    // Kill PTY process
                    if (workspacePtyProcessesRef) {
                        const ptyProcess = workspacePtyProcessesRef.get(workspaceId);
                        if (ptyProcess && !ptyProcess.killed) ptyProcess.kill();
                        workspacePtyProcessesRef.delete(workspaceId);
                    }

                    // Close file watcher
                    if (workspaceWatchersRef) {
                        const watcher = workspaceWatchersRef.get(workspaceId);
                        if (watcher) {
                            watcher.close();
                            workspaceWatchersRef.delete(workspaceId);
                        }
                    }

                    // Stop Docker container
                    containerManager.stopWorkspaceContainer(workspaceId);
                }
            }, 15000); // 15s grace period — allows page refresh reconnects
        }
    });
});

// Clean up empty workspaces (No sockets in room)
setInterval(() => {
    if (workspacePtyProcessesRef && workspaceWatchersRef) {
        for (const [workspaceId, ptyProcess] of workspacePtyProcessesRef.entries()) {
            const room = io.sockets.adapter.rooms.get(`workspace:${workspaceId}`);
            if (!room || room.size === 0) {
                console.log(`Cleaning up inactive workspace ${workspaceId}`);
                if (ptyProcess && !ptyProcess.killed) ptyProcess.kill();
                workspacePtyProcessesRef.delete(workspaceId);
                
                const watcher = workspaceWatchersRef.get(workspaceId);
                if (watcher) {
                    watcher.close();
                    workspaceWatchersRef.delete(workspaceId);
                }
            }
        }
    }
}, 5 * 60 * 1000);

// Protected File routes (Updated for Workspace)
app.get('/files', authenticateToken, async (req, res) => {
    const workspaceId = req.query.workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    
    const workspaceDir = `./workspaces/${workspaceId}`;
    try {
        await fs.mkdir(workspaceDir, { recursive: true });
        const filetree = await generatefile(workspaceDir);
        containerManager.updateWorkspaceActivity(workspaceId);
        return res.json({ tree: filetree });
    } catch(err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/files/content', authenticateToken, async (req, res) => {
    const { workspaceId, path: filePath } = req.query;
    if (!workspaceId || !filePath) return res.status(400).json({ error: 'workspaceId and path required' });

    const fullPath = `./workspaces/${workspaceId}${filePath}`;
    try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) return res.status(400).json({ error: 'Cannot read directory content' });
        const content = await fs.readFile(fullPath, 'utf-8');
        containerManager.updateWorkspaceActivity(workspaceId);
        return res.json({ content });
    } catch (error) {
        return res.status(404).json({ error: 'File not found' });
    }
});

app.post('/files/create', authenticateToken, async (req, res) => {
    const { workspaceId, path: filePath, type } = req.body;
    if (!workspaceId || !filePath) return res.status(400).json({ error: 'workspaceId and path required' });

    const fullPath = `./workspaces/${workspaceId}${filePath}`;
    try {
        if (type === 'folder') {
            await fs.mkdir(fullPath, { recursive: true });
        } else {
            // Ensure parent directory exists
            await fs.mkdir(require('path').dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, '', 'utf-8');
        }
        containerManager.updateWorkspaceActivity(workspaceId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/files/save', authenticateToken, async (req, res) => {
    const { workspaceId, path: filePath, content } = req.body;
    if (!workspaceId || !filePath) return res.status(400).json({ error: 'workspaceId and path required' });

    const fullPath = `./workspaces/${workspaceId}${filePath}`;
    try {
        await fs.mkdir(require('path').dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content ?? '', 'utf-8');
        containerManager.updateWorkspaceActivity(workspaceId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/files/delete', authenticateToken, async (req, res) => {
    const { workspaceId, path: filePath } = req.body;
    if (!workspaceId || !filePath) return res.status(400).json({ error: 'workspaceId and path required' });

    const fullPath = `./workspaces/${workspaceId}${filePath}`;
    try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
            await fs.rm(fullPath, { recursive: true });
        } else {
            await fs.unlink(fullPath);
        }
        containerManager.updateWorkspaceActivity(workspaceId);
        res.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
        if (error.code === 'ENOENT') res.status(404).json({ error: 'File or Folder not found' });
        else res.status(500).json({ error: error.message });
    }
});

app.use(express.static(path.join(__dirname, '..', 'client/build')));

// Yjs WebSocket Server Setup with Hocuspocus
const { Server, Hocuspocus } = require('@hocuspocus/server');
const hocuspocusServer = typeof Server.configure === 'function' 
    ? Server.configure({ port: 1234 }) 
    : new Hocuspocus().configure({ port: 1234 });

server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    // Route Yjs traffic specifically
    if (pathname === '/yjs') {
        hocuspocusServer.handleConnection(socket, request);
    }
});

const PORT = process.env.PORT || 8000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT}`)
});

async function generatefile(directory) {
    const tree = {};
    async function buildtree(currentDirectory, currentTree) {
        const files = await fs.readdir(currentDirectory);
        for (const file of files) {
            const filePath = path.join(currentDirectory, file);
            const stat = await fs.stat(filePath);
            if (stat.isDirectory()) {
                currentTree[file] = {};
                await buildtree(filePath, currentTree[file]);
            } else {
                currentTree[file] = null;
            }
        }
    }
    await buildtree(directory, tree);
    return tree;
}