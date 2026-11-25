import { useLanguage } from '../context/useLanguage.js'

export default function PrivacyPolicy() {
  const { t } = useLanguage()
  const sections = t('privacyPolicyContent.sections', { returnObjects: true })
  const sectionList = Array.isArray(sections) ? sections : []

  return (
    <div className="veterinary-page privacy-policy-page bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <section className="veterinary-page-heading">
        <span className="veterinary-kicker">PoultryMedix</span>
        <h1>{t('privacyPolicyContent.title', 'Privacy & Security')}</h1>
        <p>{t('privacyPolicyContent.subtitle', 'PoultryMedix: Privacy, Security, and Terms of Use Policy')}</p>
      </section>

      <article className="privacy-policy-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700">
        {sectionList.map((section) => (
          <section className="privacy-policy-section" key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body && <p>{section.body}</p>}
            {Array.isArray(section.bullets) && (
              <ul>
                {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
              </ul>
            )}
          </section>
        ))}
      </article>
    </div>
  )
}
