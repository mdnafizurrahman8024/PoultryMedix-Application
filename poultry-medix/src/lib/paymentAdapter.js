/**
 * PoultryMedix Privacy-Protected Payment & Unified Platform Room Adapter
 *
 * Initiates server-backed gateway payment sessions (bKash / Nagad / Rocket / SSLCommerz
 * in live mode, or interactive signed sandbox gateway in staging) without storing
 * real merchant credentials in browser code or accepting unverified/fake TrxIDs.
 */

import { BASELINE_DOCTORS, formatVetHeaderDisplay } from './doctorsStore.js'

export const CONSULTATION_FEE_BDT = 500
export const PAYMENT_SYNC_CHANNEL = 'poultrymedix_payment_sync'
export const PENDING_BOOKING_STORAGE_KEY = 'poultrymedix_pending_booking_v1'
const LOCAL_GATEWAY_LEDGER_KEY = 'poultrymedix_gateway_ledger_v1'

export const PAYMENT_MODE =
  String(import.meta.env?.VITE_PAYMENT_MODE || 'sandbox').toLowerCase() === 'live'
    ? 'live'
    : 'sandbox'

export const PAYMENT_API_BASE_URL = String(
  import.meta.env?.VITE_PAYMENT_API_BASE_URL || ''
).trim()

export const DEMO_VETERINARIAN = BASELINE_DOCTORS[0]
export const VETERINARY_DOCTORS = BASELINE_DOCTORS
export { formatVetHeaderDisplay }

export const QUICK_SELECT_MEDICATIONS = [
  {
    id: 'preset-doxivet',
    tradeName: 'Doxivet',
    genericName: 'Doxycycline HCl',
    antibioticClass: 'Tetracycline',
    generation: '2nd Gen',
    whoAwareCategory: 'Watch',
    formulation: 'Water soluble powder',
    dosage: '1g / 2–4L drinking water daily',
    frequency: 'Continuous in water',
    duration: '4',
    durationType: 'Days',
    withdrawal: '7 days (Meat) · Not for table-egg layers',
    meatWithdrawalDays: '7 days',
    eggWithdrawalDays: 'Not for table-egg layers',
  },
  {
    id: 'preset-moxivet',
    tradeName: 'Moxivet',
    genericName: 'Amoxicillin Trihydrate',
    antibioticClass: 'Aminopenicillin',
    generation: '2nd Gen',
    whoAwareCategory: 'Access',
    formulation: 'Water soluble powder',
    dosage: '10–20 mg/kg or 1g / 2L water daily',
    frequency: 'Twice daily',
    duration: '5',
    durationType: 'Days',
    withdrawal: '3 days (Meat) · 1–2 days (Check label)',
    meatWithdrawalDays: '3 days',
    eggWithdrawalDays: '1–2 days (Check label)',
  },
  {
    id: 'preset-tylovet',
    tradeName: 'Tylovet',
    genericName: 'Tylosin Tartrate',
    antibioticClass: 'Macrolide',
    generation: '1st Gen',
    whoAwareCategory: 'Watch',
    formulation: 'Water soluble powder',
    dosage: '0.5g / 1L drinking water',
    frequency: 'Continuous in water',
    duration: '4',
    durationType: 'Days',
    withdrawal: '5 days (Meat) · 0–2 days (Eggs)',
    meatWithdrawalDays: '5 days',
    eggWithdrawalDays: '0–2 days (Check label)',
  },
  {
    id: 'preset-amprolium',
    tradeName: 'Amprolium Plus',
    genericName: 'Amprolium HCl + Ethopabate',
    antibioticClass: 'Anticoccidial',
    generation: 'Non-Antimicrobial',
    whoAwareCategory: 'Access',
    formulation: 'Water soluble powder',
    dosage: '1g / 1–2L drinking water',
    frequency: 'Continuous in water',
    duration: '5',
    durationType: 'Days',
    withdrawal: '3 days (Meat) · 0 days (Check label)',
    meatWithdrawalDays: '3 days',
    eggWithdrawalDays: '0 days (Check label)',
  },
  {
    id: 'preset-electrolytes',
    tradeName: 'Electrolytes + Vitamin C',
    genericName: 'Oral Rehydration & Ascorbic Acid',
    antibioticClass: 'Supportive Care',
    generation: 'Supportive',
    whoAwareCategory: 'Access',
    formulation: 'Water soluble powder',
    dosage: '1g / 1L cool drinking water',
    frequency: 'Continuous in water',
    duration: '5',
    durationType: 'Days',
    withdrawal: '0 days (Zero residue)',
    meatWithdrawalDays: '0 days',
    eggWithdrawalDays: '0 days',
  },
]

export const DEV_SANDBOX_DEFAULTS = {
  farmer: 'Demo Farmer (Sandbox)',
  farm: 'Green Valley Poultry Shed',
  concern: 'Flock Health & Respiratory Checkup',
  mobileNumber: '01700000000',
}

export const PAYMENT_METHODS = [
  { id: 'bkash', labelKey: 'bkash', detailKey: 'mobileFinancialService', kind: 'mfs', color: '#d12053' },
  { id: 'nagad', labelKey: 'nagad', detailKey: 'mobileFinancialService', kind: 'mfs', color: '#ea580c' },
  { id: 'rocket', labelKey: 'rocket', detailKey: 'mobileFinancialService', kind: 'mfs', color: '#7c3aed' },
  { id: 'bank-card', labelKey: 'bankCard', detailKey: 'bankTransferDetail', kind: 'card', color: '#0369a1' },
]

function getPaymentApiBase() {
  return PAYMENT_API_BASE_URL.replace(/\/$/, '')
}

function stripControlChars(str) {
  let out = ''
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i)
    if (code >= 32 && code !== 127) out += str[i]
  }
  return out
}

export function sanitizePaymentInput(value, maxLength = 120) {
  return stripControlChars(String(value ?? ''))
    .replace(/[<>`"'\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

export function resolveBookingWithSandboxDefaults(booking) {
  if (PAYMENT_MODE !== 'sandbox') return booking
  return {
    ...booking,
    farmer: sanitizePaymentInput(booking?.farmer, 120) || DEV_SANDBOX_DEFAULTS.farmer,
    farm: sanitizePaymentInput(booking?.farm, 120) || DEV_SANDBOX_DEFAULTS.farm,
    concern: sanitizePaymentInput(booking?.concern, 300) || DEV_SANDBOX_DEFAULTS.concern,
  }
}

export function createCallRoomCode(trxId = '') {
  const clean = String(trxId || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
  const suffix = clean.slice(-6) || generateReceiptTrxId('PMX').slice(-6)
  return `PMX-ROOM-${suffix}`
}

export function buildLiveJitsiRoomName(roomId = 'PMX-ROOM-LIVE') {
  const clean = String(roomId || 'PMX-ROOM-LIVE').replace(/[^A-Za-z0-9_-]/g, '') || 'PMX-ROOM-LIVE'
  return `PoultryMedix-Live-${clean}`
}

export function buildJitsiMountOptions({
  roomId = 'PMX-ROOM-LIVE',
  displayName = 'PoultryMedix Participant',
  isHost = false,
  startAudioOnly = false,
  height = 380,
  parentNode = null,
} = {}) {
  const safeName = sanitizePaymentInput(displayName || 'PoultryMedix Participant', 60) || 'PoultryMedix Participant'
  return {
    roomName: buildLiveJitsiRoomName(roomId),
    width: '100%',
    height,
    parentNode,
    userInfo: { displayName: safeName },
    configOverwrite: {
      prejoinPageEnabled: false,
      startWithAudioMuted: isHost ? false : true,
      startWithVideoMuted: isHost ? Boolean(startAudioOnly) : true,
      startAudioOnly: isHost ? Boolean(startAudioOnly) : false,
      disableDeepLinking: true,
    },
    interfaceConfigOverwrite: {
      TOOLBAR_BUTTONS: isHost
        ? ['microphone', 'camera', 'desktop', 'tileview', 'raisehand', 'fullscreen', 'hangup']
        : ['microphone', 'camera', 'raisehand', 'tileview', 'fullscreen', 'hangup'],
      SHOW_JITSI_WATERMARK: false,
      SHOW_WATERMARK_FOR_GUESTS: false,
    },
  }
}

let jitsiApiLoadPromise = null

export function loadJitsiExternalApi(timeoutMs = 7000) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Jitsi External API requires a browser DOM.'))
  }
  if (typeof window.JitsiMeetExternalAPI === 'function') {
    return Promise.resolve(window.JitsiMeetExternalAPI)
  }
  if (jitsiApiLoadPromise) return jitsiApiLoadPromise

  jitsiApiLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-pmx-jitsi-api="true"]')
    const timer = window.setTimeout(() => {
      jitsiApiLoadPromise = null
      reject(new Error('Jitsi Meet script timed out (network restricted or offline).'))
    }, timeoutMs)

    const onReady = () => {
      window.clearTimeout(timer)
      if (typeof window.JitsiMeetExternalAPI === 'function') {
        resolve(window.JitsiMeetExternalAPI)
      } else {
        jitsiApiLoadPromise = null
        reject(new Error('JitsiMeetExternalAPI unavailable after script load.'))
      }
    }

    const onError = () => {
      window.clearTimeout(timer)
      jitsiApiLoadPromise = null
      reject(new Error('Unable to load Jitsi Meet External API script.'))
    }

    if (existing) {
      existing.addEventListener('load', onReady, { once: true })
      existing.addEventListener('error', onError, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://meet.jit.si/external_api.js'
    script.async = true
    script.dataset.pmxJitsiApi = 'true'
    script.addEventListener('load', onReady, { once: true })
    script.addEventListener('error', onError, { once: true })
    document.head.appendChild(script)
  })

  return jitsiApiLoadPromise
}

export function buildJitsiRoomUrl({
  roomId = 'PMX-ROOM-LIVE',
  displayName = 'PoultryMedix Participant',
  startAudioOnly = false,
  isHost = false,
} = {}) {
  const safeRoom = buildLiveJitsiRoomName(roomId)
  const safeName = sanitizePaymentInput(displayName || 'PoultryMedix Participant', 60) || 'PoultryMedix Participant'
  const hashParams = [
    'config.prejoinPageEnabled=false',
    `config.startWithAudioMuted=${isHost ? 'false' : 'true'}`,
    `config.startWithVideoMuted=${isHost && !startAudioOnly ? 'false' : 'true'}`,
    `config.startAudioOnly=${startAudioOnly ? 'true' : 'false'}`,
    `userInfo.displayName=${encodeURIComponent(safeName)}`,
  ].join('&')
  return `https://meet.jit.si/${safeRoom}#${hashParams}`
}

export function normalizeBdPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.startsWith('880') && digits.length === 13) return digits.slice(2)
  return digits
}

export function isValidBdMobile(phone) {
  return /^01[3-9]\d{8}$/.test(normalizeBdPhone(phone))
}

export function isValidTrxId(trxId) {
  const clean = sanitizePaymentInput(trxId, 30).toUpperCase().replace(/[^A-Z0-9-]/g, '')
  return /^[A-Z0-9-]{6,28}$/.test(clean)
}

export function maskMobileNumber(phone) {
  const norm = normalizeBdPhone(phone)
  if (!/^01\d{9}$/.test(norm)) return '01•••••••••'
  return `${norm.slice(0, 3)}••••${norm.slice(-4)}`
}

export function formatCardNumberDisplay(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 19)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

export function generateReceiptTrxId(prefix = 'PMX-TRX') {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(6)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  let code = ''
  for (let i = 0; i < bytes.length; i += 1) {
    code += alphabet[bytes[i] % alphabet.length]
  }
  return `${prefix}-${datePart}-${code}`
}

function readLocalGatewayLedger() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LOCAL_GATEWAY_LEDGER_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeLocalGatewayLedger(ledger) {
  if (typeof window === 'undefined') return
  try {
    const keys = Object.keys(ledger)
    if (keys.length > 40) {
      keys.slice(0, keys.length - 40).forEach((k) => delete ledger[k])
    }
    window.localStorage.setItem(LOCAL_GATEWAY_LEDGER_KEY, JSON.stringify(ledger))
  } catch {
    // Ignore storage quota errors
  }
}

function generateSecureHex(bytesLen = 12) {
  const bytes = new Uint8Array(bytesLen)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytesLen; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function createLocalFallbackSandboxSession({ booking, doctor, methodLabel, amount }) {
  const sessionId = generateReceiptTrxId('PMX-PAY')
  const merchantInvoice = generateReceiptTrxId('PMX-INV')
  const nonce = generateSecureHex(16)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
  const session = {
    sessionId,
    merchantInvoice,
    nonce,
    method: booking.payment || 'bkash',
    methodLabel: methodLabel || booking.payment || 'bKash',
    amount,
    currency: 'BDT',
    doctorId: doctor.id,
    doctorName: doctor.name,
    bvcRegNo: doctor.regNo,
    clinicDetails: doctor.clinic,
    farmerName: sanitizePaymentInput(booking.farmer, 120) || DEV_SANDBOX_DEFAULTS.farmer,
    farmName: sanitizePaymentInput(booking.farm, 120) || DEV_SANDBOX_DEFAULTS.farm,
    district: sanitizePaymentInput(booking.district, 60) || 'Rajshahi',
    bookingDate: booking.date || new Date().toISOString().slice(0, 10),
    bookingTime: booking.time || '10:30',
    concern: sanitizePaymentInput(booking.concern, 300) || DEV_SANDBOX_DEFAULTS.concern,
    provider: 'sandbox-gateway-local',
    paymentMode: 'sandbox',
    isLocalFallback: true,
    status: 'PENDING',
    checkoutUrl: `${origin}/?pmx_gateway_sim=${encodeURIComponent(sessionId)}&nonce=${encodeURIComponent(nonce)}`,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000,
    receipt: null,
  }

  const ledger = readLocalGatewayLedger()
  ledger[sessionId] = session
  writeLocalGatewayLedger(ledger)
  return session
}

export function getLocalFallbackSandboxSession(sessionId) {
  const ledger = readLocalGatewayLedger()
  const session = ledger[sessionId]
  if (!session) return null
  if (session.status === 'PENDING' && Date.now() > session.expiresAt) {
    session.status = 'EXPIRED'
    ledger[sessionId] = session
    writeLocalGatewayLedger(ledger)
  }
  return session
}

export function confirmLocalFallbackSandboxSession({ sessionId, nonce, walletAccount, language = 'en' }) {
  const isBn = language === 'bn'
  const ledger = readLocalGatewayLedger()
  const session = ledger[sessionId]
  if (!session) {
    return { ok: false, error: isBn ? 'পেমেন্ট সেশন মেয়াদোত্তীর্ণ।' : 'Sandbox payment session expired or not found.' }
  }
  if (!nonce || nonce !== session.nonce) {
    return { ok: false, error: isBn ? 'অবৈধ সেশন টোকেন।' : 'Invalid payment session authorization token.' }
  }
  if (session.status === 'COMPLETED' && session.receipt) {
    return { ok: true, receipt: session.receipt }
  }

  let accountMask
  if (session.method !== 'bank-card') {
    const norm = normalizeBdPhone(walletAccount)
    if (!isValidBdMobile(norm)) {
      return { ok: false, error: isBn ? 'সঠিক ১১ সংখ্যার টেস্ট ওয়ালেট নম্বর দিন।' : 'Enter a valid 11-digit BD sandbox wallet number.' }
    }
    accountMask = maskMobileNumber(norm)
  } else {
    const digits = String(walletAccount || '').replace(/\D/g, '').slice(-4) || '4242'
    accountMask = `Card •••• ${digits}`
  }

  const receiptTrxId = generateReceiptTrxId('PMX-TRX')
  const roomCode = createCallRoomCode(receiptTrxId)
  const nowIso = new Date().toISOString()
  const receipt = {
    id: receiptTrxId,
    trxId: receiptTrxId,
    sessionId: session.sessionId,
    merchantInvoice: session.merchantInvoice,
    roomCode,
    roomId: roomCode,
    gatewayTrxRef: `GW${generateReceiptTrxId('SBX').slice(-8)}`,
    timestamp: nowIso,
    formattedDate: new Date(nowIso).toLocaleString(isBn ? 'bn-BD' : 'en-BD'),
    method: session.method,
    paymentMethod: session.method,
    paymentMethodLabel: session.methodLabel,
    accountMask,
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
    paymentMode: 'sandbox',
    provider: 'sandbox-gateway-local',
    verifiedByGateway: true,
    status: 'Completed',
  }

  session.status = 'COMPLETED'
  session.receipt = receipt
  ledger[sessionId] = session
  writeLocalGatewayLedger(ledger)

  const syncPayload = {
    type: 'pmx-payment-sync',
    sessionId,
    status: 'COMPLETED',
    receipt,
  }
  if (typeof window !== 'undefined') {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(syncPayload, window.location.origin)
      }
    } catch {
      // Ignore postMessage restriction
    }
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel(PAYMENT_SYNC_CHANNEL)
        channel.postMessage(syncPayload)
        channel.close()
      }
    } catch {
      // Ignore BroadcastChannel unavailability
    }
  }

  return { ok: true, receipt }
}

export function cancelLocalFallbackSandboxSession({ sessionId, nonce }) {
  const ledger = readLocalGatewayLedger()
  const session = ledger[sessionId]
  if (session && session.nonce === nonce && session.status === 'PENDING') {
    session.status = 'FAILED'
    ledger[sessionId] = session
    writeLocalGatewayLedger(ledger)
  }
}

export function persistPendingCheckoutContext(context) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(PENDING_BOOKING_STORAGE_KEY, JSON.stringify(context))
  } catch {
    // Ignore sessionStorage error
  }
}

export function consumePendingCheckoutContext() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(PENDING_BOOKING_STORAGE_KEY)
    if (!raw) return null
    window.sessionStorage.removeItem(PENDING_BOOKING_STORAGE_KEY)
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Creates a server-backed gateway payment session (bKash / Nagad / Rocket / SSLCommerz
 * in live mode, or interactive signed sandbox gateway checkout).
 */
export async function createGatewayPaymentSession({
  booking,
  doctor,
  methodLabel,
  amountBdt = CONSULTATION_FEE_BDT,
  language = 'en',
}) {
  const isBn = language === 'bn'
  const base = getPaymentApiBase()
  const amount = Math.max(10, Math.round(Number(amountBdt) || CONSULTATION_FEE_BDT))
  const returnOrigin = typeof window !== 'undefined' ? window.location.origin : ''

  try {
    const response = await fetch(`${base}/api/payments/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: booking.payment || 'bkash',
        methodLabel: methodLabel || booking.payment || 'bKash',
        amount,
        doctorId: doctor.id,
        doctorName: doctor.name,
        bvcRegNo: doctor.regNo,
        clinicDetails: doctor.clinic,
        farmerName: sanitizePaymentInput(booking.farmer, 120) || DEV_SANDBOX_DEFAULTS.farmer,
        farmName: sanitizePaymentInput(booking.farm, 120) || DEV_SANDBOX_DEFAULTS.farm,
        district: sanitizePaymentInput(booking.district, 60) || 'Rajshahi',
        bookingDate: booking.date,
        bookingTime: booking.time,
        concern: sanitizePaymentInput(booking.concern, 300) || DEV_SANDBOX_DEFAULTS.concern,
        returnOrigin,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (response.ok && data?.ok && data?.sessionId && data?.checkoutUrl) {
      return { ok: true, session: data }
    }

    if (PAYMENT_MODE === 'live' || response.status >= 500 || response.status === 400) {
      if (PAYMENT_MODE === 'live') {
        return {
          ok: false,
          error: data?.error || (isBn ? 'লাইভ পেমেন্ট সেশন তৈরি করা যায়নি।' : 'Unable to create live payment gateway session.'),
        }
      }
      if (response.status >= 400 && response.status !== 404) {
        return {
          ok: false,
          error: data?.error || (isBn ? 'গেটওয়ে সেশন শুরু করা যায়নি।' : 'Gateway session initialization failed.'),
        }
      }
    }
  } catch {
    if (PAYMENT_MODE === 'live') {
      return {
        ok: false,
        error: isBn
          ? 'লাইভ পেমেন্ট সার্ভারের সাথে সংযোগ পাওয়া যাচ্ছে না। অনুগ্রহ করে ব্যাকএন্ড সার্ভার চালু করুন।'
          : 'Live payment verification server is unreachable. Real payments require the backend gateway service.',
      }
    }
  }

  if (PAYMENT_MODE === 'live') {
    return {
      ok: false,
      error: isBn ? 'লাইভ পেমেন্ট গেটওয়ে উপলব্ধ নয়।' : 'Live payment gateway unavailable.',
    }
  }

  // Fallback for standalone static preview in sandbox mode only
  const localSession = createLocalFallbackSandboxSession({
    booking,
    doctor,
    methodLabel,
    amount,
  })
  return { ok: true, session: localSession }
}

/**
 * Checks real gateway settlement status for a session (never trusts arbitrary user claims).
 */
export async function pollGatewayPaymentSession(sessionOrId) {
  const sessionId = typeof sessionOrId === 'string' ? sessionOrId : sessionOrId?.sessionId
  const isLocalFallback = typeof sessionOrId === 'object' && Boolean(sessionOrId?.isLocalFallback)
  if (!sessionId) return { ok: false, status: 'INVALID' }

  if (isLocalFallback) {
    const local = getLocalFallbackSandboxSession(sessionId)
    if (!local) return { ok: false, status: 'EXPIRED' }
    return {
      ok: true,
      status: local.status,
      receipt: local.status === 'COMPLETED' ? local.receipt : null,
    }
  }

  const base = getPaymentApiBase()
  try {
    const response = await fetch(`${base}/api/payments/session/${encodeURIComponent(sessionId)}`)
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data?.ok) {
      return { ok: false, status: 'UNKNOWN', error: data?.error || '' }
    }
    return {
      ok: true,
      status: data.status,
      receipt: data.receipt || null,
    }
  } catch {
    return { ok: false, status: 'NETWORK_ERROR' }
  }
}

/**
 * Verifies a pre-paid gateway Transaction ID strictly against verified gateway settlements.
 * Rejects any guessed, arbitrary, or fake phone numbers & TrxIDs.
 */
export async function verifyExistingGatewayReference({ reference, language = 'en' }) {
  const isBn = language === 'bn'
  const cleanRef = sanitizePaymentInput(reference, 40).toUpperCase().replace(/[^A-Z0-9-]/g, '')
  if (!isValidTrxId(cleanRef)) {
    return {
      ok: false,
      error: isBn
        ? 'সঠিক গেটওয়ে TrxID লিখুন। ভুয়া নম্বর বা অনুমানকৃত TrxID গ্রহণযোগ্য নয়।'
        : 'Enter a valid gateway TrxID. Fake or unverified Transaction IDs are rejected.',
    }
  }

  const base = getPaymentApiBase()
  try {
    const response = await fetch(`${base}/api/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: cleanRef }),
    })
    const data = await response.json().catch(() => ({}))
    if (response.ok && data?.ok && data?.receipt) {
      return { ok: true, receipt: data.receipt }
    }
    if (response.status !== 404 && !data?.error) {
      return {
        ok: false,
        error: isBn ? 'পেমেন্ট গেটওয়ে যাচাই ব্যর্থ হয়েছে।' : 'Gateway payment verification failed.',
      }
    }
    if (data?.error) {
      return { ok: false, error: data.error }
    }
  } catch {
    // Check local sandbox ledger below if running static sandbox preview
  }

  if (PAYMENT_MODE === 'sandbox') {
    const ledger = readLocalGatewayLedger()
    const match = Object.values(ledger).find(
      (entry) =>
        entry?.status === 'COMPLETED' &&
        entry?.receipt &&
        !entry.redeemed &&
        (entry.receipt.trxId?.toUpperCase() === cleanRef || entry.receipt.gatewayTrxRef?.toUpperCase() === cleanRef)
    )
    if (match?.receipt) {
      match.redeemed = true
      ledger[match.sessionId] = match
      writeLocalGatewayLedger(ledger)
      return { ok: true, receipt: match.receipt }
    }
  }

  return {
    ok: false,
    error: isBn
      ? 'এই TrxID-এর বিপরীতে কোনো যাচাইকৃত পেমেন্ট পাওয়া যায়নি। ভুয়া নম্বর বা অনুমানকৃত TrxID গ্রহণ করা হয় না — অনুগ্রহ করে সরাসরি পেমেন্ট অ্যাপ থেকে পরিশোধ করুন।'
      : 'No verified payment found for this TrxID. Arbitrary or fake numbers and TrxIDs are rejected — please pay directly via the gateway app.',
  }
}

/**
 * Legacy-compatible checkout helper: rejects unverified manual inputs cleanly,
 * and allows explicit dev quick-test simulation ONLY when `isQuickSandbox` is true in sandbox mode.
 */
export async function processConsultationPayment({
  booking,
  doctor,
  methodLabel,
  fields = {},
  isQuickSandbox = false,
  amountBdt = CONSULTATION_FEE_BDT,
  language = 'en',
}) {
  const isBn = language === 'bn'

  if (!isQuickSandbox) {
    return verifyExistingGatewayReference({
      reference: fields?.trxId || fields?.reference || '',
      language,
    })
  }

  if (PAYMENT_MODE === 'live') {
    return {
      ok: false,
      error: isBn
        ? 'লাইভ মোডে দ্রুত স্যান্ডবক্স অনুমোদন নিষিদ্ধ। পেমেন্ট অ্যাপের মাধ্যমে পরিশোধ করুন।'
        : 'Sandbox quick verification is disabled in live mode. Authorize through the payment gateway.',
    }
  }

  const sessionRes = await createGatewayPaymentSession({
    booking,
    doctor,
    methodLabel,
    amountBdt,
    language,
  })
  if (!sessionRes.ok || !sessionRes.session) {
    return { ok: false, error: sessionRes.error || 'Unable to start sandbox payment session.' }
  }

  const session = sessionRes.session
  if (session.isLocalFallback) {
    return confirmLocalFallbackSandboxSession({
      sessionId: session.sessionId,
      nonce: session.nonce,
      walletAccount: booking.payment === 'bank-card' ? '4242424242424242' : DEV_SANDBOX_DEFAULTS.mobileNumber,
      language,
    })
  }

  // Settle server sandbox session using signed nonce fetched only via server confirm flow
  const base = getPaymentApiBase()
  try {
    const gatewayHtml = await fetch(session.checkoutUrl).then((r) => r.text())
    const nonceMatch = gatewayHtml.match(/var authNonce = "([^"]+)"/)
    if (nonceMatch?.[1]) {
      const confirmRes = await fetch(`${base}/api/payments/sandbox-confirm/${encodeURIComponent(session.sessionId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authNonce: nonceMatch[1],
          walletAccount: booking.payment === 'bank-card' ? '4242' : DEV_SANDBOX_DEFAULTS.mobileNumber,
        }),
      })
      const confirmData = await confirmRes.json().catch(() => ({}))
      if (confirmRes.ok && confirmData?.ok && confirmData?.receipt) {
        return { ok: true, receipt: confirmData.receipt }
      }
    }
  } catch {
    // Fall back to local sandbox settlement
  }

  const fallback = createLocalFallbackSandboxSession({
    booking,
    doctor,
    methodLabel,
    amount: Math.max(10, Math.round(Number(amountBdt) || CONSULTATION_FEE_BDT)),
  })
  return confirmLocalFallbackSandboxSession({
    sessionId: fallback.sessionId,
    nonce: fallback.nonce,
    walletAccount: booking.payment === 'bank-card' ? '4242' : DEV_SANDBOX_DEFAULTS.mobileNumber,
    language,
  })
}

export function buildDigitalReceiptMarkup(receipt, language = 'en') {
  const isBn = language === 'bn'
  const escape = (val) =>
    String(val ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]))

  const title = isBn ? 'পোল্ট্রিমেডিক্স ডিজিটাল পেমেন্ট রিসিট' : 'PoultryMedix Digital Payment Receipt'
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escape(receipt.trxId || receipt.id)} — ${escape(title)}</title>
  <style>
    @page { size: A4 portrait; margin: 16mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 24px; line-height: 1.5; font-size: 13px; }
    .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #047857; padding-bottom: 14px; margin-bottom: 18px; }
    .brand { font-size: 20px; font-weight: 800; color: #047857; margin: 0; }
    .sub { font-size: 11px; color: #475569; margin-top: 2px; }
    .status { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #dcfce7; color: #166534; font-weight: 800; font-size: 11px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; margin-bottom: 16px; }
    .cell span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; font-weight: 700; }
    .cell strong { font-size: 13px; color: #0f172a; }
    .amount-box { display: flex; justify-content: space-between; align-items: center; background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 10px; padding: 14px 18px; margin-bottom: 16px; }
    .amount-val { font-size: 22px; font-weight: 800; color: #065f46; }
    .note { font-size: 11px; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="hdr">
    <div>
      <h1 class="brand">POULTRYMEDIX AI</h1>
      <div class="sub">${escape(title)} · ${escape(isBn ? 'গোপনীয়তা-সুরক্ষিত প্ল্যাটফর্ম কল' : 'Privacy-Protected Platform Call')}</div>
    </div>
    <div style="text-align:right">
      <div class="status">${escape(receipt.status || 'Completed')}</div>
      <div style="font-size:12px;font-weight:700;margin-top:6px">${escape(receipt.trxId || receipt.id)}</div>
      ${receipt.roomCode ? `<div style="font-size:11px;color:#047857;font-weight:700">Room: ${escape(receipt.roomCode)}</div>` : ''}
      <div style="font-size:11px;color:#64748b">${escape(receipt.formattedDate || new Date(receipt.timestamp || Date.now()).toLocaleString())}</div>
    </div>
  </div>
  <div class="grid">
    <div class="cell"><span>${isBn ? 'নিবন্ধিত পশুচিকিৎসক' : 'Veterinarian'}</span><strong>${escape(receipt.doctorName || receipt.vetName || DEMO_VETERINARIAN.name)}</strong><div style="font-size:11px;color:#047857">${escape(receipt.bvcRegNo || DEMO_VETERINARIAN.regNo)}</div></div>
    <div class="cell"><span>${isBn ? 'খামারি ও খামার' : 'Farmer & Farm'}</span><strong>${escape(receipt.farmerName || 'Registered Farmer')}</strong><div style="font-size:11px;color:#475569">${escape([receipt.farmName, receipt.district].filter(Boolean).join(' · '))}</div></div>
    <div class="cell"><span>${isBn ? 'নির্ধারিত তারিখ ও সময়' : 'Scheduled Slot'}</span><strong>${escape(receipt.bookingDate || '—')} · ${escape(receipt.bookingTime || '—')}</strong></div>
    <div class="cell"><span>${isBn ? 'পেমেন্ট মাধ্যম ও হিসাব' : 'Payment Method & Account'}</span><strong>${escape(receipt.paymentMethodLabel || receipt.method || 'bKash')} (${escape(receipt.accountMask || 'Verified')})</strong>${receipt.gatewayTrxRef ? `<div style="font-size:11px;color:#475569">Gateway Ref: ${escape(receipt.gatewayTrxRef)}</div>` : ''}</div>
  </div>
  <div class="amount-box">
    <div>
      <strong style="display:block;font-size:13px">${isBn ? 'টেলিমেডিসিন পরামর্শ / সেবা ফি' : 'Veterinary Consultation & Platform Fee'}</strong>
      <small style="color:#047857">${isBn ? 'বিষয়' : 'Purpose'}: ${escape(receipt.concern || 'General poultry consultation')}</small>
    </div>
    <div class="amount-val">৳ ${escape(Number(receipt.amount) || 500)}</div>
  </div>
  <div class="note">
    <strong>${isBn ? 'প্ল্যাটফর্ম গেটওয়ে যাচাই ও গোপনীয়তা:' : 'Gateway Verification & Platform Privacy:'}</strong>
    ${isBn
      ? `এই ডিজিটাল পেমেন্ট স্লিপটি সার্ভার-যাচাইকৃত পেমেন্ট সেশন (${escape(String(receipt.paymentMode || 'sandbox').toUpperCase())} মোড)-এর মাধ্যমে সিঙ্ক হয়েছে। পরামর্শের সময় শুধুমাত্র ইন-অ্যাপ রুম (${escape(receipt.roomCode || receipt.trxId)}) ব্যবহার করুন।`
      : `Settled and synced via PoultryMedix verified gateway checkout (${escape(String(receipt.paymentMode || 'sandbox').toUpperCase())} mode). Join via the unified in-app Room (${escape(receipt.roomCode || receipt.trxId)}).`}
  </div>
  <script>window.addEventListener('load', () => window.print())</script>
</body>
</html>`
}
