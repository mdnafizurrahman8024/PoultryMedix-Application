/**
 * Real-Time National One-Health Epidemiology, Zoonotic & AMR Analytics Engine
 *
 * Aggregates diagnostic, prescription, and Field/ULO surveillance data from
 * 3 verified sources (Govt. ULO Hospitals, BVC Registered Vets, Farmer AI Logs)
 * to power dynamic Outbreak Maps, Zoonotic Alerts, and WHO AWaRe Analytics.
 */

import { getClinicalLogs } from './clinicalLogsStore.js'
import {
  BASELINE_SURVEILLANCE_RECORDS,
  SURVEILLANCE_ANTIBIOTICS,
  getZoonoticInfo,
  normalizeReporterSource,
} from './oneHealthSurveillance.js'

export const ANALYTICS_UPDATED_EVENT = 'poultrymedix-analytics-updated'
export const PRESCRIPTION_DATA_CHANGED_EVENT = 'poultrymedix-prescriptions-updated'

export const prescriptionStorageKeys = {
  home: 'poultrymedix_home_prescriptions',
  consult: 'poultrymedix_vet_prescriptions',
}

// Bangladesh District Geolocation Coordinates [Latitude, Longitude]
export const BANGLADESH_DISTRICT_COORDINATES = {
  Rajshahi: [24.3745, 88.6042],
  Bogura: [24.8481, 89.372],
  Bogra: [24.8481, 89.372],
  Gazipur: [24.0958, 90.4125],
  Mymensingh: [24.7471, 90.4203],
  Cumilla: [23.4607, 91.1809],
  Comilla: [23.4607, 91.1809],
  Dhaka: [23.8103, 90.4125],
  Chattogram: [22.3569, 91.7832],
  Chittagong: [22.3569, 91.7832],
  Sylhet: [24.8949, 91.8687],
  Khulna: [22.8456, 89.5403],
  Barishal: [22.701, 90.3535],
  Barisal: [22.701, 90.3535],
  Rangpur: [25.7439, 89.2752],
  "Cox's Bazar": [21.4272, 92.0058],
  Jashore: [23.1664, 89.2081],
  Jessore: [23.1664, 89.2081],
  Dinajpur: [25.6217, 88.6355],
  Pabna: [24.0064, 89.2372],
  Tangail: [24.2513, 89.9167],
  Kishoreganj: [24.4449, 90.7766],
  Faridpur: [23.6071, 89.8429],
  Narayanganj: [23.6238, 90.5],
  Brahmanbaria: [23.9571, 91.1119],
  Noakhali: [22.8696, 91.0995],
  Sirajganj: [24.4534, 89.7008],
  Natore: [24.4206, 88.9324],
  Kushtia: [23.9013, 89.1205],
}

export const BASELINE_OUTBREAK_SEEDS = [
  { name: 'Rajshahi', coordinates: [24.3745, 88.6042], disease: 'Avian Influenza', baselineCases: 18, risk: 'High AMR risk' },
  { name: 'Mymensingh', coordinates: [24.7471, 90.4203], disease: 'Coccidiosis', baselineCases: 16, risk: 'Elevated AMR risk' },
  { name: 'Bogura', coordinates: [24.8481, 89.372], disease: 'Newcastle / Ranikhet', baselineCases: 14, risk: 'Elevated AMR risk' },
  { name: 'Chattogram', coordinates: [22.3569, 91.7832], disease: 'Salmonellosis', baselineCases: 14, risk: 'High AMR risk' },
  { name: 'Gazipur', coordinates: [24.0958, 90.4125], disease: 'Gumboro', baselineCases: 13, risk: 'Elevated AMR risk' },
  { name: 'Pabna', coordinates: [24.0064, 89.2372], disease: 'Infectious Coryza', baselineCases: 11, risk: 'Elevated AMR risk' },
  { name: 'Cumilla', coordinates: [23.4607, 91.1809], disease: 'Fowl Cholera', baselineCases: 10, risk: 'Elevated AMR risk' },
  { name: 'Rangpur', coordinates: [25.7439, 89.2752], disease: 'Campylobacteriosis', baselineCases: 9, risk: 'High AMR risk' },
]

// Baseline Prescription Seeds across verified sources
const homeSeed = [
  ['Gazipur', 'Tetracyclines', 'Doxycycline', 'Doxy-A Vet', 'ACME Laboratories Ltd.', '3rd Gen', 'Watch', 'Elevated AMR risk', '7 days', '5 days', 5],
  ['Bogura', 'Tetracyclines', 'Doxycycline', 'Respiron Vet', 'Eskayef / SK+F', '3rd Gen', 'Watch', 'Elevated AMR risk', '7 days', '5 days', 4],
  ['Chattogram', 'Tetracyclines', 'Doxycycline', 'Doxyvet', 'Square Pharmaceuticals PLC', '3rd Gen', 'Watch', 'Elevated AMR risk', '7 days', '5 days', 4],
  ['Mymensingh', 'Tetracyclines', 'Doxycycline', 'Doxy-A Vet', 'ACME Laboratories Ltd.', '2nd Gen', 'Watch', 'Moderate AMR risk', '7 days', '5 days', 5],
  ['Rangpur', 'Tetracyclines', 'Oxytetracycline', 'Renamycin Vet', 'Renata PLC', '2nd Gen', 'Access', 'Moderate AMR risk', '5 days', '3 days', 3],
  ['Cumilla', 'Sulfonamides', 'Sulfadiazine + Trimethoprim', 'Cosumix Plus', 'Elanco / Renata', '2nd Gen', 'Access', 'Moderate AMR risk', '7 days', 'Not for layers', 3],
]

const consultSeed = [
  ['Rajshahi', 'Beta-lactams / Cephalosporins', 'Amoxicillin', 'Moxacil Vet', 'Square Pharmaceuticals PLC', '2nd Gen', 'Access', 'Low / Monitored AMR risk', '3 days', '1 day', 6],
  ['Bogura', 'Fluoroquinolones', 'Ciprofloxacin', 'Ciprocin Vet', 'Square Pharmaceuticals PLC', '2nd Gen', 'Watch', 'High AMR risk', '10 days', '7 days', 5],
  ['Gazipur', 'Macrolides', 'Tylosin', 'Tylovet', 'ACME Laboratories Ltd.', '2nd Gen', 'Watch', 'Moderate AMR risk', '5 days', '3 days', 4],
  ['Mymensingh', 'Sulfonamides', 'Sulfadiazine + Trimethoprim', 'Sulpha-3 Vet', 'Eon Animal Health', '2nd Gen', 'Access', 'Moderate AMR risk', '7 days', 'Not for layers', 5],
  ['Pabna', 'Macrolides', 'Tylosin', 'Tylo-Vet', 'Renata PLC', '2nd Gen', 'Watch', 'Moderate AMR risk', '5 days', '3 days', 4],
  ['Rangpur', 'Beta-lactams / Cephalosporins', 'Amoxicillin', 'Renamox', 'Renata PLC', '2nd Gen', 'Access', 'Low / Monitored AMR risk', '3 days', '1 day', 3],
]

const ULO_TRADE_MAP = {
  'Sulfadiazine + Trimethoprim': { tradeName: 'Cotrim-Vet (Govt. Formulary)', company: 'DLS Approved Supply' },
  Enrofloxacin: { tradeName: 'Enrocin / Enrovet (AST Guided)', company: 'Techno Drugs Ltd.' },
  Oxytetracycline: { tradeName: 'Renamycin Vet', company: 'Renata PLC' },
  Tylosin: { tradeName: 'Tylovet', company: 'ACME Laboratories Ltd.' },
  Amoxicillin: { tradeName: 'Moxacil Vet', company: 'Square Pharmaceuticals PLC' },
  Doxycycline: { tradeName: 'Doxy-A Vet', company: 'ACME Laboratories Ltd.' },
  Ciprofloxacin: { tradeName: 'Ciprocin Vet', company: 'Square Pharmaceuticals PLC' },
}

const antibioticMetaMap = new Map(SURVEILLANCE_ANTIBIOTICS.map((item) => [item.name.toLowerCase(), item]))

function buildUloSeed() {
  return BASELINE_SURVEILLANCE_RECORDS
    .filter((rec) => rec.reporterRole === 'ulo_hospital' && rec.antibioticPrescribed !== 'None / Supportive Only')
    .map((rec) => {
      const meta = antibioticMetaMap.get(rec.antibioticPrescribed.toLowerCase()) || {}
      const tradeMeta = ULO_TRADE_MAP[rec.antibioticPrescribed] || {
        tradeName: rec.antibioticPrescribed,
        company: 'DLS Veterinary Formulary',
      }
      const { aware, risk } = inferWhoAwareCategory(rec.antibioticPrescribed, meta.generation || '2nd Gen')
      return {
        id: `seed-ulo-${rec.id}`,
        source: 'ulo_hospital',
        district: rec.district,
        className: meta.className || inferAntibioticClass(rec.antibioticPrescribed),
        generic: rec.antibioticPrescribed,
        tradeName: tradeMeta.tradeName,
        company: tradeMeta.company,
        generation: meta.generation || '2nd Gen',
        aware: meta.aware || aware,
        risk: meta.restricted ? 'Critical AMR risk' : risk,
        meatDays: meta.meatDays || '7 days',
        eggDays: meta.eggDays || '5 days',
        quantity: rec.cases || 1,
      }
    })
}

function formatSeed(source, [district, className, generic, tradeName, company, generation, aware, risk, meatDays, eggDays, quantity]) {
  return {
    id: `seed-${source}-${district}-${generic}-${tradeName}`,
    source,
    district,
    className,
    generic,
    tradeName,
    company,
    generation: generation || '2nd Gen',
    aware: aware || (generation === '3rd Gen' ? 'Watch' : 'Access'),
    risk: risk || (generation === '3rd Gen' ? 'High AMR risk' : 'Moderate AMR risk'),
    meatDays: meatDays || '7 days',
    eggDays: eggDays || '5 days',
    quantity: Number(quantity) || 1,
  }
}

export const defaultPrescriptionSeeds = {
  home: homeSeed.map((row) => formatSeed('farmer_ai', row)),
  consult: consultSeed.map((row) => formatSeed('bvc_vet', row)),
  ulo: buildUloSeed(),
}

function resolveCoordinates(rawDistrict) {
  const cleaned = String(rawDistrict || 'Rajshahi').trim()
  return BANGLADESH_DISTRICT_COORDINATES[cleaned]
    || Object.entries(BANGLADESH_DISTRICT_COORDINATES).find(([k]) => k.toLowerCase() === cleaned.toLowerCase())?.[1]
    || [23.685, 90.3563]
}

export function calculateSeverity(totalCases, hasCriticalZoonotic = false) {
  if (totalCases >= 15 || hasCriticalZoonotic) {
    return { severity: 'Critical', color: '#dc2626', risk: 'High AMR risk' }
  }
  if (totalCases >= 5) return { severity: 'High', color: '#ea580c', risk: 'Elevated AMR risk' }
  if (totalCases >= 2) return { severity: 'Moderate', color: '#d97706', risk: 'Moderate AMR risk' }
  return { severity: 'Watch', color: '#3b82f6', risk: 'Low / Monitored AMR risk' }
}

export function inferAntibioticClass(genericName) {
  const name = String(genericName || '').toLowerCase()
  if (name.includes('doxy') || name.includes('oxy') || name.includes('tetra')) return 'Tetracyclines'
  if (name.includes('amox') || name.includes('amp') || name.includes('cef') || name.includes('penicillin')) return 'Beta-lactams / Cephalosporins'
  if (name.includes('cipro') || name.includes('enro') || name.includes('flox') || name.includes('levo')) return 'Fluoroquinolones'
  if (name.includes('tylo') || name.includes('erythro') || name.includes('azithro')) return 'Macrolides'
  if (name.includes('colistin') || name.includes('polymyxin')) return 'Polymyxins'
  if (name.includes('sulfa') || name.includes('trimethoprim') || name.includes('cotrim')) return 'Sulfonamides'
  if (name.includes('genta') || name.includes('neomycin') || name.includes('strepto')) return 'Aminoglycosides'
  return 'Other antibiotics'
}

export function inferWhoAwareCategory(genericName, generation = '') {
  const name = String(genericName || '').toLowerCase()
  const gen = String(generation || '').toLowerCase()

  if (name.includes('colistin') || name.includes('fosfomycin') || name.includes('linezolid')) {
    return { aware: 'Reserve', risk: 'Critical AMR risk' }
  }
  if (
    name.includes('cipro') || name.includes('enro') || name.includes('flox')
    || name.includes('cef') || name.includes('tylo') || name.includes('erythro')
    || name.includes('azithro') || name.includes('neomycin') || gen.includes('3rd') || gen.includes('4th')
  ) {
    return { aware: 'Watch', risk: 'High AMR risk' }
  }
  return { aware: 'Access', risk: 'Moderate AMR risk' }
}

function getAllSurveillanceAndDiagnosticEvents() {
  const events = BASELINE_SURVEILLANCE_RECORDS.map((seed) => ({
    ...seed,
    isLive: false,
    zoonotic: getZoonoticInfo(seed.disease),
  }))

  const diagnosisLogs = getClinicalLogs('diagnosis')
  diagnosisLogs.forEach((log) => {
    const disease = log.primaryDisease || 'Clinical Screening'
    events.push({
      id: log.id,
      district: (log.district || 'Rajshahi').trim(),
      upazila: (log.upazila || '').trim(),
      reporterRole: normalizeReporterSource(log.source || log.reporterRole || 'farmer_ai'),
      reporterName: log.reporterName || 'Smart Diagnosis AI Scan',
      species: log.species || 'Poultry',
      disease,
      antibioticPrescribed: 'None / Supportive Only',
      mortalityCount: Number(log.mortalityCount) || 0,
      cases: 1,
      timestamp: log.timestamp || new Date().toISOString(),
      isLive: true,
      zoonotic: getZoonoticInfo(disease),
    })
  })

  const surveillanceLogs = getClinicalLogs('surveillance')
  surveillanceLogs.forEach((log) => {
    const disease = log.disease || log.primaryDisease || 'Clinical Screening'
    events.push({
      id: log.id,
      district: (log.district || 'Rajshahi').trim(),
      upazila: (log.upazila || '').trim(),
      reporterRole: normalizeReporterSource(log.reporterRole || log.source),
      reporterName: log.reporterName || 'Field Surveillance Officer',
      species: log.species || 'Broiler',
      disease,
      antibioticPrescribed: log.antibioticPrescribed || 'None / Supportive Only',
      mortalityCount: Number(log.mortalityCount) || 0,
      cases: 1,
      timestamp: log.timestamp || new Date().toISOString(),
      isLive: true,
      zoonotic: getZoonoticInfo(disease),
    })
  })

  return events
}

/**
 * Aggregates baseline + live multi-source outbreak data by district, including
 * top circulating diseases, source counts, mortality, and One-Health zoonotic flags.
 */
export function getLiveOutbreakDistricts() {
  const districtMap = new Map()
  const events = getAllSurveillanceAndDiagnosticEvents()
  const severityOrder = { critical: 3, high: 2, moderate: 1 }

  events.forEach((ev) => {
    const rawDistrict = ev.district || 'Rajshahi'
    const key = rawDistrict.toLowerCase()
    const caseWeight = Number(ev.cases) || 1
    const role = ev.reporterRole

    let entry = districtMap.get(key)
    if (!entry) {
      entry = {
        name: rawDistrict,
        coordinates: resolveCoordinates(rawDistrict),
        farms: 0,
        baselineCases: 0,
        liveCases: 0,
        mortalityTotal: 0,
        sourceCounts: { ulo_hospital: 0, bvc_vet: 0, farmer_ai: 0 },
        diseaseCounts: {},
        antibioticCounts: {},
        upazilas: new Set(),
        zoonoticDiseases: new Set(),
        zoonoticMaxSeverity: null,
        latestTimestamp: null,
      }
      districtMap.set(key, entry)
    }

    entry.farms += caseWeight
    if (ev.isLive) entry.liveCases += caseWeight
    else entry.baselineCases += caseWeight

    entry.mortalityTotal += Number(ev.mortalityCount) || 0
    entry.sourceCounts[role] = (entry.sourceCounts[role] || 0) + caseWeight
    entry.diseaseCounts[ev.disease] = (entry.diseaseCounts[ev.disease] || 0) + caseWeight

    if (ev.upazila) entry.upazilas.add(ev.upazila)
    if (ev.antibioticPrescribed && ev.antibioticPrescribed !== 'None / Supportive Only') {
      entry.antibioticCounts[ev.antibioticPrescribed] = (entry.antibioticCounts[ev.antibioticPrescribed] || 0) + caseWeight
    }

    if (ev.zoonotic.isZoonotic) {
      entry.zoonoticDiseases.add(ev.disease)
      const currentRank = severityOrder[entry.zoonoticMaxSeverity] || 0
      const nextRank = severityOrder[ev.zoonotic.severity] || 1
      if (nextRank > currentRank) {
        entry.zoonoticMaxSeverity = ev.zoonotic.severity
      }
    }

    if (!entry.latestTimestamp || (ev.timestamp && new Date(ev.timestamp) > new Date(entry.latestTimestamp))) {
      entry.latestTimestamp = ev.timestamp
    }
  })

  const results = Array.from(districtMap.values()).map((entry) => {
    const sortedDiseases = Object.entries(entry.diseaseCounts)
      .map(([disease, count]) => ({
        disease,
        count,
        isZoonotic: getZoonoticInfo(disease).isZoonotic,
      }))
      .sort((a, b) => b.count - a.count)

    const topDisease = sortedDiseases[0]?.disease || 'Clinical Screening'
    const antibiotics = Object.entries(entry.antibioticCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    const isZoonotic = entry.zoonoticDiseases.size > 0
    const { severity, color, risk } = calculateSeverity(entry.farms, entry.zoonoticMaxSeverity === 'critical')

    return {
      name: entry.name,
      coordinates: entry.coordinates,
      disease: topDisease,
      topDiseases: sortedDiseases,
      farms: entry.farms,
      baselineCases: entry.baselineCases,
      liveCases: entry.liveCases,
      mortalityTotal: entry.mortalityTotal,
      sourceCounts: entry.sourceCounts,
      upazilas: Array.from(entry.upazilas),
      antibiotics,
      isZoonotic,
      zoonoticDiseases: Array.from(entry.zoonoticDiseases),
      zoonoticMaxSeverity: entry.zoonoticMaxSeverity,
      severity,
      color,
      risk,
      latestTimestamp: entry.latestTimestamp,
      diseaseCounts: entry.diseaseCounts,
    }
  })

  results.sort((a, b) => {
    if (a.isZoonotic !== b.isZoonotic) return a.isZoonotic ? -1 : 1
    return b.farms - a.farms
  })
  return results
}

/**
 * Returns nationwide or district/zoonotic-filtered One-Health analytics:
 * source-wise reporting stats, top circulating diseases, mortality, and recent feed.
 */
export function getOneHealthSurveillanceSummary(districtFilter = '', zoonoticOnly = false) {
  const allEvents = getAllSurveillanceAndDiagnosticEvents()
  const filteredEvents = allEvents.filter((ev) => {
    if (districtFilter && ev.district.toLowerCase() !== districtFilter.toLowerCase()) return false
    if (zoonoticOnly && !ev.zoonotic.isZoonotic) return false
    return true
  })

  const sourceTotals = {
    ulo_hospital: { total: 0, live: 0, percentage: 0 },
    bvc_vet: { total: 0, live: 0, percentage: 0 },
    farmer_ai: { total: 0, live: 0, percentage: 0 },
  }

  let totalCases = 0
  let liveTotalCases = 0
  let totalMortality = 0
  let zoonoticCaseCount = 0
  const activeDistricts = new Set()
  const zoonoticDistricts = new Set()
  const diseaseAgg = new Map()

  filteredEvents.forEach((ev) => {
    const count = Number(ev.cases) || 1
    const role = ev.reporterRole
    totalCases += count
    if (ev.isLive) liveTotalCases += count
    totalMortality += Number(ev.mortalityCount) || 0

    activeDistricts.add(ev.district)
    if (ev.zoonotic.isZoonotic) {
      zoonoticCaseCount += count
      zoonoticDistricts.add(ev.district)
    }

    if (sourceTotals[role]) {
      sourceTotals[role].total += count
      if (ev.isLive) sourceTotals[role].live += count
    }

    const dEntry = diseaseAgg.get(ev.disease) || {
      disease: ev.disease,
      count: 0,
      mortality: 0,
      isZoonotic: ev.zoonotic.isZoonotic,
      zoonoticSeverity: ev.zoonotic.severity,
      districts: new Set(),
    }
    dEntry.count += count
    dEntry.mortality += Number(ev.mortalityCount) || 0
    dEntry.districts.add(ev.district)
    diseaseAgg.set(ev.disease, dEntry)
  })

  Object.keys(sourceTotals).forEach((key) => {
    sourceTotals[key].percentage = totalCases > 0 ? Math.round((sourceTotals[key].total / totalCases) * 100) : 0
  })

  const topDiseases = Array.from(diseaseAgg.values())
    .map((item) => ({
      ...item,
      districts: Array.from(item.districts),
      percentage: totalCases > 0 ? Math.round((item.count / totalCases) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // Put user-submitted live reports at the top, followed by baseline surveillance feed
  const liveFeed = filteredEvents
    .filter((ev) => ev.isLive)
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
  const baselineFeed = filteredEvents
    .filter((ev) => !ev.isLive)
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))

  const recentFeed = [...liveFeed, ...baselineFeed].slice(0, 10)

  return {
    totalCases,
    liveTotalCases,
    totalMortality,
    activeDistrictCount: activeDistricts.size,
    zoonoticDistrictCount: zoonoticDistricts.size,
    zoonoticCaseCount,
    sourceStats: sourceTotals,
    topDiseases,
    recentFeed,
  }
}

/**
 * Aggregates antibiotic prescriptions and field surveillance drug logs
 * across all 3 One-Health sources and returns hierarchical Class -> Generic -> Trade -> Gen data.
 *
 * @param {'all' | 'ulo_hospital' | 'bvc_vet' | 'farmer_ai' | 'home' | 'consult'} source
 * @param {string} district
 */
export function getLiveAntibioticAnalytics(source = 'all', district = '') {
  const normalizedFilter = source === 'all'
    ? 'all'
    : source === 'home'
      ? 'farmer_ai'
      : source === 'consult'
        ? 'bvc_vet'
        : source

  const records = []

  if (normalizedFilter === 'all' || normalizedFilter === 'farmer_ai') {
    records.push(...defaultPrescriptionSeeds.home)
  }
  if (normalizedFilter === 'all' || normalizedFilter === 'bvc_vet') {
    records.push(...defaultPrescriptionSeeds.consult)
  }
  if (normalizedFilter === 'all' || normalizedFilter === 'ulo_hospital') {
    records.push(...defaultPrescriptionSeeds.ulo)
  }

  // Live Prescription logs (image scans & doctor-issued Rx)
  const prescriptionLogs = getClinicalLogs('prescription')
  prescriptionLogs.forEach((log) => {
    const logSource = normalizeReporterSource(log.source)
    if (normalizedFilter !== 'all' && logSource !== normalizedFilter) return

    const logDistrict = log.district || 'Rajshahi'
    const medications = Array.isArray(log.medications) && log.medications.length > 0
      ? log.medications
      : [
          {
            tradeName: log.tradeName || log.medicineName || 'Analyzed Medicine',
            genericName: log.genericName || log.generic || 'Doxycycline',
            antibioticClass: log.antibioticClass || log.className,
            generation: log.generation || '2nd Gen',
            whoAwareCategory: log.whoAwareCategory,
            meatWithdrawalDays: log.meatWithdrawalDays || log.withdrawalMeat,
            eggWithdrawalDays: log.eggWithdrawalDays || log.withdrawalEgg,
          },
        ]

    medications.forEach((med, idx) => {
      const generic = med.genericName || med.generic || med.name || 'Veterinary Antimicrobial'
      const className = med.antibioticClass || med.className || inferAntibioticClass(generic)
      const generation = med.generation || '2nd Gen'
      const { aware, risk } = inferWhoAwareCategory(generic, generation)

      records.push({
        id: `${log.id || 'rx'}-${idx}`,
        source: logSource,
        district: logDistrict,
        className,
        generic,
        tradeName: med.tradeName || med.name || generic,
        company: med.company || 'Veterinary Formulator',
        generation,
        aware: med.whoAwareCategory || aware,
        risk: med.risk || risk,
        meatDays: med.meatWithdrawalDays || '7 days',
        eggDays: med.eggWithdrawalDays || '5 days',
        quantity: 1,
      })
    })
  })

  // Live Field / ULO Surveillance antibiotic records
  const surveillanceLogs = getClinicalLogs('surveillance')
  surveillanceLogs.forEach((log) => {
    const drug = String(log.antibioticPrescribed || '').trim()
    if (!drug || drug === 'None / Supportive Only') return
    const logSource = normalizeReporterSource(log.reporterRole || log.source)
    if (normalizedFilter !== 'all' && logSource !== normalizedFilter) return

    const meta = antibioticMetaMap.get(drug.toLowerCase()) || {}
    const generation = meta.generation || '2nd Gen'
    const { aware, risk } = inferWhoAwareCategory(drug, generation)
    const tradeInfo = ULO_TRADE_MAP[drug] || { tradeName: drug, company: log.reporterName || 'Field / ULO Supply' }

    records.push({
      id: `surv-${log.id}`,
      source: logSource,
      district: log.district || 'Rajshahi',
      className: meta.className || inferAntibioticClass(drug),
      generic: drug,
      tradeName: tradeInfo.tradeName,
      company: tradeInfo.company,
      generation,
      aware: meta.aware || aware,
      risk: meta.restricted ? 'Critical AMR risk' : risk,
      meatDays: meta.meatDays || '7 days',
      eggDays: meta.eggDays || '5 days',
      quantity: 1,
    })
  })

  const filtered = district
    ? records.filter((r) => r.district.toLowerCase() === district.toLowerCase())
    : records

  const total = filtered.reduce((sum, r) => sum + r.quantity, 0)
  const percentage = (val) => (total > 0 ? Math.round((val / total) * 100) : 0)

  const classMap = new Map()
  const awareCounts = { Access: 0, Watch: 0, Reserve: 0 }

  filtered.forEach((record) => {
    const awareCategory = record.aware || 'Access'
    if (awareCounts[awareCategory] !== undefined) {
      awareCounts[awareCategory] += record.quantity
    } else {
      awareCounts.Watch += record.quantity
    }

    const classEntry = classMap.get(record.className) || {
      name: record.className,
      count: 0,
      generics: new Map(),
    }
    classEntry.count += record.quantity

    const genericEntry = classEntry.generics.get(record.generic) || {
      name: record.generic,
      count: 0,
      trades: new Map(),
    }
    genericEntry.count += record.quantity

    const tradeKey = `${record.tradeName} (${record.company})`
    const tradeEntry = genericEntry.trades.get(tradeKey) || {
      name: record.tradeName,
      company: record.company,
      count: 0,
      generations: new Map(),
    }
    tradeEntry.count += record.quantity

    const generationEntry = tradeEntry.generations.get(record.generation) || {
      name: record.generation,
      count: 0,
      aware: record.aware,
      risk: record.risk,
      meatDays: record.meatDays,
      eggDays: record.eggDays,
    }
    generationEntry.count += record.quantity

    tradeEntry.generations.set(record.generation, generationEntry)
    genericEntry.trades.set(tradeKey, tradeEntry)
    classEntry.generics.set(record.generic, genericEntry)
    classMap.set(record.className, classEntry)
  })

  const classes = Array.from(classMap.values())
    .map((classEntry) => ({
      ...classEntry,
      percentage: percentage(classEntry.count),
      generics: Array.from(classEntry.generics.values())
        .map((genericEntry) => ({
          ...genericEntry,
          percentage: percentage(genericEntry.count),
          trades: Array.from(genericEntry.trades.values())
            .map((tradeEntry) => ({
              ...tradeEntry,
              percentage: percentage(tradeEntry.count),
              generations: Array.from(tradeEntry.generations.values()).map((genEntry) => ({
                ...genEntry,
                percentage: tradeEntry.count ? Math.round((genEntry.count / tradeEntry.count) * 100) : 0,
              })),
            }))
            .sort((a, b) => b.count - a.count),
        }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.count - a.count)

  return {
    total,
    classes,
    awareSummary: {
      Access: { count: awareCounts.Access, percentage: percentage(awareCounts.Access) },
      Watch: { count: awareCounts.Watch, percentage: percentage(awareCounts.Watch) },
      Reserve: { count: awareCounts.Reserve, percentage: percentage(awareCounts.Reserve) },
    },
  }
}

export function notifyAnalyticsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ANALYTICS_UPDATED_EVENT))
    window.dispatchEvent(new CustomEvent(PRESCRIPTION_DATA_CHANGED_EVENT))
  }
}
