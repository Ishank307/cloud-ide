import React from 'react'
import { getFileIcon, getFolderIcon } from '../utils/fileIcons'

const FileTreeNode = ({ fileName, nodes, onselect, path, activePath }) => {
    const isDir = !!nodes;
    const icon = isDir ? getFolderIcon(fileName) : getFileIcon(fileName);
    const isActive = activePath === path;
    
    return (
        <div style={{ marginLeft: '10px' }}>
            <div 
                className={`${isDir ? "folder-node" : "file-node"} ${isActive ? 'active-tree-node' : ''}`}
                onClick={(e) => {
                    e.stopPropagation();
                    if (isDir) 
                        onselect(path + '/');
                    else 
                        onselect(path);
                }}
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
                            />
                        </li>
                    ))}
                </ul>
            )}       
        </div>
    )
}

const FileTree = ({ tree, onselect, activePath }) => {
    if (!tree || typeof tree !== 'object' || Object.keys(tree).length === 0) {
        return <div style={{color: '#94a3b8', padding: '1rem'}}>No files to display</div>;
    }
    
    return (
        <FileTreeNode
            onselect={onselect}
            fileName="/" 
            path=""
            nodes={tree}
            activePath={activePath}
        />
    )
}

export default FileTree