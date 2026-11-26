import { getClinicalLogs } from './clinicalLogsStore.js'
import { evaluateConsultationScheduleWindow, getActiveRoomCalls } from './telehealthNotifier.js'
import { getConsolidatedVaccineAlarms } from './vaccineManager.js'
import { getFreeSeminars } from './seminarStore.js'

export const POULTRYMEDIX_READ_NOTIFICATIONS_KEY = 'poultrymedix_read_notifications_v1'
export const POULTRYMEDIX_NOTIFICATIONS_READ_EVENT = 'poultrymedix:notifications-read'

let memoryReadIds = new Set()

function getStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getReadNotificationIds() {
  const storage = getStorage()
  if (!storage) return new Set(memoryReadIds)
  try {
    const raw = storage.getItem(POULTRYMEDIX_READ_NOTIFICATIONS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function persistReadIds(set) {
  const arr = Array.from(set).slice(-200)
  const storage = getStorage()
  if (storage) {
    try {
      storage.setItem(POULTRYMEDIX_READ_NOTIFICATIONS_KEY, JSON.stringify(arr))
    } catch {
      memoryReadIds = new Set(arr)
    }
  } else {
    memoryReadIds = new Set(arr)
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(POULTRYMEDIX_NOTIFICATIONS_READ_EVENT))
  }
}

export function markNotificationRead(id) {
  if (!id) return
  const set = getReadNotificationIds()
  set.add(String(id))
  persistReadIds(set)
}

export function markAllNotificationsRead(ids = []) {
  const set = getReadNotificationIds()
  ids.forEach((id) => {
    if (id) set.add(String(id))
  })
  persistReadIds(set)
}

/**
 * Aggregates live notifications across all PoultryMedix app subsystems:
 * - Telemedicine Room Calls & Schedule Reminders
 * - Heat Stress & Shed Microclimate Alerts
 * - Vaccination Schedule Alarms (Today / Overdue / 1-Day Advance)
 * - Free In-App Seminar Updates (LIVE / Upcoming)
 * - Daily Care Tips & Regulatory / AMR Safety Notices
 */
export function buildAppNotifications({
  weather = null,
  heatStress = false,
  shedThermalSummary = null,
  sheds = [],
  dailyTipsEnabled = true,
  noticesEnabled = true,
  freeSeminars = null,
  language = 'en',
  nowMs = Date.now(),
} = {}) {
  const isBn = language === 'bn'
  const readSet = getReadNotificationIds()
  const items = []

  const pushItem = (entry) => {
    items.push({
      ...entry,
      isRead: readSet.has(entry.id),
    })
  }

  // 1. Telemedicine Incoming Doctor Calls & Upcoming Consultations
  const activeRooms = getActiveRoomCalls()
  for (const room of Object.values(activeRooms)) {
    if (room?.status === 'DOCTOR_CALLING') {
      pushItem({
        id: `tele-ring-${room.roomCode}-${room.initiatedAt || ''}`,
        category: 'telemedicine',
        severity: 'urgent',
        priority: 0,
        title: isBn
          ? `চিকিৎসক কল করছেন (${room.roomCode})`
          : `Incoming Consultation Call (${room.roomCode})`,
        body: isBn
          ? `${room.doctorName} রুম ${room.roomCode}-এ কল শুরু করেছেন। যুক্ত হতে টেলিমেডিসিন খুলুন।`
          : `${room.doctorName} initiated an encrypted ${room.callType || 'video'} call in Room ${room.roomCode}.`,
        meta: isBn ? 'এখনই লাইভ' : 'LIVE ROOM',
        targetView: 'telemedicine',
      })
    }
  }

  const consultations = getClinicalLogs('consultation')
  consultations.slice(0, 5).forEach((consult) => {
    if (!consult?.roomCode || activeRooms[consult.roomCode]?.status === 'COMPLETED') return
    const slotEval = evaluateConsultationScheduleWindow(consult.bookingDate, consult.bookingTime, nowMs)
    if (slotEval.phase === 'ACTIVE' || slotEval.phase === 'UPCOMING') {
      pushItem({
        id: `tele-slot-${consult.id || consult.roomCode}`,
        category: 'telemedicine',
        severity: slotEval.phase === 'ACTIVE' ? 'action' : 'info',
        priority: slotEval.phase === 'ACTIVE' ? 1 : 4,
        title: isBn
          ? `পরামর্শ রিমাইন্ডার · ${consult.roomCode}`
          : `Telemedicine Reminder · ${consult.roomCode}`,
        body: isBn
          ? `${consult.doctorName || consult.vetName} — ${consult.bookingDate} · ${consult.bookingTime} (${slotEval.countdownBn})`
          : `${consult.doctorName || consult.vetName} — ${consult.bookingDate} · ${consult.bookingTime} (${slotEval.countdownEn})`,
        meta: `${consult.bookingDate || ''} ${consult.bookingTime || ''}`.trim(),
        targetView: 'telemedicine',
      })
    }
  })

  // 2. Heat Stress & Shed Microclimate Alerts
  if (heatStress) {
    const shedName = shedThermalSummary?.highestReport?.shed?.name
    const count = shedThermalSummary?.activeAlerts?.length || 1
    pushItem({
      id: `heat-stress-${weather?.temperature ?? 'alert'}-${shedName || 'farm'}`,
      category: 'heat_stress',
      severity: 'urgent',
      priority: 1,
      title: isBn
        ? `তাপ-পীড়ন সতর্কতা${shedName ? `: ${shedName}` : ''}`
        : `Heat Stress Alert${shedName ? `: ${shedName}` : ''}`,
      body: shedThermalSummary?.highestReport
        ? (isBn ? shedThermalSummary.highestReport.adviceBn : shedThermalSummary.highestReport.adviceEn)
        : (isBn
          ? `${count}টি শেডে অতিরিক্ত তাপের ঝুঁকি রয়েছে। পরিষ্কার ঠান্ডা পানি, ইলেক্ট্রোলাইট ও বাতাস চলাচল বাড়ান।`
          : `Elevated heat-stress risk (${weather?.temperature ?? ''}°C). Increase ventilation and provide electrolytes.`),
      meta: weather?.temperature != null ? `${weather.temperature}°C` : (isBn ? 'তাপ সতর্কতা' : 'Heat Risk'),
      targetView: 'home',
      targetSection: 'sheds',
    })
  } else if (shedThermalSummary?.broodingHeatAlerts?.length > 0) {
    const first = shedThermalSummary.broodingHeatAlerts[0]
    pushItem({
      id: `brooding-heat-${first.shed?.id || 'shed'}`,
      category: 'heat_stress',
      severity: 'action',
      priority: 3,
      title: isBn
        ? `ব্রুডিং তাপমাত্রা নির্দেশনা: ${first.shed?.name || ''}`
        : `Brooding Heat Advisory: ${first.shed?.name || ''}`,
      body: isBn ? first.adviceBn : first.adviceEn,
      meta: isBn ? 'ব্রুডার তাপ' : 'Brooding',
      targetView: 'home',
      targetSection: 'sheds',
    })
  }

  // 3. Vaccination Schedule Alarms across all sheds
  const vaccineAlarms = getConsolidatedVaccineAlarms(sheds)
  vaccineAlarms.slice(0, 6).forEach((alarm) => {
    const statusLabel = alarm.status === 'due_today'
      ? (isBn ? 'আজ টিকার দিন' : 'Due Today')
      : alarm.status === 'overdue'
        ? (isBn ? 'মেয়াদোত্তীর্ণ' : 'Overdue')
        : (isBn ? 'আগামীকাল (১ দিন বাকি)' : 'Tomorrow (1-Day Alert)')
    pushItem({
      id: `vac-${alarm.recordKey}-${alarm.status}`,
      category: 'vaccine',
      severity: alarm.status === 'overdue' ? 'urgent' : alarm.status === 'due_today' ? 'action' : 'info',
      priority: alarm.status === 'due_today' ? 1 : alarm.status === 'overdue' ? 2 : 3,
      title: isBn
        ? `${statusLabel}: ${alarm.nameBn}`
        : `${statusLabel}: ${alarm.name}`,
      body: `${alarm.shedName} (${alarm.species}) · ${isBn ? alarm.routeBn : alarm.route}`,
      meta: alarm.dueDateKey || statusLabel,
      targetView: 'home',
      targetSection: 'vaccines',
    })
  })

  // 4. Free Online Seminars & Training Updates
  const seminars = Array.isArray(freeSeminars) ? freeSeminars : getFreeSeminars()
  seminars.forEach((sem) => {
    if (sem.status === 'ended') return
    const isLive = sem.status === 'live'
    pushItem({
      id: `sem-${sem.id}-${sem.status}`,
      category: 'seminar',
      severity: isLive ? 'urgent' : 'info',
      priority: isLive ? 1 : sem.isRegistered ? 3 : 5,
      title: isLive
        ? (isBn ? `লাইভ ফ্রি সেমিনার: ${sem.titleBn}` : `LIVE Free Seminar: ${sem.titleEn}`)
        : (isBn ? `আসন্ন ফ্রি সেমিনার: ${sem.titleBn}` : `Upcoming Free Seminar: ${sem.titleEn}`),
      body: `${sem.hostName} · ${sem.date} · ${sem.time} (${isBn ? 'সম্পূর্ণ ফ্রি' : '100% Free'})`,
      meta: isLive ? 'LIVE' : sem.date,
      targetView: 'seminars',
      seminarId: sem.id,
    })
  })

  // 5. Daily Tips & Regulatory / AMR Safety Notices (respecting settings toggles)
  if (noticesEnabled) {
    pushItem({
      id: 'notice-colistin-amr',
      category: 'daily_tip',
      severity: 'action',
      priority: 4,
      title: isBn ? 'কোলিস্টিন (Colistin) ব্যবহার ও AMR সতর্কতা' : 'Colistin Ban & One-Health AMR Stewardship Notice',
      body: isBn
        ? 'পোল্ট্রিতে কোলিস্টিন প্রতিরোধক হিসেবে ব্যবহার নিষিদ্ধ। পশুচিকিৎসকের অনুমোদন ও উইথড্রয়াল সময় মেনে চলুন।'
        : 'Routine Colistin use drives critical antimicrobial resistance. Use antimicrobials strictly with veterinary authorization.',
      meta: isBn ? 'জরুরি নোটিশ' : 'Stewardship',
      targetView: 'home',
      targetSection: 'notices',
    })
  }

  if (dailyTipsEnabled) {
    pushItem({
      id: 'daily-tip-water-biosecurity',
      category: 'daily_tip',
      severity: 'info',
      priority: 6,
      title: isBn ? 'দৈনিক খামার টিপস: পানির পাত্র ও লিটার পরীক্ষা' : 'Daily Farm Tip: Clean Drinkers & Dry Litter Check',
      body: isBn
        ? 'সকাল-বিকাল পানির পাত্র ধুয়ে নিন এবং ভেজা লিটার সরালে শ্বাসতন্ত্র ও কক্সিডিওসিস ঝুঁকি অনেক কমে।'
        : 'Sanitize bell/nipple drinkers twice daily and replace damp litter near drinkers to prevent ammonia buildup & coccidiosis.',
      meta: isBn ? 'দৈনিক টিপস' : 'Daily Tip',
      targetView: 'home',
      targetSection: 'notices',
    })
  }

  items.sort((a, b) => (a.priority - b.priority) || Number(a.isRead) - Number(b.isRead))
  return items
}
