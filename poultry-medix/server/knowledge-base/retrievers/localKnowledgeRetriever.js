import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, '..', 'data')

let drugsCache = null
let pathogensCache = null

function loadJsonSafe(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    console.error(`[knowledge-base] Failed to read ${filePath}:`, error?.message)
    return null
  }
}

export function getLocalDrugDatabase() {
  if (!drugsCache) {
    const data = loadJsonSafe(path.join(dataDir, 'veterinary-drugs.json'))
    drugsCache = data?.drugs || []
  }
  return drugsCache
}

export function getLocalPathogenDatabase() {
  if (!pathogensCache) {
    const data = loadJsonSafe(path.join(dataDir, 'poultry-pathogens.json'))
    pathogensCache = data?.pathogens || []
  }
  return pathogensCache
}

/**
 * Searches local verified veterinary drugs, regulations, and withdrawal periods.
 */
export function queryLocalDrugKnowledge(searchTerm) {
  if (!searchTerm) return []
  const normalized = searchTerm.toLowerCase().trim()
  const tokens = normalized.split(/\s+/).filter((token) => token.length > 2)
  const drugs = getLocalDrugDatabase()

  return drugs.filter((drug) => {
    const dName = drug.genericName.toLowerCase()
    const dClass = drug.class.toLowerCase()
    const dIndications = (drug.indications || '').toLowerCase()
    const directMatch = dName.includes(normalized) || dClass.includes(normalized) || dIndications.includes(normalized)
    const tokenMatch = tokens.some((token) => dName.includes(token) || dClass.includes(token) || dIndications.includes(token))
    return directMatch || tokenMatch
  })
}

/**
 * Searches local differential pathogen profiles by symptom or name.
 */
export function queryLocalPathogenKnowledge(searchTerm) {
  if (!searchTerm) return []
  const normalized = searchTerm.toLowerCase().trim()
  const tokens = normalized.split(/\s+/).filter((token) => token.length > 2)
  const pathogens = getLocalPathogenDatabase()

  return pathogens.filter((pathogen) => {
    const pName = pathogen.name.toLowerCase()
    const signs = pathogen.clinicalSigns.map((sign) => sign.toLowerCase()).join(' ')
    const directMatch = pName.includes(normalized) || signs.includes(normalized)
    const tokenMatch = tokens.some((token) => pName.includes(token) || signs.includes(token))
    return directMatch || tokenMatch
  })
}
