const express =require('express')
const fs =require('fs').promises
const http = require('http')
const {Server:SocketServer}=require('socket.io')
const app=express();
const server=http.createServer(app)
const pty= require('node-pty');
const path = require('path');
const cors= require('cors')
const chokidar=require('chokidar')

var ptyProcess = pty.spawn('bash', [], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.env.INIT_CWD,
  env: process.env
});

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
})

const watcher = chokidar.watch('./user').on('all',(event,path)=>{
    io.emit('file:refresh',path)
});
app.use(cors());

app.get('/files',async (req,res)=>{
    const filetree=await generatefile('./user');
    return res.json({tree:filetree})
})

server.listen('8000',()=>{
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