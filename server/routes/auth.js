import express from 'express';
import { clerkAuth } from '../middleware/clerkAuth.js';

export function createAuthRouter({ auth = clerkAuth } = {}) {
  const router = express.Router();

  router.get('/profile', auth, async (req, res) => {
    try {
      const user = req.user;
      if (!user?._id) {
        return res.status(500).json({ message: 'User profile database ID missing' });
      }
      return res.json({
        user: {
          _id: String(user._id),
          id: user.clerkId,
          username: user.username,
          email: user.email,
          imageUrl: `https://api.dicebear.com/7.x/bottts/png?seed=${user.clerkId}`,
          color: '#00f3ff',
          stats: user.stats || {
            distance: 0,
            territories: 0,
            conquests: 0,
            defenses: 0,
          },
        },
      });
    } catch {
      return res.status(500).json({ message: 'Failed to fetch profile' });
    }
  });

  router.get('/me', auth, (req, res) => res.redirect('/api/auth/profile'));
  router.post('/login', (req, res) => res.status(410).json({ message: 'Legacy Login Disabled. Use Clerk.' }));
  router.post('/register', (req, res) => res.status(410).json({ message: 'Legacy Register Disabled. Use Clerk.' }));

  return router;
}

const router = createAuthRouter();

export default router;
