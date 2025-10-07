import { Terminal as XTerminal } from '@xterm/xterm'
import { useEffect, useRef } from 'react';
import '@xterm/xterm/css/xterm.css';

const Terminal = ({ socket }) => {
    const terminalRef = useRef();
    const terminalInstance = useRef(null);

    useEffect(() => {
        if (!socket || terminalInstance.current) return;

        const terminal = new XTerminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
        });
        
        terminal.open(terminalRef.current);
        terminalInstance.current = terminal;

        terminal.onData((data) => {
            socket.emit('terminal:write', data);    
        });

        socket.on('terminal:data', (data) => {
            terminal.write(data);
        });

        return () => {
            if (socket) {
                socket.off('terminal:data');
            }
            if (terminal) {
                terminal.dispose();
            }
            terminalInstance.current = null;
        };
    }, [socket]);

    return (
        <div>
            <div style={{ padding: '10px', background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
                <strong>Terminal</strong>
            </div>
            <div id='terminal' ref={terminalRef} />
        </div>
    );
};
export default Terminal;