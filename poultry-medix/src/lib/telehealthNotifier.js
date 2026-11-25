/**
 * Privacy-Protected Platform Consultation Signaling & In-App Alerts
 *
 * Broadcasts paid booking arrivals and live digital prescription deliveries across
 * open Farmer & Veterinarian PoultryMedix tabs without exposing personal doctor contact data.
 */

export const BOOKING_NOTIFY_WEBHOOK_URL = String(
  import.meta.env?.VITE_BOOKING_NOTIFY_WEBHOOK_URL || ''
).trim()

export const TELEHEALTH_SIGNAL_CHANNEL = 'poultrymedix-telehealth-webrtc'

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
