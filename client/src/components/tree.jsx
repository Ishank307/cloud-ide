import React from 'react'

const FileTreeNode = ({ fileName, nodes, onselect, path }) => {
    const isDir = !!nodes;
    
    return (
        <div style={{ marginLeft: '10px' }}>
            <p 
                className={isDir ? "folder-node" : "file-node"}
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
                    padding: '2px 4px',
                    borderRadius: '3px'
                }}
            >
                {fileName}
            </p>
            
            {nodes && fileName !== 'node_modules' && typeof nodes === 'object' && Object.keys(nodes).length > 0 && (
                <ul style={{ listStyle: 'none', paddingLeft: '10px', margin: '0' }}>
                    {Object.keys(nodes).map(child => (
                        <li key={child}>
                            <FileTreeNode
                                onselect={onselect}
                                path={path + '/' + child}
                                fileName={child}
                                nodes={nodes[child]}
                            />
                        </li>
                    ))}
                </ul>
            )}       
        </div>
    )
}

const FileTree = ({ tree, onselect }) => {
    if (!tree || typeof tree !== 'object' || Object.keys(tree).length === 0) {
        return <div>No files to display</div>;
    }
    
    return (
        <FileTreeNode
            onselect={onselect}
            fileName="/" 
            path=""
            nodes={tree}
        />
    )
}

export default FileTree