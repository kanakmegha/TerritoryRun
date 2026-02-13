import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/game.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;



// Middleware
app.use(cors()); // Revert to default permissive CORS for debugging
// app.use(cors({
//    origin: 'http://localhost:5173', 
//    credentials: true
// }));
app.use(express.json());



// Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
