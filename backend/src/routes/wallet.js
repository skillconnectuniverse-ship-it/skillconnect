import { Router } from 'express';
import multer from 'multer';
import { User } from '../models/User.js';
import { LedgerEntry, balancesFor, availableFor } from '../models/Ledger.js';
import { PayoutRequest } from '../models/PayoutRequest.js';
import { requireAuth } from '../middleware/auth.js';
import { saveImage } from '../services/storage.js';
import { encrypt, maskTail } from '../services/crypto.js';
import { notify } from '../services/notify.js';
import { config } from '../config.js';
import { HttpError, str } from '../utils.js';

const router = Router();
router.use(requireAuth);

const ID_TYPES = ['aadhaar', 'pan', 'passport', 'driving_license', 'voter_id', 'other'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, cb) => cb(IMAGE_TYPES.includes(file.mimetype) ? null : new HttpError(400, 'Only image files are allowed'), IMAGE_TYPES.includes(file.mimetype)),
});

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

const shapePayout = (p) => ({
  id: String(p._id),
  amountMinor: p.amountMinor,
  currency: p.currency,
  method: p.method,
  destinationLabel: p.destinationLabel,
  status: p.status,
  txnRef: p.txnRef,
  adminNote: p.adminNote,
  createdAt: p.createdAt,
  processedAt: p.processedAt,
});

router.get('/', async (req, res) => {
  const [balances, entries, payouts] = await Promise.all([
    balancesFor(req.user._id),
    LedgerEntry.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50),
    PayoutRequest.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30),
  ]);
  const k = req.user.kyc || {};
  res.json({
    balances,
    minPayoutMinor: config.minPayoutMinor,
    holdHours: config.payoutHoldHours,
    kyc: { status: k.status || 'none', legalName: k.legalName || '', idType: k.idType || '', idLast4: k.idLast4 || '', rejectReason: k.rejectReason || '' },
    payoutMethod: req.user.payoutMethod?.kind ? { kind: req.user.payoutMethod.kind, holderName: req.user.payoutMethod.holderName, label: req.user.payoutMethod.label } : null,
    entries: entries.map((e) => ({
      id: String(e._id),
      kind: e.kind,
      amountMinor: e.amountMinor,
      currency: e.currency,
      note: e.note,
      availableAt: e.availableAt,
      held: e.held,
      createdAt: e.createdAt,
      bookingId: e.booking ? String(e.booking) : undefined,
    })),
    payouts: payouts.map(shapePayout),
  });
});

router.post('/kyc', upload.fields([{ name: 'front', maxCount: 1 }, { name: 'selfie', maxCount: 1 }]), async (req, res) => {
  const k = req.user.kyc || {};
  if (k.status === 'pending') throw new HttpError(409, 'Your KYC is already under review');
  if (k.status === 'verified') throw new HttpError(409, 'Your KYC is already verified');
  const legalName = str(req.body.legalName, 80);
  const idType = str(req.body.idType, 30);
  const idNumber = str(req.body.idNumber, 30).replace(/\s/g, '');
  if (legalName.length < 2) throw new HttpError(400, 'Enter your full legal name');
  if (!ID_TYPES.includes(idType)) throw new HttpError(400, 'Choose an ID type');
  if (!/^[A-Za-z0-9-]{4,30}$/.test(idNumber)) throw new HttpError(400, 'Enter a valid ID number');
  const front = req.files?.front?.[0];
  if (!front) throw new HttpError(400, 'Upload a photo of your ID');
  const selfie = req.files?.selfie?.[0];

  const frontId = await saveImage(front, req.user._id, { isPrivate: true });
  const selfieId = selfie ? await saveImage(selfie, req.user._id, { isPrivate: true }) : undefined;
  req.user.kyc = {
    status: 'pending',
    legalName,
    idType,
    idLast4: idNumber.slice(-4),
    idNumberEnc: encrypt(idNumber),
    frontMedia: frontId,
    selfieMedia: selfieId,
    submittedAt: new Date(),
    rejectReason: '',
  };
  await req.user.save();
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  await Promise.all(admins.map((a) => notify(a._id, { type: 'admin_kyc', title: 'New KYC to review', body: legalName, store: true })));
  res.status(201).json({ kyc: { status: 'pending', legalName } });
});

router.put('/payout-method', async (req, res) => {
  const kind = req.body.kind;
  const holderName = str(req.body.holderName, 80);
  if (holderName.length < 2) throw new HttpError(400, 'Enter the account holder name');
  let details;
  let label;
  if (kind === 'bank') {
    const accountNumber = str(req.body.accountNumber, 20).replace(/\s/g, '');
    const ifsc = str(req.body.ifsc, 11).toUpperCase();
    if (!/^[0-9]{9,18}$/.test(accountNumber)) throw new HttpError(400, 'Enter a valid account number');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new HttpError(400, 'Enter a valid IFSC code');
    details = { kind, accountNumber, ifsc };
    label = `Bank ${maskTail(accountNumber)} (${ifsc})`;
  } else if (kind === 'upi') {
    const upiId = str(req.body.upiId, 60);
    if (!/^[\w.-]{2,}@[A-Za-z]{2,}$/.test(upiId)) throw new HttpError(400, 'Enter a valid UPI ID');
    details = { kind, upiId };
    const [name, handle] = upiId.split('@');
    label = `UPI ${name.slice(0, 2)}***@${handle}`;
  } else {
    throw new HttpError(400, 'Choose bank or UPI');
  }
  req.user.payoutMethod = { kind, holderName, label, enc: encrypt(JSON.stringify(details)) };
  await req.user.save();
  res.json({ payoutMethod: { kind, holderName, label } });
});

router.post('/payouts', async (req, res) => {
  const u = req.user;
  if (u.kyc?.status !== 'verified') throw new HttpError(403, 'Complete KYC verification before withdrawing');
  if (!u.payoutMethod?.kind) throw new HttpError(400, 'Add a bank account or UPI ID first');
  if (norm(u.payoutMethod.holderName) !== norm(u.kyc.legalName)) {
    throw new HttpError(400, 'Account holder name must match the name on your KYC');
  }
  const currency = str(req.body.currency, 3).toUpperCase();
  const amountMinor = Math.round(Number(req.body.amountMinor));
  if (!currency || !Number.isFinite(amountMinor) || amountMinor <= 0) throw new HttpError(400, 'Enter a valid amount');
  if (amountMinor < config.minPayoutMinor) throw new HttpError(400, `Minimum withdrawal is ${config.minPayoutMinor / 100} ${currency}`);
  if (await PayoutRequest.exists({ user: u._id, status: 'requested' })) throw new HttpError(409, 'You already have a withdrawal being processed');
  if (amountMinor > (await availableFor(u._id, currency))) throw new HttpError(400, 'Amount is more than your available balance');

  const payout = await PayoutRequest.create({
    user: u._id,
    amountMinor,
    currency,
    method: u.payoutMethod.kind,
    destinationEnc: u.payoutMethod.enc,
    destinationLabel: u.payoutMethod.label,
  });
  const entry = await LedgerEntry.create({ user: u._id, kind: 'payout', currency, amountMinor: -amountMinor, payout: payout._id, note: `Withdrawal to ${payout.destinationLabel}` });
  // Re-check after reserving so two simultaneous requests cannot overspend.
  if ((await availableFor(u._id, currency)) < 0) {
    await Promise.all([entry.deleteOne(), payout.deleteOne()]);
    throw new HttpError(409, 'Balance changed, please try again');
  }
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  await Promise.all(admins.map((a) => notify(a._id, { type: 'admin_payout', title: 'New payout request', body: `${u.name}: ${amountMinor / 100} ${currency}` })));
  res.status(201).json({ payout: shapePayout(payout) });
});

export default router;
