/**
 * Centralized Clinical Logs Store for PoultryMedix AI
 *
 * Persists all Smart Diagnoses, Prescription Scans, and Doctor-issued Digital Prescriptions
 * in localStorage under 'poultrymedix_clinical_logs', structured for future backend sync.
 */

import { getZoonoticInfo, normalizeReporterSource } from './oneHealthSurveillance.js'

export const CLINICAL_LOGS_STORAGE_KEY = 'poultrymedix_clinical_logs'
export const CLINICAL_LOGS_UPDATED_EVENT = 'poultrymedix-clinical-logs-updated'

function getInitialLogs() {
  if (typeof window === 'undefined') return []
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
    // Avoid exact duplicate IDs
    const filtered = existing.filter((item) => String(item.id) !== String(id))
    const updated = [fullRecord, ...filtered].slice(0, 300)
    localStorage.setItem(CLINICAL_LOGS_STORAGE_KEY, JSON.stringify(updated))

    // Broadcast update event so open tabs/components re-render instantly
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CLINICAL_LOGS_UPDATED_EVENT, { detail: fullRecord }))
      window.dispatchEvent(new CustomEvent('poultrymedix-analytics-updated', { detail: fullRecord }))
    }
  } catch (err) {
    console.error('[clinical-logs] Failed to write log entry:', err)
  }

  return fullRecord
}

/**
 * Saves a Smart Diagnosis log entry.
 */
export function saveDiagnosisLog({
  id,
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
  vetName = '',
  bvcRegNo = '',
  clinicDetails = '',
  farmerName = '',
  district = 'Rajshahi',
  flockType = 'Broiler',
  diagnosis = '',
  fileName = '',
  transcription = '',
  medications = [],
  advice = '',
  followUpDate = '',
}) {
  return saveClinicalLog({
    id: id || crypto.randomUUID(),
    type: 'prescription',
    source,
    vetName: vetName || (source === 'vet_issued' ? 'Dr. Sarah Ahmed, DVM' : 'Veterinary Prescription'),
    bvcRegNo: bvcRegNo || (source === 'vet_issued' ? 'BVC-REG-10492' : ''),
    clinicDetails: clinicDetails || 'Avian Health & Diagnostic Care',
    farmerName: farmerName || 'Flock Owner',
    district: district || 'Rajshahi',
    flockType: flockType || 'Broiler',
    diagnosis: diagnosis || (medications[0]?.tradeName ? `Prescription: ${medications[0].tradeName}` : 'Prescription Scan'),
    fileName,
    transcription,
    medications: Array.isArray(medications) ? medications : [],
    advice,
    followUpDate,
    syncedToCloud: false,
  })
}

/**
 * Saves a Vet Consultation Booking log entry (appointment + fee record).
 */
export function saveConsultationLog({
  id,
  trxId = '',
  vetName = 'Dr. Md Nafizur Rahman',
  doctorName = '',
  bvcRegNo = 'BVC-REG-11842',
  clinicDetails = 'PoultryMedix National Avian Telehealth Hub',
  farmerName = 'Registered Farmer',
  farmName = '',
  district = 'Rajshahi',
  bookingDate = '',
  bookingTime = '',
  concern = '',
  paymentMethod = 'bkash',
  paymentMethodLabel = 'bKash',
  amount = 500,
  currency = 'BDT',
  paymentStatus = 'Confirmed',
}) {
  const resolvedDoctor = doctorName || vetName || 'Dr. Md Nafizur Rahman'
  return saveClinicalLog({
    id: id || crypto.randomUUID(),
    trxId,
    type: 'consultation',
    doctorName: resolvedDoctor,
    vetName: resolvedDoctor,
    bvcRegNo,
    clinicDetails,
    farmerName: farmerName || 'Registered Farmer',
    farmName,
    district: district || 'Rajshahi',
    bookingDate,
    bookingTime,
    date: bookingDate,
    time: bookingTime,
    concern: concern || 'Flock Consultation',
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
  return saveClinicalLog({
    id: id || `call-${crypto.randomUUID()}`,
    bookingId,
    trxId: bookingId,
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
