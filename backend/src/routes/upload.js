import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { saveImage } from '../services/storage.js';
import { HttpError } from '../utils.js';

const router = Router();
router.use(requireAuth);

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => cb(ALLOWED.includes(file.mimetype) ? null : new HttpError(400, 'Only image files are allowed'), ALLOWED.includes(file.mimetype)),
});

router.post('/', upload.array('files', 6), async (req, res) => {
  if (!req.files?.length) throw new HttpError(400, 'No files uploaded');
  const urls = await Promise.all(req.files.map((f) => saveImage(f, req.user._id)));
  res.status(201).json({ urls });
});

export default router;
