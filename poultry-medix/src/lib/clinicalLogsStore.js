/**
 * Centralized Clinical Logs Store for PoultryMedix AI
 *
 * Persists all Smart Diagnoses, Prescription Scans, and Doctor-issued Digital Prescriptions
 * in localStorage under 'poultrymedix_clinical_logs', structured for future backend sync.
 */

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
}) {
  return saveClinicalLog({
    id: id || crypto.randomUUID(),
    type: 'diagnosis',
    district: district || 'Rajshahi',
    primaryDisease,
    confidencePercent,
    inputModalities,
    guidanceSummary,
    breakdown,
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
  vetName = 'Dr. Sarah Ahmed, DVM',
  bvcRegNo = 'BVC-REG-10492',
  clinicDetails = 'Rajshahi Avian Diagnostic & Research Hospital',
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
  return saveClinicalLog({
    id: id || crypto.randomUUID(),
    type: 'consultation',
    vetName,
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
    'Source',
    'District',
    'Primary Condition / Diagnosis',
    'Confidence % / Details',
    'Modalities / File',
    'Medications Count',
    'Medications List',
    'Withdrawal Periods (Meat / Egg)',
    'Advice & Guidance',
  ]

  const rows = logs.map((log) => {
    const meds = Array.isArray(log.medications) ? log.medications : []
    const medList = meds.map((m) => `${m.tradeName || m.name} (${m.genericName || ''})`).join('; ')
    const withdrawalList = meds.map((m) => `Meat: ${m.meatWithdrawalDays || '—'}, Eggs: ${m.eggWithdrawalDays || '—'}`).join('; ')

    return [
      `"${log.id || ''}"`,
      `"${log.formattedDate || log.timestamp || ''}"`,
      `"${log.type || ''}"`,
      `"${log.source || ''}"`,
      `"${log.district || 'Rajshahi'}"`,
      `"${(log.primaryDisease || log.diagnosis || '').replace(/"/g, '""')}"`,
      `"${log.confidencePercent || ''}"`,
      `"${Array.isArray(log.inputModalities) ? log.inputModalities.join(', ') : (log.fileName || '')}"`,
      meds.length,
      `"${medList.replace(/"/g, '""')}"`,
      `"${withdrawalList.replace(/"/g, '""')}"`,
      `"${(log.guidanceSummary || log.advice || log.transcription || '').replace(/"/g, '""')}"`,
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
