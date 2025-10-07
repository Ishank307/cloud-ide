import Terminal from "./components/terminal"
import Auth from "./components/Auth";
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


const MainApp = () => {
    const { user, token, logout } = useAuth();
    const [socket, setSocket] = useState(null);
    const [fileTree, setFileTree] = useState({});
    const [selectedFile, setSelectedFile] = useState('');
    const [selectedFileContent, setSelectedFileContent] = useState('');
    const [code, setCode] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createType, setCreateType] = useState('file');
    const [createName, setCreateName] = useState('');
    const [currentPath, setCurrentPath] = useState('');

    const isSaved = selectedFileContent === code;

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
                    <img src={user.picture} alt={user.name} className="user-avatar" />
                    <span className="user-name">{user.name}</span>
                </div>
                <button onClick={logout} className="logout-btn">Logout</button>
            </div>

            <div className="editor-container">
                <div className="files">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h1>Files</h1>
                        <div>
                            <button
                                onClick={() => { setShowCreateModal(true); setCreateType('file') }}
                                style={{ marginRight: '5px', padding: '2px 6px', fontSize: '12px', cursor: 'pointer' }}
                                title="New File"
                            >
                                📄+
                            </button>
                            <button
                                onClick={() => { setShowCreateModal(true); setCreateType('folder') }}
                                style={{ marginRight: '5px', padding: '2px 6px', fontSize: '12px', cursor: 'pointer' }}
                                title="New Folder"
                            >
                                📁+
                            </button>
                            <button
                                onClick={() => selectedFile && deleteFileOrFolder(selectedFile)}
                                disabled={!selectedFile || selectedFile === '/'}
                                style={{
                                    padding: '2px 6px',
                                    fontSize: '12px',
                                    cursor: selectedFile && selectedFile !== '/' ? 'pointer' : 'not-allowed',
                                    backgroundColor: selectedFile && selectedFile !== '/' ? '#8f5252ff' : '#ccc',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px'
                                }}
                                title={selectedFile ? `Delete ${selectedFile}` : "Select a file or folder to delete"}
                            >
                                🗑️
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
                        <>
                            <div style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                zIndex: 999
                            }} onClick={() => setShowCreateModal(false)}></div>

                            <div style={{
                                position: 'fixed',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                background: 'white',
                                border: '1px solid #ccc',
                                padding: '20px',
                                borderRadius: '5px',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                                zIndex: 1000,
                                minWidth: '300px'
                            }}>
                                <h3>Create {createType}</h3>
                                <p style={{ fontSize: '12px', color: '#666', margin: '5px 0' }}>
                                    Location: {currentPath || '/'}
                                </p>
                                <input
                                    type="text"
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    placeholder={`Enter ${createType} name`}
                                    style={{ width: '100%', padding: '8px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '3px' }}
                                    onKeyPress={(e) => e.key === 'Enter' && createFileOrFolder()}
                                    autoFocus
                                />
                                <div style={{ textAlign: 'right' }}>
                                    <button
                                        onClick={() => { setShowCreateModal(false); setCreateName('') }}
                                        style={{ marginRight: '10px', padding: '5px 15px', border: '1px solid #ddd', background: '#f5f5f5', borderRadius: '3px', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={createFileOrFolder}
                                        style={{ padding: '5px 15px', border: '1px solid #007acc', background: '#007acc', color: 'white', borderRadius: '3px', cursor: 'pointer' }}
                                    >
                                        Create
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="editor">
                    {selectedFile && <p>{selectedFile.replaceAll('/', ' -> ')}{isSaved ? ' Saved' : ' Unsaved'}</p>}
                    <AceEditor
                        value={code}
                        onChange={(e) => setCode(e)}
                        name="editor"
                        theme="github"
                        enableSnippets={{
                            enableBasicAutocompletion: true,
                            enableLiveAutoccompletion: true,
                            enableSnippets: true,
                        }}
                    />
                </div>
            </div>

            <div className="terminal-container">
                <Terminal socket={socket} />
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
        return <Auth onLogin={login} />;
    }

    return <MainApp />;
};

export default App