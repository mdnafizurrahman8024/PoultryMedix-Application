import { useRef, useState } from 'react'
import { supabase } from './lib/supabase.js'
import { runMultimodalDiagnosis } from './lib/ai.js'
import { useLanguage } from './context/useLanguage.js'
import Icon from './components/Icon.jsx'
import VoiceRecorder from './components/VoiceRecorder.jsx'
import PrescriptionLookup from './veterinary/PrescriptionLookup.jsx'
import AiSafetyBanner from './components/AiSafetyBanner.jsx'

const maxFileSize = 8 * 1024 * 1024

export default function DiagnosisHub() {
  const { t } = useLanguage()
  const imageInput = useRef(null)
  const imageCameraInput = useRef(null)
  const audioInput = useRef(null)
  const prescriptionInput = useRef(null)
  const prescriptionCameraInput = useRef(null)
  const [image, setImage] = useState(null)
  const [audio, setAudio] = useState(null)
  const [prescription, setPrescription] = useState(null)
  const [prescriptionAnalyzed, setPrescriptionAnalyzed] = useState(false)
  const [symptoms, setSymptoms] = useState('')
  const [answer, setAnswer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modelWarning, setModelWarning] = useState('')

  function acceptFile(file, expected) {
    setError('')
    if (!file) return null
    const imageTypes = ['image/jpeg', 'image/png']
    const isValid = expected === 'audio'
      ? file.type.startsWith('audio/')
      : expected === 'prescription'
        ? file.type === 'application/pdf' || imageTypes.includes(file.type)
        : imageTypes.includes(file.type)
    if (!isValid) {
      setError(t(expected === 'audio' ? 'audioFormatError' : expected === 'prescription' ? 'prescriptionFormatError' : 'imageFormatError'))
      return null
    }
    if (file.size > maxFileSize) {
      setError(t('aiFileTooLarge'))
      return null
    }
    return file
  }

  async function submitDiagnosis(event) {
    event.preventDefault()
    const files = [image, audio, prescription].filter(Boolean)
    if (!symptoms.trim() && !files.length) {
      setError(t('aiInputRequired'))
      return
    }
    setError('')
    setModelWarning('')
    setAnswer(null)
    setPrescriptionAnalyzed(Boolean(prescription))
    setLoading(true)
    try {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (!data.session?.access_token) throw new Error(t('aiSignInRequired'))
      const result = await runMultimodalDiagnosis({
        text: symptoms.trim(),
        files,
        accessToken: data.session.access_token,
        onModelWarning: () => setModelWarning(t('visualModelUnavailable')),
      })
      setAnswer(result)
    } catch (requestError) {
      setError(requestError.message || t('aiRequestFailed'))
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setSymptoms('')
    setImage(null)
    setAudio(null)
    setPrescription(null)
    setPrescriptionAnalyzed(false)
    setAnswer(null)
    setError('')
    setModelWarning('')
    if (imageInput.current) imageInput.current.value = ''
    if (imageCameraInput.current) imageCameraInput.current.value = ''
    if (audioInput.current) audioInput.current.value = ''
    if (prescriptionInput.current) prescriptionInput.current.value = ''
    if (prescriptionCameraInput.current) prescriptionCameraInput.current.value = ''
  }

  return (
    <section className="diagnosis-hub" aria-labelledby="diagnosis-hub-title">
      <AiSafetyBanner />
      <div className="diagnosis-hub-heading">
        <div className="diagnosis-heading-icon"><Icon name="stethoscope" size={20} /></div>
        <div className="diagnosis-heading-copy">
          <span className="diagnosis-kicker">{t('diagnosisHubEyebrow')}</span>
          <h2 id="diagnosis-hub-title">{t('diagnosisHubTitle')}</h2>
          <p>{t('diagnosisHubDescription')}</p>
        </div>
        <span className="diagnosis-ai-tag"><span />{t('geminiPowered')}</span>
      </div>

      <form onSubmit={submitDiagnosis}>
        <label className="diagnosis-symptom-label" htmlFor="diagnosis-symptoms">{t('symptomsLabel')}</label>
        <textarea
          id="diagnosis-symptoms"
          className="diagnosis-symptom-input"
          value={symptoms}
          onChange={(event) => setSymptoms(event.target.value)}
          placeholder={t('symptomsPlaceholder')}
          rows="3"
        />

        <div className="diagnosis-attachment-grid">
          <section className="diagnosis-attachment" aria-labelledby="diagnosis-image-title">
            <div className="diagnosis-input-card-heading">
              <span className="attachment-icon attachment-icon--image"><Icon name="image" size={19} /></span>
              <div><h3 id="diagnosis-image-title">{t('flockImageTitle')}</h3><p>{image?.name || t('flockImageDescription')}</p></div>
              {image && <button className="remove-attachment" type="button" aria-label={t('removeImage')} onClick={() => { setImage(null); if (imageInput.current) imageInput.current.value = ''; if (imageCameraInput.current) imageCameraInput.current.value = '' }}><Icon name="remove" size={16} /></button>}
            </div>
            <div className="diagnosis-input-options">
              <input ref={imageInput} className="visually-hidden-input" type="file" accept="image/jpeg,image/png" aria-label={t('uploadImage')} onChange={(event) => setImage(acceptFile(event.target.files?.[0], 'image'))} />
              <input ref={imageCameraInput} className="visually-hidden-input" type="file" accept="image/jpeg,image/png" capture="environment" aria-label={t('useLiveCamera')} onChange={(event) => setImage(acceptFile(event.target.files?.[0], 'image'))} />
              <button className={`diagnosis-input-option${image ? ' has-file' : ''}`} type="button" aria-label={t('uploadImage')} onClick={() => imageInput.current?.click()}>
                <Icon name="upload" size={15} /><span>{t('uploadShort')}</span>
              </button>
              <button className="diagnosis-input-option" type="button" aria-label={t('useLiveCamera')} onClick={() => imageCameraInput.current?.click()}>
                <Icon name="camera" size={15} /><span>{t('liveShort')}</span>
              </button>
            </div>
          </section>

          <section className="diagnosis-attachment" aria-labelledby="diagnosis-audio-title">
            <div className="diagnosis-input-card-heading">
              <span className="attachment-icon attachment-icon--audio"><Icon name="mic" size={19} /></span>
              <div><h3 id="diagnosis-audio-title">{t('audioObservationTitle')}</h3><p>{audio?.name || t('audioObservationDescription')}</p></div>
              {audio && <button className="remove-attachment" type="button" aria-label={t('removeAudio')} onClick={() => setAudio(null)}><Icon name="remove" size={16} /></button>}
            </div>
            <div className="diagnosis-input-options">
              <input ref={audioInput} className="visually-hidden-input" type="file" accept="audio/*" aria-label={t('uploadAudioFile')} onChange={(event) => setAudio(acceptFile(event.target.files?.[0], 'audio'))} />
              <button className={`diagnosis-input-option${audio ? ' has-file' : ''}`} type="button" aria-label={t('uploadAudioFile')} onClick={() => audioInput.current?.click()}>
                <Icon name="upload" size={15} /><span>{t('uploadShort')}</span>
              </button>
              <div className="diagnosis-input-option diagnosis-input-option--record">
                <VoiceRecorder compact buttonLabel={t('liveShort')} buttonAriaLabel={t('recordLiveAudio')} onAudioReady={(blob) => setAudio(new File([blob], `flock-audio-${Date.now()}.webm`, { type: blob.type || 'audio/webm' }))} />
              </div>
            </div>
          </section>

          <section className="diagnosis-attachment" aria-labelledby="diagnosis-prescription-title">
            <div className="diagnosis-input-card-heading">
              <span className="attachment-icon attachment-icon--pdf"><Icon name="pdf" size={19} /></span>
              <div><h3 id="diagnosis-prescription-title">{t('prescriptionTitle')}</h3><p>{prescription?.name || t('prescriptionDescription')}</p></div>
              {prescription && <button className="remove-attachment" type="button" aria-label={t('removePrescription')} onClick={() => { setPrescription(null); setPrescriptionAnalyzed(false); if (prescriptionInput.current) prescriptionInput.current.value = ''; if (prescriptionCameraInput.current) prescriptionCameraInput.current.value = '' }}><Icon name="remove" size={16} /></button>}
            </div>
            <div className="diagnosis-input-options">
              <input ref={prescriptionInput} className="visually-hidden-input" type="file" accept="application/pdf,.pdf,image/jpeg,image/png" aria-label={t('uploadPrescription')} onChange={(event) => { setPrescriptionAnalyzed(false); setPrescription(acceptFile(event.target.files?.[0], 'prescription')) }} />
              <input ref={prescriptionCameraInput} className="visually-hidden-input" type="file" accept="image/jpeg,image/png" capture="environment" aria-label={t('useLiveCamera')} onChange={(event) => { setPrescriptionAnalyzed(false); setPrescription(acceptFile(event.target.files?.[0], 'prescription')) }} />
              <button className={`diagnosis-input-option${prescription ? ' has-file' : ''}`} type="button" aria-label={t('uploadPrescription')} onClick={() => prescriptionInput.current?.click()}>
                <Icon name="upload" size={15} /><span>{t('uploadShort')}</span>
              </button>
              <button className="diagnosis-input-option" type="button" aria-label={t('useLiveCamera')} onClick={() => prescriptionCameraInput.current?.click()}>
                <Icon name="camera" size={15} /><span>{t('liveShort')}</span>
              </button>
            </div>
          </section>
        </div>

        <p className="diagnosis-accuracy-note"><Icon name="spark" size={15} />{t('accuracyTip')}</p>
        {error && <p className="diagnosis-error" role="alert">{error}</p>}
        {modelWarning && <p className="diagnosis-warning" role="status">{modelWarning}</p>}

        <div className="diagnosis-actions">
          <button className="diagnosis-submit" type="submit" disabled={loading}>
            {loading ? <span className="ai-spinner" /> : <Icon name="stethoscope" size={17} />}
            {loading ? t('analyzing') : t('analyzeFlock')}
          </button>
          {(image || audio || prescription || symptoms || answer) && <button className="diagnosis-reset" type="button" onClick={resetForm}>{t('clearForm')}</button>}
        </div>
      </form>

      {prescription && prescriptionAnalyzed && <PrescriptionLookup />}

      {answer && <div className="ai-answer-card" aria-live="polite">
        <div className="ai-answer-heading"><span><Icon name="spark" size={17} />{t('aiTriageSummary')}</span><span className="ai-safety-label">{t('informationalOnly')}</span></div>
        {answer.visualResult && <p className="visual-classification"><Icon name="image" size={15} />{t('visualClassification')}: <strong>{answer.visualResult.label}</strong> ({Math.round(answer.visualResult.confidence * 100)}%)</p>}
        <p className="ai-answer-text">{answer.answer}</p>
        <div className="ai-source-row"><span className="source-badge"><Icon name="book" size={12} />{t('sourceReference')}</span>{answer.sources.map((source) => <span className="ai-source-name" key={source}>{source}</span>)}</div>
        <section className="reference-video-section" aria-labelledby="reference-video-title">
          <h3 id="reference-video-title"><Icon name="video" size={16} />{t('referenceVideoTitle')}</h3>
          <p>{t('referenceVideoDescription')}</p>
          <a href="https://www.youtube.com/results?search_query=Bangladesh+Department+of+Livestock+Services+poultry+health+biosecurity" target="_blank" rel="noreferrer">
            {t('findDlsVideos')}<Icon name="arrow" size={14} />
          </a>
        </section>
      </div>}
    </section>
  )
}
