import { useRef, useState } from 'react'
import { supabase } from './lib/supabase.js'
import { classifyPoultryImage, findLocalClinicalMatches, scanPrescription } from './lib/ai.js'
import { generateDiagnosticExplanation, REPORT_AI_FALLBACK_NOTE } from './lib/aiServiceAdapter.js'
import { getVerifiedVeterinarySources } from './lib/veterinarySources.js'
import { useLanguage } from './context/useLanguage.js'
import Icon from './components/Icon.jsx'
import VoiceRecorder from './components/VoiceRecorder.jsx'
import PrescriptionLookup from './veterinary/PrescriptionLookup.jsx'
import AiSafetyBanner from './components/AiSafetyBanner.jsx'
import { saveHistoryEntry, saveLocalPrescriptionAttachment, saveUnifiedLog } from './veterinary/historyStore.js'
import useSpeechToText from './hooks/useSpeechToText.js'

const maxFileSize = 8 * 1024 * 1024

function mergeSources(...sourceArrays) {
  const seen = new Set()
  const result = []
  for (const arr of sourceArrays) {
    if (!Array.isArray(arr)) continue
    for (const item of arr) {
      if (!item) continue
      const key = typeof item === 'object' ? (item.url || item.title) : item
      if (!seen.has(key)) {
        seen.add(key)
        result.push(item)
      }
    }
  }
  return result
}

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
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [currentReport, setCurrentReport] = useState(null)
  const modalOpenedAtRef = useRef(0)
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
    const symptomText = symptoms.trim()
    if (!symptomText && !image && !audio) {
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
      const allowGuestAi = import.meta.env.VITE_ALLOW_GUEST_AI === 'true'
      if (!accessToken && !import.meta.env.DEV && !allowGuestAi) throw new Error(t('aiSignInRequired'))

      // 1. Client-side evaluation: Teachable Machine on image & local clinical signs on symptoms
      let visualResult = null
      if (image) {
        try {
          visualResult = await classifyPoultryImage(image)
        } catch (modelError) {
          console.warn('[smart-diagnosis] Teachable Machine vision error:', modelError)
          setModelWarning(`${t('visualModelUnavailable')} ${modelError.message}`)
        }
      }

      const localMatches = symptomText ? findLocalClinicalMatches(symptomText) : []

      // Derive disease ranking & percentage breakdown
      let rankedPredictions = []
      let topDisease = 'Avian Health Screening'
      let topConfidence = 'Screened'

      if (visualResult?.predictions?.length) {
        rankedPredictions = visualResult.predictions.map((p) => ({
          disease: p.disease,
          confidence: p.confidence,
          percentage: `${(p.confidence * 100).toFixed(1)}%`,
          score: p.confidence,
        }))
        topDisease = visualResult.label || rankedPredictions[0].disease
        topConfidence = `${(visualResult.confidence * 100).toFixed(1)}%`
      } else if (localMatches.length) {
        rankedPredictions = localMatches.map((m) => ({
          disease: m.disease,
          confidence: m.score,
          percentage: `${Math.round(m.score * 100)}%`,
          matchedSigns: m.matchedSigns,
          score: m.score,
        }))
        topDisease = rankedPredictions[0].disease
        topConfidence = rankedPredictions[0].percentage
      } else if (audio) {
        rankedPredictions = [{
          disease: 'Respiratory Sound Observation',
          confidence: 0.85,
          percentage: 'Acoustic Screened',
          score: 0.85,
        }]
        topDisease = 'Flock Respiratory Audio Observation'
        topConfidence = 'Audio Recorded'
      } else if (symptomText) {
        topDisease = 'Clinical Symptom Evaluation'
        topConfidence = 'Observational'
      }

      const reportId = crypto.randomUUID()
      const initialReport = {
        id: reportId,
        createdAt: new Date().toISOString(),
        topDisease,
        topConfidence,
        predictions: rankedPredictions,
        visualResult,
        symptoms: symptomText,
        hasImage: Boolean(image),
        hasAudio: Boolean(audio),
        hasText: Boolean(symptomText),
        imageName: image?.name || '',
        audioName: audio?.name || '',
        explanation: '',
        explanationLoading: true,
        explanationFallback: false,
        sources: getVerifiedVeterinarySources(topDisease),
      }

      // 2. Open Diagnostic Report Window IMMEDIATELY & populate main-page answer card
      modalOpenedAtRef.current = Date.now()
      setCurrentReport(initialReport)
      setReportModalOpen(true)
      setLoading(false)

      const initialAnswer = {
        answer: `${topDisease}: Initial screening complete (${topConfidence}). Review the full breakdown in the open report window.`,
        predictions: rankedPredictions.map((p) => ({
          disease: p.disease,
          overall_probability: p.percentage,
          breakdown: {
            clinical_sign_match: p.matchedSigns?.length ? p.percentage : 'N/A',
            image_match: visualResult ? p.percentage : 'N/A',
            audio_match: audio ? 'Received' : 'N/A',
          },
        })),
        differential_diagnosis: `Screened condition: ${topDisease} (${topConfidence})`,
        sources: initialReport.sources,
        visualResult,
      }
      setAnswer(initialAnswer)

      // 3. Background AI explanation & biosecurity advice (non-blocking)
      generateDiagnosticExplanation({
        topDisease,
        confidence: topConfidence,
        predictions: rankedPredictions,
        symptoms: symptomText,
        language,
      }).then((aiResult) => {
        try {
          const explanationText = aiResult?.explanation || REPORT_AI_FALLBACK_NOTE
          const aiSources = aiResult?.sources || getVerifiedVeterinarySources(topDisease)
          const isFallback = Boolean(aiResult?.isFallback)

          setCurrentReport((prev) => {
            if (!prev || prev.id !== reportId) return prev
            return {
              ...prev,
              explanation: explanationText,
              explanationLoading: false,
              explanationFallback: isFallback,
              sources: mergeSources(prev.sources, aiSources, getVerifiedVeterinarySources(topDisease)),
            }
          })

          const fullAnswer = {
            answer: explanationText,
            predictions: rankedPredictions.map((p) => ({
              disease: p.disease,
              overall_probability: p.percentage,
              breakdown: {
                clinical_sign_match: p.matchedSigns?.length ? p.percentage : 'N/A',
                image_match: visualResult ? p.percentage : 'N/A',
                audio_match: audio ? 'Received' : 'N/A',
              },
            })),
            differential_diagnosis: explanationText,
            sources: mergeSources(initialReport.sources, aiSources, getVerifiedVeterinarySources(topDisease)),
            visualResult,
          }
          setAnswer(fullAnswer)

          setClinicalLogs((logs) => [...logs, {
            type: 'Smart Diagnosis',
            summary: symptomText || explanationText.slice(0, 140),
            createdAt: new Date().toISOString(),
          }])

          saveUnifiedLog('SMART_DIAGNOSIS', {
            symptoms: symptomText,
            summary: symptomText || explanationText.slice(0, 140),
            answer: explanationText,
            predictions: fullAnswer.predictions,
            differential_diagnosis: explanationText,
            files: files.map(({ name }) => name),
          })

          try {
            saveHistoryEntry('diagnosis', {
              id: reportId,
              createdAt: initialReport.createdAt,
              summary: `${topDisease} (${topConfidence}) - ${symptomText.slice(0, 80) || 'Flock triage'}`,
              answer: explanationText,
              predictions: fullAnswer.predictions,
              differential_diagnosis: explanationText,
              sources: fullAnswer.sources,
              visualResult,
              files: files.map(({ name }) => name),
            })
            setHistoryWarning('')
          } catch (historyError) {
            console.error('Unable to save Smart Diagnosis history.', historyError)
            setHistoryWarning(t('historySaveError'))
          }
        } catch (secondaryError) {
          console.warn('[smart-diagnosis] Secondary report update error:', secondaryError)
        }
      }).catch((aiError) => {
        console.warn('[smart-diagnosis] Background AI explanation error:', aiError)
        setCurrentReport((prev) => {
          if (!prev || prev.id !== reportId) return prev
          return {
            ...prev,
            explanation: REPORT_AI_FALLBACK_NOTE,
            explanationLoading: false,
            explanationFallback: true,
          }
        })
      })
    } catch (requestError) {
      setError(requestError.message || t('aiRequestFailed'))
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
    setReportModalOpen(false)
    setCurrentReport(null)
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
          <button className="diagnosis-submit" type="submit" disabled={loading || !Boolean(symptoms.trim() || image || audio)}>
            {loading ? <span className="ai-spinner" /> : <Icon name="stethoscope" size={17} />}
            {loading ? t('analyzing') : t('analyzeFlock')}
          </button>
          {(image || audio || prescription || symptoms || answer || currentReport) && <button className="diagnosis-reset" type="button" onClick={resetForm}>{t('clearForm')}</button>}
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

      {reportModalOpen && currentReport && (
        <div
          className="diagnosis-withdrawal-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget && Date.now() - modalOpenedAtRef.current > 400) {
              setReportModalOpen(false)
            }
          }}
        >
          <section
            className="diagnosis-report-modal dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="diagnosis-modal-heading dark:text-gray-100">
              <div>
                <span className="diagnosis-section-kicker dark:text-gray-300">CLINICAL TRIAGE REPORT</span>
                <h3 id="report-modal-title" className="dark:text-white">Flock Health Screening</h3>
              </div>
              <button className="dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700" type="button" onClick={() => setReportModalOpen(false)} aria-label="Close diagnostic report">
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="diagnosis-report-badge-list">
              {currentReport.hasImage && (
                <span className="diagnosis-report-badge">
                  <Icon name="image" size={13} />
                  <span>{currentReport.imageName || 'Flock Image'}</span>
                </span>
              )}
              {currentReport.hasAudio && (
                <span className="diagnosis-report-badge">
                  <Icon name="mic" size={13} />
                  <span>{currentReport.audioName || 'Flock Audio'}</span>
                </span>
              )}
              {currentReport.hasText && (
                <span className="diagnosis-report-badge">
                  <Icon name="spark" size={13} />
                  <span>Symptoms Noted</span>
                </span>
              )}
            </div>

            <div className="diagnosis-report-top-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#166534' }}>
                  Primary Condition Detected
                </span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#15803d' }}>
                  {currentReport.topConfidence}
                </span>
              </div>
              <h4 style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: '#0f172a' }}>
                {currentReport.topDisease}
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#475569' }}>
                {currentReport.hasImage
                  ? 'Calculated client-side via Google Teachable Machine edge vision model (i4VE4hlCa).'
                  : 'Screened against local clinical poultry pathogen and symptom indices.'}
              </p>
            </div>

            {currentReport.predictions?.length > 0 && (
              <div className="diagnosis-report-breakdown">
                <h5 style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                  Confidence Breakdown (% Score)
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {currentReport.predictions.slice(0, 5).map((pred) => {
                    const pct = typeof pred.confidence === 'number'
                      ? Math.min(100, Math.max(0, Math.round(pred.confidence * 100)))
                      : parseInt(pred.percentage, 10) || 0
                    return (
                      <div key={pred.disease} className="diagnosis-report-breakdown-row">
                        <span style={{ minWidth: '120px', fontWeight: 600 }}>{pred.disease}</span>
                        <div className="diagnosis-report-progress-bar-bg">
                          <div className="diagnosis-report-progress-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span style={{ minWidth: '50px', textAlign: 'right', fontWeight: 700 }}>
                          {pred.percentage || `${pct}%`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="diagnosis-report-ai-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Icon name="spark" size={16} />
                <h5 style={{ margin: 0, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Veterinary Guidance & Farm Biosecurity Advice
                </h5>
              </div>

              {currentReport.explanationLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0', fontSize: '13px', color: '#64748b' }}>
                  <span className="ai-spinner" />
                  <span>Analyzing flock findings and preparing biosecurity guidance…</span>
                </div>
              ) : (
                <div style={{ fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  <p style={{ margin: '0 0 8px' }}>{currentReport.explanation}</p>
                  {currentReport.explanationFallback && (
                    <p style={{ margin: '6px 0 0', fontWeight: 600, color: '#b45309' }}>
                      {REPORT_AI_FALLBACK_NOTE}
                    </p>
                  )}
                  {currentReport.sources?.length > 0 && (
                    <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                        Verified Clinical & Scientific Sources:
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {currentReport.sources.map((source, sIdx) => {
                          const isObj = typeof source === 'object' && source !== null
                          const title = isObj ? source.title : source
                          const url = isObj ? source.url : null
                          const provider = isObj ? source.provider : null
                          if (url) {
                            return (
                              <a
                                key={url || sIdx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#047857', fontWeight: 600, textDecoration: 'underline' }}
                              >
                                <span>{title} {provider ? `(${provider})` : ''}</span>
                                <Icon name="arrow" size={10} />
                              </a>
                            )
                          }
                          return <span key={sIdx} style={{ fontSize: '11px', color: '#64748b' }}>{title}</span>
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="diagnosis-report-disclaimer">
              <strong>Veterinary Safety Notice:</strong> This diagnostic tool is an initial screening aid and does not prescribe antibiotics or treatment dosages under AMR stewardship guidelines. Always verify with a licensed veterinarian before administering treatment.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <button
                type="button"
                className="diagnosis-glass-button dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                style={{ padding: '8px 18px', fontSize: '12px' }}
                onClick={() => setReportModalOpen(false)}
              >
                Close Report
              </button>
            </div>
          </section>
        </div>
      )}

      {withdrawalModalOpen && <div className="diagnosis-withdrawal-modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setWithdrawalModalOpen(false) }}>
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
        <div className="ai-answer-heading">
          <span><Icon name="spark" size={17} />{t('aiTriageSummary')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {currentReport && (
              <button
                type="button"
                style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, borderRadius: '8px', border: '1px solid #10b981', background: 'rgba(16, 185, 129, 0.1)', color: '#047857', cursor: 'pointer' }}
                onClick={() => setReportModalOpen(true)}
              >
                View Diagnostic Report Window
              </button>
            )}
            <span className="ai-safety-label">{t('informationalOnly')}</span>
          </div>
        </div>
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
        <div className="ai-source-row">
          <span className="source-badge"><Icon name="book" size={12} />{t('sourceReference')}</span>
          {answer.sources?.map((source, sIdx) => {
            const isObj = typeof source === 'object' && source !== null
            const title = isObj ? source.title : source
            const url = isObj ? source.url : null
            const provider = isObj ? source.provider : null
            if (url) {
              return (
                <a
                  key={url || sIdx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ai-source-name"
                  style={{ textDecoration: 'underline', color: '#047857', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>{title} {provider ? `(${provider})` : ''}</span>
                  <Icon name="arrow" size={10} />
                </a>
              )
            }
            return <span className="ai-source-name" key={title || sIdx}>{title}</span>
          })}
        </div>
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
