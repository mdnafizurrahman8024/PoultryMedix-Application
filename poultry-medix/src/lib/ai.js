import axios from 'axios'
import * as tmImage from '@teachablemachine/image'
import diseaseSigns from '../data/poultry-disease-signs.json'

let teachableModelPromise
const teachableModelBase = new URL('https://teachablemachine.withgoogle.com/models/i4VE4hlCa/')

async function loadPoultryImageModel() {
  const modelUrl = new URL('model.json', teachableModelBase).href
  const metadataUrl = new URL('metadata.json', teachableModelBase).href
  console.info('[smart-diagnosis] Loading Teachable Machine image model', { modelUrl, metadataUrl })
  const load = tmImage.load || tmImage.default?.load
  if (typeof load !== 'function') throw new Error('The Teachable Machine image loader is missing from the installed package.')
  return load(modelUrl, metadataUrl)
}

function canonicalDiseaseName(name) {
  const normalized = normalizeClinicalText(name)
  const matched = diseaseSigns.find((entry) => [entry.disease, ...entry.aliases]
    .some((alias) => normalizeClinicalText(alias) === normalized))
  return matched?.disease || name
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof Blob)) {
      reject(new Error('The selected prescription file is not readable as a browser file.'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('The selected file could not be converted to Base64.'))
        return
      }
      const separator = reader.result.indexOf(',')
      if (separator < 0 || !reader.result.slice(separator + 1)) {
        reject(new Error('The selected file produced an empty Base64 image payload.'))
        return
      }
      resolve(reader.result.slice(separator + 1))
    }
    reader.onerror = () => reject(reader.error || new Error('The selected file could not be read.'))
    reader.onabort = () => reject(new Error('Reading the selected file was cancelled.'))
    reader.readAsDataURL(file)
  })
}

export async function classifyPoultryImage(file) {
  if (!(file instanceof Blob) || !file.type.startsWith('image/')) {
    throw new Error('The Teachable Machine poultry classifier accepts image files only.')
  }
  if (!teachableModelPromise) {
    teachableModelPromise = loadPoultryImageModel().catch((error) => {
      teachableModelPromise = undefined
      console.error('[smart-diagnosis] Teachable Machine image model failed to load.', {
        modelUrl: new URL('model.json', teachableModelBase).href,
        message: error?.message || String(error),
        error,
      })
      throw new Error(`Teachable Machine image model could not load: ${error?.message || 'unknown model loading error'}`, { cause: error })
    })
  }

  const model = await teachableModelPromise
  const imageUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = imageUrl
    await image.decode()
    const predictions = await model.predict(image)
    const ranked = predictions
      .map(({ className, probability }) => ({ disease: canonicalDiseaseName(className), confidence: probability }))
      .sort((first, second) => second.confidence - first.confidence)
    const top = ranked[0]
    if (!top) throw new Error('The image model did not return a classification.')
    console.info('[smart-diagnosis] Teachable Machine image predictions received', ranked)
    return { label: top.disease, confidence: top.confidence, predictions: ranked }
  } catch (error) {
    console.error('[smart-diagnosis] Teachable Machine image classification failed.', error)
    throw error
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

function normalizeClinicalText(text) {
  return text.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}

function findLocalClinicalMatches(text) {
  const normalized = normalizeClinicalText(text)
  if (!normalized) return []
  return diseaseSigns.map((entry) => {
    const nameMatch = [entry.disease, ...entry.aliases].some((name) => normalized.includes(normalizeClinicalText(name)))
    const matchedSigns = entry.signs.filter((sign) => normalized.includes(normalizeClinicalText(sign)))
    const score = nameMatch ? 0.98 : matchedSigns.length ? Math.min(0.92, 0.48 + matchedSigns.length * 0.14) : 0
    return { disease: entry.disease, score, matchedSigns, confident: nameMatch || matchedSigns.length >= 2 }
  }).filter((match) => match.confident).sort((first, second) => second.score - first.score).slice(0, 3)
}

function asPercent(value) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

export async function analyzeSmartDiagnosis({ text, imageFile, audioFile, accessToken, appLanguage = 'en', onModelWarning }) {
  const localMatches = text ? findLocalClinicalMatches(text) : []
  let clinicalMatches = localMatches
  let clinicalAnswer = localMatches.length
    ? `The built-in clinical-sign index found these possible matches: ${localMatches.map((match) => `${match.disease}${match.matchedSigns.length ? ` (matching signs: ${match.matchedSigns.join(', ')})` : ''}`).join('; ')}. This is a screening aid, not a diagnosis.`
    : ''
  let sources = localMatches.length ? ['Built-in poultry clinical-sign index (local match; triage only)'] : []

  if (text && !localMatches.length) {
    const headers = { 'content-type': 'application/json' }
    if (accessToken) headers.authorization = `Bearer ${accessToken}`
    const response = await fetch('/api/diagnose', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, attachments: [], structuredMode: true, userRole: 'farmer', appLanguage }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Text symptom analysis could not be completed.')
    clinicalMatches = Array.isArray(result.predictions) ? result.predictions.map((item) => ({
      disease: item.disease,
      score: Number(item.clinical_sign_match) / 100,
    })).filter((item) => item.disease && Number.isFinite(item.score)) : []
    clinicalAnswer = result.differential_diagnosis || result.answer || ''
    sources = Array.isArray(result.sources) ? result.sources : []
  }

  let visualResult = null
  if (imageFile) {
    try {
      visualResult = await classifyPoultryImage(imageFile)
    } catch (error) {
      onModelWarning?.(error)
    }
  }

  const imageMatches = visualResult?.predictions || []
  const rankedImages = imageMatches.slice(0, 3)
  const candidateNames = [...new Set([
    ...clinicalMatches.map(({ disease }) => disease),
    ...rankedImages.map(({ disease }) => disease),
  ])]
  const predictions = candidateNames.map((disease) => {
    const clinical = clinicalMatches.find((match) => canonicalDiseaseName(match.disease) === canonicalDiseaseName(disease))
    const visual = imageMatches.find((match) => canonicalDiseaseName(match.disease) === canonicalDiseaseName(disease))
    const availableSignals = [clinical?.score, visual?.confidence].filter((score) => Number.isFinite(score))
    const overall = availableSignals.length ? availableSignals.reduce((sum, score) => sum + score, 0) / availableSignals.length : null
    return {
      disease,
      overall_probability: overall === null ? 'N/A' : asPercent(overall),
      breakdown: {
        clinical_sign_match: text ? (clinical ? asPercent(clinical.score) : clinicalAnswer ? 'N/A' : 'No confident local match') : 'N/A',
        image_match: imageFile ? (visual ? asPercent(visual.confidence) : 'N/A') : 'N/A',
        audio_match: 'N/A',
      },
    }
  }).sort((first, second) => Number.parseInt(second.overall_probability, 10) - Number.parseInt(first.overall_probability, 10))

  const limitations = []
  if (audioFile) limitations.push('Audio was received, but this Teachable Machine model contains an image classifier only; no audio classification was performed.')
  if (imageFile && !visualResult) limitations.push('The image model was unavailable, so no image classification was included.')
  if (text && !localMatches.length && !clinicalMatches.length) limitations.push('No confident clinical-sign match was returned from the available references.')
  const differential_diagnosis = [clinicalAnswer, limitations.join(' ')].filter(Boolean).join('\n\n')
    || 'Results are supporting signals for triage only and are not a diagnosis. Please consult a poultry veterinarian.'
  const answer = `${differential_diagnosis}\n\nMatch percentages are model/sign-match scores, not calibrated disease probabilities. Confirm findings with a poultry veterinarian.`
  return {
    answer,
    predictions,
    differential_diagnosis,
    sources,
    visualResult,
    audioAnalysisAvailable: false,
  }
}

export async function requestDiagnosis({ text, files, accessToken, visualFile, visualResult, userRole, appLanguage }) {
  const attachments = await Promise.all(files.filter((file) => file !== visualFile).map(async (file) => ({
    name: file.name,
    mimeType: file.type,
    data: await readFileAsBase64(file),
  })))
  const headers = { 'content-type': 'application/json' }
  if (accessToken) headers.authorization = `Bearer ${accessToken}`
  const response = await fetch('/api/diagnose', {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, attachments, visualResult, userRole, appLanguage }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'AI diagnosis could not be completed.')
  return result
}

export async function runMultimodalDiagnosis({ text, files, visualFile, accessToken, userRole, appLanguage, onModelWarning }) {
  let visualResult = null
  const image = visualFile === null ? null : visualFile || files.find((file) => file.type.startsWith('image/'))
  if (image) {
    try {
      visualResult = await classifyPoultryImage(image)
    } catch (error) {
      onModelWarning(error)
    }
  }
  const result = await requestDiagnosis({ text, files, accessToken, visualFile: image, visualResult, userRole, appLanguage })
  return { ...result, visualResult }
}

export async function scanPrescription(file) {
  const data = await readFileAsBase64(file)
  try {
    const response = await axios.post('/api/prescription-scan', {
      name: file.name,
      mimeType: file.type,
      data,
    }, {
      headers: { 'content-type': 'application/json' },
    })
    return response.data
  } catch (error) {
    const message = error.response?.data?.error || error.response?.data?.message
    console.error('[prescription-rag] Local prescription API request failed', {
      status: error.response?.status || null,
      message: message || error.message,
      code: error.code || null,
    })
    if (message) throw new Error(message)
    if (error.response) throw new Error(`Prescription analysis failed (HTTP ${error.response.status}).`)
    throw new Error(`Could not connect to the local prescription analysis API: ${error.message}`)
  }
}
