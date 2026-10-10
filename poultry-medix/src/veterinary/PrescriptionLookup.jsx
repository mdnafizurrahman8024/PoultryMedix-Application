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

export default function PrescriptionLookup() {
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

  return (
    <div className="prescription-result-tools">
      <section className={`drug-info-accordion${drugInfoExpanded ? ' is-expanded' : ''}`}>
        <button
          className="drug-info-accordion-trigger"
          type="button"
          aria-expanded={drugInfoExpanded}
          aria-controls="drug-withdrawal-details"
          onClick={() => setDrugInfoExpanded((isExpanded) => !isExpanded)}
        >
          <span className="drug-info-accordion-icon"><Icon name="pill" size={18} /></span>
          <span className="drug-info-accordion-title">{t('drugWithdrawalCardTitle')}</span>
          <Icon className="drug-info-accordion-chevron" name="chevron" size={17} />
        </button>
        {drugInfoExpanded && (
          <div className="drug-info-accordion-content" id="drug-withdrawal-details">
            <p className="drug-info-source">
              Illustrative mock analysis results; the attached file has not been read and the listed medicines are not verified.
            </p>
            {detectedDrugs.map((drug, index) => (
              <article className="drug-info-accordion drug-info-result-card is-expanded" aria-labelledby={`drug-withdrawal-title-${index}`} key={drug.name}>
                <div className="drug-info-accordion-content">
                  <div className="drug-info-heading">
                    <div className="drug-info-title-row">
                      <h4 id={`drug-withdrawal-title-${index}`}>{drug.name}</h4>
                      <span className="drug-class-badge">{drug.status}</span>
                    </div>
                    <p>{drug.class}</p>
                  </div>
                  <div className="withdrawal-guidelines">
                    <article className="withdrawal-local">
                      <strong>LOCAL GUIDELINES (BD DLS)</strong>
                      <p>Meat: {drug.localMeat}, Eggs: {drug.localEggs}</p>
                    </article>
                    <article className="withdrawal-international">
                      <strong>INTERNATIONAL GUIDELINES (WHO/WOAH)</strong>
                      <p>Meat: {drug.intlMeat}, Eggs: {drug.intlEggs}</p>
                    </article>
                  </div>
                  <p className="drug-info-source">Verify current product labels and applicable official guidance before use.</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={`dose-calculator-accordion${doseExpanded ? ' is-expanded' : ''}`}>
        <button
          className="dose-calculator-trigger"
          type="button"
          aria-expanded={doseExpanded}
          aria-controls="dose-calculator-details"
          onClick={() => setDoseExpanded((isExpanded) => !isExpanded)}
        >
          <span className="dose-calculator-icon"><Icon name="calculator" size={18} /></span>
          <span>{t('doseCalculatorTitle')}</span>
          <Icon className="drug-info-accordion-chevron" name="chevron" size={17} />
        </button>
        {doseExpanded && (
          <section className="dose-helper" id="dose-calculator-details" aria-labelledby="dose-helper-title">
            <h4 id="dose-helper-title">{t('doseCalculatorTitle')}</h4>
            <p>Enter a veterinarian-prescribed dose to calculate the total amount.</p>
            <form className="dose-calculator" onSubmit={calculateDose}>
              <div className="dose-inputs">
                <label>Bird weight (kg)<input type="number" min="0.001" step="0.001" required value={bodyWeight} onChange={(event) => { setBodyWeight(event.target.value); setDoseMg(null) }} inputMode="decimal" /></label>
                <label>Vet-prescribed dose (mg/kg)<input type="number" min="0.001" step="0.001" required value={prescribedMgPerKg} onChange={(event) => { setPrescribedMgPerKg(event.target.value); setDoseMg(null) }} inputMode="decimal" /></label>
              </div>
              <button className="dose-calculate-button" type="submit">Calculate Dose</button>
            </form>
            {doseMg !== null && <output className="dose-calculation" aria-live="polite">Calculated dose: {doseMg.toLocaleString(undefined, { maximumFractionDigits: 2 })} mg</output>}
            <p className="dose-safety-warning">Use only a dose prescribed by a veterinarian. Verify withdrawal periods against the product label and local guidance.</p>
          </section>
        )}
      </section>
    </div>
  )
}
