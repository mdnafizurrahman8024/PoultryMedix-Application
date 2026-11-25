import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en/translation.json'
import bn from './locales/bn/translation.json'

export const supportedLanguages = ['en', 'bn']
export const languageStorageKey = 'poultry-medix-language'

function getStoredLanguage() {
  try {
    const storedLanguage = localStorage.getItem(languageStorageKey)
    if (supportedLanguages.includes(storedLanguage)) return storedLanguage
    if (storedLanguage) localStorage.removeItem(languageStorageKey)
    return null
  } catch (error) {
    console.error('Unable to restore the saved language preference.', error)
    return null
  }
}

function getBrowserLanguage() {
  if (typeof navigator === 'undefined') return 'en'

  const browserLanguages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language]

  for (const browserLanguage of browserLanguages) {
    const normalizedLanguage = browserLanguage?.toLowerCase() || ''
    if (normalizedLanguage.startsWith('bn') || normalizedLanguage.endsWith('-bd')) return 'bn'
  }

  return 'en'
}

const detectedLanguage = getStoredLanguage() || getBrowserLanguage()

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      bn: { translation: bn },
    },
    lng: detectedLanguage,
    fallbackLng: 'en',
    supportedLngs: supportedLanguages,
    interpolation: {
      escapeValue: false,
    },
    initImmediate: false,
  })

export default i18n
