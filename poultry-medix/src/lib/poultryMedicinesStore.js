import rawDatabase from '../data/poultryMedicines.json' with { type: 'json' }

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value
  Object.freeze(value)
  for (const prop of Object.values(value)) {
    if (prop && typeof prop === 'object' && !Object.isFrozen(prop)) {
      deepFreeze(prop)
    }
  }
  return value
}

export const POULTRY_MEDICINES_MASTER = deepFreeze(structuredClone(rawDatabase))

export function assertAuthenticatedAdminMutation(context) {
  const role = String(context?.role || '').toUpperCase()
  const hasValidToken = Boolean(context?.adminToken && String(context.adminToken).trim().length >= 16)
  if (!context?.isAuthenticated || role !== 'ADMIN' || !hasValidToken) {
    throw new Error('Unauthorized: medicine master database is read-only; mutations require authenticated ADMIN role.')
  }
}

export function getMedicineCategories() {
  return POULTRY_MEDICINES_MASTER.categories
}

export function getAllMasterMedicineEntries() {
  const list = []
  for (const cat of POULTRY_MEDICINES_MASTER.categories) {
    for (const gen of cat.generics) {
      for (const brand of gen.brands) {
        list.push(
          Object.freeze({
            key: `${cat.id}::${gen.genericName}::${brand.tradeName}`,
            categoryId: cat.id,
            category: cat.category,
            categoryBn: cat.categoryBn,
            requiresRegisteredVetRx: cat.requiresRegisteredVetRx,
            genericName: gen.genericName,
            whoAwareCategory: gen.whoAwareCategory || 'Access',
            formulation: gen.formulation,
            indicationEn: gen.indicationEn,
            indicationBn: gen.indicationBn,
            ...brand,
          })
        )
      }
    }
  }
  return Object.freeze(list)
}

export function mapFormulationToRxSelect(formulationText = '') {
  const f = String(formulationText || '').toLowerCase()
  if (f.includes('drop')) return 'Drops'
  if (f.includes('premix')) return 'Feed premix'
  if (f.includes('liquid') || f.includes('solution') || f.includes('syrup') || f.includes('suspension')) {
    return 'Oral Liquid'
  }
  return 'Water soluble powder'
}
