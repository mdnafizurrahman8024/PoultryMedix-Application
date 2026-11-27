/**
 * Prescription RBAC Authority, Regimen Presets & Immutability Helper
 *
 * Strictly verifies registered veterinarian credentials before signing/issuing
 * prescriptions, detects antimicrobial/anticoccidial withdrawal obligations,
 * and generates tamper-evident immutable records on send.
 */

export const RX_ROUTE_OPTIONS = [
  'Drinking Water',
  'Feed Mix',
  'Oral Drop',
  'IM/SC Injection',
]

export const RX_DOSE_CHIPS = [
  '1 ml / 1 L water',
  '1 ml / 2 L water',
  '1 gm / 1 L water',
  '1 gm / 2 L water',
]

export const RX_FREQUENCY_CHIPS = [
  'Once daily',
  'Twice daily (Morning & Evening)',
  'Continuous 24 hrs',
]

export const RX_DURATION_CHIPS = [
  { value: '3', unit: 'Days', labelEn: '3 Days', labelBn: '৩ দিন' },
  { value: '5', unit: 'Days', labelEn: '5 Days', labelBn: '৫ দিন' },
  { value: '7', unit: 'Days', labelEn: '7 Days', labelBn: '৭ দিন' },
  { value: '10', unit: 'Days', labelEn: '10 Days', labelBn: '১০ দিন' },
]

export const RX_MANDATORY_REGULATORY_EN =
  'Antibiotics must only be used under registered veterinarian supervision. Strictly observe withdrawal periods.'

export const RX_MANDATORY_REGULATORY_BN =
  'শুধুমাত্র নিবন্ধিত পশুচিকিৎসকের পরামর্শে অ্যান্টিবায়োটিক ব্যবহার করুন। উইথড্রয়াল পিরিয়ড কঠোরভাবে মেনে চলুন।'

const WITHDRAWAL_ALERT_KEYWORDS = [
  'antibiotic',
  'anticoccidial',
  'antimicrobial',
  'florfenicol',
  'tilmicosin',
  'amoxicillin',
  'enrofloxacin',
  'doxycycline',
  'tylvalosin',
  'tylosin',
  'ciprofloxacin',
  'danofloxacin',
  'neomycin',
  'chlortetracycline',
  'sulphadiazine',
  'sulfadiazine',
  'trimethoprim',
  'oxytetracycline',
  'gentamicin',
  'toltrazuril',
  'amprolium',
  'coccidiostat',
]

export function isValidBvcRegistration(regNo = '') {
  const clean = String(regNo || '').trim().toUpperCase()
  return /^BVC-[A-Z0-9-]{4,24}$/.test(clean)
}

/**
 * Verifies prescription issuance privilege. Accepts application role 'REGISTERED_VET'
 * or external equivalent 'DOCTOR', alongside active authenticated session & BVC Reg No.
 */
export function assertDoctorPrescriptionAuthority({
  role = '',
  doctorSession = null,
  bvcRegNo = '',
} = {}) {
  const normalizedRole = String(role || '').trim().toUpperCase()
  const isDoctorRole = normalizedRole === 'REGISTERED_VET' || normalizedRole === 'DOCTOR'
  const effectiveReg = String(bvcRegNo || doctorSession?.regNo || '').trim().toUpperCase()

  if (!isDoctorRole || !doctorSession?.isAuthenticatedDoctor || !isValidBvcRegistration(effectiveReg)) {
    throw new Error('Unauthorized: only an authenticated doctor/veterinarian with valid BVC registration can sign and issue prescriptions.')
  }

  return Object.freeze({
    authorized: true,
    role: normalizedRole,
    doctorId: doctorSession.doctorId,
    regNo: effectiveReg,
  })
}

export function isWithdrawalRequiredMedication(med = {}) {
  if (!med || typeof med !== 'object') return false
  if (med.requiresRegisteredVetRx === true) return true
  const cat = String(med.categoryId || '').toLowerCase()
  if (cat === 'antibiotics' || cat === 'anticoccidial') return true

  const combined = [
    med.antibioticClass,
    med.genericName,
    med.generic,
    med.tradeName,
    med.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return WITHDRAWAL_ALERT_KEYWORDS.some((kw) => combined.includes(kw))
}

export function computeRxIntegrityDigest(record = {}) {
  const seed = [
    record.id || '',
    record.bvcRegNo || '',
    record.vetName || '',
    record.farmerName || '',
    record.diagnosis || '',
    record.timestamp || '',
    ...(Array.isArray(record.medications)
      ? record.medications.map((m) => `${m.genericName || ''}:${m.tradeName || m.name || ''}:${m.dosage || ''}`)
      : []),
  ].join('|')

  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `PMX-SIG-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
}

export function buildImmutableRxLockFields({ record, doctorSession }) {
  const nowIso = record?.lockedAt || record?.timestamp || new Date().toISOString()
  const bvcReg = String(record?.bvcRegNo || doctorSession?.regNo || '').trim().toUpperCase()
  const digitalSignature =
    String(record?.digitalSignature || '').trim() ||
    `${record?.vetName || 'Registered Veterinarian'} (${bvcReg})`

  const stamped = {
    ...record,
    bvcRegNo: bvcReg,
    digitalSignature,
    isImmutable: true,
    lockedAt: nowIso,
    regulatoryNoticeEn: RX_MANDATORY_REGULATORY_EN,
    regulatoryNoticeBn: RX_MANDATORY_REGULATORY_BN,
  }
  return Object.freeze({
    ...stamped,
    signatureDigest: computeRxIntegrityDigest(stamped),
  })
}
