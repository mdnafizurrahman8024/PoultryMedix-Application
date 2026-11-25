import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  BookOpen,
  Brain,
  Calendar,
  ChevronRight,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  History,
  MapPin,
  MessageCircle,
  Printer,
  Share2,
  ShieldAlert,
  Stethoscope,
  X,
} from 'lucide-react'
import { useLanguage } from '../context/useLanguage.js'
import { readHistory } from './historyStore.js'
import {
  getClinicalLogs,
  CLINICAL_LOGS_UPDATED_EVENT,
} from '../lib/clinicalLogsStore.js'
import {
  ANALYTICS_UPDATED_EVENT,
  getOneHealthSurveillanceSummary,
} from '../lib/analyticsEngine.js'
import {
  REPORTER_ROLES,
  ZOONOTIC_HUMAN_PRECAUTIONS,
  getDiseaseDisplayLabel,
  getZoonoticInfo,
  normalizeReporterSource,
} from '../lib/oneHealthSurveillance.js'

const historyTabs = [
  { id: 'unified', labelKey: 'historyAllClinicalLogsTab' },
  { id: 'surveillance', labelKey: 'historySurveillanceTab' },
  { id: 'diagnosis', labelKey: 'historyDiagnosisTab' },
  { id: 'prescriptions', labelKey: 'historyPrescriptionsTab' },
  { id: 'consultations', labelKey: 'historyVetConsultationsTab' },
  { id: 'chat', labelKey: 'historyChatTab' },
  { id: 'payments', labelKey: 'historyPaymentHistoryTab' },
]

const historyTabIcons = {
  unified: History,
  surveillance: ShieldAlert,
  diagnosis: Brain,
  prescriptions: FileText,
  consultations: Stethoscope,
  chat: MessageCircle,
  payments: CreditCard,
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch])
}

function formattedDate(value, locale, options = { dateStyle: 'medium', timeStyle: 'short' }) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(locale, options)
}

function safeText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function wrapPrintDocument(title, bodyHtml) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; margin: 24px; line-height: 1.45; font-size: 13px; }
    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #15803d; }
    .doc-title { font-size: 20px; font-weight: 800; color: #15803d; margin: 0; }
    .doc-subtitle { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 700; margin-top: 2px; }
    .doc-meta-right { text-align: right; }
    .doc-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 14px 0; padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; }
    .doc-grid-4 { grid-template-columns: repeat(4, 1fr); }
    .doc-cell span { display: block; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .doc-cell strong { font-size: 12px; color: #0f172a; }
    .doc-box { margin: 12px 0; padding: 10px 14px; border-left: 4px solid #15803d; background: #f0fdf4; border-radius: 0 8px 8px 0; }
    .doc-box h3 { margin: 0 0 4px 0; font-size: 13px; color: #166534; }
    .doc-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    .doc-table th { background: #f1f5f9; color: #334155; font-weight: 700; text-align: left; padding: 8px 10px; border: 1px solid #cbd5e1; }
    .doc-table td { padding: 8px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
    .doc-table tr:nth-child(even) { background: #f8fafc; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 11px; }
    .badge-meat { background: #dcfce7; color: #166534; }
    .badge-egg { background: #fef3c7; color: #92400e; }
    .doc-advice { margin: 14px 0; padding: 10px 14px; background: #fafafa; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; white-space: pre-wrap; }
    .doc-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 36px; padding-top: 15px; border-top: 1px solid #e2e8f0; }
    .doc-sig { text-align: center; width: 180px; }
    .doc-sig-line { border-bottom: 1px solid #0f172a; height: 35px; margin-bottom: 5px; }
    .doc-notice { font-size: 10px; color: #64748b; max-width: 390px; line-height: 1.4; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  ${bodyHtml}
  <script>window.addEventListener('load', () => window.print())</script>
</body>
</html>`
}

function prescriptionMarkup(prescription) {
  const medications = Array.isArray(prescription.medications) ? prescription.medications : []
  const dateStr = prescription.formattedDate
    || (prescription.timestamp ? new Date(prescription.timestamp).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' }) : new Date().toLocaleString())

  return wrapPrintDocument(`Prescription - ${prescription.diagnosis || 'PoultryMedix'}`, `
    <div class="doc-header">
      <div>
        <h1 class="doc-title">POULTRY VETERINARY PRESCRIPTION</h1>
        <div class="doc-subtitle">Bangladesh DLS &amp; DGDA Antimicrobial Stewardship Compliant</div>
      </div>
      <div class="doc-meta-right">
        <div style="font-size:15px;font-weight:800;color:#0f172a;">${escapeHtml(prescription.vetName || 'Dr. Sarah Ahmed, DVM')}</div>
        <div style="font-size:11px;color:#047857;font-weight:700;">${escapeHtml(prescription.bvcRegNo || prescription.registrationNumber || 'BVC-REG-10492')}</div>
        <div style="font-size:11px;color:#64748b;">${escapeHtml(prescription.clinicDetails || 'Avian Clinical Services, Rajshahi')}</div>
      </div>
    </div>

    <div class="doc-grid doc-grid-4">
      <div class="doc-cell"><span>Farmer Name</span><strong>${escapeHtml(prescription.farmerName || 'Registered Farmer')}</strong></div>
      <div class="doc-cell"><span>District</span><strong>${escapeHtml(prescription.district || 'Rajshahi')}</strong></div>
      <div class="doc-cell"><span>Flock Type</span><strong>${escapeHtml(prescription.flockType || prescription.birdType || 'Broiler')} (${escapeHtml(prescription.flockSize || '—')} birds)</strong></div>
      <div class="doc-cell"><span>Date &amp; Time</span><strong>${escapeHtml(dateStr)}</strong></div>
    </div>

    <div class="doc-box">
      <h3>Rx &amp; Diagnosis: ${escapeHtml(prescription.diagnosis || 'Flock Consultation')}</h3>
      ${prescription.complaints?.length ? `<p style="margin:0;font-size:11px;color:#475569;">Reported Signs: ${escapeHtml(Array.isArray(prescription.complaints) ? prescription.complaints.join(', ') : prescription.complaints)}</p>` : ''}
    </div>

    <table class="doc-table">
      <thead>
        <tr>
          <th style="width:28px">#</th>
          <th>Medication (Trade &amp; Generic)</th>
          <th>Dosage &amp; Frequency</th>
          <th>Duration</th>
          <th>Meat Withdrawal</th>
          <th>Egg Withdrawal</th>
        </tr>
      </thead>
      <tbody>
        ${medications.length ? medications.map((m, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>
              <strong>${escapeHtml(m.tradeName || m.name || 'Prescribed Compound')}</strong>
              ${m.genericName ? `<br><small style="color:#64748b">${escapeHtml(m.genericName)} (${escapeHtml(m.antibioticClass || 'Antimicrobial')})</small>` : ''}
            </td>
            <td>${escapeHtml(m.dosage || 'As directed')}<br><small style="color:#64748b">${escapeHtml(m.frequency || 'Once daily')}</small></td>
            <td>${escapeHtml(m.duration || '3-5 Days')}</td>
            <td><span class="badge badge-meat">${escapeHtml(m.meatWithdrawalDays || m.withdrawal || '7 days')}</span></td>
            <td><span class="badge badge-egg">${escapeHtml(m.eggWithdrawalDays || 'Not for layers')}</span></td>
          </tr>
        `).join('') : `<tr><td colspan="6" style="text-align:center;color:#64748b;padding:16px;">No specific pharmaceuticals listed. Maintain supportive biosecurity.</td></tr>`}
      </tbody>
    </table>

    ${prescription.advice || prescription.transcription ? `
      <div class="doc-advice"><strong>Veterinarian Instructions &amp; Biosecurity Advice:</strong>\n${escapeHtml(prescription.advice || prescription.transcription)}</div>
    ` : ''}

    ${prescription.followUpDate ? `<div style="font-size:11px;color:#1e40af;margin-top:6px;"><strong>Scheduled Follow-Up:</strong> ${escapeHtml(prescription.followUpDate)}</div>` : ''}

    <div class="doc-footer">
      <div class="doc-notice">
        <strong>Statutory Antimicrobial Stewardship Notice:</strong><br>
        Administer strictly according to prescribed dosage and duration. Under Bangladesh DLS and DGDA regulations, meat and egg withdrawal periods must be strictly honored before food chain marketing.
      </div>
      <div class="doc-sig">
        <div class="doc-sig-line"></div>
        <strong style="font-size:11px;">Registered Veterinarian</strong><br>
        <small style="color:#64748b;font-size:10px;">Signature &amp; Seal</small>
      </div>
    </div>
  `)
}

function diagnosisMarkup(record) {
  const dateStr = record.formattedDate || new Date(record.timestamp || Date.now()).toLocaleString()
  const breakdown = Array.isArray(record.breakdown) ? record.breakdown : []

  return wrapPrintDocument(`Smart Diagnosis - ${record.primaryDisease || 'Report'}`, `
    <div class="doc-header">
      <div>
        <h1 class="doc-title">POULTRYMEDIX AI TRIAGE REPORT</h1>
        <div class="doc-subtitle">Multimodal Flock Health Screening &amp; Biosecurity Guidance</div>
      </div>
      <div class="doc-meta-right">
        <div style="font-size:12px;font-weight:700;">Date: ${escapeHtml(dateStr)}</div>
        <div style="font-size:11px;color:#047857;">District: ${escapeHtml(record.district || 'Rajshahi')}</div>
      </div>
    </div>

    <div class="doc-box">
      <h3>Primary Screened Condition: ${escapeHtml(record.primaryDisease || 'Clinical Screening')} (${escapeHtml(record.confidencePercent || '—')})</h3>
      <p style="margin:0;font-size:11px;color:#475569;">Modalities Used: ${escapeHtml((record.inputModalities || ['text']).join(', '))}</p>
    </div>

    ${breakdown.length ? `
      <table class="doc-table">
        <thead><tr><th>Condition</th><th>Model Match Confidence</th></tr></thead>
        <tbody>
          ${breakdown.map((b) => `<tr><td>${escapeHtml(b.disease || b.label)}</td><td><strong>${escapeHtml(b.confidencePercent || `${Number(b.probability || 0).toFixed(1)}%`)}</strong></td></tr>`).join('')}
        </tbody>
      </table>
    ` : ''}

    <div class="doc-advice"><strong>AI Clinical Guidance &amp; Biosecurity Protocol:</strong>\n${escapeHtml(record.guidanceSummary || 'Consult a licensed veterinarian for clinical diagnosis and prescription.')}</div>

    <div class="doc-footer">
      <div class="doc-notice">
        <strong>Veterinary Consulting Notice:</strong> This report is for informational triage guidance only and is not a veterinary diagnosis or prescription. Always consult a BVC-registered veterinarian before administering treatments.
      </div>
    </div>
  `)
}

function surveillanceMarkup(record) {
  const disease = record.disease || record.primaryDisease || 'Field Report'
  const zoonotic = getZoonoticInfo(disease)
  const dateStr = record.formattedDate || new Date(record.timestamp || Date.now()).toLocaleString()
  const roleMeta = REPORTER_ROLES[normalizeReporterSource(record.reporterRole || record.source)]
  return wrapPrintDocument(`One-Health Surveillance - ${disease}`, `
    <div class="doc-header">
      <div>
        <h1 class="doc-title">ONE-HEALTH SURVEILLANCE REPORT</h1>
        <div class="doc-subtitle">${escapeHtml(roleMeta.labelEn)} · Bangladesh Poultry Surveillance Network</div>
      </div>
      <div class="doc-meta-right">
        <div style="font-size:12px;font-weight:700;">Date: ${escapeHtml(dateStr)}</div>
        <div style="font-size:11px;color:#047857;">${escapeHtml(record.district || 'Rajshahi')}${record.upazila ? ` · ${escapeHtml(record.upazila)}` : ''}</div>
      </div>
    </div>

    <div class="doc-grid doc-grid-4">
      <div class="doc-cell"><span>Reporter Source</span><strong>${escapeHtml(roleMeta.labelEn)}</strong></div>
      <div class="doc-cell"><span>Reporter / Center</span><strong>${escapeHtml(record.reporterName || roleMeta.labelEn)}</strong></div>
      <div class="doc-cell"><span>Bird Species</span><strong>${escapeHtml(record.species || 'Broiler')}</strong></div>
      <div class="doc-cell"><span>Mortality Count</span><strong>${escapeHtml(Number(record.mortalityCount) || 0)} birds</strong></div>
    </div>

    <div class="doc-box" style="${zoonotic.isZoonotic ? 'border-left-color:#b91c1c;background:#fef2f2;' : ''}">
      <h3 style="${zoonotic.isZoonotic ? 'color:#991b1b;' : ''}">
        Detected Disease: ${escapeHtml(disease)}
        ${zoonotic.isZoonotic ? ' — [⚠️ ZOONOTIC RISK: Human-Animal Transmission]' : ''}
      </h3>
      <p style="margin:4px 0 0;font-size:12px;">Antibiotic Prescribed / Reported: <strong>${escapeHtml(record.antibioticPrescribed || 'None / Supportive Only')}</strong></p>
    </div>

    ${record.notes ? `<div class="doc-advice"><strong>Field / Lab Notes:</strong>\n${escapeHtml(record.notes)}</div>` : ''}
    ${zoonotic.isZoonotic ? `<div class="doc-notice" style="margin-top:12px;color:#991b1b;"><strong>One-Health Biosecurity Protocol:</strong> Wear PPE (N95 mask, gloves, goggles), deep-bury dead birds with quicklime, and notify local ULO / DLS helpline 16358 immediately.</div>` : ''}
  `)
}

function buildSurveillanceShareText(record) {
  const disease = record.disease || record.primaryDisease || 'Field Case'
  const zoonotic = getZoonoticInfo(disease)
  const roleMeta = REPORTER_ROLES[normalizeReporterSource(record.reporterRole || record.source)]
  return `🛡️ *PoultryMedix One-Health Surveillance Report*
📅 ${record.formattedDate || new Date(record.timestamp || Date.now()).toLocaleString()}
📍 ${record.district || 'Rajshahi'}${record.upazila ? `, ${record.upazila}` : ''}
🏛️ Source: ${roleMeta.labelEn} (${record.reporterName || ''})
🐓 Species: ${record.species || 'Poultry'} | Mortality: ${Number(record.mortalityCount) || 0}
🩺 Disease: ${disease}${zoonotic.isZoonotic ? ' [⚠️ ZOONOTIC RISK]' : ''}
💊 Antibiotic: ${record.antibioticPrescribed || 'None / Supportive Only'}
${record.notes ? `📝 Notes: ${record.notes}` : ''}`
}

function consultationMarkup(record) {
  const bookingDate = record.bookingDate || record.date || '—'
  const bookingTime = record.bookingTime || record.time || '—'
  return wrapPrintDocument(`Vet Booking - ${record.vetName || 'Consultation'}`, `
    <div class="doc-header">
      <div>
        <h1 class="doc-title">VETERINARY CONSULTATION BOOKING SLIP</h1>
        <div class="doc-subtitle">PoultryMedix Telemedicine Appointment &amp; Fee Record</div>
      </div>
      <div class="doc-meta-right">
        <div style="font-size:13px;font-weight:800;">${escapeHtml(record.vetName || 'Dr. Sarah Ahmed, DVM')}</div>
        <div style="font-size:11px;color:#047857;">${escapeHtml(record.bvcRegNo || 'BVC-REG-10492')}</div>
      </div>
    </div>

    <div class="doc-grid">
      <div class="doc-cell"><span>Scheduled Date &amp; Time</span><strong>${escapeHtml(bookingDate)} at ${escapeHtml(bookingTime)}</strong></div>
      <div class="doc-cell"><span>Clinic / Center</span><strong>${escapeHtml(record.clinicDetails || 'PoultryMedix Vet Care')}</strong></div>
      <div class="doc-cell"><span>Farmer Name</span><strong>${escapeHtml(record.farmerName || 'Registered Farmer')}</strong></div>
      <div class="doc-cell"><span>Farm &amp; District</span><strong>${escapeHtml([record.farmName, record.district || 'Rajshahi'].filter(Boolean).join(' · '))}</strong></div>
      <div class="doc-cell"><span>Payment Method</span><strong>${escapeHtml(record.paymentMethodLabel || record.paymentMethod || 'bKash')}</strong></div>
      <div class="doc-cell"><span>Consultation Fee</span><strong>৳ ${escapeHtml(Number(record.amount) || 500)} (${escapeHtml(record.paymentStatus || 'Confirmed')})</strong></div>
    </div>

    <div class="doc-box">
      <h3>Main Clinical Concern</h3>
      <p style="margin:0;font-size:12px;">${escapeHtml(record.concern || 'General poultry consultation')}</p>
    </div>
  `)
}

async function shareTextRecord({ title, text }, onStatus, language) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text })
      onStatus(language === 'bn' ? 'সফলভাবে শেয়ার করা হয়েছে!' : 'Shared successfully!')
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      onStatus(language === 'bn' ? 'সারাংশ ক্লিপবোর্ডে কপি করা হয়েছে!' : 'Summary copied to clipboard!')
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank')
      onStatus(language === 'bn' ? 'শেয়ার অপশন খোলা হয়েছে!' : 'Opened share options!')
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank')
    }
  }
}

function buildPrescriptionShareText(record) {
  const meds = Array.isArray(record.medications) ? record.medications : []
  const medSummary = meds
    .map(
      (m, i) =>
        `${i + 1}. ${m.tradeName || m.name} (${m.genericName || ''}) - Dose: ${m.dosage || 'As directed'} | Meat: ${m.meatWithdrawalDays || m.withdrawal || '7 days'} | Eggs: ${m.eggWithdrawalDays || 'Not for layers'}`
    )
    .join('\n')

  return `📋 *PoultryMedix Veterinary Prescription*
📅 Date & Time: ${record.formattedDate || new Date(record.timestamp || Date.now()).toLocaleString()}
📍 District: ${record.district || 'Rajshahi'}
👨‍⚕️ Veterinarian: ${record.vetName || 'Registered Veterinarian'} (${record.bvcRegNo || 'BVC Registered'})
👤 Farmer: ${record.farmerName || 'Flock Owner'} | ${record.flockType || 'Poultry'}
🩺 Diagnosis: ${record.diagnosis || 'Clinical Diagnosis'}

💊 Prescribed Medications:
${medSummary || 'None listed'}

⚠️ Advice: ${record.advice || record.transcription || 'Observe withdrawal periods strictly.'}
🔗 Verified via PoultryMedix AI (DLS & DGDA Guidelines)`
}

function openPrintPopup(html, onStatus, labels) {
  const popup = window.open('', '_blank')
  if (!popup) {
    onStatus(labels.popupBlocked)
    return
  }
  popup.opener = null
  popup.document.open()
  popup.document.write(html)
  popup.document.close()
  onStatus(labels.pdfSaveHint)
}

export default function ClinicalLog() {
  const { t, language } = useLanguage()
  const locale = { en: 'en-BD', bn: 'bn-BD', hi: 'hi-IN', ur: 'ur-PK' }[language] || 'en-BD'
  const [activeTab, setActiveTab] = useState('unified')
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [actionStatus, setActionStatus] = useState('')
  const [structuredLogs, setStructuredLogs] = useState(() => getClinicalLogs('all'))
  const [oneHealthSummary, setOneHealthSummary] = useState(() => getOneHealthSurveillanceSummary())
  const [legacyChats, setLegacyChats] = useState(() => {
    try { return readHistory('chat') } catch { return [] }
  })
  const [legacyAppointments, setLegacyAppointments] = useState(() => {
    try { return readHistory('appointment') } catch { return [] }
  })

  useEffect(() => {
    function refreshLogs() {
      setStructuredLogs(getClinicalLogs('all'))
      setOneHealthSummary(getOneHealthSurveillanceSummary())
      try { setLegacyChats(readHistory('chat')) } catch { /* ignore */ }
      try { setLegacyAppointments(readHistory('appointment')) } catch { /* ignore */ }
    }
    window.addEventListener(CLINICAL_LOGS_UPDATED_EVENT, refreshLogs)
    window.addEventListener(ANALYTICS_UPDATED_EVENT, refreshLogs)
    window.addEventListener('storage', refreshLogs)
    return () => {
      window.removeEventListener(CLINICAL_LOGS_UPDATED_EVENT, refreshLogs)
      window.removeEventListener(ANALYTICS_UPDATED_EVENT, refreshLogs)
      window.removeEventListener('storage', refreshLogs)
    }
  }, [])

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') setSelectedRecord(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [])

  const labels = {
    popupBlocked: language === 'bn' ? 'পপ-আপ ব্লক করা হয়েছে। অনুগ্রহ করে অনুমতি দিন।' : 'Pop-up blocked. Please allow pop-ups to save PDF.',
    pdfSaveHint: language === 'bn' ? 'PDF প্রিন্ট / ডাউনলোড উইন্ডো খোলা হয়েছে।' : 'PDF download / print view opened.',
    viewDetails: language === 'bn' ? 'বিস্তারিত দেখুন' : 'View Details',
    downloadPdf: language === 'bn' ? 'PDF ডাউনলোড' : 'Download PDF',
    share: language === 'bn' ? 'শেয়ার' : 'Share',
  }

  const surveillanceLogs = useMemo(
    () => structuredLogs.filter((log) => log.type === 'surveillance'),
    [structuredLogs]
  )
  const diagnosisLogs = useMemo(
    () => structuredLogs.filter((log) => log.type === 'diagnosis'),
    [structuredLogs]
  )
  const prescriptionLogs = useMemo(
    () => structuredLogs.filter((log) => log.type === 'prescription'),
    [structuredLogs]
  )

  // Deduplicate structured consultation logs with legacy appointments
  const consultationBookings = useMemo(() => {
    const storeBookings = structuredLogs.filter((log) => log.type === 'consultation')
    const seen = new Set(storeBookings.map((item) => String(item.id)))
    const merged = [...storeBookings]
    for (const appt of legacyAppointments) {
      if (!seen.has(String(appt.id))) {
        seen.add(String(appt.id))
        merged.push({
          ...appt,
          type: 'consultation',
          timestamp: appt.createdAt || new Date().toISOString(),
          bookingDate: appt.date || '',
          bookingTime: appt.time || '',
        })
      }
    }
    merged.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    return merged
  }, [structuredLogs, legacyAppointments])

  // Consultation tab shows Vet Bookings + Doctor-Issued Consultation Prescriptions
  const consultationTabLogs = useMemo(() => {
    const vetRx = prescriptionLogs.filter((p) => p.source === 'vet_issued')
    return [...consultationBookings, ...vetRx].sort(
      (a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
    )
  }, [consultationBookings, prescriptionLogs])

  // Unified tab combines all clinical records & chat sessions chronologically
  const unifiedLogs = useMemo(() => {
    const normalizedChats = legacyChats.map((chat) => ({
      ...chat,
      type: 'chat',
      timestamp: chat.updatedAt || chat.createdAt || new Date().toISOString(),
    }))
    const seen = new Set()
    return [...structuredLogs, ...consultationBookings, ...normalizedChats]
      .filter((item) => {
        const key = `${item.type}-${item.id}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
  }, [structuredLogs, consultationBookings, legacyChats])

  return (
    <div className="veterinary-page clinical-history-page bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <section className="veterinary-page-heading">
        <span className="veterinary-kicker">{t('veterinaryToolsEyebrow')}</span>
        <h1>{t('clinicalLogTitle')}</h1>
        <p>{t('historyDashboardDescription')}</p>
      </section>

      {/* Compact One-Health Source & Zoonotic Surveillance Strip */}
      <section className="clinical-onehealth-strip dark:bg-gray-800 dark:border-gray-700" aria-label={t('sourceBreakdownTitle')}>
        <div className="clinical-strip-item">
          <span>{language === 'bn' ? REPORTER_ROLES.ulo_hospital.shortBn : REPORTER_ROLES.ulo_hospital.shortEn}</span>
          <strong>{oneHealthSummary.sourceStats.ulo_hospital.total}</strong>
        </div>
        <div className="clinical-strip-item">
          <span>{language === 'bn' ? REPORTER_ROLES.bvc_vet.shortBn : REPORTER_ROLES.bvc_vet.shortEn}</span>
          <strong>{oneHealthSummary.sourceStats.bvc_vet.total}</strong>
        </div>
        <div className="clinical-strip-item">
          <span>{language === 'bn' ? REPORTER_ROLES.farmer_ai.shortBn : REPORTER_ROLES.farmer_ai.shortEn}</span>
          <strong>{oneHealthSummary.sourceStats.farmer_ai.total}</strong>
        </div>
        <div className="clinical-strip-item is-zoonotic">
          <span>{t('zoonoticAlertsStat')}</span>
          <strong>
            ⚠️ {oneHealthSummary.zoonoticDistrictCount}{' '}
            {language === 'bn' ? 'জেলা' : 'districts'}
          </strong>
        </div>
      </section>

      {actionStatus && (
        <p className="history-feedback" role="status" style={{ margin: '8px 0' }}>
          {actionStatus}
        </p>
      )}

      {/* Horizontally scrollable, single-line nowrap tab bar */}
      <div className="history-tabs" role="tablist" aria-label={t('historyDashboardTabs')}>
        {historyTabs.map(({ id, labelKey }) => {
          const TabIcon = historyTabIcons[id]
          const count =
            id === 'unified'
              ? unifiedLogs.length
              : id === 'surveillance'
              ? surveillanceLogs.length
              : id === 'diagnosis'
              ? diagnosisLogs.length
              : id === 'prescriptions'
              ? prescriptionLogs.length
              : id === 'consultations'
              ? consultationTabLogs.length
              : id === 'chat'
              ? legacyChats.length
              : consultationBookings.length

          return (
            <button
              className={`history-tab${activeTab === id ? ' is-active' : ''}`}
              type="button"
              role="tab"
              id={`history-tab-${id}`}
              aria-selected={activeTab === id}
              aria-controls={`history-panel-${id}`}
              key={id}
              onClick={() => {
                setActiveTab(id)
                setActionStatus('')
              }}
            >
              <TabIcon size={16} aria-hidden="true" />
              <span>{t(labelKey)}</span>
              {count > 0 && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    background: activeTab === id ? '#dcfce7' : '#e2e8f0',
                    color: activeTab === id ? '#15803d' : '#64748b',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <section
        className="history-panel dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
        role="tabpanel"
        id={`history-panel-${activeTab}`}
        aria-labelledby={`history-tab-${activeTab}`}
      >
        {activeTab === 'unified' && (
          <HistoryList
            records={unifiedLogs}
            emptyText={t('historyNoClinicalLogs')}
            render={(record) => (
              <SummaryCard
                key={`${record.type}-${record.id}`}
                record={record}
                locale={locale}
                language={language}
                labels={labels}
                onSelect={setSelectedRecord}
                onStatus={setActionStatus}
                t={t}
              />
            )}
          />
        )}

        {activeTab === 'surveillance' && (
          <HistoryList
            records={surveillanceLogs}
            emptyText={t('historyNoSurveillanceLogs')}
            emptyIcon={ShieldAlert}
            render={(record) => (
              <SummaryCard
                key={record.id}
                record={record}
                locale={locale}
                language={language}
                labels={labels}
                onSelect={setSelectedRecord}
                onStatus={setActionStatus}
                t={t}
              />
            )}
          />
        )}

        {activeTab === 'diagnosis' && (
          <HistoryList
            records={diagnosisLogs}
            emptyText={t('historyNoDiagnoses')}
            emptyIcon={Brain}
            render={(record) => (
              <SummaryCard
                key={record.id}
                record={record}
                locale={locale}
                language={language}
                labels={labels}
                onSelect={setSelectedRecord}
                onStatus={setActionStatus}
                t={t}
              />
            )}
          />
        )}

        {activeTab === 'prescriptions' && (
          <HistoryList
            records={prescriptionLogs}
            emptyText={t('historyNoPrescriptions')}
            emptyIcon={FileText}
            render={(record) => (
              <SummaryCard
                key={record.id}
                record={record}
                locale={locale}
                language={language}
                labels={labels}
                onSelect={setSelectedRecord}
                onStatus={setActionStatus}
                t={t}
              />
            )}
          />
        )}

        {activeTab === 'consultations' && (
          <HistoryList
            records={consultationTabLogs}
            emptyText={t('historyNoVetConsultations')}
            emptyIcon={Stethoscope}
            render={(record) => (
              <SummaryCard
                key={`${record.type}-${record.id}`}
                record={record}
                locale={locale}
                language={language}
                labels={labels}
                onSelect={setSelectedRecord}
                onStatus={setActionStatus}
                t={t}
              />
            )}
          />
        )}

        {activeTab === 'chat' && (
          <HistoryList
            records={legacyChats.map((c) => ({ ...c, type: 'chat' }))}
            emptyText={t('historyNoChats')}
            emptyIcon={MessageCircle}
            render={(record) => (
              <SummaryCard
                key={record.id}
                record={record}
                locale={locale}
                language={language}
                labels={labels}
                onSelect={setSelectedRecord}
                onStatus={setActionStatus}
                t={t}
              />
            )}
          />
        )}

        {activeTab === 'payments' && (
          <HistoryList
            records={consultationBookings}
            emptyText={t('historyNoPaymentHistory')}
            emptyIcon={CreditCard}
            render={(record) => (
              <SummaryCard
                key={record.id}
                record={{ ...record, displayAsPayment: true }}
                locale={locale}
                language={language}
                labels={labels}
                onSelect={setSelectedRecord}
                onStatus={setActionStatus}
                t={t}
              />
            )}
          />
        )}
      </section>

      {/* UNIFIED CLICK-TO-VIEW RECORD DETAIL MODAL */}
      {selectedRecord && (
        <RecordDetailModal
          record={selectedRecord}
          locale={locale}
          language={language}
          labels={labels}
          t={t}
          onClose={() => setSelectedRecord(null)}
          onStatus={setActionStatus}
        />
      )}
    </div>
  )
}

/**
 * Compact clickable summary card used across all tabs
 */
function SummaryCard({ record, locale, language, labels, onSelect, onStatus, t }) {
  const type = record.type
  const isPrescription = type === 'prescription'
  const isDiagnosis = type === 'diagnosis'
  const isSurveillance = type === 'surveillance'
  const isConsultation = type === 'consultation' || type === 'appointment'
  const isChat = type === 'chat'
  const isVetIssued = record.source === 'vet_issued'

  const dateDisplay = record.formattedDate || formattedDate(record.timestamp || record.updatedAt || record.createdAt, locale)
  const district = record.district || 'Rajshahi'
  const diseaseName = record.disease || record.primaryDisease || ''
  const zoonotic = (isDiagnosis || isSurveillance) ? getZoonoticInfo(diseaseName) : { isZoonotic: false }

  let title = ''
  let subtitle = ''
  let typeLabel = ''
  let badgeClass = ''
  let rightMetric = null

  if (isSurveillance) {
    const roleMeta = REPORTER_ROLES[normalizeReporterSource(record.reporterRole || record.source)]
    title = getDiseaseDisplayLabel(diseaseName, language, t)
    subtitle = [
      record.upazila && `${record.upazila}`,
      record.species && `${record.species}`,
      record.reporterName || (language === 'bn' ? roleMeta.labelBn : roleMeta.labelEn),
      record.antibioticPrescribed && record.antibioticPrescribed !== 'None / Supportive Only'
        ? `Rx: ${t(`antibiotics.generics.${record.antibioticPrescribed}`, record.antibioticPrescribed)}`
        : '',
    ].filter(Boolean).join(' · ')
    typeLabel = language === 'bn' ? roleMeta.shortBn : roleMeta.shortEn
    badgeClass = normalizeReporterSource(record.reporterRole || record.source) === 'ulo_hospital' ? 'vet' : 'diagnosis'
    rightMetric = (
      <span className="history-metric-pill withdrawal">
        {language === 'bn' ? `মৃত্যু: ${Number(record.mortalityCount) || 0}` : `Mortality: ${Number(record.mortalityCount) || 0}`}
      </span>
    )
  } else if (isPrescription) {
    const meds = Array.isArray(record.medications) ? record.medications : []
    const medNames = meds.map((m) => m.tradeName || m.name).filter(Boolean).slice(0, 3).join(', ')
    title = record.diagnosis || (meds[0]?.tradeName ? `${language === 'bn' ? 'প্রেসক্রিপশন' : 'Prescription'}: ${meds[0].tradeName}` : t('historyPrescriptionTitle'))
    subtitle = [
      record.vetName || (isVetIssued ? 'Dr. Sarah Ahmed, DVM' : (language === 'bn' ? 'প্রেসক্রিপশন স্ক্যান' : 'Prescription Scan')),
      record.farmerName && `${t('farmerName')}: ${record.farmerName}`,
      meds.length ? `${meds.length} ${t('historyMedicationCount')}: ${medNames}` : '',
    ].filter(Boolean).join(' · ')
    typeLabel = isVetIssued
      ? (language === 'bn' ? '👨‍⚕️ ডাক্তার প্রেরিত প্রেসক্রিপশন' : '👨‍⚕️ Doctor Prescription')
      : (language === 'bn' ? '📷 প্রেসক্রিপশন স্ক্যান' : '📷 Prescription Scan')
    badgeClass = isVetIssued ? 'vet' : 'scan'
    if (meds[0]) {
      rightMetric = (
        <span className="history-metric-pill withdrawal">
          {t('meatShort', 'Meat')}: {meds[0].meatWithdrawalDays || meds[0].withdrawal || '7 days'}
        </span>
      )
    }
  } else if (isDiagnosis) {
    title = getDiseaseDisplayLabel(record.primaryDisease, language, t) || t('historyDiagnosisLabel')
    subtitle = record.guidanceSummary
      ? record.guidanceSummary.replace(/\s+/g, ' ').slice(0, 120) + (record.guidanceSummary.length > 120 ? '…' : '')
      : (record.inputModalities || ['text']).join(', ')
    typeLabel = language === 'bn' ? '🔬 স্মার্ট ডায়াগনোসিস' : '🔬 Smart Diagnosis'
    badgeClass = 'diagnosis'
    if (record.confidencePercent) {
      rightMetric = (
        <span className="history-metric-pill confidence">
          {record.confidencePercent}
        </span>
      )
    }
  } else if (isConsultation) {
    const bookingDate = record.bookingDate || record.date
    const bookingTime = record.bookingTime || record.time
    const apptDt = bookingDate ? new Date(`${bookingDate}T${bookingTime || '00:00'}`) : null
    const isUpcoming = apptDt && !Number.isNaN(apptDt.getTime()) && apptDt >= new Date()

    if (record.displayAsPayment) {
      title = `${safeText(record.vetName, t('historyVetNotAssigned'))} — ৳ ${Number(record.amount) || 500}`
      subtitle = `${record.paymentMethodLabel || record.paymentMethod || 'bKash'} · ${bookingDate || ''} ${bookingTime || ''} · ${record.farmerName || t('farmer')}`
      typeLabel = language === 'bn' ? '💳 পেমেন্ট রেকর্ড' : '💳 Payment Record'
      badgeClass = 'vet'
      rightMetric = (
        <span className="history-metric-pill confidence">
          {record.paymentStatus || (language === 'bn' ? 'পরিশোধিত' : 'Paid')}
        </span>
      )
    } else {
      title = safeText(record.vetName, t('historyVetNotAssigned'))
      subtitle = [
        bookingDate && `📅 ${bookingDate} ${bookingTime ? `⏰ ${bookingTime}` : ''}`,
        record.farmerName && `${t('farmerName')}: ${record.farmerName}`,
        record.concern,
      ].filter(Boolean).join(' · ')
      typeLabel = language === 'bn' ? '🩺 ভেট কনসালটেশন' : '🩺 Vet Booking'
      badgeClass = 'vet'
      rightMetric = (
        <span className={`history-status${isUpcoming ? ' history-status--upcoming' : ''}`}>
          {isUpcoming ? t('historyUpcoming') : (record.paymentStatus || t('historyBookingConfirmed'))}
        </span>
      )
    }
  } else if (isChat) {
    const transcript = Array.isArray(record.transcript) ? record.transcript : []
    const lastReply = transcript.length ? transcript[transcript.length - 1].text : ''
    title = safeText(record.summary, t('historyChatTopic'))
    subtitle = lastReply
      ? lastReply.replace(/\s+/g, ' ').slice(0, 115) + (lastReply.length > 115 ? '…' : '')
      : t('historyNoDetails')
    typeLabel = language === 'bn' ? '💬 এআই চ্যাট' : '💬 AI Chat'
    badgeClass = 'diagnosis'
    rightMetric = (
      <span className="history-metric-pill" style={{ background: '#e0f2fe', color: '#0369a1' }}>
        {transcript.length} {language === 'bn' ? 'বার্তা' : 'msgs'}
      </span>
    )
  }

  return (
    <article
      className="history-rich-card cursor-pointer dark:bg-gray-800 dark:border-gray-700"
      onClick={() => onSelect(record)}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(record)
        }
      }}
    >
      <header className="history-rich-header dark:border-gray-700">
        <div className="history-meta-badges">
          <span className="history-badge-date dark:bg-gray-900 dark:text-gray-300">
            <Calendar size={12} />
            {dateDisplay}
          </span>
          {!isChat && (
            <span className="history-badge-district dark:bg-gray-900 dark:text-emerald-400">
              <MapPin size={12} />
              {t(`districts.${district}`, district)}
              {record.upazila ? ` (${record.upazila})` : ''}
            </span>
          )}
          <span className={`history-badge-type ${badgeClass} dark:bg-gray-900`}>
            {typeLabel}
          </span>
          {zoonotic.isZoonotic && (
            <span className="zoonotic-risk-badge is-compact">
              ⚠️ {t('zoonoticRiskShort')}
            </span>
          )}
        </div>
        <div>{rightMetric}</div>
      </header>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h4 className="history-rich-title dark:text-white" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </h4>
          {subtitle && (
            <p className="history-rich-desc dark:text-gray-300" style={{ marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {subtitle}
            </p>
          )}
        </div>
        <ChevronRight size={18} className="shrink-0 text-gray-400" aria-hidden="true" />
      </div>

      {(isPrescription || isSurveillance) ? (
        <div
          className="history-prescription-actions-row"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="history-action-btn history-action-btn--primary"
            onClick={() => onSelect(record)}
          >
            <BookOpen size={13} />
            <span>{labels.viewDetails}</span>
          </button>
          <button
            type="button"
            className="history-action-btn"
            onClick={() => openPrintPopup(isSurveillance ? surveillanceMarkup(record) : prescriptionMarkup(record), onStatus, labels)}
          >
            <Printer size={13} />
            <span>{labels.downloadPdf}</span>
          </button>
          <button
            type="button"
            className="history-action-btn"
            onClick={() =>
              shareTextRecord(
                isSurveillance
                  ? { title: `One-Health Surveillance - ${title}`, text: buildSurveillanceShareText(record) }
                  : { title: `PoultryMedix Prescription - ${title}`, text: buildPrescriptionShareText(record) },
                onStatus,
                language
              )
            }
          >
            <Share2 size={13} />
            <span>{labels.share}</span>
          </button>
        </div>
      ) : null}
    </article>
  )
}

/**
 * Unified Details Modal for Prescriptions, Smart Diagnosis, Vet Bookings, and AI Chats
 */
function RecordDetailModal({ record, locale, language, labels, t, onClose, onStatus }) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  const type = record.type
  const isPrescription = type === 'prescription'
  const isDiagnosis = type === 'diagnosis'
  const isSurveillance = type === 'surveillance'
  const isConsultation = type === 'consultation' || type === 'appointment'
  const isChat = type === 'chat'
  const modalDisease = record.disease || record.primaryDisease || ''
  const zoonotic = (isDiagnosis || isSurveillance) ? getZoonoticInfo(modalDisease) : { isZoonotic: false }

  const dateDisplay = record.formattedDate || formattedDate(record.timestamp || record.updatedAt || record.createdAt, locale)

  return createPortal(
    <div
      className="history-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="history-prescription-modal dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-detail-modal-title"
      >
        <header>
          <div>
            <span className="veterinary-kicker">
              {isPrescription
                ? (record.source === 'vet_issued' ? (language === 'bn' ? 'ভেটেরিনারি প্রেসক্রিপশন' : 'Registered Vet Prescription') : (language === 'bn' ? 'প্রেসক্রিপশন স্ক্যান' : 'Prescription Analysis'))
                : isSurveillance
                ? (language === 'bn' ? 'ওয়ান-হেলথ ফিল্ড ও ULO সার্ভেইল্যান্স' : 'One-Health Field / ULO Surveillance')
                : isDiagnosis
                ? (language === 'bn' ? 'স্মার্ট ডায়াগনোসিস রিপোর্ট' : 'Smart Diagnosis Report')
                : isConsultation
                ? (language === 'bn' ? 'ভেট কনসালটেশন বুকিং' : 'Vet Consultation Record')
                : (language === 'bn' ? 'AI চ্যাট কথোপকথন' : 'AI Chat Conversation')}
            </span>
            <h2 id="history-detail-modal-title">
              {isChat
                ? safeText(record.summary, t('historyChatTopic'))
                : isConsultation
                ? safeText(record.vetName, t('historyVetNotAssigned'))
                : record.diagnosis || getDiseaseDisplayLabel(modalDisease, language, t) || 'Clinical Details'}
            </h2>
            <small style={{ color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
              <Clock size={12} /> {dateDisplay}
              {!isChat && record.district && ` · 📍 ${t(`districts.${record.district}`, record.district)}${record.upazila ? `, ${record.upazila}` : ''}`}
            </small>
          </div>
          <button
            type="button"
            className="history-modal-close-btn"
            aria-label={t('close') || 'Close'}
            title={t('close') || 'Close'}
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>

        <div className="history-prescription-modal-body dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700">
          {/* ONE-HEALTH ZOONOTIC WARNING LAYER */}
          {zoonotic.isZoonotic && (
            <div className="surveillance-zoonotic-preview" role="alert">
              <div className="surveillance-zoonotic-badge-row">
                <span className="zoonotic-risk-badge">
                  <AlertTriangle size={13} aria-hidden="true" />
                  <span>{t('zoonoticRiskBadge')}</span>
                </span>
              </div>
              <p style={{ marginTop: '6px', fontSize: '12px' }}>
                {language === 'bn' ? zoonotic.riskNoteBn : zoonotic.riskNoteEn}
              </p>
              <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '11.5px', display: 'grid', gap: '4px' }}>
                {ZOONOTIC_HUMAN_PRECAUTIONS.slice(0, 3).map((prec) => (
                  <li key={prec.id}>
                    <strong>{language === 'bn' ? prec.titleBn : prec.titleEn}:</strong>{' '}
                    {language === 'bn' ? prec.detailBn : prec.detailEn}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* FIELD / ULO SURVEILLANCE DETAIL */}
          {isSurveillance && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px', background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }} className="dark:bg-gray-800 dark:border-gray-700">
                <div>
                  <small style={{ color: '#64748b', display: 'block', fontSize: '10px', fontWeight: 700 }}>{t('reporterRoleLabel')}</small>
                  <strong className="dark:text-white">
                    {language === 'bn'
                      ? (REPORTER_ROLES[normalizeReporterSource(record.reporterRole || record.source)]?.labelBn)
                      : (REPORTER_ROLES[normalizeReporterSource(record.reporterRole || record.source)]?.labelEn)}
                  </strong>
                  <div style={{ fontSize: '11px', color: '#047857' }}>{record.reporterName}</div>
                </div>
                <div>
                  <small style={{ color: '#64748b', display: 'block', fontSize: '10px', fontWeight: 700 }}>{t('birdSpeciesLabel')} · {t('mortalityCountLabel')}</small>
                  <strong className="dark:text-white">{record.species || 'Broiler'}</strong>
                  <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 700 }}>
                    {language === 'bn' ? `মৃত্যু: ${Number(record.mortalityCount) || 0} পাখি` : `${Number(record.mortalityCount) || 0} mortality`}
                  </div>
                </div>
                <div>
                  <small style={{ color: '#64748b', display: 'block', fontSize: '10px', fontWeight: 700 }}>{t('antibioticPrescribedLabel')}</small>
                  <strong className="dark:text-white">{record.antibioticPrescribed || 'None / Supportive Only'}</strong>
                </div>
              </div>
              {record.notes && (
                <div style={{ padding: '10px 14px', background: '#fafafa', borderRadius: '10px', border: '1px solid #e2e8f0' }} className="dark:bg-gray-800 dark:border-gray-700">
                  <strong style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>{t('surveillanceNotesLabel')}:</strong>
                  <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5 }}>{record.notes}</p>
                </div>
              )}
            </>
          )}

          {/* PRESCRIPTION DETAIL */}
          {isPrescription && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px', background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }} className="dark:bg-gray-800 dark:border-gray-700">
                <div>
                  <small style={{ color: '#64748b', display: 'block', fontSize: '10px', fontWeight: 700 }}>{t('historyVeterinarianUpper')}</small>
                  <strong className="dark:text-white">{record.vetName || t('historyVeterinarian')}</strong>
                  <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 600 }}>{record.bvcRegNo || 'BVC-REG-10492'}</div>
                </div>
                <div>
                  <small style={{ color: '#64748b', display: 'block', fontSize: '10px', fontWeight: 700 }}>{t('historyFarmerFlockUpper')}</small>
                  <strong className="dark:text-white">{record.farmerName || t('farmer')}</strong>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>📍 {t(`districts.${record.district || 'Rajshahi'}`, record.district || 'Rajshahi')} · {t(`birdTypes.${record.flockType || 'Broiler'}`, record.flockType || 'Broiler')}</div>
                </div>
              </div>

              <h3>{t('historyMedications')}</h3>
              {(Array.isArray(record.medications) ? record.medications : []).map((item, idx) => (
                <article className="history-medication-detail dark:bg-gray-800 dark:border-gray-700" key={item.id || idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
                    <div>
                      <strong className="dark:text-white" style={{ fontSize: '13px' }}>{item.tradeName || item.name}</strong>
                      {item.genericName && <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>({item.genericName})</span>}
                    </div>
                    <span className="prescription-status-pill is-approved" style={{ fontSize: '10px' }}>
                      {item.antibioticClass || t('antibioticBadge')}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0', fontSize: '12px' }}>
                    {[item.formulation, item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <span className="badge-pill meat">{t('meatShort', 'Meat')}: {item.meatWithdrawalDays || item.withdrawal || '7 days'}</span>
                    <span className="badge-pill egg">{t('eggShort', 'Eggs')}: {item.eggWithdrawalDays || (language === 'bn' ? 'লেয়ারের জন্য নয়' : 'Not for layers')}</span>
                  </div>
                </article>
              ))}

              {(record.advice || record.transcription) && (
                <div style={{ padding: '10px 14px', background: '#fafafa', borderRadius: '10px', border: '1px solid #e2e8f0' }} className="dark:bg-gray-800 dark:border-gray-700">
                  <strong style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>{t('historyAdviceHeading')}:</strong>
                  <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5 }}>{record.advice || record.transcription}</p>
                </div>
              )}

              {record.followUpDate && (
                <p style={{ fontSize: '12px', color: '#1d4ed8' }}>
                  <strong>{t('historyFollowUpHeading')}:</strong> {record.followUpDate}
                </p>
              )}
            </>
          )}

          {/* SMART DIAGNOSIS DETAIL */}
          {isDiagnosis && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <span className="history-metric-pill confidence">{t('historyConfidenceLabel')}: {record.confidencePercent || '—'}</span>
                {(record.inputModalities || []).map((mod) => (
                  <span key={mod} className="history-modality-pill dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
                    {mod === 'image' ? `🖼️ ${t('historyModalityImage')}` : mod === 'audio' ? `🎤 ${t('historyModalityAudio')}` : `📝 ${t('historyModalitySymptoms')}`}
                  </span>
                ))}
              </div>

              {Array.isArray(record.breakdown) && record.breakdown.length > 0 && (
                <div>
                  <h3>{t('historyPredictionBreakdown')}</h3>
                  <div style={{ display: 'grid', gap: '6px', marginTop: '6px' }}>
                    {record.breakdown.slice(0, 6).map((b, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }} className="dark:bg-gray-800 dark:border-gray-700">
                        <span>{b.disease || b.label}</span>
                        <strong>{b.confidencePercent || `${Number(b.probability || 0).toFixed(1)}%`}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3>{t('historyAiClinicalGuidance')}</h3>
                <p style={{ marginTop: '6px', whiteSpace: 'pre-wrap' }}>{record.guidanceSummary || t('veterinarySafetyDisclaimer')}</p>
              </div>
            </>
          )}

          {/* VET CONSULTATION / PAYMENT BOOKING DETAIL */}
          {isConsultation && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px', background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }} className="dark:bg-gray-800 dark:border-gray-700">
                <div>
                  <small style={{ color: '#64748b', display: 'block', fontSize: '10px', fontWeight: 700 }}>{t('historyScheduledDateTime')}</small>
                  <strong className="dark:text-white">{record.bookingDate || record.date || '—'} · {record.bookingTime || record.time || '—'}</strong>
                </div>
                <div>
                  <small style={{ color: '#64748b', display: 'block', fontSize: '10px', fontWeight: 700 }}>{t('historyVetClinicUpper')}</small>
                  <strong className="dark:text-white">{record.vetName || 'Dr. Sarah Ahmed, DVM'}</strong>
                  <div style={{ fontSize: '11px', color: '#047857' }}>{record.clinicDetails || 'PoultryMedix Veterinary Care'}</div>
                </div>
                <div>
                  <small style={{ color: '#64748b', display: 'block', fontSize: '10px', fontWeight: 700 }}>{t('historyFarmerFarmUpper')}</small>
                  <strong className="dark:text-white">{record.farmerName || t('farmer')}</strong>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{record.farmName || t('farmName')} · {t(`districts.${record.district || 'Rajshahi'}`, record.district || 'Rajshahi')}</div>
                </div>
                <div>
                  <small style={{ color: '#64748b', display: 'block', fontSize: '10px', fontWeight: 700 }}>{t('historyFeePaymentUpper')}</small>
                  <strong className="dark:text-white">৳ {Number(record.amount) || 500} ({record.paymentMethodLabel || record.paymentMethod || 'bKash'})</strong>
                  <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 600 }}>{record.paymentStatus || t('historyBookingConfirmed')}</div>
                </div>
              </div>

              <div>
                <h3>{t('historyConsultationConcern')}</h3>
                <p style={{ marginTop: '4px' }}>{record.concern || t('historyNoDetails')}</p>
              </div>
            </>
          )}

          {/* AI CHAT FULL TRANSCRIPT MODAL */}
          {isChat && (
            <div className="history-transcript dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700" style={{ borderTop: 'none', padding: 0 }}>
              {(Array.isArray(record.transcript) ? record.transcript : []).map((message, index) => (
                <div
                  className={`history-transcript-message history-transcript-message--${message.role} dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200`}
                  key={`${record.id}-${index}`}
                >
                  <strong>{message.role === 'assistant' ? t('historyAssistant') : t('historyYou')}</strong>
                  <p>{message.text}</p>
                  {message.files?.length > 0 && (
                    <small style={{ color: '#059669' }}>📎 {message.files.join(', ')}</small>
                  )}
                  {message.sources?.length > 0 && (
                    <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {message.sources.map((src, sIdx) => (
                        <a
                          key={sIdx}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#047857', fontWeight: 700 }}
                        >
                          <ExternalLink size={11} /> {src.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {(!record.transcript || !record.transcript.length) && <p>{t('historyNoDetails')}</p>}
            </div>
          )}
        </div>

        <footer className="history-prescription-modal-footer dark:bg-gray-800 dark:border-gray-700" style={{ flexWrap: 'wrap' }}>
          {(isPrescription || isDiagnosis || isConsultation || isSurveillance) && (
            <>
              <button
                type="button"
                className="history-action-btn history-action-btn--primary"
                onClick={() =>
                  openPrintPopup(
                    isSurveillance
                      ? surveillanceMarkup(record)
                      : isPrescription
                      ? prescriptionMarkup(record)
                      : isDiagnosis
                      ? diagnosisMarkup(record)
                      : consultationMarkup(record),
                    onStatus,
                    labels
                  )
                }
              >
                <Printer size={14} />
                <span>{labels.downloadPdf}</span>
              </button>
              <button
                type="button"
                className="history-action-btn"
                onClick={() =>
                  shareTextRecord(
                    isSurveillance
                      ? { title: `One-Health Surveillance - ${modalDisease}`, text: buildSurveillanceShareText(record) }
                      : isPrescription
                      ? { title: `PoultryMedix Prescription - ${record.diagnosis || 'Prescription'}`, text: buildPrescriptionShareText(record) }
                      : isDiagnosis
                      ? {
                          title: `PoultryMedix Triage - ${record.primaryDisease}`,
                          text: `🔬 *PoultryMedix Smart Diagnosis*\n📅 ${dateDisplay} | 📍 ${record.district || 'Rajshahi'}\n🩺 Screened Condition: ${record.primaryDisease} (${record.confidencePercent})\n\n${record.guidanceSummary || ''}`,
                        }
                      : {
                          title: `PoultryMedix Booking - ${record.vetName}`,
                          text: `🩺 *PoultryMedix Vet Consultation*\n👨‍⚕️ Doctor: ${record.vetName}\n📅 Date & Time: ${record.bookingDate || record.date} at ${record.bookingTime || record.time}\n👤 Farmer: ${record.farmerName} (${record.district})\n💳 Fee: ৳ ${Number(record.amount) || 500} (${record.paymentMethodLabel || record.paymentMethod})\n📝 Concern: ${record.concern}`,
                        },
                    onStatus,
                    language
                  )
                }
              >
                <Share2 size={14} />
                <span>{labels.share}</span>
              </button>
            </>
          )}
          <button
            type="button"
            className="history-action-btn"
            onClick={onClose}
          >
            <X size={14} />
            <span>{t('close') || (language === 'bn' ? 'বন্ধ করুন' : 'Close')}</span>
          </button>
        </footer>
      </section>
    </div>,
    document.body
  )
}

function HistoryList({ records, emptyText, emptyDescription, emptyIcon: EmptyIcon = History, render }) {
  return records.length ? (
    <div className="history-entry-list">{records.map(render)}</div>
  ) : (
    <div className="history-empty">
      <span><EmptyIcon size={24} /></span>
      <div>
        <p>{emptyText}</p>
        {emptyDescription && <small>{emptyDescription}</small>}
      </div>
    </div>
  )
}
