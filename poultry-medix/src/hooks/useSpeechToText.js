import { useCallback, useEffect, useRef, useState } from 'react'

const recognitionLanguages = {
  en: 'en-US',
  bn: 'bn-BD',
}

export default function useSpeechToText({ language, value, onChange, onError }) {
  const recognitionRef = useRef(null)
  const permissionRequestRef = useRef(null)
  const baseTextRef = useRef('')
  const onChangeRef = useRef(onChange)
  const onErrorRef = useRef(onError)
  const [listening, setListening] = useState(false)

  useEffect(() => {
    onChangeRef.current = onChange
    onErrorRef.current = onError
  }, [onChange, onError])

  const stop = useCallback(() => {
    if (permissionRequestRef.current) {
      permissionRequestRef.current.cancelled = true
      permissionRequestRef.current = null
      setListening(false)
    }
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(async () => {
    if (recognitionRef.current) {
      stop()
      return
    }
    if (permissionRequestRef.current) {
      stop()
      return
    }

    const permissionRequest = { cancelled: false }
    permissionRequestRef.current = permissionRequest
    setListening(true)
    let recognition = null

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      if (permissionRequest.cancelled || permissionRequestRef.current !== permissionRequest) return

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) {
        permissionRequestRef.current = null
        setListening(false)
        onErrorRef.current?.('speechRecognitionUnavailable')
        return
      }

      recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = recognitionLanguages[language] || 'en-US'
      baseTextRef.current = value
      recognitionRef.current = recognition

      recognition.onstart = () => setListening(true)
      recognition.onresult = (event) => {
        let transcript = ''
        for (let index = 0; index < event.results.length; index += 1) {
          transcript += event.results[index][0]?.transcript || ''
        }
        if (!transcript) return
        const baseText = baseTextRef.current
        const separator = baseText && !/\s$/.test(baseText) ? ' ' : ''
        onChangeRef.current(`${baseText}${separator}${transcript}`)
      }
      recognition.onerror = (event) => {
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          onErrorRef.current?.('speechRecognitionError')
        }
      }
      recognition.onend = () => {
        if (recognitionRef.current === recognition) recognitionRef.current = null
        setListening(false)
      }

      permissionRequestRef.current = null
      recognition.start()
    } catch {
      if (permissionRequestRef.current === permissionRequest || (recognition && recognitionRef.current === recognition)) {
        if (permissionRequestRef.current === permissionRequest) permissionRequestRef.current = null
        if (recognitionRef.current === recognition) recognitionRef.current = null
        setListening(false)
        onErrorRef.current?.('speechRecognitionError')
      }
    }
  }, [language, stop, value])

  useEffect(() => () => {
    if (permissionRequestRef.current) permissionRequestRef.current.cancelled = true
    recognitionRef.current?.abort()
    recognitionRef.current = null
  }, [])

  return { listening, start, stop }
}
