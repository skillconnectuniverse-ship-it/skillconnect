import { Router } from 'express';
import mongoose from 'mongoose';
import { Post } from '../models/Post.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, str } from '../utils.js';

const router = Router();
router.use(requireAuth);

const shape = (p, me) => ({
  id: String(p._id),
  images: p.images,
  caption: p.caption,
  skillTag: p.skillTag,
  likeCount: p.likeCount,
  liked: p.likes.some((l) => String(l) === String(me)),
  createdAt: p.createdAt,
  author: p.author?._id
    ? { id: String(p.author._id), name: p.author.name, avatar: p.author.avatar, city: p.author.city, status: p.author.status }
    : { id: String(p.author) },
});

// Feed or a single person's portfolio (?author=). Cursor pagination on createdAt.
router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.author) {
    if (!mongoose.isValidObjectId(req.query.author)) throw new HttpError(400, 'Invalid author');
    filter.author = req.query.author;
  }
  if (req.query.cursor) {
    const d = new Date(String(req.query.cursor));
    if (!Number.isNaN(d.getTime())) filter.createdAt = { $lt: d };
  }
  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 12));
  const posts = await Post.find(filter).sort({ createdAt: -1 }).limit(limit).populate('author', 'name avatar city status');
  res.json({
    posts: posts.map((p) => shape(p, req.user._id)),
    nextCursor: posts.length === limit ? posts[posts.length - 1].createdAt : null,
  });
});

router.post('/', async (req, res) => {
  const images = Array.isArray(req.body.images) ? req.body.images.map((i) => str(i, 500)).filter(Boolean).slice(0, 6) : [];
  if (!images.length) throw new HttpError(400, 'Add at least one photo');
  const post = await Post.create({
    author: req.user._id,
    images,
    caption: str(req.body.caption, 1000),
    skillTag: str(req.body.skillTag, 60),
  });
  await post.populate('author', 'name avatar city status');
  res.status(201).json({ post: shape(post, req.user._id) });
});

router.post('/:id/like', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Post not found');
  const me = req.user._id;
  let post = await Post.findOneAndUpdate({ _id: req.params.id, likes: { $ne: me } }, { $addToSet: { likes: me }, $inc: { likeCount: 1 } }, { new: true });
  if (!post) {
    post = await Post.findOneAndUpdate({ _id: req.params.id, likes: me }, { $pull: { likes: me }, $inc: { likeCount: -1 } }, { new: true });
  }
  if (!post) throw new HttpError(404, 'Post not found');
  res.json({ liked: post.likes.some((l) => String(l) === String(me)), likeCount: post.likeCount });
});

router.delete('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Post not found');
  const r = await Post.deleteOne({ _id: req.params.id, author: req.user._id });
  if (!r.deletedCount) throw new HttpError(404, 'Post not found');
  res.json({ ok: true });
});

export default router;
