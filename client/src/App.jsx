import Terminal from "./components/terminal"
import Auth from "./components/Auth";
import SimpleJwtAuth from "./components/SimpleJwtAuth";
import './App.css';
import { useCallback, useEffect, useState } from "react";
import FileTree from "./components/tree";
import socketManager from "./socket";
import AceEditor from 'react-ace';
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/ext-language_tools";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { API_ENDPOINTS, SOCKET_URL } from "./config/api";
import { getFileIcon } from "./utils/fileIcons";


const MainApp = () => {
    const { user, token, logout, login } = useAuth();
    const [socket, setSocket] = useState(null);
    const [fileTree, setFileTree] = useState({});
    const [selectedFile, setSelectedFile] = useState('');
    const [selectedFileContent, setSelectedFileContent] = useState('');
    const [code, setCode] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createType, setCreateType] = useState('file');
    const [createName, setCreateName] = useState('');
    const [currentPath, setCurrentPath] = useState('');
    const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, type: 'editor' });
    const [terminalMinimized, setTerminalMinimized] = useState(false);

    const isSaved = selectedFileContent === code;

    // Handle OAuth callback
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const authToken = urlParams.get('token');
        const authError = urlParams.get('error');

        if (authToken) {
            login(authToken);
            // Clean up URL
            window.history.replaceState({}, document.title, '/');
        } else if (authError) {
            console.error('OAuth error:', authError);
            // Could show error message to user
        }
    }, [login]);

    useEffect(() => {
        if (token && !socket) {
            const newSocket = socketManager.createSocket(token, SOCKET_URL);
            setSocket(newSocket);
        }
    }, [token, socket]);


    const getFileTree = async () => {
        if (!token) return;

        try {
            const response = await fetch(API_ENDPOINTS.FILES, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                logout();
                return;
            }

            const result = await response.json();
            setFileTree(result.tree);
        } catch (error) {
            console.error('Error fetching file tree:', error);
        }
    };


    const createFileOrFolder = async () => {
        if (!createName.trim()) return;
        const fullPath = currentPath ? `${currentPath}/${createName}` : `/${createName}`;

        try {
            const response = await fetch(API_ENDPOINTS.FILES_CREATE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    path: fullPath,
                    type: createType
                })
            });


            if (response.ok) {
                getFileTree();
                setShowCreateModal(false);
                setCreateName('');
            } else {
                const error = await response.json();
                alert(`Error creating ${createType}:${error.error}`)
            }

        }
        catch (error) {
            console.error('Error creating file/folder', error);
            alert(`Error creating ${createType}`);
        }
    };


    const deleteFileOrFolder = async (filePath) => {
        if (!confirm(`Are you sure you want to delete ${filePath}?`)) return;

        try {
            const response = await fetch(API_ENDPOINTS.FILES_DELETE, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    path: filePath
                })
            });

            if (response.ok) {
                getFileTree(); // Refresh the file tree
                // If deleted file was selected, clear the editor
                if (selectedFile === filePath) {
                    setSelectedFile('');
                    setSelectedFileContent('');
                    setCode('');
                }
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error('Error deleting file/folder:', error);
            alert('Error deleting file/folder');
        }
    };



    useEffect(() => {
        getFileTree();
    }, []);

    useEffect(() => {
        if (socket) {
            socket.on('file:refresh', getFileTree);
            return () => {
                socket.off('file:refresh', getFileTree);
            };
        }
    }, [socket]);

    // Close context menu on outside click
    useEffect(() => {
        const handleClickOutside = () => {
            setContextMenu({ show: false, x: 0, y: 0, type: 'editor' });
        };

        if (contextMenu.show) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [contextMenu.show]);


    useEffect(() => {
        if (socket && code && !isSaved && selectedFile && !selectedFile.endsWith('/')) {
            const timer = setTimeout(() => {
                socket.emit("file:change", {
                    path: selectedFile,
                    content: code,
                });
            }, 5 * 1000);
            return () => {
                clearTimeout(timer);
            };
        }
    }, [socket, code, selectedFile, isSaved]);


    useEffect(() => {
        // Clear code and content when switching files
        setCode('');
        setSelectedFileContent('');
    }, [selectedFile]);

    const isExecutableFile = (filename) => {
        if (!filename) return false;
        const ext = filename.split('.').pop()?.toLowerCase();
        return ['js', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'php', 'rb', 'ts', 'jsx', 'tsx'].includes(ext);
    };

    const saveFile = () => {
        if (!selectedFile || !socket) return;
        socket.emit("file:change", {
            path: selectedFile,
            content: code,
        });
    };

    const runCode = () => {
        if (!selectedFile || !socket) return;

        // Save file first
        saveFile();

        // Get file extension and path info
        const ext = selectedFile.split('.').pop()?.toLowerCase();
        const filename = selectedFile.split('/').pop();
        const filePath = selectedFile.startsWith('/') ? selectedFile.substring(1) : selectedFile;
        const directory = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';

        let command = '';

        switch (ext) {
            case 'js':
            case 'jsx':
                command = `node "${filename}"`;
                break;
            case 'py':
                command = `python3 "${filename}" || python "${filename}"`;
                break;
            case 'java':
                const className = filename.replace('.java', '');
                command = `javac "${filename}" && java "${className}"`;
                break;
            case 'cpp':
                const cppOut = filename.replace('.cpp', '');
                command = `g++ "${filename}" -o "${cppOut}" && ./"${cppOut}"`;
                break;
            case 'c':
                const cOut = filename.replace('.c', '');
                command = `gcc "${filename}" -o "${cOut}" && ./"${cOut}"`;
                break;
            case 'go':
                command = `go run "${filename}"`;
                break;
            case 'rs':
                command = `rustc "${filename}" && ./"${filename.replace('.rs', '')}"`;
                break;
            case 'php':
                command = `php "${filename}"`;
                break;
            case 'rb':
                command = `ruby "${filename}"`;
                break;
            case 'ts':
            case 'tsx':
                command = `npx ts-node "${filename}"`;
                break;
            default:
                command = `echo "Unsupported file type: ${ext}"`;
        }

        // Navigate to correct directory and run command
        socket.emit('terminal:write', `echo "🚀 Running ${filename}..."\r`);
        if (directory) {
            socket.emit('terminal:write', `cd ~ && cd "${directory}" && ${command} && cd ~\r`);
        } else {
            socket.emit('terminal:write', `${command}\r`);
        }
    };

    useEffect(() => {
        if (selectedFile && selectedFileContent !== null) {
            setCode(selectedFileContent);
        }
    }, [selectedFile, selectedFileContent]);


    const getFileContent = useCallback(async () => {
        if (!selectedFile || selectedFile.endsWith('/') || !token) {
            setSelectedFileContent('');
            return;
        }

        try {
            const response = await fetch(`${API_ENDPOINTS.FILES_CONTENT}?path=${selectedFile}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                logout();
                return;
            }

            if (response.status === 404) {
                // File doesn't exist or is empty, set empty content
                setSelectedFileContent('');
                return;
            }

            const result = await response.json();
            setSelectedFileContent(result.content || '');
        } catch (error) {
            console.error('Error fetching file content:', error);
            // On error, assume it's a new file
            setSelectedFileContent('');
        }
    }, [selectedFile, token, logout]);


    useEffect(() => {
        if (selectedFile && !selectedFile.endsWith('/')) {
            getFileContent();
        }
    }, [selectedFile, getFileContent]);



    return (
        <div className="playground-container">
            <div className="user-header">
                <div className="user-info">
                    <img
                        src={user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=6366f1&color=fff`}
                        alt={user.name}
                        className="user-avatar"
                        onError={(e) => {
                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=6366f1&color=fff`;
                        }}
                    />
                    <span className="user-name">{user.name}</span>
                </div>
                <button onClick={logout} className="logout-btn">Logout</button>
            </div>

            <div className="editor-container">
                <div className="sidebar">
                    <div className="sidebar-header">
                        <div className="sidebar-title">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                            <span>Explorer</span>
                        </div>
                        <div className="sidebar-actions">
                            <button
                                className="action-btn"
                                onClick={() => { setShowCreateModal(true); setCreateType('file') }}
                                title="New File"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14,2 14,8 20,8" />
                                    <line x1="12" y1="18" x2="12" y2="12" />
                                    <line x1="9" y1="15" x2="15" y2="15" />
                                </svg>
                            </button>
                            <button
                                className="action-btn"
                                onClick={() => { setShowCreateModal(true); setCreateType('folder') }}
                                title="New Folder"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                    <line x1="12" y1="15" x2="12" y2="9" />
                                    <line x1="9" y1="12" x2="15" y2="12" />
                                </svg>
                            </button>
                            <button
                                className="action-btn delete-btn"
                                onClick={() => selectedFile && deleteFileOrFolder(selectedFile)}
                                disabled={!selectedFile || selectedFile === '/'}
                                title={selectedFile ? `Delete ${selectedFile}` : "Select a file or folder to delete"}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3,6 5,6 21,6" />
                                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" />
                                    <line x1="10" y1="11" x2="10" y2="17" />
                                    <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <FileTree
                        onselect={(path) => {
                            setSelectedFile(path);
                            // Track current directory for new file/folder creation
                            if (path.endsWith('/')) {
                                setCurrentPath(path.slice(0, -1)); // Remove trailing slash
                            } else {
                                // If it's a file, get its directory
                                const pathParts = path.split('/');
                                pathParts.pop(); // Remove filename
                                setCurrentPath(pathParts.join('/'));
                            }
                        }}
                        tree={fileTree}
                    />

                    {/* Create File/Folder Modal */}
                    {showCreateModal && (
                        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                <h3>Create {createType}</h3>
                                <p>Location: {currentPath || '/'}</p>
                                <input
                                    type="text"
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    placeholder={`Enter ${createType} name`}
                                    onKeyPress={(e) => e.key === 'Enter' && createFileOrFolder()}
                                    autoFocus
                                />
                                <div className="modal-actions">
                                    <button
                                        className="modal-btn cancel"
                                        onClick={() => { setShowCreateModal(false); setCreateName('') }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="modal-btn primary"
                                        onClick={createFileOrFolder}
                                    >
                                        Create
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Context Menu */}
                    {contextMenu.show && (
                        <div
                            className="context-menu"
                            style={{
                                position: 'fixed',
                                top: contextMenu.y,
                                left: contextMenu.x,
                                zIndex: 1000
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="context-menu-item" onClick={() => {
                                setShowCreateModal(true);
                                setCreateType('file');
                                setContextMenu({ show: false, x: 0, y: 0, type: 'editor' });
                            }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14,2 14,8 20,8" />
                                    <line x1="12" y1="18" x2="12" y2="12" />
                                    <line x1="9" y1="15" x2="15" y2="15" />
                                </svg>
                                New File
                            </div>
                            <div className="context-menu-item" onClick={() => {
                                setShowCreateModal(true);
                                setCreateType('folder');
                                setContextMenu({ show: false, x: 0, y: 0, type: 'editor' });
                            }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                    <line x1="12" y1="15" x2="12" y2="9" />
                                    <line x1="9" y1="12" x2="15" y2="12" />
                                </svg>
                                New Folder
                            </div>
                            {selectedFile && selectedFile !== '/' && (
                                <>
                                    <div className="context-menu-divider"></div>
                                    <div className="context-menu-item danger" onClick={() => {
                                        deleteFileOrFolder(selectedFile);
                                        setContextMenu({ show: false, x: 0, y: 0, type: 'editor' });
                                    }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="3,6 5,6 21,6" />
                                            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" />
                                            <line x1="10" y1="11" x2="10" y2="17" />
                                            <line x1="14" y1="11" x2="14" y2="17" />
                                        </svg>
                                        Delete {selectedFile.split('/').pop()}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="main-content">
                    <div className="editor-section">
                        <div className="editor-header">
                            <div className="tab-bar">
                                {selectedFile && (
                                    <div className="tab active">
                                        <div className="tab-icon">
                                            <span style={{ fontSize: '16px' }}>
                                                {getFileIcon(selectedFile.split('/').pop())}
                                            </span>
                                        </div>
                                        <span className="tab-name">
                                            {selectedFile.split('/').pop() || 'untitled'}
                                        </span>
                                        <div className={`save-indicator ${isSaved ? 'saved' : 'unsaved'}`}>
                                        </div>
                                        <div className="tab-actions">
                                            <button
                                                onClick={runCode}
                                                className="run-btn"
                                                disabled={!isExecutableFile(selectedFile)}
                                                title="Run code"
                                            >
                                                ▶️ Run
                                            </button>
                                            <button
                                                onClick={saveFile}
                                                className="save-btn"
                                                disabled={isSaved}
                                                title={isSaved ? 'File saved' : 'Save file'}
                                            >
                                                {isSaved ? '✓ Saved' : '💾 Save'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {!selectedFile && (
                                    <div className="no-file-selected">
                                        <span>Select a file to start editing</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div
                            className="editor-content"
                            onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setContextMenu({
                                    show: true,
                                    x: e.clientX,
                                    y: e.clientY,
                                    type: 'editor'
                                });
                            }}
                        >
                            <AceEditor
                                value={code}
                                onChange={(e) => setCode(e)}
                                name="editor"
                                theme="one_dark"
                                mode="javascript"
                                width="100%"
                                height="100%"
                                fontSize={14}
                                showPrintMargin={false}
                                showGutter={true}
                                highlightActiveLine={true}
                                setOptions={{
                                    enableBasicAutocompletion: true,
                                    enableLiveAutocompletion: true,
                                    enableSnippets: true,
                                    showLineNumbers: true,
                                    tabSize: 2,
                                    useWorker: false
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className={`terminal-container ${terminalMinimized ? 'minimized' : ''}`}>
                <div className="terminal-header">
                    <div className="terminal-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="4,17 10,11 4,5" />
                            <line x1="12" y1="19" x2="20" y2="19" />
                        </svg>
                        <span>Terminal</span>
                    </div>
                    <div className="terminal-actions">
                        {!terminalMinimized && (
                            <>
                                <button
                                    className="terminal-action-btn"
                                    onClick={() => {
                                        const terminal = document.querySelector('#terminal .xterm-viewport');
                                        if (terminal) {
                                            terminal.scrollTop = terminal.scrollHeight;
                                        }
                                    }}
                                    title="Scroll to Bottom"
                                >
                                    ⬇️
                                </button>
                                <button
                                    className="terminal-action-btn"
                                    onClick={() => {
                                        if (socket) {
                                            socket.emit('terminal:write', 'clear\r');
                                        }
                                    }}
                                    title="Clear Terminal"
                                >
                                    🗑️
                                </button>
                            </>
                        )}
                        <button
                            className="terminal-toggle"
                            onClick={() => setTerminalMinimized(!terminalMinimized)}
                            title={terminalMinimized ? "Maximize Terminal" : "Minimize Terminal"}
                        >
                            {terminalMinimized ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="15,3 21,3 21,9" />
                                    <polyline points="9,21 3,21 3,15" />
                                    <line x1="21" y1="3" x2="14" y2="10" />
                                    <line x1="3" y1="21" x2="10" y2="14" />
                                </svg>
                            ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="4,14 10,14 10,20" />
                                    <polyline points="20,10 14,10 14,4" />
                                    <line x1="14" y1="10" x2="21" y2="3" />
                                    <line x1="3" y1="21" x2="10" y2="14" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
                <div id="terminal" style={{
                    height: terminalMinimized ? '0px' : '300px',
                    overflow: 'hidden',
                    transition: 'height 0.3s ease'
                }}>
                    {!terminalMinimized && <Terminal socket={socket} />}
                </div>
            </div>
        </div>
    );
};

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

const AppContent = () => {
    const { user, loading, login } = useAuth();

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                fontSize: '1.2rem'
            }}>
                Loading...
            </div>
        );
    }

    if (!user) {
        return <SimpleJwtAuth onLogin={login} />;
    }

    return <MainApp />;
};

export default App