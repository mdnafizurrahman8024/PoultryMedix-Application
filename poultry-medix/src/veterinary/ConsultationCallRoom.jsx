import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bird,
  Clock,
  FileCheck2,
  Globe,
  Hourglass,
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
import { buildJitsiRoomUrl } from '../lib/paymentAdapter.js'
import { TELEHEALTH_SIGNAL_CHANNEL } from '../lib/telehealthNotifier.js'
import { CLINICAL_LOGS_UPDATED_EVENT, getClinicalLogs } from '../lib/clinicalLogsStore.js'
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
  onToggleMobileRxSheet,
  mobileRxOpen = false,
}) {
  const { t, language } = useLanguage()
  const isBn = language === 'bn'

  const [activeCallType, setActiveCallType] = useState(
    initialCallType === 'video' ? 'video' : 'audio'
  )
  const [callEngine, setCallEngine] = useState('webrtc')
  const [connectionState, setConnectionState] = useState('connecting')
  const [peerConnected, setPeerConnected] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [micMuted, setMicMuted] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(initialCallType === 'video')
  const [hasLiveVideo, setHasLiveVideo] = useState(false)
  const [hasLiveAudio, setHasLiveAudio] = useState(false)
  const [mediaNotice, setMediaNotice] = useState('')
  const [micLevels, setMicLevels] = useState([22, 34, 28, 40, 24])
  const [callStartedAt] = useState(() => Date.now())
  const [liveRxAlert, setLiveRxAlert] = useState(null)

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const peerConnRef = useRef(null)
  const signalChannelRef = useRef(null)
  const audioCtxRef = useRef(null)
  const endedRef = useRef(false)
  const peerIdRef = useRef('')

  const roomCode = bookingContext?.roomCode || bookingContext?.roomId || bookingContext?.trxId || 'PMX-ROOM-LIVE'
  const isVideoMode = activeCallType === 'video'
  const participantDisplayName =
    participantRole === 'vet'
      ? `${doctor.name} (${doctor.regNo})`
      : bookingContext?.farmerName || 'Registered Farmer'

  const jitsiEmbedUrl = useMemo(
    () =>
      buildJitsiRoomUrl({
        roomId: roomCode,
        displayName: participantDisplayName,
        startAudioOnly: !isVideoMode,
      }),
    [roomCode, participantDisplayName, isVideoMode]
  )

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
    const connectTimer = window.setTimeout(() => {
      setConnectionState('connected')
    }, 750)
    return () => window.clearTimeout(connectTimer)
  }, [])

  useEffect(() => {
    if (connectionState !== 'connected') return undefined
    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [connectionState])

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

  useEffect(() => {
    if (callEngine !== 'webrtc') return undefined

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
            from: peerIdRef.current,
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
            ? 'এই ব্রাউজারে মিডিয়া API পাওয়া যায়নি — Jitsi Meet HD মোড ব্যবহার করুন অথবা প্রিভিউ মোডে থাকুন।'
            : 'Browser media API unavailable — switch to Jitsi Meet HD or continue in preview mode.'
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
                ? 'ক্যামেরা পাওয়া যায়নি — অডিও মাইক্রোফোন সক্রিয় রয়েছে।'
                : 'Camera unavailable or blocked — microphone audio remains active.'
            )
            return { stream: audioOnly, videoOk: false, audioOk: audioOnly.getAudioTracks().length > 0 }
          } catch {
            setMediaNotice(
              isBn
                ? 'মাইক্রোফোন/ক্যামেরার অনুমতি না থাকায় প্ল্যাটফর্ম প্রিভিউ মোডে চলছে।'
                : 'Mic/camera permission declined — active in platform room preview mode.'
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
            ? 'মাইক্রোফোন সংযুক্ত নেই বা অনুমতি নেই — রুমটি স্থানীয় অডিও প্রিভিউ মোডে চলছে।'
            : 'Microphone unavailable — room running in local audio preview mode.'
        )
        return null
      }
    }

    async function setupRoom() {
      const acquired = await acquireStream()
      if (cancelled) {
        if (acquired?.stream) acquired.stream.getTracks().forEach((track) => track.stop())
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
            // fallback levels
          }
        }
      }

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
  }, [callEngine, activeCallType, cameraEnabled, roomCode, participantRole, isBn, micMuted])

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
            </div>
            <h4>{doctor.name}</h4>
            <p>
              {doctor.degrees} · {doctor.regNo}
              {doctor.specialty ? ` · ${doctor.specialty}` : ''}
            </p>
          </div>
        </div>

        <div className="pmx-inline-header-right">
          <div className="pmx-mode-switch-group" role="group" aria-label={t('callEngineLabel')}>
            <button
              type="button"
              className={`pmx-mode-tab${callEngine === 'webrtc' ? ' is-active' : ''}`}
              onClick={() => setCallEngine('webrtc')}
            >
              <Radio size={12} aria-hidden="true" />
              <span>{t('callEngineWebRtc')}</span>
            </button>
            <button
              type="button"
              className={`pmx-mode-tab${callEngine === 'jitsi' ? ' is-active' : ''}`}
              onClick={() => setCallEngine('jitsi')}
            >
              <Globe size={12} aria-hidden="true" />
              <span>{t('callEngineJitsi')}</span>
            </button>
          </div>

          <div className="pmx-mode-switch-group" role="group" aria-label={t('callSwitchMode')}>
            <button
              type="button"
              className={`pmx-mode-tab${!isVideoMode ? ' is-active' : ''}`}
              onClick={() => toggleVideoMode('audio')}
            >
              <Phone size={12} aria-hidden="true" />
              <span>{t('callModeAudioShort')}</span>
            </button>
            <button
              type="button"
              className={`pmx-mode-tab${isVideoMode ? ' is-active' : ''}`}
              onClick={() => toggleVideoMode('video')}
            >
              <Video size={12} aria-hidden="true" />
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
        {callEngine === 'jitsi' ? (
          <div className="pmx-jitsi-stage dark:bg-gray-950 dark:border-gray-800">
            <iframe
              src={jitsiEmbedUrl}
              title={`PoultryMedix Jitsi Consultation ${roomCode}`}
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              className="pmx-jitsi-iframe"
            />
            <div className="pmx-jitsi-fallback-bar">
              <span>{t('jitsiRoomActiveNote', { roomCode })}</span>
              <button type="button" className="pmx-mode-tab" onClick={() => setCallEngine('webrtc')}>
                {t('switchToBuiltinWebRtc')}
              </button>
            </div>
          </div>
        ) : (
          <div className="pmx-call-stage dark:bg-gray-950 dark:border-gray-800">
            {peerConnected ? (
              <video ref={remoteVideoRef} autoPlay playsInline className="pmx-remote-video" />
            ) : (
              <div className="pmx-doctor-stage-card">
                <div className="pmx-doctor-monogram" aria-hidden="true">NR</div>
                <strong>{participantRole === 'vet' ? (bookingContext?.farmerName || t('farmer')) : doctor.name}</strong>
                <span>
                  {participantRole === 'vet'
                    ? `${bookingContext?.district || 'Rajshahi'} · ${roomCode}`
                    : `${doctor.regNo} · ${doctor.clinic}`}
                </span>
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
        )}

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
                <span>{mobileRxOpen ? t('hideMobileRxPad') : t('openMobileRxPad')}</span>
              </button>
            )
          )}
        </aside>
      </div>

      {mediaNotice && callEngine === 'webrtc' && (
        <p className="pmx-inline-media-notice dark:text-amber-200">{mediaNotice}</p>
      )}

      <footer className="pmx-call-controls dark:bg-gray-950 dark:border-gray-800">
        {callEngine === 'webrtc' && (
          <>
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
          </>
        )}

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
