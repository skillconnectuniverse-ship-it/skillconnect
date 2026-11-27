import mongoose from 'mongoose';
import { STATUSES } from '../constants.js';

const { Schema } = mongoose;

export const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined },
  },
  { _id: false }
);

const skillSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  category: { type: String, trim: true, default: 'Other', maxlength: 40 },
  description: { type: String, default: '', maxlength: 500 },
  experienceYears: { type: Number, min: 0, max: 70, default: 0 },
  currency: { type: String, default: 'INR', uppercase: true },
  rates: {
    hourly: { type: Number, min: 0 },
    daily: { type: Number, min: 0 },
    monthly: { type: Number, min: 0 },
    yearly: { type: Number, min: 0 },
  },
});

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    password: { type: String, required: true, select: false },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 500 },
    city: { type: String, default: '', trim: true, maxlength: 80, index: true },
    country: { type: String, default: '', trim: true, maxlength: 80 },
    location: { type: pointSchema, default: undefined },
    skills: { type: [skillSchema], default: [] },
    status: { type: String, enum: STATUSES, default: 'available' },
    statusNote: { type: String, default: '', maxlength: 120 },
    ratingSum: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    ratingAvg: { type: Number, default: 0 },
    // Bayesian average so one 5-star review does not outrank hundreds of 4.9s.
    ratingScore: { type: Number, default: 3.5, index: true },
    completedJobs: { type: Number, default: 0 },
    clientRatingSum: { type: Number, default: 0 },
    clientRatingCount: { type: Number, default: 0 },
    clientRatingAvg: { type: Number, default: 0 },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    kyc: {
      status: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
      legalName: { type: String, default: '' },
      idType: { type: String, default: '' },
      idLast4: { type: String, default: '' },
      idNumberEnc: { type: String, default: '' },
      frontMedia: { type: Schema.Types.ObjectId, ref: 'Media' },
      selfieMedia: { type: Schema.Types.ObjectId, ref: 'Media' },
      submittedAt: Date,
      reviewedAt: Date,
      rejectReason: { type: String, default: '' },
    },
    payoutMethod: {
      kind: { type: String, enum: ['bank', 'upi'] },
      holderName: { type: String, default: '' },
      label: { type: String, default: '' },
      enc: { type: String, default: '' },
    },
    pushToken: { type: String, default: '', select: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.index({ location: '2dsphere' });
userSchema.index({ 'skills.name': 1 });

export function publicUser(u) {
  if (!u) return null;
  const o = u.toObject ? u.toObject() : u;
  return {
    id: String(o._id),
    name: o.name,
    avatar: o.avatar,
    bio: o.bio,
    city: o.city,
    country: o.country,
    skills: o.skills,
    status: o.status,
    statusNote: o.statusNote,
    ratingAvg: o.ratingAvg,
    ratingCount: o.ratingCount,
    ratingScore: o.ratingScore,
    completedJobs: o.completedJobs,
    clientRatingAvg: o.clientRatingAvg,
    clientRatingCount: o.clientRatingCount,
    emailVerified: o.emailVerified,
    phoneVerified: o.phoneVerified,
    kycVerified: o.kyc?.status === 'verified',
    createdAt: o.createdAt,
    coords: o.location?.coordinates ? { lng: o.location.coordinates[0], lat: o.location.coordinates[1] } : null,
  };
}

export function privateUser(u) {
  const o = u.toObject ? u.toObject() : u;
  return {
    ...publicUser(o),
    email: o.email,
    phone: o.phone,
    role: o.role,
    kyc: { status: o.kyc?.status || 'none', legalName: o.kyc?.legalName || '', rejectReason: o.kyc?.rejectReason || '' },
    payoutMethod: o.payoutMethod?.kind ? { kind: o.payoutMethod.kind, holderName: o.payoutMethod.holderName, label: o.payoutMethod.label } : null,
  };
}

export const User = mongoose.model('User', userSchema);
