import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  ExternalLink,
  Lock,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  X,
  Zap,
} from 'lucide-react'
import {
  CONSULTATION_FEE_BDT,
  PAYMENT_METHODS,
  PAYMENT_MODE,
  PAYMENT_SYNC_CHANNEL,
  createGatewayPaymentSession,
  persistPendingCheckoutContext,
  pollGatewayPaymentSession,
  processConsultationPayment,
  sanitizePaymentInput,
  verifyExistingGatewayReference,
} from '../lib/paymentAdapter.js'
import { useLanguage } from '../context/useLanguage.js'

export default function PaymentCheckoutModal({
  booking,
  doctor,
  districtLabel,
  amountBdt = CONSULTATION_FEE_BDT,
  onClose,
  onSuccess,
}) {
  const { t, language } = useLanguage()
  const isBn = language === 'bn'
  const methodMeta = PAYMENT_METHODS.find((m) => m.id === booking.payment) || PAYMENT_METHODS[0]
  const methodLabel = t(methodMeta.labelKey)
  const payableAmount = Math.max(10, Math.round(Number(amountBdt) || CONSULTATION_FEE_BDT))

  const [session, setSession] = useState(null)
  const [initializingSession, setInitializingSession] = useState(true)
  const [syncState, setSyncState] = useState('READY') // READY | WAITING_SYNC | SYNCED
  const [showTrxLookup, setShowTrxLookup] = useState(false)
  const [trxId, setTrxId] = useState('')
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const settledRef = useRef(false)
  const gatewayPopupRef = useRef(null)

  const handleSettledReceipt = useCallback((receipt) => {
    if (!receipt || settledRef.current) return
    settledRef.current = true
    setSyncState('SYNCED')
    setIsBusy(false)
    try {
      if (gatewayPopupRef.current && !gatewayPopupRef.current.closed) {
        gatewayPopupRef.current.close()
      }
    } catch {
      // Ignore cross-origin window close warning
    }
    onSuccess(receipt)
  }, [onSuccess])

  useEffect(() => {
    let cancelled = false
    createGatewayPaymentSession({
      booking,
      doctor,
      methodLabel,
      amountBdt: payableAmount,
      language,
    }).then((res) => {
      if (cancelled) return
      setInitializingSession(false)
      if (!res.ok || !res.session) {
        setSession(null)
        setError(res.error || (isBn ? 'পেমেন্ট সেশন শুরু করা যায়নি।' : 'Could not start payment gateway session.'))
        return
      }
      setSession(res.session)
    })
    return () => {
      cancelled = true
    }
  }, [booking, doctor, methodLabel, payableAmount, language, isBn])

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isBusy) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, isBusy])

  // Real-time multi-channel payment sync (postMessage + BroadcastChannel + session status polling)
  useEffect(() => {
    if (!session?.sessionId || settledRef.current) return undefined

    function processIncomingSync(payload) {
      if (!payload || payload.type !== 'pmx-payment-sync') return
      if (payload.sessionId !== session.sessionId) return
      if (payload.status === 'COMPLETED' && payload.receipt) {
        handleSettledReceipt(payload.receipt)
      } else if (payload.status === 'FAILED') {
        setSyncState('READY')
        setError(payload.error || (isBn ? 'পেমেন্ট বাতিল বা ব্যর্থ হয়েছে।' : 'Payment was cancelled or failed at the gateway.'))
      }
    }

    function handleWindowMessage(event) {
      processIncomingSync(event.data)
    }

    let channel = null
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(PAYMENT_SYNC_CHANNEL)
      channel.onmessage = (event) => processIncomingSync(event.data)
    }

    window.addEventListener('message', handleWindowMessage)

    const interval = window.setInterval(async () => {
      if (settledRef.current) return
      const poll = await pollGatewayPaymentSession(session)
      if (poll.ok && poll.status === 'COMPLETED' && poll.receipt) {
        handleSettledReceipt(poll.receipt)
      } else if (poll.ok && poll.status === 'FAILED') {
        setSyncState('READY')
        setError(isBn ? 'পেমেন্ট গেটওয়ে থেকে বাতিল করা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।' : 'Payment was declined or cancelled at the gateway.')
      }
    }, 1500)

    return () => {
      window.removeEventListener('message', handleWindowMessage)
      if (channel) channel.close()
      window.clearInterval(interval)
    }
  }, [session, handleSettledReceipt, isBn])

  function handleLaunchPaymentApp({ sameTab = false } = {}) {
    if (!session?.checkoutUrl || settledRef.current) return
    setError('')

    persistPendingCheckoutContext({
      sessionId: session.sessionId,
      isLocalFallback: Boolean(session.isLocalFallback),
      booking,
      doctor,
      methodLabel,
      amountBdt: payableAmount,
    })

    if (sameTab) {
      window.location.assign(session.checkoutUrl)
      return
    }

    const popup = window.open(session.checkoutUrl, 'pmxPaymentGateway', 'width=480,height=740')
    if (!popup || popup.closed) {
      // Fall back to direct tab navigation if popup blocker prevented new window
      window.location.assign(session.checkoutUrl)
      return
    }
    gatewayPopupRef.current = popup
    setSyncState('WAITING_SYNC')
  }

  async function handleManualSyncCheck() {
    if (!session?.sessionId || settledRef.current) return
    setIsBusy(true)
    setError('')
    const poll = await pollGatewayPaymentSession(session)
    setIsBusy(false)
    if (poll.ok && poll.status === 'COMPLETED' && poll.receipt) {
      handleSettledReceipt(poll.receipt)
    } else if (poll.status === 'FAILED' || poll.status === 'EXPIRED') {
      setSyncState('READY')
      setError(isBn ? 'পেমেন্ট অসম্পূর্ণ বা বাতিল হয়েছে।' : 'Payment session failed or expired. Restart checkout.')
    } else {
      setError(
        isBn
          ? 'এখনো পেমেন্ট সম্পন্ন হয়নি। খোলা ওয়ালেট উইন্ডোতে অনুমোদন সম্পন্ন করুন।'
          : 'Waiting for gateway settlement. Please complete authorization in the opened wallet window.'
      )
    }
  }

  async function handleVerifyReferenceSubmit(event) {
    event.preventDefault()
    if (isBusy || settledRef.current) return
    setIsBusy(true)
    setError('')
    const result = await verifyExistingGatewayReference({
      reference: trxId,
      language,
    })
    setIsBusy(false)
    if (!result.ok || !result.receipt) {
      setError(result.error || (isBn ? 'TrxID যাচাই করা যায়নি।' : 'Transaction verification failed.'))
      return
    }
    handleSettledReceipt(result.receipt)
  }

  async function handleSandboxQuickTest() {
    if (isBusy || settledRef.current || PAYMENT_MODE !== 'sandbox') return
    setIsBusy(true)
    setError('')
    const result = await processConsultationPayment({
      booking,
      doctor,
      methodLabel,
      isQuickSandbox: true,
      amountBdt: payableAmount,
      language,
    })
    setIsBusy(false)
    if (!result.ok || !result.receipt) {
      setError(result.error || 'Sandbox verification failed.')
      return
    }
    handleSettledReceipt(result.receipt)
  }

  return createPortal(
    <div
      className="pmx-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) onClose()
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
                {session?.paymentMode === 'live' ? t('checkoutLiveMode') : t('checkoutSandboxMode')}
              </span>
            </div>
            <h2 id="pmx-checkout-title">{t('checkoutModalTitle')}</h2>
          </div>
          <button
            type="button"
            className="pmx-modal-close dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
            onClick={() => !isBusy && onClose()}
            disabled={isBusy}
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
            {session?.merchantInvoice && (
              <div className="pmx-summary-row">
                <span>{t('checkoutInvoiceLabel')}</span>
                <strong>{session.merchantInvoice}</strong>
              </div>
            )}
            <div className="pmx-summary-fee dark:bg-emerald-950/50 dark:border-emerald-800">
              <span>{t('checkoutFeeLabel')}</span>
              <strong>৳ {payableAmount}</strong>
            </div>
          </div>

          {/* Primary App-Launch & Auto-Sync Gateway Panel */}
          <div className="pmx-gateway-launch-box dark:bg-gray-800 dark:border-gray-700">
            <div className="pmx-gateway-launch-head">
              <div>
                <strong>
                  {syncState === 'WAITING_SYNC'
                    ? t('checkoutWaitingSyncTitle', { method: methodLabel })
                    : t('checkoutLaunchTitle', { method: methodLabel })}
                </strong>
                <p>
                  {syncState === 'WAITING_SYNC'
                    ? t('checkoutWaitingSyncDesc', { method: methodLabel })
                    : t('checkoutLaunchDesc', { method: methodLabel })}
                </p>
              </div>
            </div>

            {syncState === 'WAITING_SYNC' && (
              <div className="pmx-sync-banner" role="status">
                <RefreshCw size={15} className="pmx-spin-icon" aria-hidden="true" />
                <span>{t('checkoutLiveSyncActive')}</span>
              </div>
            )}

            <div className="pmx-gateway-btn-row">
              <button
                type="button"
                className="pmx-gateway-pay-btn"
                style={{ backgroundColor: methodMeta.color }}
                disabled={initializingSession || !session?.checkoutUrl || isBusy}
                onClick={() => handleLaunchPaymentApp({ sameTab: false })}
              >
                <ExternalLink size={16} aria-hidden="true" />
                <span>
                  {initializingSession
                    ? t('checkoutPreparingSession')
                    : syncState === 'WAITING_SYNC'
                      ? t('checkoutReopenAppBtn', { method: methodLabel })
                      : t('checkoutOpenAppPayBtn', { method: methodLabel, amount: payableAmount })}
                </span>
              </button>

              {syncState === 'WAITING_SYNC' ? (
                <button
                  type="button"
                  className="pmx-secondary-btn dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700"
                  disabled={isBusy}
                  onClick={handleManualSyncCheck}
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  <span>{t('checkoutSyncNowBtn')}</span>
                </button>
              ) : (
                session?.checkoutUrl && (
                  <button
                    type="button"
                    className="pmx-secondary-btn dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700"
                    disabled={initializingSession || isBusy}
                    onClick={() => handleLaunchPaymentApp({ sameTab: true })}
                  >
                    <span>{t('checkoutSameTabBtn')}</span>
                  </button>
                )
              )}
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
                onClick={handleSandboxQuickTest}
                disabled={isBusy}
              >
                <Zap size={15} aria-hidden="true" />
                {isBusy ? t('checkoutProcessing') : t('checkoutQuickVerifyBtn')}
              </button>
            </div>
          )}

          {/* Optional Strictly Verified TrxID Lookup (rejects arbitrary/fake IDs) */}
          <div className="pmx-trx-lookup-wrap dark:border-gray-700">
            <button
              type="button"
              className="pmx-trx-lookup-toggle dark:text-gray-300"
              aria-expanded={showTrxLookup}
              onClick={() => setShowTrxLookup((v) => !v)}
            >
              <span>{t('checkoutAlreadyPaidToggle')}</span>
              <ChevronDown
                size={15}
                style={{ transform: showTrxLookup ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}
                aria-hidden="true"
              />
            </button>

            {showTrxLookup && (
              <form className="pmx-checkout-form" onSubmit={handleVerifyReferenceSubmit} noValidate>
                <label className="telemedicine-field dark:text-gray-200">
                  <span>{t('checkoutTrxIdLabel')}</span>
                  <input
                    type="text"
                    maxLength={28}
                    placeholder={t('checkoutTrxIdPlaceholder')}
                    value={trxId}
                    onChange={(event) => {
                      setTrxId(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))
                      if (error) setError('')
                    }}
                    disabled={isBusy}
                    required
                  />
                  <small className="pmx-field-hint">{t('checkoutTrxStrictHint')}</small>
                </label>

                <div className="pmx-checkout-actions">
                  <button
                    type="submit"
                    className="pmx-primary-submit-btn"
                    disabled={isBusy || !trxId.trim()}
                  >
                    <ShieldCheck size={16} aria-hidden="true" />
                    {isBusy ? t('checkoutProcessing') : t('checkoutVerifyTrxBtn')}
                  </button>
                </div>
              </form>
            )}
          </div>

          {error && (
            <div className="pmx-checkout-error" role="alert">
              <AlertCircle size={15} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {syncState === 'SYNCED' && (
            <div className="pmx-checkout-success" role="status">
              <CheckCircle2 size={15} aria-hidden="true" />
              <span>{t('checkoutSyncedSuccess')}</span>
            </div>
          )}

          <div className="pmx-checkout-actions">
            <button
              type="button"
              className="pmx-secondary-btn dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
              onClick={onClose}
              disabled={isBusy}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body
  )
}
