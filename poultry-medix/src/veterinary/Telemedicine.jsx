import { useEffect, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { saveHistoryEntry, saveUnifiedLog, readHistory } from './historyStore.js'
import { notifyPrescriptionDataChanged, prescriptionStorageKeys } from './prescriptionAnalytics.js'
import {
  savePrescriptionLog,
  saveConsultationLog,
  getClinicalLogs,
  CLINICAL_LOGS_UPDATED_EVENT,
} from '../lib/clinicalLogsStore.js'
import { useUser } from '../context/UserContext.jsx'
import { useLanguage } from '../context/useLanguage.js'
import './Telemedicine.css'

const VETERINARY_DOCTORS = [
  {
    id: 'dr-sarah',
    name: 'Dr. Sarah Ahmed, DVM',
    degrees: 'DVM, MS in Avian Pathology (BAU)',
    regNo: 'BVC-REG-10492',
    clinic: 'Rajshahi Avian Diagnostic & Research Hospital',
    specialty: 'Avian Pathology & Respiratory Care',
  },
  {
    id: 'dr-tariqul',
    name: 'Dr. Tariqul Islam, DVM',
    degrees: 'DVM, MSc in Veterinary Microbiology',
    regNo: 'BVC-REG-11284',
    clinic: 'Bogura Poultry Health & Biosecurity Center',
    specialty: 'AMR Stewardship & Hatchery Biosecurity',
  },
  {
    id: 'dr-farhana',
    name: 'Dr. Farhana Rahman, DVM',
    degrees: 'DVM, MS in Poultry Medicine',
    regNo: 'BVC-REG-09871',
    clinic: 'Gazipur Central Avian Clinic',
    specialty: 'Broiler & Layer Flock Management',
  },
]

const BANGLADESH_DISTRICTS = [
  'Rajshahi',
  'Bogura',
  'Gazipur',
  'Mymensingh',
  'Cumilla',
  'Dhaka',
  'Chattogram',
  'Sylhet',
  'Khulna',
  'Rangpur',
  'Barishal',
]

const paymentMethods = [
  { id: 'bkash', labelKey: 'bkash', detailKey: 'mobileFinancialService' },
  { id: 'nagad', labelKey: 'nagad', detailKey: 'mobileFinancialService' },
  { id: 'rocket', labelKey: 'rocket', detailKey: 'mobileFinancialService' },
  { id: 'bank-card', labelKey: 'bankCard', detailKey: 'bankTransferDetail' },
]

const birdTypes = ['Broiler', 'Layer', 'Sonali', 'Breeder', 'Other']
const formulations = ['Water soluble powder', 'Feed premix', 'Oral Liquid', 'Injection', 'Drops', 'Ointment']
const frequencies = ['Once daily', 'Twice daily', 'Thrice daily', 'Continuous in water', 'As needed']

const emptyPrescription = {
  vetName: 'Dr. Sarah Ahmed, DVM',
  vetDegrees: 'DVM, MS in Avian Pathology (BAU)',
  registrationNumber: 'BVC-REG-10492',
  bvcRegNo: 'BVC-REG-10492',
  clinicDetails: 'Rajshahi Avian Diagnostic & Research Hospital',
  farmerName: '',
  farmName: '',
  district: 'Rajshahi',
  age: '',
  flockSize: '',
  averageWeight: '',
  birdType: 'Broiler',
  complaints: [],
  diagnosis: '',
  tests: '',
  advice: '',
  followUpDate: '',
}

const emptyMedication = () => ({
  id: crypto.randomUUID(),
  name: '',
  tradeName: '',
  genericName: '',
  antibioticClass: 'Veterinary Antimicrobial',
  generation: '2nd Gen',
  whoAwareCategory: 'Watch',
  formulation: 'Water soluble powder',
  dosage: '',
  frequency: 'Once daily',
  duration: '',
  durationType: 'Days',
  withdrawal: '',
  meatWithdrawalDays: '',
  eggWithdrawalDays: '',
})

function Field({ label, children, className = '' }) {
  return <label className={`telemedicine-field dark:text-gray-100 ${className}`}><span>{label}</span>{children}</label>
}

function FormSection({ title, icon, children }) {
  return (
    <section className="telemedicine-form-section dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
      <h3><span className="telemedicine-section-icon"><Icon name={icon} size={17} /></span>{title}</h3>
      {children}
    </section>
  )
}

function loadConsultationBookings() {
  const fromStore = getClinicalLogs('consultation')
  const readLegacyAppointments = () => {
    try {
      return readHistory('appointment').map((item) => ({
        id: item.id,
        vetName: item.vetName || 'Dr. Sarah Ahmed, DVM',
        farmerName: item.farmerName || 'Registered Farmer',
        farmName: item.farmName || '',
        district: item.district || 'Rajshahi',
        bookingDate: item.date || item.bookingDate || '',
        bookingTime: item.time || item.bookingTime || '',
        concern: item.concern || '',
        amount: Number(item.amount) || 500,
        paymentMethodLabel: item.paymentMethodLabel || item.paymentMethod || 'bKash',
        timestamp: item.createdAt || new Date().toISOString(),
      }))
    } catch {
      return []
    }
  }

  const seen = new Set()
  return [...fromStore, ...readLegacyAppointments()].filter((item) => {
    if (!item?.id || seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

export default function Telemedicine() {
  const { role } = useUser()
  const { t, language } = useLanguage()
  const isRegisteredVet = role === 'REGISTERED_VET'
  const [booking, setBooking] = useState({
    vetId: VETERINARY_DOCTORS[0].id,
    district: 'Rajshahi',
    farmer: '',
    farm: '',
    concern: '',
    date: new Date().toISOString().slice(0, 10),
    time: '10:30',
    payment: 'bkash',
  })
  const [bookingConfirmed, setBookingConfirmed] = useState(false)
  const [bookingMessage, setBookingMessage] = useState('')
  const [recentBookings, setRecentBookings] = useState(() => loadConsultationBookings())
  const [callMode, setCallMode] = useState('')
  const [prescription, setPrescription] = useState(emptyPrescription)
  const [medications, setMedications] = useState([emptyMedication()])
  const [complaintDraft, setComplaintDraft] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const canStartCall = isRegisteredVet || bookingConfirmed

  useEffect(() => {
    function syncBookings() {
      setRecentBookings(loadConsultationBookings())
    }
    window.addEventListener(CLINICAL_LOGS_UPDATED_EVENT, syncBookings)
    window.addEventListener('storage', syncBookings)
    return () => {
      window.removeEventListener(CLINICAL_LOGS_UPDATED_EVENT, syncBookings)
      window.removeEventListener('storage', syncBookings)
    }
  }, [])

  function updateBooking(field, value) {
    setBooking((current) => ({ ...current, [field]: value }))
    setBookingConfirmed(false)
    setBookingMessage('')
  }

  function updatePrescription(field, value) {
    setPrescription((current) => ({ ...current, [field]: value }))
  }

  function updateMedication(id, field, value) {
    setMedications((current) => current.map((medication) => (
      medication.id === id ? { ...medication, [field]: value } : medication
    )))
  }

  function addComplaint() {
    const complaint = complaintDraft.trim()
    if (!complaint || prescription.complaints.some((item) => item.toLocaleLowerCase() === complaint.toLocaleLowerCase())) return
    updatePrescription('complaints', [...prescription.complaints, complaint])
    setComplaintDraft('')
  }

  function loadBookingIntoPrescription(appt) {
    const matchedDoc = VETERINARY_DOCTORS.find((doc) => doc.name === appt.vetName)
    setPrescription((current) => ({
      ...current,
      vetName: matchedDoc?.name || appt.vetName || current.vetName,
      vetDegrees: matchedDoc?.degrees || current.vetDegrees,
      registrationNumber: matchedDoc?.regNo || current.registrationNumber,
      bvcRegNo: matchedDoc?.regNo || current.bvcRegNo,
      clinicDetails: matchedDoc?.clinic || appt.clinicDetails || current.clinicDetails,
      farmerName: appt.farmerName || current.farmerName,
      farmName: appt.farmName || current.farmName,
      district: appt.district || current.district,
      complaints: appt.concern && !current.complaints.includes(appt.concern)
        ? [appt.concern, ...current.complaints]
        : current.complaints,
    }))
    setSaveMessage(language === 'bn'
      ? `বুকিং লোড হয়েছে: ${appt.farmerName || 'Farmer'} (${appt.bookingDate || ''} ${appt.bookingTime || ''})`
      : `Loaded patient booking: ${appt.farmerName || 'Farmer'} (${appt.bookingDate || ''} ${appt.bookingTime || ''})`)
  }

  function confirmBooking(event) {
    event.preventDefault()
    setBookingConfirmed(true)
    setCallMode('')
    const selectedVet = VETERINARY_DOCTORS.find((doc) => doc.id === booking.vetId) || VETERINARY_DOCTORS[0]
    const paymentMethod = paymentMethods.find(({ id }) => id === booking.payment)
    const paymentMethodLabel = paymentMethod ? t(paymentMethod.labelKey) : booking.payment
    const recordId = crypto.randomUUID()
    const createdAt = new Date().toISOString()

    try {
      saveConsultationLog({
        id: recordId,
        vetName: selectedVet.name,
        bvcRegNo: selectedVet.regNo,
        clinicDetails: selectedVet.clinic,
        farmerName: booking.farmer.trim(),
        farmName: booking.farm.trim(),
        district: booking.district || 'Rajshahi',
        bookingDate: booking.date,
        bookingTime: booking.time,
        concern: booking.concern.trim(),
        amount: 500,
        currency: 'BDT',
        paymentMethod: booking.payment,
        paymentMethodLabel,
        paymentStatus: 'Confirmed',
      })

      saveHistoryEntry('appointment', {
        id: recordId,
        createdAt,
        date: booking.date,
        time: booking.time,
        vetName: selectedVet.name,
        bvcRegNo: selectedVet.regNo,
        clinicDetails: selectedVet.clinic,
        farmerName: booking.farmer.trim(),
        farmName: booking.farm.trim(),
        district: booking.district || 'Rajshahi',
        concern: booking.concern.trim(),
        amount: 500,
        currency: 'BDT',
        paymentMethod: booking.payment,
        paymentMethodLabel,
        paymentStatusKey: 'historyBookingConfirmed',
      })

      setBookingMessage(language === 'bn'
        ? `${selectedVet.name}-এর সাথে বুকিং নিশ্চিত হয়েছে (${booking.date}, ${booking.time})। ক্লিনিক্যাল লগের Vet Consultations অপশনে সংরক্ষণ করা হয়েছে।`
        : `Booking confirmed with ${selectedVet.name} on ${booking.date} at ${booking.time}. Saved to Clinical Log → Vet Consultations.`)
    } catch (error) {
      console.error('Unable to save consultation booking to history.', error)
      setBookingMessage(t('mockBookingSaveFailed', { payment: paymentMethodLabel }))
    }
  }

  function printPrescription() {
    document.body.dataset.printPrescription = 'true'
    const cleanPrintState = () => {
      delete document.body.dataset.printPrescription
      window.removeEventListener('afterprint', cleanPrintState)
    }
    window.addEventListener('afterprint', cleanPrintState)
    window.print()
    window.setTimeout(cleanPrintState, 2000)
  }

  function savePrescription() {
    setSaveMessage('')
    setSaveError('')
    try {
      const recordId = crypto.randomUUID()
      const nowIso = new Date().toISOString()
      const formattedMeds = medications.map((medication) => ({
        id: medication.id || crypto.randomUUID(),
        name: medication.name || medication.tradeName || 'Prescribed Drug',
        tradeName: medication.tradeName || medication.name || 'Prescribed Drug',
        genericName: medication.genericName || medication.generic || medication.name || 'Veterinary Antimicrobial',
        antibioticClass: medication.antibioticClass || medication.class || 'Veterinary Antimicrobial',
        generation: medication.generation || '2nd Gen',
        whoAwareCategory: medication.whoAwareCategory || 'Watch',
        formulation: medication.formulation || 'Water soluble powder',
        dosage: medication.dosage || 'As directed',
        frequency: medication.frequency || 'Once daily',
        duration: medication.duration ? `${medication.duration} ${medication.durationType || 'Days'}` : '5 Days',
        withdrawal: medication.withdrawal || medication.meatWithdrawalDays || '7 days',
        meatWithdrawalDays: medication.meatWithdrawalDays || medication.withdrawal || '7 days',
        eggWithdrawalDays: medication.eggWithdrawalDays || 'Not for layers',
      }))

      const structuredPrescription = {
        id: recordId,
        type: 'prescription',
        source: 'vet_issued',
        timestamp: nowIso,
        formattedDate: new Date(nowIso).toLocaleString(),
        vetName: prescription.vetName || 'Dr. Sarah Ahmed, DVM',
        bvcRegNo: prescription.bvcRegNo || prescription.registrationNumber || 'BVC-REG-10492',
        clinicDetails: prescription.clinicDetails || 'Rajshahi Avian Diagnostic Hospital',
        farmerName: prescription.farmerName || 'Registered Farmer',
        farmName: prescription.farmName || '',
        district: prescription.district || 'Rajshahi',
        flockType: prescription.flockType || prescription.birdType || 'Broiler',
        age: prescription.age || '',
        flockSize: prescription.flockSize || '',
        averageWeight: prescription.averageWeight || '',
        diagnosis: prescription.diagnosis || 'Clinical Diagnosis',
        complaints: prescription.complaints || [],
        medications: formattedMeds,
        tests: prescription.tests || '',
        advice: prescription.advice || '',
        followUpDate: prescription.followUpDate || '',
      }

      savePrescriptionLog(structuredPrescription)

      const stored = JSON.parse(localStorage.getItem('poultry-telemedicine-prescriptions') || '[]')
      const legacyRecord = { ...structuredPrescription, savedAt: nowIso }
      localStorage.setItem('poultry-telemedicine-prescriptions', JSON.stringify([legacyRecord, ...(Array.isArray(stored) ? stored : [])].slice(0, 100)))
      saveUnifiedLog('FARMER_PRESCRIPTION', legacyRecord)

      const analyticsRecord = {
        ...legacyRecord,
        source: 'consult',
        medications: formattedMeds.map((m) => ({
          ...m,
          generic: m.genericName,
          tradeName: m.tradeName,
          company: 'Registered Veterinary Pharmaceuticals',
        })),
      }
      const analyticsRecords = JSON.parse(localStorage.getItem(prescriptionStorageKeys.consult) || '[]')
      localStorage.setItem(prescriptionStorageKeys.consult, JSON.stringify([analyticsRecord, ...(Array.isArray(analyticsRecords) ? analyticsRecords : [])].slice(0, 100)))
      notifyPrescriptionDataChanged()

      setSaveMessage(language === 'bn'
        ? 'ডিজিটাল প্রেসক্রিপশনটি সফলভাবে পাঠানো হয়েছে এবং ফার্মারের ক্লিনিক্যাল লগের Prescriptions ও Vet Consultations অংশে তারিখ ও সময়সহ সংরক্ষিত হয়েছে!'
        : 'Digital Prescription successfully sent and saved to the Farmer’s Clinical Log (Prescriptions tab) with date & time!')
    } catch (error) {
      setSaveError(t('prescriptionSaveError', { message: error.message }))
    }
  }

  return (
    <main className="veterinary-page telemedicine-page bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <section className="veterinary-page-heading telemedicine-heading">
        <span className="veterinary-kicker">{t('telemedicineEyebrow')}</span>
        <h1>{t('telemedicineTitle')}</h1>
        <p>{t('telemedicineDescription')}</p>
      </section>

      {!isRegisteredVet && <section className="telemedicine-booking-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700" aria-labelledby="consult-booking-heading">
        <div className="telemedicine-card-heading">
          <span className="telemedicine-hero-icon"><Icon name="stethoscope" size={22} /></span>
          <div><span className="telemedicine-eyebrow">{t('remoteVeterinarySupport')}</span><h2 id="consult-booking-heading">{t('bookVetConsultation')}</h2></div>
        </div>
        <form className="telemedicine-booking-form dark:text-gray-100" onSubmit={confirmBooking}>
          <Field label={t('rxSelectVet')}>
            <select value={booking.vetId} onChange={(event) => updateBooking('vetId', event.target.value)}>
              {VETERINARY_DOCTORS.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.name} — {doc.clinic}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('rxDistrict')}>
            <select value={booking.district} onChange={(event) => updateBooking('district', event.target.value)}>
              {BANGLADESH_DISTRICTS.map((dist) => (
                <option key={dist} value={dist}>{t(`districts.${dist}`, dist)}</option>
              ))}
            </select>
          </Field>
          <Field label={t('farmerName')}><input required maxLength={120} value={booking.farmer} onChange={(event) => updateBooking('farmer', event.target.value)} placeholder={t('namePlaceholder')} /></Field>
          <Field label={t('farmName')}><input required maxLength={120} value={booking.farm} onChange={(event) => updateBooking('farm', event.target.value)} placeholder={t('farmFlockPlaceholder')} /></Field>
          <Field label={t('mainConcern')}><input required maxLength={300} value={booking.concern} onChange={(event) => updateBooking('concern', event.target.value)} placeholder={t('concernPlaceholder')} /></Field>
          <Field label={t('preferredDate')}><input required type="date" min={new Date().toISOString().slice(0, 10)} value={booking.date} onChange={(event) => updateBooking('date', event.target.value)} /></Field>
          <Field label={t('preferredTime')}><input required type="time" value={booking.time} onChange={(event) => updateBooking('time', event.target.value)} /></Field>
          <fieldset className="telemedicine-payment-options dark:border-gray-700 dark:text-gray-100">
            <legend>{t('mockPaymentMethod')} (৳ 500)</legend>
            <div className="telemedicine-payment-grid">
              {paymentMethods.map((method) => (
                <label className={`telemedicine-payment-option dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700${booking.payment === method.id ? ' selected' : ''}`} key={method.id}>
                  <input type="radio" name="payment-method" value={method.id} checked={booking.payment === method.id} onChange={() => updateBooking('payment', method.id)} />
                  <span className="telemedicine-payment-mark"><Icon name={method.id === 'bank-card' ? 'creditCard' : 'phone'} size={17} /></span>
                  <span><strong>{t(method.labelKey)}</strong><small>{t(method.detailKey)}</small></span>
                </label>
              ))}
            </div>
            <p className="telemedicine-payment-note">{t('paymentDemoNotice')}</p>
          </fieldset>
          <button className="telemedicine-primary-button" type="submit"><Icon name="check" size={17} />{t('confirmMockBooking')}</button>
          {bookingMessage && <p className="telemedicine-status" role="status">{bookingMessage}</p>}
        </form>

        <div className="telemedicine-call-actions">
          <div><h3>{t('consultationRoom')}</h3><p>{bookingConfirmed ? t('bookingReady') : t('confirmBookingToCall')}</p></div>
          <div className="telemedicine-call-buttons">
            <button type="button" className="telemedicine-audio-button" disabled={!canStartCall} onClick={() => setCallMode('audio')}><Icon name="phone" size={17} />{t('startAudioCall')}</button>
            <button type="button" className="telemedicine-video-button" disabled={!canStartCall} onClick={() => setCallMode('video')}><Icon name="video" size={18} />{t('startVideoCall')}</button>
          </div>
        </div>
        {callMode && <div className="telemedicine-call-panel dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700" role="status">
          <span className="telemedicine-call-pulse"><Icon name={callMode === 'audio' ? 'phone' : 'video'} size={18} /></span>
          <div><strong>{callMode === 'audio' ? t('demoAudioCall') : t('demoVideoCall')} {t('isReady')}</strong><p>{t('noRealCall')}</p></div>
          <button type="button" onClick={() => setCallMode('')}>{t('endDemo')}</button>
        </div>}

        {recentBookings.length > 0 && (
          <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-700">
            <h3 className="mb-2.5 text-sm font-bold text-gray-800 dark:text-gray-100">
              {t('rxScheduledBookings')}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {recentBookings.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-900">
                  <div className="flex items-center justify-between gap-2 font-bold text-emerald-800 dark:text-emerald-400">
                    <span>{item.vetName}</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {item.bookingDate || t('today')} · {item.bookingTime || '--:--'}
                    </span>
                  </div>
                  <p className="mt-1 text-gray-600 dark:text-gray-300">
                    <strong>{item.farmerName || t('farmer')}</strong> ({t(`districts.${item.district || 'Rajshahi'}`, item.district || 'Rajshahi')}) — {item.concern}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {t('rxDoctorOnlyNote')}
        </p>
      </section>}

      {isRegisteredVet && <section className="telemedicine-prescription-section bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white" aria-labelledby="prescription-builder-heading">
        {recentBookings.length > 0 && (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                {t('rxDoctorQueue')}
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('rxBookingsCount', { count: recentBookings.length })}
              </span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {recentBookings.slice(0, 6).map((appt) => (
                <div key={appt.id} className="flex flex-col justify-between rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-900">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-gray-900 dark:text-white">{appt.farmerName || t('farmer')}</strong>
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {appt.bookingDate || t('today')} {appt.bookingTime || ''}
                      </span>
                    </div>
                    <p className="mt-1 text-gray-600 dark:text-gray-300">{appt.farmName || t('farmName')} · {t(`districts.${appt.district || 'Rajshahi'}`, appt.district || 'Rajshahi')}</p>
                    <p className="mt-1 line-clamp-2 text-gray-500 dark:text-gray-400">{appt.concern}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadBookingIntoPrescription(appt)}
                    className="mt-2.5 w-full rounded-lg border border-emerald-600 bg-emerald-600/10 py-1.5 font-semibold text-emerald-800 transition-colors hover:bg-emerald-600 hover:text-white dark:text-emerald-300"
                  >
                    {t('rxLoadIntoBuilder')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="telemedicine-builder-heading">
          <div><span className="telemedicine-eyebrow">{t('veterinarianWorkspace')}</span><h2 id="prescription-builder-heading">{t('digitalPrescriptionBuilder')}</h2><p>{t('prescriptionBuilderDescription')}</p></div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="telemedicine-save-button" type="button" onClick={savePrescription} style={{ padding: '9px 15px', borderRadius: '10px' }}>
              <Icon name="send" size={17} />
              {t('rxSendSaveToLog')}
            </button>
            <button className="telemedicine-print-button" type="button" onClick={printPrescription} style={{ padding: '9px 15px', borderRadius: '10px' }}>
              <Icon name="pdf" size={17} />
              {t('printSavePdf')}
            </button>
          </div>
        </div>

        <div className="telemedicine-builder-grid dark:text-gray-100">
          <form className="telemedicine-entry-form dark:text-gray-100" onSubmit={(event) => event.preventDefault()}>
            <FormSection title={t('veterinarianInformation')} icon="user">
              <div className="telemedicine-fields-grid">
                <Field label={t('vetName')}><input value={prescription.vetName} onChange={(event) => updatePrescription('vetName', event.target.value)} placeholder={t('veterinarianName')} /></Field>
                <Field label={t('degrees')}><input value={prescription.vetDegrees} onChange={(event) => updatePrescription('vetDegrees', event.target.value)} placeholder={t('degreesPlaceholder')} /></Field>
                <Field label={t('registrationNumber')}><input value={prescription.registrationNumber} onChange={(event) => updatePrescription('registrationNumber', event.target.value)} placeholder={t('registrationId')} /></Field>
                <Field label={t('clinicDetails')}><input value={prescription.clinicDetails} onChange={(event) => updatePrescription('clinicDetails', event.target.value)} placeholder={t('clinicDetailsPlaceholder')} /></Field>
              </div>
            </FormSection>

            <FormSection title={t('flockFarmerInformation')} icon="bird">
              <div className="telemedicine-fields-grid">
                <Field label={t('farmerName')}><input value={prescription.farmerName} onChange={(event) => updatePrescription('farmerName', event.target.value)} /></Field>
                <Field label={t('farmName')}><input value={prescription.farmName} onChange={(event) => updatePrescription('farmName', event.target.value)} /></Field>
                <Field label={t('rxDistrict')}>
                  <select value={prescription.district} onChange={(event) => updatePrescription('district', event.target.value)}>
                    {BANGLADESH_DISTRICTS.map((dist) => <option key={dist} value={dist}>{t(`districts.${dist}`, dist)}</option>)}
                  </select>
                </Field>
                <Field label={t('age')}><input type="text" value={prescription.age} onChange={(event) => updatePrescription('age', event.target.value)} placeholder={t('agePlaceholder')} /></Field>
                <Field label={t('flockSize')}><input type="number" min="0" value={prescription.flockSize} onChange={(event) => updatePrescription('flockSize', event.target.value)} /></Field>
                <Field label={t('averageWeight')}><input type="number" min="0" step="any" value={prescription.averageWeight} onChange={(event) => updatePrescription('averageWeight', event.target.value)} placeholder={t('kg')} /></Field>
                <Field label={t('birdType')}><select value={prescription.birdType} onChange={(event) => updatePrescription('birdType', event.target.value)}>{birdTypes.map((type) => <option key={type} value={type}>{t(`birdTypes.${type}`, type)}</option>)}</select></Field>
              </div>
            </FormSection>

            <FormSection title={t('clinicalHistoryDiagnosis')} icon="clipboard">
              <div className="telemedicine-tag-entry">
                <Field label={t('chiefComplaints')}><input value={complaintDraft} onChange={(event) => setComplaintDraft(event.target.value)} placeholder={t('symptomPlaceholder')} /></Field>
                <button type="button" className="telemedicine-add-button" onClick={addComplaint}><Icon name="plus" size={15} />{t('add')}</button>
              </div>
              {prescription.complaints.length > 0 && <div className="telemedicine-tags">{prescription.complaints.map((complaint) => <span key={complaint}>{complaint}<button type="button" aria-label={t('removeFile', { name: complaint })} onClick={() => updatePrescription('complaints', prescription.complaints.filter((item) => item !== complaint))}><Icon name="close" size={13} /></button></span>)}</div>}
              <Field label={t('tentativeDiagnosis')}><input value={prescription.diagnosis} onChange={(event) => updatePrescription('diagnosis', event.target.value)} placeholder={t('diagnosisPlaceholder')} /></Field>
            </FormSection>

            <FormSection title={t('medicationDetails')} icon="pill">
              <div className="telemedicine-medication-list">
                {medications.map((medication, index) => (
                  <fieldset className="telemedicine-medication-row dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" key={medication.id}>
                    <legend>{t('medicineNumber', { number: index + 1 })}</legend>
                    {medications.length > 1 && <button className="telemedicine-remove-button" type="button" aria-label={`${t('remove')} ${index + 1}`} onClick={() => setMedications((current) => current.filter(({ id }) => id !== medication.id))}><Icon name="remove" size={16} />{t('remove')}</button>}
                    <div className="telemedicine-fields-grid">
                      <Field label={t('drugMedicineName')}><input value={medication.name} onChange={(event) => updateMedication(medication.id, 'name', event.target.value)} placeholder={t('medicineName')} /></Field>
                      <Field label={t('rxGenericName')}><input value={medication.genericName} onChange={(event) => updateMedication(medication.id, 'genericName', event.target.value)} placeholder={t('rxGenericPlaceholder')} /></Field>
                      <Field label={t('formulation')}><select value={medication.formulation} onChange={(event) => updateMedication(medication.id, 'formulation', event.target.value)}>{formulations.map((formulation) => <option key={formulation} value={formulation}>{t(`formulations.${formulation}`, formulation)}</option>)}</select></Field>
                      <Field label={t('dosage')}><input value={medication.dosage} onChange={(event) => updateMedication(medication.id, 'dosage', event.target.value)} placeholder={t('dosagePlaceholder')} /></Field>
                      <Field label={t('frequencyTiming')}><select value={medication.frequency} onChange={(event) => updateMedication(medication.id, 'frequency', event.target.value)}>{frequencies.map((frequency) => <option key={frequency} value={frequency}>{t(`frequencies.${frequency}`, frequency)}</option>)}</select></Field>
                      <Field label={t('duration')}><span className="telemedicine-duration-inputs"><input type="number" min="1" value={medication.duration} onChange={(event) => updateMedication(medication.id, 'duration', event.target.value)} /><select aria-label={t('durationType')} value={medication.durationType} onChange={(event) => updateMedication(medication.id, 'durationType', event.target.value)}><option value="Days">{t('days')}</option><option value="Weeks">{t('weeks')}</option></select></span></Field>
                      <Field label={t('withdrawalPeriod')}><input value={medication.withdrawal} onChange={(event) => updateMedication(medication.id, 'withdrawal', event.target.value)} placeholder={t('withdrawalPlaceholder')} /></Field>
                    </div>
                  </fieldset>
                ))}
              </div>
              <button type="button" className="telemedicine-add-medication" onClick={() => setMedications((current) => [...current, emptyMedication()])}><Icon name="plus" size={16} />{t('addAnotherMedicine')}</button>
            </FormSection>

            <FormSection title={t('rxInvestigationsAdvice')} icon="file">
              <Field label={t('rxRecommendedTests')}><input value={prescription.tests} onChange={(event) => updatePrescription('tests', event.target.value)} placeholder={t('rxRecommendedTestsPlaceholder')} /></Field>
              <Field label={t('rxManagementAdvice')}><textarea rows="4" value={prescription.advice} onChange={(event) => updatePrescription('advice', event.target.value)} placeholder={t('rxManagementAdvicePlaceholder')} /></Field>
              <Field label={t('rxFollowUpDate')}><input type="date" value={prescription.followUpDate} onChange={(event) => updatePrescription('followUpDate', event.target.value)} /></Field>
            </FormSection>
          </form>

          <aside className="telemedicine-preview-column dark:text-gray-100" aria-label={t('rxLivePreview')}>
            <div className="telemedicine-preview-topline"><span><Icon name="file" size={16} />{t('rxLivePreview')}</span><span>{t('rxPreviewBadge')}</span></div>
            <article className="prescription-preview dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
              <header className="prescription-pad-header">
                <div className="prescription-pad-brand"><span className="prescription-pad-logo"><Icon name="stethoscope" size={21} /></span><div><strong>{prescription.clinicDetails || t('rxClinicDefault')}</strong><span>{t('rxPadHeader')}</span></div></div>
                <div className="prescription-pad-vet"><strong>{[prescription.vetName, prescription.vetDegrees].filter(Boolean).join(', ') || t('rxVetDefault')}</strong><span>{prescription.registrationNumber ? `${t('rxRegPrefix')} ${prescription.registrationNumber}` : t('rxRegDefault')}</span></div>
              </header>
              <div className="prescription-pad-rule" />
              <div className="prescription-preview-title"><span>{t('rxTitleUpper')}</span><time>{new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : undefined)}</time></div>
              <div className="prescription-info-grid">
                <div><span>{t('rxFarmerUpper')}</span><strong>{prescription.farmerName || '—'}</strong></div>
                <div><span>{t('rxFarmDistrictUpper')}</span><strong>{[prescription.farmName, prescription.district ? t(`districts.${prescription.district}`, prescription.district) : ''].filter(Boolean).join(' · ') || '—'}</strong></div>
                <div><span>{t('rxBirdTypeUpper')}</span><strong>{t(`birdTypes.${prescription.birdType}`, prescription.birdType)}</strong></div>
                <div><span>{t('rxAgeUpper')}</span><strong>{prescription.age || '—'}</strong></div>
                <div><span>{t('rxFlockSizeUpper')}</span><strong>{prescription.flockSize || '—'}</strong></div>
                <div><span>{t('rxAvgWeightUpper')}</span><strong>{prescription.averageWeight ? `${prescription.averageWeight} ${t('kg')}` : '—'}</strong></div>
              </div>
              <section className="prescription-preview-block"><h3>{t('rxComplaintsHeading')}</h3><p>{prescription.complaints.join(' · ') || t('rxNoSymptoms')}</p></section>
              <section className="prescription-preview-block"><h3>{t('rxDiagnosisHeading')}</h3><p>{prescription.diagnosis || t('rxNotEntered')}</p></section>
              <section className="prescription-rx-block">
                <div className="prescription-rx-mark">℞</div>
                {medications.map((medication, index) => (
                  <div className="prescription-preview-medication" key={medication.id}>
                    <strong>{index + 1}. {medication.name || t('rxMedicineNameDefault')} {medication.genericName ? `(${medication.genericName})` : ''}</strong>
                    <span>{[t(`formulations.${medication.formulation}`, medication.formulation), medication.dosage, t(`frequencies.${medication.frequency}`, medication.frequency), medication.duration && `${medication.duration} ${t(medication.durationType === 'Weeks' ? 'weeks' : 'days')}`].filter(Boolean).join(' · ')}</span>
                    {medication.withdrawal && <small>{t('rxWithdrawalPrefix')}: {medication.withdrawal}</small>}
                  </div>
                ))}
              </section>

              {(prescription.tests || prescription.advice) && <section className="prescription-preview-block"><h3>{t('rxInvestigationsAdvice')}</h3>{prescription.tests && <p><strong>{t('rxRecommendedTests')}:</strong> {prescription.tests}</p>}{prescription.advice && <p>{prescription.advice}</p>}</section>}
              <div className="prescription-preview-followup"><span>{t('rxFollowUpUpper')}</span><strong>{prescription.followUpDate || t('historyAsAdvised')}</strong></div>
              <footer className="prescription-pad-footer"><span>{t('rxDisclaimerFooter')}</span><div><span className="prescription-signature">{prescription.vetName || t('rxSignatureDefault')}</span><small>{t('rxSignatureSeal')}</small></div></footer>
            </article>
            {saveMessage && <p className="telemedicine-status telemedicine-save-status" role="status">{saveMessage}</p>}
            {saveError && <p className="telemedicine-error" role="alert">{saveError}</p>}
            <button className="telemedicine-save-button" type="button" onClick={savePrescription}>
              <Icon name="send" size={17} />
              {t('rxSendToFarmerLog')}
            </button>
            <p className="telemedicine-preview-note">{t('rxSyncNote')}</p>
          </aside>
        </div>
      </section>}

      {isRegisteredVet && <section className="telemedicine-booking-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700" aria-labelledby="vet-consultation-room-heading">
        <div className="telemedicine-call-actions">
          <div><h3 id="vet-consultation-room-heading">{t('consultationRoom')}</h3><p>{t('bookingReady')}</p></div>
          <div className="telemedicine-call-buttons">
            <button type="button" className="telemedicine-audio-button" onClick={() => setCallMode('audio')}><Icon name="phone" size={17} />{t('startAudioCall')}</button>
            <button type="button" className="telemedicine-video-button" onClick={() => setCallMode('video')}><Icon name="video" size={18} />{t('startVideoCall')}</button>
          </div>
        </div>
        {callMode && <div className="telemedicine-call-panel dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700" role="status">
          <span className="telemedicine-call-pulse"><Icon name={callMode === 'audio' ? 'phone' : 'video'} size={18} /></span>
          <div><strong>{callMode === 'audio' ? t('demoAudioCall') : t('demoVideoCall')} {t('isReady')}</strong><p>{t('noRealCall')}</p></div>
          <button type="button" onClick={() => setCallMode('')}>{t('endDemo')}</button>
        </div>}
      </section>}
    </main>
  )
}
