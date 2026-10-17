import { useState } from 'react'
import { calculatePrescriberDose } from './medicineLookup.js'
import { useLanguage } from '../context/useLanguage.js'
import Icon from '../components/Icon.jsx'

const detectedDrugs = [
  {
    name: 'Enrofloxacin 10%',
    class: 'Fluoroquinolone • Used for CRD, colibacillosis',
    localMeat: '7 days',
    localEggs: 'Not for layers',
    intlMeat: '8-10 days',
    intlEggs: 'Not permitted',
    status: 'Antibiotic',
  },
  {
    name: 'Colistin',
    class: 'Polymyxin (Banned)',
    localMeat: 'Banned',
    localEggs: 'Banned',
    intlMeat: 'Banned',
    intlEggs: 'Banned',
    status: 'Antibiotic • Banned',
  },
]

export default function PrescriptionLookup({ hideDrugInfo = false, hideDose = false, alwaysShowDrugInfo = false, alwaysShowDose = false }) {
  const { t } = useLanguage()
  const [drugInfoExpanded, setDrugInfoExpanded] = useState(false)
  const [doseExpanded, setDoseExpanded] = useState(false)
  const [bodyWeight, setBodyWeight] = useState('')
  const [prescribedMgPerKg, setPrescribedMgPerKg] = useState('')
  const [doseMg, setDoseMg] = useState(null)

  function calculateDose(event) {
    event.preventDefault()
    setDoseMg(calculatePrescriberDose(Number(bodyWeight), Number(prescribedMgPerKg)))
  }

  const formattedDose = doseMg === null
    ? ''
    : doseMg.toLocaleString(undefined, { maximumFractionDigits: 2 })

  return (
    <div className="prescription-result-tools bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      {!hideDrugInfo && <section className={`drug-info-accordion${drugInfoExpanded || alwaysShowDrugInfo ? ' is-expanded' : ''}`}>
        <button
          className="drug-info-accordion-trigger dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
          type="button"
          aria-expanded={drugInfoExpanded}
          aria-controls="drug-withdrawal-details"
          onClick={() => setDrugInfoExpanded((isExpanded) => !isExpanded)}
        >
          <span className="drug-info-accordion-icon"><Icon name="pill" size={18} /></span>
          <span className="drug-info-accordion-title">{t('drugWithdrawalCardTitle')}</span>
          <Icon className="drug-info-accordion-chevron" name="chevron" size={17} />
        </button>
        {(drugInfoExpanded || alwaysShowDrugInfo) && (
          <div className="drug-info-accordion-content dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700" id="drug-withdrawal-details">
            <p className="drug-info-source">
              Illustrative mock analysis results; the attached file has not been read and the listed medicines are not verified.
            </p>
            {detectedDrugs.map((drug, index) => (
              <article className="drug-info-accordion drug-info-result-card is-expanded dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700" aria-labelledby={`drug-withdrawal-title-${index}`} key={drug.name}>
                <div className="drug-info-accordion-content dark:bg-gray-800 dark:text-gray-200">
                  <div className="drug-info-heading">
                    <div className="drug-info-title-row">
                      <h4 id={`drug-withdrawal-title-${index}`}>{drug.name}</h4>
                      <span className="drug-class-badge">{drug.status}</span>
                    </div>
                    <p>{drug.class}</p>
                  </div>
                  <div className="withdrawal-guidelines">
                    <article className="withdrawal-local">
                      <strong>{t('localGuidelines')}</strong>
                      <p>Meat: {drug.localMeat}, Eggs: {drug.localEggs}</p>
                    </article>
                    <article className="withdrawal-international">
                      <strong>{t('internationalGuidelines')}</strong>
                      <p>Meat: {drug.intlMeat}, Eggs: {drug.intlEggs}</p>
                    </article>
                  </div>
                  <p className="drug-info-source">{t('verifyProductGuidance')}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      }

      {!hideDose && <section className={`dose-calculator-accordion${doseExpanded || alwaysShowDose ? ' is-expanded' : ''}`}>
        <button
          className="dose-calculator-trigger dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
          type="button"
          aria-expanded={doseExpanded}
          aria-controls="dose-calculator-details"
          onClick={() => setDoseExpanded((isExpanded) => !isExpanded)}
        >
          <span className="dose-calculator-icon"><Icon name="calculator" size={18} /></span>
          <span>{t('doseCalculatorTitle')}</span>
          <Icon className="drug-info-accordion-chevron" name="chevron" size={17} />
        </button>
        {(doseExpanded || alwaysShowDose) && (
          <section className="dose-helper dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700" id="dose-calculator-details" aria-labelledby="dose-helper-title">
            <h4 id="dose-helper-title">{t('doseCalculatorTitle')}</h4>
            <p>{t('doseHelperDescription')}</p>
            <form className="dose-calculator dark:text-gray-200" onSubmit={calculateDose}>
              <div className="dose-inputs">
                <label>{t('birdWeightKg')}<input type="number" min="0.001" step="0.001" required value={bodyWeight} onChange={(event) => { setBodyWeight(event.target.value); setDoseMg(null) }} inputMode="decimal" /></label>
                <label>{t('prescribedMgKg')}<input type="number" min="0.001" step="0.001" required value={prescribedMgPerKg} onChange={(event) => { setPrescribedMgPerKg(event.target.value); setDoseMg(null) }} inputMode="decimal" /></label>
              </div>
              <button className="dose-calculate-button dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700" type="submit">{t('doseCalculate')}</button>
            </form>
            {doseMg !== null && (
              <output className="dose-calculation" aria-live="polite">
                {t('doseCalculated').replace('{amount}', formattedDose)}
              </output>
            )}
            <p className="dose-safety-warning">{t('doseSafety')}</p>
          </section>
        )}
      </section>
      }
    </div>
  )
}
