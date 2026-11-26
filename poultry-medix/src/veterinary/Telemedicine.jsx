import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { saveHistoryEntry, saveUnifiedLog, readHistory } from './historyStore.js'
import { notifyPrescriptionDataChanged, prescriptionStorageKeys } from './prescriptionAnalytics.js'
import {
  savePrescriptionLog,
  saveConsultationLog,
  savePaymentLog,
  saveCallSessionLog,
  getClinicalLogs,
  CLINICAL_LOGS_UPDATED_EVENT,
} from '../lib/clinicalLogsStore.js'
import {
  consumeTelemedicinePrefill,
  POULTRYMEDIX_OPEN_TELEMEDICINE_EVENT,
} from '../lib/uloDirectory.js'
import {
  CONSULTATION_FEE_BDT,
  PAYMENT_METHODS,
  PAYMENT_MODE,
  QUICK_SELECT_MEDICATIONS,
  VETERINARY_DOCTORS,
  consumePendingCheckoutContext,
  createCallRoomCode,
  pollGatewayPaymentSession,
  processConsultationPayment,
  resolveBookingWithSandboxDefaults,
  sanitizePaymentInput,
} from '../lib/paymentAdapter.js'
import {
  TELEHEALTH_SIGNAL_CHANNEL,
  broadcastLivePrescription,
  dispatchDoctorBookingNotifications,
} from '../lib/telehealthNotifier.js'
import { getSheds } from '../lib/shedManager.js'
import { useUser } from '../context/user-context.js'
import { useLanguage } from '../context/useLanguage.js'
import PaymentCheckoutModal from './PaymentCheckoutModal.jsx'
import DigitalReceiptModal from './DigitalReceiptModal.jsx'
import ConsultationCallRoom from './ConsultationCallRoom.jsx'
import SplitScreenRxPad from './SplitScreenRxPad.jsx'
import './Telemedicine.css'

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

const birdTypes = ['Broiler', 'Layer', 'Sonali', 'Breeder', 'Other']
const formulations = ['Water soluble powder', 'Feed premix', 'Oral Liquid', 'Injection', 'Drops', 'Ointment']
const frequencies = ['Once daily', 'Twice daily', 'Thrice daily', 'Continuous in water', 'As needed']

const emptyPrescription = {
  vetName: VETERINARY_DOCTORS[0].name,
  vetDegrees: VETERINARY_DOCTORS[0].degrees,
  registrationNumber: VETERINARY_DOCTORS[0].regNo,
  bvcRegNo: VETERINARY_DOCTORS[0].regNo,
  clinicDetails: VETERINARY_DOCTORS[0].clinic,
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
        trxId: item.trxId || '',
        roomCode: item.roomCode || createCallRoomCode(item.trxId || item.id),
        vetName: item.vetName || VETERINARY_DOCTORS[0].name,
        doctorName: item.doctorName || item.vetName || VETERINARY_DOCTORS[0].name,
        farmerName: item.farmerName || 'Registered Farmer',
        farmName: item.farmName || '',
        district: item.district || 'Rajshahi',
        bookingDate: item.date || item.bookingDate || '',
        bookingTime: item.time || item.bookingTime || '',
        concern: item.concern || '',
        shedSummary: item.shedSummary || '',
        aiDiagnosisSummary: item.aiDiagnosisSummary || '',
        amount: Number(item.amount) || 500,
        paymentMethodLabel: item.paymentMethodLabel || item.paymentMethod || 'bKash',
        paymentStatus: item.paymentStatus || 'Completed',
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

function buildFlockContextSnapshot(language) {
  const sheds = getSheds()
  const isBn = language === 'bn'
  const shedSummary = sheds.length
    ? isBn
      ? `${sheds.length}টি শেড · ${sheds.reduce((s, item) => s + (Number(item.birdCount) || 0), 0)} পাখি (${sheds[0].species}, দিন ${sheds[0].currentAgeDays})`
      : `${sheds.length} Shed${sheds.length > 1 ? 's' : ''} · ${sheds.reduce((s, item) => s + (Number(item.birdCount) || 0), 0)} birds (${sheds[0].species}, Day ${sheds[0].currentAgeDays})`
    : ''

  const latestDiag = getClinicalLogs('diagnosis')[0]
  const aiDiagnosisSummary = latestDiag?.primaryDisease
    ? `${latestDiag.primaryDisease}${latestDiag.confidencePercent ? ` (${latestDiag.confidencePercent})` : ''}`
    : ''

  return { shedSummary, aiDiagnosisSummary }
}

export default function Telemedicine() {
  const { role } = useUser()
  const { t, language } = useLanguage()
  const isRegisteredVet = role === 'REGISTERED_VET'
  const [initialPrefill] = useState(() => consumeTelemedicinePrefill())
  const [prefillNotice, setPrefillNotice] = useState(() => Boolean(initialPrefill?.concern))
  const [booking, setBooking] = useState(() => ({
    vetId: VETERINARY_DOCTORS[0].id,
    district: initialPrefill?.district && BANGLADESH_DISTRICTS.includes(initialPrefill.district)
      ? initialPrefill.district
      : 'Rajshahi',
    farmer: '',
    farm: '',
    concern: initialPrefill?.concern || '',
    date: new Date().toISOString().slice(0, 10),
    time: '10:30',
    payment: 'bkash',
  }))
  const [bookingConfirmed, setBookingConfirmed] = useState(false)
  const [bookingMessage, setBookingMessage] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutBooking, setCheckoutBooking] = useState(null)
  const [verifiedReceipt, setVerifiedReceipt] = useState(null)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [devVerifyBusy, setDevVerifyBusy] = useState(false)
  const [callSessionNotice, setCallSessionNotice] = useState('')
  const [vetRoomCode, setVetRoomCode] = useState('')
  const [activeVetPatient, setActiveVetPatient] = useState(null)
  const [mobileRxOpen, setMobileRxOpen] = useState(false)
  const [recentBookings, setRecentBookings] = useState(() => loadConsultationBookings())
  const [callMode, setCallMode] = useState('')
  const [prescription, setPrescription] = useState(() => ({
    ...emptyPrescription,
    district: initialPrefill?.district && BANGLADESH_DISTRICTS.includes(initialPrefill.district)
      ? initialPrefill.district
      : emptyPrescription.district,
    complaints: initialPrefill?.concern ? [initialPrefill.concern] : [],
  }))
  const [medications, setMedications] = useState([emptyMedication()])
  const [complaintDraft, setComplaintDraft] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const selectedVet = VETERINARY_DOCTORS.find((doc) => doc.id === booking.vetId) || VETERINARY_DOCTORS[0]
  const canStartCall = isRegisteredVet || bookingConfirmed
  const fallbackContext = useMemo(() => buildFlockContextSnapshot(language), [language])

  useEffect(() => {
    function syncBookings() {
      setRecentBookings(loadConsultationBookings())
    }
    function handlePrefillReferral(event) {
      const detail = event?.detail || consumeTelemedicinePrefill()
      if (!detail) return
      const nextConcern = String(detail.concern || '').trim()
      const nextDistrict = detail.district && BANGLADESH_DISTRICTS.includes(detail.district) ? detail.district : ''
      if (nextConcern || nextDistrict) {
        setBooking((prev) => ({
          ...prev,
          ...(nextConcern ? { concern: nextConcern } : {}),
          ...(nextDistrict ? { district: nextDistrict } : {}),
        }))
        setPrescription((prev) => ({
          ...prev,
          ...(nextDistrict ? { district: nextDistrict } : {}),
          complaints: nextConcern && !prev.complaints.includes(nextConcern)
            ? [nextConcern, ...prev.complaints]
            : prev.complaints,
        }))
        if (nextConcern) setPrefillNotice(true)
      }
    }

    let bc = null
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(TELEHEALTH_SIGNAL_CHANNEL)
      bc.onmessage = (event) => {
        if (event.data?.type === 'booking-alert' && event.data.roomCode) {
          setVetRoomCode(event.data.roomCode)
          syncBookings()
        }
      }
    }

    window.addEventListener(CLINICAL_LOGS_UPDATED_EVENT, syncBookings)
    window.addEventListener('storage', syncBookings)
    window.addEventListener(POULTRYMEDIX_OPEN_TELEMEDICINE_EVENT, handlePrefillReferral)
    return () => {
      if (bc) bc.close()
      window.removeEventListener(CLINICAL_LOGS_UPDATED_EVENT, syncBookings)
      window.removeEventListener('storage', syncBookings)
      window.removeEventListener(POULTRYMEDIX_OPEN_TELEMEDICINE_EVENT, handlePrefillReferral)
    }
  }, [])

  // Auto-sync when returning to app from a same-tab external gateway / wallet redirect
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const returnedSessionId = url.searchParams.get('pmx_session')
    if (!returnedSessionId) return

    const pending = consumePendingCheckoutContext()
    if (pending?.returnView === 'blueprint') return

    url.searchParams.delete('pmx_session')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)

    let cancelled = false
    pollGatewayPaymentSession({
      sessionId: returnedSessionId,
      isLocalFallback: Boolean(pending?.isLocalFallback),
    }).then((poll) => {
      if (cancelled) return
      if (poll.ok && poll.status === 'COMPLETED' && poll.receipt) {
        const roomCode = poll.receipt.roomCode || createCallRoomCode(poll.receipt.trxId)
        const { shedSummary, aiDiagnosisSummary } = buildFlockContextSnapshot(language)
        const enriched = {
          ...poll.receipt,
          roomCode,
          roomId: roomCode,
          shedSummary,
          aiDiagnosisSummary,
        }
        setVerifiedReceipt(enriched)
        setBookingConfirmed(true)
        savePaymentLog({ ...enriched, status: 'Completed' })
        saveConsultationLog({
          id: `consult-${enriched.id}`,
          ...enriched,
          currency: 'BDT',
          paymentStatus: 'Completed',
        })
        setBookingMessage(language === 'bn'
          ? `${enriched.doctorName}-এর সাথে পেমেন্ট (${enriched.trxId}) সিঙ্ক ও সম্পন্ন হয়েছে!`
          : `Payment synced & verified (${enriched.trxId}) with ${enriched.doctorName}!`)
        setReceiptModalOpen(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [language])

  function updateBooking(field, value) {
    setBooking((current) => ({ ...current, [field]: value }))
    setBookingConfirmed(false)
    setBookingMessage('')
    setVerifiedReceipt(null)
    setCallSessionNotice('')
  }

  function updatePrescription(field, value) {
    setPrescription((current) => ({ ...current, [field]: value }))
  }

  function updateMedication(id, field, value) {
    setMedications((current) => current.map((medication) => (
      medication.id === id ? { ...medication, [field]: value } : medication
    )))
  }

  function applyQuickMedication(preset) {
    const newRow = {
      id: crypto.randomUUID(),
      name: preset.tradeName,
      tradeName: preset.tradeName,
      genericName: preset.genericName,
      antibioticClass: preset.antibioticClass,
      generation: preset.generation,
      whoAwareCategory: preset.whoAwareCategory,
      formulation: preset.formulation,
      dosage: preset.dosage,
      frequency: preset.frequency,
      duration: preset.duration,
      durationType: preset.durationType,
      withdrawal: preset.withdrawal,
      meatWithdrawalDays: preset.meatWithdrawalDays,
      eggWithdrawalDays: preset.eggWithdrawalDays,
    }
    setMedications((current) => {
      const hasOnlyBlankRow =
        current.length === 1 &&
        !String(current[0].name || '').trim() &&
        !String(current[0].dosage || '').trim()
      return hasOnlyBlankRow ? [newRow] : [...current, newRow]
    })
  }

  function addComplaint() {
    const complaint = complaintDraft.trim()
    if (!complaint || prescription.complaints.some((item) => item.toLocaleLowerCase() === complaint.toLocaleLowerCase())) return
    updatePrescription('complaints', [...prescription.complaints, complaint])
    setComplaintDraft('')
  }

  function loadBookingIntoPrescription(appt, openCallAfterLoad = false) {
    const matchedDoc = VETERINARY_DOCTORS.find((doc) => doc.name === (appt.doctorName || appt.vetName))
    const resolvedRoom = appt.roomCode || appt.roomId || createCallRoomCode(appt.trxId || appt.id)
    setVetRoomCode(resolvedRoom)
    setActiveVetPatient({ ...appt, roomCode: resolvedRoom })
    setPrescription((current) => ({
      ...current,
      vetName: matchedDoc?.name || appt.doctorName || appt.vetName || current.vetName,
      vetDegrees: matchedDoc?.degrees || current.vetDegrees,
      registrationNumber: matchedDoc?.regNo || appt.bvcRegNo || current.registrationNumber,
      bvcRegNo: matchedDoc?.regNo || appt.bvcRegNo || current.bvcRegNo,
      clinicDetails: matchedDoc?.clinic || appt.clinicDetails || current.clinicDetails,
      farmerName: appt.farmerName || current.farmerName,
      farmName: appt.farmName || current.farmName,
      district: appt.district || current.district,
      complaints: appt.concern && !current.complaints.includes(appt.concern)
        ? [appt.concern, ...current.complaints]
        : current.complaints,
    }))
    if (openCallAfterLoad) {
      setCallMode('video')
      setMobileRxOpen(true)
    }
    setSaveMessage(language === 'bn'
      ? `রোগীর বুকিং লোড হয়েছে: ${appt.farmerName || 'Farmer'} (${resolvedRoom})`
      : `Loaded patient consultation: ${appt.farmerName || 'Farmer'} (${resolvedRoom})`)
  }

  function openCheckoutModal(event) {
    event.preventDefault()
    const resolved = resolveBookingWithSandboxDefaults(booking)
    const cleanFarmer = sanitizePaymentInput(resolved.farmer, 120)
    const cleanFarm = sanitizePaymentInput(resolved.farm, 120)
    const cleanConcern = sanitizePaymentInput(resolved.concern, 300)
    if (!cleanFarmer || !cleanFarm || !cleanConcern) return
    setCallMode('')
    setCheckoutBooking(resolved)
    setCheckoutOpen(true)
  }

  async function handleQuickDevVerifyAndOpen(autoOpenCallMode = '') {
    if (PAYMENT_MODE !== 'sandbox' || devVerifyBusy) return
    setDevVerifyBusy(true)
    try {
      const resolved = resolveBookingWithSandboxDefaults(booking)
      const methodMeta = PAYMENT_METHODS.find((m) => m.id === resolved.payment) || PAYMENT_METHODS[0]
      const result = await processConsultationPayment({
        booking: resolved,
        doctor: selectedVet,
        methodLabel: t(methodMeta.labelKey),
        isQuickSandbox: true,
        language,
        fields: {},
      })
      if (result.ok) {
        await handlePaymentVerified(result.receipt, {
          openReceiptModal: !autoOpenCallMode,
          autoOpenCallMode,
        })
      }
    } finally {
      setDevVerifyBusy(false)
    }
  }

  async function handlePaymentVerified(receipt, options = { openReceiptModal: true, autoOpenCallMode: '' }) {
    const roomCode = receipt.roomCode || createCallRoomCode(receipt.trxId)
    const { shedSummary, aiDiagnosisSummary } = buildFlockContextSnapshot(language)
    const enrichedReceipt = {
      ...receipt,
      roomCode,
      roomId: roomCode,
      shedSummary,
      aiDiagnosisSummary,
    }
    setCheckoutOpen(false)
    setVerifiedReceipt(enrichedReceipt)
    setBookingConfirmed(true)
    setCallSessionNotice('')

    try {
      savePaymentLog({
        id: enrichedReceipt.id,
        trxId: enrichedReceipt.trxId,
        gatewayTrxRef: enrichedReceipt.gatewayTrxRef,
        timestamp: enrichedReceipt.timestamp,
        method: enrichedReceipt.method,
        paymentMethodLabel: enrichedReceipt.paymentMethodLabel,
        accountMask: enrichedReceipt.accountMask,
        amount: enrichedReceipt.amount,
        doctorName: enrichedReceipt.doctorName,
        bvcRegNo: enrichedReceipt.bvcRegNo,
        clinicDetails: enrichedReceipt.clinicDetails,
        farmerName: enrichedReceipt.farmerName,
        farmName: enrichedReceipt.farmName,
        district: enrichedReceipt.district,
        bookingDate: enrichedReceipt.bookingDate,
        bookingTime: enrichedReceipt.bookingTime,
        concern: enrichedReceipt.concern,
        paymentMode: enrichedReceipt.paymentMode,
        roomCode,
        status: 'Completed',
      })

      saveConsultationLog({
        id: `consult-${enrichedReceipt.id}`,
        trxId: enrichedReceipt.trxId,
        roomId: roomCode,
        roomCode,
        doctorName: enrichedReceipt.doctorName,
        vetName: enrichedReceipt.doctorName,
        bvcRegNo: enrichedReceipt.bvcRegNo,
        clinicDetails: enrichedReceipt.clinicDetails,
        farmerName: enrichedReceipt.farmerName,
        farmName: enrichedReceipt.farmName,
        district: enrichedReceipt.district,
        bookingDate: enrichedReceipt.bookingDate,
        bookingTime: enrichedReceipt.bookingTime,
        concern: enrichedReceipt.concern,
        shedSummary,
        aiDiagnosisSummary,
        amount: enrichedReceipt.amount,
        currency: 'BDT',
        paymentMethod: enrichedReceipt.method,
        paymentMethodLabel: enrichedReceipt.paymentMethodLabel,
        paymentStatus: 'Completed',
      })

      saveHistoryEntry('appointment', {
        id: `consult-${enrichedReceipt.id}`,
        trxId: enrichedReceipt.trxId,
        roomCode,
        createdAt: enrichedReceipt.timestamp,
        date: enrichedReceipt.bookingDate,
        time: enrichedReceipt.bookingTime,
        vetName: enrichedReceipt.doctorName,
        doctorName: enrichedReceipt.doctorName,
        bvcRegNo: enrichedReceipt.bvcRegNo,
        clinicDetails: enrichedReceipt.clinicDetails,
        farmerName: enrichedReceipt.farmerName,
        farmName: enrichedReceipt.farmName,
        district: enrichedReceipt.district,
        concern: enrichedReceipt.concern,
        shedSummary,
        aiDiagnosisSummary,
        amount: enrichedReceipt.amount,
        currency: 'BDT',
        paymentMethod: enrichedReceipt.method,
        paymentMethodLabel: enrichedReceipt.paymentMethodLabel,
        paymentStatusKey: 'historyBookingConfirmed',
      })

      await dispatchDoctorBookingNotifications({
        receipt: enrichedReceipt,
        doctor: selectedVet,
        roomCode,
        shedSummary,
        aiDiagnosisSummary,
      })

      setBookingMessage(language === 'bn'
        ? `${enrichedReceipt.doctorName}-এর সাথে পেমেন্ট (${enrichedReceipt.trxId}) সম্পন্ন হয়েছে! গোপনীয়তা-সুরক্ষিত রুম ${roomCode} নিচে সক্রিয় করা হয়েছে।`
        : `Payment verified (${enrichedReceipt.trxId}) with ${enrichedReceipt.doctorName}. Privacy-protected Room ${roomCode} is now active below.`)
      if (options.autoOpenCallMode) {
        setCallMode(options.autoOpenCallMode)
      } else if (options.openReceiptModal !== false) {
        setReceiptModalOpen(true)
      }
    } catch (error) {
      console.error('Unable to save verified booking to clinical logs.', error)
      setBookingMessage(t('mockBookingSaveFailed', { payment: receipt.paymentMethodLabel }))
    }
  }

  function handleEndCall(sessionInfo) {
    setCallMode('')
    setMobileRxOpen(false)
    const doctorForSession = isRegisteredVet
      ? {
          name: prescription.vetName || VETERINARY_DOCTORS[0].name,
          regNo: prescription.bvcRegNo || VETERINARY_DOCTORS[0].regNo,
          clinic: prescription.clinicDetails || VETERINARY_DOCTORS[0].clinic,
        }
      : selectedVet

    const resolvedRoomId =
      sessionInfo.roomId ||
      sessionInfo.roomCode ||
      verifiedReceipt?.roomCode ||
      vetRoomCode ||
      activeVetPatient?.roomCode ||
      'PMX-ROOM-LIVE'

    saveCallSessionLog({
      bookingId: verifiedReceipt?.trxId || activeVetPatient?.trxId || resolvedRoomId,
      roomId: resolvedRoomId,
      roomCode: resolvedRoomId,
      doctorName: doctorForSession.name,
      bvcRegNo: doctorForSession.regNo,
      clinicDetails: doctorForSession.clinic,
      callType: sessionInfo.callType,
      duration: sessionInfo.duration,
      durationSeconds: sessionInfo.durationSeconds,
      timestamp: sessionInfo.timestamp,
      farmerName: verifiedReceipt?.farmerName || activeVetPatient?.farmerName || sanitizePaymentInput(booking.farmer, 120) || prescription.farmerName || 'Registered Farmer',
      farmName: verifiedReceipt?.farmName || activeVetPatient?.farmName || sanitizePaymentInput(booking.farm, 120) || prescription.farmName,
      district: booking.district || prescription.district || 'Rajshahi',
      concern: verifiedReceipt?.concern || activeVetPatient?.concern || sanitizePaymentInput(booking.concern, 300) || prescription.diagnosis || 'Flock Consultation',
    })

    setCallSessionNotice(language === 'bn'
      ? `${doctorForSession.name} (${doctorForSession.regNo})-এর সাথে ${sessionInfo.callType === 'Video' ? 'ভিডিও' : 'অডিও'} কল [${resolvedRoomId}] (${sessionInfo.duration}) সম্পন্ন হয়ে ক্লিনিক্যাল লগের Vet Consultations-এ সংরক্ষিত হয়েছে।`
      : `${sessionInfo.callType} consultation with ${doctorForSession.name} [${resolvedRoomId}] (${sessionInfo.duration}) logged to Clinical Logs → Vet Consultations.`)
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

      const activeRoom = vetRoomCode || activeVetPatient?.roomCode || ''
      const structuredPrescription = {
        id: recordId,
        type: 'prescription',
        source: 'vet_issued',
        roomId: activeRoom,
        roomCode: activeRoom,
        timestamp: nowIso,
        formattedDate: new Date(nowIso).toLocaleString(),
        vetName: prescription.vetName || VETERINARY_DOCTORS[0].name,
        bvcRegNo: prescription.bvcRegNo || prescription.registrationNumber || VETERINARY_DOCTORS[0].regNo,
        clinicDetails: prescription.clinicDetails || VETERINARY_DOCTORS[0].clinic,
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
      broadcastLivePrescription({ roomCode: activeRoom, prescription: structuredPrescription })

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

      {prefillNotice && (
        <div
          className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          role="status"
        >
          <span>
            {language === 'bn'
              ? 'রোগ নির্ণয় / AI চ্যাট থেকে আপনার খামারের লক্ষণসমূহ স্বয়ংক্রিয়ভাবে নিচে যুক্ত করা হয়েছে।'
              : 'Flock symptoms have been pre-filled automatically from your Smart Diagnosis / AI Chat session.'}
          </span>
          <button
            type="button"
            onClick={() => setPrefillNotice(false)}
            style={{ background: 'none', border: 0, cursor: 'pointer', color: 'inherit', fontWeight: 800 }}
            aria-label={t('close')}
          >
            ✕
          </button>
        </div>
      )}

      {!isRegisteredVet && <section className="telemedicine-booking-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700" aria-labelledby="consult-booking-heading">
        <div className="telemedicine-card-heading">
          <span className="telemedicine-hero-icon"><Icon name="stethoscope" size={22} /></span>
          <div><span className="telemedicine-eyebrow">{t('remoteVeterinarySupport')}</span><h2 id="consult-booking-heading">{t('bookVetConsultation')}</h2></div>
        </div>
        <form className="telemedicine-booking-form dark:text-gray-100" onSubmit={openCheckoutModal}>
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
          <Field label={t('farmerName')}><input required={PAYMENT_MODE === 'live'} maxLength={120} value={booking.farmer} onChange={(event) => updateBooking('farmer', event.target.value)} placeholder={t('namePlaceholder')} /></Field>
          <Field label={t('farmName')}><input required={PAYMENT_MODE === 'live'} maxLength={120} value={booking.farm} onChange={(event) => updateBooking('farm', event.target.value)} placeholder={t('farmFlockPlaceholder')} /></Field>
          <Field label={t('mainConcern')}><input required={PAYMENT_MODE === 'live'} maxLength={300} value={booking.concern} onChange={(event) => updateBooking('concern', event.target.value)} placeholder={t('concernPlaceholder')} /></Field>
          <Field label={t('preferredDate')}><input required type="date" min={new Date().toISOString().slice(0, 10)} value={booking.date} onChange={(event) => updateBooking('date', event.target.value)} /></Field>
          <Field label={t('preferredTime')}><input required type="time" value={booking.time} onChange={(event) => updateBooking('time', event.target.value)} /></Field>
          <fieldset className="telemedicine-payment-options dark:border-gray-700 dark:text-gray-100">
            <legend>{t('selectPaymentMethod')} (৳ {CONSULTATION_FEE_BDT})</legend>
            <div className="telemedicine-payment-grid">
              {PAYMENT_METHODS.map((method) => (
                <label className={`telemedicine-payment-option dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700${booking.payment === method.id ? ' selected' : ''}`} key={method.id}>
                  <input type="radio" name="payment-method" value={method.id} checked={booking.payment === method.id} onChange={() => updateBooking('payment', method.id)} />
                  <span className="telemedicine-payment-mark"><Icon name={method.id === 'bank-card' ? 'creditCard' : 'phone'} size={17} /></span>
                  <span><strong>{t(method.labelKey)}</strong><small>{t(method.detailKey)}</small></span>
                </label>
              ))}
            </div>
            <p className="telemedicine-payment-note">
              {PAYMENT_MODE === 'live' ? t('paymentLiveNotice') : t('paymentSandboxNotice')}
            </p>
            {PAYMENT_MODE === 'sandbox' && (
              <p className="telemedicine-payment-note" style={{ color: '#047857', fontWeight: 600 }}>
                {t('bookingOptionalSandboxHint')}
              </p>
            )}
          </fieldset>
          <div className="pmx-booking-submit-row">
            <button className="telemedicine-primary-button" type="submit"><Icon name="lock" size={16} />{t('confirmBookingBtn')}</button>
            {PAYMENT_MODE === 'sandbox' && (
              <button
                type="button"
                className="pmx-dev-quick-btn"
                disabled={devVerifyBusy}
                onClick={() => handleQuickDevVerifyAndOpen('video')}
              >
                <Icon name="video" size={16} />
                {devVerifyBusy ? t('checkoutProcessing') : t('devQuickVerifyUnlockBtn')}
              </button>
            )}
          </div>
          {bookingMessage && <p className="telemedicine-status" role="status">{bookingMessage}</p>}
          {callSessionNotice && <p className="telemedicine-status" role="status">{callSessionNotice}</p>}
        </form>

        <div className="telemedicine-call-actions">
          <div>
            <h3>{t('consultationRoom')} — {selectedVet.name}</h3>
            <p>
              {bookingConfirmed
                ? t('bookingVerifiedReady', { trxId: verifiedReceipt?.trxId || '' })
                : t('confirmBookingToCall')}
            </p>
          </div>
          <div className="telemedicine-call-buttons">
            <button type="button" className="telemedicine-audio-button" disabled={!canStartCall} onClick={() => setCallMode('audio')}>
              <Icon name="phone" size={17} />
              {t('startAudioCall')}
            </button>
            <button type="button" className="telemedicine-video-button" disabled={!canStartCall} onClick={() => setCallMode('video')}>
              <Icon name="video" size={18} />
              {t('startVideoCall')}
            </button>
          </div>
        </div>

        <div className="pmx-doctor-privacy-card dark:bg-gray-900 dark:border-gray-700">
          <div className="pmx-doctor-privacy-info">
            <span className="pmx-privacy-shield-badge">
              <Icon name="shield" size={13} />
              {t('privacyProtectedCallBadge')}
            </span>
            <strong>{selectedVet.name}</strong>
            <span>{selectedVet.degrees} · {selectedVet.regNo}</span>
            <small>{selectedVet.specialty}</small>
          </div>
          {verifiedReceipt && (
            <div className="pmx-verified-room-actions">
              <span className="pmx-verified-trx-chip">{verifiedReceipt.trxId}</span>
              <span className="pmx-room-code-pill">{verifiedReceipt.roomCode}</span>
              <button
                type="button"
                className="pmx-receipt-open-btn dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
                onClick={() => setReceiptModalOpen(true)}
              >
                <Icon name="file" size={15} />
                {t('viewDigitalReceipt')}
              </button>
            </div>
          )}
        </div>

        {callMode && (
          <ConsultationCallRoom
            initialCallType={callMode}
            doctor={selectedVet}
            participantRole="farmer"
            bookingContext={{
              trxId: verifiedReceipt?.trxId || 'PMX-TRX-DEV',
              roomCode: verifiedReceipt?.roomCode || createCallRoomCode(verifiedReceipt?.trxId),
              farmerName: verifiedReceipt?.farmerName || sanitizePaymentInput(booking.farmer, 120) || 'Registered Farmer',
              farmName: verifiedReceipt?.farmName || sanitizePaymentInput(booking.farm, 120),
              district: t(`districts.${booking.district}`, booking.district),
              bookingDate: booking.date,
              bookingTime: booking.time,
              concern: verifiedReceipt?.concern || sanitizePaymentInput(booking.concern, 300),
              shedSummary: verifiedReceipt?.shedSummary || fallbackContext.shedSummary,
              aiDiagnosisSummary: verifiedReceipt?.aiDiagnosisSummary || fallbackContext.aiDiagnosisSummary,
              amount: CONSULTATION_FEE_BDT,
              paymentMethodLabel: verifiedReceipt?.paymentMethodLabel || booking.payment,
            }}
            onEndCall={handleEndCall}
          />
        )}

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

      {isRegisteredVet && <section className="telemedicine-booking-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700" aria-labelledby="vet-consultation-room-heading">
        <div className="telemedicine-card-heading" style={{ marginBottom: '14px' }}>
          <span className="telemedicine-hero-icon"><Icon name="users" size={21} /></span>
          <div>
            <span className="telemedicine-eyebrow">{t('veterinarianWorkspace')}</span>
            <h2 id="vet-consultation-room-heading">{t('activePatientQueueTitle')}</h2>
          </div>
        </div>

        {recentBookings.length > 0 ? (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 mb-4">
            {recentBookings.slice(0, 6).map((appt) => {
              const roomBadge = appt.roomCode || appt.roomId || createCallRoomCode(appt.trxId || appt.id)
              const shedLabel = appt.shedSummary || fallbackContext.shedSummary || t('callFlockSnapshotEmpty')
              const aiLabel = appt.aiDiagnosisSummary || fallbackContext.aiDiagnosisSummary || t('queueNoAiScanYet')
              return (
                <div key={appt.id} className="pmx-queue-card dark:bg-gray-900 dark:border-gray-700">
                  <div>
                    <div className="pmx-queue-card-top">
                      <strong>{appt.farmerName || t('farmer')}</strong>
                      <span className="pmx-room-code-pill">{roomBadge}</span>
                    </div>
                    <p className="pmx-queue-meta">
                      {t(`districts.${appt.district || 'Rajshahi'}`, appt.district || 'Rajshahi')} · {appt.bookingDate || t('today')} {appt.bookingTime || ''}
                    </p>
                    <p className="pmx-queue-shed"><strong>{t('shedLabelShort')}:</strong> {shedLabel}</p>
                    <p className="pmx-queue-symptom"><strong>{t('symptomsShort')}:</strong> {appt.concern || t('historyNoDetails')}</p>
                    <div className="pmx-queue-ai-chip">{t('aiDiagnosisBadgeLabel')}: {aiLabel}</div>
                  </div>
                  <div className="pmx-queue-card-actions">
                    <button
                      type="button"
                      onClick={() => loadBookingIntoPrescription(appt, true)}
                      className="pmx-primary-submit-btn"
                      style={{ flex: 1, minHeight: '34px', fontSize: '11px' }}
                    >
                      <Icon name="video" size={14} />
                      {t('joinCallOpenRxBtn')}
                    </button>
                    <button
                      type="button"
                      onClick={() => loadBookingIntoPrescription(appt, false)}
                      className="pmx-secondary-btn dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
                      style={{ minHeight: '34px', fontSize: '11px', padding: '0 9px' }}
                    >
                      {t('rxLoadShort')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="telemedicine-payment-note" style={{ marginBottom: '12px' }}>{t('queueNoPaidBookings')}</p>
        )}

        <div className="telemedicine-call-actions">
          <div>
            <h3>{t('consultationRoom')}</h3>
            <p>{t('vetJoinRoomHint')}</p>
          </div>
          <div className="telemedicine-call-buttons">
            <input
              type="text"
              className="pmx-vet-room-input dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              value={vetRoomCode || recentBookings[0]?.roomCode || ''}
              onChange={(event) => setVetRoomCode(event.target.value.toUpperCase())}
              placeholder={t('roomCodeLabel')}
              aria-label={t('roomCodeLabel')}
            />
            <button type="button" className="telemedicine-audio-button" onClick={() => setCallMode('audio')}><Icon name="phone" size={17} />{t('startAudioCall')}</button>
            <button type="button" className="telemedicine-video-button" onClick={() => { setCallMode('video'); setMobileRxOpen(true) }}><Icon name="video" size={18} />{t('startVideoCall')}</button>
          </div>
        </div>
        {callSessionNotice && <p className="telemedicine-status" style={{ marginTop: '10px' }} role="status">{callSessionNotice}</p>}

        {callMode && (
          <div className="pmx-split-workspace-grid">
            <ConsultationCallRoom
              initialCallType={callMode}
              participantRole="vet"
              mobileRxOpen={mobileRxOpen}
              onToggleMobileRxSheet={() => setMobileRxOpen((prev) => !prev)}
              doctor={{
                ...VETERINARY_DOCTORS[0],
                name: prescription.vetName || VETERINARY_DOCTORS[0].name,
                degrees: prescription.vetDegrees || VETERINARY_DOCTORS[0].degrees,
                regNo: prescription.bvcRegNo || prescription.registrationNumber || VETERINARY_DOCTORS[0].regNo,
                clinic: prescription.clinicDetails || VETERINARY_DOCTORS[0].clinic,
              }}
              bookingContext={{
                trxId: activeVetPatient?.trxId || recentBookings[0]?.trxId || 'VET-DIRECT',
                roomCode: vetRoomCode || activeVetPatient?.roomCode || recentBookings[0]?.roomCode || 'PMX-ROOM-LIVE',
                farmerName: prescription.farmerName || activeVetPatient?.farmerName || recentBookings[0]?.farmerName || t('farmer'),
                farmName: prescription.farmName || activeVetPatient?.farmName || recentBookings[0]?.farmName || '',
                district: t(`districts.${prescription.district || 'Rajshahi'}`, prescription.district || 'Rajshahi'),
                concern: prescription.diagnosis || activeVetPatient?.concern || recentBookings[0]?.concern || 'Clinical Telemedicine Consultation',
                shedSummary: activeVetPatient?.shedSummary || recentBookings[0]?.shedSummary || fallbackContext.shedSummary,
                aiDiagnosisSummary: activeVetPatient?.aiDiagnosisSummary || recentBookings[0]?.aiDiagnosisSummary || fallbackContext.aiDiagnosisSummary,
              }}
              onEndCall={handleEndCall}
            />
            <SplitScreenRxPad
              prescription={prescription}
              medications={medications}
              onUpdatePrescription={updatePrescription}
              onUpdateMedication={updateMedication}
              onApplyQuickMed={applyQuickMedication}
              onAddBlankMed={() => setMedications((current) => [...current, emptyMedication()])}
              onRemoveMed={(id) => setMedications((current) => current.filter((item) => item.id !== id))}
              onSendPrescription={savePrescription}
              saveMessage={saveMessage}
              saveError={saveError}
              mobileOpen={mobileRxOpen}
              onCloseMobile={() => setMobileRxOpen(false)}
            />
          </div>
        )}
      </section>}

      {isRegisteredVet && <section className="telemedicine-prescription-section bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white" aria-labelledby="prescription-builder-heading">

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
              <div className="pmx-quick-meds-grid" style={{ marginBottom: '6px' }}>
                {QUICK_SELECT_MEDICATIONS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="pmx-quick-med-chip dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                    onClick={() => applyQuickMedication(preset)}
                  >
                    <div className="pmx-quick-med-top">
                      <strong>+ {preset.tradeName}</strong>
                      <span className={`pmx-aware-tag is-${String(preset.whoAwareCategory || 'Watch').toLowerCase()}`}>
                        {preset.whoAwareCategory}
                      </span>
                    </div>
                    <small>{preset.genericName} · {preset.meatWithdrawalDays}</small>
                  </button>
                ))}
              </div>
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

      {checkoutOpen && (
        <PaymentCheckoutModal
          booking={checkoutBooking || resolveBookingWithSandboxDefaults(booking)}
          doctor={selectedVet}
          districtLabel={t(`districts.${booking.district}`, booking.district)}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={handlePaymentVerified}
        />
      )}

      {receiptModalOpen && verifiedReceipt && (
        <DigitalReceiptModal
          receipt={verifiedReceipt}
          onClose={() => setReceiptModalOpen(false)}
          onStartCall={(mode) => {
            setReceiptModalOpen(false)
            setCallMode(mode)
          }}
        />
      )}
    </main>
  )
}
