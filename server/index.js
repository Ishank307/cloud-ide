const express =require('express')
const fs =require('fs').promises
const http = require('http')
const {Server:SocketServer}=require('socket.io')
const app=express();
const server=http.createServer(app)
const pty= require('node-pty');
const path = require('path');
const cors= require('cors')
const chokidar=require('chokidar');
const { error } = require('console');
const { json } = require('stream/consumers');
// const { default: socket } = require('../client/src/socket');

var ptyProcess = pty.spawn('bash', [], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.env.INIT_CWD + '/user',
});

// setTimeout(() => { // made so that i can change path from ishank/... to workspace$ 
//   ptyProcess.write('export PS1="workspace$ "\r');
//   ptyProcess.write('clear\r');
// }, 100);

const io = new SocketServer({
    cors: '*'
});

 io.attach(server);


ptyProcess.onData((data)=>{
   io.emit('terminal:data',data)
});

io.on('connection',(socket)=>{
    console.log('connected',socket.id)

    socket.on('terminal:write',(data)=>{
        ptyProcess.write(data)
    })

    socket.on('file:write',({path,content},callback) =>{
        fs.writeFile(path,content,(err)=>{
            callback({ success:!err,error:err?.message});
        })
    })


     socket.on('file:change',async ({path,content})=>{
                await fs.writeFile(`./user${path}`,content,'utf-8');
        })
})

chokidar.watch('./user').on('all', (event, filePath) => {
  io.emit('file:refresh', filePath);
});

app.use(cors());
app.use(express.json())
app.get('/files',async (req,res)=>{
    const filetree=await generatefile('./user');
    return res.json({tree:filetree})
})

app.get('/files/content', async (req,res)=>{
    const filePath= req.query.path;

    if (!filePath) {
            return res.status(400).json({error: 'Path parameter is required'});
        }
    
        const fullPath= `./user${filePath}`;
    // new code bases
    const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
            return res.status(400).json({error: 'Cannot read directory content'});
        }

    const content= await fs.readFile(`./user${filePath}`,'utf-8')
    return res.json({content})
})

app.post('/files/create',async(req,res)=>{
    const {path:filePath,type}=req.body;

    if(!filePath){
        return res.status(400).json({error:'Path parameter is required'});
    }

    const fullPath= `./user${filePath}`;

    try{
        if(type==='folder'){
            await fs.mkdir(fullPath,{recursive:true})
        }else{
            await fs.writeFile(fullPath,'','utf-8');
        }
        res.json({success:true})
    }
    catch(error){
        res.status(500).json({error:error.message});
    }
});

app.delete('/files/delete',async(req,res)=>{
    const {path:filePath}=req.body;
    if(!filePath){
        return res.status(400).json({error:'Path parameter is required'});
    }

    const fullPath= `./user${filePath}`;

    // console.log('Received filePath:', filePath);
    // console.log('Full path to delete:', fullPath);
    try{
        const stat= await fs.stat(fullPath);
        //  console.log('File exists, isDirectory:', stat.isDirectory());
        if(stat.isDirectory()){
            await fs.rmdir(fullPath,{recursive: true});
        }
        else{
            await fs.unlink(fullPath);
        }
        res.json({success:true,message:'Deleted successfully'});
    }catch(error){
        if(error.code==='ENOENT'){
            res.status(404).json({error:'File or Folder not found'});

        }else{
            res.status(500).json({error:error.message})
        }
    }
})

app.use(express.static(path.join(__dirname, '..', 'client/build')));

// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '..', 'client/build', 'index.html'));
// });

server.listen('8000','0.0.0.0',()=>{
    console.log(`Docker is running on port 8000`)
})

async function generatefile(directory){
    const tree ={};

    async function buildtree(currentDirectory,currentTree){
        const files = await fs.readdir(currentDirectory)

        for(const file of files){
            const filePath= path.join(currentDirectory, file);
            const stat= await fs.stat(filePath);
            if(stat.isDirectory() ){
                currentTree[file]={};
                await buildtree(filePath,currentTree[file]);
            }
            else{
                currentTree[file]=null;
            }
        }

    }
    await buildtree(directory,tree);
    return tree;
}