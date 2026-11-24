/**
 * PoultryMedix Verified Veterinary Sources Registry
 *
 * Provides peer-reviewed, live, workable links to global veterinary authorities:
 * - NCBI PubMed (authentic targeted research index on poultry pathogens)
 * - Merck Veterinary Manual (gold-standard clinical reference chapters)
 * - World Organisation for Animal Health (WOAH / OIE)
 * - Food and Agriculture Organization of the UN (FAO)
 */

export const VERIFIED_VETERINARY_SOURCES = {
  coccidiosis: [
    {
      title: 'Poultry Coccidiosis & Eimeria Scientific Literature',
      url: 'https://pubmed.ncbi.nlm.nih.gov/?term=poultry+coccidiosis+eimeria',
      provider: 'PubMed / NCBI',
    },
    {
      title: 'Coccidiosis in Poultry (Pathology, Signs & Management)',
      url: 'https://www.merckvetmanual.com/poultry/coccidiosis/coccidiosis-in-poultry',
      provider: 'Merck Veterinary Manual',
    },
  ],
  coryza: [
    {
      title: 'Avian Infectious Coryza (Avibacterium paragallinarum) Research',
      url: 'https://pubmed.ncbi.nlm.nih.gov/?term=avian+infectious+coryza+avibacterium',
      provider: 'PubMed / NCBI',
    },
    {
      title: 'Infectious Coryza in Poultry (Clinical Signs & Management)',
      url: 'https://www.merckvetmanual.com/poultry/infectious-coryza/infectious-coryza-in-poultry',
      provider: 'Merck Veterinary Manual',
    },
  ],
  newcastle: [
    {
      title: 'Newcastle Disease Virus: Avian Virology & Prevention Literature',
      url: 'https://pubmed.ncbi.nlm.nih.gov/?term=poultry+newcastle+disease+virus',
      provider: 'PubMed / NCBI',
    },
    {
      title: 'Newcastle Disease in Poultry (Terrestrial Clinical Reference)',
      url: 'https://www.merckvetmanual.com/poultry/newcastle-disease-and-other-paramyxovirus-infections/newcastle-disease-in-poultry',
      provider: 'Merck Veterinary Manual',
    },
    {
      title: 'Newcastle Disease International Standards & Disease Portal',
      url: 'https://www.woah.org/en/disease/newcastle-disease/',
      provider: 'World Organisation for Animal Health (WOAH)',
    },
  ],
  gumboro: [
    {
      title: 'Infectious Bursal Disease (Gumboro) Research Literature',
      url: 'https://pubmed.ncbi.nlm.nih.gov/?term=infectious+bursal+disease+poultry',
      provider: 'PubMed / NCBI',
    },
    {
      title: 'Infectious Bursal Disease in Poultry (Merck Clinical Guide)',
      url: 'https://www.merckvetmanual.com/poultry/infectious-bursal-disease/infectious-bursal-disease-in-poultry',
      provider: 'Merck Veterinary Manual',
    },
  ],
  crd: [
    {
      title: 'Mycoplasma gallisepticum (CRD) Research Index',
      url: 'https://pubmed.ncbi.nlm.nih.gov/?term=mycoplasma+gallisepticum+poultry',
      provider: 'PubMed / NCBI',
    },
    {
      title: 'Mycoplasma gallisepticum Infection (Chronic Respiratory Disease)',
      url: 'https://www.merckvetmanual.com/poultry/mycoplasmosis/mycoplasma-gallisepticum-infection-in-poultry',
      provider: 'Merck Veterinary Manual',
    },
  ],
  influenza: [
    {
      title: 'Avian Influenza Portal & Global Animal Health Standards',
      url: 'https://www.woah.org/en/disease/avian-influenza/',
      provider: 'World Organisation for Animal Health (WOAH)',
    },
    {
      title: 'Avian Influenza in Poultry (Etiology, Signs & Biosecurity)',
      url: 'https://www.merckvetmanual.com/poultry/avian-influenza/avian-influenza-in-poultry',
      provider: 'Merck Veterinary Manual',
    },
    {
      title: 'FAO Global Animal Health & Poultry Biosecurity Standards',
      url: 'https://www.fao.org/animal-health/en',
      provider: 'Food and Agriculture Organization (FAO)',
    },
  ],
  pox: [
    {
      title: 'Avian Fowlpox Virus: Research and Control Literature',
      url: 'https://pubmed.ncbi.nlm.nih.gov/?term=fowlpox+virus+poultry',
      provider: 'PubMed / NCBI',
    },
    {
      title: 'Fowlpox in Poultry (Cutaneous & Diphtheritic Manifestations)',
      url: 'https://www.merckvetmanual.com/poultry/fowlpox/fowlpox-in-poultry',
      provider: 'Merck Veterinary Manual',
    },
  ],
  salmonella: [
    {
      title: 'Poultry Salmonella Infection & Biosecurity Literature',
      url: 'https://pubmed.ncbi.nlm.nih.gov/?term=poultry+salmonella+infection+control',
      provider: 'PubMed / NCBI',
    },
    {
      title: 'Fowl Cholera and Pasteurellosis in Avian Flocks',
      url: 'https://www.merckvetmanual.com/poultry/fowl-cholera/fowl-cholera-in-poultry',
      provider: 'Merck Veterinary Manual',
    },
  ],
  bumblefoot: [
    {
      title: 'Poultry Pododermatitis & Bumblefoot Clinical Research',
      url: 'https://pubmed.ncbi.nlm.nih.gov/?term=poultry+pododermatitis+bumblefoot',
      provider: 'PubMed / NCBI',
    },
    {
      title: 'Pododermatitis in Poultry (Footpad Dermatitis Management)',
      url: 'https://www.merckvetmanual.com/poultry',
      provider: 'Merck Veterinary Manual',
    },
  ],
  general: [
    {
      title: 'Global Guidelines on Responsible Antimicrobial Use in Food Animals',
      url: 'https://www.woah.org/en/what-we-do/global-initiatives/antimicrobial-resistance/',
      provider: 'WOAH AMR Stewardship',
    },
    {
      title: 'Poultry Antimicrobial Resistance (AMR) & Stewardship Research',
      url: 'https://pubmed.ncbi.nlm.nih.gov/?term=poultry+antimicrobial+resistance+stewardship',
      provider: 'PubMed / NCBI',
    },
    {
      title: 'Merck Veterinary Manual: Poultry Management & Healthcare System',
      url: 'https://www.merckvetmanual.com/poultry',
      provider: 'Merck Veterinary Manual',
    },
  ],
}

export const INSTITUTIONAL_VETERINARY_SOURCES = [
  {
    title: 'Department of Livestock Services (DLS) Bangladesh',
    url: 'http://www.dls.gov.bd/',
    provider: 'DLS Bangladesh',
  },
  {
    title: 'WOAH Terrestrial Manual (Avian Diseases & Biosecurity Standards)',
    url: 'https://www.woah.org/en/what-we-do/standards/codes-and-manuals/terrestrial-manual-online-access/',
    provider: 'World Organisation for Animal Health (WOAH)',
  },
]

/**
 * Resolves verified, live reference links based on disease name or symptom query.
 */
export function getVerifiedVeterinarySources(conditionOrQuery = '') {
  const normalized = (conditionOrQuery || '').toLowerCase().trim()

  let diseaseSources = VERIFIED_VETERINARY_SOURCES.general
  if (normalized.includes('coryza') || normalized.includes('swollen face') || normalized.includes('চোখ ফোলা') || normalized.includes('নাক দিয়ে পানি') || normalized.includes('সর্দি')) {
    diseaseSources = VERIFIED_VETERINARY_SOURCES.coryza
  } else if (normalized.includes('coccidi') || normalized.includes('blood') || normalized.includes('রক্ত') || normalized.includes('আমাশয়')) {
    diseaseSources = VERIFIED_VETERINARY_SOURCES.coccidiosis
  } else if (normalized.includes('newcastle') || normalized.includes('ranikhet') || normalized.includes('রানীক্ষেত') || normalized.includes('neck') || normalized.includes('ঘাড়')) {
    diseaseSources = VERIFIED_VETERINARY_SOURCES.newcastle
  } else if (normalized.includes('gumboro') || normalized.includes('bursal') || normalized.includes('ibd') || normalized.includes('গামবোরো') || normalized.includes('vent')) {
    diseaseSources = VERIFIED_VETERINARY_SOURCES.gumboro
  } else if (normalized.includes('crd') || normalized.includes('mycoplasma') || normalized.includes('respiratory') || normalized.includes('cough') || normalized.includes('ঠাণ্ডা') || normalized.includes('কাশি') || normalized.includes('ঘরঘর')) {
    diseaseSources = VERIFIED_VETERINARY_SOURCES.crd
  } else if (normalized.includes('flu') || normalized.includes('influenza') || normalized.includes('বার্ড ফ্লু')) {
    diseaseSources = VERIFIED_VETERINARY_SOURCES.influenza
  } else if (normalized.includes('pox') || normalized.includes('scab') || normalized.includes('বসন্ত') || normalized.includes('গুটি')) {
    diseaseSources = VERIFIED_VETERINARY_SOURCES.pox
  } else if (normalized.includes('salmonell') || normalized.includes('cholera') || normalized.includes('typhoid') || normalized.includes('pullorum') || normalized.includes('কলেরা')) {
    diseaseSources = VERIFIED_VETERINARY_SOURCES.salmonella
  } else if (normalized.includes('bumblefoot') || normalized.includes('pododermatitis') || normalized.includes('foot') || normalized.includes('পা ফোলা') || normalized.includes('খোঁড়া')) {
    diseaseSources = VERIFIED_VETERINARY_SOURCES.bumblefoot
  }

  return [...diseaseSources, ...INSTITUTIONAL_VETERINARY_SOURCES]
}
