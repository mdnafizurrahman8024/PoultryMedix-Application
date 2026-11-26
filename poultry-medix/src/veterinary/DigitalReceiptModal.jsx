import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckCircle2,
  Clock,
  Download,
  Printer,
  ShieldCheck,
  X,
} from 'lucide-react'
import { buildDigitalReceiptMarkup } from '../lib/paymentAdapter.js'
import { useLanguage } from '../context/useLanguage.js'

export default function DigitalReceiptModal({
  receipt,
  onClose,
}) {
  const { t, language } = useLanguage()
  const isBn = language === 'bn'
  const [statusNote, setStatusNote] = useState('')

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  if (!receipt) return null

  function handlePrintReceipt() {
    const html = buildDigitalReceiptMarkup(receipt, language)
    const popup = window.open('', '_blank')
    if (!popup) {
      handleDownloadReceipt()
      return
    }
    popup.opener = null
    popup.document.open()
    popup.document.write(html)
    popup.document.close()
    setStatusNote(isBn ? 'প্রিন্ট / PDF রিসিট উইন্ডো খোলা হয়েছে।' : 'Printable PDF receipt view opened.')
  }

  function handleDownloadReceipt() {
    const html = buildDigitalReceiptMarkup(receipt, language)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${receipt.trxId || receipt.id}-receipt.html`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
    setStatusNote(isBn ? 'ডিজিটাল রিসিট ডাউনলোড হয়েছে!' : 'Digital receipt downloaded!')
  }

  return createPortal(
    <div
      className="pmx-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="pmx-modal-card dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pmx-receipt-title"
      >
        <header className="pmx-modal-header dark:bg-gray-950 dark:border-gray-800">
          <div>
            <span className="pmx-receipt-verified-badge">
              <CheckCircle2 size={13} aria-hidden="true" />
              {t('receiptVerifiedBadge')}
            </span>
            <h2 id="pmx-receipt-title">{t('receiptModalTitle')}</h2>
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
          <div className="pmx-receipt-sheet dark:bg-gray-800 dark:border-gray-700">
            <div className="pmx-receipt-top">
              <div>
                <small>{t('receiptTransactionId')}</small>
                <strong className="pmx-receipt-trx">{receipt.trxId || receipt.id}</strong>
                {receipt.roomCode && (
                  <div style={{ marginTop: 4 }}>
                    <span className="pmx-room-code-pill">{receipt.roomCode}</span>
                  </div>
                )}
              </div>
              <span className="pmx-receipt-status">{receipt.status || 'Completed'}</span>
            </div>

            <div className="pmx-receipt-grid">
              <div>
                <small>{t('checkoutDoctorLabel')}</small>
                <strong>{receipt.doctorName || receipt.vetName}</strong>
                <span>{receipt.bvcRegNo}</span>
              </div>
              <div>
                <small>{t('checkoutFarmerLabel')}</small>
                <strong>{receipt.farmerName}</strong>
                <span>{[receipt.farmName, receipt.district].filter(Boolean).join(' · ')}</span>
              </div>
              <div>
                <small>{t('checkoutSlotLabel')}</small>
                <strong>{receipt.bookingDate} · {receipt.bookingTime}</strong>
              </div>
              <div>
                <small>{t('checkoutMethodLabel')}</small>
                <strong>{receipt.paymentMethodLabel} ({receipt.accountMask})</strong>
                {receipt.gatewayTrxRef && <span>Ref: {receipt.gatewayTrxRef}</span>}
              </div>
            </div>

            <div className="pmx-summary-fee dark:bg-emerald-950/50 dark:border-emerald-800">
              <div>
                <span>{t('checkoutFeeLabel')}</span>
                <small style={{ display: 'block', marginTop: 2, opacity: 0.8 }}>
                  {receipt.concern}
                </small>
              </div>
              <strong>৳ {receipt.amount}</strong>
            </div>

            <p className="pmx-receipt-sync-note">
              <ShieldCheck size={13} style={{ display: 'inline', marginRight: 5 }} aria-hidden="true" />
              {t('receiptSyncedNote')}
            </p>
          </div>

          <div className="pmx-receipt-schedule-note dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200">
            <Clock size={15} aria-hidden="true" className="shrink-0" />
            <span>{t('receiptScheduleProtocolNote', { date: receipt.bookingDate, time: receipt.bookingTime })}</span>
          </div>

          {statusNote && (
            <p className="telemedicine-status" role="status">
              {statusNote}
            </p>
          )}

          <div className="pmx-receipt-actions">
            <button type="button" className="pmx-secondary-btn dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700" onClick={handlePrintReceipt}>
              <Printer size={15} aria-hidden="true" />
              {t('receiptPrintPdf')}
            </button>
            <button type="button" className="pmx-secondary-btn dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700" onClick={handleDownloadReceipt}>
              <Download size={15} aria-hidden="true" />
              {t('receiptDownloadBtn')}
            </button>
            <button type="button" className="pmx-primary-submit-btn" onClick={onClose}>
              {t('close')}
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body
  )
}
