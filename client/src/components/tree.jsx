import React from 'react'

const FileTreeNode = ({ fileName, nodes,onselect,path }) => {
    // console.log('fileName:', fileName, 'nodes:', nodes);

    const isDir=!!nodes
    
    return (
        <div  onClick={(e)=>{
            e.stopPropagation()
            if(isDir) 
            onselect(path+'/');
            else 
                onselect(path);
        }}
        
        style={{ marginLeft: '10px' }}> {/* Add some indentation */}
           <p className={isDir? "folder-node": "file-node"}>{fileName}</p> 
            {nodes && fileName!=='node_modules'&& typeof nodes === 'object' && Object.keys(nodes).length > 0 && (
                <ul style={{ listStyle: 'none', paddingLeft: '10px' }}>
                    {Object.keys(nodes).map(child => (
                        <li key={child}>
                            <FileTreeNode
                            onselect={onselect}
                                path={path+'/'+child}
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

const FileTree = ({ tree,onselect,path }) => {
    // console.log('FileTree received:', tree);
    
    // Better empty check
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