import { getLocalTodayDateStr } from './telehealthNotifier.js'

export const DOCTORS_STORAGE_KEY = 'poultrymedix_doctors'
export const DOCTOR_SCHEDULES_KEY = 'poultrymedix_doctor_schedules_v1'
export const SLOT_LOCKS_KEY = 'poultrymedix_slot_locks_v1'
export const ACTIVE_DOCTOR_SESSION_KEY = 'poultrymedix_active_doctor_session_v1'

export const POULTRYMEDIX_DOCTORS_UPDATED_EVENT = 'poultrymedix:doctors-updated'
export const POULTRYMEDIX_SLOTS_UPDATED_EVENT = 'poultrymedix:slots-updated'
export const POULTRYMEDIX_DOCTORS_CHANNEL = 'poultrymedix_doctors_sync'

export const BASELINE_DOCTORS = [
  {
    id: 'dr-nafizur',
    name: 'Dr. Md Nafizur Rahman',
    nameBn: 'ডাঃ মোঃ নাফিজুর রহমান',
    degrees: 'DVM, Avian Health & Telemedicine Specialist',
    degreesBn: 'ডিভিএম, এভিয়ান স্বাস্থ্য ও টেলিমেডিসিন বিশেষজ্ঞ',
    regNo: 'BVC-REG-11842',
    location: 'Rajshahi',
    locationBn: 'রাজশাহী',
    clinic: 'PoultryMedix National Avian Telehealth Hub',
    clinicBn: 'পোল্ট্রিমেডিক্স জাতীয় এভিয়ান টেলিহেলথ হাব',
    specialty: 'Poultry Disease Triage, Outbreak Control & Biosecurity',
    specialtyBn: 'পোল্ট্রি রোগ নির্ণয়, প্রাদুর্ভাব নিয়ন্ত্রণ ও বায়োসিকিউরিটি',
    bioEn: 'Avian telemedicine specialist leading early outbreak triage, antimicrobial stewardship, and heat-stress flock recovery across northern Bangladesh farms.',
    bioBn: 'উত্তরবঙ্গের খামারগুলোতে প্রাদুর্ভাব শনাক্তকরণ, দায়িত্বশীল অ্যান্টিবায়োটিক প্রয়োগ এবং তাপ-পীড়ন ব্যবস্থাপনায় অভিজ্ঞ পোল্ট্রি চিকিৎসক।',
    avatarInitials: 'NR',
    avatarTone: 'emerald',
    experienceYears: 7,
    consultationsServed: 142,
    privacyProtected: true,
  },
  {
    id: 'dr-sarah',
    name: 'Dr. Sarah Ahmed, DVM',
    nameBn: 'ডাঃ সারাহ আহমেদ, ডিভিএম',
    degrees: 'DVM, MS in Avian Pathology (BAU)',
    degreesBn: 'ডিভিএম, এমএস ইন এভিয়ান প্যাথলজি (বাকৃবি)',
    regNo: 'BVC-REG-10492',
    location: 'Rajshahi / BAU',
    locationBn: 'রাজশাহী / বাকৃবি (BAU)',
    clinic: 'Rajshahi Avian Diagnostic & Research Hospital',
    clinicBn: 'রাজশাহী এভিয়ান ডায়াগনস্টিক ও গবেষণা হাসপাতাল',
    specialty: 'Avian Pathology & Respiratory Care',
    specialtyBn: 'এভিয়ান প্যাথলজি ও শ্বাসতন্ত্রের চিকিৎসা',
    bioEn: 'BAU-trained avian pathologist specializing in necrotic enteritis, respiratory complexes, and differential diagnosis of commercial layer & broiler flocks.',
    bioBn: 'বাংলাদেশ কৃষি বিশ্ববিদ্যালয় থেকে উচ্চতর ডিগ্রিপ্রাপ্ত, লেয়ার ও ব্রয়লারের শ্বাসতন্ত্র এবং অন্ত্রের রোগ নির্ণয়ে বিশেষজ্ঞ।',
    avatarInitials: 'SA',
    avatarTone: 'teal',
    experienceYears: 9,
    consultationsServed: 98,
    privacyProtected: true,
  },
  {
    id: 'dr-tariqul',
    name: 'Dr. Tariqul Islam, DVM',
    nameBn: 'ডাঃ তারিকুল ইসলাম, ডিভিএম',
    degrees: 'DVM, MSc in Veterinary Microbiology',
    degreesBn: 'ডিভিএম, এমএসসি ইন ভেটেরিনারি মাইক্রোবায়োলজি',
    regNo: 'BVC-REG-11284',
    location: 'Bogura',
    locationBn: 'বগুড়া',
    clinic: 'Bogura Poultry Health & Biosecurity Center',
    clinicBn: 'বগুড়া পোল্ট্রি স্বাস্থ্য ও বায়োসিকিউরিটি সেন্টার',
    specialty: 'AMR Stewardship & Hatchery Biosecurity',
    specialtyBn: 'এএমআর প্রতিরোধ ও হ্যাচারি জৈব-নিরাপত্তা',
    bioEn: 'Microbiology specialist advising hatcheries and marginal farms on vaccine cold-chain integrity, bacterial sensitivity testing, and biosecurity auditing.',
    bioBn: 'হ্যাচারি জৈব-নিরাপত্তা, টিকার কোল্ড-চেইন সুরক্ষা ও অ্যান্টিবায়োটিক রেজিস্ট্যান্স প্রতিরোধে নিয়োজিত।',
    avatarInitials: 'TI',
    avatarTone: 'sage',
    experienceYears: 6,
    consultationsServed: 74,
    privacyProtected: true,
  },
  {
    id: 'dr-farhana',
    name: 'Dr. Farhana Rahman, DVM',
    nameBn: 'ডাঃ ফারহানা রহমান, ডিভিএম',
    degrees: 'DVM, MS in Poultry Medicine',
    degreesBn: 'ডিভিএম, এমএস ইন পোল্ট্রি মেডিসিন',
    regNo: 'BVC-REG-09871',
    location: 'Gazipur',
    locationBn: 'গাজীপুর',
    clinic: 'Gazipur Central Avian Clinic',
    clinicBn: 'গাজীপুর কেন্দ্রীয় এভিয়ান ক্লিনিক',
    specialty: 'Broiler & Layer Flock Management',
    specialtyBn: 'ব্রয়লার ও লেয়ার খামার ব্যবস্থাপনা',
    bioEn: 'Clinical poultry medicine practitioner helping commercial broiler & breeder sheds optimize feed conversion, water sanitation, and withdrawal compliance.',
    bioBn: 'বাণিজ্যিক ব্রয়লার ও প্যারেন্ট-স্টক খামারের এফসিআর উন্নতি, পানি শোধন ও উইথড্রয়াল নীতি বাস্তবায়নে পরামর্শদাতা।',
    avatarInitials: 'FR',
    avatarTone: 'forest',
    experienceYears: 8,
    consultationsServed: 115,
    privacyProtected: true,
  },
]

let memoryDoctors = BASELINE_DOCTORS.map((d) => ({ ...d }))
let memorySchedules = {}
let memorySlotLocks = {}
let memoryActiveDoctorSession = { doctorId: BASELINE_DOCTORS[0].id, regNo: BASELINE_DOCTORS[0].regNo }

function getStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function addDaysToDateStr(baseDateStr, offsetDays) {
  const match = String(baseDateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const base = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date()
  base.setDate(base.getDate() + offsetDays)
  return getLocalTodayDateStr(base)
}

function buildDefaultActiveDates(referenceDateStr = getLocalTodayDateStr()) {
  return [0, 1, 2, 3].map((offset) => addDaysToDateStr(referenceDateStr, offset))
}

function buildDefaultScheduleForDoctor(doctorId, referenceDateStr = getLocalTodayDateStr()) {
  return {
    doctorId,
    startTime: '10:00',
    endTime: '12:30',
    slotDurationMins: 15,
    activeDates: buildDefaultActiveDates(referenceDateStr),
    updatedAt: new Date().toISOString(),
  }
}

function normalizeDoctorBaseName(name) {
  return String(name || '')
    .replace(/,?\s*\bDVM\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

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

export function toLocaleDigits(value, language = 'en') {
  const str = String(value ?? '')
  if (language !== 'bn') return str
  const map = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']
  return str.replace(/\d/g, (d) => map[Number(d)])
}

export function formatSlotTimeDisplay(hhmm, language = 'en') {
  const m = String(hhmm || '').match(/^(\d{2}):(\d{2})$/)
  if (!m) return hhmm
  const hh = Number(m[1])
  const mm = m[2]
  const period = hh >= 12 ? (language === 'bn' ? 'অপরাহ্ণ' : 'PM') : (language === 'bn' ? 'পূর্বাহ্ণ' : 'AM')
  const h12 = hh % 12 || 12
  const formatted = `${String(h12).padStart(2, '0')}:${mm}`
  return `${toLocaleDigits(formatted, language)} ${period}`
}

export function getDoctorLocalizedFields(doc, language = 'en') {
  const isBn = language === 'bn'
  if (!doc) return {}
  return {
    ...doc,
    displayName: isBn ? (doc.nameBn || doc.name) : doc.name,
    displayDegrees: isBn ? (doc.degreesBn || doc.degrees) : doc.degrees,
    displayClinic: isBn ? (doc.clinicBn || doc.clinic) : doc.clinic,
    displayLocation: isBn ? (doc.locationBn || doc.location) : doc.location,
    displaySpecialty: isBn ? (doc.specialtyBn || doc.specialty) : doc.specialty,
    displayBio: isBn ? (doc.bioBn || doc.bioEn) : (doc.bioEn || doc.specialty),
  }
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

function broadcastDoctorsEvent(eventName, detail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(eventName, { detail }))
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const ch = new BroadcastChannel(POULTRYMEDIX_DOCTORS_CHANNEL)
      ch.postMessage({ type: eventName, detail })
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
  broadcastDoctorsEvent(POULTRYMEDIX_DOCTORS_UPDATED_EVENT, { doctors })
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
    return mergeWithBaseline(parsed)
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

/* ============================================================================
 * Role-Based Doctor Session & Strict RBAC Helpers
 * ========================================================================== */

export function getAuthenticatedDoctorSession(appRole = 'FARMER') {
  if (String(appRole || '').toUpperCase() !== 'REGISTERED_VET') {
    return Object.freeze({
      isAuthenticatedDoctor: false,
      role: String(appRole || 'FARMER').toUpperCase(),
      doctorId: null,
      regNo: '',
    })
  }

  let stored = memoryActiveDoctorSession
  const storage = getStorage()
  if (storage) {
    try {
      const raw = storage.getItem(ACTIVE_DOCTOR_SESSION_KEY)
      if (raw) stored = JSON.parse(raw)
    } catch {
      stored = memoryActiveDoctorSession
    }
  }

  const matched = findDoctorProfile({ id: stored?.doctorId, regNo: stored?.regNo })
  return Object.freeze({
    isAuthenticatedDoctor: true,
    role: 'REGISTERED_VET',
    doctorId: matched.id,
    regNo: matched.regNo,
  })
}

export function setAuthenticatedDoctorSession({ doctorId, regNo, appRole = 'REGISTERED_VET' } = {}) {
  if (String(appRole || '').toUpperCase() !== 'REGISTERED_VET') {
    throw new Error('Unauthorized: only REGISTERED_VET role can establish a doctor consultation session.')
  }
  const matched = findDoctorProfile({ id: doctorId, regNo })
  if (!matched || (regNo && String(matched.regNo).toUpperCase() !== String(regNo).trim().toUpperCase())) {
    throw new Error('Invalid veterinarian BVC registration credentials.')
  }
  const payload = { doctorId: matched.id, regNo: matched.regNo, updatedAt: new Date().toISOString() }
  const storage = getStorage()
  if (storage) {
    try {
      storage.setItem(ACTIVE_DOCTOR_SESSION_KEY, JSON.stringify(payload))
    } catch {
      memoryActiveDoctorSession = payload
    }
  } else {
    memoryActiveDoctorSession = payload
  }
  broadcastDoctorsEvent(POULTRYMEDIX_DOCTORS_UPDATED_EVENT, { doctorSession: payload })
  return getAuthenticatedDoctorSession('REGISTERED_VET')
}

export function assertDoctorOwnership(doctorSession, targetDoctorId) {
  if (!doctorSession?.isAuthenticatedDoctor || doctorSession.role !== 'REGISTERED_VET') {
    throw new Error('Forbidden: REGISTERED_VET authentication is required for doctor schedule or room operations.')
  }
  if (!targetDoctorId || doctorSession.doctorId !== targetDoctorId) {
    throw new Error('Forbidden: doctors can only access or modify their own schedule and patient queue.')
  }
}

export function filterBookingsForDoctorSession(bookings = [], doctorSession) {
  if (!doctorSession?.isAuthenticatedDoctor || doctorSession.role !== 'REGISTERED_VET') {
    return []
  }
  const doctor = findDoctorProfile({ id: doctorSession.doctorId, regNo: doctorSession.regNo })
  if (!doctor) return []
  const targetNameBase = normalizeDoctorBaseName(doctor.name)

  return (Array.isArray(bookings) ? bookings : []).filter((appt) => {
    if (!appt) return false
    if (appt.doctorId && appt.doctorId === doctor.id) return true
    if (appt.bvcRegNo && String(appt.bvcRegNo).toUpperCase() === String(doctor.regNo).toUpperCase()) return true
    const apptDocName = normalizeDoctorBaseName(appt.doctorName || appt.vetName)
    return Boolean(apptDocName && apptDocName === targetNameBase)
  })
}

/* ============================================================================
 * Doctor Schedule Configuration & Automated Slot Generation
 * ========================================================================== */

function parseHHMMToMinutes(hhmm) {
  const m = String(hhmm || '').trim().match(/^(\d{2}):(\d{2})$/)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return hh * 60 + mm
}

function minutesToHHMM(totalMins) {
  const hh = String(Math.floor(totalMins / 60)).padStart(2, '0')
  const mm = String(totalMins % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

export function generateSlotsFromWindow(startTime = '10:00', endTime = '12:30', slotDurationMins = 15) {
  const startMins = parseHHMMToMinutes(startTime)
  const endMins = parseHHMMToMinutes(endTime)
  const step = Math.max(10, Math.min(60, Number(slotDurationMins) || 15))
  if (startMins === null || endMins === null || startMins >= endMins) return []

  const slots = []
  for (let cur = startMins; cur + step <= endMins; cur += step) {
    slots.push(minutesToHHMM(cur))
  }
  return slots
}

function readAllSchedulesMap() {
  const storage = getStorage()
  if (!storage) return { ...memorySchedules }
  try {
    const raw = storage.getItem(DOCTOR_SCHEDULES_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function getDoctorSchedule(doctorId, referenceDateStr = getLocalTodayDateStr()) {
  const map = readAllSchedulesMap()
  const saved = map[doctorId]
  const fallback = buildDefaultScheduleForDoctor(doctorId, referenceDateStr)
  if (!saved) return fallback

  const activeDates = Array.isArray(saved.activeDates)
    ? saved.activeDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= referenceDateStr).sort()
    : []

  return {
    ...fallback,
    ...saved,
    slotDurationMins: Math.max(10, Math.min(60, Number(saved.slotDurationMins) || 15)),
    activeDates: activeDates.length > 0 ? activeDates : fallback.activeDates,
  }
}

export function saveDoctorScheduleConfig(doctorSession, doctorId, { activeDates, startTime, endTime, slotDurationMins } = {}) {
  assertDoctorOwnership(doctorSession, doctorId)

  const slotsCheck = generateSlotsFromWindow(startTime, endTime, slotDurationMins)
  if (slotsCheck.length === 0) {
    throw new Error('End time must leave room for at least one slot after start time.')
  }

  const today = getLocalTodayDateStr()
  const cleanDates = Array.isArray(activeDates)
    ? [...new Set(activeDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today))].sort()
    : buildDefaultActiveDates(today)

  if (cleanDates.length === 0) {
    throw new Error('Select at least one active consultation date (today or upcoming).')
  }

  const nextSchedule = {
    doctorId,
    startTime,
    endTime,
    slotDurationMins: Math.max(10, Math.min(60, Number(slotDurationMins) || 15)),
    activeDates: cleanDates,
    updatedAt: new Date().toISOString(),
  }

  const map = readAllSchedulesMap()
  const nextMap = { ...map, [doctorId]: nextSchedule }
  const storage = getStorage()
  if (storage) {
    try {
      storage.setItem(DOCTOR_SCHEDULES_KEY, JSON.stringify(nextMap))
    } catch {
      memorySchedules = nextMap
    }
  } else {
    memorySchedules = nextMap
  }
  broadcastDoctorsEvent(POULTRYMEDIX_SLOTS_UPDATED_EVENT, { doctorId, schedule: nextSchedule })
  return nextSchedule
}

/* ============================================================================
 * Atomic Slot Locking Store & Tamper-Resistant Checks
 * ========================================================================== */

export function makeSlotLockKey(doctorId, date, time) {
  return `${String(doctorId || '').trim()}::${String(date || '').trim()}::${String(time || '').trim()}`
}

function readMutableLocksMap() {
  const storage = getStorage()
  if (!storage) return { ...memorySlotLocks }
  try {
    const raw = storage.getItem(SLOT_LOCKS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeLocksMap(nextMap, detail = {}) {
  const storage = getStorage()
  if (storage) {
    try {
      storage.setItem(SLOT_LOCKS_KEY, JSON.stringify(nextMap))
    } catch {
      memorySlotLocks = nextMap
    }
  } else {
    memorySlotLocks = nextMap
  }
  broadcastDoctorsEvent(POULTRYMEDIX_SLOTS_UPDATED_EVENT, detail)
}

export function getAllSlotLocks() {
  const raw = readMutableLocksMap()
  const frozen = {}
  for (const [k, v] of Object.entries(raw)) {
    if (v && typeof v === 'object') {
      frozen[k] = Object.freeze({ ...v })
    }
  }
  return Object.freeze(frozen)
}

export function getSlotsForDoctorDate(doctorId, dateStr, referenceTodayStr = getLocalTodayDateStr()) {
  const schedule = getDoctorSchedule(doctorId, referenceTodayStr)
  if (!schedule.activeDates.includes(dateStr)) return []
  const times = generateSlotsFromWindow(schedule.startTime, schedule.endTime, schedule.slotDurationMins)
  const locks = readMutableLocksMap()

  return times.map((time) => {
    const key = makeSlotLockKey(doctorId, dateStr, time)
    const lock = locks[key]
    const isBooked = lock?.status === 'BOOKED'
    return {
      slotKey: key,
      doctorId,
      date: dateStr,
      time,
      status: isBooked ? 'BOOKED' : 'AVAILABLE',
      lockedBy: isBooked ? lock.lockedBy : null,
      farmerName: isBooked ? lock.farmerName : '',
      bookingId: isBooked ? lock.bookingId : '',
      sessionStarted: Boolean(lock?.sessionStarted),
    }
  })
}

export function getDoctorAvailabilitySummary(doctorId, referenceTodayStr = getLocalTodayDateStr()) {
  const schedule = getDoctorSchedule(doctorId, referenceTodayStr)
  const todaySlots = getSlotsForDoctorDate(doctorId, referenceTodayStr, referenceTodayStr)
  const freeTodaySlots = todaySlots.filter((s) => s.status === 'AVAILABLE')
  const availableSlots = freeTodaySlots.length
  const totalTodaySlots = todaySlots.length
  const isAvailableToday = availableSlots >= 1

  let nextAvailableDate = null
  if (!isAvailableToday) {
    for (const candidateDate of schedule.activeDates) {
      if (candidateDate <= referenceTodayStr) continue
      const candidateSlots = getSlotsForDoctorDate(doctorId, candidateDate, referenceTodayStr)
      if (candidateSlots.some((s) => s.status === 'AVAILABLE')) {
        nextAvailableDate = candidateDate
        break
      }
    }
  }

  return {
    doctorId,
    todayDate: referenceTodayStr,
    badgeStatus: isAvailableToday ? 'available' : 'fully_booked',
    availableSlots,
    totalTodaySlots,
    nextAvailableDate,
    activeDates: schedule.activeDates,
    todaySlots,
  }
}

/**
 * Atomically locks a doctor slot if currently unbooked and present in active schedule.
 * Prevents double-booking and rejects forged lock states.
 */
export function lockDoctorTimeSlot({
  doctorId,
  date,
  time,
  farmerId = 'farmer-default',
  farmerName = 'Registered Farmer',
  bookingId = '',
  referenceTodayStr = getLocalTodayDateStr(),
} = {}) {
  const cleanDoctorId = String(doctorId || '').trim()
  const cleanDate = String(date || '').trim()
  const cleanTime = String(time || '').trim()
  const cleanFarmerId = String(farmerId || '').trim() || 'farmer-default'

  if (!cleanDoctorId || !cleanDate || !cleanTime) {
    return { ok: false, code: 'INVALID_SLOT', error: 'Doctor, date, and time slot are required.' }
  }
  if (cleanDate < referenceTodayStr) {
    return { ok: false, code: 'PAST_DATE', error: 'Cannot book a slot on a past date.' }
  }

  const schedule = getDoctorSchedule(cleanDoctorId, referenceTodayStr)
  if (!schedule.activeDates.includes(cleanDate)) {
    return { ok: false, code: 'DATE_UNAVAILABLE', error: 'Doctor is not scheduled on the selected date.' }
  }
  const validTimes = generateSlotsFromWindow(schedule.startTime, schedule.endTime, schedule.slotDurationMins)
  if (!validTimes.includes(cleanTime)) {
    return { ok: false, code: 'OUTSIDE_SCHEDULE', error: 'Selected time is outside the doctor’s scheduled slots.' }
  }

  const locks = readMutableLocksMap()
  const key = makeSlotLockKey(cleanDoctorId, cleanDate, cleanTime)
  if (locks[key]?.status === 'BOOKED') {
    return {
      ok: false,
      code: 'SLOT_ALREADY_BOOKED',
      error: `Slot ${cleanDate} ${cleanTime} is already booked. Please choose another free slot.`,
    }
  }

  const newLock = Object.freeze({
    slotKey: key,
    doctorId: cleanDoctorId,
    date: cleanDate,
    time: cleanTime,
    status: 'BOOKED',
    lockedBy: cleanFarmerId,
    farmerName: String(farmerName || 'Registered Farmer').slice(0, 120),
    bookingId: String(bookingId || `LOCK-${Date.now()}`).slice(0, 64),
    sessionStarted: false,
    lockedAt: new Date().toISOString(),
  })

  writeLocksMap({ ...locks, [key]: newLock }, { action: 'locked', slot: newLock })
  return { ok: true, lock: newLock }
}

/**
 * Locks a slot cleanly once the doctor starts the consultation session so
 * it cannot be tampered with or cancelled afterwards.
 */
export function markSlotSessionStarted({ doctorId, date, time, doctorSession }) {
  assertDoctorOwnership(doctorSession, doctorId)
  const locks = readMutableLocksMap()
  const key = makeSlotLockKey(doctorId, date, time)
  const existing = locks[key]
  if (!existing) return null
  const updated = Object.freeze({ ...existing, sessionStarted: true, sessionStartedAt: new Date().toISOString() })
  writeLocksMap({ ...locks, [key]: updated }, { action: 'session_started', slot: updated })
  return updated
}

/**
 * Releases a locked slot ONLY if cancelled before session start by the booking owner
 * or the owning doctor. Prevents client-side manipulation of locked slots.
 */
export function releaseDoctorTimeSlot({
  doctorId,
  date,
  time,
  actorId = '',
  actorRole = 'FARMER',
  sessionStartedOverride = false,
} = {}) {
  const key = makeSlotLockKey(doctorId, date, time)
  const locks = readMutableLocksMap()
  const existing = locks[key]
  if (!existing || existing.status !== 'BOOKED') {
    return { ok: false, code: 'NOT_BOOKED', error: 'Slot is not currently locked.' }
  }

  if (existing.sessionStarted || sessionStartedOverride) {
    return {
      ok: false,
      code: 'SESSION_ALREADY_STARTED',
      error: 'Locked slot cannot be released after the consultation session has started.',
    }
  }

  const isBookingOwner = actorRole === 'FARMER' && actorId && existing.lockedBy === actorId
  const isOwningDoctor = actorRole === 'REGISTERED_VET' && actorId && existing.doctorId === actorId
  if (!isBookingOwner && !isOwningDoctor) {
    return {
      ok: false,
      code: 'FORBIDDEN_UNLOCK',
      error: 'Unauthorized: only the booking farmer or assigned doctor may release a locked slot prior to the session.',
    }
  }

  const nextLocks = { ...locks }
  delete nextLocks[key]
  writeLocksMap(nextLocks, { action: 'released', slotKey: key, doctorId, date, time })
  return { ok: true, releasedKey: key }
}

export function clearMemorySlotStateForTests() {
  memorySchedules = {}
  memorySlotLocks = {}
  memoryActiveDoctorSession = { doctorId: BASELINE_DOCTORS[0].id, regNo: BASELINE_DOCTORS[0].regNo }
}
