/**
 * Real-Time Epidemiology & AMR (Antimicrobial Resistance) Analytics Engine
 *
 * Connects structured diagnostic and prescription logs from clinicalLogsStore
 * with baseline surveillance data to power dynamic Outbreak Maps, District Alerts,
 * and WHO AWaRe Antibiotic Usage Hierarchies.
 */

import {
  getClinicalLogs,
  CLINICAL_LOGS_STORAGE_KEY,
  CLINICAL_LOGS_UPDATED_EVENT,
} from './clinicalLogsStore.js'

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
  'Cox\'s Bazar': [21.4272, 92.0058],
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

// Initial Baseline Epidemiological Surveillance Seeds
export const BASELINE_OUTBREAK_SEEDS = [
  { name: 'Rajshahi', coordinates: [24.3745, 88.6042], disease: 'Avian Influenza', baselineCases: 18, risk: 'High AMR risk' },
  { name: 'Bogura', coordinates: [24.8481, 89.372], disease: 'Newcastle / Ranikhet', baselineCases: 12, risk: 'Elevated AMR risk' },
  { name: 'Gazipur', coordinates: [24.0958, 90.4125], disease: 'Gumboro', baselineCases: 9, risk: 'Moderate AMR risk' },
  { name: 'Mymensingh', coordinates: [24.7471, 90.4203], disease: 'Coccidiosis', baselineCases: 15, risk: 'Elevated AMR risk' },
  { name: 'Cumilla', coordinates: [23.4607, 91.1809], disease: 'Newcastle / Ranikhet', baselineCases: 7, risk: 'Moderate AMR risk' },
]

// Baseline Prescription Seeds
const homeSeed = [
  ['Gazipur', 'Tetracyclines', 'Doxycycline', 'Doxy-A Vet', 'ACME Laboratories Ltd.', '3rd Gen', 'Watch', 'Elevated AMR risk', '7 days', '5 days', 8],
  ['Gazipur', 'Tetracyclines', 'Doxycycline', 'Respiron Vet', 'Eskayef / SK+F', '3rd Gen', 'Watch', 'Elevated AMR risk', '7 days', '5 days', 5],
  ['Bogura', 'Tetracyclines', 'Oxytetracycline', 'Renamycin Vet', 'Renata PLC', '2nd Gen', 'Access', 'Moderate AMR risk', '5 days', '3 days', 5],
  ['Rajshahi', 'Beta-lactams / Cephalosporins', 'Amoxicillin', 'Moxacil Vet', 'Square Pharmaceuticals PLC', '3rd Gen', 'Access', 'Low / Monitored AMR risk', '3 days', '1 day', 5],
  ['Mymensingh', 'Fluoroquinolones', 'Enrofloxacin', 'Enrocin', 'Techno Drugs Ltd.', '3rd Gen', 'Watch', 'High AMR risk', '10 days', '7 days', 4],
  ['Cumilla', 'Macrolides', 'Tylosin', 'Tylovet', 'ACME Laboratories Ltd.', '2nd Gen', 'Watch', 'Moderate AMR risk', '5 days', '3 days', 3],
]

const consultSeed = [
  ['Rajshahi', 'Tetracyclines', 'Doxycycline', 'Doxyvet', 'Square Pharmaceuticals PLC', '3rd Gen', 'Watch', 'Elevated AMR risk', '7 days', '5 days', 7],
  ['Bogura', 'Tetracyclines', 'Doxycycline', 'Doxy-A Vet', 'ACME Laboratories Ltd.', '2nd Gen', 'Access', 'Moderate AMR risk', '5 days', '3 days', 4],
  ['Gazipur', 'Tetracyclines', 'Oxytetracycline', 'Oxy-D Vet', 'Eon Animal Health', '2nd Gen', 'Access', 'Moderate AMR risk', '5 days', '3 days', 6],
  ['Mymensingh', 'Beta-lactams / Cephalosporins', 'Ceftiofur / Ceftriaxone', 'Tifur Vet', 'Square Pharmaceuticals PLC', '3rd Gen', 'Watch', 'High AMR risk', '8 days', 'Not for layers', 4],
  ['Cumilla', 'Beta-lactams / Cephalosporins', 'Amoxicillin', 'Renamox', 'Renata PLC', '2nd Gen', 'Access', 'Low / Monitored AMR risk', '3 days', '1 day', 4],
  ['Rajshahi', 'Fluoroquinolones', 'Ciprofloxacin', 'Ciprocin Vet', 'Square Pharmaceuticals PLC', '2nd Gen', 'Watch', 'High AMR risk', '10 days', '7 days', 5],
  ['Mymensingh', 'Fluoroquinolones', 'Enrofloxacin', 'Floxavet', 'ACME Laboratories Ltd.', '3rd Gen', 'Watch', 'High AMR risk', '10 days', '7 days', 3],
  ['Cumilla', 'Macrolides', 'Tylosin', 'Tylovet', 'Renata PLC', '2nd Gen', 'Watch', 'Moderate AMR risk', '5 days', '3 days', 4],
]

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
  home: homeSeed.map((row) => formatSeed('home', row)),
  consult: consultSeed.map((row) => formatSeed('consult', row)),
}

/**
 * Calculates severity based on case counts:
 * - >= 15: Critical
 * - >= 5: High
 * - 2 to 4: Moderate
 * - 1: Watch
 */
export function calculateSeverity(totalCases) {
  if (totalCases >= 15) return { severity: 'Critical', color: '#dc2626', risk: 'High AMR risk' }
  if (totalCases >= 5) return { severity: 'High', color: '#ea580c', risk: 'Elevated AMR risk' }
  if (totalCases >= 2) return { severity: 'Moderate', color: '#d97706', risk: 'Moderate AMR risk' }
  return { severity: 'Watch', color: '#3b82f6', risk: 'Low / Monitored AMR risk' }
}

/**
 * Infers an antibiotic class from a generic drug name.
 */
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

/**
 * Infers WHO AWaRe classification and risk from generic name and generation.
 */
export function inferWhoAwareCategory(genericName, generation = '') {
  const name = String(genericName || '').toLowerCase()
  const gen = String(generation || '').toLowerCase()

  // Reserve Category
  if (name.includes('colistin') || name.includes('fosfomycin') || name.includes('linezolid')) {
    return { aware: 'Reserve', risk: 'Critical AMR risk' }
  }

  // Watch Category
  if (
    name.includes('cipro') || name.includes('enro') || name.includes('flox') ||
    name.includes('cef') || name.includes('tylo') || name.includes('erythro') ||
    name.includes('azithro') || gen.includes('3rd') || gen.includes('4th')
  ) {
    return { aware: 'Watch', risk: 'High AMR risk' }
  }

  // Access Category
  return { aware: 'Access', risk: 'Moderate AMR risk' }
}

/**
 * Reads all diagnostic logs and aggregates them by district and primary condition,
 * dynamically merging with baseline surveillance data.
 */
export function getLiveOutbreakDistricts() {
  const districtMap = new Map()

  // 1. Populate baseline seeds
  BASELINE_OUTBREAK_SEEDS.forEach((seed) => {
    districtMap.set(seed.name.toLowerCase(), {
      name: seed.name,
      coordinates: seed.coordinates || BANGLADESH_DISTRICT_COORDINATES[seed.name] || [23.685, 90.3563],
      disease: seed.disease,
      farms: seed.baselineCases,
      baselineCases: seed.baselineCases,
      liveCases: 0,
      risk: seed.risk,
      diseaseCounts: { [seed.disease]: seed.baselineCases },
      latestTimestamp: null,
    })
  })

  // 2. Read live diagnostic logs from clinicalLogsStore
  const diagnosisLogs = getClinicalLogs('diagnosis')

  diagnosisLogs.forEach((log) => {
    const rawDistrict = (log.district || 'Rajshahi').trim()
    const districtKey = rawDistrict.toLowerCase()
    const primaryDisease = log.primaryDisease || 'Clinical Screening'

    let districtEntry = districtMap.get(districtKey)
    if (!districtEntry) {
      // Find matching coordinates or standard coordinates for Bangladesh
      const matchedCoords = BANGLADESH_DISTRICT_COORDINATES[rawDistrict] ||
        Object.entries(BANGLADESH_DISTRICT_COORDINATES).find(([k]) => k.toLowerCase() === districtKey)?.[1] ||
        [23.685, 90.3563]

      districtEntry = {
        name: rawDistrict,
        coordinates: matchedCoords,
        disease: primaryDisease,
        farms: 0,
        baselineCases: 0,
        liveCases: 0,
        risk: 'Low / Monitored AMR risk',
        diseaseCounts: {},
        latestTimestamp: null,
      }
      districtMap.set(districtKey, districtEntry)
    }

    districtEntry.farms += 1
    districtEntry.liveCases += 1
    districtEntry.diseaseCounts[primaryDisease] = (districtEntry.diseaseCounts[primaryDisease] || 0) + 1

    if (!districtEntry.latestTimestamp || (log.timestamp && new Date(log.timestamp) > new Date(districtEntry.latestTimestamp))) {
      districtEntry.latestTimestamp = log.timestamp
    }
  })

  // 3. Determine predominant disease and severity for each district
  const results = Array.from(districtMap.values()).map((district) => {
    // Determine top disease by counts
    let topDisease = district.disease
    let maxCount = -1
    Object.entries(district.diseaseCounts).forEach(([dis, count]) => {
      if (count > maxCount) {
        maxCount = count
        topDisease = dis
      }
    })

    const { severity, color, risk } = calculateSeverity(district.farms)

    return {
      name: district.name,
      coordinates: district.coordinates,
      disease: topDisease,
      farms: district.farms,
      baselineCases: district.baselineCases,
      liveCases: district.liveCases,
      severity,
      color,
      risk,
      latestTimestamp: district.latestTimestamp,
      diseaseCounts: district.diseaseCounts,
    }
  })

  // Sort by total cases descending
  results.sort((a, b) => b.farms - a.farms)
  return results
}

/**
 * Reads all prescription logs (image scans + digital prescriptions) and aggregates
 * class, generic, brand, generation, and WHO AWaRe data.
 *
 * @param {'all' | 'home' | 'consult'} source
 * @param {string} district
 */
export function getLiveAntibioticAnalytics(source = 'all', district = '') {
  const records = []

  // 1. Add baseline seeds according to selected source
  if (source === 'all' || source === 'home') {
    records.push(...defaultPrescriptionSeeds.home)
  }
  if (source === 'all' || source === 'consult') {
    records.push(...defaultPrescriptionSeeds.consult)
  }

  // 2. Read live prescription logs from clinicalLogsStore
  const prescriptionLogs = getClinicalLogs('prescription')

  prescriptionLogs.forEach((log) => {
    // Map log source: 'image_scan' -> 'home', 'vet_issued' -> 'consult'
    const logSource = (log.source === 'image_scan' || log.source === 'home') ? 'home' : 'consult'

    if (source !== 'all' && logSource !== source) {
      return
    }

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

  // 3. Filter by district if specified
  const filtered = district
    ? records.filter((r) => r.district.toLowerCase() === district.toLowerCase())
    : records

  const total = filtered.reduce((sum, r) => sum + r.quantity, 0)
  const percentage = (val) => (total > 0 ? Math.round((val / total) * 100) : 0)

  // 4. Group by Class -> Generic -> Trade Name -> Generation
  const classMap = new Map()
  const awareCounts = { Access: 0, Watch: 0, Reserve: 0 }

  filtered.forEach((record) => {
    // Tally WHO AWaRe
    const awareCategory = record.aware || 'Access'
    if (awareCounts[awareCategory] !== undefined) {
      awareCounts[awareCategory] += record.quantity
    } else {
      awareCounts.Watch += record.quantity
    }

    // Class level
    const classEntry = classMap.get(record.className) || {
      name: record.className,
      count: 0,
      generics: new Map(),
    }
    classEntry.count += record.quantity

    // Generic level
    const genericEntry = classEntry.generics.get(record.generic) || {
      name: record.generic,
      count: 0,
      trades: new Map(),
    }
    genericEntry.count += record.quantity

    // Trade name level
    const tradeKey = `${record.tradeName} (${record.company})`
    const tradeEntry = genericEntry.trades.get(tradeKey) || {
      name: record.tradeName,
      company: record.company,
      count: 0,
      generations: new Map(),
    }
    tradeEntry.count += record.quantity

    // Generation level
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

  const classes = Array.from(classMap.values()).map((classEntry) => ({
    ...classEntry,
    percentage: percentage(classEntry.count),
    generics: Array.from(classEntry.generics.values()).map((genericEntry) => ({
      ...genericEntry,
      percentage: percentage(genericEntry.count),
      trades: Array.from(genericEntry.trades.values()).map((tradeEntry) => ({
        ...tradeEntry,
        percentage: percentage(tradeEntry.count),
        generations: Array.from(tradeEntry.generations.values()).map((genEntry) => ({
          ...genEntry,
          percentage: tradeEntry.count ? Math.round((genEntry.count / tradeEntry.count) * 100) : 0,
        })),
      })),
    })),
  }))

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

/**
 * Dispatches live analytics update event to sync open components.
 */
export function notifyAnalyticsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ANALYTICS_UPDATED_EVENT))
    window.dispatchEvent(new CustomEvent(PRESCRIPTION_DATA_CHANGED_EVENT))
  }
}
