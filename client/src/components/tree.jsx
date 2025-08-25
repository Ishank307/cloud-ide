import React from 'react'

const FileTreeNode = ({ fileName, nodes }) => {
    console.log('fileName:', fileName, 'nodes:', nodes);

    const isDir=!!nodes
    
    return (
        <div style={{ marginLeft: '10px' }}> {/* Add some indentation */}
           <p className={isDir? "folder-node": "file-node"}>{fileName}</p> 
            {nodes && typeof nodes === 'object' && Object.keys(nodes).length > 0 && (
                <ul style={{ listStyle: 'none', paddingLeft: '10px' }}>
                    {Object.keys(nodes).map(child => (
                        <li key={child}>
                            <FileTreeNode
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

const FileTree = ({ tree }) => {
    console.log('FileTree received:', tree);
    
    // Better empty check
    if (!tree || typeof tree !== 'object' || Object.keys(tree).length === 0) {
        return <div>No files to display</div>;
    }
    
    return (
        <FileTreeNode
            fileName="/"
            nodes={tree}
        />
    )
}


export default FileTree