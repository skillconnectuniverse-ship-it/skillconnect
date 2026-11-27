import mongoose from 'mongoose';

const { Schema } = mongoose;

// Signed amounts: earnings are positive, payouts and reversals negative.
const ledgerSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['earning', 'payout', 'payout_refund', 'reversal'], required: true },
    currency: { type: String, required: true },
    amountMinor: { type: Number, required: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking' },
    payout: { type: Schema.Types.ObjectId, ref: 'PayoutRequest' },
    availableAt: { type: Date, default: Date.now },
    // True while a complaint is open on the booking.
    held: { type: Boolean, default: false },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

ledgerSchema.index({ booking: 1, kind: 1 }, { unique: true, partialFilterExpression: { kind: 'earning' } });

export const LedgerEntry = mongoose.model('LedgerEntry', ledgerSchema);

export async function balancesFor(userId) {
  const now = new Date();
  const rows = await LedgerEntry.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(userId)) } },
    {
      $group: {
        _id: '$currency',
        availableMinor: { $sum: { $cond: [{ $and: [{ $lte: ['$availableAt', now] }, { $ne: ['$held', true] }] }, '$amountMinor', 0] } },
        pendingMinor: { $sum: { $cond: [{ $or: [{ $gt: ['$availableAt', now] }, { $eq: ['$held', true] }] }, '$amountMinor', 0] } },
      },
    },
  ]);
  return rows.map((r) => ({ currency: r._id, availableMinor: r.availableMinor, pendingMinor: r.pendingMinor }));
}

export async function availableFor(userId, currency) {
  const b = (await balancesFor(userId)).find((x) => x.currency === currency);
  return b ? b.availableMinor : 0;
}
