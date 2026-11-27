import mongoose from 'mongoose';
import { pointSchema } from './User.js';
import { PLANS, BOOKING_STATUS } from '../constants.js';

const { Schema } = mongoose;

const bookingSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skill: {
      skillId: Schema.Types.ObjectId,
      name: String,
      category: String,
    },
    plan: { type: String, enum: PLANS, required: true },
    quantity: { type: Number, min: 1, max: 1000, default: 1 },
    currency: { type: String, required: true },
    unitPriceMinor: { type: Number, required: true },
    amountMinor: { type: Number, required: true },
    platformFeeMinor: { type: Number, default: 0 },
    providerEarningMinor: { type: Number, default: 0 },
    scheduledFor: { type: Date, default: Date.now },
    notes: { type: String, default: '', maxlength: 500 },
    location: { type: pointSchema, default: undefined },
    address: { type: String, default: '', maxlength: 300 },
    status: { type: String, enum: Object.values(BOOKING_STATUS), default: BOOKING_STATUS.PENDING_PAYMENT, index: true },
    startOtp: { type: String, default: '' },
    endOtp: { type: String, default: '' },
    otpAttempts: { type: Number, default: 0 },
    startedAt: Date,
    endedAt: Date,
    cancelledAt: Date,
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelReason: { type: String, default: '' },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment' },
    reviewed: { type: Boolean, default: false },
    clientReviewed: { type: Boolean, default: false },
    disputeOpen: { type: Boolean, default: false },
    providerLocation: { type: pointSchema, default: undefined },
    providerLocationAt: Date,
  },
  { timestamps: true }
);

export const Booking = mongoose.model('Booking', bookingSchema);

const CONTACT_VISIBLE = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.IN_PROGRESS];

// Shapes a booking for one viewer: only the client sees OTPs, phones are visible only while a job is active.
export function serializeBooking(b, viewerId) {
  const o = b.toObject ? b.toObject() : b;
  const id = String(viewerId);
  const clientId = String(o.client?._id || o.client);
  const isClient = clientId === id;
  const showPhone = CONTACT_VISIBLE.includes(o.status);

  const shapeUser = (u, withPhone) => {
    if (!u || !u._id) return u ? { id: String(u) } : null;
    return {
      id: String(u._id),
      name: u.name,
      avatar: u.avatar,
      city: u.city,
      ratingAvg: u.ratingAvg,
      ratingCount: u.ratingCount,
      clientRatingAvg: u.clientRatingAvg,
      clientRatingCount: u.clientRatingCount,
      phone: withPhone ? u.phone : undefined,
    };
  };

  const out = {
    id: String(o._id),
    role: isClient ? 'client' : 'provider',
    client: shapeUser(o.client, showPhone && !isClient),
    provider: shapeUser(o.provider, showPhone && isClient),
    skill: o.skill,
    plan: o.plan,
    quantity: o.quantity,
    currency: o.currency,
    unitPriceMinor: o.unitPriceMinor,
    amountMinor: o.amountMinor,
    platformFeeMinor: o.platformFeeMinor,
    providerEarningMinor: o.providerEarningMinor,
    scheduledFor: o.scheduledFor,
    notes: o.notes,
    address: o.address,
    coords: o.location?.coordinates ? { lng: o.location.coordinates[0], lat: o.location.coordinates[1] } : null,
    status: o.status,
    startedAt: o.startedAt,
    endedAt: o.endedAt,
    cancelledAt: o.cancelledAt,
    cancelReason: o.cancelReason,
    reviewed: o.reviewed,
    clientReviewed: o.clientReviewed,
    disputeOpen: o.disputeOpen,
    createdAt: o.createdAt,
  };
  // Live position is only shared with the person who hired, and only while the job is active.
  if (isClient && showPhone && o.providerLocation?.coordinates) {
    out.providerLocation = {
      lat: o.providerLocation.coordinates[1],
      lng: o.providerLocation.coordinates[0],
      updatedAt: o.providerLocationAt,
    };
  }
  if (isClient) {
    if (o.status === BOOKING_STATUS.CONFIRMED) out.startOtp = o.startOtp;
    if (o.status === BOOKING_STATUS.IN_PROGRESS) out.endOtp = o.endOtp;
  }
  return out;
}
