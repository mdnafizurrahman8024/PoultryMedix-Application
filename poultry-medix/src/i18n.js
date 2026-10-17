import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en/translation.json'
import bn from './locales/bn/translation.json'
import hi from './locales/hi/translation.json'
import ur from './locales/ur/translation.json'

export const supportedLanguages = ['en', 'bn', 'hi', 'ur']
export const languageStorageKey = 'poultry-medix-language'

function getStoredLanguage() {
  try {
    const storedLanguage = localStorage.getItem(languageStorageKey)
    return supportedLanguages.includes(storedLanguage) ? storedLanguage : null
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
    if (normalizedLanguage.startsWith('hi') || normalizedLanguage.endsWith('-in')) return 'hi'
    if (normalizedLanguage.startsWith('ur') || normalizedLanguage.endsWith('-pk')) return 'ur'
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
      hi: { translation: hi },
      ur: { translation: ur },
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
