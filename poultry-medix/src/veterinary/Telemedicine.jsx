import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { saveHistoryEntry, saveUnifiedLog } from './historyStore.js'
import { notifyPrescriptionDataChanged, prescriptionStorageKeys } from './prescriptionAnalytics.js'
import {
  cancelConsultationBookingRecord,
  ensureCleanConsultationBookings,
  getClinicalLogs,
  saveCallSessionLog,
  saveConsultationLog,
  savePaymentLog,
  savePrescriptionLog,
  CLINICAL_LOGS_UPDATED_EVENT,
} from '../lib/clinicalLogsStore.js'
import {
  consumeTelemedicinePrefill,
  POULTRYMEDIX_OPEN_TELEMEDICINE_EVENT,
} from '../lib/uloDirectory.js'
import {
  POULTRYMEDIX_DOCTORS_CHANNEL,
  POULTRYMEDIX_DOCTORS_UPDATED_EVENT,
  POULTRYMEDIX_SLOTS_UPDATED_EVENT,
  assertDoctorOwnership,
  filterBookingsForDoctorSession,
  findDoctorProfile,
  formatSlotTimeDisplay,
  formatVetHeaderDisplay,
  getAuthenticatedDoctorSession,
  getDoctorAvailabilitySummary,
  getDoctorLocalizedFields,
  getDoctorsDirectory,
  getSlotsForDoctorDate,
  incrementDoctorServiceCounter,
  lockDoctorTimeSlot,
  markSlotSessionStarted,
  releaseDoctorTimeSlot,
  toLocaleDigits,
} from '../lib/doctorsStore.js'
import {
  getAllMasterMedicineEntries,
  getMedicineCategories,
  mapFormulationToRxSelect,
} from '../lib/poultryMedicinesStore.js'
import {
  CONSULTATION_FEE_BDT,
  PAYMENT_METHODS,
  PAYMENT_MODE,
  VETERINARY_DOCTORS,
  consumePendingCheckoutContext,
  createCallRoomCode,
  pollGatewayPaymentSession,
  processConsultationPayment,
  resolveBookingWithSandboxDefaults,
  sanitizePaymentInput,
} from '../lib/paymentAdapter.js'
import {
  POULTRYMEDIX_ROOMS_UPDATED_EVENT,
  TELEHEALTH_SIGNAL_CHANNEL,
  broadcastLivePrescription,
  dispatchDoctorBookingNotifications,
  evaluateConsultationScheduleWindow,
  getActiveRoomCalls,
  getLocalTodayDateStr,
  markRoomCallCompleted,
  openDoctorCallRoom,
} from '../lib/telehealthNotifier.js'
import { getSheds, POULTRYMEDIX_SHEDS_UPDATED_EVENT } from '../lib/shedManager.js'
import {
  BOOKING_TARGET_MODES,
  MANUAL_BIRD_TYPES,
  MAX_ATTACHMENT_COUNT,
  buildBookingFlockPayload,
  formatBytesReadable,
  getShedLinkedDiagnoses,
  getShedLinkedPrescriptions,
  normalizeBirdSpecies,
  readAttachmentAsDataUrl,
  validateHistoryAttachmentFile,
} from '../lib/bookingContextHelper.js'
import { useUser } from '../context/user-context.js'
import { useLanguage } from '../context/useLanguage.js'
import PaymentCheckoutModal from './PaymentCheckoutModal.jsx'
import DigitalReceiptModal from './DigitalReceiptModal.jsx'
import ConsultationCallRoom from './ConsultationCallRoom.jsx'
import DoctorDetailsModal from './DoctorDetailsModal.jsx'
import DoctorScheduleManager from './DoctorScheduleManager.jsx'
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

const birdTypes = ['Broiler', 'Layer', 'Sonali', 'Duck', 'Native', 'Breeder', 'Pigeon', 'Other']
const formulations = ['Water soluble powder', 'Feed premix', 'Oral Liquid', 'Injection', 'Drops', 'Ointment']
const frequencies = ['Once daily', 'Twice daily', 'Thrice daily', 'Continuous in water', 'As needed']

const emptyPrescription = {
  vetId: VETERINARY_DOCTORS[0].id,
  vetName: VETERINARY_DOCTORS[0].name,
  vetDegrees: VETERINARY_DOCTORS[0].degrees,
  registrationNumber: VETERINARY_DOCTORS[0].regNo,
  bvcRegNo: VETERINARY_DOCTORS[0].regNo,
  clinicDetails: VETERINARY_DOCTORS[0].clinic,
  farmerName: '',
  farmName: '',
  district: 'Rajshahi',
  upazila: '',
  age: '',
  flockSize: '',
  averageWeight: '',
  birdType: 'Broiler',
  complaints: [],
  historyNotes: '',
  clinicalSigns: '',
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

function parseShedSnapshot(shedSummary = '') {
  const text = String(shedSummary || '')
  const countMatch = text.match(/([\d,]+)\s*(?:birds|পাখি)/i)
  const speciesMatch = text.match(/\((Broiler|Layer|Sonali|Duck|Native|Desi \/ Native|Breeder|Pigeon|Other)\b/i)
  const ageMatch = text.match(/(?:Day|Week|দিন|সপ্তাহ)\s*\d+|\d+\s*(?:days?|weeks?)/i)
  return {
    flockSize: countMatch ? countMatch[1].replace(/,/g, '') : '',
    birdType: speciesMatch ? normalizeBirdSpecies(speciesMatch[1]) : '',
    age: ageMatch ? ageMatch[0] : '',
  }
}

function loadConsultationBookings() {
  ensureCleanConsultationBookings()
  const fromStore = getClinicalLogs('consultation')
  const seen = new Set()
  return fromStore.filter((item) => {
    if (!item?.id) return false
    const dedupeKey = item.roomCode || item.trxId || item.id
    if (seen.has(dedupeKey)) return false
    seen.add(dedupeKey)
    return true
  })
}

function getOrCreateFarmerClientId() {
  if (typeof window === 'undefined') return 'farmer-client'
  try {
    const key = 'poultrymedix_farmer_client_id_v1'
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const fresh = `farmer-${crypto.randomUUID().slice(0, 8)}`
    localStorage.setItem(key, fresh)
    return fresh
  } catch {
    return 'farmer-client'
  }
}

export default function Telemedicine() {
  const { role } = useUser()
  const { t, language } = useLanguage()
  const isRegisteredVet = role === 'REGISTERED_VET'
  const [initialPrefill] = useState(() => consumeTelemedicinePrefill())
  const [prefillNotice, setPrefillNotice] = useState(() => Boolean(initialPrefill?.concern))
  const [registeredSheds, setRegisteredSheds] = useState(() => getSheds())
  const [bookingMode, setBookingMode] = useState(() => (
    getSheds().length > 0 ? BOOKING_TARGET_MODES.REGISTERED_SHED : BOOKING_TARGET_MODES.MANUAL_FARM
  ))
  const [selectedShedId, setSelectedShedId] = useState(() => getSheds()[0]?.id || '')
  const [allDiagnosisLogs, setAllDiagnosisLogs] = useState(() => getClinicalLogs('diagnosis'))
  const [allPrescriptionLogs, setAllPrescriptionLogs] = useState(() => getClinicalLogs('prescription'))
  const [selectedHistoryRxIds, setSelectedHistoryRxIds] = useState(() => {
    const firstShed = getSheds()[0]
    if (!firstShed) return []
    return getShedLinkedPrescriptions(firstShed, getClinicalLogs('prescription')).slice(0, 3).map((rx) => rx.id)
  })
  const [uploadedAttachments, setUploadedAttachments] = useState([])
  const [attachmentError, setAttachmentError] = useState('')
  const [booking, setBooking] = useState(() => {
    const today = getLocalTodayDateStr()
    const firstOpen = getDoctorAvailabilitySummary(VETERINARY_DOCTORS[0].id, today).todaySlots.find((s) => s.status === 'AVAILABLE')
    return {
      vetId: VETERINARY_DOCTORS[0].id,
      district: initialPrefill?.district && BANGLADESH_DISTRICTS.includes(initialPrefill.district)
        ? initialPrefill.district
        : 'Rajshahi',
      upazila: '',
      farmer: '',
      farm: '',
      manualBirdType: 'Broiler',
      manualTotalBirds: '',
      manualAgeDays: '',
      concern: initialPrefill?.concern || '',
      date: today,
      time: firstOpen?.time || '10:00',
      payment: 'bkash',
    }
  })
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [slotError, setSlotError] = useState('')
  const [clockMs, setClockMs] = useState(() => Date.now())
  const [activeRooms, setActiveRooms] = useState(() => getActiveRoomCalls())
  const [bookingMessage, setBookingMessage] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutBooking, setCheckoutBooking] = useState(null)
  const [verifiedReceipt, setVerifiedReceipt] = useState(null)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [devVerifyBusy, setDevVerifyBusy] = useState(false)
  const [callSessionNotice, setCallSessionNotice] = useState('')
  const [vetRoomCode, setVetRoomCode] = useState('')
  const [activeVetPatient, setActiveVetPatient] = useState(null)
  const [doctorsList, setDoctorsList] = useState(() => getDoctorsDirectory())
  const [slotVersion, setSlotVersion] = useState(0)
  const [detailsModalDoctorId, setDetailsModalDoctorId] = useState('')
  const [recentBookings, setRecentBookings] = useState(() => loadConsultationBookings())
  const [callMode, setCallMode] = useState('')
  const [prescription, setPrescription] = useState(() => ({
    ...emptyPrescription,
    district: initialPrefill?.district && BANGLADESH_DISTRICTS.includes(initialPrefill.district)
      ? initialPrefill.district
      : emptyPrescription.district,
    complaints: initialPrefill?.concern ? [initialPrefill.concern] : [],
    historyNotes: initialPrefill?.concern || '',
  }))
  const [medications, setMedications] = useState([emptyMedication()])
  const [complaintDraft, setComplaintDraft] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')

  const selectedVet = findDoctorProfile({ id: booking.vetId }, doctorsList) || doctorsList[0]
  const detailsModalDoctor = detailsModalDoctorId
    ? findDoctorProfile({ id: detailsModalDoctorId }, doctorsList)
    : null

  // RBAC: Logged-in doctor strictly scoped to their own identity, schedule & queue
  const doctorSession = useMemo(() => getAuthenticatedDoctorSession(role), [role])
  const myDoctorProfile = useMemo(
    () => (isRegisteredVet ? findDoctorProfile({ id: doctorSession.doctorId, regNo: doctorSession.regNo }, doctorsList) : null),
    [isRegisteredVet, doctorSession, doctorsList]
  )
  const myPersonalBookings = useMemo(
    () => (isRegisteredVet ? filterBookingsForDoctorSession(recentBookings, doctorSession) : []),
    [isRegisteredVet, recentBookings, doctorSession]
  )

  const selectedShed = useMemo(
    () => registeredSheds.find((s) => s.id === selectedShedId) || null,
    [registeredSheds, selectedShedId]
  )
  const linkedShedDiagnoses = useMemo(
    () => (bookingMode === BOOKING_TARGET_MODES.REGISTERED_SHED && selectedShed
      ? getShedLinkedDiagnoses(selectedShed, allDiagnosisLogs)
      : []),
    [bookingMode, selectedShed, allDiagnosisLogs]
  )
  const shedMatchedRxIdSet = useMemo(() => {
    if (!selectedShed) return new Set()
    return new Set(getShedLinkedPrescriptions(selectedShed, allPrescriptionLogs).map((r) => String(r.id)))
  }, [selectedShed, allPrescriptionLogs])
  const sortedPrescriptionsForPicker = useMemo(() => {
    const list = allPrescriptionLogs.slice(0, 15)
    if (bookingMode !== BOOKING_TARGET_MODES.REGISTERED_SHED || !selectedShed) return list
    return [...list].sort((a, b) => {
      const aMatch = shedMatchedRxIdSet.has(String(a.id)) ? 0 : 1
      const bMatch = shedMatchedRxIdSet.has(String(b.id)) ? 0 : 1
      return aMatch - bMatch
    })
  }, [allPrescriptionLogs, bookingMode, selectedShed, shedMatchedRxIdSet])

  const currentFlockPayload = useMemo(() => buildBookingFlockPayload({
    mode: bookingMode,
    selectedShed,
    manualInput: {
      upazila: booking.upazila,
      farmName: booking.farm,
      birdType: booking.manualBirdType,
      totalBirds: booking.manualTotalBirds,
      ageDays: booking.manualAgeDays,
    },
    attachedRxIds: selectedHistoryRxIds,
    uploadedFiles: uploadedAttachments,
    allDiagnoses: allDiagnosisLogs,
    allPrescriptions: allPrescriptionLogs,
    language,
  }), [
    bookingMode,
    selectedShed,
    booking.upazila,
    booking.farm,
    booking.manualBirdType,
    booking.manualTotalBirds,
    booking.manualAgeDays,
    selectedHistoryRxIds,
    uploadedAttachments,
    allDiagnosisLogs,
    allPrescriptionLogs,
    language,
  ])

  const medicineCategories = useMemo(() => getMedicineCategories(), [])
  const masterMedicineIndex = useMemo(() => {
    const map = new Map()
    getAllMasterMedicineEntries().forEach((entry) => map.set(entry.key, entry))
    return map
  }, [])

  const activePaidBooking = useMemo(() => {
    if (verifiedReceipt) return verifiedReceipt
    return recentBookings.find((item) => item?.trxId && item?.roomCode && item?.paymentStatus === 'Completed') || null
  }, [verifiedReceipt, recentBookings])

  const activeRoomCode = activePaidBooking?.roomCode || createCallRoomCode(activePaidBooking?.trxId || '')
  const activeBookingDoctor = useMemo(() => {
    const docName = activePaidBooking?.doctorName || activePaidBooking?.vetName
    return findDoctorProfile({ id: activePaidBooking?.doctorId, name: docName, regNo: activePaidBooking?.bvcRegNo }, doctorsList) || selectedVet
  }, [activePaidBooking, doctorsList, selectedVet])

  const scheduleStatus = useMemo(
    () => evaluateConsultationScheduleWindow(activePaidBooking?.bookingDate, activePaidBooking?.bookingTime, clockMs),
    [activePaidBooking?.bookingDate, activePaidBooking?.bookingTime, clockMs]
  )
  const farmerRoomSignal = activeRooms[activeRoomCode] || null
  const isDoctorCallingFarmer = farmerRoomSignal?.status === 'DOCTOR_CALLING'
  const isRoomCompleted = farmerRoomSignal?.status === 'COMPLETED'
  const farmerCanJoinCall = Boolean(
    activePaidBooking &&
    scheduleStatus.isWithinWindow &&
    isDoctorCallingFarmer &&
    !isRoomCompleted
  )
  const canStartCall = isRegisteredVet ? Boolean(vetRoomCode || myPersonalBookings[0]?.roomCode) : farmerCanJoinCall

  useEffect(() => {
    const timer = window.setInterval(() => setClockMs(Date.now()), 10000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    function syncDoctorsOnly() {
      setDoctorsList(getDoctorsDirectory())
      setSlotVersion((v) => v + 1)
    }
    function syncSlotsOnly() {
      setSlotVersion((v) => v + 1)
    }
    function syncShedsOnly() {
      const nextSheds = getSheds()
      setRegisteredSheds(nextSheds)
      setSelectedShedId((prev) => (prev && nextSheds.some((s) => s.id === prev) ? prev : (nextSheds[0]?.id || '')))
    }
    function syncBookings() {
      setRecentBookings(loadConsultationBookings())
      setAllDiagnosisLogs(getClinicalLogs('diagnosis'))
      setAllPrescriptionLogs(getClinicalLogs('prescription'))
      setActiveRooms(getActiveRoomCalls())
      syncShedsOnly()
      syncDoctorsOnly()
    }
    function syncRoomsOnly() {
      setActiveRooms(getActiveRoomCalls())
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
    let docsBc = null
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(TELEHEALTH_SIGNAL_CHANNEL)
      bc.onmessage = (event) => {
        if (event.data?.type === 'booking-alert' && event.data.roomCode) {
          setVetRoomCode(event.data.roomCode)
          syncBookings()
        } else if (event.data?.type === 'doctor-room-status') {
          syncRoomsOnly()
        }
      }
      docsBc = new BroadcastChannel(POULTRYMEDIX_DOCTORS_CHANNEL)
      docsBc.onmessage = syncDoctorsOnly
    }

    window.addEventListener(CLINICAL_LOGS_UPDATED_EVENT, syncBookings)
    window.addEventListener(POULTRYMEDIX_ROOMS_UPDATED_EVENT, syncRoomsOnly)
    window.addEventListener(POULTRYMEDIX_DOCTORS_UPDATED_EVENT, syncDoctorsOnly)
    window.addEventListener(POULTRYMEDIX_SLOTS_UPDATED_EVENT, syncSlotsOnly)
    window.addEventListener(POULTRYMEDIX_SHEDS_UPDATED_EVENT, syncShedsOnly)
    window.addEventListener('storage', syncBookings)
    window.addEventListener(POULTRYMEDIX_OPEN_TELEMEDICINE_EVENT, handlePrefillReferral)
    return () => {
      if (bc) bc.close()
      if (docsBc) docsBc.close()
      window.removeEventListener(CLINICAL_LOGS_UPDATED_EVENT, syncBookings)
      window.removeEventListener(POULTRYMEDIX_ROOMS_UPDATED_EVENT, syncRoomsOnly)
      window.removeEventListener(POULTRYMEDIX_DOCTORS_UPDATED_EVENT, syncDoctorsOnly)
      window.removeEventListener(POULTRYMEDIX_SLOTS_UPDATED_EVENT, syncSlotsOnly)
      window.removeEventListener(POULTRYMEDIX_SHEDS_UPDATED_EVENT, syncShedsOnly)
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
        const shedsSnapshot = getSheds()
        const returnedMode = pending?.bookingMode || (shedsSnapshot.length > 0 ? BOOKING_TARGET_MODES.REGISTERED_SHED : BOOKING_TARGET_MODES.MANUAL_FARM)
        const returnedShed = shedsSnapshot.find((s) => s.id === pending?.shedId) || shedsSnapshot[0] || null
        const flockSnap = buildBookingFlockPayload({
          mode: returnedMode,
          selectedShed: returnedMode === BOOKING_TARGET_MODES.REGISTERED_SHED ? returnedShed : null,
          manualInput: pending?.manualInput || {},
          attachedRxIds: pending?.attachedRxIds || [],
          uploadedFiles: pending?.uploadedFiles || [],
          allDiagnoses: getClinicalLogs('diagnosis'),
          allPrescriptions: getClinicalLogs('prescription'),
          language,
        })
        const enriched = {
          ...poll.receipt,
          roomCode,
          roomId: roomCode,
          bookingMode: flockSnap.bookingMode,
          shedId: flockSnap.shedId,
          shedName: flockSnap.shedName,
          upazila: flockSnap.upazila,
          birdType: flockSnap.birdType,
          age: flockSnap.age,
          flockSize: flockSnap.flockSize,
          shedSummary: flockSnap.shedSummary,
          aiDiagnosisSummary: flockSnap.aiDiagnosisSummary,
          linkedDiagnoses: flockSnap.linkedDiagnoses,
          attachedPrescriptions: flockSnap.attachedPrescriptions,
          uploadedAttachments: flockSnap.uploadedAttachments,
        }
        setVerifiedReceipt(enriched)
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
    setSlotError('')
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

  function applyMasterMedicineToRow(id, entryKey) {
    const entry = masterMedicineIndex.get(entryKey)
    if (!entry) return
    setMedications((current) => current.map((medication) => (
      medication.id === id
        ? {
            ...medication,
            masterKey: entryKey,
            name: entry.tradeName,
            tradeName: entry.tradeName,
            genericName: entry.genericName,
            antibioticClass: entry.category,
            whoAwareCategory: entry.whoAwareCategory,
            formulation: mapFormulationToRxSelect(entry.formulation),
            dosage: entry.standardDose,
            withdrawal: entry.withdrawalPeriod || '0 days',
            meatWithdrawalDays: entry.withdrawalPeriod || '0 days',
            company: entry.company,
            approxMrpBdt: entry.approxMrpBdt,
          }
        : medication
    )))
  }

  function addComplaint() {
    const complaint = complaintDraft.trim()
    if (!complaint || prescription.complaints.some((item) => item.toLocaleLowerCase() === complaint.toLocaleLowerCase())) return
    updatePrescription('complaints', [...prescription.complaints, complaint])
    setComplaintDraft('')
  }

  function scrollToUnifiedWorkspace(targetId = 'pmx-unified-vet-workspace') {
    window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function handleSwitchBookingMode(nextMode) {
    setBookingMode(nextMode)
    setSlotError('')
    setBookingMessage('')
    if (nextMode === BOOKING_TARGET_MODES.REGISTERED_SHED) {
      const targetShed = registeredSheds.find((s) => s.id === selectedShedId) || registeredSheds[0] || null
      if (targetShed) {
        setSelectedShedId(targetShed.id)
        setSelectedHistoryRxIds(
          getShedLinkedPrescriptions(targetShed, allPrescriptionLogs).slice(0, 3).map((r) => r.id)
        )
      }
    } else {
      setSelectedHistoryRxIds([])
    }
  }

  function handleSelectRegisteredShed(nextShedId) {
    setSelectedShedId(nextShedId)
    setSlotError('')
    setBookingMessage('')
    const targetShed = registeredSheds.find((s) => s.id === nextShedId) || null
    if (targetShed) {
      setSelectedHistoryRxIds(
        getShedLinkedPrescriptions(targetShed, allPrescriptionLogs).slice(0, 3).map((r) => r.id)
      )
    } else {
      setSelectedHistoryRxIds([])
    }
  }

  function toggleHistoryRx(rxId) {
    const key = String(rxId)
    setSelectedHistoryRxIds((prev) => (
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key].slice(0, 5)
    ))
  }

  async function handleHistoryAttachmentUpload(event) {
    setAttachmentError('')
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return

    let currentCount = uploadedAttachments.length
    const accepted = []
    for (const file of files) {
      if (currentCount >= MAX_ATTACHMENT_COUNT) {
        setAttachmentError(t('bookingAttachmentLimitError', { max: MAX_ATTACHMENT_COUNT }))
        break
      }
      const validation = validateHistoryAttachmentFile(file, language)
      if (!validation.ok) {
        setAttachmentError(validation.error)
        continue
      }
      try {
        const dataUrl = await readAttachmentAsDataUrl(file)
        accepted.push({
          id: crypto.randomUUID(),
          fileName: validation.cleanName,
          mimeType: validation.mimeType,
          sizeBytes: validation.sizeBytes,
          dataUrl,
        })
        currentCount += 1
      } catch {
        setAttachmentError(t('bookingAttachmentReadError'))
      }
    }
    if (accepted.length > 0) {
      setUploadedAttachments((prev) => [...prev, ...accepted].slice(0, MAX_ATTACHMENT_COUNT))
    }
  }

  function resolveBookingPayloadWithTarget(rawBooking) {
    const farmOverride = bookingMode === BOOKING_TARGET_MODES.REGISTERED_SHED && selectedShed
      ? sanitizePaymentInput(selectedShed.name, 120)
      : sanitizePaymentInput(rawBooking.farm, 120) || (
        sanitizePaymentInput(rawBooking.upazila, 80)
          ? `${sanitizePaymentInput(rawBooking.upazila, 80)} Farm`
          : (PAYMENT_MODE === 'sandbox' ? '' : (language === 'bn' ? 'অনিবন্ধিত খামার' : 'Unregistered Farm'))
      )
    const prepared = {
      ...rawBooking,
      farm: farmOverride,
    }
    return resolveBookingWithSandboxDefaults(prepared)
  }

  function loadBookingIntoPrescription(appt, callTypeToStart = '') {
    if (!doctorSession.isAuthenticatedDoctor) return
    const matchedDoc = myDoctorProfile || findDoctorProfile(
      { id: doctorSession.doctorId, regNo: doctorSession.regNo },
      doctorsList
    )
    assertDoctorOwnership(doctorSession, matchedDoc.id)

    const parsedShed = parseShedSnapshot(appt.shedSummary)
    const resolvedRoom = appt.roomCode || appt.roomId || createCallRoomCode(appt.trxId || appt.id)
    const candidateBird = normalizeBirdSpecies(appt.birdType || parsedShed.birdType || 'Broiler')
    const resolvedBirdType = birdTypes.includes(candidateBird) ? candidateBird : 'Broiler'

    setVetRoomCode(resolvedRoom)
    setActiveVetPatient({ ...appt, roomCode: resolvedRoom })
    setPrescription((current) => ({
      ...current,
      vetId: matchedDoc.id,
      vetName: matchedDoc.name,
      vetDegrees: matchedDoc.degrees,
      registrationNumber: matchedDoc.regNo,
      bvcRegNo: matchedDoc.regNo,
      clinicDetails: matchedDoc.clinic,
      farmerName: appt.farmerName || '',
      farmName: appt.farmName || appt.shedName || '',
      district: appt.district || 'Rajshahi',
      upazila: appt.upazila || '',
      birdType: resolvedBirdType,
      age: appt.age || parsedShed.age || '',
      flockSize: appt.flockSize || parsedShed.flockSize || '',
      averageWeight: appt.averageWeight || '',
      complaints: appt.concern ? [appt.concern] : [],
      historyNotes: appt.historyNotes || appt.concern || '',
      clinicalSigns: appt.clinicalSigns || appt.aiDiagnosisSummary || appt.concern || '',
      diagnosis: appt.diagnosis || '',
    }))
    if (callTypeToStart) {
      markSlotSessionStarted({
        doctorId: matchedDoc.id,
        date: appt.bookingDate,
        time: appt.bookingTime,
        doctorSession,
      })
      const normalizedType = callTypeToStart === 'audio' ? 'audio' : 'video'
      openDoctorCallRoom({ roomCode: resolvedRoom, doctor: matchedDoc, callType: normalizedType })
      setActiveRooms(getActiveRoomCalls())
      setCallMode(normalizedType)
      scrollToUnifiedWorkspace('pmx-unified-vet-workspace')
    } else {
      scrollToUnifiedWorkspace('prescription-builder-heading')
    }
    setSaveMessage(language === 'bn'
      ? `রোগীর পূর্ণ তথ্য ও ডাক্তার প্রোফাইল লোড হয়েছে: ${appt.farmerName || 'Farmer'} (${resolvedRoom})`
      : `Loaded consultation & auto-filled Dx/Flock info: ${appt.farmerName || 'Farmer'} (${resolvedRoom})`)
  }

  function validateBookingFormReady({ skipConsent = false, skipManualRequired = false } = {}) {
    if (!skipConsent && !consentAccepted) {
      setSlotError(t('telemedicineConsentRequiredError'))
      return false
    }
    if (bookingMode === BOOKING_TARGET_MODES.REGISTERED_SHED && !selectedShed) {
      setSlotError(t('bookingNoRegisteredShedError'))
      return false
    }
    if (!skipManualRequired && PAYMENT_MODE === 'live' && bookingMode === BOOKING_TARGET_MODES.MANUAL_FARM) {
      const birdCountNum = Number(booking.manualTotalBirds)
      if (!sanitizePaymentInput(booking.farmer, 120) || !sanitizePaymentInput(booking.concern, 300) || !Number.isFinite(birdCountNum) || birdCountNum <= 0) {
        setSlotError(t('bookingManualRequiredError'))
        return false
      }
    }
    const todayStr = getLocalTodayDateStr()
    if (!booking.date || booking.date < todayStr) {
      setSlotError(t('bookingPastSlotError'))
      return false
    }
    const slots = getSlotsForDoctorDate(booking.vetId, booking.date, todayStr)
    const targetSlot = slots.find((s) => s.time === booking.time)
    if (!targetSlot || targetSlot.status !== 'AVAILABLE') {
      setSlotError(t('slotAlreadyLockedError'))
      return false
    }
    setSlotError('')
    return true
  }

  function openCheckoutModal(event) {
    event.preventDefault()
    if (!validateBookingFormReady()) return
    const resolved = resolveBookingPayloadWithTarget(booking)
    const cleanFarmer = sanitizePaymentInput(resolved.farmer, 120)
    const cleanFarm = sanitizePaymentInput(resolved.farm, 120)
    const cleanConcern = sanitizePaymentInput(resolved.concern, 300)
    if (!cleanFarmer || !cleanFarm || !cleanConcern) return
    setCallMode('')
    setCheckoutBooking(resolved)
    setCheckoutOpen(true)
  }

  async function handleQuickDevVerifyAndOpen() {
    if (PAYMENT_MODE !== 'sandbox' || devVerifyBusy) return
    if (!validateBookingFormReady({ skipConsent: true, skipManualRequired: true })) return
    setSlotError('')
    setDevVerifyBusy(true)
    try {
      const resolved = resolveBookingPayloadWithTarget(booking)
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
          openReceiptModal: true,
        })
      }
    } finally {
      setDevVerifyBusy(false)
    }
  }

  async function handlePaymentVerified(receipt, options = { openReceiptModal: true }) {
    const roomCode = receipt.roomCode || createCallRoomCode(receipt.trxId)
    const flockSnap = currentFlockPayload
    const {
      bookingMode: snapMode,
      shedId,
      shedName,
      upazila,
      birdType,
      age,
      flockSize,
      shedSummary,
      aiDiagnosisSummary,
      linkedDiagnoses,
      attachedPrescriptions,
      uploadedAttachments: snapAttachments,
    } = flockSnap
    const matchedDoc = findDoctorProfile({ id: selectedVet.id, name: receipt.doctorName, regNo: receipt.bvcRegNo }, doctorsList)
    const farmerClientId = getOrCreateFarmerClientId()

    const lockResult = lockDoctorTimeSlot({
      doctorId: matchedDoc.id,
      date: receipt.bookingDate || booking.date,
      time: receipt.bookingTime || booking.time,
      farmerId: farmerClientId,
      farmerName: receipt.farmerName,
      bookingId: receipt.trxId,
    })

    if (!lockResult.ok) {
      setCheckoutOpen(false)
      setSlotError(lockResult.error || t('slotAlreadyLockedError'))
      return
    }
    setSlotVersion((v) => v + 1)

    const enrichedReceipt = {
      ...receipt,
      doctorId: matchedDoc?.id || selectedVet.id,
      farmerId: farmerClientId,
      vetDegrees: matchedDoc?.degrees || selectedVet.degrees,
      roomCode,
      roomId: roomCode,
      bookingMode: snapMode,
      shedId,
      shedName,
      farmName: shedName || receipt.farmName || flockSnap.farmName,
      upazila,
      birdType,
      age,
      flockSize,
      historyNotes: receipt.concern,
      clinicalSigns: aiDiagnosisSummary || receipt.concern,
      shedSummary,
      aiDiagnosisSummary,
      linkedDiagnoses,
      attachedPrescriptions,
      uploadedAttachments: snapAttachments,
    }
    setCheckoutOpen(false)
    setVerifiedReceipt(enrichedReceipt)
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
        upazila,
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
        doctorId: matchedDoc?.id || selectedVet.id,
        farmerId: farmerClientId,
        doctorName: enrichedReceipt.doctorName,
        vetName: enrichedReceipt.doctorName,
        vetDegrees: matchedDoc?.degrees || selectedVet.degrees,
        bvcRegNo: enrichedReceipt.bvcRegNo,
        clinicDetails: enrichedReceipt.clinicDetails,
        bookingMode: snapMode,
        shedId,
        shedName,
        farmerName: enrichedReceipt.farmerName,
        farmName: enrichedReceipt.farmName,
        district: enrichedReceipt.district,
        upazila,
        birdType,
        age,
        flockSize,
        bookingDate: enrichedReceipt.bookingDate,
        bookingTime: enrichedReceipt.bookingTime,
        concern: enrichedReceipt.concern,
        historyNotes: enrichedReceipt.concern,
        clinicalSigns: aiDiagnosisSummary || enrichedReceipt.concern,
        shedSummary,
        aiDiagnosisSummary,
        linkedDiagnoses,
        attachedPrescriptions,
        uploadedAttachments: snapAttachments,
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
        upazila,
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

      setUploadedAttachments([])
      setBookingMessage(language === 'bn'
        ? `${enrichedReceipt.doctorName}-এর সাথে বুকিং ও পেমেন্ট (${enrichedReceipt.trxId}) নিশ্চিত হয়েছে! নির্ধারিত সময়ে (${enrichedReceipt.bookingDate} · ${enrichedReceipt.bookingTime}) চিকিৎসক রুম ${roomCode}-এ কল শুরু করবেন।`
        : `Payment verified (${enrichedReceipt.trxId}) with ${enrichedReceipt.doctorName}. Wait in Room ${roomCode} at your scheduled slot (${enrichedReceipt.bookingDate} · ${enrichedReceipt.bookingTime}); the veterinarian will initiate the call.`)
      if (options.openReceiptModal !== false) {
        setReceiptModalOpen(true)
      }
    } catch (error) {
      console.error('Unable to save verified booking to clinical logs.', error)
      setBookingMessage(t('mockBookingSaveFailed', { payment: receipt.paymentMethodLabel }))
    }
  }

  function handleFarmerCancelBooking(item) {
    const roomSignal = activeRooms[item.roomCode]
    const sessionStarted = Boolean(roomSignal?.status === 'DOCTOR_CALLING' || roomSignal?.status === 'COMPLETED')
    const docMatch = findDoctorProfile({ id: item.doctorId, name: item.doctorName || item.vetName, regNo: item.bvcRegNo }, doctorsList)
    const release = releaseDoctorTimeSlot({
      doctorId: docMatch.id,
      date: item.bookingDate,
      time: item.bookingTime,
      actorId: item.farmerId || getOrCreateFarmerClientId(),
      actorRole: 'FARMER',
      sessionStartedOverride: sessionStarted,
    })
    if (!release.ok && release.code === 'SESSION_ALREADY_STARTED') {
      setSlotError(release.error)
      return
    }
    cancelConsultationBookingRecord(item.id)
    setRecentBookings(loadConsultationBookings())
    setSlotVersion((v) => v + 1)
    if (verifiedReceipt?.id === item.id || verifiedReceipt?.trxId === item.trxId) {
      setVerifiedReceipt(null)
    }
    setBookingMessage(
      language === 'bn'
        ? `বুকিং বাতিল করা হয়েছে এবং স্লট (${item.bookingDate} • ${item.bookingTime}) পুনরায় উন্মুক্ত হয়েছে।`
        : `Booking cancelled and time slot (${item.bookingDate} • ${item.bookingTime}) released for other farmers.`
    )
  }

  function handleVetInitiateDirectCall(mode) {
    if (!doctorSession.isAuthenticatedDoctor) return
    const targetAppt = activeVetPatient || myPersonalBookings[0]
    if (!targetAppt) return
    const matchedDoc = myDoctorProfile || findDoctorProfile(
      { id: doctorSession.doctorId, regNo: doctorSession.regNo },
      doctorsList
    )
    assertDoctorOwnership(doctorSession, matchedDoc.id)

    const targetRoom = vetRoomCode || targetAppt.roomCode || 'PMX-ROOM-LIVE'
    markSlotSessionStarted({
      doctorId: matchedDoc.id,
      date: targetAppt.bookingDate,
      time: targetAppt.bookingTime,
      doctorSession,
    })
    setVetRoomCode(targetRoom)
    openDoctorCallRoom({ roomCode: targetRoom, doctor: matchedDoc, callType: mode })
    setActiveRooms(getActiveRoomCalls())
    setCallMode(mode)
    scrollToUnifiedWorkspace('pmx-unified-vet-workspace')
  }

  function handleEndCall(sessionInfo) {
    setCallMode('')
    const doctorForSession = isRegisteredVet
      ? findDoctorProfile(
          { id: prescription.vetId, name: prescription.vetName, regNo: prescription.bvcRegNo || prescription.registrationNumber },
          doctorsList
        )
      : activeBookingDoctor

    const resolvedDoctorObj = {
      id: doctorForSession?.id || VETERINARY_DOCTORS[0].id,
      name: (isRegisteredVet ? prescription.vetName : doctorForSession?.name) || VETERINARY_DOCTORS[0].name,
      regNo: (isRegisteredVet ? (prescription.bvcRegNo || prescription.registrationNumber) : doctorForSession?.regNo) || VETERINARY_DOCTORS[0].regNo,
      clinic: (isRegisteredVet ? prescription.clinicDetails : doctorForSession?.clinic) || VETERINARY_DOCTORS[0].clinic,
    }

    const resolvedRoomId =
      sessionInfo.roomId ||
      sessionInfo.roomCode ||
      verifiedReceipt?.roomCode ||
      activePaidBooking?.roomCode ||
      vetRoomCode ||
      activeVetPatient?.roomCode ||
      'PMX-ROOM-LIVE'

    if (isRegisteredVet && resolvedRoomId !== 'PMX-ROOM-LIVE') {
      markRoomCallCompleted(resolvedRoomId)
      setActiveRooms(getActiveRoomCalls())
    }

    const updatedDocs = incrementDoctorServiceCounter({
      doctorId: resolvedDoctorObj.id,
      doctorName: resolvedDoctorObj.name,
      bvcRegNo: resolvedDoctorObj.regNo,
    })
    setDoctorsList(updatedDocs)

    saveCallSessionLog({
      bookingId: verifiedReceipt?.trxId || activePaidBooking?.trxId || activeVetPatient?.trxId || resolvedRoomId,
      roomId: resolvedRoomId,
      roomCode: resolvedRoomId,
      doctorName: resolvedDoctorObj.name,
      bvcRegNo: resolvedDoctorObj.regNo,
      clinicDetails: resolvedDoctorObj.clinic,
      callType: sessionInfo.callType,
      duration: sessionInfo.duration,
      durationSeconds: sessionInfo.durationSeconds,
      timestamp: sessionInfo.timestamp,
      farmerName: verifiedReceipt?.farmerName || activePaidBooking?.farmerName || activeVetPatient?.farmerName || sanitizePaymentInput(booking.farmer, 120) || prescription.farmerName || 'Registered Farmer',
      farmName: verifiedReceipt?.farmName || activePaidBooking?.farmName || activeVetPatient?.farmName || sanitizePaymentInput(booking.farm, 120) || prescription.farmName,
      district: booking.district || prescription.district || 'Rajshahi',
      concern: verifiedReceipt?.concern || activePaidBooking?.concern || activeVetPatient?.concern || sanitizePaymentInput(booking.concern, 300) || prescription.diagnosis || 'Flock Consultation',
    })

    setCallSessionNotice(language === 'bn'
      ? `${resolvedDoctorObj.name} (${resolvedDoctorObj.regNo})-এর সাথে ${sessionInfo.callType === 'Video' ? 'ভিডিও' : 'অডিও'} কল [${resolvedRoomId}] (${sessionInfo.duration}) সম্পন্ন হয়েছে ও সেবা কাউন্টার হালনাগাদ করা হয়েছে।`
      : `${sessionInfo.callType} consultation with ${resolvedDoctorObj.name} [${resolvedRoomId}] (${sessionInfo.duration}) logged & consultation counter updated (+1).`)
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
      const matchedDoc = findDoctorProfile(
        { id: prescription.vetId, name: prescription.vetName, regNo: prescription.bvcRegNo || prescription.registrationNumber },
        doctorsList
      )
      const structuredPrescription = {
        id: recordId,
        type: 'prescription',
        source: 'vet_issued',
        roomId: activeRoom,
        roomCode: activeRoom,
        shedId: activeVetPatient?.shedId || '',
        shedName: activeVetPatient?.shedName || prescription.farmName || '',
        timestamp: nowIso,
        formattedDate: new Date(nowIso).toLocaleString(),
        vetName: prescription.vetName || matchedDoc.name,
        vetDegrees: prescription.vetDegrees || matchedDoc.degrees,
        bvcRegNo: prescription.bvcRegNo || prescription.registrationNumber || matchedDoc.regNo,
        clinicDetails: prescription.clinicDetails || matchedDoc.clinic,
        farmerName: prescription.farmerName || 'Registered Farmer',
        farmName: prescription.farmName || '',
        district: prescription.district || 'Rajshahi',
        upazila: prescription.upazila || activeVetPatient?.upazila || '',
        flockType: prescription.flockType || prescription.birdType || 'Broiler',
        age: prescription.age || '',
        flockSize: prescription.flockSize || '',
        averageWeight: prescription.averageWeight || '',
        diagnosis: prescription.diagnosis || 'Clinical Diagnosis',
        complaints: prescription.complaints || [],
        historyNotes: prescription.historyNotes || '',
        clinicalSigns: prescription.clinicalSigns || '',
        medications: formattedMeds,
        tests: prescription.tests || '',
        advice: prescription.advice || '',
        followUpDate: prescription.followUpDate || '',
      }

      savePrescriptionLog(structuredPrescription)
      broadcastLivePrescription({ roomCode: activeRoom, prescription: structuredPrescription })
      setDoctorsList(incrementDoctorServiceCounter({
        doctorId: matchedDoc.id,
        doctorName: structuredPrescription.vetName,
        bvcRegNo: structuredPrescription.bvcRegNo,
      }))

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
          <div className="pmx-specialist-section-head">
            <strong>{t('doctorDirectoryTitle')}</strong>
            <small>{t('doctorDirectorySubtitle')}</small>
          </div>
          <div className="pmx-specialist-grid">
            {doctorsList.map((doc) => {
              const isSelectedDoc = doc.id === selectedVet.id
              const locDoc = getDoctorLocalizedFields(doc, language)
              const availSummary = getDoctorAvailabilitySummary(doc.id, getLocalTodayDateStr())
              return (
                <button
                  key={`${doc.id}-${slotVersion}`}
                  type="button"
                  className={`pmx-specialist-card${isSelectedDoc ? ' is-selected' : ''}`}
                  onClick={() => {
                    updateBooking('vetId', doc.id)
                    setDetailsModalDoctorId(doc.id)
                  }}
                >
                  <div className="pmx-specialist-card-top">
                    <span className={`pmx-doc-avatar-badge is-${doc.avatarTone || 'emerald'}`} aria-hidden="true">
                      {doc.avatarInitials || 'DR'}
                    </span>
                    <div className="pmx-specialist-card-info">
                      <strong>{locDoc.displayName}</strong>
                      <span>{locDoc.displayDegrees}</span>
                      <small>{locDoc.displayClinic}</small>
                    </div>
                  </div>
                  <div className="pmx-specialist-stats">
                    <span>
                      {toLocaleDigits(doc.experienceYears, language)} {t('doctorExpYearsLabel')}
                    </span>
                    <span>•</span>
                    <span>
                      {toLocaleDigits(doc.consultationsServed, language)} {t('doctorServedLabel')}
                    </span>
                    <span>•</span>
                    <span>{locDoc.displayLocation}</span>
                  </div>
                  <div className="pmx-specialist-card-footer">
                    {availSummary.badgeStatus === 'available' ? (
                      <span className="pmx-slot-status-badge is-available">
                        ● {t('doctorAvailableTodayBadge', { count: toLocaleDigits(availSummary.availableSlots, language) })}
                      </span>
                    ) : (
                      <div className="pmx-fully-booked-stack">
                        <span className="pmx-slot-status-badge is-full">
                          {t('doctorFullyBookedBadge')}
                        </span>
                        {availSummary.nextAvailableDate && (
                          <small className="pmx-next-available-note">
                            {t('doctorNextAvailableLabel', { date: toLocaleDigits(availSummary.nextAvailableDate, language) })}
                          </small>
                        )}
                      </div>
                    )}
                    <span className="pmx-card-action-hint">{t('docViewProfileAndSlots')} →</span>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="pmx-selected-slot-banner">
            <div>
              <strong>{t('docSelectedSlotBannerLabel')}:</strong>{' '}
              <span>
                {getDoctorLocalizedFields(selectedVet, language).displayName} •{' '}
                {toLocaleDigits(booking.date, language)} •{' '}
                {formatSlotTimeDisplay(booking.time, language)}
              </span>
            </div>
            <button
              type="button"
              className="pmx-secondary-btn dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
              style={{ minHeight: '30px', padding: '0 10px', fontSize: '11px' }}
              onClick={() => setDetailsModalDoctorId(selectedVet.id)}
            >
              {t('docOpenModalBtn')}
            </button>
          </div>

          <div className="pmx-target-mode-panel dark:border-gray-700 dark:bg-gray-900">
            <div className="pmx-target-mode-head">
              <strong>{t('bookingTargetTitle')}</strong>
              <small>{t('bookingTargetSubtitle')}</small>
            </div>
            <div className="pmx-target-mode-toggle" role="radiogroup" aria-label={t('bookingTargetTitle')}>
              <button
                type="button"
                className={`pmx-mode-choice-btn${bookingMode === BOOKING_TARGET_MODES.REGISTERED_SHED ? ' is-active' : ''}`}
                aria-pressed={bookingMode === BOOKING_TARGET_MODES.REGISTERED_SHED}
                onClick={() => handleSwitchBookingMode(BOOKING_TARGET_MODES.REGISTERED_SHED)}
              >
                <strong>{t('bookingModeRegisteredShed')}</strong>
                <small>{t('bookingModeRegisteredHint')}</small>
              </button>
              <button
                type="button"
                className={`pmx-mode-choice-btn${bookingMode === BOOKING_TARGET_MODES.MANUAL_FARM ? ' is-active' : ''}`}
                aria-pressed={bookingMode === BOOKING_TARGET_MODES.MANUAL_FARM}
                onClick={() => handleSwitchBookingMode(BOOKING_TARGET_MODES.MANUAL_FARM)}
              >
                <strong>{t('bookingModeManualFarm')}</strong>
                <small>{t('bookingModeManualHint')}</small>
              </button>
            </div>

            {bookingMode === BOOKING_TARGET_MODES.REGISTERED_SHED ? (
              registeredSheds.length > 0 ? (
                <div className="pmx-shed-selector-body">
                  <Field label={t('bookingSelectShedLabel')}>
                    <select value={selectedShedId} onChange={(event) => handleSelectRegisteredShed(event.target.value)}>
                      {registeredSheds.map((shed) => (
                        <option key={shed.id} value={shed.id}>
                          {shed.name} · {t(`birdTypes.${normalizeBirdSpecies(shed.species)}`, shed.species)} · {toLocaleDigits(shed.birdCount, language)} {t('birdsUnit')} ({language === 'bn' ? `দিন ${toLocaleDigits(shed.currentAgeDays, language)}` : `Day ${shed.currentAgeDays}`})
                        </option>
                      ))}
                    </select>
                  </Field>
                  {selectedShed && (
                    <div className="pmx-shed-autofill-strip">
                      <div className="pmx-shed-autofill-metrics">
                        <span><strong>{t('birdType')}:</strong> {t(`birdTypes.${currentFlockPayload.birdType}`, currentFlockPayload.birdType)}</span>
                        <span><strong>{t('flockSize')}:</strong> {toLocaleDigits(currentFlockPayload.flockSize || '0', language)}</span>
                        <span><strong>{t('age')}:</strong> {currentFlockPayload.age}</span>
                      </div>
                      {linkedShedDiagnoses.length > 0 ? (
                        <div className="pmx-shed-linked-ai-pill">
                          <Icon name="spark" size={14} />
                          <span>
                            {t('bookingLinkedAiScanSummary', {
                              disease: linkedShedDiagnoses[0].primaryDisease,
                              confidence: linkedShedDiagnoses[0].confidencePercent || '',
                            })}
                          </span>
                        </div>
                      ) : (
                        <small className="pmx-shed-no-ai-note">{t('bookingNoShedAiScanNote')}</small>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="pmx-empty-shed-callout">
                  <span>{t('bookingNoShedsFound')}</span>
                  <button
                    type="button"
                    className="pmx-secondary-btn"
                    style={{ minHeight: '30px', padding: '0 10px', fontSize: '11px' }}
                    onClick={() => handleSwitchBookingMode(BOOKING_TARGET_MODES.MANUAL_FARM)}
                  >
                    {t('bookingSwitchToManualBtn')}
                  </button>
                </div>
              )
            ) : (
              <div className="pmx-manual-clinical-banner">
                <Icon name="stethoscope" size={15} />
                <span>{t('bookingManualClinicalNote')}</span>
              </div>
            )}
          </div>

          <Field label={bookingMode === BOOKING_TARGET_MODES.MANUAL_FARM ? t('farmerOwnerName') : t('farmerName')}>
            <input required={PAYMENT_MODE === 'live'} maxLength={120} value={booking.farmer} onChange={(event) => updateBooking('farmer', event.target.value)} placeholder={t('namePlaceholder')} />
          </Field>
          {bookingMode === BOOKING_TARGET_MODES.MANUAL_FARM && (
            <Field label={t('bookingManualFarmOptional')}>
              <input maxLength={120} value={booking.farm} onChange={(event) => updateBooking('farm', event.target.value)} placeholder={t('farmFlockPlaceholder')} />
            </Field>
          )}
          <Field label={t('rxDistrict')}>
            <select value={booking.district} onChange={(event) => updateBooking('district', event.target.value)}>
              {BANGLADESH_DISTRICTS.map((dist) => (
                <option key={dist} value={dist}>{t(`districts.${dist}`, dist)}</option>
              ))}
            </select>
          </Field>
          <Field label={t('bookingUpazilaLabel')}>
            <input maxLength={80} value={booking.upazila} onChange={(event) => updateBooking('upazila', event.target.value)} placeholder={t('bookingUpazilaPlaceholder')} />
          </Field>

          {bookingMode === BOOKING_TARGET_MODES.MANUAL_FARM && (
            <>
              <Field label={t('birdType')}>
                <select value={booking.manualBirdType} onChange={(event) => updateBooking('manualBirdType', event.target.value)}>
                  {MANUAL_BIRD_TYPES.map((species) => (
                    <option key={species} value={species}>{t(`birdTypes.${species}`, species)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('bookingTotalBirdsLabel')}>
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  required={PAYMENT_MODE === 'live'}
                  value={booking.manualTotalBirds}
                  onChange={(event) => updateBooking('manualTotalBirds', event.target.value)}
                  placeholder="1000"
                />
              </Field>
              <Field label={t('bookingBirdAgeDaysLabel')}>
                <input
                  type="number"
                  min="0"
                  max="2000"
                  value={booking.manualAgeDays}
                  onChange={(event) => updateBooking('manualAgeDays', event.target.value)}
                  placeholder="21"
                />
              </Field>
            </>
          )}

          <Field label={t('mainConcern')} className="pmx-booking-concern-field">
            <input required={PAYMENT_MODE === 'live'} maxLength={300} value={booking.concern} onChange={(event) => updateBooking('concern', event.target.value)} placeholder={t('concernPlaceholder')} />
          </Field>

          <div className="pmx-history-attach-panel dark:border-gray-700 dark:bg-gray-900">
            <div className="pmx-history-attach-head">
              <strong>{t('bookingAttachHistoryTitle')}</strong>
              <small>{t('bookingAttachHistorySubtitle')}</small>
            </div>

            {sortedPrescriptionsForPicker.length > 0 && (
              <div className="pmx-history-rx-picker">
                <span className="pmx-history-sublabel">{t('bookingPastRxPickerLabel')}</span>
                <div className="pmx-history-rx-list">
                  {sortedPrescriptionsForPicker.map((rx) => {
                    const rxId = String(rx.id)
                    const checked = selectedHistoryRxIds.includes(rxId)
                    const isShedMatch = bookingMode === BOOKING_TARGET_MODES.REGISTERED_SHED && shedMatchedRxIdSet.has(rxId)
                    return (
                      <label key={rxId} className={`pmx-history-rx-option${checked ? ' is-checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleHistoryRx(rxId)}
                        />
                        <div className="pmx-history-rx-copy">
                          <strong>
                            {rx.diagnosis || t('clinicalHistoryDiagnosis')}
                            {isShedMatch && <span className="pmx-shed-match-tag">{t('bookingMatchesShedTag')}</span>}
                          </strong>
                          <small>
                            {[rx.formattedDate || (rx.timestamp ? rx.timestamp.slice(0, 10) : ''), rx.vetName, rx.flockType].filter(Boolean).join(' · ')}
                          </small>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="pmx-external-upload-zone">
              <div className="pmx-external-upload-row">
                <div>
                  <span className="pmx-history-sublabel">{t('bookingExternalUploadLabel')}</span>
                  <small className="pmx-upload-hint">{t('bookingExternalUploadHint')}</small>
                </div>
                <label className="pmx-upload-file-trigger">
                  <Icon name="upload" size={14} />
                  <span>{t('bookingUploadBtn')}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                    multiple
                    onChange={handleHistoryAttachmentUpload}
                  />
                </label>
              </div>
              {attachmentError && (
                <div className="pmx-checkout-error" role="alert" style={{ marginTop: '6px' }}>
                  <Icon name="alert" size={14} />
                  <span>{attachmentError}</span>
                </div>
              )}
              {uploadedAttachments.length > 0 && (
                <ul className="pmx-uploaded-chips">
                  {uploadedAttachments.map((file) => (
                    <li key={file.id} className="pmx-uploaded-chip">
                      <span>{file.fileName} ({formatBytesReadable(file.sizeBytes)})</span>
                      <button
                        type="button"
                        aria-label={t('removeFile', { name: file.fileName })}
                        onClick={() => setUploadedAttachments((prev) => prev.filter((item) => item.id !== file.id))}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <Field label={t('preferredDate')}><input required type="date" min={getLocalTodayDateStr()} value={booking.date} onChange={(event) => updateBooking('date', event.target.value)} /></Field>
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
          </fieldset>
          <label className="pmx-telehealth-consent-box dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(event) => {
                setConsentAccepted(event.target.checked)
                if (slotError) setSlotError('')
              }}
            />
            <span>{t('telemedicineConsentLabel')}</span>
          </label>
          {slotError && (
            <div className="pmx-checkout-error" style={{ gridColumn: '1 / -1' }} role="alert">
              <Icon name="alert" size={15} />
              <span>{slotError}</span>
            </div>
          )}
          <div className="pmx-booking-submit-row">
            <button className="telemedicine-primary-button" type="submit"><Icon name="lock" size={16} />{t('confirmBookingBtn')}</button>
            {PAYMENT_MODE === 'sandbox' && (
              <button
                type="button"
                className="pmx-dev-quick-btn"
                disabled={devVerifyBusy}
                onClick={() => handleQuickDevVerifyAndOpen()}
              >
                <Icon name="shield" size={16} />
                {devVerifyBusy ? t('checkoutProcessing') : t('devQuickVerifyUnlockBtn')}
              </button>
            )}
          </div>
          {bookingMessage && <p className="telemedicine-status" role="status">{bookingMessage}</p>}
          {callSessionNotice && <p className="telemedicine-status" role="status">{callSessionNotice}</p>}
        </form>

        <div className={`telemedicine-call-actions${farmerCanJoinCall ? ' is-ringing' : ''}`}>
          <div>
            <h3>{t('waitingRoomTitle')} — {activeBookingDoctor.name}</h3>
            {!activePaidBooking ? (
              <p>{t('confirmBookingToCall')}</p>
            ) : isRoomCompleted ? (
              <p>{t('roomCompletedLockedNote', { roomCode: activeRoomCode })}</p>
            ) : !scheduleStatus.isWithinWindow ? (
              <p>
                <strong>{activePaidBooking.bookingDate} · {activePaidBooking.bookingTime}</strong> —{' '}
                {language === 'bn' ? scheduleStatus.countdownBn : scheduleStatus.countdownEn}. {t('doctorOnlyCallsOnScheduleNote')}
              </p>
            ) : isDoctorCallingFarmer ? (
              <p className="pmx-ringing-prompt">
                {t('doctorCallingJoinPrompt', { doctor: activeBookingDoctor.name, roomCode: activeRoomCode })}
              </p>
            ) : (
              <p>{t('waitingForDoctorCallPrompt', { doctor: activeBookingDoctor.name, roomCode: activeRoomCode })}</p>
            )}
          </div>
          <div className="telemedicine-call-buttons">
            <button
              type="button"
              className="telemedicine-audio-button"
              disabled={!farmerCanJoinCall}
              onClick={() => setCallMode('audio')}
            >
              <Icon name="phone" size={17} />
              {t('farmerJoinAudioBtn')}
            </button>
            <button
              type="button"
              className="telemedicine-video-button"
              disabled={!farmerCanJoinCall}
              onClick={() => setCallMode('video')}
            >
              <Icon name="video" size={18} />
              {t('farmerJoinVideoBtn')}
            </button>
          </div>
        </div>

        <div className="pmx-doctor-privacy-card dark:bg-gray-900 dark:border-gray-700">
          <div className="pmx-doctor-privacy-info">
            <span className="pmx-privacy-shield-badge">
              <Icon name="shield" size={13} />
              {t('privacyProtectedCallBadge')}
            </span>
            <strong>{activeBookingDoctor.name}</strong>
            <span>{activeBookingDoctor.degrees} · {activeBookingDoctor.regNo}</span>
            <small>{activeBookingDoctor.specialty}</small>
          </div>
          {activePaidBooking && (
            <div className="pmx-verified-room-actions">
              <span className="pmx-verified-trx-chip">{activePaidBooking.trxId}</span>
              <span className="pmx-room-code-pill">{activeRoomCode}</span>
              <span className={`pmx-schedule-pill is-${isRoomCompleted ? 'completed' : scheduleStatus.phase.toLowerCase()}`}>
                {isRoomCompleted
                  ? t('slotStatusCompleted')
                  : scheduleStatus.isWithinWindow
                    ? (isDoctorCallingFarmer ? t('slotStatusDoctorCalling') : t('slotStatusWindowOpen'))
                    : scheduleStatus.phase === 'EXPIRED'
                      ? t('slotStatusExpired')
                      : t('slotStatusUpcoming')}
              </span>
              {verifiedReceipt && (
                <button
                  type="button"
                  className="pmx-receipt-open-btn dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
                  onClick={() => setReceiptModalOpen(true)}
                >
                  <Icon name="file" size={15} />
                  {t('viewDigitalReceipt')}
                </button>
              )}
            </div>
          )}
        </div>

        {callMode && farmerCanJoinCall && (
          <ConsultationCallRoom
            initialCallType={callMode}
            doctor={activeBookingDoctor}
            participantRole="farmer"
            userRole={role}
            bookingContext={{
              trxId: activePaidBooking?.trxId || 'PMX-TRX-DEV',
              roomCode: activeRoomCode,
              bookingMode: activePaidBooking?.bookingMode || currentFlockPayload.bookingMode,
              shedName: activePaidBooking?.shedName || currentFlockPayload.shedName,
              farmerName: activePaidBooking?.farmerName || sanitizePaymentInput(booking.farmer, 120) || 'Registered Farmer',
              farmName: activePaidBooking?.farmName || currentFlockPayload.farmName,
              district: t(`districts.${activePaidBooking?.district || booking.district}`, activePaidBooking?.district || booking.district),
              upazila: activePaidBooking?.upazila ?? currentFlockPayload.upazila,
              birdType: activePaidBooking?.birdType || currentFlockPayload.birdType,
              flockSize: activePaidBooking?.flockSize || currentFlockPayload.flockSize,
              age: activePaidBooking?.age || currentFlockPayload.age,
              bookingDate: activePaidBooking?.bookingDate || booking.date,
              bookingTime: activePaidBooking?.bookingTime || booking.time,
              concern: activePaidBooking?.concern || sanitizePaymentInput(booking.concern, 300),
              shedSummary: activePaidBooking?.shedSummary ?? currentFlockPayload.shedSummary,
              aiDiagnosisSummary: activePaidBooking?.aiDiagnosisSummary ?? currentFlockPayload.aiDiagnosisSummary,
              linkedDiagnoses: activePaidBooking?.linkedDiagnoses ?? currentFlockPayload.linkedDiagnoses,
              attachedPrescriptions: activePaidBooking?.attachedPrescriptions ?? currentFlockPayload.attachedPrescriptions,
              uploadedAttachments: activePaidBooking?.uploadedAttachments ?? currentFlockPayload.uploadedAttachments,
              amount: CONSULTATION_FEE_BDT,
              paymentMethodLabel: activePaidBooking?.paymentMethodLabel || booking.payment,
            }}
            onEndCall={handleEndCall}
          />
        )}

        {recentBookings.length > 0 && (
          <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-700">
            <h3 className="mb-2.5 text-sm font-bold text-gray-800 dark:text-gray-100">
              {t('rxScheduledBookings')}
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {recentBookings.slice(0, 6).map((item) => {
                const matchedDoc = findDoctorProfile({ id: item.doctorId, name: item.vetName || item.doctorName, regNo: item.bvcRegNo }, doctorsList)
                const locDoc = getDoctorLocalizedFields(matchedDoc, language)
                const sessionActiveOrDone = Boolean(activeRooms[item.roomCode]?.status)
                return (
                  <div key={item.id} className="pmx-scheduled-booking-card rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-900">
                    <div className="pmx-booking-header-row">
                      <strong className="pmx-booking-doc-name text-emerald-800 dark:text-emerald-400">
                        {locDoc.displayName || item.vetName || item.doctorName}
                      </strong>
                      <span className="pmx-booking-slot-pill">
                        {toLocaleDigits(item.bookingDate || t('today'), language)} • {formatSlotTimeDisplay(item.bookingTime, language)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-gray-600 dark:text-gray-300">
                      <strong>{item.farmerName || t('farmer')}</strong>
                      {item.farmName ? ` · ${item.farmName}` : ''} ({[item.upazila, t(`districts.${item.district || 'Rajshahi'}`, item.district || 'Rajshahi')].filter(Boolean).join(', ')}) — {item.concern}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.bookingMode && (
                          <span className={`pmx-booking-mode-pill ${item.bookingMode === BOOKING_TARGET_MODES.MANUAL_FARM ? 'is-manual' : 'is-shed'}`}>
                            {item.bookingMode === BOOKING_TARGET_MODES.MANUAL_FARM ? t('bookingModeManualShort') : t('bookingModeShedShort')}
                          </span>
                        )}
                        {item.roomCode && <span className="pmx-room-code-pill">{item.roomCode}</span>}
                        {item.flockSize && (
                          <small className="text-gray-500 dark:text-gray-400">
                            {t(`birdTypes.${normalizeBirdSpecies(item.birdType || 'Broiler')}`, item.birdType || 'Broiler')} · {item.flockSize}{item.age ? ` · ${item.age}` : ''}
                          </small>
                        )}
                      </div>
                      {!sessionActiveOrDone && (
                        <button
                          type="button"
                          className="pmx-cancel-booking-btn"
                          onClick={() => handleFarmerCancelBooking(item)}
                        >
                          {t('cancelBookingReleaseBtn')}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {t('rxDoctorOnlyNote')}
        </p>
      </section>}

      {isRegisteredVet && myDoctorProfile && <section className="telemedicine-booking-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700" aria-labelledby="vet-consultation-room-heading">
        {/* Personal Doctor Profile Header — strict RBAC personal view without multi-doctor switchers or debug buttons */}
        {(() => {
          const locDoc = getDoctorLocalizedFields(myDoctorProfile, language)
          return (
            <header className="pmx-doctor-personal-hero">
              <div className="pmx-doctor-personal-left">
                <span className={`pmx-doc-avatar-badge is-${myDoctorProfile.avatarTone || 'emerald'}`} aria-hidden="true">
                  {myDoctorProfile.avatarInitials || 'DR'}
                </span>
                <div>
                  <span className="telemedicine-eyebrow">{t('veterinarianWorkspace')} · {myDoctorProfile.regNo}</span>
                  <h2 id="vet-consultation-room-heading">{locDoc.displayName}</h2>
                  <p>{locDoc.displayDegrees} · {locDoc.displayClinic}</p>
                </div>
              </div>
              <div className="pmx-doctor-personal-metrics">
                <span className="pmx-served-counter-pill">
                  {toLocaleDigits(myDoctorProfile.consultationsServed, language)} {t('doctorServedLabel')}
                </span>
                <span className="pmx-booking-slot-pill">
                  {toLocaleDigits(myDoctorProfile.experienceYears, language)} {t('doctorExpYearsLabel')}
                </span>
              </div>
            </header>
          )
        })()}

        {/* Doctor Personal Schedule & Availability Manager */}
        <DoctorScheduleManager
          key={`sched-${myDoctorProfile.id}`}
          doctorSession={doctorSession}
          doctorId={myDoctorProfile.id}
          slotVersion={slotVersion}
          onScheduleUpdated={() => setSlotVersion((v) => v + 1)}
        />

        <div style={{ marginBottom: '10px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800 }}>{t('activePatientQueueTitle')}</h3>
          <small style={{ color: '#64748b' }}>{t('docPersonalDashboardSubtitle')}</small>
        </div>

        {myPersonalBookings.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            {myPersonalBookings.slice(0, 8).map((appt) => {
              const roomBadge = appt.roomCode || appt.roomId || createCallRoomCode(appt.trxId || appt.id)
              const shedLabel = appt.shedSummary || [appt.birdType, appt.flockSize ? `${appt.flockSize}` : '', appt.age].filter(Boolean).join(' · ') || t('callFlockSnapshotEmpty')
              const aiLabel = appt.aiDiagnosisSummary || t('queueNoAiScanYet')
              const isManualAppt = appt.bookingMode === BOOKING_TARGET_MODES.MANUAL_FARM
              const attachedCount = (Array.isArray(appt.attachedPrescriptions) ? appt.attachedPrescriptions.length : 0) + (Array.isArray(appt.uploadedAttachments) ? appt.uploadedAttachments.length : 0)
              const slotEval = evaluateConsultationScheduleWindow(appt.bookingDate, appt.bookingTime, clockMs)
              const qRoomState = activeRooms[roomBadge]
              const isCompleted = qRoomState?.status === 'COMPLETED'
              return (
                <div key={appt.id} className="pmx-queue-card dark:bg-gray-900 dark:border-gray-700">
                  <div>
                    <div className="pmx-queue-card-top">
                      <strong>{appt.farmerName || t('farmer')}</strong>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className={`pmx-booking-mode-pill ${isManualAppt ? 'is-manual' : 'is-shed'}`}>
                          {isManualAppt ? t('bookingModeManualShort') : t('bookingModeShedShort')}
                        </span>
                        <span className="pmx-room-code-pill">{roomBadge}</span>
                      </div>
                    </div>
                    <div className="pmx-booking-header-row pmx-queue-doc-row">
                      <span className="pmx-booking-doc-name">
                        {[appt.upazila, t(`districts.${appt.district || 'Rajshahi'}`, appt.district || 'Rajshahi')].filter(Boolean).join(', ')}
                        {appt.farmName ? ` · ${appt.farmName}` : ''}
                      </span>
                      <span className="pmx-booking-slot-pill">
                        {toLocaleDigits(appt.bookingDate || t('today'), language)} • {formatSlotTimeDisplay(appt.bookingTime, language)}
                      </span>
                    </div>
                    <div style={{ margin: '4px 0 6px' }}>
                      <span className={`pmx-schedule-pill is-${isCompleted ? 'completed' : slotEval.phase.toLowerCase()}`}>
                        {isCompleted
                          ? t('slotStatusCompleted')
                          : slotEval.isWithinWindow
                            ? t('slotStatusWindowOpen')
                            : slotEval.phase === 'EXPIRED'
                              ? t('slotStatusExpired')
                              : (language === 'bn' ? slotEval.countdownBn : slotEval.countdownEn)}
                      </span>
                    </div>
                    <p className="pmx-queue-shed"><strong>{t('shedLabelShort')}:</strong> {shedLabel}</p>
                    <p className="pmx-queue-symptom"><strong>{t('symptomsShort')}:</strong> {appt.concern || t('historyNoDetails')}</p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div className="pmx-queue-ai-chip">{t('aiDiagnosisBadgeLabel')}: {aiLabel}</div>
                      {attachedCount > 0 && (
                        <span className="pmx-queue-attach-chip">
                          + {toLocaleDigits(attachedCount, language)} {t('queueAttachedFilesBadge')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="pmx-queue-card-actions">
                    <button
                      type="button"
                      disabled={isCompleted || (!slotEval.isWithinWindow && !import.meta.env.DEV)}
                      onClick={() => loadBookingIntoPrescription(appt, 'video')}
                      className="pmx-primary-submit-btn"
                      style={{ flex: 1, minHeight: '34px', fontSize: '11px' }}
                    >
                      <Icon name="video" size={14} />
                      {t('vetRingVideoBtn')}
                    </button>
                    <button
                      type="button"
                      disabled={isCompleted || (!slotEval.isWithinWindow && !import.meta.env.DEV)}
                      onClick={() => loadBookingIntoPrescription(appt, 'audio')}
                      className="pmx-secondary-btn dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
                      style={{ minHeight: '34px', fontSize: '11px', padding: '0 9px' }}
                      aria-label={t('vetInitiateAudioBtn')}
                    >
                      <Icon name="phone" size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => loadBookingIntoPrescription(appt, '')}
                      className="pmx-secondary-btn dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
                      style={{ minHeight: '34px', fontSize: '11px', padding: '0 10px' }}
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
              value={vetRoomCode || myPersonalBookings[0]?.roomCode || ''}
              onChange={(event) => setVetRoomCode(event.target.value.toUpperCase())}
              placeholder={t('roomCodeLabel')}
              aria-label={t('roomCodeLabel')}
            />
            <button type="button" className="telemedicine-audio-button" disabled={!canStartCall} onClick={() => handleVetInitiateDirectCall('audio')}><Icon name="phone" size={17} />{t('vetInitiateAudioBtn')}</button>
            <button type="button" className="telemedicine-video-button" disabled={!canStartCall} onClick={() => handleVetInitiateDirectCall('video')}><Icon name="video" size={18} />{t('vetInitiateVideoBtn')}</button>
          </div>
        </div>
        {callSessionNotice && <p className="telemedicine-status" style={{ marginTop: '10px' }} role="status">{callSessionNotice}</p>}
      </section>}

      {isRegisteredVet && <section id="pmx-unified-vet-workspace" className={`telemedicine-prescription-section pmx-unified-vet-workspace${callMode ? ' has-active-call' : ''} bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white`} aria-labelledby="prescription-builder-heading">
        {callMode && (
          <div className="pmx-unified-call-container">
            <ConsultationCallRoom
              initialCallType={callMode}
              participantRole="vet"
              userRole={role}
              onToggleMobileRxSheet={() => scrollToUnifiedWorkspace('prescription-builder-heading')}
              doctor={{
                ...myDoctorProfile,
                name: prescription.vetName || myDoctorProfile.name,
                degrees: prescription.vetDegrees || myDoctorProfile.degrees,
                regNo: prescription.bvcRegNo || prescription.registrationNumber || myDoctorProfile.regNo,
                clinic: prescription.clinicDetails || myDoctorProfile.clinic,
              }}
              bookingContext={(() => {
                const targetAppt = activeVetPatient || myPersonalBookings[0] || {}
                return {
                  trxId: targetAppt.trxId || 'VET-DIRECT',
                  roomCode: vetRoomCode || targetAppt.roomCode || 'PMX-ROOM-LIVE',
                  bookingMode: targetAppt.bookingMode || BOOKING_TARGET_MODES.REGISTERED_SHED,
                  shedName: targetAppt.shedName || '',
                  farmerName: prescription.farmerName || targetAppt.farmerName || t('farmer'),
                  farmName: prescription.farmName || targetAppt.farmName || '',
                  district: t(`districts.${prescription.district || targetAppt.district || 'Rajshahi'}`, prescription.district || targetAppt.district || 'Rajshahi'),
                  upazila: prescription.upazila || targetAppt.upazila || '',
                  birdType: prescription.birdType || targetAppt.birdType || '',
                  flockSize: prescription.flockSize || targetAppt.flockSize || '',
                  age: prescription.age || targetAppt.age || '',
                  concern: prescription.historyNotes || prescription.diagnosis || targetAppt.concern || 'Clinical Telemedicine Consultation',
                  shedSummary: targetAppt.shedSummary || '',
                  aiDiagnosisSummary: targetAppt.aiDiagnosisSummary || '',
                  linkedDiagnoses: targetAppt.linkedDiagnoses || [],
                  attachedPrescriptions: targetAppt.attachedPrescriptions || [],
                  uploadedAttachments: targetAppt.uploadedAttachments || [],
                }
              })()}
              onEndCall={handleEndCall}
            />
            <div className="pmx-unified-connection-banner">
              <Icon name="stethoscope" size={14} />
              <span>{t('rxUnifiedWorkspaceBanner')}</span>
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
                <Field label={t('registrationNumber')}><input value={prescription.registrationNumber} onChange={(event) => { updatePrescription('registrationNumber', event.target.value); updatePrescription('bvcRegNo', event.target.value) }} placeholder={t('registrationId')} /></Field>
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
              <Field label={t('rxHistoryLabel')}>
                <textarea rows="2" value={prescription.historyNotes} onChange={(event) => updatePrescription('historyNotes', event.target.value)} placeholder={t('rxHistoryPlaceholder')} />
              </Field>
              <Field label={t('rxClinicalSignsLabel')}>
                <textarea rows="2" value={prescription.clinicalSigns} onChange={(event) => updatePrescription('clinicalSigns', event.target.value)} placeholder={t('rxClinicalSignsPlaceholder')} />
              </Field>
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
                    <legend>
                      {t('medicineNumber', { number: index + 1 })}
                      {medication.company ? ` · ${medication.company}` : ''}
                      {medication.approxMrpBdt ? ` · ${medication.approxMrpBdt}` : ''}
                    </legend>
                    {medications.length > 1 && <button className="telemedicine-remove-button" type="button" aria-label={`${t('remove')} ${index + 1}`} onClick={() => setMedications((current) => current.filter(({ id }) => id !== medication.id))}><Icon name="remove" size={16} />{t('remove')}</button>}
                    <div className="telemedicine-fields-grid">
                      <Field label={t('rxSelectFromFormulary')} className="telemedicine-field--wide">
                        <select
                          value={medication.masterKey || ''}
                          onChange={(event) => applyMasterMedicineToRow(medication.id, event.target.value)}
                        >
                          <option value="">{t('rxFormularyPlaceholder')}</option>
                          {medicineCategories.map((cat) => (
                            <optgroup key={cat.id} label={language === 'bn' ? cat.categoryBn : cat.category}>
                              {cat.generics.flatMap((gen) =>
                                gen.brands.map((brand) => {
                                  const key = `${cat.id}::${gen.genericName}::${brand.tradeName}`
                                  return (
                                    <option key={key} value={key}>
                                      {brand.tradeName} ({gen.genericName}) — {brand.company} · {brand.approxMrpBdt}
                                    </option>
                                  )
                                })
                              )}
                            </optgroup>
                          ))}
                        </select>
                      </Field>
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
                <div className="prescription-pad-vet"><strong>{formatVetHeaderDisplay(prescription.vetName, prescription.vetDegrees) || t('rxVetDefault')}</strong><span>{prescription.registrationNumber ? `${t('rxRegPrefix')} ${prescription.registrationNumber}` : t('rxRegDefault')}</span></div>
              </header>
              <div className="prescription-pad-rule" />
              <div className="prescription-preview-title"><span>{t('rxTitleUpper')}</span><time>{new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : undefined)}</time></div>
              <div className="prescription-info-grid">
                <div><span>{t('rxFarmerUpper')}</span><strong>{prescription.farmerName || '—'}</strong></div>
                <div><span>{t('rxFarmDistrictUpper')}</span><strong>{[prescription.farmName, prescription.upazila, prescription.district ? t(`districts.${prescription.district}`, prescription.district) : ''].filter(Boolean).join(' · ') || '—'}</strong></div>
                <div><span>{t('rxBirdTypeUpper')}</span><strong>{t(`birdTypes.${prescription.birdType}`, prescription.birdType)}</strong></div>
                <div><span>{t('rxAgeUpper')}</span><strong>{prescription.age || '—'}</strong></div>
                <div><span>{t('rxFlockSizeUpper')}</span><strong>{prescription.flockSize || '—'}</strong></div>
                <div><span>{t('rxAvgWeightUpper')}</span><strong>{prescription.averageWeight ? `${prescription.averageWeight} ${t('kg')}` : '—'}</strong></div>
              </div>
              <section className="prescription-preview-block">
                <h3>{t('rxComplaintsHeading')}</h3>
                <p>{[prescription.historyNotes, ...prescription.complaints].filter((v, idx, arr) => v && arr.indexOf(v) === idx).join(' · ') || t('rxNoSymptoms')}</p>
              </section>
              {prescription.clinicalSigns && (
                <section className="prescription-preview-block">
                  <h3>{t('rxClinicalSignsLabel')}</h3>
                  <p>{prescription.clinicalSigns}</p>
                </section>
              )}
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
              {t('rxSendSaveToLog')}
            </button>
            <p className="telemedicine-preview-note">{t('rxSyncNote')}</p>
          </aside>
        </div>
      </section>}

      {detailsModalDoctor && (
        <DoctorDetailsModal
          doctor={detailsModalDoctor}
          initialDate={booking.date}
          initialTime={booking.vetId === detailsModalDoctor.id ? booking.time : ''}
          slotVersion={slotVersion}
          onSelectSlotAndContinue={({ doctorId, date, time }) => {
            setBooking((current) => ({ ...current, vetId: doctorId, date, time }))
            setSlotError('')
            setDetailsModalDoctorId('')
          }}
          onClose={() => setDetailsModalDoctorId('')}
        />
      )}

      {checkoutOpen && (
        <PaymentCheckoutModal
          booking={checkoutBooking || resolveBookingPayloadWithTarget(booking)}
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
        />
      )}
    </main>
  )
}
