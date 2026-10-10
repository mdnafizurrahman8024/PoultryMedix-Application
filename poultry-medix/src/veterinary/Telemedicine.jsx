import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import './Telemedicine.css'

const paymentMethods = [
  { id: 'bkash', label: 'bKash', detail: 'Mobile financial service' },
  { id: 'nagad', label: 'Nagad', detail: 'Mobile financial service' },
  { id: 'rocket', label: 'Rocket', detail: 'Mobile financial service' },
  { id: 'bank-card', label: 'Bank / Card', detail: 'Debit, credit, or bank transfer' },
]

const birdTypes = ['Broiler', 'Layer', 'Sonali', 'Breeder', 'Other']
const formulations = ['Water soluble powder', 'Feed premix', 'Oral Liquid', 'Injection', 'Drops', 'Ointment']
const frequencies = ['Once daily', 'Twice daily', 'Thrice daily', 'Continuous in water', 'As needed']

const emptyPrescription = {
  vetName: '',
  vetDegrees: '',
  registrationNumber: '',
  clinicDetails: '',
  farmerName: '',
  farmName: '',
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
  formulation: 'Water soluble powder',
  dosage: '',
  frequency: 'Once daily',
  duration: '',
  durationType: 'Days',
  withdrawal: '',
})

function Field({ label, children, className = '' }) {
  return <label className={`telemedicine-field ${className}`}><span>{label}</span>{children}</label>
}

function FormSection({ title, icon, children }) {
  return (
    <section className="telemedicine-form-section">
      <h3><span className="telemedicine-section-icon"><Icon name={icon} size={17} /></span>{title}</h3>
      {children}
    </section>
  )
}

export default function Telemedicine() {
  const [booking, setBooking] = useState({ farmer: '', farm: '', concern: '', date: '', time: '', payment: 'bkash' })
  const [bookingConfirmed, setBookingConfirmed] = useState(false)
  const [bookingMessage, setBookingMessage] = useState('')
  const [callMode, setCallMode] = useState('')
  const [prescription, setPrescription] = useState(emptyPrescription)
  const [medications, setMedications] = useState([emptyMedication()])
  const [complaintDraft, setComplaintDraft] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')

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
    setBookingMessage(`Mock booking confirmed with ${paymentMethods.find(({ id }) => id === booking.payment)?.label}. No payment was processed.`)
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
      const stored = JSON.parse(localStorage.getItem('poultry-telemedicine-prescriptions') || '[]')
      if (!Array.isArray(stored)) throw new Error('Saved history data is invalid.')
      const record = {
        id: crypto.randomUUID(),
        savedAt: new Date().toISOString(),
        ...prescription,
        medications: medications.map((medication) => ({ ...medication })),
      }
      localStorage.setItem('poultry-telemedicine-prescriptions', JSON.stringify([record, ...stored].slice(0, 100)))
      setSaveMessage('Prescription saved to this device’s simulated Farmer Clinical History.')
    } catch (error) {
      setSaveError(`Could not save prescription: ${error.message}`)
    }
  }

  return (
    <main className="veterinary-page telemedicine-page">
      <section className="veterinary-page-heading telemedicine-heading">
        <span className="veterinary-kicker">VETERINARY CONSULTATION & CARE</span>
        <h1>Vet Telemedicine &amp; Digital Prescription</h1>
        <p>Arrange a consultation and prepare a clear prescription record with a live, print-ready preview.</p>
      </section>

      <section className="telemedicine-booking-card" aria-labelledby="consult-booking-heading">
        <div className="telemedicine-card-heading">
          <span className="telemedicine-hero-icon"><Icon name="stethoscope" size={22} /></span>
          <div><span className="telemedicine-eyebrow">REMOTE VETERINARY SUPPORT</span><h2 id="consult-booking-heading">Book a vet consultation</h2></div>
        </div>
        <form className="telemedicine-booking-form" onSubmit={confirmBooking}>
          <Field label="Farmer name"><input required maxLength={120} value={booking.farmer} onChange={(event) => updateBooking('farmer', event.target.value)} placeholder="Name" /></Field>
          <Field label="Farm name"><input required maxLength={120} value={booking.farm} onChange={(event) => updateBooking('farm', event.target.value)} placeholder="Farm or flock name" /></Field>
          <Field label="Main concern"><input required maxLength={300} value={booking.concern} onChange={(event) => updateBooking('concern', event.target.value)} placeholder="Briefly describe the concern" /></Field>
          <Field label="Preferred date"><input required type="date" min={new Date().toISOString().slice(0, 10)} value={booking.date} onChange={(event) => updateBooking('date', event.target.value)} /></Field>
          <Field label="Preferred time"><input required type="time" value={booking.time} onChange={(event) => updateBooking('time', event.target.value)} /></Field>
          <fieldset className="telemedicine-payment-options">
            <legend>Mock payment method</legend>
            <div className="telemedicine-payment-grid">
              {paymentMethods.map((method) => (
                <label className={`telemedicine-payment-option${booking.payment === method.id ? ' selected' : ''}`} key={method.id}>
                  <input type="radio" name="payment-method" value={method.id} checked={booking.payment === method.id} onChange={() => updateBooking('payment', method.id)} />
                  <span className="telemedicine-payment-mark"><Icon name={method.id === 'bank-card' ? 'creditCard' : 'phone'} size={17} /></span>
                  <span><strong>{method.label}</strong><small>{method.detail}</small></span>
                </label>
              ))}
            </div>
            <p className="telemedicine-payment-note">Demo only — no charge, transaction, or payment credentials are collected.</p>
          </fieldset>
          <button className="telemedicine-primary-button" type="submit"><Icon name="check" size={17} />Confirm mock booking</button>
          {bookingMessage && <p className="telemedicine-status" role="status">{bookingMessage}</p>}
        </form>
        <div className="telemedicine-call-actions">
          <div><h3>Consultation room</h3><p>{bookingConfirmed ? 'Your mock booking is ready. Choose a call mode to open a demo call state.' : 'Confirm a consultation booking to enable the demo call controls.'}</p></div>
          <div className="telemedicine-call-buttons">
            <button type="button" className="telemedicine-audio-button" disabled={!bookingConfirmed} onClick={() => setCallMode('audio')}><Icon name="phone" size={17} />Start Audio Call</button>
            <button type="button" className="telemedicine-video-button" disabled={!bookingConfirmed} onClick={() => setCallMode('video')}><Icon name="video" size={18} />Start Video Call</button>
          </div>
        </div>
        {callMode && <div className="telemedicine-call-panel" role="status">
          <span className="telemedicine-call-pulse"><Icon name={callMode === 'audio' ? 'phone' : 'video'} size={18} /></span>
          <div><strong>{callMode === 'audio' ? 'Demo audio call' : 'Demo video call'} is ready</strong><p>No real call connection is made by this prototype.</p></div>
          <button type="button" onClick={() => setCallMode('')}>End demo</button>
        </div>}
      </section>

      <section className="telemedicine-prescription-section" aria-labelledby="prescription-builder-heading">
        <div className="telemedicine-builder-heading">
          <div><span className="telemedicine-eyebrow">VETERINARIAN WORKSPACE</span><h2 id="prescription-builder-heading">Digital Prescription Builder</h2><p>Enter the details once; the print-ready prescription updates as you type.</p></div>
          <button className="telemedicine-print-button" type="button" onClick={printPrescription}><Icon name="pdf" size={17} />Print / Save PDF</button>
        </div>

        <div className="telemedicine-builder-grid">
          <form className="telemedicine-entry-form" onSubmit={(event) => event.preventDefault()}>
            <FormSection title="Veterinarian information" icon="user">
              <div className="telemedicine-fields-grid">
                <Field label="Vet name"><input value={prescription.vetName} onChange={(event) => updatePrescription('vetName', event.target.value)} placeholder="Veterinarian name" /></Field>
                <Field label="Degrees"><input value={prescription.vetDegrees} onChange={(event) => updatePrescription('vetDegrees', event.target.value)} placeholder="DVM, MS, etc." /></Field>
                <Field label="Registration number"><input value={prescription.registrationNumber} onChange={(event) => updatePrescription('registrationNumber', event.target.value)} placeholder="Registration ID" /></Field>
                <Field label="Clinic details"><input value={prescription.clinicDetails} onChange={(event) => updatePrescription('clinicDetails', event.target.value)} placeholder="Clinic name, address, phone" /></Field>
              </div>
            </FormSection>

            <FormSection title="Flock & farmer information" icon="bird">
              <div className="telemedicine-fields-grid">
                <Field label="Farmer name"><input value={prescription.farmerName} onChange={(event) => updatePrescription('farmerName', event.target.value)} /></Field>
                <Field label="Farm name"><input value={prescription.farmName} onChange={(event) => updatePrescription('farmName', event.target.value)} /></Field>
                <Field label="Age"><input type="text" value={prescription.age} onChange={(event) => updatePrescription('age', event.target.value)} placeholder="e.g., 28 days" /></Field>
                <Field label="Flock size"><input type="number" min="0" value={prescription.flockSize} onChange={(event) => updatePrescription('flockSize', event.target.value)} /></Field>
                <Field label="Average weight"><input type="number" min="0" step="any" value={prescription.averageWeight} onChange={(event) => updatePrescription('averageWeight', event.target.value)} placeholder="kg" /></Field>
                <Field label="Bird type"><select value={prescription.birdType} onChange={(event) => updatePrescription('birdType', event.target.value)}>{birdTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
              </div>
            </FormSection>

            <FormSection title="Clinical history & diagnosis" icon="clipboard">
              <div className="telemedicine-tag-entry">
                <Field label="Chief complaints & symptoms"><input value={complaintDraft} onChange={(event) => setComplaintDraft(event.target.value)} placeholder="Enter a symptom, then select Add" /></Field>
                <button type="button" className="telemedicine-add-button" onClick={addComplaint}><Icon name="plus" size={15} />Add</button>
              </div>
              {prescription.complaints.length > 0 && <div className="telemedicine-tags">{prescription.complaints.map((complaint) => <span key={complaint}>{complaint}<button type="button" aria-label={`Remove ${complaint}`} onClick={() => updatePrescription('complaints', prescription.complaints.filter((item) => item !== complaint))}><Icon name="close" size={13} /></button></span>)}</div>}
              <Field label="Tentative / final diagnosis"><input value={prescription.diagnosis} onChange={(event) => updatePrescription('diagnosis', event.target.value)} placeholder="Diagnosis" /></Field>
            </FormSection>

            <FormSection title="Medication / Rx details" icon="pill">
              <div className="telemedicine-medication-list">
                {medications.map((medication, index) => (
                  <fieldset className="telemedicine-medication-row" key={medication.id}>
                    <legend>Medicine {index + 1}</legend>
                    {medications.length > 1 && <button className="telemedicine-remove-button" type="button" aria-label={`Remove medicine ${index + 1}`} onClick={() => setMedications((current) => current.filter(({ id }) => id !== medication.id))}><Icon name="remove" size={16} />Remove</button>}
                    <div className="telemedicine-fields-grid">
                      <Field label="Drug / medicine name"><input value={medication.name} onChange={(event) => updateMedication(medication.id, 'name', event.target.value)} placeholder="Medicine name" /></Field>
                      <Field label="Formulation"><select value={medication.formulation} onChange={(event) => updateMedication(medication.id, 'formulation', event.target.value)}>{formulations.map((formulation) => <option key={formulation}>{formulation}</option>)}</select></Field>
                      <Field label="Dosage"><input value={medication.dosage} onChange={(event) => updateMedication(medication.id, 'dosage', event.target.value)} placeholder="e.g., 1g / 1L water" /></Field>
                      <Field label="Frequency / timing"><select value={medication.frequency} onChange={(event) => updateMedication(medication.id, 'frequency', event.target.value)}>{frequencies.map((frequency) => <option key={frequency}>{frequency}</option>)}</select></Field>
                      <Field label="Duration"><span className="telemedicine-duration-inputs"><input type="number" min="1" value={medication.duration} onChange={(event) => updateMedication(medication.id, 'duration', event.target.value)} /><select aria-label="Duration type" value={medication.durationType} onChange={(event) => updateMedication(medication.id, 'durationType', event.target.value)}><option>Days</option><option>Weeks</option></select></span></Field>
                      <Field label="Withdrawal period (meat & eggs)"><input value={medication.withdrawal} onChange={(event) => updateMedication(medication.id, 'withdrawal', event.target.value)} placeholder="Enter label/local guidance" /></Field>
                    </div>
                  </fieldset>
                ))}
              </div>
              <button type="button" className="telemedicine-add-medication" onClick={() => setMedications((current) => [...current, emptyMedication()])}><Icon name="plus" size={16} />Add another medicine</button>
            </FormSection>

            <FormSection title="Investigations & advice" icon="file">
              <Field label="Diagnostic tests recommended"><input value={prescription.tests} onChange={(event) => updatePrescription('tests', event.target.value)} placeholder="Recommended tests" /></Field>
              <Field label="Management & biosecurity advice"><textarea rows="4" value={prescription.advice} onChange={(event) => updatePrescription('advice', event.target.value)} placeholder="Care, management, and biosecurity guidance" /></Field>
              <Field label="Follow-up date"><input type="date" value={prescription.followUpDate} onChange={(event) => updatePrescription('followUpDate', event.target.value)} /></Field>
            </FormSection>
          </form>

          <aside className="telemedicine-preview-column" aria-label="Live prescription preview">
            <div className="telemedicine-preview-topline"><span><Icon name="file" size={16} />Live print-ready preview</span><span>PREVIEW</span></div>
            <article className="prescription-preview">
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
      </section>
    </main>
  )
}
