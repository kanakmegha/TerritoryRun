import axios from 'axios';

const testRegistration = async () => {
    try {
        console.log("Testing Registration Endpoint directly...");
        const res = await axios.post('http://localhost:5001/api/auth/register', {
            username: `test_${Date.now()}`,
            email: `test_${Date.now()}@example.com`,
            password: 'password123',
            color: '#ff0000'
        });
        console.log("✅ SUCCESS:", res.data);
    } catch (err) {
        console.error("❌ ERROR:", err.message);
        console.error("Status:", err.response?.status);
        console.error("Data:", err.response?.data);
    }
};

testRegistration();
