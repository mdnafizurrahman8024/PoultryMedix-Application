import 'dotenv/config'
import express from 'express'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'

const app = express()
const port = Number(process.env.PORT || 8787)
const geminiKey = process.env.GEMINI_API_KEY
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const maxFileBytes = 8 * 1024 * 1024
const maxRequestBytes = 15 * 1024 * 1024
const allowedMimeTypes = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'audio/aac', 'audio/flac', 'audio/mp3', 'audio/m4a', 'audio/mp4', 'audio/mpeg',
  'audio/mpga', 'audio/ogg', 'audio/opus', 'audio/wav', 'audio/webm',
  'application/pdf',
])
const requestsByUser = new Map()

app.disable('x-powered-by')
app.use(express.json({ limit: '22mb', strict: true }))

app.get('/api/health', (_request, response) => {
  response.json({
    configured: Boolean(geminiKey && supabaseUrl && supabaseAnonKey),
    visualModelConfigured: Boolean(process.env.VITE_TEACHABLE_MACHINE_MODEL_URL),
  })
})

async function requireUser(request, response, next) {
  const authorization = request.get('authorization')
  if (!authorization?.startsWith('Bearer ') || !supabaseUrl || !supabaseAnonKey) {
    return response.status(401).json({ error: 'Sign in to use the AI tools.' })
  }

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        authorization,
      },
    })
    if (!userResponse.ok) return response.status(401).json({ error: 'Your session is no longer valid. Sign in again.' })
    const user = await userResponse.json()
    if (!user.id) return response.status(401).json({ error: 'Your session is no longer valid. Sign in again.' })

    const now = Date.now()
    const windowMs = 60_000
    if (requestsByUser.size > 5000) {
      for (const [id, timestamps] of requestsByUser) {
        if (!timestamps.some((time) => now - time < windowMs)) requestsByUser.delete(id)
      }
    }
    const requestTimes = (requestsByUser.get(user.id) || []).filter((time) => now - time < windowMs)
    if (requestTimes.length >= 8) return response.status(429).json({ error: 'Please wait a minute before making another AI request.' })
    requestTimes.push(now)
    requestsByUser.set(user.id, requestTimes)
    request.userId = user.id
    return next()
  } catch {
    return response.status(503).json({ error: 'Authentication could not be checked. Please try again.' })
  }
}

function validateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'A valid diagnosis request is required.'
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const attachments = Array.isArray(body.attachments) ? body.attachments : []
  if (!text && attachments.length === 0) return 'Add symptoms or at least one file before submitting.'
  if (text.length > 12_000) return 'Text is too long. Please keep it under 12,000 characters.'
  if (attachments.length > 4) return 'Attach no more than four files at a time.'

  let totalBytes = 0
  for (const attachment of attachments) {
    if (!attachment || typeof attachment !== 'object') return 'One of the attached files is invalid.'
    if (typeof attachment.mimeType !== 'string' || !allowedMimeTypes.has(attachment.mimeType)) {
      return 'Use JPG, PNG, WEBP, PDF, or a supported audio file.'
    }
    if (typeof attachment.data !== 'string' || !attachment.data || !/^[A-Za-z0-9+/]*={0,2}$/.test(attachment.data)) {
      return 'One of the attached files could not be read.'
    }
    const bytes = Math.floor(attachment.data.length * 3 / 4)
    if (bytes > maxFileBytes) return 'Each attachment must be 8 MB or smaller.'
    totalBytes += bytes
  }
  if (totalBytes > maxRequestBytes) return 'Attachments must total 15 MB or less.'

  if (body.visualResult && (
    typeof body.visualResult.label !== 'string'
    || typeof body.visualResult.confidence !== 'number'
    || body.visualResult.label.length > 160
    || body.visualResult.confidence < 0
    || body.visualResult.confidence > 1
  )) return 'Visual model result is invalid.'

  return null
}

app.post('/api/diagnose', requireUser, async (request, response) => {
  if (!geminiKey) return response.status(503).json({ error: 'The AI service is not configured on this server.' })
  const validationError = validateRequest(request.body)
  if (validationError) return response.status(400).json({ error: validationError })

  const { text = '', attachments = [], visualResult = null } = request.body
  const parts = [{
    text: [
      'You are PoultryMedix, an informational poultry health triage assistant.',
      'Help the farmer organize observations, highlight possible urgency, and suggest safe next steps.',
      'Do not claim a definitive diagnosis, prescribe or calculate drug doses, or advise starting/stopping medicines.',
      'If signs suggest severe distress, sudden deaths, neurological signs, or a fast-spreading outbreak, advise immediate contact with a licensed poultry veterinarian or local animal-health authority.',
      'Clearly note that AI/image classifications can be wrong and veterinary assessment is required.',
      'When a prescription is attached, transcribe and summarize only what is legible; do not validate, alter, or recommend the prescription.',
      'Respond in the language used by the farmer. Use short sections: What I notice, Possible concerns, Recommended next steps, Urgency.',
      `Farmer observations and question:\n${text || '(No additional typed symptoms.)'}`,
      visualResult
        ? `Teachable Machine image classification (unverified model output): ${visualResult.label} (${Math.round(visualResult.confidence * 100)}% model confidence). Treat only as a supporting signal, never as a confirmed diagnosis.`
        : '',
    ].filter(Boolean).join('\n\n'),
  }]

  for (const attachment of attachments) {
    parts.push({
      inline_data: {
        mime_type: attachment.mimeType,
        data: attachment.data,
      },
    })
  }

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0.25, maxOutputTokens: 1200 },
        }),
        signal: AbortSignal.timeout(90_000),
      },
    )

    if (!geminiResponse.ok) {
      const status = geminiResponse.status
      if (status === 429) return response.status(503).json({ error: 'The AI service is busy. Please try again shortly.' })
      if (status === 400) return response.status(422).json({ error: 'The AI service could not process one of these files. Check its format and try again.' })
      console.error('Gemini diagnosis request failed with status', status)
      return response.status(502).json({ error: 'The AI service could not complete this request.' })
    }

    const result = await geminiResponse.json()
    const answer = result.candidates?.[0]?.content?.parts
      ?.filter((part) => typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n')
      .trim()
    if (!answer) {
      console.error('Gemini returned no text for a diagnosis request.')
      return response.status(502).json({ error: 'The AI service returned an empty response. Please try again.' })
    }

    const sources = ['Gemini multimodal analysis']
    if (visualResult) sources.push(`Teachable Machine: ${visualResult.label} (${Math.round(visualResult.confidence * 100)}%)`)
    return response.json({ answer, sources })
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return response.status(504).json({ error: 'The AI request took too long. Please try again.' })
    }
    console.error('Gemini diagnosis request could not be completed.', error.message)
    return response.status(502).json({ error: 'The AI service could not complete this request.' })
  }
})

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'API route not found.' })
})

app.use((error, _request, response, _next) => {
  void _next
  if (error.type === 'entity.too.large') {
    return response.status(413).json({ error: 'The request is too large. Keep each file under 8 MB and total attachments under 15 MB.' })
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return response.status(400).json({ error: 'The diagnosis request is not valid JSON.' })
  }
  console.error('PoultryMedix request failed.', error.message)
  return response.status(500).json({ error: 'The request could not be completed.' })
})

app.use(express.static(path.join(projectRoot, 'dist')))
app.use((request, response, next) => {
  if (request.method !== 'GET') return next()
  response.sendFile(path.join(projectRoot, 'dist', 'index.html'), (error) => {
    if (error) next()
  })
})

app.listen(port, () => {
  console.log(`PoultryMedix API listening on port ${port}`)
})
