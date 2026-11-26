import { useState } from 'react'
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react'
import {
  PAYMENT_METHODS,
  confirmLocalFallbackSandboxSession,
  cancelLocalFallbackSandboxSession,
  getLocalFallbackSandboxSession,
} from '../lib/paymentAdapter.js'
import { useLanguage } from '../context/useLanguage.js'
import './Telemedicine.css'

export default function GatewaySandboxView({ sessionId, nonce }) {
  const { language, t } = useLanguage()
  const isBn = language === 'bn'
  const [session] = useState(() => getLocalFallbackSandboxSession(sessionId))
  const methodMeta = PAYMENT_METHODS.find((m) => m.id === session?.method) || PAYMENT_METHODS[0]
  const isCard = methodMeta.kind === 'card'
  const [account, setAccount] = useState(() => (isCard ? '4242 4242 4242 4242' : '01700000000'))
  const [error, setError] = useState('')
  const [doneReceipt, setDoneReceipt] = useState(null)

  if (!session) {
    return (
      <main className="pmx-sandbox-page-shell">
        <div className="pmx-sandbox-page-card">
          <XCircle size={32} className="text-red-600" />
          <h1>{isBn ? 'পেমেন্ট সেশন পাওয়া যায়নি' : 'Payment Session Expired'}</h1>
          <p>{isBn ? 'অনুগ্রহ করে মূল অ্যাপ থেকে আবার পেমেন্ট শুরু করুন।' : 'Please restart checkout from the PoultryMedix app.'}</p>
          <button type="button" className="pmx-secondary-btn" onClick={() => window.close()}>
            {t('close')}
          </button>
        </div>
      </main>
    )
  }

  function handleConfirm(event) {
    event.preventDefault()
    setError('')
    const result = confirmLocalFallbackSandboxSession({
      sessionId,
      nonce,
      walletAccount: account,
      language,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDoneReceipt(result.receipt)
    window.setTimeout(() => {
      if (window.opener && !window.opener.closed) {
        window.close()
      }
    }, 900)
  }

  function handleCancel() {
    cancelLocalFallbackSandboxSession({ sessionId, nonce })
    if (window.opener && !window.opener.closed) {
      window.close()
    } else {
      window.location.href = window.location.origin
    }
  }

  return (
    <main className="pmx-sandbox-page-shell" data-method={session.method}>
      <section className="pmx-sandbox-page-card">
        <header className="pmx-sandbox-page-head" data-method={session.method}>
          <span>{isBn ? 'স্যান্ডবক্স টেস্ট গেটওয়ে · কোনো বাস্তব টাকা কাটা হবে না' : 'SANDBOX TEST GATEWAY · NO REAL BDT CHARGED'}</span>
          <h1>{t(methodMeta.labelKey)} App Checkout</h1>
          <p>PoultryMedix Telehealth Gateway Sync</p>
        </header>

        {doneReceipt ? (
          <div className="pmx-sandbox-page-done">
            <CheckCircle2 size={36} className="text-emerald-700" />
            <h2>{isBn ? 'পেমেন্ট নিশ্চিত ও সিঙ্ক সম্পন্ন!' : 'Payment Verified & Synced!'}</h2>
            <p>
              {isBn
                ? `রিসিট ${doneReceipt.trxId} মূল অ্যাপে পাঠানো হয়েছে। এই উইন্ডো বন্ধ করে অ্যাপে ফিরে যান।`
                : `Receipt ${doneReceipt.trxId} synced back to PoultryMedix. Returning to your consultation...`}
            </p>
            <button type="button" className="pmx-primary-submit-btn" onClick={() => window.close()}>
              {isBn ? 'উইন্ডো বন্ধ করুন' : 'Return to PoultryMedix'}
            </button>
          </div>
        ) : (
          <form className="pmx-sandbox-page-body" onSubmit={handleConfirm}>
            <div className="pmx-summary-fee">
              <span>{isBn ? 'মোট ফি' : 'Merchant Payable'}</span>
              <strong>৳ {session.amount}</strong>
            </div>

            <div className="pmx-booking-summary">
              <div className="pmx-summary-row">
                <span>{isBn ? 'মার্চেন্ট' : 'Merchant'}</span>
                <strong>PoultryMedix Telehealth</strong>
              </div>
              <div className="pmx-summary-row">
                <span>{isBn ? 'ইনভয়েস' : 'Invoice'}</span>
                <strong>{session.merchantInvoice}</strong>
              </div>
              <div className="pmx-summary-row">
                <span>{t('checkoutDoctorLabel')}</span>
                <strong>{session.doctorName}</strong>
              </div>
            </div>

            <label className="telemedicine-field">
              <span>
                {isCard
                  ? (isBn ? 'টেস্ট কার্ড / অ্যাকাউন্ট নম্বর' : 'Sandbox Card / Account Number')
                  : (isBn ? `টেস্ট ${t(methodMeta.labelKey)} ওয়ালেট নম্বর` : `Sandbox ${t(methodMeta.labelKey)} Wallet Number`)}
              </span>
              <input
                type="text"
                required
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              />
            </label>

            {error && <p className="pmx-checkout-error">{error}</p>}

            <div className="pmx-checkout-actions">
              <button type="button" className="pmx-secondary-btn" onClick={handleCancel}>
                {t('cancel')}
              </button>
              <button type="submit" className="pmx-primary-submit-btn">
                <ShieldCheck size={16} />
                <span>{isBn ? `৳ ${session.amount} অনুমোদন করুন` : `Authorize ৳ ${session.amount}`}</span>
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  )
}
