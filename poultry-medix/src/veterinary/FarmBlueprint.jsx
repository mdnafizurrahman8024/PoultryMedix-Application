import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  Calculator,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  ExternalLink,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react'
import { useLanguage } from '../context/useLanguage.js'
import { useUser } from '../context/user-context.js'
import {
  BIOSECURITY_DISTANCES,
  BIOSECURITY_ZONES,
  DAM_COST_DEFAULTS,
  DLS_REGISTRATION_CHECKLIST,
  GRADE_A_CHICK_CHECKLIST,
  UPCOMING_MENTORSHIP_WORKSHOPS,
  calculateFcrAndBreakEven,
} from '../lib/farmBlueprintData.js'
import {
  ANALYTICS_UPDATED_EVENT,
  getLiveOutbreakDistricts,
} from '../lib/analyticsEngine.js'
import {
  CLINICAL_LOGS_UPDATED_EVENT,
  saveConsultationLog,
  savePaymentLog,
} from '../lib/clinicalLogsStore.js'
import { saveHistoryEntry } from './historyStore.js'
import { SURVEILLANCE_DISTRICTS, getDiseaseDisplayLabel } from '../lib/oneHealthSurveillance.js'
import { DLS_PORTAL_URL, requestTelemedicineReferral, requestUloDirectoryModal } from '../lib/uloDirectory.js'
import { consumePendingCheckoutContext, pollGatewayPaymentSession } from '../lib/paymentAdapter.js'
import ShedBlueprintVisualizer from './ShedBlueprintVisualizer.jsx'
import PaymentCheckoutModal from './PaymentCheckoutModal.jsx'
import DigitalReceiptModal from './DigitalReceiptModal.jsx'
import LiveMediaStage from './LiveMediaStage.jsx'
import LiveQaHandRaisePanel from './LiveQaHandRaisePanel.jsx'

function BiosecurityRadarSvg({ isBn, hasAlert }) {
  return (
    <figure className="blueprint-svg-card dark:bg-gray-900 dark:border-gray-700" style={{ margin: 0 }}>
      <figcaption className="blueprint-svg-caption dark:text-gray-200">
        <span>{isBn ? 'জৈব-নিরাপত্তা দূরত্ব ও জোন রাডার' : 'FAO / WOAH Separation & Zone Radar'}</span>
        <strong>{isBn ? 'লাল · হলুদ · সবুজ জোন' : 'Red · Amber · Green Zones'}</strong>
      </figcaption>

      <svg
        viewBox="0 0 360 330"
        className="blueprint-svg-canvas"
        role="img"
        aria-label={isBn ? 'জৈব-নিরাপত্তা দূরত্ব ও জোন রাডার' : 'Biosecurity separation distance radar'}
      >
        {/* Concentric Zones */}
        {/* Outer 2.0-3.0 km Hatchery/Breeder separation */}
        <circle cx="180" cy="162" r="144" fill="rgba(248, 250, 252, 0.7)" stroke="#64748b" strokeWidth="1.2" strokeDasharray="5 4" />
        {/* 1.0 km Broiler-Layer buffer */}
        <circle cx="180" cy="162" r="112" fill="rgba(254, 242, 242, 0.45)" stroke="#dc2626" strokeWidth="1.2" strokeDasharray="4 3" />
        {/* 0.5 km Poultry Farm buffer / Red Public Perimeter */}
        <circle cx="180" cy="162" r="80" fill="rgba(254, 226, 226, 0.72)" stroke="#b91c1c" strokeWidth="1.8" />
        {/* Amber Transition Buffer */}
        <circle cx="180" cy="162" r="52" fill="rgba(254, 243, 199, 0.9)" stroke="#d97706" strokeWidth="1.8" />
        {/* Green Production Core (Shed) */}
        <circle cx="180" cy="162" r="26" fill={hasAlert ? '#dcfce7' : '#bbf7d0'} stroke="#15803d" strokeWidth="2.5" />

        {/* Radar crosshairs */}
        <line x1="36" y1="162" x2="324" y2="162" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2 3" />
        <line x1="180" y1="18" x2="180" y2="306" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2 3" />

        {/* Core & Ring Labels */}
        <text x="180" y="159" textAnchor="middle" fontSize="9" fontWeight="800" fill="#14532d">
          {isBn ? 'শেড' : 'GREEN'}
        </text>
        <text x="180" y="170" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#166534">
          {isBn ? 'সবুজ' : 'SHED'}
        </text>

        <text x="180" y="121" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#92400e">
          {isBn ? 'হলুদ: বাফার জোন' : 'AMBER · Transition'}
        </text>
        <text x="180" y="95" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#991b1b">
          {isBn ? 'লাল: গেট ≥ ১০০-২০০ মি.' : 'RED · Gate ≥100–200m'}
        </text>
        <text x="180" y="63" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#b91c1c">
          {isBn ? '≥ ০.৫ কি.মি. (অন্য খামার) · ≥ ১.০ কি.মি. (ব্রয়লার-লেয়ার)' : '≥ 0.5 km Poultry Farm · ≥ 1.0 km Broiler-Layer'}
        </text>
        <text x="180" y="29" textAnchor="middle" fontSize="9" fontWeight="800" fill="#334155">
          {isBn ? '≥ ২.০–৩.০ কি.মি. (ব্রিডার ও হ্যাচারি)' : '≥ 2.0 – 3.0 km (Breeder & Hatchery)'}
        </text>

        {/* Legend at bottom */}
        <g transform="translate(26, 316)">
          <circle cx="8" cy="-3" r="4" fill="#15803d" />
          <text x="16" y="0" fontSize="8.5" fontWeight="700" fill="#166534">{isBn ? 'সবুজ (নিরাপদ)' : 'Green Core'}</text>
          <circle cx="114" cy="-3" r="4" fill="#d97706" />
          <text x="122" y="0" fontSize="8.5" fontWeight="700" fill="#92400e">{isBn ? 'হলুদ (স্যানিটেশন)' : 'Amber Buffer'}</text>
          <circle cx="222" cy="-3" r="4" fill="#b91c1c" />
          <text x="230" y="0" fontSize="8.5" fontWeight="700" fill="#991b1b">{isBn ? 'লাল (সীমানা গেট)' : 'Red Gate'}</text>
        </g>
      </svg>
    </figure>
  )
}

export default function FarmBlueprint() {
  const { language, t } = useLanguage()
  const isBn = language === 'bn'

  // Section 1 state
  const [flockSize, setFlockSize] = useState(1000)
  const [farmType, setFarmType] = useState('Broiler')

  // Section 2 Live Neighborhood Risk Check state
  const [selectedDistrict, setSelectedDistrict] = useState('Rajshahi')
  const [outbreakDistricts, setOutbreakDistricts] = useState(() => getLiveOutbreakDistricts())

  useEffect(() => {
    function syncOutbreaks() {
      setOutbreakDistricts(getLiveOutbreakDistricts())
    }
    window.addEventListener(ANALYTICS_UPDATED_EVENT, syncOutbreaks)
    window.addEventListener(CLINICAL_LOGS_UPDATED_EVENT, syncOutbreaks)
    window.addEventListener('storage', syncOutbreaks)
    return () => {
      window.removeEventListener(ANALYTICS_UPDATED_EVENT, syncOutbreaks)
      window.removeEventListener(CLINICAL_LOGS_UPDATED_EVENT, syncOutbreaks)
      window.removeEventListener('storage', syncOutbreaks)
    }
  }, [])

  const availableDistricts = useMemo(() => {
    const names = new Set([...SURVEILLANCE_DISTRICTS, ...outbreakDistricts.map((d) => d.name)])
    return Array.from(names)
  }, [outbreakDistricts])

  const districtRisk = useMemo(
    () => outbreakDistricts.find((d) => d.name.toLowerCase() === selectedDistrict.toLowerCase()) || null,
    [outbreakDistricts, selectedDistrict]
  )

  // Section 3 Editable FCR & Break-Even Estimator (strictly cash basis — zero loans/interest)
  const [costInputs, setCostInputs] = useState(() => ({ ...DAM_COST_DEFAULTS.Broiler }))

  function handleFarmTypeChange(nextType) {
    setFarmType(nextType)
    const preset = DAM_COST_DEFAULTS[nextType] || DAM_COST_DEFAULTS.Broiler
    setCostInputs({ ...preset })
  }

  function updateCostField(field, value) {
    setCostInputs((prev) => ({ ...prev, [field]: value }))
  }

  function resetDamDefaults() {
    const preset = DAM_COST_DEFAULTS[farmType] || DAM_COST_DEFAULTS.Broiler
    setCostInputs({ ...preset })
  }

  const costEstimate = useMemo(
    () => calculateFcrAndBreakEven({ flockSize, ...costInputs }),
    [flockSize, costInputs]
  )

  // Interactive Grade-A Chick & DLS Checklists
  const [checkedChicks, setCheckedChicks] = useState(() => new Set(['hatchery-dls']))
  const [checkedDocs, setCheckedDocs] = useState(() => new Set(['nid-photo']))

  function toggleChecklistItem(setter, id) {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Section 4 Pro Mentorship Workshop Booking State
  const [workshops, setWorkshops] = useState(() => UPCOMING_MENTORSHIP_WORKSHOPS)
  const [activeWorkshopId, setActiveWorkshopId] = useState('')
  const [reservedWorkshopIds, setReservedWorkshopIds] = useState(() => new Set())
  const [bookingForm, setBookingForm] = useState({
    name: '',
    contact: '',
    district: 'Rajshahi',
    question: '',
    payment: 'bkash',
  })
  const [bookingConfirmation, setBookingConfirmation] = useState('')
  const [workshopCheckoutOpen, setWorkshopCheckoutOpen] = useState(false)
  const [workshopReceipt, setWorkshopReceipt] = useState(null)
  const [workshopReceiptOpen, setWorkshopReceiptOpen] = useState(false)
  const [liveWorkshopId, setLiveWorkshopId] = useState('')
  const { role } = useUser()

  const activeLiveWorkshop = useMemo(
    () => workshops.find((ws) => ws.id === liveWorkshopId) || null,
    [workshops, liveWorkshopId]
  )

  const activeWorkshop = useMemo(
    () => workshops.find((ws) => ws.id === activeWorkshopId) || null,
    [workshops, activeWorkshopId]
  )

  function finalizeWorkshopBooking(receipt, workshopObj) {
    if (!receipt || !workshopObj) return
    const workshopTitle = isBn ? workshopObj.titleBn : workshopObj.titleEn
    const recordId = receipt.id || crypto.randomUUID()

    savePaymentLog({
      ...receipt,
      id: recordId,
      concern: `[Workshop Seat] ${workshopTitle}`,
      status: 'Completed',
    })

    saveConsultationLog({
      id: `consult-${recordId}`,
      trxId: receipt.trxId,
      roomCode: receipt.roomCode,
      roomId: receipt.roomCode,
      vetName: workshopObj.vetName,
      doctorName: workshopObj.vetName,
      bvcRegNo: workshopObj.bvcRegNo,
      clinicDetails: `${workshopObj.clinicDetails} — Pro Mentorship Workshop`,
      farmerName: receipt.farmerName,
      farmName: `${farmType} (${flockSize} ${isBn ? 'টি' : 'birds'})`,
      district: receipt.district || 'Rajshahi',
      bookingDate: workshopObj.scheduleDate,
      bookingTime: workshopObj.scheduleTime,
      concern: receipt.concern,
      amount: receipt.amount,
      currency: 'BDT',
      paymentMethod: receipt.method,
      paymentMethodLabel: receipt.paymentMethodLabel,
      paymentStatus: 'Completed',
    })

    saveHistoryEntry('appointment', {
      id: `consult-${recordId}`,
      trxId: receipt.trxId,
      roomCode: receipt.roomCode,
      createdAt: receipt.timestamp,
      date: workshopObj.scheduleDate,
      time: workshopObj.scheduleTime,
      vetName: workshopObj.vetName,
      bvcRegNo: workshopObj.bvcRegNo,
      clinicDetails: `${workshopObj.clinicDetails} — Pro Workshop`,
      farmerName: receipt.farmerName,
      farmName: `${farmType} (${flockSize} birds)`,
      district: receipt.district || 'Rajshahi',
      concern: receipt.concern,
      amount: receipt.amount,
      currency: 'BDT',
      paymentMethod: receipt.method,
      paymentMethodLabel: receipt.paymentMethodLabel,
      paymentStatusKey: 'historyBookingConfirmed',
    })

    setReservedWorkshopIds((prev) => new Set(prev).add(workshopObj.id))
    setWorkshops((prev) => prev.map((ws) => (
      ws.id === workshopObj.id ? { ...ws, seatsLeft: Math.max(0, ws.seatsLeft - 1) } : ws
    )))
    setBookingConfirmation(
      isBn
        ? `পেমেন্ট যাচাই ও আসন নিশ্চিত (${receipt.trxId})! ${workshopObj.vetName}-এর কর্মশালা (${workshopObj.displayTimeBn}) ডিজিটাল স্লিপসহ সংরক্ষিত হয়েছে।`
        : `Payment verified (${receipt.trxId}) & seat reserved for "${workshopTitle}" with ${workshopObj.vetName}. Digital payment slip issued.`
    )
    setWorkshopCheckoutOpen(false)
    setActiveWorkshopId('')
    setBookingForm((prev) => ({ ...prev, question: '' }))
    setWorkshopReceipt(receipt)
    setWorkshopReceiptOpen(true)
  }

  function handleReserveWorkshop(event) {
    event.preventDefault()
    if (!activeWorkshop) return
    setWorkshopCheckoutOpen(true)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const returnedSessionId = url.searchParams.get('pmx_session')
    if (!returnedSessionId) return
    const pending = consumePendingCheckoutContext()
    if (pending?.returnView !== 'blueprint') return
    url.searchParams.delete('pmx_session')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)

    pollGatewayPaymentSession({
      sessionId: returnedSessionId,
      isLocalFallback: Boolean(pending?.isLocalFallback),
    }).then((poll) => {
      if (poll.ok && poll.status === 'COMPLETED' && poll.receipt) {
        const matchedWs = workshops.find((ws) => ws.id === pending.workshopId) || workshops[0]
        if (matchedWs) {
          savePaymentLog({ ...poll.receipt, status: 'Completed' })
          setWorkshopReceipt(poll.receipt)
          setWorkshopReceiptOpen(true)
        }
      }
    })
  }, [workshops])

  return (
    <main className="veterinary-page blueprint-page w-full min-w-0 max-w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <section className="veterinary-page-heading">
        <span className="veterinary-kicker">{t('farmBlueprintKicker')}</span>
        <h1>{t('farmBlueprintTitle')}</h1>
        <p>{t('farmBlueprintSubtitle')}</p>
      </section>

      {/* SECTION 1: Interactive 2D Floor Plan & 3D Isometric Shed Visualizer */}
      <ShedBlueprintVisualizer
        flockSize={flockSize}
        onFlockSizeChange={setFlockSize}
        farmType={farmType}
        onFarmTypeChange={handleFarmTypeChange}
        isBn={isBn}
      />

      {/* SECTION 2: Biosecurity Distance Radar & Live Neighborhood Risk Check */}
      <section className="blueprint-card dark:bg-gray-800 dark:border-gray-700" aria-labelledby="biosecurity-radar-heading">
        <div className="blueprint-section-head">
          <div>
            <span className="veterinary-kicker">
              {isBn ? '২ · FAO ও WOAH বায়োসিকিউরিটি রাডার ও ঝুঁকি যাচাই' : '2 · BIOSECURITY DISTANCE RADAR & NEIGHBORHOOD RISK CHECK'}
            </span>
            <h2 id="biosecurity-radar-heading">
              {isBn ? 'বাধ্যতামূলক খামার দূরত্ব ও রিয়েল-টাইম জেলা ঝুঁকি যাচাই' : 'Mandatory Separation Radar & Live Neighborhood Outbreak Check'}
            </h2>
            <p>
              {isBn
                ? 'খামারের জায়গা নির্বাচনের আগে পাশের খামার, হ্যাচারি ও রাস্তার দূরত্ব এবং জেলার বর্তমান রোগের পরিস্থিতি যাচাই করুন।'
                : 'Verify FAO/WOAH site separation rules, Red/Amber/Green farm zones, and live One-Health disease alerts in your district before building.'}
            </p>
          </div>
        </div>

        <div className="blueprint-radar-layout">
          <div className="blueprint-radar-left">
            <BiosecurityRadarSvg isBn={isBn} hasAlert={Boolean(districtRisk?.isZoonotic)} />

            {/* Live Neighborhood Risk Scanner */}
            <div className="blueprint-risk-scanner dark:bg-gray-900/70 dark:border-gray-700">
              <div className="blueprint-risk-scanner-head">
                <label className="surveillance-field" style={{ flex: '1 1 200px' }}>
                  <span>{isBn ? 'আপনার প্রস্তাবিত খামারের জেলা নির্বাচন করুন' : 'Select Your Proposed Farm District'}</span>
                  <select value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)}>
                    {availableDistricts.map((dist) => (
                      <option key={dist} value={dist}>
                        {t(`districts.${dist}`, dist)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {districtRisk ? (
                <div className={`blueprint-risk-result${districtRisk.isZoonotic ? ' is-danger' : ' is-caution'} dark:bg-gray-800`}>
                  <div className="blueprint-risk-top">
                    <strong>
                      <ShieldAlert size={16} aria-hidden="true" />
                      <span>
                        {t(`districts.${districtRisk.name}`, districtRisk.name)}:{' '}
                        {districtRisk.farms} {t('affectedFarms')} ({t(`severity.${districtRisk.severity}`, districtRisk.severity)})
                      </span>
                    </strong>
                    {districtRisk.isZoonotic && (
                      <span className="zoonotic-risk-badge is-compact">
                        <AlertTriangle size={11} aria-hidden="true" />
                        <span>{t('zoonoticRiskShort')}</span>
                      </span>
                    )}
                  </div>
                  <p>
                    {isBn ? 'সক্রিয় প্রধান রোগসমূহ: ' : 'Circulating diseases nearby: '}
                    <strong>
                      {districtRisk.topDiseases
                        .slice(0, 3)
                        .map((d) => `${getDiseaseDisplayLabel(d.disease, language, t)} (${d.count})`)
                        .join(', ')}
                    </strong>
                  </p>
                  <p className="blueprint-risk-advice">
                    {districtRisk.isZoonotic
                      ? (isBn
                          ? 'উচ্চ সতর্কতা: এই জেলায় জুনোটিক রোগ শনাক্ত আছে। নতুন শেড অন্তত ১–২ কি.মি. দূরত্বে স্থাপন করুন, বন্যপাখি-রোধী জাল ও প্রবেশপথে ফুটবাথ বাধ্যতামূলক করুন এবং সরকারি ULO কর্মকর্তার সাইট ভিজিট নিন।'
                          : 'Heightened Warning: Zoonotic pathogens active nearby. Enforce >=1.0–2.0 km farm isolation, closed wild-bird netting, perimeter vehicle dips, and ULO site clearance before placement.')
                      : (isBn
                          ? 'মাঝারি/উচ্চ সতর্কতা: আশেপাশের খামার থেকে কমপক্ষে ০.৫–১.০ কি.মি. দূরত্ব বজায় রাখুন এবং ১ম দিন থেকে নিয়মিত ভ্যাকসিন ও জীবাণুনাশক মেনে চলুন।'
                          : 'Neighborhood Alert: Maintain full >=0.5–1.0 km farm separation and strict biosecurity zoning from Day 1.')}
                  </p>
                  <button
                    type="button"
                    className="blueprint-ulo-link-btn"
                    onClick={() => requestUloDirectoryModal({ district: selectedDistrict })}
                  >
                    <Building2 size={14} aria-hidden="true" />
                    <span>{isBn ? 'জেলা সরকারি ULO অফিস দেখুন' : 'Check Govt. ULO Office'}</span>
                  </button>
                </div>
              ) : (
                <div className="blueprint-risk-result is-clear dark:bg-gray-800">
                  <strong>
                    <ShieldCheck size={16} aria-hidden="true" />
                    <span>
                      {t(`districts.${selectedDistrict}`, selectedDistrict)}:{' '}
                      {isBn ? 'সাম্প্রতিক বড় প্রাদুর্ভাব রিপোর্ট নেই' : 'No Active Outbreak Cluster Logged'}
                    </span>
                  </strong>
                  <p>
                    {isBn
                      ? 'বর্তমানে বড় প্রাদুর্ভাব না থাকলেও FAO ও WOAH অনুযায়ী ০.৫–৩.০ কি.মি. নিরাপদ দূরত্ব বজায় রেখে শেড নির্মাণ করুন।'
                      : 'No active epidemic clusters recorded here right now. Continue observing all mandatory 0.5–3.0 km FAO/WOAH site buffers.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="blueprint-radar-right">
            <h3 className="blueprint-subheading">
              {isBn ? 'বাধ্যতামূলক দূরত্ব বিধি (সূত্র: FAO ও WOAH)' : 'Mandatory Separation Rules (Source: FAO & WOAH)'}
            </h3>
            <div className="blueprint-distance-list">
              {BIOSECURITY_DISTANCES.map((rule) => (
                <article key={rule.id} className="blueprint-distance-card dark:bg-gray-900/60 dark:border-gray-700">
                  <span className="blueprint-distance-pill">{isBn ? rule.metricBn : rule.metric}</span>
                  <strong>{isBn ? rule.titleBn : rule.titleEn}</strong>
                  <p>{isBn ? rule.detailBn : rule.detailEn}</p>
                </article>
              ))}
            </div>

            <h3 className="blueprint-subheading" style={{ marginTop: '14px' }}>
              {isBn ? 'খামারের ৩ স্তরের জৈব-নিরাপত্তা জোন' : '3-Tier Farm Biosecurity Zones'}
            </h3>
            <div className="blueprint-zone-list">
              {BIOSECURITY_ZONES.map((zone) => (
                <article
                  key={zone.id}
                  className="blueprint-zone-card dark:bg-gray-900/60"
                  style={{ borderLeft: `4px solid ${zone.color}` }}
                >
                  <strong style={{ color: zone.color }}>{isBn ? zone.nameBn : zone.nameEn}</strong>
                  <p>{isBn ? zone.detailBn : zone.detailEn}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Custom FCR & Break-Even Estimator + Checklists */}
      <section className="blueprint-card dark:bg-gray-800 dark:border-gray-700" aria-labelledby="fcr-breakeven-heading">
        <div className="blueprint-section-head">
          <div>
            <span className="veterinary-kicker">
              {isBn ? '৩ · নগদ উৎপাদন খরচ, FCR হিসাব ও বাচ্চা যাচাই' : '3 · CUSTOM FCR & BREAK-EVEN ESTIMATOR · GRADE-A CHECKLISTS'}
            </span>
            <h2 id="fcr-breakeven-heading">
              {isBn ? 'কাস্টম FCR, ব্রেক-ইভেন খরচ ও গ্রেড-এ বাচ্চা যাচাই' : 'Editable FCR & Break-Even Calculator + Chick & DLS Verification'}
            </h2>
            <p>
              {isBn
                ? 'তথ্যসূত্র: কৃষি বিপণন অধিদপ্তর (DAM বাংলাদেশ)-এর গড় রেফারেন্স। আপনার এলাকার বর্তমান বাচ্চা ও ফিডের দাম অনুযায়ী মান পরিবর্তন করুন (সুদ বা ব্যাংক ঋণমুক্ত নিজস্ব পুঁজির হিসাব)।'
                : 'Pre-filled with reference averages from the Department of Agricultural Marketing (DAM Bangladesh) — edit freely for local chick & feed prices. Cash-capital basis only.'}
            </p>
          </div>

          <button type="button" className="blueprint-reset-btn" onClick={resetDamDefaults}>
            <RotateCcw size={14} aria-hidden="true" />
            <span>{isBn ? 'DAM রেফারেন্স রিসেট' : 'Reset DAM Defaults'}</span>
          </button>
        </div>

        <div className="blueprint-cost-layout">
          {/* Editable Inputs */}
          <div className="blueprint-cost-inputs dark:bg-gray-900/60 dark:border-gray-700">
            <div className="blueprint-inputs-grid">
              <label className="surveillance-field">
                <span>{isBn ? `লক্ষ্যমাত্রা FCR (${DAM_COST_DEFAULTS[farmType]?.cycleDays || '32-35'} দিন)` : `Target FCR (${DAM_COST_DEFAULTS[farmType]?.cycleDays || '32-35'} days)`}</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.8"
                  max="5"
                  value={costInputs.fcr}
                  onChange={(e) => updateCostField('fcr', Number(e.target.value))}
                />
              </label>

              <label className="surveillance-field">
                <span>{isBn ? 'গড় বিক্রয় ওজন (কেজি/পাখি)' : 'Target Harvest Weight (kg/bird)'}</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.3"
                  max="5"
                  value={costInputs.targetWeightKg}
                  onChange={(e) => updateCostField('targetWeightKg', Number(e.target.value))}
                />
              </label>

              <label className="surveillance-field">
                <span>{isBn ? 'একদিনের বাচ্চার দাম (৳/বাচ্চা)' : 'Day-Old Chick Price (BDT/bird)'}</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={costInputs.docPriceBdt}
                  onChange={(e) => updateCostField('docPriceBdt', Number(e.target.value))}
                />
              </label>

              <label className="surveillance-field">
                <span>{isBn ? 'ফিড প্রতি ৫০ কেজি বস্তা (৳)' : 'Feed Price per 50 kg Bag (BDT)'}</span>
                <input
                  type="number"
                  step="25"
                  min="0"
                  value={costInputs.feedBagPriceBdt}
                  onChange={(e) => updateCostField('feedBagPriceBdt', Number(e.target.value))}
                />
              </label>

              <label className="surveillance-field">
                <span>{isBn ? 'টিকা, ওষুধ, লিটার ও বিদ্যুৎ (৳/পাখি)' : 'Vaccine, Vet, Litter & Utility (BDT/bird)'}</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={costInputs.miscPerBirdBdt}
                  onChange={(e) => updateCostField('miscPerBirdBdt', Number(e.target.value))}
                />
              </label>

              <label className="surveillance-field">
                <span>{isBn ? 'সুরক্ষা হার (% বেঁচে থাকা)' : 'Expected Survival Rate (%)'}</span>
                <input
                  type="number"
                  step="0.5"
                  min="70"
                  max="100"
                  value={costInputs.survivalPct}
                  onChange={(e) => updateCostField('survivalPct', Number(e.target.value))}
                />
              </label>

              <label className="surveillance-field" style={{ gridColumn: '1 / -1' }}>
                <span>{isBn ? 'সম্ভাব্য স্থানীয় বাজার দর (৳/কেজি লাইভ ওজন)' : 'Reference Local Market Sale Price (BDT/kg live weight)'}</span>
                <input
                  type="number"
                  step="2"
                  min="0"
                  value={costInputs.marketSaleBdtPerKg}
                  onChange={(e) => updateCostField('marketSaleBdtPerKg', Number(e.target.value))}
                />
              </label>
            </div>
          </div>

          {/* Calculated Outputs */}
          <div className="blueprint-cost-outputs dark:bg-gray-900/60 dark:border-gray-700">
            <div className="blueprint-cost-highlight">
              <div>
                <span>{isBn ? 'নিরাপদ ব্রেক-ইভেন উৎপাদন খরচ' : 'Safe Break-Even Production Cost'}</span>
                <strong>৳ {costEstimate.breakEvenCostPerKg} <small>/ kg</small></strong>
              </div>
              <div>
                <span>{isBn ? 'মোট প্রয়োজনীয় ৫০ কেজি ফিডের বস্তা' : 'Total 50 kg Feed Bags Needed'}</span>
                <strong>{costEstimate.feedBagsRounded} <small>{isBn ? 'বস্তা' : 'bags'}</small></strong>
                <small style={{ display: 'block', fontSize: '11px', color: '#475569' }}>
                  ({costEstimate.totalFeedKg.toLocaleString()} kg · {costEstimate.survivingBirds.toLocaleString()} {isBn ? 'জীবিত পাখি' : 'marketable birds'})
                </small>
              </div>
            </div>

            <div className="blueprint-cost-breakdown">
              <div>
                <span>{isBn ? `বাচ্চা বাবদ খরচ (${flockSize}টি)` : `Day-Old Chicks (${flockSize} birds)`}</span>
                <strong>৳ {costEstimate.totalChickCost.toLocaleString()}</strong>
              </div>
              <div>
                <span>{isBn ? `মোট ফিড খরচ (${costEstimate.feedBagsExact} বস্তা)` : `Feed Cost (${costEstimate.feedBagsExact} bags)`}</span>
                <strong>৳ {costEstimate.totalFeedCost.toLocaleString()}</strong>
              </div>
              <div>
                <span>{isBn ? 'ভ্যাকসিন, ভেট ও পরিচালনা ব্যয়' : 'Vaccine, Biosecurity & Utilities'}</span>
                <strong>৳ {costEstimate.totalMiscCost.toLocaleString()}</strong>
              </div>
              <div className="is-total">
                <span>{isBn ? 'মোট নগদ ব্যাচ মূলধন প্রয়োজন' : 'Total Cash Batch Capital Required'}</span>
                <strong>৳ {costEstimate.totalProductionCost.toLocaleString()}</strong>
              </div>
              <div className={costEstimate.estimatedMargin >= 0 ? 'is-margin-pos' : 'is-margin-neg'}>
                <span>
                  <Calculator size={13} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
                  {isBn
                    ? `৳ ${costInputs.marketSaleBdtPerKg}/কেজি দরে সম্ভাব্য নিট মার্জিন`
                    : `Est. Cash Batch Margin @ ৳${costInputs.marketSaleBdtPerKg}/kg`}
                </span>
                <strong>
                  {costEstimate.estimatedMargin >= 0 ? '+' : ''}৳ {costEstimate.estimatedMargin.toLocaleString()}
                </strong>
              </div>
            </div>

            {farmType === 'Layer' && (
              <p className="blueprint-layer-note">
                {isBn
                  ? 'নোট: লেয়ার মুরগির উপরের হিসাবটি ডিম পাড়ার আগ পর্যন্ত (১৮ সপ্তাহ পুলেট) গ্রোয়ার ব্যয়; মূল আয় ৭২ সপ্তাহব্যাপী ডিম উৎপাদন থেকে আসে।'
                  : 'Note: For Layer flocks, the figure above reflects point-of-lay pullet rearing cost (up to Week 18); primary returns come from 280–310 eggs/hen across 72 weeks.'}
              </p>
            )}
          </div>
        </div>

        {/* Grade-A Chick & DLS Registration Interactive Checklists */}
        <div className="blueprint-checklists-grid">
          <div className="blueprint-checklist-panel dark:bg-gray-900/60 dark:border-gray-700">
            <div className="blueprint-checklist-head">
              <h3>
                <CheckCircle2 size={16} aria-hidden="true" className="text-emerald-700 dark:text-emerald-400" />
                <span>{isBn ? 'গ্রেড-এ বাচ্চা (DOC) ও DLS হ্যাচারি যাচাই তালিকা' : 'Grade-A Chick (DOC) & DLS Hatchery Verification Checklist'}</span>
              </h3>
              <span className="blueprint-progress-pill">
                {checkedChicks.size} / {GRADE_A_CHICK_CHECKLIST.length}
              </span>
            </div>

            <div className="blueprint-checklist-items">
              {GRADE_A_CHICK_CHECKLIST.map((item) => {
                const checked = checkedChicks.has(item.id)
                return (
                  <label key={item.id} className={`blueprint-check-item${checked ? ' is-checked' : ''} dark:border-gray-700`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleChecklistItem(setCheckedChicks, item.id)}
                    />
                    <div>
                      <strong>{isBn ? item.titleBn : item.titleEn}</strong>
                      <p>{isBn ? item.detailBn : item.detailEn}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="blueprint-checklist-panel dark:bg-gray-900/60 dark:border-gray-700">
            <div className="blueprint-checklist-head">
              <h3>
                <ClipboardCheck size={16} aria-hidden="true" className="text-emerald-700 dark:text-emerald-400" />
                <span>{isBn ? 'বাংলাদেশ DLS খামার নিবন্ধনের প্রয়োজনীয় কাগজপত্র' : 'DLS Farm Registration Document Checklist'}</span>
              </h3>
              <span className="blueprint-progress-pill">
                {checkedDocs.size} / {DLS_REGISTRATION_CHECKLIST.length}
              </span>
            </div>

            <div className="blueprint-checklist-items">
              {DLS_REGISTRATION_CHECKLIST.map((item) => {
                const checked = checkedDocs.has(item.id)
                return (
                  <label key={item.id} className={`blueprint-check-item${checked ? ' is-checked' : ''} dark:border-gray-700`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleChecklistItem(setCheckedDocs, item.id)}
                    />
                    <div>
                      <strong>{isBn ? item.titleBn : item.titleEn}</strong>
                    </div>
                  </label>
                )
              })}
            </div>

            <div className="blueprint-doc-actions">
              <a className="ulo-portal-link" href={DLS_PORTAL_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={13} aria-hidden="true" />
                <span>{isBn ? 'DLS বাংলাদেশ পোর্টাল' : 'DLS Official Portal'}</span>
              </a>
              <button
                type="button"
                className="ulo-portal-link"
                onClick={() => requestUloDirectoryModal({ district: selectedDistrict })}
              >
                <Compass size={13} aria-hidden="true" />
                <span>{isBn ? 'নিকটস্থ ULO অফিস খুঁজুন' : 'Find Your ULO Office'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: Paid "Live Expert Q&A & Farm Setup Workshop (Pro)" Booking Card */}
      <section className="blueprint-card blueprint-workshop-section dark:bg-gray-800 dark:border-gray-700" aria-labelledby="pro-workshop-heading">
        <div className="blueprint-section-head">
          <div>
            <span className="veterinary-kicker">
              {isBn ? '৪ · পোল্ট্রিমেডিক্স ভেট টিম লাইভ মেন্টরশিপ' : '4 · POULTRYMEDIX VET TEAM MENTORSHIP'}
            </span>
            <h2 id="pro-workshop-heading">
              {t('proWorkshopTitle')}
            </h2>
            <p>{t('proWorkshopSubtitle')}</p>
          </div>
          <span className="blueprint-pro-badge">
            <Users size={14} aria-hidden="true" />
            <span>{isBn ? 'BVC নিবন্ধিত পশুচিকিৎসক' : 'BVC Verified Vets'}</span>
          </span>
        </div>

        {bookingConfirmation && (
          <div className="onehealth-toast" role="status">
            <span>{bookingConfirmation}</span>
            <button
              type="button"
              style={{ width: 'auto', paddingInline: '10px', fontSize: '12px', fontWeight: 700 }}
              onClick={() => requestTelemedicineReferral({
                concern: `Pro Farm Setup Workshop Follow-up (${farmType}, ${flockSize} birds)`,
                district: selectedDistrict,
              })}
            >
              {isBn ? 'টেলিমেডিসিনে যান →' : 'Open Telemedicine →'}
            </button>
          </div>
        )}

        <div className="blueprint-workshop-grid">
          {workshops.map((ws) => {
            const isReserved = reservedWorkshopIds.has(ws.id)
            const isBookingOpen = activeWorkshopId === ws.id
            return (
              <article key={ws.id} className="blueprint-workshop-card dark:bg-gray-900/70 dark:border-gray-700">
                <div className="blueprint-workshop-top">
                  <span className="blueprint-workshop-date">
                    <Calendar size={12} aria-hidden="true" />
                    <span>{isBn ? ws.displayTimeBn : ws.displayTimeEn}</span>
                  </span>
                  <span className="blueprint-workshop-fee">৳ {ws.feeBdt}</span>
                </div>

                <h3>{isBn ? ws.titleBn : ws.titleEn}</h3>
                <p className="blueprint-workshop-topics">{isBn ? ws.topicsBn : ws.topicsEn}</p>

                <div className="blueprint-workshop-host">
                  <Stethoscope size={14} aria-hidden="true" />
                  <div>
                    <strong>{ws.vetName}</strong>
                    <small>{ws.bvcRegNo} · {ws.clinicDetails}</small>
                  </div>
                </div>

                <div className="blueprint-workshop-footer">
                  <span className="blueprint-seats-left">
                    {isBn ? `খালি আসন: ${ws.seatsLeft}টি` : `${ws.seatsLeft} seats left`}
                  </span>
                  {isReserved || role === 'REGISTERED_VET' ? (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {isReserved && (
                        <span className="blueprint-reserved-badge">✓ {isBn ? 'আসন নিশ্চিত' : 'Seat Reserved'}</span>
                      )}
                      <button
                        type="button"
                        className="blueprint-reserve-btn"
                        onClick={() => setLiveWorkshopId(liveWorkshopId === ws.id ? '' : ws.id)}
                      >
                        {liveWorkshopId === ws.id
                          ? t('close')
                          : (isBn ? 'লাইভ ক্লাস ও প্রশ্নোত্তর' : 'Live Room & Q&A')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="blueprint-reserve-btn"
                      onClick={() => {
                        setActiveWorkshopId(isBookingOpen ? '' : ws.id)
                        setBookingConfirmation('')
                      }}
                    >
                      {isBookingOpen
                        ? (isBn ? 'বন্ধ করুন' : 'Cancel')
                        : (isBn ? 'আসন সংরক্ষণ করুন' : 'Reserve a Seat')}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        {/* Paid Mentorship Live Seminar Room (Hand-Raise & Live Q&A) */}
        {activeLiveWorkshop && (
          <div className="seminar-live-auditorium dark:bg-gray-900 dark:border-gray-700" style={{ marginTop: '14px' }}>
            <header className="seminar-auditorium-header">
              <div>
                <span className="seminar-live-pill">LIVE PAID WORKSHOP</span>
                <h4>{isBn ? activeLiveWorkshop.titleBn : activeLiveWorkshop.titleEn}</h4>
                <p>{activeLiveWorkshop.vetName} · {activeLiveWorkshop.bvcRegNo}</p>
              </div>
              <button
                type="button"
                className="ethical-care-btn"
                style={{ flex: '0 0 auto' }}
                onClick={() => setLiveWorkshopId('')}
              >
                {t('seminarLeaveRoomBtn')}
              </button>
            </header>
            <div className="seminar-auditorium-grid">
              <LiveMediaStage
                key={`ws-stage-${activeLiveWorkshop.id}-${role}`}
                roomId={`PMX-WS-${activeLiveWorkshop.id}`}
                userRole={role || 'FARMER'}
                displayName={bookingForm.name || (isBn ? 'নিবন্ধিত অংশগ্রহণকারী' : 'Workshop Participant')}
                remoteTitle={activeLiveWorkshop.vetName}
                remoteSubtitle={activeLiveWorkshop.clinicDetails}
                heightPx={320}
                onLeaveOrEnd={() => setLiveWorkshopId('')}
              />
              <aside className="seminar-auditorium-sidebar dark:bg-gray-900 dark:border-gray-700">
                <LiveQaHandRaisePanel
                  key={`ws-qa-${activeLiveWorkshop.id}-${role}`}
                  roomId={`PMX-WS-${activeLiveWorkshop.id}`}
                  userRole={role || 'FARMER'}
                  participantName={bookingForm.name || (isBn ? 'অংশগ্রহণকারী' : 'Participant')}
                />
              </aside>
            </div>
          </div>
        )}

        {/* Interactive Seat Reservation Form Drawer */}
        {activeWorkshop && (
          <form className="blueprint-reserve-form dark:bg-gray-900/80 dark:border-gray-700" onSubmit={handleReserveWorkshop}>
            <div className="blueprint-reserve-form-head">
              <strong>
                {isBn ? 'ওয়ার্কশপ আসন বুকিং: ' : 'Reserve Seat For: '}
                {isBn ? activeWorkshop.titleBn : activeWorkshop.titleEn} (৳ {activeWorkshop.feeBdt})
              </strong>
              <small>
                {isBn
                  ? 'প্রোটোটাইপ বুকিং — কোনো বাস্তব অর্থ কাটা হবে না; বুকিং ক্লিনিক্যাল লগে সংরক্ষিত হবে।'
                  : 'Prototype workshop booking — no real charge is collected; reservation logs to Clinical Log.'}
              </small>
            </div>

            <div className="blueprint-reserve-fields">
              <label className="surveillance-field">
                <span>{isBn ? 'উদ্যোক্তার নাম' : 'Entrepreneur Name'}</span>
                <input
                  type="text"
                  required
                  value={bookingForm.name}
                  onChange={(e) => setBookingForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder={isBn ? 'আপনার নাম লিখুন' : 'Your full name'}
                />
              </label>

              <label className="surveillance-field">
                <span>{isBn ? 'মোবাইল / ইমেইল' : 'Phone or Email'}</span>
                <input
                  type="text"
                  value={bookingForm.contact}
                  onChange={(e) => setBookingForm((p) => ({ ...p, contact: e.target.value }))}
                  placeholder="+880 1XXXXXXXXX"
                />
              </label>

              <label className="surveillance-field">
                <span>{t('rxDistrict')}</span>
                <select
                  value={bookingForm.district}
                  onChange={(e) => setBookingForm((p) => ({ ...p, district: e.target.value }))}
                >
                  {availableDistricts.map((dist) => (
                    <option key={dist} value={dist}>{t(`districts.${dist}`, dist)}</option>
                  ))}
                </select>
              </label>

              <label className="surveillance-field">
                <span>{t('mockPaymentMethod')}</span>
                <select
                  value={bookingForm.payment}
                  onChange={(e) => setBookingForm((p) => ({ ...p, payment: e.target.value }))}
                >
                  <option value="bkash">{t('bkash')}</option>
                  <option value="nagad">{t('nagad')}</option>
                  <option value="rocket">{t('rocket')}</option>
                  <option value="bank-card">{t('bankCard')}</option>
                </select>
              </label>

              <label className="surveillance-field" style={{ gridColumn: '1 / -1' }}>
                <span>{isBn ? 'লাইভ প্রশ্ন / খামার স্থাপনের জিজ্ঞাসা' : 'Your Question for the BVC Veterinarian'}</span>
                <input
                  type="text"
                  value={bookingForm.question}
                  onChange={(e) => setBookingForm((p) => ({ ...p, question: e.target.value }))}
                  placeholder={isBn
                    ? `যেমন: ${flockSize} ${farmType} শেডের কার্নিশ ও বাচ্চা ব্রুডিং পরামর্শ`
                    : `e.g., Curtain setup & brooding check for ${flockSize} ${farmType} birds`}
                />
              </label>
            </div>

            <div className="blueprint-reserve-submit-row">
              <button type="button" className="ethical-care-btn" style={{ flex: '0 0 auto' }} onClick={() => setActiveWorkshopId('')}>
                {t('close')}
              </button>
              <button type="submit" className="ethical-care-btn ethical-care-btn--primary" style={{ flex: '1 1 220px' }}>
                <CheckCircle2 size={15} aria-hidden="true" />
                <span>{isBn ? `পেমেন্ট অ্যাপ দিয়ে আসন নিশ্চিত (৳ ${activeWorkshop.feeBdt})` : `Pay & Confirm Workshop Seat (৳ ${activeWorkshop.feeBdt})`}</span>
              </button>
            </div>
          </form>
        )}
      </section>

      {workshopCheckoutOpen && activeWorkshop && (
        <PaymentCheckoutModal
          booking={{
            farmer: bookingForm.name.trim() || (isBn ? 'নবীন উদ্যোক্তা' : 'New Entrepreneur'),
            farm: `${farmType} (${flockSize} ${isBn ? 'টি' : 'birds'})`,
            district: bookingForm.district || selectedDistrict || 'Rajshahi',
            date: activeWorkshop.scheduleDate,
            time: activeWorkshop.scheduleTime,
            concern: `[Workshop Seat] ${isBn ? activeWorkshop.titleBn : activeWorkshop.titleEn}`,
            payment: bookingForm.payment,
            returnView: 'blueprint',
            workshopId: activeWorkshop.id,
          }}
          doctor={{
            id: activeWorkshop.id,
            name: activeWorkshop.vetName,
            regNo: activeWorkshop.bvcRegNo,
            clinic: `${activeWorkshop.clinicDetails} — Pro Mentorship Workshop`,
          }}
          districtLabel={t(`districts.${bookingForm.district || selectedDistrict || 'Rajshahi'}`, bookingForm.district || selectedDistrict || 'Rajshahi')}
          amountBdt={activeWorkshop.feeBdt}
          onClose={() => setWorkshopCheckoutOpen(false)}
          onSuccess={(receipt) => finalizeWorkshopBooking(receipt, activeWorkshop)}
        />
      )}

      {workshopReceiptOpen && workshopReceipt && (
        <DigitalReceiptModal
          receipt={workshopReceipt}
          onClose={() => setWorkshopReceiptOpen(false)}
        />
      )}
    </main>
  )
}
