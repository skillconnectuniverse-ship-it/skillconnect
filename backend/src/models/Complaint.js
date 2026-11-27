import mongoose from 'mongoose';

const { Schema } = mongoose;

export const COMPLAINT_CATEGORIES = ['no_show', 'poor_quality', 'overcharge', 'safety', 'fraud', 'abusive', 'payment_issue', 'other'];

const complaintSchema = new Schema(
  {
    // 'dispute' is tied to a booking and holds the provider's earnings; 'report' is a general complaint about a user.
    type: { type: String, enum: ['dispute', 'report'], required: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking' },
    raisedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    against: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, enum: COMPLAINT_CATEGORIES, required: true },
    description: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open', index: true },
    messages: [
      {
        from: { type: Schema.Types.ObjectId, ref: 'User' },
        isAdmin: Boolean,
        text: { type: String, maxlength: 1000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    resolution: {
      action: { type: String, enum: ['refund_full', 'refund_partial', 'release_provider', 'dismiss'] },
      refundMinor: { type: Number, default: 0 },
      note: String,
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      at: Date,
    },
  },
  { timestamps: true }
);

export const Complaint = mongoose.model('Complaint', complaintSchema);
