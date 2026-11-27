import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    // Private files (KYC) are never served from the public /media route.
    private: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Media = mongoose.model('Media', mediaSchema);
