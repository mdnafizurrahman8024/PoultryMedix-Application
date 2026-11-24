import { searchEuropePmcArticles, searchPubMedArticles } from './retrievers/literatureRetriever.js'
import {
  getLocalDrugDatabase,
  getLocalPathogenDatabase,
  queryLocalDrugKnowledge,
  queryLocalPathogenKnowledge,
} from './retrievers/localKnowledgeRetriever.js'
import {
  generatePrescriptionSafetyResponse,
  isPrescriptionOrDoseRequest,
} from './guardrails/clinicalSafetyGuardrail.js'
import {
  VETERINARY_EVIDENCE_SYSTEM_PROMPT,
  getProviderSystemPrompt,
} from './guardrails/systemPrompts.js'

/**
 * Unified Knowledge Base & Evidence-Grounded RAG Service.
 */
export async function queryVeterinaryKnowledge({ query, language = 'en', includeLiterature = true }) {
  // Step 1: Safety check against unauthorized treatment/prescription queries
  if (isPrescriptionOrDoseRequest(query)) {
    return generatePrescriptionSafetyResponse(language)
  }

  // Step 2: Query local verified knowledge base
  const localDrugs = queryLocalDrugKnowledge(query)
  const localPathogens = queryLocalPathogenKnowledge(query)

  // Step 3: Query scientific literature if requested
  let literature = []
  if (includeLiterature) {
    const [pubmed, europePmc] = await Promise.all([
      searchPubMedArticles(query, 2),
      searchEuropePmcArticles(query, 1),
    ])
    literature = [...pubmed, ...europePmc]
  }

  return {
    blocked: false,
    query,
    results: {
      localDrugs,
      localPathogens,
      literature,
    },
    systemPrompt: getProviderSystemPrompt(),
  }
}

export {
  searchPubMedArticles,
  searchEuropePmcArticles,
  getLocalDrugDatabase,
  getLocalPathogenDatabase,
  queryLocalDrugKnowledge,
  queryLocalPathogenKnowledge,
  isPrescriptionOrDoseRequest,
  generatePrescriptionSafetyResponse,
  VETERINARY_EVIDENCE_SYSTEM_PROMPT,
}
