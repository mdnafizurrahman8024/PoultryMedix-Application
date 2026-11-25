/**
 * Multi-Channel Doctor Booking Notification Adapter
 *
 * Supports immediate WhatsApp & Email dispatch on booking/payment verification,
 * plus an extensible backend webhook / future channel hook via environment variables
 * (`VITE_DOCTOR_NOTIFY_EMAIL`, `VITE_BOOKING_NOTIFY_WEBHOOK_URL`).
 */

import { buildDoctorWhatsAppUrl } from './paymentAdapter.js'

export const DOCTOR_NOTIFY_EMAIL = String(
  import.meta.env?.VITE_DOCTOR_NOTIFY_EMAIL || 'consultation@poultrymedix.app'
).trim()

export const BOOKING_NOTIFY_WEBHOOK_URL = String(
  import.meta.env?.VITE_BOOKING_NOTIFY_WEBHOOK_URL || ''
).trim()

export const TELEHEALTH_SIGNAL_CHANNEL = 'poultrymedix-telehealth-webrtc'

export function buildDoctorEmailUrl({
  email = DOCTOR_NOTIFY_EMAIL,
  doctorName = 'Dr. Md Nafizur Rahman',
  receipt,
  roomCode = '',
  language = 'en',
}) {
  const isBn = language === 'bn'
  const trxId = receipt?.trxId || receipt?.id || 'PMX-TRX'
  const subject = isBn
    ? `[PoultryMedix বুকিং ${trxId}] নতুন টেলিমেডিসিন পরামর্শ (${receipt?.farmerName || 'খামারি'})`
    : `[PoultryMedix Booking ${trxId}] New Telemedicine Consultation (${receipt?.farmerName || 'Farmer'})`

  const lines = isBn
    ? [
        `আসসালামু আলাইকুম ${doctorName},`,
        '',
        'পোল্ট্রিমেডিক্স অ্যাপে একটি নতুন যাচাইকৃত পরামর্শ বুকিং সম্পন্ন হয়েছে:',
        `• রিসিট / বুকিং আইডি: ${trxId}`,
        roomCode ? `• অ্যাপ কল রুম কোড: ${roomCode}` : '',
        `• তারিখ ও সময়: ${receipt?.bookingDate || ''} · ${receipt?.bookingTime || ''}`,
        `• খামারি ও খামার: ${receipt?.farmerName || ''} (${receipt?.farmName || ''}, ${receipt?.district || ''})`,
        `• পালের সমস্যা: ${receipt?.concern || ''}`,
        `• পেমেন্ট স্ট্যাটাস: ৳ ${receipt?.amount || 500} (${receipt?.paymentMethodLabel || 'Verified'}) — ${receipt?.status || 'Completed'}`,
        '',
        'দয়া করে PoultryMedix Consult Vet (Registered Veterinarian) সেকশনে এই রুম কোড দিয়ে যুক্ত হোন অথবা হোয়াটসঅ্যাপে সাড়া দিন।',
      ].filter((line) => line !== null && line !== undefined)
    : [
        `Hello ${doctorName},`,
        '',
        'A verified consultation booking has been scheduled on PoultryMedix:',
        `• Booking / Receipt ID: ${trxId}`,
        roomCode ? `• Consultation Room Code: ${roomCode}` : '',
        `• Scheduled Slot: ${receipt?.bookingDate || ''} at ${receipt?.bookingTime || ''}`,
        `• Farmer & Farm: ${receipt?.farmerName || ''} (${receipt?.farmName || ''}, ${receipt?.district || ''})`,
        `• Flock Concern: ${receipt?.concern || ''}`,
        `• Payment Status: BDT ${receipt?.amount || 500} (${receipt?.paymentMethodLabel || 'Verified'}) — ${receipt?.status || 'Completed'}`,
        '',
        'Please join via PoultryMedix Consult Vet (Registered Veterinarian view) using the Room Code or connect via WhatsApp.',
      ].filter((line) => line !== null && line !== undefined)

  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`
}

export async function dispatchDoctorBookingNotifications({
  receipt,
  doctor,
  roomCode = '',
  language = 'en',
}) {
  const whatsappUrl = buildDoctorWhatsAppUrl({
    phone: doctor?.whatsappNumber || '+8801849288024',
    bookingId: receipt?.trxId || receipt?.id,
    doctorName: doctor?.name || 'Dr. Md Nafizur Rahman',
    farmerName: receipt?.farmerName || '',
    farmName: receipt?.farmName || '',
    district: receipt?.district || '',
    concern: receipt?.concern || '',
    language,
  })

  const emailUrl = buildDoctorEmailUrl({
    email: doctor?.email || DOCTOR_NOTIFY_EMAIL,
    doctorName: doctor?.name || 'Dr. Md Nafizur Rahman',
    receipt,
    roomCode,
    language,
  })

  let webhookDispatched = false
  if (BOOKING_NOTIFY_WEBHOOK_URL) {
    try {
      const response = await fetch(BOOKING_NOTIFY_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'telemedicine.booking.verified',
          trxId: receipt?.trxId,
          roomCode,
          doctorName: doctor?.name,
          doctorPhone: doctor?.whatsappNumber,
          doctorEmail: doctor?.email || DOCTOR_NOTIFY_EMAIL,
          farmerName: receipt?.farmerName,
          farmName: receipt?.farmName,
          district: receipt?.district,
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
        trxId: receipt?.trxId,
        farmerName: receipt?.farmerName,
        district: receipt?.district,
        concern: receipt?.concern,
        timestamp: receipt?.timestamp || new Date().toISOString(),
      })
      channel.close()
    } catch {
      // Ignore broadcast channel errors
    }
  }

  return {
    whatsappUrl,
    emailUrl,
    doctorEmail: doctor?.email || DOCTOR_NOTIFY_EMAIL,
    doctorPhone: doctor?.whatsappDisplay || '+880 1849-288024',
    webhookDispatched,
    webhookConfigured: Boolean(BOOKING_NOTIFY_WEBHOOK_URL),
    roomCode,
  }
}
