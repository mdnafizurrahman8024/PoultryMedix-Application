import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  CreditCard,
  Lock,
  ShieldCheck,
  Smartphone,
  X,
  Zap,
} from 'lucide-react'
import {
  CONSULTATION_FEE_BDT,
  PAYMENT_METHODS,
  PAYMENT_MODE,
  formatCardNumberDisplay,
  processConsultationPayment,
  sanitizePaymentInput,
} from '../lib/paymentAdapter.js'
import { useLanguage } from '../context/useLanguage.js'

export default function PaymentCheckoutModal({
  booking,
  doctor,
  districtLabel,
  onClose,
  onSuccess,
}) {
  const { t, language } = useLanguage()
  const isBn = language === 'bn'
  const methodMeta = PAYMENT_METHODS.find((m) => m.id === booking.payment) || PAYMENT_METHODS[0]
  const methodLabel = t(methodMeta.labelKey)

  const [mobileNumber, setMobileNumber] = useState('')
  const [trxId, setTrxId] = useState('')
  const [cardHolder, setCardHolder] = useState(() => booking.farmer || '')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvc, setCardCvc] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitGuardRef = useRef(false)

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !submitGuardRef.current) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  async function runVerification({ isQuickSandbox = false } = {}) {
    if (submitGuardRef.current) return
    submitGuardRef.current = true
    setIsSubmitting(true)
    setError('')

    try {
      const result = await processConsultationPayment({
        booking,
        doctor,
        methodLabel,
        isQuickSandbox,
        language,
        fields: {
          mobileNumber,
          trxId,
          cardHolder,
          cardNumber,
          cardExpiry,
          cardCvc,
        },
      })

      if (!result.ok) {
        setError(result.error || (isBn ? 'পেমেন্ট যাচাই করা যায়নি।' : 'Unable to verify payment.'))
        submitGuardRef.current = false
        setIsSubmitting(false)
        return
      }

      onSuccess(result.receipt)
    } catch {
      setError(isBn ? 'পেমেন্ট প্রসেসিংয়ে ত্রুটি হয়েছে। আবার চেষ্টা করুন।' : 'Payment processing failed. Please try again.')
      submitGuardRef.current = false
      setIsSubmitting(false)
    }
  }

  function handleFormSubmit(event) {
    event.preventDefault()
    runVerification({ isQuickSandbox: false })
  }

  function handleExpiryChange(value) {
    const digits = String(value).replace(/\D/g, '').slice(0, 4)
    if (digits.length >= 3) {
      setCardExpiry(`${digits.slice(0, 2)}/${digits.slice(2)}`)
    } else {
      setCardExpiry(digits)
    }
  }

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
        aria-labelledby="pmx-checkout-title"
      >
        <header className="pmx-modal-header dark:bg-gray-950 dark:border-gray-800">
          <div>
            <div className="pmx-security-badges">
              <span className="pmx-ssl-badge">
                <Lock size={12} aria-hidden="true" />
                {t('checkoutSslBadge')}
              </span>
              <span className="pmx-mode-badge">
                {PAYMENT_MODE === 'live' ? t('checkoutLiveMode') : t('checkoutSandboxMode')}
              </span>
            </div>
            <h2 id="pmx-checkout-title">{t('checkoutModalTitle')}</h2>
          </div>
          <button
            type="button"
            className="pmx-modal-close dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
            onClick={() => !isSubmitting && onClose()}
            disabled={isSubmitting}
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </header>

        <div className="pmx-modal-body">
          <div className="pmx-booking-summary dark:bg-gray-800 dark:border-gray-700">
            <div className="pmx-summary-row">
              <span>{t('checkoutDoctorLabel')}</span>
              <strong>{doctor.name}</strong>
            </div>
            <div className="pmx-summary-row">
              <span>{t('checkoutSlotLabel')}</span>
              <strong>{booking.date} · {booking.time}</strong>
            </div>
            <div className="pmx-summary-row">
              <span>{t('checkoutFarmerLabel')}</span>
              <strong>
                {sanitizePaymentInput(booking.farmer, 80) || t('farmer')} · {districtLabel}
              </strong>
            </div>
            <div className="pmx-summary-row">
              <span>{t('checkoutMethodLabel')}</span>
              <span className="pmx-method-chip">
                {methodMeta.kind === 'card' ? <CreditCard size={13} /> : <Smartphone size={13} />}
                {methodLabel}
              </span>
            </div>
            <div className="pmx-summary-fee dark:bg-emerald-950/50 dark:border-emerald-800">
              <span>{t('checkoutFeeLabel')}</span>
              <strong>৳ {CONSULTATION_FEE_BDT}</strong>
            </div>
          </div>

          {PAYMENT_MODE === 'sandbox' && (
            <div className="pmx-sandbox-quickbox dark:bg-gray-800 dark:border-gray-700">
              <div>
                <strong>{t('checkoutQuickVerifyTitle')}</strong>
                <p>{t('checkoutQuickVerifyDesc')}</p>
              </div>
              <button
                type="button"
                className="pmx-sandbox-btn"
                onClick={() => runVerification({ isQuickSandbox: true })}
                disabled={isSubmitting}
              >
                <Zap size={15} aria-hidden="true" />
                {isSubmitting ? t('checkoutProcessing') : t('checkoutQuickVerifyBtn')}
              </button>
            </div>
          )}

          <form className="pmx-checkout-form" onSubmit={handleFormSubmit} noValidate>
            {methodMeta.kind === 'mfs' ? (
              <>
                <label className="telemedicine-field dark:text-gray-200">
                  <span>{t('checkoutMobileLabel', { method: methodLabel })}</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={14}
                    placeholder="018XXXXXXXX"
                    value={mobileNumber}
                    onChange={(event) => {
                      setMobileNumber(event.target.value.replace(/[^\d+\-\s]/g, ''))
                      if (error) setError('')
                    }}
                    disabled={isSubmitting}
                    required
                  />
                  <small className="pmx-field-hint">{t('checkoutMobileHint')}</small>
                </label>

                <label className="telemedicine-field dark:text-gray-200">
                  <span>{t('checkoutTrxIdLabel')}</span>
                  <input
                    type="text"
                    maxLength={22}
                    placeholder={t('checkoutTrxIdPlaceholder')}
                    value={trxId}
                    onChange={(event) => {
                      setTrxId(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))
                      if (error) setError('')
                    }}
                    disabled={isSubmitting}
                    required
                  />
                  <small className="pmx-field-hint">{t('checkoutTrxIdHint')}</small>
                </label>
              </>
            ) : (
              <>
                <label className="telemedicine-field dark:text-gray-200">
                  <span>{t('checkoutCardHolderLabel')}</span>
                  <input
                    type="text"
                    maxLength={80}
                    placeholder={t('checkoutCardHolderPlaceholder')}
                    value={cardHolder}
                    onChange={(event) => {
                      setCardHolder(event.target.value.replace(/[<>`"'\\]/g, ''))
                      if (error) setError('')
                    }}
                    disabled={isSubmitting}
                    required
                  />
                </label>

                <label className="telemedicine-field dark:text-gray-200">
                  <span>{t('checkoutCardNumberLabel')}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={23}
                    placeholder="4242 4242 4242 4242"
                    value={cardNumber}
                    onChange={(event) => {
                      setCardNumber(formatCardNumberDisplay(event.target.value))
                      if (error) setError('')
                    }}
                    disabled={isSubmitting}
                    required
                  />
                </label>

                <div className="pmx-card-split">
                  <label className="telemedicine-field dark:text-gray-200">
                    <span>{t('checkoutCardExpiryLabel')}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="MM/YY"
                      value={cardExpiry}
                      onChange={(event) => {
                        handleExpiryChange(event.target.value)
                        if (error) setError('')
                      }}
                      disabled={isSubmitting}
                      required
                    />
                  </label>

                  <label className="telemedicine-field dark:text-gray-200">
                    <span>{t('checkoutCardCvcLabel')}</span>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={4}
                      placeholder="***"
                      value={cardCvc}
                      onChange={(event) => {
                        setCardCvc(event.target.value.replace(/\D/g, '').slice(0, 4))
                        if (error) setError('')
                      }}
                      disabled={isSubmitting}
                      required
                    />
                  </label>
                </div>
              </>
            )}

            {error && (
              <div className="pmx-checkout-error" role="alert">
                <AlertCircle size={15} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="pmx-checkout-actions">
              <button
                type="button"
                className="pmx-secondary-btn dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
                onClick={onClose}
                disabled={isSubmitting}
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="pmx-primary-submit-btn"
                disabled={isSubmitting}
              >
                <ShieldCheck size={16} aria-hidden="true" />
                {isSubmitting ? t('checkoutProcessing') : t('checkoutVerifyPayBtn')}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>,
    document.body
  )
}
