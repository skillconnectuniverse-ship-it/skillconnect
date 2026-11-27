import mongoose from 'mongoose';

const { Schema } = mongoose;

const reviewSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    // client_to_provider: the hirer rates the hired person; provider_to_client: the reverse.
    direction: { type: String, enum: ['client_to_provider', 'provider_to_client'], default: 'client_to_provider' },
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skillName: { type: String, default: '' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', maxlength: 1000 },
  },
  { timestamps: true }
);

reviewSchema.index({ booking: 1, direction: 1 }, { unique: true });

export const Review = mongoose.model('Review', reviewSchema);
