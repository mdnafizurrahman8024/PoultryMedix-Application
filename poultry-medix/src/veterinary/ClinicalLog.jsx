import { useEffect, useState } from 'react'
import {
  BookOpen,
  Brain,
  CreditCard,
  ChevronDown,
  ExternalLink,
  FileDown,
  FileText,
  History,
  MessageCircle,
  Printer,
  Share2,
  Stethoscope,
  X,
  Calendar,
  MapPin,
  CheckCircle,
} from 'lucide-react'
import { useLanguage } from '../context/useLanguage.js'
import { readHistory, readPrescriptionHistory } from './historyStore.js'
import {
  getClinicalLogs,
  exportLogsAsJson,
  exportLogsAsCsv,
  CLINICAL_LOGS_UPDATED_EVENT,
} from '../lib/clinicalLogsStore.js'
import { supabase } from '../lib/supabase.js'

const historyTabs = [
  { id: 'unified', labelKey: 'historyAllClinicalLogsTab' },
  { id: 'diagnosis', labelKey: 'historyDiagnosisTab' },
  { id: 'prescriptions', labelKey: 'historyPrescriptionsTab' },
  { id: 'consultations', labelKey: 'historyVetConsultationsTab' },
  { id: 'chat', labelKey: 'historyChatTab' },
  { id: 'payments', labelKey: 'historyPaymentHistoryTab' },
]

const historyTabIcons = {
  unified: History,
  diagnosis: Brain,
  prescriptions: FileText,
  consultations: Stethoscope,
  chat: MessageCircle,
  payments: CreditCard,
}

function formattedDate(value, locale, options = { dateStyle: 'medium', timeStyle: 'short' }) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(locale, options)
}

function safeText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value : fallback
}

/**
 * Official A4 Print-Ready Bangladesh Poultry Veterinary Prescription Pad
 */
function prescriptionMarkup(prescription, labels) {
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])

  const medications = Array.isArray(prescription.medications) ? prescription.medications : []
  const dateStr = prescription.formattedDate || (prescription.timestamp ? new Date(prescription.timestamp).toLocaleDateString('en-BD', { dateStyle: 'long' }) : new Date().toLocaleDateString())

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escape(labels.prescription)} - ${escape(prescription.diagnosis || 'PoultryMedix')}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; margin: 24px; line-height: 1.45; font-size: 13px; }
    .rx-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #15803d; }
    .rx-title { font-size: 20px; font-weight: 800; color: #15803d; margin: 0; }
    .rx-subtitle { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 700; margin-top: 2px; }
    .rx-vet-info { text-align: right; }
    .rx-vet-name { font-size: 15px; font-weight: 800; color: #0f172a; margin: 0; }
    .rx-vet-reg { font-size: 11px; color: #047857; font-weight: 700; }
    .rx-vet-clinic { font-size: 11px; color: #64748b; }
    
    .rx-info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; }
    .rx-info-cell span { display: block; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .rx-info-cell strong { font-size: 12px; color: #0f172a; }

    .rx-diagnosis-box { margin: 12px 0; padding: 10px 14px; border-left: 4px solid #15803d; background: #f0fdf4; border-radius: 0 8px 8px 0; }
    .rx-diagnosis-box h3 { margin: 0 0 4px 0; font-size: 13px; color: #166534; }
    
    .rx-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    .rx-table th { background: #f1f5f9; color: #334155; font-weight: 700; text-align: left; padding: 8px 10px; border: 1px solid #cbd5e1; }
    .rx-table td { padding: 8px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
    .rx-table tr:nth-child(even) { background: #f8fafc; }
    .badge-withdrawal { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 11px; }
    .badge-meat { background: #dcfce7; color: #166534; }
    .badge-egg { background: #fef3c7; color: #92400e; }

    .rx-advice { margin: 14px 0; padding: 10px 14px; background: #fafafa; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; }
    .rx-advice strong { display: block; margin-bottom: 4px; color: #334155; }
    
    .rx-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 36px; padding-top: 15px; border-top: 1px solid #e2e8f0; }
    .rx-signature-box { text-align: center; width: 180px; }
    .rx-sig-line { border-bottom: 1px solid #0f172a; height: 35px; margin-bottom: 5px; }
    .rx-statutory-notice { font-size: 10px; color: #94a3b8; max-width: 380px; line-height: 1.4; }
    
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="rx-header">
    <div>
      <h1 class="rx-title">POULTRY VETERINARY PRESCRIPTION</h1>
      <div class="rx-subtitle">Bangladesh DLS &amp; DGDA Antimicrobial Stewardship Compliant</div>
    </div>
    <div class="rx-vet-info">
      <div class="rx-vet-name">${escape(prescription.vetName || 'Dr. Sarah Ahmed, DVM')}</div>
      <div class="rx-vet-reg">${escape(prescription.bvcRegNo || prescription.registrationNumber || 'BVC-REG-10492')}</div>
      <div class="rx-vet-clinic">${escape(prescription.clinicDetails || 'Avian Clinical Services, Rajshahi')}</div>
    </div>
  </div>

  <div class="rx-info-grid">
    <div class="rx-info-cell"><span>Farmer Name</span><strong>${escape(prescription.farmerName || 'Registered Farmer')}</strong></div>
    <div class="rx-info-cell"><span>District</span><strong>${escape(prescription.district || 'Rajshahi')}</strong></div>
    <div class="rx-info-cell"><span>Bird Type / Flock</span><strong>${escape(prescription.flockType || prescription.birdType || 'Broiler')} (${escape(prescription.flockSize || '—')} birds)</strong></div>
    <div class="rx-info-cell"><span>Date &amp; Time</span><strong>${escape(dateStr)}</strong></div>
  </div>

  <div class="rx-diagnosis-box">
    <h3>Rx &amp; Tentative Clinical Diagnosis: ${escape(prescription.diagnosis || 'Flock Consultation')}</h3>
    ${prescription.complaints?.length ? `<p style="margin:0;font-size:11px;color:#475569;">Reported Signs: ${escape(Array.isArray(prescription.complaints) ? prescription.complaints.join(', ') : prescription.complaints)}</p>` : ''}
  </div>

  <table class="rx-table">
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th>Prescribed Medication (Trade &amp; Generic)</th>
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
            <strong>${escape(m.tradeName || m.name || 'Prescribed Compound')}</strong>
            ${m.genericName ? `<br><small style="color:#64748b">${escape(m.genericName)} (${escape(m.antibioticClass || 'Antimicrobial')})</small>` : ''}
          </td>
          <td>${escape(m.dosage || 'As directed')}<br><small style="color:#64748b">${escape(m.frequency || 'Once daily')}</small></td>
          <td>${escape(m.duration || '3-5 Days')}</td>
          <td><span class="badge-withdrawal badge-meat">${escape(m.meatWithdrawalDays || m.withdrawal || '7 days')}</span></td>
          <td><span class="badge-withdrawal badge-egg">${escape(m.eggWithdrawalDays || 'Not for layers')}</span></td>
        </tr>
      `).join('') : `
        <tr><td colspan="6" style="text-align:center;color:#64748b;padding:16px;">No specific pharmaceuticals prescribed. Maintain supportive flock biosecurity.</td></tr>
      `}
    </tbody>
  </table>

  ${prescription.advice || prescription.transcription ? `
    <div class="rx-advice">
      <strong>Veterinarian Instructions &amp; Biosecurity Advice:</strong>
      <p style="margin:0;color:#334155;">${escape(prescription.advice || prescription.transcription)}</p>
    </div>
  ` : ''}

  ${prescription.followUpDate ? `
    <div style="font-size:11px;color:#1e40af;margin-top:6px;">
      <strong>Scheduled Follow-Up:</strong> ${escape(prescription.followUpDate)}
    </div>
  ` : ''}

  <div class="rx-footer">
    <div class="rx-statutory-notice">
      <strong>Statutory Antimicrobial Stewardship Notice:</strong><br>
      Administer strictly according to prescribed dosage and duration. Under Bangladesh Livestock and DGDA regulations, meat and egg withdrawal times must be strictly honored to prevent chemical and antimicrobial residues from entering human food chains.
    </div>
    <div class="rx-signature-box">
      <div class="rx-sig-line"></div>
      <strong style="font-size:11px;">Registered Veterinarian</strong><br>
      <small style="color:#64748b;font-size:10px;">Signature &amp; Seal</small>
    </div>
  </div>

  <script>window.addEventListener('load', () => window.print())</script>
</body>
</html>`
}

/**
 * Action buttons component for Prescriptions
 */
function PrescriptionActions({ record, labels, onStatus, onRead, language }) {
  function openPrintView() {
    const popup = window.open('', '_blank')
    if (!popup) {
      onStatus(labels.popupBlocked)
      return
    }
    popup.opener = null
    popup.document.open()
    popup.document.write(prescriptionMarkup(record, labels))
    popup.document.close()
    onStatus(labels.pdfSaveHint)
  }

  async function sharePrescription() {
    const meds = Array.isArray(record.medications) ? record.medications : []
    const medSummary = meds
      .map(
        (m, i) =>
          `${i + 1}. ${m.tradeName || m.name} (${m.genericName || ''}) - Dose: ${m.dosage || 'As directed'} | Meat: ${m.meatWithdrawalDays || m.withdrawal || '7 days'} | Eggs: ${m.eggWithdrawalDays || 'Not for layers'}`
      )
      .join('\n')

    const text = `📋 *PoultryMedix Veterinary Prescription*
📅 Date: ${record.formattedDate || new Date(record.timestamp || Date.now()).toLocaleDateString()}
📍 District: ${record.district || 'Rajshahi'}
👨‍⚕️ Veterinarian: ${record.vetName || 'Registered Veterinarian'} (${record.bvcRegNo || 'BVC Registered'})
👤 Farmer: ${record.farmerName || 'Flock Owner'} | ${record.flockType || 'Poultry'}
🩺 Diagnosis: ${record.diagnosis || 'Clinical Diagnosis'}

💊 Prescribed Medications:
${medSummary || 'None listed'}

⚠️ Advice: ${record.advice || record.transcription || 'Observe withdrawal periods strictly.'}
🔗 Verified via PoultryMedix AI (DLS & DGDA Guidelines)`

    try {
      if (navigator.share) {
        await navigator.share({
          title: `PoultryMedix Prescription - ${record.diagnosis || 'Prescription'}`,
          text,
        })
        onStatus(language === 'bn' ? 'প্রেসক্রিপশনটি সফলভাবে শেয়ার করা হয়েছে!' : 'Prescription shared successfully!')
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
        onStatus(labels.shareCopied)
      } else {
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
        window.open(waUrl, '_blank')
        onStatus(language === 'bn' ? 'শেয়ার অপশন খোলা হয়েছে!' : 'Opened share options!')
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
        window.open(waUrl, '_blank')
      }
    }
  }

  return (
    <div className="history-prescription-actions-row">
      <button
        type="button"
        className="history-action-btn history-action-btn--primary"
        onClick={() => onRead(record)}
        aria-label={labels.read}
      >
        <BookOpen size={14} />
        <span>{labels.read}</span>
      </button>
      <button
        type="button"
        className="history-action-btn"
        onClick={openPrintView}
        aria-label={labels.print}
      >
        <Printer size={14} />
        <span>{labels.downloadPdf}</span>
      </button>
      <button
        type="button"
        className="history-action-btn"
        onClick={sharePrescription}
        aria-label={labels.share}
      >
        <Share2 size={14} />
        <span>{labels.share}</span>
      </button>
    </div>
  )
}

export default function ClinicalLog() {
  const { t, language } = useLanguage()
  const locale = { en: 'en-BD', bn: 'bn-BD', hi: 'hi-IN', ur: 'ur-PK' }[language] || 'en-BD'
  const [activeTab, setActiveTab] = useState('unified')
  const [selectedPrescription, setSelectedPrescription] = useState(null)
  const [actionStatus, setActionStatus] = useState('')
  const [structuredLogs, setStructuredLogs] = useState(() => getClinicalLogs('all'))

  const [legacyHistory] = useState(() => {
    try {
      return {
        chats: readHistory('chat'),
        appointments: readHistory('appointment'),
      }
    } catch {
      return { chats: [], appointments: [] }
    }
  })

  // Real-time synchronization for new diagnoses and prescriptions
  useEffect(() => {
    function refreshLogs() {
      setStructuredLogs(getClinicalLogs('all'))
    }
    window.addEventListener(CLINICAL_LOGS_UPDATED_EVENT, refreshLogs)
    window.addEventListener('storage', refreshLogs)
    return () => {
      window.removeEventListener(CLINICAL_LOGS_UPDATED_EVENT, refreshLogs)
      window.removeEventListener('storage', refreshLogs)
    }
  }, [])

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') setSelectedPrescription(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [])

  const prescriptionLabels = {
    prescription: t('historyPrescriptionTitle'),
    unassignedVet: t('historyVetNotAssigned'),
    patientDetails: t('historyPatientDetails'),
    diagnosis: t('historyDiagnosisLabel'),
    medications: t('historyMedications'),
    advice: t('historyAdvice'),
    followUp: t('historyFollowUp'),
    asAdvised: t('historyAsAdvised'),
    popupBlocked: language === 'bn' ? 'পপ-আপ ব্লক করা হয়েছে। অনুগ্রহ করে অনুমতি দিন।' : 'Pop-up blocked. Please allow pop-ups to print.',
    pdfSaveHint: language === 'bn' ? 'প্রিন্ট / PDF ভিউ প্রস্তুত করা হয়েছে।' : 'Print / PDF view opened.',
    shareCopied: language === 'bn' ? 'প্রেসক্রিপশন সারাংশ ক্লিপবোর্ডে কপি করা হয়েছে!' : 'Prescription summary copied to clipboard!',
    shareUnavailable: language === 'bn' ? 'শেয়ারিং অপশন সমর্থিত নয়।' : 'Sharing unavailable.',
    read: language === 'bn' ? 'পূর্ণাঙ্গ প্রেসক্রিপশন' : 'View Full Prescription',
    print: language === 'bn' ? 'প্রিন্ট / PDF' : 'Download / Print PDF',
    downloadPdf: language === 'bn' ? 'ডাউনলোড / প্রিন্ট PDF' : 'Download / Print PDF',
    share: language === 'bn' ? 'শেয়ার / পাঠান' : 'Send / Share',
  }

  // Filtered views
  const diagnosisLogs = structuredLogs.filter((log) => log.type === 'diagnosis')
  const prescriptionLogs = structuredLogs.filter((log) => log.type === 'prescription')
  const consultationLogs = [
    ...legacyHistory.appointments.map((record) => ({ ...record, historyType: 'appointment' })),
    ...prescriptionLogs.filter((p) => p.source === 'vet_issued'),
  ]

  return (
    <div className="veterinary-page clinical-history-page bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <section className="veterinary-page-heading">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span className="veterinary-kicker">{t('veterinaryToolsEyebrow')}</span>
            <h1>{t('clinicalLogTitle')}</h1>
            <p>{t('historyDashboardDescription')}</p>
          </div>

          {/* Export All Logs (JSON / CSV) for researchers and veterinarians */}
          <div className="history-export-bar">
            <button
              type="button"
              onClick={exportLogsAsJson}
              className="history-export-btn"
              title="Download all structured clinical logs in JSON format"
            >
              <FileDown size={14} />
              <span>{language === 'bn' ? 'সব লগ এক্সপোর্ট (JSON)' : 'Export All Logs (JSON)'}</span>
            </button>
            <button
              type="button"
              onClick={exportLogsAsCsv}
              className="history-export-btn"
              title="Download all structured clinical logs in CSV format"
            >
              <FileText size={14} />
              <span>{language === 'bn' ? 'সব লগ এক্সপোর্ট (CSV)' : 'Export All Logs (CSV)'}</span>
            </button>
          </div>
        </div>
      </section>

      {actionStatus && actionStatus !== 'read' && (
        <p className="history-feedback" role="status" style={{ margin: '8px 0' }}>
          {actionStatus}
        </p>
      )}

      {/* Horizontally scrollable, single-line nowrap tab bar */}
      <div className="history-tabs" role="tablist" aria-label={t('historyDashboardTabs')}>
        {historyTabs.map(({ id, labelKey, label }) => {
          const TabIcon = historyTabIcons[id]
          const count =
            id === 'unified'
              ? structuredLogs.length
              : id === 'diagnosis'
              ? diagnosisLogs.length
              : id === 'prescriptions'
              ? prescriptionLogs.length
              : id === 'consultations'
              ? consultationLogs.length
              : id === 'chat'
              ? legacyHistory.chats.length
              : legacyHistory.appointments.length

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
              <span>{label || t(labelKey)}</span>
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
        {/* UNIFIED ALL CLINICAL LOGS */}
        {activeTab === 'unified' && (
          <HistoryList
            records={structuredLogs}
            emptyText={t('historyNoClinicalLogs')}
            render={(record) => renderRichCard(record, locale, prescriptionLabels, setActionStatus, setSelectedPrescription, language)}
          />
        )}

        {/* SMART DIAGNOSES ONLY */}
        {activeTab === 'diagnosis' && (
          <HistoryList
            records={diagnosisLogs}
            emptyText={t('historyNoDiagnoses')}
            emptyIcon={Brain}
            render={(record) => renderRichCard(record, locale, prescriptionLabels, setActionStatus, setSelectedPrescription, language)}
          />
        )}

        {/* PRESCRIPTIONS (VET ISSUED + SCANNED) */}
        {activeTab === 'prescriptions' && (
          <HistoryList
            records={prescriptionLogs}
            emptyText={t('historyNoPrescriptions')}
            emptyIcon={FileText}
            render={(record) => renderRichCard(record, locale, prescriptionLabels, setActionStatus, setSelectedPrescription, language)}
          />
        )}

        {/* CONSULTATIONS */}
        {activeTab === 'consultations' && (
          <HistoryList
            records={consultationLogs}
            emptyText={t('historyNoVetConsultations')}
            emptyIcon={Stethoscope}
            render={(record) => {
              if (record.type === 'prescription' || record.historyType === 'prescription') {
                return renderRichCard(record, locale, prescriptionLabels, setActionStatus, setSelectedPrescription, language)
              }
              const appointmentDate = new Date(`${record.date}T${record.time || '00:00'}`)
              const isUpcoming = !Number.isNaN(appointmentDate.getTime()) && appointmentDate >= new Date()
              return (
                <article className="history-appointment-card dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" key={record.id}>
                  <div className="history-appointment-heading">
                    <span className="history-entry-icon history-entry-icon--teal"><Stethoscope size={18} /></span>
                    <div>
                      <strong>{safeText(record.vetName, t('historyVetNotAssigned'))}</strong>
                      <small>{formattedDate(appointmentDate, locale, { dateStyle: 'medium', timeStyle: 'short' })}</small>
                    </div>
                    <span className={`history-status${isUpcoming ? ' history-status--upcoming' : ''}`}>
                      {isUpcoming ? t('historyUpcoming') : t('historyCompleted')}
                    </span>
                  </div>
                  <div className="history-payment-grid history-consultation-grid">
                    <span><small>{t('historyConsultationStatus')}</small><strong>{isUpcoming ? t('historyBookingConfirmed') : t('historyConsultationPending')}</strong></span>
                    {record.concern && <span><small>{t('historyConsultationConcern')}</small><strong>{record.concern}</strong></span>}
                  </div>
                  <p className="history-demo-note">{t('historyMockRecordNotice')}</p>
                </article>
              )
            }}
          />
        )}

        {/* AI CHAT TRANSCRIPTS */}
        {activeTab === 'chat' && (
          <HistoryList
            records={legacyHistory.chats}
            emptyText={t('historyNoChats')}
            emptyIcon={MessageCircle}
            render={(record) => {
              const transcript = Array.isArray(record.transcript) ? record.transcript : []
              return (
                <article className="history-entry is-expanded dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" key={record.id}>
                  <div className="history-entry-trigger">
                    <span className="history-entry-icon history-entry-icon--blue"><MessageCircle size={18} /></span>
                    <span className="history-entry-summary">
                      <strong>{safeText(record.summary, t('historyChatTopic'))}</strong>
                      <small>{formattedDate(record.updatedAt || record.createdAt, locale)}</small>
                    </span>
                  </div>
                  <div className="history-transcript dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700" style={{ padding: '12px' }}>
                    {transcript.map((message, index) => (
                      <div className={`history-transcript-message history-transcript-message--${message.role} dark:text-gray-200`} key={`${record.id}-${index}`}>
                        <strong>{message.role === 'assistant' ? t('historyAssistant') : t('historyYou')}</strong>
                        <p>{message.text}</p>
                      </div>
                    ))}
                    {!transcript.length && <p>{t('historyNoDetails')}</p>}
                  </div>
                </article>
              )
            }}
          />
        )}

        {/* PAYMENTS */}
        {activeTab === 'payments' && (
          <HistoryList
            records={legacyHistory.appointments}
            emptyText={t('historyNoPaymentHistory')}
            emptyIcon={CreditCard}
            render={(record) => (
              <article className="history-appointment-card history-payment-card dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" key={record.id}>
                <div className="history-appointment-heading">
                  <span className="history-entry-icon history-entry-icon--amber"><CreditCard size={18} /></span>
                  <div>
                    <strong>{safeText(record.vetName, t('historyVetNotAssigned'))}</strong>
                    <small>{formattedDate(new Date(`${record.date}T${record.time || '00:00'}`), locale, { dateStyle: 'medium', timeStyle: 'short' })}</small>
                  </div>
                </div>
                <div className="history-payment-grid">
                  <span><small>{t('historyPaymentAmount')}</small><strong>৳ {Number(record.amount) || 500}</strong></span>
                  <span><small>{t('historyPaymentMethod')}</small><strong>{record.paymentMethod || 'bKash'}</strong></span>
                  <span><small>{t('historyPaymentStatus')}</small><strong className="text-emerald-600">Paid / Verified</strong></span>
                </div>
              </article>
            )}
          />
        )}
      </section>

      {/* FULL PRESCRIPTION PREVIEW MODAL */}
      {selectedPrescription && (
        <div
          className="history-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedPrescription(null)
          }}
        >
          <section
            className="history-prescription-modal dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-prescription-modal-title"
            style={{ maxWidth: '640px', width: '92vw' }}
          >
            <header>
              <div>
                <span className="veterinary-kicker">{t('historyPrescriptionTitle')}</span>
                <h2 id="history-prescription-modal-title">
                  {selectedPrescription.diagnosis || selectedPrescription.primaryDisease || 'Prescription Details'}
                </h2>
              </div>
              <button type="button" aria-label={t('close')} onClick={() => setSelectedPrescription(null)}>
                <X size={19} />
              </button>
            </header>

            <div className="history-prescription-modal-body dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', border: '1px solid #e2e8f0' }} className="dark:bg-gray-800 dark:border-gray-700">
                <div>
                  <small style={{ color: '#64748b', display: 'block', fontSize: '10px', fontWeight: 700 }}>VETERINARIAN</small>
                  <strong className="dark:text-white">{selectedPrescription.vetName || 'Registered Veterinarian'}</strong>
                  <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 600 }}>{selectedPrescription.bvcRegNo || 'BVC-REG-10492'}</div>
                </div>
                <div>
                  <small style={{ color: '#64748b', display: 'block', fontSize: '10px', fontWeight: 700 }}>FARMER &amp; LOCATION</small>
                  <strong className="dark:text-white">{selectedPrescription.farmerName || 'Registered Farmer'}</strong>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>📍 {selectedPrescription.district || 'Rajshahi'} • {selectedPrescription.flockType || 'Broiler'}</div>
                </div>
              </div>

              <h3>{t('historyMedications')}</h3>
              {(Array.isArray(selectedPrescription.medications) ? selectedPrescription.medications : []).map((item, idx) => (
                <article className="history-medication-detail dark:bg-gray-800 dark:border-gray-700" key={item.id || idx} style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
                    <div>
                      <strong className="dark:text-white" style={{ fontSize: '13px' }}>{item.tradeName || item.name}</strong>
                      {item.genericName && <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>({item.genericName})</span>}
                    </div>
                    <span className="prescription-status-pill is-approved" style={{ fontSize: '10px' }}>
                      {item.antibioticClass || 'Antimicrobial'}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0', fontSize: '12px' }}>
                    {[item.formulation, item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <span className="badge-pill meat">Meat: {item.meatWithdrawalDays || item.withdrawal || '7 days'}</span>
                    <span className="badge-pill egg">Eggs: {item.eggWithdrawalDays || 'Not for layers'}</span>
                  </div>
                </article>
              ))}

              {(selectedPrescription.advice || selectedPrescription.transcription) && (
                <div style={{ marginTop: '14px', padding: '10px 14px', background: '#fafafa', borderRadius: '10px', border: '1px solid #e2e8f0' }} className="dark:bg-gray-800 dark:border-gray-700">
                  <strong style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>Advice &amp; Biosecurity Instructions:</strong>
                  <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5 }}>{selectedPrescription.advice || selectedPrescription.transcription}</p>
                </div>
              )}

              {/* Actions inside modal */}
              <div style={{ marginTop: '18px', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <PrescriptionActions
                  record={selectedPrescription}
                  labels={prescriptionLabels}
                  onStatus={setActionStatus}
                  onRead={() => {}}
                  language={language}
                />
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

/**
 * Renders a rich structured card for Smart Diagnosis and Prescriptions
 */
function renderRichCard(record, locale, prescriptionLabels, setActionStatus, setSelectedPrescription, language) {
  const isPrescription = record.type === 'prescription'
  const isDiagnosis = record.type === 'diagnosis'
  const isVetIssued = record.source === 'vet_issued'

  const title = record.primaryDisease || record.diagnosis || record.fileName || (record.medications?.[0]?.tradeName ? `Prescription: ${record.medications[0].tradeName}` : 'Prescription Record')
  const dateDisplay = record.formattedDate || formattedDate(record.timestamp, locale)
  const district = record.district || 'Rajshahi'

  return (
    <article className="history-rich-card dark:bg-gray-800 dark:border-gray-700" key={record.id}>
      <header className="history-rich-header dark:border-gray-700">
        <div className="history-meta-badges">
          <span className="history-badge-date dark:bg-gray-900 dark:text-gray-300">
            <Calendar size={12} />
            {dateDisplay}
          </span>
          <span className="history-badge-district dark:bg-gray-900 dark:text-emerald-400">
            <MapPin size={12} />
            {district}
          </span>
          <span className={`history-badge-type ${isDiagnosis ? 'diagnosis' : isVetIssued ? 'vet' : 'scan'} dark:bg-gray-900`}>
            {isDiagnosis
              ? (language === 'bn' ? '🔬 স্মার্ট ডায়াগনোসিস' : '🔬 Smart Diagnosis')
              : isVetIssued
              ? (language === 'bn' ? '👨‍⚕️ ভেটেরিনারি প্রেসক্রিপশন' : '👨‍⚕️ Doctor Issued')
              : (language === 'bn' ? '📷 প্রেসক্রিপশন স্ক্যান' : '📷 Prescription Scan')}
          </span>
        </div>

        <div>
          {isDiagnosis && record.confidencePercent && (
            <span className="history-metric-pill confidence">
              Confidence: {record.confidencePercent}
            </span>
          )}
          {isPrescription && record.medications?.[0] && (
            <span className="history-metric-pill withdrawal">
              Meat: {record.medications[0].meatWithdrawalDays || record.medications[0].withdrawal || '7 days'}
            </span>
          )}
        </div>
      </header>

      <div>
        <h4 className="history-rich-title dark:text-white">{title}</h4>

        {/* Modalities for Smart Diagnosis */}
        {isDiagnosis && record.inputModalities?.length > 0 && (
          <div className="history-modalities-strip" style={{ marginTop: '6px' }}>
            {record.inputModalities.map((mod) => (
              <span key={mod} className="history-modality-pill dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300">
                {mod === 'image' ? '🖼️ Image Vision' : mod === 'audio' ? '🎤 Audio Cough' : '📝 Clinical Symptoms'}
              </span>
            ))}
          </div>
        )}

        {/* Diagnosis Guidance */}
        {isDiagnosis && record.guidanceSummary && (
          <p className="history-rich-desc dark:text-gray-300" style={{ marginTop: '8px' }}>
            {record.guidanceSummary}
          </p>
        )}

        {/* Prescription details and medications table */}
        {isPrescription && (
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }} className="dark:text-gray-400">
              {record.vetName && <span><strong>Doctor:</strong> {record.vetName} • </span>}
              {record.farmerName && <span><strong>Farmer:</strong> {record.farmerName} • </span>}
              <span><strong>Flock:</strong> {record.flockType || 'Broiler'}</span>
            </div>

            {record.medications?.length > 0 && (
              <div className="history-meds-summary-box dark:bg-gray-900 dark:border-gray-700">
                {record.medications.map((m, idx) => (
                  <div key={idx} className="history-med-row dark:border-gray-800">
                    <div>
                      <strong className="dark:text-white">{m.tradeName || m.name}</strong>
                      {m.genericName && (
                        <span className="text-gray-500 dark:text-gray-400" style={{ marginLeft: '6px' }}>
                          ({m.genericName})
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span className="badge-pill meat">Meat: {m.meatWithdrawalDays || m.withdrawal || '7 days'}</span>
                      <span className="badge-pill egg">Eggs: {m.eggWithdrawalDays || 'Not for layers'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {record.advice && (
              <p className="history-rich-desc dark:text-gray-300" style={{ marginTop: '6px' }}>
                <strong>Advice:</strong> {record.advice}
              </p>
            )}

            {/* Action buttons on every prescription card */}
            <PrescriptionActions
              record={record}
              labels={prescriptionLabels}
              onStatus={setActionStatus}
              onRead={setSelectedPrescription}
              language={language}
            />
          </div>
        )}
      </div>
    </article>
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
