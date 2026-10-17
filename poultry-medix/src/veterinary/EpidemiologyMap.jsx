import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import {
  getPrescriptionAnalytics,
  prescriptionDataChangedEvent,
} from './prescriptionAnalytics.js'
import { useLanguage } from '../context/useLanguage.js'

const bangladeshCenter = [23.685, 90.3563]
const themeStyles = {
  emerald: { background: 'rgba(16, 185, 129, .13)', border: '#6ee7b7', accent: '#047857' },
  indigo: { background: 'rgba(79, 70, 229, .13)', border: '#a5b4fc', accent: '#3730a3' },
  rose: { background: 'rgba(244, 63, 94, .13)', border: '#fda4af', accent: '#be123c' },
  amber: { background: 'rgba(245, 158, 11, .15)', border: '#fcd34d', accent: '#b45309' },
}

const outbreakDistricts = [
  { name: 'Rajshahi', coordinates: [24.3745, 88.6042], disease: 'Avian Influenza', severity: 'Critical', farms: 18, risk: 'High AMR risk', color: '#dc2626' },
  { name: 'Bogura', coordinates: [24.8481, 89.372], disease: 'Newcastle / Ranikhet', severity: 'High', farms: 12, risk: 'Elevated AMR risk', color: '#ea580c' },
  { name: 'Gazipur', coordinates: [24.0958, 90.4125], disease: 'Gumboro', severity: 'Moderate', farms: 9, risk: 'Moderate AMR risk', color: '#d97706' },
  { name: 'Mymensingh', coordinates: [24.7471, 90.4203], disease: 'Coccidiosis', severity: 'High', farms: 15, risk: 'Elevated AMR risk', color: '#ea580c' },
  { name: 'Cumilla', coordinates: [23.4607, 91.1809], disease: 'Newcastle / Ranikhet', severity: 'Moderate', farms: 7, risk: 'Moderate AMR risk', color: '#d97706' },
]

function severityStyle(severity) {
  if (severity === 'Critical') return { background: '#fee2e2', color: '#b91c1c' }
  if (severity === 'High') return { background: '#ffedd5', color: '#c2410c' }
  return { background: '#fef3c7', color: '#a16207' }
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
  const [analytics, setAnalytics] = useState(() => getPrescriptionAnalytics(source, district))
  const [expandedClasses, setExpandedClasses] = useState(() => new Set(['Tetracyclines']))
  const [expandedGenerics, setExpandedGenerics] = useState(() => new Set())
  const [selectedGeneration, setSelectedGeneration] = useState(null)

  useEffect(() => {
    const refresh = () => setAnalytics(getPrescriptionAnalytics(source, district))
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener(prescriptionDataChangedEvent, refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener(prescriptionDataChangedEvent, refresh)
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

  return (
    <section className="amr-analytics-card dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" aria-labelledby="antibiotic-hierarchy-title">
      <div className="amr-analytics-heading">
        <div>
          <span className="veterinary-kicker">{t('levelsThree')}</span>
          <h2 id="antibiotic-hierarchy-title">{t('antibioticHierarchy')}</h2>
          <p>{t('antibioticHierarchyDescription')}</p>
        </div>
      </div>
      <div style={{ alignItems: 'center', backdropFilter: 'blur(14px)', background: 'rgba(255, 255, 255, .75)', border: '1px solid rgba(255, 255, 255, .6)', borderRadius: '1rem', boxShadow: '0 8px 20px rgba(15, 23, 42, .1)', display: 'flex', flexWrap: 'wrap', gap: '.6rem', marginBottom: '1rem', padding: '.75rem' }}>
        <strong>{t('totalAnalyzed', { count: analytics.total })}</strong>
        {[
          ['all', t('allCombined')],
          ['home', t('homePageData')],
          ['consult', t('consultVetData')],
        ].map(([value, label]) => (
          <button key={value} type="button" onClick={() => window.dispatchEvent(new CustomEvent('poultrymedix-source-filter', { detail: value }))} className="cursor-pointer transition-all active:scale-95" style={{ background: source === value ? '#0f766e' : 'rgba(255, 255, 255, .7)', border: 0, borderRadius: 999, color: source === value ? 'white' : '#334155', cursor: 'pointer', padding: '.45rem .7rem' }}>
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
                <span><strong>{t(`antibiotics.classes.${classEntry.name}`)}</strong> · {classEntry.percentage}% · {classEntry.count} {t('prescriptions')}</span>
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
                        <span><strong>{t(`antibiotics.generics.${generic.name}`)}</strong> · {generic.percentage}%</span><b>{genericOpen ? '−' : '+'}</b>
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
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [source, setSource] = useState('all')

  useEffect(() => {
    const onSourceFilter = (event) => setSource(event.detail || 'all')
    window.addEventListener('poultrymedix-source-filter', onSourceFilter)
    return () => window.removeEventListener('poultrymedix-source-filter', onSourceFilter)
  }, [])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return undefined
    const map = L.map(mapContainerRef.current, { center: bangladeshCenter, zoom: 7 })
    mapRef.current = map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map)
    outbreakDistricts.forEach((district) => {
      const marker = L.circleMarker(district.coordinates, { color: district.color, fillColor: district.color, fillOpacity: .65, radius: district.severity === 'Critical' ? 13 : 10, weight: 2 }).addTo(map)
      marker.bindPopup(`<strong>${t(`districts.${district.name}`)}</strong><br />${t(`diseases.${district.disease}`)}<br />${t(`risks.${district.risk}`)}`)
      marker.on('click', () => setSelectedDistrict(district.name))
    })
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [t])

  function selectDistrict(district) {
    setSelectedDistrict(district.name)
    mapRef.current?.flyTo(district.coordinates, 9, { animate: true, duration: .8 })
  }

  function centerOnLocation() {
    if (!navigator.geolocation || !mapRef.current) return
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const coordinates = [coords.latitude, coords.longitude]
      mapRef.current?.flyTo(coordinates, 10, { animate: true, duration: .8 })
      L.circleMarker(coordinates, { color: '#2563eb', fillColor: '#60a5fa', fillOpacity: .9, radius: 8 }).addTo(mapRef.current).bindPopup(t('currentLocation')).openPopup()
    })
  }

  return (
    <main className="veterinary-page epidemiology-page bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <section className="veterinary-page-heading"><span className="veterinary-kicker">{t('veterinaryTools')}</span><h1>{t('outbreakMap')}</h1><p>{t('outbreakMapDescription')}</p></section>
      <section className="amr-map-card dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" aria-labelledby="live-epidemiology-title">
        <div className="map-card-heading" style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <div><h2 id="live-epidemiology-title">{t('liveEpidemiologyMap')}</h2><p>{t('mapPrivacyNotice')}</p></div>
          <button className="map-locate-button" type="button" onClick={centerOnLocation}>{t('myLocation')}</button>
        </div>
        <div ref={mapContainerRef} className="amr-leaflet-map min-h-[450px]" style={{ height: '450px', minHeight: '450px', width: '100%' }} />
      </section>
      <section className="local-district-alerts dark:text-gray-100" aria-labelledby="district-alerts-title">
        <h2 id="district-alerts-title">{t('districtAlerts')}</h2>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {outbreakDistricts.map((district) => <button key={district.name} type="button" onClick={() => selectDistrict(district)} className="cursor-pointer transition-all duration-200 hover:-translate-y-1 active:scale-95 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" style={{ backdropFilter: 'blur(12px)', background: 'rgba(255, 255, 255, .75)', border: '1px solid rgba(255, 255, 255, .6)', borderRadius: '1rem', boxShadow: '0 10px 28px rgba(15, 23, 42, .12)', cursor: 'pointer', padding: '1rem', textAlign: 'left' }}><strong style={{ display: 'block' }}>{t(`districts.${district.name}`)}</strong><span style={{ display: 'block', margin: '.35rem 0' }}>{t(`diseases.${district.disease}`)}</span><span style={{ ...severityStyle(district.severity), borderRadius: 999, display: 'inline-block', fontSize: '.75rem', fontWeight: 800, padding: '.25rem .55rem' }}>{t(`severity.${district.severity}`)}</span><small style={{ display: 'block', marginTop: '.65rem' }}>{district.farms} {t('affectedFarms')}</small></button>)}
        </div>
      </section>
      <AntibioticHierarchy source={source} district={selectedDistrict} />
    </main>
  )
}
