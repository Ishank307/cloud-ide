import {Terminal as XTerminal} from '@xterm/xterm'
import { useEffect } from 'react';
import { useRef } from 'react';
import '@xterm/xterm/css/xterm.css';

const Terminal =() => {

    const terminalRef = useRef();
    const isRendered = useRef(false);

    useEffect(() => {
        if (isRendered.current) return;
        const terminal = new XTerminal();
        terminal.open(terminalRef.current);

        terminal.onData((data) => {
            console.log(data);
        });

        isRendered.current = true;
    }, [])

    return (
        <div id='terminal' ref={terminalRef}/>
    )
}
export default Terminal;