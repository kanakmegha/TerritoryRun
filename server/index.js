import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/game.js';

dotenv.config();

const app = express();
// Vercel handles the port, but we keep 5001 for local dev
const PORT = process.env.PORT || 5001;

// 1. IMPROVED CORS: Allow all origins so your mobile phone can connect to the deployed API
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
// We mount them under both /api and / to handle different deployment environments
// (Local dev usually expects /api, Vercel might strip it)
app.use(['/api/auth', '/auth'], authRoutes);
app.use(['/api/game', '/game'], gameRoutes);

// Health check for Vercel deployment verification
app.get(['/', '/api'], (req, res) => res.send('Territory Run API Operational'));

// 2. STABLE DB CONNECTION: Use the URI from Vercel Environment Variables
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
      .then(() => console.log('Connected to MongoDB'))
      .catch((err) => console.error('MongoDB connection error:', err));
}

// 3. EXPORT FOR VERCEL: This allows Vercel to treat the app as a function
export default app;

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT} (Accessible on local network)`);
    });
}