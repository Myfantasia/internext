import crypto from 'crypto';

// Safaricom Daraja "M-Pesa Express" (STK Push) client.
// Docs: https://developer.safaricom.co.ke/APIs/MpesaExpressSimulate
//
// MPESA_ENV:
//   sandbox    — Daraja sandbox (https://sandbox.safaricom.co.ke). Default.
//   production — live Daraja. Only after Safaricom approves your go-live.
//   simulation — no network calls; for local development without Daraja
//                credentials. Refused when NODE_ENV=production.

const BASE_URLS = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke'
};

// STK ResultCodes we explain to customers. Anything else is a generic failure.
const RESULT_MESSAGES = {
  0: 'Payment received.',
  1: 'The M-Pesa balance was insufficient for this payment.',
  1001: 'Another M-Pesa transaction is in progress on this phone. Please wait a moment and try again.',
  1019: 'The M-Pesa request expired before it was completed.',
  1025: 'M-Pesa could not send the prompt. Please try again.',
  1032: 'The M-Pesa request was cancelled on the phone.',
  1037: 'Your phone could not be reached. Make sure it is on and has signal, then try again.',
  2001: 'The M-Pesa PIN entered was incorrect.'
};

export function mpesaEnv() {
  const env = (process.env.MPESA_ENV || 'sandbox').toLowerCase();
  if (env === 'simulation' && process.env.NODE_ENV === 'production') {
    throw new Error('MPESA_ENV=simulation is not allowed in production.');
  }
  return env;
}

export function describeResult(code, fallback) {
  return RESULT_MESSAGES[Number(code)] || fallback || 'The M-Pesa payment was not completed.';
}

export function resultStatus(code) {
  const n = Number(code);
  if (n === 0) return 'succeeded';
  if (n === 1032 || n === 1019 || n === 1037) return 'cancelled';
  return 'failed';
}

function config() {
  const cfg = {
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    shortcode: process.env.MPESA_SHORTCODE,
    passkey: process.env.MPESA_PASSKEY,
    transactionType: process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
    // For Buy Goods (till), PartyB is the till number while BusinessShortCode stays the store number.
    partyB: process.env.MPESA_PARTY_B || process.env.MPESA_SHORTCODE,
    callbackBaseUrl: (process.env.MPESA_CALLBACK_BASE_URL || '').replace(/\/$/, ''),
    callbackSecret: process.env.MPESA_CALLBACK_SECRET
  };
  const missing = Object.entries({
    MPESA_CONSUMER_KEY: cfg.consumerKey, MPESA_CONSUMER_SECRET: cfg.consumerSecret, MPESA_SHORTCODE: cfg.shortcode,
    MPESA_PASSKEY: cfg.passkey, MPESA_CALLBACK_BASE_URL: cfg.callbackBaseUrl, MPESA_CALLBACK_SECRET: cfg.callbackSecret
  }).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    const err = new Error(`M-Pesa is not configured. Missing: ${missing.join(', ')}`);
    err.code = 'MPESA_NOT_CONFIGURED';
    throw err;
  }
  if (!cfg.callbackBaseUrl.startsWith('https://')) {
    const err = new Error('MPESA_CALLBACK_BASE_URL must be a public https:// URL that Safaricom can reach.');
    err.code = 'MPESA_NOT_CONFIGURED';
    throw err;
  }
  return cfg;
}

export function callbackPath(secret = process.env.MPESA_CALLBACK_SECRET) {
  return `/api/payments/mpesa/callback/${secret}`;
}

// Daraja timestamps are East Africa Time, formatted YYYYMMDDHHmmss.
function timestamp() {
  const eat = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return eat.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
}

function password(cfg, ts) {
  return Buffer.from(`${cfg.shortcode}${cfg.passkey}${ts}`).toString('base64');
}

let cachedToken = null;
async function accessToken(cfg, env) {
  if (cachedToken && cachedToken.env === env && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const auth = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString('base64');
  const res = await fetch(`${BASE_URLS[env]}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(15000)
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.access_token) {
    throw new Error(`Daraja authentication failed (HTTP ${res.status}). Check MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET.`);
  }
  // Refresh a minute early to avoid using a token as it expires.
  cachedToken = { env, value: body.access_token, expiresAt: Date.now() + (Number(body.expires_in || 3599) - 60) * 1000 };
  return cachedToken.value;
}

async function darajaPost(env, cfg, path, payload) {
  const token = await accessToken(cfg, env);
  const res = await fetch(`${BASE_URLS[env]}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000)
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

// --- Simulation (development only) -------------------------------------------
const simulated = new Map();

// Starts an STK push. Returns { sessionId, customerMessage, raw }.
export async function initiateStkPush({ phone, amount, accountReference, description }) {
  const env = mpesaEnv();
  // M-Pesa only accepts whole shillings; round up so the order is fully covered.
  const wholeAmount = Math.ceil(Number(amount));

  if (env === 'simulation') {
    const sessionId = `ws_CO_SIM_${crypto.randomBytes(8).toString('hex')}`;
    simulated.set(sessionId, { startedAt: Date.now(), amount: wholeAmount, phone });
    return { sessionId, customerMessage: 'Simulation: no real prompt is sent. Payment will be marked successful in a few seconds.', raw: { simulated: true } };
  }

  const cfg = config();
  const ts = timestamp();
  const { ok, status, body } = await darajaPost(env, cfg, '/mpesa/stkpush/v1/processrequest', {
    BusinessShortCode: cfg.shortcode,
    Password: password(cfg, ts),
    Timestamp: ts,
    TransactionType: cfg.transactionType,
    Amount: wholeAmount,
    PartyA: phone,
    PartyB: cfg.partyB,
    PhoneNumber: phone,
    CallBackURL: `${cfg.callbackBaseUrl}${callbackPath(cfg.callbackSecret)}`,
    AccountReference: String(accountReference).slice(0, 12),
    TransactionDesc: String(description || 'Order payment').slice(0, 13)
  });

  if (!ok || body?.ResponseCode !== '0') {
    const message = body?.errorMessage || body?.ResponseDescription || `Daraja returned HTTP ${status}`;
    const err = new Error(`M-Pesa could not start the payment: ${message}`);
    err.raw = body;
    throw err;
  }
  return { sessionId: body.CheckoutRequestID, customerMessage: body.CustomerMessage, raw: body };
}

// Asks Daraja for the final state of an STK push. Returns
// { state: 'pending' | 'succeeded' | 'failed' | 'cancelled', resultCode, message, raw }.
// Note: the query API does not return the M-Pesa receipt number; that only
// arrives in the callback.
export async function queryStkStatus(sessionId) {
  const env = mpesaEnv();

  if (env === 'simulation') {
    const sim = simulated.get(sessionId);
    if (!sim) return { state: 'failed', message: 'Unknown simulated payment.' };
    if (Date.now() - sim.startedAt < 5000) return { state: 'pending' };
    return { state: 'succeeded', resultCode: 0, message: 'Simulated payment.', receipt: `SIM${crypto.randomBytes(4).toString('hex').toUpperCase()}`, amount: sim.amount, raw: { simulated: true } };
  }

  const cfg = config();
  const ts = timestamp();
  const { body } = await darajaPost(env, cfg, '/mpesa/stkpushquery/v1/query', {
    BusinessShortCode: cfg.shortcode,
    Password: password(cfg, ts),
    Timestamp: ts,
    CheckoutRequestID: sessionId
  });

  // "The transaction is being processed" comes back as an error object.
  if (!body || body.errorCode) return { state: 'pending', raw: body };
  if (body.ResultCode === undefined) return { state: 'pending', raw: body };
  return { state: resultStatus(body.ResultCode), resultCode: Number(body.ResultCode), message: describeResult(body.ResultCode, body.ResultDesc), raw: body };
}

// Parses Daraja's STK callback body into a normalized result.
export function parseCallback(body) {
  const cb = body?.Body?.stkCallback;
  if (!cb?.CheckoutRequestID) return null;
  const items = Object.fromEntries((cb.CallbackMetadata?.Item || []).map((i) => [i.Name, i.Value]));
  return {
    sessionId: cb.CheckoutRequestID,
    merchantRequestId: cb.MerchantRequestID,
    resultCode: Number(cb.ResultCode),
    state: resultStatus(cb.ResultCode),
    message: describeResult(cb.ResultCode, cb.ResultDesc),
    receipt: items.MpesaReceiptNumber ? String(items.MpesaReceiptNumber) : null,
    amount: items.Amount != null ? Number(items.Amount) : null,
    phone: items.PhoneNumber != null ? String(items.PhoneNumber) : null
  };
}

export function isCallbackSecretValid(provided) {
  const expected = process.env.MPESA_CALLBACK_SECRET || '';
  if (!expected || !provided || provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
