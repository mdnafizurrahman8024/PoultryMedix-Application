import { useState } from 'react'

const antibioticClasses = [
  {
    name: 'Tetracyclines',
    ratio: 38,
    antibiotics: [
      {
        name: 'Doxycycline',
        tradeName: 'Doxy-A Vet',
        ratio: 24,
        generations: [
          { name: '3rd Gen', ratio: 62 },
          { name: '2nd Gen', ratio: 38 },
        ],
      },
      {
        name: 'Oxytetracycline',
        ratio: 14,
        generations: [{ name: '1st Gen', ratio: 100 }],
      },
    ],
  },
  {
    name: 'Beta-lactams',
    ratio: 31,
    antibiotics: [
      {
        name: 'Amoxicillin',
        ratio: 19,
        generations: [
          { name: '3rd Gen', ratio: 70 },
          { name: '2nd Gen', ratio: 30 },
        ],
      },
      {
        name: 'Ampicillin',
        ratio: 12,
        generations: [{ name: '2nd Gen', ratio: 100 }],
      },
    ],
  },
  {
    name: 'Macrolides',
    ratio: 19,
    antibiotics: [
      {
        name: 'Tylosin',
        ratio: 19,
        generations: [{ name: '1st Gen', ratio: 100 }],
      },
    ],
  },
  {
    name: 'Sulfonamides',
    ratio: 12,
    antibiotics: [
      {
        name: 'Sulfadiazine',
        ratio: 12,
        generations: [{ name: '1st Gen', ratio: 100 }],
      },
    ],
  },
]

function formatPercent(value, language) {
  return `${new Intl.NumberFormat(language === 'bn' ? 'bn-BD' : 'en').format(value)}%`
}

function getIntensityClass(ratio) {
  return ratio >= 50 ? 'usage-ratio--high' : 'usage-ratio--moderate'
}

function ExpandIcon({ expanded }) {
  return (
    <span className="usage-accordion-icon" aria-hidden="true">
      {expanded ? '−' : '+'}
    </span>
  )
}

function GenerationRow({ generation, language, t }) {
  return (
    <li className="usage-generation-row dark:text-gray-900">
      <div className="usage-item-copy dark:text-gray-900">
        <strong className="dark:font-bold">{generation.name}</strong>
        <small className="dark:text-gray-700">{t('antibioticGeneration')}</small>
      </div>
      <div className="usage-meter-group">
        <div className="usage-meter" aria-hidden="true">
          <span
            className={getIntensityClass(generation.ratio)}
            style={{ width: `${generation.ratio}%` }}
          />
        </div>
        <strong className={`usage-ratio dark:text-gray-900 dark:font-bold ${getIntensityClass(generation.ratio)}`}>
          {formatPercent(generation.ratio, language)}
        </strong>
      </div>
    </li>
  )
}

function AntibioticCard({ antibiotic, expanded, language, onToggle, t }) {
  const panelId = `usage-${antibiotic.name.toLowerCase().replaceAll(' ', '-')}`

  return (
    <div className="usage-antibiotic-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700">
      <button
        type="button"
        className="usage-antibiotic-trigger dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
        aria-controls={panelId}
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="usage-item-copy">
          <strong>{antibiotic.name}</strong>
          <small>
            {antibiotic.tradeName
              ? `${antibiotic.tradeName} · ${t('specificAntibioticName')}`
              : t('specificAntibioticName')}
          </small>
        </span>
        <span className={`usage-ratio ${getIntensityClass(antibiotic.ratio)}`}>
          {formatPercent(antibiotic.ratio, language)}
        </span>
        <ExpandIcon expanded={expanded} />
      </button>

      {expanded && (
        <div id={panelId} className="usage-generation-panel dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700">
          <div className="usage-nested-heading dark:text-gray-200">
            <span>{t('antibioticToGenerationUsage')}</span>
            <span>{t('mapUsageRatio')}</span>
          </div>
          <ul>
            {antibiotic.generations.map((generation) => (
              <GenerationRow
                key={generation.name}
                generation={generation}
                language={language}
                t={t}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function AntibioticClassCard({ group, expanded, language, onToggle, t }) {
  const [expandedAntibiotics, setExpandedAntibiotics] = useState(() => new Set())
  const panelId = `usage-class-${group.name.toLowerCase().replaceAll(' ', '-')}`

  function toggleAntibiotic(name) {
    setExpandedAntibiotics((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <article className={`usage-class-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700 ${expanded ? 'is-expanded' : ''}`}>
      <button
        type="button"
        className="usage-class-trigger dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
        aria-controls={panelId}
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="usage-class-heading">
          <strong>{t(`antibiotics.classes.${group.name}`)}</strong>
          <small>{t('genericAntibioticClass')}</small>
        </span>
        <span className={`usage-ratio ${getIntensityClass(group.ratio)}`}>
          {formatPercent(group.ratio, language)}
        </span>
        <ExpandIcon expanded={expanded} />
      </button>

      {expanded && (
        <div id={panelId} className="usage-class-panel dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700">
          {group.antibiotics.map((antibiotic) => (
            <AntibioticCard
              key={antibiotic.name}
              antibiotic={antibiotic}
              expanded={expandedAntibiotics.has(antibiotic.name)}
              language={language}
              onToggle={() => toggleAntibiotic(antibiotic.name)}
              t={t}
            />
          ))}
        </div>
      )}
    </article>
  )
}

export default function AntibioticUsageAccordion({ language, t }) {
  const [expandedClasses, setExpandedClasses] = useState(
    () => new Set(antibioticClasses.map(({ name }) => name)),
  )

  function toggleClass(name) {
    setExpandedClasses((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <section className="amr-analytics-section antibiotic-usage-dashboard bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700" aria-labelledby="class-usage-title">
      <div className="usage-section-heading">
        <div>
          <h3 id="class-usage-title">{t('classToAntibioticUsage')}</h3>
          <p>{t('hierarchyDescription')}</p>
        </div>
        <span className="usage-section-badge">{t('levelsThree')}</span>
      </div>
      <div className="usage-accordion">
        {antibioticClasses.map((group) => (
          <AntibioticClassCard
            key={group.name}
            group={group}
            expanded={expandedClasses.has(group.name)}
            language={language}
            onToggle={() => toggleClass(group.name)}
            t={t}
          />
        ))}
      </div>
    </section>
  )
}
