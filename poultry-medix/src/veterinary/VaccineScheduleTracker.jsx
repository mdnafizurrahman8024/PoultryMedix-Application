import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bell,
  BellRing,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ShieldAlert,
  Syringe,
  X,
} from 'lucide-react'
import { useLanguage } from '../context/useLanguage.js'
import {
  getSheds,
  SHED_SPECIES,
  POULTRYMEDIX_SHEDS_UPDATED_EVENT,
} from '../lib/shedManager.js'
import {
  DLS_BLRI_CITATION,
  FAO_WOAH_PREP_CITATION,
  VACCINE_PREPARATION_CHECKLIST,
  getCompletedVaccinesMap,
  toggleVaccineCompleted,
  getShedVaccineSchedule,
  getConsolidatedVaccineAlarms,
  dispatchBrowserVaccineNotifications,
  toLocalDateKey,
  POULTRYMEDIX_VACCINES_UPDATED_EVENT,
} from '../lib/vaccineManager.js'
import './VaccineScheduleTracker.css'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function statusMeta(status, isBn) {
  switch (status) {
    case 'completed':
      return {
        label: isBn ? 'সম্পন্ন ✓' : 'Completed ✓',
        pillClass: 'vaccine-status-pill--completed',
        chipClass: 'vaccine-cal-chip--completed',
      }
    case 'due_today':
      return {
        label: isBn ? 'আজই দিতে হবে!' : 'Due Today',
        pillClass: 'vaccine-status-pill--due-today',
        chipClass: 'vaccine-cal-chip--urgent',
      }
    case 'overdue':
      return {
        label: isBn ? 'সময় পার হয়েছে' : 'Overdue',
        pillClass: 'vaccine-status-pill--overdue',
        chipClass: 'vaccine-cal-chip--urgent',
      }
    case 'due_tomorrow':
      return {
        label: isBn ? 'আগামীকাল (১ দিন বাকি)' : 'Tomorrow (1 Day Left)',
        pillClass: 'vaccine-status-pill--due-tomorrow',
        chipClass: 'vaccine-cal-chip--tomorrow',
      }
    case 'upcoming_booster':
      return {
        label: isBn ? 'আসন্ন বুস্টার' : 'Upcoming Booster',
        pillClass: 'vaccine-status-pill--booster',
        chipClass: 'vaccine-cal-chip--booster',
      }
    default:
      return {
        label: isBn ? 'নির্ধারিত' : 'Scheduled',
        pillClass: 'vaccine-status-pill--upcoming',
        chipClass: 'vaccine-cal-chip--upcoming',
      }
  }
}

export default function VaccineScheduleTracker() {
  const { language } = useLanguage()
  const isBn = language === 'bn'

  const [sheds, setSheds] = useState(() => getSheds())
  const [completedMap, setCompletedMap] = useState(() => getCompletedVaccinesMap())
  const [selectedShedFilter, setSelectedShedFilter] = useState('all')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarShedFilter, setCalendarShedFilter] = useState('all')
  const [notifPermission, setNotifPermission] = useState(() => (
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  ))

  useEffect(() => {
    function syncAll() {
      setSheds(getSheds())
      setCompletedMap(getCompletedVaccinesMap())
    }
    window.addEventListener(POULTRYMEDIX_SHEDS_UPDATED_EVENT, syncAll)
    window.addEventListener(POULTRYMEDIX_VACCINES_UPDATED_EVENT, syncAll)
    window.addEventListener('storage', syncAll)
    return () => {
      window.removeEventListener(POULTRYMEDIX_SHEDS_UPDATED_EVENT, syncAll)
      window.removeEventListener(POULTRYMEDIX_VACCINES_UPDATED_EVENT, syncAll)
      window.removeEventListener('storage', syncAll)
    }
  }, [])

  const alarms = useMemo(
    () => getConsolidatedVaccineAlarms(sheds, completedMap),
    [sheds, completedMap]
  )

  useEffect(() => {
    if (alarms.length > 0 && notifPermission === 'granted') {
      dispatchBrowserVaccineNotifications(alarms, isBn)
    }
  }, [alarms, notifPermission, isBn])

  const shedSchedules = useMemo(() => {
    const targetSheds = selectedShedFilter === 'all'
      ? sheds
      : sheds.filter((s) => s.id === selectedShedFilter)

    return targetSheds.map((shed) => {
      const items = getShedVaccineSchedule(shed, completedMap)
      const completedCount = items.filter((item) => item.isCompleted).length
      return { shed, items, completedCount }
    })
  }, [sheds, completedMap, selectedShedFilter])

  async function requestAlarmPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    try {
      const result = await Notification.requestPermission()
      setNotifPermission(result)
      if (result === 'granted' && alarms.length > 0) {
        dispatchBrowserVaccineNotifications(alarms, isBn)
      }
    } catch {
      // Ignore permission rejection
    }
  }

  function handleToggleVaccine(shedId, vaccineId) {
    setCompletedMap(toggleVaccineCompleted(shedId, vaccineId))
  }

  const hasUrgentAlarm = alarms.some((a) => a.status === 'due_today' || a.status === 'overdue')

  return (
    <section
      id="vaccine-schedule-tracker"
      className="vaccine-tracker-card"
      aria-labelledby="vaccine-tracker-heading"
    >
      {/* Header Row */}
      <div className="vaccine-tracker-header">
        <div className="vaccine-tracker-heading">
          <div className="vaccine-tracker-kicker">
            <Syringe size={14} aria-hidden="true" />
            <span>{isBn ? 'প্রজাতি-ভিত্তিক টিকা সময়সূচি ও ১-দিন পূর্বের অ্যালার্ম' : 'Species-Specific Immunization & 1-Day Alarms'}</span>
          </div>
          <h2 id="vaccine-tracker-heading">
            {isBn ? 'পোল্ট্রি ভ্যাকসিন শিডিউল ট্র্যাকার ও ক্যালেন্ডার' : 'Vaccine Schedule Tracker & Interactive Calendar'}
          </h2>
          <p>
            {isBn
              ? 'প্রতিটি শেডের পাখির ধরন অনুযায়ী আলাদা DLS/BLRI টিকা তালিকা, ১ দিন আগে সতর্কতা এবং ক্যালেন্ডার দেখুন।'
              : 'Automatically filtered by each shed’s exact species (Broiler, Layer, Sonali, Desi, Duck, Pigeon) with 1-day advance reminders.'}
          </p>
        </div>

        <div className="vaccine-header-actions">
          {notifPermission !== 'unsupported' && (
            <button
              type="button"
              onClick={requestAlarmPermission}
              className="vaccine-btn"
              title={isBn ? 'ব্রাউজার অ্যালার্ম চালু করুন' : 'Enable browser 1-day vaccine alerts'}
            >
              {notifPermission === 'granted' ? <BellRing size={14} color="#15803d" /> : <Bell size={14} />}
              <span>
                {notifPermission === 'granted'
                  ? (isBn ? 'পুশ অ্যালার্ম চালু' : 'Push Alerts: On')
                  : (isBn ? 'অ্যালার্ম চালু করুন' : 'Enable Alerts')}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setCalendarShedFilter(selectedShedFilter)
              setCalendarOpen(true)
            }}
            className="vaccine-btn vaccine-btn--primary"
          >
            <CalendarIcon size={15} aria-hidden="true" />
            <span>{isBn ? 'টিকা ক্যালেন্ডার দেখুন' : 'See Vaccine Schedule Calendar'}</span>
          </button>
        </div>
      </div>

      {/* Consolidated Multi-Shed 1-Day Advance & Same-Day Alarm Banner */}
      {alarms.length > 0 && (
        <div className={`vaccine-alarm-banner${hasUrgentAlarm ? ' vaccine-alarm-banner--urgent' : ''}`} role="region" aria-label="Vaccine alarms">
          <div className="vaccine-alarm-banner-head">
            <strong>
              <ShieldAlert size={16} aria-hidden="true" />
              <span>
                {isBn
                  ? `সতর্কতা: ${alarms.length}টি টিকা আজ/আগামীকাল নির্ধারিত আছে`
                  : `Multi-Shed Vaccine Alarm (${alarms.length} Action Item${alarms.length > 1 ? 's' : ''})`}
              </span>
            </strong>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {isBn ? 'সম্পন্ন হলে টিক চিহ্ন দিন' : 'Check off once administered'}
            </span>
          </div>

          <div className="vaccine-alarm-list">
            {alarms.map((alarm) => {
              const meta = statusMeta(alarm.status, isBn)
              return (
                <div className="vaccine-alarm-item" key={alarm.recordKey}>
                  <div className="vaccine-alarm-meta">
                    <span className="shed-serial-num">#{alarm.shedSerial}</span>
                    <strong>{alarm.shedName}</strong>
                    <span className="shed-species-pill">{alarm.species}</span>
                    <span>→ <strong>{isBn ? alarm.nameBn : alarm.name}</strong> ({isBn ? alarm.routeBn : alarm.route})</span>
                    {alarm.isBooster && <span className="vaccine-booster-badge">BOOSTER</span>}
                    <span className={`vaccine-status-pill ${meta.pillClass}`}>{meta.label}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleVaccine(alarm.shedId, alarm.id)}
                    className="vaccine-btn vaccine-btn--small vaccine-btn--primary"
                  >
                    <Check size={13} aria-hidden="true" />
                    <span>{isBn ? 'দেওয়া হয়েছে' : 'Mark Given'}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Official Vaccination Preparation Checklist Card */}
      <div className="vaccine-prep-card">
        <h3 className="vaccine-prep-title">
          <ClipboardCheck size={16} aria-hidden="true" />
          <span>{isBn ? 'ভ্যাকসিন প্রস্তুতির সরকারি নির্দেশিকা (চেকলিস্ট)' : 'Official Vaccination Preparation Checklist'}</span>
        </h3>
        <div className="vaccine-prep-grid">
          {VACCINE_PREPARATION_CHECKLIST.map((step) => (
            <div className="vaccine-prep-item" key={step.id}>
              <strong>{isBn ? step.titleBn : step.titleEn}</strong>
              <p>{isBn ? step.detailBn : step.detailEn}</p>
            </div>
          ))}
        </div>
        <p className="vaccine-prep-citation">{FAO_WOAH_PREP_CITATION}</p>
      </div>

      {/* Shed Filter Bar */}
      {sheds.length > 0 && (
        <div className="vaccine-filter-bar">
          <div className="vaccine-filter-pills" role="group" aria-label="Filter vaccine tracker by shed">
            <button
              type="button"
              className={`vaccine-filter-pill${selectedShedFilter === 'all' ? ' is-active' : ''}`}
              onClick={() => setSelectedShedFilter('all')}
            >
              {isBn ? `সব শেড (${sheds.length})` : `All Sheds (${sheds.length})`}
            </button>
            {sheds.map((shed) => (
              <button
                type="button"
                key={shed.id}
                className={`vaccine-filter-pill${selectedShedFilter === shed.id ? ' is-active' : ''}`}
                onClick={() => setSelectedShedFilter(shed.id)}
              >
                #{shed.serialNumber} {shed.name} ({shed.species})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Shed-by-Shed Species-Filtered Vaccine Lists */}
      {sheds.length === 0 ? (
        <div className="shed-empty-state">
          <Syringe size={26} color="#15803d" aria-hidden="true" />
          <h3>{isBn ? 'টিকা সময়সূচি দেখতে প্রথমে শেড যোগ করুন' : 'Add a Flock Shed Above to Generate Its Vaccine Schedule'}</h3>
          <p>
            {isBn
              ? 'শেড যোগ করার সাথে সাথে প্রজাতি অনুযায়ী (ব্রয়লার, লেয়ার, সোনালী, দেশি, হাঁস বা কবুতর) সঠিক DLS ও BLRI টিকা তালিকা ও অ্যালার্ম তৈরি হয়ে যাবে।'
              : 'Once you add a shed in the Flock Manager above, its exact species-filtered DLS/BLRI schedule and 1-day advance alarms appear here automatically.'}
          </p>
        </div>
      ) : (
        <div className="vaccine-shed-list">
          {shedSchedules.map(({ shed, items, completedCount }) => {
            const speciesObj = SHED_SPECIES.find((s) => s.id === shed.species)
            return (
              <article className="vaccine-shed-card" key={shed.id}>
                <div className="vaccine-shed-top">
                  <div>
                    <div className="shed-identity-badges">
                      <span className="shed-serial-num">#{shed.serialNumber}</span>
                      <h3 className="shed-report-title">{shed.name}</h3>
                      <span className="shed-species-pill">
                        {isBn ? speciesObj?.labelBn || shed.species : shed.species}
                      </span>
                      <span className="shed-age-pill">
                        {isBn ? `বয়স: ${shed.currentAgeDays} দিন` : `Day ${shed.currentAgeDays}`}
                      </span>
                    </div>
                    <span className="vaccine-shed-citation">{DLS_BLRI_CITATION}</span>
                  </div>

                  <span className="vaccine-progress-pill">
                    {completedCount} / {items.length} {isBn ? 'সম্পন্ন' : 'Given'}
                  </span>
                </div>

                <div className="vaccine-rows">
                  {items.map((item) => {
                    const meta = statusMeta(item.status, isBn)
                    const rowClass =
                      item.status === 'completed'
                        ? ' is-completed'
                        : item.status === 'due_today' || item.status === 'overdue'
                        ? ' is-due-today'
                        : item.status === 'due_tomorrow'
                        ? ' is-due-tomorrow'
                        : ''

                    return (
                      <div className={`vaccine-row${rowClass}`} key={item.id}>
                        <div className="vaccine-row-left">
                          <button
                            type="button"
                            className={`vaccine-check-btn${item.isCompleted ? ' is-checked' : ''}`}
                            aria-pressed={item.isCompleted}
                            aria-label={`Mark ${item.name} as ${item.isCompleted ? 'not given' : 'given'} for ${shed.name}`}
                            onClick={() => handleToggleVaccine(shed.id, item.id)}
                          >
                            {item.isCompleted && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                          </button>

                          <div className="vaccine-row-info">
                            <div className="vaccine-row-title-line">
                              <span className="vaccine-row-title">
                                {item.dayLabel}: {isBn ? item.nameBn : item.name}
                              </span>
                              {item.isBooster && <span className="vaccine-booster-badge">BOOSTER</span>}
                            </div>
                            <div className="vaccine-row-sub">
                              <span>{isBn ? 'প্রয়োগ পদ্ধতি:' : 'Route:'} <strong>{isBn ? item.routeBn : item.route}</strong></span>
                              {' · '}
                              <span>
                                {isBn ? 'তারিখ:' : 'Date:'}{' '}
                                <strong>
                                  {item.dueDateKey === item.windowEndKey
                                    ? item.dueDateKey
                                    : `${item.dueDateKey} – ${item.windowEndKey}`}
                                </strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="vaccine-row-badges">
                          <span className={`vaccine-status-pill ${meta.pillClass}`}>{meta.label}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Interactive Vaccine Schedule Calendar Modal */}
      {calendarOpen && (
        <VaccineCalendarModal
          sheds={sheds}
          completedMap={completedMap}
          initialFilter={calendarShedFilter}
          isBn={isBn}
          onToggleVaccine={handleToggleVaccine}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </section>
  )
}

function VaccineCalendarModal({ sheds, completedMap, initialFilter, isBn, onToggleVaccine, onClose }) {
  const [shedFilter, setShedFilter] = useState(initialFilter || 'all')
  const [cursorDate, setCursorDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDateKey, setSelectedDateKey] = useState(() => toLocalDateKey(new Date()))

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const eventsByDate = useMemo(() => {
    const filteredSheds = shedFilter === 'all' ? sheds : sheds.filter((s) => s.id === shedFilter)
    const map = {}
    filteredSheds.forEach((shed) => {
      const items = getShedVaccineSchedule(shed, completedMap)
      items.forEach((item) => {
        if (!map[item.dueDateKey]) map[item.dueDateKey] = []
        map[item.dueDateKey].push(item)
      })
    })
    return map
  }, [sheds, completedMap, shedFilter])

  const calendarCells = useMemo(() => {
    const year = cursorDate.getFullYear()
    const month = cursorDate.getMonth()
    const firstDayOfMonth = new Date(year, month, 1)
    const startOffset = firstDayOfMonth.getDay()
    const startCellDate = new Date(year, month, 1 - startOffset)

    const cells = []
    for (let i = 0; i < 42; i += 1) {
      const d = new Date(startCellDate.getFullYear(), startCellDate.getMonth(), startCellDate.getDate() + i)
      const dateKey = toLocalDateKey(d)
      cells.push({
        dateKey,
        dayNum: d.getDate(),
        isCurrentMonth: d.getMonth() === month,
        isToday: dateKey === toLocalDateKey(new Date()),
        events: eventsByDate[dateKey] || [],
      })
    }
    return cells
  }, [cursorDate, eventsByDate])

  const selectedEvents = eventsByDate[selectedDateKey] || []
  const monthLabel = cursorDate.toLocaleString(isBn ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' })

  return createPortal(
    <div
      className="vaccine-calendar-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section
        className="vaccine-calendar-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vaccine-calendar-title"
      >
        <header>
          <div>
            <span className="vaccine-tracker-kicker">
              <CalendarIcon size={13} aria-hidden="true" />
              <span>{isBn ? 'টিকা সময়সূচি ক্যালেন্ডার' : 'Immunization Calendar'}</span>
            </span>
            <h2 id="vaccine-calendar-title">
              {isBn ? 'মাল্টি-শেড ভ্যাকসিন ক্যালেন্ডার' : 'Multi-Shed Vaccine Schedule Calendar'}
            </h2>
          </div>
          <button type="button" className="vaccine-calendar-close" aria-label="Close calendar" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="vaccine-calendar-body">
          {/* Toolbar & Filter */}
          <div className="vaccine-calendar-toolbar">
            <div className="vaccine-month-nav">
              <button
                type="button"
                className="vaccine-btn vaccine-btn--small"
                onClick={() => setCursorDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                aria-label="Previous month"
              >
                <ChevronLeft size={14} />
              </button>
              <strong>{monthLabel}</strong>
              <button
                type="button"
                className="vaccine-btn vaccine-btn--small"
                onClick={() => setCursorDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                aria-label="Next month"
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                className="vaccine-btn vaccine-btn--small"
                onClick={() => {
                  const now = new Date()
                  setCursorDate(new Date(now.getFullYear(), now.getMonth(), 1))
                  setSelectedDateKey(toLocalDateKey(now))
                }}
              >
                {isBn ? 'আজ' : 'Today'}
              </button>
            </div>

            <label className="shed-field" style={{ flex: '0 1 220px' }}>
              <select value={shedFilter} onChange={(e) => setShedFilter(e.target.value)} aria-label="Select shed calendar filter">
                <option value="all">{isBn ? `সব শেড (${sheds.length})` : `All Sheds (${sheds.length})`}</option>
                {sheds.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.serialNumber} {s.name} ({s.species})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Color-Coded Status Legend */}
          <div className="vaccine-legend">
            <span className="vaccine-legend-item">
              <span className="vaccine-legend-dot" style={{ background: '#16a34a' }} />
              {isBn ? 'সম্পন্ন (✓)' : 'Completed (✓)'}
            </span>
            <span className="vaccine-legend-item">
              <span className="vaccine-legend-dot" style={{ background: '#9333ea' }} />
              {isBn ? 'বুস্টার (BOOSTER)' : 'Booster'}
            </span>
            <span className="vaccine-legend-item">
              <span className="vaccine-legend-dot" style={{ background: '#dc2626' }} />
              {isBn ? 'আজ / মেয়াদোত্তীর্ণ' : 'Due Today / Overdue'}
            </span>
            <span className="vaccine-legend-item">
              <span className="vaccine-legend-dot" style={{ background: '#d97706' }} />
              {isBn ? 'আগামীকাল (১ দিন বাকি)' : 'Due Tomorrow (1d)'}
            </span>
            <span className="vaccine-legend-item">
              <span className="vaccine-legend-dot" style={{ background: '#0284c7' }} />
              {isBn ? 'আসন্ন ডোজ' : 'Upcoming'}
            </span>
          </div>

          {/* Monthly Calendar Grid */}
          <div className="vaccine-calendar-grid">
            {WEEKDAYS.map((day) => (
              <div className="vaccine-weekday-head" key={day}>{day}</div>
            ))}

            {calendarCells.map((cell) => (
              <button
                type="button"
                key={cell.dateKey}
                onClick={() => setSelectedDateKey(cell.dateKey)}
                className={`vaccine-day-cell${!cell.isCurrentMonth ? ' is-outside' : ''}${cell.isToday ? ' is-today' : ''}${selectedDateKey === cell.dateKey ? ' is-selected' : ''}`}
              >
                <span className="vaccine-day-number">{cell.dayNum}</span>
                <div className="vaccine-day-chips">
                  {cell.events.slice(0, 3).map((ev) => {
                    const meta = statusMeta(ev.status, isBn)
                    return (
                      <span
                        key={ev.recordKey}
                        className={`vaccine-cal-chip ${meta.chipClass}`}
                        title={`#${ev.shedSerial} ${ev.shedName}: ${ev.name}`}
                      >
                        {ev.isCompleted ? '✓ ' : ev.isBooster ? 'BOOSTER ' : ''}
                        #{ev.shedSerial}
                      </span>
                    )
                  })}
                  {cell.events.length > 3 && (
                    <span className="vaccine-cal-chip vaccine-cal-chip--upcoming">+{cell.events.length - 3}</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Clicked Date Event Detail Box */}
          <div className="vaccine-day-detail">
            <h4>
              {isBn ? `তারিখ: ${selectedDateKey} — নির্ধারিত টিকাসমূহ` : `Schedule for ${selectedDateKey}`}
            </h4>
            {selectedEvents.length === 0 ? (
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                {sheds.length === 0
                  ? (isBn ? 'ক্যালেন্ডারে দেখতে প্রথমে অন্তত একটি শেড যোগ করুন।' : 'Add a flock shed to populate calendar vaccine dates.')
                  : (isBn ? 'এই তারিখে কোনো টিকা নির্ধারিত নেই।' : 'No vaccinations scheduled to start on this date.')}
              </p>
            ) : (
              <div className="vaccine-rows">
                {selectedEvents.map((ev) => {
                  const meta = statusMeta(ev.status, isBn)
                  return (
                    <div className={`vaccine-row${ev.isCompleted ? ' is-completed' : ''}`} key={ev.recordKey}>
                      <div className="vaccine-row-info">
                        <div className="vaccine-row-title-line">
                          <span className="shed-serial-num">#{ev.shedSerial}</span>
                          <strong>{ev.shedName}</strong>
                          <span className="shed-species-pill">{ev.species}</span>
                          <span className="vaccine-row-title">{isBn ? ev.nameBn : ev.name}</span>
                          {ev.isBooster && <span className="vaccine-booster-badge">BOOSTER</span>}
                        </div>
                        <div className="vaccine-row-sub">
                          {ev.dayLabel} · {isBn ? 'পদ্ধতি:' : 'Route:'} <strong>{isBn ? ev.routeBn : ev.route}</strong> · {meta.label}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleVaccine(ev.shedId, ev.id)}
                        className={`vaccine-btn vaccine-btn--small${ev.isCompleted ? '' : ' vaccine-btn--primary'}`}
                      >
                        <Check size={13} aria-hidden="true" />
                        <span>{ev.isCompleted ? (isBn ? 'দেওয়া সম্পন্ন ✓' : 'Given ✓') : (isBn ? 'দেওয়া হয়েছে চিহ্ন দিন' : 'Mark as Given')}</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <footer className="vaccine-calendar-footer">
          <button type="button" className="vaccine-btn" onClick={onClose}>
            {isBn ? 'বন্ধ করুন' : 'Close'}
          </button>
        </footer>
      </section>
    </div>,
    document.body
  )
}
