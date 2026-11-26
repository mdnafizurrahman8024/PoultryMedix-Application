import { sanitizePaymentInput } from './paymentAdapter.js'

export const POULTRYMEDIX_ROOM_INTERACTION_KEY = 'poultrymedix_live_room_interaction_v1'
export const POULTRYMEDIX_ROOM_INTERACTION_EVENT = 'poultrymedix:live-room-interaction'
export const POULTRYMEDIX_ROOM_INTERACTION_CHANNEL = 'poultrymedix_live_room_interaction_sync'

let memoryRoomMap = {}

function normalizeRoomKey(roomId) {
  const clean = String(roomId || 'PMX-ROOM-LIVE').replace(/[^A-Za-z0-9_-]/g, '')
  return clean || 'PMX-ROOM-LIVE'
}

function getStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readAllRoomsMap() {
  const storage = getStorage()
  if (!storage) return memoryRoomMap
  try {
    const raw = storage.getItem(POULTRYMEDIX_ROOM_INTERACTION_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeAllRoomsMap(nextMap, changedRoomId) {
  const storage = getStorage()
  if (storage) {
    try {
      storage.setItem(POULTRYMEDIX_ROOM_INTERACTION_KEY, JSON.stringify(nextMap))
    } catch {
      memoryRoomMap = nextMap
    }
  } else {
    memoryRoomMap = nextMap
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(POULTRYMEDIX_ROOM_INTERACTION_EVENT, { detail: { roomId: changedRoomId } })
    )
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const ch = new BroadcastChannel(POULTRYMEDIX_ROOM_INTERACTION_CHANNEL)
        ch.postMessage({ type: 'room-interaction-updated', roomId: changedRoomId })
        ch.close()
      } catch {
        // ignore if BroadcastChannel is unavailable
      }
    }
  }
}

/**
 * Groups the 3 top-level PoultryMedix roles cleanly into the 2 Live Room roles:
 * Host (REGISTERED_VET) vs Participant (FARMER / VET_STUDENT).
 */
export function getRoomRoleGrouping(userRole) {
  const normalized = String(userRole || 'FARMER').toUpperCase()
  if (normalized === 'REGISTERED_VET') {
    return {
      userRole: 'REGISTERED_VET',
      side: 'host',
      isHost: true,
      badgeKey: 'liveRoleHostBadge',
      roleLabelKey: 'roleVet',
    }
  }
  return {
    userRole: normalized === 'VET_STUDENT' ? 'VET_STUDENT' : 'FARMER',
    side: 'participant',
    isHost: false,
    badgeKey: 'liveRoleParticipantBadge',
    roleLabelKey: normalized === 'VET_STUDENT' ? 'roleStudent' : 'roleFarmer',
  }
}

export function getRoomInteractionState(roomId) {
  const key = normalizeRoomKey(roomId)
  const map = readAllRoomsMap()
  const entry = map[key]
  return {
    roomId: key,
    raisedHands: Array.isArray(entry?.raisedHands) ? entry.raisedHands : [],
    messages: Array.isArray(entry?.messages) ? entry.messages : [],
  }
}

export function seedRoomQuestionsIfEmpty(roomId, initialQuestions = []) {
  if (!Array.isArray(initialQuestions) || initialQuestions.length === 0) {
    return getRoomInteractionState(roomId)
  }
  const key = normalizeRoomKey(roomId)
  const map = readAllRoomsMap()
  const existing = map[key]
  if (existing && Array.isArray(existing.messages) && existing.messages.length > 0) {
    return getRoomInteractionState(key)
  }
  const seededMessages = initialQuestions.map((q) => ({
    id: q.id || `qa-${Math.random().toString(36).slice(2, 8)}`,
    author: sanitizePaymentInput(q.author || 'Participant', 80),
    userRole: q.userRole || 'FARMER',
    text: sanitizePaymentInput(q.text || '', 300),
    createdAt: q.createdAt || new Date().toISOString(),
    answered: Boolean(q.answered),
  })).filter((m) => m.text)

  const nextMap = {
    ...map,
    [key]: {
      raisedHands: Array.isArray(existing?.raisedHands) ? existing.raisedHands : [],
      messages: seededMessages,
    },
  }
  writeAllRoomsMap(nextMap, key)
  return getRoomInteractionState(key)
}

export function toggleRaiseHand(roomId, { participantId = '', participantName = 'Participant', userRole = 'FARMER' } = {}) {
  const key = normalizeRoomKey(roomId)
  const map = readAllRoomsMap()
  const current = map[key] || { raisedHands: [], messages: [] }
  const cleanId = sanitizePaymentInput(participantId, 60) || `${userRole}-${sanitizePaymentInput(participantName, 40) || 'user'}`
  const existingHands = Array.isArray(current.raisedHands) ? current.raisedHands : []
  const alreadyRaised = existingHands.some((h) => h.participantId === cleanId)

  const nextHands = alreadyRaised
    ? existingHands.filter((h) => h.participantId !== cleanId)
    : [
        {
          participantId: cleanId,
          participantName: sanitizePaymentInput(participantName, 80) || 'Participant',
          userRole: String(userRole || 'FARMER').toUpperCase(),
          raisedAt: new Date().toISOString(),
        },
        ...existingHands,
      ].slice(0, 40)

  const nextMap = {
    ...map,
    [key]: {
      raisedHands: nextHands,
      messages: Array.isArray(current.messages) ? current.messages : [],
    },
  }
  writeAllRoomsMap(nextMap, key)
  return { raised: !alreadyRaised, state: getRoomInteractionState(key) }
}

export function acknowledgeRaisedHand(roomId, participantId) {
  const key = normalizeRoomKey(roomId)
  const map = readAllRoomsMap()
  const current = map[key]
  if (!current) return getRoomInteractionState(key)
  const nextHands = (current.raisedHands || []).filter((h) => h.participantId !== participantId)
  writeAllRoomsMap({ ...map, [key]: { ...current, raisedHands: nextHands } }, key)
  return getRoomInteractionState(key)
}

export function clearAllRaisedHands(roomId) {
  const key = normalizeRoomKey(roomId)
  const map = readAllRoomsMap()
  const current = map[key]
  if (!current) return getRoomInteractionState(key)
  writeAllRoomsMap({ ...map, [key]: { ...current, raisedHands: [] } }, key)
  return getRoomInteractionState(key)
}

export function sendLiveQaMessage(roomId, { author = 'Participant', userRole = 'FARMER', text = '' } = {}) {
  const cleanText = sanitizePaymentInput(text, 300)
  if (!cleanText) return { ok: false, state: getRoomInteractionState(roomId) }

  const key = normalizeRoomKey(roomId)
  const map = readAllRoomsMap()
  const current = map[key] || { raisedHands: [], messages: [] }
  const msg = {
    id: `qa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    author: sanitizePaymentInput(author, 80) || 'Participant',
    userRole: String(userRole || 'FARMER').toUpperCase(),
    text: cleanText,
    createdAt: new Date().toISOString(),
    answered: false,
  }
  const nextMessages = [msg, ...(Array.isArray(current.messages) ? current.messages : [])].slice(0, 80)
  const nextMap = {
    ...map,
    [key]: {
      raisedHands: Array.isArray(current.raisedHands) ? current.raisedHands : [],
      messages: nextMessages,
    },
  }
  writeAllRoomsMap(nextMap, key)
  return { ok: true, message: msg, state: getRoomInteractionState(key) }
}

export function toggleLiveQaAnswered(roomId, messageId) {
  const key = normalizeRoomKey(roomId)
  const map = readAllRoomsMap()
  const current = map[key]
  if (!current) return getRoomInteractionState(key)
  const nextMessages = (current.messages || []).map((m) => (
    m.id === messageId ? { ...m, answered: !m.answered } : m
  ))
  writeAllRoomsMap({ ...map, [key]: { ...current, messages: nextMessages } }, key)
  return getRoomInteractionState(key)
}
