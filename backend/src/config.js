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

// ICE_SERVERS is a JSON array; add a TURN server there for calls behind strict NATs.
function parseIce(raw) {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    console.warn('ICE_SERVERS is not valid JSON, using default STUN');
  }
  return [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
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
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT) || 587,
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || env.SMTP_USER || 'SkillConnect <no-reply@skillconnect.local>',
  },
  emailEnabled: !!env.SMTP_HOST,
  twilio: { sid: env.TWILIO_ACCOUNT_SID || '', token: env.TWILIO_AUTH_TOKEN || '', from: env.TWILIO_FROM || '' },
  smsEnabled: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM),
  // Unverified emails can browse but cannot hire; defaults to on once SMTP is configured.
  requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION ? env.REQUIRE_EMAIL_VERIFICATION === 'true' : !!env.SMTP_HOST,
  payoutHoldHours: Number(env.PAYOUT_HOLD_HOURS ?? 24),
  minPayoutMinor: Number(env.MIN_PAYOUT_MINOR ?? 10000),
  encryptionKey: env.ENCRYPTION_KEY || env.JWT_SECRET || 'dev-only-secret-change-me',
  iceServers: parseIce(env.ICE_SERVERS),
};
