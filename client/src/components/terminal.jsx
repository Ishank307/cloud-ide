import { Terminal as XTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useEffect, useRef } from 'react';
import '@xterm/xterm/css/xterm.css';

const Terminal = ({ socket, workspaceId }) => {
    const terminalRef = useRef();
    const terminalInstance = useRef(null);
    const fitAddonInstance = useRef(null);
    const resizeObserver = useRef(null);
    // Track whether we've already requested the terminal session
    // so reconnects don't spawn duplicate PTYs
    const sessionStarted = useRef(false);

    useEffect(() => {
        if (!socket) return;

        // Dispose previous xterm instance if socket changes
        if (terminalInstance.current) {
            terminalInstance.current.dispose();
            terminalInstance.current = null;
        }

        const terminal = new XTerminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            scrollback: 2000,
            convertEol: true,
            theme: {
                background: '#0d0d0d',
                foreground: '#e2e8f0',
                cursor: '#6366f1',
                cursorAccent: '#0d0d0d',
                selectionBackground: 'rgba(99,102,241,0.3)',
                black: '#1e1e2e',
                red: '#f38ba8',
                green: '#a6e3a1',
                yellow: '#f9e2af',
                blue: '#89b4fa',
                magenta: '#cba6f7',
                cyan: '#89dceb',
                white: '#cdd6f4',
                brightBlack: '#585b70',
                brightBlue: '#89b4fa',
                brightCyan: '#89dceb',
                brightGreen: '#a6e3a1',
                brightMagenta: '#cba6f7',
                brightRed: '#f38ba8',
                brightWhite: '#cdd6f4',
                brightYellow: '#f9e2af',
            }
        });

        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        fitAddonInstance.current = fitAddon;

        terminal.open(terminalRef.current);
        requestAnimationFrame(() => { fitAddon.fit(); });
        terminalInstance.current = terminal;

        // ResizeObserver to keep cols/rows accurate
        resizeObserver.current = new ResizeObserver(() => {
            requestAnimationFrame(() => {
                if (fitAddonInstance.current) fitAddonInstance.current.fit();
            });
        });
        if (terminalRef.current) {
            resizeObserver.current.observe(terminalRef.current);
        }

        // ── Socket data handlers ──────────────────────────────────────────────

        const handleTerminalData = (data) => {
            if (terminalInstance.current) {
                terminalInstance.current.write(data);
            }
        };

        const handleDisconnect = () => {
            if (terminalInstance.current) {
                terminalInstance.current.write('\r\n\x1b[33m[Disconnected from server]\x1b[0m\r\n');
            }
            sessionStarted.current = false; // allow re-init on reconnect
        };

        const handleConnect = () => {
            if (terminalInstance.current) {
                terminalInstance.current.write('\r\n\x1b[32m[Reconnected]\x1b[0m\r\n');
            }
            // Re-join the workspace room and start the terminal again after reconnect
            if (!sessionStarted.current) {
                sessionStarted.current = true;
                socket.emit('workspace:join', { workspaceId });
                setTimeout(() => {
                    socket.emit('terminal:start', { workspaceId });
                }, 300);
            }
        };

        // Register listeners
        socket.on('terminal:data', handleTerminalData);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect', handleConnect);

        // ── Input forwarding ──────────────────────────────────────────────────
        terminal.onData((data) => {
            if (socket && socket.connected) {
                socket.emit('terminal:write', { workspaceId, data });
            }
        });

        // ── Initial session start ─────────────────────────────────────────────
        terminal.write('\x1b[90m[Terminal ready]\x1b[0m\r\n');

        if (socket.connected && !sessionStarted.current) {
            sessionStarted.current = true;
            socket.emit('workspace:join', { workspaceId });
            setTimeout(() => {
                socket.emit('terminal:start', { workspaceId });
            }, 300);
        }

        return () => {
            sessionStarted.current = false;
            if (resizeObserver.current) resizeObserver.current.disconnect();
            socket.off('terminal:data', handleTerminalData);
            socket.off('disconnect', handleDisconnect);
            socket.off('connect', handleConnect);
            if (terminalInstance.current) {
                terminalInstance.current.dispose();
                terminalInstance.current = null;
            }
            fitAddonInstance.current = null;
        };
    }, [socket, workspaceId]);

    return <div id="terminal" ref={terminalRef} style={{ width: '100%', height: '100%' }} />;
};

export default Terminal;