import express from 'express';
import User from '../models/User.js';
import { clerkAuth } from '../middleware/clerkAuth.js';

const router = express.Router();

// --- THE CORE PROFILE SYNC ---
// This is the route that populates your Profile and Empire tabs
router.get("/profile", clerkAuth, async (req, res) => {
  try {
    const user = req.user;

    res.json({
      user: {
        id: user.clerkId,                // important
        username: user.username,
        email: user.email,
        imageUrl: `https://api.dicebear.com/7.x/bottts/png?seed=${user.clerkId}`,
        color: "#00f3ff",
        stats: user.stats || {
          distance: 0,
          territories: 0,
          conquests: 0,
          defenses: 0
        }
      }
    });

  } catch (err) {
    console.error("PROFILE ERROR:", err);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});
// Redirect old 'me' requests to the new profile sync
router.get('/me', clerkAuth, (req, res) => res.redirect('/api/auth/profile'));

// Explicitly block old login/register routes now that we use Clerk
router.post('/login', (req, res) => res.status(410).json({ message: 'Legacy Login Disabled. Use Clerk.' }));
router.post('/register', (req, res) => res.status(410).json({ message: 'Legacy Register Disabled. Use Clerk.' }));

export default router;