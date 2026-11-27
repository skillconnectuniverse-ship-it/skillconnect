import { Router } from 'express';
import mongoose from 'mongoose';
import { Complaint, COMPLAINT_CATEGORIES } from '../models/Complaint.js';
import { Booking } from '../models/Booking.js';
import { User } from '../models/User.js';
import { LedgerEntry } from '../models/Ledger.js';
import { requireAuth } from '../middleware/auth.js';
import { notify, notifyAdmins } from '../services/notify.js';
import { BOOKING_STATUS as S } from '../constants.js';
import { HttpError, str } from '../utils.js';

const router = Router();
router.use(requireAuth);

export const shapeComplaint = (c) => ({
  id: String(c._id),
  type: c.type,
  category: c.category,
  description: c.description,
  status: c.status,
  bookingId: c.booking ? String(c.booking._id || c.booking) : undefined,
  raisedBy: c.raisedBy?._id ? { id: String(c.raisedBy._id), name: c.raisedBy.name } : { id: String(c.raisedBy) },
  against: c.against?._id ? { id: String(c.against._id), name: c.against.name } : { id: String(c.against) },
  messages: (c.messages || []).map((m) => ({ id: String(m._id), from: String(m.from), isAdmin: !!m.isAdmin, text: m.text, createdAt: m.createdAt })),
  resolution: c.resolution?.action ? { action: c.resolution.action, refundMinor: c.resolution.refundMinor, note: c.resolution.note, at: c.resolution.at } : null,
  createdAt: c.createdAt,
});

router.post('/', async (req, res) => {
  const category = str(req.body.category, 30);
  if (!COMPLAINT_CATEGORIES.includes(category)) throw new HttpError(400, 'Choose a category');
  const description = str(req.body.description, 2000);
  if (description.length < 10) throw new HttpError(400, 'Please describe the problem (at least 10 characters)');

  let type = 'report';
  let againstId = req.body.againstId;
  let booking = null;

  if (req.body.bookingId) {
    if (!mongoose.isValidObjectId(req.body.bookingId)) throw new HttpError(404, 'Booking not found');
    booking = await Booking.findById(req.body.bookingId);
    const me = String(req.user._id);
    if (!booking || ![String(booking.client), String(booking.provider)].includes(me)) throw new HttpError(404, 'Booking not found');
    if (![S.CONFIRMED, S.IN_PROGRESS, S.COMPLETED].includes(booking.status)) throw new HttpError(409, 'You can raise a dispute only for paid bookings');
    if (await Complaint.exists({ booking: booking._id, raisedBy: req.user._id, status: 'open' })) throw new HttpError(409, 'You already have an open complaint for this booking');
    type = 'dispute';
    againstId = String(booking.client) === me ? booking.provider : booking.client;
  }
  if (!mongoose.isValidObjectId(againstId)) throw new HttpError(400, 'Choose who the complaint is about');
  if (String(againstId) === String(req.user._id)) throw new HttpError(400, 'You cannot report yourself');
  const against = await User.findById(againstId).select('name');
  if (!against) throw new HttpError(404, 'User not found');

  const complaint = await Complaint.create({ type, booking: booking?._id, raisedBy: req.user._id, against: against._id, category, description });
  if (booking) {
    await Booking.updateOne({ _id: booking._id }, { disputeOpen: true });
    // Hold the provider's earnings until an admin decides.
    await LedgerEntry.updateMany({ booking: booking._id, kind: 'earning' }, { held: true });
    await notify(against._id, {
      type: 'complaint',
      title: 'A complaint was raised on your booking',
      body: 'Our team is reviewing it. You can reply from Support.',
      data: { bookingId: String(booking._id), complaintId: String(complaint._id) },
    });
  }
  await notifyAdmins({ type: 'admin_complaint', title: `New ${type}`, body: `${req.user.name} vs ${against.name}: ${category}`, data: { complaintId: String(complaint._id) } });
  res.status(201).json({ complaint: shapeComplaint(complaint) });
});

router.get('/mine', async (req, res) => {
  const items = await Complaint.find({ $or: [{ raisedBy: req.user._id }, { against: req.user._id, type: 'dispute' }] })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('raisedBy against', 'name');
  res.json({ complaints: items.map(shapeComplaint) });
});

async function loadMine(id, user) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Complaint not found');
  const c = await Complaint.findById(id).populate('raisedBy against', 'name');
  const me = String(user._id);
  const involved = c && (String(c.raisedBy._id) === me || (c.type === 'dispute' && String(c.against._id) === me));
  if (!c || !(involved || user.role === 'admin')) throw new HttpError(404, 'Complaint not found');
  return c;
}

router.get('/:id', async (req, res) => {
  res.json({ complaint: shapeComplaint(await loadMine(req.params.id, req.user)) });
});

router.post('/:id/reply', async (req, res) => {
  const c = await loadMine(req.params.id, req.user);
  if (c.status !== 'open') throw new HttpError(409, 'This complaint is closed');
  const text = str(req.body.text, 1000);
  if (!text) throw new HttpError(400, 'Message is empty');
  c.messages.push({ from: req.user._id, isAdmin: req.user.role === 'admin', text });
  await c.save();
  const others = [String(c.raisedBy._id), String(c.against._id)].filter((id) => id !== String(req.user._id));
  await Promise.all(
    others
      .filter((id) => c.type === 'dispute' || id === String(c.raisedBy._id))
      .map((id) => notify(id, { type: 'complaint', title: 'New reply on your complaint', body: text.slice(0, 100), data: { complaintId: String(c._id) } }))
  );
  res.status(201).json({ complaint: shapeComplaint(c) });
});

export default router;
