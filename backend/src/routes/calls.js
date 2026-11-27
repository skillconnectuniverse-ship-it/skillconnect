import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';

const router = Router();
router.use(requireAuth);

router.get('/ice', (_req, res) => res.json({ iceServers: config.iceServers }));

export default router;
