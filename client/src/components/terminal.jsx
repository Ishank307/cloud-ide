import { Terminal as XTerminal } from '@xterm/xterm'
import { useEffect, useRef } from 'react';
import '@xterm/xterm/css/xterm.css';

const Terminal = ({ socket }) => {
    const terminalRef = useRef();
    const terminalInstance = useRef(null);

    useEffect(() => {
        if (!socket) return;

        // Clean up existing terminal if socket changes
        if (terminalInstance.current) {
            terminalInstance.current.dispose();
            terminalInstance.current = null;
        }

        const terminal = new XTerminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            scrollback: 1000,
            convertEol: true,
            theme: {
                background: '#1a1a1a',
                foreground: '#ffffff',
                cursor: '#ffffff'
            }
        });

        terminal.open(terminalRef.current);
        terminalInstance.current = terminal;

        // Handle terminal input
        terminal.onData((data) => {
            if (socket && socket.connected) {
                socket.emit('terminal:write', data);
                // Auto-scroll to bottom when user types
                setTimeout(() => {
                    if (terminalInstance.current) {
                        terminalInstance.current.scrollToBottom();
                    }
                }, 10);
            } else {
                terminal.write('\r\nConnection lost. Please refresh the page.\r\n');
            }
        });

        // Add keyboard shortcut to scroll to bottom (Ctrl+End)
        terminal.onKey(({ key, domEvent }) => {
            if (domEvent.ctrlKey && domEvent.key === 'End') {
                domEvent.preventDefault();
                terminal.scrollToBottom();
            }
        });

        // Handle terminal output
        const handleTerminalData = (data) => {
            if (terminalInstance.current) {
                terminalInstance.current.write(data);
                // Auto-scroll to bottom after writing data
                setTimeout(() => {
                    if (terminalInstance.current) {
                        terminalInstance.current.scrollToBottom();
                    }
                }, 10);
            }
        };

        // Handle socket connection events
        const handleConnect = () => {
            if (terminalInstance.current) {
                terminalInstance.current.write('\r\n[Connected to terminal]\r\n');
            }
        };

        const handleDisconnect = () => {
            if (terminalInstance.current) {
                terminalInstance.current.write('\r\n[Disconnected from server]\r\n');
            }
        };

        const handleReconnect = () => {
            if (terminalInstance.current) {
                terminalInstance.current.write('\r\n[Reconnected to server]\r\n');
            }
        };

        // Set up event listeners
        socket.on('terminal:data', handleTerminalData);
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('reconnect', handleReconnect);

        // Initial connection message
        terminal.write('[Terminal ready]\r\n');
        
        // Wait for socket connection then initialize terminal
        if (socket.connected) {
            console.log('Socket already connected, initializing terminal...');
            setTimeout(() => {
                terminal.write('Initializing shell...\r\n');
                // Request terminal session from backend
                socket.emit('terminal:start');
            }, 500);
        } else {
            socket.on('connect', () => {
                console.log('Socket connected, initializing terminal...');
                setTimeout(() => {
                    terminal.write('Initializing shell...\r\n');
                    // Request terminal session from backend
                    socket.emit('terminal:start');
                }, 500);
            });
        }

        return () => {
            if (socket) {
                socket.off('terminal:data', handleTerminalData);
                socket.off('connect', handleConnect);
                socket.off('disconnect', handleDisconnect);
                socket.off('reconnect', handleReconnect);
            }
            if (terminal) {
                terminal.dispose();
            }
            terminalInstance.current = null;
        };
    }, [socket]);

    return (
        <div id='terminal' ref={terminalRef} />
    );
};
export default Terminal;