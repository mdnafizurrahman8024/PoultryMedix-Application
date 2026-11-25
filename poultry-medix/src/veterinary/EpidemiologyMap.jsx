import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Building2,
  ClipboardPlus,
  Filter,
  MapPin,
  PhoneCall,
  ShieldAlert,
  Stethoscope,
  UserCheck,
  X,
} from 'lucide-react'
import {
  getLiveOutbreakDistricts,
  getLiveAntibioticAnalytics,
  getOneHealthSurveillanceSummary,
  ANALYTICS_UPDATED_EVENT,
  PRESCRIPTION_DATA_CHANGED_EVENT,
} from '../lib/analyticsEngine.js'
import { CLINICAL_LOGS_UPDATED_EVENT } from '../lib/clinicalLogsStore.js'
import {
  REPORTER_ROLES,
  ZOONOTIC_HUMAN_PRECAUTIONS,
  getDiseaseDisplayLabel,
} from '../lib/oneHealthSurveillance.js'
import { DLS_EMERGENCY_HELPLINE, requestUloDirectoryModal } from '../lib/uloDirectory.js'
import { useLanguage } from '../context/useLanguage.js'
import { useUser } from '../context/user-context.js'
import SurveillanceReportModal from './SurveillanceReportModal.jsx'

const bangladeshCenter = [23.685, 90.3563]
const themeStyles = {
  emerald: { background: 'rgba(16, 185, 129, .13)', border: '#6ee7b7', accent: '#047857' },
  indigo: { background: 'rgba(79, 70, 229, .13)', border: '#a5b4fc', accent: '#3730a3' },
  rose: { background: 'rgba(244, 63, 94, .13)', border: '#fda4af', accent: '#be123c' },
  amber: { background: 'rgba(245, 158, 11, .15)', border: '#fcd34d', accent: '#b45309' },
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch])
}

function severityStyle(severity) {
  if (severity === 'Critical') return { background: '#fee2e2', color: '#b91c1c' }
  if (severity === 'High') return { background: '#ffedd5', color: '#c2410c' }
  if (severity === 'Moderate') return { background: '#fef3c7', color: '#a16207' }
  return { background: '#e0f2fe', color: '#0369a1' }
}

function ProgressBar({ percentage, color }) {
  return (
    <span style={{ background: 'rgba(148, 163, 184, .2)', borderRadius: 999, display: 'block', height: 8, overflow: 'hidden' }}>
      <span style={{ background: `linear-gradient(90deg, ${color}, #fbbf24)`, display: 'block', height: '100%', width: `${Math.min(100, Math.max(0, percentage))}%` }} />
    </span>
  )
}

function AntibioticHierarchy({ source, district }) {
  const { language, t } = useLanguage()
  const isBn = language === 'bn'
  const [analytics, setAnalytics] = useState(() => getLiveAntibioticAnalytics(source, district))
  const [expandedClasses, setExpandedClasses] = useState(() => new Set(['Tetracyclines']))
  const [expandedGenerics, setExpandedGenerics] = useState(() => new Set())
  const [selectedGeneration, setSelectedGeneration] = useState(null)

  useEffect(() => {
    const refresh = () => setAnalytics(getLiveAntibioticAnalytics(source, district))
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener(ANALYTICS_UPDATED_EVENT, refresh)
    window.addEventListener(PRESCRIPTION_DATA_CHANGED_EVENT, refresh)
    window.addEventListener(CLINICAL_LOGS_UPDATED_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener(ANALYTICS_UPDATED_EVENT, refresh)
      window.removeEventListener(PRESCRIPTION_DATA_CHANGED_EVENT, refresh)
      window.removeEventListener(CLINICAL_LOGS_UPDATED_EVENT, refresh)
    }
  }, [source, district])

  function toggle(setter, key) {
    setter((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const aware = analytics.awareSummary || { Access: { percentage: 0 }, Watch: { percentage: 0 }, Reserve: { percentage: 0 } }
  const sourceButtons = [
    ['all', t('allCombined')],
    ['ulo_hospital', isBn ? REPORTER_ROLES.ulo_hospital.shortBn : REPORTER_ROLES.ulo_hospital.shortEn],
    ['bvc_vet', isBn ? REPORTER_ROLES.bvc_vet.shortBn : REPORTER_ROLES.bvc_vet.shortEn],
    ['farmer_ai', isBn ? REPORTER_ROLES.farmer_ai.shortBn : REPORTER_ROLES.farmer_ai.shortEn],
  ]

  return (
    <section className="amr-analytics-card dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" aria-labelledby="antibiotic-hierarchy-title">
      <div className="amr-analytics-heading">
        <div>
          <span className="veterinary-kicker">{t('levelsThree')}</span>
          <h2 id="antibiotic-hierarchy-title">{t('antibioticHierarchy')}</h2>
          <p>{t('antibioticHierarchyDescription')}</p>
        </div>
      </div>

      {/* WHO AWaRe Surveillance Overview Banner */}
      <div className="mb-4 rounded-xl border border-gray-200/70 bg-white/70 p-3.5 shadow-sm dark:border-gray-700 dark:bg-gray-800/80">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            {t('whoAwareRatios', 'WHO AWaRe Classification Ratios')}
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            {district
              ? t('filteredByDistrict', { district: t(`districts.${district}`, district) })
              : t('allSurveillanceDistricts', 'All Surveillance Districts')}
          </span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div style={{ width: `${aware.Access.percentage}%` }} className="bg-emerald-500 transition-all duration-300" title={`${t('awareCategories.Access', 'Access')}: ${aware.Access.percentage}%`} />
          <div style={{ width: `${aware.Watch.percentage}%` }} className="bg-amber-500 transition-all duration-300" title={`${t('awareCategories.Watch', 'Watch')}: ${aware.Watch.percentage}%`} />
          <div style={{ width: `${aware.Reserve.percentage}%` }} className="bg-rose-600 transition-all duration-300" title={`${t('awareCategories.Reserve', 'Reserve')}: ${aware.Reserve.percentage}%`} />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <strong className="text-emerald-700 dark:text-emerald-400">{t('awareCategories.Access', 'Access')}:</strong> {aware.Access.percentage}% ({aware.Access.count || 0})
          </span>
          <span className="flex items-center gap-1">
            <strong className="text-amber-700 dark:text-amber-400">{t('awareCategories.Watch', 'Watch')}:</strong> {aware.Watch.percentage}% ({aware.Watch.count || 0})
          </span>
          <span className="flex items-center gap-1">
            <strong className="text-rose-700 dark:text-rose-400">{t('awareCategories.Reserve', 'Reserve')}:</strong> {aware.Reserve.percentage}% ({aware.Reserve.count || 0})
          </span>
        </div>
      </div>

      <div className="mb-4 flex w-full min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white/80 p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900/60 lg:gap-[0.6rem]">
        <strong className="w-full min-w-0 sm:w-auto text-gray-900 dark:text-gray-100">
          {t('totalAnalyzed', { count: analytics.total })}
        </strong>
        {sourceButtons.map(([value, label]) => {
          const active = source === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('poultrymedix-source-filter', { detail: value }))}
              className={`min-w-0 max-w-full flex-[1_1_auto] whitespace-normal rounded-full px-3 py-1.5 text-center text-xs font-bold leading-snug transition-all active:scale-95 lg:flex-[0_1_auto] ${
                active
                  ? 'bg-emerald-700 text-white'
                  : 'bg-gray-100 text-slate-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {analytics.classes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-xs text-gray-600 dark:border-gray-700 dark:text-gray-400">
          {isBn
            ? 'নির্বাচিত উৎস বা জেলার জন্য এখনো কোনো অ্যান্টিবায়োটিক রেকর্ড পাওয়া যায়নি।'
            : 'No antibiotic usage records found for this source and district filter.'}
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {analytics.classes.map((classEntry, index) => {
            const theme = themeStyles[['emerald', 'indigo', 'rose', 'amber'][index % 4]]
            const classOpen = expandedClasses.has(classEntry.name)
            return (
              <article key={classEntry.name} className="dark:text-gray-900" style={{ background: theme.background, border: `1px solid ${theme.border}`, borderRadius: '1rem', boxShadow: '0 6px 18px rgba(15, 23, 42, .06)', padding: '1rem' }}>
                <button type="button" onClick={() => toggle(setExpandedClasses, classEntry.name)} aria-expanded={classOpen} className="cursor-pointer transition-all active:scale-95 dark:text-gray-100" style={{ alignItems: 'center', background: 'transparent', border: 0, color: theme.accent, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', padding: 0, width: '100%', textAlign: 'left', gap: '8px' }}>
                  <span><strong>{t(`antibiotics.classes.${classEntry.name}`, classEntry.name)}</strong> · {classEntry.percentage}% · {classEntry.count} {t('prescriptions')}</span>
                  <b aria-hidden="true">{classOpen ? '−' : '+'}</b>
                </button>
                <ProgressBar percentage={classEntry.percentage} color={theme.accent} />
                {classOpen && (
                  <div style={{ display: 'grid', gap: '.75rem', marginTop: '.85rem', paddingLeft: '.75rem' }}>
                    {classEntry.generics.map((generic) => {
                      const genericKey = `${classEntry.name}-${generic.name}`
                      const genericOpen = expandedGenerics.has(genericKey)
                      return (
                        <div key={genericKey} className="dark:text-gray-900 dark:font-semibold" style={{ background: 'rgba(255, 255, 255, .62)', borderRadius: '.8rem', padding: '.7rem' }}>
                          <button type="button" onClick={() => toggle(setExpandedGenerics, genericKey)} aria-expanded={genericOpen} className="cursor-pointer transition-all active:scale-95 dark:text-gray-900" style={{ alignItems: 'center', background: 'transparent', border: 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', padding: 0, width: '100%', textAlign: 'left', gap: '8px' }}>
                            <span><strong>{t(`antibiotics.generics.${generic.name}`, generic.name)}</strong> · {generic.percentage}% ({generic.count})</span><b>{genericOpen ? '−' : '+'}</b>
                          </button>
                          <ProgressBar percentage={generic.percentage} color={theme.accent} />
                          {genericOpen && (
                            <div style={{ display: 'grid', gap: '.7rem', marginTop: '.7rem' }}>
                              {generic.trades.map((trade) => (
                                <div key={`${genericKey}-${trade.name}-${trade.company}`}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>{trade.name} <small>({trade.company})</small></span><strong>{trade.percentage}%</strong></div>
                                  <ProgressBar percentage={trade.percentage} color={theme.accent} />
                                  <div style={{ display: 'grid', gap: '.35rem', marginTop: '.45rem' }}>
                                    {trade.generations.map((generation) => {
                                      const generationKey = `${genericKey}-${trade.name}-${generation.name}`
                                      const open = selectedGeneration === generationKey
                                      return (
                                        <div key={generationKey}>
                                          <button type="button" onClick={() => setSelectedGeneration(open ? null : generationKey)} className="cursor-pointer transition-all active:scale-95 dark:text-gray-900" style={{ background: 'rgba(255, 255, 255, .82)', border: '1px solid rgba(255, 255, 255, .9)', borderRadius: '.65rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', padding: '.45rem .6rem', textAlign: 'left', width: '100%' }}>
                                            <span>{t(`generationsMap.${generation.name}`, generation.name)}</span><strong>{generation.percentage}%</strong>
                                          </button>
                                          {open && (
                                            <div className="dark:text-gray-900 dark:border-gray-300 dark:font-semibold" style={{ background: 'rgba(255, 255, 255, .92)', border: '1px solid #e2e8f0', borderRadius: '.7rem', fontSize: '.82rem', marginTop: '.3rem', padding: '.55rem' }}>
                                              WHO AWaRe: <strong>{t(`awareCategories.${generation.aware}`, generation.aware)}</strong> · {t('amrResistanceRisk', 'AMR Resistance Risk')}: <strong>{t(`risks.${generation.risk}`, generation.risk)}</strong> · {t('meatShort', 'Meat')}: <strong>{generation.meatDays}</strong> · {t('eggShort', 'Egg')}: <strong>{generation.eggDays}</strong>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default function EpidemiologyMap() {
  const { language, t } = useLanguage()
  const { role } = useUser()
  const isBn = language === 'bn'
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])

  const [outbreakDistricts, setOutbreakDistricts] = useState(() => getLiveOutbreakDistricts())
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [zoonoticOnly, setZoonoticOnly] = useState(false)
  const [source, setSource] = useState('all')
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [submissionFeedback, setSubmissionFeedback] = useState(null)

  const activeSelectedDistrictObj = useMemo(
    () => outbreakDistricts.find((d) => d.name === selectedDistrict) || null,
    [outbreakDistricts, selectedDistrict]
  )

  const summary = getOneHealthSurveillanceSummary(selectedDistrict, zoonoticOnly)

  const visibleDistricts = useMemo(
    () => (zoonoticOnly ? outbreakDistricts.filter((d) => d.isZoonotic) : outbreakDistricts),
    [outbreakDistricts, zoonoticOnly]
  )

  const totalZoonoticDistricts = useMemo(
    () => outbreakDistricts.filter((d) => d.isZoonotic).length,
    [outbreakDistricts]
  )

  useEffect(() => {
    const onSourceFilter = (event) => setSource(event.detail || 'all')
    window.addEventListener('poultrymedix-source-filter', onSourceFilter)
    return () => window.removeEventListener('poultrymedix-source-filter', onSourceFilter)
  }, [])

  useEffect(() => {
    function refreshData() {
      setOutbreakDistricts(getLiveOutbreakDistricts())
    }
    window.addEventListener('storage', refreshData)
    window.addEventListener(ANALYTICS_UPDATED_EVENT, refreshData)
    window.addEventListener(CLINICAL_LOGS_UPDATED_EVENT, refreshData)
    window.addEventListener(PRESCRIPTION_DATA_CHANGED_EVENT, refreshData)
    return () => {
      window.removeEventListener('storage', refreshData)
      window.removeEventListener(ANALYTICS_UPDATED_EVENT, refreshData)
      window.removeEventListener(CLINICAL_LOGS_UPDATED_EVENT, refreshData)
      window.removeEventListener(PRESCRIPTION_DATA_CHANGED_EVENT, refreshData)
    }
  }, [])

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return undefined
    const map = L.map(mapContainerRef.current, { center: bangladeshCenter, zoom: 7 })
    mapRef.current = map
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    }).addTo(map)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}').addTo(map)

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Sync dynamic markers whenever visibleDistricts or selectedDistrict or language changes
  useEffect(() => {
    if (!mapRef.current) return

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    visibleDistricts.forEach((district) => {
      const isSelected = selectedDistrict === district.name
      const radius = district.severity === 'Critical' ? 14 : district.severity === 'High' ? 11 : 9

      if (district.isZoonotic) {
        const ring = L.circleMarker(district.coordinates, {
          color: '#b91c1c',
          fillColor: '#b91c1c',
          fillOpacity: 0.08,
          dashArray: '4 4',
          radius: (isSelected ? radius + 4 : radius) + 6,
          weight: 2,
        }).addTo(mapRef.current)
        markersRef.current.push(ring)
      }

      const marker = L.circleMarker(district.coordinates, {
        color: district.isZoonotic ? '#991b1b' : district.color,
        fillColor: district.color,
        fillOpacity: isSelected ? 0.92 : 0.72,
        radius: isSelected ? radius + 4 : radius,
        weight: isSelected ? 3 : 2,
      }).addTo(mapRef.current)

      const districtLabel = escapeHtml(t(`districts.${district.name}`, district.name))
      const diseaseLabel = escapeHtml(getDiseaseDisplayLabel(district.disease, language, t))
      const riskLabel = escapeHtml(t(`risks.${district.risk}`, district.risk))
      const severityLabel = escapeHtml(t(`severity.${district.severity}`, district.severity))
      const upazilaLine = district.upazilas?.length
        ? `<div style="font-size:11px; color:#64748b; margin-top:2px;">Upazila: ${escapeHtml(district.upazilas.slice(0, 3).join(', '))}</div>`
        : ''
      const zoonoticHtml = district.isZoonotic
        ? `<div style="margin-top:5px; padding:3px 7px; border-radius:6px; background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; font-size:10px; font-weight:800;">⚠️ ${escapeHtml(t('zoonoticRiskBadge'))}</div>`
        : ''

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 13px; line-height: 1.4; max-width: 240px;">
          <strong style="font-size: 14px; color: #0f172a;">${districtLabel}</strong>
          ${upazilaLine}
          ${zoonoticHtml}
          <div style="color: #334155; font-weight: 700; margin-top: 5px;">${diseaseLabel}</div>
          <span style="display:inline-block; margin-top:4px; padding:2px 8px; border-radius:12px; font-weight:700; font-size:11px; background:${district.color}22; color:${district.color};">
            ${severityLabel} · ${district.farms} ${escapeHtml(t('affectedFarms'))}
          </span>
          <div style="font-size:11px; color:#475569; margin-top:4px;">
            ${escapeHtml(isBn ? 'মৃত্যু' : 'Mortality')}: <strong>${district.mortalityTotal}</strong> · ULO ${district.sourceCounts.ulo_hospital} · BVC ${district.sourceCounts.bvc_vet} · AI ${district.sourceCounts.farmer_ai}
          </div>
          ${district.liveCases > 0 ? `<div style="font-size:10px; color:#059669; font-weight:700; margin-top:2px;">(${escapeHtml(t('liveLogsBadge', { count: district.liveCases }))})</div>` : ''}
          <small style="color: #64748b; display:block; margin-top:4px;">${riskLabel}</small>
        </div>
      `)

      marker.on('click', () => setSelectedDistrict(district.name))
      markersRef.current.push(marker)
    })
  }, [visibleDistricts, selectedDistrict, language, isBn, t])

  function selectDistrict(district) {
    setSelectedDistrict(district.name)
    mapRef.current?.flyTo(district.coordinates, 9, { animate: true, duration: 0.8 })
  }

  function centerOnLocation() {
    if (!navigator.geolocation || !mapRef.current) return
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const coordinates = [coords.latitude, coords.longitude]
      mapRef.current?.flyTo(coordinates, 10, { animate: true, duration: 0.8 })
      L.circleMarker(coordinates, { color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.9, radius: 8 })
        .addTo(mapRef.current)
        .bindPopup(escapeHtml(t('currentLocation')))
        .openPopup()
    })
  }

  function handleSurveillanceSubmitted(saved) {
    const refreshed = getLiveOutbreakDistricts()
    setOutbreakDistricts(refreshed)
    if (saved?.district) {
      setSelectedDistrict(saved.district)
      const match = refreshed.find((d) => d.name.toLowerCase() === saved.district.toLowerCase())
      if (match) {
        mapRef.current?.flyTo(match.coordinates, 9, { animate: true, duration: 0.8 })
      }
    }
    setSubmissionFeedback(saved)
  }

  const defaultReporterRole = role === 'REGISTERED_VET' ? 'bvc_vet' : 'ulo_hospital'
  const showBiosecurityPanel = Boolean(
    zoonoticOnly
    || activeSelectedDistrictObj?.isZoonotic
    || visibleDistricts.some((d) => d.isZoonotic)
  )

  return (
    <main className="veterinary-page epidemiology-page w-full min-w-0 max-w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Header + Submit Field / ULO Surveillance Report CTA */}
      <section className="veterinary-page-heading onehealth-header-row">
        <div>
          <span className="veterinary-kicker">{t('oneHealthKicker')}</span>
          <h1>{t('outbreakMap')}</h1>
          <p>{t('oneHealthSubtitle')}</p>
        </div>

        <button
          type="button"
          className="onehealth-submit-btn"
          onClick={() => setReportModalOpen(true)}
        >
          <ClipboardPlus size={16} aria-hidden="true" />
          <span>{t('submitSurveillanceTitle')}</span>
        </button>
      </section>

      {submissionFeedback && (
        <div className="onehealth-toast" role="status">
          <div>
            <strong>{t('surveillanceSavedTitle')}</strong>
            <span>
              {' — '}
              {t(`districts.${submissionFeedback.district}`, submissionFeedback.district)}
              {submissionFeedback.upazila ? ` (${submissionFeedback.upazila})` : ''} ·{' '}
              {getDiseaseDisplayLabel(submissionFeedback.disease, language, t)}
              {submissionFeedback.isZoonotic ? ` · ⚠️ ${t('zoonoticRiskShort')}` : ''}
            </span>
          </div>
          <button type="button" onClick={() => setSubmissionFeedback(null)} aria-label={t('close')}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Multi-Source Reporting Stats & One-Health Metrics */}
      <section className="onehealth-kpi-grid" aria-label={t('sourceBreakdownTitle')}>
        <article className="onehealth-kpi-card dark:bg-gray-800 dark:border-gray-700">
          <div className="onehealth-kpi-head">
            <span className="onehealth-source-icon is-ulo"><Building2 size={15} aria-hidden="true" /></span>
            <span>{isBn ? REPORTER_ROLES.ulo_hospital.shortBn : REPORTER_ROLES.ulo_hospital.shortEn}</span>
          </div>
          <div className="onehealth-kpi-value-row">
            <strong>{summary.sourceStats.ulo_hospital.total}</strong>
            <small>{summary.sourceStats.ulo_hospital.percentage}%</small>
            {summary.sourceStats.ulo_hospital.live > 0 && (
              <span className="onehealth-live-pill">+{summary.sourceStats.ulo_hospital.live}</span>
            )}
          </div>
          <span className="onehealth-kpi-sub">{isBn ? 'সরকারি প্রাণিসম্পদ হাসপাতাল রিপোর্ট' : 'Govt. Upazila Livestock Hospitals'}</span>
        </article>

        <article className="onehealth-kpi-card dark:bg-gray-800 dark:border-gray-700">
          <div className="onehealth-kpi-head">
            <span className="onehealth-source-icon is-bvc"><Stethoscope size={15} aria-hidden="true" /></span>
            <span>{isBn ? REPORTER_ROLES.bvc_vet.shortBn : REPORTER_ROLES.bvc_vet.shortEn}</span>
          </div>
          <div className="onehealth-kpi-value-row">
            <strong>{summary.sourceStats.bvc_vet.total}</strong>
            <small>{summary.sourceStats.bvc_vet.percentage}%</small>
            {summary.sourceStats.bvc_vet.live > 0 && (
              <span className="onehealth-live-pill">+{summary.sourceStats.bvc_vet.live}</span>
            )}
          </div>
          <span className="onehealth-kpi-sub">{isBn ? 'নিবন্ধিত ভেটেরিনারি চিকিৎসক' : 'BVC Registered Veterinarians'}</span>
        </article>

        <article className="onehealth-kpi-card dark:bg-gray-800 dark:border-gray-700">
          <div className="onehealth-kpi-head">
            <span className="onehealth-source-icon is-ai"><UserCheck size={15} aria-hidden="true" /></span>
            <span>{isBn ? REPORTER_ROLES.farmer_ai.shortBn : REPORTER_ROLES.farmer_ai.shortEn}</span>
          </div>
          <div className="onehealth-kpi-value-row">
            <strong>{summary.sourceStats.farmer_ai.total}</strong>
            <small>{summary.sourceStats.farmer_ai.percentage}%</small>
            {summary.sourceStats.farmer_ai.live > 0 && (
              <span className="onehealth-live-pill">+{summary.sourceStats.farmer_ai.live}</span>
            )}
          </div>
          <span className="onehealth-kpi-sub">{isBn ? 'খামারি এআই স্ক্যান ও ফিল্ড লগ' : 'Verified Farmer AI Field Scans'}</span>
        </article>

        <article className={`onehealth-kpi-card dark:bg-gray-800 dark:border-gray-700${summary.zoonoticDistrictCount > 0 ? ' is-zoonotic-alert' : ''}`}>
          <div className="onehealth-kpi-head">
            <span className="onehealth-source-icon is-zoonotic"><ShieldAlert size={15} aria-hidden="true" /></span>
            <span>{t('zoonoticAlertsStat')}</span>
          </div>
          <div className="onehealth-kpi-value-row">
            <strong>{summary.zoonoticDistrictCount}</strong>
            <small>{isBn ? `জেলা (${summary.zoonoticCaseCount} কেস)` : `districts (${summary.zoonoticCaseCount} cases)`}</small>
          </div>
          <span className="onehealth-kpi-sub">
            {isBn ? `মোট নথিভুক্ত মৃত্যু: ${summary.totalMortality} পাখি` : `Tracked mortality: ${summary.totalMortality} birds`}
          </span>
        </article>
      </section>

      {/* Interactive Satellite Map + Zoonotic Filter Toggle */}
      <section className="amr-map-card dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" aria-labelledby="live-epidemiology-title">
        <div className="map-card-heading map-card-heading--wrap">
          <div>
            <h2 id="live-epidemiology-title">{t('liveEpidemiologyMap')}</h2>
            <p>{t('mapPrivacyNotice')}</p>
          </div>

          <div className="map-actions map-actions--wrap">
            <button
              type="button"
              aria-pressed={zoonoticOnly}
              onClick={() => {
                const next = !zoonoticOnly
                if (next && activeSelectedDistrictObj && !activeSelectedDistrictObj.isZoonotic) {
                  setSelectedDistrict('')
                }
                setZoonoticOnly(next)
              }}
              className={`zoonotic-filter-toggle${zoonoticOnly ? ' is-active' : ''}`}
            >
              <ShieldAlert size={14} aria-hidden="true" />
              <span>{t('zoonoticOnlyToggle')}</span>
              <span className="zoonotic-filter-count">{totalZoonoticDistricts}</span>
            </button>

            <button className="map-locate-button" type="button" onClick={centerOnLocation}>
              <MapPin size={13} aria-hidden="true" />
              <span>{t('myLocation')}</span>
            </button>
          </div>
        </div>

        <div ref={mapContainerRef} className="amr-leaflet-map min-h-[430px]" style={{ height: '430px', minHeight: '430px', width: '100%' }} />

        <div className="onehealth-map-legend dark:bg-gray-900/60 dark:border-gray-700 dark:text-gray-300">
          <span><i className="legend-dot" style={{ background: '#dc2626' }} /> {t('severity.Critical')} (&ge;15)</span>
          <span><i className="legend-dot" style={{ background: '#ea580c' }} /> {t('severity.High')} (5–14)</span>
          <span><i className="legend-dot" style={{ background: '#d97706' }} /> {t('severity.Moderate')} (2–4)</span>
          <span className="legend-zoonotic"><i className="legend-ring" /> {t('zoonoticRiskShort')}</span>
        </div>
      </section>

      {/* One-Health Human Biosecurity Precautions Layer */}
      {showBiosecurityPanel && (
        <section
          className={`onehealth-biosecurity-panel dark:border-red-900/60 dark:bg-red-950/25${activeSelectedDistrictObj?.isZoonotic || zoonoticOnly ? ' is-emphasized' : ''}`}
          aria-labelledby="onehealth-biosecurity-title"
        >
          <div className="onehealth-biosecurity-head">
            <div>
              <span className="zoonotic-risk-badge">
                <AlertTriangle size={13} aria-hidden="true" />
                <span>{t('zoonoticRiskBadge')}</span>
              </span>
              <h2 id="onehealth-biosecurity-title">{t('humanBiosecurityTitle')}</h2>
              <p>
                {activeSelectedDistrictObj?.isZoonotic
                  ? (isBn
                      ? `${t(`districts.${activeSelectedDistrictObj.name}`, activeSelectedDistrictObj.name)} জেলায় সক্রিয় জুনোটিক ঝুঁকি (${activeSelectedDistrictObj.zoonoticDiseases.map((d) => getDiseaseDisplayLabel(d, language, t)).join(', ')}) — মানবদেহে সংক্রমণ রোধে নিচের জৈব-নিরাপত্তা কঠোরভাবে মেনে চলুন।`
                      : `Active zoonotic alert in ${activeSelectedDistrictObj.name} (${activeSelectedDistrictObj.zoonoticDiseases.join(', ')}). Enforce human biosecurity precautions immediately to prevent farm-to-human transmission.`)
                  : (isBn
                      ? 'বার্ড ফ্লু, সালমোনেলা, ক্যাম্পাইলোব্যাক্টার, ই. কোলাই বা রানীক্ষেত কনজাংটিভাইটিস সক্রিয় থাকা জেলাগুলোতে মানুষ ও খামারের নিরাপত্তায় নিচের নির্দেশনা অনুসরণ করুন।'
                      : 'Human biosecurity precautions are required in districts with active Avian Influenza, Salmonellosis, Campylobacteriosis, Colibacillosis, or Newcastle Conjunctivitis.')}
              </p>
            </div>

            <div className="onehealth-biosecurity-actions">
              <a className="ulo-call-btn" href={`tel:${DLS_EMERGENCY_HELPLINE}`}>
                <PhoneCall size={14} aria-hidden="true" />
                <span>{isBn ? `জরুরি DLS কল: ${DLS_EMERGENCY_HELPLINE}` : `Call DLS ${DLS_EMERGENCY_HELPLINE}`}</span>
              </a>
              <button
                type="button"
                className="ulo-portal-link"
                onClick={() => requestUloDirectoryModal({ district: selectedDistrict })}
              >
                <Building2 size={14} aria-hidden="true" />
                <span>{isBn ? 'নিকটস্থ সরকারি ULO' : 'Govt. ULO Directory'}</span>
              </button>
            </div>
          </div>

          <div className="onehealth-precautions-grid">
            {ZOONOTIC_HUMAN_PRECAUTIONS.map((step) => (
              <article key={step.id} className="onehealth-precaution-card dark:bg-gray-900/70 dark:border-red-900/40">
                <strong className="dark:text-red-200">{isBn ? step.titleBn : step.titleEn}</strong>
                <p className="dark:text-gray-300">{isBn ? step.detailBn : step.detailEn}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* District Outbreak Alerts Grid */}
      <section className="local-district-alerts dark:text-gray-100 dark:bg-gray-800/50 dark:border-gray-700" aria-labelledby="district-alerts-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="district-alerts-title" style={{ margin: 0 }}>{t('districtAlerts')}</h2>
            {zoonoticOnly && (
              <span className="zoonotic-risk-badge">
                <Filter size={11} aria-hidden="true" />
                <span>{t('zoonoticOnlyToggle')}</span>
              </span>
            )}
          </div>
          {selectedDistrict && (
            <button
              type="button"
              onClick={() => setSelectedDistrict('')}
              className="rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              {t('clearFilterDistrict', { district: t(`districts.${selectedDistrict}`, selectedDistrict) })} ✕
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          {visibleDistricts.map((district) => {
            const isSelected = selectedDistrict === district.name
            return (
              <button
                key={district.name}
                type="button"
                onClick={() => selectDistrict(district)}
                className={`district-surveillance-card dark:bg-gray-800 dark:text-gray-100 ${
                  isSelected ? 'is-selected' : 'dark:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <strong className="district-card-title">{t(`districts.${district.name}`, district.name)}</strong>
                    {district.upazilas?.length > 0 && (
                      <span className="district-upazilas">
                        {district.upazilas.slice(0, 3).join(', ')}
                      </span>
                    )}
                  </div>
                  {district.liveCases > 0 && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {t('liveBadge', { count: district.liveCases })}
                    </span>
                  )}
                </div>

                {district.isZoonotic && (
                  <div className="mt-2">
                    <span className="zoonotic-risk-badge">
                      <AlertTriangle size={11} aria-hidden="true" />
                      <span>{t('zoonoticRiskBadge')}</span>
                    </span>
                  </div>
                )}

                <div className="district-top-disease-block">
                  <span className="district-primary-disease">{getDiseaseDisplayLabel(district.disease, language, t)}</span>
                  {district.topDiseases.length > 1 && (
                    <div className="district-secondary-diseases">
                      {district.topDiseases.slice(1, 3).map((d) => (
                        <span key={d.disease} className="district-disease-chip dark:bg-gray-900 dark:text-gray-300">
                          {getDiseaseDisplayLabel(d.disease, language, t)} ({d.count})
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="district-card-metrics">
                  <span style={{ ...severityStyle(district.severity), borderRadius: 999, display: 'inline-block', fontSize: '.72rem', fontWeight: 800, padding: '.2rem .55rem' }}>
                    {t(`severity.${district.severity}`, district.severity)}
                  </span>
                  <span className="district-metric-pill dark:bg-gray-900 dark:text-gray-300">
                    {district.farms} {t('affectedFarms')}
                  </span>
                  <span className="district-metric-pill dark:bg-gray-900 dark:text-gray-300">
                    {isBn ? `মৃত্যু: ${district.mortalityTotal}` : `Mortality: ${district.mortalityTotal}`}
                  </span>
                </div>

                <div className="district-source-footer dark:border-gray-700 dark:text-gray-400">
                  <span>ULO: <strong>{district.sourceCounts.ulo_hospital}</strong></span>
                  <span>BVC: <strong>{district.sourceCounts.bvc_vet}</strong></span>
                  <span>AI: <strong>{district.sourceCounts.farmer_ai}</strong></span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Nationwide Top Circulating Diseases & Multi-Source Live Surveillance Feed */}
      <section className="onehealth-analytics-grid" aria-label={t('topDiseasesTitle')}>
        <article className="amr-analytics-card dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
          <div className="amr-analytics-heading">
            <div>
              <span className="veterinary-kicker">{t('oneHealthKicker')}</span>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Activity size={17} aria-hidden="true" />
                <span>{t('topDiseasesTitle')}</span>
              </h2>
              <p>
                {selectedDistrict
                  ? t('filteredByDistrict', { district: t(`districts.${selectedDistrict}`, selectedDistrict) })
                  : t('topDiseasesSubtitle')}
              </p>
            </div>
          </div>

          <div className="onehealth-disease-list">
            {summary.topDiseases.slice(0, 7).map((item) => (
              <div key={item.disease} className="onehealth-disease-row dark:border-gray-700 dark:bg-gray-900/50">
                <div className="onehealth-disease-row-top">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <strong>{getDiseaseDisplayLabel(item.disease, language, t)}</strong>
                    {item.isZoonotic && (
                      <span className="zoonotic-risk-badge is-compact">
                        ⚠️ {t('zoonoticRiskShort')}
                      </span>
                    )}
                  </div>
                  <span className="onehealth-disease-stats">
                    <strong>{item.count}</strong> {isBn ? 'রিপোর্ট' : 'cases'} ({item.percentage}%) ·{' '}
                    {isBn ? `মৃত্যু ${item.mortality}` : `${item.mortality} deaths`}
                  </span>
                </div>
                <ProgressBar percentage={item.percentage} color={item.isZoonotic ? '#dc2626' : '#15803d'} />
                <div className="onehealth-disease-districts">
                  {item.districts.map((dist) => t(`districts.${dist}`, dist)).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="amr-analytics-card dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
          <div className="amr-analytics-heading">
            <div>
              <span className="veterinary-kicker">{t('liveSurveillanceFeedKicker')}</span>
              <h2>{t('liveSurveillanceFeedTitle')}</h2>
              <p>{t('liveSurveillanceFeedSubtitle')}</p>
            </div>
          </div>

          <div className="onehealth-feed-list">
            {summary.recentFeed.map((item) => {
              const roleMeta = REPORTER_ROLES[item.reporterRole] || REPORTER_ROLES.farmer_ai
              return (
                <article key={item.id} className="onehealth-feed-item dark:border-gray-700 dark:bg-gray-900/50">
                  <div className="onehealth-feed-top">
                    <span className={`onehealth-role-pill is-${item.reporterRole}`}>
                      {isBn ? roleMeta.shortBn : roleMeta.shortEn}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.isLive && (
                        <span className="onehealth-live-pill">
                          {isBn ? 'নতুন লাইভ' : 'LIVE'}
                        </span>
                      )}
                      {item.zoonotic?.isZoonotic && (
                        <span className="zoonotic-risk-badge is-compact">⚠️ {t('zoonoticRiskShort')}</span>
                      )}
                    </div>
                  </div>

                  <div className="onehealth-feed-main">
                    <strong>{getDiseaseDisplayLabel(item.disease, language, t)}</strong>
                    <span>
                      {' — '}
                      {t(`districts.${item.district}`, item.district)}
                      {item.upazila ? `, ${item.upazila}` : ''} · {item.species || 'Poultry'}
                    </span>
                  </div>

                  <div className="onehealth-feed-meta dark:text-gray-400">
                    <span>{item.reporterName}</span>
                    {item.antibioticPrescribed && item.antibioticPrescribed !== 'None / Supportive Only' && (
                      <span> · Rx: <strong>{t(`antibiotics.generics.${item.antibioticPrescribed}`, item.antibioticPrescribed)}</strong></span>
                    )}
                    <span> · {isBn ? `মৃত্যু: ${item.mortalityCount || 0}` : `Mortality: ${item.mortalityCount || 0}`}</span>
                  </div>
                </article>
              )
            })}
          </div>
        </article>
      </section>

      <AntibioticHierarchy source={source} district={selectedDistrict} />

      {reportModalOpen && (
        <SurveillanceReportModal
          defaultDistrict={selectedDistrict || 'Rajshahi'}
          defaultRole={defaultReporterRole}
          onSubmitted={handleSurveillanceSubmitted}
          onClose={() => setReportModalOpen(false)}
        />
      )}
    </main>
  )
}
