import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bird,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Hourglass,
  Image as ImageIcon,
  Phone,
  ShieldCheck,
  Stethoscope,
  Video,
  X,
} from 'lucide-react'
import NativeConsultVideoStage from './NativeConsultVideoStage.jsx'
import { TELEHEALTH_SIGNAL_CHANNEL } from '../lib/telehealthNotifier.js'
import { CLINICAL_LOGS_UPDATED_EVENT, getClinicalLogs } from '../lib/clinicalLogsStore.js'
import { formatVetHeaderDisplay } from '../lib/doctorsStore.js'
import { getRoomRoleGrouping } from '../lib/liveRoomInteractionStore.js'
import { BOOKING_TARGET_MODES, formatBytesReadable } from '../lib/bookingContextHelper.js'
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
  compactPip = false,
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
  const [callStartedAt] = useState(() => Date.now())
  const [liveRxAlert, setLiveRxAlert] = useState(null)
  const [previewAttachment, setPreviewAttachment] = useState(null)

  const endedRef = useRef(false)
  const roomCode = bookingContext?.roomCode || bookingContext?.roomId || bookingContext?.trxId || 'PMX-ROOM-LIVE'
  const isVideoMode = activeCallType === 'video'
  const participantDisplayName = roleGroup.isHost
    ? `${doctor.name} (${doctor.regNo})`
    : bookingContext?.farmerName || t(roleGroup.roleLabelKey)

  const bookingMode = bookingContext?.bookingMode || BOOKING_TARGET_MODES.REGISTERED_SHED
  const isManualBooking = bookingMode === BOOKING_TARGET_MODES.MANUAL_FARM
  const flockSummaryText = useMemo(() => {
    if (bookingContext?.shedSummary) return bookingContext.shedSummary
    const parts = [
      bookingContext?.farmName || bookingContext?.shedName || '',
      bookingContext?.flockSize ? `${bookingContext.flockSize}` : '',
      bookingContext?.birdType || '',
      bookingContext?.age || '',
    ].filter(Boolean)
    if (parts.length > 0) return parts.join(' · ')
    return isBn
      ? 'সাধারণ পোল্ট্রি পরামর্শ'
      : 'General poultry consultation'
  }, [bookingContext, isBn])

  const genuineDiagnoses = useMemo(() => {
    if (Array.isArray(bookingContext?.linkedDiagnoses) && bookingContext.linkedDiagnoses.length > 0) {
      return bookingContext.linkedDiagnoses
    }
    if (bookingContext?.aiDiagnosisSummary) {
      return [{ id: 'summary', primaryDisease: bookingContext.aiDiagnosisSummary, confidencePercent: '' }]
    }
    return []
  }, [bookingContext])

  const attachedPrescriptions = useMemo(
    () => (Array.isArray(bookingContext?.attachedPrescriptions) ? bookingContext.attachedPrescriptions : []),
    [bookingContext]
  )

  const uploadedAttachments = useMemo(
    () => (Array.isArray(bookingContext?.uploadedAttachments) ? bookingContext.uploadedAttachments : []),
    [bookingContext]
  )

  function handleOpenUploadedFile(att) {
    if (!att?.dataUrl) return
    if (att.mimeType === 'application/pdf') {
      try {
        const [, b64] = att.dataUrl.split(',')
        const binary = window.atob(b64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
        const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
        window.open(blobUrl, '_blank', 'noopener,noreferrer')
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
      } catch {
        setPreviewAttachment(att)
      }
      return
    }
    setPreviewAttachment(att)
  }

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
    const finalSeconds = Math.max(1, stageInfo?.elapsedSeconds || 1)
    onEndCall({
      roomId: roomCode,
      roomCode,
      callType: stageInfo?.callType || (activeCallType === 'video' ? 'Video' : 'Audio'),
      durationSeconds: finalSeconds,
      duration: formatDurationMMSS(finalSeconds),
      doctorName: doctor.name,
      bvcRegNo: doctor.regNo,
      timestamp: new Date().toISOString(),
    })
  }

  return (
    <section
      className={`pmx-inline-call-room${compactPip ? ' is-compact-pip' : ''} dark:bg-gray-900 dark:border-gray-700`}
      aria-label={isVideoMode ? t('callRoomVideoTitle') : t('callRoomAudioTitle')}
    >
      {!compactPip && (
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
      )}

      <div className={`pmx-inline-stage-grid${compactPip ? ' is-pip-stage' : ''}${participantRole === 'vet' && !compactPip ? ' is-vet-column' : ''}`}>
        <NativeConsultVideoStage
          key={`${roomCode}-${roleGroup.side}-${activeCallType}`}
          roomId={roomCode}
          trxId={bookingContext?.trxId || ''}
          participantRole={participantRole}
          userRole={effectiveRole}
          displayName={participantDisplayName}
          remoteTitle={roleGroup.isHost ? (bookingContext?.farmerName || t('farmer')) : doctor.name}
          remoteSubtitle={
            roleGroup.isHost
              ? `${[bookingContext?.upazila, bookingContext?.district].filter(Boolean).join(', ') || 'Rajshahi'} · ${roomCode}`
              : `${doctor.regNo} · ${doctor.clinic}`
          }
          initialAudioOnly={!isVideoMode}
          compactPip={compactPip}
          onEndCall={handleEndSession}
        />

        {!compactPip && (
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
              <dt>{t('bookingTargetLabel')}</dt>
              <dd>
                <span className={`pmx-booking-mode-pill ${isManualBooking ? 'is-manual' : 'is-shed'}`}>
                  {isManualBooking ? t('bookingModeManualShort') : t('bookingModeShedShort')}
                </span>
              </dd>
            </div>
            <div>
              <dt>{t('checkoutFarmerLabel')}</dt>
              <dd>
                {bookingContext?.farmerName || t('farmer')}
                {bookingContext?.farmName ? ` · ${bookingContext.farmName}` : ''}
                {(bookingContext?.upazila || bookingContext?.district) && (
                  <small className="pmx-call-subline">
                    {[bookingContext?.upazila, bookingContext?.district].filter(Boolean).join(', ')}
                  </small>
                )}
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
            <div>
              <dt>{t('aiDiagnosisBadgeLabel')}</dt>
              <dd>
                {genuineDiagnoses.length > 0 ? (
                  <ul className="pmx-call-linked-list">
                    {genuineDiagnoses.map((diag, idx) => (
                      <li key={diag.id || idx}>
                        <strong>{diag.primaryDisease}</strong>
                        {diag.confidencePercent ? ` (${diag.confidencePercent})` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="pmx-call-muted-note">{t('callNoAiScanNote')}</span>
                )}
              </dd>
            </div>
            {(attachedPrescriptions.length > 0 || uploadedAttachments.length > 0) && (
              <div>
                <dt>{t('callAttachedHistoryLabel')}</dt>
                <dd>
                  {attachedPrescriptions.length > 0 && (
                    <ul className="pmx-call-history-rx-list">
                      {attachedPrescriptions.map((rx, idx) => (
                        <li key={rx.id || idx}>
                          <strong>{rx.diagnosis || t('clinicalHistoryDiagnosis')}</strong>
                          <small>
                            {[rx.dateLabel, rx.vetName, rx.medicationSummary].filter(Boolean).join(' · ')}
                          </small>
                        </li>
                      ))}
                    </ul>
                  )}
                  {uploadedAttachments.length > 0 && (
                    <div className="pmx-call-uploaded-grid">
                      {uploadedAttachments.map((att) => {
                        const isPdf = att.mimeType === 'application/pdf'
                        return (
                          <div key={att.id || att.fileName} className="pmx-call-uploaded-item">
                            {isPdf || !att.dataUrl ? (
                              <span className="pmx-call-file-icon">
                                <FileText size={16} aria-hidden="true" />
                              </span>
                            ) : (
                              <img
                                src={att.dataUrl}
                                alt={att.fileName}
                                className="pmx-call-upload-thumb"
                              />
                            )}
                            <div className="pmx-call-upload-meta">
                              <strong>{att.fileName}</strong>
                              <small>{formatBytesReadable(att.sizeBytes)}</small>
                            </div>
                            {att.dataUrl && (
                              <div className="pmx-call-upload-actions">
                                <button
                                  type="button"
                                  className="pmx-call-file-btn"
                                  onClick={() => handleOpenUploadedFile(att)}
                                  aria-label={t('callPreviewFileBtn')}
                                  title={t('callPreviewFileBtn')}
                                >
                                  {isPdf ? <ExternalLink size={13} /> : <ImageIcon size={13} />}
                                </button>
                                <a
                                  href={att.dataUrl}
                                  download={att.fileName}
                                  className="pmx-call-file-btn"
                                  aria-label={t('receiptDownloadBtn')}
                                  title={t('receiptDownloadBtn')}
                                >
                                  <Download size={13} />
                                </a>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </dd>
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
        </aside>
        )}
      </div>

      {previewAttachment && (
        <div
          className="pmx-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewAttachment(null)
          }}
        >
          <section className="pmx-modal-card dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700" role="dialog" aria-modal="true">
            <header className="pmx-modal-header dark:bg-gray-950 dark:border-gray-800">
              <div>
                <strong>{previewAttachment.fileName}</strong>
                <small style={{ display: 'block', color: '#64748b' }}>{formatBytesReadable(previewAttachment.sizeBytes)}</small>
              </div>
              <button
                type="button"
                className="pmx-modal-close dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
                onClick={() => setPreviewAttachment(null)}
                aria-label={t('close')}
              >
                <X size={18} />
              </button>
            </header>
            <div className="pmx-modal-body" style={{ textAlign: 'center' }}>
              {previewAttachment.mimeType === 'application/pdf' ? (
                <p style={{ margin: '12px 0' }}>{t('callPdfDownloadFallback')}</p>
              ) : (
                <img
                  src={previewAttachment.dataUrl}
                  alt={previewAttachment.fileName}
                  style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '10px', margin: '0 auto' }}
                />
              )}
              <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <a href={previewAttachment.dataUrl} download={previewAttachment.fileName} className="pmx-primary-submit-btn">
                  <Download size={15} />
                  {t('receiptDownloadBtn')}
                </a>
                <button type="button" className="pmx-secondary-btn" onClick={() => setPreviewAttachment(null)}>
                  {t('close')}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
