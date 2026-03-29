/* ============================================
   PayFlow — server.js
   Express backend for Razorpay order creation
   and webhook relay to n8n.
   ============================================ */

const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// ─── RAZORPAY CONFIG ─────────────────────────
const RAZORPAY_KEY_ID = 'rzp_test_SUkHB2wTXHNDph';
const RAZORPAY_KEY_SECRET = 'qZXAuTIXjIHJptti70WtnC97';

// Razorpay Webhook Secret (from Razorpay Dashboard → Settings → Webhooks)
// You get this when you set up a webhook endpoint in Razorpay
const RAZORPAY_WEBHOOK_SECRET = 'jp_payment_system_123';  // ← Set this after step below

// n8n Webhook URL — your n8n "Razorpay Webhook Processor" workflow URL
// If n8n is running locally: http://localhost:5678/webhook/razorpay-webhook
// If n8n cloud: https://your-instance.app.n8n.cloud/webhook/razorpay-webhook
const N8N_WEBHOOK_URL = 'https://n8n.food-u.live/webhook-test/razorpay-webhook';

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

// ─── MIDDLEWARE ──────────────────────────────
app.use(cors());
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.static(path.join(__dirname)));

// ─── API: Create Order ──────────────────────
app.post('/api/create-order', async (req, res) => {
  console.log('--- POST /api/create-order received ---');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  try {
    const { amount, currency = 'INR', plan, billing_cycle } = req.body;
    console.log('Parsed body variables:', { amount, currency, plan, billing_cycle });

    if (!amount || amount < 100) {
      return res.status(400).json({ error: 'Invalid amount. Minimum is ₹1 (100 paise).' });
    }

    const options = {
      amount: amount,
      currency: currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        plan_name: plan || 'unknown',
        billing_cycle: billing_cycle || 'monthly',
      },
    };

    const order = await razorpay.orders.create(options);
    console.log(`✅ Order created: ${order.id} | ₹${amount / 100} | ${plan}`);

    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    console.error('❌ Order creation failed:', err.message);
    res.status(500).json({ error: 'Failed to create Razorpay order.', details: err.message });
  }
});

// ─── API: Verify Payment ────────────────────
app.post('/api/verify-payment', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSignature === razorpay_signature) {
    console.log(`✅ Payment verified: ${razorpay_payment_id}`);
    res.json({ verified: true });
  } else {
    console.log(`❌ Payment verification failed for: ${razorpay_payment_id}`);
    res.status(400).json({ verified: false });
  }
});

// ══════════════════════════════════════════════
// RAZORPAY WEBHOOK → n8n RELAY
// ══════════════════════════════════════════════
// Razorpay sends POST events here. We verify the
// signature, log it, then forward to n8n for processing.
//
// In Razorpay Dashboard → Settings → Webhooks:
//   URL:    http://YOUR_PUBLIC_URL/api/razorpay-webhook
//   Events: subscription.activated, subscription.charged,
//           subscription.pending, subscription.halted,
//           subscription.cancelled, payment.authorized,
//           payment.captured, payment.failed
// ══════════════════════════════════════════════

app.post('/api/razorpay-webhook', async (req, res) => {
  // Immediately respond 200 to Razorpay (they timeout after 5s)
  res.status(200).json({ status: 'received' });

  try {
    // req.body is already parsed by express.json()
    const payload = req.body;
    const rawBody = req.rawBody || JSON.stringify(payload);
    const eventType = payload.event || 'unknown';
    const eventId = payload.payload?.payment?.entity?.id
      || payload.payload?.subscription?.entity?.id
      || `evt_${Date.now()}`;

    console.log('');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔔 Webhook received: ${eventType}`);
    console.log(`   Event ID: ${eventId}`);
    console.log(`   Time:     ${new Date().toLocaleString()}`);

    // ── Signature Verification ──────────────
    const razorpaySignature = req.headers['x-razorpay-signature'];

    if (RAZORPAY_WEBHOOK_SECRET && RAZORPAY_WEBHOOK_SECRET !== 'YOUR_WEBHOOK_SECRET_HERE') {
      const expectedSig = crypto
        .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      if (razorpaySignature === expectedSig) {
        console.log(`   Signature: ✅ Verified`);
      } else {
        console.log(`   Signature: ❌ MISMATCH (event still forwarded)`);
      }
    } else {
      console.log(`   Signature: ⚠️  Skipped (no webhook secret set)`);
    }

    // ── Forward to n8n ──────────────────────
    console.log(`   Forwarding to n8n: ${N8N_WEBHOOK_URL}`);

    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Razorpay-Event': eventType,
        'X-Razorpay-Event-Id': eventId,
      },
      body: JSON.stringify(payload),
    });

    if (n8nResponse.ok) {
      console.log(`   n8n response: ✅ ${n8nResponse.status}`);
    } else {
      console.log(`   n8n response: ❌ ${n8nResponse.status} ${n8nResponse.statusText}`);
    }

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log('');

  } catch (err) {
    console.error(`❌ Webhook processing error: ${err.message}`);
  }
});

// ─── API: Health Check ──────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'PayFlow',
    razorpay_connected: true,
    n8n_url: N8N_WEBHOOK_URL,
    timestamp: new Date().toISOString(),
  });
});

// ─── START SERVER ────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ⚡ PayFlow server running!');
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → http://127.0.0.1:${PORT}`);
  console.log('');
  console.log('  📡 Razorpay Webhook endpoint:');
  console.log(`  → POST http://localhost:${PORT}/api/razorpay-webhook`);
  console.log('');
  console.log('  🔗 n8n relay target:');
  console.log(`  → ${N8N_WEBHOOK_URL}`);
  console.log('');
});

