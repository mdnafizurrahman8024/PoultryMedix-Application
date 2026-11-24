import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import {
  getLiveOutbreakDistricts,
  getLiveAntibioticAnalytics,
  ANALYTICS_UPDATED_EVENT,
  PRESCRIPTION_DATA_CHANGED_EVENT,
} from '../lib/analyticsEngine.js'
import { CLINICAL_LOGS_UPDATED_EVENT } from '../lib/clinicalLogsStore.js'
import { useLanguage } from '../context/useLanguage.js'

const bangladeshCenter = [23.685, 90.3563]
const themeStyles = {
  emerald: { background: 'rgba(16, 185, 129, .13)', border: '#6ee7b7', accent: '#047857' },
  indigo: { background: 'rgba(79, 70, 229, .13)', border: '#a5b4fc', accent: '#3730a3' },
  rose: { background: 'rgba(244, 63, 94, .13)', border: '#fda4af', accent: '#be123c' },
  amber: { background: 'rgba(245, 158, 11, .15)', border: '#fcd34d', accent: '#b45309' },
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
      <span style={{ background: `linear-gradient(90deg, ${color}, #fbbf24)`, display: 'block', height: '100%', width: `${percentage}%` }} />
    </span>
  )
}

function AntibioticHierarchy({ source, district }) {
  const { t } = useLanguage()
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
      <div className="mb-4 rounded-xl border border-gray-200/70 bg-white/70 p-3.5 shadow-sm backdrop-blur-md dark:border-gray-700 dark:bg-gray-800/80">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            WHO AWaRe Classification Ratios
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            {district ? `Filtered: ${district}` : 'All Surveillance Districts'}
          </span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div style={{ width: `${aware.Access.percentage}%` }} className="bg-emerald-500 transition-all duration-300" title={`Access: ${aware.Access.percentage}%`} />
          <div style={{ width: `${aware.Watch.percentage}%` }} className="bg-amber-500 transition-all duration-300" title={`Watch: ${aware.Watch.percentage}%`} />
          <div style={{ width: `${aware.Reserve.percentage}%` }} className="bg-rose-600 transition-all duration-300" title={`Reserve: ${aware.Reserve.percentage}%`} />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <strong className="text-emerald-700 dark:text-emerald-400">Access:</strong> {aware.Access.percentage}% ({aware.Access.count || 0})
          </span>
          <span className="flex items-center gap-1">
            <strong className="text-amber-700 dark:text-amber-400">Watch:</strong> {aware.Watch.percentage}% ({aware.Watch.count || 0})
          </span>
          <span className="flex items-center gap-1">
            <strong className="text-rose-700 dark:text-rose-400">Reserve:</strong> {aware.Reserve.percentage}% ({aware.Reserve.count || 0})
          </span>
        </div>
      </div>

      <div className="mb-4 flex w-full min-w-0 flex-wrap items-center gap-2 p-3 lg:gap-[0.6rem]" style={{ backdropFilter: 'blur(14px)', background: 'rgba(255, 255, 255, .75)', border: '1px solid rgba(255, 255, 255, .6)', borderRadius: '1rem', boxShadow: '0 8px 20px rgba(15, 23, 42, .1)' }}>
        <strong className="w-full min-w-0 break-words sm:w-auto text-gray-900 dark:text-gray-900">
          {t('totalAnalyzed', { count: analytics.total })}
        </strong>
        {[
          ['all', t('allCombined')],
          ['home', t('homePageData')],
          ['consult', t('consultVetData')],
        ].map(([value, label]) => (
          <button key={value} type="button" onClick={() => window.dispatchEvent(new CustomEvent('poultrymedix-source-filter', { detail: value }))} className="min-w-0 max-w-full flex-[1_1_auto] whitespace-normal break-words text-center leading-snug transition-all active:scale-95 lg:flex-[0_1_auto] lg:break-normal lg:leading-normal lg:text-center" style={{ background: source === value ? '#0f766e' : 'rgba(255, 255, 255, .7)', border: 0, borderRadius: 999, color: source === value ? 'white' : '#334155', cursor: 'pointer', padding: '.45rem .7rem' }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {analytics.classes.map((classEntry, index) => {
          const theme = themeStyles[['emerald', 'indigo', 'rose', 'amber'][index % 4]]
          const classOpen = expandedClasses.has(classEntry.name)
          return (
            <article key={classEntry.name} className="dark:text-gray-900" style={{ backdropFilter: 'blur(18px)', background: theme.background, border: `1px solid ${theme.border}`, borderRadius: '1rem', boxShadow: '0 8px 24px rgba(15, 23, 42, .1)', padding: '1rem' }}>
              <button type="button" onClick={() => toggle(setExpandedClasses, classEntry.name)} aria-expanded={classOpen} className="cursor-pointer transition-all hover:-translate-y-0.5 active:scale-95 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700" style={{ alignItems: 'center', background: 'transparent', border: 0, color: theme.accent, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', padding: 0, width: '100%' }}>
                <span><strong>{t(`antibiotics.classes.${classEntry.name}`) || classEntry.name}</strong> · {classEntry.percentage}% · {classEntry.count} {t('prescriptions')}</span>
                <b aria-hidden="true">{classOpen ? '−' : '+'}</b>
              </button>
              <ProgressBar percentage={classEntry.percentage} color={theme.accent} />
              {classOpen && <div style={{ display: 'grid', gap: '.75rem', marginTop: '.85rem', paddingLeft: '.75rem' }}>
                {classEntry.generics.map((generic) => {
                  const genericKey = `${classEntry.name}-${generic.name}`
                  const genericOpen = expandedGenerics.has(genericKey)
                  return (
                    <div key={genericKey} className="dark:text-gray-900 dark:font-semibold" style={{ background: 'rgba(255, 255, 255, .45)', borderRadius: '.8rem', padding: '.7rem' }}>
                      <button type="button" onClick={() => toggle(setExpandedGenerics, genericKey)} aria-expanded={genericOpen} className="cursor-pointer transition-all active:scale-95 dark:text-gray-900 dark:hover:bg-gray-200 dark:focus:bg-gray-200" style={{ alignItems: 'center', background: 'transparent', border: 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', padding: 0, width: '100%' }}>
                        <span><strong>{t(`antibiotics.generics.${generic.name}`) || generic.name}</strong> · {generic.percentage}%</span><b>{genericOpen ? '−' : '+'}</b>
                      </button>
                      <ProgressBar percentage={generic.percentage} color={theme.accent} />
                      {genericOpen && <div style={{ display: 'grid', gap: '.7rem', marginTop: '.7rem' }}>
                        {generic.trades.map((trade) => (
                          <div key={`${genericKey}-${trade.name}-${trade.company}`}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{trade.name} <small>({trade.company})</small></span><strong>{trade.percentage}%</strong></div>
                            <ProgressBar percentage={trade.percentage} color={theme.accent} />
                            <div style={{ display: 'grid', gap: '.35rem', marginTop: '.45rem' }}>
                              {trade.generations.map((generation) => {
                                const generationKey = `${genericKey}-${trade.name}-${generation.name}`
                                const open = selectedGeneration === generationKey
                                return (
                                  <div key={generationKey}>
                                    <button type="button" onClick={() => setSelectedGeneration(open ? null : generationKey)} className="cursor-pointer transition-all hover:-translate-y-0.5 active:scale-95 dark:text-gray-900 dark:hover:bg-gray-200 dark:focus:bg-gray-200" style={{ background: 'rgba(255, 255, 255, .7)', border: '1px solid rgba(255, 255, 255, .8)', borderRadius: '.65rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', padding: '.45rem .6rem', textAlign: 'left', width: '100%' }}>
                                      <span>{generation.name}</span><strong>{generation.percentage}%</strong>
                                    </button>
                                    {open && <div className="dark:text-gray-900 dark:border-gray-300 dark:font-semibold" style={{ backdropFilter: 'blur(14px)', background: 'rgba(255, 255, 255, .82)', border: '1px solid rgba(255, 255, 255, .7)', borderRadius: '.7rem', fontSize: '.82rem', marginTop: '.3rem', padding: '.55rem' }}>
                                      WHO AWaRe: <strong>{generation.aware}</strong> · AMR Resistance Risk: <strong>{generation.risk}</strong> · Meat: <strong>{generation.meatDays}</strong> · Egg: <strong>{generation.eggDays}</strong>
                                    </div>}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>}
                    </div>
                  )
                })}
              </div>}
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default function EpidemiologyMap() {
  const { t } = useLanguage()
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const [outbreakDistricts, setOutbreakDistricts] = useState(() => getLiveOutbreakDistricts())
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [source, setSource] = useState('all')

  useEffect(() => {
    const onSourceFilter = (event) => setSource(event.detail || 'all')
    window.addEventListener('poultrymedix-source-filter', onSourceFilter)
    return () => window.removeEventListener('poultrymedix-source-filter', onSourceFilter)
  }, [])

  // Sync real-time updates from diagnostic and prescription logs
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

  // Initialize base Leaflet Map once
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

  // Sync dynamic markers whenever outbreakDistricts or selectedDistrict changes
  useEffect(() => {
    if (!mapRef.current) return

    // Clean up existing markers
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    outbreakDistricts.forEach((district) => {
      const isSelected = selectedDistrict === district.name
      const radius = district.severity === 'Critical' ? 14 : district.severity === 'High' ? 11 : 9
      const marker = L.circleMarker(district.coordinates, {
        color: district.color,
        fillColor: district.color,
        fillOpacity: isSelected ? 0.9 : 0.65,
        radius: isSelected ? radius + 4 : radius,
        weight: isSelected ? 3 : 2,
      }).addTo(mapRef.current)

      const districtLabel = t(`districts.${district.name}`) || district.name
      const diseaseLabel = t(`diseases.${district.disease}`) || district.disease
      const riskLabel = t(`risks.${district.risk}`) || district.risk
      const severityLabel = t(`severity.${district.severity}`) || district.severity

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 13px; line-height: 1.4;">
          <strong style="font-size: 14px; color: #1e293b;">${districtLabel}</strong><br />
          <span style="color: #475569;">${diseaseLabel}</span><br />
          <span style="display:inline-block; margin-top:4px; padding:2px 8px; border-radius:12px; font-weight:700; font-size:11px; background:${district.color}22; color:${district.color};">
            ${severityLabel} · ${district.farms} ${t('affectedFarms') || 'cases'}
          </span>
          ${district.liveCases > 0 ? `<br /><span style="font-size:10px; color:#059669; font-weight:600;">(+${district.liveCases} live logs)</span>` : ''}
          <br /><small style="color: #64748b; display:block; margin-top:4px;">${riskLabel}</small>
        </div>
      `)

      marker.on('click', () => setSelectedDistrict(district.name))
      markersRef.current.push(marker)
    })
  }, [outbreakDistricts, selectedDistrict, t])

  function selectDistrict(district) {
    setSelectedDistrict(district.name)
    mapRef.current?.flyTo(district.coordinates, 9, { animate: true, duration: 0.8 })
  }

  function centerOnLocation() {
    if (!navigator.geolocation || !mapRef.current) return
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const coordinates = [coords.latitude, coords.longitude]
      mapRef.current?.flyTo(coordinates, 10, { animate: true, duration: 0.8 })
      L.circleMarker(coordinates, { color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.9, radius: 8 }).addTo(mapRef.current).bindPopup(t('currentLocation')).openPopup()
    })
  }

  return (
    <main className="veterinary-page epidemiology-page w-full min-w-0 max-w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <section className="veterinary-page-heading">
        <span className="veterinary-kicker">{t('veterinaryTools')}</span>
        <h1>{t('outbreakMap')}</h1>
        <p>{t('outbreakMapDescription')}</p>
      </section>

      <section className="amr-map-card dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" aria-labelledby="live-epidemiology-title">
        <div className="map-card-heading" style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h2 id="live-epidemiology-title">{t('liveEpidemiologyMap')}</h2>
            <p>{t('mapPrivacyNotice')}</p>
          </div>
          <button className="map-locate-button" type="button" onClick={centerOnLocation}>
            {t('myLocation')}
          </button>
        </div>
        <div ref={mapContainerRef} className="amr-leaflet-map min-h-[450px]" style={{ height: '450px', minHeight: '450px', width: '100%' }} />
      </section>

      <section className="local-district-alerts dark:text-gray-100" aria-labelledby="district-alerts-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="district-alerts-title">{t('districtAlerts')}</h2>
          {selectedDistrict && (
            <button
              type="button"
              onClick={() => setSelectedDistrict('')}
              className="rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Clear Filter ({selectedDistrict}) ✕
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {outbreakDistricts.map((district) => {
            const isSelected = selectedDistrict === district.name
            return (
              <button
                key={district.name}
                type="button"
                onClick={() => selectDistrict(district)}
                className={`cursor-pointer transition-all duration-200 hover:-translate-y-1 active:scale-95 dark:bg-gray-800 dark:text-gray-100 ${
                  isSelected ? 'ring-2 ring-emerald-600 dark:ring-emerald-400' : 'dark:border-gray-700'
                }`}
                style={{
                  backdropFilter: 'blur(12px)',
                  background: isSelected ? 'rgba(236, 253, 245, 0.85)' : 'rgba(255, 255, 255, .75)',
                  border: isSelected ? '2px solid #059669' : '1px solid rgba(255, 255, 255, .6)',
                  borderRadius: '1rem',
                  boxShadow: '0 10px 28px rgba(15, 23, 42, .12)',
                  cursor: 'pointer',
                  padding: '1rem',
                  textAlign: 'left',
                }}
              >
                <div className="flex items-center justify-between">
                  <strong style={{ display: 'block' }}>{t(`districts.${district.name}`) || district.name}</strong>
                  {district.liveCases > 0 && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      +{district.liveCases} live
                    </span>
                  )}
                </div>
                <span style={{ display: 'block', margin: '.35rem 0' }}>{t(`diseases.${district.disease}`) || district.disease}</span>
                <span style={{ ...severityStyle(district.severity), borderRadius: 999, display: 'inline-block', fontSize: '.75rem', fontWeight: 800, padding: '.25rem .55rem' }}>
                  {t(`severity.${district.severity}`) || district.severity}
                </span>
                <small style={{ display: 'block', marginTop: '.65rem' }}>
                  {district.farms} {t('affectedFarms')}
                </small>
              </button>
            )
          })}
        </div>
      </section>

      <AntibioticHierarchy source={source} district={selectedDistrict} />
    </main>
  )
}
