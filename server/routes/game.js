import express from 'express';
import User from '../models/User.js';

// TODO: Create a separate model for ClaimedTiles if we want to query them efficiently
// For MVP, we might just store them in a simple collection or embedded in users (not scalable)
// Let's create a Tile schema/model quickly implicitly here or separate file?
// Better to have a separate model for Tiles.

import mongoose from 'mongoose';

const tileSchema = new mongoose.Schema({
    index: { type: String, required: true, unique: true }, // H3 index
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ownerColor: String,
    timestamp: { type: Date, default: Date.now }
});

const Tile = mongoose.model('Tile', tileSchema);

const router = express.Router();

// Middleware to verify token (simplified)
import jwt from 'jsonwebtoken';
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

        // Find user to get color
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Upsert the tile
        const tile = await Tile.findOneAndUpdate(
            { index },
            { 
                owner: userId, 
                ownerColor: user.color, 
                timestamp: Date.now() 
            },
            { upsert: true, new: true }
        );

        // Update user stats (increment territory count)
        // Note: This is a bit naive, ideally we check if we already owned it to not over-count
        // For MVP, let's just count total owned tiles
        const count = await Tile.countDocuments({ owner: userId });
        await User.findByIdAndUpdate(userId, { 'stats.territories': count });

        res.json({ success: true, tile });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// Get all tiles (for map rendering)
router.get('/map', async (req, res) => {
    try {
        // Implement Decay logic on fetch? Or background job?
        // Simple decay on fetch:
        const decayTime = 72 * 60 * 60 * 1000;
        const cutOff = new Date(Date.now() - decayTime);
        
        // Delete old tiles
        await Tile.deleteMany({ timestamp: { $lt: cutOff } });

        const tiles = await Tile.find({});
        // Convert to format expected by frontend
        const tileMap = tiles.reduce((acc, tile) => {
            acc[tile.index] = {
                ownerId: tile.owner,
                color: tile.ownerColor,
                timestamp: tile.timestamp
            };
            return acc;
        }, {});

        res.json(tileMap);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

export default router;
