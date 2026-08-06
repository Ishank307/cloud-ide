import React, { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { File, X, Play, Users, TerminalSquare, ChevronDown, ChevronUp, FilePlus, FolderPlus, RefreshCw } from 'lucide-react';
import Terminal from './terminal';
import FileTree from './tree';
import socketManager from '../socket';
import { API_ENDPOINTS, SOCKET_URL } from '../config/api';

// ─── Custom Resizable Splitter Hook ──────────────────────────────────────────

function useResizer(initial, min, max, direction = 'horizontal') {
    const [size, setSize] = useState(initial);
    const dragging = useRef(false);
    const startPos = useRef(0);
    const startSize = useRef(initial);

    const onMouseDown = useCallback((e) => {
        e.preventDefault();
        dragging.current = true;
        startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
        startSize.current = size;

        const onMouseMove = (e) => {
            if (!dragging.current) return;
            const delta = direction === 'horizontal'
                ? e.clientX - startPos.current
                : e.clientY - startPos.current;
            const newSize = Math.min(max, Math.max(min, startSize.current + delta));
            setSize(newSize);
        };

        const onMouseUp = () => {
            dragging.current = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';
    }, [size, min, max, direction]);

    return [size, onMouseDown];
}

// ─── Language detection ───────────────────────────────────────────────────────
function getLanguage(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const map = {
        js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
        py: 'python', java: 'java', cpp: 'cpp', c: 'c', cs: 'csharp',
        go: 'go', rs: 'rust', rb: 'ruby', php: 'php',
        html: 'html', css: 'css', scss: 'scss', json: 'json',
        md: 'markdown', sh: 'shell', yaml: 'yaml', yml: 'yaml',
        xml: 'xml', sql: 'sql', kt: 'kotlin', swift: 'swift',
    };
    return map[ext] || 'plaintext';
}

// ─── IDE Workspace ─────────────────────────────────────────────────────────

const IdeWorkspace = ({ workspaceId, user, token, logout, onLeaveWorkspace }) => {
    const [socket, setSocket] = useState(null);
    const [fileTree, setFileTree] = useState({});

    const [openTabs, setOpenTabs] = useState([]);
    const [activeTab, setActiveTab] = useState(null);
    const [fileContents, setFileContents] = useState({}); // path -> content
    const [terminalOpen, setTerminalOpen] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newItemState, setNewItemState] = useState(null); // { type: 'file'|'folder', parentPath }
    const [newItemName, setNewItemName] = useState('');

    const [sidebarWidth, onSidebarDrag] = useResizer(240, 140, 500, 'horizontal');
    const [terminalHeight, onTerminalDrag] = useResizer(220, 80, 520, 'vertical');

    const editorRef = useRef(null);
    const saveTimerRef = useRef(null);

    // ── Socket ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (token && !socket) {
            const newSocket = socketManager.createSocket(token, SOCKET_URL);
            setSocket(newSocket);
            // NOTE: workspace:join and terminal:start are handled inside Terminal component
            // to avoid duplicate PTY spawning on reconnects.
            newSocket.on('file:refresh', getFileTree);
            return () => { newSocket.disconnect(); };
        }
    }, [token, workspaceId]);

    // ── File Tree ───────────────────────────────────────────────────────────
    const getFileTree = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_ENDPOINTS.FILES}?workspaceId=${workspaceId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setFileTree(data.tree);
            }
        } catch (err) {
            console.error('Error fetching file tree:', err);
        }
    }, [token, workspaceId]);

    useEffect(() => { getFileTree(); }, [workspaceId]);

    // ── Load File Content ────────────────────────────────────────────────────
    const loadFile = useCallback(async (path) => {
        if (fileContents[path] !== undefined) return; // already cached
        try {
            const res = await fetch(`${API_ENDPOINTS.FILES_CONTENT}?workspaceId=${workspaceId}&path=${encodeURIComponent(path)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setFileContents(prev => ({ ...prev, [path]: data.content }));
            }
        } catch (err) {
            console.error('Error loading file:', err);
        }
    }, [token, workspaceId, fileContents]);

    // ── Save File Content ────────────────────────────────────────────────────
    const saveFile = useCallback(async (path, content) => {
        if (!path || content === undefined) return;
        setSaving(true);
        try {
            await fetch(API_ENDPOINTS.FILES_SAVE, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ workspaceId, path, content })
            });
        } catch (err) {
            console.error('Error saving file:', err);
        } finally {
            setSaving(false);
        }
    }, [token, workspaceId]);

    // ── Tabs ─────────────────────────────────────────────────────────────────
    const handleFileSelect = useCallback(async (path) => {
        if (path.endsWith('/')) return; // folder — skip
        const name = path.split('/').pop();
        if (!openTabs.find(t => t.path === path)) {
            setOpenTabs(prev => [...prev, { path, name }]);
        }
        setActiveTab(path);
        await loadFile(path);
    }, [openTabs, loadFile]);

    const handleTabClose = (e, path) => {
        e.stopPropagation();
        setOpenTabs(prev => prev.filter(t => t.path !== path));
        setFileContents(prev => { const n = { ...prev }; delete n[path]; return n; });
        if (activeTab === path) {
            const remaining = openTabs.filter(t => t.path !== path);
            setActiveTab(remaining.length > 0 ? remaining[remaining.length - 1].path : null);
        }
    };

    // ── Editor Change → debounced auto-save ──────────────────────────────────
    const handleEditorChange = (value) => {
        if (!activeTab) return;
        setFileContents(prev => ({ ...prev, [activeTab]: value }));
        // debounce save by 1.2s
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            saveFile(activeTab, value);
        }, 1200);
    };

    // Ctrl+S to save immediately
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (activeTab && fileContents[activeTab] !== undefined) {
                    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                    saveFile(activeTab, fileContents[activeTab]);
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [activeTab, fileContents, saveFile]);

    const handleEditorMount = (editor) => { editorRef.current = editor; };

    // ── Run Code ──────────────────────────────────────────────────────────────
    const runCode = () => {
        if (!activeTab || !socket) return;
        // activeTab is like "/subdir/test.js" — get just the filename
        const filename = activeTab.split('/').pop();
        const ext = filename.split('.').pop()?.toLowerCase();
        // Build run command — the terminal CWD is already the workspace root
        // If the file is in a subdirectory, we need the relative path from workspace root
        const relPath = activeTab.startsWith('/') ? activeTab.slice(1) : activeTab;
        let command;
        if (ext === 'js') command = `node "${relPath}"`;
        else if (ext === 'py') command = `python3 "${relPath}"`;
        else if (ext === 'sh') command = `bash "${relPath}"`;
        else if (ext === 'ts') command = `npx ts-node "${relPath}"`;
        else command = `echo "No runner configured for .${ext} files"`;
        socket.emit('terminal:write', { workspaceId, data: `${command}\r` });
    };

    // ── Create New File/Folder ────────────────────────────────────────────────
    const handleCreateItem = async (type) => {
        setNewItemState({ type });
        setNewItemName('');
    };

    const confirmCreate = async () => {
        if (!newItemName.trim()) return;
        const filePath = '/' + newItemName.trim();
        try {
            await fetch(API_ENDPOINTS.FILES_CREATE, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ workspaceId, path: filePath, type: newItemState.type })
            });
            setNewItemState(null);
            setNewItemName('');
            await getFileTree();
        } catch (err) {
            console.error('Error creating item:', err);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="workspace-container">
            {/* ── Header ── */}
            <div className="workspace-header">
                <div className="brand">
                    <TerminalSquare size={22} className="brand-icon" />
                    <span>CloudIDE</span>
                    <span className="workspace-badge">{workspaceId}</span>
                </div>
                <div className="header-actions">
                    <div className="user-profile">
                        <Users size={14} />
                        <span>{user.name}</span>
                    </div>
                    {saving && <span className="saving-indicator">Saving...</span>}
                    {onLeaveWorkspace && (
                        <button onClick={onLeaveWorkspace} className="btn-workspaces">← Workspaces</button>
                    )}
                    <button onClick={logout} className="btn-exit">Sign out</button>
                </div>
            </div>

            {/* ── Main IDE Body ── */}
            <div className="ide-body">

                {/* ── Sidebar ── */}
                <div className="ide-sidebar" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
                    <div className="sidebar-title">
                        <span>EXPLORER</span>
                        <div className="sidebar-actions">
                            <button title="New File" onClick={() => handleCreateItem('file')}><FilePlus size={14} /></button>
                            <button title="New Folder" onClick={() => handleCreateItem('folder')}><FolderPlus size={14} /></button>
                            <button title="Refresh" onClick={getFileTree}><RefreshCw size={13} /></button>
                        </div>
                    </div>

                    {/* New item input */}
                    {newItemState && (
                        <div className="new-item-input">
                            <input
                                autoFocus
                                type="text"
                                placeholder={newItemState.type === 'file' ? 'filename.js' : 'folder-name'}
                                value={newItemName}
                                onChange={e => setNewItemName(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') confirmCreate();
                                    if (e.key === 'Escape') setNewItemState(null);
                                }}
                            />
                        </div>
                    )}

                    <div className="sidebar-content">
                        <FileTree
                            tree={fileTree}
                            onselect={handleFileSelect}
                            activePath={activeTab}
                        />
                    </div>
                </div>

                {/* ── Sidebar Drag Handle ── */}
                <div className="drag-handle drag-handle-v" onMouseDown={onSidebarDrag} />

                {/* ── Editor + Terminal Column ── */}
                <div className="ide-main">

                    {/* Editor area */}
                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

                        {/* Tabs */}
                        <div className="editor-tabs">
                            {openTabs.map(tab => (
                                <div
                                    key={tab.path}
                                    className={`tab ${activeTab === tab.path ? 'active' : ''}`}
                                    onClick={() => { setActiveTab(tab.path); loadFile(tab.path); }}
                                >
                                    <File size={13} />
                                    <span>{tab.name}</span>
                                    <button className="tab-close" onClick={(e) => handleTabClose(e, tab.path)}>
                                        <X size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Active file toolbar */}
                        {activeTab && (
                            <div className="editor-toolbar">
                                <span className="path-breadcrumb">{activeTab}</span>
                                <button onClick={runCode} className="btn-run">
                                    <Play size={13} /> Run
                                </button>
                            </div>
                        )}

                        {/* Monaco */}
                        <div style={{ flex: 1, overflow: 'hidden', background: '#1e1e1e' }}>
                            {activeTab ? (
                                <Editor
                                    height="100%"
                                    theme="vs-dark"
                                    language={getLanguage(activeTab)}
                                    value={fileContents[activeTab] ?? ''}
                                    onMount={handleEditorMount}
                                    onChange={handleEditorChange}
                                    options={{
                                        minimap: { enabled: true },
                                        fontSize: 14,
                                        wordWrap: 'on',
                                        padding: { top: 16 },
                                        scrollBeyondLastLine: false,
                                        automaticLayout: true,
                                    }}
                                />
                            ) : (
                                <div className="empty-editor">
                                    <TerminalSquare size={52} strokeWidth={1} />
                                    <h2>Welcome to CloudIDE</h2>
                                    <p>Click a file in the explorer to start editing.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Terminal Drag Handle ── */}
                    {terminalOpen && (
                        <div className="drag-handle drag-handle-h" onMouseDown={onTerminalDrag} />
                    )}

                    {/* ── Terminal ── */}
                    <div
                        className="terminal-panel"
                        style={terminalOpen ? { height: terminalHeight, minHeight: terminalHeight } : {}}
                    >
                        <div className="terminal-toolbar" onClick={() => setTerminalOpen(o => !o)}>
                            <span>TERMINAL</span>
                            {terminalOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        </div>
                        {terminalOpen && (
                            <div className="terminal-content">
                                {socket && <Terminal socket={socket} workspaceId={workspaceId} />}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IdeWorkspace;
