import { io } from 'socket.io-client';

let socket = null;

export const createSocket = (token, url = 'http://localhost:8000') => {
    if (socket) {
        socket.disconnect();
    }
    
    socket = io(url, {
        auth: {
            token: token
        }
    });
    
    return socket;
};

export const getSocket = () => socket;

export default { createSocket, getSocket };