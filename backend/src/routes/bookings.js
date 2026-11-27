import { Router } from 'express';
import mongoose from 'mongoose';
import { Booking, serializeBooking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { Review } from '../models/Review.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { notify } from '../services/notify.js';
import { refundPayment } from '../services/payments.js';
import { emitToUser } from '../realtime.js';
import { config } from '../config.js';
import { BOOKING_STATUS as S, PLANS, PLAN_UNIT, HIREABLE_STATUSES } from '../constants.js';
import { HttpError, genOtp, parseLatLng, str, toPoint, safeStr } from '../utils.js';

const router = Router();
router.use(requireAuth);

const POPULATE = 'name avatar city ratingAvg ratingCount phone';
const MAX_OTP_ATTEMPTS = 5;

async function loadForParticipant(id, userId) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Booking not found');
  const b = await Booking.findById(id).populate('client provider', POPULATE);
  if (!b) throw new HttpError(404, 'Booking not found');
  const uid = String(userId);
  const isClient = String(b.client._id) === uid;
  const isProvider = String(b.provider._id) === uid;
  if (!isClient && !isProvider) throw new HttpError(404, 'Booking not found');
  return { b, isClient, isProvider };
}

const label = (b) => `${b.quantity} ${PLAN_UNIT[b.plan]}${b.quantity > 1 ? 's' : ''}`;

async function pushUpdate(b, ...userIds) {
  const data = { bookingId: String(b._id) };
  userIds.forEach((u) => emitToUser(u, 'booking:update', data));
}

router.post('/', async (req, res) => {
  const { providerId, skillId } = req.body;
  const plan = String(req.body.plan);
  if (!PLANS.includes(plan)) throw new HttpError(400, 'Choose hourly, daily, monthly or yearly');
  if (!mongoose.isValidObjectId(providerId)) throw new HttpError(400, 'Invalid provider');
  if (String(providerId) === String(req.user._id)) throw new HttpError(400, 'You cannot hire yourself');
  const quantity = Math.floor(Number(req.body.quantity) || 1);
  if (quantity < 1 || quantity > 1000) throw new HttpError(400, 'Invalid quantity');

  const provider = await User.findOne({ _id: providerId, isActive: true });
  if (!provider) throw new HttpError(404, 'Provider not found');
  if (!HIREABLE_STATUSES.includes(provider.status)) {
    throw new HttpError(409, 'This person is not accepting work right now');
  }
  const skill = provider.skills.id(skillId);
  if (!skill) throw new HttpError(404, 'Skill not found');
  const rate = skill.rates?.[plan];
  if (!rate) throw new HttpError(400, `${skill.name} is not offered on a ${plan} basis`);

  const ll = parseLatLng(req.body.lat, req.body.lng);
  if (!ll) throw new HttpError(400, 'Work location is required');

  const unitPriceMinor = Math.round(rate * 100);
  const amountMinor = unitPriceMinor * quantity;
  const platformFeeMinor = Math.round((amountMinor * config.platformFeePercent) / 100);
  const scheduledFor = req.body.scheduledFor ? new Date(req.body.scheduledFor) : new Date();

  const booking = await Booking.create({
    client: req.user._id,
    provider: provider._id,
    skill: { skillId: skill._id, name: skill.name, category: skill.category },
    plan,
    quantity,
    currency: skill.currency,
    unitPriceMinor,
    amountMinor,
    platformFeeMinor,
    providerEarningMinor: amountMinor - platformFeeMinor,
    scheduledFor: Number.isNaN(scheduledFor.getTime()) ? new Date() : scheduledFor,
    notes: str(req.body.notes, 500),
    location: toPoint(ll),
    address: str(req.body.address, 300),
  });
  await booking.populate('client provider', POPULATE);
  res.status(201).json({ booking: serializeBooking(booking, req.user._id) });
});

router.get('/', async (req, res) => {
  const me = req.user._id;
  const role = req.query.role;
  const filter =
    role === 'client' ? { client: me } : role === 'provider' ? { provider: me, status: { $ne: S.PENDING_PAYMENT } } : { $or: [{ client: me }, { provider: me, status: { $ne: S.PENDING_PAYMENT } }] };
  if (req.query.status && Object.values(S).includes(req.query.status)) filter.status = req.query.status;
  const items = await Booking.find(filter).sort({ createdAt: -1 }).limit(100).populate('client provider', POPULATE);
  res.json({ bookings: items.map((b) => serializeBooking(b, me)) });
});

router.get('/:id', async (req, res) => {
  const { b } = await loadForParticipant(req.params.id, req.user._id);
  res.json({ booking: serializeBooking(b, req.user._id) });
});

// Provider enters the OTP shown on the client's phone when work begins; the timer starts.
router.post('/:id/start', async (req, res) => {
  const { b, isProvider } = await loadForParticipant(req.params.id, req.user._id);
  if (!isProvider) throw new HttpError(403, 'Only the hired person can start the job');
  if (b.status !== S.CONFIRMED) throw new HttpError(409, 'Booking is not ready to start');
  if (b.otpAttempts >= MAX_OTP_ATTEMPTS) throw new HttpError(429, 'Too many wrong OTP attempts');
  if (safeStr(req.body.otp) !== b.startOtp) {
    await Booking.updateOne({ _id: b._id }, { $inc: { otpAttempts: 1 } });
    throw new HttpError(400, 'Incorrect OTP');
  }
  const updated = await Booking.findOneAndUpdate(
    { _id: b._id, status: S.CONFIRMED },
    { status: S.IN_PROGRESS, startedAt: new Date(), endOtp: genOtp(), otpAttempts: 0 },
    { new: true }
  ).populate('client provider', POPULATE);
  if (!updated) throw new HttpError(409, 'Booking is not ready to start');

  await notify(b.client._id, {
    type: 'job_started',
    title: 'Work started',
    body: `${b.provider.name} started ${b.skill.name}. Timer is running.`,
    data: { bookingId: String(b._id) },
  });
  await pushUpdate(b, b.client._id, b.provider._id);
  res.json({ booking: serializeBooking(updated, req.user._id) });
});

// Provider enters the closing OTP to finish; booking is completed and the client is asked to review.
router.post('/:id/complete', async (req, res) => {
  const { b, isProvider } = await loadForParticipant(req.params.id, req.user._id);
  if (!isProvider) throw new HttpError(403, 'Only the hired person can complete the job');
  if (b.status !== S.IN_PROGRESS) throw new HttpError(409, 'Job has not started');
  if (b.otpAttempts >= MAX_OTP_ATTEMPTS) throw new HttpError(429, 'Too many wrong OTP attempts');
  if (safeStr(req.body.otp) !== b.endOtp) {
    await Booking.updateOne({ _id: b._id }, { $inc: { otpAttempts: 1 } });
    throw new HttpError(400, 'Incorrect OTP');
  }
  const updated = await Booking.findOneAndUpdate(
    { _id: b._id, status: S.IN_PROGRESS },
    { status: S.COMPLETED, endedAt: new Date() },
    { new: true }
  ).populate('client provider', POPULATE);
  if (!updated) throw new HttpError(409, 'Job is already finished');

  await User.updateOne({ _id: b.provider._id }, { $inc: { completedJobs: 1 } });
  const data = { bookingId: String(b._id) };
  await Promise.all([
    notify(b.client._id, { type: 'booking_completed', title: 'Booking completed', body: `${b.provider.name} finished the work. Please rate your experience.`, data }),
    notify(b.provider._id, { type: 'booking_completed', title: 'Booking completed', body: `Job for ${b.client.name} is complete (${label(b)}).`, data }),
  ]);
  await pushUpdate(b, b.client._id, b.provider._id);
  res.json({ booking: serializeBooking(updated, req.user._id) });
});

router.post('/:id/cancel', async (req, res) => {
  const { b, isClient } = await loadForParticipant(req.params.id, req.user._id);
  if (![S.PENDING_PAYMENT, S.CONFIRMED].includes(b.status)) throw new HttpError(409, 'This booking can no longer be cancelled');
  const updated = await Booking.findOneAndUpdate(
    { _id: b._id, status: { $in: [S.PENDING_PAYMENT, S.CONFIRMED] } },
    { status: S.CANCELLED, cancelledAt: new Date(), cancelledBy: req.user._id, cancelReason: str(req.body.reason, 200) },
    { new: true }
  ).populate('client provider', POPULATE);
  if (!updated) throw new HttpError(409, 'This booking can no longer be cancelled');

  const payment = await Payment.findOne({ booking: b._id, status: 'paid' });
  let refunded = false;
  if (payment) {
    try {
      await refundPayment(payment);
      refunded = true;
    } catch (e) {
      console.error('refund failed', e.message);
    }
  }
  const otherId = isClient ? b.provider._id : b.client._id;
  const who = isClient ? b.client.name : b.provider.name;
  await notify(otherId, {
    type: 'booking_cancelled',
    title: 'Booking cancelled',
    body: `${who} cancelled the booking for ${b.skill.name}.`,
    data: { bookingId: String(b._id) },
  });
  await pushUpdate(b, b.client._id, b.provider._id);
  res.json({ booking: serializeBooking(updated, req.user._id), refunded });
});

router.post('/:id/review', async (req, res) => {
  const { b, isClient } = await loadForParticipant(req.params.id, req.user._id);
  if (!isClient) throw new HttpError(403, 'Only the person who hired can review');
  if (b.status !== S.COMPLETED) throw new HttpError(409, 'You can review after the booking is completed');
  const rating = Math.floor(Number(req.body.rating));
  if (!(rating >= 1 && rating <= 5)) throw new HttpError(400, 'Rating must be 1 to 5');
  if (await Review.exists({ booking: b._id })) throw new HttpError(409, 'Already reviewed');

  const review = await Review.create({
    booking: b._id,
    client: b.client._id,
    provider: b.provider._id,
    skillName: b.skill.name,
    rating,
    comment: str(req.body.comment, 1000),
  });
  await Booking.updateOne({ _id: b._id }, { reviewed: true });
  // Atomic recalculation; 3.5 x 5 acts as the prior for the Bayesian score.
  await User.updateOne({ _id: b.provider._id }, [
    { $set: { ratingSum: { $add: ['$ratingSum', rating] }, ratingCount: { $add: ['$ratingCount', 1] } } },
    {
      $set: {
        ratingAvg: { $round: [{ $divide: ['$ratingSum', '$ratingCount'] }, 2] },
        ratingScore: { $divide: [{ $add: ['$ratingSum', 17.5] }, { $add: ['$ratingCount', 5] }] },
      },
    },
  ]);
  await notify(b.provider._id, {
    type: 'review',
    title: `New ${rating}-star review`,
    body: `${b.client.name}: ${review.comment || 'No comment'}`,
    data: { bookingId: String(b._id) },
  });
  res.status(201).json({ review: { id: String(review._id), rating, comment: review.comment } });
});

export default router;
