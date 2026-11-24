# PoultryMedix Verified Veterinary Knowledge Base & RAG Layer

This isolated module houses the curated veterinary knowledge base, scientific literature retrievers, and anti-hallucination reasoning guardrails for **PoultryMedix**.

## Directory Structure
- `data/`
  - `veterinary-drugs.json`: Curated local antimicrobial and antiparasitic registry, legal status, local/international withdrawal periods (meat/egg withholding), and national DGDA/DLS AMR restrictions (e.g. Colistin ban).
  - `poultry-pathogens.json`: Differential clinical profiles, transmission vectors, notifiable status, biosecurity steps, and AMR relevance.
- `retrievers/`
  - `localKnowledgeRetriever.js`: In-memory query matcher against verified local datasets and guidelines.
  - `literatureRetriever.js`: Live REST client querying PubMed (NCBI eUtils) and Europe PMC with timeout and fallback protection.
- `guardrails/`
  - `clinicalSafetyGuardrail.js`: Intercepts and blocks unauthorized automated drug suggestions, prescription names, dosages, or treatment procedures from farmers, mandating registered veterinary consultation.
  - `systemPrompts.js`: Evidence-grounded system prompts configured for Claude, OpenAI, and Gemini APIs.
- `index.js`: Unified entry point exposing `queryVeterinaryKnowledge` and safety utilities.
