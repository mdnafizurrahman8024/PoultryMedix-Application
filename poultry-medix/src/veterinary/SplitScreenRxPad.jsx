import { Plus, Send, ShieldCheck, Trash2, X } from 'lucide-react'
import { QUICK_SELECT_MEDICATIONS } from '../lib/paymentAdapter.js'
import { useLanguage } from '../context/useLanguage.js'

export default function SplitScreenRxPad({
  prescription,
  medications,
  onUpdatePrescription,
  onUpdateMedication,
  onApplyQuickMed,
  onAddBlankMed,
  onRemoveMed,
  onSendPrescription,
  saveMessage,
  saveError,
  mobileOpen,
  onCloseMobile,
}) {
  const { t, language } = useLanguage()
  const isBn = language === 'bn'

  return (
    <aside
      className={`pmx-split-rx-pad dark:bg-gray-900 dark:border-gray-700${mobileOpen ? ' is-mobile-open' : ''}`}
      aria-label={t('splitRxPadTitle')}
    >
      <header className="pmx-split-rx-header dark:bg-gray-950 dark:border-gray-800">
        <div>
          <span className="pmx-privacy-shield-badge">
            <ShieldCheck size={11} aria-hidden="true" />
            {t('liveSplitRxBadge')}
          </span>
          <h4>{t('splitRxPadTitle')}</h4>
          <p>
            {prescription.farmerName || t('farmer')} ·{' '}
            {t(`districts.${prescription.district || 'Rajshahi'}`, prescription.district || 'Rajshahi')}
          </p>
        </div>
        {onCloseMobile && (
          <button
            type="button"
            className="pmx-mobile-sheet-close dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
            onClick={onCloseMobile}
            aria-label={t('close')}
          >
            <X size={16} />
          </button>
        )}
      </header>

      <div className="pmx-split-rx-body">
        <div className="pmx-quick-meds-section">
          <span className="pmx-quick-meds-label">{t('quickSelectMedsTitle')}</span>
          <div className="pmx-quick-meds-grid">
            {QUICK_SELECT_MEDICATIONS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="pmx-quick-med-chip dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                onClick={() => onApplyQuickMed(preset)}
              >
                <div className="pmx-quick-med-top">
                  <strong>{preset.tradeName}</strong>
                  <span className={`pmx-aware-tag is-${String(preset.whoAwareCategory || 'Watch').toLowerCase()}`}>
                    {preset.whoAwareCategory}
                  </span>
                </div>
                <small>{preset.genericName}</small>
                <small className="pmx-quick-med-wd">
                  {t('meatShort', 'Meat')}: {preset.meatWithdrawalDays}
                </small>
              </button>
            ))}
          </div>
        </div>

        <label className="telemedicine-field dark:text-gray-200">
          <span>{t('tentativeDiagnosis')}</span>
          <input
            type="text"
            value={prescription.diagnosis}
            onChange={(event) => onUpdatePrescription('diagnosis', event.target.value)}
            placeholder={t('diagnosisPlaceholder')}
          />
        </label>

        <div className="pmx-split-med-rows">
          {medications.map((med, idx) => (
            <div className="pmx-split-med-item dark:bg-gray-800 dark:border-gray-700" key={med.id}>
              <div className="pmx-split-med-item-head">
                <strong>
                  {t('medicineNumber', { number: idx + 1 })}
                  {med.whoAwareCategory ? ` · WHO ${med.whoAwareCategory}` : ''}
                </strong>
                {medications.length > 1 && (
                  <button
                    type="button"
                    className="pmx-split-med-del"
                    onClick={() => onRemoveMed(med.id)}
                    aria-label={`${t('remove')} ${idx + 1}`}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div className="pmx-split-med-inputs">
                <input
                  type="text"
                  value={med.name}
                  onChange={(event) => onUpdateMedication(med.id, 'name', event.target.value)}
                  placeholder={t('drugMedicineName')}
                  aria-label={t('drugMedicineName')}
                />
                <input
                  type="text"
                  value={med.genericName}
                  onChange={(event) => onUpdateMedication(med.id, 'genericName', event.target.value)}
                  placeholder={t('rxGenericName')}
                  aria-label={t('rxGenericName')}
                />
                <input
                  type="text"
                  value={med.dosage}
                  onChange={(event) => onUpdateMedication(med.id, 'dosage', event.target.value)}
                  placeholder={t('dosagePlaceholder')}
                  aria-label={t('dosage')}
                />
                <input
                  type="text"
                  value={med.withdrawal}
                  onChange={(event) => onUpdateMedication(med.id, 'withdrawal', event.target.value)}
                  placeholder={t('withdrawalPlaceholder')}
                  aria-label={t('withdrawalPeriod')}
                />
              </div>
            </div>
          ))}
          <button type="button" className="pmx-split-add-med-btn" onClick={onAddBlankMed}>
            <Plus size={14} aria-hidden="true" />
            <span>{t('addAnotherMedicine')}</span>
          </button>
        </div>

        <label className="telemedicine-field dark:text-gray-200">
          <span>{t('rxManagementAdvice')}</span>
          <textarea
            rows="2"
            value={prescription.advice}
            onChange={(event) => onUpdatePrescription('advice', event.target.value)}
            placeholder={t('rxManagementAdvicePlaceholder')}
          />
        </label>

        <label className="telemedicine-field dark:text-gray-200">
          <span>{t('rxFollowUpDate')}</span>
          <input
            type="date"
            value={prescription.followUpDate}
            onChange={(event) => onUpdatePrescription('followUpDate', event.target.value)}
          />
        </label>

        {saveMessage && (
          <p className="telemedicine-status" role="status">
            {saveMessage}
          </p>
        )}
        {saveError && (
          <p className="telemedicine-error" role="alert">
            {saveError}
          </p>
        )}
      </div>

      <footer className="pmx-split-rx-footer dark:bg-gray-950 dark:border-gray-800">
        <button
          type="button"
          className="pmx-primary-submit-btn pmx-send-rx-btn"
          onClick={onSendPrescription}
        >
          <Send size={15} aria-hidden="true" />
          <span>{t('sendRxToFarmerBtn')}</span>
        </button>
        <small className="pmx-split-sync-caption">
          {isBn
            ? 'পাঠানো মাত্রই খামারির কল স্ক্রিন ও ক্লিনিক্যাল লগে যুক্ত হবে।'
            : 'Syncs instantly to Farmer Call Room & Clinical Logs → Prescriptions.'}
        </small>
      </footer>
    </aside>
  )
}
