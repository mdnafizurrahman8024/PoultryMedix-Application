import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Lock, Printer, Send, ShieldCheck, X } from 'lucide-react'
import {
  RX_MANDATORY_REGULATORY_BN,
  RX_MANDATORY_REGULATORY_EN,
  isWithdrawalRequiredMedication,
} from '../lib/rxSecurityHelper.js'
import { useLanguage } from '../context/useLanguage.js'

export default function RxReviewModal({
  prescription,
  medications,
  deliveredRecord,
  isSubmitting = false,
  errorText = '',
  onConfirmSend,
  onPrintPdf,
  onClose,
}) {
  const { t, language } = useLanguage()
  const isBn = language === 'bn'
  const withdrawalCount = (medications || []).filter(isWithdrawalRequiredMedication).length
  const isSent = Boolean(deliveredRecord?.isImmutable)

  return createPortal(
    <div
      className="pmx-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose()
      }}
    >
      <section
        className="pmx-modal-card dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pmx-rx-confirm-title"
      >
        <header className="pmx-modal-header dark:bg-gray-950 dark:border-gray-800">
          <div>
            <span className="pmx-privacy-shield-badge">
              {isSent ? <Lock size={12} aria-hidden="true" /> : <ShieldCheck size={12} aria-hidden="true" />}
              {isSent ? t('rxImmutableLockedBadge') : t('rxReviewBadge')}
            </span>
            <h2 id="pmx-rx-confirm-title">
              {isSent ? t('rxDeliveredSuccessTitle') : t('rxReviewModalTitle')}
            </h2>
          </div>
          <button
            type="button"
            className="pmx-modal-close dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
            onClick={onClose}
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </header>

        <div className="pmx-modal-body">
          <div className="pmx-rx-review-summary dark:bg-gray-800 dark:border-gray-700">
            <div>
              <small>{t('veterinarianInformation')}</small>
              <strong>{prescription.vetName}</strong>
              <span>{prescription.registrationNumber || prescription.bvcRegNo}</span>
            </div>
            <div>
              <small>{t('checkoutFarmerLabel')}</small>
              <strong>{prescription.farmerName || t('farmer')}</strong>
              <span>{[prescription.farmName, prescription.upazila, prescription.district].filter(Boolean).join(' · ')}</span>
            </div>
            <div>
              <small>{t('rxDiagnosisHeading')}</small>
              <strong>{prescription.diagnosis || t('rxNotEntered')}</strong>
              <span>{prescription.birdType} · {prescription.flockSize || '—'} · {prescription.age || '—'}</span>
            </div>
            <div>
              <small>{t('rxDigitalSignatureLabel')}</small>
              <strong style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                {prescription.digitalSignature || `${prescription.vetName} (${prescription.registrationNumber})`}
              </strong>
              {deliveredRecord?.signatureDigest && <span>{deliveredRecord.signatureDigest}</span>}
            </div>
          </div>

          <div className="pmx-rx-review-meds">
            <strong>{t('medicationDetails')} ({medications.length})</strong>
            <ul>
              {medications.map((m, idx) => (
                <li key={m.id || idx}>
                  <strong>{idx + 1}. {m.name || m.tradeName || m.genericName || t('rxMedicineNameDefault')}</strong>
                  {m.genericName ? ` (${m.genericName})` : ''}
                  {m.company ? ` — ${m.company}` : ''}
                  {m.packSize ? ` · ${m.packSize}` : ''}
                  <small>{[m.route || m.formulation, m.dosage, m.frequency, m.duration ? `${m.duration} ${m.durationType || 'Days'}` : ''].filter(Boolean).join(' · ')}</small>
                </li>
              ))}
            </ul>
          </div>

          {withdrawalCount > 0 && (
            <div className="pmx-rx-withdrawal-alert" role="status">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>{t('rxConfirmWithdrawalNote', { count: withdrawalCount })}</span>
            </div>
          )}

          <p className="pmx-rx-reg-mandatory-note">
            {isBn ? RX_MANDATORY_REGULATORY_BN : RX_MANDATORY_REGULATORY_EN}
          </p>

          {errorText && (
            <div className="pmx-checkout-error" role="alert">
              <AlertTriangle size={15} />
              <span>{errorText}</span>
            </div>
          )}

          {isSent ? (
            <div className="pmx-rx-sent-banner" role="status">
              <CheckCircle2 size={17} aria-hidden="true" />
              <div>
                <strong>{t('rxDeliveredSyncedFarmer')}</strong>
                <small>{t('rxImmutableFooterHint')}</small>
              </div>
            </div>
          ) : (
            <p className="pmx-rx-immutable-warning">
              <Lock size={13} aria-hidden="true" />
              <span>{t('rxWillLockImmutableNote')}</span>
            </p>
          )}

          <div className="pmx-receipt-actions">
            {isSent ? (
              <>
                <button type="button" className="pmx-primary-submit-btn" onClick={onPrintPdf}>
                  <Printer size={15} aria-hidden="true" />
                  {t('rxOneClickPdfBtn')}
                </button>
                <button type="button" className="pmx-secondary-btn dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700" onClick={onClose}>
                  {t('close')}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="pmx-secondary-btn dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700" onClick={onClose}>
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  className="pmx-primary-submit-btn"
                  onClick={onConfirmSend}
                >
                  <Send size={15} aria-hidden="true" />
                  {t('rxConfirmSignAndSendBtn')}
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body
  )
}
