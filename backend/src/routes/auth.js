import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User, privateUser } from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import { HttpError, str } from '../utils.js';

const router = Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false });
router.use(limiter);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res) => {
  const name = str(req.body.name, 80);
  const email = str(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || '');
  if (!name) throw new HttpError(400, 'Name is required');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Valid email is required');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  if (await User.exists({ email })) throw new HttpError(409, 'Email already registered');

  const user = await User.create({
    name,
    email,
    phone: str(req.body.phone, 20),
    city: str(req.body.city, 80),
    country: str(req.body.country, 80),
    password: await bcrypt.hash(password, 11),
  });
  res.status(201).json({ token: signToken(user._id), user: privateUser(user) });
});

router.post('/login', async (req, res) => {
  const email = str(req.body.email, 120).toLowerCase();
  const user = await User.findOne({ email }).select('+password');
  const ok = user && user.isActive && (await bcrypt.compare(String(req.body.password || ''), user.password));
  if (!ok) throw new HttpError(401, 'Invalid email or password');
  res.json({ token: signToken(user._id), user: privateUser(user) });
});

export default router;
