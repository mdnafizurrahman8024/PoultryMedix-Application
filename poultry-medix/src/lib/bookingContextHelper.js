/**
 * Booking Target Mode Helper & Clinical History Attachment Sanitizer
 *
 * Strictly separates Mode A (My Registered Shed with auto-filled flock specs
 * and genuine shed-scoped AI diagnostics/prescriptions) from Mode B
 * (Other / Unregistered Farm Manual Entry with zero fabricated AI diagnosis).
 */

import { sanitizePaymentInput } from './paymentAdapter.js'

export const BOOKING_TARGET_MODES = {
  REGISTERED_SHED: 'registered_shed',
  MANUAL_FARM: 'manual_farm',
}

export const MANUAL_BIRD_TYPES = ['Broiler', 'Layer', 'Sonali', 'Duck', 'Native']

export const ALLOWED_ATTACHMENT_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

export const ALLOWED_ATTACHMENT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf']

export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024 // 4 MB max per file
export const MAX_ATTACHMENT_COUNT = 3

const KNOWN_BIRD_SPECIES = [
  'Broiler',
  'Layer',
  'Sonali',
  'Duck',
  'Native',
  'Breeder',
  'Pigeon',
  'Other',
]

function normalizeTextKey(val) {
  return String(val ?? '').trim().toLocaleLowerCase()
}

export function normalizeBirdSpecies(species = 'Broiler') {
  const raw = String(species ?? '').trim()
  if (!raw) return 'Broiler'
  const lower = raw.toLocaleLowerCase()
  if (lower === 'desi / native' || lower === 'desi') return 'Native'
  const found = KNOWN_BIRD_SPECIES.find((item) => item.toLocaleLowerCase() === lower)
  return found || 'Broiler'
}

export function getFileExtension(fileName = '') {
  const clean = String(fileName || '').trim().toLocaleLowerCase()
  const idx = clean.lastIndexOf('.')
  return idx >= 0 ? clean.slice(idx) : ''
}

export function isSafeDataUrlForAttachment(dataUrl = '', mimeType = '') {
  const safeUrl = String(dataUrl || '')
  const safeMime = String(mimeType || '').toLocaleLowerCase()
  if (!ALLOWED_ATTACHMENT_MIMES.includes(safeMime)) return false
  return safeUrl.startsWith(`data:${safeMime};base64,`)
}

export function validateHistoryAttachmentFile(file, language = 'en') {
  const isBn = language === 'bn'
  if (!file || typeof file !== 'object') {
    return {
      ok: false,
      error: isBn ? 'কোনো বৈধ ফাইল নির্বাচন করা হয়নি।' : 'No valid file selected.',
    }
  }

  const mimeType = String(file.type || '').trim().toLocaleLowerCase()
  const ext = getFileExtension(file.name)
  const mimeValid = ALLOWED_ATTACHMENT_MIMES.includes(mimeType)
  const extValid = ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)
  const pdfConsistency =
    (mimeType === 'application/pdf' && ext === '.pdf') ||
    (mimeType.startsWith('image/') && ext !== '.pdf')

  if (!mimeValid || !extValid || !pdfConsistency) {
    return {
      ok: false,
      error: isBn
        ? 'শুধুমাত্র JPG, PNG, WebP ছবি অথবা PDF ফাইল আপলোড করা যাবে।'
        : 'Only JPG, PNG, WebP images or PDF files are allowed.',
    }
  }

  const sizeBytes = Number(file.size) || 0
  if (sizeBytes <= 0 || sizeBytes > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      error: isBn
        ? 'ফাইলের আকার সর্বোচ্চ ৪ মেগাবাইটের মধ্যে হতে হবে।'
        : 'File size must be under 4 MB.',
    }
  }

  return {
    ok: true,
    cleanName: sanitizePaymentInput(file.name, 90) || `attachment${ext}`,
    mimeType,
    sizeBytes,
  }
}

export function readAttachmentAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('FileReader unavailable'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read attachment'))
    reader.readAsDataURL(file)
  })
}

export function getShedLinkedDiagnoses(shed, allDiagnoses = []) {
  if (!shed || !Array.isArray(allDiagnoses)) return []
  const shedId = String(shed.id || '')
  const shedNameNorm = normalizeTextKey(shed.name)
  return allDiagnoses.filter((diag) => {
    if (!diag || typeof diag !== 'object') return false
    if (diag.shedId && shedId && String(diag.shedId) === shedId) return true
    if (diag.shedName && shedNameNorm && normalizeTextKey(diag.shedName) === shedNameNorm) return true
    return false
  })
}

export function getShedLinkedPrescriptions(shed, allPrescriptions = []) {
  if (!shed || !Array.isArray(allPrescriptions)) return []
  const shedId = String(shed.id || '')
  const shedNameNorm = normalizeTextKey(shed.name)
  return allPrescriptions.filter((rx) => {
    if (!rx || typeof rx !== 'object') return false
    if (rx.shedId && shedId && String(rx.shedId) === shedId) return true
    if (rx.shedName && shedNameNorm && normalizeTextKey(rx.shedName) === shedNameNorm) return true
    if (rx.farmName && shedNameNorm && normalizeTextKey(rx.farmName) === shedNameNorm) return true
    return false
  })
}

export function summarizeClinicalRxRecord(rx) {
  if (!rx || typeof rx !== 'object') return null
  const meds = Array.isArray(rx.medications) ? rx.medications : []
  const medNames = meds
    .map((m) => sanitizePaymentInput(m?.tradeName || m?.name || m?.genericName || '', 60))
    .filter(Boolean)
    .slice(0, 4)

  return {
    id: String(rx.id || ''),
    timestamp: rx.timestamp || '',
    dateLabel: rx.formattedDate || (rx.timestamp ? String(rx.timestamp).slice(0, 10) : ''),
    vetName: sanitizePaymentInput(rx.vetName || 'Registered Veterinarian', 80),
    diagnosis: sanitizePaymentInput(rx.diagnosis || 'Prescription Record', 120),
    flockType: normalizeBirdSpecies(rx.flockType || rx.birdType || 'Broiler'),
    age: sanitizePaymentInput(rx.age || '', 30),
    flockSize: sanitizePaymentInput(rx.flockSize || '', 20),
    medicationSummary: medNames.join(', '),
    medicationsCount: meds.length,
    shedName: sanitizePaymentInput(rx.shedName || rx.farmName || '', 80),
  }
}

export function formatBytesReadable(bytes = 0) {
  const num = Number(bytes) || 0
  if (num < 1024) return `${num} B`
  if (num < 1024 * 1024) return `${Math.round(num / 1024)} KB`
  return `${(num / (1024 * 1024)).toFixed(1)} MB`
}

export function buildBookingFlockPayload({
  mode = BOOKING_TARGET_MODES.REGISTERED_SHED,
  selectedShed = null,
  manualInput = {},
  attachedRxIds = [],
  uploadedFiles = [],
  allDiagnoses = [],
  allPrescriptions = [],
  language = 'en',
} = {}) {
  const isBn = language === 'bn'
  const isRegisteredMode = mode === BOOKING_TARGET_MODES.REGISTERED_SHED && Boolean(selectedShed)
  const resolvedMode = isRegisteredMode
    ? BOOKING_TARGET_MODES.REGISTERED_SHED
    : BOOKING_TARGET_MODES.MANUAL_FARM

  const safeUpazila = sanitizePaymentInput(manualInput?.upazila || '', 80)

  let shedId = ''
  let shedName = ''
  let farmName
  let birdType
  let flockSize
  let age = ''
  let ageDays = null
  let shedSummary
  let linkedDiagnoses
  let aiDiagnosisSummary = ''

  if (isRegisteredMode) {
    shedId = String(selectedShed.id || '')
    shedName = sanitizePaymentInput(selectedShed.name, 120) || (isBn ? 'নিবন্ধিত শেড' : 'Registered Shed')
    farmName = shedName
    birdType = normalizeBirdSpecies(selectedShed.species)
    const countNum = Math.max(0, Math.floor(Number(selectedShed.birdCount) || 0))
    flockSize = countNum > 0 ? String(countNum) : ''
    ageDays = Math.max(1, Math.floor(Number(selectedShed.currentAgeDays ?? selectedShed.initialAgeDays) || 1))
    age = isBn ? `দিন ${ageDays}` : `Day ${ageDays}`
    shedSummary = isBn
      ? `${shedName} · ${flockSize || '—'} পাখি (${birdType}, দিন ${ageDays})`
      : `${shedName} · ${flockSize || '—'} birds (${birdType}, Day ${ageDays})`

    // Strictly link genuine Smart AI Diagnostics saved for this registered shed only
    linkedDiagnoses = getShedLinkedDiagnoses(selectedShed, allDiagnoses)
      .slice(0, 3)
      .map((diag) => ({
        id: String(diag.id || ''),
        primaryDisease: sanitizePaymentInput(diag.primaryDisease || '', 120),
        confidencePercent: sanitizePaymentInput(diag.confidencePercent || '', 20),
        timestamp: diag.timestamp || '',
        shedId: diag.shedId || '',
        shedName: sanitizePaymentInput(diag.shedName || shedName, 80),
      }))
      .filter((d) => Boolean(d.primaryDisease))

    if (linkedDiagnoses[0]) {
      aiDiagnosisSummary = `${linkedDiagnoses[0].primaryDisease}${linkedDiagnoses[0].confidencePercent ? ` (${linkedDiagnoses[0].confidencePercent})` : ''}`
    }
  } else {
    const rawFarm = sanitizePaymentInput(manualInput?.farmName || manualInput?.farm || '', 120)
    farmName = rawFarm || (safeUpazila
      ? `${safeUpazila} Farm`
      : (isBn ? 'অনিবন্ধিত খামার' : 'Unregistered Farm'))
    birdType = normalizeBirdSpecies(manualInput?.birdType || 'Broiler')

    const countVal = Number(manualInput?.totalBirds ?? manualInput?.flockSize)
    flockSize = Number.isFinite(countVal) && countVal > 0 ? String(Math.floor(countVal)) : ''

    const rawAgeStr = String(manualInput?.ageDays ?? manualInput?.age ?? '').trim()
    const ageVal = Number(rawAgeStr)
    if (rawAgeStr !== '' && Number.isFinite(ageVal) && ageVal >= 0) {
      ageDays = Math.floor(ageVal)
      age = isBn ? `দিন ${ageDays}` : `Day ${ageDays}`
    }

    const parts = [
      farmName,
      safeUpazila || '',
      flockSize ? `${flockSize} ${birdType}` : birdType,
      age || '',
    ].filter(Boolean)
    shedSummary = parts.join(' · ')

    // Never fabricate an AI diagnosis from raw booking complaints
    linkedDiagnoses = []
    aiDiagnosisSummary = ''
  }

  const rxIdSet = new Set((Array.isArray(attachedRxIds) ? attachedRxIds : []).map(String))
  const attachedPrescriptions = (Array.isArray(allPrescriptions) ? allPrescriptions : [])
    .filter((rx) => rx?.id && rxIdSet.has(String(rx.id)))
    .slice(0, 5)
    .map(summarizeClinicalRxRecord)
    .filter(Boolean)

  const uploadedAttachments = (Array.isArray(uploadedFiles) ? uploadedFiles : [])
    .slice(0, MAX_ATTACHMENT_COUNT)
    .filter((item) => item && ALLOWED_ATTACHMENT_MIMES.includes(String(item.mimeType || '').toLowerCase()))
    .map((item) => ({
      id: String(item.id || crypto.randomUUID()),
      fileName: sanitizePaymentInput(item.fileName || item.name || 'report', 90),
      mimeType: String(item.mimeType).toLowerCase(),
      sizeBytes: Math.max(0, Number(item.sizeBytes || item.size) || 0),
      dataUrl: isSafeDataUrlForAttachment(item.dataUrl, item.mimeType) ? item.dataUrl : '',
    }))

  return {
    bookingMode: resolvedMode,
    shedId,
    shedName,
    farmName,
    upazila: safeUpazila,
    birdType,
    flockSize,
    age,
    ageDays,
    shedSummary,
    linkedDiagnoses,
    aiDiagnosisSummary,
    attachedPrescriptions,
    uploadedAttachments,
  }
}
