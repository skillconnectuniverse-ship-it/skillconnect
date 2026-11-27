import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User, privateUser } from '../models/User.js';
import { issueCode, consumeCode } from '../models/VerificationCode.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { sendMail } from '../services/mailer.js';
import { sendSms } from '../services/sms.js';
import { config } from '../config.js';
import { HttpError, str } from '../utils.js';

const router = Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false });
router.use(limiter);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9]{8,15}$/;

// Without a mail/SMS provider, development responses include the code so the flow can be tested.
const devCodeFor = (sent, code) => (!config.isProd && !sent && code ? { devCode: code } : {});

async function sendEmailCode(user) {
  const code = await issueCode(user._id, 'email', user.email);
  if (!code) return { throttled: true };
  const sent = await sendMail({ to: user.email, subject: 'Verify your SkillConnect email', text: `Your SkillConnect verification code is ${code}. It expires in 15 minutes.` });
  return { sent, code };
}

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
  const mail = await sendEmailCode(user).catch((e) => {
    console.error('verification email failed', e.message);
    return {};
  });
  res.status(201).json({ token: signToken(user._id), user: privateUser(user), ...devCodeFor(mail.sent, mail.code) });
});

router.post('/login', async (req, res) => {
  const email = str(req.body.email, 120).toLowerCase();
  const user = await User.findOne({ email }).select('+password');
  const ok = user && user.isActive && (await bcrypt.compare(String(req.body.password || ''), user.password));
  if (!ok) throw new HttpError(401, 'Invalid email or password');
  res.json({ token: signToken(user._id), user: privateUser(user) });
});

router.post('/email/send', requireAuth, async (req, res) => {
  if (req.user.emailVerified) return res.json({ ok: true, alreadyVerified: true });
  const mail = await sendEmailCode(req.user);
  if (mail.throttled) throw new HttpError(429, 'Please wait a minute before asking for another code');
  res.json({ ok: true, ...devCodeFor(mail.sent, mail.code) });
});

router.post('/email/verify', requireAuth, async (req, res) => {
  const hit = await consumeCode(req.user._id, 'email', req.body.code);
  if (!hit || hit.target !== req.user.email) throw new HttpError(400, 'Invalid or expired code');
  req.user.emailVerified = true;
  await req.user.save();
  res.json({ user: privateUser(req.user) });
});

router.post('/phone/send', requireAuth, async (req, res) => {
  const phone = str(req.body.phone || req.user.phone, 20).replace(/[\s-]/g, '');
  if (!PHONE_RE.test(phone)) throw new HttpError(400, 'Enter the phone number with country code, e.g. +919876543210');
  if (phone !== req.user.phone) {
    req.user.phone = phone;
    req.user.phoneVerified = false;
    await req.user.save();
  }
  const code = await issueCode(req.user._id, 'phone', phone);
  if (!code) throw new HttpError(429, 'Please wait a minute before asking for another code');
  const sent = await sendSms(phone, `Your SkillConnect verification code is ${code}`).catch((e) => {
    console.error('sms failed', e.message);
    return false;
  });
  res.json({ ok: true, ...devCodeFor(sent, code) });
});

router.post('/phone/verify', requireAuth, async (req, res) => {
  const hit = await consumeCode(req.user._id, 'phone', req.body.code);
  if (!hit || hit.target !== req.user.phone) throw new HttpError(400, 'Invalid or expired code');
  req.user.phoneVerified = true;
  await req.user.save();
  res.json({ user: privateUser(req.user) });
});

// Always answers ok so the endpoint cannot be used to discover which emails are registered.
router.post('/forgot', async (req, res) => {
  const email = str(req.body.email, 120).toLowerCase();
  const user = EMAIL_RE.test(email) ? await User.findOne({ email, isActive: true }) : null;
  let extra = {};
  if (user) {
    const code = await issueCode(user._id, 'reset', user.email);
    if (code) {
      const sent = await sendMail({ to: user.email, subject: 'Reset your SkillConnect password', text: `Your password reset code is ${code}. It expires in 15 minutes. If you did not ask for this, ignore this email.` }).catch(() => false);
      extra = devCodeFor(sent, code);
    }
  }
  res.json({ ok: true, ...extra });
});

router.post('/reset', async (req, res) => {
  const email = str(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || '');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  const user = await User.findOne({ email, isActive: true });
  const hit = user && (await consumeCode(user._id, 'reset', req.body.code));
  if (!hit) throw new HttpError(400, 'Invalid or expired code');
  user.password = await bcrypt.hash(password, 11);
  user.emailVerified = true; // receiving the code proves ownership of the inbox
  await user.save();
  res.json({ ok: true });
});

export default router;
