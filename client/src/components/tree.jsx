import React from 'react'
import { getFileIcon, getFolderIcon } from '../utils/fileIcons'

const FileTreeNode = ({ fileName, nodes, onselect, path, activePath, onContextMenu }) => {
    const isDir = !!nodes;
    const icon = isDir ? getFolderIcon(fileName) : getFileIcon(fileName);
    const isActive = activePath === path;
    
    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onContextMenu) {
            onContextMenu(e, path, isDir, fileName);
        }
    };

    return (
        <div style={{ marginLeft: path === '' ? 0 : '10px' }}>
            <div 
                className={`${isDir ? "folder-node" : "file-node"} ${isActive ? 'active-tree-node' : ''}`}
                onClick={(e) => {
                    e.stopPropagation();
                    if (isDir) 
                        onselect(path + '/');
                    else 
                        onselect(path);
                }}
                onContextMenu={handleContextMenu}
                style={{ 
                    margin: 0,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px'
                }}
            >
                <span className="file-icon" style={{ fontSize: '16px' }}>{icon}</span>
                <span className="file-name">{fileName}</span>
            </div>
            
            {nodes && fileName !== 'node_modules' && typeof nodes === 'object' && Object.keys(nodes).length > 0 && (
                <ul style={{ listStyle: 'none', paddingLeft: '10px', margin: '0' }}>
                    {Object.keys(nodes).map(child => (
                        <li key={child}>
                            <FileTreeNode
                                onselect={onselect}
                                path={path + '/' + child}
                                fileName={child}
                                nodes={nodes[child]}
                                activePath={activePath}
                                onContextMenu={onContextMenu}
                            />
                        </li>
                    ))}
                </ul>
            )}       
        </div>
    )
}

const FileTree = ({ tree, onselect, activePath, onContextMenu }) => {
    const handleEmptyContextMenu = (e) => {
        e.preventDefault();
        if (onContextMenu) {
            onContextMenu(e, '', true, 'root');
        }
    };

    if (!tree || typeof tree !== 'object' || Object.keys(tree).length === 0) {
        return (
            <div 
                style={{ color: '#94a3b8', padding: '1rem', minHeight: '100%' }}
                onContextMenu={handleEmptyContextMenu}
            >
                No files to display
            </div>
        );
    }
    
    return (
        <div 
            style={{ height: '100%', minHeight: '100%' }}
            onContextMenu={handleEmptyContextMenu}
        >
            <FileTreeNode
                onselect={onselect}
                fileName="/" 
                path=""
                nodes={tree}
                activePath={activePath}
                onContextMenu={onContextMenu}
            />
        </div>
    )
}

export default FileTree