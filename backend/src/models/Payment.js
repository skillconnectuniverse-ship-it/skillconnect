import mongoose from 'mongoose';

const { Schema } = mongoose;

const paymentSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    gateway: { type: String, enum: ['razorpay', 'stripe', 'demo'], required: true },
    status: { type: String, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created', index: true },
    amountMinor: { type: Number, required: true },
    currency: { type: String, required: true },
    checkoutToken: { type: String, required: true, unique: true },
    razorpayOrderId: { type: String, index: true, sparse: true },
    stripeSessionId: { type: String, index: true, sparse: true },
    gatewayPaymentId: String,
    paidAt: Date,
    refundId: String,
  },
  { timestamps: true }
);

export const Payment = mongoose.model('Payment', paymentSchema);
