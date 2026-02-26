import express from 'express';
import User from '../models/User.js';
import Territory from '../models/Territory.js';
import Team from '../models/Team.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Middleware to verify token
const auth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Auth Error' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.userId;
        next();
    } catch (e) {
        res.status(401).json({ message: 'Invalid Token' });
    }
};

// Claim a New Vector Territory Poly
router.post('/claim', auth, async (req, res) => {
    try {
        const { boundary, area, perimeter, reward } = req.body;
        const userId = req.user;

        if (!boundary || !Array.isArray(boundary) || boundary.length < 3) {
            return res.status(400).json({ message: 'Invalid geometric boundary' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const territory = new Territory({
            owner: userId,
            ownerColor: user.color,
            area_sqm: area,
            perimeter_m: perimeter,
            strength_count: 1,
            strength: area, // Initial strength is just 1x Area
            path_nodes: boundary, // Store raw path coordinates
            boundary: {
                type: 'Polygon',
                coordinates: [boundary] // GeoJSON requires wrapped array: [[[lng, lat]]]
            }
        });

        await territory.save();

        // Dynamically increment user stats
        if (reward > 0) {
            await User.findByIdAndUpdate(userId, { $inc: { 'stats.territories': reward } });
        }

        res.json({ success: true, territory });
    } catch (error) {
        console.error("Claim error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Fetch all active Territories
router.get('/territories', async (req, res) => {
    try {
        const cutOff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const territories = await Territory.find({ 
            timestamp: { $gt: cutOff } 
        }).limit(1000).select('-__v');

        res.json({ territories });
    } catch (error) {
        console.error("Map fetch error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Fetch Global Leaderboard
router.get('/leaderboard', async (req, res) => {
    try {
        const leaders = await User.find()
            .sort({ 'stats.territories': -1, 'stats.distance': -1 })
            .limit(10)
            .select('username color stats');
        
        const formattedLeaderboard = leaders.map((l, index) => ({
            id: l._id,
            name: l.username,
            rank: index + 1,
            score: l.stats.territories * 10, // Mock score calculation
            area: `${(l.stats.distance / 1000).toFixed(1)} km²`
        }));

        res.json({ success: true, leaderboard: formattedLeaderboard });
    } catch (error) {
        console.error("Leaderboard fetch error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Fetch Active Teams
router.get('/teams', async (req, res) => {
    try {
        const teams = await Team.find()
            .populate('members', 'username')
            .limit(20);
        
        res.json({ success: true, teams });
    } catch (error) {
        console.error("Teams fetch error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Process Attack on Territory
router.post('/attack', auth, async (req, res) => {
    try {
        const { territoryId, attackDistance } = req.body;
        const userId = req.user;

        const territory = await Territory.findById(territoryId);
        if (!territory) return res.status(404).json({ message: 'Territory not found' });
        
        if (territory.owner.toString() === userId.toString()) {
            return res.status(400).json({ message: 'Cannot attack your own territory' });
        }

        const requiredDistance = territory.perimeter_m * territory.strength;

        // In a real app, you'd want to verify the GPS path here. 
        // For simplicity, we trust the client's calculated attack distance if it meets the criteria.
        if (attackDistance >= requiredDistance) {
            const user = await User.findById(userId);
            
            // Conquer!
            territory.owner = userId;
            territory.ownerColor = user.color;
            territory.timestamp = Date.now();
            territory.strength_count = 1; // Reset defense stat on capture
            territory.strength = territory.area_sqm; // Reset strength
            
            await territory.save();

            // Adjust Stats
            await User.findByIdAndUpdate(userId, { $inc: { 'stats.territories': 1 } });
            
            // Decrease old owner stats (Optional - but logical)
            await User.findByIdAndUpdate(territory.owner, { $inc: { 'stats.territories': -1 } });

            res.json({ success: true, message: 'Territory Reclaimed!', territory });
        } else {
            res.status(400).json({ success: false, message: 'Attack criteria not met' });
        }
    } catch (error) {
        console.error("Attack error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Predict / Suggest Routes (Mock Mappls Integration)
router.post('/suggest', async (req, res) => {
    try {
        const { targetDistance, lat, lng } = req.body;
        
        // Mock mapmyindia predictive routing curves
        const routes = [
            { id: 'r1', name: 'Alpha Protocol Loop', type: 'Urban', distance: (targetDistance * 1.05).toFixed(1) },
            { id: 'r2', name: 'Neon Grid Circuit', type: 'Flat', distance: (targetDistance * 0.92).toFixed(1) },
            { id: 'r3', name: 'Outskirts Path', type: 'Hilly', distance: (targetDistance * 1.15).toFixed(1) }
        ];

        res.json({ success: true, routes });
    } catch (error) {
        console.error("Suggest error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

export default router;
