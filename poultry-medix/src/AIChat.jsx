import { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase.js'
import { runMultimodalDiagnosis } from './lib/ai.js'
import { useLanguage } from './context/useLanguage.js'
import Icon from './components/Icon.jsx'
import AiSafetyBanner from './components/AiSafetyBanner.jsx'
import { saveHistoryEntry } from './veterinary/historyStore.js'

const supportedMimeTypes = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  'audio/aac', 'audio/flac', 'audio/mp3', 'audio/m4a', 'audio/mp4', 'audio/mpeg',
  'audio/mpga', 'audio/ogg', 'audio/opus', 'audio/wav', 'audio/webm',
])
const maxFileSize = 8 * 1024 * 1024

function VetDoctorChatImage({ className, alt = 'PoultryMedix AI Diagnostic', size, style }) {
  const [imageFailed, setImageFailed] = useState(false)
  const fallbackSize = typeof size === 'number' ? `${size}px` : size || '100%'
  const fallbackIconSize = Math.max(16, Number.parseInt(size || '24', 10) * 0.42)

  if (imageFailed) {
    return (
      <span
        className={className}
        role="img"
        aria-label={`${alt} fallback`}
        style={{ width: fallbackSize, height: fallbackSize, display: 'grid', placeItems: 'center', position: 'relative', borderRadius: '50%', background: 'linear-gradient(135deg, #064e3b, #047857)', color: '#d9f99d' }}
      >
        <Icon name="stethoscope" size={fallbackIconSize} />
        <span aria-hidden="true" style={{ position: 'absolute', fontSize: '0.7em', fontWeight: 800 }}>+</span>
      </span>
    )
  }

  return (
    <img
      className={className}
      src="/images/chat-icon.png"
      alt={alt}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style }}
      onError={() => setImageFailed(true)}
    />
  )
}
export default function AIChat({ isWideDesktop = false }) {
  const { t, language } = useLanguage()
  const [userRole, setUserRole] = useState('farmer')
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ x: null, y: 0 })
  const [files, setFiles] = useState([])
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingStatusKey, setLoadingStatusKey] = useState('analyzing')
  const [dragError, setDragError] = useState('')
  const [modelWarning, setModelWarning] = useState('')
  const [guestNotice, setGuestNotice] = useState('')
  const [historyWarning, setHistoryWarning] = useState('')
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const inputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const listRef = useRef(null)
  const fabRef = useRef(null)
  const dragRef = useRef(null)
  const draggedRef = useRef(false)
  const suppressClickRef = useRef(false)
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const recordingTimerRef = useRef(null)
  const chatSessionId = useRef('')
  if (!chatSessionId.current) chatSessionId.current = crypto.randomUUID()

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const role = data.session?.user?.user_metadata?.userRole
        || data.session?.user?.user_metadata?.role
      if (['farmer', 'vet_student', 'registered_vet'].includes(role)) setUserRole(role)
    }).catch((error) => {
      console.error('Unable to load the AI access role.', error)
    })
    return () => { active = false }
  }, [])

  function saveChatResponse(question, queuedFiles, assistantMessage) {
    try {
      const previousMessages = messages
        .filter((item) => item.role !== 'error')
        .slice(-36)
        .map(({ role, text, files: attachedFiles, sources, externalReference }) => ({
          role,
          text,
          ...(attachedFiles?.length ? { files: attachedFiles } : {}),
          ...(sources?.length ? { sources } : {}),
          ...(externalReference ? { externalReference } : {}),
        }))
      const userMessage = { role: 'user', text: question || t('attachedFilesOnly') }
      if (queuedFiles.length) userMessage.files = queuedFiles.map(({ name }) => name)
      const existing = JSON.parse(localStorage.getItem('poultry-history-chats') || '[]')
        .find((record) => record.id === chatSessionId.current)
      const now = new Date().toISOString()
      saveHistoryEntry('chat', {
        id: chatSessionId.current,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        summary: existing?.summary || question.slice(0, 140) || t('attachedFilesOnly'),
        transcript: [
          ...previousMessages,
          userMessage,
          {
            role: 'assistant',
            text: assistantMessage.text,
            ...(assistantMessage.sources?.length ? { sources: assistantMessage.sources } : {}),
            ...(assistantMessage.externalReference ? { externalReference: assistantMessage.externalReference } : {}),
          },
        ].slice(-40),
      })
      setHistoryWarning('')
    } catch (historyError) {
      console.error('Unable to save AI chat history.', historyError)
      setHistoryWarning(t('historySaveError'))
    }
  }

  useEffect(() => {
    function constrainPosition() {
      const fab = fabRef.current
      if (!fab) return
      window.requestAnimationFrame(() => {
        const container = fab.closest('.dashboard-content')
        const containerBounds = container?.getBoundingClientRect()
        if (!containerBounds) return
        const width = fab.offsetWidth || 70
        const height = fab.offsetHeight || 90
        setPosition((current) => current.x === null ? current : ({
          x: Math.max(8, Math.min(containerBounds.width - width - 8, current.x)),
          y: Math.max(8, Math.min(containerBounds.height - height - 8, current.y)),
        }))
      })
    }

    window.addEventListener('resize', constrainPosition)
    window.addEventListener('orientationchange', constrainPosition)
    return () => {
      window.removeEventListener('resize', constrainPosition)
      window.removeEventListener('orientationchange', constrainPosition)
    }
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages, loading])

  useEffect(() => {
    if (!open) return undefined
    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open])

  useEffect(() => () => {
    recorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    window.clearInterval(recordingTimerRef.current)
    const drag = dragRef.current
    if (drag) {
      if (drag.rafId) window.cancelAnimationFrame(drag.rafId)
      window.removeEventListener('mousemove', drag.moveMouse)
      window.removeEventListener('mouseup', drag.endMouse)
      window.removeEventListener('touchmove', drag.moveTouch)
      window.removeEventListener('touchend', drag.endTouch)
      window.removeEventListener('touchcancel', drag.endTouch)
    }
  }, [])

  function finishDrag() {
    const drag = dragRef.current
    if (!drag) return
    if (drag.rafId) window.cancelAnimationFrame(drag.rafId)
    window.removeEventListener('mousemove', drag.moveMouse)
    window.removeEventListener('mouseup', drag.endMouse)
    window.removeEventListener('touchmove', drag.moveTouch)
    window.removeEventListener('touchend', drag.endTouch)
    window.removeEventListener('touchcancel', drag.endTouch)
    dragRef.current = null
    suppressClickRef.current = true
    if (drag.moved) {
      draggedRef.current = true
    } else {
      setOpen((value) => !value)
    }
  }

  function startDrag(event, inputType) {
    if (inputType === 'mouse' && event.button !== 0) return
    const point = inputType === 'touch' ? event.touches[0] : event
    if (!point) return
    event.preventDefault()
    const fab = fabRef.current
    const bounds = fab?.getBoundingClientRect()
    const containerBounds = fab?.closest('.dashboard-content')?.getBoundingClientRect()
    const drag = {
      startX: point.clientX,
      startY: point.clientY,
      originX: bounds && containerBounds ? bounds.left - containerBounds.left : (position.x ?? 0),
      originY: bounds && containerBounds ? bounds.top - containerBounds.top : position.y,
      containerWidth: containerBounds?.width || window.innerWidth,
      containerHeight: containerBounds?.height || window.innerHeight,
      moved: false,
      rafId: 0,
      moveMouse: null,
      endMouse: null,
      moveTouch: null,
      endTouch: null,
    }
    drag.move = (moveEvent) => {
      const movePoint = inputType === 'touch' ? moveEvent.touches[0] : moveEvent
      if (!movePoint) return
      const deltaX = movePoint.clientX - drag.startX
      const deltaY = movePoint.clientY - drag.startY
      if (Math.hypot(deltaX, deltaY) > 5) drag.moved = true
      if (!drag.moved || drag.rafId) return
      drag.rafId = window.requestAnimationFrame(() => {
        drag.rafId = 0
        const width = fabRef.current?.offsetWidth || 70
        const height = fabRef.current?.offsetHeight || 90
        setPosition({
          x: Math.max(8, Math.min(drag.containerWidth - width - 8, drag.originX + deltaX)),
          y: Math.max(8, Math.min(drag.containerHeight - height - 8, drag.originY + deltaY)),
        })
      })
    }
    drag.end = () => finishDrag()
    drag.moveMouse = (moveEvent) => drag.move(moveEvent)
    drag.endMouse = () => drag.end()
    drag.moveTouch = (moveEvent) => {
      moveEvent.preventDefault()
      drag.move(moveEvent)
    }
    drag.endTouch = () => drag.end()
    dragRef.current = drag
    draggedRef.current = false
    if (inputType === 'touch') {
      window.addEventListener('touchmove', drag.moveTouch, { passive: false })
      window.addEventListener('touchend', drag.endTouch)
      window.addEventListener('touchcancel', drag.endTouch)
    } else {
      window.addEventListener('mousemove', drag.moveMouse)
      window.addEventListener('mouseup', drag.endMouse)
    }
  }

  function activateFab() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      draggedRef.current = false
      return
    }
    if (draggedRef.current) {
      draggedRef.current = false
      return
    }
    setOpen((value) => !value)
  }

  function queueAudioBlob(blob) {
    const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('mpeg') ? 'mp3' : 'webm'
    queueFiles([new File([blob], `voice-note-${Date.now()}.${extension}`, { type: blob.type || 'audio/webm' })])
  }

  async function startRecording() {
    setDragError('')
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setDragError(t('audioUnavailable'))
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
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
        window.clearInterval(recordingTimerRef.current)
        if (blob.size) queueAudioBlob(blob)
      }, { once: true })
      recorder.start()
      recorderRef.current = recorder
      streamRef.current = stream
      setRecordingSeconds(0)
      setRecording(true)
      recordingTimerRef.current = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000)
    } catch {
      setDragError(t('audioPermissionError'))
    }
  }

  function stopRecording() {
    recorderRef.current?.stop()
  }

  function queueFiles(fileList) {
    setDragError('')
    const incoming = Array.from(fileList)
    const valid = []
    for (const file of incoming) {
      if (!supportedMimeTypes.has(file.type)) {
        setDragError(t('aiUnsupportedFile'))
        continue
      }

      if (file.size > maxFileSize) {
        setDragError(t('aiFileTooLarge'))
        continue
      }
      valid.push(file)
    }
    const available = Math.max(0, 4 - files.length)
    if (valid.length > available) setDragError(t('aiMaxFiles'))
    setFiles((previous) => [...previous, ...valid.slice(0, available)])
  }

  async function sendMessage(event) {
    event.preventDefault()
    if (loading || (!message.trim() && files.length === 0)) return
    const question = message.trim()
    const queuedFiles = [...files]
    setMessages((previous) => [...previous, {
      id: `${Date.now()}-user`,
      role: 'user',
      text: question || t('attachedFilesOnly'),
      files: queuedFiles.map((file) => file.name),
    }])
    setMessage('')
    setFiles([])
    setDragError('')
    setModelWarning('')
    setLoading(true)
    setLoadingStatusKey('analyzing')
    try {
      let accessToken = ''
      if (!import.meta.env.DEV) {
        let session = null
        try {
          const current = await supabase.auth.getSession()
          session = current.data.session
          if (!session?.access_token) {
            const refreshed = await supabase.auth.refreshSession()
            session = refreshed.data.session
          }
        } catch (error) {
          console.info('Unable to restore the Supabase session for AI diagnosis.', error)
        }
        accessToken = session?.access_token || ''
        if (!accessToken) {
          const assistantMessage = {
            role: 'assistant',
            text: 'Please create an account to use this feature.',
            sources: [],
          }
          saveChatResponse(question, queuedFiles, assistantMessage)
          setMessages((previous) => [...previous, {
            id: `${Date.now()}-assistant`,
            ...assistantMessage,
          }])
          return
        }
      }
      setGuestNotice(!accessToken && import.meta.env.DEV
        ? 'Please create an account to use this feature.'
        : '')
      const transcript = messages
        .filter((item) => item.role !== 'error')
        .slice(-6)
        .map((item) => `${item.role === 'assistant' ? 'Assistant' : 'Farmer'}: ${item.text}`)
        .join('\n')
      const contextualQuestion = transcript
        ? `${t('chatHistoryContext')}\n${transcript}\nFarmer: ${question || t('attachedFilesOnly')}`
        : question
      const result = await runMultimodalDiagnosis({
        text: contextualQuestion,
        files: queuedFiles,
        accessToken,
        userRole,
        appLanguage: language,
        onModelWarning: () => setModelWarning(t('visualModelUnavailable')),
      })
      const assistantMessage = {
        role: 'assistant',
        text: result.answer,
        sources: result.sources,
        visualResult: result.visualResult,
      }
      saveChatResponse(question, queuedFiles, assistantMessage)
      setMessages((previous) => [...previous, {
        id: `${Date.now()}-assistant`,
        ...assistantMessage,
      }])
    } catch (error) {
      setMessages((previous) => [...previous, {
        id: `${Date.now()}-error`,
        role: 'error',
        text: language === 'en'
          ? error.message || t('aiRequestFailed')
          : t('aiRequestFailed'),
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ai-chat-widget bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {open && <section
        className={`ai-chat-panel fixed bottom-0 left-0 z-50 w-full max-h-[90vh] overflow-y-auto rounded-t-2xl shadow-lg lg:bottom-[94px] lg:left-auto lg:right-[25px] lg:z-30 lg:w-[min(390px,calc(100vw-36px))] lg:max-h-none lg:overflow-hidden lg:rounded-[15px] lg:shadow-[0_15px_48px_rgba(29,54,32,0.2)] dark:text-gray-100${open && expanded ? ' ai-chat-panel--expanded' : ''}`}
        aria-label={t('aiChatTitle')}
        style={open && expanded ? {
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 999999,
          borderRadius: 0,
          right: 'auto',
          bottom: 'auto',
        } : {
          position: 'fixed',
          bottom: '185px',
          right: '24px',
          zIndex: 999999,
          width: '380px',
          height: '560px',
          maxHeight: 'calc(100vh - 200px)',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <AiSafetyBanner />
        <header
          className="ai-chat-header dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
          role="button"
          tabIndex="0"
          aria-label={t('aiToggleLabel')}
          onClick={() => setOpen((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setOpen((value) => !value)
            }
          }}
        >
          <span className="chat-avatar"><VetDoctorChatImage className="w-10 h-10 rounded-full object-cover border border-emerald-400/50" size={40} /></span>
          <span className="chat-title"><strong>PoultryMedix AI</strong><small><span className="chat-online-dot" />{t('aiDiagnosticOnline')}</small></span>
          <span className="chat-header-actions">
            <button
              className="chat-header-action"
              type="button"
              aria-label={expanded ? t('aiExitFullscreen') : t('aiExpand')}
              title={expanded ? t('aiExitFullscreen') : t('aiExpand')}
              onClick={(event) => {
                event.stopPropagation()
                setExpanded((value) => !value)
              }}
            >
              <span aria-hidden="true">[ ]</span>
            </button>
            <button
              className="chat-header-action"
              type="button"
              aria-label={t('aiClose')}
              title={t('aiCloseTitle')}
              onClick={(event) => {
                event.stopPropagation()
                setOpen(false)
                setExpanded(false)
              }}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </span>
        </header>
        <div className="ai-chat-messages dark:bg-gray-900 dark:text-gray-100" ref={listRef} aria-live="polite">
          {!messages.length && <div className="chat-welcome dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"><span className="chat-welcome-icon"><Icon name="bird" size={23} /></span><strong>{t('chatWelcomeTitle')}</strong><p>{t('chatWelcomeDescription')}</p><span className="chat-source-note dark:text-gray-300"><Icon name="book" size={12} />{t('aiInformationalNotice')}</span></div>}
          {messages.map((item) => <article className={`chat-message chat-message--${item.role}`} key={item.id}>
            <p>{item.text}</p>
            {item.files?.length > 0 && <div className="chat-message-files">{item.files.map((name) => <span key={name}><Icon name="file" size={12} />{name}</span>)}</div>}
            {item.role === 'assistant' && <>
              {item.visualResult && <span className="chat-visual-result">{t('visualClassification')}: {item.visualResult.label} ({Math.round(item.visualResult.confidence * 100)}%)</span>}
              <span className="source-badge"><Icon name="book" size={12} />{t('sourceReference')}</span>
              <div className="chat-source-list">
                {item.sources.map((source) => <span key={source}>{source}</span>)}
              </div>
              <aside className="chat-message-safety dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700" role="note">
                <strong>{t('veterinaryConsultingAlertTitle')}</strong>
                <p>{t('veterinaryConsultingAlert')}</p>
              </aside>
            </>}
          </article>)}
          {loading && <div className="chat-typing"><span /><span /><span />{t(loadingStatusKey)}</div>}
          {guestNotice && <p className="chat-warning" role="status">{guestNotice}</p>}
          {modelWarning && <p className="chat-warning" role="status">{modelWarning}</p>}
          {historyWarning && <p className="chat-warning" role="status">{historyWarning}</p>}
        </div>
        <div className="chat-composer-wrap">
          {files.length > 0 && <div className="chat-queued-files">{files.map((file, index) => <span className="queued-file" key={`${file.name}-${index}`}><Icon name={file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'mic'} size={13} /><span>{file.name}</span><button type="button" aria-label={t('removeFile', { name: file.name })} onClick={() => setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index))}><Icon name="close" size={12} /></button></span>)}</div>}
          {dragError && <p className="chat-composer-error" role="alert">{dragError}</p>}
          {recording ? <div className="chat-recording-panel dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
            <div className="chat-recording-status"><span className="chat-recording-mic"><Icon name="mic" size={22} /></span><span><strong>{t('aiListening')}</strong><small>{t('aiSpeakNow')}</small></span><time>0:{String(recordingSeconds).padStart(2, '0')}s</time></div>
            <div className="chat-waveform" aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <i key={index} style={{ animationDelay: `${index * 45}ms` }} />)}</div>
            <button className="chat-stop-recording" type="button" onClick={stopRecording}><Icon name="stop" size={15} />{t('aiStopRecording')}</button>
          </div> : <form className="chat-composer dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" onSubmit={sendMessage}>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t('chatPlaceholder')} rows="2" aria-label={t('chatPlaceholder')} onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form.requestSubmit()
              }
            }} />
            <div className="chat-composer-actions">
              <input ref={inputRef} className="visually-hidden-input" type="file" accept="image/*,audio/*,application/pdf" multiple onChange={(event) => { if (event.target.files) queueFiles(event.target.files); event.target.value = ''; setAttachmentMenuOpen(false) }} aria-label={t('attachFiles')} />
              <input ref={cameraInputRef} className="visually-hidden-input" type="file" accept="image/*" capture="environment" onChange={(event) => { if (event.target.files) queueFiles(event.target.files); event.target.value = ''; setAttachmentMenuOpen(false) }} aria-label={t('aiTakePhoto')} />
              <div className="chat-attachment-menu-wrap" style={{ position: 'relative' }}>
                <button className="chat-tool-button" type="button" aria-label={t('attachFiles')} aria-expanded={attachmentMenuOpen} onClick={() => setAttachmentMenuOpen((value) => !value)} disabled={loading}><Icon name="plus" size={17} /></button>
                {attachmentMenuOpen && <div
                  className="chat-attachment-menu dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
                  role="menu"
                  onClick={(event) => event.stopPropagation()}
                  style={{ position: 'absolute', bottom: '68px', left: '16px', width: '240px', backgroundColor: '#ffffff', border: '1px solid #d1fae5', borderRadius: '16px', padding: '8px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.18)', zIndex: 9999 }}
                >
                  <button style={{ backgroundColor: '#f8fafc', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', marginBottom: '4px', border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left' }} type="button" role="menuitem" onClick={() => { setAttachmentMenuOpen(false); inputRef.current?.click() }}><Icon name="upload" size={15} />{t('aiUploadFiles')}</button>
                  <button style={{ backgroundColor: '#f8fafc', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', marginBottom: '4px', border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left' }} type="button" role="menuitem" onClick={() => { setAttachmentMenuOpen(false); setDragError(t('aiDriveUnavailable')) }}><Icon name="cloud" size={15} />{t('aiGoogleDrive')}</button>
                  <button style={{ backgroundColor: '#f8fafc', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', marginBottom: '4px', border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left' }} type="button" role="menuitem" onClick={() => { setAttachmentMenuOpen(false); cameraInputRef.current?.click() }}><Icon name="camera" size={15} />{t('aiTakePhoto')}</button>
                  <button style={{ backgroundColor: '#f8fafc', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', marginBottom: '4px', border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left' }} type="button" role="menuitem" onClick={() => { setAttachmentMenuOpen(false); inputRef.current?.click() }}><Icon name="pdf" size={15} />{t('antibiotics.aiPrescriptionPdf')}</button>
                  <button style={{ backgroundColor: '#f8fafc', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', marginBottom: '4px', border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left' }} type="button" role="menuitem" onClick={() => { setAttachmentMenuOpen(false); startRecording() }}><Icon name="mic" size={15} />{t('antibiotics.aiVoiceNote')}</button>
                </div>}
              </div>
              <button className="chat-send-button" type="submit" disabled={loading || (!message.trim() && !files.length)} aria-label={t('sendMessage')}><Icon name="send" size={16} /></button>
            </div>
          </form>}
          <p className="chat-disclaimer">{t('aiInformationalNotice')}</p>
        </div>
      </section>}

      {!open && <div
        ref={fabRef}
        onMouseDown={(event) => startDrag(event, 'mouse')}
        onTouchStart={(event) => startDrag(event, 'touch')}
        onClick={activateFab}
        style={{
          position: 'absolute',
          left: position.x === null ? 'auto' : `${position.x}px`,
          right: position.x === null ? '0px' : 'auto',
          top: position.x === null ? `${isWideDesktop ? 36 : 20}px` : `${position.y}px`,
          bottom: 'auto',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          cursor: 'grab',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        <img
          src="/images/chat-icon.png"
          alt="Doctor Avatar"
          style={{ width: '76px', height: 'auto', display: 'block', pointerEvents: 'none' }}
        />
        <span style={{ marginTop: '6px', backgroundColor: '#064e3b', color: '#ffffff', fontSize: '11px', fontWeight: 'bold', padding: '4px 12px', borderRadius: '9999px', border: '1.5px solid #10b981', whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 4px 8px rgba(0,0,0,0.15)' }}>
          {t('aiDiagnostic')}
        </span>
      </div>}
    </div>
  )
}

