import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Clock,
  Globe,
  Hand,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  Radio,
  Users,
  Video,
  VideoOff,
} from 'lucide-react'
import {
  buildJitsiMountOptions,
  buildLiveJitsiRoomName,
  loadJitsiExternalApi,
} from '../lib/paymentAdapter.js'
import {
  getRoomInteractionState,
  getRoomRoleGrouping,
  POULTRYMEDIX_ROOM_INTERACTION_CHANNEL,
  POULTRYMEDIX_ROOM_INTERACTION_EVENT,
  toggleRaiseHand,
} from '../lib/liveRoomInteractionStore.js'
import { TELEHEALTH_SIGNAL_CHANNEL } from '../lib/telehealthNotifier.js'
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

export default function LiveMediaStage({
  roomId = 'PMX-ROOM-LIVE',
  userRole = 'FARMER',
  displayName = 'PoultryMedix Participant',
  participantId = '',
  remoteTitle = 'Veterinary Host',
  remoteSubtitle = '',
  initialAudioOnly = false,
  heightPx = 360,
  onLeaveOrEnd,
  endButtonLabel = '',
  hideBottomLeaveButton = false,
}) {
  const { t, language } = useLanguage()
  const isBn = language === 'bn'
  const roleInfo = useMemo(() => getRoomRoleGrouping(userRole), [userRole])
  const isHost = roleInfo.isHost

  const [engine, setEngine] = useState('jitsi')
  const [jitsiState, setJitsiState] = useState('loading') // loading | ready | fallback
  const [jitsiFallbackReason, setJitsiFallbackReason] = useState('')
  const [studioStatus, setStudioStatus] = useState('connecting') // connecting | connected
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const [micMuted, setMicMuted] = useState(!isHost)
  const [cameraEnabled, setCameraEnabled] = useState(isHost && !initialAudioOnly)
  const [screenSharing, setScreenSharing] = useState(false)
  const [hasLiveVideo, setHasLiveVideo] = useState(false)
  const [hasLiveAudio, setHasLiveAudio] = useState(false)
  const [peerConnected, setPeerConnected] = useState(false)
  const [peerScreenActive, setPeerScreenActive] = useState(false)
  const [participantCount, setParticipantCount] = useState(1)
  const [mediaNotice, setMediaNotice] = useState('')
  const [micLevels, setMicLevels] = useState([20, 32, 26, 38, 22])

  const cleanParticipantId = useMemo(
    () => participantId || `${roleInfo.userRole}-${displayName}`.slice(0, 48),
    [participantId, roleInfo.userRole, displayName]
  )

  const [handRaised, setHandRaised] = useState(() => {
    const state = getRoomInteractionState(roomId)
    return state.raisedHands.some((h) => h.participantId === cleanParticipantId)
  })

  const jitsiMountRef = useRef(null)
  const jitsiApiRef = useRef(null)
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
  const micMutedRef = useRef(micMuted)
  const elapsedSecondsRef = useRef(elapsedSeconds)
  const onLeaveOrEndRef = useRef(onLeaveOrEnd)

  useEffect(() => {
    micMutedRef.current = micMuted
  }, [micMuted])

  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds
  }, [elapsedSeconds])

  useEffect(() => {
    onLeaveOrEndRef.current = onLeaveOrEnd
  }, [onLeaveOrEnd])

  const liveJitsiRoomName = useMemo(() => buildLiveJitsiRoomName(roomId), [roomId])

  // Keep local handRaised indicator synced with cross-tab Clear / Lower actions
  useEffect(() => {
    function syncHandState() {
      const state = getRoomInteractionState(roomId)
      const isStillRaised = state.raisedHands.some((h) => h.participantId === cleanParticipantId)
      setHandRaised(isStillRaised)
    }
    window.addEventListener(POULTRYMEDIX_ROOM_INTERACTION_EVENT, syncHandState)
    window.addEventListener('storage', syncHandState)
    let bc = null
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(POULTRYMEDIX_ROOM_INTERACTION_CHANNEL)
      bc.onmessage = syncHandState
    }
    return () => {
      if (bc) bc.close()
      window.removeEventListener(POULTRYMEDIX_ROOM_INTERACTION_EVENT, syncHandState)
      window.removeEventListener('storage', syncHandState)
    }
  }, [roomId, cleanParticipantId])

  // Active duration timer once room is up
  useEffect(() => {
    const ready = engine === 'jitsi' ? jitsiState === 'ready' : studioStatus === 'connected'
    if (!ready) return undefined
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [engine, jitsiState, studioStatus])

  // Primary Engine: Dynamically load Jitsi External API & mount Host/Participant room
  useEffect(() => {
    if (engine !== 'jitsi') return undefined

    let cancelled = false
    let mountedApi = null

    async function mountJitsiConference() {
      try {
        const JitsiExternalAPI = await loadJitsiExternalApi(7000)
        if (cancelled || !jitsiMountRef.current) return

        jitsiMountRef.current.innerHTML = ''
        const options = buildJitsiMountOptions({
          roomId,
          displayName,
          isHost,
          startAudioOnly: initialAudioOnly,
          height: heightPx,
          parentNode: jitsiMountRef.current,
        })

        mountedApi = new JitsiExternalAPI('meet.jit.si', options)
        jitsiApiRef.current = mountedApi

        mountedApi.addListener('videoConferenceJoined', () => {
          if (cancelled) return
          setJitsiState('ready')
          setParticipantCount(Math.max(1, mountedApi.getNumberOfParticipants?.() || 1))
        })

        mountedApi.addListener('participantJoined', () => {
          if (cancelled) return
          setParticipantCount(Math.max(1, mountedApi.getNumberOfParticipants?.() || 1))
        })

        mountedApi.addListener('participantLeft', () => {
          if (cancelled) return
          setParticipantCount(Math.max(1, mountedApi.getNumberOfParticipants?.() || 1))
        })

        mountedApi.addListener('readyToClose', () => {
          if (!cancelled && onLeaveOrEndRef.current) {
            onLeaveOrEndRef.current({ elapsedSeconds: elapsedSecondsRef.current, engine: 'jitsi' })
          }
        })
      } catch (err) {
        if (cancelled) return
        setJitsiFallbackReason(
          isBn
            ? 'লাইভ Jitsi সার্ভার অফলাইন বা সীমাবদ্ধ — সরাসরি হার্ডওয়্যার WebRTC স্টুডিও মোড চালু হয়েছে।'
            : `${err?.message || 'Jitsi Meet unavailable offline'} — switched to Direct Hardware Studio Mode.`
        )
        setJitsiState('fallback')
        setEngine('studio')
      }
    }

    mountJitsiConference()

    return () => {
      cancelled = true
      if (mountedApi) {
        try {
          mountedApi.dispose()
        } catch {
          // ignore dispose errors
        }
      }
      jitsiApiRef.current = null
    }
  }, [engine, roomId, displayName, isHost, initialAudioOnly, heightPx, isBn])

  // Secondary Engine (Offline / Restricted fallback + toggleable studio): Real getUserMedia + BroadcastChannel WebRTC
  useEffect(() => {
    if (engine !== 'studio') return undefined

    let cancelled = false
    let levelInterval = null
    const studioReadyTimer = window.setTimeout(() => {
      if (!cancelled) setStudioStatus('connected')
    }, 350)

    function cleanupStudio() {
      window.clearTimeout(studioReadyTimer)
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
          })
          signalChannelRef.current.close()
        } catch {
          // ignore cleanup failures
        }
        signalChannelRef.current = null
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((tr) => tr.stop())
        localStreamRef.current = null
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((tr) => tr.stop())
        screenStreamRef.current = null
      }
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
            : 'Browser navigator.mediaDevices API unavailable.'
        )
        return null
      }

      if (cameraEnabled) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
          return { stream, videoOk: stream.getVideoTracks().length > 0, audioOk: stream.getAudioTracks().length > 0 }
        } catch {
          try {
            const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            setMediaNotice(
              isBn
                ? 'ক্যামেরা পাওয়া যায়নি — মাইক্রোফোন অডিও সক্রিয় আছে।'
                : 'Webcam unavailable — microphone audio remains active.'
            )
            return { stream: audioOnly, videoOk: false, audioOk: audioOnly.getAudioTracks().length > 0 }
          } catch {
            setMediaNotice(
              isBn
                ? 'অফলাইন স্টুডিও প্রিভিউ মোড চালু (ক্যামেরা/মাইক অনুমতি দিলে সরাসরি স্ট্রিম হবে)।'
                : 'Studio preview active — grant camera/mic permission to stream live hardware feed.'
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
            ? 'মাইক্রোফোন সংযুক্ত নয় বা মিউট করা — প্রয়োজন হলে আনমিউট করুন।'
            : 'Microphone not connected or permission skipped — toggle Mic/Camera anytime.'
        )
        return null
      }
    }

    async function initStudio() {
      const acquired = await acquireInitialMedia()
      if (cancelled) {
        if (acquired?.stream) acquired.stream.getTracks().forEach((tr) => tr.stop())
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
            }, 130)
          } catch {
            // fallback levels
          }
        }
      }

      // Cross-tab P2P WebRTC signaling over BroadcastChannel
      if (typeof BroadcastChannel !== 'undefined' && typeof RTCPeerConnection !== 'undefined') {
        if (!peerIdRef.current) {
          const rand = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID().slice(0, 8)
            : Math.random().toString(36).slice(2, 10)
          peerIdRef.current = `${roleInfo.side}-${rand}`
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
              setParticipantCount(Math.max(2, peerConnsRef.current.size + 1))
            }
          }

          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
              setPeerConnected(true)
              setParticipantCount(Math.max(2, peerConnsRef.current.size + 1))
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
              peerConnsRef.current.delete(targetId)
              setPeerConnected(peerConnsRef.current.size > 0)
              setParticipantCount(Math.max(1, peerConnsRef.current.size + 1))
            }
          }

          return pc
        }

        ch.onmessage = async (event) => {
          const msg = event.data
          if (!msg || msg.roomCode !== roomId || msg.from === peerIdRef.current) return
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
              setParticipantCount(Math.max(1, peerConnsRef.current.size + 1))
            }
          } catch {
            // ignore transient SDP mismatch
          }
        }

        ch.postMessage({
          type: 'join',
          roomCode: roomId,
          from: peerIdRef.current,
          role: roleInfo.side,
        })
      }
    }

    initStudio()
    return () => {
      cancelled = true
      cleanupStudio()
    }
  }, [engine, roomId, roleInfo.side, cameraEnabled, isBn])

  // Bind streams cleanly after React mounts each conditional <video> node
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current && cameraEnabled && hasLiveVideo) {
      localVideoRef.current.srcObject = localStreamRef.current
    }
  }, [cameraEnabled, hasLiveVideo, engine])

  useEffect(() => {
    if (localScreenRef.current && screenStreamRef.current && screenSharing) {
      localScreenRef.current.srcObject = screenStreamRef.current
    }
  }, [screenSharing, engine])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current && peerConnected) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current
    }
  }, [peerConnected, engine])

  useEffect(() => {
    if (!localStreamRef.current) return
    localStreamRef.current.getAudioTracks().forEach((tr) => {
      tr.enabled = !micMuted
    })
  }, [micMuted])

  async function handleToggleScreenShare() {
    if (screenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((tr) => tr.stop())
        screenStreamRef.current = null
      }
      if (localScreenRef.current) localScreenRef.current.srcObject = null
      setScreenSharing(false)
      signalChannelRef.current?.postMessage({ type: 'screen-state', roomCode: roomId, from: peerIdRef.current, active: false })
      return
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMediaNotice(
        isBn
          ? 'এই ব্রাউজারে Screen Share (getDisplayMedia) সমর্থিত নয়।'
          : 'Screen sharing (getDisplayMedia) is not supported on this browser.'
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
          signalChannelRef.current?.postMessage({ type: 'screen-state', roomCode: roomId, from: peerIdRef.current, active: false })
        }

        // Attach & renegotiate across all connected peers so remote tabs see live slides immediately
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
              sdp: offer,
            })
          } catch {
            // ignore per-peer renegotiation edge errors
          }
        })
      }

      signalChannelRef.current?.postMessage({ type: 'screen-state', roomCode: roomId, from: peerIdRef.current, active: true })
    } catch {
      setMediaNotice(
        isBn
          ? 'স্ক্রিন শেয়ার বাতিল করা হয়েছে বা অনুমতি দেওয়া হয়নি।'
          : 'Screen share cancelled or permission declined.'
      )
    }
  }

  function handleMicToggle() {
    if (engine === 'jitsi' && jitsiApiRef.current) {
      try {
        jitsiApiRef.current.executeCommand('toggleAudio')
      } catch {
        // ignore
      }
    }
    setMicMuted((prev) => !prev)
  }

  function handleCameraToggle() {
    if (engine === 'jitsi' && jitsiApiRef.current) {
      try {
        jitsiApiRef.current.executeCommand('toggleVideo')
      } catch {
        // ignore
      }
    }
    setCameraEnabled((prev) => !prev)
  }

  function handleRaiseHandAction() {
    const res = toggleRaiseHand(roomId, {
      participantId: cleanParticipantId,
      participantName: displayName,
      userRole: roleInfo.userRole,
    })
    setHandRaised(res.raised)
    if (engine === 'jitsi' && jitsiApiRef.current) {
      try {
        jitsiApiRef.current.executeCommand('toggleRaiseHand')
      } catch {
        // ignore
      }
    }
  }

  function handleEndOrLeave() {
    if (jitsiApiRef.current) {
      try {
        jitsiApiRef.current.dispose()
      } catch {
        // ignore
      }
      jitsiApiRef.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((tr) => tr.stop())
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((tr) => tr.stop())
    }
    if (onLeaveOrEnd) {
      onLeaveOrEnd({ elapsedSeconds, engine })
    }
  }

  return (
    <div className="pmx-live-stage-shell dark:bg-gray-900 dark:border-gray-700">
      {/* Unified Stage Control Bar: Engine Switcher + HOST LIVE / PARTICIPANT Status */}
      <div className="pmx-live-stage-topbar dark:bg-gray-950 dark:border-gray-800">
        <div className="pmx-live-role-cluster">
          <span className={`pmx-live-role-badge ${isHost ? 'is-host' : 'is-participant'}`}>
            {t(roleInfo.badgeKey)}
          </span>
          <span className="pmx-room-code-pill">{liveJitsiRoomName}</span>
          <span className="pmx-live-peers-pill">
            <Users size={12} aria-hidden="true" />
            <span>{participantCount}</span>
          </span>
          <span className="pmx-call-status-pill" data-state={engine === 'jitsi' ? (jitsiState === 'ready' ? 'connected' : 'connecting') : studioStatus}>
            <Clock size={12} aria-hidden="true" />
            <span>{formatDurationMMSS(elapsedSeconds)}</span>
          </span>
        </div>

        <div className="pmx-mode-switch-group" role="group" aria-label={t('callEngineLabel')}>
          <button
            type="button"
            className={`pmx-mode-tab${engine === 'jitsi' ? ' is-active' : ''}`}
            onClick={() => {
              setJitsiFallbackReason('')
              setJitsiState('loading')
              setEngine('jitsi')
            }}
          >
            <Globe size={12} aria-hidden="true" />
            <span>{t('callEngineJitsi')}</span>
          </button>
          <button
            type="button"
            className={`pmx-mode-tab${engine === 'studio' ? ' is-active' : ''}`}
            onClick={() => setEngine('studio')}
          >
            <Radio size={12} aria-hidden="true" />
            <span>{t('liveEngineHardwareStudio')}</span>
          </button>
        </div>
      </div>

      {jitsiFallbackReason && (
        <div className="pmx-live-fallback-banner" role="status">
          <span>{jitsiFallbackReason}</span>
        </div>
      )}

      {/* Primary Video / Presentation Stage */}
      {engine === 'jitsi' ? (
        <div className="pmx-jitsi-stage dark:bg-gray-950 dark:border-gray-800">
          {jitsiState === 'loading' && (
            <div className="pmx-jitsi-loading-overlay">
              <span>{t('liveJitsiConnecting')}</span>
            </div>
          )}
          <div ref={jitsiMountRef} className="pmx-jitsi-mount-box" style={{ minHeight: `${heightPx}px` }} />
          <div className="pmx-jitsi-fallback-bar">
            <span>{t('liveRoomStageNote', { roomName: liveJitsiRoomName })}</span>
            <button type="button" className="pmx-mode-tab" onClick={() => setEngine('studio')}>
              {t('liveSwitchToHardwareStudio')}
            </button>
          </div>
        </div>
      ) : (
        <div className="pmx-call-stage pmx-studio-stage dark:bg-gray-950 dark:border-gray-800" style={{ minHeight: `${heightPx}px` }}>
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
              <div className="pmx-doctor-monogram" aria-hidden="true">{getInitials(isHost ? displayName : remoteTitle)}</div>
              <strong>{isHost ? `${displayName} (${t(roleInfo.badgeKey)})` : remoteTitle}</strong>
              <span>{remoteSubtitle || `${roomId} · ${t('liveEngineHardwareStudio')}`}</span>
              <div className="pmx-audio-bars" data-active={hasLiveAudio && !micMuted} aria-hidden="true">
                {micLevels.map((lvl, idx) => (
                  <span
                    key={idx}
                    style={hasLiveAudio && !micMuted ? { height: `${Math.max(5, Math.round((lvl / 100) * 20))}px` } : undefined}
                  />
                ))}
              </div>
              <small className="pmx-stage-mic-state">
                {isHost
                  ? t('liveHostStudioReadyHint')
                  : t('liveParticipantStudioWaitHint')}
              </small>
            </div>
          )}

          {/* Local Camera Picture-in-Picture */}
          <div className="pmx-self-pip dark:bg-gray-900 dark:border-gray-700">
            {cameraEnabled && hasLiveVideo ? (
              <video ref={localVideoRef} autoPlay playsInline muted className="pmx-self-video" />
            ) : (
              <div className="pmx-self-fallback">
                {cameraEnabled ? <Video size={15} /> : <Mic size={15} />}
                <span>{cameraEnabled ? t('liveCamStarting') : t('callCameraPaused')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {mediaNotice && engine === 'studio' && (
        <p className="pmx-inline-media-notice dark:text-amber-200">{mediaNotice}</p>
      )}

      {/* Role-Specific Bottom Control Dock */}
      <footer className="pmx-call-controls dark:bg-gray-950 dark:border-gray-800">
        {engine === 'studio' && (
          <>
            <button
              type="button"
              className={`pmx-call-toggle-btn${micMuted ? ' is-off' : ''}`}
              onClick={handleMicToggle}
              aria-pressed={micMuted}
            >
              {micMuted ? <MicOff size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
              <span>{micMuted ? t('callUnmuteMic') : t('callMuteMic')}</span>
            </button>

            <button
              type="button"
              className={`pmx-call-toggle-btn${!cameraEnabled ? ' is-off' : ''}`}
              onClick={handleCameraToggle}
              aria-pressed={!cameraEnabled}
            >
              {cameraEnabled ? <Video size={15} aria-hidden="true" /> : <VideoOff size={15} aria-hidden="true" />}
              <span>{cameraEnabled ? t('callCameraOff') : t('callCameraOn')}</span>
            </button>

            {isHost && (
              <button
                type="button"
                className={`pmx-call-toggle-btn${screenSharing ? ' is-sharing' : ''}`}
                onClick={handleToggleScreenShare}
                aria-pressed={screenSharing}
              >
                {screenSharing ? <MonitorOff size={15} aria-hidden="true" /> : <MonitorUp size={15} aria-hidden="true" />}
                <span>{screenSharing ? t('liveStopScreenShareBtn') : t('liveShareScreenBtn')}</span>
              </button>
            )}
          </>
        )}

        {!isHost && (
          <button
            type="button"
            className={`pmx-call-toggle-btn${handRaised ? ' is-hand-raised' : ''}`}
            onClick={handleRaiseHandAction}
            aria-pressed={handRaised}
          >
            <Hand size={15} aria-hidden="true" />
            <span>{handRaised ? t('liveLowerHandBtn') : t('liveRaiseHandBtn')}</span>
          </button>
        )}

        {onLeaveOrEnd && !hideBottomLeaveButton && (
          <button
            type="button"
            className="pmx-call-end-btn"
            onClick={handleEndOrLeave}
          >
            <PhoneOff size={15} aria-hidden="true" />
            <span>{endButtonLabel || (isHost ? t('seminarEndSessionBtn') : t('seminarLeaveRoomBtn'))}</span>
          </button>
        )}
      </footer>
    </div>
  )
}
