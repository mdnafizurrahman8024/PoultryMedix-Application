import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useLanguage } from '../context/useLanguage.js'
import Icon from '../components/Icon.jsx'

const bangladeshCenter = [23.685, 90.3563]
const diseaseRatios = [
  { key: 'respiratory', ratio: 38 },
  { key: 'digestive', ratio: 27 },
  { key: 'parasitic', ratio: 21 },
  { key: 'other', ratio: 14 },
]

const antibioticClasses = [
  {
    name: 'Tetracyclines',
    ratio: 38,
    antibiotics: [
      { name: 'Doxycycline', ratio: 24, generations: [{ name: '3rd Gen', ratio: 62 }, { name: '2nd Gen', ratio: 38 }] },
      { name: 'Oxytetracycline', ratio: 14, generations: [{ name: '1st Gen', ratio: 100 }] },
    ],
  },
  {
    name: 'Beta-lactams',
    ratio: 31,
    antibiotics: [
      { name: 'Amoxicillin', ratio: 19, generations: [{ name: '3rd Gen', ratio: 70 }, { name: '2nd Gen', ratio: 30 }] },
      { name: 'Ampicillin', ratio: 12, generations: [{ name: '2nd Gen', ratio: 100 }] },
    ],
  },
  {
    name: 'Macrolides',
    ratio: 19,
    antibiotics: [
      { name: 'Tylosin', ratio: 19, generations: [{ name: '1st Gen', ratio: 100 }] },
    ],
  },
  {
    name: 'Sulfonamides',
    ratio: 12,
    antibiotics: [
      { name: 'Sulfadiazine', ratio: 12, generations: [{ name: '1st Gen', ratio: 100 }] },
    ],
  },
]

function MapViewport({ center }) {
  const map = useMap()

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true })
  }, [center, map])

  return null
}

function formatPercent(value, language) {
  return `${new Intl.NumberFormat(language === 'bn' ? 'bn-BD' : 'en').format(value)}%`
}

export default function EpidemiologyMap() {
  const { t, language } = useLanguage()
  const [center, setCenter] = useState(bangladeshCenter)
  const [view, setView] = useState('community')
  const [locationMessage, setLocationMessage] = useState('')
  const hasGeolocation = typeof navigator !== 'undefined' && Boolean(navigator.geolocation)

  useEffect(() => {
    if (!hasGeolocation) return undefined

    let active = true
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!active) return
        setCenter([coords.latitude, coords.longitude])
        setLocationMessage(t('mapGpsReady'))
      },
      () => {
        if (active) setLocationMessage(t('mapGpsFallback'))
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 600_000 },
    )

    return () => { active = false }
  }, [hasGeolocation, t])

  function centerOnCurrentLocation() {
    setLocationMessage('')
    if (!hasGeolocation) {
      setLocationMessage(t('mapLocationUnavailable'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCenter([coords.latitude, coords.longitude])
        setLocationMessage(t('mapGpsReady'))
      },
      () => setLocationMessage(t('mapGpsFallback')),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 600_000 },
    )
  }

  return (
    <div className="veterinary-page epidemiology-page">
      <section className="veterinary-page-heading">
        <span className="veterinary-kicker">{t('veterinaryToolsEyebrow')}</span>
        <h1>{t('amrMapTitle')}</h1>
        <p>{t('amrMapDescription')}</p>
      </section>

      <section className="amr-map-card" aria-label={t('amrMapTitle')}>
        <div className="map-card-heading">
          <div>
            <h2>{t('amrLiveMap')}</h2>
            <p role="status">{locationMessage || (hasGeolocation ? t('mapLocationLoading') : t('mapLocationUnavailable'))}</p>
          </div>
          <div className="map-actions">
            <button className="map-locate-button" type="button" onClick={centerOnCurrentLocation}>
              <Icon name="pin" size={15} />{t('mapMyLocation')}
            </button>
          </div>
        </div>
        <MapContainer center={center} zoom={7} scrollWheelZoom className="amr-leaflet-map">
          <MapViewport center={center} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </MapContainer>
        <p className="map-privacy-note"><Icon name="shield" size={14} />{t('mapDemoNotice')}</p>
      </section>

      <section className="local-district-alerts" aria-labelledby="local-district-alerts-title">
        <h3 id="local-district-alerts-title"><span aria-hidden="true">🚨</span>{t('localDistrictAlerts')}</h3>
        <p>{t('sampleDistrictAlertNotice')}</p>
        <ul>
          <li>{t('districtAlertPaba')}</li>
          <li>{t('districtAlertSavar')}</li>
        </ul>
      </section>

      <section className="amr-analytics-card" aria-labelledby="amr-analytics-title">
        <div className="amr-analytics-heading">
          <div className="veterinary-section-heading">
            <span className="veterinary-section-icon"><Icon name="chart" size={18} /></span>
            <div><h2 id="amr-analytics-title">{t('amrAnalyticsTitle')}</h2><p>{t('sampleAnalyticsNotice')}</p></div>
          </div>
          <div className="amr-view-toggle" role="group" aria-label={t('amrAnalyticsView')}>
            <button
              type="button"
              className={view === 'community' ? 'active' : ''}
              aria-pressed={view === 'community'}
              onClick={() => setView('community')}
            >{t('amrCommunityView')}</button>
            <button
              type="button"
              className={view === 'officer' ? 'active' : ''}
              aria-pressed={view === 'officer'}
              onClick={() => setView('officer')}
            >{t('amrOfficerView')}</button>
          </div>
        </div>
        <p className="amr-role-note">{view === 'officer' ? t('amrOfficerViewNotice') : t('amrCommunityViewNotice')}</p>

        <section className="amr-analytics-section" aria-labelledby="disease-ratio-title">
          <h3 id="disease-ratio-title">{t('currentDiseaseRatio')}</h3>
          <div className="disease-ratio-list">
            {diseaseRatios.map(({ key, ratio }) => (
              <div className="disease-ratio-row" key={key}>
                <div className="disease-ratio-label"><span>{t(`disease_${key}`)}</span><strong>{formatPercent(ratio, language)}</strong></div>
                <div className="disease-ratio-track" role="meter" aria-label={t(`disease_${key}`)} aria-valuemin="0" aria-valuemax="100" aria-valuenow={ratio}>
                  <span style={{ width: `${ratio}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="amr-analytics-section" aria-labelledby="class-usage-title">
          <h3 id="class-usage-title">{t('classToAntibioticUsage')}</h3>
          <div className="amr-hierarchy">
            {antibioticClasses.map((group) => (
              <details className="amr-class-group" key={group.name} open>
                <summary><span>{group.name}</span><strong>{t('mapUsageRatio')}: {formatPercent(group.ratio, language)}</strong></summary>
                <ul>
                  {group.antibiotics.map((antibiotic) => (
                    <li key={antibiotic.name}>
                      <span>{antibiotic.name}</span>
                      <span><strong>{formatPercent(antibiotic.ratio, language)}</strong><small>{t('specificAntibioticName')}</small></span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>

        <section className="amr-analytics-section" aria-labelledby="generation-usage-title">
          <h3 id="generation-usage-title">{t('antibioticToGenerationUsage')}</h3>
          <div className="amr-hierarchy">
            {antibioticClasses.flatMap((group) => group.antibiotics).map((antibiotic) => (
              <details className="amr-class-group" key={antibiotic.name}>
                <summary><span>{antibiotic.name}</span><strong>{t('specificAntibioticName')}</strong></summary>
                <ul>
                  {antibiotic.generations.map((generation) => (
                    <li key={generation.name}>
                      <span>{generation.name}</span>
                      <span><strong>{formatPercent(generation.ratio, language)}</strong><small>{t('antibioticGeneration')}</small></span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>

        <p className="veterinary-disclaimer">{t('amrDataDisclaimer')}</p>
      </section>
    </div>
  )
}
