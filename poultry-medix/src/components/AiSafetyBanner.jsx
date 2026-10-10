import Icon from './Icon.jsx'
import { useLanguage } from '../context/useLanguage.js'

export default function AiSafetyBanner() {
  const { t } = useLanguage()

  return (
    <aside className="ai-safety-banner" role="note" aria-label={t('veterinaryConsultingAlertTitle')}>
      <Icon name="shield" size={19} />
      <p><strong>{t('veterinaryConsultingAlertTitle')}:</strong> {t('veterinaryConsultingAlert')}</p>
    </aside>
  )
}
