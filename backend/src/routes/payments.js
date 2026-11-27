import crypto from 'crypto';
import { Router } from 'express';
import mongoose from 'mongoose';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { requireAuth } from '../middleware/auth.js';
import { BOOKING_STATUS } from '../constants.js';
import { HttpError } from '../utils.js';
import { availableGateways, createCheckout, markPaid, razorpay, stripe } from '../services/payments.js';
import { config } from '../config.js';

const router = Router();

async function ownPendingBooking(bookingId, user) {
  if (!mongoose.isValidObjectId(bookingId)) throw new HttpError(404, 'Booking not found');
  const booking = await Booking.findOne({ _id: bookingId, client: user._id });
  if (!booking) throw new HttpError(404, 'Booking not found');
  if (booking.status !== BOOKING_STATUS.PENDING_PAYMENT) throw new HttpError(409, 'Booking is already paid or closed');
  return booking;
}

router.get('/gateways', requireAuth, async (req, res) => {
  const booking = await ownPendingBooking(req.query.bookingId, req.user);
  res.json({ gateways: availableGateways(booking.currency) });
});

router.post('/checkout', requireAuth, async (req, res) => {
  const booking = await ownPendingBooking(req.body.bookingId, req.user);
  const { payment, url } = await createCheckout({ booking, user: req.user, gateway: String(req.body.gateway) });
  res.status(201).json({ paymentId: String(payment._id), url });
});

// Mobile/web apps poll this while the hosted payment page is open.
router.get('/:id/status', requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Payment not found');
  const payment = await Payment.findOne({ _id: req.params.id, client: req.user._id });
  if (!payment) throw new HttpError(404, 'Payment not found');
  res.json({ status: payment.status });
});

export default router;

// ---- Webhooks (mounted with raw body parsing in server.js) ----

export async function razorpayWebhook(req, res) {
  const secret = config.razorpay.webhookSecret;
  if (!razorpay || !secret) return res.status(503).end();
  const signature = req.headers['x-razorpay-signature'];
  const raw = req.body; // Buffer
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  if (typeof signature !== 'string' || expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return res.status(400).json({ error: 'Invalid signature' });
  }
  const event = JSON.parse(raw.toString('utf8'));
  const entity = event.payload?.payment?.entity;
  if ((event.event === 'payment.captured' || event.event === 'order.paid') && entity?.order_id) {
    const payment = await Payment.findOne({ razorpayOrderId: entity.order_id });
    if (payment) await markPaid(payment._id, entity.id);
  }
  res.json({ received: true });
}

export async function stripeWebhook(req, res) {
  if (!stripe || !config.stripe.webhookSecret) return res.status(503).end();
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.stripe.webhookSecret);
  } catch {
    return res.status(400).json({ error: 'Invalid signature' });
  }
  if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
    const session = event.data.object;
    const payment = await Payment.findOne({ stripeSessionId: session.id });
    if (payment) await markPaid(payment._id, session.payment_intent);
  }
  res.json({ received: true });
}
