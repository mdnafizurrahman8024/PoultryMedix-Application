import { useEffect, useMemo, useState } from 'react'
import { LanguageContext, translations } from './language-context.js'

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en')

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key, values = {}) => {
      const template = translations[language][key] ?? key
      return template.replace(/\{(\w+)\}/g, (_match, name) => values[name] ?? `{${name}}`)
    },
  }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
