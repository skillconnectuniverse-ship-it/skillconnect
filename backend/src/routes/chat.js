import { Router } from 'express';
import mongoose from 'mongoose';
import { Message, conversationKey } from '../models/Message.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { emitToUser } from '../realtime.js';
import { notify } from '../services/notify.js';
import { HttpError, str } from '../utils.js';

const router = Router();
router.use(requireAuth);

const shape = (m) => ({ id: String(m._id), from: String(m.from), to: String(m.to), text: m.text, readAt: m.readAt, createdAt: m.createdAt });

router.get('/conversations', async (req, res) => {
  const me = new mongoose.Types.ObjectId(req.user._id);
  const rows = await Message.aggregate([
    { $match: { $or: [{ from: me }, { to: me }] } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$key',
        last: { $first: '$$ROOT' },
        unread: { $sum: { $cond: [{ $and: [{ $eq: ['$to', me] }, { $eq: ['$readAt', null] }] }, 1, 0] } },
      },
    },
    { $sort: { 'last.createdAt': -1 } },
    { $limit: 100 },
  ]);
  const otherIds = rows.map((r) => (String(r.last.from) === String(me) ? r.last.to : r.last.from));
  const users = await User.find({ _id: { $in: otherIds } }).select('name avatar status');
  const byId = new Map(users.map((u) => [String(u._id), u]));
  res.json({
    conversations: rows
      .map((r, i) => {
        const u = byId.get(String(otherIds[i]));
        if (!u) return null;
        return {
          user: { id: String(u._id), name: u.name, avatar: u.avatar, status: u.status },
          lastMessage: shape(r.last),
          unread: r.unread,
        };
      })
      .filter(Boolean),
  });
});

router.get('/:userId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) throw new HttpError(404, 'User not found');
  const key = conversationKey(req.user._id, req.params.userId);
  const filter = { key };
  if (req.query.before) {
    const d = new Date(String(req.query.before));
    if (!Number.isNaN(d.getTime())) filter.createdAt = { $lt: d };
  }
  const msgs = await Message.find(filter).sort({ createdAt: -1 }).limit(50);
  await Message.updateMany({ key, to: req.user._id, readAt: null }, { readAt: new Date() });
  res.json({ messages: msgs.reverse().map(shape) });
});

router.post('/:userId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) throw new HttpError(404, 'User not found');
  const text = str(req.body.text, 2000);
  if (!text) throw new HttpError(400, 'Message is empty');
  if (String(req.params.userId) === String(req.user._id)) throw new HttpError(400, 'Cannot message yourself');
  const other = await User.findOne({ _id: req.params.userId, isActive: true }).select('_id');
  if (!other) throw new HttpError(404, 'User not found');

  const msg = await Message.create({
    key: conversationKey(req.user._id, other._id),
    from: req.user._id,
    to: other._id,
    text,
  });
  const out = shape(msg);
  emitToUser(other._id, 'message', out);
  // Realtime covers open apps; a stored notification + push covers closed ones.
  notify(other._id, { type: 'message', title: req.user.name, body: text.slice(0, 120), data: { userId: String(req.user._id) }, store: false }).catch(() => {});
  res.status(201).json({ message: out });
});

export default router;
