import { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase.js'
import { runMultimodalDiagnosis, classifyPoultryImage } from './lib/ai.js'
import { sendChatMessage, getPoliteExhaustionMessage } from './lib/aiServiceAdapter.js'
import { getVerifiedVeterinarySources } from './lib/veterinarySources.js'
import { useLanguage } from './context/useLanguage.js'
import Icon from './components/Icon.jsx'
import AiSafetyBanner from './components/AiSafetyBanner.jsx'
import EthicalCareBar from './veterinary/EthicalCareBar.jsx'
import { saveHistoryEntry } from './veterinary/historyStore.js'
import useSpeechToText from './hooks/useSpeechToText.js'

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
export default function AIChat() {
  const { t, language } = useLanguage()
  const [chatPosition, setChatPosition] = useState({ x: null, y: null })
  const chatWindowRef = useRef(null)
  const chatDragRef = useRef(null)
  const [userRole, setUserRole] = useState('farmer')
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState(() => ({
    x: null,
    y: 100,
  }))
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
  const speech = useSpeechToText({ language, value: message, onChange: setMessage, onError: (key) => setDragError(t(key)) })
  const inputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const listRef = useRef(null)
  const fabRef = useRef(null)
  const dragRef = useRef(null)
  const draggedRef = useRef(false)
  const suppressClickRef = useRef(false)
  const [chatSessionId] = useState(() => crypto.randomUUID())

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
        .find((record) => record.id === chatSessionId)
      const now = new Date().toISOString()
      saveHistoryEntry('chat', {
        id: chatSessionId,
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
      if (fab) {
        window.requestAnimationFrame(() => {
          const width = fab.offsetWidth || 70
          const height = fab.offsetHeight || 90
          setPosition((current) => current.x === null ? current : ({
            x: Math.max(8, Math.min(window.innerWidth - width - 8, current.x)),
            y: Math.max(72, Math.min(window.innerHeight - height - 8, current.y)),
          }))
        })
      }
      const card = chatWindowRef.current
      if (card) {
        window.requestAnimationFrame(() => {
          const cWidth = card.offsetWidth || 380
          setChatPosition((current) => (current.x === null || current.y === null ? current : ({
            x: Math.max(8, Math.min(window.innerWidth - cWidth - 8, current.x)),
            y: Math.max(16, Math.min(window.innerHeight - 80, current.y)),
          })))
        })
      }
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

  const stopSpeech = speech.stop
  useEffect(() => {
    if (!open) stopSpeech()
  }, [open, stopSpeech])

  useEffect(() => () => {
    const drag = dragRef.current
    if (drag) {
      if (drag.rafId) window.cancelAnimationFrame(drag.rafId)
      window.removeEventListener('mousemove', drag.moveMouse)
      window.removeEventListener('mouseup', drag.endMouse)
      window.removeEventListener('touchmove', drag.moveTouch)
      window.removeEventListener('touchend', drag.endTouch)
      window.removeEventListener('touchcancel', drag.endTouch)
    }
    const cDrag = chatDragRef.current
    if (cDrag) {
      if (cDrag.rafId) window.cancelAnimationFrame(cDrag.rafId)
      window.removeEventListener('mousemove', cDrag.move)
      window.removeEventListener('mouseup', cDrag.end)
      window.removeEventListener('touchmove', cDrag.move)
      window.removeEventListener('touchend', cDrag.end)
      window.removeEventListener('touchcancel', cDrag.end)
    }
  }, [])

  function startChatDrag(event, inputType) {
    if (expanded) return
    if (inputType === 'mouse' && event.button !== 0) return
    if (event.target.closest('button') || event.target.closest('a') || event.target.closest('input')) return

    const point = inputType === 'touch' ? event.touches[0] : event
    if (!point) return

    const card = chatWindowRef.current
    const bounds = card?.getBoundingClientRect()
    const cardWidth = card?.offsetWidth || Math.min(380, window.innerWidth - 24)
    const cardHeight = card?.offsetHeight || Math.min(560, window.innerHeight - 80)
    const defaultX = Math.max(12, window.innerWidth - cardWidth - 20)
    const defaultY = Math.max(70, window.innerHeight - cardHeight - 20)
    const currentLeft = bounds?.left ?? (chatPosition.x ?? defaultX)
    const currentTop = bounds?.top ?? (chatPosition.y ?? defaultY)

    const drag = {
      startX: point.clientX,
      startY: point.clientY,
      originX: currentLeft,
      originY: currentTop,
      moved: false,
      rafId: 0,
      move: null,
      end: null,
    }

    drag.move = (moveEvent) => {
      const movePoint = inputType === 'touch' ? moveEvent.touches[0] : moveEvent
      if (!movePoint) return
      const deltaX = movePoint.clientX - drag.startX
      const deltaY = movePoint.clientY - drag.startY
      if (Math.hypot(deltaX, deltaY) > 4) drag.moved = true
      if (!drag.moved || drag.rafId) return

      drag.rafId = window.requestAnimationFrame(() => {
        drag.rafId = 0
        const cWidth = chatWindowRef.current?.offsetWidth || 380
        setChatPosition({
          x: Math.max(8, Math.min(window.innerWidth - cWidth - 8, drag.originX + deltaX)),
          y: Math.max(16, Math.min(window.innerHeight - 80, drag.originY + deltaY)),
        })
      })
    }

    drag.end = () => {
      if (drag.rafId) window.cancelAnimationFrame(drag.rafId)
      window.removeEventListener('mousemove', drag.move)
      window.removeEventListener('mouseup', drag.end)
      window.removeEventListener('touchmove', drag.move)
      window.removeEventListener('touchend', drag.end)
      window.removeEventListener('touchcancel', drag.end)
      chatDragRef.current = null
    }

    chatDragRef.current = drag
    if (inputType === 'touch') {
      window.addEventListener('touchmove', drag.move, { passive: false })
      window.addEventListener('touchend', drag.end)
      window.addEventListener('touchcancel', drag.end)
    } else {
      window.addEventListener('mousemove', drag.move)
      window.addEventListener('mouseup', drag.end)
    }
  }

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
    const drag = {
      startX: point.clientX,
      startY: point.clientY,
      originX: bounds?.left ?? position.x ?? Math.max(8, window.innerWidth - 128),
      originY: bounds?.top ?? position.y,
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
          x: Math.max(8, Math.min(window.innerWidth - width - 8, drag.originX + deltaX)),
          y: Math.max(72, Math.min(window.innerHeight - height - 8, drag.originY + deltaY)),
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
    speech.stop()
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
      const allowGuestAi = import.meta.env.VITE_ALLOW_GUEST_AI === 'true'
      let accessToken = ''

      try {
        const current = await supabase.auth.getSession()
        let session = current.data.session
        if (!session?.access_token) {
          const refreshed = await supabase.auth.refreshSession()
          session = refreshed.data.session
        }
        accessToken = session?.access_token || ''
      } catch (error) {
        console.info('Session check in chat completed', error)
      }

      if (!accessToken && !allowGuestAi) {
        const assistantMessage = {
          role: 'assistant',
          text: t('aiSignInRequired'),
          sources: [],
        }
        saveChatResponse(question, queuedFiles, assistantMessage)
        setMessages((previous) => [...previous, {
          id: `${Date.now()}-assistant`,
          ...assistantMessage,
        }])
        return
      }

      setGuestNotice('')

      const transcript = messages
        .filter((item) => item.role !== 'error')
        .slice(-6)
        .map((item) => `${item.role === 'assistant' ? 'Assistant' : 'Farmer'}: ${item.text}`)
        .join('\n')

      let result = null
      let visualResult = null

      // If user queued an image, run edge Teachable Machine vision analysis on-device
      const imageFile = queuedFiles.find((file) => file.type?.startsWith('image/'))
      if (imageFile) {
        try {
          visualResult = await classifyPoultryImage(imageFile)
          console.info('[chat] On-device image classification received:', visualResult)
        } catch (visionError) {
          console.warn('[chat] On-device image model classification note:', visionError?.message)
        }
      }

      if (queuedFiles.length > 0) {
        try {
          const contextualQuestion = transcript
            ? `${t('chatHistoryContext')}\n${transcript}\nFarmer: ${question || t('attachedFilesOnly')}`
            : question

          result = await runMultimodalDiagnosis({
            text: contextualQuestion,
            files: queuedFiles,
            accessToken,
            userRole,
            appLanguage: language,
            onModelWarning: () => {},
          })
          if (result?.visualResult) {
            visualResult = result.visualResult
          }
        } catch (diagError) {
          console.warn('[chat] Multimodal diagnostics fallback to AI engine:', diagError?.message)
        }
      }

      if (!result || !result.answer) {
        const conversationMessages = messages
          .filter((item) => item.role === 'assistant' || item.role === 'user')
          .slice(-6)
          .map((item) => ({ role: item.role, content: item.text }))

        conversationMessages.push({
          role: 'user',
          content: question || (visualResult ? `Attached flock image: ${imageFile?.name || 'Photo'}` : t('attachedFilesOnly')),
        })

        result = await sendChatMessage({
          messages: conversationMessages,
          language,
          contextPrompt: transcript,
          visualResult,
        })
      }

      const verifiedSources = (Array.isArray(result.sources) && result.sources.length > 0)
        ? result.sources
        : getVerifiedVeterinarySources(visualResult?.label || question)

      const assistantMessage = {
        role: 'assistant',
        text: result.answer,
        sourceQuery: question,
        sources: verifiedSources,
        visualResult: result.visualResult || visualResult || null,
      }
      saveChatResponse(question, queuedFiles, assistantMessage)
      setMessages((previous) => [...previous, {
        id: `${Date.now()}-assistant`,
        ...assistantMessage,
      }])
    } catch (error) {
      console.warn('[chat] Chat consultation error:', error)
      setMessages((previous) => [...previous, {
        id: `${Date.now()}-error`,
        role: 'error',
        text: getPoliteExhaustionMessage(language),
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ai-chat-widget bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {open && <section
        ref={chatWindowRef}
        className={`ai-chat-panel fixed z-50 rounded-2xl shadow-2xl dark:text-gray-100${open && expanded ? ' ai-chat-panel--expanded' : ''}`}
        aria-label={t('aiChatTitle')}
        style={open && expanded ? {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '100vw',
          height: '100%',
          maxHeight: '100vh',
          zIndex: 999999,
          borderRadius: 0,
          margin: 0,
          padding: 0,
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        } : {
          position: 'fixed',
          left: chatPosition.x !== null
            ? `${Math.max(8, Math.min(window.innerWidth - Math.min(390, window.innerWidth - 24) - 8, chatPosition.x))}px`
            : `${Math.max(12, window.innerWidth - Math.min(390, window.innerWidth - 24) - 20)}px`,
          top: chatPosition.y !== null
            ? `${Math.max(16, Math.min(window.innerHeight - 80, chatPosition.y))}px`
            : `${Math.max(70, window.innerHeight - Math.min(560, window.innerHeight - 80) - 20)}px`,
          right: 'auto',
          bottom: 'auto',
          width: `${Math.min(390, window.innerWidth - 24)}px`,
          height: `${Math.min(560, window.innerHeight - 80)}px`,
          maxHeight: 'calc(100vh - 40px)',
          zIndex: 999999,
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          className="ai-chat-header dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
          onMouseDown={(event) => startChatDrag(event, 'mouse')}
          onTouchStart={(event) => startChatDrag(event, 'touch')}
          style={{
            cursor: expanded ? 'default' : 'grab',
            userSelect: 'none',
            touchAction: 'none',
          }}
          title={expanded ? '' : (language === 'bn' ? 'উইন্ডোটি ড্র্যাগ করে যেকোনো জায়গায় সরান' : 'Click and drag to move chat window')}
        >
          <span className="chat-avatar"><VetDoctorChatImage className="w-10 h-10 rounded-full object-cover border border-emerald-400/50" size={40} /></span>
          <span className="chat-title" style={{ pointerEvents: 'none' }}>
            <strong>PoultryMedix AI</strong>
            <small><span className="chat-online-dot" />{t('aiDiagnosticOnline')}</small>
          </span>
          <span className="chat-header-actions">
            <button
              className="chat-header-action"
              type="button"
              aria-label={expanded ? t('aiExitFullscreen') : t('aiExpand')}
              title={expanded ? (language === 'bn' ? 'ছোট উইন্ডো করুন' : 'Restore smaller window') : (language === 'bn' ? 'বড় উইন্ডো করুন' : 'Expand to full screen')}
              onClick={(event) => {
                event.stopPropagation()
                setExpanded((value) => !value)
              }}
            >
              {expanded ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              )}
            </button>
            <button
              className="chat-header-action"
              type="button"
              aria-label={t('aiClose')}
              title={language === 'bn' ? 'চ্যাট বন্ধ করুন' : 'Close chat'}
              onClick={(event) => {
                event.stopPropagation()
                setOpen(false)
                setExpanded(false)
              }}
              style={{
                width: '32px',
                height: '32px',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </span>
        </header>
        <AiSafetyBanner />
        <div className="ai-chat-messages dark:bg-gray-900 dark:text-gray-100" ref={listRef} aria-live="polite">
          {!messages.length && <div className="chat-welcome dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"><span className="chat-welcome-icon"><Icon name="bird" size={23} /></span><strong>{t('chatWelcomeTitle')}</strong><p>{t('chatWelcomeDescription')}</p><span className="chat-source-note dark:text-gray-300"><Icon name="book" size={12} />{t('aiInformationalNotice')}</span></div>}
          {messages.map((item) => <article className={`chat-message chat-message--${item.role}`} key={item.id}>
            <p>{item.text}</p>
            {item.files?.length > 0 && <div className="chat-message-files">{item.files.map((name) => <span key={name}><Icon name="file" size={12} />{name}</span>)}</div>}
            {item.role === 'assistant' && <>
              {item.visualResult && (
                <div style={{ marginBottom: '6px' }}>
                  <span className="chat-visual-result" style={{ display: 'inline-block', marginBottom: '4px' }}>
                    {t('visualClassification')}: <strong>{item.visualResult.label}</strong> ({Math.round(item.visualResult.confidence * 100)}%)
                  </span>
                  {item.visualResult.predictions?.length > 1 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                      {item.visualResult.predictions.slice(0, 4).map((pred) => (
                        <span
                          key={pred.disease}
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '6px',
                            background: pred.disease === item.visualResult.label ? '#dcfce7' : '#f1f5f9',
                            color: pred.disease === item.visualResult.label ? '#166534' : '#64748b',
                            border: '1px solid rgba(0,0,0,0.06)',
                          }}
                        >
                          {pred.disease}: {typeof pred.confidence === 'number' ? `${(pred.confidence * 100).toFixed(1)}%` : pred.percentage}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {item.sources?.length > 0 && (
                <div className="chat-source-section" style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <span className="source-badge"><Icon name="book" size={12} />{t('sourceReference')}</span>
                  <div className="chat-source-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                    {item.sources.map((source, sIdx) => {
                      const isObj = typeof source === 'object' && source !== null
                      const title = isObj ? source.title : source
                      const url = isObj ? source.url : null
                      const provider = isObj ? source.provider : null

                      if (url) {
                        return (
                          <a
                            key={url || sIdx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="chat-source-link hover:underline"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              color: '#047857',
                              fontWeight: 600,
                              textDecoration: 'underline',
                              lineHeight: 1.4,
                            }}
                          >
                            <span>{title} {provider ? `(${provider})` : ''}</span>
                            <Icon name="arrow" size={10} />
                          </a>
                        )
                      }

                      return (
                        <span key={title || sIdx} style={{ fontSize: '11px', color: '#64748b' }}>
                          {title}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
              <aside className="chat-message-safety dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700" role="note">
                <strong>{t('veterinaryConsultingAlertTitle')}</strong>
                <p>{t('veterinaryConsultingAlert')}</p>
              </aside>
              <EthicalCareBar
                compact
                prefillConcern={[item.visualResult?.label, item.sourceQuery].filter(Boolean).join(' — ')}
                onBeforeAction={() => {
                  setOpen(false)
                  setExpanded(false)
                }}
              />
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
          <form className="chat-composer dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" onSubmit={sendMessage}>
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
                  <button style={{ backgroundColor: '#f8fafc', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', marginBottom: '4px', border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left' }} type="button" role="menuitem" onClick={() => { setAttachmentMenuOpen(false); cameraInputRef.current?.click() }}><Icon name="camera" size={15} />{t('aiTakePhoto')}</button>
                  <button style={{ backgroundColor: '#f8fafc', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', marginBottom: '4px', border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left' }} type="button" role="menuitem" onClick={() => { setAttachmentMenuOpen(false); inputRef.current?.click() }}><Icon name="upload" size={15} />{t('aiUploadFiles')}</button>
                  <button style={{ backgroundColor: '#f8fafc', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', marginBottom: '4px', border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left' }} type="button" role="menuitem" onClick={() => { setAttachmentMenuOpen(false); inputRef.current?.click() }}><Icon name="pdf" size={15} />{t('antibiotics.aiPrescriptionPdf')}</button>
                  <button style={{ backgroundColor: '#f8fafc', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', marginBottom: '4px', border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left' }} type="button" role="menuitem" onClick={() => { setAttachmentMenuOpen(false); setDragError(t('aiDriveUnavailable')) }}><Icon name="cloud" size={15} />{t('aiGoogleDrive')}</button>
                </div>}
              </div>
              <button className={`chat-tool-button speech-mic-button${speech.listening ? ' is-listening' : ''}`} type="button" aria-label={t(speech.listening ? 'stopVoiceTyping' : 'startVoiceTyping')} aria-pressed={speech.listening} onClick={() => { setDragError(''); speech.start() }} disabled={loading}><Icon name="mic" size={16} /></button>
              <button className="chat-send-button" type="submit" disabled={loading || (!message.trim() && !files.length)} aria-label={t('sendMessage')}><Icon name="send" size={16} /></button>
            </div>
          </form>
          <p className="chat-disclaimer">{t('aiInformationalNotice')}</p>
        </div>
      </section>}

      {!open && <div
        ref={fabRef}
        onMouseDown={(event) => startDrag(event, 'mouse')}
        onTouchStart={(event) => startDrag(event, 'touch')}
        onClick={activateFab}
        style={{
          position: 'fixed',
          left: position.x === null ? 'auto' : `${position.x}px`,
          right: position.x === null ? '20px' : 'auto',
          top: position.y === 100 ? '100px' : `${position.y}px`,
          bottom: 'auto',
          zIndex: 40,
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
          alt={t('aiDiagnostic')}
          style={{ width: '76px', height: 'auto', display: 'block', pointerEvents: 'none' }}
        />
        <span style={{ marginTop: '6px', backgroundColor: '#064e3b', color: '#ffffff', fontSize: '11px', fontWeight: 'bold', padding: '4px 12px', borderRadius: '9999px', border: '1.5px solid #10b981', whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 4px 8px rgba(0,0,0,0.15)' }}>
          {t('aiDiagnostic')}
        </span>
      </div>}
    </div>
  )
}

