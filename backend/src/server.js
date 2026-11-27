import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { config } from './config.js';
import { initRealtime } from './realtime.js';
import { Media } from './models/Media.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import searchRoutes from './routes/search.js';
import postRoutes from './routes/posts.js';
import uploadRoutes from './routes/upload.js';
import bookingRoutes from './routes/bookings.js';
import paymentRoutes, { razorpayWebhook, stripeWebhook } from './routes/payments.js';
import payPages from './routes/payPages.js';
import chatRoutes from './routes/chat.js';
import notificationRoutes from './routes/notifications.js';
import walletRoutes from './routes/wallet.js';
import complaintRoutes from './routes/complaints.js';
import adminRoutes from './routes/admin.js';
import callRoutes from './routes/calls.js';
import { Review } from './models/Review.js';
import { verifyMediaToken } from './services/crypto.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.corsOrigins.includes('*') ? true : config.corsOrigins }));
if (!config.isProd) app.use(morgan('dev'));

// Webhooks need the untouched body for signature checks.
app.post('/api/payments/razorpay/webhook', express.raw({ type: '*/*', limit: '1mb' }), razorpayWebhook);
app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), stripeWebhook);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.get('/media/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
  const m = await Media.findById(req.params.id);
  if (!m || m.private) return res.status(404).end();
  res.set({ 'Content-Type': m.contentType, 'Cache-Control': 'public, max-age=31536000, immutable' });
  res.send(m.data);
});

// KYC images are private: only reachable with a short-lived signed link issued to admins.
app.get('/kyc-doc/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || !verifyMediaToken(req.params.id, req.query.t)) return res.status(404).end();
  const m = await Media.findById(req.params.id);
  if (!m) return res.status(404).end();
  res.set({ 'Content-Type': m.contentType, 'Cache-Control': 'private, no-store' });
  res.send(m.data);
});
app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/calls', callRoutes);
app.use('/pay', payPages);

// Built web app (npm run build:web) is served from the same origin as the API.
const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
if (fs.existsSync(path.join(WEB_DIR, 'index.html'))) {
  app.use(express.static(WEB_DIR, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/|pay\/|media\/|socket\.io\/|health$).*/, (_req, res) => res.sendFile(path.join(WEB_DIR, 'index.html')));
}

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.message;
  if (err.name === 'MulterError') status = 400;
  if (err.name === 'CastError' || err.name === 'ValidationError') status = 400;
  if (status >= 500) {
    console.error(err);
    if (config.isProd) message = 'Something went wrong';
  }
  res.status(status).json({ error: message });
});

const server = http.createServer(app);
initRealtime(server);

mongoose
  .connect(config.mongoUri)
  .then(() => Review.syncIndexes())
  .then(() => {
    server.listen(config.port, () => {
      console.log(`SkillConnect API on :${config.port} (${config.nodeEnv})`);
      console.log(`Public URL: ${config.publicUrl}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
