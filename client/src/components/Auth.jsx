import { useState, useEffect } from 'react';
import './Auth.css';
import { API_ENDPOINTS } from '../config/api';

const Auth = ({ onLogin }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const authError = urlParams.get('error');

        if (token) {
            localStorage.setItem('token', token);
            onLogin(token);
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (authError) {
            setError('Authentication failed. Please try again.');
        }
    }, [onLogin]);

    const handleGoogleLogin = () => {
        setLoading(true);
        setError('');
        window.location.href = API_ENDPOINTS.AUTH_GOOGLE;
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-content">
                    <div className="logo-section">
                        <div className="logo">
                            <div className="logo-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                                    <path d="M13 3L4 14h7v7l9-11h-7V3z" fill="currentColor"/>
                                </svg>
                            </div>
                            <span className="logo-text">CloudIDE</span>
                        </div>
                        <h1 className="welcome-title">Welcome back</h1>
                        <p className="welcome-subtitle">
                            Sign in to your development environment
                        </p>
                    </div>

                    {error && (
                        <div className="error-alert">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                                <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2"/>
                                <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                            {error}
                        </div>
                    )}

                    <div className="auth-form">
                        <button 
                            className="google-btn"
                            onClick={handleGoogleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="loading-spinner"></div>
                            ) : (
                                <svg className="google-icon" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                </svg>
                            )}
                            <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
                        </button>
                    </div>

                    <div className="auth-footer">
                        <p>
                            By continuing, you agree to our{' '}
                            <a href="#" className="footer-link">Terms of Service</a>
                            {' '}and{' '}
                            <a href="#" className="footer-link">Privacy Policy</a>
                        </p>
                    </div>
                </div>
            </div>

            <div className="auth-background">
                <div className="grid-pattern"></div>
                <div className="gradient-overlay"></div>
            </div>
        </div>
    );
};

export default Auth;