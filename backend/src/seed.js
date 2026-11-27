import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { config } from './config.js';
import { User } from './models/User.js';

const people = [
  { name: 'Ramesh Kumar', city: 'Delhi', coords: [77.209, 28.6139], skill: 'Driver', category: 'Driver', rates: { hourly: 150, daily: 900, monthly: 18000, yearly: 210000 }, rating: [4.8, 120] },
  { name: 'Suresh Yadav', city: 'Delhi', coords: [77.23, 28.62], skill: 'Driver', category: 'Driver', rates: { hourly: 120, daily: 800, monthly: 16000 }, rating: [4.2, 30] },
  { name: 'Imran Khan', city: 'Mumbai', coords: [72.8777, 19.076], skill: 'Driver', category: 'Driver', rates: { hourly: 200, daily: 1100, monthly: 22000 }, rating: [4.9, 12] },
  { name: 'Anita Sharma', city: 'Bengaluru', coords: [77.5946, 12.9716], skill: 'Software Engineer', category: 'Technology', rates: { hourly: 1500, daily: 10000, monthly: 200000 }, rating: [4.7, 55] },
  { name: 'Mohan Lal', city: 'Delhi', coords: [77.2, 28.65], skill: 'Carpenter', category: 'Home Services', rates: { hourly: 250, daily: 1500, monthly: 30000 }, rating: [4.5, 40] },
  { name: 'Dr. Priya Singh', city: 'Pune', coords: [73.8567, 18.5204], skill: 'Doctor', category: 'Healthcare', rates: { hourly: 1000, daily: 6000 }, rating: [4.95, 210] },
  { name: 'Vikas Painter', city: 'Mumbai', coords: [72.88, 19.08], skill: 'Painter', category: 'Home Services', rates: { hourly: 200, daily: 1200 }, rating: [4.0, 18] },
];

await mongoose.connect(config.mongoUri);
const password = await bcrypt.hash('Password123', 11);

for (const [i, p] of people.entries()) {
  const email = `demo${i + 1}@skillconnect.test`;
  if (await User.exists({ email })) continue;
  const [avg, count] = p.rating;
  await User.create({
    name: p.name,
    email,
    password,
    emailVerified: true,
    phone: `+91900000000${i}`,
    city: p.city,
    country: 'India',
    bio: `Experienced ${p.skill} available for hire.`,
    location: { type: 'Point', coordinates: p.coords },
    skills: [{ name: p.skill, category: p.category, experienceYears: 5, currency: 'INR', rates: p.rates }],
    ratingCount: count,
    ratingSum: avg * count,
    ratingAvg: avg,
    ratingScore: (avg * count + 17.5) / (count + 5),
    completedJobs: count,
  });
}
console.log('Seeded demo providers (password: Password123)');
await mongoose.disconnect();
