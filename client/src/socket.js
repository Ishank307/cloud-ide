import { io } from 'socket.io-client';
import API_BASE_URL from './config/api';

let socket = null;

export const createSocket = (token, url = API_BASE_URL) => {
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
        timeout: 20000,
        transports: ['websocket', 'polling'],
        forceNew: true,
        upgrade: true
    });

    // Add connection event handlers
    socket.on('connect', () => {
        console.log('✅ Connected to server:', url);
        console.log('Socket ID:', socket.id);
    });

    socket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from server:', reason);
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Reconnected to server after', attemptNumber, 'attempts');
    });

    socket.on('reconnect_error', (error) => {
        console.error('🚫 Reconnection failed:', error);
    });

    socket.on('connect_error', (error) => {
        console.error('🚫 Connection error:', error);
    });

    socket.on('terminal:data', (data) => {
        console.log('📟 Terminal data received:', data.substring(0, 50) + '...');
    });
    
    return socket;
};

export const getSocket = () => socket;

export default { createSocket, getSocket };