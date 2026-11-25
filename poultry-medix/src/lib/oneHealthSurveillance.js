export const REPORTER_ROLES = {
  ulo_hospital: {
    id: 'ulo_hospital',
    labelEn: 'Govt. ULO Hospital',
    labelBn: 'সরকারি উপজেলা প্রাণিসম্পদ (ULO)',
    shortEn: 'ULO Hospitals',
    shortBn: 'ULO হাসপাতাল',
  },
  bvc_vet: {
    id: 'bvc_vet',
    labelEn: 'BVC Registered Vet',
    labelBn: 'BVC নিবন্ধিত পশুচিকিৎসক',
    shortEn: 'BVC Vets',
    shortBn: 'BVC চিকিৎসক',
  },
  farmer_ai: {
    id: 'farmer_ai',
    labelEn: 'Farmer / AI Field Log',
    labelBn: 'খামারি / AI ফিল্ড লগ',
    shortEn: 'Farmer AI Scans',
    shortBn: 'খামারি AI স্ক্যান',
  },
}

export function normalizeReporterSource(value) {
  const key = String(value || '').trim().toLowerCase()
  if (key === 'ulo_hospital' || key === 'ulo' || key.includes('ulo')) return 'ulo_hospital'
  if (key === 'bvc_vet' || key === 'vet_issued' || key === 'consult' || key.includes('bvc')) return 'bvc_vet'
  return 'farmer_ai'
}

export const ZOONOTIC_DISEASE_RULES = [
  {
    id: 'avian_influenza',
    patterns: ['avian influenza', 'bird flu', 'hpai', 'lpai', 'h5n1', 'h9n2'],
    severity: 'critical',
    riskNoteEn: 'High human-animal respiratory transmission risk (Avian Influenza / Bird Flu)',
    riskNoteBn: 'মানুষে শ্বাসতন্ত্রের মারাত্মক সংক্রমণের উচ্চ ঝুঁকি (বার্ড ফ্লু / এভিয়ান ইনফ্লুয়েঞ্জা)',
  },
  {
    id: 'salmonellosis',
    patterns: ['salmonellosis', 'salmonella'],
    severity: 'high',
    riskNoteEn: 'Zoonotic foodborne & farm-handler enteric infection risk',
    riskNoteBn: 'খাদ্য ও সরাসরি সংস্পর্শে মানুষে সালমোনেলা পেটের সংক্রমণের ঝুঁকি',
  },
  {
    id: 'campylobacteriosis',
    patterns: ['campylobacteriosis', 'campylobacter'],
    severity: 'high',
    riskNoteEn: 'Zoonotic poultry-to-human acute gastroenteritis risk',
    riskNoteBn: 'পোল্ট্রি থেকে মানুষে তীব্র ক্যাম্পাইলোব্যাক্টার পেটের রোগ ছড়ানোর ঝুঁকি',
  },
  {
    id: 'colibacillosis',
    patterns: ['colibacillosis', 'escherichia coli', 'e. coli', 'e coli', 'apec'],
    severity: 'moderate',
    riskNoteEn: 'Pathogenic E. coli zoonotic & antimicrobial-resistance plasmid risk',
    riskNoteBn: 'মানুষে ক্ষতিকর ই. কোলাই ও অ্যান্টিবায়োটিক-প্রতিরোধী জীবাণু ছড়ানোর ঝুঁকি',
  },
  {
    id: 'newcastle_conjunctivitis',
    patterns: ['newcastle', 'ranikhet', 'ndv', 'conjunctivitis'],
    severity: 'moderate',
    riskNoteEn: 'Newcastle Conjunctivitis risk in poultry handlers via eyes/aerosols',
    riskNoteBn: 'খামারি ও কর্মীদের চোখে রানীক্ষেত-জনিত কনজাংটিভাইটিস (চোখ লাল হওয়া) সংক্রমণের ঝুঁকি',
  },
]

export function getZoonoticInfo(diseaseName) {
  const normalized = String(diseaseName || '').trim().toLowerCase()
  if (!normalized) return { isZoonotic: false, id: null, severity: null, riskNoteEn: '', riskNoteBn: '' }

  const match = ZOONOTIC_DISEASE_RULES.find((rule) =>
    rule.patterns.some((pattern) => normalized.includes(pattern))
  )

  if (!match) {
    return { isZoonotic: false, id: null, severity: null, riskNoteEn: '', riskNoteBn: '' }
  }

  return {
    isZoonotic: true,
    id: match.id,
    severity: match.severity,
    riskNoteEn: match.riskNoteEn,
    riskNoteBn: match.riskNoteBn,
  }
}

export const ZOONOTIC_HUMAN_PRECAUTIONS = [
  {
    id: 'ppe',
    titleEn: 'Wear Full PPE (N95 Mask, Gloves & Eye Protection)',
    titleBn: 'পিপিই, N95 মাস্ক, গ্লাভস ও চশমা ব্যবহার করুন',
    detailEn: 'Never touch sick birds, droppings, nasal secretions, or carcasses bare-handed. Cover mouth, nose, and eyes inside affected sheds.',
    detailBn: 'অসুস্থ পাখি, বিষ্ঠা বা মৃত পাখি খালি হাতে ধরবেন না; শেডে ঢোকার আগে মাস্ক, গ্লাভস ও নিরাপত্তা চশমা পরুন।',
  },
  {
    id: 'burial',
    titleEn: 'Strict Deep Burial / Incineration of Dead Birds',
    titleBn: 'মৃত পাখি গভীর গর্তে পুঁতে ফেলুন (চুনসহ)',
    detailEn: 'Double-bag carcasses and bury at least 4–5 feet deep with quicklime away from tube-wells and canals. Never dump in open water or sell sick birds.',
    detailBn: 'মৃত পাখি ডাবল ব্যাগে ভরে খাল-বিল ও টিউবওয়েল থেকে দূরে ৪–৫ ফুট গভীর গর্তে চুন দিয়ে মাটিচাপা দিন; কখনোই বিক্রি বা পানিতে ফেলবেন না।',
  },
  {
    id: 'ulo-notify',
    titleEn: 'Immediate ULO Notification & Quarantine (Call 16358)',
    titleBn: 'তাৎক্ষণিক সরকারি ULO অফিসে জানান (হেল্পলাইন ১৬৩৫৮)',
    detailEn: 'Quarantine the shed, halt live-bird/litter movement immediately, disinfect boots/vehicles, and report suspected Avian Flu or zoonotic clusters to DLS.',
    detailBn: 'খামার থেকে পাখি বা লিটার সরানো বন্ধ রাখুন, প্রবেশপথে জীবাণুনাশক স্প্রে করুন এবং দ্রুত স্থানীয় ULO বা ১৬৩৫৮ নম্বরে জানান।',
  },
  {
    id: 'human-symptom',
    titleEn: 'Monitor Handler Health & Eye / Fever Symptoms',
    titleBn: 'খামারের কর্মীদের জ্বর, কাশি বা চোখ ওঠা পর্যবেক্ষণ',
    detailEn: 'Wash hands thoroughly with soap for 20+ seconds after shed work. Seek medical attention immediately if anyone develops fever, cough, or red eyes.',
    detailBn: 'কাজের পর সাবান দিয়ে ভালোভাবে হাত ধুয়ে নিন। কোনো কর্মীর জ্বর, শ্বাসকষ্ট বা চোখ লাল হলে দ্রুত নিকটস্থ সরকারি হাসপাতালে দেখান।',
  },
]

export const SURVEILLANCE_DISTRICTS = [
  'Rajshahi',
  'Pabna',
  'Bogura',
  'Gazipur',
  'Chattogram',
  'Mymensingh',
  'Cumilla',
  'Rangpur',
  'Dhaka',
  'Sylhet',
  'Khulna',
  'Barishal',
  'Dinajpur',
  'Jashore',
  'Sirajganj',
  'Tangail',
  'Kishoreganj',
  'Faridpur',
  'Narayanganj',
  'Brahmanbaria',
  'Noakhali',
  'Natore',
  'Kushtia',
  "Cox's Bazar",
]

export const DISTRICT_UPAZILAS = {
  Rajshahi: ['Paba', 'Mohonpur', 'Charghat', 'Bagha', 'Godagari', 'Tanore'],
  Pabna: ['Ishwardi', 'Santhia', 'Atghoria', 'Pabna Sadar', 'Bera'],
  Bogura: ['Sherpur', 'Shajahanpur', 'Bogura Sadar', 'Nandigram', 'Gabtali'],
  Gazipur: ['Sreepur', 'Kapasia', 'Kaliakoir', 'Gazipur Sadar', 'Kaliganj'],
  Chattogram: ['Sitakunda', 'Hathazari', 'Mirsharai', 'Patiya', 'Raozan'],
  Mymensingh: ['Trishal', 'Bhaluka', 'Fulbaria', 'Muktagachha', 'Mymensingh Sadar'],
  Cumilla: ['Daudkandi', 'Chandina', 'Laksam', 'Chauddagram', 'Burichang'],
  Rangpur: ['Rangpur Sadar', 'Pirganj', 'Mithapukur', 'Badarganj', 'Taraganj'],
  Dhaka: ['Savar', 'Dhamrai', 'Keraniganj', 'Nawabganj', 'Dohar'],
  Sylhet: ['Sylhet Sadar', 'Golapganj', 'Beanibazar', 'South Surma'],
  Khulna: ['Dumuria', 'Batiaghata', 'Phultala', 'Rupsha'],
  Barishal: ['Barishal Sadar', 'Babuganj', 'Bakerganj', 'Uzirpur'],
  Dinajpur: ['Dinajpur Sadar', 'Birganj', 'Chirirbandar', 'Parbatipur'],
  Jashore: ['Jashore Sadar', 'Jhikargachha', 'Abhaynagar', 'Manirampur'],
}

export const SURVEILLANCE_SPECIES = [
  { id: 'Broiler', labelEn: 'Broiler', labelBn: 'ব্রয়লার' },
  { id: 'Layer', labelEn: 'Layer', labelBn: 'লেয়ার' },
  { id: 'Sonali', labelEn: 'Sonali', labelBn: 'সোনালী' },
  { id: 'Desi / Native', labelEn: 'Desi / Native', labelBn: 'দেশি মুরগি' },
  { id: 'Duck', labelEn: 'Duck', labelBn: 'হাঁস' },
  { id: 'Pigeon', labelEn: 'Pigeon', labelBn: 'কবুতর' },
]

export const SURVEILLANCE_DISEASES = [
  { id: 'Avian Influenza', labelEn: 'Avian Influenza (Bird Flu)', labelBn: 'এভিয়ান ইনফ্লুয়েঞ্জা (বার্ড ফ্লু)', isZoonotic: true },
  { id: 'Salmonellosis', labelEn: 'Salmonellosis', labelBn: 'সালমোনেলোসিস', isZoonotic: true },
  { id: 'Campylobacteriosis', labelEn: 'Campylobacteriosis', labelBn: 'ক্যাম্পাইলোব্যাক্টেরিওসিস', isZoonotic: true },
  { id: 'Colibacillosis', labelEn: 'Colibacillosis (E. coli)', labelBn: 'কলিব্যাসিলোসিস (ই. কোলাই)', isZoonotic: true },
  { id: 'Newcastle / Ranikhet', labelEn: 'Newcastle / Ranikhet (Conjunctivitis Risk)', labelBn: 'রানীক্ষেত / নিউক্যাসল (চোখ ওঠা ঝুঁকি)', isZoonotic: true },
  { id: 'Gumboro', labelEn: 'Gumboro (IBD)', labelBn: 'গামবোরো (IBD)', isZoonotic: false },
  { id: 'Coccidiosis', labelEn: 'Coccidiosis', labelBn: 'কক্সিডিওসিস (রক্ত আমাশয়)', isZoonotic: false },
  { id: 'Infectious Coryza', labelEn: 'Infectious Coryza', labelBn: 'ইনফেকশাস করাইজা', isZoonotic: false },
  { id: 'CRD', labelEn: 'Chronic Respiratory Disease (CRD)', labelBn: 'সিআরডি (সংক্রামক সর্দি-কাশি)', isZoonotic: false },
  { id: 'Fowl Cholera', labelEn: 'Fowl Cholera', labelBn: 'ফাউল কলেরা', isZoonotic: false },
  { id: 'Fowl Pox', labelEn: 'Fowl Pox', labelBn: 'ফাউল পক্স (মুরগির বসন্ত)', isZoonotic: false },
  { id: 'Duck Plague / Viral Hepatitis', labelEn: 'Duck Plague / Viral Hepatitis', labelBn: 'হাঁসের প্লেগ / ভাইরাল হেপাটাইটিস', isZoonotic: false },
]

export const SURVEILLANCE_ANTIBIOTICS = [
  {
    name: 'None / Supportive Only',
    labelEn: 'None / Supportive Biosecurity Only (Recommended for Viral)',
    labelBn: 'কোনো অ্যান্টিবায়োটিক নয় / সহায়ক পরিচর্যা (ভাইরাল রোগে)',
    className: 'None',
    generation: 'N/A',
    aware: 'None',
    meatDays: '0 days',
    eggDays: '0 days',
    restricted: false,
  },
  {
    name: 'Amoxicillin',
    labelEn: 'Amoxicillin (Beta-lactam · WHO Access)',
    labelBn: 'অ্যামোক্সিসিলিন (বিটা-ল্যাকটাম · Access)',
    className: 'Beta-lactams / Cephalosporins',
    generation: '2nd Gen',
    aware: 'Access',
    meatDays: '3 days',
    eggDays: '1 day',
    restricted: false,
  },
  {
    name: 'Oxytetracycline',
    labelEn: 'Oxytetracycline (Tetracycline · WHO Access)',
    labelBn: 'অক্সিটেট্রাসাইক্লিন (টেট্রাসাইক্লিন · Access)',
    className: 'Tetracyclines',
    generation: '2nd Gen',
    aware: 'Access',
    meatDays: '5 days',
    eggDays: '3 days',
    restricted: false,
  },
  {
    name: 'Sulfadiazine + Trimethoprim',
    labelEn: 'Sulfadiazine + Trimethoprim (Sulfonamide · WHO Access)',
    labelBn: 'সালফাডায়াজিন + ট্রাইমেথোপ্রিম (সালফোনামাইড · Access)',
    className: 'Sulfonamides',
    generation: '2nd Gen',
    aware: 'Access',
    meatDays: '7 days',
    eggDays: 'Not for layers',
    restricted: false,
  },
  {
    name: 'Doxycycline',
    labelEn: 'Doxycycline (Tetracycline · WHO Watch)',
    labelBn: 'ডক্সিসাইক্লিন (টেট্রাসাইক্লিন · Watch)',
    className: 'Tetracyclines',
    generation: '3rd Gen',
    aware: 'Watch',
    meatDays: '7 days',
    eggDays: '5 days',
    restricted: false,
  },
  {
    name: 'Tylosin',
    labelEn: 'Tylosin (Macrolide · WHO Watch)',
    labelBn: 'টাইলোসিন (ম্যাক্রোলাইড · Watch)',
    className: 'Macrolides',
    generation: '2nd Gen',
    aware: 'Watch',
    meatDays: '5 days',
    eggDays: '3 days',
    restricted: false,
  },
  {
    name: 'Enrofloxacin',
    labelEn: 'Enrofloxacin (Fluoroquinolone · WHO Watch)',
    labelBn: 'এনরোফ্লক্সাসিন (ফ্লুরোকুইনোলোন · Watch)',
    className: 'Fluoroquinolones',
    generation: '3rd Gen',
    aware: 'Watch',
    meatDays: '10 days',
    eggDays: 'Not for layers',
    restricted: false,
  },
  {
    name: 'Ciprofloxacin',
    labelEn: 'Ciprofloxacin (Fluoroquinolone · WHO Watch)',
    labelBn: 'সিপ্রোফ্লক্সাসিন (ফ্লুরোকুইনোলোন · Watch)',
    className: 'Fluoroquinolones',
    generation: '2nd Gen',
    aware: 'Watch',
    meatDays: '10 days',
    eggDays: '7 days',
    restricted: false,
  },
  {
    name: 'Ceftiofur',
    labelEn: 'Ceftiofur / Cephalosporin (3rd Gen · WHO Watch)',
    labelBn: 'সেফটিওফার / সেফালোস্পোরিন (৩য় প্রজন্ম · Watch)',
    className: 'Beta-lactams / Cephalosporins',
    generation: '3rd Gen',
    aware: 'Watch',
    meatDays: '8 days',
    eggDays: 'Not for layers',
    restricted: false,
  },
  {
    name: 'Neomycin',
    labelEn: 'Neomycin (Aminoglycoside · WHO Watch)',
    labelBn: 'নিওমাইসিন (অ্যামাইনোগ্লাইকোসাইড · Watch)',
    className: 'Aminoglycosides',
    generation: '2nd Gen',
    aware: 'Watch',
    meatDays: '5 days',
    eggDays: '3 days',
    restricted: false,
  },
  {
    name: 'Colistin Sulfate',
    labelEn: 'Colistin Sulfate (BANNED in Bangladesh Poultry · Red Flag AMR Surveillance)',
    labelBn: 'কোলিস্টিন সালফেট (বাংলাদেশে নিষিদ্ধ · জরুরি AMR নজরদারি)',
    className: 'Polymyxins',
    generation: '4th Gen',
    aware: 'Reserve',
    meatDays: 'Prohibited',
    eggDays: 'Prohibited',
    restricted: true,
  },
]

export const BASELINE_SURVEILLANCE_RECORDS = [
  // Rajshahi (18 cases - Critical, Zoonotic Active)
  { id: 'base-raj-ulo', district: 'Rajshahi', upazila: 'Paba', reporterRole: 'ulo_hospital', reporterName: 'Paba ULO Hospital', species: 'Layer', disease: 'Avian Influenza', antibioticPrescribed: 'None / Supportive Only', mortalityCount: 64, cases: 7, timestamp: '2026-11-24T09:15:00Z' },
  { id: 'base-raj-vet', district: 'Rajshahi', upazila: 'Mohonpur', reporterRole: 'bvc_vet', reporterName: 'Dr. Sarah Ahmed (BVC-10492)', species: 'Broiler', disease: 'Salmonellosis', antibioticPrescribed: 'Amoxicillin', mortalityCount: 28, cases: 6, timestamp: '2026-11-24T11:30:00Z' },
  { id: 'base-raj-ai', district: 'Rajshahi', upazila: 'Charghat', reporterRole: 'farmer_ai', reporterName: 'AI Field Screening', species: 'Sonali', disease: 'Newcastle / Ranikhet', antibioticPrescribed: 'None / Supportive Only', mortalityCount: 35, cases: 5, timestamp: '2026-11-24T14:10:00Z' },

  // Mymensingh (16 cases - Critical, Non-zoonotic)
  { id: 'base-mym-ulo', district: 'Mymensingh', upazila: 'Trishal', reporterRole: 'ulo_hospital', reporterName: 'Trishal ULO Livestock Office', species: 'Broiler', disease: 'Coccidiosis', antibioticPrescribed: 'Sulfadiazine + Trimethoprim', mortalityCount: 18, cases: 6, timestamp: '2026-11-24T08:40:00Z' },
  { id: 'base-mym-vet', district: 'Mymensingh', upazila: 'Bhaluka', reporterRole: 'bvc_vet', reporterName: 'BAU Alumni Vet Clinic', species: 'Layer', disease: 'Coccidiosis', antibioticPrescribed: 'Sulfadiazine + Trimethoprim', mortalityCount: 14, cases: 5, timestamp: '2026-11-24T10:20:00Z' },
  { id: 'base-mym-ai', district: 'Mymensingh', upazila: 'Fulbaria', reporterRole: 'farmer_ai', reporterName: 'AI Field Screening', species: 'Sonali', disease: 'Infectious Coryza', antibioticPrescribed: 'Doxycycline', mortalityCount: 9, cases: 5, timestamp: '2026-11-24T13:05:00Z' },

  // Bogura (14 cases - High, Zoonotic Active)
  { id: 'base-bog-ulo', district: 'Bogura', upazila: 'Sherpur', reporterRole: 'ulo_hospital', reporterName: 'Sherpur ULO Vet Unit', species: 'Sonali', disease: 'Newcastle / Ranikhet', antibioticPrescribed: 'None / Supportive Only', mortalityCount: 30, cases: 5, timestamp: '2026-11-24T09:00:00Z' },
  { id: 'base-bog-vet', district: 'Bogura', upazila: 'Shajahanpur', reporterRole: 'bvc_vet', reporterName: 'Dr. Tariqul Islam (BVC-11284)', species: 'Broiler', disease: 'Colibacillosis', antibioticPrescribed: 'Ciprofloxacin', mortalityCount: 19, cases: 5, timestamp: '2026-11-24T12:15:00Z' },
  { id: 'base-bog-ai', district: 'Bogura', upazila: 'Bogura Sadar', reporterRole: 'farmer_ai', reporterName: 'AI Field Screening', species: 'Sonali', disease: 'Newcastle / Ranikhet', antibioticPrescribed: 'Doxycycline', mortalityCount: 22, cases: 4, timestamp: '2026-11-24T15:00:00Z' },

  // Chattogram (14 cases - High, Zoonotic Active)
  { id: 'base-ctg-ulo', district: 'Chattogram', upazila: 'Sitakunda', reporterRole: 'ulo_hospital', reporterName: 'Sitakunda ULO Hospital', species: 'Layer', disease: 'Salmonellosis', antibioticPrescribed: 'Enrofloxacin', mortalityCount: 24, cases: 6, timestamp: '2026-11-23T16:30:00Z' },
  { id: 'base-ctg-vet', district: 'Chattogram', upazila: 'Hathazari', reporterRole: 'bvc_vet', reporterName: 'CVASU Field Extension Vet', species: 'Broiler', disease: 'Avian Influenza', antibioticPrescribed: 'None / Supportive Only', mortalityCount: 48, cases: 4, timestamp: '2026-11-24T08:10:00Z' },
  { id: 'base-ctg-ai', district: 'Chattogram', upazila: 'Mirsharai', reporterRole: 'farmer_ai', reporterName: 'AI Field Screening', species: 'Broiler', disease: 'Colibacillosis', antibioticPrescribed: 'Doxycycline', mortalityCount: 15, cases: 4, timestamp: '2026-11-24T11:45:00Z' },

  // Gazipur (13 cases - High, Non-zoonotic)
  { id: 'base-gaz-ulo', district: 'Gazipur', upazila: 'Sreepur', reporterRole: 'ulo_hospital', reporterName: 'Sreepur ULO Poultry Desk', species: 'Broiler', disease: 'Gumboro', antibioticPrescribed: 'None / Supportive Only', mortalityCount: 27, cases: 5, timestamp: '2026-11-23T15:20:00Z' },
  { id: 'base-gaz-vet', district: 'Gazipur', upazila: 'Kapasia', reporterRole: 'bvc_vet', reporterName: 'Dr. Farhana Rahman (BVC-09871)', species: 'Layer', disease: 'CRD', antibioticPrescribed: 'Tylosin', mortalityCount: 8, cases: 4, timestamp: '2026-11-24T09:50:00Z' },
  { id: 'base-gaz-ai', district: 'Gazipur', upazila: 'Kaliakoir', reporterRole: 'farmer_ai', reporterName: 'AI Field Screening', species: 'Broiler', disease: 'Gumboro', antibioticPrescribed: 'Doxycycline', mortalityCount: 19, cases: 4, timestamp: '2026-11-24T13:40:00Z' },

  // Pabna (11 cases - High, Non-zoonotic)
  { id: 'base-pab-ulo', district: 'Pabna', upazila: 'Ishwardi', reporterRole: 'ulo_hospital', reporterName: 'Ishwardi ULO Livestock Complex', species: 'Layer', disease: 'Infectious Coryza', antibioticPrescribed: 'Oxytetracycline', mortalityCount: 10, cases: 4, timestamp: '2026-11-23T14:15:00Z' },
  { id: 'base-pab-vet', district: 'Pabna', upazila: 'Santhia', reporterRole: 'bvc_vet', reporterName: 'Pabna BVC Poultry Consultant', species: 'Broiler', disease: 'CRD', antibioticPrescribed: 'Tylosin', mortalityCount: 9, cases: 4, timestamp: '2026-11-24T10:05:00Z' },
  { id: 'base-pab-ai', district: 'Pabna', upazila: 'Atghoria', reporterRole: 'farmer_ai', reporterName: 'AI Field Screening', species: 'Desi / Native', disease: 'Fowl Pox', antibioticPrescribed: 'None / Supportive Only', mortalityCount: 4, cases: 3, timestamp: '2026-11-24T12:55:00Z' },

  // Cumilla (10 cases - High, Non-zoonotic)
  { id: 'base-cum-ulo', district: 'Cumilla', upazila: 'Daudkandi', reporterRole: 'ulo_hospital', reporterName: 'Daudkandi ULO Hospital', species: 'Duck', disease: 'Fowl Cholera', antibioticPrescribed: 'Enrofloxacin', mortalityCount: 16, cases: 4, timestamp: '2026-11-23T11:20:00Z' },
  { id: 'base-cum-vet', district: 'Cumilla', upazila: 'Chandina', reporterRole: 'bvc_vet', reporterName: 'Cumilla Registered Vet Desk', species: 'Broiler', disease: 'Gumboro', antibioticPrescribed: 'None / Supportive Only', mortalityCount: 15, cases: 3, timestamp: '2026-11-24T08:50:00Z' },
  { id: 'base-cum-ai', district: 'Cumilla', upazila: 'Laksam', reporterRole: 'farmer_ai', reporterName: 'AI Field Screening', species: 'Sonali', disease: 'Coccidiosis', antibioticPrescribed: 'Sulfadiazine + Trimethoprim', mortalityCount: 9, cases: 3, timestamp: '2026-11-24T14:25:00Z' },

  // Rangpur (9 cases - High, Zoonotic Active)
  { id: 'base-rng-ulo', district: 'Rangpur', upazila: 'Rangpur Sadar', reporterRole: 'ulo_hospital', reporterName: 'Rangpur Sadar ULO Hospital', species: 'Broiler', disease: 'Campylobacteriosis', antibioticPrescribed: 'Tylosin', mortalityCount: 11, cases: 3, timestamp: '2026-11-23T13:10:00Z' },
  { id: 'base-rng-vet', district: 'Rangpur', upazila: 'Pirganj', reporterRole: 'bvc_vet', reporterName: 'Rangpur BVC Field Vet', species: 'Layer', disease: 'Colibacillosis', antibioticPrescribed: 'Amoxicillin', mortalityCount: 14, cases: 3, timestamp: '2026-11-24T09:30:00Z' },
  { id: 'base-rng-ai', district: 'Rangpur', upazila: 'Mithapukur', reporterRole: 'farmer_ai', reporterName: 'AI Field Screening', species: 'Desi / Native', disease: 'Salmonellosis', antibioticPrescribed: 'Oxytetracycline', mortalityCount: 12, cases: 3, timestamp: '2026-11-24T13:50:00Z' },
]

export function getDiseaseDisplayLabel(diseaseName, language, t) {
  if (!diseaseName) return ''
  const raw = String(diseaseName).trim()
  const keyDirect = `diseases.${raw}`
  if (t) {
    const translated = t(keyDirect, { defaultValue: '' })
    if (translated && translated !== keyDirect) return translated
  }
  const found = SURVEILLANCE_DISEASES.find(
    (d) => d.id.toLowerCase() === raw.toLowerCase() || d.labelEn.toLowerCase() === raw.toLowerCase()
  )
  if (found) return language === 'bn' ? found.labelBn : found.labelEn
  return raw
}
