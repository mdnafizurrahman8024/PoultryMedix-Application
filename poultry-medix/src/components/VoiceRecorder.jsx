import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../context/useLanguage.js'
import Icon from './Icon.jsx'

const maxRecordingBytes = 8 * 1024 * 1024

function formatDuration(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export default function VoiceRecorder({ onAudioReady, compact = false, disabled = false, buttonLabel, buttonAriaLabel }) {
  const { t } = useLanguage()
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const confirmAfterStopRef = useRef(false)
  const discardAfterStopRef = useRef(false)
  const mountedRef = useRef(false)
  const [phase, setPhase] = useState('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [recordedBlob, setRecordedBlob] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (phase !== 'recording') return undefined
    const timer = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000)
    return () => window.clearInterval(timer)
  }, [phase])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      recorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  async function startRecording() {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(t('audioUnavailable'))
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      const chunks = []
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size) chunks.push(event.data)
      })
      recorder.addEventListener('stop', () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        if (!mountedRef.current) return
        if (discardAfterStopRef.current) {
          discardAfterStopRef.current = false
          confirmAfterStopRef.current = false
          setRecordedBlob(null)
          setElapsedSeconds(0)
          setPhase('idle')
        } else if (blob.size > maxRecordingBytes) {
          confirmAfterStopRef.current = false
          setRecordedBlob(null)
          setPhase('idle')
          setError(t('audioTooLarge'))
        } else if (blob.size && confirmAfterStopRef.current) {
          confirmAfterStopRef.current = false
          onAudioReady?.(blob)
          setElapsedSeconds(0)
          setRecordedBlob(null)
          setPhase('idle')
        } else if (blob.size) {
          setRecordedBlob(blob)
          setPhase('ready')
        } else {
          setPhase('idle')
        }
      }, { once: true })
      recorder.start()
      setElapsedSeconds(0)
      confirmAfterStopRef.current = false
      setRecordedBlob(null)
      setPhase('recording')
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      recorderRef.current = null
      if (!mountedRef.current) return
      setPhase('idle')
      setError(t('audioPermissionError'))
    }
  }

  function togglePause() {
    const recorder = recorderRef.current
    if (!recorder) return
    if (phase === 'recording' && recorder.state === 'recording') {
      recorder.pause()
      setPhase('paused')
    } else if (phase === 'paused' && recorder.state === 'paused') {
      recorder.resume()
      setPhase('recording')
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }

  function sendRecordingNow() {
    if (phase !== 'recording' && phase !== 'paused') return
    confirmAfterStopRef.current = true
    stopRecording()
  }

  function confirmRecording() {
    if (!recordedBlob) return
    onAudioReady?.(recordedBlob)
    setRecordedBlob(null)
    setElapsedSeconds(0)
    setPhase('idle')
  }

  function cancelRecording() {
    confirmAfterStopRef.current = false
    if (phase === 'recording' || phase === 'paused') {
      discardAfterStopRef.current = true
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      return
    }
    setRecordedBlob(null)
    setElapsedSeconds(0)
    setError('')
    setPhase('idle')
  }

  return (
    <div className={`voice-recorder${compact ? ' voice-recorder--compact' : ''}${phase !== 'idle' ? ' is-in-session' : ''}`}>
      {phase === 'idle' && <button
        className="voice-record-button glass-upload-button"
        type="button"
        disabled={disabled}
        aria-label={buttonAriaLabel || buttonLabel || t('recordVoice')}
        onClick={startRecording}
      >
        <Icon name="mic" size={compact ? 16 : 18} />
        <span>{buttonLabel || t('recordVoice')}</span>
      </button>}

      {(phase === 'recording' || phase === 'paused') && <div className={`voice-recorder-controls${phase === 'paused' ? ' is-paused' : ''}`}>
        <span className="voice-recording-timer" aria-live="off"><i />{formatDuration(elapsedSeconds)}</span>
        <div className="voice-recorder-icon-actions">
          <button className="voice-recorder-control voice-recorder-pause" type="button" onClick={togglePause} aria-label={t(phase === 'paused' ? 'resumeRecording' : 'pauseRecording')} title={t(phase === 'paused' ? 'resumeRecording' : 'pauseRecording')}>
            <Icon name={phase === 'paused' ? 'play' : 'pause'} size={16} />
          </button>
          <button className="voice-recorder-control voice-recorder-stop" type="button" onClick={stopRecording} aria-label={t('stopRecording')} title={t('stopRecording')}>
            <Icon name="stop" size={16} />
          </button>
          <button className="voice-recorder-control voice-recorder-cancel" type="button" onClick={cancelRecording} aria-label={t('cancelRecording')} title={t('cancelRecording')}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <button className="voice-recorder-control voice-recorder-send voice-recorder-send-now" type="button" onClick={sendRecordingNow} aria-label={t('confirmRecording')}>
          <Icon name="send" size={15} /><span>{t('confirmRecording')}</span>
        </button>
      </div>}

      {phase === 'ready' && <div className="voice-recorder-controls voice-recorder-confirm">
        <span className="voice-recording-timer"><Icon name="check" size={14} />{formatDuration(elapsedSeconds)}</span>
        <button className="voice-recorder-control voice-recorder-cancel voice-recorder-icon-only" type="button" onClick={cancelRecording} aria-label={t('discardRecording')} title={t('discardRecording')}>
          <Icon name="close" size={16} />
        </button>
        <button className="voice-recorder-control voice-recorder-retake" type="button" onClick={startRecording} disabled={disabled}>
          <Icon name="mic" size={15} /><span>{t('recordAgain')}</span>
        </button>
        <button className="voice-recorder-control voice-recorder-send" type="button" onClick={confirmRecording} disabled={disabled}>
          <Icon name="send" size={15} /><span>{t('confirmRecording')}</span>
        </button>
      </div>}

      {error && <span className="voice-error" role="status">{error}</span>}
    </div>
  )
}
