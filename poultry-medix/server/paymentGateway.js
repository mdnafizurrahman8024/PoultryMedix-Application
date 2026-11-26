import crypto from 'node:crypto'
import process from 'node:process'
import express from 'express'

const SESSION_TTL_MS = 30 * 60 * 1000
const MAX_STORED_SESSIONS = 1000
const VALID_METHODS = new Set(['bkash', 'nagad', 'rocket', 'bank-card'])

const paymentSessions = new Map()
const settledByTrxId = new Map()
const redeemedTrxIds = new Set()

const RUNTIME_HMAC_SECRET = process.env.PAYMENT_SIGNING_SECRET || crypto.randomBytes(32).toString('hex')

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]))
}

function sanitizeText(value, maxLength = 120) {
  let out = ''
  const raw = String(value ?? '')
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i)
    if (code >= 32 && code !== 127) out += raw[i]
  }
  return out
    .replace(/[<>`"'\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function normalizeMethod(method) {
  const clean = String(method || '').toLowerCase().trim()
  return VALID_METHODS.has(clean) ? clean : 'bkash'
}

function pruneExpiredSessions() {
  const now = Date.now()
  if (paymentSessions.size > MAX_STORED_SESSIONS) {
    for (const [key, session] of paymentSessions) {
      if (now > session.expiresAt || paymentSessions.size > MAX_STORED_SESSIONS) {
        paymentSessions.delete(key)
      }
    }
  }
}

function generateCode(prefix, bytesLen = 6) {
  const raw = crypto.randomBytes(bytesLen).toString('hex').toUpperCase()
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${prefix}-${datePart}-${raw.slice(0, 6)}`
}

function signReceiptPayload(payload) {
  const canonical = [
    payload.trxId,
    payload.gatewayTrxRef,
    payload.amount,
    payload.currency,
    payload.method,
    payload.sessionId,
  ].join('|')
  return crypto.createHmac('sha256', RUNTIME_HMAC_SECRET).update(canonical).digest('hex')
}

export function verifyReceiptSignature(receipt) {
  if (!receipt?.trxId || !receipt?.gatewaySignature || !receipt?.sessionId) return false
  const expected = signReceiptPayload(receipt)
  const actualBuf = Buffer.from(String(receipt.gatewaySignature), 'utf8')
  const expectedBuf = Buffer.from(expected, 'utf8')
  if (actualBuf.length !== expectedBuf.length) return false
  return crypto.timingSafeEqual(actualBuf, expectedBuf)
}

function buildVerifiedReceipt(session, { gatewayTrxRef, accountMask, paymentMode, provider }) {
  const trxId = generateCode('PMX-TRX')
  const roomSuffix = trxId.replace(/[^A-Z0-9]/gi, '').slice(-6)
  const roomCode = `PMX-ROOM-${roomSuffix}`
  const timestamp = new Date().toISOString()

  const baseReceipt = {
    id: trxId,
    trxId,
    sessionId: session.sessionId,
    merchantInvoice: session.merchantInvoice,
    roomCode,
    roomId: roomCode,
    gatewayTrxRef,
    accountMask,
    timestamp,
    method: session.method,
    paymentMethod: session.method,
    paymentMethodLabel: session.methodLabel,
    amount: session.amount,
    currency: 'BDT',
    doctorId: session.doctorId,
    doctorName: session.doctorName,
    vetName: session.doctorName,
    bvcRegNo: session.bvcRegNo,
    clinicDetails: session.clinicDetails,
    farmerName: session.farmerName,
    farmName: session.farmName,
    district: session.district,
    bookingDate: session.bookingDate,
    bookingTime: session.bookingTime,
    concern: session.concern,
    paymentMode,
    provider,
    verifiedByServer: true,
    status: 'Completed',
  }

  return {
    ...baseReceipt,
    gatewaySignature: signReceiptPayload(baseReceipt),
  }
}

function finalizeSession(session, settleInfo) {
  if (session.status === 'COMPLETED' && session.receipt) {
    return session.receipt
  }

  const receipt = buildVerifiedReceipt(session, settleInfo)
  session.status = 'COMPLETED'
  session.receipt = receipt
  session.completedAt = Date.now()
  settledByTrxId.set(receipt.trxId.toUpperCase(), { receipt, sessionId: session.sessionId })
  if (receipt.gatewayTrxRef) {
    settledByTrxId.set(receipt.gatewayTrxRef.toUpperCase(), { receipt, sessionId: session.sessionId })
  }
  return receipt
}

function getLiveGatewayConfig() {
  const bkashReady = Boolean(
    process.env.BKASH_APP_KEY
    && process.env.BKASH_APP_SECRET
    && process.env.BKASH_USERNAME
    && process.env.BKASH_PASSWORD
  )
  const sslczReady = Boolean(process.env.SSLCZ_STORE_ID && process.env.SSLCZ_STORE_PASSWD)
  const requestedMode = String(process.env.VITE_PAYMENT_MODE || 'sandbox').toLowerCase() === 'live'
    ? 'live'
    : 'sandbox'
  return { bkashReady, sslczReady, requestedMode }
}

async function createBkashTokenizedCheckout(session, callbackOrigin) {
  const baseUrl = (process.env.BKASH_BASE_URL || 'https://tokenized.sandbox.bka.sh/v1.2.0-beta').replace(/\/$/, '')
  const tokenRes = await fetch(`${baseUrl}/tokenized/checkout/token/grant`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      username: process.env.BKASH_USERNAME,
      password: process.env.BKASH_PASSWORD,
    },
    body: JSON.stringify({
      app_key: process.env.BKASH_APP_KEY,
      app_secret: process.env.BKASH_APP_SECRET,
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!tokenRes.ok) throw new Error('bKash gateway token grant failed.')
  const tokenData = await tokenRes.json()
  if (!tokenData?.id_token) throw new Error(tokenData?.statusMessage || 'bKash gateway token missing.')

  const createRes = await fetch(`${baseUrl}/tokenized/checkout/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: tokenData.id_token,
      'x-app-key': process.env.BKASH_APP_KEY,
    },
    body: JSON.stringify({
      mode: '0011',
      payerReference: session.farmerName || 'Farmer',
      callbackURL: `${callbackOrigin}/api/payments/callback/bkash?sessionId=${encodeURIComponent(session.sessionId)}`,
      amount: String(session.amount),
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: session.merchantInvoice,
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!createRes.ok) throw new Error('bKash checkout session creation failed.')
  const createData = await createRes.json()
  if (!createData?.bkashURL || !createData?.paymentID) {
    throw new Error(createData?.statusMessage || 'Invalid bKash checkout response.')
  }

  return {
    provider: 'bkash-tokenized',
    gatewayPaymentId: createData.paymentID,
    checkoutUrl: createData.bkashURL,
    idToken: tokenData.id_token,
  }
}

async function executeBkashPayment(paymentID, idToken) {
  const baseUrl = (process.env.BKASH_BASE_URL || 'https://tokenized.sandbox.bka.sh/v1.2.0-beta').replace(/\/$/, '')
  const execRes = await fetch(`${baseUrl}/tokenized/checkout/execute`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: idToken,
      'x-app-key': process.env.BKASH_APP_KEY,
    },
    body: JSON.stringify({ paymentID }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!execRes.ok) throw new Error('bKash execute payment failed.')
  return execRes.json()
}

async function createSslcommerzSession(session, callbackOrigin) {
  const isSandbox = String(process.env.SSLCZ_IS_SANDBOX || 'true').toLowerCase() !== 'false'
  const initUrl = isSandbox
    ? 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
    : 'https://securepay.sslcommerz.com/gwprocess/v4/api.php'

  const multiCardMap = {
    bkash: 'bkash',
    nagad: 'nagad',
    rocket: 'dbblmobilebanking',
    'bank-card': 'visacard,mastercard,internetbank',
  }

  const form = new URLSearchParams({
    store_id: process.env.SSLCZ_STORE_ID,
    store_passwd: process.env.SSLCZ_STORE_PASSWD,
    total_amount: String(session.amount),
    currency: 'BDT',
    tran_id: session.merchantInvoice,
    success_url: `${callbackOrigin}/api/payments/callback/sslcommerz?sessionId=${encodeURIComponent(session.sessionId)}`,
    fail_url: `${callbackOrigin}/api/payments/callback/sslcommerz?sessionId=${encodeURIComponent(session.sessionId)}&failed=1`,
    cancel_url: `${callbackOrigin}/api/payments/callback/sslcommerz?sessionId=${encodeURIComponent(session.sessionId)}&canceled=1`,
    emi_option: '0',
    cus_name: session.farmerName || 'Registered Farmer',
    cus_email: 'telehealth@poultrymedix.local',
    cus_add1: session.district || 'Rajshahi',
    cus_city: session.district || 'Rajshahi',
    cus_country: 'Bangladesh',
    cus_phone: '01700000000',
    shipping_method: 'NO',
    product_name: 'PoultryMedix Veterinary Consultation',
    product_category: 'Telemedicine',
    product_profile: 'non-physical-goods',
    multi_card_name: multiCardMap[session.method] || '',
  })

  const response = await fetch(initUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error('SSLCommerz gateway initialization failed.')
  const data = await response.json()
  if (data?.status !== 'SUCCESS' || !data?.GatewayPageURL) {
    throw new Error(data?.failedreason || 'SSLCommerz failed to create payment URL.')
  }

  return {
    provider: 'sslcommerz',
    gatewayPaymentId: data.sessionkey || session.merchantInvoice,
    checkoutUrl: data.GatewayPageURL,
  }
}

async function validateSslcommerzOrder(valId) {
  const isSandbox = String(process.env.SSLCZ_IS_SANDBOX || 'true').toLowerCase() !== 'false'
  const validatorBase = isSandbox
    ? 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'
    : 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php'

  const query = new URLSearchParams({
    val_id: String(valId),
    store_id: process.env.SSLCZ_STORE_ID,
    store_passwd: process.env.SSLCZ_STORE_PASSWD,
    v: '1',
    format: 'json',
  })
  const res = await fetch(`${validatorBase}?${query.toString()}`, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error('SSLCommerz validation failed.')
  return res.json()
}

function normalizeHttpOrigin(value, fallback) {
  try {
    const url = new URL(String(value || '').trim())
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.origin
    }
  } catch {
    // Fall back to request host origin
  }
  return fallback
}

function methodBrandMeta(method) {
  switch (method) {
    case 'nagad':
      return { name: 'Nagad', color: '#ea580c', schemeHint: 'nagad://pay' }
    case 'rocket':
      return { name: 'Rocket (DBBL)', color: '#7c3aed', schemeHint: 'rocket://pay' }
    case 'bank-card':
      return { name: 'Bank / Card Gateway', color: '#0369a1', schemeHint: '' }
    default:
      return { name: 'bKash', color: '#d12053', schemeHint: 'bkash://pay' }
  }
}

function renderCallbackResultPage({ status, receipt, sessionId, message, returnOrigin }) {
  const isOk = status === 'COMPLETED' && Boolean(receipt)
  const payload = JSON.stringify({
    type: 'pmx-payment-sync',
    sessionId,
    status,
    receipt: receipt || null,
    error: message || '',
  }).replace(/</g, '\\u003c')

  const targetReturnUrl = returnOrigin
    ? `${returnOrigin.replace(/\/$/, '')}/?pmx_session=${encodeURIComponent(sessionId)}`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>PoultryMedix Payment Sync</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; }
    .card { width: min(100%, 420px); background: #fff; border: 1px solid #cbd5e1; border-radius: 16px; padding: 24px; text-align: center; box-shadow: 0 12px 30px rgba(15, 23, 42, .08); }
    .pill { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 800; background: ${isOk ? '#dcfce7' : '#fee2e2'}; color: ${isOk ? '#166534' : '#991b1b'}; }
    h1 { font-size: 19px; margin: 12px 0 6px; }
    p { font-size: 13px; color: #475569; margin: 0 0 18px; line-height: 1.5; }
    .btn { display: inline-block; padding: 10px 18px; border-radius: 10px; border: 0; background: #15803d; color: #fff; font-weight: 700; font-size: 13px; text-decoration: none; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <span class="pill">${isOk ? 'PAYMENT VERIFIED & SYNCED' : 'PAYMENT NOT COMPLETED'}</span>
    <h1>${isOk ? '৳ ' + escapeHtml(receipt.amount) + ' Confirmed' : 'Payment Cancelled or Failed'}</h1>
    <p>${escapeHtml(message || (isOk ? `Receipt ${receipt.trxId} has been synced with PoultryMedix.` : 'No payment was settled.'))}</p>
    ${targetReturnUrl ? `<a class="btn" href="${escapeHtml(targetReturnUrl)}">Return to PoultryMedix</a>` : `<button class="btn" onclick="window.close()">Close Window</button>`}
  </div>
  <script>
    (function () {
      var data = ${payload};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(data, '*');
        }
      } catch (e) {}
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          var ch = new BroadcastChannel('poultrymedix_payment_sync');
          ch.postMessage(data);
          ch.close();
        }
      } catch (e) {}
      setTimeout(function () {
        if (window.opener && !window.opener.closed) {
          window.close();
        }
      }, 900);
    })();
  </script>
</body>
</html>`
}

function renderSandboxGatewayPage(session) {
  const brand = methodBrandMeta(session.method)
  const isBank = session.method === 'bank-card'

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(brand.name)} Sandbox Gateway — PoultryMedix</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f1f5f9; color: #0f172a; margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; }
    .gw-shell { width: min(100%, 420px); background: #fff; border: 1px solid #cbd5e1; border-radius: 18px; overflow: hidden; box-shadow: 0 20px 50px rgba(15, 23, 42, .12); }
    .gw-top { background: ${brand.color}; color: #fff; padding: 18px 20px; }
    .gw-tag { display: inline-block; padding: 3px 9px; border-radius: 999px; background: rgba(255,255,255,.22); font-size: 10px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
    .gw-top h1 { margin: 8px 0 2px; font-size: 19px; font-weight: 800; }
    .gw-top p { margin: 0; font-size: 12px; opacity: .9; }
    .gw-body { padding: 18px 20px 20px; display: grid; gap: 14px; }
    .gw-amount { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1px solid #bbf7d0; border-radius: 12px; background: #f0fdf4; }
    .gw-amount span { font-size: 12px; font-weight: 700; color: #166534; }
    .gw-amount strong { font-size: 22px; font-weight: 800; color: #14532d; }
    .gw-meta { display: grid; gap: 6px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; font-size: 12px; }
    .gw-meta div { display: flex; justify-content: space-between; gap: 8px; }
    .gw-meta span { color: #64748b; }
    label { display: grid; gap: 5px; font-size: 12px; font-weight: 700; color: #334155; }
    input { width: 100%; height: 42px; padding: 0 12px; border: 1.5px solid #cbd5e1; border-radius: 10px; font: inherit; font-size: 14px; }
    .gw-actions { display: grid; grid-template-columns: 1fr 1.6fr; gap: 9px; margin-top: 4px; }
    button { height: 42px; border-radius: 10px; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; }
    .btn-cancel { border: 1px solid #cbd5e1; background: #fff; color: #334155; }
    .btn-pay { border: 0; background: ${brand.color}; color: #fff; }
    .gw-note { font-size: 11px; color: #475569; line-height: 1.45; margin: 0; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 9px 11px; }
    .err { color: #b91c1c; font-size: 12px; font-weight: 700; margin: 0; display: none; }
  </style>
</head>
<body>
  <div class="gw-shell">
    <div class="gw-top">
      <span class="gw-tag">SANDBOX TEST GATEWAY · NO REAL BDT CHARGED</span>
      <h1>${escapeHtml(brand.name)} App Checkout</h1>
      <p>PoultryMedix National Avian Telehealth</p>
    </div>
    <form class="gw-body" id="gw-form">
      <div class="gw-amount">
        <span>Merchant Payment Total</span>
        <strong>৳ ${escapeHtml(session.amount)}</strong>
      </div>
      <div class="gw-meta">
        <div><span>Merchant</span><strong>PoultryMedix Telehealth</strong></div>
        <div><span>Invoice</span><strong>${escapeHtml(session.merchantInvoice)}</strong></div>
        <div><span>Veterinarian</span><strong>${escapeHtml(session.doctorName)}</strong></div>
      </div>
      <label>
        <span>${isBank ? 'Sandbox Cardholder / Account Ending' : `${escapeHtml(brand.name)} Sandbox Wallet Number (01[3-9]XXXXXXXX)`}</span>
        <input id="gw-account" type="text" required value="${isBank ? '4242' : '01700000000'}" />
      </label>
      <p class="gw-note">
        Confirming here executes server-signed sandbox settlement for session <strong>${escapeHtml(session.sessionId)}</strong> and automatically syncs your PoultryMedix consultation slip.
      </p>
      <p class="err" id="gw-err"></p>
      <div class="gw-actions">
        <button type="button" class="btn-cancel" id="gw-cancel">Cancel</button>
        <button type="submit" class="btn-pay" id="gw-submit">Authorize ৳ ${escapeHtml(session.amount)}</button>
      </div>
    </form>
  </div>
  <script>
    (function () {
      var sessionId = ${JSON.stringify(session.sessionId)};
      var authNonce = ${JSON.stringify(session.authNonce)};
      var isBank = ${JSON.stringify(isBank)};
      var errEl = document.getElementById('gw-err');
      var submitBtn = document.getElementById('gw-submit');

      function showErr(msg) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
        submitBtn.disabled = false;
      }

      document.getElementById('gw-cancel').addEventListener('click', function () {
        fetch('/api/payments/sandbox-cancel/' + encodeURIComponent(sessionId), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ authNonce: authNonce })
        }).finally(function () {
          window.close();
        });
      });

      document.getElementById('gw-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var acct = (document.getElementById('gw-account').value || '').trim();
        if (!isBank && !/^01[3-9]\\d{8}$/.test(acct.replace(/\\D/g, ''))) {
          showErr('Enter a valid 11-digit BD sandbox wallet number (e.g. 01700000000).');
          return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = 'Authorizing...';
        fetch('/api/payments/sandbox-confirm/' + encodeURIComponent(sessionId), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ authNonce: authNonce, walletAccount: acct })
        })
          .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
          .then(function (res) {
            if (!res.ok || !res.d.ok) {
              showErr((res.d && res.d.error) || 'Gateway confirmation failed.');
              return;
            }
            document.open();
            document.write(res.d.html);
            document.close();
          })
          .catch(function () {
            showErr('Unable to reach PoultryMedix server.');
          });
      });
    })();
  </script>
</body>
</html>`
}

export function registerPaymentRoutes(app) {
  app.post('/api/payments/session', async (request, response) => {
    try {
      pruneExpiredSessions()
      const body = request.body && typeof request.body === 'object' ? request.body : {}
      const method = normalizeMethod(body.method)
      const amount = Math.max(10, Math.min(50000, Math.round(Number(body.amount) || 500)))
      const sessionId = generateCode('PMX-PAY', 8)
      const merchantInvoice = generateCode('PMX-INV', 6)
      const authNonce = crypto.randomBytes(24).toString('hex')
      const brand = methodBrandMeta(method)

      const forwardedProto = String(request.get('x-forwarded-proto') || request.protocol || 'http').split(',')[0].trim()
      const forwardedHost = String(request.get('x-forwarded-host') || request.get('host') || '127.0.0.1:8787').split(',')[0].trim()
      const serverOrigin = `${forwardedProto}://${forwardedHost}`
      const returnOrigin = normalizeHttpOrigin(body.returnOrigin, serverOrigin)
      const callbackOrigin = normalizeHttpOrigin(body.returnOrigin, serverOrigin)

      const session = {
        sessionId,
        merchantInvoice,
        authNonce,
        method,
        methodLabel: sanitizeText(body.methodLabel || brand.name, 40) || brand.name,
        amount,
        currency: 'BDT',
        doctorId: sanitizeText(body.doctorId || 'dr-nafizur', 60),
        doctorName: sanitizeText(body.doctorName || 'Dr. Md Nafizur Rahman', 100),
        bvcRegNo: sanitizeText(body.bvcRegNo || 'BVC-REG-11842', 40),
        clinicDetails: sanitizeText(body.clinicDetails || 'PoultryMedix National Avian Telehealth Hub', 140),
        farmerName: sanitizeText(body.farmerName || 'Registered Farmer', 120),
        farmName: sanitizeText(body.farmName || '', 120),
        district: sanitizeText(body.district || 'Rajshahi', 60),
        bookingDate: sanitizeText(body.bookingDate || '', 20),
        bookingTime: sanitizeText(body.bookingTime || '', 20),
        concern: sanitizeText(body.concern || 'Poultry Consultation', 300),
        returnOrigin,
        status: 'PENDING',
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_TTL_MS,
      }

      const { bkashReady, sslczReady, requestedMode } = getLiveGatewayConfig()

      if (method === 'bkash' && bkashReady) {
        const bkashSession = await createBkashTokenizedCheckout(session, callbackOrigin)
        session.provider = bkashSession.provider
        session.gatewayPaymentId = bkashSession.gatewayPaymentId
        session.bkashIdToken = bkashSession.idToken
        session.checkoutUrl = bkashSession.checkoutUrl
      } else if (sslczReady) {
        const sslSession = await createSslcommerzSession(session, callbackOrigin)
        session.provider = sslSession.provider
        session.gatewayPaymentId = sslSession.gatewayPaymentId
        session.checkoutUrl = sslSession.checkoutUrl
      } else if (requestedMode === 'live') {
        return response.status(503).json({
          ok: false,
          error: 'Live gateway credentials (BKASH_* or SSLCZ_*) are not configured on the server. Set server gateway keys or use sandbox mode.',
        })
      } else {
        session.provider = 'sandbox-gateway'
        session.checkoutUrl = `${callbackOrigin}/api/payments/sandbox-checkout/${encodeURIComponent(sessionId)}`
      }

      paymentSessions.set(sessionId, session)

      return response.json({
        ok: true,
        sessionId: session.sessionId,
        merchantInvoice: session.merchantInvoice,
        amount: session.amount,
        currency: session.currency,
        method: session.method,
        methodLabel: session.methodLabel,
        provider: session.provider,
        paymentMode: session.provider === 'sandbox-gateway' ? 'sandbox' : 'live',
        status: session.status,
        checkoutUrl: session.checkoutUrl,
        mobileAppSchemeHint: brand.schemeHint,
        expiresAt: session.expiresAt,
      })
    } catch (error) {
      console.error('Payment session creation failed:', error.message)
      return response.status(502).json({
        ok: false,
        error: error.message || 'Unable to initialize payment gateway session.',
      })
    }
  })

  app.get('/api/payments/session/:sessionId', (request, response) => {
    const session = paymentSessions.get(String(request.params.sessionId || ''))
    if (!session) {
      return response.status(404).json({ ok: false, error: 'Payment session not found or expired.' })
    }
    if (session.status === 'PENDING' && Date.now() > session.expiresAt) {
      session.status = 'EXPIRED'
    }
    return response.json({
      ok: true,
      sessionId: session.sessionId,
      status: session.status,
      provider: session.provider,
      amount: session.amount,
      receipt: session.status === 'COMPLETED' ? session.receipt : null,
    })
  })

  app.get('/api/payments/sandbox-checkout/:sessionId', (request, response) => {
    const session = paymentSessions.get(String(request.params.sessionId || ''))
    if (!session || session.provider !== 'sandbox-gateway') {
      return response.status(404).send('<h3>Sandbox payment session expired or unavailable.</h3>')
    }
    if (session.status === 'COMPLETED' && session.receipt) {
      return response.type('html').send(renderCallbackResultPage({
        status: 'COMPLETED',
        receipt: session.receipt,
        sessionId: session.sessionId,
        returnOrigin: session.returnOrigin,
      }))
    }
    return response.type('html').send(renderSandboxGatewayPage(session))
  })

  app.post('/api/payments/sandbox-confirm/:sessionId', (request, response) => {
    const session = paymentSessions.get(String(request.params.sessionId || ''))
    if (!session || session.provider !== 'sandbox-gateway') {
      return response.status(404).json({ ok: false, error: 'Sandbox payment session not found.' })
    }
    if (Date.now() > session.expiresAt) {
      session.status = 'EXPIRED'
      return response.status(410).json({ ok: false, error: 'Payment session expired.' })
    }

    const suppliedNonce = String(request.body?.authNonce || '')
    const a = Buffer.from(suppliedNonce, 'utf8')
    const b = Buffer.from(session.authNonce, 'utf8')
    if (!suppliedNonce || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return response.status(403).json({ ok: false, error: 'Invalid gateway session signature.' })
    }

    const rawAcct = String(request.body?.walletAccount || '').trim()
    let accountMask
    if (session.method !== 'bank-card') {
      const norm = rawAcct.replace(/\D/g, '')
      if (!/^01[3-9]\d{8}$/.test(norm)) {
        return response.status(400).json({ ok: false, error: 'Invalid sandbox mobile wallet number.' })
      }
      accountMask = `${norm.slice(0, 3)}••••${norm.slice(-4)}`
    } else {
      const digits = rawAcct.replace(/\D/g, '').slice(-4) || '4242'
      accountMask = `Card •••• ${digits}`
    }

    const gatewayTrxRef = `GW${generateCode('SBX', 5).slice(-10)}`
    const receipt = finalizeSession(session, {
      gatewayTrxRef,
      accountMask,
      paymentMode: 'sandbox',
      provider: 'sandbox-gateway',
    })

    const html = renderCallbackResultPage({
      status: 'COMPLETED',
      receipt,
      sessionId: session.sessionId,
      returnOrigin: session.returnOrigin,
    })

    return response.json({ ok: true, status: 'COMPLETED', receipt, html })
  })

  app.post('/api/payments/sandbox-cancel/:sessionId', (request, response) => {
    const session = paymentSessions.get(String(request.params.sessionId || ''))
    if (session && session.status === 'PENDING') {
      const suppliedNonce = String(request.body?.authNonce || '')
      if (suppliedNonce === session.authNonce) {
        session.status = 'FAILED'
      }
    }
    return response.json({ ok: true })
  })

  app.get('/api/payments/callback/bkash', async (request, response) => {
    const sessionId = String(request.query?.sessionId || '')
    const paymentID = String(request.query?.paymentID || '')
    const status = String(request.query?.status || '').toLowerCase()
    const session = paymentSessions.get(sessionId)

    if (!session || status !== 'success' || !paymentID || paymentID !== session.gatewayPaymentId) {
      if (session) session.status = 'FAILED'
      return response.type('html').send(renderCallbackResultPage({
        status: 'FAILED',
        sessionId,
        message: 'bKash authorization was cancelled or failed.',
        returnOrigin: session?.returnOrigin || '',
      }))
    }

    try {
      const exec = await executeBkashPayment(paymentID, session.bkashIdToken)
      if (exec?.transactionStatus !== 'Completed' || Number(exec?.amount) < session.amount || !exec?.trxID) {
        session.status = 'FAILED'
        return response.type('html').send(renderCallbackResultPage({
          status: 'FAILED',
          sessionId,
          message: exec?.statusMessage || 'bKash transaction verification failed.',
          returnOrigin: session.returnOrigin,
        }))
      }

      const normPhone = String(exec.customerMsisdn || '').replace(/\D/g, '')
      const accountMask = /^01\d{9}$/.test(normPhone) ? `${normPhone.slice(0, 3)}••••${normPhone.slice(-4)}` : 'bKash Verified'
      const receipt = finalizeSession(session, {
        gatewayTrxRef: String(exec.trxID).toUpperCase(),
        accountMask,
        paymentMode: 'live',
        provider: 'bkash-tokenized',
      })

      return response.type('html').send(renderCallbackResultPage({
        status: 'COMPLETED',
        receipt,
        sessionId,
        returnOrigin: session.returnOrigin,
      }))
    } catch (error) {
      session.status = 'FAILED'
      return response.type('html').send(renderCallbackResultPage({
        status: 'FAILED',
        sessionId,
        message: error.message || 'bKash verification error.',
        returnOrigin: session.returnOrigin,
      }))
    }
  })

  app.all('/api/payments/callback/sslcommerz', express.urlencoded({ extended: false }), async (request, response) => {
    const sessionId = String(request.query?.sessionId || '')
    const session = paymentSessions.get(sessionId)
    const valId = String(request.body?.val_id || request.query?.val_id || '')
    const failed = Boolean(request.query?.failed || request.query?.canceled)

    if (!session || failed || !valId) {
      if (session) session.status = 'FAILED'
      return response.type('html').send(renderCallbackResultPage({
        status: 'FAILED',
        sessionId,
        message: 'Gateway payment was cancelled or failed.',
        returnOrigin: session?.returnOrigin || '',
      }))
    }

    try {
      const validation = await validateSslcommerzOrder(valId)
      const isValidStatus = validation?.status === 'VALID' || validation?.status === 'VALIDATED'
      const paidAmount = Number(validation?.amount || 0)
      if (!isValidStatus || paidAmount < session.amount || validation?.tran_id !== session.merchantInvoice) {
        session.status = 'FAILED'
        return response.type('html').send(renderCallbackResultPage({
          status: 'FAILED',
          sessionId,
          message: 'SSLCommerz order validation failed amount or status check.',
          returnOrigin: session.returnOrigin,
        }))
      }

      const trxRef = String(validation.bank_tran_id || validation.val_id || session.merchantInvoice).toUpperCase()
      const accountMask = sanitizeText(validation.card_issuer || validation.card_brand || 'Gateway Verified', 40)
      const receipt = finalizeSession(session, {
        gatewayTrxRef: trxRef,
        accountMask,
        paymentMode: String(process.env.SSLCZ_IS_SANDBOX || 'true') === 'false' ? 'live' : 'sandbox',
        provider: 'sslcommerz',
      })

      return response.type('html').send(renderCallbackResultPage({
        status: 'COMPLETED',
        receipt,
        sessionId,
        returnOrigin: session.returnOrigin,
      }))
    } catch (error) {
      session.status = 'FAILED'
      return response.type('html').send(renderCallbackResultPage({
        status: 'FAILED',
        sessionId,
        message: error.message || 'SSLCommerz verification error.',
        returnOrigin: session.returnOrigin,
      }))
    }
  })

  app.post('/api/payments/verify', (request, response) => {
    const body = request.body && typeof request.body === 'object' ? request.body : {}
    const sessionId = sanitizeText(body.sessionId || '', 60)
    const reference = sanitizeText(body.reference || body.trxId || '', 40).toUpperCase()

    if (sessionId) {
      const session = paymentSessions.get(sessionId)
      if (!session || session.status !== 'COMPLETED' || !session.receipt) {
        return response.status(402).json({
          ok: false,
          error: 'Payment session is not completed yet. Complete payment in the gateway app first.',
        })
      }
      if (!verifyReceiptSignature(session.receipt)) {
        return response.status(403).json({ ok: false, error: 'Payment signature check failed.' })
      }
      redeemedTrxIds.add(session.receipt.trxId.toUpperCase())
      return response.json({ ok: true, receipt: session.receipt })
    }

    if (!reference) {
      return response.status(400).json({
        ok: false,
        error: 'No settled payment session or gateway reference provided.',
      })
    }

    const found = settledByTrxId.get(reference)
    if (!found || !verifyReceiptSignature(found.receipt)) {
      return response.status(404).json({
        ok: false,
        error: 'Transaction ID was not found in verified gateway settlements. Fake or manual unverified TrxIDs cannot confirm booking.',
      })
    }

    if (redeemedTrxIds.has(found.receipt.trxId.toUpperCase())) {
      return response.status(409).json({
        ok: false,
        error: 'This Transaction ID has already been redeemed for a consultation booking.',
      })
    }

    redeemedTrxIds.add(found.receipt.trxId.toUpperCase())
    return response.json({ ok: true, receipt: found.receipt })
  })
}
