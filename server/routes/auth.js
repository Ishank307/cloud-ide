const express = require('express');
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Google OAuth login
router.get('/google', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(400).json({ error: 'Google OAuth is not configured on this server. Please use Email/Password (JWT) login.' });
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// Google OAuth callback
router.get('/google/callback', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(400).json({ error: 'Google OAuth is not configured.' });
    }
    passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_URL}?error=auth_failed` })(req, res, next);
},
    (req, res) => {
        // Generate JWT token
        const token = jwt.sign(
            { 
                id: req.user.id, 
                email: req.user.email, 
                name: req.user.name,
                picture: req.user.picture 
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Redirect to frontend with token
        res.redirect(`${process.env.CLIENT_URL}?token=${token}`);
    }
);

// Get current user info
router.get('/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        res.json({ user });
    });
});

// Logout
router.post('/logout', (req, res) => {
    // In a real app, you might want to blacklist the token
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;