const express =require('express')
const fs =require('fs')
const http = require('http')
const {Server:SocketServer}=require('socket.io')
const app=express();
const server=http.createServer(app)
const pty= require('node-pty')

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

server.listen('8000',()=>{
    console.log(`Docker is running on port 8000`)
})