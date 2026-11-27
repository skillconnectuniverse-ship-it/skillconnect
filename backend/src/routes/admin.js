import { Router } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { Complaint } from '../models/Complaint.js';
import { LedgerEntry } from '../models/Ledger.js';
import { PayoutRequest } from '../models/PayoutRequest.js';
import { requireAuth } from '../middleware/auth.js';
import { refundPayment } from '../services/payments.js';
import { decrypt, signMediaUrl } from '../services/crypto.js';
import { notify } from '../services/notify.js';
import { shapeComplaint } from './complaints.js';
import { BOOKING_STATUS as S } from '../constants.js';
import { escapeRegex, HttpError, str } from '../utils.js';

const router = Router();
router.use(requireAuth, (req, _res, next) => {
  if (req.user.role !== 'admin') throw new HttpError(403, 'Admin access required');
  next();
});

const oid = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Not found');
  return id;
};

router.get('/stats', async (_req, res) => {
  const [users, providers, bookingsByStatus, money, openComplaints, pendingKyc, pendingPayouts] = await Promise.all([
    User.countDocuments({ isActive: true }),
    User.countDocuments({ isActive: true, 'skills.0': { $exists: true } }),
    Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Booking.aggregate([
      { $match: { status: S.COMPLETED } },
      { $group: { _id: '$currency', gmvMinor: { $sum: '$amountMinor' }, feesMinor: { $sum: '$platformFeeMinor' } } },
    ]),
    Complaint.countDocuments({ status: 'open' }),
    User.countDocuments({ 'kyc.status': 'pending' }),
    PayoutRequest.countDocuments({ status: 'requested' }),
  ]);
  res.json({
    users,
    providers,
    bookings: Object.fromEntries(bookingsByStatus.map((b) => [b._id, b.count])),
    revenue: money.map((m) => ({ currency: m._id, gmvMinor: m.gmvMinor, feesMinor: m.feesMinor })),
    openComplaints,
    pendingKyc,
    pendingPayouts,
  });
});

router.get('/users', async (req, res) => {
  const q = str(req.query.q, 80);
  const filter = q ? { $or: [{ name: new RegExp(escapeRegex(q), 'i') }, { email: new RegExp(escapeRegex(q), 'i') }] } : {};
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(50);
  res.json({
    users: users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      city: u.city,
      role: u.role,
      isActive: u.isActive,
      emailVerified: u.emailVerified,
      phoneVerified: u.phoneVerified,
      kycStatus: u.kyc?.status || 'none',
      completedJobs: u.completedJobs,
      createdAt: u.createdAt,
    })),
  });
});

router.post('/users/:id/ban', async (req, res) => {
  const u = await User.findById(oid(req.params.id));
  if (!u) throw new HttpError(404, 'User not found');
  if (u.role === 'admin') throw new HttpError(400, 'Admins cannot be banned');
  u.isActive = req.body.banned === false;
  await u.save();
  res.json({ isActive: u.isActive });
});

router.get('/bookings', async (req, res) => {
  const filter = Object.values(S).includes(req.query.status) ? { status: req.query.status } : {};
  const items = await Booking.find(filter).sort({ createdAt: -1 }).limit(100).populate('client provider', 'name');
  res.json({
    bookings: items.map((b) => ({
      id: String(b._id),
      client: b.client?.name,
      provider: b.provider?.name,
      skill: b.skill?.name,
      status: b.status,
      amountMinor: b.amountMinor,
      currency: b.currency,
      disputeOpen: b.disputeOpen,
      createdAt: b.createdAt,
    })),
  });
});

// ---- Complaints / disputes ----
router.get('/complaints', async (req, res) => {
  const status = ['open', 'resolved', 'dismissed'].includes(req.query.status) ? req.query.status : 'open';
  const items = await Complaint.find({ status }).sort({ createdAt: -1 }).limit(100).populate('raisedBy against', 'name');
  res.json({ complaints: items.map(shapeComplaint) });
});

router.get('/complaints/:id', async (req, res) => {
  const c = await Complaint.findById(oid(req.params.id)).populate('raisedBy against', 'name');
  if (!c) throw new HttpError(404, 'Not found');
  const booking = c.booking ? await Booking.findById(c.booking) : null;
  const payment = booking ? await Payment.findOne({ booking: booking._id, status: { $in: ['paid', 'refunded'] } }) : null;
  res.json({
    complaint: shapeComplaint(c),
    booking: booking && {
      id: String(booking._id),
      status: booking.status,
      skill: booking.skill?.name,
      amountMinor: booking.amountMinor,
      currency: booking.currency,
      providerEarningMinor: booking.providerEarningMinor,
      refundableMinor: payment && payment.status === 'paid' ? payment.amountMinor - (payment.refundedMinor || 0) : 0,
    },
  });
});

router.post('/complaints/:id/resolve', async (req, res) => {
  const c = await Complaint.findById(oid(req.params.id));
  if (!c) throw new HttpError(404, 'Not found');
  if (c.status !== 'open') throw new HttpError(409, 'Already closed');
  const action = req.body.action;
  if (!['refund_full', 'refund_partial', 'release_provider', 'dismiss'].includes(action)) throw new HttpError(400, 'Invalid action');
  const note = str(req.body.note, 500);
  const booking = c.booking ? await Booking.findById(c.booking) : null;
  let refundMinor = 0;

  if (action === 'refund_full' || action === 'refund_partial') {
    if (!booking) throw new HttpError(400, 'Refunds need a booking');
    const payment = await Payment.findOne({ booking: booking._id, status: 'paid' });
    if (!payment) throw new HttpError(409, 'There is no paid payment left to refund');
    const remaining = payment.amountMinor - (payment.refundedMinor || 0);
    refundMinor = action === 'refund_full' ? remaining : Math.round(Number(req.body.refundMinor));
    if (!Number.isFinite(refundMinor) || refundMinor < 1 || refundMinor > remaining) throw new HttpError(400, `Refund must be between 1 and ${remaining}`);
    await refundPayment(payment, refundMinor);

    const reverse = Math.min(booking.providerEarningMinor, Math.round((refundMinor * booking.providerEarningMinor) / booking.amountMinor));
    booking.providerEarningMinor -= reverse;
    if (booking.status === S.COMPLETED && reverse > 0) {
      await LedgerEntry.create({ user: booking.provider, kind: 'reversal', currency: booking.currency, amountMinor: -reverse, booking: booking._id, note: 'Refund after complaint' });
    }
    if (action === 'refund_full' && booking.status !== S.COMPLETED) {
      booking.status = S.CANCELLED;
      booking.cancelledAt = new Date();
      booking.cancelReason = 'Refunded after complaint';
    }
  }

  c.status = action === 'dismiss' ? 'dismissed' : 'resolved';
  c.resolution = { action, refundMinor, note, by: req.user._id, at: new Date() };
  await c.save();

  if (booking) {
    const stillOpen = await Complaint.exists({ booking: booking._id, status: 'open' });
    booking.disputeOpen = !!stillOpen;
    await booking.save();
    if (!stillOpen) await LedgerEntry.updateMany({ booking: booking._id, kind: 'earning' }, { held: false });
  }

  const summary = { refund_full: 'Full refund issued to the client.', refund_partial: 'A partial refund was issued to the client.', release_provider: 'Decision: no refund; the provider keeps the payment.', dismiss: 'The complaint was dismissed.' }[action];
  const data = { complaintId: String(c._id), ...(booking ? { bookingId: String(booking._id) } : {}) };
  await Promise.all([c.raisedBy, c.against].map((id) => notify(id, { type: 'complaint', title: 'Complaint resolved', body: `${summary}${note ? ` ${note}` : ''}`, data })));
  res.json({ ok: true });
});

// ---- KYC ----
router.get('/kyc', async (req, res) => {
  const status = ['pending', 'verified', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const users = await User.find({ 'kyc.status': status }).sort({ 'kyc.submittedAt': 1 }).limit(50);
  res.json({
    items: users.map((u) => ({
      userId: String(u._id),
      name: u.name,
      email: u.email,
      status: u.kyc.status,
      legalName: u.kyc.legalName,
      idType: u.kyc.idType,
      idNumber: u.kyc.idNumberEnc ? decrypt(u.kyc.idNumberEnc) : '',
      submittedAt: u.kyc.submittedAt,
      frontUrl: u.kyc.frontMedia ? signMediaUrl(u.kyc.frontMedia) : null,
      selfieUrl: u.kyc.selfieMedia ? signMediaUrl(u.kyc.selfieMedia) : null,
    })),
  });
});

router.post('/kyc/:userId/review', async (req, res) => {
  const u = await User.findById(oid(req.params.userId));
  if (!u || u.kyc?.status !== 'pending') throw new HttpError(409, 'No pending KYC for this user');
  const approve = req.body.approve === true;
  const reason = str(req.body.reason, 200);
  if (!approve && !reason) throw new HttpError(400, 'Give a reason for rejecting');
  u.kyc.status = approve ? 'verified' : 'rejected';
  u.kyc.reviewedAt = new Date();
  u.kyc.rejectReason = approve ? '' : reason;
  await u.save();
  await notify(u._id, {
    type: 'kyc',
    title: approve ? 'KYC verified' : 'KYC rejected',
    body: approve ? 'You can now withdraw your earnings.' : reason,
  });
  res.json({ ok: true });
});

// ---- Payouts (admin sends the money from the business bank/UPI, then records it here) ----
router.get('/payouts', async (req, res) => {
  const status = ['requested', 'paid', 'rejected'].includes(req.query.status) ? req.query.status : 'requested';
  const items = await PayoutRequest.find({ status }).sort({ createdAt: 1 }).limit(100).populate('user', 'name email kyc.legalName');
  res.json({
    payouts: items.map((p) => {
      const d = JSON.parse(decrypt(p.destinationEnc));
      return {
        id: String(p._id),
        user: { id: String(p.user._id), name: p.user.name, email: p.user.email, legalName: p.user.kyc?.legalName },
        amountMinor: p.amountMinor,
        currency: p.currency,
        method: p.method,
        destination: d,
        status: p.status,
        txnRef: p.txnRef,
        adminNote: p.adminNote,
        createdAt: p.createdAt,
      };
    }),
  });
});

router.post('/payouts/:id/process', async (req, res) => {
  const p = await PayoutRequest.findById(oid(req.params.id));
  if (!p || p.status !== 'requested') throw new HttpError(409, 'Payout is not pending');
  const note = str(req.body.note, 300);
  if (req.body.action === 'paid') {
    const txnRef = str(req.body.txnRef, 80);
    if (!txnRef) throw new HttpError(400, 'Enter the bank/UPI transaction reference');
    p.status = 'paid';
    p.txnRef = txnRef;
  } else if (req.body.action === 'reject') {
    if (!note) throw new HttpError(400, 'Give a reason for rejecting');
    p.status = 'rejected';
    await LedgerEntry.create({ user: p.user, kind: 'payout_refund', currency: p.currency, amountMinor: p.amountMinor, payout: p._id, note: 'Withdrawal rejected' });
  } else {
    throw new HttpError(400, 'Invalid action');
  }
  p.adminNote = note;
  p.processedAt = new Date();
  p.processedBy = req.user._id;
  await p.save();
  await notify(p.user, {
    type: 'payout',
    title: p.status === 'paid' ? 'Withdrawal sent' : 'Withdrawal rejected',
    body: p.status === 'paid' ? `${p.amountMinor / 100} ${p.currency} sent to ${p.destinationLabel}. Ref: ${p.txnRef}` : note,
  });
  res.json({ ok: true });
});

export default router;
