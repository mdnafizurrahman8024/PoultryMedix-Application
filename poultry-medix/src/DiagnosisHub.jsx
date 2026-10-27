import { useRef, useState } from 'react'
import { supabase } from './lib/supabase.js'
import { analyzeSmartDiagnosis, scanPrescription } from './lib/ai.js'
import { useLanguage } from './context/useLanguage.js'
import Icon from './components/Icon.jsx'
import VoiceRecorder from './components/VoiceRecorder.jsx'
import PrescriptionLookup from './veterinary/PrescriptionLookup.jsx'
import AiSafetyBanner from './components/AiSafetyBanner.jsx'
import { saveHistoryEntry, saveLocalPrescriptionAttachment, saveUnifiedLog } from './veterinary/historyStore.js'
import useSpeechToText from './hooks/useSpeechToText.js'

const maxFileSize = 8 * 1024 * 1024

export default function DiagnosisHub() {
  const { t, language } = useLanguage()
  const imageInput = useRef(null)
  const imageCameraInput = useRef(null)
  const audioInput = useRef(null)
  const prescriptionInput = useRef(null)
  const prescriptionCameraInput = useRef(null)
  const [image, setImage] = useState(null)
  const [audio, setAudio] = useState(null)
  const [prescription, setPrescription] = useState(null)
  const [symptoms, setSymptoms] = useState('')
  const [answer, setAnswer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [historyWarning, setHistoryWarning] = useState('')
  const [modelWarning, setModelWarning] = useState('')
  const [, setClinicalLogs] = useState([])
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false)
  const [prescriptionLoading, setPrescriptionLoading] = useState(false)
  const [prescriptionError, setPrescriptionError] = useState('')
  const [prescriptionResult, setPrescriptionResult] = useState(null)
  const [saveMessage, setSaveMessage] = useState('')
  const speech = useSpeechToText({ language, value: symptoms, onChange: setSymptoms, onError: (key) => setError(t(key)) })

  async function savePrescriptionAnalysis(file, result) {
    const recordId = crypto.randomUUID()
    const medicines = Array.isArray(result.medicines) ? result.medicines : []
    const summary = medicines.map((medicine) => medicine.tradeName || medicine.genericNames?.join(', ')).filter(Boolean).join(', ') || 'Prescription scan: no medicine identified'
    let imageUrl = ''
    try {
      imageUrl = await saveLocalPrescriptionAttachment(file, recordId)
    } catch (attachmentError) {
      console.error('Unable to save prescription attachment to device history.', attachmentError)
    }

    let databaseSaved = false
    try {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const user = data.session?.user
      if (user) {
        const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storagePath = `${user.id}/prescription-scans/${recordId}-${safeFileName}`
        const { error: uploadError } = await supabase.storage.from('clinical-submissions').upload(storagePath, file, { contentType: file.type, upsert: false })
        if (uploadError) throw uploadError
        const { data: signedImage, error: signedUrlError } = await supabase.storage.from('clinical-submissions').createSignedUrl(storagePath, 60 * 60 * 24 * 365)
        if (signedUrlError) console.error('Unable to create prescription attachment URL.', signedUrlError)
        const { error: insertError } = await supabase.from('prescription_analysis_logs').insert({
          id: recordId,
          user_id: user.id,
          file_name: file.name,
          image_path: storagePath,
          image_url: signedImage?.signedUrl || null,
          transcription: result.transcription || '',
          medicines,
          sources: result.sources || [],
        })
        if (insertError) {
          await supabase.storage.from('clinical-submissions').remove([storagePath])
          throw insertError
        }
        imageUrl = storagePath
        databaseSaved = true
      }
    } catch (databaseError) {
      console.error('Unable to save prescription scan to Supabase Clinical Log.', databaseError)
    }

    saveUnifiedLog('PRESCRIPTION_SCAN', {
      summary,
      fileName: file.name,
      imageUrl,
      transcription: result.transcription || '',
      drugs: medicines.map((medicine) => ({
        name: medicine.tradeName,
        genericNames: medicine.genericNames || [],
        withdrawalPeriod: medicine.withdrawalPeriod || 'Data not found in current guidelines.',
        sources: (medicine.sources || []).map(({ label, url, provider }) => ({ label, url, provider })),
      })),
      sources: (result.sources || []).map(({ label, url, provider }) => ({ label, url, provider })),
      databaseSaved,
    }, recordId)
    setSaveMessage(databaseSaved ? 'Prescription analysis saved to Clinical Log.' : 'Prescription analysis saved to this device’s Clinical Log.')
  }

  async function handlePrescriptionFile(file) {
    const acceptedFile = acceptFile(file, 'prescription')
    setPrescription(acceptedFile)
    setPrescriptionResult(null)
    setPrescriptionError('')
    setSaveMessage('')
    if (!acceptedFile) return
    setWithdrawalModalOpen(false)
    setPrescriptionLoading(true)
    try {
      const result = await scanPrescription(acceptedFile)
      setPrescriptionResult(result)
      await savePrescriptionAnalysis(acceptedFile, result)
      setWithdrawalModalOpen(true)
    } catch (scanError) {
      setPrescriptionError(scanError.message || 'Prescription analysis could not be completed.')
      setError(scanError.message || 'Prescription analysis could not be completed.')
      setWithdrawalModalOpen(true)
    } finally {
      setPrescriptionLoading(false)
    }
  }

  function handlePrescriptionCapture(event) {
    handlePrescriptionFile(event.target.files?.[0])
    event.target.value = ''
  }

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
    speech.stop()
    const files = [image, audio].filter(Boolean)
    if (!symptoms.trim() && !image && !audio) {
      setError(t('aiInputRequired'))
      return
    }
    setError('')
    setModelWarning('')
    setAnswer(null)
    setLoading(true)
    try {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const accessToken = data.session?.access_token
      if (!accessToken && !import.meta.env.DEV) throw new Error(t('aiSignInRequired'))
      const result = await analyzeSmartDiagnosis({
        text: symptoms.trim(),
        imageFile: image,
        audioFile: audio,
        accessToken,
        appLanguage: language,
        onModelWarning: (modelError) => setModelWarning(`${t('visualModelUnavailable')} ${modelError.message}`),
      })
      setAnswer(result)
      setClinicalLogs((logs) => [...logs, {
        type: 'Smart Diagnosis',
        summary: symptoms.trim() || result.answer.slice(0, 140),
        createdAt: new Date().toISOString(),
      }])
      saveUnifiedLog('SMART_DIAGNOSIS', {
        symptoms: symptoms.trim(),
        summary: symptoms.trim() || result.answer.slice(0, 140),
        answer: result.answer,
        predictions: result.predictions,
        differential_diagnosis: result.differential_diagnosis,
        files: files.map(({ name }) => name),
      })
      setSaveMessage(t('antibiotics.savedToClinicalLog'))
      try {
        saveHistoryEntry('diagnosis', {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          summary: symptoms.trim().slice(0, 140) || result.answer.slice(0, 140),
          answer: result.answer,
          predictions: result.predictions,
          differential_diagnosis: result.differential_diagnosis,
          sources: result.sources || [],
          visualResult: result.visualResult || null,
          files: files.map(({ name }) => name),
        })
        setHistoryWarning('')
      } catch (historyError) {
        console.error('Unable to save Smart Diagnosis history.', historyError)
        setHistoryWarning(t('historySaveError'))
      }
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
    setPrescriptionResult(null)
    setPrescriptionError('')
    setWithdrawalModalOpen(false)
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
    <section className="diagnosis-hub bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white" aria-labelledby="diagnosis-hub-title">
      <AiSafetyBanner />
      <div className="diagnosis-hub-heading">
        <div className="diagnosis-heading-icon"><Icon name="stethoscope" size={20} /></div>
        <div className="diagnosis-heading-copy">
          <span className="diagnosis-kicker">{t('diagnosisHubEyebrow')}</span>
          <h2 id="diagnosis-hub-title">{t('diagnosisHubTitle')}</h2>
          <p>{t('diagnosisHubDescription')}</p>
        </div>
      </div>

      <form onSubmit={submitDiagnosis}>
        <section className="diagnosis-tool-card diagnosis-smart-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700" aria-labelledby="smart-diagnosis-title">
          <div className="diagnosis-section-heading dark:text-white">
            <div><span className="diagnosis-section-kicker dark:text-gray-200 dark:font-semibold">{t('sectionOne')}</span><h3 id="smart-diagnosis-title" className="dark:text-white dark:font-bold">{t('smartDiagnosis')}</h3><p className="dark:text-gray-200">{t('smartDiagnosisDescription')}</p></div>
            <span className="diagnosis-section-icon"><Icon name="spark" size={20} /></span>
          </div>
          <label className="diagnosis-symptom-label dark:text-gray-100 dark:font-semibold" htmlFor="diagnosis-symptoms">{t('symptomsLabel')}</label>
          <div className="diagnosis-textarea-wrap">
            <textarea
              id="diagnosis-symptoms"
              className="diagnosis-symptom-input dark:bg-gray-900 dark:text-white dark:border-gray-600 dark:placeholder-gray-400"
              value={symptoms}
              onChange={(event) => setSymptoms(event.target.value)}
              placeholder={t('symptomsPlaceholder')}
              rows="3"
            />
            <button className={`diagnosis-textarea-mic${speech.listening ? ' is-listening' : ''}`} type="button" aria-label={t(speech.listening ? 'stopVoiceTyping' : 'startVoiceTyping')} aria-pressed={speech.listening} onClick={() => { setError(''); speech.start() }} disabled={loading}><Icon name="mic" size={16} /></button>
          </div>
          <div className="diagnosis-attachment-grid diagnosis-media-grid">
          <section className="diagnosis-attachment" aria-labelledby="diagnosis-image-title">
            <div className="diagnosis-input-card-heading dark:text-gray-100">
              <span className="attachment-icon attachment-icon--image"><Icon name="image" size={19} /></span>
              <div><h3 id="diagnosis-image-title" className="dark:text-white dark:font-bold">{t('flockImageTitle')}</h3><p className="dark:text-gray-200">{image?.name || t('flockImageDescription')}</p></div>
              {image && <button className="remove-attachment" type="button" aria-label={t('removeImage')} onClick={() => { setImage(null); if (imageInput.current) imageInput.current.value = ''; if (imageCameraInput.current) imageCameraInput.current.value = '' }}><Icon name="remove" size={16} /></button>}
            </div>
            <div className="diagnosis-input-options">
              <input ref={imageInput} className="visually-hidden-input" type="file" accept="image/jpeg,image/png" aria-label={t('uploadImage')} onChange={(event) => setImage(acceptFile(event.target.files?.[0], 'image'))} />
              <input ref={imageCameraInput} className="visually-hidden-input" type="file" accept="image/jpeg,image/png" capture="environment" aria-label={t('useLiveCamera')} onChange={(event) => setImage(acceptFile(event.target.files?.[0], 'image'))} />
              <button className={`diagnosis-input-option dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-700${image ? ' has-file' : ''}`} type="button" aria-label={t('uploadImage')} onClick={() => imageInput.current?.click()}>
                <Icon name="upload" size={15} /><span>{t('uploadShort')}</span>
              </button>
              <button className="diagnosis-input-option dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-700" type="button" aria-label={t('useLiveCamera')} onClick={() => imageCameraInput.current?.click()}>
                <Icon name="camera" size={15} /><span>{t('liveShort')}</span>
              </button>
            </div>
          </section>

          <section className="diagnosis-attachment" aria-labelledby="diagnosis-audio-title">
            <div className="diagnosis-input-card-heading dark:text-gray-100">
              <span className="attachment-icon attachment-icon--audio"><Icon name="mic" size={19} /></span>
              <div><h3 id="diagnosis-audio-title" className="dark:text-white dark:font-bold">{t('audioObservationTitle')}</h3><p className="dark:text-gray-200">{audio?.name || t('audioObservationDescription')}</p></div>
              {audio && <button className="remove-attachment" type="button" aria-label={t('removeAudio')} onClick={() => { setAudio(null); if (audioInput.current) audioInput.current.value = '' }}><Icon name="remove" size={16} /></button>}
            </div>
            <div className="upload-type-category-actions diagnosis-smart-audio-actions">
              <input ref={audioInput} className="visually-hidden-input" type="file" accept="audio/*" aria-label={t('uploadAudioFile')} onChange={(event) => { setAudio(acceptFile(event.target.files?.[0], 'audio')); event.target.value = '' }} />
              <button className="upload-type-action upload-type-action--upload" type="button" aria-label={t('uploadAudioFile')} onClick={() => audioInput.current?.click()}>
                <Icon name="upload" size={15} /><span>{t('uploadShort')}</span>
              </button>
              <VoiceRecorder compact buttonLabel={t('liveShort')} buttonAriaLabel={t('recordLiveAudio')} onAudioReady={(blob) => setAudio(new File([blob], `flock-audio-${Date.now()}.webm`, { type: blob.type || 'audio/webm' }))} />
            </div>
          </section>
          </div>
        </section>

        <p className="diagnosis-accuracy-note"><Icon name="spark" size={15} />{t('accuracyTip')}</p>
        {error && <p className="diagnosis-error" role="alert">{error}</p>}
        {modelWarning && <p className="diagnosis-warning" role="status">{modelWarning}</p>}
        {historyWarning && <p className="diagnosis-warning" role="status">{historyWarning}</p>}

        <div className="diagnosis-actions">
          <button className="diagnosis-submit" type="submit" disabled={loading}>
            {loading ? <span className="ai-spinner" /> : <Icon name="stethoscope" size={17} />}
            {loading ? t('analyzing') : t('analyzeFlock')}
          </button>
          {(image || audio || prescription || symptoms || answer) && <button className="diagnosis-reset" type="button" onClick={resetForm}>{t('clearForm')}</button>}
        </div>
      </form>

      <section className="diagnosis-tool-card diagnosis-prescription-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700" aria-labelledby="prescription-info-title">
        <div className="diagnosis-section-heading dark:text-gray-100">
          <div><span className="diagnosis-section-kicker dark:text-gray-300">{t('sectionTwo')}</span><h3 id="prescription-info-title" className="dark:text-gray-100">{t('prescriptionWithdrawal')}</h3><p className="dark:text-gray-300">{t('prescriptionWithdrawalDescription')}</p></div>
          <span className="diagnosis-section-icon"><Icon name="pill" size={20} /></span>
        </div>
        <input ref={prescriptionInput} className="visually-hidden-input" type="file" accept="application/pdf,.pdf,image/jpeg,image/png" aria-label={t('uploadPrescription')} onChange={(event) => { handlePrescriptionFile(event.target.files?.[0]); event.target.value = '' }} />
        <input ref={prescriptionCameraInput} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} aria-label={t('useLiveCamera')} onChange={handlePrescriptionCapture} />
        <div className="diagnosis-prescription-actions">
          <button className="diagnosis-glass-button diagnosis-glass-button--primary dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-700" type="button" onClick={() => prescriptionCameraInput.current?.click()}><Icon name="camera" size={17} />{t('takePhotoScan')}</button>
          <button className="diagnosis-glass-button dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-700" type="button" onClick={() => prescriptionInput.current?.click()}><Icon name="upload" size={17} />{t('uploadPrescriptionPhoto')}</button>
        </div>
        {prescriptionLoading && <div className="prescription-rag-loading" role="status"><span className="ai-spinner" /> Reading prescription and searching medical references…</div>}
      </section>

      <section className="diagnosis-tool-card diagnosis-dose-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700" aria-labelledby="dose-calculator-title">
        <div className="diagnosis-section-heading dark:text-gray-100">
          <div><span className="diagnosis-section-kicker dark:text-gray-300">{t('sectionThree')}</span><h3 id="dose-calculator-title" className="dark:text-gray-100">{t('doseCalculator')}</h3><p className="dark:text-gray-300">{t('doseValuesWarning')}</p></div>
          <span className="diagnosis-section-icon"><Icon name="calculator" size={20} /></span>
        </div>
        <PrescriptionLookup hideDrugInfo alwaysShowDose />
      </section>

      {withdrawalModalOpen && <div className="diagnosis-withdrawal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setWithdrawalModalOpen(false) }}>
        <section className="diagnosis-withdrawal-modal dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700" role="dialog" aria-modal="true" aria-labelledby="withdrawal-modal-title">
          <div className="diagnosis-modal-heading dark:text-gray-100"><div><span className="diagnosis-section-kicker dark:text-gray-300">{t('antibiotics.extractedResult')}</span><h3 id="withdrawal-modal-title">{t('antibiotics.drugWithdrawalInfo')}</h3></div><button className="dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700" type="button" onClick={() => setWithdrawalModalOpen(false)} aria-label={t('antibiotics.closeWithdrawalInfo')}><Icon name="close" size={18} /></button></div>
          {prescriptionResult && <>
            {prescriptionResult.transcription && <details className="prescription-rag-transcription"><summary>Extracted prescription text</summary><p>{prescriptionResult.transcription}</p></details>}
            {!prescriptionResult.medicines?.length && <p>Medicine names could not be reliably identified from this upload.</p>}
            {prescriptionResult.medicines?.map((drug, index) => <article className="diagnosis-modal-drug dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700" key={`${drug.tradeName}-${index}`}>
              <div className="drug-info-title-row"><h4>{drug.tradeName || 'Unidentified medicine'}</h4><span className="drug-class-badge">Trade name</span></div>
              <p>Generic name(s): {drug.genericNames?.length ? drug.genericNames.join(', ') : 'Not resolved confidently.'}</p>
              <div className="prescription-rag-source"><strong>Withdrawal Period</strong><p>{drug.withdrawalPeriod || 'Data not found in current guidelines.'}</p></div>
              {drug.sources?.map((source, sourceIndex) => <div className="prescription-rag-source" key={`${source.label}-${sourceIndex}`}><strong>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : source.label}</strong><p>{source.content}</p></div>)}
            </article>)}
            <section className="prescription-rag-references" aria-labelledby="prescription-rag-references-title">
              <h4 id="prescription-rag-references-title">Medical References / Sources</h4>
              {prescriptionResult.sources?.length ? <ul>{prescriptionResult.sources.map((source) => <li key={source.label}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : source.label} <span>({source.provider || source.metadata?.provider || 'Supabase documents'})</span></li>)}</ul> : <p>Source: Supabase documents returned no matching withdrawal-period reference.</p>}
            </section>
          </>}
          {prescriptionError && <p className="diagnosis-error" role="alert">{prescriptionError}</p>}
        </section>
      </div>}

      {saveMessage && <p className="diagnosis-save-message" role="status">{saveMessage}</p>}
      {answer && <div className="ai-answer-card" aria-live="polite">
        <div className="ai-answer-heading"><span><Icon name="spark" size={17} />{t('aiTriageSummary')}</span><span className="ai-safety-label">{t('informationalOnly')}</span></div>
        {answer.visualResult && <p className="visual-classification"><Icon name="image" size={15} />{t('visualClassification')}: <strong>{answer.visualResult.label}</strong> ({Math.round(answer.visualResult.confidence * 100)}%)</p>}
        {answer.predictions?.length > 0 && <section className="diagnosis-prediction-results" aria-labelledby="diagnosis-prediction-title">
          <h3 id="diagnosis-prediction-title">Prediction breakdown</h3>
          <p className="diagnosis-prediction-note">Percentages are supporting model/sign-match scores, not calibrated disease probabilities.</p>
          {answer.predictions.map((prediction) => <article className="diagnosis-prediction-card" key={prediction.disease}>
            <div className="diagnosis-prediction-heading"><strong>{prediction.disease}</strong><span>{prediction.overall_probability}</span></div>
            <div className="diagnosis-prediction-breakdown">
              <div><span>Clinical Signs</span><strong>{prediction.breakdown.clinical_sign_match}</strong></div>
              <div><span>Image</span><strong>{prediction.breakdown.image_match}</strong></div>
              <div><span>Audio</span><strong>{prediction.breakdown.audio_match}</strong></div>
            </div>
          </article>)}
        </section>}
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
