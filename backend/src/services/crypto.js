import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const key = crypto.createHash('sha256').update(config.encryptionKey).digest();

// AES-256-GCM for bank/ID details at rest. Format: iv:tag:data (base64).
export function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join(':');
}

export function decrypt(payload) {
  const [iv, tag, data] = String(payload).split(':').map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export const hashCode = (code) => crypto.createHmac('sha256', config.jwtSecret).update(String(code)).digest('hex');

// Short-lived link for admins to view a private KYC image.
export const signMediaUrl = (mediaId) => {
  const t = jwt.sign({ mid: String(mediaId) }, config.jwtSecret, { expiresIn: '15m' });
  return `${config.publicUrl}/kyc-doc/${mediaId}?t=${t}`;
};

export function verifyMediaToken(mediaId, token) {
  try {
    return jwt.verify(String(token), config.jwtSecret).mid === String(mediaId);
  } catch {
    return false;
  }
}

export const maskTail = (s, n = 4) => {
  const v = String(s);
  return v.length <= n ? v : `${'*'.repeat(Math.max(0, v.length - n))}${v.slice(-n)}`;
};
