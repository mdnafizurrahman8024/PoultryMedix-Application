export const prescriptionStorageKeys = {
  home: 'poultrymedix_home_prescriptions',
  consult: 'poultrymedix_vet_prescriptions',
}

export const prescriptionDataChangedEvent = 'poultrymedix-prescriptions-updated'

const homeSeed = [
  ['Gazipur', 'Tetracyclines', 'Doxycycline', 'Doxy-A Vet', 'ACME Laboratories Ltd.', '3rd Gen', 8],
  ['Gazipur', 'Tetracyclines', 'Doxycycline', 'Respiron Vet', 'Eskayef / SK+F', '3rd Gen', 5],
  ['Bogura', 'Tetracyclines', 'Oxytetracycline', 'Renamycin Vet', 'Renata PLC', '2nd Gen', 5],
  ['Rajshahi', 'Beta-lactams / Cephalosporins', 'Amoxicillin', 'Moxacil Vet', 'Square Pharmaceuticals PLC', '3rd Gen', 5],
  ['Mymensingh', 'Fluoroquinolones', 'Enrofloxacin', 'Enrocin', 'Techno Drugs Ltd.', '3rd Gen', 4],
  ['Cumilla', 'Macrolides', 'Tylosin', 'Tylovet', 'ACME Laboratories Ltd.', '2nd Gen', 3],
]

const consultSeed = [
  ['Rajshahi', 'Tetracyclines', 'Doxycycline', 'Doxyvet', 'Square Pharmaceuticals PLC', '3rd Gen', 7],
  ['Bogura', 'Tetracyclines', 'Doxycycline', 'Doxy-A Vet', 'ACME Laboratories Ltd.', '2nd Gen', 4],
  ['Gazipur', 'Tetracyclines', 'Oxytetracycline', 'Oxy-D Vet', 'Eon Animal Health', '2nd Gen', 6],
  ['Mymensingh', 'Beta-lactams / Cephalosporins', 'Ceftiofur / Ceftriaxone', 'Tifur Vet', 'Square Pharmaceuticals PLC', '3rd Gen', 4],
  ['Cumilla', 'Beta-lactams / Cephalosporins', 'Amoxicillin', 'Renamox', 'Renata PLC', '2nd Gen', 4],
  ['Rajshahi', 'Fluoroquinolones', 'Ciprofloxacin', 'Ciprocin Vet', 'Square Pharmaceuticals PLC', '2nd Gen', 5],
  ['Mymensingh', 'Fluoroquinolones', 'Enrofloxacin', 'Floxavet', 'ACME Laboratories Ltd.', '3rd Gen', 3],
  ['Cumilla', 'Macrolides', 'Tylosin', 'Tylovet', 'Renata PLC', '2nd Gen', 4],
]

function seedRecord(source, [district, className, generic, tradeName, company, generation, quantity]) {
  return {
    id: `seed-${source}-${district}-${generic}-${tradeName}`,
    source,
    district,
    className,
    generic,
    tradeName,
    company,
    generation,
    quantity,
  }
}

export const defaultPrescriptionSeeds = {
  home: homeSeed.map((record) => seedRecord('home', record)),
  consult: consultSeed.map((record) => seedRecord('consult', record)),
}

function safeRead(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error(`Unable to read prescription analytics data from ${key}.`, error)
    return []
  }
}

function inferClass(generic) {
  const name = String(generic || '').toLocaleLowerCase()
  if (name.includes('doxy') || name.includes('oxy')) return 'Tetracyclines'
  if (name.includes('cef') || name.includes('amoxicillin') || name.includes('ampicillin')) return 'Beta-lactams / Cephalosporins'
  if (name.includes('cipro') || name.includes('enro') || name.includes('flox')) return 'Fluoroquinolones'
  if (name.includes('tylo') || name.includes('erythro')) return 'Macrolides'
  return 'Other antibiotics'
}

function normalizeRecord(record, source) {
  if (!record || typeof record !== 'object') return null
  const medication = Array.isArray(record.medications) ? record.medications[0] : record
  const generic = medication.generic || medication.genericName || medication.name
  if (!generic) return null
  return {
    id: record.id || `${source}-${generic}-${record.savedAt || Date.now()}`,
    source,
    district: record.district || record.location || record.farmDistrict || 'Unspecified',
    className: medication.className || medication.antibioticClass || inferClass(generic),
    generic: String(generic),
    tradeName: medication.tradeName || medication.brand || medication.name || String(generic),
    company: medication.company || medication.manufacturer || 'Company not recorded',
    generation: medication.generation || 'Unspecified Gen',
    quantity: Math.max(1, Number(medication.quantity || medication.count || 1)),
    aware: medication.aware,
    risk: medication.risk,
    meatDays: medication.meatDays || medication.withdrawalMeat || medication.withdrawal,
    eggDays: medication.eggDays || medication.withdrawalEgg,
  }
}

export function readPrescriptionSources() {
  const home = safeRead(prescriptionStorageKeys.home).map((record) => normalizeRecord(record, 'home')).filter(Boolean)
  const consult = safeRead(prescriptionStorageKeys.consult)
    .concat(safeRead('poultry-telemedicine-prescriptions'))
    .map((record) => normalizeRecord(record, 'consult'))
    .filter(Boolean)

  return {
    home: home.length ? home : defaultPrescriptionSeeds.home,
    consult: consult.length ? consult : defaultPrescriptionSeeds.consult,
  }
}

export function getPrescriptionAnalytics(source = 'all', district = '') {
  const sources = readPrescriptionSources()
  const records = source === 'home' ? sources.home : source === 'consult' ? sources.consult : [...sources.home, ...sources.consult]
  const filtered = district ? records.filter((record) => record.district === district) : records
  const total = filtered.reduce((sum, record) => sum + record.quantity, 0)
  const percentage = (value) => total ? Math.round((value / total) * 100) : 0
  const classMap = new Map()

  filtered.forEach((record) => {
    const classEntry = classMap.get(record.className) || { name: record.className, count: 0, generics: new Map() }
    classEntry.count += record.quantity
    const genericEntry = classEntry.generics.get(record.generic) || { name: record.generic, count: 0, trades: new Map() }
    genericEntry.count += record.quantity
    const tradeKey = `${record.tradeName} (${record.company})`
    const tradeEntry = genericEntry.trades.get(tradeKey) || { name: record.tradeName, company: record.company, count: 0, generations: new Map() }
    tradeEntry.count += record.quantity
    const generationEntry = tradeEntry.generations.get(record.generation) || {
      name: record.generation,
      count: 0,
      aware: record.aware || (record.generation === '3rd Gen' ? 'Watch' : 'Access'),
      risk: record.risk || (record.generation === '3rd Gen' ? 'High' : 'Moderate'),
      meatDays: record.meatDays || '7 days',
      eggDays: record.eggDays || '5 days',
    }
    generationEntry.count += record.quantity
    tradeEntry.generations.set(record.generation, generationEntry)
    genericEntry.trades.set(tradeKey, tradeEntry)
    classEntry.generics.set(record.generic, genericEntry)
    classMap.set(record.className, classEntry)
  })

  return {
    total,
    classes: [...classMap.values()].map((classEntry) => ({
      ...classEntry,
      percentage: percentage(classEntry.count),
      generics: [...classEntry.generics.values()].map((genericEntry) => ({
        ...genericEntry,
        percentage: percentage(genericEntry.count),
        trades: [...genericEntry.trades.values()].map((tradeEntry) => ({
          ...tradeEntry,
          percentage: percentage(tradeEntry.count),
          generations: [...tradeEntry.generations.values()].map((generationEntry) => ({
            ...generationEntry,
            percentage: tradeEntry.count ? Math.round((generationEntry.count / tradeEntry.count) * 100) : 0,
          })),
        })),
      })),
    })),
  }
}

export function notifyPrescriptionDataChanged() {
  window.dispatchEvent(new CustomEvent(prescriptionDataChangedEvent))
}
