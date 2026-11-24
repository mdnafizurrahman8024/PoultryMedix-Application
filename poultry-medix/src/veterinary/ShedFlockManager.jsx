import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Droplets,
  Pencil,
  Plus,
  SlidersHorizontal,
  Thermometer,
  Trash2,
} from 'lucide-react'
import { useLanguage } from '../context/useLanguage.js'
import {
  SHED_SPECIES,
  MANAGEMENT_STANDARDS_CITATION,
  THI_GUIDELINES_CITATION,
  getSheds,
  addShed,
  updateShed,
  deleteShed,
  evaluateAllSheds,
  evaluateShedThermalStress,
  formatPlacementDateInput,
  POULTRYMEDIX_SHEDS_UPDATED_EVENT,
} from '../lib/shedManager.js'
import './ShedFlockManager.css'

function severityBadgeStyles(severity, coldWarning) {
  if (severity === 'high') {
    return { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' }
  }
  if (severity === 'medium') {
    return { bg: '#ffedd5', color: '#9a3412', border: '#fed7aa' }
  }
  if (severity === 'low') {
    return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' }
  }
  if (coldWarning) {
    return { bg: '#e0f2fe', color: '#075985', border: '#bae6fd' }
  }
  if (severity === 'normal') {
    return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' }
  }
  return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' }
}

export default function ShedFlockManager({ weather, isOpen, onToggle }) {
  const { language } = useLanguage()
  const isBn = language === 'bn'

  const [internalOpen, setInternalOpen] = useState(false)
  const [quickSimOpen, setQuickSimOpen] = useState(false)
  const expanded = typeof isOpen === 'boolean' ? isOpen : internalOpen

  function handleAccordionToggle() {
    if (onToggle) onToggle()
    else setInternalOpen((prev) => !prev)
  }

  const [sheds, setSheds] = useState(() => getSheds())
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [shedName, setShedName] = useState('')
  const [species, setSpecies] = useState('Broiler')
  const [ageMode, setAgeMode] = useState('days')
  const [ageDays, setAgeDays] = useState('1')
  const [placementDate, setPlacementDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [birdCount, setBirdCount] = useState('500')

  const [useSimulatedWeather, setUseSimulatedWeather] = useState(false)
  const [simTempC, setSimTempC] = useState('31')
  const [simHumidity, setSimHumidity] = useState('72')

  const [quickSpecies, setQuickSpecies] = useState('Broiler')
  const [quickAge, setQuickAge] = useState('7')
  const [quickTempC, setQuickTempC] = useState('')
  const [quickHumidity, setQuickHumidity] = useState('')

  useEffect(() => {
    function syncSheds() {
      setSheds(getSheds())
    }
    window.addEventListener(POULTRYMEDIX_SHEDS_UPDATED_EVENT, syncSheds)
    window.addEventListener('storage', syncSheds)
    return () => {
      window.removeEventListener(POULTRYMEDIX_SHEDS_UPDATED_EVENT, syncSheds)
      window.removeEventListener('storage', syncSheds)
    }
  }, [])

  const activeWeather = useMemo(() => {
    if (useSimulatedWeather) {
      const tVal = Number(simTempC)
      const hVal = Number(simHumidity)
      if (Number.isFinite(tVal) && Number.isFinite(hVal)) {
        return { temperature: tVal, humidity: hVal, isSimulated: true }
      }
    }
    if (weather && Number.isFinite(Number(weather.temperature)) && Number.isFinite(Number(weather.humidity))) {
      return { temperature: Number(weather.temperature), humidity: Number(weather.humidity), isSimulated: false }
    }
    return null
  }, [useSimulatedWeather, simTempC, simHumidity, weather])

  const evaluation = useMemo(
    () => evaluateAllSheds(sheds, activeWeather?.temperature, activeWeather?.humidity),
    [sheds, activeWeather]
  )

  const quickCheckEval = useMemo(() => {
    const tempToUse = quickTempC !== '' ? Number(quickTempC) : activeWeather?.temperature
    const humToUse = quickHumidity !== '' ? Number(quickHumidity) : activeWeather?.humidity
    return evaluateShedThermalStress({
      species: quickSpecies,
      ageDays: Math.max(1, Math.floor(Number(quickAge) || 1)),
      tempC: tempToUse,
      humidity: humToUse,
    })
  }, [quickSpecies, quickAge, quickTempC, quickHumidity, activeWeather])

  const totalBirds = useMemo(
    () => sheds.reduce((sum, s) => sum + (Number(s.birdCount) || 0), 0),
    [sheds]
  )

  function openAddForm() {
    setEditingId(null)
    setShedName('')
    setSpecies('Broiler')
    setAgeMode('days')
    setAgeDays('1')
    setPlacementDate(new Date().toISOString().slice(0, 10))
    setBirdCount('500')
    setFormOpen(true)
  }

  function openEditForm(shed) {
    setEditingId(shed.id)
    setShedName(shed.name || '')
    setSpecies(shed.species || 'Broiler')
    setAgeMode('days')
    setAgeDays(String(shed.currentAgeDays || 1))
    setPlacementDate(formatPlacementDateInput(shed.placementTimestamp))
    setBirdCount(String(shed.birdCount || 100))
    setFormOpen(true)
  }

  function handleSaveShed(event) {
    event.preventDefault()
    const payload = {
      name: shedName,
      species,
      ageDays: ageMode === 'days' ? Number(ageDays) : undefined,
      placementDate: ageMode === 'date' ? placementDate : undefined,
      birdCount: Number(birdCount),
    }

    const updated = editingId
      ? updateShed(editingId, payload)
      : addShed(payload)

    setSheds(updated)
    setFormOpen(false)
    setEditingId(null)
  }

  function handleDeleteShed(id) {
    setSheds(deleteShed(id))
  }

  const activeTempC = activeWeather ? Math.round(activeWeather.temperature) : null
  const activeTempF = activeWeather ? Math.round((activeWeather.temperature * 9) / 5 + 32) : null
  const weatherReadout = activeTempC !== null ? `${activeTempC}°C (${activeTempF}°F)` : null
  const shedCountLabel = sheds.length === 0
    ? (isBn ? '০টি শেড' : '0 Sheds')
    : (isBn ? `${sheds.length}টি শেড` : `${sheds.length} Shed${sheds.length === 1 ? '' : 's'}`)

  const heatAlertCount = evaluation.activeAlerts.length
  const broodingNeedCount = evaluation.broodingHeatAlerts.length
  const hasHighHeat = evaluation.activeAlerts.some((report) => report.severity === 'high')

  let headerPillTone = 'home-status-pill--ok'
  let headerStatusText = isBn ? 'স্বাভাবিক' : 'Normal'
  if (sheds.length === 0) {
    headerPillTone = ''
    headerStatusText = isBn ? 'শেড যোগ করুন' : 'Add Shed'
  } else if (heatAlertCount > 0) {
    headerPillTone = hasHighHeat ? 'home-status-pill--danger' : 'home-status-pill--warn'
    headerStatusText = isBn
      ? (hasHighHeat ? `${heatAlertCount}টি উচ্চ তাপ-সতর্কতা` : `${heatAlertCount}টি তাপ-সতর্কতা`)
      : (hasHighHeat ? `${heatAlertCount} High Heat Alert${heatAlertCount > 1 ? 's' : ''}` : `${heatAlertCount} Heat Alert${heatAlertCount > 1 ? 's' : ''}`)
  } else if (broodingNeedCount > 0) {
    headerPillTone = 'home-status-pill--cold'
    headerStatusText = isBn ? `${broodingNeedCount}টি শেডে ব্রুডিং তাপ প্রয়োজন` : `${broodingNeedCount} Need Brooding Heat`
  } else if (!weatherReadout) {
    headerPillTone = ''
    headerStatusText = isBn ? 'আদর্শ তাপমাত্রা সক্রিয়' : 'Targets Ready'
  }

  const shedHeaderPillText = [shedCountLabel, weatherReadout, headerStatusText].filter(Boolean).join(' · ')

  return (
    <section
      id="shed-flock-manager"
      className={`shed-manager-card${expanded ? '' : ' is-collapsed'}`}
      aria-labelledby="shed-flock-manager-heading"
    >
      <button
        type="button"
        className="shed-accordion-trigger"
        aria-expanded={expanded}
        aria-controls="shed-flock-manager-body"
        onClick={handleAccordionToggle}
      >
        <div className="shed-accordion-lead">
          <span className="shed-accordion-icon"><Building2 size={18} aria-hidden="true" /></span>
          <div className="shed-accordion-copy">
            <span className="shed-manager-kicker">
              {isBn ? 'সেকশন ৩ · মাল্টি-শেড ও তাপ-পীড়ন রিপোর্ট' : 'Section 3 · Multi-Shed & Thermal Stress Engine'}
            </span>
            <h2 id="shed-flock-manager-heading">
              {isBn ? 'শেড ও ব্যাচ ফ্লক ম্যানেজার' : 'Flock Sheds & Age-Specific Heat-Stress Report'}
            </h2>
            <p>
              {isBn
                ? 'প্রতিটি শেডের প্রজাতি ও বয়স অনুযায়ী আদর্শ তাপমাত্রা, আর্দ্রতা ও হিট-স্ট্রেস ঝুঁকি পর্যবেক্ষণ করুন।'
                : 'Track unlimited poultry sheds with daily auto-advancing bird ages and USDA-ARS temperature + humidity alerts.'}
            </p>
          </div>
        </div>

        <div className="home-accordion-meta">
          <span className={`home-status-pill ${headerPillTone}`}>
            {heatAlertCount > 0 ? (
              <AlertTriangle size={12} aria-hidden="true" />
            ) : sheds.length > 0 && broodingNeedCount === 0 ? (
              <CheckCircle2 size={12} aria-hidden="true" />
            ) : (
              <Thermometer size={12} aria-hidden="true" />
            )}
            <span>{shedHeaderPillText}</span>
          </span>
          <ChevronRight
            size={18}
            className={`shed-accordion-chevron${expanded ? ' is-open' : ''}`}
            aria-hidden="true"
          />
        </div>
      </button>

      {expanded && (
        <div id="shed-flock-manager-body" className="shed-accordion-body">
          <div className="shed-header-actions shed-body-actions">
            <button
              type="button"
              onClick={() => setUseSimulatedWeather((prev) => !prev)}
              className={`shed-btn${useSimulatedWeather ? ' shed-btn--sim-active' : ''}`}
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              <span>
                {useSimulatedWeather
                  ? (isBn ? 'সিমুলেশন সক্রিয়' : 'Weather Sim: On')
                  : (isBn ? 'আবহাওয়া টেস্ট করুন' : 'Test Ambient Temp')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => (formOpen ? setFormOpen(false) : openAddForm())}
              className="shed-btn shed-btn--primary"
            >
              <Plus size={15} aria-hidden="true" />
              <span>{formOpen ? (isBn ? 'ফর্ম বন্ধ করুন' : 'Close Form') : (isBn ? 'নতুন শেড যোগ করুন' : 'Add Shed / Batch')}</span>
            </button>
          </div>

      {/* Summary Metrics Strip */}
      <div className="shed-summary-strip">
        <div className="shed-summary-metrics">
          <span>
            <strong>{sheds.length}</strong>{' '}
            {isBn ? 'টি সক্রিয় শেড' : `Active Shed${sheds.length === 1 ? '' : 's'}`}
          </span>
          <span>
            <strong>{totalBirds.toLocaleString()}</strong>{' '}
            {isBn ? 'টি মোট পাখি' : 'Total Birds'}
          </span>
          <span>
            <strong style={{ color: evaluation.activeAlerts.length > 0 ? '#dc2626' : '#15803d' }}>
              {evaluation.activeAlerts.length}
            </strong>{' '}
            {isBn ? 'টি তাপ-সতর্কতা' : `Heat Alert${evaluation.activeAlerts.length === 1 ? '' : 's'}`}
          </span>
        </div>

        <div className="shed-summary-weather">
          <Thermometer size={14} color="#15803d" aria-hidden="true" />
          {activeWeather ? (
            <span>
              {activeWeather.isSimulated ? (isBn ? 'টেস্ট আবহাওয়া: ' : 'Simulated: ') : (isBn ? 'বর্তমান আবহাওয়া: ' : 'Live: ')}
              <strong>
                {activeWeather.temperature}°C ({Math.round((activeWeather.temperature * 9) / 5 + 32)}°F)
              </strong>{' '}
              · <strong>{activeWeather.humidity}% RH</strong>
            </span>
          ) : (
            <span style={{ color: '#b45309' }}>
              {isBn ? 'লাইভ আবহাওয়া পাওয়া যায়নি — টেস্ট আবহাওয়া ব্যবহার করতে পারেন' : 'Weather unavailable — enable "Test Ambient Temp" to simulate stress'}
            </span>
          )}
        </div>
      </div>

      {/* Optional Ambient Simulation Controls */}
      {useSimulatedWeather && (
        <div className="shed-sim-bar">
          <label className="shed-field" style={{ flex: '0 1 150px' }}>
            <span>{isBn ? 'তাপমাত্রা (°C)' : 'Ambient Temp (°C)'}</span>
            <input
              type="number"
              step="0.5"
              min="-5"
              max="55"
              value={simTempC}
              onChange={(e) => setSimTempC(e.target.value)}
            />
          </label>
          <label className="shed-field" style={{ flex: '0 1 150px' }}>
            <span>{isBn ? 'আর্দ্রতা (% RH)' : 'Relative Humidity (%)'}</span>
            <input
              type="number"
              min="10"
              max="100"
              value={simHumidity}
              onChange={(e) => setSimHumidity(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => setUseSimulatedWeather(false)}
            className="shed-btn"
          >
            {isBn ? 'লাইভ আবহাওয়ায় ফিরুন' : 'Use Live Weather'}
          </button>
        </div>
      )}

      {/* Add / Edit Shed Form */}
      {formOpen && (
        <form onSubmit={handleSaveShed} className="shed-form-panel">
          <h3>
            {editingId
              ? (isBn ? 'শেডের তথ্য সম্পাদনা করুন' : 'Edit Shed / Batch Details')
              : (isBn ? `নতুন শেড যোগ করুন (Shed #${sheds.length + 1})` : `Add New Shed / Batch (Auto-Serial: Shed #${sheds.length + 1})`)}
          </h3>

          <div className="shed-form-grid">
            <label className="shed-field">
              <span>{isBn ? 'শেড বা ব্যাচের নাম' : 'Shed / Batch Name'}</span>
              <input
                type="text"
                maxLength={80}
                value={shedName}
                onChange={(e) => setShedName(e.target.value)}
                placeholder={`Shed #${editingId ? '' : sheds.length + 1} (e.g. North Shed)`}
              />
            </label>

            <label className="shed-field">
              <span>{isBn ? 'প্রজাতি / পাখির ধরন' : 'Species / Bird Type'}</span>
              <select value={species} onChange={(e) => setSpecies(e.target.value)}>
                {SHED_SPECIES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {isBn ? `${item.labelBn} (${item.labelEn})` : item.labelEn}
                  </option>
                ))}
              </select>
            </label>

            <div className="shed-field">
              <div className="shed-field-label-row">
                <span>
                  {ageMode === 'days'
                    ? (isBn ? 'বর্তমান বয়স (দিন)' : 'Current Age (Days)')
                    : (isBn ? 'বাচ্চা তোলার তারিখ' : 'Placement Date (Day 1)')}
                </span>
                <button
                  type="button"
                  onClick={() => setAgeMode((m) => (m === 'days' ? 'date' : 'days'))}
                  className="shed-link-btn"
                >
                  {ageMode === 'days' ? (isBn ? 'তারিখ দিন' : 'Use Date') : (isBn ? 'দিন লিখুন' : 'Use Age (Days)')}
                </button>
              </div>
              {ageMode === 'days' ? (
                <input
                  type="number"
                  min="1"
                  max="1000"
                  required
                  value={ageDays}
                  onChange={(e) => setAgeDays(e.target.value)}
                />
              ) : (
                <input
                  type="date"
                  required
                  max={new Date().toISOString().slice(0, 10)}
                  value={placementDate}
                  onChange={(e) => setPlacementDate(e.target.value)}
                />
              )}
            </div>

            <label className="shed-field">
              <span>{isBn ? 'পাখির সংখ্যা' : 'Bird Count'}</span>
              <input
                type="number"
                min="1"
                max="1000000"
                required
                value={birdCount}
                onChange={(e) => setBirdCount(e.target.value)}
              />
            </label>
          </div>

          <p className="shed-form-note">
            {isBn
              ? 'স্বয়ংক্রিয় বয়স গণনা: আজকের সংরক্ষিত তারিখ থেকে প্রতিদিন প্রতিটি শেডের বয়স স্বয়ংক্রিয়ভাবে ১ দিন করে বাড়বে।'
              : 'Auto-Incrementing Age Engine: Placement timestamp is saved so each shed advances automatically every 24 hours.'}
          </p>

          <div className="shed-form-footer">
            <button
              type="button"
              onClick={() => {
                setFormOpen(false)
                setEditingId(null)
              }}
              className="shed-btn"
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            <button type="submit" className="shed-btn shed-btn--primary">
              {editingId ? (isBn ? 'আপডেট সংরক্ষণ করুন' : 'Update Shed') : (isBn ? 'শেড সংরক্ষণ করুন' : 'Save Shed')}
            </button>
          </div>
        </form>
      )}

      {/* Shed-by-Shed Serial Heat-Stress Report View */}
      {evaluation.reports.length === 0 ? (
        <div className="shed-empty-state">
          <Building2 size={28} color="#15803d" aria-hidden="true" />
          <h3>
            {isBn ? 'এখনও কোনো শেড বা ব্যাচ যোগ করা হয়নি' : 'No Flock Sheds Added Yet'}
          </h3>
          <p>
            {isBn
              ? 'আপনার খামারের শেড যোগ করুন (যেমন Shed #1 ব্রয়লার ৬ দিন, Shed #2 লেয়ার ৩৫ দিন) এবং প্রতিদিনের বয়স-ভিত্তিক তাপমাত্রা ও আর্দ্রতা সতর্কতা দেখুন।'
              : 'Add your poultry sheds (e.g., Shed #1 Broiler Day 6, Shed #2 Layer Day 35, Shed #3 Duck Day 20) to get an automatic shed-by-shed serial heat-stress report.'}
          </p>
          <button type="button" onClick={openAddForm} className="shed-btn shed-btn--primary">
            <Plus size={14} aria-hidden="true" />
            <span>{isBn ? 'প্রথম শেড যোগ করুন' : 'Add Your First Shed'}</span>
          </button>
        </div>
      ) : (
        <div className="shed-serial-list">
          {evaluation.reports.map((report) => {
            const { shed, targets } = report
            const badge = severityBadgeStyles(report.severity, report.coldWarning)
            const speciesObj = SHED_SPECIES.find((s) => s.id === shed.species)

            return (
              <article key={shed.id} className="shed-report-card">
                <div className="shed-report-top">
                  <div className="shed-identity-group">
                    <div className="shed-identity-badges">
                      <span className="shed-serial-num">#{shed.serialNumber}</span>
                      <h3 className="shed-report-title">{shed.name}</h3>
                      <span className="shed-species-pill">
                        {isBn ? speciesObj?.labelBn || shed.species : shed.species}
                      </span>
                      <span className="shed-age-pill">
                        <Calendar size={11} aria-hidden="true" />
                        {isBn ? `বয়স: ${shed.currentAgeDays} দিন` : `Day ${shed.currentAgeDays}`} · {shed.birdCount?.toLocaleString()} {isBn ? 'পাখি' : 'birds'}
                      </span>
                    </div>
                    <p className="shed-stage-subtitle">
                      {isBn ? targets.stageLabelBn : targets.stageLabel}
                      {targets.toleranceNote ? ` · ${isBn ? targets.toleranceNoteBn : targets.toleranceNote}` : ''}
                    </p>
                  </div>

                  <div className="shed-status-controls">
                    <span
                      className="shed-alert-pill"
                      style={{ backgroundColor: badge.bg, color: badge.color, borderColor: badge.border }}
                    >
                      {report.severity === 'normal' && !report.coldWarning ? (
                        <CheckCircle2 size={13} aria-hidden="true" />
                      ) : (
                        <AlertTriangle size={13} aria-hidden="true" />
                      )}
                      <span>{isBn ? report.severityLabelBn : report.severityLabelEn}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => openEditForm(shed)}
                      className="shed-icon-btn"
                      aria-label={`Edit ${shed.name}`}
                      title={isBn ? 'সম্পাদনা' : 'Edit'}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteShed(shed.id)}
                      className="shed-icon-btn shed-icon-btn--danger"
                      aria-label={`Delete ${shed.name}`}
                      title={isBn ? 'মুছে ফেলুন' : 'Delete'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="shed-metrics-grid">
                  <div className="shed-metric-cell">
                    <span>
                      <Thermometer size={12} aria-hidden="true" />
                      {isBn ? 'আদর্শ তাপমাত্রা' : 'Ideal Temperature'}
                    </span>
                    <strong>
                      {targets.minTempC}°C–{targets.maxTempC}°C ({targets.minTempF}°F–{targets.maxTempF}°F)
                    </strong>
                  </div>

                  <div className="shed-metric-cell">
                    <span>
                      <Droplets size={12} aria-hidden="true" />
                      {isBn ? 'আদর্শ আর্দ্রতা (RH)' : 'Ideal Humidity (RH)'}
                    </span>
                    <strong>
                      {targets.minRh}%–{targets.maxRh}% RH
                    </strong>
                  </div>

                  <div className="shed-metric-cell">
                    <span>{isBn ? 'বর্তমান বনাম সর্বোচ্চ সীমা' : 'Ambient vs Max Limit'}</span>
                    <strong>
                      {report.hasWeather
                        ? `${report.ambientC}°C (${report.ambientF}°F) · ${report.humidity}% (${report.deltaC > 0 ? `+${report.deltaC}°C` : `${report.deltaC}°C`})`
                        : (isBn ? `সর্বোচ্চ সীমা: ${targets.maxTempC}°C` : `Max Limit: ${targets.maxTempC}°C`)}
                    </strong>
                  </div>
                </div>

                <p className="shed-advice-text">
                  {isBn ? report.adviceBn : report.adviceEn}
                </p>
                <p className="shed-citation">
                  {MANAGEMENT_STANDARDS_CITATION} · {THI_GUIDELINES_CITATION}.
                </p>
              </article>
            )
          })}
        </div>
      )}

      {/* Quick Check Any Age Simulator Collapsible Sub-Drawer */}
      <div className={`shed-simulator-panel${quickSimOpen ? '' : ' is-collapsed'}`}>
        <button
          type="button"
          className="shed-sim-drawer-trigger"
          aria-expanded={quickSimOpen}
          aria-controls="shed-quick-sim-body"
          onClick={() => setQuickSimOpen((prev) => !prev)}
        >
          <span className="shed-sim-drawer-lead">
            <ChevronRight
              size={16}
              className={`shed-accordion-chevron${quickSimOpen ? ' is-open' : ''}`}
              aria-hidden="true"
            />
            <span>
              {isBn ? 'যেকোনো বয়সের তাৎক্ষণিক যাচাই (সিমুলেটর)' : 'Quick Check Any Age (Simulator)'}
            </span>
          </span>
          <span className="shed-sim-drawer-badge">
            {isBn
              ? `${quickSpecies} · ${quickAge} দিন · ${quickCheckEval.targets.minTempC}–${quickCheckEval.targets.maxTempC}°C`
              : `${quickSpecies} · Day ${quickAge} · ${quickCheckEval.targets.minTempC}–${quickCheckEval.targets.maxTempC}°C`}
          </span>
        </button>

        {quickSimOpen && (
          <div id="shed-quick-sim-body" className="shed-sim-drawer-body">
            <p>
              {isBn
                ? 'সংরক্ষিত শেড পরিবর্তন না করেই যেকোনো প্রজাতি ও বয়সের আদর্শ তাপমাত্রা এবং তাপ-পীড়ন পরীক্ষা করুন।'
                : 'Test ideal brooding/housing targets and thermal stress risk for any bird age without changing your saved sheds.'}
            </p>

            <div className="shed-form-grid">
              <label className="shed-field">
                <span>{isBn ? 'প্রজাতি' : 'Species'}</span>
                <select value={quickSpecies} onChange={(e) => setQuickSpecies(e.target.value)}>
                  {SHED_SPECIES.map((s) => (
                    <option key={s.id} value={s.id}>{isBn ? s.labelBn : s.labelEn}</option>
                  ))}
                </select>
              </label>

              <label className="shed-field">
                <span>{isBn ? 'বয়স (দিন)' : 'Age (Days)'}</span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={quickAge}
                  onChange={(e) => setQuickAge(e.target.value)}
                />
              </label>

              <label className="shed-field">
                <span>{isBn ? 'টেস্ট তাপমাত্রা (°C)' : 'Test Temp (°C)'}</span>
                <input
                  type="number"
                  step="0.5"
                  placeholder={activeWeather ? String(activeWeather.temperature) : 'e.g. 31'}
                  value={quickTempC}
                  onChange={(e) => setQuickTempC(e.target.value)}
                />
              </label>

              <label className="shed-field">
                <span>{isBn ? 'টেস্ট আর্দ্রতা (%)' : 'Test RH (%)'}</span>
                <input
                  type="number"
                  min="10"
                  max="100"
                  placeholder={activeWeather ? String(activeWeather.humidity) : 'e.g. 72'}
                  value={quickHumidity}
                  onChange={(e) => setQuickHumidity(e.target.value)}
                />
              </label>
            </div>

            <div className="shed-simulator-result">
              <div className="shed-simulator-result-top">
                <div>
                  <span>{isBn ? quickCheckEval.targets.stageLabelBn : quickCheckEval.targets.stageLabel}: </span>
                  <span style={{ color: '#15803d' }}>
                    {quickCheckEval.targets.minTempC}°C–{quickCheckEval.targets.maxTempC}°C ({quickCheckEval.targets.minTempF}°F–{quickCheckEval.targets.maxTempF}°F)
                  </span>
                  <span> · RH {quickCheckEval.targets.minRh}%–{quickCheckEval.targets.maxRh}%</span>
                </div>

                {(() => {
                  const simBadge = severityBadgeStyles(quickCheckEval.severity, quickCheckEval.coldWarning)
                  return (
                    <span
                      className="shed-alert-pill"
                      style={{ backgroundColor: simBadge.bg, color: simBadge.color, borderColor: simBadge.border }}
                    >
                      {isBn ? quickCheckEval.severityLabelBn : quickCheckEval.severityLabelEn}
                    </span>
                  )
                })()}
              </div>
              <p className="shed-advice-text">
                {isBn ? quickCheckEval.adviceBn : quickCheckEval.adviceEn}
              </p>
              <p className="shed-citation">
                {MANAGEMENT_STANDARDS_CITATION} · {THI_GUIDELINES_CITATION}.
              </p>
            </div>
          </div>
        )}
      </div>
        </div>
      )}
    </section>
  )
}
