import { io } from 'socket.io-client';

let socket = null;

export const createSocket = (token, url = 'http://localhost:8000') => {
    if (socket) {
        socket.disconnect();
    }
    
    socket = io(url, {
        auth: {
            token: token
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 20000
    });

    // Add connection event handlers
    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected to server after', attemptNumber, 'attempts');
    });

    socket.on('reconnect_error', (error) => {
        console.error('Reconnection failed:', error);
    });
    
    return socket;
};

export const getSocket = () => socket;

export default { createSocket, getSocket };