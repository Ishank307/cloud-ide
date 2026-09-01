import React, { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { File, X, Play, Users, TerminalSquare, ChevronDown, ChevronUp, FilePlus, FolderPlus, RefreshCw, Trash2 } from 'lucide-react';
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

// ─── Helper to compute parent directory ──────────────────────────────────────
function getParentDirectory(path, isDir) {
    if (!path || path === '/') return '';
    if (isDir) return path;
    const lastSlashIndex = path.lastIndexOf('/');
    if (lastSlashIndex <= 0) return '';
    return path.substring(0, lastSlashIndex);
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
    const [contextMenu, setContextMenu] = useState(null); // { x, y, path, isDir, fileName }

    const [sidebarWidth, onSidebarDrag] = useResizer(240, 140, 500, 'horizontal');
    const [terminalHeight, onTerminalDrag] = useResizer(220, 80, 520, 'vertical');

    const editorRef = useRef(null);
    const saveTimerRef = useRef(null);

    // ── Context Menu dismiss listener ─────────────────────────────────────────
    useEffect(() => {
        const handleClose = () => setContextMenu(null);
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setContextMenu(null);
        };
        if (contextMenu) {
            window.addEventListener('click', handleClose);
            window.addEventListener('contextmenu', handleClose);
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            window.removeEventListener('click', handleClose);
            window.removeEventListener('contextmenu', handleClose);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [contextMenu]);

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
        const filename = activeTab.split('/').pop();
        const ext = filename.split('.').pop()?.toLowerCase();
        const nameNoExt = filename.replace(/\.[^/.]+$/, '');
        const relPath = activeTab.startsWith('/') ? activeTab.slice(1) : activeTab;
        const dir = relPath.includes('/') ? relPath.substring(0, relPath.lastIndexOf('/')) : '.';
        let command;
        if (ext === 'js') command = `node "${relPath}"`;
        else if (ext === 'py') command = `python3 "${relPath}"`;
        else if (ext === 'sh') command = `bash "${relPath}"`;
        else if (ext === 'ts') command = `npx ts-node "${relPath}"`;
        else if (ext === 'java') command = `java "${relPath}"`;
        else if (ext === 'c') command = `gcc "${relPath}" -o "${dir}/${nameNoExt}" && "${dir}/${nameNoExt}"`;
        else if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') command = `g++ "${relPath}" -o "${dir}/${nameNoExt}" && "${dir}/${nameNoExt}"`;
        else if (ext === 'go') command = `go run "${relPath}"`;
        else if (ext === 'rs') command = `rustc "${relPath}" -o "${dir}/${nameNoExt}" && "${dir}/${nameNoExt}"`;
        else if (ext === 'rb') command = `ruby "${relPath}"`;
        else if (ext === 'php') command = `php "${relPath}"`;
        else command = `echo "No runner configured for .${ext} files"`;
        socket.emit('terminal:write', { workspaceId, data: `${command}\r` });
    };

    // ── Create New File/Folder ────────────────────────────────────────────────
    const handleCreateItem = (type, targetPath = '', isDir = true) => {
        const parentPath = getParentDirectory(targetPath, isDir);
        setNewItemState({ type, parentPath });
        setNewItemName('');
    };

    const confirmCreate = async () => {
        if (!newItemName.trim() || !newItemState) return;

        let parent = newItemState.parentPath || '';
        if (parent && !parent.startsWith('/')) {
            parent = '/' + parent;
        }
        if (parent.endsWith('/')) {
            parent = parent.slice(0, -1);
        }

        let name = newItemName.trim();
        if (name.startsWith('/')) {
            name = name.slice(1);
        }

        const filePath = parent + '/' + name;

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

    // ── Delete File/Folder ────────────────────────────────────────────────────
    const handleDeleteItem = async (path, isDir, fileName) => {
        if (!path || path === '/') return;
        const itemType = isDir ? 'folder' : 'file';
        const displayName = fileName || path.split('/').pop() || path;

        if (!window.confirm(`Are you sure you want to delete the ${itemType} "${displayName}"?`)) {
            return;
        }

        try {
            const res = await fetch(API_ENDPOINTS.FILES_DELETE, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ workspaceId, path })
            });

            if (res.ok) {
                setOpenTabs(prev => prev.filter(t => t.path !== path && !t.path.startsWith(path + '/')));
                setFileContents(prev => {
                    const next = { ...prev };
                    Object.keys(next).forEach(p => {
                        if (p === path || p.startsWith(path + '/')) {
                            delete next[p];
                        }
                    });
                    return next;
                });
                if (activeTab === path || (activeTab && activeTab.startsWith(path + '/'))) {
                    setActiveTab(null);
                }
                await getFileTree();
            } else {
                const data = await res.json();
                alert(`Error deleting item: ${data.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Error deleting item:', err);
        }
    };

    // ── Tree Context Menu Handler ─────────────────────────────────────────────
    const handleTreeContextMenu = (e, path, isDir, fileName) => {
        e.preventDefault();
        e.stopPropagation();
        const menuWidth = 160;
        const menuHeight = 120;
        const x = Math.min(e.clientX, window.innerWidth - menuWidth);
        const y = Math.min(e.clientY, window.innerHeight - menuHeight);
        setContextMenu({ x, y, path, isDir, fileName });
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
                            <button title="New File in Root" onClick={() => handleCreateItem('file', '', true)}><FilePlus size={14} /></button>
                            <button title="New Folder in Root" onClick={() => handleCreateItem('folder', '', true)}><FolderPlus size={14} /></button>
                            <button title="Refresh" onClick={getFileTree}><RefreshCw size={13} /></button>
                        </div>
                    </div>

                    {/* New item input */}
                    {newItemState && (
                        <div className="new-item-input">
                            <div className="new-item-target">
                                {newItemState.parentPath ? `Target: ${newItemState.parentPath}` : 'Target: / (root)'}
                            </div>
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
                            onContextMenu={handleTreeContextMenu}
                        />
                    </div>
                </div>

                {/* ── Context Menu Overlay ── */}
                {contextMenu && (
                    <div 
                        className="context-menu"
                        style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            className="context-menu-item"
                            onClick={() => {
                                handleCreateItem('file', contextMenu.path, contextMenu.isDir);
                                setContextMenu(null);
                            }}
                        >
                            <FilePlus size={14} />
                            <span>New File</span>
                        </button>
                        <button 
                            className="context-menu-item"
                            onClick={() => {
                                handleCreateItem('folder', contextMenu.path, contextMenu.isDir);
                                setContextMenu(null);
                            }}
                        >
                            <FolderPlus size={14} />
                            <span>New Folder</span>
                        </button>
                        {contextMenu.path && contextMenu.path !== '/' && (
                            <>
                                <div className="context-menu-divider" />
                                <button 
                                    className="context-menu-item danger"
                                    onClick={() => {
                                        const { path, isDir, fileName } = contextMenu;
                                        setContextMenu(null);
                                        handleDeleteItem(path, isDir, fileName);
                                    }}
                                >
                                    <Trash2 size={14} />
                                    <span>Delete {contextMenu.isDir ? 'Folder' : 'File'}</span>
                                </button>
                            </>
                        )}
                    </div>
                )}

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
