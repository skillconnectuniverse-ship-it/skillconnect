import { Router } from 'express';
import mongoose from 'mongoose';
import { Notification } from '../models/Notification.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const shape = (n) => ({ id: String(n._id), type: n.type, title: n.title, body: n.body, data: n.data, read: !!n.readAt, createdAt: n.createdAt });

router.get('/', async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100),
    Notification.countDocuments({ user: req.user._id, readAt: null }),
  ]);
  res.json({ notifications: items.map(shape), unread });
});

router.post('/read', async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { readAt: new Date() });
  res.json({ ok: true });
});

router.post('/:id/read', async (req, res) => {
  if (mongoose.isValidObjectId(req.params.id)) {
    await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { readAt: new Date() });
  }
  res.json({ ok: true });
});

export default router;
