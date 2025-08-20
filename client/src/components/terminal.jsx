import { Terminal as XTerminal } from '@xterm/xterm'
import { useEffect } from 'react';
import { useRef } from 'react';
import '@xterm/xterm/css/xterm.css';
import socket from '../socket';

const Terminal = () => {

    const terminalRef = useRef();
    const isRendered = useRef(false);

    useEffect(() => {
        if (isRendered.current) return;
        const terminal = new XTerminal();
        terminal.open(terminalRef.current);

        terminal.onData((data) => {
            socket.emit('terminal:write',data);    
        });

        socket.on('terminal:data',(data)=>{
            terminal.write(data)
        })

        isRendered.current = true;
    }, [])

    return (
        <div id='terminal' ref={terminalRef} />
    )
}
export default Terminal;