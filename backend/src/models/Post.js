import mongoose from 'mongoose';

const { Schema } = mongoose;

const postSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    images: { type: [String], default: [] },
    caption: { type: String, default: '', maxlength: 1000 },
    skillTag: { type: String, default: '', maxlength: 60 },
    likes: { type: [Schema.Types.ObjectId], default: [] },
    likeCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });

export const Post = mongoose.model('Post', postSchema);
