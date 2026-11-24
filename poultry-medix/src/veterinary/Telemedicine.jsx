import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { saveHistoryEntry, saveUnifiedLog } from './historyStore.js'
import { notifyPrescriptionDataChanged, prescriptionStorageKeys } from './prescriptionAnalytics.js'
import { savePrescriptionLog } from '../lib/clinicalLogsStore.js'
import { useUser } from '../context/UserContext.jsx'
import { useLanguage } from '../context/useLanguage.js'
import './Telemedicine.css'

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

export default function Telemedicine() {
  const { role } = useUser()
  const { t } = useLanguage()
  const isRegisteredVet = role === 'REGISTERED_VET'
  const [booking, setBooking] = useState({ farmer: '', farm: '', concern: '', date: '', time: '', payment: 'bkash' })
  const [bookingConfirmed, setBookingConfirmed] = useState(false)
  const [bookingMessage, setBookingMessage] = useState('')
  const [callMode, setCallMode] = useState('')
  const [prescription, setPrescription] = useState(emptyPrescription)
  const [medications, setMedications] = useState([emptyMedication()])
  const [complaintDraft, setComplaintDraft] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const canStartCall = isRegisteredVet || bookingConfirmed

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

  function confirmBooking(event) {
    event.preventDefault()
    setBookingConfirmed(true)
    setCallMode('')
    const paymentMethod = paymentMethods.find(({ id }) => id === booking.payment)
    const paymentMethodLabel = paymentMethod ? t(paymentMethod.labelKey) : booking.payment
    try {
      saveHistoryEntry('appointment', {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        date: booking.date,
        time: booking.time,
        vetName: 'PoultryMedix Veterinary Team (not assigned)',
        concern: booking.concern,
        amount: 0,
        currency: 'BDT',
        paymentMethod: booking.payment,
        paymentMethodLabel,
        paymentStatusKey: 'historyPaymentNotProcessed',
      })
      setBookingMessage(t('mockBookingConfirmed', { payment: paymentMethodLabel }))
    } catch (error) {
      console.error('Unable to save the mock consultation booking to history.', error)
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
        formattedDate: new Date().toLocaleString(),
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
        ? 'প্রেসক্রিপশনটি সফলভাবে সংরক্ষিত হয়েছে এবং ফার্মারের ক্লিনিক্যাল লগে যুক্ত করা হয়েছে!'
        : 'Prescription successfully saved and synced to Farmer’s Clinical Log!')
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
          <Field label={t('farmerName')}><input required maxLength={120} value={booking.farmer} onChange={(event) => updateBooking('farmer', event.target.value)} placeholder={t('namePlaceholder')} /></Field>
          <Field label={t('farmName')}><input required maxLength={120} value={booking.farm} onChange={(event) => updateBooking('farm', event.target.value)} placeholder={t('farmFlockPlaceholder')} /></Field>
          <Field label={t('mainConcern')}><input required maxLength={300} value={booking.concern} onChange={(event) => updateBooking('concern', event.target.value)} placeholder={t('concernPlaceholder')} /></Field>
          <Field label={t('preferredDate')}><input required type="date" min={new Date().toISOString().slice(0, 10)} value={booking.date} onChange={(event) => updateBooking('date', event.target.value)} /></Field>
          <Field label={t('preferredTime')}><input required type="time" value={booking.time} onChange={(event) => updateBooking('time', event.target.value)} /></Field>
          <fieldset className="telemedicine-payment-options dark:border-gray-700 dark:text-gray-100">
            <legend>{t('mockPaymentMethod')}</legend>
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
      </section>}

      {isRegisteredVet && <section className="telemedicine-prescription-section bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white" aria-labelledby="prescription-builder-heading">
        <div className="telemedicine-builder-heading">
          <div><span className="telemedicine-eyebrow">{t('veterinarianWorkspace')}</span><h2 id="prescription-builder-heading">{t('digitalPrescriptionBuilder')}</h2><p>{t('prescriptionBuilderDescription')}</p></div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="telemedicine-save-button" type="button" onClick={savePrescription} style={{ padding: '9px 15px', borderRadius: '10px' }}>
              <Icon name="send" size={17} />
              {language === 'bn' ? 'ফার্মারের লগে পাঠান / সংরক্ষণ' : 'Send / Save to Farmer Clinical Log'}
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
                <Field label={t('age')}><input type="text" value={prescription.age} onChange={(event) => updatePrescription('age', event.target.value)} placeholder={t('agePlaceholder')} /></Field>
                <Field label={t('flockSize')}><input type="number" min="0" value={prescription.flockSize} onChange={(event) => updatePrescription('flockSize', event.target.value)} /></Field>
                <Field label={t('averageWeight')}><input type="number" min="0" step="any" value={prescription.averageWeight} onChange={(event) => updatePrescription('averageWeight', event.target.value)} placeholder={t('kg')} /></Field>
                <Field label={t('birdType')}><select value={prescription.birdType} onChange={(event) => updatePrescription('birdType', event.target.value)}>{birdTypes.map((type) => <option key={type}>{t(`birdTypes.${type}`)}</option>)}</select></Field>
              </div>
            </FormSection>

            <FormSection title={t('clinicalHistoryDiagnosis')} icon="clipboard">
              <div className="telemedicine-tag-entry">
                <Field label={t('chiefComplaints')}><input value={complaintDraft} onChange={(event) => setComplaintDraft(event.target.value)} placeholder={t('symptomPlaceholder')} /></Field>
                <button type="button" className="telemedicine-add-button" onClick={addComplaint}><Icon name="plus" size={15} />{t('add')}</button>
              </div>
              {prescription.complaints.length > 0 && <div className="telemedicine-tags">{prescription.complaints.map((complaint) => <span key={complaint}>{complaint}<button type="button" aria-label={`Remove ${complaint}`} onClick={() => updatePrescription('complaints', prescription.complaints.filter((item) => item !== complaint))}><Icon name="close" size={13} /></button></span>)}</div>}
              <Field label={t('tentativeDiagnosis')}><input value={prescription.diagnosis} onChange={(event) => updatePrescription('diagnosis', event.target.value)} placeholder={t('diagnosisPlaceholder')} /></Field>
            </FormSection>

            <FormSection title={t('medicationDetails')} icon="pill">
              <div className="telemedicine-medication-list">
                {medications.map((medication, index) => (
                  <fieldset className="telemedicine-medication-row dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" key={medication.id}>
                    <legend>{t('medicineNumber', { number: index + 1 })}</legend>
                    {medications.length > 1 && <button className="telemedicine-remove-button" type="button" aria-label={`Remove medicine ${index + 1}`} onClick={() => setMedications((current) => current.filter(({ id }) => id !== medication.id))}><Icon name="remove" size={16} />Remove</button>}
                    <div className="telemedicine-fields-grid">
                      <Field label={t('drugMedicineName')}><input value={medication.name} onChange={(event) => updateMedication(medication.id, 'name', event.target.value)} placeholder={t('medicineName')} /></Field>
                      <Field label={t('formulation')}><select value={medication.formulation} onChange={(event) => updateMedication(medication.id, 'formulation', event.target.value)}>{formulations.map((formulation) => <option key={formulation}>{t(`formulations.${formulation}`)}</option>)}</select></Field>
                      <Field label={t('dosage')}><input value={medication.dosage} onChange={(event) => updateMedication(medication.id, 'dosage', event.target.value)} placeholder={t('dosagePlaceholder')} /></Field>
                      <Field label={t('frequencyTiming')}><select value={medication.frequency} onChange={(event) => updateMedication(medication.id, 'frequency', event.target.value)}>{frequencies.map((frequency) => <option key={frequency}>{t(`frequencies.${frequency}`)}</option>)}</select></Field>
                      <Field label={t('duration')}><span className="telemedicine-duration-inputs"><input type="number" min="1" value={medication.duration} onChange={(event) => updateMedication(medication.id, 'duration', event.target.value)} /><select aria-label={t('durationType')} value={medication.durationType} onChange={(event) => updateMedication(medication.id, 'durationType', event.target.value)}><option>{t('days')}</option><option>{t('weeks')}</option></select></span></Field>
                      <Field label={t('withdrawalPeriod')}><input value={medication.withdrawal} onChange={(event) => updateMedication(medication.id, 'withdrawal', event.target.value)} placeholder={t('withdrawalPlaceholder')} /></Field>
                    </div>
                  </fieldset>
                ))}
              </div>
              <button type="button" className="telemedicine-add-medication" onClick={() => setMedications((current) => [...current, emptyMedication()])}><Icon name="plus" size={16} />{t('addAnotherMedicine')}</button>
            </FormSection>

            <FormSection title="Investigations & advice" icon="file">
              <Field label="Diagnostic tests recommended"><input value={prescription.tests} onChange={(event) => updatePrescription('tests', event.target.value)} placeholder="Recommended tests" /></Field>
              <Field label="Management & biosecurity advice"><textarea rows="4" value={prescription.advice} onChange={(event) => updatePrescription('advice', event.target.value)} placeholder="Care, management, and biosecurity guidance" /></Field>
              <Field label="Follow-up date"><input type="date" value={prescription.followUpDate} onChange={(event) => updatePrescription('followUpDate', event.target.value)} /></Field>
            </FormSection>
          </form>

          <aside className="telemedicine-preview-column dark:text-gray-100" aria-label="Live prescription preview">
            <div className="telemedicine-preview-topline"><span><Icon name="file" size={16} />Live print-ready preview</span><span>PREVIEW</span></div>
            <article className="prescription-preview dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
              <header className="prescription-pad-header">
                <div className="prescription-pad-brand"><span className="prescription-pad-logo"><Icon name="stethoscope" size={21} /></span><div><strong>{prescription.clinicDetails || 'Veterinary Clinic'}</strong><span>POULTRY VETERINARY PRESCRIPTION</span></div></div>
                <div className="prescription-pad-vet"><strong>{[prescription.vetName, prescription.vetDegrees].filter(Boolean).join(', ') || 'Veterinarian name & degrees'}</strong><span>{prescription.registrationNumber ? `Reg. No. ${prescription.registrationNumber}` : 'Registration number'}</span></div>
              </header>
              <div className="prescription-pad-rule" />
              <div className="prescription-preview-title"><span>VETERINARY PRESCRIPTION</span><time>{new Date().toLocaleDateString()}</time></div>
              <div className="prescription-info-grid">
                <div><span>FARMER</span><strong>{prescription.farmerName || '—'}</strong></div>
                <div><span>FARM / FLOCK</span><strong>{prescription.farmName || '—'}</strong></div>
                <div><span>BIRD TYPE</span><strong>{prescription.birdType}</strong></div>
                <div><span>AGE</span><strong>{prescription.age || '—'}</strong></div>
                <div><span>FLOCK SIZE</span><strong>{prescription.flockSize || '—'}</strong></div>
                <div><span>AVERAGE WEIGHT</span><strong>{prescription.averageWeight ? `${prescription.averageWeight} kg` : '—'}</strong></div>
              </div>
              <section className="prescription-preview-block"><h3>Chief complaints &amp; symptoms</h3><p>{prescription.complaints.join(' · ') || 'No symptoms entered'}</p></section>
              <section className="prescription-preview-block"><h3>Diagnosis</h3><p>{prescription.diagnosis || 'Not entered'}</p></section>
              <section className="prescription-rx-block">
                <div className="prescription-rx-mark">℞</div>
                {medications.map((medication, index) => (
                  <div className="prescription-preview-medication" key={medication.id}>
                    <strong>{index + 1}. {medication.name || 'Medicine name'}</strong>
                    <span>{[medication.formulation, medication.dosage, medication.frequency, medication.duration && `${medication.duration} ${medication.durationType}`].filter(Boolean).join(' · ')}</span>
                    {medication.withdrawal && <small>Withdrawal: {medication.withdrawal}</small>}
                  </div>
                ))}
              </section>

              {(prescription.tests || prescription.advice) && <section className="prescription-preview-block"><h3>Investigations &amp; advice</h3>{prescription.tests && <p><strong>Tests:</strong> {prescription.tests}</p>}{prescription.advice && <p>{prescription.advice}</p>}</section>}
              <div className="prescription-preview-followup"><span>FOLLOW-UP</span><strong>{prescription.followUpDate || 'As advised'}</strong></div>
              <footer className="prescription-pad-footer"><span>For veterinary use. Follow the veterinarian’s instructions and the approved product label.</span><div><span className="prescription-signature">{prescription.vetName || 'Veterinarian signature'}</span><small>Signature &amp; seal</small></div></footer>
            </article>
            {saveMessage && <p className="telemedicine-status telemedicine-save-status" role="status">{saveMessage}</p>}
            {saveError && <p className="telemedicine-error" role="alert">{saveError}</p>}
            <button className="telemedicine-save-button" type="button" onClick={savePrescription}><Icon name="send" size={17} />Send to Farmer's Clinical History</button>
            <p className="telemedicine-preview-note">Saved on this device for this prototype; it is not uploaded to a clinical database.</p>
          </aside>
        </div>
      </section>}

      {isRegisteredVet && <section className="telemedicine-booking-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700" aria-labelledby="vet-consultation-room-heading">
        <div className="telemedicine-call-actions">
          <div><h3 id="vet-consultation-room-heading">Consultation room</h3><p>Choose a call mode to open a demo call state.</p></div>
          <div className="telemedicine-call-buttons">
            <button type="button" className="telemedicine-audio-button" onClick={() => setCallMode('audio')}><Icon name="phone" size={17} />Start Audio Call</button>
            <button type="button" className="telemedicine-video-button" onClick={() => setCallMode('video')}><Icon name="video" size={18} />Start Video Call</button>
          </div>
        </div>
        {callMode && <div className="telemedicine-call-panel dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700" role="status">
          <span className="telemedicine-call-pulse"><Icon name={callMode === 'audio' ? 'phone' : 'video'} size={18} /></span>
          <div><strong>{callMode === 'audio' ? 'Demo audio call' : 'Demo video call'} is ready</strong><p>No real call connection is made by this prototype.</p></div>
          <button type="button" onClick={() => setCallMode('')}>End demo</button>
        </div>}
      </section>}
    </main>
  )
}
