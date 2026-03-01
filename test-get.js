import axios from 'axios';

const testGet = async () => {
    try {
        console.log("Testing root /api...");
        const res1 = await axios.get('http://192.168.68.113:5001/api');
        console.log("Root /api:", res1.data);

        console.log("Testing /api/game/territories...");
        const res2 = await axios.get('http://192.168.68.113:5001/api/game/territories');
        console.log("/api/game/territories:", res2.status);
    } catch (e) {
        console.error("GET failed:", e.message);
        console.error("Status:", e.response?.status);
    }
};

testGet();
