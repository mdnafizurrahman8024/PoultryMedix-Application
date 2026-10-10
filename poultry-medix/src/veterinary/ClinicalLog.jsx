import { useEffect, useState } from 'react'
import {
  BookOpen,
  Brain,
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
} from 'lucide-react'
import { useLanguage } from '../context/useLanguage.js'
import { readHistory, readPrescriptionHistory } from './historyStore.js'

const historyTabs = [
  { id: 'diagnosis', labelKey: 'historyDiagnosisTab' },
  { id: 'chat', labelKey: 'historyChatTab' },
  { id: 'prescriptions', labelKey: 'historyPrescriptionsTab' },
  { id: 'appointments', labelKey: 'historyAppointmentsTab' },
]

const historyTabIcons = {
  diagnosis: Brain,
  chat: MessageCircle,
  prescriptions: FileText,
  appointments: Stethoscope,
}

function formattedDate(value, locale, options = { dateStyle: 'medium' }) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(locale, options)
}

function safeText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function prescriptionMarkup(prescription, labels) {
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
  const medications = Array.isArray(prescription.medications) ? prescription.medications : []
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(labels.prescription)}</title>
    <style>body{font:14px Arial,sans-serif;color:#344737;margin:28px}h1{color:#315d4d}
    section{margin:18px 0;padding:12px;border:1px solid #dce8df;border-radius:10px;background:#f7faf8}
    li{margin:8px 0}@media print{body{margin:14mm}}</style></head><body>
    <h1>${escape(labels.prescription)}</h1><p>${escape(prescription.vetName || labels.unassignedVet)}</p>
    <p>${escape(prescription.clinicDetails || '')}</p>
    <section><strong>${escape(labels.patientDetails)}</strong><p>${escape(prescription.farmerName || '')} · ${escape(prescription.farmName || '')}</p>
    <p>${escape(prescription.birdType || '')} · ${escape(prescription.flockSize || '')}</p></section>
    <section><strong>${escape(labels.diagnosis)}</strong><p>${escape(prescription.diagnosis || '')}</p>
    <p>${escape(Array.isArray(prescription.complaints) ? prescription.complaints.join(', ') : '')}</p></section>
    <section><strong>${escape(labels.medications)}</strong><ul>${medications.map((item) => `<li>${escape(item.name)} — ${escape(item.dosage)} · ${escape(item.frequency)} · ${escape(item.duration)} ${escape(item.durationType)}. ${escape(item.withdrawal)}</li>`).join('')}</ul></section>
    <section><strong>${escape(labels.advice)}</strong><p>${escape(prescription.tests || '')}</p><p>${escape(prescription.advice || '')}</p></section>
    <p>${escape(labels.followUp)}: ${escape(prescription.followUpDate || labels.asAdvised)}</p>
    <script>window.addEventListener('load',()=>window.print())</script></body></html>`
}

function PrescriptionActions({ record, labels, onStatus, onRead }) {
  function openPrintView(isPdfDownload = false) {
    const popup = window.open('', '_blank')
    if (!popup) {
      onStatus(labels.popupBlocked)
      return
    }
    popup.opener = null
    popup.document.open()
    popup.document.write(prescriptionMarkup(record, labels))
    popup.document.close()
    onStatus(isPdfDownload ? labels.pdfSaveHint : '')
  }

  async function sharePrescription() {
    const text = `${labels.prescription}: ${record.vetName || labels.unassignedVet} — ${record.diagnosis || labels.prescription}`
    try {
      if (navigator.share) {
        await navigator.share({ title: labels.prescription, text })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
        onStatus(labels.shareCopied)
      } else {
        onStatus(labels.shareUnavailable)
      }
    } catch (error) {
      if (error.name !== 'AbortError') onStatus(labels.shareUnavailable)
    }
  }

  return (
    <div className="history-prescription-actions">
      <button type="button" onClick={() => onRead(record)} aria-label={labels.read}><BookOpen size={15} />{labels.read}</button>
      <button type="button" onClick={() => openPrintView()} aria-label={labels.print}><Printer size={15} />{labels.print}</button>
      <button type="button" onClick={() => openPrintView(true)} aria-label={labels.downloadPdf}><FileDown size={15} />{labels.downloadPdf}</button>
      <button type="button" onClick={sharePrescription} aria-label={labels.share}><Share2 size={15} />{labels.share}</button>
    </div>
  )
}

export default function ClinicalLog() {
  const { t, language } = useLanguage()
  const locale = { en: 'en-BD', bn: 'bn-BD', hi: 'hi-IN', ur: 'ur-PK' }[language] || 'en-BD'
  const [activeTab, setActiveTab] = useState('diagnosis')
  const [history] = useState(() => {
    try {
      return {
        diagnoses: readHistory('diagnosis'),
        chats: readHistory('chat'),
        prescriptions: readPrescriptionHistory(),
        appointments: readHistory('appointment'),
        error: '',
      }
    } catch (loadError) {
      console.error('Unable to load the local clinical history.', loadError)
      return { diagnoses: [], chats: [], prescriptions: [], appointments: [], error: 'historyLoadError' }
    }
  })
  const [expandedId, setExpandedId] = useState('')
  const [selectedPrescription, setSelectedPrescription] = useState(null)
  const [actionStatus, setActionStatus] = useState('')

  const { diagnoses, chats, prescriptions, appointments } = history

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') setSelectedPrescription(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [])

  function toggleExpanded(id) {
    setExpandedId((current) => current === id ? '' : id)
  }

  const prescriptionLabels = {
    prescription: t('historyPrescriptionTitle'),
    unassignedVet: t('historyVetNotAssigned'),
    patientDetails: t('historyPatientDetails'),
    diagnosis: t('historyDiagnosisLabel'),
    medications: t('historyMedications'),
    advice: t('historyAdvice'),
    followUp: t('historyFollowUp'),
    asAdvised: t('historyAsAdvised'),
    popupBlocked: t('historyPopupBlocked'),
    pdfSaveHint: t('historyPdfSaveHint'),
    shareCopied: t('historyShareCopied'),
    shareUnavailable: t('historyShareUnavailable'),
    read: t('historyRead'),
    print: t('historyPrint'),
    downloadPdf: t('historyDownloadPdf'),
    share: t('historyShare'),
  }

  return (
    <div className="veterinary-page clinical-history-page">
      <section className="veterinary-page-heading">
        <span className="veterinary-kicker">{t('veterinaryToolsEyebrow')}</span>
        <h1>{t('clinicalLogTitle')}</h1>
        <p>{t('historyDashboardDescription')}</p>
      </section>

      {history.error && <p className="history-feedback history-feedback--error" role="alert">{t(history.error)}</p>}
      {actionStatus && actionStatus !== 'read' && <p className="history-feedback" role="status">{actionStatus}</p>}

      <div className="history-tabs" role="tablist" aria-label={t('historyDashboardTabs')}>
        {historyTabs.map(({ id, labelKey }) => (
          <button
            className={`history-tab${activeTab === id ? ' is-active' : ''}`}
            type="button"
            role="tab"
            id={`history-tab-${id}`}
            aria-selected={activeTab === id}
            aria-controls={`history-panel-${id}`}
            key={id}
            onClick={() => { setActiveTab(id); setExpandedId(''); setActionStatus('') }}
          >
            {(() => {
              const TabIcon = historyTabIcons[id]
              return <TabIcon size={17} aria-hidden="true" />
            })()}<span>{t(labelKey)}</span>
          </button>
        ))}
      </div>

      <section className="history-panel" role="tabpanel" id={`history-panel-${activeTab}`} aria-labelledby={`history-tab-${activeTab}`}>
        {activeTab === 'diagnosis' && (
          <HistoryList
            records={diagnoses}
            emptyText={t('historyNoDiagnoses')}
            render={(record) => {
              const summary = safeText(record.summary, t('historyDiagnosisLabel'))
              const expanded = expandedId === record.id
              return (
                <article className={`history-entry${expanded ? ' is-expanded' : ''}`} key={record.id}>
                  <button className="history-entry-trigger" type="button" aria-expanded={expanded} onClick={() => toggleExpanded(record.id)}>
                    <span className="history-entry-icon history-entry-icon--teal"><Brain size={18} /></span>
                    <span className="history-entry-summary"><strong>{summary}</strong><small>{formattedDate(record.createdAt, locale)}</small></span>
                    <ChevronDown size={17} />
                  </button>
                  {expanded && <div className="history-entry-details">
                    <p>{safeText(record.answer, t('historyNoDetails'))}</p>
                    {record.visualResult?.label && <p><strong>{t('visualClassification')}:</strong> {record.visualResult.label}</p>}
                    {record.files?.length > 0 && <p><strong>{t('historyAttachments')}:</strong> {record.files.join(', ')}</p>}
                    {record.sources?.length > 0 && <div className="history-reference-list"><strong>{t('historyReferences')}:</strong>{record.sources.map((source) => <span key={source}>{source}</span>)}</div>}
                    {record.externalReference?.url && <a href={record.externalReference.url} target="_blank" rel="noreferrer">{record.externalReference.title || t('historyExternalReference')} <ExternalLink size={13} /></a>}
                  </div>}
                </article>
              )
            }}
          />
        )}

        {activeTab === 'chat' && (
          <HistoryList
            records={chats}
            emptyText={t('historyNoChats')}
            render={(record) => {
              const expanded = expandedId === record.id
              const transcript = Array.isArray(record.transcript) ? record.transcript : []
              return (
                <article className={`history-entry${expanded ? ' is-expanded' : ''}`} key={record.id}>
                  <button className="history-entry-trigger" type="button" aria-expanded={expanded} onClick={() => toggleExpanded(record.id)}>
                    <span className="history-entry-icon history-entry-icon--blue"><MessageCircle size={18} /></span>
                    <span className="history-entry-summary"><strong>{safeText(record.summary, t('historyChatTopic'))}</strong><small>{formattedDate(record.updatedAt || record.createdAt, locale)}</small></span>
                    <ChevronDown size={17} />
                  </button>
                  {expanded && <div className="history-transcript">
                    {transcript.map((message, index) => (
                      <div className={`history-transcript-message history-transcript-message--${message.role}`} key={`${record.id}-${index}`}>
                        <strong>{message.role === 'assistant' ? t('historyAssistant') : t('historyYou')}</strong>
                        <p>{message.text}</p>
                        {message.files?.length > 0 && <small>{t('historyAttachments')}: {message.files.join(', ')}</small>}
                        {message.sources?.length > 0 && <small>{t('historyReferences')}: {message.sources.join(', ')}</small>}
                        {message.externalReference?.url && <a href={message.externalReference.url} target="_blank" rel="noreferrer">{message.externalReference.title || t('historyExternalReference')} <ExternalLink size={12} /></a>}
                      </div>
                    ))}
                    {!transcript.length && <p>{t('historyNoDetails')}</p>}
                  </div>}
                </article>
              )
            }}
          />
        )}

        {activeTab === 'prescriptions' && (
          <HistoryList
            records={prescriptions}
            emptyText={t('historyNoPrescriptions')}
            render={(record) => (
              <article className="history-prescription-card" key={record.id}>
                <div className="history-entry-trigger history-prescription-summary">
                  <span className="history-entry-icon history-entry-icon--amber"><FileText size={18} /></span>
                  <span className="history-entry-summary">
                    <strong>{safeText(record.diagnosis, t('historyPrescriptionTitle'))}</strong>
                    <small>{formattedDate(record.savedAt || record.createdAt, locale)} · {safeText(record.vetName, t('historyVetNotAssigned'))}</small>
                  </span>
                </div>
                <p className="history-prescription-meta">{safeText(record.farmName, t('historyFarmNotListed'))} · {Array.isArray(record.medications) ? record.medications.length : 0} {t('historyMedicationCount')}</p>
                <PrescriptionActions record={record} labels={prescriptionLabels} onStatus={setActionStatus} onRead={setSelectedPrescription} />
              </article>
            )}
          />
        )}

        {activeTab === 'appointments' && (
          <HistoryList
            records={appointments}
            emptyText={t('historyNoAppointments')}
            render={(record) => {
              const appointmentDate = new Date(`${record.date}T${record.time || '00:00'}`)
              const isUpcoming = !Number.isNaN(appointmentDate.getTime()) && appointmentDate >= new Date()
              return (
                <article className="history-appointment-card" key={record.id}>
                  <div className="history-appointment-heading">
                    <span className="history-entry-icon history-entry-icon--teal"><Stethoscope size={18} /></span>
                    <div><strong>{safeText(record.vetName, t('historyVetNotAssigned'))}</strong><small>{formattedDate(appointmentDate, locale, { dateStyle: 'medium', timeStyle: 'short' })}</small></div>
                    <span className={`history-status${isUpcoming ? ' history-status--upcoming' : ''}`}>{isUpcoming ? t('historyUpcoming') : t('historyCompleted')}</span>
                  </div>
                  <div className="history-payment-grid">
                    <span><small>{t('historyConsultationStatus')}</small><strong>{isUpcoming ? t('historyBookingConfirmed') : t('historyConsultationPending')}</strong></span>
                    <span><small>{t('historyPaymentAmount')}</small><strong>{new Intl.NumberFormat(locale, { style: 'currency', currency: record.currency || 'BDT', maximumFractionDigits: 0 }).format(Number(record.amount) || 0)}</strong></span>
                    <span><small>{t('historyPaymentMethod')}</small><strong>{record.paymentMethodLabel || record.paymentMethod || t('historyNotAvailable')}</strong></span>
                    <span><small>{t('historyPaymentStatus')}</small><strong>{t(record.paymentStatusKey || 'historyPaymentNotProcessed')}</strong></span>
                  </div>
                  {record.concern && <p className="history-appointment-concern">{record.concern}</p>}
                  <p className="history-demo-note">{t('historyMockRecordNotice')}</p>
                </article>
              )
            }}
          />
        )}
      </section>
      <p className="history-storage-note">{t('historyStoredLocallyNotice')}</p>

      {selectedPrescription && (
        <div className="history-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPrescription(null) }}>
          <section className="history-prescription-modal" role="dialog" aria-modal="true" aria-labelledby="history-prescription-modal-title">
            <header><div><span className="veterinary-kicker">{t('historyPrescriptionTitle')}</span><h2 id="history-prescription-modal-title">{safeText(selectedPrescription.diagnosis, t('historyPrescriptionTitle'))}</h2></div><button type="button" aria-label={t('close')} onClick={() => setSelectedPrescription(null)}><X size={19} /></button></header>
            <div className="history-prescription-modal-body">
              <p><strong>{t('historyVeterinarian')}:</strong> {safeText(selectedPrescription.vetName, t('historyVetNotAssigned'))}</p>
              <p><strong>{t('historyPatientDetails')}:</strong> {safeText(selectedPrescription.farmerName, '')} · {safeText(selectedPrescription.farmName, t('historyFarmNotListed'))} · {selectedPrescription.birdType || ''} · {selectedPrescription.flockSize || ''}</p>
              <p><strong>{t('historyComplaints')}:</strong> {Array.isArray(selectedPrescription.complaints) ? selectedPrescription.complaints.join(', ') : ''}</p>
              <h3>{t('historyMedications')}</h3>
              {(Array.isArray(selectedPrescription.medications) ? selectedPrescription.medications : []).map((item) => (
                <article className="history-medication-detail" key={item.id || item.name}>
                  <strong>{item.name || t('historyNotAvailable')}</strong>
                  <p>{[item.formulation, item.dosage, item.frequency, item.duration && `${item.duration} ${item.durationType}`].filter(Boolean).join(' · ')}</p>
                  {item.withdrawal && <small>{t('historyWithdrawalPeriod')}: {item.withdrawal}</small>}
                </article>
              ))}
              <p><strong>{t('historyAdvice')}:</strong> {safeText(selectedPrescription.advice, t('historyNoDetails'))}</p>
              <p><strong>{t('historyFollowUp')}:</strong> {safeText(selectedPrescription.followUpDate, t('historyAsAdvised'))}</p>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function HistoryList({ records, emptyText, render }) {
  return records.length
    ? <div className="history-entry-list">{records.map(render)}</div>
    :     <div className="history-empty"><span><History size={23} /></span><p>{emptyText}</p></div>
}
