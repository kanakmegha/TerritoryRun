import express from 'express';
import User from '../models/User.js';
import Territory from '../models/Territory.js';
//import Team from '../models/Team.js';
import { clerkAuth } from '../middleware/clerkAuth.js';
import { gameMutations } from '../services/gameMutations.js';
import { createActivityLifecycle } from '../services/activityLifecycle.js';
import { createRouteSuggestionResult } from '../services/routeSuggestions.js';


// --- ROUTES ---

export function createGameRouter({
  service = gameMutations,
  activityService = createActivityLifecycle({ mutations: service }),
  auth = clerkAuth,
  territoryModel = Territory,
  routeSuggestionService = createRouteSuggestionResult,
} = {}) {
  const router = express.Router();

  router.post('/activities', auth, async (req, res) => {
    console.log('[Activities] POST /activities start', {
      hasOwner: Boolean(req.user?._id),
      hasClientActivityId: Boolean(req.body?.clientActivityId),
      isTest: req.body?.isTest === true,
    });
    const result = await activityService.start({ ownerId: req.user?._id, clientActivityId: req.body?.clientActivityId, isTest: req.body?.isTest === true });
    console.log('[Activities] POST /activities completed', { status: result.status, code: result.body?.code });
    res.status(result.status).json(result.body);
  });

  router.post('/activities/:activityId/submit', auth, async (req, res) => {
    const result = await activityService.submit({ ownerId: req.user?._id, activityId: req.params.activityId, samples: req.body?.samples, isTest: req.body?.isTest === true });
    res.status(result.status).json(result.body);
  });

  // The request identifies evidence only. Reward, geometry and metrics are read
  // from the private, server-verified Activity record.
  router.post('/claim', auth, async (req, res) => {
    const result = await service.claim({
      userId: req.user?._id == null ? undefined : String(req.user._id),
      activityId: req.body?.activityId,
    });
    res.status(result.status).json(result.body);
  });

// Fetch all active Territories
router.get('/territories', async (req, res) => {
    try {
        const cutOff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const territories = await territoryModel.find({ timestamp: { $gt: cutOff } }).limit(1000).select('-__v -path_nodes -claimActivity');
        res.json({ territories });
    } catch (error) {
        console.error("Map fetch error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Fetch Global Leaderboard
router.get('/leaderboard', async (req, res) => {
    try {
        const leaders = await User.find().sort({ 'stats.territories': -1, 'stats.distance': -1 }).limit(10).select('username color stats');
        const formattedLeaderboard = leaders.map((l, index) => ({
            id: l._id,
            name: l.username,
            rank: index + 1,
            score: l.stats.territories * 10,
            area: `${(l.stats.distance / 1000).toFixed(1)} km²`
        }));
        res.json({ success: true, leaderboard: formattedLeaderboard });
    } catch (error) {
        console.error("Leaderboard fetch error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Fetch Active Teams
/* router.get('/teams', async (req, res) => {
    try {
        const teams = await Team.find().populate('members', 'username').limit(20);
        res.json({ success: true, teams });
    } catch (error) {
        console.error("Teams fetch error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
}); */

  // Eligibility comes only from the activity verifier's private evidence.
  router.post('/attack', auth, async (req, res) => {
    const result = await service.attack({
      userId: req.user?._id == null ? undefined : String(req.user._id),
      activityId: req.body?.activityId,
      territoryId: req.body?.territoryId,
    });
    res.status(result.status).json(result.body);
  });

router.post('/suggest', async (req, res) => {
  try {
    const result = await routeSuggestionService({ body: req.body });
    return res.status(result.status).json(result.body);
  } catch {
    return res.status(500).json({ success: false, code: 'suggestion_unavailable',
      message: 'Route suggestions are temporarily unavailable. Retry in a moment.' });
  }
});

  return router;
}

const router = createGameRouter();
export default router;
