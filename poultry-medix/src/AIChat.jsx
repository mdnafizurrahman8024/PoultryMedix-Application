import { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase.js'
import { runMultimodalDiagnosis } from './lib/ai.js'
import { useLanguage } from './context/useLanguage.js'
import Icon from './components/Icon.jsx'
import VoiceRecorder from './components/VoiceRecorder.jsx'
import AiSafetyBanner from './components/AiSafetyBanner.jsx'
import { findLocalPoultryKnowledge } from './lib/poultryKnowledge.js'
import { searchWikipedia } from './lib/wikipedia.js'
import { saveHistoryEntry } from './veterinary/historyStore.js'

const supportedMimeTypes = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  'audio/aac', 'audio/flac', 'audio/mp3', 'audio/m4a', 'audio/mp4', 'audio/mpeg',
  'audio/mpga', 'audio/ogg', 'audio/opus', 'audio/wav', 'audio/webm',
])
const maxFileSize = 8 * 1024 * 1024

export default function AIChat() {
  const { t, language } = useLanguage()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState(null)
  const [files, setFiles] = useState([])
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingStatusKey, setLoadingStatusKey] = useState('analyzing')
  const [dragError, setDragError] = useState('')
  const [modelWarning, setModelWarning] = useState('')
  const [historyWarning, setHistoryWarning] = useState('')
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const fabRef = useRef(null)
  const dragRef = useRef(null)
  const draggedRef = useRef(false)
  const chatSessionId = useRef('')
  if (!chatSessionId.current) chatSessionId.current = crypto.randomUUID()

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
      window.requestAnimationFrame(() => {
        const fab = fabRef.current
        if (!fab) return
        const width = fab.offsetWidth
        const height = fab.offsetHeight
        setPosition((current) => {
          if (!current) return current
          const left = Math.max(8, Math.min(window.innerWidth - width - 8, current.left))
          const top = Math.max(8, Math.min(window.innerHeight - height - 8, current.top))
          return left === current.left && top === current.top ? current : { left, top }
        })
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

  function pointerDown(event) {
    if (event.button !== 0) return
    const bounds = event.currentTarget.getBoundingClientRect()
    dragRef.current = { startX: event.clientX, startY: event.clientY, left: bounds.left, top: bounds.top }
    draggedRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function pointerMove(event) {
    const drag = dragRef.current
    if (!drag || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) draggedRef.current = true
    if (!draggedRef.current) return
    const width = event.currentTarget.offsetWidth
    const height = event.currentTarget.offsetHeight
    setPosition({
      left: Math.max(8, Math.min(window.innerWidth - width - 8, drag.left + deltaX)),
      top: Math.max(8, Math.min(window.innerHeight - height - 8, drag.top + deltaY)),
    })
  }

  function pointerUp(event) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
  }

  function pointerCancel(event) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
    draggedRef.current = false
  }

  function activateFab() {
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
    setLoadingStatusKey(question ? 'searchingOnlineSources' : 'analyzing')
    try {
      const localKnowledge = question ? findLocalPoultryKnowledge(question, language) : null
      if (localKnowledge && queuedFiles.length === 0) {
        const assistantMessage = {
          role: 'assistant',
          text: localKnowledge.answer,
          sources: [t('aiLocalKnowledgeSource')],
        }
        saveChatResponse(question, queuedFiles, assistantMessage)
        setMessages((previous) => [...previous, {
          id: `${Date.now()}-assistant`,
          ...assistantMessage,
        }])
        return
      }

      let externalReference = null
      if (question && !localKnowledge) {
        const controller = new AbortController()
        const timeout = window.setTimeout(() => controller.abort(), 12000)
        try {
          externalReference = await searchWikipedia(question, language, controller.signal)
        } catch {
          throw new Error(t('externalSearchError'))
        } finally {
          window.clearTimeout(timeout)
        }
      }

      if (question && !localKnowledge && !externalReference && queuedFiles.length === 0) {
        const assistantMessage = { role: 'assistant', text: t('noExternalSearchResult'), sources: [] }
        saveChatResponse(question, queuedFiles, assistantMessage)
        setMessages((previous) => [...previous, {
          id: `${Date.now()}-assistant`,
          ...assistantMessage,
        }])
        return
      }

      setLoadingStatusKey('analyzing')
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      if (!data.session?.access_token) {
        if (externalReference && queuedFiles.length === 0) {
          const assistantMessage = {
            role: 'assistant',
            text: externalReference.extract,
            sources: [],
            externalReference,
          }
          saveChatResponse(question, queuedFiles, assistantMessage)
          setMessages((previous) => [...previous, {
            id: `${Date.now()}-assistant`,
            ...assistantMessage,
          }])
          return
        }
        throw new Error(t('aiSignInRequired'))
      }
      const transcript = messages
        .filter((item) => item.role !== 'error')
        .slice(-6)
        .map((item) => `${item.role === 'assistant' ? 'Assistant' : 'Farmer'}: ${item.text}`)
        .join('\n')
      const searchContext = [
        localKnowledge ? `${t('aiLocalKnowledgeSource')}: ${localKnowledge.answer}` : '',
        externalReference ? `External reference: ${externalReference.title}\n${externalReference.extract}\n${externalReference.url}` : '',
      ].filter(Boolean).join('\n\n')
      const contextualQuestion = [
        transcript ? `${t('chatHistoryContext')}\n${transcript}\nFarmer: ${question || t('attachedFilesOnly')}` : question,
        searchContext ? `${t('retrievedKnowledgeContext')}\n${searchContext}` : '',
      ].filter(Boolean).join('\n\n')
      const result = await runMultimodalDiagnosis({
        text: contextualQuestion,
        files: queuedFiles,
        accessToken: data.session.access_token,
        onModelWarning: () => setModelWarning(t('visualModelUnavailable')),
      })
      const assistantMessage = {
        role: 'assistant',
        text: result.answer,
        sources: result.sources,
        visualResult: result.visualResult,
        externalReference,
      }
      saveChatResponse(question, queuedFiles, assistantMessage)
      setMessages((previous) => [...previous, {
        id: `${Date.now()}-assistant`,
        ...assistantMessage,
      }])
    } catch (error) {
      const localizedErrorKey = ['externalSearchError', 'aiSignInRequired']
        .find((key) => error.message === t(key))
      setMessages((previous) => [...previous, {
        id: `${Date.now()}-error`,
        role: 'error',
        text: language === 'en'
          ? error.message || t('aiRequestFailed')
          : localizedErrorKey ? t(localizedErrorKey) : t('aiRequestFailed'),
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ai-chat-widget">
      {open && <section className="ai-chat-panel" aria-label={t('aiChatTitle')}>
        <AiSafetyBanner />
        <header className="ai-chat-header">
          <span className="chat-avatar"><Icon name="spark" size={18} /></span>
          <span className="chat-title"><strong>{t('aiChatTitle')}</strong><small><span />{t('aiChatOnline')}</small></span>
          <button className="chat-close"           ref={fabRef}
          type="button" aria-label={t('close')} onClick={() => setOpen(false)}><Icon name="close" size={18} /></button>
        </header>
        <div className="ai-chat-messages" ref={listRef} aria-live="polite">
          {!messages.length && <div className="chat-welcome"><span className="chat-welcome-icon"><Icon name="bird" size={23} /></span><strong>{t('chatWelcomeTitle')}</strong><p>{t('chatWelcomeDescription')}</p><span className="chat-source-note"><Icon name="book" size={12} />{t('aiInformationalNotice')}</span></div>}
          {messages.map((item) => <article className={`chat-message chat-message--${item.role}`} key={item.id}>
            <p>{item.text}</p>
            {item.files?.length > 0 && <div className="chat-message-files">{item.files.map((name) => <span key={name}><Icon name="file" size={12} />{name}</span>)}</div>}
            {item.role === 'assistant' && <>
              {item.visualResult && <span className="chat-visual-result">{t('visualClassification')}: {item.visualResult.label} ({Math.round(item.visualResult.confidence * 100)}%)</span>}
              <span className="source-badge"><Icon name="book" size={12} />{t('sourceReference')}</span>
              <div className="chat-source-list">
                {item.sources.map((source) => <span key={source}>{source}</span>)}
                {item.externalReference && <a href={item.externalReference.url} target="_blank" rel="noreferrer">{t('wikipediaSource')}: {item.externalReference.title}</a>}
              </div>
              <aside className="chat-message-safety" role="note">
                <strong>{t('veterinaryConsultingAlertTitle')}</strong>
                <p>{t('veterinaryConsultingAlert')}</p>
              </aside>
            </>}
          </article>)}
          {loading && <div className="chat-typing"><span /><span /><span />{t(loadingStatusKey)}</div>}
          {modelWarning && <p className="chat-warning" role="status">{modelWarning}</p>}
          {historyWarning && <p className="chat-warning" role="status">{historyWarning}</p>}
        </div>
        <div className="chat-composer-wrap">
          {files.length > 0 && <div className="chat-queued-files">{files.map((file, index) => <span className="queued-file" key={`${file.name}-${index}`}><Icon name={file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'mic'} size={13} /><span>{file.name}</span><button type="button" aria-label={t('removeFile', { name: file.name })} onClick={() => setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index))}><Icon name="close" size={12} /></button></span>)}</div>}
          {dragError && <p className="chat-composer-error" role="alert">{dragError}</p>}
          <form className="chat-composer" onSubmit={sendMessage}>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t('chatPlaceholder')} rows="2" aria-label={t('chatPlaceholder')} onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form.requestSubmit()
              }
            }} />
            <div className="chat-composer-actions">
              <input ref={inputRef} className="visually-hidden-input" type="file" accept="image/*,audio/*,application/pdf" multiple onChange={(event) => { if (event.target.files) queueFiles(event.target.files); event.target.value = '' }} aria-label={t('attachFiles')} />
              <button className="chat-tool-button" type="button" aria-label={t('attachFiles')} title={t('attachFiles')} onClick={() => inputRef.current?.click()} disabled={loading}><Icon name="plus" size={17} /></button>
              <VoiceRecorder compact disabled={loading || files.length >= 4} onAudioReady={(blob) => {
                const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('mpeg') ? 'mp3' : 'webm'
                queueFiles([new File([blob], `voice-note-${Date.now()}.${extension}`, { type: blob.type || 'audio/webm' })])
              }} />
              <button className="chat-send-button" type="submit" disabled={loading || (!message.trim() && !files.length)} aria-label={t('sendMessage')}><Icon name="send" size={16} /></button>
            </div>
          </form>
          <p className="chat-disclaimer">{t('aiInformationalNotice')}</p>
        </div>
      </section>}

      <button
        className={`ai-chat-fab${open ? ' ai-chat-fab--open' : ''}`}
        type="button"
        aria-label={open ? t('close') : t('openAiChat')}
        aria-expanded={open}
        title={t('dragChat')}
        style={position ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto' } : undefined}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerCancel}
        onClick={activateFab}
      >
        {open ? <Icon name="close" size={22} /> : <><Icon name="message" size={23} /><span className="fab-spark">✦</span></>}
      </button>
    </div>
  )
}
