import process from 'node:process';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from './app.js';

dotenv.config();

// Startup check for Clerk credentials

if (!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    console.warn('⚠️ WARNING: EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is missing from .env.');
}
// Development-only indoor test mode status
const devTestMode = process.env.NODE_ENV !== 'production' && process.env.DEV_INDOOR_TEST_MODE === 'true';
if (devTestMode) {
    console.log('🏠 INDOOR TEST MODE: enabled (short-distance validation, no real territory awards)');
    console.log(`   minDistance=${process.env.DEV_TEST_MIN_DISTANCE_METERS || 20}m minArea=${process.env.DEV_TEST_MIN_AREA_SQM || 1}m²`);
} else if (process.env.NODE_ENV === 'production' && process.env.DEV_INDOOR_TEST_MODE) {
    console.log('🏠 INDOOR TEST MODE: ignored (production environment)');
} else {
    console.log('🏠 INDOOR TEST MODE: disabled');
}
// Vercel handles the port, but we keep 5001 for local dev
const PORT = process.env.PORT || 5001;

// 2. STABLE DB CONNECTION: Use the URI from Vercel Environment Variables
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
      .then(() => console.log('Connected to MongoDB'))
      .catch((err) => console.error('MongoDB connection error:', err));
}

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT} (Accessible on local network)`);
    });
}

// 3. EXPORT FOR VERCEL: This allows Vercel to treat the app as a function
export default app;
