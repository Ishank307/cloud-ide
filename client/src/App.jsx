import React, { useState, useEffect } from "react";
import SimpleJwtAuth from "./components/SimpleJwtAuth";
import IdeWorkspace from "./components/IdeWorkspace";
import { AuthProvider, useAuth } from "./context/AuthContext";
import './App.css';
import API_BASE_URL from "./config/api";
import { TerminalSquare, Plus, ArrowRight, Clock, Trash2, Edit2 } from "lucide-react";

// ─── Workspace Selector ───────────────────────────────────────────────────────

const WorkspaceSelector = ({ user, token, onEnter, onLogout }) => {
    const [workspaces, setWorkspaces] = useState([]);
    const [joinInput, setJoinInput] = useState('');
    const [creating, setCreating] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [createName, setCreateName] = useState('');
    const [editingWsId, setEditingWsId] = useState(null);
    const [editingWsName, setEditingWsName] = useState('');

    const fetchWorkspaces = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/workspaces`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) setWorkspaces(data);
        } catch (err) {
            console.error('Failed to fetch workspaces:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkspaces();
    }, [token]);

    const handleCreate = async () => {
        setCreating(true);
        try {
            const res = await fetch(`${API_BASE_URL}/workspaces`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: createName.trim() || `${user.name}'s Workspace` })
            });
            const data = await res.json();
            if (data._id) {
                onEnter(data._id);
            }
        } catch (err) {
            console.error('Failed to create workspace', err);
        } finally {
            setCreating(false);
        }
    };

    const handleJoin = () => {
        if (joinInput.trim()) onEnter(joinInput.trim());
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to delete this workspace? This action cannot be undone.")) return;
        
        try {
            const res = await fetch(`${API_BASE_URL}/workspaces/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setWorkspaces(prev => prev.filter(w => w._id !== id));
                setSearchResults(prev => prev.filter(w => w._id !== id));
            } else {
                const err = await res.json();
                alert(err.error || "Failed to delete workspace");
            }
        } catch (err) {
            console.error('Failed to delete workspace:', err);
            alert('Failed to delete workspace');
        }
    };

    const handleStartRename = (e, ws) => {
        e.stopPropagation();
        setEditingWsId(ws._id);
        setEditingWsName(ws.name || 'Untitled Workspace');
    };

    const handleRenameSubmit = async (e, id) => {
        e.stopPropagation();
        if (!editingWsName.trim()) {
            setEditingWsId(null);
            return;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/workspaces/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: editingWsName })
            });
            if (res.ok) {
                setWorkspaces(prev => prev.map(ws => ws._id === id ? { ...ws, name: editingWsName } : ws));
                if (searchResults.length > 0) {
                    setSearchResults(prev => prev.map(ws => ws._id === id ? { ...ws, name: editingWsName } : ws));
                }
            } else {
                alert('Failed to rename workspace');
            }
        } catch (err) {
            console.error('Failed to rename workspace:', err);
            alert('Failed to rename workspace');
        }
        setEditingWsId(null);
    };

    const handleRenameKeyDown = (e, id) => {
        if (e.key === 'Enter') {
            handleRenameSubmit(e, id);
        } else if (e.key === 'Escape') {
            setEditingWsId(null);
        }
    };

    const handleSearch = async (query) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const res = await fetch(`${API_BASE_URL}/workspaces/search?q=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) setSearchResults(data);
        } catch (err) {
            console.error('Failed to search workspaces:', err);
        } finally {
            setIsSearching(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="selector-bg">
            <div className="selector-card">
                {/* Brand */}
                <div className="selector-brand">
                    <TerminalSquare size={32} className="brand-icon" />
                    <span>CloudIDE</span>
                </div>

                <h2>Welcome back, <span className="accent">{user.name}</span></h2>
                <p className="selector-subtitle">Pick up where you left off or start something new.</p>

                {/* Create input and button */}
                <div className="join-row">
                    <input
                        type="text"
                        placeholder="Enter workspace name..."
                        value={createName}
                        onChange={e => setCreateName(e.target.value)}
                    />
                    <button className="btn-create" style={{ width: 'auto' }} onClick={handleCreate} disabled={creating}>
                        <Plus size={16} />
                        {creating ? 'Creating...' : 'New'}
                    </button>
                </div>

                {/* Existing workspaces */}
                {!loading && workspaces.length > 0 && (
                    <div className="ws-list">
                        <div className="ws-list-label">YOUR WORKSPACES</div>
                        {workspaces.map(ws => (
                            <div
                                key={ws._id}
                                className="ws-item"
                                onClick={() => onEnter(ws._id)}
                            >
                                <div className="ws-item-icon">
                                    <TerminalSquare size={16} />
                                </div>
                                <div className="ws-item-info">
                                    {editingWsId === ws._id ? (
                                        <input
                                            type="text"
                                            className="ws-rename-input"
                                            value={editingWsName}
                                            onChange={(e) => setEditingWsName(e.target.value)}
                                            onKeyDown={(e) => handleRenameKeyDown(e, ws._id)}
                                            onClick={(e) => e.stopPropagation()}
                                            autoFocus
                                            onBlur={(e) => handleRenameSubmit(e, ws._id)}
                                            style={{ 
                                                background: 'rgba(255,255,255,0.1)', 
                                                border: '1px solid var(--accent)',
                                                color: 'var(--text-main)',
                                                borderRadius: '4px',
                                                padding: '2px 6px',
                                                fontSize: '15px',
                                                fontWeight: '600',
                                                width: '100%',
                                                outline: 'none'
                                            }}
                                        />
                                    ) : (
                                        <span className="ws-item-name">{ws.name || 'Untitled Workspace'}</span>
                                    )}
                                    <span className="ws-item-id">{ws._id}</span>
                                </div>
                                <div className="ws-item-meta">
                                    {ws.updatedAt && (
                                        <span className="ws-item-date">
                                            <Clock size={11} />
                                            {formatDate(ws.updatedAt)}
                                        </span>
                                    )}
                                    <button 
                                        className="btn-delete-ws" 
                                        onClick={(e) => handleStartRename(e, ws)}
                                        title="Rename workspace"
                                        style={{ marginRight: '4px' }}
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button 
                                        className="btn-delete-ws" 
                                        onClick={(e) => handleDelete(e, ws._id)}
                                        title="Delete workspace"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {loading && (
                    <div className="ws-loading">Loading your workspaces...</div>
                )}

                {/* Divider */}
                <div className="selector-divider"><span>search or join</span></div>
                
                {/* Search input */}
                <div className="join-row">
                    <input
                        type="text"
                        placeholder="Search workspace by name or ID..."
                        value={searchQuery}
                        onChange={e => handleSearch(e.target.value)}
                    />
                </div>

                {isSearching && (
                    <div className="ws-loading" style={{ marginTop: '10px' }}>Searching...</div>
                )}

                {!isSearching && searchResults.length > 0 && (
                    <div className="ws-list" style={{ marginTop: '10px' }}>
                        <div className="ws-list-label">SEARCH RESULTS</div>
                        {searchResults.map(ws => (
                            <div
                                key={ws._id}
                                className="ws-item"
                                onClick={() => onEnter(ws._id)}
                            >
                                <div className="ws-item-icon">
                                    <TerminalSquare size={16} />
                                </div>
                                <div className="ws-item-info">
                                    {editingWsId === ws._id ? (
                                        <input
                                            type="text"
                                            className="ws-rename-input"
                                            value={editingWsName}
                                            onChange={(e) => setEditingWsName(e.target.value)}
                                            onKeyDown={(e) => handleRenameKeyDown(e, ws._id)}
                                            onClick={(e) => e.stopPropagation()}
                                            autoFocus
                                            onBlur={(e) => handleRenameSubmit(e, ws._id)}
                                            style={{ 
                                                background: 'rgba(255,255,255,0.1)', 
                                                border: '1px solid var(--accent)',
                                                color: 'var(--text-main)',
                                                borderRadius: '4px',
                                                padding: '2px 6px',
                                                fontSize: '15px',
                                                fontWeight: '600',
                                                width: '100%',
                                                outline: 'none'
                                            }}
                                        />
                                    ) : (
                                        <span className="ws-item-name">{ws.name || 'Untitled Workspace'}</span>
                                    )}
                                    <span className="ws-item-id">{ws._id}</span>
                                </div>
                                <div className="ws-item-meta" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                                    <button 
                                        className="btn-delete-ws" 
                                        onClick={(e) => handleStartRename(e, ws)}
                                        title="Rename workspace"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button 
                                        className="btn-delete-ws" 
                                        onClick={(e) => handleDelete(e, ws._id)}
                                        title="Delete workspace"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Join input */}
                <div className="join-row">
                    <input
                        type="text"
                        placeholder="Paste workspace ID..."
                        value={joinInput}
                        onChange={e => setJoinInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleJoin()}
                    />
                    <button className="btn-join" onClick={handleJoin}>Join</button>
                </div>

                <button className="btn-logout-link" onClick={onLogout}>Sign out</button>
            </div>
        </div>
    );
};

// ─── Main App ─────────────────────────────────────────────────────────────────

const WORKSPACE_STORAGE_KEY = 'cloud_ide_last_workspace';

const MainApp = () => {
    const { user, token, logout, login } = useAuth();

    // Restore last workspace from localStorage on mount
    const [workspaceId, setWorkspaceId] = useState(() => {
        return localStorage.getItem(WORKSPACE_STORAGE_KEY) || '';
    });

    // Handle OAuth callback token in URL
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const authToken = urlParams.get('token');
        const authError = urlParams.get('error');
        if (authToken) {
            login(authToken);
            window.history.replaceState({}, document.title, '/');
        } else if (authError) {
            console.error('OAuth error:', authError);
        }
    }, [login]);

    const enterWorkspace = (id) => {
        localStorage.setItem(WORKSPACE_STORAGE_KEY, id);
        setWorkspaceId(id);
    };

    const exitWorkspace = () => {
        localStorage.removeItem(WORKSPACE_STORAGE_KEY);
        setWorkspaceId('');
    };

    const handleLogout = () => {
        exitWorkspace();
        logout();
    };

    if (!user) return <SimpleJwtAuth />;

    if (workspaceId) {
        return (
            <IdeWorkspace
                workspaceId={workspaceId}
                user={user}
                token={token}
                logout={() => {
                    exitWorkspace();
                    logout();
                }}
                onLeaveWorkspace={exitWorkspace}
            />
        );
    }

    return (
        <WorkspaceSelector
            user={user}
            token={token}
            onEnter={enterWorkspace}
            onLogout={handleLogout}
        />
    );
};

function App() {
    return (
        <AuthProvider>
            <MainApp />
        </AuthProvider>
    );
}

export default App;