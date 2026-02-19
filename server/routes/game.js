import express from 'express';
import User from '../models/User.js';
import Tile from '../models/Tile.js';
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

// Claim a tile
router.post('/claim', auth, async (req, res) => {
    try {
        const { index, lat, lng } = req.body;
        const userId = req.user;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Upsert the tile with precise location data
        const tile = await Tile.findOneAndUpdate(
            { index },
            { 
                owner: userId, 
                ownerColor: user.color, 
                timestamp: Date.now(),
                location: {
                    type: 'Point',
                    coordinates: [lng, lat] // MongoDB uses [lng, lat]
                }
            },
            { upsert: true, new: true }
        );

        // Update user stats
        const count = await Tile.countDocuments({ owner: userId });
        await User.findByIdAndUpdate(userId, { 'stats.territories': count });

        res.json({ success: true, tile });
    } catch (error) {
        console.error("Claim error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Get tiles within BBox (Viewport Filtering)
router.get('/map', async (req, res) => {
    try {
        const { bbox } = req.query; // format: minLng,minLat,maxLng,maxLat
        let query = {};

        if (bbox) {
            const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
            query = {
                location: {
                    $geoWithin: {
                        $box: [
                            [minLng, minLat],
                            [maxLng, maxLat]
                        ]
                    }
                }
            };
        }

        // Automatic Decay (72 hours)
        const cutOff = new Date(Date.now() - 72 * 60 * 60 * 1000);
        
        // We still fetch everything if no bbox, but we should enforce one in production
        const tiles = await Tile.find({ 
            ...query,
            timestamp: { $gt: cutOff } 
        }).limit(2000); // Guard against massive dumps

        // Convert to optimized format for frontend
        const tileMap = {};
        tiles.forEach(tile => {
            tileMap[tile.index] = {
                ownerId: tile.owner,
                color: tile.ownerColor,
                timestamp: tile.timestamp
            };
        });

        res.json(tileMap);
    } catch (error) {
        console.error("Map fetch error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

export default router;

export default router;
