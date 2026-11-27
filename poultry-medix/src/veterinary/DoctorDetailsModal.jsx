import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Award, Building2, Calendar, CheckCircle2, Clock, Lock, MapPin, ShieldCheck, X } from 'lucide-react'
import {
  formatSlotTimeDisplay,
  getDoctorAvailabilitySummary,
  getDoctorLocalizedFields,
  getSlotsForDoctorDate,
  toLocaleDigits,
} from '../lib/doctorsStore.js'
import { getLocalTodayDateStr } from '../lib/telehealthNotifier.js'
import { useLanguage } from '../context/useLanguage.js'

export default function DoctorDetailsModal({
  doctor,
  initialDate = '',
  initialTime = '',
  slotVersion = 0,
  onSelectSlotAndContinue,
  onClose,
}) {
  const { t, language } = useLanguage()
  const isBn = language === 'bn'
  const todayStr = getLocalTodayDateStr()

  const localizedDoc = useMemo(() => getDoctorLocalizedFields(doctor, language), [doctor, language])
  const summary = useMemo(
    () => getDoctorAvailabilitySummary(doctor.id, todayStr),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doctor.id, todayStr, slotVersion]
  )

  const [selectedDate, setSelectedDate] = useState(() => (
    initialDate && summary.activeDates.includes(initialDate)
      ? initialDate
      : (summary.availableSlots > 0 ? todayStr : (summary.nextAvailableDate || summary.activeDates[0] || todayStr))
  ))
  const [selectedTime, setSelectedTime] = useState(initialTime || '')

  const dateSlots = useMemo(
    () => getSlotsForDoctorDate(doctor.id, selectedDate, todayStr),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doctor.id, selectedDate, todayStr, slotVersion]
  )

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const selectedSlotObj = dateSlots.find((s) => s.time === selectedTime && s.status === 'AVAILABLE') || null

  return createPortal(
    <div
      className="pmx-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="pmx-modal-card pmx-doctor-details-modal dark:bg-gray-900 dark:text-white dark:border-gray-700"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pmx-doc-modal-title"
      >
        <header className="pmx-modal-header dark:bg-gray-950 dark:border-gray-800">
          <div className="pmx-modal-doc-head">
            <span className={`pmx-doc-avatar-badge is-${doctor.avatarTone || 'emerald'}`} aria-hidden="true">
              {doctor.avatarInitials || 'DR'}
            </span>
            <div>
              <span className="pmx-privacy-shield-badge">
                <ShieldCheck size={11} aria-hidden="true" />
                {doctor.regNo}
              </span>
              <h2 id="pmx-doc-modal-title">{localizedDoc.displayName}</h2>
              <p className="pmx-modal-doc-degrees">{localizedDoc.displayDegrees}</p>
            </div>
          </div>
          <button
            type="button"
            className="pmx-modal-close dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
            onClick={onClose}
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </header>

        <div className="pmx-modal-body">
          <div className="pmx-doc-modal-credentials dark:bg-gray-800 dark:border-gray-700">
            <div className="pmx-doc-cred-row">
              <Building2 size={15} aria-hidden="true" />
              <span><strong>{t('docModalWorkplace')}:</strong> {localizedDoc.displayClinic}</span>
            </div>
            <div className="pmx-doc-cred-row">
              <MapPin size={15} aria-hidden="true" />
              <span><strong>{t('rxDistrict')}:</strong> {localizedDoc.displayLocation}</span>
            </div>
            <div className="pmx-doc-cred-row">
              <Award size={15} aria-hidden="true" />
              <span>
                {toLocaleDigits(doctor.experienceYears, language)} {t('doctorExpYearsLabel')} •{' '}
                {toLocaleDigits(doctor.consultationsServed, language)} {t('doctorServedLabel')}
              </span>
            </div>
            <p className="pmx-doc-modal-bio dark:text-gray-300">{localizedDoc.displayBio}</p>
          </div>

          <div className="pmx-doc-modal-status-row">
            {summary.badgeStatus === 'available' ? (
              <span className="pmx-slot-status-badge is-available">
                ● {t('doctorAvailableTodayBadge', { count: toLocaleDigits(summary.availableSlots, language) })}
              </span>
            ) : (
              <div className="pmx-fully-booked-stack">
                <span className="pmx-slot-status-badge is-full">
                  {t('doctorFullyBookedBadge')}
                </span>
                {summary.nextAvailableDate && (
                  <small className="pmx-next-available-note">
                    {t('doctorNextAvailableLabel', { date: toLocaleDigits(summary.nextAvailableDate, language) })}
                  </small>
                )}
              </div>
            )}
          </div>

          <div className="pmx-modal-slot-picker">
            <label className="pmx-slot-section-label">
              <Calendar size={14} aria-hidden="true" />
              <span>{t('docModalSelectDate')}</span>
            </label>
            <div className="pmx-date-pills-row">
              {summary.activeDates.map((d) => {
                const isSelected = d === selectedDate
                return (
                  <button
                    key={d}
                    type="button"
                    className={`pmx-date-pill${isSelected ? ' is-active' : ''} dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200`}
                    onClick={() => {
                      setSelectedDate(d)
                      setSelectedTime('')
                    }}
                  >
                    {d === todayStr ? t('today') : toLocaleDigits(d, language)}
                  </button>
                )
              })}
            </div>

            <label className="pmx-slot-section-label" style={{ marginTop: '10px' }}>
              <Clock size={14} aria-hidden="true" />
              <span>{t('docModalChooseSlot')}</span>
            </label>

            {dateSlots.length === 0 ? (
              <p className="pmx-empty-slots-note">{t('docModalNoSlotsForDate')}</p>
            ) : (
              <div className="pmx-time-slots-grid" role="radiogroup" aria-label={t('docModalChooseSlot')}>
                {dateSlots.map((slot) => {
                  const isBooked = slot.status === 'BOOKED'
                  const isChosen = selectedTime === slot.time && !isBooked
                  return (
                    <button
                      key={slot.slotKey}
                      type="button"
                      disabled={isBooked}
                      role="radio"
                      aria-checked={isChosen}
                      className={`pmx-time-slot-pill${isChosen ? ' is-chosen' : ''}${isBooked ? ' is-booked' : ''} dark:bg-gray-800 dark:border-gray-700`}
                      onClick={() => setSelectedTime(slot.time)}
                    >
                      {isBooked && <Lock size={11} aria-hidden="true" />}
                      <span>{formatSlotTimeDisplay(slot.time, language)}</span>
                      <small>{isBooked ? t('slotStatusBookedShort') : (isBn ? 'খালি' : 'Open')}</small>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="pmx-checkout-actions">
            <button
              type="button"
              className="pmx-secondary-btn dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
              onClick={onClose}
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              disabled={!selectedSlotObj}
              className="pmx-primary-submit-btn"
              onClick={() => {
                if (!selectedSlotObj) return
                onSelectSlotAndContinue({
                  doctorId: doctor.id,
                  date: selectedDate,
                  time: selectedSlotObj.time,
                })
              }}
            >
              <CheckCircle2 size={15} aria-hidden="true" />
              <span>
                {selectedSlotObj
                  ? t('docModalConfirmSlotBtn', { time: formatSlotTimeDisplay(selectedSlotObj.time, language) })
                  : t('docModalPickSlotFirst')}
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body
  )
}
