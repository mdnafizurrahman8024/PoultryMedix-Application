export const DOCTORS_STORAGE_KEY = 'poultrymedix_doctors'
export const POULTRYMEDIX_DOCTORS_UPDATED_EVENT = 'poultrymedix:doctors-updated'
export const POULTRYMEDIX_DOCTORS_CHANNEL = 'poultrymedix_doctors_sync'

export const BASELINE_DOCTORS = [
  {
    id: 'dr-nafizur',
    name: 'Dr. Md Nafizur Rahman',
    degrees: 'DVM, Avian Health & Telemedicine Specialist',
    regNo: 'BVC-REG-11842',
    location: 'Rajshahi',
    locationBn: 'রাজশাহী',
    clinic: 'PoultryMedix National Avian Telehealth Hub',
    specialty: 'Poultry Disease Triage, Outbreak Control & Biosecurity',
    specialtyBn: 'পোল্ট্রি রোগ নির্ণয়, প্রাদুর্ভাব নিয়ন্ত্রণ ও বায়োসিকিউরিটি',
    experienceYears: 7,
    consultationsServed: 142,
    privacyProtected: true,
  },
  {
    id: 'dr-sarah',
    name: 'Dr. Sarah Ahmed, DVM',
    degrees: 'DVM, MS in Avian Pathology (BAU)',
    regNo: 'BVC-REG-10492',
    location: 'Rajshahi / BAU',
    locationBn: 'রাজশাহী / বাকৃবি (BAU)',
    clinic: 'Rajshahi Avian Diagnostic & Research Hospital',
    specialty: 'Avian Pathology & Respiratory Care',
    specialtyBn: 'এভিয়ান প্যাথলজি ও শ্বাসতন্ত্রের চিকিৎসা',
    experienceYears: 9,
    consultationsServed: 98,
    privacyProtected: true,
  },
  {
    id: 'dr-tariqul',
    name: 'Dr. Tariqul Islam, DVM',
    degrees: 'DVM, MSc in Veterinary Microbiology',
    regNo: 'BVC-REG-11284',
    location: 'Bogura',
    locationBn: 'বগুড়া',
    clinic: 'Bogura Poultry Health & Biosecurity Center',
    specialty: 'AMR Stewardship & Hatchery Biosecurity',
    specialtyBn: 'এএমআর প্রতিরোধ ও হ্যাচারি জৈব-নিরাপত্তা',
    experienceYears: 6,
    consultationsServed: 74,
    privacyProtected: true,
  },
  {
    id: 'dr-farhana',
    name: 'Dr. Farhana Rahman, DVM',
    degrees: 'DVM, MS in Poultry Medicine',
    regNo: 'BVC-REG-09871',
    location: 'Gazipur',
    locationBn: 'গাজীপুর',
    clinic: 'Gazipur Central Avian Clinic',
    specialty: 'Broiler & Layer Flock Management',
    specialtyBn: 'ব্রয়লার ও লেয়ার খামার ব্যবস্থাপনা',
    experienceYears: 8,
    consultationsServed: 115,
    privacyProtected: true,
  },
]

let memoryDoctors = BASELINE_DOCTORS.map((d) => ({ ...d }))

function getStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function normalizeDoctorBaseName(name) {
  return String(name || '')
    .replace(/,?\s*\bDVM\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Formats veterinarian full name and degrees without repeating trailing/leading "DVM" tokens
 * (prevents "Dr. Sarah Ahmed, DVM, DVM, MS in Avian Pathology (BAU)" in headers).
 */
export function formatVetHeaderDisplay(vetName = '', vetDegrees = '') {
  const cleanName = String(vetName || '').trim()
  let cleanDegrees = String(vetDegrees || '').trim()
  if (!cleanName && !cleanDegrees) return ''
  if (!cleanDegrees) return cleanName

  if (cleanName && /\bDVM\b/i.test(cleanName)) {
    cleanDegrees = cleanDegrees.replace(/^DVM\s*[,·\-–]?\s*/i, '').trim()
  }

  if (!cleanDegrees) return cleanName
  if (cleanName.toLowerCase().includes(cleanDegrees.toLowerCase())) return cleanName
  return `${cleanName}, ${cleanDegrees}`
}

function mergeWithBaseline(list) {
  const incomingById = new Map()
  if (Array.isArray(list)) {
    list.forEach((doc) => {
      if (doc?.id) incomingById.set(doc.id, doc)
    })
  }
  return BASELINE_DOCTORS.map((base) => {
    const saved = incomingById.get(base.id)
    if (!saved) return { ...base }
    return {
      ...base,
      ...saved,
      experienceYears: Math.max(1, Number(saved.experienceYears) || base.experienceYears),
      consultationsServed: Math.max(base.consultationsServed, Number(saved.consultationsServed) || base.consultationsServed),
    }
  })
}

function broadcastDoctorsUpdated(doctors) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(POULTRYMEDIX_DOCTORS_UPDATED_EVENT, { detail: { doctors } }))
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const ch = new BroadcastChannel(POULTRYMEDIX_DOCTORS_CHANNEL)
      ch.postMessage({ type: 'doctors-updated', doctors })
      ch.close()
    } catch {
      // ignore if BroadcastChannel unavailable
    }
  }
}

function persistDoctorsDirectory(doctors) {
  const storage = getStorage()
  if (storage) {
    try {
      storage.setItem(DOCTORS_STORAGE_KEY, JSON.stringify(doctors))
    } catch {
      memoryDoctors = doctors
    }
  } else {
    memoryDoctors = doctors
  }
  broadcastDoctorsUpdated(doctors)
  return doctors
}

export function getDoctorsDirectory() {
  const storage = getStorage()
  if (!storage) return memoryDoctors.map((d) => ({ ...d }))
  try {
    const raw = storage.getItem(DOCTORS_STORAGE_KEY)
    if (!raw) {
      const seeded = BASELINE_DOCTORS.map((d) => ({ ...d }))
      storage.setItem(DOCTORS_STORAGE_KEY, JSON.stringify(seeded))
      return seeded
    }
    const parsed = JSON.parse(raw)
    const merged = mergeWithBaseline(parsed)
    return merged
  } catch {
    return BASELINE_DOCTORS.map((d) => ({ ...d }))
  }
}

export function findDoctorProfile({ id = '', name = '', regNo = '' } = {}, list = null) {
  const doctors = Array.isArray(list) ? list : getDoctorsDirectory()
  if (id) {
    const byId = doctors.find((d) => d.id === id)
    if (byId) return byId
  }
  if (regNo) {
    const byReg = doctors.find((d) => String(d.regNo).toUpperCase() === String(regNo).trim().toUpperCase())
    if (byReg) return byReg
  }
  if (name) {
    const target = normalizeDoctorBaseName(name)
    const byName = doctors.find((d) => normalizeDoctorBaseName(d.name) === target)
    if (byName) return byName
  }
  return doctors[0]
}

export function incrementDoctorServiceCounter({ doctorId = '', doctorName = '', bvcRegNo = '' } = {}) {
  const current = getDoctorsDirectory()
  const matched = findDoctorProfile({ id: doctorId, name: doctorName, regNo: bvcRegNo }, current)
  if (!matched) return current
  const next = current.map((doc) => (
    doc.id === matched.id
      ? { ...doc, consultationsServed: (Number(doc.consultationsServed) || 0) + 1 }
      : doc
  ))
  return persistDoctorsDirectory(next)
}
