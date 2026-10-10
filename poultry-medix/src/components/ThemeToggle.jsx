import Icon from './Icon.jsx'
import { useLanguage } from '../context/useLanguage.js'
import { useTheme } from '../context/theme-context.js'

const options = [
  { mode: 'light', icon: 'sun', label: 'themeLight' },
  { mode: 'dark', icon: 'moon', label: 'themeDark' },
  { mode: 'system', icon: 'monitor', label: 'themeSystem' },
]

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const { t } = useLanguage()

  return (
    <div className="theme-toggle" role="group" aria-label={t('themePreference')}>
      {options.map(({ mode, icon, label }) => (
        <button
          className="theme-toggle-option"
          type="button"
          key={mode}
          title={t(label)}
          aria-label={t(label)}
          aria-pressed={theme === mode}
          onClick={() => setTheme(mode)}
        >
          <Icon name={icon} size={15} />
        </button>
      ))}
    </div>
  )
}
