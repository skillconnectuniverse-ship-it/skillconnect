import 'dotenv/config';

const env = process.env;
const port = Number(env.PORT) || 4000;
const nodeEnv = env.NODE_ENV || 'development';

if (nodeEnv === 'production' && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET (>= 32 chars) is required in production');
}
if (nodeEnv === 'production' && env.ALLOW_DEMO_PAYMENTS === 'true') {
  throw new Error('ALLOW_DEMO_PAYMENTS must not be enabled in production');
}

export const config = {
  port,
  nodeEnv,
  isProd: nodeEnv === 'production',
  mongoUri: env.MONGODB_URI || 'mongodb://127.0.0.1:27017/skillconnect',
  jwtSecret: env.JWT_SECRET || 'dev-only-secret-change-me',
  publicUrl: (env.PUBLIC_URL || env.RENDER_EXTERNAL_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  corsOrigins: (env.CORS_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean),
  platformFeePercent: Number(env.PLATFORM_FEE_PERCENT ?? 10),
  razorpay: {
    keyId: env.RAZORPAY_KEY_ID || '',
    keySecret: env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY || '',
    webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
  },
  cloudinaryEnabled: !!env.CLOUDINARY_URL,
  allowDemoPayments: env.ALLOW_DEMO_PAYMENTS === 'true',
};
