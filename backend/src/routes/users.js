import { Router } from 'express';
import { User, publicUser, privateUser } from '../models/User.js';
import { Review } from '../models/Review.js';
import { requireAuth } from '../middleware/auth.js';
import { PLANS, CURRENCIES, STATUSES } from '../constants.js';
import { HttpError, str, parseLatLng, toPoint } from '../utils.js';
import mongoose from 'mongoose';

const router = Router();
router.use(requireAuth);

function cleanSkill(s) {
  const name = str(s?.name, 60);
  if (!name) throw new HttpError(400, 'Skill name is required');
  const rates = {};
  for (const plan of PLANS) {
    const v = Number(s.rates?.[plan]);
    if (Number.isFinite(v) && v > 0) rates[plan] = Math.round(v * 100) / 100;
  }
  if (!Object.keys(rates).length) throw new HttpError(400, `Set at least one price for "${name}"`);
  const currency = str(s.currency || 'INR', 3).toUpperCase();
  if (!CURRENCIES.includes(currency)) throw new HttpError(400, `Unsupported currency ${currency}`);
  const out = {
    name,
    category: str(s.category || 'Other', 40),
    description: str(s.description, 500),
    experienceYears: Math.min(70, Math.max(0, Number(s.experienceYears) || 0)),
    currency,
    rates,
  };
  if (s._id && mongoose.isValidObjectId(s._id)) out._id = s._id;
  return out;
}

router.get('/me', (req, res) => res.json({ user: privateUser(req.user) }));

router.patch('/me', async (req, res) => {
  const u = req.user;
  const b = req.body;
  if (b.name !== undefined) {
    if (!str(b.name, 80)) throw new HttpError(400, 'Name cannot be empty');
    u.name = str(b.name, 80);
  }
  if (b.bio !== undefined) u.bio = str(b.bio, 500);
  if (b.city !== undefined) u.city = str(b.city, 80);
  if (b.country !== undefined) u.country = str(b.country, 80);
  if (b.phone !== undefined) u.phone = str(b.phone, 20);
  if (b.avatar !== undefined) u.avatar = str(b.avatar, 500);
  if (b.statusNote !== undefined) u.statusNote = str(b.statusNote, 120);
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) throw new HttpError(400, 'Invalid status');
    u.status = b.status;
  }
  if (b.lat !== undefined && b.lng !== undefined) {
    const ll = parseLatLng(b.lat, b.lng);
    if (!ll) throw new HttpError(400, 'Invalid coordinates');
    u.location = toPoint(ll);
  }
  await u.save();
  res.json({ user: privateUser(u) });
});

router.put('/me/skills', async (req, res) => {
  if (!Array.isArray(req.body.skills) || req.body.skills.length > 15) throw new HttpError(400, 'Provide up to 15 skills');
  req.user.skills = req.body.skills.map(cleanSkill);
  await req.user.save();
  res.json({ user: privateUser(req.user) });
});

router.post('/me/push-token', async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { pushToken: str(req.body.token, 200) });
  res.json({ ok: true });
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'User not found');
  const user = await User.findOne({ _id: req.params.id, isActive: true });
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ user: publicUser(user), isSelf: String(user._id) === String(req.user._id) });
});

router.get('/:id/reviews', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'User not found');
  const page = Math.max(1, Number(req.query.page) || 1);
  const reviews = await Review.find({ provider: req.params.id })
    .sort({ createdAt: -1 })
    .skip((page - 1) * 20)
    .limit(20)
    .populate('client', 'name avatar');
  res.json({
    reviews: reviews.map((r) => ({
      id: String(r._id),
      rating: r.rating,
      comment: r.comment,
      skillName: r.skillName,
      createdAt: r.createdAt,
      client: r.client ? { id: String(r.client._id), name: r.client.name, avatar: r.client.avatar } : null,
    })),
  });
});

export default router;
