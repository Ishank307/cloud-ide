// 🚀 SUPER SIMPLE JWT EXAMPLE
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// 📊 Simple User Schema
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

// 🔗 Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/simple-jwt')
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ MongoDB Error:', err));

// 📝 REGISTER
app.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const user = new User({ email, password: hashedPassword });
        await user.save();
        
        res.json({ message: 'User created!' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 🔐 LOGIN
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }
        
        // Check password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(400).json({ error: 'Invalid password' });
        }
        
        // Create JWT
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            'your-secret-key',
            { expiresIn: '24h' }
        );
        
        res.json({ token, message: 'Login successful!' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 🛡️ PROTECTED ROUTE
app.get('/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const decoded = jwt.verify(token, 'your-secret-key');
        const user = await User.findById(decoded.userId).select('-password');
        
        res.json({ user });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

app.listen(3000, () => {
    console.log('🚀 Server running on port 3000');
});