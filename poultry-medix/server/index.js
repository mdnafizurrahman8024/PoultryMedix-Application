import dotenv from 'dotenv'
import express from 'express'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'

const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(serverDirectory, '..')
dotenv.config({ path: path.join(projectRoot, '.env') })
dotenv.config({ path: path.join(serverDirectory, '.env') })

const app = express()
const port = Number(process.env.PORT || 8787)
const geminiKey = process.env.GEMINI_API_KEY
const openAiKey = process.env.OPENAI_API_KEY
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
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
const supabase = {
  auth: {
    async getUser(token) {
      const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: supabaseAnonKey,
          authorization: `Bearer ${token}`,
        },
      })
      if (!userResponse.ok) return { data: { user: null }, error: new Error('Invalid Supabase session.') }
      const user = await userResponse.json()
      return { data: { user }, error: user?.id ? null : new Error('Invalid Supabase session.') }
    },
  },
}
const veterinarySystemPrompt = [
  'You are a highly advanced Veterinary Clinical AI. You must act as a natural conversational agent (like ChatGPT).',
  'You MUST understand and process full natural language sentences, not just strict keywords.',
  'You MUST fluently understand and reply in English, Bengali (বাংলা script), and Banglish (Bengali written in English letters, e.g., "amake farming niye bolo").',
  "Extract the user's true intent regardless of spelling or grammar.",
  'You MUST provide detailed clinical, diagnostic, and treatment information when asked.',
  'Always search the local Supabase veterinary documents first. If no relevant local record exists, use only retrieved PubMed research context. Never use Wikipedia or general web results.',
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
  const rawAuthorization = request.get('authorization')?.trim()
  const token = rawAuthorization?.replace(/^Bearer\s+/i, '').trim()
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return response.status(401).json({ error: 'Sign in to use the AI tools.' })
  }
  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user?.id) {
      return response.status(401).json({ error: 'Your session is no longer valid. Sign in again.' })
    }
    const user = data.user

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

function allowDevelopmentGuest(request, response, next) {
  const guestId = `development-guest:${request.ip}`
  const now = Date.now()
  const requestTimes = (requestsByUser.get(guestId) || []).filter((time) => now - time < 60_000)
  if (requestTimes.length >= 8) {
    return response.status(429).json({ error: 'Please wait a minute before making another AI request.' })
  }
  requestTimes.push(now)
  requestsByUser.set(guestId, requestTimes)
  request.userId = guestId
  return next()
}

// Keep the strict middleware available for production; development chat accepts guests.
const requireAiUser = process.env.NODE_ENV === 'development' ? allowDevelopmentGuest : requireUser

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

function validateChatRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'A valid chat request is required.'
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return 'Enter a veterinary question before submitting.'
  if (text.length > 12_000) return 'Text is too long. Please keep it under 12,000 characters.'
  if (body.appLanguage !== undefined && (typeof body.appLanguage !== 'string' || body.appLanguage.length > 12)) return 'The selected app language is invalid.'
  return null
}

async function openAiChat(messages, temperature = 0.2) {
  const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature,
      messages,
    }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!openAiResponse.ok) {
    const errorBody = await openAiResponse.text()
    console.error('OpenAI chat request failed.', openAiResponse.status, errorBody)
    throw new Error('The language model could not complete this request.')
  }

  const result = await openAiResponse.json()
  const content = result.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('The language model returned an empty response.')
  return content
}

async function createOpenAiEmbedding(input) {
  const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!embeddingResponse.ok) {
    const errorBody = await embeddingResponse.text()
    console.error('OpenAI embedding request failed.', embeddingResponse.status, errorBody)
    throw new Error('The embedding service could not process this request.')
  }

  const result = await embeddingResponse.json()
  const embedding = result.data?.[0]?.embedding
  if (!Array.isArray(embedding) || embedding.length !== 1536) {
    throw new Error('The embedding service returned an unexpected vector dimension.')
  }
  return embedding
}

async function matchVeterinaryDocs(embedding, authorization) {
  const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/match_veterinary_docs`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      authorization: authorization || `Bearer ${supabaseAnonKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query_embedding: embedding,
      match_threshold: 0.65,
      match_count: 5,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!rpcResponse.ok) {
    const errorBody = await rpcResponse.text()
    console.error('Supabase veterinary document search failed.', rpcResponse.status, errorBody)
    throw new Error('The veterinary document search could not be completed.')
  }

  const matches = await rpcResponse.json()
  return Array.isArray(matches) ? matches : []
}

async function searchLocalVeterinaryDocs(query, authorization) {
  if (openAiKey) {
    const embedding = await createOpenAiEmbedding(query)
    return matchVeterinaryDocs(embedding, authorization)
  }

  // Development can retrieve local records lexically when no OpenAI embedding key is configured.
  const stopWords = new Set(['about', 'after', 'again', 'are', 'can', 'does', 'from', 'have', 'help', 'how', 'what', 'when', 'where', 'with'])
  const terms = [...new Set(query.toLocaleLowerCase().match(/[\p{L}\p{N}-]{3,}/gu) || [])]
    .filter((term) => !stopWords.has(term))
    .slice(0, 8)
  if (!terms.length) return []

  const params = new URLSearchParams({
    select: 'id,content,metadata',
    or: `(${terms.map((term) => `content.ilike.*${term}*`).join(',')})`,
    limit: '5',
  })
  const searchResponse = await fetch(`${supabaseUrl}/rest/v1/documents?${params}`, {
    headers: {
      apikey: supabaseAnonKey,
      authorization: authorization || `Bearer ${supabaseAnonKey}`,
    },
    signal: AbortSignal.timeout(20_000),
  })
  if (!searchResponse.ok) {
    const errorBody = await searchResponse.text()
    console.error('Supabase veterinary document search failed.', searchResponse.status, errorBody)
    throw new Error('The local veterinary document search could not be completed.')
  }

  const records = await searchResponse.json()
  return Array.isArray(records) ? records : []
}

async function searchExternalVeterinarySource(keyword) {
  const params = new URLSearchParams({
    query: `SRC:MED AND (${keyword}) AND (poultry OR chicken OR avian)`,
    format: 'json',
    pageSize: '3',
    resultType: 'core',
  })
  const searchResponse = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params}`, {
    signal: AbortSignal.timeout(20_000),
  })
  if (!searchResponse.ok) throw new Error('The PubMed veterinary literature search could not be completed.')
  const result = await searchResponse.json()
  const article = result.resultList?.result?.find((candidate) => (
    typeof candidate?.abstractText === 'string' && candidate.abstractText.trim()
  ))
  if (!article) return null
  const pmid = typeof article.pmid === 'string' ? article.pmid : ''
  const pmcid = typeof article.pmcid === 'string' ? article.pmcid : ''
  const url = pmid
    ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
    : `https://europepmc.org/article/PMC/${pmcid.replace(/^PMC/i, '')}`
  const source = [article.title, article.journalTitle, article.pubYear].filter(Boolean).join('. ')
  return {
    content: article.abstractText.trim(),
    source: source || 'PubMed indexed veterinary research article',
    url,
  }
}

app.post('/api/chat', requireAiUser, async (request, response) => {
  const validationError = validateChatRequest(request.body)
  if (validationError) return response.status(400).json({ error: validationError })
  if (!openAiKey) return response.status(503).json({ error: 'The RAG language model is not configured on this server.' })

  const { text, appLanguage = 'en' } = request.body

  try {
    const keywordJson = await openAiChat([
      {
        role: 'system',
        content: [
          'Extract exactly one core veterinary medical keyword or topic from the user message.',
          'The message may be English, Bengali, Banglish, Hindi, Urdu, or mixed language.',
          'Return JSON only in this exact shape: {"keyword":"coccidiosis"}.',
          'Do not answer the question and do not add explanations.',
        ].join(' '),
      },
      { role: 'user', content: text },
    ], 0)

    let keyword
    try {
      keyword = JSON.parse(keywordJson).keyword
    } catch {
      throw new Error('The intent extraction response was not valid JSON.')
    }
    if (typeof keyword !== 'string' || !keyword.trim()) throw new Error('No veterinary search keyword was extracted.')

    const embedding = await createOpenAiEmbedding(keyword.trim())
    const matches = await matchVeterinaryDocs(embedding, request.get('authorization'))
    const references = matches
      .map((match) => {
        const metadata = match?.metadata || {}
        const suppliedSource = metadata.book_name ?? metadata.bookName ?? metadata.source ?? metadata.title
        const documentId = match?.id ?? match?.document_id
        const bookName = typeof suppliedSource === 'string' && suppliedSource.trim()
          ? suppliedSource.trim()
          : `Supabase documents table${documentId ? ` record ${documentId}` : ''}`
        const pageNumber = metadata.page ?? metadata.page_number ?? metadata.pageNumber
        const content = typeof match?.content === 'string' ? match.content.trim() : ''
        if (!content) return null
        return {
          content,
          bookName,
          pageNumber: pageNumber === undefined ? 'n/a' : pageNumber,
        }
      })
      .filter(Boolean)

    if (!references.length) {
      const externalReference = await searchExternalVeterinarySource(keyword.trim())
      if (!externalReference) {
        return response.json({
          answer: 'I could not find a matching verified veterinary reference, so I cannot provide a sourced answer. Please consult a registered veterinarian.\n\nReferences/Sources\n- No matching source found in the local veterinary database or PubMed.',
          sources: ['No matching source found in the local veterinary database or PubMed.'],
          keyword: keyword.trim(),
        })
      }
      const answer = await openAiChat([
        {
          role: 'system',
          content: [
            'You are a cautious veterinary information assistant.',
            `Answer in the same language and writing style as the user. The app language is ${appLanguage}, but preserve Banglish when the user writes Banglish.`,
            'Use only the supplied external veterinary context for factual claims and clearly state that professional assessment is required.',
            'Do not add a References section; the application will append the verified citation.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: `Original question:\n${text}\n\nExtracted keyword:\n${keyword.trim()}\n\nExternal veterinary context:\n${externalReference.content}`,
        },
      ])
      const source = `Source: ${externalReference.source}, URL: ${externalReference.url}`
      return response.json({ answer: `${answer}\n\nReferences/Sources\n- ${source}`, sources: [source], keyword: keyword.trim() })
    }

    const context = references.map((reference, index) => (
      `[Reference ${index + 1}]\nBook: ${reference.bookName}\nPage: ${reference.pageNumber}\nText:\n${reference.content}`
    )).join('\n\n')
    const answer = await openAiChat([
      {
        role: 'system',
        content: [
          'You are a cautious veterinary information assistant.',
          `Answer in the same language and writing style as the user. The app language is ${appLanguage}, but preserve Banglish when the user writes Banglish.`,
          'Use only the supplied reference context for factual claims. Do not invent diagnoses, doses, withdrawal periods, or treatment plans.',
          'Recommend a registered veterinarian for diagnosis and treatment decisions.',
          'Use only the supplied reference context for factual claims. Do not add a References section; the application appends exact citations.',
          'Use the exact metadata values supplied. Never cite Local Database, Database, or an invented source.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: `Original question:\n${text}\n\nExtracted keyword:\n${keyword.trim()}\n\nReference context:\n${context}`,
      },
    ])

    const sources = references.map(({ bookName, pageNumber }) => `Source: ${bookName}, Page: ${pageNumber}`)
    return response.json({
      answer: `${answer}\n\nReferences/Sources\n${sources.map((source) => `- ${source}`).join('\n')}`,
      keyword: keyword.trim(),
      sources,
    })
  } catch (error) {
    console.error('Veterinary RAG chat request failed.', error.message)
    return response.status(502).json({ error: error.message || 'The veterinary RAG request could not be completed.' })
  }
})

app.post('/api/diagnose', requireAiUser, async (request, response) => {
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
      'Use only the verified local database or PubMed context supplied below for factual claims. Do not invent diagnoses, citations, or references. The application will append the exact verified citations at the end of your response.',
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
    const retrievalQuery = text.trim() || 'poultry disease clinical signs and diagnosis'
    const matches = await searchLocalVeterinaryDocs(retrievalQuery, request.get('authorization'))
    const localReferences = matches.map((match) => {
      const metadata = match?.metadata || {}
      const content = typeof match?.content === 'string' ? match.content.trim() : ''
      if (!content) return null
      const documentId = match?.id ?? match?.document_id
      const bookName = metadata.book_name ?? metadata.bookName ?? metadata.source ?? metadata.title
        ?? `Supabase documents table${documentId ? ` record ${documentId}` : ''}`
      const pageNumber = metadata.page ?? metadata.page_number ?? metadata.pageNumber ?? 'n/a'
      return { content, bookName: String(bookName), pageNumber }
    }).filter(Boolean)
    const externalReference = localReferences.length
      ? null
      : await searchExternalVeterinarySource(retrievalQuery)
    if (!localReferences.length && !externalReference) {
      return response.json({
        answer: 'I could not find a matching verified veterinary reference, so I cannot provide a sourced answer. Please consult a registered veterinarian.\n\nReferences/Sources\n- No matching source found in the local veterinary database or PubMed.',
        sources: ['No matching source found in the local veterinary database or PubMed.'],
      })
    }
    const retrievedContext = localReferences.length
      ? localReferences.map((reference, index) => (
        `[Local reference ${index + 1}] ${reference.bookName}, page ${reference.pageNumber}\n${reference.content}`
      )).join('\n\n')
      : externalReference
        ? `[PubMed reference] ${externalReference.source}\nURL: ${externalReference.url}\n${externalReference.content}`
        : 'No verified veterinary reference was found. Do not provide an unsupported medical answer; recommend consulting a registered veterinarian.'
    parts[0].text += `\n\nVerified veterinary reference context (local Supabase search runs first):\n${retrievedContext}`

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

    const sources = localReferences.length
      ? localReferences.map(({ bookName, pageNumber }) => `Source: ${bookName}, Page: ${pageNumber}`)
      : externalReference
        ? [`Source: ${externalReference.source}, URL: ${externalReference.url}`]
        : ['No matching source found in the local veterinary database or PubMed.']
    if (visualResult) sources.push(`Teachable Machine: ${visualResult.label} (${Math.round(visualResult.confidence * 100)}%)`)
    const answerWithReferences = `${answer}\n\nReferences/Sources\n${sources.map((source) => `- ${source}`).join('\n')}`
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
