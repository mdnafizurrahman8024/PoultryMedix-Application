import {
  POULTRY_MEDICINES_MASTER,
  assertAuthenticatedAdminMutation,
  getAllMasterMedicineEntries,
  getMedicineCategories,
} from '../lib/poultryMedicinesStore.js'

export interface PoultryMedicineBrand {
  readonly tradeName: string
  readonly company: string
  readonly packSizes: readonly string[]
  readonly approxMrpBdt: string
  readonly standardDose: string
  readonly withdrawalPeriod: string
}

export interface PoultryMedicineGenericGroup {
  readonly genericName: string
  readonly whoAwareCategory?: 'Access' | 'Watch'
  readonly formulation: string
  readonly indicationEn: string
  readonly indicationBn: string
  readonly brands: readonly PoultryMedicineBrand[]
}

export interface PoultryMedicineCategory {
  readonly id: string
  readonly category: string
  readonly categoryBn: string
  readonly requiresRegisteredVetRx: boolean
  readonly generics: readonly PoultryMedicineGenericGroup[]
}

export interface PoultryMedicineMasterDatabase {
  readonly metadata: {
    readonly databaseName: string
    readonly version: string
    readonly regulatoryFramework: string
    readonly formulationPolicy: string
    readonly currency: string
    readonly readOnlyClient: true
  }
  readonly categories: readonly PoultryMedicineCategory[]
}

export interface AdminMutationContext {
  role?: string
  isAuthenticated?: boolean
  adminToken?: string
}

export const POULTRY_MEDICINES_DB = POULTRY_MEDICINES_MASTER as unknown as PoultryMedicineMasterDatabase

export { assertAuthenticatedAdminMutation, getMedicineCategories }

export function getFlattenedPoultryMedicines() {
  return getAllMasterMedicineEntries()
}

export function searchPoultryMedicines(query = '') {
  const q = String(query || '').trim().toLowerCase()
  const all = getFlattenedPoultryMedicines()
  if (!q) return all
  return all.filter(
    (entry: Record<string, unknown>) =>
      String(entry.tradeName || '').toLowerCase().includes(q) ||
      String(entry.genericName || '').toLowerCase().includes(q) ||
      String(entry.company || '').toLowerCase().includes(q) ||
      String(entry.category || '').toLowerCase().includes(q)
  )
}

export default POULTRY_MEDICINES_DB
