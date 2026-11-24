/**
 * Multi-Shed Flock Manager & Age-Specific Thermal Stress Engine
 *
 * Persists unlimited poultry sheds/batches under `poultrymedix_sheds`,
 * auto-advances bird age daily from placementTimestamp, computes species-
 * and age-specific brooding/housing targets, and evaluates Temp + RH THI alerts.
 *
 * Citations:
 * - Cobb-Vantress, Aviagen (Ross), & FAO Poultry Management Standards
 * - USDA-ARS Poultry THI Guidelines
 */

export const POULTRYMEDIX_SHEDS_KEY = 'poultrymedix_sheds'
export const POULTRYMEDIX_SHEDS_UPDATED_EVENT = 'poultrymedix-sheds-updated'

export const MS_PER_DAY = 24 * 60 * 60 * 1000

export const SHED_SPECIES = [
  { id: 'Broiler', labelEn: 'Broiler', labelBn: 'ব্রয়লার' },
  { id: 'Layer', labelEn: 'Layer', labelBn: 'লেয়ার' },
  { id: 'Sonali', labelEn: 'Sonali', labelBn: 'সোনালী' },
  { id: 'Desi / Native', labelEn: 'Desi / Native', labelBn: 'দেশি মুরগি' },
  { id: 'Duck', labelEn: 'Duck', labelBn: 'হাঁস' },
  { id: 'Pigeon', labelEn: 'Pigeon', labelBn: 'কবুতর' },
]

export const MANAGEMENT_STANDARDS_CITATION =
  'Source: Cobb-Vantress, Aviagen (Ross), & FAO Poultry Management Standards.'

export const THI_GUIDELINES_CITATION =
  'Source: USDA-ARS Poultry THI Guidelines'

export function celsiusToFahrenheit(c) {
  return Math.round((c * 9) / 5 + 32)
}

/**
 * Computes exact Day-1 placementTimestamp from either an explicit placementDate (YYYY-MM-DD)
 * or an entered current age in days.
 */
export function computePlacementTimestamp({ ageDays, placementDate }) {
  if (placementDate) {
    const parsed = new Date(`${placementDate}T00:00:00`)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime()
    }
  }
  const safeAge = Math.max(1, Math.floor(Number(ageDays) || 1))
  // Day 1 starts 0 days ago; Day 5 starts 4 days ago -> after 10 days it reads 15.
  return Date.now() - (safeAge - 1) * MS_PER_DAY
}

/**
 * Calculates live age in days automatically from stored placementTimestamp.
 */
export function calculateCurrentAgeDays(shed, nowMs = Date.now()) {
  if (!shed) return 1
  if (Number.isFinite(Number(shed.placementTimestamp))) {
    const elapsedDays = Math.floor((nowMs - Number(shed.placementTimestamp)) / MS_PER_DAY)
    return Math.max(1, elapsedDays + 1)
  }
  return Math.max(1, Math.floor(Number(shed.initialAgeDays) || 1))
}

/**
 * Formats placementTimestamp as YYYY-MM-DD for date input editing.
 */
export function formatPlacementDateInput(timestamp) {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return new Date().toISOString().slice(0, 10)
  const d = new Date(ts)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Returns species & age-specific ideal temperature (°C & °F) and RH (%) targets.
 */
export function getIdealEnvironmentTargets(species = 'Broiler', rawAgeDays = 1) {
  const ageDays = Math.max(1, Math.floor(Number(rawAgeDays) || 1))
  const normalizedSpecies = SHED_SPECIES.some((s) => s.id === species) ? species : 'Broiler'

  let minTempC
  let maxTempC
  let minRh
  let maxRh
  let stageLabel
  let stageLabelBn
  let toleranceNote = ''
  let toleranceNoteBn = ''

  if (normalizedSpecies === 'Duck') {
    minRh = 55
    maxRh = 70
    if (ageDays <= 7) {
      minTempC = 30
      maxTempC = 32
      stageLabel = 'Week 1 (Duckling Brooding)'
      stageLabelBn = 'সপ্তাহ ১ (হাঁসের বাচ্চা ব্রুডিং)'
    } else if (ageDays <= 14) {
      minTempC = 26
      maxTempC = 28
      stageLabel = 'Week 2 (Early Brooding)'
      stageLabelBn = 'সপ্তাহ ২ (প্রাথমিক ব্রুডিং)'
    } else {
      minTempC = 18
      maxTempC = 24
      stageLabel = 'Week 3+ (Grower / Adult)'
      stageLabelBn = 'সপ্তাহ ৩+ (গ্রোয়ার / পূর্ণবয়স্ক)'
    }
  } else if (normalizedSpecies === 'Pigeon') {
    minRh = 50
    maxRh = 65
    if (ageDays <= 14) {
      minTempC = 28
      maxTempC = 32
      stageLabel = 'Week 1–2 (Squab Nesting)'
      stageLabelBn = 'সপ্তাহ ১–২ (স্কোয়াব / বাচ্চা অবস্থা)'
    } else {
      minTempC = 18
      maxTempC = 26
      stageLabel = 'Week 3+ (Fledgling / Adult)'
      stageLabelBn = 'সপ্তাহ ৩+ (বড় বাচ্চা / পূর্ণবয়স্ক)'
    }
  } else {
    // Chickens: Broiler, Sonali, Layer, Desi / Native
    if (ageDays <= 7) {
      minTempC = 32
      maxTempC = 35
      minRh = 60
      maxRh = 70
      stageLabel = 'Week 1 (Brooding Phase)'
      stageLabelBn = 'সপ্তাহ ১ (ব্রুডিং পর্যায়)'
    } else if (ageDays <= 14) {
      minTempC = 29
      maxTempC = 32
      minRh = 60
      maxRh = 65
      stageLabel = 'Week 2 (Brooding Phase)'
      stageLabelBn = 'সপ্তাহ ২ (ব্রুডিং পর্যায়)'
    } else if (ageDays <= 21) {
      minTempC = 26
      maxTempC = 29
      minRh = 55
      maxRh = 65
      stageLabel = 'Week 3 (Transition Phase)'
      stageLabelBn = 'সপ্তাহ ৩ (রূপান্তর পর্যায়)'
    } else if (ageDays <= 28) {
      minTempC = 23
      maxTempC = 26
      minRh = 50
      maxRh = 60
      stageLabel = 'Week 4 (Grower Phase)'
      stageLabelBn = 'সপ্তাহ ৪ (গ্রোয়ার পর্যায়)'
    } else {
      minRh = 50
      maxRh = 60
      stageLabel = 'Week 5+ (Finisher / Adult)'
      stageLabelBn = 'সপ্তাহ ৫+ (ফিনিশার / পূর্ণবয়স্ক)'
      if (normalizedSpecies === 'Desi / Native') {
        minTempC = 18
        maxTempC = 26
        toleranceNote = 'Desi / Native tolerant up to 26°C'
        toleranceNoteBn = 'দেশি মুরগি ২৬°C পর্যন্ত তাপমাত্রা সহ্য করতে পারে'
      } else {
        minTempC = 18
        maxTempC = 22
      }
    }
  }

  return {
    species: normalizedSpecies,
    ageDays,
    minTempC,
    maxTempC,
    minTempF: celsiusToFahrenheit(minTempC),
    maxTempF: celsiusToFahrenheit(maxTempC),
    minRh,
    maxRh,
    stageLabel,
    stageLabelBn,
    toleranceNote,
    toleranceNoteBn,
    citation: MANAGEMENT_STANDARDS_CITATION,
  }
}

/**
 * Evaluates current ambient Temperature (°C) + Humidity (%) against age-specific comfort targets.
 * Follows USDA-ARS Poultry THI threshold tiers.
 */
export function evaluateShedThermalStress({ species, ageDays, tempC, humidity }) {
  const targets = getIdealEnvironmentTargets(species, ageDays)
  const hasWeather = Number.isFinite(Number(tempC)) && Number.isFinite(Number(humidity))

  if (!hasWeather) {
    return {
      targets,
      hasWeather: false,
      severity: 'unknown',
      severityLabelEn: 'Targets Ready',
      severityLabelBn: 'টার্গেট প্রস্তুত',
      coldWarning: false,
      deltaC: 0,
      adviceEn: `Maintain shed environment at ${targets.minTempC}°C–${targets.maxTempC}°C (${targets.minTempF}°F–${targets.maxTempF}°F) and ${targets.minRh}%–${targets.maxRh}% RH.`,
      adviceBn: `শেডের তাপমাত্রা ${targets.minTempC}°C–${targets.maxTempC}°C এবং আর্দ্রতা ${targets.minRh}%–${targets.maxRh}% RH বজায় রাখুন।`,
    }
  }

  const ambientC = Number(tempC)
  const ambientF = celsiusToFahrenheit(ambientC)
  const rh = Number(humidity)
  const deltaC = Number((ambientC - targets.maxTempC).toFixed(1))
  const isAdultOrFinisher = targets.ageDays >= 29

  let severity = 'normal'
  let severityLabelEn = 'Normal'
  let severityLabelBn = 'স্বাভাবিক'
  let coldWarning = false
  let adviceEn
  let adviceBn

  if (deltaC > 4.5 || (isAdultOrFinisher && ambientC > 32 && rh >= 65)) {
    severity = 'high'
    severityLabelEn = 'High / Critical Alert'
    severityLabelBn = 'উচ্চ / জরুরি সতর্কতা'
    adviceEn = `Critical thermal overload (+${Math.max(0, deltaC)}°C above ${targets.maxTempC}°C limit at ${rh}% RH). Maximize tunnel/cross ventilation immediately, run foggers cautiously only if RH < 70%, serve cool electrolyte water, and halt midday feeding.`
    adviceBn = `মারাত্মক তাপ পীড়ন (সর্বোচ্চ সীমা ${targets.maxTempC}°C-এর চেয়ে +${Math.max(0, deltaC)}°C বেশি ও আর্দ্রতা ${rh}%)। দ্রুত সব ফ্যান ও ক্রস-ভেন্টিলেশন চালু করুন, ঠান্ডা পানি ও ইলেক্ট্রোলাইট দিন এবং দুপুরের খাবার সাময়িক বন্ধ রাখুন।`
  } else if (deltaC >= 2.6 && deltaC <= 4.5 && rh > 65) {
    severity = 'medium'
    severityLabelEn = 'Medium Alert'
    severityLabelBn = 'মাঝারি সতর্কতা'
    adviceEn = `Moderate-high THI stress (+${deltaC}°C above ${targets.maxTempC}°C limit with ${rh}% humidity). Increase air speed over birds, shade tin roofs, refresh cool water lines, and add Vitamin C + electrolytes.`
    adviceBn = `মাঝারি তাপ ও আর্দ্রতা পীড়ন (+${deltaC}°C বেশি ও আর্দ্রতা ${rh}%)। শেডের বাতাস চলাচল বাড়ান, চালা ঠান্ডা রাখুন, ঠান্ডা পানি ও ভিটামিন-সি ইলেক্ট্রোলাইট সরবরাহ করুন।`
  } else if (deltaC >= 1.0 || (rh >= 75 && ambientC >= targets.maxTempC - 1.5)) {
    severity = 'low'
    severityLabelEn = 'Low Alert'
    severityLabelBn = 'নিম্ন সতর্কতা'
    adviceEn = deltaC >= 1.0
      ? `Slightly warm (+${deltaC}°C above ${targets.maxTempC}°C limit). Check fan airflow, flush water drinkers for cool intake, and monitor panting behavior.`
      : `High humidity (${rh}% RH near ${targets.maxTempC}°C comfort ceiling) reduces evaporative cooling. Open curtains/vents for air exchange and prevent wet litter.`
    adviceBn = deltaC >= 1.0
      ? `তাপমাত্রা আদর্শ সীমার চেয়ে +${deltaC}°C বেশি। বাতাস চলাচল বাড়ান, পাত্রের পানি ঠান্ডা রাখুন এবং পাখির শ্বাস-প্রশ্বাস পর্যবেক্ষণ করুন।`
      : `উচ্চ আর্দ্রতা (${rh}% RH) ঘাম ও তাপ নিঃসরণ কমিয়ে দেয়। পর্দা খুলে বাতাস চলাচল বাড়ান এবং লিটার শুকনো রাখুন।`
  } else if (ambientC < targets.minTempC) {
    const deficitC = Number((targets.minTempC - ambientC).toFixed(1))
    const isYoungBrooding = targets.ageDays <= 14
    coldWarning = true
    severity = 'normal'
    severityLabelEn = isYoungBrooding ? 'Normal · Needs Brooder Heat' : 'Normal · Watch Chilling'
    severityLabelBn = isYoungBrooding ? 'স্বাভাবিক · ব্রুডার তাপ প্রয়োজন' : 'স্বাভাবিক · ঠান্ডা সতর্কতা'
    adviceEn = isYoungBrooding
      ? `No heat stress, but ambient temperature (${ambientC}°C / ${ambientF}°F) is ${deficitC}°C below ${targets.stageLabel} brooding target (${targets.minTempC}°C). Keep brooder hover warm and block floor drafts.`
      : `No heat-stress risk (${ambientC}°C / ${ambientF}°F). Slightly cool (−${deficitC}°C below ${targets.minTempC}°C min); close night curtains to prevent chilling.`
    adviceBn = isYoungBrooding
      ? `তাপ পীড়ন নেই, তবে বাইরের তাপমাত্রা (${ambientC}°C) ব্রুডিং লক্ষ্যমাত্রা (${targets.minTempC}°C)-এর চেয়ে ${deficitC}°C কম। ব্রুডার হিটার চালু রাখুন ও ঠান্ডা বাতাস আটকান।`
      : `তাপ পীড়নের ঝুঁকি নেই (${ambientC}°C)। আবহাওয়া কিছুটা ঠান্ডা (−${deficitC}°C); রাতে পর্দা নামিয়ে রাখুন যাতে ঠান্ডা না লাগে।`
  } else {
    adviceEn = `Optimal comfort (${ambientC}°C / ${ambientF}°F, ${rh}% RH) matches ${targets.stageLabel} target (${targets.minTempC}°C–${targets.maxTempC}°C, ${targets.minRh}%–${targets.maxRh}% RH). Maintain standard ventilation.`
    adviceBn = `আদর্শ পরিবেশ (${ambientC}°C, ${rh}% RH) যা ${targets.stageLabelBn} লক্ষ্যমাত্রার সাথে সামঞ্জস্যপূর্ণ। স্বাভাবিক ব্যবস্থাপনা বজায় রাখুন।`
  }

  return {
    targets,
    hasWeather: true,
    ambientC,
    ambientF,
    humidity: rh,
    deltaC,
    severity,
    severityLabelEn,
    severityLabelBn,
    coldWarning,
    adviceEn,
    adviceBn,
  }
}

export function getSheds() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(POULTRYMEDIX_SHEDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((shed, idx) => ({
      ...shed,
      serialNumber: idx + 1,
      currentAgeDays: calculateCurrentAgeDays(shed),
    }))
  } catch (error) {
    console.warn('[shedManager] Unable to read sheds from localStorage:', error)
    return []
  }
}

function persistSheds(sheds) {
  const normalized = sheds.map((shed, idx) => ({
    ...shed,
    serialNumber: idx + 1,
  }))
  try {
    localStorage.setItem(POULTRYMEDIX_SHEDS_KEY, JSON.stringify(normalized))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(POULTRYMEDIX_SHEDS_UPDATED_EVENT, { detail: normalized }))
    }
  } catch (error) {
    console.error('[shedManager] Failed to persist sheds:', error)
  }
  return getSheds()
}

export function addShed({ name, species, ageDays, placementDate, birdCount }) {
  const existing = getSheds()
  const nextSerial = existing.length + 1
  const cleanName = typeof name === 'string' && name.trim() ? name.trim() : `Shed #${nextSerial}`
  const placementTimestamp = computePlacementTimestamp({ ageDays, placementDate })

  const newShed = {
    id: crypto.randomUUID(),
    name: cleanName,
    species: SHED_SPECIES.some((s) => s.id === species) ? species : 'Broiler',
    placementTimestamp,
    initialAgeDays: Math.max(1, Math.floor(Number(ageDays) || 1)),
    birdCount: Math.max(1, Math.floor(Number(birdCount) || 100)),
    createdAt: new Date().toISOString(),
  }

  return persistSheds([...existing, newShed])
}

export function updateShed(id, { name, species, ageDays, placementDate, birdCount }) {
  const existing = getSheds()
  const updated = existing.map((shed, idx) => {
    if (shed.id !== id) return shed
    const cleanName = typeof name === 'string' && name.trim() ? name.trim() : `Shed #${idx + 1}`
    return {
      ...shed,
      name: cleanName,
      species: SHED_SPECIES.some((s) => s.id === species) ? species : shed.species,
      placementTimestamp: computePlacementTimestamp({ ageDays, placementDate }),
      initialAgeDays: Math.max(1, Math.floor(Number(ageDays) || 1)),
      birdCount: Math.max(1, Math.floor(Number(birdCount) || 1)),
      updatedAt: new Date().toISOString(),
    }
  })

  return persistSheds(updated)
}

export function deleteShed(id) {
  const existing = getSheds()
  return persistSheds(existing.filter((shed) => shed.id !== id))
}

/**
 * Evaluates all saved sheds against live weather readings and returns serial report + highest summary.
 */
export function evaluateAllSheds(sheds, tempC, humidity) {
  const rank = { high: 3, medium: 2, low: 1, normal: 0, unknown: -1 }
  const reports = (sheds || []).map((shed, idx) => {
    const ageDays = calculateCurrentAgeDays(shed)
    const evaluation = evaluateShedThermalStress({
      species: shed.species,
      ageDays,
      tempC,
      humidity,
    })
    return {
      shed: {
        ...shed,
        serialNumber: idx + 1,
        currentAgeDays: ageDays,
      },
      ...evaluation,
    }
  })

  const activeAlerts = reports.filter((r) => ['high', 'medium', 'low'].includes(r.severity))
  const broodingHeatAlerts = reports.filter((r) => r.coldWarning)
  let highestReport = null
  for (const r of reports) {
    if (!highestReport || rank[r.severity] > rank[highestReport.severity]) {
      highestReport = r
    }
  }

  return {
    reports,
    activeAlerts,
    broodingHeatAlerts,
    highestSeverity: highestReport?.severity || 'unknown',
    highestReport,
  }
}
