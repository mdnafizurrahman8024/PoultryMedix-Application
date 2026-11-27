/**
 * Native Consultation Media Security, Split Workspace & Floating PiP Helpers
 */

export const DEFAULT_SPLIT_LEFT_PCT = 50
export const MIN_SPLIT_LEFT_PCT = 25 // Allows Right Prescription Builder up to 75%
export const MAX_SPLIT_LEFT_PCT = 70 // Allows Right Prescription Builder down to 30%

export function clampSplitLeftPct(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return DEFAULT_SPLIT_LEFT_PCT
  return Math.min(MAX_SPLIT_LEFT_PCT, Math.max(MIN_SPLIT_LEFT_PCT, Math.round(num * 10) / 10))
}

export function clampPipPosition({
  x,
  y,
  width = 330,
  height = 250,
  viewportWidth = 1280,
  viewportHeight = 800,
  margin = 12,
} = {}) {
  const maxX = Math.max(margin, viewportWidth - width - margin)
  const maxY = Math.max(margin, viewportHeight - height - margin)
  return {
    x: Math.round(Math.min(maxX, Math.max(margin, Number(x) || margin))),
    y: Math.round(Math.min(maxY, Math.max(margin, Number(y) || margin))),
  }
}

export function validateConsultMediaAccess({
  participantRole = 'farmer',
  userRole = '',
  roomCode = '',
  trxId = '',
  doctorSession = null,
} = {}) {
  const cleanRoom = String(roomCode || '').trim().replace(/[^A-Za-z0-9_-]/g, '')
  if (!cleanRoom || cleanRoom.length < 4) {
    return {
      authorized: false,
      sessionToken: '',
      errorKey: 'consultMediaAuthDenied',
    }
  }

  const normalizedRole = String(userRole || '').toUpperCase()
  const isVet = participantRole === 'vet' || normalizedRole === 'REGISTERED_VET'

  if (isVet) {
    if (!doctorSession?.isAuthenticatedDoctor || !doctorSession?.doctorId || !doctorSession?.regNo) {
      return {
        authorized: false,
        sessionToken: '',
        errorKey: 'consultMediaAuthDenied',
      }
    }
    return {
      authorized: true,
      roleSide: 'vet',
      sessionToken: `pmx-vet-${doctorSession.doctorId}-${cleanRoom}`,
    }
  }

  const cleanTrx = String(trxId || '').trim().replace(/[^A-Za-z0-9_-]/g, '')
  if (!cleanTrx || cleanTrx.length < 5) {
    return {
      authorized: false,
      sessionToken: '',
      errorKey: 'consultMediaAuthDenied',
    }
  }

  return {
    authorized: true,
    roleSide: 'farmer',
    sessionToken: `pmx-farmer-${cleanTrx}-${cleanRoom}`,
  }
}

export function stopMediaStreamTracks(stream) {
  if (!stream || typeof stream.getTracks !== 'function') return 0
  let stopped = 0
  stream.getTracks().forEach((track) => {
    if (track && typeof track.stop === 'function') {
      track.stop()
      stopped += 1
    }
  })
  return stopped
}
