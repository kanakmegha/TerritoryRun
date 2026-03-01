import express from 'express';
import User from '../models/User.js';
import Territory from '../models/Territory.js';
//import Team from '../models/Team.js';
import { clerkAuth } from '../middleware/clerkAuth.js';


const router = express.Router();

// --- GEOMETRY HELPERS ---
const R_EARTH = 6378137;
function toRad(degrees) { return degrees * Math.PI / 180; }
function toDeg(radians) { return radians * 180 / Math.PI; }

function computeDestinationPoint(lat, lng, distMeters, bearingDeg) {
    const lat1 = toRad(lat);
    const lng1 = toRad(lng);
    const brng = toRad(bearingDeg);
    const dR = distMeters / R_EARTH;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(brng));
    const lng2 = Math.atan2(Math.sin(brng) * Math.sin(dR) * Math.cos(lat1), Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: toDeg(lat2), lng: toDeg(lng1 + lng2) };
}

function decodePolyline(encoded) {
    if (!encoded) return [];
    let points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;
    while (index < len) {
        let b, shift = 0, result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;
        points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
    return points;
}

function computePolygonArea(points) {
    if (points.length < 3) return 0;
    let area = 0;
    const refLat = toRad(points[0].lat);
    const latToM = 111320;
    const lngToM = 111320 * Math.cos(refLat);
    let cart = points.map(p => ({ x: (p.lng - points[0].lng) * lngToM, y: (p.lat - points[0].lat) * latToM }));
    for (let i = 0; i < cart.length; i++) {
        const j = (i + 1) % cart.length;
        area += cart[i].x * cart[j].y - cart[i].y * cart[j].x;
    }
    return Math.abs(area / 2);
}

// --- ROUTES ---

// Claim a New Vector Territory Poly
router.post('/claim', clerkAuth, async (req, res) => {
    try {
        const { boundary, area, perimeter, reward } = req.body;
        const user = req.user;
        const userId = user._id;
        if (!boundary || !Array.isArray(boundary) || boundary.length < 3) {
            return res.status(400).json({ message: 'Invalid geometric boundary' });
        }
        if (!user) return res.status(404).json({ message: 'User not found' });
        const territory = new Territory({
            owner: userId,
            ownerColor: user.color,
            area_sqm: area,
            perimeter_m: perimeter,
            strength_count: 1,
            strength: area,
            path_nodes: boundary,
            boundary: { type: 'Polygon', coordinates: [boundary] }
        });
        await territory.save();
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
        const territories = await Territory.find({ timestamp: { $gt: cutOff } }).limit(1000).select('-__v');
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

// Process Attack on Territory
router.post('/attack', clerkAuth, async (req, res) => {
    try {
        const { territoryId, attackDistance } = req.body;
        const user = req.user;
        const userId = user._id;
        const territory = await Territory.findById(territoryId);
        if (!territory) return res.status(404).json({ message: 'Territory not found' });
        if (territory.owner.toString() === userId.toString()) {
            return res.status(400).json({ message: 'Cannot attack your own territory' });
        }
        const requiredDistance = territory.perimeter_m * territory.strength;
        if (attackDistance >= requiredDistance) {
            territory.owner = userId;
            territory.ownerColor = user.color;
            territory.timestamp = Date.now();
            territory.strength_count = 1;
            territory.strength = territory.area_sqm;
            await territory.save();
            await User.findByIdAndUpdate(userId, { $inc: { 'stats.territories': 1 } });
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

// --- UPDATED SUGGEST ROUTE ---
router.post('/suggest', async (req, res) => {
    try {
        const { targetDistance, lat, lng } = req.body;
        const distKm = parseFloat(targetDistance) || 5;
        const distMeters = distKm * 1000;
        const apiKey = process.env.GOOGLE_CONSOLE_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

        if (!lat || !lng) {
            return res.status(400).json({ success: false, message: 'Coordinates required.' });
        }

        let locationName = distKm < 5 ? 'Sector' : 'District';
        if (apiKey) {
            try {
                const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&result_type=neighborhood|sublocality|route`;
                const gRes = await fetch(geoUrl);
                const gData = await gRes.json();
                if (gData.status === 'OK' && gData.results.length > 0) {
                    locationName = gData.results[0].address_components[0].short_name;
                }
            } catch (e) {}
        }

        const headings = [0, 90, 180, 270];
        const routeTypes = ['Urban Grid', 'Mainline', 'Back-Alley', 'Mixed Terrain'];
        const nameSuffixes = ['Neural Loop', 'Perimeter Bound', 'Stealth Circuit', 'Apex Trail'];

        const routePromises = headings.map(async (heading, index) => {
            const legLength = distMeters / 3.2; // Slightly adjusted for road winding
            const wp1 = computeDestinationPoint(lat, lng, legLength, heading);
            const wp2 = computeDestinationPoint(wp1.lat, wp1.lng, legLength, heading + 120);

            let realDistanceKm = distKm;
            let realAreaKm2 = ((distKm * distKm) / 12).toFixed(2);
            let polyline = "";

            if (apiKey) {
                // FIXED: Using standard waypoints (no via:) for maximum API compatibility
                const dirUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${lat},${lng}&destination=${lat},${lng}&waypoints=${wp1.lat},${wp1.lng}|${wp2.lat},${wp2.lng}&mode=walking&key=${apiKey}`;
                try {
                    const rDir = await fetch(dirUrl);
                    const dDir = await rDir.json();
                    if (dDir.status === 'OK' && dDir.routes?.length > 0) {
                        const route = dDir.routes[0];
                        let sumMeters = route.legs.reduce((acc, leg) => acc + leg.distance.value, 0);
                        realDistanceKm = (sumMeters / 1000).toFixed(1);
                        polyline = route.overview_polyline?.points || "";

                        const decoded = decodePolyline(polyline);
                        if (decoded.length > 2) {
                            const areaSqm = computePolygonArea(decoded);
                            realAreaKm2 = (areaSqm / 1000000).toFixed(2);
                        }
                    }
                } catch (e) {
                    console.error(`Route ${index} math synthesis failed:`, e.message);
                }
            }

            return {
                id: `r_${Date.now()}_${index}`,
                name: `${locationName} ${nameSuffixes[index]}`,
                type: routeTypes[index],
                distance: realDistanceKm,
                area: realAreaKm2,
                polyline: polyline
            };
        });

        const routes = await Promise.all(routePromises);
        res.json({ success: true, routes });
    } catch (error) {
        console.error("Suggest API Crash:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

export default router;