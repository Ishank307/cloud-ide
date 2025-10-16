// 🧪 Test JWT Authentication
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testJWT() {
    try {
        console.log('🧪 Testing JWT Authentication...\n');

        // 1. Register a user
        console.log('1️⃣ Registering user...');
        await axios.post(`${BASE_URL}/register`, {
            email: 'test@example.com',
            password: 'password123'
        });
        console.log('✅ User registered successfully\n');

        // 2. Login
        console.log('2️⃣ Logging in...');
        const loginResponse = await axios.post(`${BASE_URL}/login`, {
            email: 'test@example.com',
            password: 'password123'
        });
        
        const { token } = loginResponse.data;
        console.log('✅ Login successful');
        console.log('🔑 Token:', token.substring(0, 20) + '...\n');

        // 3. Access protected route
        console.log('3️⃣ Accessing protected route...');
        const profileResponse = await axios.get(`${BASE_URL}/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('✅ Profile data:', profileResponse.data);
        console.log('\n🎉 All tests passed!');

    } catch (error) {
        if (error.response) {
            console.log('❌ Error:', error.response.data);
        } else {
            console.log('❌ Network Error:', error.message);
        }
    }
}

testJWT();