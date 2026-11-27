# SkillConnect

Instagram-style skill marketplace: people list skills with hourly/daily/monthly/yearly prices, post work photos, set an availability status, and get hired. Runs on **iOS, Android and Web** from one codebase.

```
backend/   Node.js + Express + MongoDB (cloud: MongoDB Atlas), Socket.IO, Razorpay, Stripe, Cloudinary
app/       Expo (React Native + React Native Web) - iOS, Android and website
```

## Features

| Area | What it does |
| --- | --- |
| Profiles | Photo, bio, city, "member since", jobs done, rating + reviews, work photo grid (portfolio posts) |
| Skills | Any skill (Driver, Carpenter, Doctor, Software Engineer...) with hourly/daily/monthly/yearly price and currency |
| Availability | Available (green), Unavailable (red), Do not disturb (dark red), Be right back (amber), Away (yellow), Offline (grey) + a note like "Today 5-9 PM". Only Available/BRB/Away can be hired |
| Search | By skill, name or city (e.g. `driver delhi`), "Near me" (GPS radius), "Available now". Ranked by rating (Bayesian average, so 1 review does not beat 100 reviews), then review count |
| Hire flow | Pick skill -> pick price -> quantity -> work location -> pay |
| Payments | Razorpay (UPI QR, debit/credit cards, netbanking, wallets) for INR, Stripe for international cards. Server verifies every payment (signature + webhook) |
| After payment | Both people get a notification (in-app + push). Hired person gets the client's location with Google Maps navigation and a Call button; client can call too |
| OTP | Client sees a start OTP; hired person enters it on arrival -> timer starts. Finish OTP works the same -> booking completed |
| Reviews | Client rates 1-5 and writes a review after completion |
| Messaging | Realtime 1:1 chat (Socket.IO), phone calls via the phone dialer |
| Cancel | Either side can cancel before work starts; payment is refunded automatically |

Phone numbers are private: they are only returned to the two people in an active (confirmed / in progress) booking.

## Run locally

### 1. Backend

```bash
cd backend
cp .env.example .env        # then edit values
npm install
npm run seed                # optional demo providers (password: Password123)
npm run dev                 # http://localhost:4000
```

Needs a MongoDB connection string in `MONGODB_URI` (create a free cluster on MongoDB Atlas, or run MongoDB locally).

With `ALLOW_DEMO_PAYMENTS=true` (development only) a "Demo payment" button appears so you can test the whole flow without gateway keys.

### 2. App (iOS / Android / Web)

```bash
cd app
npm install
npm run web                 # website
npm run start               # then scan the QR with Expo Go (iOS/Android)
```

The app finds the backend automatically in development (same machine IP, port 4000). For a real phone set `PUBLIC_URL` in `backend/.env` to your computer's LAN IP, e.g. `http://192.168.1.10:4000`, so the payment page opens on the phone.
For production set `EXPO_PUBLIC_API_URL=https://api.yourdomain.com` when building.

## Free cloud deploy (MongoDB Atlas + Render)

One free web service serves the API **and** the website (`backend/public`), so no separate frontend host is needed. Images are stored in MongoDB unless `CLOUDINARY_URL` is set.

1. **Database:** create a free M0 cluster on https://cloud.mongodb.com, add a database user, allow network access `0.0.0.0/0`, copy the connection string (`mongodb+srv://...`).
2. **Code on GitHub:** create an empty repo, then `git remote add origin <url> && git push -u origin main`.
3. **Render:** https://render.com -> New -> Blueprint -> pick the repo (it reads `render.yaml`). Paste your Atlas string into `MONGODB_URI`. `JWT_SECRET` is generated for you; `PUBLIC_URL` is detected automatically.
4. Open the `https://<name>.onrender.com` URL: website + API are live. Optional demo data: `cd backend && MONGODB_URI="<atlas string>" npm run seed`.
5. After changing the app, run `scripts/build-web.sh`, commit `backend/public` and push; Render redeploys.

Free tier notes: Render's free service sleeps after ~15 min idle (first request takes ~30-60 s), and Atlas M0 has 512 MB storage.

## Going live worldwide

1. **Database (cloud):** MongoDB Atlas -> set `MONGODB_URI`.
2. **Images (cloud):** stored in MongoDB by default; set `CLOUDINARY_URL` (Cloudinary) for larger scale.
3. **Backend hosting:** any Node host (Render, Railway, Fly.io, AWS...) with HTTPS. Set `NODE_ENV=production`, a long random `JWT_SECRET`, `PUBLIC_URL` (the HTTPS URL of the API), `CORS_ORIGINS` (your website origin) and `ALLOW_DEMO_PAYMENTS=false`.
4. **Razorpay:** set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`. Add webhook `https://<api>/api/payments/razorpay/webhook` (events `payment.captured`, `order.paid`) and put its secret in `RAZORPAY_WEBHOOK_SECRET`.
5. **Stripe:** set `STRIPE_SECRET_KEY`. Add webhook `https://<api>/api/payments/stripe/webhook` (event `checkout.session.completed`) and set `STRIPE_WEBHOOK_SECRET`.
6. **Website:** `scripts/build-web.sh` (served by the backend), or host `app/dist` separately on Netlify/Vercel/Cloudflare Pages and set `EXPO_PUBLIC_API_URL`.
7. **iOS / Android apps:** use EAS Build (`npx eas build -p android` / `-p ios`) with `EXPO_PUBLIC_API_URL=https://<api>` and submit to Play Store / App Store. Set the bundle id / package in `app/app.json`. Push notifications need an EAS project id.

## Notes and next steps

- Platform fee is `PLATFORM_FEE_PERCENT` (default 10%) and is recorded on every booking (`platformFeeMinor`, `providerEarningMinor`). Paying providers out (Razorpay Route / Stripe Connect) and KYC are not implemented yet.
- Calls use the phone dialer. In-app/masked calling (Twilio, Agora) can replace the `Call` button later.
- Web "address to map" fallback uses OpenStreetMap Nominatim (fair-use); use Google Geocoding for production traffic.
- Razorpay is offered for INR only; other currencies go through Stripe.
