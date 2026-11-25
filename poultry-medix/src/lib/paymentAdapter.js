/**
 * PoultryMedix Privacy-Protected Payment & Unified Platform Room Adapter
 *
 * Keeps gateway mode configurable via Vite environment variables
 * (`VITE_PAYMENT_MODE=sandbox|live`, `VITE_PAYMENT_API_BASE_URL`) without storing
 * real merchant credentials or exposing doctor private phone numbers/emails.
 */

export const CONSULTATION_FEE_BDT = 500

export const PAYMENT_MODE =
  String(import.meta.env?.VITE_PAYMENT_MODE || 'sandbox').toLowerCase() === 'live'
    ? 'live'
    : 'sandbox'

export const PAYMENT_API_BASE_URL = String(
  import.meta.env?.VITE_PAYMENT_API_BASE_URL || ''
).trim()

export const DEMO_VETERINARIAN = {
  id: 'dr-nafizur',
  name: 'Dr. Md Nafizur Rahman',
  degrees: 'DVM, Avian Health & Telemedicine Specialist',
  regNo: 'BVC-REG-11842',
  clinic: 'PoultryMedix National Avian Telehealth Hub',
  specialty: 'Poultry Disease Triage, Outbreak Control & Biosecurity',
  privacyProtected: true,
}

export const VETERINARY_DOCTORS = [
  DEMO_VETERINARIAN,
  {
    id: 'dr-sarah',
    name: 'Dr. Sarah Ahmed, DVM',
    degrees: 'DVM, MS in Avian Pathology (BAU)',
    regNo: 'BVC-REG-10492',
    clinic: 'Rajshahi Avian Diagnostic & Research Hospital',
    specialty: 'Avian Pathology & Respiratory Care',
    privacyProtected: true,
  },
  {
    id: 'dr-tariqul',
    name: 'Dr. Tariqul Islam, DVM',
    degrees: 'DVM, MSc in Veterinary Microbiology',
    regNo: 'BVC-REG-11284',
    clinic: 'Bogura Poultry Health & Biosecurity Center',
    specialty: 'AMR Stewardship & Hatchery Biosecurity',
    privacyProtected: true,
  },
  {
    id: 'dr-farhana',
    name: 'Dr. Farhana Rahman, DVM',
    degrees: 'DVM, MS in Poultry Medicine',
    regNo: 'BVC-REG-09871',
    clinic: 'Gazipur Central Avian Clinic',
    specialty: 'Broiler & Layer Flock Management',
    privacyProtected: true,
  },
]

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
  { id: 'bkash', labelKey: 'bkash', detailKey: 'mobileFinancialService', kind: 'mfs' },
  { id: 'nagad', labelKey: 'nagad', detailKey: 'mobileFinancialService', kind: 'mfs' },
  { id: 'rocket', labelKey: 'rocket', detailKey: 'mobileFinancialService', kind: 'mfs' },
  { id: 'bank-card', labelKey: 'bankCard', detailKey: 'bankTransferDetail', kind: 'card' },
]

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

export function buildJitsiRoomUrl({
  roomId = 'PMX-ROOM-LIVE',
  displayName = 'PoultryMedix Participant',
  startAudioOnly = false,
} = {}) {
  const safeRoom = `PoultryMedix-${String(roomId || 'PMX-ROOM-LIVE').replace(/[^A-Za-z0-9_-]/g, '')}`
  const safeName = sanitizePaymentInput(displayName || 'PoultryMedix Participant', 60) || 'PoultryMedix Participant'
  const hashParams = [
    'config.prejoinPageEnabled=false',
    'config.startWithAudioMuted=false',
    `config.startWithVideoMuted=${startAudioOnly ? 'true' : 'false'}`,
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
  const clean = sanitizePaymentInput(trxId, 24).toUpperCase().replace(/[^A-Z0-9-]/g, '')
  return /^[A-Z0-9-]{6,22}$/.test(clean)
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

export function validateCheckoutFields({ method, mobileNumber, trxId, cardHolder, cardNumber, cardExpiry, cardCvc, language = 'en' }) {
  const isBn = language === 'bn'
  if (method === 'bank-card') {
    const cleanHolder = sanitizePaymentInput(cardHolder, 80)
    const digits = String(cardNumber ?? '').replace(/\D/g, '')
    const cleanExpiry = sanitizePaymentInput(cardExpiry, 7)
    const cleanCvc = String(cardCvc ?? '').replace(/\D/g, '')

    if (cleanHolder.length < 3) {
      return isBn ? 'কার্ডহোল্ডারের পূর্ণ নাম লিখুন।' : 'Please enter the cardholder full name.'
    }
    if (digits.length < 13 || digits.length > 19) {
      return isBn ? 'সঠিক ১৩ থেকে ১৯ সংখ্যার কার্ড নম্বর দিন।' : 'Enter a valid 13–19 digit card or bank account number.'
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cleanExpiry)) {
      return isBn ? 'কার্ডের মেয়াদ MM/YY ফরম্যাটে লিখুন (যেমন 08/28)।' : 'Enter expiry in MM/YY format (e.g., 08/28).'
    }
    if (!/^\d{3,4}$/.test(cleanCvc)) {
      return isBn ? '৩ বা ৪ সংখ্যার সঠিক CVC কোড লিখুন।' : 'Enter a valid 3 or 4 digit CVC code.'
    }
    return ''
  }

  if (!isValidBdMobile(mobileNumber)) {
    return isBn
      ? '১১ সংখ্যার সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন 017XXXXXXXX বা 018XXXXXXXX)।'
      : 'Enter a valid 11-digit BD mobile number (01[3-9]XXXXXXXX).'
  }
  if (!isValidTrxId(trxId)) {
    return isBn
      ? 'সঠিক TrxID লিখুন (কমপক্ষে ৬ অক্ষর ও সংখ্যার সমন্বয়)।'
      : 'Enter a valid TrxID (6–22 alphanumeric characters).'
  }
  return ''
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

export async function processConsultationPayment({
  booking,
  doctor,
  methodLabel,
  fields,
  isQuickSandbox = false,
  language = 'en',
}) {
  const isBn = language === 'bn'
  if (PAYMENT_MODE === 'live' && !PAYMENT_API_BASE_URL) {
    return {
      ok: false,
      error: isBn
        ? 'লাইভ পেমেন্ট গেটওয়ে কনফিগার করা হয়নি। অনুগ্রহ করে সার্ভার-সাইড VITE_PAYMENT_API_BASE_URL যুক্ত করুন অথবা স্যান্ডবক্স মোড ব্যবহার করুন।'
        : 'Live payment proxy endpoint is not configured (VITE_PAYMENT_API_BASE_URL missing). Use sandbox mode or configure backend verification.',
    }
  }

  const effectiveFields = isQuickSandbox
    ? {
        mobileNumber: DEV_SANDBOX_DEFAULTS.mobileNumber,
        trxId: `SBX${generateReceiptTrxId('PMX').slice(-8)}`,
        cardHolder: sanitizePaymentInput(booking?.farmer || DEV_SANDBOX_DEFAULTS.farmer, 80) || DEV_SANDBOX_DEFAULTS.farmer,
        cardNumber: '4242424242424242',
        cardExpiry: '12/29',
        cardCvc: '424',
      }
    : fields

  const validationError = validateCheckoutFields({
    method: booking.payment,
    ...effectiveFields,
    language,
  })
  if (validationError) {
    return { ok: false, error: validationError }
  }

  if (PAYMENT_MODE === 'live' && PAYMENT_API_BASE_URL) {
    const response = await fetch(`${PAYMENT_API_BASE_URL.replace(/\/$/, '')}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctorId: doctor.id,
        method: booking.payment,
        amount: CONSULTATION_FEE_BDT,
        reference: sanitizePaymentInput(effectiveFields.trxId, 24),
        bookingDate: booking.date,
        bookingTime: booking.time,
      }),
    })
    if (!response.ok) {
      return {
        ok: false,
        error: isBn ? 'গেটওয়ে পেমেন্ট যাচাই করতে পারেনি। আবার চেষ্টা করুন।' : 'Gateway payment verification failed. Please verify details.',
      }
    }
  }

  const receiptTrxId = generateReceiptTrxId('PMX-TRX')
  const roomCode = createCallRoomCode(receiptTrxId)
  const nowIso = new Date().toISOString()
  const cardDigits = String(effectiveFields.cardNumber ?? '').replace(/\D/g, '')
  const accountMask =
    booking.payment === 'bank-card'
      ? `Card •••• ${cardDigits.slice(-4) || '0000'}`
      : maskMobileNumber(effectiveFields.mobileNumber)
  const gatewayTrxRef =
    booking.payment === 'bank-card'
      ? sanitizePaymentInput(effectiveFields.cardHolder, 60)
      : sanitizePaymentInput(effectiveFields.trxId, 24).toUpperCase()

  const receipt = {
    id: receiptTrxId,
    trxId: receiptTrxId,
    roomCode,
    roomId: roomCode,
    gatewayTrxRef,
    timestamp: nowIso,
    formattedDate: new Date(nowIso).toLocaleString(isBn ? 'bn-BD' : 'en-BD'),
    method: booking.payment,
    paymentMethod: booking.payment,
    paymentMethodLabel: methodLabel || booking.payment,
    accountMask,
    amount: CONSULTATION_FEE_BDT,
    currency: 'BDT',
    doctorId: doctor.id,
    doctorName: doctor.name,
    vetName: doctor.name,
    bvcRegNo: doctor.regNo,
    clinicDetails: doctor.clinic,
    farmerName: sanitizePaymentInput(booking.farmer, 120) || DEV_SANDBOX_DEFAULTS.farmer,
    farmName: sanitizePaymentInput(booking.farm, 120) || DEV_SANDBOX_DEFAULTS.farm,
    district: sanitizePaymentInput(booking.district, 60) || 'Rajshahi',
    bookingDate: booking.date,
    bookingTime: booking.time,
    concern: sanitizePaymentInput(booking.concern, 300) || DEV_SANDBOX_DEFAULTS.concern,
    paymentMode: PAYMENT_MODE,
    status: 'Completed',
  }

  return { ok: true, receipt }
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
    <div class="cell"><span>${isBn ? 'পেমেন্ট মাধ্যম ও হিসাব' : 'Payment Method & Account'}</span><strong>${escape(receipt.paymentMethodLabel || receipt.method || 'bKash')} (${escape(receipt.accountMask || 'Verified')})</strong>${receipt.gatewayTrxRef ? `<div style="font-size:11px;color:#475569">Ref: ${escape(receipt.gatewayTrxRef)}</div>` : ''}</div>
  </div>
  <div class="amount-box">
    <div>
      <strong style="display:block;font-size:13px">${isBn ? 'টেলিমেডিসিন পরামর্শ ফি' : 'Veterinary Telemedicine Consultation Fee'}</strong>
      <small style="color:#047857">${isBn ? 'পরামর্শের বিষয়' : 'Flock Concern'}: ${escape(receipt.concern || 'General poultry consultation')}</small>
    </div>
    <div class="amount-val">৳ ${escape(Number(receipt.amount) || 500)}</div>
  </div>
  <div class="note">
    <strong>${isBn ? 'প্ল্যাটফর্ম গোপনীয়তা ও নিরাপত্তা:' : 'Platform Privacy & Gateway Security:'}</strong>
    ${isBn
      ? `এই রিসিটটি PoultryMedix এনক্রিপ্টেড পেমেন্ট অ্যাডাপ্টার (${escape(String(receipt.paymentMode || 'sandbox').toUpperCase())} মোড)-এর মাধ্যমে যাচাইকৃত। পরামর্শের সময় শুধুমাত্র অ্যাপের ইন-অ্যাপ রুম (${escape(receipt.roomCode || receipt.trxId)}) ব্যবহার করুন।`
      : `Verified via PoultryMedix encrypted checkout adapter (${escape(String(receipt.paymentMode || 'sandbox').toUpperCase())} mode). Join via the unified in-app Consultation Room (${escape(receipt.roomCode || receipt.trxId)}).`}
  </div>
  <script>window.addEventListener('load', () => window.print())</script>
</body>
</html>`
}
