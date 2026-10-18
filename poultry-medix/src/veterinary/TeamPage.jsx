import Icon from '../components/Icon.jsx'
import { useLanguage } from '../context/useLanguage.js'

const leadContactLinks = [
  { id: 'email', labelKey: 'teamEmail', href: 'mailto:mdnafizurrahman8024@gmail.com', icon: 'mail' },
  { id: 'whatsapp', labelKey: 'teamWhatsApp', href: 'https://wa.me/8801849288024', icon: 'phone' },
  { id: 'linkedin', labelKey: 'teamLinkedIn', href: 'https://www.linkedin.com/in/md-nafizur-rahman-ru', icon: 'linkedin' },
  { id: 'facebook', labelKey: 'teamFacebook', href: 'https://www.facebook.com/share/1MtimuivnB/', icon: 'facebook' },
  { id: 'orcid', labelKey: 'teamOrcid', href: 'https://orcid.org/0009-0008-3918-187X', icon: 'orcid' },
  { id: 'portfolio', labelKey: 'teamPortfolio', href: 'https://sites.google.com/view/md-nafizur-rahman/home', icon: 'external' },
]

const teamMembers = [
  {
    id: 'sojib',
    name: 'Md. Sojib Hossain',
    role: 'Intern Doctor, AMR Researcher, Field Data Collector, Database & Information Collector, Data Management & Validation, Research Documentation, Application Development Support.',
    bioKey: 'teamBioSojib',
    image: '/images/sojib.jpeg',
  },
  {
    id: 'fathynul',
    name: 'Md Fathynul Islam',
    role: 'Veterinary Student, AMR Researcher, Field Data Collector, Database & Information Collector, Data Management & Validation, Research Documentation, Application Development Support.',
    bioKey: 'teamBioFathynul',
    image: '/images/fethynul.jpeg',
  },
  {
    id: 'tika',
    name: 'Tika B.K.',
    role: 'Veterinary Student, AMR Researcher, Field Data Collector, Database & Information Collector, Data Management & Validation, Research Documentation, Application Development Support.',
    bioKey: 'teamBioTika',
    image: '/images/tika.jpeg',
  },
  {
    id: 'afia-anjum-eisha',
    name: 'Afia Anjum Eisha',
    role: 'Dedicated and compassionate third-year Doctor of Veterinary Medicine (DVM) student at University of Rajshahi. Operational proficiency assisting in small animal clinical settings, emergency triage. Proven background in safe animal restraint, client communication and basic diagnostic procedures. Eager to bring strong medical enthusiasm and a team-oriented mindset to a clinical externship or assistant role.',
    bioKey: null,
    image: null,
  },
]

function FemaleAvatar() {
  return (
    <svg className="team-member-photo team-member-photo-placeholder team-female-avatar" viewBox="0 0 96 96" role="img" aria-label="Female profile illustration">
      <circle cx="48" cy="48" r="46" fill="#edf4e9" />
      <path d="M23 82c2-15 12-23 25-23s23 8 25 23" fill="#8eaa8a" />
      <path d="M31 43c0-18 8-27 18-27s18 9 18 27v6c0 12-8 21-18 21S31 61 31 49z" fill="#634b43" />
      <path d="M36 43c0-10 5-16 13-16s13 6 13 16v7c0 9-5 15-13 15s-13-6-13-15z" fill="#e9bd9d" />
      <path d="M34 43c1-15 7-23 16-23 7 0 14 5 16 17-6-2-11-6-14-10-4 7-10 12-18 16Z" fill="#634b43" />
      <path d="M43 48h.1m9.8 0h.1" stroke="#493a36" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M45 56c2 2 4 2 6 0" fill="none" stroke="#9c6156" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function MemberPhoto({ member }) {
  return (
    <div className="team-member-photo-wrap">
      {member.image ? (
        <img
          className="team-member-photo"
          src={member.image}
          alt={`${member.name} profile`}
          onError={(event) => { event.currentTarget.hidden = true }}
        />
      ) : <FemaleAvatar />}
    </div>
  )
}

export default function TeamPage() {
  const { t } = useLanguage()

  return (
    <div className="veterinary-page team-page bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <section className="veterinary-page-heading">
        <span className="veterinary-kicker">{t('veterinaryToolsEyebrow')}</span>
        <h1>{t('teamPageTitle')}</h1>
        <p>{t('teamPageDescription')}</p>
      </section>

      <article className="team-lead-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700">
        <div className="team-lead-profile">
          <div className="team-lead-photo-wrap">
            <div className="team-lead-photo-frame">
            <img
              className="team-lead-photo"
                src="/images/nafiz.png"
                alt="Md Nafizur Rahman"
                onError={(event) => { event.currentTarget.hidden = true }}
              />
            </div>
          </div>
          <div className="team-lead-identity">
            <span className="team-lead-badge"><Icon name="shield" size={13} />{t('teamProjectLead')}</span>
            <h2>Md Nafizur Rahman</h2>
            <p className="team-lead-degree">{t('teamDegree')}</p>
            <p className="team-lead-academics">{t('teamAcademicDetails')}</p>
            <p className="team-lead-location"><Icon name="pin" size={15} />{t('teamHomeTown')}</p>
          </div>
        </div>

        <section className="team-roles-section">
          <h3>{t('teamCoreRoles')}</h3>
          <p>{t('teamCoreRolesText')}</p>
        </section>

        <div className="team-contact-links" aria-label={t('teamContactLinks')}>
          {leadContactLinks.map(({ id, labelKey, href, icon }) => (
            <a key={id} href={href} target={id === 'email' ? undefined : '_blank'} rel={id === 'email' ? undefined : 'noreferrer'} aria-label={t(labelKey)} title={t(labelKey)}>
              <Icon name={icon} size={17} /><span>{t(labelKey)}</span>
            </a>
          ))}
        </div>

        <details className="team-about-section">
          <summary className="team-about-toggle">
            <span><Icon name="user" size={18} />{t('aboutLeadTitle')}</span>
            <Icon name="chevron" size={18} />
          </summary>
          <div className="team-about-content">
            <h3>{t('teamBriefDescriptionLabel')}</h3>
            <p className="team-brief-description">{t('teamBriefDescription')}</p>
            <h3>{t('teamDetailedDescriptionLabel')}</h3>
            <p>{t('teamDetailedDescription')}</p>
          </div>
        </details>
      </article>

      <section className="team-members-section">
        <div className="team-section-heading">
          <div className="veterinary-section-heading">
            <span className="veterinary-section-icon"><Icon name="users" size={18} /></span>
            <div><h2>{t('teamCoMembersTitle')}</h2><p>{t('teamCoMembersDescription')}</p></div>
          </div>
          <span className="team-member-count">{t('teamMemberCount')}</span>
        </div>
        <div className="team-member-grid">
          {teamMembers.map((member, index) => (
            <article className="team-member-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700" key={member.id}>
              <MemberPhoto member={member} />
              <div className="team-member-details">
                <span className="team-member-number">MEMBER {index + 1}</span>
                <h3>{member.name}</h3>
                <p className="team-member-role">{member.role}</p>
                {member.bioKey && <p className="team-member-bio">{t(member.bioKey)}</p>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="team-acknowledgements">
        <span className="team-acknowledgements-icon"><Icon name="graduationCap" size={21} /></span>
        <div>
          <span className="veterinary-kicker">{t('teamGratitudeEyebrow')}</span>
          <h2>{t('teamAcknowledgementsTitle')}</h2>
          <p>{t('teamAcknowledgementsText')}</p>
        </div>
      </section>
    </div>
  )
}
