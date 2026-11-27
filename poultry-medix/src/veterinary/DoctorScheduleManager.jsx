import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, Lock, Save } from 'lucide-react'
import {
  formatSlotTimeDisplay,
  generateSlotsFromWindow,
  getDoctorSchedule,
  getSlotsForDoctorDate,
  saveDoctorScheduleConfig,
} from '../lib/doctorsStore.js'
import { getLocalTodayDateStr } from '../lib/telehealthNotifier.js'
import { useLanguage } from '../context/useLanguage.js'

function getUpcomingDateWindow(days = 7) {
  const base = new Date()
  const dates = []
  for (let i = 0; i < days; i += 1) {
    const dt = new Date(base)
    dt.setDate(base.getDate() + i)
    dates.push(getLocalTodayDateStr(dt))
  }
  return dates
}

export default function DoctorScheduleManager({
  doctorSession,
  doctorId,
  slotVersion = 0,
  onScheduleUpdated,
}) {
  const { t, language } = useLanguage()
  const isBn = language === 'bn'
  const todayStr = getLocalTodayDateStr()
  const selectableDates = useMemo(() => getUpcomingDateWindow(7), [])

  const initialSchedule = useMemo(
    () => getDoctorSchedule(doctorId, todayStr),
    [doctorId, todayStr]
  )

  const [activeDates, setActiveDates] = useState(() => initialSchedule.activeDates)
  const [startTime, setStartTime] = useState(() => initialSchedule.startTime)
  const [endTime, setEndTime] = useState(() => initialSchedule.endTime)
  const [slotDurationMins, setSlotDurationMins] = useState(() => String(initialSchedule.slotDurationMins))
  const [inspectDate, setInspectDate] = useState(() => initialSchedule.activeDates[0] || todayStr)
  const [feedback, setFeedback] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const previewSlots = useMemo(
    () => generateSlotsFromWindow(startTime, endTime, Number(slotDurationMins)),
    [startTime, endTime, slotDurationMins]
  )

  const liveInspectSlots = useMemo(
    () => getSlotsForDoctorDate(doctorId, inspectDate, todayStr),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doctorId, inspectDate, todayStr, slotVersion]
  )

  function toggleDate(dateStr) {
    setActiveDates((prev) => {
      if (prev.includes(dateStr)) {
        return prev.length > 1 ? prev.filter((d) => d !== dateStr) : prev
      }
      return [...prev, dateStr].sort()
    })
  }

  function handleSaveSchedule(event) {
    event.preventDefault()
    setFeedback('')
    setErrorMsg('')
    try {
      const updated = saveDoctorScheduleConfig(doctorSession, doctorId, {
        activeDates,
        startTime,
        endTime,
        slotDurationMins: Number(slotDurationMins),
      })
      if (updated.activeDates.length > 0 && !updated.activeDates.includes(inspectDate)) {
        setInspectDate(updated.activeDates[0])
      }
      setFeedback(
        isBn
          ? `সময়সূচি সংরক্ষিত হয়েছে — দৈনিক ${previewSlots.length}টি স্লট চালু রয়েছে।`
          : `Schedule saved — ${previewSlots.length} bookable slots generated per active date.`
      )
      if (onScheduleUpdated) onScheduleUpdated(updated)
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  return (
    <form className="pmx-schedule-manager-card dark:bg-gray-900 dark:border-gray-700" onSubmit={handleSaveSchedule}>
      <div className="pmx-schedule-mgr-head">
        <div>
          <strong>
            <CalendarClock size={16} aria-hidden="true" />
            <span>{t('docScheduleMgrTitle')}</span>
          </strong>
          <small>{t('docScheduleMgrSubtitle')}</small>
        </div>
        <span className="pmx-room-code-pill">
          {previewSlots.length} {t('docSlotsPerDayLabel')}
        </span>
      </div>

      <div className="pmx-schedule-dates-block">
        <span className="pmx-slot-section-label">{t('docActiveDatesLabel')}</span>
        <div className="pmx-date-pills-row">
          {selectableDates.map((d) => {
            const isOn = activeDates.includes(d)
            return (
              <button
                key={d}
                type="button"
                className={`pmx-date-pill${isOn ? ' is-active' : ''} dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200`}
                onClick={() => toggleDate(d)}
              >
                {d === todayStr ? t('today') : d.slice(5)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="pmx-schedule-inputs-row">
        <label className="telemedicine-field dark:text-gray-200">
          <span>{t('docWindowStartLabel')}</span>
          <input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <label className="telemedicine-field dark:text-gray-200">
          <span>{t('docWindowEndLabel')}</span>
          <input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </label>
        <label className="telemedicine-field dark:text-gray-200">
          <span>{t('docSlotDurationLabel')}</span>
          <select value={slotDurationMins} onChange={(e) => setSlotDurationMins(e.target.value)}>
            <option value="10">10 {t('minutesShort')}</option>
            <option value="15">15 {t('minutesShort')}</option>
            <option value="20">20 {t('minutesShort')}</option>
            <option value="30">30 {t('minutesShort')}</option>
          </select>
        </label>
        <div className="pmx-schedule-save-wrap">
          <button type="submit" className="pmx-primary-submit-btn">
            <Save size={14} aria-hidden="true" />
            <span>{t('docSaveScheduleBtn')}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <p className="telemedicine-status" role="status">
          <CheckCircle2 size={14} style={{ display: 'inline', marginRight: 5 }} aria-hidden="true" />
          {feedback}
        </p>
      )}
      {errorMsg && <p className="telemedicine-error" role="alert">{errorMsg}</p>}

      <div className="pmx-live-slot-monitor">
        <div className="pmx-live-slot-monitor-head">
          <span>{t('docLiveLockedSlotsTitle')}</span>
          <select
            aria-label={t('docModalSelectDate')}
            value={inspectDate}
            onChange={(e) => setInspectDate(e.target.value)}
            className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
          >
            {activeDates.map((d) => (
              <option key={d} value={d}>
                {d === todayStr ? t('today') : d}
              </option>
            ))}
          </select>
        </div>
        <div className="pmx-doctor-slot-monitor-pills">
          {liveInspectSlots.map((slot) => (
            <span
              key={slot.slotKey}
              className={`pmx-monitor-slot-chip${slot.status === 'BOOKED' ? ' is-booked' : ' is-open'}`}
            >
              {slot.status === 'BOOKED' && <Lock size={11} aria-hidden="true" />}
              <span>{formatSlotTimeDisplay(slot.time, language)}</span>
              {slot.status === 'BOOKED' && slot.farmerName ? <small>· {slot.farmerName}</small> : null}
            </span>
          ))}
        </div>
      </div>
    </form>
  )
}
