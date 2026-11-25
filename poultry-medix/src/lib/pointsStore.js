export const POULTRYMEDIX_POINTS_TOTAL_KEY = 'poultrymedix_points_total_v1'
export const POULTRYMEDIX_POINTS_HISTORY_KEY = 'poultrymedix_points_history_v1'
export const POULTRYMEDIX_POINTS_PER_SUBMISSION = 10
export const POULTRYMEDIX_POINTS_UPDATED_EVENT = 'poultrymedix:points-updated'

let memoryTotal = 0
let memoryHistory = []

function getStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function formatPointsValue(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) return '0.00'
  return numeric.toFixed(2)
}

export function getPointsTotal() {
  const storage = getStorage()
  if (!storage) return memoryTotal
  try {
    const raw = storage.getItem(POULTRYMEDIX_POINTS_TOTAL_KEY)
    if (raw === null || raw === '') return 0
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  } catch {
    return 0
  }
}

export function getPointsHistory() {
  const storage = getStorage()
  if (!storage) return memoryHistory
  try {
    const raw = storage.getItem(POULTRYMEDIX_POINTS_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function awardContributionPoints({
  source = 'research-hub',
  title = '',
  detail = '',
  amount = POULTRYMEDIX_POINTS_PER_SUBMISSION,
} = {}) {
  const increment = Number.isFinite(Number(amount)) && Number(amount) > 0
    ? Number(amount)
    : POULTRYMEDIX_POINTS_PER_SUBMISSION

  const currentTotal = getPointsTotal()
  const nextTotal = Number((currentTotal + increment).toFixed(2))
  const entry = {
    id: `pmx-pts-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    source,
    title: String(title || '').trim(),
    detail: String(detail || '').trim(),
    points: increment,
    createdAt: new Date().toISOString(),
  }

  const nextHistory = [entry, ...getPointsHistory()].slice(0, 50)
  const storage = getStorage()

  if (storage) {
    try {
      storage.setItem(POULTRYMEDIX_POINTS_TOTAL_KEY, String(nextTotal))
      storage.setItem(POULTRYMEDIX_POINTS_HISTORY_KEY, JSON.stringify(nextHistory))
    } catch {
      memoryTotal = nextTotal
      memoryHistory = nextHistory
    }
  } else {
    memoryTotal = nextTotal
    memoryHistory = nextHistory
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent(POULTRYMEDIX_POINTS_UPDATED_EVENT, {
        detail: { total: nextTotal, history: nextHistory, entry },
      })
    )
  }

  return { total: nextTotal, history: nextHistory, entry }
}
