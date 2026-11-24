/**
 * Species-Specific Poultry Immunization Schedule Engine,
 * 1-Day Advance Alarm Scanner & Calendar Date Aggregator.
 *
 * Official References:
 * - Department of Livestock Services (DLS) & Bangladesh Livestock Research Institute (BLRI)
 * - FAO Manual on Poultry Vaccination & WOAH Terrestrial Animal Health Manual
 */

import { MS_PER_DAY, calculateCurrentAgeDays, getSheds } from './shedManager.js'

export const POULTRYMEDIX_VACCINE_RECORDS_KEY = 'poultrymedix_vaccine_records'
export const POULTRYMEDIX_VACCINES_UPDATED_EVENT = 'poultrymedix-vaccines-updated'
export const POULTRYMEDIX_ALARM_NOTIFIED_KEY = 'poultrymedix_vaccine_notified_alarms'

export const DLS_BLRI_CITATION =
  'Source: Department of Livestock Services (DLS) & Bangladesh Livestock Research Institute (BLRI) Immunization Schedules.'

export const FAO_WOAH_PREP_CITATION =
  'Source: FAO Manual on Poultry Vaccination & WOAH Terrestrial Animal Health Manual.'

export const VACCINE_PREPARATION_CHECKLIST = [
  {
    id: 'water-fast',
    titleEn: '2-Hour Pre-Vaccination Water Fast',
    titleBn: 'ভ্যাকসিনের ২ ঘণ্টা আগে পানি বন্ধ রাখুন',
    detailEn: 'Withhold drinking water for 2 hours prior to water vaccination so all birds consume the dose evenly.',
    detailBn: 'পানিতে ভ্যাকসিন দেওয়ার ২ ঘণ্টা আগে পানির পাত্র সরিয়ে নিন যেন সব পাখি সমানভাবে ডোজ পান করে।',
  },
  {
    id: 'chlorine-free',
    titleEn: 'Strictly Chlorine-Free, Cool Water',
    titleBn: 'ক্লোরিনমুক্ত ও ঠান্ডা পানি ব্যবহার করুন',
    detailEn: 'Use strictly chlorine-free, cool drinking water (chlorine neutralizes live vaccines).',
    detailBn: 'অবশ্যই ক্লোরিন ও জীবাণুনাশকমুক্ত ঠান্ডা পানি ব্যবহার করুন (ক্লোরিন জীবন্ত ভ্যাকসিন নষ্ট করে দেয়)।',
  },
  {
    id: 'vit-c-post',
    titleEn: 'Post-Vaccination Vitamin C & Electrolytes',
    titleBn: 'ভ্যাকসিনের পর ভিটামিন-সি ও ইলেক্ট্রোলাইট দিন',
    detailEn: 'Administer Vitamin C & Electrolytes post-vaccination to reduce stress and strengthen antibody response.',
    detailBn: 'ভ্যাকসিন দেওয়ার পর পাখির ধকল কমাতে ও রোগ প্রতিরোধ ক্ষমতা বাড়াতে ভিটামিন-সি ও ইলেক্ট্রোলাইট দিন।',
  },
]

export const SPECIES_VACCINE_SCHEDULES = {
  Broiler: [
    { id: 'broiler-bcrdv-1', dayLabel: 'Day 4–5', minDay: 4, maxDay: 5, name: 'BCRDV (Newcastle 1st)', nameBn: 'বিসিআরডিভি (রাণীক্ষেত ১ম ডোজ)', route: 'Eye Drop', routeBn: 'চোখে ফোঁটা', isBooster: false },
    { id: 'broiler-ibd-1', dayLabel: 'Day 10–12', minDay: 10, maxDay: 12, name: 'Gumboro (IBD 1st)', nameBn: 'গামবোরো (আইবিডি ১ম ডোজ)', route: 'Eye Drop / Water', routeBn: 'চোখে ফোঁটা / পানি', isBooster: false },
    { id: 'broiler-ibd-b', dayLabel: 'Day 17–18', minDay: 17, maxDay: 18, name: 'Gumboro (IBD Booster)', nameBn: 'গামবোরো বুস্টার', route: 'Drinking Water', routeBn: 'খাওয়ার পানি', isBooster: true },
    { id: 'broiler-bcrdv-b', dayLabel: 'Day 21–22', minDay: 21, maxDay: 22, name: 'BCRDV / LaSota Booster', nameBn: 'বিসিআরডিভি / লাসোটা বুস্টার', route: 'Drinking Water', routeBn: 'খাওয়ার পানি', isBooster: true },
  ],
  Layer: [
    { id: 'layer-mareks', dayLabel: 'Day 1', minDay: 1, maxDay: 1, name: "Marek's Disease", nameBn: 'মারেক্স ভ্যাকসিন', route: 'SC', routeBn: 'চামড়ার নিচে (SC)', isBooster: false },
    { id: 'layer-bcrdv-1', dayLabel: 'Day 4–5', minDay: 4, maxDay: 5, name: 'BCRDV (Newcastle 1st)', nameBn: 'বিসিআরডিভি (রাণীক্ষেত ১ম)', route: 'Eye Drop', routeBn: 'চোখে ফোঁটা', isBooster: false },
    { id: 'layer-ibd-1', dayLabel: 'Day 10–12', minDay: 10, maxDay: 12, name: 'Gumboro (IBD)', nameBn: 'গামবোরো (আইবিডি)', route: 'Eye Drop', routeBn: 'চোখে ফোঁটা', isBooster: false },
    { id: 'layer-ibd-b', dayLabel: 'Day 18–20', minDay: 18, maxDay: 20, name: 'Gumboro Booster', nameBn: 'গামবোরো বুস্টার', route: 'Drinking Water', routeBn: 'খাওয়ার পানি', isBooster: true },
    { id: 'layer-bcrdv-b', dayLabel: 'Day 24–26', minDay: 24, maxDay: 26, name: 'BCRDV / LaSota Booster', nameBn: 'বিসিআরডিভি / লাসোটা বুস্টার', route: 'Drinking Water', routeBn: 'খাওয়ার পানি', isBooster: true },
    { id: 'layer-fowlpox', dayLabel: 'Day 35', minDay: 35, maxDay: 35, name: 'Fowl Pox', nameBn: 'ফাউল পক্স (বসন্ত)', route: 'Wing Web', routeBn: 'ডানার পর্দায় (Wing Web)', isBooster: false },
    { id: 'layer-cholera', dayLabel: 'Day 42–45', minDay: 42, maxDay: 45, name: 'Fowl Cholera', nameBn: 'ফাউল কলেরা', route: 'SC', routeBn: 'চামড়ার নিচে (SC)', isBooster: false },
    { id: 'layer-rdv', dayLabel: 'Day 60–65', minDay: 60, maxDay: 65, name: 'RDV (Ranikhet)', nameBn: 'আরডিভি (রাণীক্ষেত)', route: 'IM', routeBn: 'মাংসপেশিতে (IM)', isBooster: false },
    { id: 'layer-salm-chol-b', dayLabel: 'Day 75–80', minDay: 75, maxDay: 80, name: 'Salmonella / Cholera Booster', nameBn: 'সালমোনেলা / কলেরা বুস্টার', route: 'SC / IM', routeBn: 'SC / IM', isBooster: true },
    { id: 'layer-nd-ib-eds', dayLabel: 'Day 110–115', minDay: 110, maxDay: 115, name: 'ND + IB + EDS Killed', nameBn: 'এনডি + আইবি + ইডিএস কিল্ড', route: 'IM', routeBn: 'মাংসপেশিতে (IM)', isBooster: true },
  ],
  Sonali: [
    { id: 'sonali-mareks', dayLabel: 'Day 1', minDay: 1, maxDay: 1, name: "Marek's Disease", nameBn: 'মারেক্স ভ্যাকসিন', route: 'SC', routeBn: 'চামড়ার নিচে (SC)', isBooster: false },
    { id: 'sonali-bcrdv-1', dayLabel: 'Day 4–5', minDay: 4, maxDay: 5, name: 'BCRDV (Newcastle 1st)', nameBn: 'বিসিআরডিভি (রাণীক্ষেত ১ম)', route: 'Eye Drop', routeBn: 'চোখে ফোঁটা', isBooster: false },
    { id: 'sonali-ibd-1', dayLabel: 'Day 10–12', minDay: 10, maxDay: 12, name: 'Gumboro (IBD)', nameBn: 'গামবোরো (আইবিডি)', route: 'Eye Drop / Water', routeBn: 'চোখে ফোঁটা / পানি', isBooster: false },
    { id: 'sonali-ibd-b', dayLabel: 'Day 18–20', minDay: 18, maxDay: 20, name: 'Gumboro Booster', nameBn: 'গামবোরো বুস্টার', route: 'Drinking Water', routeBn: 'খাওয়ার পানি', isBooster: true },
    { id: 'sonali-bcrdv-b', dayLabel: 'Day 24–26', minDay: 24, maxDay: 26, name: 'BCRDV Booster', nameBn: 'বিসিআরডিভি বুস্টার', route: 'Drinking Water', routeBn: 'খাওয়ার পানি', isBooster: true },
    { id: 'sonali-fowlpox', dayLabel: 'Day 35', minDay: 35, maxDay: 35, name: 'Fowl Pox', nameBn: 'ফাউল পক্স (বসন্ত)', route: 'Wing Web', routeBn: 'ডানার পর্দায়', isBooster: false },
    { id: 'sonali-cholera', dayLabel: 'Day 45', minDay: 45, maxDay: 45, name: 'Fowl Cholera', nameBn: 'ফাউল কলেরা', route: 'SC', routeBn: 'চামড়ার নিচে (SC)', isBooster: false },
    { id: 'sonali-rdv', dayLabel: 'Day 60', minDay: 60, maxDay: 60, name: 'RDV (Ranikhet)', nameBn: 'আরডিভি (রাণীক্ষেত)', route: 'IM', routeBn: 'মাংসপেশিতে (IM)', isBooster: false },
  ],
  'Desi / Native': [
    { id: 'desi-bcrdv-1', dayLabel: 'Day 5–7', minDay: 5, maxDay: 7, name: 'BCRDV', nameBn: 'বিসিআরডিভি (১ম ডোজ)', route: 'Eye Drop', routeBn: 'চোখে ফোঁটা', isBooster: false },
    { id: 'desi-ibd-1', dayLabel: 'Day 14', minDay: 14, maxDay: 14, name: 'Gumboro (IBD)', nameBn: 'গামবোরো (আইবিডি)', route: 'Eye Drop / Water', routeBn: 'চোখে ফোঁটা / পানি', isBooster: false },
    { id: 'desi-bcrdv-b', dayLabel: 'Day 24', minDay: 24, maxDay: 24, name: 'BCRDV Booster', nameBn: 'বিসিআরডিভি বুস্টার', route: 'Eye Drop / Water', routeBn: 'চোখে ফোঁটা / পানি', isBooster: true },
    { id: 'desi-fowlpox', dayLabel: 'Day 35', minDay: 35, maxDay: 35, name: 'Fowl Pox', nameBn: 'ফাউল পক্স (বসন্ত)', route: 'Wing Web', routeBn: 'ডানার পর্দায়', isBooster: false },
    { id: 'desi-cholera', dayLabel: 'Day 45–50', minDay: 45, maxDay: 50, name: 'Fowl Cholera', nameBn: 'ফাউল কলেরা', route: 'SC', routeBn: 'চামড়ার নিচে (SC)', isBooster: false },
    { id: 'desi-rdv', dayLabel: 'Day 65–70', minDay: 65, maxDay: 70, name: 'RDV (Every 6 Months Booster)', nameBn: 'আরডিভি (প্রতি ৬ মাস পর বুস্টার)', route: 'IM', routeBn: 'মাংসপেশিতে (IM)', isBooster: true },
  ],
  Duck: [
    { id: 'duck-plague-1', dayLabel: 'Day 14–15', minDay: 14, maxDay: 15, name: 'Duck Plague (Duck Viral Enteritis - 1st)', nameBn: 'ডাক প্লেগ (হাঁসের প্লেগ ১ম)', route: 'SC', routeBn: 'চামড়ার নিচে (SC)', isBooster: false },
    { id: 'duck-plague-b', dayLabel: 'Day 28–30', minDay: 28, maxDay: 30, name: 'Duck Plague Booster', nameBn: 'ডাক প্লেগ বুস্টার', route: 'SC', routeBn: 'চামড়ার নিচে (SC)', isBooster: true },
    { id: 'duck-cholera-1', dayLabel: 'Day 42–45', minDay: 42, maxDay: 45, name: 'Duck Cholera (1st)', nameBn: 'ডাক কলেরা (১ম)', route: 'SC', routeBn: 'চামড়ার নিচে (SC)', isBooster: false },
    { id: 'duck-cholera-b', dayLabel: 'Day 60', minDay: 60, maxDay: 60, name: 'Duck Cholera Booster', nameBn: 'ডাক কলেরা বুস্টার', route: 'SC', routeBn: 'চামড়ার নিচে (SC)', isBooster: true },
  ],
  Pigeon: [
    { id: 'pigeon-pmv-1', dayLabel: 'Day 7–10', minDay: 7, maxDay: 10, name: 'BCRDV / Pigeon Paramyxovirus (1st)', nameBn: 'বিসিআরডিভি / প্যারামিক্সোভাইরাস ১ম', route: 'Eye Drop', routeBn: 'চোখে ফোঁটা', isBooster: false },
    { id: 'pigeon-pox', dayLabel: 'Day 21–25', minDay: 21, maxDay: 25, name: 'Pigeon Pox', nameBn: 'কবুতরের বসন্ত (Pigeon Pox)', route: 'Wing Web / Follicle', routeBn: 'ডানা / পালকের গোড়ায়', isBooster: false },
    { id: 'pigeon-pmv-b', dayLabel: 'Day 30–35', minDay: 30, maxDay: 35, name: 'Paramyxovirus / ND Booster', nameBn: 'প্যারামিক্সোভাইরাস / এনডি বুস্টার', route: 'Eye Drop / SC', routeBn: 'চোখে ফোঁটা / SC', isBooster: true },
  ],
}

/**
 * Formats any Date or ms timestamp as local YYYY-MM-DD (avoids UTC timezone date shifts).
 */
export function toLocalDateKey(input) {
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Returns integer calendar days between dateKeyA and dateKeyB (A - B).
 */
export function diffLocalDateKeys(dateKeyA, dateKeyB) {
  const [ya, ma, da] = dateKeyA.split('-').map(Number)
  const [yb, mb, db] = dateKeyB.split('-').map(Number)
  const utcA = Date.UTC(ya, ma - 1, da)
  const utcB = Date.UTC(yb, mb - 1, db)
  return Math.round((utcA - utcB) / MS_PER_DAY)
}

export function getVaccineRecordKey(shedId, vaccineId) {
  return `${shedId}__${vaccineId}`
}

export function getCompletedVaccinesMap() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(POULTRYMEDIX_VACCINE_RECORDS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    console.warn('[vaccineManager] Unable to read completed vaccines:', error)
    return {}
  }
}

export function toggleVaccineCompleted(shedId, vaccineId, forceState) {
  const map = getCompletedVaccinesMap()
  const key = getVaccineRecordKey(shedId, vaccineId)
  const nextCompleted = typeof forceState === 'boolean' ? forceState : !map[key]?.completed

  if (nextCompleted) {
    map[key] = {
      completed: true,
      completedAt: new Date().toISOString(),
      givenOnDate: toLocalDateKey(new Date()),
    }
  } else {
    delete map[key]
  }

  try {
    localStorage.setItem(POULTRYMEDIX_VACCINE_RECORDS_KEY, JSON.stringify(map))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(POULTRYMEDIX_VACCINES_UPDATED_EVENT, { detail: { shedId, vaccineId, completed: nextCompleted } }))
    }
  } catch (error) {
    console.error('[vaccineManager] Failed to persist vaccine completion:', error)
  }

  return map
}

/**
 * Strictly returns ONLY the official vaccination schedule items matching a shed's species,
 * enriched with exact local calendar dates, days until due, and live status.
 */
export function getShedVaccineSchedule(shed, completedMap = getCompletedVaccinesMap(), nowDate = new Date()) {
  if (!shed) return []
  const speciesSchedule = SPECIES_VACCINE_SCHEDULES[shed.species] || SPECIES_VACCINE_SCHEDULES.Broiler
  const currentAgeDays = calculateCurrentAgeDays(shed, nowDate.getTime())
  const todayKey = toLocalDateKey(nowDate)

  // Compute local Day-1 midnight from currentAgeDays so Day 1 = today - (age - 1) days
  const todayLocalMidnight = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime()
  const dayOneMidnight = todayLocalMidnight - (currentAgeDays - 1) * MS_PER_DAY

  return speciesSchedule.map((item) => {
    const recordKey = getVaccineRecordKey(shed.id, item.id)
    const completionRecord = completedMap[recordKey]
    const isCompleted = Boolean(completionRecord?.completed)

    const dueMs = dayOneMidnight + (item.minDay - 1) * MS_PER_DAY
    const windowEndMs = dayOneMidnight + (item.maxDay - 1) * MS_PER_DAY
    const dueDateKey = toLocalDateKey(dueMs)
    const windowEndKey = toLocalDateKey(windowEndMs)

    const daysUntilDue = diffLocalDateKeys(dueDateKey, todayKey)
    const daysUntilWindowEnd = diffLocalDateKeys(windowEndKey, todayKey)

    let status = 'upcoming'
    if (isCompleted) {
      status = 'completed'
    } else if (daysUntilDue <= 0 && daysUntilWindowEnd >= 0) {
      status = 'due_today'
    } else if (daysUntilDue === 1) {
      status = 'due_tomorrow'
    } else if (daysUntilWindowEnd < 0) {
      status = 'overdue'
    } else if (item.isBooster) {
      status = 'upcoming_booster'
    }

    return {
      ...item,
      shedId: shed.id,
      shedName: shed.name,
      shedSerial: shed.serialNumber,
      species: shed.species,
      currentAgeDays,
      recordKey,
      isCompleted,
      completedAt: completionRecord?.completedAt || null,
      dueDateMs: dueMs,
      windowEndMs,
      dueDateKey,
      windowEndKey,
      daysUntilDue,
      daysUntilWindowEnd,
      status,
    }
  })
}

/**
 * Scans all sheds and extracts consolidated alarms for vaccines Due Today,
 * Due Tomorrow (1-Day Advance), or Overdue.
 */
export function getConsolidatedVaccineAlarms(sheds = getSheds(), completedMap = getCompletedVaccinesMap(), nowDate = new Date()) {
  const alarms = []
  sheds.forEach((shed, idx) => {
    const normalizedShed = { ...shed, serialNumber: shed.serialNumber || idx + 1 }
    const schedule = getShedVaccineSchedule(normalizedShed, completedMap, nowDate)
    for (const entry of schedule) {
      if (entry.status === 'due_today' || entry.status === 'due_tomorrow' || entry.status === 'overdue') {
        alarms.push(entry)
      }
    }
  })

  const priority = { due_today: 0, overdue: 1, due_tomorrow: 2 }
  alarms.sort((a, b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9))
  return alarms
}

/**
 * Fires deduplicated browser notifications for Due Today and Tomorrow (1-Day Advance) alarms
 * when Notification permission is already granted.
 */
export function dispatchBrowserVaccineNotifications(alarms, isBn = false) {
  if (typeof window === 'undefined' || !('Notification' in window)) return 0
  if (Notification.permission !== 'granted') return 0

  const todayKey = toLocalDateKey(new Date())
  let sentCache
  try {
    sentCache = JSON.parse(localStorage.getItem(POULTRYMEDIX_ALARM_NOTIFIED_KEY) || '{}')
  } catch {
    sentCache = {}
  }

  let sentCount = 0
  for (const alarm of alarms) {
    if (alarm.status !== 'due_today' && alarm.status !== 'due_tomorrow') continue
    const dedupKey = `${todayKey}__${alarm.recordKey}__${alarm.status}`
    if (sentCache[dedupKey]) continue

    const title = alarm.status === 'due_today'
      ? (isBn ? `আজ টিকার দিন: ${alarm.shedName}` : `Vaccine Due Today: ${alarm.shedName}`)
      : (isBn ? `আগামীকাল টিকা (১ দিন বাকি): ${alarm.shedName}` : `1-Day Advance Vaccine Alert: ${alarm.shedName}`)

    const body = `${alarm.species} · ${isBn ? alarm.nameBn : alarm.name} (${alarm.route})${alarm.isBooster ? ' [BOOSTER]' : ''}`
    try {
      new Notification(title, { body, icon: '/images/logo.png' })
      sentCache[dedupKey] = true
      sentCount += 1
    } catch {
      // Ignore notification errors in restricted contexts
    }
  }

  if (sentCount > 0) {
    try {
      localStorage.setItem(POULTRYMEDIX_ALARM_NOTIFIED_KEY, JSON.stringify(sentCache))
    } catch {
      // ignore storage quota errors
    }
  }
  return sentCount
}
