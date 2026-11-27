import crypto from 'crypto';
import Razorpay from 'razorpay';
import Stripe from 'stripe';
import { config } from '../config.js';
import { Payment } from '../models/Payment.js';
import { Booking } from '../models/Booking.js';
import { BOOKING_STATUS, PLAN_UNIT } from '../constants.js';
import { HttpError, genOtp, genToken, formatMoney } from '../utils.js';
import { notify } from './notify.js';
import { emitToUser } from '../realtime.js';

export const razorpay = config.razorpay.keyId && config.razorpay.keySecret
  ? new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret })
  : null;

export const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;

export function availableGateways(currency) {
  const list = [];
  if (razorpay && currency === 'INR') list.push({ id: 'razorpay', label: 'UPI QR, Debit/Credit Card, Netbanking (Razorpay)' });
  if (stripe) list.push({ id: 'stripe', label: 'International Debit/Credit Card (Stripe)' });
  if (config.allowDemoPayments) list.push({ id: 'demo', label: 'Demo payment (testing only)' });
  return list;
}

const unitLabel = (b) => `${b.quantity} ${PLAN_UNIT[b.plan]}${b.quantity > 1 ? 's' : ''}`;

export async function createCheckout({ booking, user, gateway }) {
  if (!availableGateways(booking.currency).some((g) => g.id === gateway)) {
    throw new HttpError(400, `Gateway "${gateway}" is not available for ${booking.currency}`);
  }
  const token = genToken();
  const base = {
    booking: booking._id,
    client: user._id,
    gateway,
    amountMinor: booking.amountMinor,
    currency: booking.currency,
    checkoutToken: token,
  };

  if (gateway === 'razorpay') {
    const order = await razorpay.orders.create({
      amount: booking.amountMinor,
      currency: booking.currency,
      receipt: `bk_${String(booking._id).slice(-16)}`,
      notes: { bookingId: String(booking._id) },
    });
    const payment = await Payment.create({ ...base, razorpayOrderId: order.id });
    return { payment, url: `${config.publicUrl}/pay/razorpay/${token}` };
  }

  if (gateway === 'stripe') {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: booking.currency.toLowerCase(),
            unit_amount: booking.amountMinor,
            product_data: { name: `${booking.skill.name} - ${unitLabel(booking)}` },
          },
        },
      ],
      metadata: { bookingId: String(booking._id) },
      success_url: `${config.publicUrl}/pay/stripe/return/${token}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.publicUrl}/pay/result?status=cancelled`,
    });
    const payment = await Payment.create({ ...base, stripeSessionId: session.id });
    return { payment, url: session.url };
  }

  const payment = await Payment.create(base);
  return { payment, url: `${config.publicUrl}/pay/demo/${token}` };
}

// Idempotent: confirms the booking and informs both people the first time a payment is marked paid.
export async function markPaid(paymentId, gatewayPaymentId) {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: 'created' },
    { status: 'paid', gatewayPaymentId, paidAt: new Date() },
    { new: true }
  );
  if (!payment) return false;

  const booking = await Booking.findOneAndUpdate(
    { _id: payment.booking, status: BOOKING_STATUS.PENDING_PAYMENT },
    { status: BOOKING_STATUS.CONFIRMED, startOtp: genOtp(), payment: payment._id },
    { new: true }
  ).populate('client provider', 'name');

  if (!booking) {
    // Booking was already paid/cancelled through another attempt: give the money back.
    await refundPayment(payment).catch((e) => console.error('auto refund failed', e.message));
    return false;
  }

  const amount = formatMoney(booking.amountMinor, booking.currency);
  const what = `${booking.skill.name} for ${unitLabel(booking)}`;
  const data = { bookingId: String(booking._id) };
  await Promise.all([
    notify(booking.provider._id, {
      type: 'booking_confirmed',
      title: 'You have been hired!',
      body: `${booking.client.name} hired you as ${what} (${amount}). Open the booking for location and contact.`,
      data,
    }),
    notify(booking.client._id, {
      type: 'booking_confirmed',
      title: 'Payment successful - booking confirmed',
      body: `${booking.provider.name} is hired as ${what} (${amount}). Share your OTP when they arrive.`,
      data,
    }),
  ]);
  emitToUser(booking.client._id, 'booking:update', data);
  emitToUser(booking.provider._id, 'booking:update', data);
  return true;
}

// Refunds the remaining amount by default; pass amountMinor for a partial refund.
export async function refundPayment(payment, amountMinor) {
  if (payment.status !== 'paid') return null;
  const remaining = payment.amountMinor - (payment.refundedMinor || 0);
  const amount = Math.min(amountMinor ?? remaining, remaining);
  if (amount <= 0) return null;
  let refundId = `demo_${Date.now()}`;
  if (payment.gateway === 'razorpay') {
    const r = await razorpay.payments.refund(payment.gatewayPaymentId, { amount, speed: 'normal' });
    refundId = r.id;
  } else if (payment.gateway === 'stripe') {
    const r = await stripe.refunds.create({ payment_intent: payment.gatewayPaymentId, amount });
    refundId = r.id;
  }
  payment.refundedMinor = (payment.refundedMinor || 0) + amount;
  if (payment.refundedMinor >= payment.amountMinor) payment.status = 'refunded';
  payment.refundId = refundId;
  await payment.save();
  return refundId;
}

export function verifyRazorpaySignature(orderId, paymentId, signature) {
  const expected = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return safeEqual(expected, String(signature || ''));
}

export function safeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
