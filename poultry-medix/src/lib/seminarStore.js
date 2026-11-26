export const POULTRYMEDIX_SEMINARS_KEY = 'poultrymedix_free_seminars_v1'
export const POULTRYMEDIX_SEMINARS_UPDATED_EVENT = 'poultrymedix:free-seminars-updated'
export const POULTRYMEDIX_SEMINARS_CHANNEL = 'poultrymedix_free_seminars_sync'

export const SEMINAR_CATEGORIES = [
  {
    id: 'all',
    labelEn: 'All Free Sessions',
    labelBn: 'সব ফ্রি সেমিনার',
  },
  {
    id: 'farm_management',
    labelEn: 'Farm & Housing',
    labelBn: 'খামার ও শেড ব্যবস্থাপনা',
  },
  {
    id: 'basic_guidelines',
    labelEn: 'Basic Guidelines & Vaccines',
    labelBn: 'মৌলিক গাইডলাইন ও টিকা',
  },
  {
    id: 'amr_stewardship',
    labelEn: 'AMR Stewardship',
    labelBn: 'এএমআর প্রতিরোধ ও ওষুধ নীতি',
  },
  {
    id: 'farmer_qa',
    labelEn: 'Farmer Open Q&A',
    labelBn: 'খামারি উন্মুক্ত প্রশ্নোত্তর',
  },
]

const SEEDED_FREE_SEMINARS = [
  {
    id: 'sem-amr-stewardship',
    roomCode: 'PMX-SEM-AMR101',
    category: 'amr_stewardship',
    isFree: true,
    feeBdt: 0,
    status: 'live',
    titleEn: 'AMR Stewardship: Safe Withdrawal Periods & Avoiding Unnecessary Antibiotics',
    titleBn: 'এএমআর প্রতিরোধ: নিরাপদ উইথড্রয়াল সময় এবং অযথা অ্যান্টিবায়োটিক বর্জন',
    hostName: 'Dr. Md Nafizur Rahman',
    hostRoleEn: 'BVC-REG-11842 · Avian Health & AMR Lead',
    hostRoleBn: 'BVC-REG-11842 · এভিয়ান স্বাস্থ্য ও এএমআর বিশেষজ্ঞ',
    date: '2026-11-26',
    time: '21:00',
    durationMinutes: 45,
    agendaEn: 'Why blind antibiotics fail in viral outbreaks, reading WHO AWaRe tiers, honoring 7-day meat/egg withdrawal periods, and when to request AST lab testing.',
    agendaBn: 'ভাইরাসজনিত রোগে অ্যান্টিবায়োটিক কেন কাজ করে না, WHO AWaRe শ্রেণিবিন্যাস, মাংস-ডিমের ৭ দিনের উইথড্রয়াল নীতি ও কালচার/AST পরীক্ষার গুরুত্ব।',
    registeredCount: 48,
    isRegistered: false,
    questions: [
      {
        id: 'sq-seed-1',
        author: 'Rahim Poultry (Bogura)',
        text: 'What if birds still cough 3 days after Doxivet? Can we switch antibiotics without culture?',
        createdAt: '2026-11-26T14:55:00.000Z',
        answered: true,
      },
    ],
  },
  {
    id: 'sem-farm-biosecurity',
    roomCode: 'PMX-SEM-FRM202',
    category: 'farm_management',
    isFree: true,
    feeBdt: 0,
    status: 'upcoming',
    titleEn: 'New Farmer Workshop: 3-Zone Biosecurity, Footbaths & Summer Heat Stress Control',
    titleBn: 'নতুন খামারি সেমিনার: ৩-স্তর জৈব-নিরাপত্তা, ফুটবাথ ও হিট-স্ট্রেস নিয়ন্ত্রণ',
    hostName: 'Dr. Sarah Ahmed, DVM',
    hostRoleEn: 'BVC-REG-10492 · Avian Pathology Specialist',
    hostRoleBn: 'BVC-REG-10492 · এভিয়ান প্যাথলজি বিশেষজ্ঞ',
    date: '2026-11-27',
    time: '19:30',
    durationMinutes: 60,
    agendaEn: 'Designing Red/Amber/Green farm perimeters, disinfecting vehicles & visitors, stir fan positioning in East-West sheds, and Vitamin C/electrolyte heat protocols.',
    agendaBn: 'লাল-হলুদ-সবুজ বায়োসিকিউরিটি জোন, শেডের প্রবেশমুখে ফুটবাথের সঠিক মাত্রা, পূর্ব-পশ্চিম শেডে বাতাস চলাচল ও গরমে ইলেক্ট্রোলাইট প্রয়োগ।',
    registeredCount: 62,
    isRegistered: false,
    questions: [],
  },
  {
    id: 'sem-vaccine-basics',
    roomCode: 'PMX-SEM-BAS303',
    category: 'basic_guidelines',
    isFree: true,
    feeBdt: 0,
    status: 'upcoming',
    titleEn: 'Basic Poultry Guidelines: Day-Old Chick Grading, Vaccine Cold-Chain & Early Triage',
    titleBn: 'মৌলিক খামার নির্দেশিকা: গ্রেড-এ বাচ্চা চেনা, টিকার কোল্ড-চেইন ও প্রাথমিক রোগ নির্ণয়',
    hostName: 'Dr. Tariqul Islam, DVM',
    hostRoleEn: 'BVC-REG-11284 · Poultry Microbiology & Hatchery Specialist',
    hostRoleBn: 'BVC-REG-11284 · পোল্ট্রি মাইক্রোবায়োলজি বিশেষজ্ঞ',
    date: '2026-11-29',
    time: '20:00',
    durationMinutes: 50,
    agendaEn: 'Checking 38-42g Grade-A chicks on arrival, 2-hour chlorine-free water fasting before BCRDV/IBD vaccines, and recognizing early respiratory/dropping signs.',
    agendaBn: '৩৮-৪২ গ্রাম গ্রেড-এ বাচ্চা যাচাই, বিসিআরডিভি/গামবোরো টিকার ২ ঘণ্টা আগে ক্লোরিনমুক্ত পানি ব্যবস্থাপনা ও রোগের প্রাথমিক লক্ষণ শনাক্তকরণ।',
    registeredCount: 39,
    isRegistered: false,
    questions: [],
  },
  {
    id: 'sem-farmer-open-qa',
    roomCode: 'PMX-SEM-FQA404',
    category: 'farmer_qa',
    isFree: true,
    feeBdt: 0,
    status: 'upcoming',
    titleEn: 'Community Farmer Open Q&A: Marginal Farm Profits Without Irrational Drug Cost',
    titleBn: 'খামারি উন্মুক্ত প্রশ্নোত্তর: অযথা ওষুধের খরচ কমিয়ে নিরাপদ খামার পরিচালনা',
    hostName: 'PoultryMedix Research & Vet Panel',
    hostRoleEn: 'One-Health Stewardship Team · BVC Guidance',
    hostRoleBn: 'ওয়ান-হেলথ গবেষণা ও পশুচিকিৎসক প্যানেল',
    date: '2026-12-01',
    time: '20:30',
    durationMinutes: 60,
    agendaEn: 'Open microphone & live question board for rural poultry farmers — discuss real flock challenges, dry litter checks, and local Upazila Livestock Office (ULO) support.',
    agendaBn: 'প্রান্তিক খামারিদের সরাসরি সমস্যা সমাধান, লিটার ব্যবস্থাপনা এবং জরুরি অবস্থায় সরকারি ULO হাসপাতালের সহায়তা পাওয়ার সহজ উপায়।',
    registeredCount: 31,
    isRegistered: false,
    questions: [],
  },
]

let memorySeminars = SEEDED_FREE_SEMINARS.map((item) => ({ ...item }))

function getStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function sanitizeText(value, maxLength = 240) {
  return String(value ?? '')
    .replace(/[<>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function broadcastSeminarSync(seminars) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(POULTRYMEDIX_SEMINARS_UPDATED_EVENT, { detail: { seminars } }))
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const ch = new BroadcastChannel(POULTRYMEDIX_SEMINARS_CHANNEL)
      ch.postMessage({ type: 'seminars-updated', seminars })
      ch.close()
    } catch {
      // ignore broadcast unavailability
    }
  }
}

function saveFreeSeminars(list) {
  const storage = getStorage()
  if (storage) {
    try {
      storage.setItem(POULTRYMEDIX_SEMINARS_KEY, JSON.stringify(list))
    } catch {
      memorySeminars = list
    }
  } else {
    memorySeminars = list
  }
  broadcastSeminarSync(list)
}

export function getFreeSeminars() {
  const storage = getStorage()
  if (!storage) return memorySeminars
  try {
    const raw = storage.getItem(POULTRYMEDIX_SEMINARS_KEY)
    if (!raw) return SEEDED_FREE_SEMINARS.map((item) => ({ ...item }))
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return SEEDED_FREE_SEMINARS.map((item) => ({ ...item }))
    }
    return parsed
  } catch {
    return SEEDED_FREE_SEMINARS.map((item) => ({ ...item }))
  }
}

export function toggleSeminarRegistration(seminarId) {
  const current = getFreeSeminars()
  let updatedItem = null
  const next = current.map((sem) => {
    if (sem.id !== seminarId) return sem
    const nextReg = !sem.isRegistered
    updatedItem = {
      ...sem,
      isRegistered: nextReg,
      registeredCount: Math.max(0, (Number(sem.registeredCount) || 0) + (nextReg ? 1 : -1)),
    }
    return updatedItem
  })
  saveFreeSeminars(next)
  return { seminars: next, updated: updatedItem }
}

export function submitSeminarQuestion(seminarId, { author = 'Registered Farmer', text = '' } = {}) {
  const cleanText = sanitizeText(text, 300)
  if (!cleanText) return { ok: false, seminars: getFreeSeminars() }
  const cleanAuthor = sanitizeText(author, 80) || 'Farmer'
  const current = getFreeSeminars()
  const newQuestion = {
    id: `sq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    author: cleanAuthor,
    text: cleanText,
    createdAt: new Date().toISOString(),
    answered: false,
  }
  const next = current.map((sem) => (
    sem.id === seminarId
      ? { ...sem, questions: [newQuestion, ...(Array.isArray(sem.questions) ? sem.questions : [])].slice(0, 50) }
      : sem
  ))
  saveFreeSeminars(next)
  return { ok: true, question: newQuestion, seminars: next }
}

export function toggleSeminarQuestionAnswered(seminarId, questionId) {
  const current = getFreeSeminars()
  const next = current.map((sem) => {
    if (sem.id !== seminarId) return sem
    const questions = (sem.questions || []).map((q) => (
      q.id === questionId ? { ...q, answered: !q.answered } : q
    ))
    return { ...sem, questions }
  })
  saveFreeSeminars(next)
  return next
}

export function createFreeSeminar({
  titleEn,
  titleBn,
  category = 'basic_guidelines',
  hostName = 'PoultryMedix Veterinary Team',
  hostRoleEn = 'Free Community Session · BVC Stewards',
  hostRoleBn = 'ফ্রি খামারি প্রশিক্ষণ · BVC বিশেষজ্ঞ দল',
  date,
  time = '20:00',
  durationMinutes = 45,
  agendaEn = '',
  agendaBn = '',
  startImmediately = false,
} = {}) {
  const cleanTitleEn = sanitizeText(titleEn || titleBn, 160)
  const cleanTitleBn = sanitizeText(titleBn || titleEn, 160)
  if (!cleanTitleEn) return { ok: false, error: 'Seminar title is required.' }

  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
  const newSeminar = {
    id: `sem-${Date.now()}-${suffix.toLowerCase()}`,
    roomCode: `PMX-SEM-${suffix}`,
    category: SEMINAR_CATEGORIES.some((c) => c.id === category && c.id !== 'all') ? category : 'basic_guidelines',
    isFree: true,
    feeBdt: 0,
    status: startImmediately ? 'live' : 'upcoming',
    titleEn: cleanTitleEn,
    titleBn: cleanTitleBn,
    hostName: sanitizeText(hostName, 100) || 'PoultryMedix Veterinary Team',
    hostRoleEn: sanitizeText(hostRoleEn, 120) || 'Free Community Session',
    hostRoleBn: sanitizeText(hostRoleBn, 120) || 'ফ্রি খামারি সেমিনার',
    date: sanitizeText(date || new Date().toISOString().slice(0, 10), 20),
    time: sanitizeText(time, 10) || '20:00',
    durationMinutes: Math.max(15, Math.min(180, Number(durationMinutes) || 45)),
    agendaEn: sanitizeText(agendaEn || cleanTitleEn, 400),
    agendaBn: sanitizeText(agendaBn || cleanTitleBn, 400),
    registeredCount: 1,
    isRegistered: true,
    questions: [],
  }

  const next = [newSeminar, ...getFreeSeminars()]
  saveFreeSeminars(next)
  return { ok: true, seminar: newSeminar, seminars: next }
}

export function setSeminarStatus(seminarId, nextStatus) {
  if (!['live', 'upcoming', 'ended'].includes(nextStatus)) return getFreeSeminars()
  const next = getFreeSeminars().map((sem) => (
    sem.id === seminarId ? { ...sem, status: nextStatus } : sem
  ))
  saveFreeSeminars(next)
  return next
}
