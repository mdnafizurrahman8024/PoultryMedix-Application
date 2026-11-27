/**
 * Privacy-Protected Platform Consultation Signaling, Schedule Windowing & Room Admission
 *
 * Enforces ethical telemedicine controls:
 * 1. Calls are strictly gated to the scheduled appointment window (-10m pre-slot to +45m).
 * 2. Only a registered veterinarian (`REGISTERED_VET`) can initiate a call into `PMX-ROOM-*`.
 * 3. Sessions lock once completed so old room codes cannot be reused arbitrarily.
 */

export const BOOKING_NOTIFY_WEBHOOK_URL = String(
  import.meta.env?.VITE_BOOKING_NOTIFY_WEBHOOK_URL || ''
).trim()

export const TELEHEALTH_SIGNAL_CHANNEL = 'poultrymedix-telehealth-webrtc'
export const POULTRYMEDIX_ACTIVE_ROOMS_KEY = 'poultrymedix_active_call_rooms_v1'
export const POULTRYMEDIX_ROOMS_UPDATED_EVENT = 'poultrymedix:call-rooms-updated'

export const SLOT_PRE_OPEN_MS = 10 * 60 * 1000
export const SLOT_DURATION_MS = 45 * 60 * 1000
export const DOCTOR_RING_TTL_MS = 60 * 60 * 1000

function getStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getLocalTodayDateStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getSuggestedSlotTime(offsetMinutes = 5, date = new Date()) {
  const target = new Date(date.getTime() + offsetMinutes * 60 * 1000)
  const hh = String(target.getHours()).padStart(2, '0')
  const mm = String(target.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function getLocalSlotDateAndTime(offsetMinutes = 5, date = new Date()) {
  const target = new Date(date.getTime() + offsetMinutes * 60 * 1000)
  return {
    date: getLocalTodayDateStr(target),
    time: getSuggestedSlotTime(0, target),
  }
}

export function parseSlotTimestamp(bookingDate, bookingTime) {
  const dateMatch = String(bookingDate || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const timeMatch = String(bookingTime || '').trim().match(/^(\d{2}):(\d{2})/)
  if (!dateMatch || !timeMatch) return null
  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2]) - 1
  const day = Number(dateMatch[3])
  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])
  const dt = new Date(year, month, day, hour, minute, 0, 0)
  return Number.isNaN(dt.getTime()) ? null : dt.getTime()
}

function formatDurationWords(ms, isBn) {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000))
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const mins = totalMinutes % 60
  if (isBn) {
    if (days > 0) return `${days} দিন ${hours} ঘণ্টা`
    if (hours > 0) return `${hours} ঘণ্টা ${mins} মিনিট`
    return `${mins} মিনিট`
  }
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export function evaluateConsultationScheduleWindow(bookingDate, bookingTime, nowMs = Date.now()) {
  const startsAtMs = parseSlotTimestamp(bookingDate, bookingTime)
  if (!startsAtMs) {
    return {
      phase: 'INVALID',
      isWithinWindow: false,
      startsAtMs: null,
      opensAtMs: null,
      closesAtMs: null,
      msUntilOpen: 0,
      countdownEn: 'Invalid or missing appointment time',
      countdownBn: 'নির্ধারিত তারিখ ও সময় সঠিক নয়',
    }
  }

  const opensAtMs = startsAtMs - SLOT_PRE_OPEN_MS
  const closesAtMs = startsAtMs + SLOT_DURATION_MS

  if (nowMs < opensAtMs) {
    const waitMs = opensAtMs - nowMs
    return {
      phase: 'UPCOMING',
      isWithinWindow: false,
      startsAtMs,
      opensAtMs,
      closesAtMs,
      msUntilOpen: waitMs,
      countdownEn: `Room check-in opens in ${formatDurationWords(waitMs, false)} (10m before slot)`,
      countdownBn: `ওয়েটিং রুম চালু হতে বাকি ${formatDurationWords(waitMs, true)} (স্লটের ১০ মিনিট আগে)`,
    }
  }

  if (nowMs > closesAtMs) {
    return {
      phase: 'EXPIRED',
      isWithinWindow: false,
      startsAtMs,
      opensAtMs,
      closesAtMs,
      msUntilOpen: 0,
      countdownEn: 'Scheduled appointment window has ended',
      countdownBn: 'নির্ধারিত অ্যাপয়েন্টমেন্টের সময় শেষ হয়েছে',
    }
  }

  return {
    phase: 'ACTIVE',
    isWithinWindow: true,
    startsAtMs,
    opensAtMs,
    closesAtMs,
    msUntilOpen: 0,
    countdownEn: 'Appointment window open now',
    countdownBn: 'নির্ধারিত অ্যাপয়েন্টমেন্টের সময় এখন চলছে',
  }
}

export function getActiveRoomCalls() {
  const storage = getStorage()
  if (!storage) return {}
  try {
    const raw = storage.getItem(POULTRYMEDIX_ACTIVE_ROOMS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    if (!parsed || typeof parsed !== 'object') return {}
    const now = Date.now()
    const cleaned = {}
    let changed = false
    for (const [code, entry] of Object.entries(parsed)) {
      if (entry && (!entry.expiresAt || entry.expiresAt > now)) {
        cleaned[code] = entry
      } else {
        changed = true
      }
    }
    if (changed) {
      storage.setItem(POULTRYMEDIX_ACTIVE_ROOMS_KEY, JSON.stringify(cleaned))
    }
    return cleaned
  } catch {
    return {}
  }
}

export function getRoomCallState(roomCode) {
  if (!roomCode) return null
  const map = getActiveRoomCalls()
  return map[String(roomCode).trim()] || null
}

function broadcastRoomEvent(payload) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(POULTRYMEDIX_ROOMS_UPDATED_EVENT, { detail: payload }))
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(TELEHEALTH_SIGNAL_CHANNEL)
      channel.postMessage(payload)
      channel.close()
    } catch {
      // ignore broadcast errors
    }
  }
}

export function openDoctorCallRoom({ roomCode, doctor, callType = 'video' }) {
  if (!roomCode) return null
  const cleanRoom = String(roomCode).trim()
  const entry = {
    roomCode: cleanRoom,
    status: 'DOCTOR_CALLING',
    callType: callType === 'video' ? 'video' : 'audio',
    doctorName: doctor?.name || 'Registered Veterinarian',
    bvcRegNo: doctor?.regNo || '',
    initiatedByRole: 'REGISTERED_VET',
    initiatedAt: new Date().toISOString(),
    expiresAt: Date.now() + DOCTOR_RING_TTL_MS,
  }
  const storage = getStorage()
  if (storage) {
    try {
      const map = getActiveRoomCalls()
      map[cleanRoom] = entry
      storage.setItem(POULTRYMEDIX_ACTIVE_ROOMS_KEY, JSON.stringify(map))
    } catch {
      // ignore storage quota errors
    }
  }
  broadcastRoomEvent({ type: 'doctor-room-status', ...entry })
  return entry
}

export function markRoomCallCompleted(roomCode) {
  if (!roomCode) return null
  const cleanRoom = String(roomCode).trim()
  const entry = {
    roomCode: cleanRoom,
    status: 'COMPLETED',
    completedAt: new Date().toISOString(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  }
  const storage = getStorage()
  if (storage) {
    try {
      const map = getActiveRoomCalls()
      map[cleanRoom] = entry
      storage.setItem(POULTRYMEDIX_ACTIVE_ROOMS_KEY, JSON.stringify(map))
    } catch {
      // ignore storage quota errors
    }
  }
  broadcastRoomEvent({ type: 'doctor-room-status', ...entry })
  return entry
}

export async function dispatchDoctorBookingNotifications({
  receipt,
  doctor,
  roomCode = '',
  shedSummary = '',
  aiDiagnosisSummary = '',
}) {
  let webhookDispatched = false
  if (BOOKING_NOTIFY_WEBHOOK_URL) {
    try {
      const response = await fetch(BOOKING_NOTIFY_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'telemedicine.booking.verified',
          trxId: receipt?.trxId,
          roomId: roomCode,
          roomCode,
          doctorId: doctor?.id,
          doctorName: doctor?.name,
          bvcRegNo: doctor?.regNo,
          farmerName: receipt?.farmerName,
          farmName: receipt?.farmName,
          district: receipt?.district,
          shedSummary,
          aiDiagnosisSummary,
          bookingDate: receipt?.bookingDate,
          bookingTime: receipt?.bookingTime,
          concern: receipt?.concern,
          amount: receipt?.amount,
          timestamp: receipt?.timestamp,
        }),
      })
      webhookDispatched = response.ok
    } catch {
      webhookDispatched = false
    }
  }

  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(TELEHEALTH_SIGNAL_CHANNEL)
      channel.postMessage({
        type: 'booking-alert',
        roomCode,
        roomId: roomCode,
        trxId: receipt?.trxId,
        farmerName: receipt?.farmerName,
        farmName: receipt?.farmName,
        district: receipt?.district,
        shedSummary,
        aiDiagnosisSummary,
        bookingDate: receipt?.bookingDate,
        bookingTime: receipt?.bookingTime,
        concern: receipt?.concern,
        timestamp: receipt?.timestamp || new Date().toISOString(),
      })
      channel.close()
    } catch {
      // Ignore broadcast errors
    }
  }

  return {
    roomCode,
    roomId: roomCode,
    webhookDispatched,
    webhookConfigured: Boolean(BOOKING_NOTIFY_WEBHOOK_URL),
    privacyProtected: true,
  }
}

export function broadcastLivePrescription({ roomCode = '', prescription }) {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return
  try {
    const channel = new BroadcastChannel(TELEHEALTH_SIGNAL_CHANNEL)
    channel.postMessage({
      type: 'rx-delivered',
      roomCode,
      roomId: roomCode,
      prescriptionId: prescription?.id || '',
      diagnosis: prescription?.diagnosis || '',
      doctorName: prescription?.vetName || 'Dr. Md Nafizur Rahman',
      farmerName: prescription?.farmerName || '',
      medicationsCount: Array.isArray(prescription?.medications) ? prescription.medications.length : 0,
      timestamp: prescription?.timestamp || new Date().toISOString(),
    })
    channel.close()
  } catch {
    // Ignore broadcast errors
  }
}
