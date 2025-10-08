const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD
    ? 'https://cloud-ide-production.up.railway.app' 
    : 'http://localhost:8000');

export const API_ENDPOINTS = {
  AUTH_GOOGLE: `${API_BASE_URL}/auth/google`,
  AUTH_ME: `${API_BASE_URL}/auth/me`,
  AUTH_LOGOUT: `${API_BASE_URL}/auth/logout`,
  FILES: `${API_BASE_URL}/files`,
  FILES_CONTENT: `${API_BASE_URL}/files/content`,
  FILES_CREATE: `${API_BASE_URL}/files/create`,
  FILES_DELETE: `${API_BASE_URL}/files/delete`,
};

export const SOCKET_URL = API_BASE_URL;

export default API_BASE_URL;