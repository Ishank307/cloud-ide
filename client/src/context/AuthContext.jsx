import { createContext, useContext, useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(
        localStorage.getItem('jwt_token') || localStorage.getItem('token')
    );
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            // Determine which endpoint to use based on token type
            const isJWT = token.startsWith('eyJ'); // JWT tokens start with 'eyJ'
            const endpoint = isJWT ? '/api/auth/me' : API_ENDPOINTS.AUTH_ME;
            
            // Verify token and get user info
            fetch(`http://localhost:8000${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
                .then(res => res.json())
                .then(data => {
                    if (data.user) {
                        console.log('User data received:', data.user);
                        setUser(data.user);
                    } else {
                        // Invalid token
                        localStorage.removeItem('token');
                        localStorage.removeItem('jwt_token');
                        setToken(null);
                    }
                })
                .catch(err => {
                    console.error('Auth check failed:', err);
                    localStorage.removeItem('token');
                    localStorage.removeItem('jwt_token');
                    setToken(null);
                })
                .finally(() => {
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, [token]);

    const login = (newToken, userData = null) => {
        setToken(newToken);
        
        // If user data is provided (JWT login), set it immediately
        if (userData) {
            setUser(userData);
        }
        
        // Store token based on type
        if (newToken.startsWith('eyJ')) {
            // JWT token
            localStorage.setItem('jwt_token', newToken);
            localStorage.removeItem('token'); // Remove OAuth token if exists
        } else {
            // OAuth token
            localStorage.setItem('token', newToken);
            localStorage.removeItem('jwt_token'); // Remove JWT token if exists
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('jwt_token');

        // Call backend logout endpoint (optional)
        if (token) {
            fetch(API_ENDPOINTS.AUTH_LOGOUT, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).catch(err => console.error('Logout error:', err));
        }
    };

    const value = {
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};