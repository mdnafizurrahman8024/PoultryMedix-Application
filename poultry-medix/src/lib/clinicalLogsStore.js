/**
 * Centralized Clinical Logs Store for PoultryMedix AI
 *
 * Persists all Smart Diagnoses, Prescription Scans, and Doctor-issued Digital Prescriptions
 * in localStorage under 'poultrymedix_clinical_logs', structured for future backend sync.
 */

import { getZoonoticInfo, normalizeReporterSource } from './oneHealthSurveillance.js'
import { BASELINE_DOCTORS } from './doctorsStore.js'
import { getLocalSlotDateAndTime } from './telehealthNotifier.js'

export const CLINICAL_LOGS_STORAGE_KEY = 'poultrymedix_clinical_logs'
export const CLINICAL_LOGS_UPDATED_EVENT = 'poultrymedix-clinical-logs-updated'
const CLEAN_DEMO_BOOKINGS_MARKER_KEY = 'poultrymedix_clean_demo_bookings_v2'

export function buildCleanDemoConsultationBookings(now = new Date()) {
  const drNafizur = BASELINE_DOCTORS[0]
  const drSarah = BASELINE_DOCTORS[1]
  const slot1 = getLocalSlotDateAndTime(0, now)
  const slot2 = getLocalSlotDateAndTime(5, now)

  return [
    {
      id: 'demo-consult-nafizur',
      trxId: 'PMX-TRX-DEMO101',
      roomId: 'PMX-ROOM-DEMO101',
      roomCode: 'PMX-ROOM-DEMO101',
      type: 'consultation',
      isDemoSeed: true,
      doctorId: drNafizur.id,
      doctorName: drNafizur.name,
      vetName: drNafizur.name,
      vetDegrees: drNafizur.degrees,
      bvcRegNo: drNafizur.regNo,
      clinicDetails: drNafizur.clinic,
      farmerName: 'Md. Rafiqul Islam',
      farmName: 'Green Valley Poultry Shed',
      district: 'Rajshahi',
      birdType: 'Broiler',
      age: '24 days',
      flockSize: '1500',
      averageWeight: '1.35',
      bookingDate: slot1.date,
      bookingTime: slot1.time,
      date: slot1.date,
      time: slot1.time,
      concern: 'Mild gasping, wet litter in East bay & reduced feed intake for 24h',
      historyNotes: 'Flock vaccinated with BCRDV on Day 5 and IBD on Day 14. Humid afternoon temperatures inside shed yesterday; 4 birds isolated.',
      clinicalSigns: 'Nasal discharge, mild rales on auscultation, huddled near drinker line',
      shedSummary: '1 Shed · 1,500 birds (Broiler, Day 24)',
      aiDiagnosisSummary: 'Chronic Respiratory Disease (CRD) (84%)',
      paymentMethod: 'bkash',
      paymentMethodLabel: 'bKash',
      amount: 500,
      currency: 'BDT',
      paymentStatus: 'Completed',
      timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      syncedToCloud: false,
    },
    {
      id: 'demo-consult-sarah',
      trxId: 'PMX-TRX-DEMO202',
      roomId: 'PMX-ROOM-DEMO202',
      roomCode: 'PMX-ROOM-DEMO202',
      type: 'consultation',
      isDemoSeed: true,
      doctorId: drSarah.id,
      doctorName: drSarah.name,
      vetName: drSarah.name,
      vetDegrees: drSarah.degrees,
      bvcRegNo: drSarah.regNo,
      clinicDetails: drSarah.clinic,
      farmerName: 'Mst. Nasrin Akter',
      farmName: 'Padma Layer Eco Farm',
      district: 'Mymensingh',
      birdType: 'Layer',
      age: '18 weeks',
      flockSize: '1200',
      averageWeight: '1.45',
      bookingDate: slot2.date,
      bookingTime: slot2.time,
      date: slot2.date,
      time: slot2.time,
      concern: 'Bloody droppings in 8 cages & sudden 6% feed drop',
      historyNotes: 'No anticoccidial given in grower mash last week; birds housed on slatted floor transitioning to laying cages.',
      clinicalSigns: 'Ruffled feathers, brownish-red mucoid feces, pale comb on 5% of birds',
      shedSummary: '1 Shed · 1,200 birds (Layer, Week 18)',
      aiDiagnosisSummary: 'Avian Coccidiosis (88%)',
      paymentMethod: 'nagad',
      paymentMethodLabel: 'Nagad',
      amount: 500,
      currency: 'BDT',
      paymentStatus: 'Completed',
      timestamp: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
      syncedToCloud: false,
    },
  ]
}

let memoryDemoConsultations = null

export function ensureCleanConsultationBookings() {
  if (typeof window === 'undefined') {
    if (!memoryDemoConsultations) {
      memoryDemoConsultations = buildCleanDemoConsultationBookings()
    }
    return memoryDemoConsultations
  }
  try {
    const marker = localStorage.getItem(CLEAN_DEMO_BOOKINGS_MARKER_KEY)
    const rawLogs = localStorage.getItem(CLINICAL_LOGS_STORAGE_KEY)
    const parsed = rawLogs ? JSON.parse(rawLogs) : []
    const existingList = Array.isArray(parsed) ? parsed : []

    if (marker === 'done') {
      const consultations = existingList.filter((item) => item?.type === 'consultation')
      if (consultations.length > 0) return consultations
    }

    // One-time cleanup: purge cluttered/expired consultation clutter & seed exactly 2 active bookings
    const nonConsultationLogs = existingList.filter(
      (item) => item?.type !== 'consultation' && item?.type !== 'appointment'
    )
    const cleanSeeds = buildCleanDemoConsultationBookings()
    const merged = [...cleanSeeds, ...nonConsultationLogs].slice(0, 300)
    localStorage.setItem(CLINICAL_LOGS_STORAGE_KEY, JSON.stringify(merged))
    // Also clear legacy appointment clutter so loadConsultationBookings never resurrects duplicates
    localStorage.setItem('poultry-telemedicine-appointments', JSON.stringify([]))
    localStorage.setItem(CLEAN_DEMO_BOOKINGS_MARKER_KEY, 'done')
    return cleanSeeds
  } catch {
    return buildCleanDemoConsultationBookings()
  }
}

export function resetToCleanDemoBookings() {
  const cleanSeeds = buildCleanDemoConsultationBookings()
  if (typeof window === 'undefined') {
    memoryDemoConsultations = cleanSeeds
    return cleanSeeds
  }
  try {
    const existing = getClinicalLogs('all').filter(
      (item) => item?.type !== 'consultation' && item?.type !== 'appointment'
    )
    localStorage.setItem(CLINICAL_LOGS_STORAGE_KEY, JSON.stringify([...cleanSeeds, ...existing].slice(0, 300)))
    localStorage.setItem('poultry-telemedicine-appointments', JSON.stringify([]))
    localStorage.setItem(CLEAN_DEMO_BOOKINGS_MARKER_KEY, 'done')
    window.dispatchEvent(new CustomEvent(CLINICAL_LOGS_UPDATED_EVENT, { detail: cleanSeeds[0] }))
  } catch {
    // ignore storage errors
  }
  return cleanSeeds
}

export function cancelConsultationBookingRecord(bookingIdOrTrx) {
  if (!bookingIdOrTrx || typeof window === 'undefined') return false
  try {
    const existing = getClinicalLogs('all')
    const target = String(bookingIdOrTrx)
    const filtered = existing.filter((item) => (
      !(
        (item?.type === 'consultation' || item?.type === 'appointment') &&
        (String(item.id) === target || String(item.trxId) === target || String(item.roomCode) === target)
      )
    ))
    localStorage.setItem(CLINICAL_LOGS_STORAGE_KEY, JSON.stringify(filtered))
    window.dispatchEvent(new CustomEvent(CLINICAL_LOGS_UPDATED_EVENT, { detail: { cancelledId: target } }))
    return true
  } catch {
    return false
  }
}

function getInitialLogs() {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(CLINICAL_LOGS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (err) {
    console.warn('[clinical-logs] Error reading primary clinical logs store:', err)
  }

  // Backwards compatibility migration: merge existing records from legacy keys
  const migrated = []
  try {
    // 1. From legacy diagnoses
    const legacyDiag = JSON.parse(localStorage.getItem('poultry-history-diagnoses') || '[]')
    if (Array.isArray(legacyDiag)) {
      for (const item of legacyDiag) {
        migrated.push({
          id: item.id || `diag-${item.createdAt || Date.now()}`,
          type: 'diagnosis',
          timestamp: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
          formattedDate: item.createdAt ? new Date(item.createdAt).toLocaleString() : new Date().toLocaleString(),
          district: item.district || 'Rajshahi',
          primaryDisease: item.summary || item.visualResult?.label || 'Clinical Screening',
          confidencePercent: item.confidence || item.visualResult?.confidence || '—',
          inputModalities: item.files?.length ? ['image'] : ['text'],
          guidanceSummary: item.answer || '',
          breakdown: [],
          syncedToCloud: false,
        })
      }
    }

    // 2. From legacy telemedicine prescriptions
    const legacyRx = JSON.parse(localStorage.getItem('poultry-telemedicine-prescriptions') || '[]')
    if (Array.isArray(legacyRx)) {
      for (const item of legacyRx) {
        migrated.push({
          id: item.id || `rx-${Date.now()}`,
          type: 'prescription',
          source: item.source || 'vet_issued',
          timestamp: item.savedAt || new Date().toISOString(),
          formattedDate: item.savedAt ? new Date(item.savedAt).toLocaleString() : new Date().toLocaleString(),
          vetName: item.vetName || 'Registered Veterinarian',
          bvcRegNo: item.bvcRegNo || item.registrationNumber || 'BVC-REG-10492',
          clinicDetails: item.clinicDetails || 'Veterinary Clinical Center',
          farmerName: item.farmerName || 'Poultry Farmer',
          district: item.district || 'Rajshahi',
          flockType: item.flockType || item.birdType || 'Broiler',
          diagnosis: item.diagnosis || 'Flock Consultation',
          medications: Array.isArray(item.medications) ? item.medications.map((m) => ({
            tradeName: m.tradeName || m.name || 'Prescribed Medicine',
            genericName: m.genericName || m.generic || m.name || '',
            antibioticClass: m.antibioticClass || m.class || 'Veterinary Antimicrobial',
            generation: m.generation || '',
            whoAwareCategory: m.whoAwareCategory || 'Watch',
            dosage: m.dosage || '',
            meatWithdrawalDays: m.meatWithdrawalDays || m.withdrawal || '7 days',
            eggWithdrawalDays: m.eggWithdrawalDays || 'Not for layers',
          })) : [],
          advice: item.advice || '',
          followUpDate: item.followUpDate || '',
          syncedToCloud: false,
        })
      }
    }

    // 3. From legacy consultation appointments
    const legacyAppts = JSON.parse(localStorage.getItem('poultry-telemedicine-appointments') || '[]')
    if (Array.isArray(legacyAppts)) {
      for (const item of legacyAppts) {
        migrated.push({
          id: item.id || `consult-${item.createdAt || Date.now()}`,
          type: 'consultation',
          timestamp: item.createdAt || new Date().toISOString(),
          formattedDate: item.createdAt ? new Date(item.createdAt).toLocaleString() : new Date().toLocaleString(),
          vetName: item.vetName || 'Dr. Sarah Ahmed, DVM',
          bvcRegNo: item.bvcRegNo || 'BVC-REG-10492',
          clinicDetails: item.clinicDetails || 'PoultryMedix Veterinary Consultation',
          farmerName: item.farmerName || 'Registered Farmer',
          farmName: item.farmName || '',
          district: item.district || 'Rajshahi',
          bookingDate: item.date || '',
          bookingTime: item.time || '',
          concern: item.concern || 'General Poultry Consultation',
          amount: Number(item.amount) || 500,
          currency: item.currency || 'BDT',
          paymentMethod: item.paymentMethod || 'bkash',
          paymentMethodLabel: item.paymentMethodLabel || item.paymentMethod || 'bKash',
          paymentStatus: item.paymentStatus || 'Confirmed',
          syncedToCloud: false,
        })
      }
    }

    if (migrated.length > 0) {
      localStorage.setItem(CLINICAL_LOGS_STORAGE_KEY, JSON.stringify(migrated.slice(0, 200)))
      return migrated
    }
  } catch (migErr) {
    console.warn('[clinical-logs] Legacy log migration notice:', migErr)
  }

  return []
}

/**
 * Reads all clinical logs from storage.
 */
export function getClinicalLogs(filterType = 'all') {
  if (typeof window !== 'undefined') {
    try {
      if (localStorage.getItem(CLEAN_DEMO_BOOKINGS_MARKER_KEY) !== 'done') {
        ensureCleanConsultationBookings()
      }
    } catch {
      // ignore marker check failure
    }
  }
  const all = getInitialLogs()
  if (filterType === 'all' || !filterType) return all
  return all.filter((log) => log.type === filterType)
}

/**
 * Appends a new structured log entry and notifies listeners.
 */
export function saveClinicalLog(entry) {
  if (!entry || typeof entry !== 'object') return null

  const id = entry.id || crypto.randomUUID()
  const timestamp = entry.timestamp || new Date().toISOString()
  const formattedDate = entry.formattedDate || new Date(timestamp).toLocaleString()

  const fullRecord = {
    id,
    timestamp,
    formattedDate,
    district: entry.district || 'Rajshahi',
    ...entry,
  }

  try {
    const existing = getInitialLogs()
    const existingSameId = existing.find((item) => String(item.id) === String(id))
    if (existingSameId?.type === 'prescription' && existingSameId?.isImmutable === true) {
      throw new Error('Unauthorized: locked prescriptions are immutable and cannot be modified after issue.')
    }
    // Avoid exact duplicate IDs
    const filtered = existing.filter((item) => String(item.id) !== String(id))
    const updated = [fullRecord, ...filtered].slice(0, 300)
    try {
      localStorage.setItem(CLINICAL_LOGS_STORAGE_KEY, JSON.stringify(updated))
    } catch {
      // Fallback: omit heavy inline attachment dataUrls if storage quota is tight
      const compactRecord = Array.isArray(fullRecord.uploadedAttachments)
        ? {
            ...fullRecord,
            uploadedAttachments: fullRecord.uploadedAttachments.map((att) => ({
              ...att,
              dataUrl: '',
            })),
          }
        : fullRecord
      localStorage.setItem(
        CLINICAL_LOGS_STORAGE_KEY,
        JSON.stringify([compactRecord, ...filtered].slice(0, 200))
      )
    }

    // Broadcast update event so open tabs/components re-render instantly
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CLINICAL_LOGS_UPDATED_EVENT, { detail: fullRecord }))
      window.dispatchEvent(new CustomEvent('poultrymedix-analytics-updated', { detail: fullRecord }))
    }
  } catch (err) {
    if (String(err?.message || '').includes('immutable')) {
      throw err
    }
    console.error('[clinical-logs] Failed to write log entry:', err)
  }

  return fullRecord
}

/**
 * Saves a Smart Diagnosis log entry.
 */
export function saveDiagnosisLog({
  id,
  shedId = '',
  shedName = '',
  primaryDisease = 'Undetermined',
  confidencePercent = '0%',
  inputModalities = ['text'],
  guidanceSummary = '',
  breakdown = [],
  district = 'Rajshahi',
  source = 'farmer_ai',
}) {
  const zoonotic = getZoonoticInfo(primaryDisease)
  return saveClinicalLog({
    id: id || crypto.randomUUID(),
    type: 'diagnosis',
    shedId: String(shedId || ''),
    shedName: String(shedName || ''),
    source: normalizeReporterSource(source),
    reporterRole: normalizeReporterSource(source),
    district: district || 'Rajshahi',
    primaryDisease,
    confidencePercent,
    inputModalities,
    guidanceSummary,
    breakdown,
    isZoonotic: zoonotic.isZoonotic,
    zoonoticSeverity: zoonotic.severity || '',
    syncedToCloud: false,
  })
}

/**
 * Saves a Field / ULO One-Health Surveillance Report.
 */
export function saveSurveillanceLog({
  id,
  district = 'Rajshahi',
  upazila = '',
  reporterRole = 'ulo_hospital',
  reporterName = '',
  species = 'Broiler',
  disease = 'Avian Influenza',
  antibioticPrescribed = 'None / Supportive Only',
  mortalityCount = 0,
  flockSize = '',
  notes = '',
}) {
  const normalizedRole = normalizeReporterSource(reporterRole)
  const zoonotic = getZoonoticInfo(disease)
  const defaultReporters = {
    ulo_hospital: 'Govt. ULO Veterinary Officer',
    bvc_vet: 'BVC Registered Veterinarian',
    farmer_ai: 'Verified Poultry Farmer',
  }

  return saveClinicalLog({
    id: id || crypto.randomUUID(),
    type: 'surveillance',
    source: normalizedRole,
    reporterRole: normalizedRole,
    reporterName: String(reporterName || '').trim() || defaultReporters[normalizedRole],
    district: district || 'Rajshahi',
    upazila: String(upazila || '').trim(),
    species: species || 'Broiler',
    disease: disease || 'Avian Influenza',
    primaryDisease: disease || 'Avian Influenza',
    antibioticPrescribed: antibioticPrescribed || 'None / Supportive Only',
    mortalityCount: Math.max(0, Number(mortalityCount) || 0),
    flockSize: flockSize ? Math.max(0, Number(flockSize) || 0) : '',
    isZoonotic: zoonotic.isZoonotic,
    zoonoticSeverity: zoonotic.severity || '',
    notes: String(notes || '').trim(),
    syncedToCloud: false,
  })
}

/**
 * Saves a Prescription log entry (either image scan or doctor-issued).
 */
export function savePrescriptionLog({
  id,
  source = 'image_scan',
  roomId = '',
  roomCode = '',
  shedId = '',
  shedName = '',
  vetName = '',
  vetDegrees = '',
  bvcRegNo = '',
  clinicDetails = '',
  farmerName = '',
  farmName = '',
  district = 'Rajshahi',
  upazila = '',
  flockType = 'Broiler',
  age = '',
  flockSize = '',
  averageWeight = '',
  complaints = [],
  historyNotes = '',
  clinicalSigns = '',
  diagnosis = '',
  fileName = '',
  transcription = '',
  medications = [],
  tests = '',
  advice = '',
  followUpDate = '',
  isImmutable = false,
  lockedAt = '',
  digitalSignature = '',
  signatureDigest = '',
}) {
  return saveClinicalLog({
    id: id || crypto.randomUUID(),
    type: 'prescription',
    source,
    roomId: roomId || roomCode || '',
    roomCode: roomCode || roomId || '',
    shedId: String(shedId || ''),
    shedName: String(shedName || ''),
    vetName: vetName || (source === 'vet_issued' ? 'Dr. Md Nafizur Rahman' : 'Veterinary Prescription'),
    vetDegrees,
    bvcRegNo: bvcRegNo || (source === 'vet_issued' ? 'BVC-REG-11842' : ''),
    clinicDetails: clinicDetails || 'PoultryMedix National Avian Telehealth Hub',
    farmerName: farmerName || 'Flock Owner',
    farmName,
    district: district || 'Rajshahi',
    upazila: String(upazila || ''),
    flockType: flockType || 'Broiler',
    age,
    flockSize,
    averageWeight,
    complaints: Array.isArray(complaints) ? complaints : [],
    historyNotes,
    clinicalSigns,
    diagnosis: diagnosis || (medications[0]?.tradeName ? `Prescription: ${medications[0].tradeName}` : 'Prescription Scan'),
    fileName,
    transcription,
    medications: Array.isArray(medications) ? medications : [],
    tests,
    advice,
    followUpDate,
    isImmutable: Boolean(isImmutable || source === 'vet_issued'),
    lockedAt: lockedAt || (source === 'vet_issued' ? new Date().toISOString() : ''),
    digitalSignature,
    signatureDigest,
    syncedToCloud: false,
  })
}

/**
 * Saves a Vet Consultation Booking log entry (appointment + fee record).
 */
export function saveConsultationLog({
  id,
  trxId = '',
  roomId = '',
  roomCode = '',
  doctorId = '',
  farmerId = '',
  vetName = 'Dr. Md Nafizur Rahman',
  vetDegrees = '',
  doctorName = '',
  bvcRegNo = 'BVC-REG-11842',
  clinicDetails = 'PoultryMedix National Avian Telehealth Hub',
  bookingMode = 'registered_shed',
  shedId = '',
  shedName = '',
  farmerName = 'Registered Farmer',
  farmName = '',
  district = 'Rajshahi',
  upazila = '',
  birdType = 'Broiler',
  age = '',
  flockSize = '',
  averageWeight = '',
  bookingDate = '',
  bookingTime = '',
  concern = '',
  historyNotes = '',
  clinicalSigns = '',
  shedSummary = '',
  aiDiagnosisSummary = '',
  linkedDiagnoses = [],
  attachedPrescriptions = [],
  uploadedAttachments = [],
  paymentMethod = 'bkash',
  paymentMethodLabel = 'bKash',
  amount = 500,
  currency = 'BDT',
  paymentStatus = 'Confirmed',
}) {
  const resolvedDoctor = doctorName || vetName || 'Dr. Md Nafizur Rahman'
  const resolvedRoom = roomId || roomCode || ''
  return saveClinicalLog({
    id: id || crypto.randomUUID(),
    trxId,
    roomId: resolvedRoom,
    roomCode: resolvedRoom,
    type: 'consultation',
    doctorId,
    farmerId,
    doctorName: resolvedDoctor,
    vetName: resolvedDoctor,
    vetDegrees,
    bvcRegNo,
    clinicDetails,
    bookingMode: bookingMode === 'manual_farm' ? 'manual_farm' : 'registered_shed',
    shedId: String(shedId || ''),
    shedName: String(shedName || ''),
    farmerName: farmerName || 'Registered Farmer',
    farmName,
    district: district || 'Rajshahi',
    upazila: String(upazila || ''),
    birdType,
    age,
    flockSize,
    averageWeight,
    bookingDate,
    bookingTime,
    date: bookingDate,
    time: bookingTime,
    concern: concern || 'Flock Consultation',
    historyNotes,
    clinicalSigns,
    shedSummary,
    aiDiagnosisSummary,
    linkedDiagnoses: Array.isArray(linkedDiagnoses) ? linkedDiagnoses : [],
    attachedPrescriptions: Array.isArray(attachedPrescriptions) ? attachedPrescriptions : [],
    uploadedAttachments: Array.isArray(uploadedAttachments) ? uploadedAttachments : [],
    paymentMethod,
    paymentMethodLabel,
    amount: Number(amount) || 500,
    currency: currency || 'BDT',
    paymentStatus,
    syncedToCloud: false,
  })
}

/**
 * Saves a verified consultation payment record under Clinical Logs > Payment History.
 */
export function savePaymentLog({
  id,
  trxId,
  gatewayTrxRef = '',
  timestamp,
  method = 'bkash',
  paymentMethodLabel = 'bKash',
  accountMask = '',
  amount = 500,
  currency = 'BDT',
  doctorName = 'Dr. Md Nafizur Rahman',
  bvcRegNo = 'BVC-REG-11842',
  clinicDetails = 'PoultryMedix National Avian Telehealth Hub',
  farmerName = 'Registered Farmer',
  farmName = '',
  district = 'Rajshahi',
  bookingDate = '',
  bookingTime = '',
  concern = '',
  paymentMode = 'sandbox',
  status = 'Completed',
}) {
  const safeTrxId = trxId || id || `PMX-TRX-${Date.now()}`
  return saveClinicalLog({
    id: id || safeTrxId,
    trxId: safeTrxId,
    gatewayTrxRef,
    type: 'payment',
    timestamp: timestamp || new Date().toISOString(),
    method,
    paymentMethod: method,
    paymentMethodLabel,
    accountMask,
    amount: Number(amount) || 500,
    currency: currency || 'BDT',
    doctorName: doctorName || 'Dr. Md Nafizur Rahman',
    vetName: doctorName || 'Dr. Md Nafizur Rahman',
    bvcRegNo,
    clinicDetails,
    farmerName: farmerName || 'Registered Farmer',
    farmName,
    district: district || 'Rajshahi',
    bookingDate,
    bookingTime,
    concern,
    paymentMode,
    status: status || 'Completed',
    paymentStatus: status || 'Completed',
    syncedToCloud: false,
  })
}

/**
 * Saves a completed Audio or Video consultation call session under Clinical Logs > Vet Consultations.
 */
export function saveCallSessionLog({
  id,
  bookingId = '',
  roomId = '',
  roomCode = '',
  doctorName = 'Dr. Md Nafizur Rahman',
  bvcRegNo = 'BVC-REG-11842',
  clinicDetails = 'PoultryMedix National Avian Telehealth Hub',
  callType = 'Audio',
  duration = '00:01',
  durationSeconds = 1,
  timestamp,
  farmerName = 'Registered Farmer',
  farmName = '',
  district = 'Rajshahi',
  concern = '',
}) {
  const normalizedType = callType === 'Video' ? 'Video' : 'Audio'
  const resolvedRoomId = roomId || roomCode || bookingId || 'PMX-ROOM-LIVE'
  return saveClinicalLog({
    id: id || `call-${crypto.randomUUID()}`,
    bookingId,
    trxId: bookingId,
    roomId: resolvedRoomId,
    roomCode: resolvedRoomId,
    type: 'consultation_call',
    doctorName: doctorName || 'Dr. Md Nafizur Rahman',
    vetName: doctorName || 'Dr. Md Nafizur Rahman',
    bvcRegNo,
    clinicDetails,
    callType: normalizedType,
    duration: duration || '00:01',
    durationSeconds: Math.max(0, Number(durationSeconds) || 0),
    timestamp: timestamp || new Date().toISOString(),
    farmerName: farmerName || 'Registered Farmer',
    farmName,
    district: district || 'Rajshahi',
    concern: concern || `${normalizedType} Telemedicine Consultation`,
    status: 'Completed',
    paymentStatus: 'Completed',
    syncedToCloud: false,
  })
}

/**
 * Exports all logs as a downloadable JSON file.
 */
export function exportLogsAsJson() {
  const logs = getClinicalLogs('all')
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `poultrymedix-clinical-logs-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/**
 * Exports all logs as a downloadable CSV file for researchers and veterinarians.
 */
export function exportLogsAsCsv() {
  const logs = getClinicalLogs('all')
  const headers = [
    'Log ID',
    'Date & Time',
    'Type',
    'Source / Reporter Role',
    'District',
    'Upazila',
    'Species',
    'Primary Condition / Disease',
    'Zoonotic Risk',
    'Mortality Count',
    'Prescribed Antibiotic / Medications',
    'Withdrawal Periods (Meat / Egg)',
    'Notes & Guidance',
  ]

  const rows = logs.map((log) => {
    const meds = Array.isArray(log.medications) ? log.medications : []
    const medList = meds.length
      ? meds.map((m) => `${m.tradeName || m.name} (${m.genericName || ''})`).join('; ')
      : (log.antibioticPrescribed || '')
    const withdrawalList = meds.map((m) => `Meat: ${m.meatWithdrawalDays || '—'}, Eggs: ${m.eggWithdrawalDays || '—'}`).join('; ')
    const disease = log.disease || log.primaryDisease || log.diagnosis || ''
    const isZoonotic = Boolean(log.isZoonotic ?? getZoonoticInfo(disease).isZoonotic)

    return [
      `"${log.id || ''}"`,
      `"${log.formattedDate || log.timestamp || ''}"`,
      `"${log.type || ''}"`,
      `"${log.reporterRole || log.source || ''}"`,
      `"${log.district || 'Rajshahi'}"`,
      `"${(log.upazila || '').replace(/"/g, '""')}"`,
      `"${(log.species || log.flockType || '').replace(/"/g, '""')}"`,
      `"${disease.replace(/"/g, '""')}"`,
      `"${isZoonotic ? 'ZOONOTIC RISK' : 'No'}"`,
      Number(log.mortalityCount) || 0,
      `"${medList.replace(/"/g, '""')}"`,
      `"${withdrawalList.replace(/"/g, '""')}"`,
      `"${(log.notes || log.guidanceSummary || log.advice || log.transcription || '').replace(/"/g, '""')}"`,
    ]
  })

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `poultrymedix-clinical-logs-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
