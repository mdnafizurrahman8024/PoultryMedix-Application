import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../context/useLanguage.js'
import Icon from './Icon.jsx'

const maxRecordingBytes = 8 * 1024 * 1024

export default function VoiceRecorder({ onAudioReady, compact = false, disabled = false, buttonLabel, buttonAriaLabel }) {
  const { t } = useLanguage()
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => {
    recorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  async function toggleRecording() {
    setError('')
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(t('audioUnavailable'))
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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
        setRecording(false)
        if (blob.size > maxRecordingBytes) setError(t('audioTooLarge'))
        else if (blob.size) onAudioReady(blob)
      }, { once: true })
      recorder.start()
      setRecording(true)
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setError(t('audioPermissionError'))
    }
  }

  return (
    <div className={`voice-recorder${compact ? ' voice-recorder--compact' : ''}`}>
      <button
        className={`voice-record-button${recording ? ' is-recording' : ''}`}
        type="button"
        disabled={disabled}
        aria-pressed={recording}
        aria-label={recording ? t('stopRecording') : buttonAriaLabel || buttonLabel || t('recordVoice')}
        onClick={toggleRecording}
      >
        <Icon name={recording ? 'stop' : 'mic'} size={compact ? 16 : 18} />
        <span>{recording ? t('stopRecording') : buttonLabel || t('recordVoice')}</span>
      </button>
      {error && <span className="voice-error" role="status">{error}</span>}
    </div>
  )
}
