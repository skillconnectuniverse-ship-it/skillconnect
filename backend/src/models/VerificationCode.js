import crypto from 'crypto';
import mongoose from 'mongoose';
import { hashCode } from '../services/crypto.js';

const codeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, enum: ['email', 'phone', 'reset'], required: true },
    target: { type: String, default: '' },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
);
codeSchema.index({ user: 1, purpose: 1 }, { unique: true });

export const VerificationCode = mongoose.model('VerificationCode', codeSchema);

const TTL_MS = 15 * 60 * 1000;
const COOLDOWN_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;

// Creates (or replaces) a 6-digit code; returns null when asked again too quickly.
export async function issueCode(userId, purpose, target = '') {
  const existing = await VerificationCode.findOne({ user: userId, purpose });
  if (existing && Date.now() - existing.updatedAt.getTime() < COOLDOWN_MS) return null;
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await VerificationCode.findOneAndUpdate(
    { user: userId, purpose },
    { codeHash: hashCode(code), target, attempts: 0, expiresAt: new Date(Date.now() + TTL_MS) },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return code;
}

// Returns { target } on success, or null when wrong/expired/locked.
export async function consumeCode(userId, purpose, code) {
  const doc = await VerificationCode.findOne({ user: userId, purpose });
  if (!doc) return null;
  if (doc.attempts >= MAX_ATTEMPTS) {
    await doc.deleteOne();
    return null;
  }
  if (doc.codeHash !== hashCode(String(code || '').trim())) {
    await VerificationCode.updateOne({ _id: doc._id }, { $inc: { attempts: 1 } });
    return null;
  }
  await doc.deleteOne();
  return { target: doc.target };
}
