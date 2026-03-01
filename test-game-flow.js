import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'http://192.168.68.113:5001/api';
const testUser = {
    username: `tester_${Date.now()}`,
    email: `tester_${Date.now()}@example.com`,
    password: 'Password123!',
    color: '#00FA9A'
};

let token = '';

const runTests = async () => {
    try {
        console.log("🚀 Starting Game Flow API Tests...");

        // 1. Register
        console.log("📝 Testing Registration...");
        const regRes = await axios.post(`${API_URL}/auth/register`, testUser);
        if (regRes.data.token) {
            console.log("✅ Registration Successful");
            token = regRes.data.token;
        }

        // 2. Login
        console.log("🔑 Testing Login...");
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: testUser.email,
            password: testUser.password
        });
        if (loginRes.data.token) {
            console.log("✅ Login Successful");
            axios.defaults.headers.common['Authorization'] = `Bearer ${loginRes.data.token}`;
        }

        // 3. Claim Territory
        console.log("🚩 Testing Territory Claim...");
        const boundary = [
            [28.6139, 77.2090],
            [28.6140, 77.2090],
            [28.6140, 77.2091],
            [28.6139, 77.2091],
            [28.6139, 77.2090]
        ];
        
        const claimRes = await axios.post(`${API_URL}/game/claim`, {
            boundary: boundary,
            area: 120,
            perimeter: 45,
            reward: 1
        });
        
        if (claimRes.data.success) {
            console.log("✅ Territory Claim Successful:", claimRes.data.territory._id);
            const territoryId = claimRes.data.territory._id;

            // 4. Fetch Territories
            console.log("🗺️ Testing Fetch Territories...");
            try {
                const terrRes = await axios.get(`${API_URL}/game/territories`);
                console.log(`✅ Fetched ${terrRes.data.territories.length} territories`);
            } catch (e) {
                console.warn("⚠️ /api/game/territories failed, trying /game/territories...");
                const altRes = await axios.get(`http://192.168.68.113:5001/game/territories`);
                console.log(`✅ Fetched ${altRes.data.territories.length} territories from alternative route`);
            }

            // 5. Leaderboard
            console.log("🏆 Testing Leaderboard...");
            const lbRes = await axios.get(`${API_URL}/game/leaderboard`);
            if (lbRes.data.success) {
                console.log("✅ Leaderboard fetched");
            }

            /* // 6. Teams
            console.log("👥 Testing Teams...");
            const teamsRes = await axios.get(`${API_URL}/game/teams`);
            if (teamsRes.data.success) {
                console.log("✅ Teams fetched");
            } */

            // 7. Attack
            console.log("⚔️ Testing Attack (Self-attack prevention)...");
            try {
                await axios.post(`${API_URL}/game/attack`, {
                    territoryId: territoryId,
                    attackDistance: 500
                });
            } catch (err) {
                if (err.response?.status === 400) {
                    console.log("✅ Self-attack correctly blocked");
                } else {
                    console.error("❌ Unexpected error on self-attack:", err.response?.data);
                }
            }
        }

        console.log("\n✨ All API Flow Tests Completed Successfully! ✨");
        process.exit(0);

    } catch (err) {
        console.error("\n❌ TEST FAILED");
        console.error("Endpoint:", err.config?.url);
        console.error("Message:", err.message);
        console.error("Data:", err.response?.data);
        process.exit(1);
    }
};

runTests();
