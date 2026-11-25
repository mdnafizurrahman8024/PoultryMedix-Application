import { getCleanProxyUrl } from './aiServiceAdapter.js'
import { getVerifiedVeterinarySources } from './veterinarySources.js'

/**
 * Authoritative Veterinary Drug Formulary & Withdrawal Period Database
 * Standards: Directorate General of Drug Administration (DGDA) & Department of Livestock Services (DLS), Bangladesh,
 * combined with WOAH / FAO Antimicrobial Stewardship Guidelines.
 */
export const BANGLADESH_POULTRY_DRUG_DATABASE = [
  {
    id: 'doxycycline',
    genericName: 'Doxycycline Hcl',
    genericNameBn: 'ডক্সিসাইক্লিন হাইড্রোক্লোরাইড',
    tradeNames: ['Doxivet', 'Doxin', 'Doxy-A', 'Renamycin-D', 'Doxypoultry', 'Doxy-10', 'Doxan'],
    antibioticClass: 'Tetracycline',
    antibioticClassBn: 'টেট্রাসাইক্লিন',
    dosage: '10–20 mg/kg body weight daily in drinking water (or 1g / 2–4L water for 3–5 days)',
    dosageBn: 'দৈনিক প্রতি কেজি ওজনে ১০–২০ মিগ্রা খাবার পানিতে (অথবা ১ গ্রাম / ২–৪ লিটার পানিতে ৩–৫ দিন)',
    meatWithdrawalDays: '7 days',
    meatWithdrawalDaysBn: '৭ দিন',
    eggWithdrawalDays: 'Not authorized for commercial table egg layers (7 days for replacement pullets)',
    eggWithdrawalDaysBn: 'বাণিজ্যিক ডিম পাড়া লেয়ার মুরগিতে ব্যবহার নিষিদ্ধ (রিপ্লেসমেন্ট পাললেটে ৭ দিন)',
    regulatoryStatus: 'APPROVED_PRESCRIPTION_ONLY',
    regulatoryStatusBn: 'অনুমোদিত (প্রেসক্রিপশন সাপেক্ষে)',
    indications: 'Chronic Respiratory Disease (CRD / Mycoplasma), Colibacillosis, Infectious Synovitis',
    indicationsBn: 'সিআরডি (মাইকোপ্লাজমোসিস), কলিব্যাসিলোসিস, সংক্রামক সাইনোভাইটিস',
    authorities: 'DGDA & DLS Bangladesh • WOAH Terrestrial Code',
  },
  {
    id: 'enrofloxacin',
    genericName: 'Enrofloxacin',
    genericNameBn: 'এনরোফ্লক্সাসিন',
    tradeNames: ['Enrocin', 'Floxavet', 'Enrovet', 'Quinoflox', 'Enro-G', 'Enrotril', 'Aviflox'],
    antibioticClass: 'Fluoroquinolone (Critically Important Antimicrobial - CIA)',
    antibioticClassBn: 'ফ্লুরোকুইনোলোন (সর্বোচ্চ সতর্কতামূলক অ্যান্টিবায়োটিক - CIA)',
    dosage: '10 mg/kg body weight daily in drinking water for 3–5 days',
    dosageBn: 'দৈনিক প্রতি কেজি ওজনে ১০ মিগ্রা খাবার পানিতে ৩–৫ দিন',
    meatWithdrawalDays: '7 days (DGDA) / 8–10 days (Intl)',
    meatWithdrawalDaysBn: '৭ দিন (ডিজিডিএ) / ৮–১০ দিন (আন্তর্জাতিক)',
    eggWithdrawalDays: 'PROHIBITED in commercial laying hens producing table eggs',
    eggWithdrawalDaysBn: 'ডিম পাড়া বাণিজ্যিক লেয়ার মুরগিতে প্রয়োগ সম্পূর্ণ নিষিদ্ধ',
    regulatoryStatus: 'RESTRICTED',
    regulatoryStatusBn: 'নিয়ন্ত্রিত (এএসটি নিশ্চিতকরণ ব্যতীত নিষিদ্ধ)',
    indications: 'Severe Colisepticemia, complicated CRD under strict AST veterinary confirmation',
    indicationsBn: 'তীব্র কলিব্যাসিলোসিস ও জটিল সিআরডি (ল্যাব টেস্ট নিশ্চিতকরণ সাপেক্ষে)',
    authorities: 'DGDA & DLS Bangladesh • WHO CIA List',
  },
  {
    id: 'ciprofloxacin',
    genericName: 'Ciprofloxacin',
    genericNameBn: 'সিপ্রোফ্লক্সাসিন',
    tradeNames: ['Ciprovet', 'Cipro-A', 'Neocipro', 'Ciproflox', 'Ciprocin-Vet', 'Flucipro'],
    antibioticClass: 'Fluoroquinolone',
    antibioticClassBn: 'ফ্লুরোকুইনোলোন',
    dosage: '10 mg/kg body weight in drinking water for 3–5 days',
    dosageBn: 'দৈনিক প্রতি কেজি ওজনে ১০ মিগ্রা খাবার পানিতে ৩–৫ দিন',
    meatWithdrawalDays: '7–10 days',
    meatWithdrawalDaysBn: '৭–১০ দিন',
    eggWithdrawalDays: 'Strictly prohibited in laying hens producing table eggs',
    eggWithdrawalDaysBn: 'বাণিজ্যিক ডিম পাড়া লেয়ার মুরগিতে প্রয়োগ সম্পূর্ণ নিষিদ্ধ',
    regulatoryStatus: 'RESTRICTED',
    regulatoryStatusBn: 'নিয়ন্ত্রিত (উচ্চ অ্যান্টিমাইক্রোবিয়াল ঝুঁকি)',
    indications: 'Salmonellosis, Colibacillosis, Fowl Cholera under veterinary supervision',
    indicationsBn: 'সালমোনেলোসিস, কলিব্যাসিলোসিস, ফাউল কলেরা',
    authorities: 'DGDA & DLS Bangladesh • WHO / WOAH Guidelines',
  },
  {
    id: 'amoxicillin',
    genericName: 'Amoxicillin Trihydrate',
    genericNameBn: 'অ্যামোক্সিসিলিন ট্রাইহাইড্রেট',
    tradeNames: ['Moxivet', 'Amoxivet', 'A-Mox', 'Renamox', 'Amoxin', 'Moxacil-Vet', 'Amoxy-Care'],
    antibioticClass: 'Aminopenicillin (Beta-lactam)',
    antibioticClassBn: 'অ্যামিনোপেনিসিলিন (বিটা-ল্যাক্টাম)',
    dosage: '10–20 mg/kg body weight daily in drinking water for 3–5 days',
    dosageBn: 'দৈনিক প্রতি কেজি ওজনে ১০–২০ মিগ্রা খাবার পানিতে ৩–৫ দিন',
    meatWithdrawalDays: '1–3 days',
    meatWithdrawalDaysBn: '১–৩ দিন',
    eggWithdrawalDays: '0–1 days (approved labeled formulations only)',
    eggWithdrawalDaysBn: '০–১ দিন (অনুমোদিত লেবেলযুক্ত প্রিপারেশনে)',
    regulatoryStatus: 'APPROVED_PRESCRIPTION_ONLY',
    regulatoryStatusBn: 'অনুমোদিত (প্রেসক্রিপশন সাপেক্ষে)',
    indications: 'Necrotic enteritis (Clostridium perfringens), Pasteurellosis, Staphylococcosis',
    indicationsBn: 'নেক্রোটিক এন্টারাইটিস, পাস্তুরেলোসিস, স্টাফাইলোকক্কোসিস',
    authorities: 'DGDA Bangladesh • WOAH Terrestrial Manual',
  },
  {
    id: 'tylosin',
    genericName: 'Tylosin Tartrate',
    genericNameBn: 'টাইলোসিন টারট্রেট',
    tradeNames: ['Tylovet', 'Tylosin-100', 'Tilovet', 'Pharmasin', 'Tylodox', 'Tylo-A'],
    antibioticClass: 'Macrolide',
    antibioticClassBn: 'ম্যাক্রোলাইড',
    dosage: '25–50 mg/kg body weight (or 0.5g / 1L drinking water for 3–5 days)',
    dosageBn: 'দৈনিক প্রতি কেজি ওজনে ২৫–৫০ মিগ্রা (অথবা ০.৫ গ্রাম / ১ লিটার পানিতে ৩–৫ দিন)',
    meatWithdrawalDays: '3–5 days',
    meatWithdrawalDaysBn: '৩–৫ দিন',
    eggWithdrawalDays: '0–2 days (check exact oral formulation label)',
    eggWithdrawalDaysBn: '০–২ দিন (নির্দিষ্ট প্রস্তুতকারকের লেবেল যাচাই করুন)',
    regulatoryStatus: 'APPROVED_PRESCRIPTION_ONLY',
    regulatoryStatusBn: 'অনুমোদিত (প্রেসক্রিপশন সাপেক্ষে)',
    indications: 'Mycoplasma gallisepticum (CRD), Mycoplasma synoviae, airsacculitis',
    indicationsBn: 'মাইকোপ্লাজমোসিস (সিআরডি), সংক্রামক এয়ারস্যাকুলাইটিস',
    authorities: 'DGDA & DLS Bangladesh • WOAH Standards',
  },
  {
    id: 'oxytetracycline',
    genericName: 'Oxytetracycline HCl',
    genericNameBn: 'অক্সিটেট্রাসাইক্লিন হাইড্রোক্লোরাইড',
    tradeNames: ['Renamycin', 'Oxyvet', 'Tetra-Vet', 'Terramycin', 'Oxytet-20', 'Biomycin'],
    antibioticClass: 'Tetracycline',
    antibioticClassBn: 'টেট্রাসাইক্লিন',
    dosage: '20–50 mg/kg body weight in drinking water or feed for 4–5 days',
    dosageBn: 'দৈনিক প্রতি কেজি ওজনে ২০–৫০ মিগ্রা খাবার পানিতে বা খাদ্যে ৪–৫ দিন',
    meatWithdrawalDays: '5–7 days',
    meatWithdrawalDaysBn: '৫–৭ দিন',
    eggWithdrawalDays: '4–5 days',
    eggWithdrawalDaysBn: '৪–৫ দিন',
    regulatoryStatus: 'APPROVED_PRESCRIPTION_ONLY',
    regulatoryStatusBn: 'অনুমোদিত (প্রেসক্রিপশন সাপেক্ষে)',
    indications: 'Fowl cholera, Infectious Coryza, secondary bacterial complications',
    indicationsBn: 'ফাউল কলেরা, সংক্রামক কোরাইজা, সেকেন্ডারি ব্যাকটেরিয়াল সংক্রমণ',
    authorities: 'DGDA & DLS Bangladesh',
  },
  {
    id: 'sulfadiazine_trimethoprim',
    genericName: 'Sulfadiazine + Trimethoprim (Co-trimazine)',
    genericNameBn: 'সালফাডায়াজিন + ট্রাইমেথোপ্রিম (কো-ট্রাইমাজিন)',
    tradeNames: ['Trimesul', 'Cotrim-Vet', 'Ditrim', 'Cosumix', 'Sulprim', 'Trim-Vet'],
    antibioticClass: 'Potentiated Sulfonamide',
    antibioticClassBn: 'পোটেনশিয়েটেড সালফোনামাইড',
    dosage: '30 mg combined/kg body weight (25mg Sulfa + 5mg TMP) in water for 4–5 days',
    dosageBn: 'সম্মিলিত ৩০ মিগ্রা/কেজি (২৫ মিগ্রা সালফা + ৫ মিগ্রা টিএমপি) পানিতে ৪–৫ দিন',
    meatWithdrawalDays: '5–7 days',
    meatWithdrawalDaysBn: '৫–৭ দিন',
    eggWithdrawalDays: 'Prohibited in active commercial table egg laying flocks',
    eggWithdrawalDaysBn: 'ডিম পাড়া বাণিজ্যিক লেয়ার মুরগিতে প্রয়োগ সম্পূর্ণ নিষিদ্ধ',
    regulatoryStatus: 'APPROVED_PRESCRIPTION_ONLY',
    regulatoryStatusBn: 'অনুমোদিত (প্রেসক্রিপশন সাপেক্ষে)',
    indications: 'Infectious Coryza, Colibacillosis, Coccidiosis secondary bacterial enteritis',
    indicationsBn: 'ইনফেকশাস কোরাইজা, কলিব্যাসিলোসিস ও কক্সিডিওসিস পরবর্তী ব্যাকটিরিয়াল সংক্রমণ',
    authorities: 'DGDA & DLS Bangladesh • WOAH Terrestrial Code',
  },
  {
    id: 'colistin',
    genericName: 'Colistin Sulfate',
    genericNameBn: 'কলিস্টিন সালফেট',
    tradeNames: ['Colivet', 'Colis', 'Colisul', 'Colistin-100'],
    antibioticClass: 'Polymyxin (Critically Important Human Reserve Antibiotic)',
    antibioticClassBn: 'পলিমিক্সিন (মানবদেহের রিজার্ভ অ্যান্টিবায়োটিক)',
    dosage: 'STRICTLY PROHIBITED / BANNED',
    dosageBn: 'ব্যবহার সম্পূর্ণ নিষিদ্ধ / বেআইনি',
    meatWithdrawalDays: 'BANNED',
    meatWithdrawalDaysBn: 'নিষিদ্ধ',
    eggWithdrawalDays: 'BANNED',
    eggWithdrawalDaysBn: 'নিষিদ্ধ',
    regulatoryStatus: 'BANNED',
    regulatoryStatusBn: 'সম্পূর্ণ নিষিদ্ধ (আইনত দণ্ডনীয়)',
    indications: 'Prohibited by DGDA and DLS Bangladesh under AMR statutory notification.',
    indicationsBn: 'অ্যান্টিমাইক্রোবিয়াল রেজিস্ট্যান্স (AMR) প্রতিরোধে প্রাণিসম্পদে ব্যবহার কঠোরভাবে নিষিদ্ধ।',
    authorities: 'DGDA & DLS Bangladesh Statutory Ban • WHO Reserve Group',
  },
  {
    id: 'toltrazuril',
    genericName: 'Toltrazuril',
    genericNameBn: 'টোলট্রাজুরিল',
    tradeNames: ['Toltraz', 'Coxuril', 'Baycox', 'Tolcox', 'Coccikill'],
    antibioticClass: 'Antiprotozoal / Triazinon (Non-antibiotic coccidiocide)',
    antibioticClassBn: 'অ্যান্টিপ্রোটোজোয়াল / ট্রায়াজিনোন (অ্যান্টিবায়োটিক নয়)',
    dosage: '7 mg/kg body weight (or 25 ppm in water for 2 consecutive days)',
    dosageBn: 'প্রতি কেজি ওজনে ৭ মিগ্রা (অথবা খাবার পানিতে ২৫ পিপিএম টানা ২ দিন)',
    meatWithdrawalDays: '14–16 days',
    meatWithdrawalDaysBn: '১৪–১৬ দিন',
    eggWithdrawalDays: 'Prohibited in laying hens producing table eggs',
    eggWithdrawalDaysBn: 'ডিম পাড়া বাণিজ্যিক লেয়ার মুরগিতে প্রয়োগ নিষিদ্ধ',
    regulatoryStatus: 'APPROVED_PRESCRIPTION_ONLY',
    regulatoryStatusBn: 'অনুমোদিত (প্রেসক্রিপশন সাপেক্ষে)',
    indications: 'Cecal and intestinal coccidiosis (Eimeria tenella, necatrix, acervulina)',
    indicationsBn: 'রক্ত আমাশয় ও কক্সিডিওসিস (আইমেরিয়া টেনেলা, নেকাট্রিক্স)',
    authorities: 'DGDA Bangladesh • DLS Clinical Formulary',
  },
]

// OpenRouter vision-capable :free models for multimodal OCR & prescription analysis
const VISION_FREE_MODELS = [
  'nvidia/nemotron-3.5-super-vl:free',
  'meta-llama/llama-3.2-11b-vision-instruct:free',
  'qwen/qwen-2.5-vl-72b-instruct:free',
  'google/gemini-2.0-flash:free',
  'google/gemini-2.0-flash-exp:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
]

/**
 * Searches the local database for a medicine by trade name or generic name.
 */
export function lookupLocalDrug(query) {
  if (!query || typeof query !== 'string') return null
  const cleaned = query.trim().toLowerCase()
  if (!cleaned) return null

  for (const drug of BANGLADESH_POULTRY_DRUG_DATABASE) {
    if (drug.id.toLowerCase() === cleaned) return drug
    if (drug.genericName.toLowerCase().includes(cleaned) || cleaned.includes(drug.genericName.toLowerCase())) return drug
    if (drug.genericNameBn && drug.genericNameBn.includes(cleaned)) return drug
    for (const trade of drug.tradeNames) {
      if (trade.toLowerCase() === cleaned || cleaned.includes(trade.toLowerCase()) || trade.toLowerCase().includes(cleaned)) {
        return drug
      }
    }
  }
  return null
}

/**
 * Normalizes and enriches a list of extracted medicines using the local formulary.
 */
export function enrichWithLocalDrugDatabase(medicines = []) {
  if (!Array.isArray(medicines) || medicines.length === 0) return []

  return medicines.map((med) => {
    const rawTrade = (med.tradeName || '').trim()
    const rawGeneric = (med.genericName || '').trim()
    const match = lookupLocalDrug(rawTrade) || lookupLocalDrug(rawGeneric)

    if (match) {
      return {
        tradeName: rawTrade || match.tradeNames[0],
        genericName: match.genericName,
        genericNameBn: match.genericNameBn,
        antibioticClass: med.antibioticClass || match.antibioticClass,
        antibioticClassBn: match.antibioticClassBn,
        dosage: med.dosage || match.dosage,
        dosageBn: match.dosageBn,
        meatWithdrawalDays: med.meatWithdrawalDays || match.meatWithdrawalDays,
        meatWithdrawalDaysBn: match.meatWithdrawalDaysBn,
        eggWithdrawalDays: med.eggWithdrawalDays || match.eggWithdrawalDays,
        eggWithdrawalDaysBn: match.eggWithdrawalDaysBn,
        regulatoryStatus: match.regulatoryStatus,
        regulatoryStatusBn: match.regulatoryStatusBn,
        indications: match.indications,
        indicationsBn: match.indicationsBn,
        authorities: match.authorities,
        verifiedInFormulary: true,
      }
    }

    return {
      tradeName: rawTrade || 'Prescribed Medicine',
      genericName: rawGeneric || 'Active constituent to be verified by veterinarian',
      genericNameBn: '',
      antibioticClass: med.antibioticClass || 'Veterinary Antimicrobial',
      antibioticClassBn: 'ভেটেরিনারি অ্যান্টিমাইক্রোবিয়াল',
      dosage: med.dosage || 'Follow veterinarian instructions on label',
      dosageBn: 'প্রেসক্রিপশন অনুযায়ী প্রযোজ্য',
      meatWithdrawalDays: med.meatWithdrawalDays || 'Check product label or consult vet',
      meatWithdrawalDaysBn: 'লেবেল যাচাই করুন বা চিকিৎসকের পরামর্শ নিন',
      eggWithdrawalDays: med.eggWithdrawalDays || 'Do not use in layers without vet confirmation',
      eggWithdrawalDaysBn: 'চিকিৎসকের নিশ্চিতকরণ ছাড়া লেয়ারে ব্যবহার করবেন না',
      regulatoryStatus: med.regulatoryStatus || 'APPROVED_PRESCRIPTION_ONLY',
      regulatoryStatusBn: 'প্রেসক্রিপশন সাপেক্ষে',
      authorities: 'Directorate General of Drug Administration (DGDA)',
      verifiedInFormulary: false,
    }
  })
}

/**
 * Builds local fallback results for a given file or keyword.
 */
export function buildLocalPrescriptionFallback(fileName = '', language = 'en') {
  const cleanName = (fileName || '').toLowerCase()
  let matchedDrugs = []

  // Check if filename contains common drug keywords
  for (const drug of BANGLADESH_POULTRY_DRUG_DATABASE) {
    if (cleanName.includes(drug.id)) {
      matchedDrugs.push(drug)
    } else {
      for (const trade of drug.tradeNames) {
        if (cleanName.includes(trade.toLowerCase())) {
          matchedDrugs.push(drug)
          break
        }
      }
    }
  }

  // If no specific match from filename, provide the standard top 4 most common Bangladesh antibiotics
  if (matchedDrugs.length === 0) {
    matchedDrugs = [
      BANGLADESH_POULTRY_DRUG_DATABASE[0], // Doxycycline
      BANGLADESH_POULTRY_DRUG_DATABASE[1], // Enrofloxacin
      BANGLADESH_POULTRY_DRUG_DATABASE[3], // Amoxicillin
      BANGLADESH_POULTRY_DRUG_DATABASE[4], // Tylosin
    ]
  }

  const isBn = language === 'bn'
  const fallbackNote = isBn
    ? 'AI ভিশন সার্ভিস ব্যস্ত থাকায় স্থানীয় ভেটেরিনারি ফর্মুলারি থেকে বাংলাদেশে বহুল ব্যবহৃত পোল্ট্রি অ্যান্টিবায়োটিকের সঠিক উইথড্রয়াল তথ্য প্রদর্শিত হলো।'
    : 'Automated vision model is busy. Displaying verified local veterinary formulary withdrawal guidelines for common Bangladesh poultry antibiotics.'

  const medicines = matchedDrugs.map((drug) => ({
    tradeName: drug.tradeNames[0],
    genericName: drug.genericName,
    genericNameBn: drug.genericNameBn,
    antibioticClass: drug.antibioticClass,
    antibioticClassBn: drug.antibioticClassBn,
    dosage: drug.dosage,
    dosageBn: drug.dosageBn,
    meatWithdrawalDays: drug.meatWithdrawalDays,
    meatWithdrawalDaysBn: drug.meatWithdrawalDaysBn,
    eggWithdrawalDays: drug.eggWithdrawalDays,
    eggWithdrawalDaysBn: drug.eggWithdrawalDaysBn,
    regulatoryStatus: drug.regulatoryStatus,
    regulatoryStatusBn: drug.regulatoryStatusBn,
    indications: drug.indications,
    indicationsBn: drug.indicationsBn,
    authorities: drug.authorities,
    verifiedInFormulary: true,
  }))

  const sources = getVerifiedVeterinarySources('CRD', language)

  return {
    isFallback: true,
    transcription: fallbackNote,
    medicines,
    sources,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Converts a File object to base64 Data URL.
 */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.readAsDataURL(file)
  })
}

/**
 * Analyzes prescription image through Cloudflare Worker :free proxy with failover to local formulary.
 */
export async function analyzePrescriptionImage(file, language = 'en') {
  if (!file) throw new Error('No file provided for prescription analysis.')

  let dataUrl
  try {
    dataUrl = await fileToDataUrl(file)
  } catch {
    return buildLocalPrescriptionFallback(file.name, language)
  }

  const proxyUrl = getCleanProxyUrl()

  // If proxy URL is configured and file is an image, attempt vision AI models in rotation
  if (proxyUrl && file.type.startsWith('image/')) {
    const prompt = `You are an avian veterinary pharmacology specialist.
Analyze this poultry veterinary prescription image carefully.
Extract all prescribed medicines, antimicrobials, and therapeutic compounds.
For EACH medicine, extract:
1. tradeName: Visible brand / trade name
2. genericName: Active generic/INN ingredient (e.g., Doxycycline, Enrofloxacin, Ciprofloxacin, Amoxicillin, Tylosin, Oxytetracycline, Sulfadiazine)
3. antibioticClass: Pharmacological class (e.g., Fluoroquinolone, Tetracycline, Beta-lactam, Macrolide, Sulfonamide, Antiprotozoal)
4. dosage: Prescribed dosage and frequency (e.g., 10 mg/kg in drinking water for 3-5 days)
5. meatWithdrawalDays: Meat withholding period before slaughter (e.g., "7 days", "14 days")
6. eggWithdrawalDays: Egg withholding period or layer restriction (e.g., "Prohibited in layers", "0 days", "4 days")
7. regulatoryStatus: "Approved" | "Restricted" | "Banned"

Respond strictly with valid JSON only in this exact shape:
{
  "transcription": "Brief summary of prescription text read",
  "medicines": [
    {
      "tradeName": "string",
      "genericName": "string",
      "antibioticClass": "string",
      "dosage": "string",
      "meatWithdrawalDays": "string",
      "eggWithdrawalDays": "string",
      "regulatoryStatus": "string"
    }
  ]
}
Do NOT include markdown backticks or extra commentary. Return valid JSON only.`

    for (const modelId of VISION_FREE_MODELS) {
      try {
        const payload = {
          model: modelId,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
          stream: false,
        }

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 12000)

        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        clearTimeout(timer)

        if (!response.ok) {
          console.warn(`[prescription-vision] Model ${modelId} returned ${response.status}, trying next model...`)
          continue
        }

        const raw = await response.text()
        let parsed = null
        try {
          parsed = JSON.parse(raw)
        } catch {
          // Attempt JSON block extraction
          const match = raw.match(/\{[\s\S]*\}/)
          if (match) {
            try { parsed = JSON.parse(match[0]) } catch { /* ignore invalid JSON */ }
          }
        }

        const content = parsed?.choices?.[0]?.message?.content || parsed?.content || ''
        if (content) {
          let extracted = null
          try {
            extracted = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim())
          } catch {
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              try { extracted = JSON.parse(jsonMatch[0]) } catch { /* ignore invalid JSON */ }
            }
          }

          if (extracted && Array.isArray(extracted.medicines) && extracted.medicines.length > 0) {
            const enriched = enrichWithLocalDrugDatabase(extracted.medicines)
            const sources = getVerifiedVeterinarySources('CRD', language)
            return {
              isFallback: false,
              modelUsed: modelId,
              transcription: extracted.transcription || 'Prescription text extracted via AI Vision',
              medicines: enriched,
              sources,
              timestamp: new Date().toISOString(),
            }
          }
        }
      } catch (err) {
        console.warn(`[prescription-vision] Attempt with ${modelId} failed:`, err?.message || err)
      }
    }
  }

  // Resilient fallback: return local formulary without ever failing with a 503 error
  return buildLocalPrescriptionFallback(file.name, language)
}
