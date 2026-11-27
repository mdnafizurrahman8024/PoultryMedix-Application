import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Clock,
  Lock,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  ShieldCheck,
  SwitchCamera,
  Video,
  VideoOff,
} from 'lucide-react'
import { getAuthenticatedDoctorSession } from '../lib/doctorsStore.js'
import { TELEHEALTH_SIGNAL_CHANNEL } from '../lib/telehealthNotifier.js'
import { stopMediaStreamTracks, validateConsultMediaAccess } from '../lib/consultMediaHelper.js'
import { useLanguage } from '../context/useLanguage.js'

function formatDurationMMSS(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const mins = String(Math.floor(safe / 60)).padStart(2, '0')
  const secs = String(safe % 60).padStart(2, '0')
  return `${mins}:${secs}`
}

function getInitials(label) {
  const words = String(label || 'PM').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase()
  return String(label || 'PM').slice(0, 2).toUpperCase()
}

export default function NativeConsultVideoStage({
  roomId = 'PMX-ROOM-LIVE',
  trxId = '',
  participantRole = 'farmer',
  userRole = '',
  displayName = 'PoultryMedix Participant',
  remoteTitle = 'Clinician / Farmer',
  remoteSubtitle = '',
  initialAudioOnly = false,
  compactPip = false,
  onEndCall,
}) {
  const { t, language } = useLanguage()
  const isBn = language === 'bn'
  const effectiveRole = userRole || (participantRole === 'vet' ? 'REGISTERED_VET' : 'FARMER')

  const accessAuth = useMemo(() => {
    const doctorSession = effectiveRole === 'REGISTERED_VET'
      ? getAuthenticatedDoctorSession(effectiveRole)
      : null
    return validateConsultMediaAccess({
      participantRole,
      userRole: effectiveRole,
      roomCode: roomId,
      trxId,
      doctorSession,
    })
  }, [participantRole, effectiveRole, roomId, trxId])

  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [micMuted, setMicMuted] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(!initialAudioOnly)
  const [facingMode, setFacingMode] = useState('user')
  const [screenSharing, setScreenSharing] = useState(false)
  const [hasLiveVideo, setHasLiveVideo] = useState(false)
  const [hasLiveAudio, setHasLiveAudio] = useState(false)
  const [peerConnected, setPeerConnected] = useState(false)
  const [peerScreenActive, setPeerScreenActive] = useState(false)
  const [mediaNotice, setMediaNotice] = useState('')
  const [micLevels, setMicLevels] = useState([22, 34, 28, 40, 24])

  const localVideoRef = useRef(null)
  const localScreenRef = useRef(null)
  const remoteVideoRef = useRef(null)

  const localStreamRef = useRef(null)
  const screenStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const peerConnsRef = useRef(new Map())
  const signalChannelRef = useRef(null)
  const audioCtxRef = useRef(null)
  const peerIdRef = useRef('')
  const cameraDeviceIdxRef = useRef(0)
  const micMutedRef = useRef(micMuted)
  const cameraEnabledRef = useRef(cameraEnabled)

  useEffect(() => {
    micMutedRef.current = micMuted
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !micMuted
      })
    }
  }, [micMuted])

  useEffect(() => {
    cameraEnabledRef.current = cameraEnabled
  }, [cameraEnabled])

  useEffect(() => {
    if (!accessAuth.authorized) return undefined
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [accessAuth.authorized])

  // Native WebRTC peer session & authenticated hardware capture with strict cleanup
  useEffect(() => {
    if (!accessAuth.authorized) return undefined

    let cancelled = false
    let levelInterval = null

    function cleanupAllHardwareAndPeers() {
      if (levelInterval) window.clearInterval(levelInterval)
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }
      peerConnsRef.current.forEach((pc) => pc.close())
      peerConnsRef.current.clear()
      if (signalChannelRef.current) {
        try {
          signalChannelRef.current.postMessage({
            type: 'leave',
            roomCode: roomId,
            from: peerIdRef.current,
            sessionToken: accessAuth.sessionToken,
          })
          signalChannelRef.current.close()
        } catch {
          // ignore cleanup close errors
        }
        signalChannelRef.current = null
      }
      stopMediaStreamTracks(localStreamRef.current)
      localStreamRef.current = null
      stopMediaStreamTracks(screenStreamRef.current)
      screenStreamRef.current = null
      if (localVideoRef.current) localVideoRef.current.srcObject = null
      if (localScreenRef.current) localScreenRef.current.srcObject = null
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
      remoteStreamRef.current = null
      setHasLiveVideo(false)
      setHasLiveAudio(false)
      setPeerConnected(false)
      setScreenSharing(false)
      setPeerScreenActive(false)
    }

    async function acquireInitialMedia() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaNotice(
          isBn
            ? 'এই ব্রাউজারে ক্যামেরা/মাইক্রোফোন WebRTC পাওয়া যায়নি।'
            : 'Native camera/microphone WebRTC API is unavailable in this browser.'
        )
        return null
      }

      if (cameraEnabledRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { facingMode: 'user' },
          })
          return { stream, videoOk: stream.getVideoTracks().length > 0, audioOk: stream.getAudioTracks().length > 0 }
        } catch {
          try {
            const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            setMediaNotice(
              isBn
                ? 'ক্যামেরা পাওয়া যায়নি — নিরাপদ অডিও কনসাল্টেশন সক্রিয় আছে।'
                : 'Webcam unavailable — encrypted consultation audio remains active.'
            )
            return { stream: audioOnly, videoOk: false, audioOk: audioOnly.getAudioTracks().length > 0 }
          } catch {
            setMediaNotice(
              isBn
                ? 'ক্যামেরা/মাইক অনুমতি দিলে সরাসরি ইন-অ্যাপ লাইভ ফিড চালু হবে।'
                : 'Grant camera & microphone permission to start live video feed.'
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
            ? 'মাইক্রোফোন সংযুক্ত নয় বা অনুমতি দেওয়া হয়নি।'
            : 'Microphone unavailable or permission skipped — toggle Mic/Camera anytime.'
        )
        return null
      }
    }

    async function initNativeCall() {
      const acquired = await acquireInitialMedia()
      if (cancelled) {
        stopMediaStreamTracks(acquired?.stream)
        return
      }

      if (acquired?.stream) {
        localStreamRef.current = acquired.stream
        setHasLiveVideo(acquired.videoOk)
        setHasLiveAudio(acquired.audioOk)
        if (acquired.videoOk) setMediaNotice('')

        acquired.stream.getAudioTracks().forEach((tr) => {
          tr.enabled = !micMutedRef.current
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
              setMicLevels(bins.map((v) => Math.max(16, Math.min(100, Math.round((v / 255) * 100)))))
            }, 140)
          } catch {
            // AudioContext waveform optional
          }
        }
      }

      if (typeof BroadcastChannel !== 'undefined' && typeof RTCPeerConnection !== 'undefined') {
        if (!peerIdRef.current) {
          const rand = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID().slice(0, 8)
            : Math.random().toString(36).slice(2, 10)
          peerIdRef.current = `${accessAuth.roleSide}-${rand}`
        }

        const ch = new BroadcastChannel(TELEHEALTH_SIGNAL_CHANNEL)
        signalChannelRef.current = ch

        function getOrCreatePeer(targetId) {
          const existing = peerConnsRef.current.get(targetId)
          if (existing) return existing
          const pc = new RTCPeerConnection({ iceServers: [] })
          peerConnsRef.current.set(targetId, pc)

          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((tr) => pc.addTrack(tr, localStreamRef.current))
          }
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((tr) => pc.addTrack(tr, screenStreamRef.current))
          }

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              ch.postMessage({
                type: 'ice-candidate',
                roomCode: roomId,
                from: peerIdRef.current,
                to: targetId,
                sessionToken: accessAuth.sessionToken,
                candidate: event.candidate.toJSON(),
              })
            }
          }

          pc.ontrack = (event) => {
            const [stream] = event.streams
            if (stream) {
              remoteStreamRef.current = stream
              if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream
              setPeerConnected(true)
            }
          }

          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
              setPeerConnected(true)
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
              peerConnsRef.current.delete(targetId)
              setPeerConnected(peerConnsRef.current.size > 0)
            }
          }

          return pc
        }

        ch.onmessage = async (event) => {
          const msg = event.data
          if (!msg || msg.roomCode !== roomId || msg.from === peerIdRef.current || !msg.sessionToken) return
          if (msg.to && msg.to !== peerIdRef.current) return

          try {
            if (msg.type === 'join') {
              const pc = getOrCreatePeer(msg.from)
              const offer = await pc.createOffer()
              await pc.setLocalDescription(offer)
              ch.postMessage({
                type: 'offer',
                roomCode: roomId,
                from: peerIdRef.current,
                to: msg.from,
                sessionToken: accessAuth.sessionToken,
                sdp: offer,
              })
            } else if (msg.type === 'offer') {
              const pc = getOrCreatePeer(msg.from)
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
              const answer = await pc.createAnswer()
              await pc.setLocalDescription(answer)
              ch.postMessage({
                type: 'answer',
                roomCode: roomId,
                from: peerIdRef.current,
                to: msg.from,
                sessionToken: accessAuth.sessionToken,
                sdp: answer,
              })
            } else if (msg.type === 'answer') {
              const pc = peerConnsRef.current.get(msg.from)
              if (pc) await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
            } else if (msg.type === 'ice-candidate' && msg.candidate) {
              const pc = peerConnsRef.current.get(msg.from)
              if (pc) await pc.addIceCandidate(new RTCIceCandidate(msg.candidate))
            } else if (msg.type === 'screen-state') {
              setPeerScreenActive(Boolean(msg.active))
            } else if (msg.type === 'leave') {
              const pc = peerConnsRef.current.get(msg.from)
              if (pc) {
                pc.close()
                peerConnsRef.current.delete(msg.from)
              }
              if (peerConnsRef.current.size === 0) {
                setPeerConnected(false)
                setPeerScreenActive(false)
                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
              }
            }
          } catch {
            // Ignore transient SDP renegotiation race
          }
        }

        ch.postMessage({
          type: 'join',
          roomCode: roomId,
          from: peerIdRef.current,
          sessionToken: accessAuth.sessionToken,
        })
      }
    }

    initNativeCall()
    return () => {
      cancelled = true
      cleanupAllHardwareAndPeers()
    }
  }, [roomId, accessAuth.authorized, accessAuth.roleSide, accessAuth.sessionToken, isBn])

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current && cameraEnabled && hasLiveVideo) {
      localVideoRef.current.srcObject = localStreamRef.current
    }
  }, [cameraEnabled, hasLiveVideo, compactPip])

  useEffect(() => {
    if (localScreenRef.current && screenStreamRef.current && screenSharing) {
      localScreenRef.current.srcObject = screenStreamRef.current
    }
  }, [screenSharing, compactPip])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current && peerConnected) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current
    }
  }, [peerConnected, compactPip])

  async function replaceLocalVideoTrack(nextVideoStream) {
    const newTrack = nextVideoStream?.getVideoTracks?.()?.[0] || null
    if (!newTrack) return false

    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((oldTrack) => {
        oldTrack.stop()
        localStreamRef.current.removeTrack(oldTrack)
      })
      localStreamRef.current.addTrack(newTrack)
    } else {
      localStreamRef.current = nextVideoStream
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current
    }

    peerConnsRef.current.forEach(async (pc) => {
      const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (videoSender) {
        await videoSender.replaceTrack(newTrack).catch(() => {})
      } else if (localStreamRef.current) {
        pc.addTrack(newTrack, localStreamRef.current)
      }
    })
    setHasLiveVideo(true)
    setMediaNotice('')
    return true
  }

  async function handleCameraToggle() {
    if (cameraEnabled) {
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((tr) => {
          tr.stop()
          localStreamRef.current.removeTrack(tr)
        })
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null
      setHasLiveVideo(false)
      setCameraEnabled(false)
      return
    }

    setCameraEnabled(true)
    if (!navigator.mediaDevices?.getUserMedia) return
    try {
      const videoOnly = await navigator.mediaDevices.getUserMedia({ video: { facingMode } })
      await replaceLocalVideoTrack(videoOnly)
    } catch {
      setMediaNotice(
        isBn
          ? 'ক্যামেরা চালু করা যায়নি — ডিভাইসের অনুমতি পরীক্ষা করুন।'
          : 'Unable to open camera — check browser camera permission.'
      )
      setHasLiveVideo(false)
    }
  }

  async function handleSwitchCamera() {
    if (!navigator.mediaDevices?.getUserMedia) return
    const nextFacing = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(nextFacing)

    try {
      const devices = typeof navigator.mediaDevices.enumerateDevices === 'function'
        ? (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
        : []

      let videoConstraints = { facingMode: nextFacing }
      if (devices.length > 1) {
        cameraDeviceIdxRef.current = (cameraDeviceIdxRef.current + 1) % devices.length
        videoConstraints = { deviceId: { exact: devices[cameraDeviceIdxRef.current].deviceId } }
      }

      const flippedStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints })
      const ok = await replaceLocalVideoTrack(flippedStream)
      if (ok) {
        setCameraEnabled(true)
      }
    } catch {
      setMediaNotice(
        isBn
          ? 'এই ডিভাইসে অতিরিক্ত ক্যামেরা পাওয়া যায়নি বা অনুমতি মেলেনি।'
          : 'No secondary camera available to switch on this device.'
      )
    }
  }

  async function handleToggleScreenShare() {
    if (screenSharing) {
      stopMediaStreamTracks(screenStreamRef.current)
      screenStreamRef.current = null
      if (localScreenRef.current) localScreenRef.current.srcObject = null
      setScreenSharing(false)
      signalChannelRef.current?.postMessage({
        type: 'screen-state',
        roomCode: roomId,
        from: peerIdRef.current,
        sessionToken: accessAuth.sessionToken,
        active: false,
      })
      return
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMediaNotice(
        isBn
          ? 'এই ব্রাউজারে স্ক্রিন শেয়ার (getDisplayMedia) সমর্থিত নয়।'
          : 'Screen sharing is not supported on this browser.'
      )
      return
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      screenStreamRef.current = displayStream
      setScreenSharing(true)
      setMediaNotice('')
      if (localScreenRef.current) {
        localScreenRef.current.srcObject = displayStream
      }

      const [screenTrack] = displayStream.getVideoTracks()
      if (screenTrack) {
        screenTrack.onended = () => {
          setScreenSharing(false)
          if (localScreenRef.current) localScreenRef.current.srcObject = null
          signalChannelRef.current?.postMessage({
            type: 'screen-state',
            roomCode: roomId,
            from: peerIdRef.current,
            sessionToken: accessAuth.sessionToken,
            active: false,
          })
        }

        peerConnsRef.current.forEach(async (pc, targetId) => {
          try {
            pc.addTrack(screenTrack, displayStream)
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            signalChannelRef.current?.postMessage({
              type: 'offer',
              roomCode: roomId,
              from: peerIdRef.current,
              to: targetId,
              sessionToken: accessAuth.sessionToken,
              sdp: offer,
            })
          } catch {
            // ignore renegotiation error
          }
        })
      }

      signalChannelRef.current?.postMessage({
        type: 'screen-state',
        roomCode: roomId,
        from: peerIdRef.current,
        sessionToken: accessAuth.sessionToken,
        active: true,
      })
    } catch {
      setMediaNotice(
        isBn
          ? 'স্ক্রিন শেয়ার বাতিল করা হয়েছে।'
          : 'Screen share cancelled or permission declined.'
      )
    }
  }

  function handleEndCallClick() {
    stopMediaStreamTracks(localStreamRef.current)
    localStreamRef.current = null
    stopMediaStreamTracks(screenStreamRef.current)
    screenStreamRef.current = null
    peerConnsRef.current.forEach((pc) => pc.close())
    peerConnsRef.current.clear()
    if (localVideoRef.current) localVideoRef.current.srcObject = null
    if (localScreenRef.current) localScreenRef.current.srcObject = null
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    setHasLiveVideo(false)
    setHasLiveAudio(false)

    if (onEndCall) {
      onEndCall({
        elapsedSeconds,
        callType: cameraEnabled || screenSharing ? 'Video' : 'Audio',
      })
    }
  }

  if (!accessAuth.authorized) {
    return (
      <div className="pmx-native-auth-denied" role="alert">
        <Lock size={18} aria-hidden="true" />
        <div>
          <strong>{t('consultMediaAuthDeniedTitle')}</strong>
          <p>{t(accessAuth.errorKey || 'consultMediaAuthDenied')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`pmx-native-video-shell${compactPip ? ' is-compact-pip' : ''}`}>
      <div className="pmx-native-stage-viewport">
        {!compactPip && (
          <div className="pmx-native-brand-overlay">
            <span className="pmx-native-brand-pill">
              <ShieldCheck size={12} aria-hidden="true" />
              <span>{t('nativeBrandStageLabel')}</span>
            </span>
            <span className="pmx-call-status-pill" data-state="connected">
              <Clock size={12} aria-hidden="true" />
              <span>{formatDurationMMSS(elapsedSeconds)}</span>
            </span>
          </div>
        )}

        {screenSharing ? (
          <div className="pmx-shared-screen-wrap">
            <video ref={localScreenRef} autoPlay playsInline muted className="pmx-shared-screen-video" />
            <span className="pmx-screen-live-tag">{t('liveSharingScreenTag')}</span>
          </div>
        ) : peerConnected ? (
          <div className="pmx-shared-screen-wrap">
            <video ref={remoteVideoRef} autoPlay playsInline className="pmx-shared-screen-video" />
            {peerScreenActive && <span className="pmx-screen-live-tag">{t('liveHostSharingTag')}</span>}
          </div>
        ) : (
          <div className="pmx-doctor-stage-card">
            <div className="pmx-doctor-monogram" aria-hidden="true">{getInitials(remoteTitle)}</div>
            <strong>{remoteTitle}</strong>
            {!compactPip && <span>{remoteSubtitle || roomId}</span>}
            <div className="pmx-audio-bars" data-active={hasLiveAudio && !micMuted} aria-hidden="true">
              {micLevels.map((lvl, idx) => (
                <span
                  key={idx}
                  style={hasLiveAudio && !micMuted ? { height: `${Math.max(5, Math.round((lvl / 100) * 20))}px` } : undefined}
                />
              ))}
            </div>
            {!compactPip && (
              <small className="pmx-stage-mic-state">
                {cameraEnabled && hasLiveVideo
                  ? t('nativeStageLiveFeedHint')
                  : t('nativeStageAudioReadyHint')}
              </small>
            )}
          </div>
        )}

        <div className="pmx-self-pip dark:bg-gray-900 dark:border-gray-700">
          {cameraEnabled && hasLiveVideo ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="pmx-self-video"
              aria-label={displayName}
            />
          ) : (
            <div className="pmx-self-fallback">
              {cameraEnabled ? <Video size={14} /> : <Mic size={14} />}
              <span>{cameraEnabled ? t('liveCamStarting') : t('callCameraPaused')}</span>
            </div>
          )}
        </div>

        <div className="pmx-native-float-controls" role="toolbar" aria-label={t('nativeCallControlsLabel')}>
          <button
            type="button"
            className={`pmx-float-ctrl-btn${micMuted ? ' is-off' : ''}`}
            onClick={() => setMicMuted((prev) => !prev)}
            aria-pressed={micMuted}
            aria-label={micMuted ? t('callUnmuteMic') : t('callMuteMic')}
            title={micMuted ? t('callUnmuteMic') : t('callMuteMic')}
          >
            {micMuted ? <MicOff size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
          </button>

          <button
            type="button"
            className={`pmx-float-ctrl-btn${!cameraEnabled ? ' is-off' : ''}`}
            onClick={handleCameraToggle}
            aria-pressed={!cameraEnabled}
            aria-label={cameraEnabled ? t('callCameraOff') : t('callCameraOn')}
            title={cameraEnabled ? t('callCameraOff') : t('callCameraOn')}
          >
            {cameraEnabled ? <Video size={16} aria-hidden="true" /> : <VideoOff size={16} aria-hidden="true" />}
          </button>

          <button
            type="button"
            className="pmx-float-ctrl-btn"
            onClick={handleSwitchCamera}
            aria-label={t('nativeSwitchCameraBtn')}
            title={t('nativeSwitchCameraBtn')}
          >
            <SwitchCamera size={16} aria-hidden="true" />
          </button>

          {!compactPip && (
            <button
              type="button"
              className={`pmx-float-ctrl-btn${screenSharing ? ' is-sharing' : ''}`}
              onClick={handleToggleScreenShare}
              aria-pressed={screenSharing}
              aria-label={screenSharing ? t('liveStopScreenShareBtn') : t('liveShareScreenBtn')}
              title={screenSharing ? t('liveStopScreenShareBtn') : t('liveShareScreenBtn')}
            >
              {screenSharing ? <MonitorOff size={16} aria-hidden="true" /> : <MonitorUp size={16} aria-hidden="true" />}
            </button>
          )}

          <button
            type="button"
            className="pmx-float-end-btn"
            onClick={handleEndCallClick}
            aria-label={t('callEndAndLog')}
            title={t('callEndAndLog')}
          >
            <PhoneOff size={16} aria-hidden="true" />
            {!compactPip && <span>{t('callEndShort')}</span>}
          </button>
        </div>
      </div>

      {mediaNotice && !compactPip && (
        <p className="pmx-inline-media-notice dark:text-amber-200">{mediaNotice}</p>
      )}
    </div>
  )
}
