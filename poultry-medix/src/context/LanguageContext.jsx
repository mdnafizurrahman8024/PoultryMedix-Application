import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import i18n, { languageStorageKey, supportedLanguages } from '../i18n.js'
import { LanguageContext } from './language-context.js'

export function LanguageProvider({ children }) {
  const { t } = useTranslation()
  const language = i18n.resolvedLanguage || i18n.language

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
    document.documentElement.dir = language === 'ur' ? 'rtl' : 'ltr'
  }, [language])

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
  }), [language, setLanguage, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
