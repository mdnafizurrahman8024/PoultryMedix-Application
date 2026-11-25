import Icon from './components/Icon.jsx'
import { USER_ROLES, useUser } from './context/user-context.js'
import { useLanguage } from './context/useLanguage.js'
import './OnboardingScreen.css'

const roleOptions = [
  {
    role: 'FARMER',
    icon: 'bird',
    titleKey: 'onboardingFarmerTitle',
    descriptionKey: 'onboardingFarmerDescription',
  },
  {
    role: 'VET_STUDENT',
    icon: 'graduationCap',
    titleKey: 'onboardingStudentTitle',
    descriptionKey: 'onboardingStudentDescription',
  },
  {
    role: 'REGISTERED_VET',
    icon: 'stethoscope',
    titleKey: 'onboardingVetTitle',
    descriptionKey: 'onboardingVetDescription',
  },
]

export default function OnboardingScreen({ onRoleSelected }) {
  const { setRole } = useUser()
  const { t } = useLanguage()

  function chooseRole(role) {
    if (USER_ROLES.includes(role)) {
      setRole(role)
      onRoleSelected?.()
    }
  }

  return (
    <main className="onboarding-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="onboarding-orb onboarding-orb--top" aria-hidden="true" />
      <div className="onboarding-orb onboarding-orb--bottom" aria-hidden="true" />
      <section className="onboarding-panel bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700" aria-labelledby="onboarding-title">
        <header className="onboarding-header">
          <a className="onboarding-brand" href="#home" aria-label={t('brand')}>
            <img src="/images/logo.png" alt="" />
            <span>Poultry<span>Medix</span></span>
          </a>
          <span className="onboarding-step">{t('antibiotics.onboardingStep')}</span>
        </header>

        <div className="onboarding-intro">
          <span className="onboarding-kicker"><Icon name="spark" size={14} /> {t('antibiotics.onboardingKicker')}</span>
          <h1 id="onboarding-title">{t('antibiotics.onboardingTitle')}</h1>
          <p>{t('antibiotics.onboardingDescription')}</p>
        </div>

        <div className="onboarding-role-grid">
          {roleOptions.map(({ role, icon, titleKey, descriptionKey }) => (
            <button className="onboarding-role-card dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 dark:focus:bg-gray-700" type="button" key={role} onClick={() => chooseRole(role)}>
              <span className="onboarding-role-icon"><Icon name={icon} size={26} /></span>
              <span className="onboarding-role-copy">
                <strong>{t(`antibiotics.${titleKey}`)}</strong>
                <span>{t(`antibiotics.${descriptionKey}`)}</span>
              </span>
              <span className="onboarding-role-arrow" aria-hidden="true"><Icon name="arrow" size={17} /></span>
            </button>
          ))}
        </div>

        <p className="onboarding-footer"><Icon name="shield" size={15} /> {t('antibiotics.onboardingFooter')}</p>
        <p className="onboarding-vision"><strong>{t('ultimateVisionLabel')}</strong> '{t('antibiotics.ultimateVisionPlain')}'</p>
      </section>
    </main>
  )
}
