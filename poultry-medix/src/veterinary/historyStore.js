const storageKeys = {
  diagnosis: 'poultry-history-diagnoses',
  chat: 'poultry-history-chats',
  appointment: 'poultry-telemedicine-appointments',
}

export function readHistory(type) {
  const key = storageKeys[type]
  if (!key) throw new Error(`Unknown history type: ${type}`)
  const raw = localStorage.getItem(key)
  if (!raw) return []
  const records = JSON.parse(raw)
  if (!Array.isArray(records)) throw new Error(`Saved ${type} history is invalid.`)
  return records
}

export function saveHistoryEntry(type, record) {
  const records = readHistory(type)
  const existingIndex = records.findIndex((item) => item.id === record.id)
  const updated = existingIndex === -1
    ? [record, ...records]
    : records.map((item, index) => index === existingIndex ? record : item)
  localStorage.setItem(storageKeys[type], JSON.stringify(updated.slice(0, 100)))
}

export function readPrescriptionHistory() {
  const raw = localStorage.getItem('poultry-telemedicine-prescriptions')
  if (!raw) return []
  const records = JSON.parse(raw)
  if (!Array.isArray(records)) throw new Error('Saved prescription history is invalid.')
  return records
}
