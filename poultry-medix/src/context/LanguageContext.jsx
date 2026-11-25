import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import i18n, { languageStorageKey, supportedLanguages } from '../i18n.js'
import { LanguageContext } from './language-context.js'

export function LanguageProvider({ children }) {
  const { t: rawT } = useTranslation()
  const rawLanguage = i18n.resolvedLanguage || i18n.language
  const language = supportedLanguages.includes(rawLanguage) ? rawLanguage : 'en'

  const t = useCallback((key, options) => {
    const translated = rawT(key, options)
    if (!options || typeof options !== 'object' || typeof translated !== 'string') {
      return translated
    }
    return translated.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, token) => (
      Object.prototype.hasOwnProperty.call(options, token) && options[token] !== undefined
        ? String(options[token])
        : match
    ))
  }, [rawT])

  const setLanguage = useCallback((nextLanguage) => {
    if (!supportedLanguages.includes(nextLanguage)) return
    try {
      localStorage.setItem(languageStorageKey, nextLanguage)
    } catch (error) {
      console.error('Unable to save the selected language preference.', error)
    }
    i18n.changeLanguage(nextLanguage)
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = 'ltr'
  }, [language])

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
  }), [language, setLanguage, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
