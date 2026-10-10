const medicineCatalog = [
  {
    key: 'colistin',
    searchTerms: ['colistin', 'colistin sulfate', 'colistin sulphate', 'polymyxin e'],
    tradeName: 'Colistin (all trade names)',
    genericMatch: 'Colistin sulfate (polymyxin E)',
    drugClass: 'Polymyxin antibiotic · critically important antimicrobial',
    safeUseGuidelines: 'RED FLAG: Do not use in poultry. A withdrawal interval does not make prohibited use acceptable. Confirm current requirements with the Bangladesh Department of Livestock Services (DLS) and the Directorate General of Drug Administration (DGDA).',
    localWithdrawal: 'Not applicable for prohibited use. Do not administer or market treated birds/products; contact DLS for case-specific direction.',
    internationalWithdrawal: 'No universal international withdrawal interval can be applied. WHO recommends restricting colistin use in food-producing animals to protect its effectiveness in human medicine.',
    restricted: true,
    reference: 'Bangladesh DLS / DGDA notices; WHO Guidelines on Use of Medically Important Antimicrobials in Food-Producing Animals (2017).',
  },
  {
    key: 'amoxicillin',
    searchTerms: ['amoxicillin', 'amoxycillin'],
    tradeName: 'Amoxicillin (trade name not verified)',
    genericMatch: 'Amoxicillin',
    drugClass: 'Beta-lactam · penicillin antibiotic',
    safeUseGuidelines: 'Antibiotics require veterinary diagnosis and a lawful, locally registered product. Use the exact product label and prescriber instructions; do not use a human formulation or share leftover medicine.',
    localWithdrawal: 'Product-specific. Use only the withdrawal period printed on the Bangladesh-registered product label; no generic interval is supplied here.',
    internationalWithdrawal: 'Product-, formulation-, and jurisdiction-specific. Consult the applicable regulator and exact product label; no universal interval is supplied here.',
    restricted: false,
    reference: 'Product label and Bangladesh DLS / DGDA guidance must be checked for the exact product.',
  },
]

export async function lookupMedicine(query) {
  await new Promise((resolve) => setTimeout(resolve, 350))

  const normalized = query.trim().toLocaleLowerCase()
  const match = medicineCatalog.find((medicine) => (
    medicine.searchTerms.some((term) => normalized.includes(term))
  ))
  return match ? { ...match } : null
}

export function calculatePrescriberDose(bodyWeightKg, prescribedMgPerKg) {
  if (!Number.isFinite(bodyWeightKg) || !Number.isFinite(prescribedMgPerKg)) return null
  if (bodyWeightKg <= 0 || prescribedMgPerKg <= 0) return null
  return bodyWeightKg * prescribedMgPerKg
}
