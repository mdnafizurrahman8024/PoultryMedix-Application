import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bird,
  Clock,
  Mail,
  MessageCircle,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Radio,
  ShieldCheck,
  Stethoscope,
  Video,
  VideoOff,
} from 'lucide-react'
import { buildDoctorWhatsAppUrl } from '../lib/paymentAdapter.js'
import {
  TELEHEALTH_SIGNAL_CHANNEL,
  buildDoctorEmailUrl,
} from '../lib/telehealthNotifier.js'
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
  onEndCall,
}) {
  const { t, language } = useLanguage()
  const isBn = language === 'bn'

  const [activeCallType, setActiveCallType] = useState(
    initialCallType === 'video' ? 'video' : 'audio'
  )
  const [connectionState, setConnectionState] = useState('connecting')
  const [peerConnected, setPeerConnected] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [micMuted, setMicMuted] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(initialCallType === 'video')
  const [hasLiveVideo, setHasLiveVideo] = useState(false)
  const [hasLiveAudio, setHasLiveAudio] = useState(false)
  const [mediaNotice, setMediaNotice] = useState('')
  const [micLevels, setMicLevels] = useState([22, 34, 28, 40, 24])

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const peerConnRef = useRef(null)
  const signalChannelRef = useRef(null)
  const audioCtxRef = useRef(null)
  const endedRef = useRef(false)
  const peerIdRef = useRef('')

  const roomCode = bookingContext?.roomCode || bookingContext?.trxId || 'PMX-ROOM-LIVE'
  const isVideoMode = activeCallType === 'video'

  const sheds = useMemo(() => getSheds(), [])
  const flockSummaryText = useMemo(() => {
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
  }, [sheds, isBn])

  const whatsAppHref = buildDoctorWhatsAppUrl({
    phone: doctor.whatsappNumber,
    bookingId: bookingContext?.trxId || roomCode,
    doctorName: doctor.name,
    farmerName: bookingContext?.farmerName,
    farmName: bookingContext?.farmName,
    district: bookingContext?.district,
    concern: bookingContext?.concern,
    language,
  })

  const emailHref = buildDoctorEmailUrl({
    doctorName: doctor.name,
    receipt: {
      trxId: bookingContext?.trxId || roomCode,
      farmerName: bookingContext?.farmerName,
      farmName: bookingContext?.farmName,
      district: bookingContext?.district,
      bookingDate: bookingContext?.bookingDate,
      bookingTime: bookingContext?.bookingTime,
      concern: bookingContext?.concern,
      amount: bookingContext?.amount || 500,
      paymentMethodLabel: bookingContext?.paymentMethodLabel || 'Verified',
      status: 'Completed',
    },
    roomCode,
    language,
  })

  useEffect(() => {
    const connectTimer = window.setTimeout(() => {
      setConnectionState('connected')
    }, 800)
    return () => window.clearTimeout(connectTimer)
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
    let levelInterval = null

    function cleanupMediaAndRtc() {
      if (levelInterval) window.clearInterval(levelInterval)
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }
      if (peerConnRef.current) {
        peerConnRef.current.close()
        peerConnRef.current = null
      }
      if (signalChannelRef.current) {
        try {
          signalChannelRef.current.postMessage({
            type: 'leave',
            roomCode,
            peerId: peerIdRef.current,
          })
          signalChannelRef.current.close()
        } catch {
          // ignore
        }
        signalChannelRef.current = null
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
        localStreamRef.current = null
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
      remoteStreamRef.current = null
      setHasLiveVideo(false)
      setHasLiveAudio(false)
      setPeerConnected(false)
    }

    async function acquireStream() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaNotice(
          isBn
            ? 'এই ব্রাউজারে মিডিয়া ডিভাইস API নেই — স্থানীয় সিমুলেশন মোডে কল চলছে।'
            : 'Browser media device API unavailable — running in local consultation room mode.'
        )
        return null
      }

      if (activeCallType === 'video' && cameraEnabled) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
          return { stream, videoOk: true, audioOk: stream.getAudioTracks().length > 0 }
        } catch {
          try {
            const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            setMediaNotice(
              isBn
                ? 'ক্যামেরা পাওয়া যায়নি বা অনুমতি নেই — অডিও মাইক্রোফোন সক্রিয় রয়েছে।'
                : 'Camera unavailable or permission declined — microphone audio remains active.'
            )
            return { stream: audioOnly, videoOk: false, audioOk: audioOnly.getAudioTracks().length > 0 }
          } catch {
            setMediaNotice(
              isBn
                ? 'মাইক্রোফোন ও ক্যামেরার অনুমতি না থাকায় প্রিভিউ মোডে চলছে। হোয়াটসঅ্যাপেও সরাসরি কল করতে পারেন।'
                : 'Mic/camera permission unavailable — active in consultation room preview mode. You can also launch WhatsApp Call directly.'
            )
            return null
          }
        }
      }

      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        return { stream: audioOnly, videoOk: false, audioOk: audioOnly.getAudioTracks().length > 0 }
      } catch {
        setMediaNotice(
          isBn
            ? 'মাইক্রোফোন সংযুক্ত নেই বা অনুমতি নেই — রুমটি স্থানীয় অডিও মোডে সক্রিয় আছে।'
            : 'Microphone unavailable or permission declined — room running in local audio state.'
        )
        return null
      }
    }

    async function setupRoom() {
      const acquired = await acquireStream()
      if (cancelled) {
        if (acquired?.stream) acquired.stream.getTracks().forEach((t) => t.stop())
        return
      }

      if (acquired?.stream) {
        localStreamRef.current = acquired.stream
        setHasLiveVideo(acquired.videoOk)
        setHasLiveAudio(acquired.audioOk)
        setMediaNotice('')

        acquired.stream.getAudioTracks().forEach((track) => {
          track.enabled = !micMuted
        })

        if (localVideoRef.current && acquired.videoOk) {
          localVideoRef.current.srcObject = acquired.stream
        }

        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (AudioCtx && acquired.audioOk) {
          try {
            const ctx = new AudioCtx()
            audioCtxRef.current = ctx
            const analyser = ctx.createAnalyser()
            analyser.fftSize = 32
            const src = ctx.createMediaStreamSource(acquired.stream)
            src.connect(analyser)
            const data = new Uint8Array(analyser.frequencyBinCount)
            levelInterval = window.setInterval(() => {
              analyser.getByteFrequencyData(data)
              const bins = [data[1] || 0, data[2] || 0, data[3] || 0, data[4] || 0, data[5] || 0]
              setMicLevels(bins.map((v) => Math.max(18, Math.min(100, Math.round((v / 255) * 100)))))
            }, 130)
          } catch {
            // fallback static meter
          }
        }
      }

      // Local two-tab WebRTC signaling over BroadcastChannel
      if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined' && typeof RTCPeerConnection !== 'undefined') {
        if (!peerIdRef.current) {
          peerIdRef.current = `${participantRole}-${crypto.randomUUID().slice(0, 8)}`
        }
        const channel = new BroadcastChannel(TELEHEALTH_SIGNAL_CHANNEL)
        signalChannelRef.current = channel

        function ensurePeerConnection(targetPeerId) {
          if (peerConnRef.current) return peerConnRef.current
          const pc = new RTCPeerConnection({ iceServers: [] })
          peerConnRef.current = pc

          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
              pc.addTrack(track, localStreamRef.current)
            })
          }

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              channel.postMessage({
                type: 'ice-candidate',
                roomCode,
                from: peerIdRef.current,
                to: targetPeerId,
                candidate: event.candidate.toJSON(),
              })
            }
          }

          pc.ontrack = (event) => {
            const [stream] = event.streams
            if (stream) {
              remoteStreamRef.current = stream
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = stream
              }
              setPeerConnected(true)
            }
          }

          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
              setPeerConnected(true)
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
              setPeerConnected(false)
            }
          }

          return pc
        }

        channel.onmessage = async (event) => {
          const msg = event.data
          if (!msg || msg.roomCode !== roomCode || msg.from === peerIdRef.current) return
          if (msg.to && msg.to !== peerIdRef.current) return

          try {
            if (msg.type === 'join') {
              const pc = ensurePeerConnection(msg.from)
              const offer = await pc.createOffer()
              await pc.setLocalDescription(offer)
              channel.postMessage({
                type: 'offer',
                roomCode,
                from: peerIdRef.current,
                to: msg.from,
                sdp: offer,
              })
            } else if (msg.type === 'offer') {
              const pc = ensurePeerConnection(msg.from)
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
              const answer = await pc.createAnswer()
              await pc.setLocalDescription(answer)
              channel.postMessage({
                type: 'answer',
                roomCode,
                from: peerIdRef.current,
                to: msg.from,
                sdp: answer,
              })
            } else if (msg.type === 'answer' && peerConnRef.current) {
              await peerConnRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp))
            } else if (msg.type === 'ice-candidate' && peerConnRef.current && msg.candidate) {
              await peerConnRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate))
            } else if (msg.type === 'leave') {
              setPeerConnected(false)
              if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
              if (peerConnRef.current) {
                peerConnRef.current.close()
                peerConnRef.current = null
              }
            }
          } catch {
            // ignore transient signaling mismatch
          }
        }

        channel.postMessage({
          type: 'join',
          roomCode,
          from: peerIdRef.current,
          role: participantRole,
        })
      }
    }

    setupRoom()
    return () => {
      cancelled = true
      cleanupMediaAndRtc()
    }
  }, [activeCallType, cameraEnabled, roomCode, participantRole, isBn, micMuted])

  useEffect(() => {
    if (!localStreamRef.current) return
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !micMuted
    })
  }, [micMuted])

  function toggleVideoMode(nextType) {
    setActiveCallType(nextType)
    setCameraEnabled(nextType === 'video')
  }

  function handleEndSession() {
    if (endedRef.current) return
    endedRef.current = true
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }
    if (peerConnRef.current) {
      peerConnRef.current.close()
      peerConnRef.current = null
    }
    const finalSeconds = connectionState === 'connected' ? Math.max(1, elapsedSeconds) : 1
    onEndCall({
      callType: activeCallType === 'video' ? 'Video' : 'Audio',
      durationSeconds: finalSeconds,
      duration: formatDurationMMSS(finalSeconds),
      doctorName: doctor.name,
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
              <span className="pmx-call-room-kicker">
                {isVideoMode ? t('callRoomVideoTitle') : t('callRoomAudioTitle')}
              </span>
              <span className="pmx-room-code-pill">{roomCode}</span>
            </div>
            <h4>{doctor.name}</h4>
            <p>{doctor.degrees} · {doctor.regNo}</p>
          </div>
        </div>

        <div className="pmx-inline-header-right">
          <div className="pmx-mode-switch-group" role="group" aria-label={t('callSwitchMode')}>
            <button
              type="button"
              className={`pmx-mode-tab${!isVideoMode ? ' is-active' : ''}`}
              onClick={() => toggleVideoMode('audio')}
            >
              <Phone size={13} aria-hidden="true" />
              <span>{t('callModeAudioShort')}</span>
            </button>
            <button
              type="button"
              className={`pmx-mode-tab${isVideoMode ? ' is-active' : ''}`}
              onClick={() => toggleVideoMode('video')}
            >
              <Video size={13} aria-hidden="true" />
              <span>{t('callModeVideoShort')}</span>
            </button>
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
        </div>
      </header>

      <div className="pmx-inline-stage-grid">
        {/* Remote / Doctor Main Screen inside Consult Vet */}
        <div className="pmx-call-stage dark:bg-gray-950 dark:border-gray-800">
          {peerConnected ? (
            <video ref={remoteVideoRef} autoPlay playsInline className="pmx-remote-video" />
          ) : (
            <div className="pmx-doctor-stage-card">
              <div className="pmx-doctor-monogram" aria-hidden="true">NR</div>
              <strong>{participantRole === 'vet' ? (bookingContext?.farmerName || t('farmer')) : doctor.name}</strong>
              <span>{participantRole === 'vet' ? `${bookingContext?.district || 'Rajshahi'} · ${roomCode}` : doctor.clinic}</span>
              <div className="pmx-audio-bars" data-active={connectionState === 'connected' && !micMuted} aria-hidden="true">
                {micLevels.map((lvl, idx) => (
                  <span
                    key={idx}
                    style={hasLiveAudio && !micMuted ? { height: `${Math.max(5, Math.round((lvl / 100) * 20))}px` } : undefined}
                  />
                ))}
              </div>
              <small className="pmx-stage-mic-state">
                <Radio size={11} style={{ display: 'inline', marginRight: 4 }} aria-hidden="true" />
                {hasLiveAudio
                  ? (micMuted ? t('callMicMutedNote') : t('callMicLiveNote'))
                  : t('callAwaitingRemoteNote')}
              </small>
            </div>
          )}

          {/* Local Camera / Audio Screen inside same section */}
          <div className="pmx-self-pip dark:bg-gray-900 dark:border-gray-700">
            {isVideoMode && cameraEnabled && hasLiveVideo ? (
              <video ref={localVideoRef} autoPlay playsInline muted className="pmx-self-video" />
            ) : (
              <div className="pmx-self-fallback">
                {isVideoMode && cameraEnabled ? <Video size={16} /> : <Mic size={16} />}
                <span>
                  {isVideoMode
                    ? (cameraEnabled ? t('callCameraPreviewReady') : t('callCameraPaused'))
                    : (micMuted ? t('callMicMutedNote') : t('callModeAudioShort'))}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Flock Summary & Multi-Channel Doctor Notification Side Card */}
        <aside className="pmx-call-summary-panel dark:bg-gray-800 dark:border-gray-700">
          <h3>
            <Bird size={15} aria-hidden="true" />
            {t('callFlockContextTitle')}
          </h3>
          <dl className="pmx-call-dl">
            <div>
              <dt>{t('receiptTransactionId')}</dt>
              <dd>{bookingContext?.trxId || roomCode}</dd>
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
          </dl>

          <div className="pmx-call-whatsapp-box dark:bg-emerald-950/35 dark:border-emerald-800">
            <div className="pmx-wa-note">
              <ShieldCheck size={14} aria-hidden="true" />
              <span>{t('callNotifyDoctorHint')}</span>
            </div>
            <div className="pmx-notify-btn-stack">
              <a
                href={whatsAppHref}
                target="_blank"
                rel="noopener noreferrer"
                className="pmx-whatsapp-cta"
              >
                <MessageCircle size={15} aria-hidden="true" />
                <span>{t('continueOnWhatsAppCall')}</span>
              </a>
              <a
                href={emailHref}
                className="pmx-email-cta dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700"
              >
                <Mail size={15} aria-hidden="true" />
                <span>{t('notifyDoctorByEmail')}</span>
              </a>
            </div>
          </div>
        </aside>
      </div>

      {mediaNotice && (
        <p className="pmx-inline-media-notice dark:text-amber-200">{mediaNotice}</p>
      )}

      <footer className="pmx-call-controls dark:bg-gray-950 dark:border-gray-800">
        <button
          type="button"
          className={`pmx-call-toggle-btn${micMuted ? ' is-off' : ''}`}
          onClick={() => setMicMuted((prev) => !prev)}
          aria-pressed={micMuted}
        >
          {micMuted ? <MicOff size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
          <span>{micMuted ? t('callUnmuteMic') : t('callMuteMic')}</span>
        </button>

        <button
          type="button"
          className={`pmx-call-toggle-btn${!cameraEnabled || !isVideoMode ? ' is-off' : ''}`}
          onClick={() => {
            if (!isVideoMode) {
              toggleVideoMode('video')
            } else {
              setCameraEnabled((prev) => !prev)
            }
          }}
          aria-pressed={!cameraEnabled || !isVideoMode}
        >
          {cameraEnabled && isVideoMode ? <Video size={16} aria-hidden="true" /> : <VideoOff size={16} aria-hidden="true" />}
          <span>{cameraEnabled && isVideoMode ? t('callCameraOff') : t('callCameraOn')}</span>
        </button>

        <button
          type="button"
          className="pmx-call-end-btn"
          onClick={handleEndSession}
        >
          <PhoneOff size={16} aria-hidden="true" />
          <span>{t('callEndAndLog')}</span>
        </button>
      </footer>
    </section>
  )
}
