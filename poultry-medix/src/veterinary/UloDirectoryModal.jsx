import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Building2,
  ClipboardCheck,
  ExternalLink,
  MapPin,
  PhoneCall,
  Search,
  X,
} from 'lucide-react'
import { useLanguage } from '../context/useLanguage.js'
import {
  DLS_EMERGENCY_HELPLINE,
  DLS_PORTAL_URL,
  SAMPLE_SUBMISSION_GUIDES,
  ULO_DIRECTORY_ENTRIES,
} from '../lib/uloDirectory.js'
import './EthicalCareBar.css'

export default function UloDirectoryModal({ initialDistrict = '', onClose }) {
  const { language, t } = useLanguage()
  const isBn = language === 'bn'

  const [query, setQuery] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState(() => initialDistrict || 'all')

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const districts = useMemo(
    () => Array.from(new Set(ULO_DIRECTORY_ENTRIES.map((entry) => entry.district))).sort(),
    []
  )

  const filteredEntries = useMemo(() => {
    const cleanedQuery = query.trim().toLowerCase()
    return ULO_DIRECTORY_ENTRIES.filter((entry) => {
      if (selectedDistrict !== 'all' && entry.district.toLowerCase() !== selectedDistrict.toLowerCase()) {
        return false
      }
      if (!cleanedQuery) return true
      const haystack = [
        entry.district,
        t(`districts.${entry.district}`, entry.district),
        entry.type,
        entry.typeBn,
        entry.nameEn,
        entry.nameBn,
        entry.addressEn,
        entry.addressBn,
        entry.servicesEn,
        entry.servicesBn,
      ].join(' ').toLowerCase()
      return haystack.includes(cleanedQuery)
    })
  }, [query, selectedDistrict, t])

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
        aria-labelledby="ulo-directory-title"
      >
        <header className="ulo-modal-header">
          <div>
            <span className="ulo-modal-kicker">
              <Building2 size={13} aria-hidden="true" />
              <span>
                {isBn ? 'বাংলাদেশ প্রাণিসম্পদ অধিদপ্তর (DLS)' : 'Bangladesh Dept. of Livestock Services (DLS)'}
              </span>
            </span>
            <h2 id="ulo-directory-title">
              {isBn
                ? 'সরকারি উপজেলা প্রাণিসম্পদ (ULO) ও জেলা ভেটেরিনারি হাসপাতাল ডিরেক্টরি'
                : 'Govt. ULO & District Veterinary Hospital Directory'}
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

        <div className="ulo-modal-body">
          {/* National Helpline Banner */}
          <div className="ulo-helpline-banner">
            <div className="ulo-helpline-copy">
              <strong>
                {isBn
                  ? `জাতীয় প্রাণিসম্পদ ও কৃষক হেল্পলাইন: ${DLS_EMERGENCY_HELPLINE}`
                  : `National Govt. Livestock & Agriculture Helpline: ${DLS_EMERGENCY_HELPLINE}`}
              </strong>
              <span>
                {isBn
                  ? 'হঠাৎ অধিক মৃত্যু, বার্ড ফ্লু সন্দেহ বা জরুরি পরামর্শের জন্য সরাসরি সরকারি পশুচিকিৎসা সহায়তায় যোগাযোগ করুন।'
                  : 'For sudden flock mortality, suspected Avian Influenza, or emergency lab referrals, call 16358 or contact your local DLS office.'}
              </span>
            </div>

            <div className="ulo-helpline-links">
              <a className="ulo-call-btn" href={`tel:${DLS_EMERGENCY_HELPLINE}`}>
                <PhoneCall size={14} aria-hidden="true" />
                <span>{isBn ? `কল করুন: ${DLS_EMERGENCY_HELPLINE}` : `Call ${DLS_EMERGENCY_HELPLINE}`}</span>
              </a>
              <a
                className="ulo-portal-link"
                href={DLS_PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={14} aria-hidden="true" />
                <span>{isBn ? 'DLS ওয়েবসাইট' : 'DLS Portal'}</span>
              </a>
            </div>
          </div>

          {/* Why No Unauthorized Antibiotics Box */}
          <div className="ulo-amr-box">
            <strong>
              <AlertTriangle size={14} aria-hidden="true" />
              <span>
                {isBn
                  ? 'কেন নিজে বা কোয়াকের কথায় অ্যান্টিবায়োটিক খাওয়াবেন না?'
                  : 'Why Guessing Antibiotics Harms Your Flock & Human Health'}
              </span>
            </strong>
            <span>
              {isBn
                ? 'ভুল অ্যান্টিবায়োটিক বা অতিরিক্ত মাত্রা প্রয়োগ করলে ভাইরাসজনিত রোগ (যেমন রানীক্ষেত, গামবোরো) সারে না—বরং পাখির কিডনি-লিভার বিকল হয়ে মৃত্যু বাড়ে এবং মানুষ ও পাখির শরীরে এএমআর (AMR) জীবাণু প্রতিরোধ তৈরি হয়।'
                : 'Viral illnesses (like Newcastle or Gumboro) do not respond to antibiotics. Random drug use stresses organs, drives avoidable flock deaths, leaves illegal meat/egg residues, and accelerates life-threatening Antimicrobial Resistance (AMR) in poultry and humans.'}
            </span>
          </div>

          {/* Search & District Filters */}
          <div className="ulo-filter-row">
            <div className="ulo-search-wrap">
              <Search size={15} className="ulo-search-icon" aria-hidden="true" />
              <input
                type="search"
                className="ulo-search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={isBn ? 'উপজেলা, জেলা বা ল্যাবের নাম দিয়ে খুঁজুন...' : 'Search by district, upazila, hospital, or FDIL lab...'}
                aria-label={isBn ? 'সরকারি ভেট হাসপাতাল খুঁজুন' : 'Search ULO directory'}
              />
            </div>

            <select
              className="ulo-district-select"
              value={selectedDistrict}
              onChange={(event) => setSelectedDistrict(event.target.value)}
              aria-label={isBn ? 'জেলা নির্বাচন করুন' : 'Filter by district'}
            >
              <option value="all">{isBn ? `সব জেলা (${ULO_DIRECTORY_ENTRIES.length}টি কেন্দ্র)` : `All Districts (${ULO_DIRECTORY_ENTRIES.length} Centers)`}</option>
              {districts.map((dist) => (
                <option key={dist} value={dist}>
                  {t(`districts.${dist}`, dist)}
                </option>
              ))}
            </select>
          </div>

          {/* Search Results List */}
          <div className="ulo-directory-list">
            {filteredEntries.length === 0 ? (
              <p style={{ margin: '8px 0', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                {isBn
                  ? 'আপনার খোঁজার সাথে মিলে যাওয়া কোনো কেন্দ্র পাওয়া যায়নি। অনুগ্রহ করে জেলা "সব জেলা" নির্বাচন করে বা ১৬৩৫৮-এ কল করে দেখুন।'
                  : 'No matching centers found for this search. Switch district filter to All Districts or call 16358.'}
              </p>
            ) : (
              filteredEntries.map((entry) => (
                <article className="ulo-entry-card" key={entry.id}>
                  <div className="ulo-entry-top">
                    <div className="ulo-entry-badges">
                      <span className="ulo-district-tag">{t(`districts.${entry.district}`, entry.district)}</span>
                      <span className="ulo-type-tag">{isBn ? entry.typeBn : entry.type}</span>
                    </div>
                    <span className="ulo-entry-hours">{isBn ? entry.hoursBn : entry.hoursEn}</span>
                  </div>
                  <h3>{isBn ? entry.nameBn : entry.nameEn}</h3>
                  <p className="ulo-entry-address">
                    <MapPin size={13} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                    <span>{isBn ? entry.addressBn : entry.addressEn}</span>
                  </p>
                  <p className="ulo-entry-services">
                    {isBn ? entry.servicesBn : entry.servicesEn}
                  </p>
                </article>
              ))
            )}
          </div>

          {/* Sample Submission Guidance */}
          <section className="ulo-sample-guide" aria-label={isBn ? 'ল্যাব নমুনা জমার নির্দেশিকা' : 'Lab Sample Submission Guidance'}>
            <h4>
              <ClipboardCheck size={15} aria-hidden="true" />
              <span>{isBn ? 'হাসপাতালে নমুনা নেওয়ার নিরাপদ নির্দেশিকা' : 'Sample & Flock Submission Guidance (FDIL / ULO)'}</span>
            </h4>
            <div className="ulo-sample-steps">
              {SAMPLE_SUBMISSION_GUIDES.map((step) => (
                <div className="ulo-sample-step" key={step.id}>
                  <strong>{isBn ? step.titleBn : step.titleEn}</strong>
                  <p>{isBn ? step.detailBn : step.detailEn}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="ulo-modal-footer">
          <button type="button" className="ethical-care-btn" style={{ flex: '0 0 auto' }} onClick={onClose}>
            {t('close')}
          </button>
        </footer>
      </section>
    </div>,
    document.body
  )
}
