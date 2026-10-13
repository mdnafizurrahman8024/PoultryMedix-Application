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
const supportedUserRoles = new Set(['farmer', 'vet_student', 'registered_vet'])
const veterinarySystemPrompt = [
  'You are a highly advanced Veterinary Clinical AI. You must act as a natural conversational agent (like ChatGPT).',
  'You MUST understand and process full natural language sentences, not just strict keywords.',
  'You MUST fluently understand and reply in English, Bengali (বাংলা script), and Banglish (Bengali written in English letters, e.g., "amake farming niye bolo").',
  "Extract the user's true intent regardless of spelling or grammar.",
  'You MUST provide detailed clinical, diagnostic, and treatment information when asked.',
  'Fetch and prioritize data in this exact order: 1) Local application database context, 2) Credible veterinary sources (Merck Vet Manual, FAO, OIE, PubMed). Do not rely solely on Wikipedia.',
  "You MUST append a clear 'References/Sources' section at the end of every medical response.",
  'Be explicit about uncertainty, emergency warning signs, and when in-person veterinary assessment is needed. Never present an unverified image classification as a confirmed diagnosis.',
].join('\n')

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
  if (body.userRole !== undefined && !supportedUserRoles.has(body.userRole)) return 'The selected AI access role is invalid.'
  if (body.appLanguage !== undefined && (typeof body.appLanguage !== 'string' || body.appLanguage.length > 12)) return 'The selected app language is invalid.'

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

  const {
    text = '',
    attachments = [],
    visualResult = null,
    userRole = 'farmer',
    appLanguage = 'en',
  } = request.body
  const role = supportedUserRoles.has(userRole) ? userRole : 'farmer'
  const roleInstructions = role === 'farmer'
    ? 'Access level: farmer. Explain outbreaks, general treatment principles, prevention, and control. Do not provide clinical prescriptions, exact pharmacological dosages, or medication schedules.'
    : `Access level: ${role}. The user is a ${role === 'registered_vet' ? 'registered veterinarian' : 'veterinary student'}. Full clinical detail, pharmacological dosages, and complete prescriptions may be provided for academic or clinical purposes, while still identifying contraindications, withdrawal periods, resistance risks, and the need for local professional judgment.`
  const parts = [{
    text: [
      'You are PoultryMedix, an informational poultry health triage assistant.',
      veterinarySystemPrompt,
      roleInstructions,
      `App language preference: ${appLanguage}. Reply in the exact language of the user's latest message when it is clear (English, Bengali script, or Banglish). Otherwise prioritize the app language preference.`,
      'Every medical response must end with a clearly labeled "References" section. Cite the local application database and any internationally valid veterinary sources used, such as Merck Veterinary Manual, FAO, WOAH/OIE, PubMed, or WHO. Never invent citations.',
      'Help the farmer organize observations, highlight possible urgency, and suggest safe next steps.',
      role === 'farmer'
        ? 'Do not claim a definitive diagnosis, prescribe or calculate drug doses, or advise starting/stopping medicines.'
        : 'Do not claim certainty when evidence is incomplete. Provide clinically responsible treatment information and state when examination, culture, sensitivity testing, or local regulations change the recommendation.',
      'If signs suggest severe distress, sudden deaths, neurological signs, or a fast-spreading outbreak, advise immediate contact with a licensed poultry veterinarian or local animal-health authority.',
      'Clearly note that AI/image classifications can be wrong and veterinary assessment is required.',
      'When a prescription is attached, transcribe and summarize only what is legible; do not validate, alter, or recommend the prescription.',
      'Understand full natural-language sentences, spelling variations, and conversational Banglish; do not rely on keyword matching. Use short sections: What I notice, Possible concerns, Recommended next steps, Urgency.',
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

    const answerWithReferences = /references(?:\/sources)?\s*:/i.test(answer)
      ? answer
      : `${answer}\n\nReferences\n- PoultryMedix local application context\n- International veterinary sources should be verified against the cited Merck Veterinary Manual, FAO, WOAH/OIE, PubMed, or WHO material.`
    const sources = ['Gemini multimodal analysis', 'PoultryMedix local application context']
    if (visualResult) sources.push(`Teachable Machine: ${visualResult.label} (${Math.round(visualResult.confidence * 100)}%)`)
    return response.json({ answer: answerWithReferences, sources })
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
