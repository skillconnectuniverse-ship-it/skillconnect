import mongoose from 'mongoose';

const { Schema } = mongoose;

const payoutSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true },
    method: { type: String, enum: ['bank', 'upi'], required: true },
    // Snapshot of the destination at request time, encrypted; label is a masked preview.
    destinationEnc: { type: String, required: true },
    destinationLabel: { type: String, required: true },
    status: { type: String, enum: ['requested', 'paid', 'rejected'], default: 'requested', index: true },
    txnRef: { type: String, default: '' },
    adminNote: { type: String, default: '' },
    processedAt: Date,
    processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const PayoutRequest = mongoose.model('PayoutRequest', payoutSchema);
