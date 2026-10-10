import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useLanguage } from '../context/useLanguage.js'
import Icon from '../components/Icon.jsx'

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

function formatDate(value, locale) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
}

function todayISODate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function printClinicalLog(records, locale, title) {
  const rows = records.map((record) => `
    <tr>
      <td>${escapeHtml(formatDate(record.observed_on, locale))}</td>
      <td>${escapeHtml(record.flock_label)}</td>
      <td>${escapeHtml(record.species)}${record.bird_count ? ` · ${escapeHtml(record.bird_count)}` : ''}</td>
      <td>${escapeHtml(record.signs)}</td>
      <td>${escapeHtml(record.outcome)}</td>
      <td>${escapeHtml(record.veterinarian_notes)}</td>
    </tr>`).join('')
  const report = `<!doctype html>
    <html lang="${escapeHtml(locale)}">
      <head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
        <style>
          body{font-family:Arial,sans-serif;color:#263b2c;margin:24px}
          h1{font-size:22px}p{font-size:11px;color:#647366}
          table{width:100%;border-collapse:collapse;font-size:10px}
          th,td{padding:8px;border:1px solid #d8e2d4;text-align:left;vertical-align:top}
          th{background:#edf4e9}tr{break-inside:avoid}
          @media print{body{margin:12mm}}
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p>${records.length} · ${escapeHtml(new Date().toLocaleString(locale))}</p>
        <table><thead><tr><th>Date</th><th>Flock</th><th>Species / count</th><th>Clinical signs</th><th>Outcome</th><th>Veterinary notes</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6">No records</td></tr>'}</tbody>
        </table>
        <script>window.addEventListener('load',()=>{window.print()})</script>
      </body>
    </html>`
  const popup = window.open('', '_blank')
  if (!popup) throw new Error('popup-blocked')
  popup.opener = null
  popup.document.open()
  popup.document.write(report)
  popup.document.close()
}

export default function ClinicalLog() {
  const { t, language } = useLanguage()
  const [records, setRecords] = useState([])
  const loading = false
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [flockLabel, setFlockLabel] = useState('')
  const [species, setSpecies] = useState('Chicken')
  const [birdCount, setBirdCount] = useState('')
  const [observedOn, setObservedOn] = useState(todayISODate)
  const [signs, setSigns] = useState('')
  const [outcome, setOutcome] = useState('')
  const [veterinarianNotes, setVeterinarianNotes] = useState('')
  const locale = language === 'bn' ? 'bn-BD' : 'en-BD'

  async function submitRecord(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const userId = sessionData.session?.user?.id
      if (!userId) throw new Error(t('dataHubSignInRequired'))
      const { error: insertError } = await supabase.from('clinical_flock_logs').insert({
        user_id: userId,
        flock_label: flockLabel.trim(),
        species: species.trim(),
        bird_count: birdCount ? Number(birdCount) : null,
        observed_on: observedOn,
        signs: signs.trim(),
        outcome: outcome.trim(),
        veterinarian_notes: veterinarianNotes.trim(),
      })
      if (insertError) throw insertError
      setRecords((currentRecords) => [{
        id: crypto.randomUUID(),
        flock_label: flockLabel.trim(),
        species: species.trim(),
        bird_count: birdCount ? Number(birdCount) : null,
        observed_on: observedOn,
        signs: signs.trim(),
        outcome: outcome.trim(),
        veterinarian_notes: veterinarianNotes.trim(),
        created_at: new Date().toISOString(),
      }, ...currentRecords])
      setFlockLabel('')
      setSpecies('Chicken')
      setBirdCount('')
      setSigns('')
      setOutcome('')
      setVeterinarianNotes('')
      setSuccess(t('clinicalLogSaved'))
    } catch (submitError) {
      setError(submitError.message || t('clinicalLogSaveError'))
    } finally {
      setSaving(false)
    }
  }

  function exportReport() {
    setError('')
    try {
      printClinicalLog(records, locale, t('clinicalLogTitle'))
    } catch (exportError) {
      setError(exportError.message === 'popup-blocked' ? t('clinicalLogPopupBlocked') : t('clinicalLogExportError'))
    }
  }

  return (
    <div className="veterinary-page clinical-log-page">
      <section className="veterinary-page-heading">
        <span className="veterinary-kicker">{t('veterinaryToolsEyebrow')}</span>
        <h1>{t('clinicalLogTitle')}</h1>
        <p>{t('clinicalLogDescription')}</p>
      </section>

      <form className="data-hub-form clinical-log-form" onSubmit={submitRecord}>
        <div className="data-hub-field-grid">
          <label className="veterinary-field"><span>{t('clinicalFlockLabel')}</span><input required maxLength={120} value={flockLabel} onChange={(event) => setFlockLabel(event.target.value)} placeholder={t('clinicalFlockPlaceholder')} /></label>
          <label className="veterinary-field"><span>{t('clinicalSpecies')}</span><input required maxLength={80} value={species} onChange={(event) => setSpecies(event.target.value)} /></label>
          <label className="veterinary-field"><span>{t('clinicalBirdCount')}</span><input type="number" min="1" max="1000000" step="1" value={birdCount} onChange={(event) => setBirdCount(event.target.value)} /></label>
          <label className="veterinary-field"><span>{t('clinicalDate')}</span><input type="date" required value={observedOn} onChange={(event) => setObservedOn(event.target.value)} /></label>
        </div>
        <label className="veterinary-field"><span>{t('clinicalSigns')}</span><textarea required maxLength={5000} rows="4" value={signs} onChange={(event) => setSigns(event.target.value)} placeholder={t('clinicalSignsPlaceholder')} /></label>
        <label className="veterinary-field"><span>{t('clinicalOutcome')}</span><textarea maxLength={5000} rows="2" value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder={t('clinicalOutcomePlaceholder')} /></label>
        <label className="veterinary-field"><span>{t('clinicalVetNotes')}</span><textarea maxLength={5000} rows="2" value={veterinarianNotes} onChange={(event) => setVeterinarianNotes(event.target.value)} placeholder={t('clinicalVetNotesPlaceholder')} /></label>
        {error && <p className="veterinary-error" role="alert">{error}</p>}
        {success && <p className="veterinary-success" role="status">{success}</p>}
        <button className="veterinary-primary-button" type="submit" disabled={saving}><Icon name="plus" size={17} />{saving ? t('clinicalLogSaving') : t('clinicalLogAdd')}</button>
      </form>

      <section className="clinical-records-section" aria-labelledby="clinical-records-heading">
        <div className="clinical-records-heading">
          <div className="veterinary-section-heading"><span className="veterinary-section-icon"><Icon name="chart" size={18} /></span><div><h2 id="clinical-records-heading">{t('clinicalRecords')}</h2><p>{t('clinicalLogPrivate')}</p></div></div>
          <button className="clinical-export-button" type="button" onClick={exportReport} disabled={loading}><Icon name="pdf" size={16} />{t('exportPdfReport')}</button>
        </div>
        {loading ? <p className="veterinary-hint">{t('clinicalLogLoading')}</p> : error ? <p className="veterinary-hint">{t('clinicalLogUnavailable')}</p> : records.length === 0 ? <p className="veterinary-hint">{t('clinicalLogEmpty')}</p> : (
          <div className="clinical-record-list">
            {records.map((record) => (
              <article className="clinical-record-card" key={record.id}>
                <div className="clinical-record-card-heading"><div><strong>{record.flock_label}</strong><span>{formatDate(record.observed_on, locale)}</span></div><span className="clinical-record-bird-count">{record.species}{record.bird_count ? ` · ${record.bird_count}` : ''}</span></div>
                <p><strong>{t('clinicalSigns')}:</strong> {record.signs}</p>
                {record.outcome && <p><strong>{t('clinicalOutcome')}:</strong> {record.outcome}</p>}
                {record.veterinarian_notes && <p><strong>{t('clinicalVetNotes')}:</strong> {record.veterinarian_notes}</p>}
              </article>
            ))}
          </div>
        )}
        <p className="veterinary-disclaimer">{t('clinicalLogDisclaimer')}</p>
      </section>
    </div>
  )
}
