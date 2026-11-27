import mongoose from 'mongoose';
import { config } from './config.js';
import { User } from './models/User.js';

// Usage: npm run make-admin -- someone@example.com
const email = (process.argv[2] || '').toLowerCase();
if (!email) {
  console.error('Usage: npm run make-admin -- <email>');
  process.exit(1);
}
await mongoose.connect(config.mongoUri);
const r = await User.updateOne({ email }, { role: 'admin', emailVerified: true });
console.log(r.matchedCount ? `${email} is now an admin` : `No user with email ${email}`);
await mongoose.disconnect();
