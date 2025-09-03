import Terminal from "./components/terminal"
import './App.css';
import { useCallback, useEffect, useState } from "react";
import FileTree from "./components/tree";
import socket from "./socket";
import AceEditor from 'react-ace';
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/ext-language_tools";

function App() {
    const [fileTree,setFileTree]=useState({});

    const [selectedFile,setSelectedFile]=useState('');
    const [selectedFileContent,setSelectedFileContent]=useState('');
    const[code,setCode]=useState('');
    
    const isSaved = selectedFileContent ===code;
    

    const getFileTree = async () =>{
    const response= await fetch("http://localhost:9000/files");
    const result = await response.json();
    console.log('Full API response:', result);
    console.log('result.tree:', result.tree); 
    setFileTree(result.tree);
 }

   useEffect(() => {
        getFileTree();
    }, []);

    useEffect(()=>
    {
        socket.on('file:refresh',getFileTree);
        return ()=>{
            socket.off('file:refresh',getFileTree)
        }
    },[])
 

    useEffect(()=>{
        if(code && !isSaved){
            const timer= setTimeout(()=>{
                socket.emit("file:change",{
                    path:selectedFile,
                    content: code,
                })

                console.log('Save code',code)
            },5*1000)
            return()=>{
                clearTimeout(timer)
            }
        }
    },[code,selectedFile,isSaved]);

    useEffect(()=>{
        if(selectedFile && selectedFileContent){
            setCode(selectedFileContent);
        }
    },[selectedFile,selectedFileContent])


    const getFileContent = useCallback(async ()=>{
        if(!selectedFile) return;
        const response= await fetch(`http://localhost:9000/files/content?path=${selectedFile}`);
        const result = await response.json();
        setSelectedFileContent(result.content)
    },[selectedFile])  


    useEffect(()=>{
        if(selectedFile)
            getFileContent()
    })


 return (
        <div className="playground-container">
            <div className="editor-container" >
            <div className="files">
                <FileTree onselect={(path)=> setSelectedFile(path)} tree={fileTree} />
                <h1>hello</h1>
            </div>
            <div className="editor">
            {selectedFile && <p>{selectedFile.replaceAll('/', ' -> ')}</p>}
                <AceEditor
                value={code}
                onChange={(e)=>setCode(e)}
                />
            </div>

            </div>
            <div className="terminal-container">
                <Terminal />
            </div>
        </div>
    );
}

export default App
