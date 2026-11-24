/**
 * Strict Clinical Safety & Anti-Hallucination Guardrail.
 *
 * SAFETY MANDATE:
 * Do not give any information on treatment procedures, drug suggestions, doses,
 * or specific drug names if the user asks for prescription advice.
 * For all other questions (differential signs, biosecurity, pathology, transmission,
 * hygiene, and AMR stewardship), give thorough, evidence-grounded answers.
 */

const PRESCRIPTION_REQUEST_PATTERNS = [
  /\b(what|which)\s+(medicine|drug|antibiotic|injection|pill|syrup|treatment|tablet)\b/i,
  /\b(how\s+to\s+treat|treatment\s+procedure|cure|treat\s+with)\b/i,
  /\b(suggest|recommend|prescribe|give)\s+(a\s+|some\s+)?(medicine|drug|antibiotic|dose|dosage|injection)\b/i,
  /\b(dose|dosage|how\s+much\s+(mg|ml|gram|packet|drop))\b/i,
  /\b(name\s+of\s+(the\s+)?(medicine|antibiotic|drug))\b/i,
  /(ওষুধ|ঔষধ|অ্যান্টিবায়োটিক|ডোজ|চিকিৎসা|কি\s+ওষুধ\s+দিব|কি\s+ঔষধ|মাত্রা)/i,
  /(दवा|एंटीबायोटिक|खुराक|इलाज|दवाई)/i,
  /(دوا|اینٹی\s*بائیوٹک|خوراک|علاج)/i,
]

export function isPrescriptionOrDoseRequest(userInput) {
  if (!userInput || typeof userInput !== 'string') return false
  const text = userInput.trim()
  return PRESCRIPTION_REQUEST_PATTERNS.some((pattern) => pattern.test(text))
}

export function generatePrescriptionSafetyResponse(language = 'en') {
  const responses = {
    en: {
      blocked: true,
      category: 'PRESCRIPTION_SAFETY_GUARDRAIL',
      message: 'Under National AMR Action Plan and Veterinary Council regulations, AI cannot provide treatment procedures, drug suggestions, dosages, or antibiotic names. Administering unprescribed antimicrobials causes fatal treatment failure and dangerous flock resistance. Please consult a licensed registered veterinarian or book an appointment via the Telemedicine tab.',
      guidance: [
        'Isolate symptomatic birds immediately in a warm, dry quarantine shed.',
        'Ensure fresh, clean drinking water with balanced electrolyte solution.',
        'Review strict farm biosecurity: disinfect footbaths and restrict external visitors.',
        'Request an on-site physical examination and Antimicrobial Susceptibility Testing (AST) from your local Upazila Livestock Officer (ULO).',
      ],
      regulatoryNotice: 'Department of Livestock Services (DLS) Bangladesh • One Health AMR Protocol',
    },
    bn: {
      blocked: true,
      category: 'PRESCRIPTION_SAFETY_GUARDRAIL',
      message: 'জাতীয় এএমআর (AMR) নীতিমালা এবং পশুচিকিৎসা আইন অনুযায়ী, এআই কোনো চিকিৎসা পদ্ধতি, ওষুধের পরামর্শ, ওষুধের নাম বা মাত্রা (ডোজ) প্রদান করতে পারে না। প্রেসক্রিপশন ছাড়া অ্যান্টিবায়োটিক ব্যবহার মারাত্মক অ্যান্টিমাইক্রোবিয়াল প্রতিরোধের সৃষ্টি করে। অনুগ্রহ করে একজন নিবন্ধিত পশুচিকিৎসকের পরামর্শ নিন অথবা টেলিমেডিসিনের মাধ্যমে যোগাযোগ করুন।',
      guidance: [
        'অসুস্থ পাখিদের অবিলম্বে আলাদা করে শুষ্ক ও উষ্ণ কোয়ারেন্টাইনে রাখুন।',
        'পর্যাপ্ত পরিষ্কার পানি এবং ইলেকট্রোলাইট স্যালাইন সরবরাহ করুন।',
        'খামারের জৈব-নিরাপত্তা কঠোর করুন এবং বাইরের দর্শনার্থীদের প্রবেশ বন্ধ রাখুন।',
        'সঠিক রোগ নির্ণয়ের জন্য স্থানীয় উপজেলা প্রাণিসম্পদ কর্মকর্তার (ULO) শরণাপন্ন হন।',
      ],
      regulatoryNotice: 'প্রাণিসম্পদ অধিদপ্তর (DLS) • ওয়ান হেলথ এএমআর নির্দেশিকা',
    },
  }

  return responses[language] || responses.en
}
