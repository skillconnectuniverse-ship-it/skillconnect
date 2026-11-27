import { Router } from 'express';
import { User, publicUser } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { CATEGORIES } from '../constants.js';
import { escapeRegex, haversineKm, parseLatLng, str } from '../utils.js';

const router = Router();
router.use(requireAuth);

router.get('/categories', (_req, res) => res.json({ categories: CATEGORIES }));

// Address -> coordinates for browsers without GPS. Proxied because Nominatim requires a User-Agent and blocks browser CORS.
router.get('/geocode', async (req, res) => {
  const q = str(req.query.q, 200);
  if (!q) return res.json({ result: null });
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'SkillConnect/1.0' },
    });
    const [hit] = r.ok ? await r.json() : [];
    res.json({ result: hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null });
  } catch {
    res.json({ result: null });
  }
});

// GET /api/search?q=driver delhi&city=&lat=&lng=&radiusKm=&sort=rating|nearby&availableOnly=1&minRating=4
router.get('/', async (req, res) => {
  const q = str(req.query.q, 100);
  const city = str(req.query.city, 80);
  const sort = req.query.sort === 'nearby' ? 'nearby' : 'rating';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const ll = parseLatLng(req.query.lat, req.query.lng);
  const radiusKm = Math.min(500, Math.max(1, Number(req.query.radiusKm) || 25));

  const and = [{ isActive: true, 'skills.0': { $exists: true } }];
  if (req.query.excludeSelf !== '0') and.push({ _id: { $ne: req.user._id } });

  // Every word must match the name, city, skill or category, e.g. "driver delhi".
  for (const token of q.split(/\s+/).filter(Boolean).slice(0, 5)) {
    const re = new RegExp(escapeRegex(token), 'i');
    and.push({ $or: [{ name: re }, { city: re }, { 'skills.name': re }, { 'skills.category': re }] });
  }
  if (city) and.push({ city: new RegExp(escapeRegex(city), 'i') });
  if (req.query.availableOnly === '1') and.push({ status: 'available' });
  const minRating = Number(req.query.minRating);
  if (minRating > 0) and.push({ ratingAvg: { $gte: minRating } });
  if (ll) {
    and.push({ location: { $geoWithin: { $centerSphere: [[ll.lng, ll.lat], radiusKm / 6378.1] } } });
  }

  const filter = { $and: and };
  const withDistance = (u) => {
    const out = publicUser(u);
    out.distanceKm = ll && out.coords ? Math.round(haversineKm(ll.lat, ll.lng, out.coords.lat, out.coords.lng) * 10) / 10 : null;
    return out;
  };

  let users;
  if (sort === 'nearby' && ll) {
    const all = await User.find(filter).limit(300);
    users = all
      .map(withDistance)
      .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9))
      .slice((page - 1) * limit, page * limit);
  } else {
    const docs = await User.find(filter)
      .sort({ ratingScore: -1, ratingCount: -1, completedJobs: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    users = docs.map(withDistance);
  }
  res.json({ users, page });
});

export default router;
