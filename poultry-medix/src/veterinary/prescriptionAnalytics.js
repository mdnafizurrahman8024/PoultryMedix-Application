/**
 * Bridge for Prescription Analytics
 * Re-exports from real-time analyticsEngine.js
 */

export {
  prescriptionStorageKeys,
  PRESCRIPTION_DATA_CHANGED_EVENT as prescriptionDataChangedEvent,
  defaultPrescriptionSeeds,
  getLiveAntibioticAnalytics as getPrescriptionAnalytics,
  notifyAnalyticsUpdated as notifyPrescriptionDataChanged,
} from '../lib/analyticsEngine.js'

import {
  getLiveAntibioticAnalytics,
  defaultPrescriptionSeeds,
  notifyAnalyticsUpdated,
} from '../lib/analyticsEngine.js'

export function readPrescriptionSources() {
  return {
    home: defaultPrescriptionSeeds.home,
    consult: defaultPrescriptionSeeds.consult,
  }
}
