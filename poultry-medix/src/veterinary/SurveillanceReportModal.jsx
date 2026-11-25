import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Building2,
  ClipboardPlus,
  ShieldAlert,
  Stethoscope,
  UserCheck,
  X,
} from 'lucide-react'
import { useLanguage } from '../context/useLanguage.js'
import { saveSurveillanceLog } from '../lib/clinicalLogsStore.js'
import { notifyAnalyticsUpdated } from '../lib/analyticsEngine.js'
import {
  DISTRICT_UPAZILAS,
  REPORTER_ROLES,
  SURVEILLANCE_ANTIBIOTICS,
  SURVEILLANCE_DISEASES,
  SURVEILLANCE_DISTRICTS,
  SURVEILLANCE_SPECIES,
  getZoonoticInfo,
} from '../lib/oneHealthSurveillance.js'
import './EthicalCareBar.css'

const ROLE_ICONS = {
  ulo_hospital: Building2,
  bvc_vet: Stethoscope,
  farmer_ai: UserCheck,
}

export default function SurveillanceReportModal({
  defaultDistrict = 'Rajshahi',
  defaultRole = 'ulo_hospital',
  onSubmitted,
  onClose,
}) {
  const { language, t } = useLanguage()
  const isBn = language === 'bn'

  const [reporterRole, setReporterRole] = useState(defaultRole || 'ulo_hospital')
  const [district, setDistrict] = useState(() => (
    SURVEILLANCE_DISTRICTS.includes(defaultDistrict) ? defaultDistrict : 'Rajshahi'
  ))
  const [upazila, setUpazila] = useState('')
  const [species, setSpecies] = useState('Broiler')
  const [disease, setDisease] = useState('Avian Influenza')
  const [antibioticPrescribed, setAntibioticPrescribed] = useState('None / Supportive Only')
  const [mortalityCount, setMortalityCount] = useState('0')
  const [reporterName, setReporterName] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleEsc = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  const zoonoticInfo = getZoonoticInfo(disease)
  const selectedAntibiotic = SURVEILLANCE_ANTIBIOTICS.find((a) => a.name === antibioticPrescribed)
  const upazilaSuggestions = DISTRICT_UPAZILAS[district] || []

  function handleSubmit(event) {
    event.preventDefault()
    const cleanUpazila = upazila.trim()
    if (!cleanUpazila) {
      setError(
        isBn
          ? 'অনুগ্রহ করে উপজেলার নাম লিখুন (যেমন: পবা, সাভার, শেরপুর)।'
          : 'Please enter the Upazila name (e.g., Paba, Savar, Sherpur).'
      )
      return
    }

    const parsedMortality = Math.max(0, Number.parseInt(mortalityCount, 10) || 0)

    const saved = saveSurveillanceLog({
      district,
      upazila: cleanUpazila,
      reporterRole,
      reporterName,
      species,
      disease,
      antibioticPrescribed,
      mortalityCount: parsedMortality,
      notes,
    })

    notifyAnalyticsUpdated()
    onSubmitted?.(saved)
    onClose()
  }

  return createPortal(
    <div
      className="ulo-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="ulo-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="surveillance-modal-title"
      >
        <header className="ulo-modal-header">
          <div>
            <span className="ulo-modal-kicker">
              <ClipboardPlus size={13} aria-hidden="true" />
              <span>
                {isBn
                  ? 'জাতীয় ওয়ান-হেলথ পোল্ট্রি ও জুনোটিক সার্ভেইল্যান্স নেটওয়ার্ক'
                  : 'National One-Health Poultry & Zoonotic Surveillance'}
              </span>
            </span>
            <h2 id="surveillance-modal-title">
              {t('submitSurveillanceTitle')}
            </h2>
          </div>

          <button
            type="button"
            className="ulo-modal-close"
            aria-label={t('close')}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <form className="ulo-modal-body surveillance-form" onSubmit={handleSubmit} noValidate>
          {/* Reporter Role / Source Selector */}
          <div>
            <span className="surveillance-field-label">
              {t('reporterRoleLabel')}
            </span>
            <div className="surveillance-role-grid" role="radiogroup" aria-label={t('reporterRoleLabel')}>
              {Object.values(REPORTER_ROLES).map((role) => {
                const RoleIcon = ROLE_ICONS[role.id] || Building2
                const selected = reporterRole === role.id
                return (
                  <button
                    key={role.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`surveillance-role-btn${selected ? ' is-active' : ''}`}
                    onClick={() => setReporterRole(role.id)}
                  >
                    <RoleIcon size={15} aria-hidden="true" />
                    <span>{isBn ? role.labelBn : role.labelEn}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="surveillance-form-grid">
            {/* District */}
            <label className="surveillance-field">
              <span>{t('rxDistrict')}</span>
              <select
                value={district}
                onChange={(event) => {
                  setDistrict(event.target.value)
                  setUpazila('')
                }}
              >
                {SURVEILLANCE_DISTRICTS.map((dist) => (
                  <option key={dist} value={dist}>
                    {t(`districts.${dist}`, dist)}
                  </option>
                ))}
              </select>
            </label>

            {/* Upazila */}
            <label className="surveillance-field">
              <span>{t('upazilaLabel')} *</span>
              <input
                type="text"
                list="surveillance-upazila-list"
                value={upazila}
                onChange={(event) => {
                  setUpazila(event.target.value)
                  if (error) setError('')
                }}
                placeholder={
                  upazilaSuggestions.length
                    ? (isBn ? `যেমন: ${upazilaSuggestions[0]}` : `e.g., ${upazilaSuggestions.join(', ')}`)
                    : (isBn ? 'উপজেলার নাম লিখুন' : 'Enter Upazila name')
                }
              />
              <datalist id="surveillance-upazila-list">
                {upazilaSuggestions.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </label>

            {/* Bird Species */}
            <label className="surveillance-field">
              <span>{t('birdSpeciesLabel')}</span>
              <select value={species} onChange={(event) => setSpecies(event.target.value)}>
                {SURVEILLANCE_SPECIES.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {isBn ? sp.labelBn : sp.labelEn}
                  </option>
                ))}
              </select>
            </label>

            {/* Mortality Count */}
            <label className="surveillance-field">
              <span>{t('mortalityCountLabel')}</span>
              <input
                type="number"
                min="0"
                max="100000"
                value={mortalityCount}
                onChange={(event) => setMortalityCount(event.target.value)}
                placeholder="0"
              />
            </label>
          </div>

          {/* Detected Disease */}
          <label className="surveillance-field">
            <span>{t('detectedDiseaseLabel')}</span>
            <select value={disease} onChange={(event) => setDisease(event.target.value)}>
              {SURVEILLANCE_DISEASES.map((d) => (
                <option key={d.id} value={d.id}>
                  {isBn ? d.labelBn : d.labelEn}
                  {d.isZoonotic ? (isBn ? ' [⚠ জুনোটিক ঝুঁকি]' : ' [⚠ Zoonotic Risk]') : ''}
                </option>
              ))}
            </select>
          </label>

          {/* Dynamic Zoonotic Alert Banner inside form */}
          {zoonoticInfo.isZoonotic && (
            <div className="surveillance-zoonotic-preview" role="alert">
              <div className="surveillance-zoonotic-badge-row">
                <span className="zoonotic-risk-badge">
                  <ShieldAlert size={13} aria-hidden="true" />
                  <span>{t('zoonoticRiskBadge')}</span>
                </span>
              </div>
              <p>
                {isBn ? zoonoticInfo.riskNoteBn : zoonoticInfo.riskNoteEn}
                {' — '}
                {isBn
                  ? 'নমুনা ও মৃত পাখি ধরার সময় মাস্ক-গ্লাভস পরুন, গর্তে চুনসহ মাটিচাপা দিন এবং জরুরি ১৬৩৫৮ নম্বরে জানান।'
                  : 'Enforce PPE (N95 mask & gloves), strict deep burial of carcasses, and immediate DLS 16358 ULO alert.'}
              </p>
            </div>
          )}

          {/* Antibiotic Prescribed */}
          <label className="surveillance-field">
            <span>{t('antibioticPrescribedLabel')}</span>
            <select
              value={antibioticPrescribed}
              onChange={(event) => setAntibioticPrescribed(event.target.value)}
            >
              {SURVEILLANCE_ANTIBIOTICS.map((ab) => (
                <option key={ab.name} value={ab.name}>
                  {isBn ? ab.labelBn : ab.labelEn}
                </option>
              ))}
            </select>
          </label>

          {selectedAntibiotic?.restricted && (
            <div className="surveillance-colistin-alert" role="alert">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>
                {isBn
                  ? 'রেড ফ্ল্যাগ সতর্কতা: বাংলাদেশে পোল্ট্রিতে কোলিস্টিন নিষিদ্ধ! কেবলমাত্র মাঠপর্যায়ে অননুমোদিত ব্যবহার বা এএমআর নজরদারির তথ্য নথিভুক্ত করতে এটি সংরক্ষণ করুন।'
                  : 'RED FLAG (DLS/DGDA Ban): Colistin is prohibited in Bangladesh poultry. Log only to flag unauthorized field/OTC exposure for national AMR surveillance.'}
              </span>
            </div>
          )}

          {reporterRole === 'farmer_ai' && antibioticPrescribed !== 'None / Supportive Only' && (
            <p className="surveillance-stewardship-hint">
              {isBn
                ? 'সতর্কতা: খামারি পর্যায়ে শুধু নিবন্ধিত BVC চিকিৎসক বা সরকারি ULO-র দেওয়া প্রেসক্রিপশনের ওষুধই এখানে উল্লেখ করুন—নিজে অ্যান্টিবায়োটিক প্রয়োগ করবেন না।'
                : 'Antimicrobial Stewardship: Farmers should only log antibiotics formally prescribed by a BVC Vet or Govt. ULO (never self-dose).'}
            </p>
          )}

          <div className="surveillance-form-grid">
            <label className="surveillance-field">
              <span>{t('reporterOrgLabel')}</span>
              <input
                type="text"
                value={reporterName}
                onChange={(event) => setReporterName(event.target.value)}
                placeholder={
                  reporterRole === 'ulo_hospital'
                    ? (isBn ? 'যেমন: পবা উপজেলা প্রাণিসম্পদ হাসপাতাল' : 'e.g., Paba ULO Hospital')
                    : reporterRole === 'bvc_vet'
                      ? (isBn ? 'যেমন: ডাঃ রফিকুল ইসলাম (BVC-...)' : 'e.g., Dr. Rafiqul Islam (BVC-...)')
                      : (isBn ? 'যেমন: সোনার বাংলা পোল্ট্রি খামার' : 'e.g., Verified Farm Shed #1')
                }
              />
            </label>

            <label className="surveillance-field">
              <span>{t('surveillanceNotesLabel')}</span>
              <input
                type="text"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={isBn ? 'পোস্ট-মর্টেম / AST / খামারের পর্যবেক্ষণ...' : 'Post-mortem, AST, or biosecurity note...'}
              />
            </label>
          </div>

          {error && (
            <p className="surveillance-form-error" role="alert">
              {error}
            </p>
          )}

          <div className="ulo-modal-footer" style={{ paddingInline: 0, background: 'transparent', borderTop: '1px solid #e2e8f0' }}>
            <button type="button" className="ethical-care-btn" style={{ flex: '0 0 auto' }} onClick={onClose}>
              {t('close')}
            </button>
            <button type="submit" className="ethical-care-btn ethical-care-btn--primary" style={{ flex: '1 1 auto' }}>
              <ClipboardPlus size={15} aria-hidden="true" />
              <span>{t('submitSurveillanceBtn')}</span>
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body
  )
}
