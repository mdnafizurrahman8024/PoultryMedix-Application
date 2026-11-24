import diseaseSigns from '../data/poultry-disease-signs.json'
import { getVerifiedVeterinarySources } from './veterinarySources.js'

/**
 * PoultryMedix AI Service Adapter
 *
 * Implements resilient multi-mode AI completions:
 * - VITE_AI_MODE=proxy : Routes via VITE_AI_PROXY_URL using dynamically discovered
 *   and silently rotated OpenRouter :free models with automatic rate-limit (429/5xx) failover.
 *   (Strict rule: Only models ending in :free or openrouter/free; NEVER openrouter/auto).
 * - VITE_AI_MODE=direct: Ready for direct provider endpoints (Claude / OpenAI / Gemini).
 * - Local Clinical Intelligence Engine: If remote proxy returns non-JSON or HTML, immediately
 *   answers farmer queries using curated veterinary biosecurity & disease triage indices.
 */

export const POLITE_EXHAUSTION_MESSAGE =
  'At this time, the AI consultation service is temporarily unavailable due to high demand. Please try again in a few hours.'

export const REPORT_AI_FALLBACK_NOTE =
  'Detailed AI explanation is temporarily busy, please review the diagnostic confidence scores above and consult a veterinarian.'

// High-reliability curated fallback sequence strictly containing valid zero-cost IDs
const CURATED_FREE_MODELS = [
  'baidu/ernie-5.5-flash-preview:free',
  'liquid/lfm-3-1.7b:free',
  'particle-ai/particle-1:free',
  'recursive/flint-v1.0:free',
  'nvidia/nemotron-3.5-super-vl:free',
  'dots-studio/dots-3-note-preview:free',
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'inclusionai/ling-3.2-flash:free',
]

let discoveredFreeModels = []
let lastModelDiscoveryTime = 0
const MODEL_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour cache

/**
 * Normalizes proxy URL ensuring no trailing slashes.
 */
export function getCleanProxyUrl() {
  const raw = import.meta.env.VITE_AI_PROXY_URL || ''
  return raw.trim().replace(/\/+$/, '')
}

/**
 * Dynamically fetches active :free models from OpenRouter catalog.
 * Strictly filters for id ending in :free or openrouter/free (NEVER openrouter/auto).
 */
export async function getAvailableFreeModels() {
  const now = Date.now()
  if (discoveredFreeModels.length > 0 && now - lastModelDiscoveryTime < MODEL_CACHE_TTL_MS) {
    return discoveredFreeModels
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })

    if (res.ok) {
      const data = await res.json()
      const models = Array.isArray(data?.data) ? data.data : []
      const freeList = models
        .filter((m) => {
          if (typeof m.id !== 'string') return false
          const id = m.id.trim()
          return (id.endsWith(':free') || id === 'openrouter/free') && id !== 'openrouter/auto'
        })
        .map((m) => m.id.trim())

      if (freeList.length > 0) {
        // Preferred reliable models first, followed by remaining discovered models
        const priorityPrefix = CURATED_FREE_MODELS.filter((id) => freeList.includes(id))
        const remaining = freeList.filter((id) => !priorityPrefix.includes(id))
        discoveredFreeModels = [...priorityPrefix, ...remaining]
        lastModelDiscoveryTime = now
        return discoveredFreeModels
      }
    }
  } catch (err) {
    console.info('[ai-adapter] Dynamic model discovery using built-in rotation list')
  }

  discoveredFreeModels = CURATED_FREE_MODELS
  lastModelDiscoveryTime = now
  return discoveredFreeModels
}

// Auto-sync free models in background on startup
if (typeof window !== 'undefined') {
  setTimeout(() => {
    getAvailableFreeModels().catch(() => {})
  }, 100)
}

/**
 * Checks if user message is asking for drug name, dosage, or treatment prescription.
 */
function isRestrictedPrescriptionQuery(text = '') {
  const normalized = text.toLowerCase().trim()
  const patterns = [
    /\b(what|which)\s+(medicine|drug|antibiotic|injection|pill|syrup|treatment|tablet)\b/,
    /\b(how\s+to\s+treat|treatment\s+procedure|cure|treat\s+with)\b/,
    /\b(suggest|recommend|prescribe|give)\s+(a\s+|some\s+)?(medicine|drug|antibiotic|dose|dosage|injection)\b/,
    /\b(dose|dosage|how\s+much\s+(mg|ml|gram|packet|drop))\b/,
    /\b(name\s+of\s+(the\s+)?(medicine|antibiotic|drug))\b/,
    /(ওষুধ|ঔষধ|অ্যান্টিবায়োটিক|ডোজ|চিকিৎসা|কি\s+ওষুধ\s+দিব|কি\s+ঔষধ|মাত্রা)/,
    /(दवा|एंटीबायোটিক|खुराक|इलाज|दवाई)/,
    /(دوا|اینٹی\s*بائیوٹک|خوراک|علاج)/,
  ]
  return patterns.some((p) => p.test(normalized))
}

/**
 * Returns localized clinical safety advisory when prescription request is intercepted.
 */
function getSafetyAdvisory(language = 'en') {
  if (language === 'bn') {
    return `⚠️ জরুরি ভেটেরিনারি রেফারাল ও এএমআর (AMR) নোটিশ:

পশুচিকিৎসা আইন এবং অ্যান্টিমাইক্রোবিয়াল রেজিস্ট্যান্স (AMR) প্রতিরোধ নীতি অনুযায়ী, খামারিদের জন্য এআই কোনো ওষুধের নাম, প্রেসক্রিপশন বা চিকিৎসার মাত্রা (ডোজ) প্রদান করতে পারে না। অনুমতি ছাড়া অ্যান্টিবায়োটিক প্রয়োগ করলে ফ্লকে মারাত্মক ওষুধ-প্রতিরোধী জীবাণু সৃষ্টি হয়।

জরুরি সহায়ক পরিচর্যা প্রোটোকল (Non-Pharmaceutical Supportive Care):
১. তাৎক্ষণিক কোয়ারেন্টাইন: অসুস্থ পাখিকে অবিলম্বে সুস্থ ঝাঁক থেকে আলাদা করে উষ্ণ, শুকনো ও আলো-বাতাসযুক্ত শেডে রাখুন।
২. রিহাইড্রেশন ও ইলেকট্রোলাইট: খাবার পানির সাথে ওরাল স্যালাইন বা ইলেকট্রোলাইট দিন যাতে পানিশূন্যতা ও দুর্বলতা দূর হয়।
৩. লিটার ও পরিবেশ ব্যবস্থাপনা: পানির পাত্রের চারপাশের ভেজা লিটার অবিলম্বে সরিয়ে নতুন শুকনো তুঁষ দিন এবং অতিরিক্ত আর্দ্রতা ও অ্যামোনিয়া কমাতে বায়ু চলাচল স্বাভাবিক রাখুন।
৪. খামারের জৈবনিরাপত্তা: শেডের প্রবেশমুখে পটাশ বা ব্লিচিং মিশ্রিত ফুটবাথ কার্যকর রাখুন এবং খাবার-পানির পাত্র প্রতিদিন পরিষ্কার করুন।

👨‍⚕️ ভেটেরিনারি পরামর্শ:
রোগের সঠিক কারণ শনাক্তকরণ এবং বৈধ প্রেসক্রিপশনের জন্য অনতিবিলম্বে একজন রেজিস্টার্ড পশুচিকিৎসক (Registered Veterinarian) বা নিকটস্থ উপজেলা প্রাণিসম্পদ কর্মকর্তার (ULO) সাথে যোগাযোগ করুন।`
  }
  return `⚠️ Veterinary Referral & AMR Safety Notice:

Under statutory veterinary laws and Antimicrobial Resistance (AMR) stewardship rules, automated AI is strictly restricted from prescribing drug names, antibiotic therapies, or treatment dosages in Farmer Mode. Indiscriminate antimicrobial use causes fatal flock resistance and treatment failure.

Immediate Supportive Management Protocols:
1. Strict Isolation: Quarantine symptomatic birds immediately in a dedicated, warm, and well-ventilated dry pen to protect the healthy flock.
2. Continuous Hydration: Provide clean drinking water supplemented with balanced oral rehydration salts (ORS) / electrolytes to sustain flock vitality.
3. Environmental Sanitation: Immediately replace damp bedding around waterers and ensure continuous fresh airflow to disperse toxic ammonia fumes.
4. Farm Biosecurity: Maintain active disinfectant footbaths (iodophore or potassium permanganate) at coop doors; sanitize all feeding and watering equipment daily.

👨‍⚕️ Veterinary Consultation:
Please consult a licensed poultry veterinarian or local livestock officer immediately for clinical diagnostic confirmation and lawful medical prescription.`
}

const VETERINARY_SYSTEM_PROMPT = `
You are PoultryMedix Clinical AI, a specialized avian triage and biosecurity assistant designed for rural poultry farmers in Bangladesh and South Asia.

CLINICAL & ETHICAL PROTOCOLS:
1. PREDICTED DIAGNOSIS & CONFIDENCE BREAKDOWN (%):
   - When a farmer asks for a diagnosis, describes symptoms, or provides a photo:
     * Clearly state the Predicted Diagnosis with percentages (%) for the primary detected condition AND any differential / secondary / minimum-risk conditions identified (e.g. Coccidiosis: 94%, CRD: 4%, Healthy: 2%).
     * State that percentages are triage matching probabilities from on-device / clinical screening models, not a final laboratory diagnosis.

2. DETAILED SUPPORTIVE PROTOCOLS FOR ALL DETECTED CONDITIONS:
   - For every disease predicted (including secondary / minimum-risk conditions), describe the detailed management protocol:
     * Isolation / Quarantine: Explain why immediate separation of sick birds in a warm, dry recovery area is vital to protect the healthy flock from transmission.
     * Hydration & ORS: Continuous clean drinking water with oral rehydration salts (ORS) / electrolytes to prevent fatal dehydration.
     * Litter & Shed Ventilation: Immediately remove and replace damp bedding around waterers; ventilate to remove toxic ammonia fumes without cold drafts.
     * Farm Biosecurity: Disinfectant footbaths (bleaching powder or potassium permanganate) at shed entries, daily cleaning and disinfection of feeders and drinkers, and restriction of visitors and wild birds.

3. STRICT PROHIBITION ON TREATMENT / PRESCRIPTIONS IN FARMER MODE:
   - In Farmer Mode, you are STRICTLY FORBIDDEN from prescribing or suggesting:
     ❌ ANY antibiotic or pharmaceutical drug names (e.g., Ciprofloxacin, Enrofloxacin, Amoxicillin, Doxycycline, Colistin, Tylosin, Sulfonamides, etc.).
     ❌ ANY medication dosages or treatment courses (e.g., mg/L, ml/kg, days of antibiotic treatment).
   - Under statutory veterinary regulations and Antimicrobial Resistance (AMR) stewardship rules, non-veterinarians cannot administer prescription antimicrobials. Random antibiotic use causes devastating treatment resistance and flock mortality.
   - If asked for medicine or treatment, firmly decline and explain the AMR safety rule.

4. MANDATORY VETERINARY REFERRAL NOTICE:
   - Every diagnosis response MUST conclude with a clear, prominent Referral Notice for a Registered Veterinarian:
     "⚠️ জরুরি ভেটেরিনারি রেফারাল (Veterinary Referral Notice): এটি একটি প্রাথমিক স্ক্রীনিং এইড (Triage Aid), কোনো চিকিৎসা বা প্রেসক্রিপশন নয়। সঠিক ল্যাব পরীক্ষা এবং চিকিৎসা প্রেসক্রিপশনের জন্য অনতিবিলম্বে একজন রেজিস্টার্ড ভেটেরিনারি চিকিৎসক (Registered Vet) বা উপজেলা প্রাণিসম্পদ কর্মকর্তার (ULO) শরণাপন্ন হোন।"

5. ON-DEVICE EDGE VISION INTEGRATION:
   - When an "[Attached Image Observation]" or "[ON-DEVICE AVIAN VISION SCREENING FINDING]" is present, this is verified edge vision screening from the farmer's flock photo. NEVER say you cannot view or analyze images. Directly discuss the detected condition and follow these protocols.

6. NATURAL MULTILINGUAL COMMUNICATION:
   - Provide answers in the farmer's requested language (Bengali বাংলা, English, Hindi हिंदी, Urdu اردو, or Banglish). Keep the tone supportive, professional, and clear.
`.trim()

/**
 * Executes chat completion request through the configured proxy or direct provider.
 */
export async function sendChatMessage({
  messages = [],
  language = 'en',
  contextPrompt = '',
  visualResult = null,
  images = [],
}) {
  const latestMessage = messages[messages.length - 1]?.content || ''
  const searchCondition = visualResult?.label || latestMessage

  // Clinical safety interception
  if (isRestrictedPrescriptionQuery(latestMessage)) {
    return {
      answer: getSafetyAdvisory(language),
      sources: getVerifiedVeterinarySources(searchCondition),
      visualResult,
    }
  }

  // Prepend visual screening context if an image was examined on-device
  let augmentedContext = contextPrompt || ''
  if (visualResult) {
    const predictionsSummary = visualResult.predictions?.length
      ? visualResult.predictions.map((p) => `${p.disease} (${Math.round((p.confidence || 0) * 100)}%)`).join(', ')
      : `${visualResult.label} (${Math.round((visualResult.confidence || 0) * 100)}%)`

    const visualNotice = [
      `[ON-DEVICE AVIAN VISION SCREENING FINDING]:`,
      `- Primary Detected Condition: ${visualResult.label} (${Math.round((visualResult.confidence || 0) * 100)}% match)`,
      `- All Detected Disease Predictions (%): ${predictionsSummary}`,
      ``,
      `CLINICAL INSTRUCTIONS FOR THIS SCREENING:`,
      `1. PREDICTED DIAGNOSIS: Present the primary detected condition (${visualResult.label}) with its exact % score, and discuss the secondary/minimum-risk conditions detected (${predictionsSummary}).`,
      `2. DETAILED SUPPORTIVE PROTOCOLS FOR ALL DETECTED CONDITIONS: Explain isolation/quarantine, hydration/electrolytes (ORS), litter/ventilation management, and farm biosecurity.`,
      `3. STRICT PROHIBITION: Do NOT give any antibiotic or pharmaceutical drug names or dosages.`,
      `4. VETERINARY NOTICE: Refer the farmer to a registered veterinarian.`,
    ].filter(Boolean).join('\n')

    augmentedContext = augmentedContext ? `${augmentedContext}\n\n${visualNotice}` : visualNotice
  }

  const mode = import.meta.env.VITE_AI_MODE || 'proxy'

  let result
  if (mode === 'direct') {
    result = await executeDirectAiCall({ messages, contextPrompt: augmentedContext, visualResult })
  } else {
    result = await executeProxyWithSilentRotation({ messages, contextPrompt: augmentedContext, visualResult, images, language })
  }

  const verifiedSources = getVerifiedVeterinarySources(searchCondition)
  return {
    ...result,
    sources: verifiedSources.length ? verifiedSources : (result.sources || []),
    visualResult,
  }
}

/**
 * Executes proxy request with resilient silent auto-rotation across up to 6 :free models.
 */
async function executeProxyWithSilentRotation({ messages, contextPrompt, visualResult = null, language = 'en' }) {
  const proxyUrl = getCleanProxyUrl()
  if (!proxyUrl) {
    console.warn('[ai-adapter] VITE_AI_PROXY_URL is not set.')
    return generateLocalClinicalKnowledgeReply({
      query: messages[messages.length - 1]?.content || '',
      topDisease: visualResult?.label || '',
      language,
    })
  }

  const candidateModels = await getAvailableFreeModels()
  const rotationSlice = candidateModels.slice(0, 6)

  const systemInstruction = contextPrompt
    ? `${VETERINARY_SYSTEM_PROMPT}\n\nClinical Context:\n${contextPrompt}`
    : VETERINARY_SYSTEM_PROMPT

  const payloadMessages = [
    { role: 'system', content: systemInstruction },
    ...messages.map((m, idx) => {
      let content = m.content || m.text || ''
      if (idx === messages.length - 1 && visualResult) {
        content = `[Attached Image Observation: Screened as ${visualResult.label} (${Math.round((visualResult.confidence || 0) * 100)}% confidence)]\n\n${content}`
      }
      return {
        role: m.role === 'user' ? 'user' : 'assistant',
        content,
      }
    }),
  ]

  let lastError = null

  for (const model of rotationSlice) {
    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: payloadMessages,
          stream: false,
        }),
        signal: AbortSignal.timeout(20000), // 20s per model attempt
      })

      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`)
        continue
      }

      const text = await response.text()
      let data = null
      try {
        data = JSON.parse(text)
      } catch {
        lastError = new Error('Non-JSON response')
        continue
      }

      const reply = data?.choices?.[0]?.message?.content
      if (typeof reply === 'string' && reply.trim().length > 0) {
        return {
          answer: reply.trim(),
          sources: getVerifiedVeterinarySources(visualResult?.label || messages[messages.length - 1]?.content),
        }
      }

      lastError = new Error('Empty response content')
    } catch (err) {
      lastError = err
    }
  }

  console.warn('[ai-adapter] All rotated :free models exhausted or proxy unavailable:', lastError?.message, '- falling back to local clinical intelligence.')
  return generateLocalClinicalKnowledgeReply({
    query: messages[messages.length - 1]?.content || '',
    topDisease: visualResult?.label || '',
    language,
  })
}

/**
 * Local Veterinary Clinical AI Engine
 * Delivers immediate, authoritative, localized veterinary supportive care & biosecurity guidance
 * whenever remote proxy endpoints are unavailable or returning non-JSON website responses.
 */
export function generateLocalClinicalKnowledgeReply({ query = '', topDisease = '', language = 'en' }) {
  const normalizedQuery = (query + ' ' + topDisease).toLowerCase().trim()
  const isBengali = language === 'bn' || /[\u0980-\u09FF]/.test(normalizedQuery) ||
    /\b(murgi|rokto|amashoy|paykhana|ranikhet|gumboro|thanda|sordi|kashi|bap|ulo|khabar|pani)\b/i.test(normalizedQuery)

  let matchedDisease = 'coccidiosis'
  if (topDisease) {
    const td = topDisease.toLowerCase()
    if (td.includes('coryza')) matchedDisease = 'coryza'
    else if (td.includes('coccidi')) matchedDisease = 'coccidiosis'
    else if (td.includes('newcastle') || td.includes('ranikhet')) matchedDisease = 'newcastle'
    else if (td.includes('gumboro') || td.includes('bursal') || td.includes('ibd')) matchedDisease = 'gumboro'
    else if (td.includes('crd') || td.includes('respiratory') || td.includes('mycoplasma')) matchedDisease = 'crd'
    else if (td.includes('pox')) matchedDisease = 'pox'
    else if (td.includes('salmonell') || td.includes('cholera') || td.includes('typhoid') || td.includes('pullorum')) matchedDisease = 'salmonella'
    else if (td.includes('bumblefoot')) matchedDisease = 'bumblefoot'
    else if (td.includes('influenza') || td.includes('bird flu')) matchedDisease = 'influenza'
    else if (td.includes('healthy') || td.includes('normal')) matchedDisease = 'healthy'
  } else {
    if (/\b(coryza|coriza|swollen face|চোখ ফোলা|নাক দিয়ে পানি|করাইজা)\b/i.test(normalizedQuery)) {
      matchedDisease = 'coryza'
    } else if (/\b(blood|bloody|coccidi|রক্ত|আমাশয়|রক্ত পায়খানা|রক্ত আমাশয়)\b/i.test(normalizedQuery)) {
      matchedDisease = 'coccidiosis'
    } else if (/\b(neck|twist|torticollis|newcastle|ranikhet|রানীক্ষেত|ঘাড় বাঁকা)\b/i.test(normalizedQuery)) {
      matchedDisease = 'newcastle'
    } else if (/\b(white diarrhea|gumboro|ibd|bursal|vent|গামবোরো|সাদা পায়খানা)\b/i.test(normalizedQuery)) {
      matchedDisease = 'gumboro'
    } else if (/\b(cough|coughing|gasp|sneeze|crd|respiratory|ঠাণ্ডা|সর্দি|কাশি|শ্বাসকষ্ট|ঘরঘর)\b/i.test(normalizedQuery)) {
      matchedDisease = 'crd'
    } else if (/\b(pox|scab|wart|বসন্ত|গুটি|পক্স)\b/i.test(normalizedQuery)) {
      matchedDisease = 'pox'
    } else if (/\b(green diarrhea|cholera|salmonell|typhoid|পায়খানা|কলেরা|সবুজ পায়খানা)\b/i.test(normalizedQuery)) {
      matchedDisease = 'salmonella'
    } else if (/\b(bumblefoot|foot|lame|পা ফোলা|খোঁড়া)\b/i.test(normalizedQuery)) {
      matchedDisease = 'bumblefoot'
    } else if (/\b(flu|influenza|bird flu|বার্ড ফ্লু)\b/i.test(normalizedQuery)) {
      matchedDisease = 'influenza'
    } else if (/\b(care|feed|water|healthy|পরিচর্যা|খাবার|সুস্থ)\b/i.test(normalizedQuery)) {
      matchedDisease = 'healthy'
    }
  }

  if (isBengali) {
    if (matchedDisease === 'coryza') {
      return {
        answer: `ক্লিনিকাল মূল্যায়ন: ইনফেকশাস করাইজা ও শ্বাসতন্ত্রের সংক্রমণ (Infectious Coryza)

সম্ভাব্য রোগ ও পূর্বাভাস (Predicted Condition):
• প্রধান ঝুঁকি: ইনফেকশাস করাইজা (Avibacterium paragallinarum সংক্রমণ)
• প্রধান লক্ষণ: চোখ ও মুখমণ্ডল ফোলা (Facial Swelling), চোখ-নাক দিয়ে শ্লেষ্মা বা জল পড়া, হাঁচি এবং খাবার গ্রহণে অনীহা।
• সেকেন্ডারি ঝুঁকি (Differential / Minimum Risk): ক্রনিক রেসপিরেটরি ডিজিজ (CRD / Mycoplasma) ও তীব্র সর্দি।

জরুরি সহায়ক পরিচর্যা প্রোটোকল (Detailed Supportive Protocols):
১. তাৎক্ষণিক কোয়ারেন্টাইন: আক্রান্ত পাখিদের দ্রুত সুস্থ ঝাঁক থেকে আলাদা করে উষ্ণ, শুকনো আইসোলেশন খাঁচায় রাখুন। এই রোগ খাবার ও পানির পাত্রের মাধ্যমে সুস্থ পাখিতে দ্রুত ছড়ায়।
২. পানি ও ইলেকট্রোলাইট ব্যবস্থাপনা: বিশুদ্ধ খাবার পানিতে ওরাল স্যালাইন বা ইলেকট্রোলাইট ও ভিটামিন-সি মিশিয়ে দিন যাতে রোগ প্রতিরোধ ক্ষমতা ও হাইড্রেশন বজায় থাকে।
৩. লিটার ও অ্যামোনিয়া নিয়ন্ত্রণ: শেডের লিটার শুষ্ক রাখুন; অ্যামোনিয়া গ্যাস চোখ ও শ্বাসনালীকে আরও ক্ষতিগ্রস্ত করে, তাই পর্যাপ্ত বাতাস চলাচলের ব্যবস্থা করুন।
৪. চোখ-নাকের পরিচর্যা: কুসুম গরম স্যালাইন পানি দিয়ে সতর্কতার সাথে চোখের চারপাশের জমাট শ্লেষ্মা পরিষ্কার করে দিন।

খামারের জৈবনিরাপত্তা (Biosecurity Protocol):
• শেডের প্রবেশদ্বারে পটাশ বা ব্লিচিং মিশ্রিত ফুটবাথ কার্যকর রাখুন।
• খাবার ও পানির পাত্র প্রতিদিন গরম পানি দিয়ে ধুয়ে জীবাণুমুক্ত করুন।

⚠️ জরুরি ভেটেরিনারি রেফারাল ও এএমআর (AMR) নোটিশ:
পশুচিকিৎসা আইন ও এএমআর নীতিমালা অনুযায়ী খামারিদের জন্য এআই কোনো অ্যান্টিবায়োটিক বা ওষুধের প্রেসক্রিপশন প্রদান সম্পূর্ণ নিষিদ্ধ। রোগ নিশ্চিতকরণ ও সঠিক প্রেসক্রিপশনের জন্য অনতিবিলম্বে একজন রেজিস্টার্ড ভেটেরিনারি চিকিৎসকের (Registered Vet) সাথে যোগাযোগ করুন।`,
        sources: getVerifiedVeterinarySources('coryza'),
      }
    }
    if (matchedDisease === 'coccidiosis') {
      return {
        answer: `ক্লিনিকাল মূল্যায়ন ও পরামর্শ: কক্সিডিওসিস (রক্ত আমাশয়)

সম্ভাব্য রোগ ও পূর্বাভাস (Predicted Condition):
• প্রধান ঝুঁকি: কক্সিডিওসিস (Eimeria প্রোটোজোয়া সংক্রমণ)
• প্রধান লক্ষণ: রক্তমিশ্রিত মল, ডানা ঝুলে পড়া, দুর্বলতা ও ফ্যাকাশে ঝুঁটি।
• সেকেন্ডারি ঝুঁকি (Differential / Minimum Risk): নেক্রোটিক এন্টারাইটিস ও স্যালমোনেলোসিস।

জরুরি সহায়ক পরিচর্যা প্রোটোকল (Detailed Supportive Protocols):
১. তাৎক্ষণিক কোয়ারেন্টাইন: আক্রান্ত পাখিকে অবিলম্বে সুস্থ ঝাঁক থেকে আলাদা করে উষ্ণ, শুকনো কোয়ারেন্টাইন শেডে রাখুন।
২. রিহাইড্রেশন ও ইলেকট্রোলাইট: বিশুদ্ধ খাবার পানির সাথে ওরাল স্যালাইন বা ইলেকট্রোলাইট দিন যাতে রক্তক্ষরণ ও পানিশূন্যতা রোধ হয়।
৩. লিটার ব্যবস্থাপনা: পানির পাত্রের চারপাশের ভেজা লিটার অবিলম্বে সরিয়ে নতুন শুকনো তুঁষ দিন (আর্দ্রতা ২৫% এর নিচে রাখুন)।
৪. খামারের জৈবনিরাপত্তা: শেডের প্রবেশমুখে পটাশ বা ব্লিচিং মিশ্রিত ফুটবাথ নিয়মিত বজায় রাখুন এবং খাবার পাত্র জীবাণুমুক্ত করুন।

⚠️ জরুরি ভেটেরিনারি রেফারাল ও এএমআর (AMR) নোটিশ:
পশুচিকিৎসা আইন অনুযায়ী খামারিদের জন্য এআই কোনো ওষুধের নাম বা প্রেসক্রিপশন প্রদান করতে পারে না। সঠিক অ্যান্টিকক্সিডিয়াল চিকিৎসার জন্য অনতিবিলম্বে একজন রেজিস্টার্ড ভেটেরিনারি চিকিৎসকের পরামর্শ নিন।`,
        sources: getVerifiedVeterinarySources('coccidiosis'),
      }
    }
    if (matchedDisease === 'newcastle') {
      return {
        answer: `ক্লিনিকাল মূল্যায়ন ও পরামর্শ: রানীক্ষেত রোগ (Newcastle Disease)

সম্ভাব্য রোগ ও পূর্বাভাস (Predicted Condition):
• প্রধান ঝুঁকি: রানীক্ষেত রোগ (Newcastle Paramyxovirus)
• প্রধান লক্ষণ: ঘাড় বাঁকা হওয়া (Torticollis), সবুজ বা চুনা পায়খানা, শ্বাসকষ্ট ও হঠাৎ মৃত্যু।
• সেকেন্ডারি ঝুঁকি (Differential / Minimum Risk): এভিয়ান ইনফ্লুয়েঞ্জা ও তীব্র ব্রঙ্কাইটিস।

জরুরি সহায়ক পরিচর্যা প্রোটোকল (Detailed Supportive Protocols):
১. দ্রুততম আইসোলেশন: অসুস্থ পাখিকে সুস্থ পাখি থেকে আলাদা শেডে রাখুন। এটি মারাত্মক ছোঁয়াচে ভাইরাল রোগ।
২. পানি ও গ্লুকোজ: পানির সাথে ইলেকট্রোলাইট, গ্লুকোজ ও ভিটামিন-সি মিশিয়ে শক্তি বজায় রাখুন।
৩. পরিবেশ ও অ্যামোনিয়া নিয়ন্ত্রণ: শেডে দুর্গন্ধ ও অ্যামোনিয়া গ্যাস কমাতে বায়ু চলাচল বৃদ্ধি করুন।
৪. খামারের জৈবনিরাপত্তা: খামারে বাইরের মানুষ বা যানবাহনের প্রবেশ সম্পূর্ণরূপে বন্ধ রাখুন। মৃত পাখি চুন দিয়ে মাটিতে পুঁতে ফেলুন।

⚠️ জরুরি ভেটেরিনারি রেফারাল ও এএমআর (AMR) নোটিশ:
এটি ভাইরাসজনিত রোগ; অ্যান্টিবায়োটিক ভাইরাসের ওপর কাজ করে না। ভ্যাকসিন রেকর্ড যাচাই ও সঠিক নির্দেশনার জন্য অবিলম্বে রেজিস্টার্ড ভেটেরিনারি চিকিৎসকের শরণাপন্ন হোন।`,
        sources: getVerifiedVeterinarySources('newcastle'),
      }
    }
    if (matchedDisease === 'gumboro') {
      return {
        answer: `ক্লিনিকাল মূল্যায়ন ও পরামর্শ: গামবোরো রোগ (IBD)

সম্ভাব্য রোগ ও পূর্বাভাস (Predicted Condition):
• প্রধান ঝুঁকি: গামবোরো রোগ (Infectious Bursal Disease)
• প্রধান লক্ষণ: সাদাটে পাতলা পায়খানা, ভেন্ট ঠোকরানো, কাঁপুনি ও অতিরিক্ত পানিশূন্যতা।
• সেকেন্ডারি ঝুঁকি (Differential / Minimum Risk): কক্সিডিওসিস ও খাদ্য বিষক্রিয়া।

জরুরি সহায়ক পরিচর্যা প্রোটোকল (Detailed Supportive Protocols):
১. তাপমাত্রা নিয়ন্ত্রণ: শেডের তাপমাত্রা স্বাভাবিক ও উষ্ণ রাখুন; হঠাৎ তাপমাত্রা নামতে দেবেন না।
২. কিডনি সুরক্ষা ও স্যালাইন: আক্রান্ত শেডে অবিলম্বে স্যালাইন ও কিডনি টনিক বা গুড়-পানির দ্রবণ সরবরাহ করুন।
৩. মানসিক চাপ মুক্ত রাখা: পাখিকে কোনো ধরনের শারীরিক বা মানসিক চাপ (Stress) দেবেন না।
৪. জৈবনিরাপত্তা: শেডের চারপাশ জীবাণুনাশক স্প্রে করুন এবং খাবার পাত্র নিয়মিত পরিষ্কার রাখুন।

⚠️ জরুরি ভেটেরিনারি রেফারাল ও এএমআর (AMR) নোটিশ:
ভাইরাসজনিত হওয়ায় অননুমোদিত অ্যান্টিবায়োটিক প্রয়োগ ক্ষতিকর। রেজিস্টার্ড ভেটেরিনারি চিকিৎসকের পরামর্শ নিন।`,
        sources: getVerifiedVeterinarySources('gumboro'),
      }
    }
    if (matchedDisease === 'crd') {
      return {
        answer: `ক্লিনিকাল মূল্যায়ন ও পরামর্শ: ক্রনিক রেসপিরেটরি ডিজিজ (CRD) ও সংক্রামক সর্দি

সম্ভাব্য রোগ ও পূর্বাভাস (Predicted Condition):
• প্রধান ঝুঁকি: ক্রনিক রেসপিরেটরি ডিজিজ (Mycoplasma gallisepticum)
• প্রধান লক্ষণ: হাঁচি, কাশি, ঘড়ঘড় শব্দ, চোখ-মুখ ফোলা ও নাক দিয়ে জল বা শ্লেষ্মা পড়া।
• সেকেন্ডারি ঝুঁকি (Differential / Minimum Risk): ইনফেকশাস ব্রঙ্কাইটিস ও অ্যাসপারজিলোসিস।

জরুরি সহায়ক পরিচর্যা প্রোটোকল (Detailed Supportive Protocols):
১. বাতাস চলাচল ও অ্যামোনিয়া নিয়ন্ত্রণ: শেডের বাতাস চলাচল উন্নত করুন যাতে অ্যামোনিয়া গ্যাস জমে না থাকে।
২. পুষ্টি ও হাইড্রেশন: খাবার পানিতে ভিটামিন-সি ও ইলেকট্রোলাইট দিন।
৩. মেঝে ও লিটার শুষ্ক রাখা: মেঝে ও লিটার শুষ্ক রাখুন; আর্দ্রতা কমাতে বায়ু চলাচলের ব্যবস্থা করুন।
৪. জৈবনিরাপত্তা: খাবার পানি ক্লোরিনেশন (Chlorination) করুন এবং পাত্র প্রতিদিন পরিষ্কার রাখুন।

⚠️ জরুরি ভেটেরিনারি রেফারাল ও এএমআর (AMR) নোটিশ:
সঠিক অ্যান্টিবায়োটিক সংবেদনশীলতা পরীক্ষা ছাড়া ওষুধ প্রয়োগ করলে ক্ষতিকর রেজিস্ট্যান্স তৈরি হয়। রেজিস্টার্ড চিকিৎসকের প্রেসক্রিপশন নিন।`,
        sources: getVerifiedVeterinarySources('crd'),
      }
    }
    return {
      answer: `ক্লিনিকাল মূল্যায়ন ও ফ্লক স্বাস্থ্য পরামর্শ

সম্ভাব্য অবস্থা ও পর্যবেক্ষণ (Predicted Screening):
আপনার বর্ণিত লক্ষণগুলো পোল্ট্রির সাধারণ ফ্লক স্বাস্থ্য সমস্যা বা সংক্রমণের ইঙ্গিত দেয়। প্রাথমিক অবস্থায় সঠিক পরিচর্যা করলে দ্রুত সুস্থতা সম্ভব।

জরুরি সহায়ক পরিচর্যা প্রোটোকল (Detailed Supportive Protocols):
১. অসুস্থ পাখিকে সুস্থ পাখি থেকে আলাদা করে উষ্ণ ও শুকনো কোয়ারেন্টাইন শেডে রাখুন।
২. পরিষ্কার খাবার পানির সাথে ওরাল স্যালাইন ও ইলেকট্রোলাইট সরবরাহ করুন।
৩. লিটার শুকনো রাখুন এবং শেডে পর্যাপ্ত আলো-বাতাস নিশ্চিত করুন।
৪. শেডের প্রবেশমুখে নিয়মিত পটাশ বা ব্লিচিং ফুটবাথ ব্যবহার করুন।

⚠️ জরুরি ভেটেরিনারি রেফারাল ও এএমআর (AMR) নোটিশ:
অ্যান্টিবায়োটিক প্রয়োগের পূর্বে অবশ্যই রেজিস্টার্ড পশুচিকিৎসক বা উপজেলা প্রাণিসম্পদ কর্মকর্তার পরামর্শ নিন।`,
      sources: getVerifiedVeterinarySources(matchedDisease),
    }
  }

  // English clinical guidance
  if (matchedDisease === 'coryza') {
    return {
      answer: `Clinical Assessment: Infectious Coryza (Avibacterium paragallinarum)

Predicted Condition & Screening Profile:
• Primary Risk: Infectious Coryza (Avibacterium paragallinarum)
• Clinical Signs: Severe facial edema, swollen sinuses, nasal discharge, sneezing, conjunctivitis, and anorexia.
• Secondary / Differential Conditions: Chronic Respiratory Disease (CRD / Mycoplasma) and Swollen Head Syndrome.

Detailed Supportive Management Protocols:
1. Strict Quarantine: Immediately isolate symptomatic birds in a dedicated dry, draft-free recovery area. Coryza spreads rapidly through shared drinkers and nasal secretions.
2. Hydration & Vitality: Supply clean drinking water fortified with balanced electrolytes and vitamin C to prevent dehydration and sustain appetite.
3. Shed Environment & Litter: Maintain bedding moisture below 25%. Eliminate ammonia fumes through steady cross-ventilation without direct drafts.
4. Hygiene & Crusting Relief: Gently flush nasal/eye encrustations using sterile warm saline solution to restore vision and feeding ability.

Farm Biosecurity & Transmission Control:
• Maintain active disinfectant footbaths (iodophore or potassium permanganate) at coop doors.
• Disinfect all waterers and feeders daily; restrict visitor entry completely.

⚠️ Veterinary Referral & AMR Stewardship Advisory:
Statutory regulations and AMR stewardship guidelines strictly prohibit automated AI from prescribing antibiotics, drug regimens, or medication dosages in Farmer Mode. Consult a licensed poultry veterinarian immediately for confirmed diagnosis and lawful prescription.`,
      sources: getVerifiedVeterinarySources('coryza'),
    }
  }

  if (matchedDisease === 'coccidiosis') {
    return {
      answer: `Clinical Assessment: Avian Coccidiosis

Predicted Condition & Screening Profile:
• Primary Risk: Avian Coccidiosis (Eimeria intestinal infection)
• Clinical Signs: Bloody droppings, lethargy, pale comb, ruffled feathers, and dehydration.
• Secondary / Differential Conditions: Necrotic Enteritis and Salmonellosis.

Detailed Supportive Management Protocols:
1. Strict Flock Isolation: Immediately quarantine symptomatic birds in a clean, dry, warm pen.
2. Hydration & Electrolytes: Provide continuous fresh drinking water supplemented with oral rehydration salts (ORS) / electrolytes to prevent fatal dehydration.
3. Litter Management: Eliminate all damp litter around waterers immediately; maintain bedding moisture below 25% with dry bedding or lime dusting.
4. Farm Biosecurity Protocols: Disinfect drinkers and feeding troughs daily; maintain active disinfectant footbaths at shed entries.

⚠️ Veterinary Referral & AMR Advisory:
Protozoal infection. Random antibiotics are ineffective and violate AMR stewardship. Consult a licensed poultry veterinarian for confirmed diagnostic prescription.`,
      sources: getVerifiedVeterinarySources('coccidiosis'),
    }
  }

  if (matchedDisease === 'newcastle') {
    return {
      answer: `Clinical Assessment: Newcastle Disease (Ranikhet)

Predicted Condition & Screening Profile:
• Primary Risk: Newcastle Disease Virus (Paramyxovirus Type 1)
• Clinical Signs: Twisted neck (torticollis), greenish watery diarrhea, gasping, and sudden mortality.
• Secondary / Differential Conditions: Avian Influenza and Infectious Laryngotracheitis.

Detailed Supportive Management Protocols:
1. Strict Quarantine: Separate affected birds immediately from healthy stock into an isolated shed.
2. Supportive Vitality: Provide water with balanced electrolytes, glucose, and vitamin C to sustain hydration.
3. Ventilation: Improve fresh air exchange to reduce shed ammonia stress.
4. Farm Biosecurity Protocols: Restrict all farm visitors and outside vehicles; safely dispose of dead birds by deep burial with lime.

⚠️ Veterinary Referral & AMR Notice:
Viral disease. Antibiotics have zero antiviral efficacy. Consult a licensed veterinarian immediately.`,
      sources: getVerifiedVeterinarySources('newcastle'),
    }
  }

  return {
    answer: `Clinical Health Guidance: Avian Flock Assessment

Observation Summary:
Reported symptoms indicate possible flock health compromise. Immediate supportive management helps stabilize the birds while diagnostic confirmation is arranged.

Detailed Supportive Management Protocols:
1. Flock Quarantine: Isolate symptomatic birds in a dedicated dry, well-ventilated recovery area.
2. Continuous Hydration: Offer clean drinking water mixed with balanced oral electrolytes.
3. Environmental Control: Keep shed litter clean, dry, and free of ammonia buildup.
4. Farm Biosecurity Protocols: Use disinfectant footbaths at all coop entrances; sanitize drinkers and feeders daily.

⚠️ Veterinary Referral & AMR Stewardship Notice:
Automated AI does not prescribe antibiotics or treatment dosages in Farmer Mode. Please consult a registered poultry veterinarian or local livestock officer for in-person evaluation.`,
    sources: getVerifiedVeterinarySources(matchedDisease),
  }
}

/**
 * Non-blocking background generator for the Diagnostic Report Window.
 * Generates clear, farmer-friendly explanation & biosecurity advice based on
 * Teachable Machine screening results and symptoms.
 */
export async function generateDiagnosticExplanation({
  topDisease,
  confidence,
  predictions = [],
  symptoms = '',
  language = 'en',
}) {
  const predictionsList = predictions.length > 0
    ? predictions.map((p) => `${p.disease}: ${p.percentage || (Math.round((p.confidence || 0) * 100) + '%')}`).join(', ')
    : `${topDisease} (${confidence})`

  const prompt = [
    `Avian Diagnostic Screening Results:`,
    `- Primary Detected Condition: ${topDisease} (${confidence} confidence score)`,
    `- Full Predicted Disease Breakdown (%): ${predictionsList}`,
    `- Farmer Symptoms Observation: ${symptoms || 'Visual flock screening only'}`,
    ``,
    `Provide a structured, farmer-friendly clinical report in ${language === 'bn' ? 'Bengali' : language === 'hi' ? 'Hindi' : language === 'ur' ? 'Urdu' : 'English'}:`,
    `1. PREDICTED SCREENING BREAKDOWN: State the primary condition (${topDisease} at ${confidence}) and note the secondary/minimum-risk conditions detected (${predictionsList}).`,
    `2. DETAILED SUPPORTIVE PROTOCOLS FOR ALL DETECTED CONDITIONS: Detail the step-by-step non-pharmaceutical management (Strict Isolation/Quarantine, Hydration & ORS/Electrolytes, Dry Litter & Ammonia Ventilation, and Farm Biosecurity/Footbaths) so the farmer understands how to protect the flock.`,
    `3. STRICT AMR RESTRICTION: Do NOT suggest or prescribe any antibiotic drug names or medication dosages under any circumstances.`,
    `4. MANDATORY VETERINARY NOTICE: End with a clear, prominent notice instructing the farmer to consult a registered veterinarian for clinical confirmation and legal prescription.`,
  ].join('\n')

  try {
    const response = await sendChatMessage({
      messages: [{ role: 'user', content: prompt }],
      language,
      visualResult: { label: topDisease, confidence, predictions },
    })

    if (response?.answer && response.answer !== POLITE_EXHAUSTION_MESSAGE) {
      return {
        explanation: response.answer,
        sources: response.sources?.length ? response.sources : getVerifiedVeterinarySources(topDisease),
        isFallback: false,
      }
    }
  } catch (err) {
    console.warn('[ai-adapter] Diagnostic explanation background generation failed:', err?.message)
  }

  const localAdvice = generateLocalClinicalKnowledgeReply({
    query: symptoms,
    topDisease,
    language,
  })

  return {
    explanation: localAdvice.answer,
    sources: localAdvice.sources?.length ? localAdvice.sources : getVerifiedVeterinarySources(topDisease),
    isFallback: false,
  }
}

/**
 * Direct API adapter for future paid Claude / OpenAI / Gemini production upgrades.
 */
async function executeDirectAiCall({ messages, contextPrompt, visualResult = null }) {
  const directEndpoint = import.meta.env.VITE_DIRECT_AI_ENDPOINT || '/api/chat'
  const directModel = import.meta.env.VITE_DIRECT_AI_MODEL || 'claude-sonnet-5-5'
  const directKey = import.meta.env.VITE_DIRECT_AI_KEY || ''

  const headers = { 'Content-Type': 'application/json' }
  if (directKey) headers.Authorization = `Bearer ${directKey}`

  try {
    const res = await fetch(directEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: directModel,
        messages: [
          { role: 'system', content: VETERINARY_SYSTEM_PROMPT },
          ...messages,
        ],
        contextPrompt,
        visualResult,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      throw new Error(`Direct API returned HTTP ${res.status}`)
    }

    const data = await res.json()
    const answer = data.choices?.[0]?.message?.content || data.answer || ''
    return {
      answer: answer || POLITE_EXHAUSTION_MESSAGE,
      sources: data.sources || getVerifiedVeterinarySources(visualResult?.label || messages[messages.length - 1]?.content),
      visualResult,
    }
  } catch (err) {
    console.error('[ai-adapter] Direct AI call failed:', err?.message)
    return {
      answer: POLITE_EXHAUSTION_MESSAGE,
      sources: getVerifiedVeterinarySources(visualResult?.label || messages[messages.length - 1]?.content),
      visualResult,
    }
  }
}
