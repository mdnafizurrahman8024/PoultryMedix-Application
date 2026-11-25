import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bird,
  Clock,
  MessageCircle,
  Mic,
  MicOff,
  PhoneOff,
  ShieldCheck,
  Stethoscope,
  Video,
  VideoOff,
} from 'lucide-react'
import { buildDoctorWhatsAppUrl } from '../lib/paymentAdapter.js'
import { getSheds } from '../lib/shedManager.js'
import { useLanguage } from '../context/useLanguage.js'

function formatDurationMMSS(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const mins = String(Math.floor(safe / 60)).padStart(2, '0')
  const secs = String(safe % 60).padStart(2, '0')
  return `${mins}:${secs}`
}

export default function ConsultationCallModal({
  callType = 'audio',
  doctor,
  bookingContext,
  onEndCall,
}) {
  const { t, language } = useLanguage()
  const isBn = language === 'bn'
  const isVideoMode = callType === 'video'

  const [connectionState, setConnectionState] = useState('connecting')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [micMuted, setMicMuted] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(isVideoMode)
  const [hasLivePreview, setHasLivePreview] = useState(false)

  const selfVideoRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const endedRef = useRef(false)

  const sheds = useMemo(() => getSheds(), [])
  const flockSummaryText = useMemo(() => {
    if (!sheds.length) {
      return isBn
        ? 'সক্রিয় শেড নিবন্ধিত নেই (সাধারণ পরামর্শ সেশন)'
        : 'No saved sheds yet (general clinical consultation)'
    }
    const totalBirds = sheds.reduce((sum, s) => sum + (Number(s.birdCount) || 0), 0)
    const primary = sheds[0]
    return isBn
      ? `${sheds.length}টি শেড · মোট ${totalBirds.toLocaleString('bn-BD')} পাখি (${primary.species}, বয়স ${primary.currentAgeDays} দিন)`
      : `${sheds.length} Shed${sheds.length > 1 ? 's' : ''} · ${totalBirds.toLocaleString('en-US')} birds (${primary.species}, Day ${primary.currentAgeDays})`
  }, [sheds, isBn])

  const whatsAppHref = buildDoctorWhatsAppUrl({
    phone: doctor.whatsappNumber,
    bookingId: bookingContext.trxId,
    doctorName: doctor.name,
    farmerName: bookingContext.farmerName,
    farmName: bookingContext.farmName,
    district: bookingContext.district,
    concern: bookingContext.concern,
    language,
  })

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const connectTimer = window.setTimeout(() => {
      setConnectionState('connected')
    }, 1200)
    return () => {
      document.body.style.overflow = prevOverflow
      window.clearTimeout(connectTimer)
    }
  }, [])

  useEffect(() => {
    if (connectionState !== 'connected') return undefined
    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [connectionState])

  useEffect(() => {
    let cancelled = false

    function stopTracks() {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
      }
      if (selfVideoRef.current) {
        selfVideoRef.current.srcObject = null
      }
      setHasLivePreview(false)
    }

    async function enableCameraPreview() {
      if (!isVideoMode || !cameraEnabled || !navigator.mediaDevices?.getUserMedia) {
        stopTracks()
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        mediaStreamRef.current = stream
        if (selfVideoRef.current) {
          selfVideoRef.current.srcObject = stream
        }
        setHasLivePreview(true)
      } catch {
        setHasLivePreview(false)
      }
    }

    enableCameraPreview()
    return () => {
      cancelled = true
      stopTracks()
    }
  }, [isVideoMode, cameraEnabled])

  function handleEndSession() {
    if (endedRef.current) return
    endedRef.current = true
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    const finalSeconds = connectionState === 'connected' ? Math.max(1, elapsedSeconds) : 1
    onEndCall({
      callType: isVideoMode ? 'Video' : 'Audio',
      durationSeconds: finalSeconds,
      duration: formatDurationMMSS(finalSeconds),
      doctorName: doctor.name,
      timestamp: new Date().toISOString(),
    })
  }

  return createPortal(
    <div className="pmx-modal-backdrop" role="presentation">
      <section
        className="pmx-call-modal dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pmx-call-room-title"
      >
        <header className="pmx-call-header dark:bg-gray-950 dark:border-gray-800">
          <div className="pmx-call-doctor-meta">
            <div className="pmx-doctor-avatar" aria-hidden="true">
              <Stethoscope size={22} />
            </div>
            <div>
              <span className="pmx-call-room-kicker">
                {isVideoMode ? t('callRoomVideoTitle') : t('callRoomAudioTitle')}
              </span>
              <h2 id="pmx-call-room-title">{doctor.name}</h2>
              <p>{doctor.degrees} · {doctor.regNo}</p>
            </div>
          </div>

          <div className="pmx-call-status-pill" data-state={connectionState} role="status" aria-live="polite">
            <span className="pmx-status-indicator" aria-hidden="true" />
            <Clock size={13} aria-hidden="true" />
            <span>
              {connectionState === 'connecting'
                ? t('callConnectingStatus')
                : `${t('callConnectedStatus')} • ${formatDurationMMSS(elapsedSeconds)}`}
            </span>
          </div>
        </header>

        <div className="pmx-call-stage-grid">
          <div className="pmx-call-stage dark:bg-gray-950 dark:border-gray-800">
            <div className="pmx-doctor-stage-card">
              <div className="pmx-doctor-monogram" aria-hidden="true">
                NR
              </div>
              <strong>{doctor.name}</strong>
              <span>{doctor.clinic}</span>
              <div className="pmx-audio-bars" data-active={connectionState === 'connected' && !micMuted} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <small className="pmx-stage-mic-state">
                {micMuted ? t('callMicMutedNote') : t('callMicLiveNote')}
              </small>
            </div>

            {isVideoMode && (
              <div className="pmx-self-pip dark:bg-gray-900 dark:border-gray-700">
                {hasLivePreview && cameraEnabled ? (
                  <video ref={selfVideoRef} autoPlay playsInline muted className="pmx-self-video" />
                ) : (
                  <div className="pmx-self-fallback">
                    {cameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                    <span>
                      {cameraEnabled ? t('callCameraPreviewReady') : t('callCameraPaused')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="pmx-call-summary-panel dark:bg-gray-800 dark:border-gray-700">
            <h3>
              <Bird size={15} aria-hidden="true" />
              {t('callFlockContextTitle')}
            </h3>
            <dl className="pmx-call-dl">
              <div>
                <dt>{t('receiptTransactionId')}</dt>
                <dd>{bookingContext.trxId || 'BVC-DIRECT'}</dd>
              </div>
              <div>
                <dt>{t('checkoutFarmerLabel')}</dt>
                <dd>
                  {bookingContext.farmerName || t('farmer')}
                  {bookingContext.farmName ? ` · ${bookingContext.farmName}` : ''}
                </dd>
              </div>
              <div>
                <dt>{t('rxDistrict')}</dt>
                <dd>{bookingContext.district}</dd>
              </div>
              <div>
                <dt>{t('mainConcern')}</dt>
                <dd>{bookingContext.concern || t('historyNoDetails')}</dd>
              </div>
              <div>
                <dt>{t('callFlockSnapshot')}</dt>
                <dd>{flockSummaryText}</dd>
              </div>
            </dl>

            <div className="pmx-call-whatsapp-box dark:bg-emerald-950/35 dark:border-emerald-800">
              <div className="pmx-wa-note">
                <ShieldCheck size={14} aria-hidden="true" />
                <span>{t('callWhatsAppHelperNote')}</span>
              </div>
              <a
                href={whatsAppHref}
                target="_blank"
                rel="noopener noreferrer"
                className="pmx-whatsapp-cta"
              >
                <MessageCircle size={16} aria-hidden="true" />
                <span>{t('continueOnWhatsAppCall')}</span>
              </a>
            </div>
          </aside>
        </div>

        <footer className="pmx-call-controls dark:bg-gray-950 dark:border-gray-800">
          <button
            type="button"
            className={`pmx-call-toggle-btn${micMuted ? ' is-off' : ''}`}
            onClick={() => setMicMuted((prev) => !prev)}
            aria-pressed={micMuted}
          >
            {micMuted ? <MicOff size={17} aria-hidden="true" /> : <Mic size={17} aria-hidden="true" />}
            <span>{micMuted ? t('callUnmuteMic') : t('callMuteMic')}</span>
          </button>

          {isVideoMode && (
            <button
              type="button"
              className={`pmx-call-toggle-btn${!cameraEnabled ? ' is-off' : ''}`}
              onClick={() => setCameraEnabled((prev) => !prev)}
              aria-pressed={!cameraEnabled}
            >
              {cameraEnabled ? <Video size={17} aria-hidden="true" /> : <VideoOff size={17} aria-hidden="true" />}
              <span>{cameraEnabled ? t('callCameraOff') : t('callCameraOn')}</span>
            </button>
          )}

          <button
            type="button"
            className="pmx-call-end-btn"
            onClick={handleEndSession}
          >
            <PhoneOff size={17} aria-hidden="true" />
            <span>{t('callEndAndLog')}</span>
          </button>
        </footer>
      </section>
    </div>,
    document.body
  )
}
