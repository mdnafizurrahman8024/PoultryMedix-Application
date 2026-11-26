/**
 * Farm Blueprint & Startup Guide Engine (PoultryMedix AI)
 *
 * Pure architectural, biosecurity, and cash-basis production cost modeling
 * grounded in Bangladesh DLS, DAM, Cobb/Aviagen Housing Manuals, and FAO/WOAH guidelines.
 * Strictly excludes any interest-based loans or financial lending calculations.
 */

export const FLOCK_SIZE_PRESETS = [500, 1000, 3000, 5000]

export const FARM_TYPES = [
  { id: 'Broiler', labelEn: 'Broiler', labelBn: 'ব্রয়লার' },
  { id: 'Layer', labelEn: 'Layer', labelBn: 'লেয়ার' },
  { id: 'Sonali', labelEn: 'Sonali', labelBn: 'সোনালী' },
  { id: 'Desi / Native', labelEn: 'Desi / Native', labelBn: 'দেশি / নেটিভ' },
  { id: 'Duck', labelEn: 'Duck', labelBn: 'হাঁস' },
]

// Space allowances (sq ft / bird) aligned with DLS Bangladesh & Cobb/Aviagen Housing Manuals
const SPACE_SQFT_PER_BIRD = {
  Broiler: { open: 1.25, ec: 1.0 },
  Layer: { open: 1.5, ec: 1.2 },
  Sonali: { open: 1.2, ec: 1.0 },
  'Desi / Native': { open: 1.75, ec: 1.4 },
  Duck: { open: 2.25, ec: 1.8 },
}

export function calculateShedDesign({
  flockSize = 1000,
  farmType = 'Broiler',
  shedMode = 'auto', // 'auto' | 'open' | 'ec'
}) {
  const safeFlock = Math.max(10, Math.min(100000, Math.round(Number(flockSize)) || 1000))
  const recommendedType = safeFlock >= 2500 ? 'ec' : 'open'
  const activeType = shedMode === 'auto' ? recommendedType : shedMode

  const spaceRates = SPACE_SQFT_PER_BIRD[farmType] || SPACE_SQFT_PER_BIRD.Broiler
  const sqFtPerBird = activeType === 'ec' ? spaceRates.ec : spaceRates.open
  const rawAreaSqFt = Math.round(safeFlock * sqFtPerBird)

  const widthFt = activeType === 'open'
    ? (safeFlock <= 150 ? 14 : safeFlock <= 350 ? 18 : safeFlock <= 500 ? 22 : safeFlock <= 1000 ? 25 : 30)
    : (safeFlock <= 500 ? 24 : safeFlock <= 1000 ? 28 : 38)

  const lengthFt = Math.max(12, Math.ceil(rawAreaSqFt / widthFt / 2) * 2)
  const totalAreaSqFt = widthFt * lengthFt
  const widthM = Number((widthFt * 0.3048).toFixed(1))
  const lengthM = Number((lengthFt * 0.3048).toFixed(1))
  const totalAreaSqM = Number((totalAreaSqFt * 0.0929).toFixed(1))

  const wallHeightFt = activeType === 'open' ? 9 : 8
  const ridgeHeightFt = activeType === 'open' ? 13.5 : 11.5
  const overhangFt = activeType === 'open' ? 4 : 2.5

  // Cobb/Aviagen & DLS equipment ratios
  const feedersCount = Math.ceil(safeFlock / 38)
  const chickTraysCount = Math.ceil(safeFlock / 85)
  const drinkersCount = Math.ceil(safeFlock / 70)
  const nippleDrinkersCount = Math.ceil(safeFlock / 11)
  const chickDrinkersCount = Math.ceil(safeFlock / 80)
  const brooderGuardsCount = Math.max(1, Math.ceil(safeFlock / 500))

  const exhaustFansCount = activeType === 'ec'
    ? Math.max(2, Math.ceil(safeFlock / 1250))
    : 0
  const coolingPadSqFt = activeType === 'ec'
    ? Math.max(40, Math.round((widthFt * 5.5) / 2))
    : 0
  const roofFansCount = activeType === 'open'
    ? Math.max(2, Math.ceil(lengthFt / 25))
    : 0

  return {
    flockSize: safeFlock,
    farmType,
    recommendedType,
    activeType,
    sqFtPerBird,
    widthFt,
    lengthFt,
    widthM,
    lengthM,
    totalAreaSqFt,
    totalAreaSqM,
    wallHeightFt,
    ridgeHeightFt,
    overhangFt,
    feedersCount,
    chickTraysCount,
    drinkersCount,
    nippleDrinkersCount,
    chickDrinkersCount,
    brooderGuardsCount,
    exhaustFansCount,
    coolingPadSqFt,
    roofFansCount,
    orientation: 'East–West Long Axis',
  }
}

// Reference DAM Bangladesh & field cost defaults (100% editable, cash-basis only — zero loans)
export const DAM_COST_DEFAULTS = {
  Broiler: {
    fcr: 1.55,
    targetWeightKg: 1.8,
    survivalPct: 96,
    docPriceBdt: 55,
    feedBagPriceBdt: 3350,
    miscPerBirdBdt: 42,
    marketSaleBdtPerKg: 178,
    cycleDays: '32–35',
  },
  Sonali: {
    fcr: 2.25,
    targetWeightKg: 0.95,
    survivalPct: 95,
    docPriceBdt: 28,
    feedBagPriceBdt: 3200,
    miscPerBirdBdt: 48,
    marketSaleBdtPerKg: 265,
    cycleDays: '60–68',
  },
  'Desi / Native': {
    fcr: 3.1,
    targetWeightKg: 1.15,
    survivalPct: 95,
    docPriceBdt: 32,
    feedBagPriceBdt: 2950,
    miscPerBirdBdt: 40,
    marketSaleBdtPerKg: 380,
    cycleDays: '95–110',
  },
  Duck: {
    fcr: 2.7,
    targetWeightKg: 1.65,
    survivalPct: 95,
    docPriceBdt: 42,
    feedBagPriceBdt: 3050,
    miscPerBirdBdt: 45,
    marketSaleBdtPerKg: 285,
    cycleDays: '70–80',
  },
  Layer: {
    fcr: 2.15,
    targetWeightKg: 1.55,
    survivalPct: 96,
    docPriceBdt: 48,
    feedBagPriceBdt: 3150,
    miscPerBirdBdt: 68,
    marketSaleBdtPerKg: 220,
    cycleDays: '126–135 (Grower)',
  },
}

export function calculateFcrAndBreakEven({
  flockSize = 1000,
  fcr = 1.55,
  targetWeightKg = 1.8,
  survivalPct = 96,
  docPriceBdt = 55,
  feedBagPriceBdt = 3350,
  miscPerBirdBdt = 42,
  marketSaleBdtPerKg = 178,
}) {
  const birds = Math.max(1, Number(flockSize) || 1000)
  const safeFcr = Math.max(0.5, Number(fcr) || 1.55)
  const safeWeight = Math.max(0.2, Number(targetWeightKg) || 1.8)
  const safeSurvival = Math.min(100, Math.max(50, Number(survivalPct) || 96))

  const survivingBirds = Math.round(birds * (safeSurvival / 100))
  const totalLiveWeightKg = survivingBirds * safeWeight
  const totalFeedKg = totalLiveWeightKg * safeFcr
  const feedBagsExact = totalFeedKg / 50
  const feedBagsRounded = Math.ceil(feedBagsExact)

  const totalChickCost = birds * Math.max(0, Number(docPriceBdt) || 0)
  const totalFeedCost = feedBagsExact * Math.max(0, Number(feedBagPriceBdt) || 0)
  const totalMiscCost = birds * Math.max(0, Number(miscPerBirdBdt) || 0)
  const totalProductionCost = Math.round(totalChickCost + totalFeedCost + totalMiscCost)

  const breakEvenCostPerKg = totalLiveWeightKg > 0 ? totalProductionCost / totalLiveWeightKg : 0
  const costPerBird = totalProductionCost / survivingBirds
  const expectedRevenue = totalLiveWeightKg * Math.max(0, Number(marketSaleBdtPerKg) || 0)
  const estimatedMargin = Math.round(expectedRevenue - totalProductionCost)

  return {
    survivingBirds,
    totalLiveWeightKg: Number(totalLiveWeightKg.toFixed(1)),
    totalFeedKg: Math.round(totalFeedKg),
    feedBagsExact: Number(feedBagsExact.toFixed(1)),
    feedBagsRounded,
    totalChickCost: Math.round(totalChickCost),
    totalFeedCost: Math.round(totalFeedCost),
    totalMiscCost: Math.round(totalMiscCost),
    totalProductionCost,
    breakEvenCostPerKg: Number(breakEvenCostPerKg.toFixed(2)),
    costPerBird: Number(costPerBird.toFixed(1)),
    expectedRevenue: Math.round(expectedRevenue),
    estimatedMargin,
  }
}

export const BIOSECURITY_DISTANCES = [
  {
    id: 'same-farm',
    metric: '≥ 0.5 km (500 m)',
    metricBn: '≥ ০.৫ কি.মি. (৫০০ মিটার)',
    titleEn: 'Minimum Distance to Nearest Poultry Farm',
    titleBn: 'নিকটতম যেকোনো পোল্ট্রি খামার থেকে ন্যূনতম দূরত্ব',
    detailEn: 'Prevents airborne viral aerosols (NDV, IBD, Mycoplasma) drifting between sheds.',
    detailBn: 'এক খামার থেকে অন্য খামারে বাতাসের মাধ্যমে ভাইরাস ও জীবাণু ছড়ানো রোধ করে।',
  },
  {
    id: 'broiler-layer',
    metric: '≥ 1.0 km (1,000 m)',
    metricBn: '≥ ১.০ কি.মি. (১,০০০ মিটার)',
    titleEn: 'Broiler-to-Layer / Multi-Age Separation',
    titleBn: 'ব্রয়লার ও লেয়ার খামারের মধ্যবর্তী নিরাপদ দূরত্ব',
    detailEn: 'Long-cycle Layers carry endemic pathogens that severely strike young Broiler flocks.',
    detailBn: 'বয়স্ক লেয়ার মুরগির শরীরে থাকা জীবাণু থেকে ছোট ব্রয়লার বাচ্চাকে সুরক্ষিত রাখে।',
  },
  {
    id: 'breeder-hatchery',
    metric: '≥ 2.0 – 3.0 km',
    metricBn: '≥ ২.০ – ৩.০ কি.মি.',
    titleEn: 'Distance from Breeder Farms & Commercial Hatcheries',
    titleBn: 'ব্রিডার খামার ও হ্যাচারি থেকে আবশ্যক দূরত্ব',
    detailEn: 'Strict FAO/WOAH biosecurity shield protecting high-value genetic breeding stock.',
    detailBn: 'মূল্যবান ব্রিডার স্টক ও হ্যাচারির রোগমুক্তি নিশ্চিত করতে FAO/WOAH-এর বাধ্যতামূলক নিয়ম।',
  },
  {
    id: 'roads-homes',
    metric: '≥ 100 – 200 m',
    metricBn: '≥ ১০০ – ২০০ মিটার',
    titleEn: 'Setback from Public Highways, Live Markets & Houses',
    titleBn: 'পাবলিক রাস্তা, হাট-বাজার ও বসতবাড়ি থেকে দূরত্ব',
    detailEn: 'Reduces dust/poultry-truck plume exposure and avoids community odor & fly complaints.',
    detailBn: 'খোলা ট্রাকের ধুলাবালি ও হাটের জীবাণু থেকে খামার বাঁচায় এবং বসতবাড়ির পরিবেশ সুস্থ রাখে।',
  },
]

export const BIOSECURITY_ZONES = [
  {
    id: 'red',
    color: '#b91c1c',
    bgLight: '#fef2f2',
    borderLight: '#fecaca',
    nameEn: 'RED ZONE — Public & Perimeter Boundary',
    nameBn: 'লাল জোন (Red Zone) — বাহ্যিক ও জনসাধারণের সীমানা',
    detailEn: 'Main perimeter fence, tire disinfectant dip, feed/live-bird truck dock, and parking. Zero outside vehicles pass this line.',
    detailBn: 'প্রধান ফটক, গাড়ির চাকা জীবাণুমুক্তকরণ ফুটবাথ ও ডেলিভারি গেট। কোনো বাইরের ভ্যান বা গাড়ি এর ভেতরে ঢুকবে না।',
  },
  {
    id: 'amber',
    color: '#b45309',
    bgLight: '#fffbeb',
    borderLight: '#fde68a',
    nameEn: 'AMBER ZONE — Transition & Sanitation Buffer',
    nameBn: 'হলুদ/অ্যাম্বার জোন (Amber Zone) — রূপান্তর ও জীবাণুনাশক স্তর',
    detailEn: 'Staff boot/coverall changing room, handwash sink, sealed feed store, and fenced carcass burial pit away from water.',
    detailBn: 'কাপড় ও বুট পরিবর্তনের কক্ষ, হাত ধোয়ার বেসিন, সিল করা খাদ্য গুদাম এবং পানির উৎস থেকে দূরে মৃত পাখি মাটিচাপার গর্ত।',
  },
  {
    id: 'green',
    color: '#15803d',
    bgLight: '#f0fdf4',
    borderLight: '#bbf7d0',
    nameEn: 'GREEN ZONE — Clean Shed Production Core',
    nameBn: 'সবুজ জোন (Green Zone) — মূল নিরাপদ শেড এলাকা',
    detailEn: 'Sheds themselves. Requires shed-door Virkon/bleach footbath, dedicated shed sandals, and wild-bird proof wire mesh.',
    detailBn: 'মূল মুরগির শেড। প্রতিটি শেডের দরজায় প্রতিদিন জীবাণুনাশক ফুটবাথ, আলাদা স্যান্ডেল এবং বন্যপাখি-রোধী জালি বাধ্যতামূলক।',
  },
]

export const GRADE_A_CHICK_CHECKLIST = [
  {
    id: 'hatchery-dls',
    titleEn: 'DLS-Registered Hatchery Invoice & Certificate',
    titleBn: 'সরকারি DLS নিবন্ধিত হ্যাচারির চালান ও সনদ যাচাই',
    detailEn: 'Buy only from a Bangladesh DLS-registered parent-stock hatchery providing a clean disease-free dispatch slip.',
    detailBn: 'অবশ্যই DLS অনুমোদিত ও রোগমুক্ত প্যারেন্ট-স্টক হ্যাচারি থেকে বৈধ চালানসহ বাচ্চা কিনুন।',
  },
  {
    id: 'weight-38-42',
    titleEn: 'Target Chick Weight: 38 – 42 g (Uniform Box Weight)',
    titleBn: 'একদিনের বাচ্চার ওজন: ৩৮ – ৪২ গ্রাম (সমমানের বাচ্চা)',
    detailEn: 'Random-weigh 20–30 chicks on delivery; underweight chicks (<35g) suffer higher early brooding mortality.',
    detailBn: 'বাক্স থেকে ২০–৩০টি বাচ্চা মেপে দেখুন; ৩৮–৪২ গ্রাম ওজনের সুস্থ বাচ্চার মৃত্যুহার সবচেয়ে কম হয়।',
  },
  {
    id: 'dry-navel',
    titleEn: 'Clean, Dry & Completely Closed Navel (No Black Button)',
    titleBn: 'শুকনো ও সম্পূর্ণ বন্ধ নাভি (পুঁজ বা কালো দাগমুক্ত)',
    detailEn: 'Check undersides: wet, open, or swollen navels indicate yolk-sac bacterial infection (Omphalitis / E. coli).',
    detailBn: 'বাচ্চার নাভি ভেজা, ফোলা বা কালো হলে অ্যামফালাইটিস সংক্রমণ থাকে—এমন বাচ্চা পরিহার করুন।',
  },
  {
    id: 'alertness',
    titleEn: 'Bright Eyes, Alertness & < 3s Righting Reflex',
    titleBn: 'উজ্জ্বল চোখ, চঞ্চলতা ও দ্রুত সোজা হয়ে দাঁড়ানোর ক্ষমতা',
    detailEn: 'Gently place a chick on its back; a Grade-A DOC flips back onto sturdy legs within 3 seconds.',
    detailBn: 'হাতের তালুতে চিৎ করে রাখলে গ্রেড-এ বাচ্চা ৩ সেকেন্ডের কম সময়ে সোজা হয়ে দাঁড়াতে পারে।',
  },
  {
    id: 'abdomen-vent',
    titleEn: 'Soft, Plump Abdomen & Clean Dry Vent',
    titleBn: 'নরম-স্বাভাবিক পেট ও পরিষ্কার শুকনো পায়ুপথ',
    detailEn: 'Reject pasted vents or tight/swollen bellies; confirm clean chick-box paper with no watery staining.',
    detailBn: 'পায়ুপথে পাতলা বিষ্ঠা লেগে থাকা বা শক্ত ফোলা পেটের বাচ্চা নেওয়া যাবে না।',
  },
  {
    id: 'legs-down',
    titleEn: 'Strong Shiny Shanks, Straight Toes & Fluffy Down',
    titleBn: 'শক্ত পা, সোজা আঙুল ও ঝরঝরে নরম লোম',
    detailEn: 'Shanks should look hydrated (not shriveled/red hocks), with zero splayed legs or crossed beaks.',
    detailBn: 'পা যেন শুষ্ক বা লাল না হয়, আঙুল বাঁকা না থাকে এবং গায়ে ঘন শুকনো লোম থাকে।',
  },
  {
    id: 'vaccine-slip',
    titleEn: 'Hatchery Vaccine & Transport Welfare Verification',
    titleBn: 'হ্যাচারি টিকা ও নিরাপদ পরিবহন যাচাই',
    detailEn: 'Confirm Marek’s/ND hatchery spray log where ordered and ensure ventilated transport van without heat stress.',
    detailBn: 'লেয়ার/সোনালী বাচ্চার মারেক্স টিকা ও হ্যাচারি স্প্রে নিশ্চিত করুন এবং বাতাস চলাচলযুক্ত গাড়িতে আনুন।',
  },
]

export const DLS_REGISTRATION_CHECKLIST = [
  {
    id: 'nid-photo',
    titleEn: 'Entrepreneur National ID (NID) & 2 Passport Photos',
    titleBn: 'উদ্যোক্তার জাতীয় পরিচয়পত্র (NID) ও ২ কপি পাসপোর্ট ছবি',
  },
  {
    id: 'land-lease',
    titleEn: 'Land Ownership Deed / Notarized Farm Lease Agreement',
    titleBn: 'জমির মালিকানার দলিল অথবা বৈধ ভাড়া চুক্তিনামা',
  },
  {
    id: 'trade-license',
    titleEn: 'Union Parishad / Municipality Poultry Trade License',
    titleBn: 'ইউনিয়ন পরিষদ বা পৌরসভার পোল্ট্রি খামার ট্রেড লাইসেন্স',
  },
  {
    id: 'ulo-clearance',
    titleEn: 'Upazila Livestock Office (ULO) Site Inspection & Distance Report',
    titleBn: 'উপজেলা প্রাণিসম্পদ কর্মকর্তার (ULO) সরেজমিন পরিদর্শন ও দূরত্ব প্রতিবেদন',
  },
  {
    id: 'biosecurity-sop',
    titleEn: 'Written Biosecurity Plan & Dead-Bird Burial Pit Layout',
    titleBn: 'জৈব-নিরাপত্তা পরিকল্পনা ও মৃত পাখি পুঁতে ফেলার গর্তের নকশা',
  },
  {
    id: 'flock-register',
    titleEn: 'DLS Flock Health, Vaccine & Withdrawal Record Book (or PoultryMedix Log)',
    titleBn: 'টিকা, মৃত্যু ও ওষুধের উইথড্রয়াল রেজিস্টার খাতা (বা পোল্ট্রিমেডিক্স ক্লিনিক্যাল লগ)',
  },
]

export const UPCOMING_MENTORSHIP_WORKSHOPS = [
  {
    id: 'ws-shed-brooding',
    vetId: 'dr-sarah',
    vetName: 'Dr. Sarah Ahmed, DVM',
    bvcRegNo: 'BVC-REG-10492',
    clinicDetails: 'Rajshahi Avian Diagnostic & Research Hospital',
    titleEn: 'Zero-Mortality Week-1 Brooding & Open/EC Shed Layout Clinic',
    titleBn: 'প্রথম সপ্তাহে শূন্য মৃত্যুহার ও আধুনিক শেড ডিজাইন লাইভ কর্মশালা',
    scheduleDate: '2026-11-28',
    scheduleTime: '20:00',
    displayTimeEn: 'Fri, Nov 28 · 8:00 PM (BST)',
    displayTimeBn: 'শুক্রবার, ২৮ নভেম্বর · রাত ৮:০০',
    seatsLeft: 7,
    feeBdt: 400,
    topicsEn: 'Brooder guard spacing, winter/summer curtain setup, nipple vs bell drinkers, live blueprint review.',
    topicsBn: 'চিক-গার্ড স্থাপন, শীত-গরমের পর্দা নিয়ন্ত্রণ, ড্রিংকার/ফিডার অনুপাত ও সরাসরি নকশা পর্যালোচনা।',
  },
  {
    id: 'ws-biosecurity-hatchery',
    vetId: 'dr-tariqul',
    vetName: 'Dr. Tariqul Islam, DVM',
    bvcRegNo: 'BVC-REG-11284',
    clinicDetails: 'Bogura Poultry Health & Biosecurity Center',
    titleEn: 'Biosecurity Zoning, Grade-A DOC Selection & Cold-Chain Vaccines',
    titleBn: 'খামার জৈব-নিরাপত্তা, গ্রেড-এ বাচ্চা বাছাই ও সঠিক টিকা ব্যবস্থাপনা',
    scheduleDate: '2026-11-30',
    scheduleTime: '19:30',
    displayTimeEn: 'Sun, Nov 30 · 7:30 PM (BST)',
    displayTimeBn: 'রবিবার, ৩০ নভেম্বর · সন্ধ্যা ৭:৩০',
    seatsLeft: 5,
    feeBdt: 350,
    topicsEn: 'Red/Amber/Green farm zoning, Grade-A chick quality checks, BCRDV/Gumboro cold-chain discipline.',
    topicsBn: 'লাল-হলুদ-সবুজ জোন বিন্যাস, ৩৮–৪২ গ্রাম বাচ্চা যাচাই এবং রানীক্ষেত ও গামবোরো টিকার কোল্ড-চেইন।',
  },
  {
    id: 'ws-fcr-amr',
    vetId: 'dr-farhana',
    vetName: 'Dr. Farhana Rahman, DVM',
    bvcRegNo: 'BVC-REG-09871',
    clinicDetails: 'Gazipur Central Avian Clinic',
    titleEn: 'Improving FCR Without Blind Antibiotics & Layer/Broiler Setup Q&A',
    titleBn: 'অযথা অ্যান্টিবায়োটিক ছাড়াই ভালো FCR ও ব্রয়লার/লেয়ার খামার প্রশ্নোত্তর',
    scheduleDate: '2026-12-02',
    scheduleTime: '20:30',
    displayTimeEn: 'Tue, Dec 02 · 8:30 PM (BST)',
    displayTimeBn: 'মঙ্গলবার, ২ ডিসেম্বর · রাত ৮:৩০',
    seatsLeft: 9,
    feeBdt: 450,
    topicsEn: 'Cutting feed waste, heat-stress electrolytes, DLS registration readiness, 1-on-1 Q&A with BVC vets.',
    topicsBn: 'খাদ্য অপচয় রোধ, হিট-স্ট্রেস ব্যবস্থাপনা, সরকারি DLS রেজিস্ট্রেশন ও সরাসরি ভেট প্রশ্নোত্তর।',
  },
]
