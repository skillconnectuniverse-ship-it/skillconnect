import { Router } from 'express';
import { Payment } from '../models/Payment.js';
import { Booking } from '../models/Booking.js';
import { User } from '../models/User.js';
import { config } from '../config.js';
import { escapeHtml, formatMoney, jsonForScript } from '../utils.js';
import { markPaid, razorpay, stripe, verifyRazorpaySignature } from '../services/payments.js';

const router = Router();

const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7fb;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px}
.card{background:#fff;border-radius:16px;padding:28px;max-width:380px;width:100%;box-shadow:0 8px 30px rgba(0,0,0,.08);text-align:center}
h1{font-size:22px;margin:0 0 8px}p{color:#555;margin:6px 0}
button{background:#5b4bff;color:#fff;border:0;border-radius:10px;padding:14px 22px;font-size:16px;margin-top:18px;width:100%}
.ok{color:#16a34a}.bad{color:#dc2626}
</style></head><body><div class="card">${body}</div></body></html>`;

async function findOpenPayment(token, gateway) {
  const payment = await Payment.findOne({ checkoutToken: token, gateway });
  if (!payment) return null;
  return payment;
}

const result = (res, status) => res.redirect(303, `${config.publicUrl}/pay/result?status=${status}`);

router.get('/result', (req, res) => {
  const ok = req.query.status === 'success';
  res.type('html').send(
    page(
      ok ? 'Payment successful' : 'Payment not completed',
      ok
        ? '<h1 class="ok">Payment successful</h1><p>Your booking is confirmed. You can return to SkillConnect.</p>'
        : '<h1 class="bad">Payment not completed</h1><p>No money was taken. Return to SkillConnect and try again.</p>'
    )
  );
});

// ---------- Razorpay: hosted Checkout (UPI QR, cards, netbanking, wallets) ----------
router.get('/razorpay/:token', async (req, res) => {
  const payment = await findOpenPayment(req.params.token, 'razorpay');
  if (!payment || payment.status !== 'created' || !razorpay) return result(res, 'failed');
  const [booking, client] = await Promise.all([Booking.findById(payment.booking), User.findById(payment.client)]);

  const options = {
    key: config.razorpay.keyId,
    amount: payment.amountMinor,
    currency: payment.currency,
    name: 'SkillConnect',
    description: `${booking.skill.name} (${booking.plan})`,
    order_id: payment.razorpayOrderId,
    prefill: { name: client.name, email: client.email, contact: client.phone || '' },
    callback_url: `${config.publicUrl}/pay/razorpay/callback/${payment.checkoutToken}`,
    redirect: true,
    theme: { color: '#5b4bff' },
  };
  const cancelUrl = `${config.publicUrl}/pay/result?status=cancelled`;
  res.type('html').send(
    page(
      'Pay with Razorpay',
      `<h1>Pay ${escapeHtml(formatMoney(payment.amountMinor, payment.currency))}</h1>
<p>Secure payment by Razorpay</p>
<button id="pay">Pay now</button>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
var options = ${jsonForScript(options)};
options.modal = { ondismiss: function () { window.location.href = ${jsonForScript(cancelUrl)}; } };
function open() { new Razorpay(options).open(); }
document.getElementById('pay').onclick = open;
window.onload = open;
</script>`
    )
  );
});

router.post('/razorpay/callback/:token', async (req, res) => {
  const payment = await findOpenPayment(req.params.token, 'razorpay');
  if (!payment) return result(res, 'failed');
  const { razorpay_payment_id: paymentId, razorpay_order_id: orderId, razorpay_signature: signature } = req.body;
  if (orderId !== payment.razorpayOrderId || !verifyRazorpaySignature(orderId, paymentId, signature)) {
    return result(res, 'failed');
  }
  await markPaid(payment._id, paymentId);
  result(res, 'success');
});

// ---------- Stripe: returns here after hosted Checkout; we verify with Stripe ----------
router.get('/stripe/return/:token', async (req, res) => {
  const payment = await findOpenPayment(req.params.token, 'stripe');
  if (!payment || !stripe) return result(res, 'failed');
  const session = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
  if (session.payment_status === 'paid') {
    await markPaid(payment._id, session.payment_intent);
    return result(res, 'success');
  }
  result(res, 'failed');
});

// ---------- Demo gateway (disabled unless ALLOW_DEMO_PAYMENTS=true) ----------
router.get('/demo/:token', async (req, res) => {
  if (!config.allowDemoPayments) return result(res, 'failed');
  const payment = await findOpenPayment(req.params.token, 'demo');
  if (!payment || payment.status !== 'created') return result(res, 'failed');
  res.type('html').send(
    page(
      'Demo payment',
      `<h1>Demo payment</h1><p>${escapeHtml(formatMoney(payment.amountMinor, payment.currency))}</p>
<p>Testing only - no real money is charged.</p>
<form method="post" action="/pay/demo/${escapeHtml(payment.checkoutToken)}/confirm"><button>Pay (demo)</button></form>`
    )
  );
});

router.post('/demo/:token/confirm', async (req, res) => {
  if (!config.allowDemoPayments) return result(res, 'failed');
  const payment = await findOpenPayment(req.params.token, 'demo');
  if (!payment) return result(res, 'failed');
  await markPaid(payment._id, `demo_${Date.now()}`);
  result(res, 'success');
});

export default router;
