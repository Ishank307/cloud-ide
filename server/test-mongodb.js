// 🧪 Test MongoDB Connection
require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
    try {
        console.log('🔗 Testing MongoDB connection...');
        console.log('URI:', process.env.MONGODB_URI?.replace(/\/\/.*@/, '//***:***@')); // Hide credentials
        
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB connected successfully!');
        
        // Test creating a simple document
        const TestSchema = new mongoose.Schema({
            message: String,
            timestamp: { type: Date, default: Date.now }
        });
        
        const Test = mongoose.model('Test', TestSchema);
        
        const testDoc = new Test({ message: 'Hello from JWT app!' });
        await testDoc.save();
        console.log('✅ Test document created successfully!');
        
        // Clean up
        await Test.deleteOne({ _id: testDoc._id });
        console.log('✅ Test document cleaned up!');
        
        await mongoose.disconnect();
        console.log('✅ MongoDB connection test completed!');
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:');
        console.error('Error:', error.message);
        
        if (error.message.includes('authentication failed')) {
            console.log('\n💡 Tips:');
            console.log('1. Check your username and password in the connection string');
            console.log('2. Make sure your IP is whitelisted in MongoDB Atlas');
            console.log('3. Verify your cluster is running');
        }
        
        if (error.message.includes('ENOTFOUND')) {
            console.log('\n💡 Tips:');
            console.log('1. Check your internet connection');
            console.log('2. Verify the cluster URL is correct');
        }
        
        process.exit(1);
    }
}

testConnection();