import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bird,
  FileCheck2,
  Hourglass,
  Phone,
  PhoneOff,
  ShieldCheck,
  Stethoscope,
  Video,
} from 'lucide-react'
import LiveMediaStage from './LiveMediaStage.jsx'
import LiveQaHandRaisePanel from './LiveQaHandRaisePanel.jsx'
import { TELEHEALTH_SIGNAL_CHANNEL } from '../lib/telehealthNotifier.js'
import { CLINICAL_LOGS_UPDATED_EVENT, getClinicalLogs } from '../lib/clinicalLogsStore.js'
import { formatVetHeaderDisplay } from '../lib/doctorsStore.js'
import { getRoomRoleGrouping } from '../lib/liveRoomInteractionStore.js'
import { getSheds } from '../lib/shedManager.js'
import { useLanguage } from '../context/useLanguage.js'

function formatDurationMMSS(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const mins = String(Math.floor(safe / 60)).padStart(2, '0')
  const secs = String(safe % 60).padStart(2, '0')
  return `${mins}:${secs}`
}

export default function ConsultationCallRoom({
  initialCallType = 'audio',
  doctor,
  bookingContext,
  participantRole = 'farmer',
  userRole = '',
  onEndCall,
  onToggleMobileRxSheet,
}) {
  const { t, language } = useLanguage()
  const isBn = language === 'bn'

  const effectiveRole = userRole || (participantRole === 'vet' ? 'REGISTERED_VET' : 'FARMER')
  const roleGroup = useMemo(() => getRoomRoleGrouping(effectiveRole), [effectiveRole])

  const [activeCallType, setActiveCallType] = useState(
    initialCallType === 'video' ? 'video' : 'audio'
  )
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [callStartedAt] = useState(() => Date.now())
  const [liveRxAlert, setLiveRxAlert] = useState(null)

  const endedRef = useRef(false)
  const roomCode = bookingContext?.roomCode || bookingContext?.roomId || bookingContext?.trxId || 'PMX-ROOM-LIVE'
  const isVideoMode = activeCallType === 'video'
  const participantDisplayName = roleGroup.isHost
    ? `${doctor.name} (${doctor.regNo})`
    : bookingContext?.farmerName || t(roleGroup.roleLabelKey)

  const sheds = useMemo(() => getSheds(), [])
  const presetShedSummary = bookingContext?.shedSummary || ''
  const flockSummaryText = useMemo(() => {
    if (presetShedSummary) return presetShedSummary
    if (!sheds.length) {
      return isBn
        ? 'সক্রিয় শেড নিবন্ধিত নেই (সাধারণ পরামর্শ)'
        : 'No saved sheds (general consultation)'
    }
    const totalBirds = sheds.reduce((sum, s) => sum + (Number(s.birdCount) || 0), 0)
    const primary = sheds[0]
    return isBn
      ? `${sheds.length}টি শেড · ${totalBirds.toLocaleString('bn-BD')} পাখি (${primary.species}, দিন ${primary.currentAgeDays})`
      : `${sheds.length} Shed${sheds.length > 1 ? 's' : ''} · ${totalBirds.toLocaleString('en-US')} birds (${primary.species}, Day ${primary.currentAgeDays})`
  }, [presetShedSummary, sheds, isBn])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [])

  // Listen for Live Prescription deliveries (real-time BroadcastChannel + clinicalLogsStore)
  useEffect(() => {
    if (participantRole !== 'farmer') return undefined

    function syncLatestRxFromStore() {
      const rxList = getClinicalLogs('prescription').filter(
        (rx) => rx.source === 'vet_issued' && (
          (rx.roomCode && rx.roomCode === roomCode) ||
          new Date(rx.timestamp || 0).getTime() >= callStartedAt - 10000
        )
      )
      if (rxList[0]) {
        setLiveRxAlert({
          diagnosis: rxList[0].diagnosis,
          doctorName: rxList[0].vetName || doctor.name,
          medicationsCount: Array.isArray(rxList[0].medications) ? rxList[0].medications.length : 0,
          timestamp: rxList[0].timestamp,
        })
      }
    }

    syncLatestRxFromStore()
    window.addEventListener(CLINICAL_LOGS_UPDATED_EVENT, syncLatestRxFromStore)
    window.addEventListener('storage', syncLatestRxFromStore)

    let rxChannel = null
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      rxChannel = new BroadcastChannel(TELEHEALTH_SIGNAL_CHANNEL)
      rxChannel.onmessage = (event) => {
        if (event.data?.type === 'rx-delivered' && (!event.data.roomCode || event.data.roomCode === roomCode)) {
          setLiveRxAlert({
            diagnosis: event.data.diagnosis,
            doctorName: event.data.doctorName || doctor.name,
            medicationsCount: event.data.medicationsCount || 1,
            timestamp: event.data.timestamp,
          })
        }
      }
    }

    return () => {
      if (rxChannel) rxChannel.close()
      window.removeEventListener(CLINICAL_LOGS_UPDATED_EVENT, syncLatestRxFromStore)
      window.removeEventListener('storage', syncLatestRxFromStore)
    }
  }, [participantRole, roomCode, doctor.name, callStartedAt])

  function handleEndSession(stageInfo) {
    if (endedRef.current) return
    endedRef.current = true
    const finalSeconds = Math.max(1, stageInfo?.elapsedSeconds || elapsedSeconds)
    onEndCall({
      roomId: roomCode,
      roomCode,
      callType: activeCallType === 'video' ? 'Video' : 'Audio',
      durationSeconds: finalSeconds,
      duration: formatDurationMMSS(finalSeconds),
      doctorName: doctor.name,
      bvcRegNo: doctor.regNo,
      timestamp: new Date().toISOString(),
    })
  }

  return (
    <section
      className="pmx-inline-call-room dark:bg-gray-900 dark:border-gray-700"
      aria-label={isVideoMode ? t('callRoomVideoTitle') : t('callRoomAudioTitle')}
    >
      <header className="pmx-inline-call-header dark:bg-gray-950 dark:border-gray-800">
        <div className="pmx-call-doctor-meta">
          <div className="pmx-doctor-avatar" aria-hidden="true">
            <Stethoscope size={20} />
          </div>
          <div>
            <div className="pmx-inline-room-badges">
              <span className="pmx-privacy-shield-badge">
                <ShieldCheck size={11} aria-hidden="true" />
                {t('privacyProtectedCallBadge')}
              </span>
              <span className="pmx-room-code-pill">{roomCode}</span>
              <span className={`pmx-live-role-badge ${roleGroup.isHost ? 'is-host' : 'is-participant'}`}>
                {t(roleGroup.badgeKey)}
              </span>
            </div>
            <h4>{formatVetHeaderDisplay(doctor.name, doctor.degrees)}</h4>
            <p>
              {doctor.regNo}
              {doctor.specialty ? ` · ${doctor.specialty}` : ''}
              {doctor.location ? ` · ${doctor.location}` : ''}
            </p>
            <div className="pmx-ethical-audit-strip">
              <span>{t('callEthicalAuditBanner', { regNo: doctor.regNo })}</span>
            </div>
          </div>
        </div>

        <div className="pmx-inline-header-right">
          <div className="pmx-mode-switch-group" role="group" aria-label={t('callSwitchMode')}>
            <button
              type="button"
              className={`pmx-mode-tab${!isVideoMode ? ' is-active' : ''}`}
              onClick={() => setActiveCallType('audio')}
            >
              <Phone size={12} aria-hidden="true" />
              <span>{t('callModeAudioShort')}</span>
            </button>
            <button
              type="button"
              className={`pmx-mode-tab${isVideoMode ? ' is-active' : ''}`}
              onClick={() => setActiveCallType('video')}
            >
              <Video size={12} aria-hidden="true" />
              <span>{t('callModeVideoShort')}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="pmx-inline-stage-grid">
        <LiveMediaStage
          key={`${roomCode}-${roleGroup.side}-${activeCallType}`}
          roomId={roomCode}
          userRole={effectiveRole}
          displayName={participantDisplayName}
          remoteTitle={roleGroup.isHost ? (bookingContext?.farmerName || t('farmer')) : doctor.name}
          remoteSubtitle={
            roleGroup.isHost
              ? `${bookingContext?.district || 'Rajshahi'} · ${roomCode}`
              : `${doctor.regNo} · ${doctor.clinic}`
          }
          initialAudioOnly={!isVideoMode}
          heightPx={340}
          hideBottomLeaveButton
          onLeaveOrEnd={handleEndSession}
        />

        <aside className="pmx-call-summary-panel dark:bg-gray-800 dark:border-gray-700">
          <h3>
            <Bird size={15} aria-hidden="true" />
            {t('callFlockContextTitle')}
          </h3>
          <dl className="pmx-call-dl">
            <div>
              <dt>{t('roomCodeLabel')}</dt>
              <dd>{roomCode}</dd>
            </div>
            <div>
              <dt>{t('checkoutFarmerLabel')}</dt>
              <dd>
                {bookingContext?.farmerName || t('farmer')}
                {bookingContext?.farmName ? ` · ${bookingContext.farmName}` : ''}
              </dd>
            </div>
            <div>
              <dt>{t('mainConcern')}</dt>
              <dd>{bookingContext?.concern || t('historyNoDetails')}</dd>
            </div>
            <div>
              <dt>{t('callFlockSnapshot')}</dt>
              <dd>{flockSummaryText}</dd>
            </div>
            {bookingContext?.aiDiagnosisSummary && (
              <div>
                <dt>{t('aiDiagnosisBadgeLabel')}</dt>
                <dd>{bookingContext.aiDiagnosisSummary}</dd>
              </div>
            )}
          </dl>

          {participantRole === 'farmer' ? (
            <div
              className={`pmx-live-rx-status-box${liveRxAlert ? ' is-received' : ''} dark:border-gray-700`}
              role="status"
            >
              {liveRxAlert ? (
                <>
                  <div className="pmx-live-rx-head">
                    <FileCheck2 size={16} aria-hidden="true" />
                    <strong>{t('liveRxReceivedTitle')}</strong>
                  </div>
                  <p>
                    {t('liveRxReceivedDetail', {
                      doctor: liveRxAlert.doctorName,
                      count: liveRxAlert.medicationsCount,
                      diagnosis: liveRxAlert.diagnosis || t('clinicalHistoryDiagnosis'),
                    })}
                  </p>
                  <small>{t('liveRxCheckClinicalLogHint')}</small>
                </>
              ) : (
                <>
                  <div className="pmx-live-rx-head">
                    <Hourglass size={15} aria-hidden="true" />
                    <strong>{t('liveRxWaitingTitle')}</strong>
                  </div>
                  <p>{t('liveRxWaitingDetail')}</p>
                </>
              )}
            </div>
          ) : (
            onToggleMobileRxSheet && (
              <button
                type="button"
                className="pmx-mobile-rx-toggle-btn"
                onClick={onToggleMobileRxSheet}
              >
                <FileCheck2 size={15} aria-hidden="true" />
                <span>{t('jumpToFullRxBuilder')}</span>
              </button>
            )
          )}

          <LiveQaHandRaisePanel
            key={`tele-qa-${roomCode}-${roleGroup.side}`}
            roomId={roomCode}
            userRole={effectiveRole}
            participantName={participantDisplayName}
            compact
          />
        </aside>
      </div>

      <footer className="pmx-call-controls dark:bg-gray-950 dark:border-gray-800">
        <button
          type="button"
          className="pmx-call-end-btn"
          onClick={() => handleEndSession({ elapsedSeconds })}
        >
          <PhoneOff size={16} aria-hidden="true" />
          <span>{t('callEndAndLog')}</span>
        </button>
      </footer>
    </section>
  )
}
