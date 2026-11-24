import { useRef, useState } from 'react'
import { supabase } from './lib/supabase.js'
import { classifyPoultryImage, findLocalClinicalMatches, scanPrescription, canonicalDiseaseName } from './lib/ai.js'
import { BANGLADESH_POULTRY_DRUG_DATABASE } from './lib/prescriptionRAG.js'
import { saveDiagnosisLog, savePrescriptionLog } from './lib/clinicalLogsStore.js'
import { generateDiagnosticExplanation, REPORT_AI_FALLBACK_NOTE } from './lib/aiServiceAdapter.js'
import { getVerifiedVeterinarySources } from './lib/veterinarySources.js'
import { useLanguage } from './context/useLanguage.js'
import Icon from './components/Icon.jsx'
import VoiceRecorder from './components/VoiceRecorder.jsx'
import AiSafetyBanner from './components/AiSafetyBanner.jsx'
import { saveHistoryEntry, saveLocalPrescriptionAttachment, saveUnifiedLog } from './veterinary/historyStore.js'
import useSpeechToText from './hooks/useSpeechToText.js'

const maxFileSize = 8 * 1024 * 1024

function deduplicatePredictions(preds) {
  if (!Array.isArray(preds)) return []
  const map = new Map()
  for (const item of preds) {
    const rawName = item?.disease || item?.className || item?.label || ''
    if (!rawName) continue
    const norm = (typeof canonicalDiseaseName === 'function' ? canonicalDiseaseName(rawName) : rawName) || rawName
    const key = norm.toLowerCase().replace(/[^a-z0-9]/g, '')
    const conf = typeof item.confidence === 'number'
      ? item.confidence
      : parseFloat(item.percentage) / 100 || 0
    const existing = map.get(key)
    if (!existing || conf > existing.confidence) {
      map.set(key, {
        ...item,
        disease: norm,
        confidence: conf,
        percentage: item.percentage || `${(conf * 100).toFixed(1)}%`,
        score: conf,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.confidence - a.confidence)
}

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
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [currentReport, setCurrentReport] = useState(null)
  const modalOpenedAtRef = useRef(0)
  const [prescriptionLoading, setPrescriptionLoading] = useState(false)
  const [prescriptionError, setPrescriptionError] = useState('')
  const [prescriptionResult, setPrescriptionResult] = useState(null)
  const [prescriptionPreview, setPrescriptionPreview] = useState(null)
  const [showDrugFormulary, setShowDrugFormulary] = useState(false)
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

    savePrescriptionLog({
      id: recordId,
      source: 'image_scan',
      fileName: file.name,
      district: 'Rajshahi',
      transcription: result.transcription || '',
      medications: medicines,
      advice: result.transcription || 'Extracted via Prescription Image Analyzer',
    })

    setSaveMessage(databaseSaved ? 'Prescription analysis saved to Clinical Log.' : 'Prescription analysis saved to this device’s Clinical Log.')
  }

  function handlePrescriptionSelect(file) {
    const acceptedFile = acceptFile(file, 'prescription')
    if (prescriptionPreview) {
      URL.revokeObjectURL(prescriptionPreview)
    }
    setPrescription(acceptedFile)
    setPrescriptionResult(null)
    setPrescriptionError('')
    setSaveMessage('')
    if (acceptedFile && acceptedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(acceptedFile)
      setPrescriptionPreview(url)
    } else {
      setPrescriptionPreview(null)
    }
  }

  function removePrescription() {
    if (prescriptionPreview) {
      URL.revokeObjectURL(prescriptionPreview)
    }
    setPrescription(null)
    setPrescriptionPreview(null)
    setPrescriptionResult(null)
    setPrescriptionError('')
    if (prescriptionInput.current) prescriptionInput.current.value = ''
    if (prescriptionCameraInput.current) prescriptionCameraInput.current.value = ''
  }

  async function runPrescriptionAnalysis() {
    if (!prescription) return
    setPrescriptionLoading(true)
    setPrescriptionError('')
    try {
      const result = await scanPrescription(prescription, language)
      setPrescriptionResult(result)
      await savePrescriptionAnalysis(prescription, result)
    } catch (scanError) {
      setPrescriptionError(scanError?.message || (language === 'bn' ? 'প্রেসক্রিপশন বিশ্লেষণ সম্পন্ন করা যায়নি।' : 'Prescription analysis could not be completed.'))
    } finally {
      setPrescriptionLoading(false)
    }
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
        rankedPredictions = deduplicatePredictions(visualResult.predictions.map((p) => ({
          disease: p.disease,
          confidence: p.confidence,
          percentage: `${(p.confidence * 100).toFixed(1)}%`,
          score: p.confidence,
        })))
        topDisease = visualResult.label || rankedPredictions[0].disease
        topConfidence = `${(rankedPredictions[0]?.confidence ? (rankedPredictions[0].confidence * 100).toFixed(1) : (visualResult.confidence * 100).toFixed(1))}%`
      } else if (localMatches.length) {
        rankedPredictions = deduplicatePredictions(localMatches.map((m) => ({
          disease: m.disease,
          confidence: m.score,
          percentage: `${Math.round(m.score * 100)}%`,
          matchedSigns: m.matchedSigns,
          score: m.score,
        })))
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

      saveDiagnosisLog({
        id: reportId,
        primaryDisease: topDisease,
        confidencePercent: topConfidence,
        inputModalities: [image && 'image', audio && 'audio', symptomText && 'text'].filter(Boolean),
        guidanceSummary: `Screened condition: ${topDisease} (${topConfidence})`,
        breakdown: rankedPredictions,
        district: 'Rajshahi',
      })

      const initialAnswer = {
        topDisease,
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
            topDisease,
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

          saveDiagnosisLog({
            id: reportId,
            primaryDisease: topDisease,
            confidencePercent: topConfidence,
            inputModalities: [image && 'image', audio && 'audio', symptomText && 'text'].filter(Boolean),
            guidanceSummary: explanationText,
            breakdown: rankedPredictions,
            district: 'Rajshahi',
          })

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
    if (prescriptionPreview) {
      URL.revokeObjectURL(prescriptionPreview)
    }
    setPrescription(null)
    setPrescriptionPreview(null)
    setPrescriptionResult(null)
    setPrescriptionError('')
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

        {currentReport && (
          <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="spark" size={16} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#166534' }}>
                {language === 'bn' ? 'সর্বশেষ স্ক্রীনিং রিপোর্ট:' : 'Latest Screening Report:'} <strong>{currentReport.topDisease}</strong> ({currentReport.topConfidence})
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                modalOpenedAtRef.current = Date.now()
                setReportModalOpen(true)
              }}
              className="diagnosis-glass-button"
              style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 700, color: '#15803d', borderColor: '#86efac', background: '#ffffff', cursor: 'pointer' }}
            >
              <Icon name="spark" size={13} />
              <span>{language === 'bn' ? 'রিপোর্ট উইন্ডো খুলুন' : 'Open Report Window'}</span>
            </button>
          </div>
        )}
      </form>

      <section className="diagnosis-tool-card diagnosis-prescription-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700" aria-labelledby="prescription-info-title">
        <div className="diagnosis-section-heading dark:text-gray-100">
          <div>
            <span className="diagnosis-section-kicker dark:text-gray-300">{t('sectionTwo')}</span>
            <h3 id="prescription-info-title" className="dark:text-gray-100">{t('prescriptionWithdrawal')}</h3>
            <p className="dark:text-gray-300">{t('prescriptionWithdrawalDescription')}</p>
          </div>
          <span className="diagnosis-section-icon"><Icon name="pill" size={20} /></span>
        </div>

        <input
          ref={prescriptionInput}
          className="visually-hidden-input"
          type="file"
          accept="application/pdf,.pdf,image/jpeg,image/png,image/webp"
          aria-label={t('uploadPrescription')}
          onChange={(event) => {
            handlePrescriptionSelect(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <input
          ref={prescriptionCameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          aria-label={t('useLiveCamera')}
          onChange={(event) => {
            handlePrescriptionSelect(event.target.files?.[0])
            event.target.value = ''
          }}
        />

        {!prescription && (
          <div className="diagnosis-prescription-actions">
            <button
              className="diagnosis-glass-button diagnosis-glass-button--primary dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
              type="button"
              onClick={() => prescriptionCameraInput.current?.click()}
            >
              <Icon name="camera" size={17} />
              {t('takePhotoScan')}
            </button>
            <button
              className="diagnosis-glass-button dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
              type="button"
              onClick={() => prescriptionInput.current?.click()}
            >
              <Icon name="upload" size={17} />
              {t('uploadPrescriptionPhoto')}
            </button>
          </div>
        )}

        {prescription && (
          <div className="prescription-staged-box dark:bg-gray-900/60 dark:border-gray-700">
            <div className="prescription-preview-row">
              <div className="prescription-preview-thumb">
                {prescriptionPreview ? (
                  <img src={prescriptionPreview} alt={prescription.name} className="prescription-preview-img" />
                ) : (
                  <div className="prescription-preview-doc-icon">
                    <Icon name="pdf" size={24} />
                  </div>
                )}
              </div>
              <div className="prescription-preview-meta">
                <span className="prescription-preview-filename" title={prescription.name}>
                  {prescription.name}
                </span>
                <span className="prescription-preview-filesize">
                  {(prescription.size / 1024).toFixed(1)} KB • {prescription.type.startsWith('image/') ? (language === 'bn' ? 'প্রেসক্রিপশন ছবি' : 'Prescription Image') : 'PDF Document'}
                </span>
              </div>
              <button
                type="button"
                className="prescription-remove-btn"
                onClick={removePrescription}
                aria-label={language === 'bn' ? 'ছবি সরিয়ে ফেলুন' : 'Remove prescription image'}
                title={language === 'bn' ? 'ছবি সরিয়ে ফেলুন' : 'Remove image'}
              >
                ✕
              </button>
            </div>

            <div className="prescription-action-row">
              <button
                type="button"
                className="diagnosis-submit prescription-analyze-btn"
                onClick={runPrescriptionAnalysis}
                disabled={prescriptionLoading}
              >
                {prescriptionLoading ? (
                  <>
                    <span className="ai-spinner" />
                    <span>{language === 'bn' ? 'প্রেসক্রিপশন বিশ্লেষণ হচ্ছে…' : 'Analyzing Prescription…'}</span>
                  </>
                ) : (
                  <>
                    <Icon name="stethoscope" size={17} />
                    <span>{language === 'bn' ? 'প্রেসক্রিপশন বিশ্লেষণ করুন' : 'Analyze Prescription'}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                className="diagnosis-reset"
                onClick={() => prescriptionInput.current?.click()}
                disabled={prescriptionLoading}
                style={{ fontSize: '13px', padding: '8px 14px' }}
              >
                {language === 'bn' ? 'অন্য ছবি দিন' : 'Change Image'}
              </button>
            </div>

            {prescriptionLoading && (
              <div className="prescription-rag-loading" role="status" style={{ marginTop: '10px' }}>
                <span className="ai-spinner" />
                <span>
                  {language === 'bn'
                    ? 'AI ভিশন মডেল ও স্থানীয় ড্রাগ উইথড্রয়াল ডাটাবেস যাচাই করা হচ্ছে…'
                    : 'Reading prescription and extracting drug withdrawal periods…'}
                </span>
              </div>
            )}
          </div>
        )}

        {prescriptionError && (
          <p className="diagnosis-error" role="alert" style={{ marginTop: '12px' }}>
            {prescriptionError}
          </p>
        )}

        {prescriptionResult && (
          <div className="prescription-inline-card dark:bg-gray-900/90 dark:border-gray-700">
            <div className="prescription-inline-header">
              <div>
                <span className="prescription-kicker">
                  {prescriptionResult.isFallback
                    ? (language === 'bn' ? 'ভেটেরিনারি ফর্মুলারি ব্যাকআপ' : 'Veterinary Formulary Fallback')
                    : (language === 'bn' ? 'AI ভিশন বিশ্লেষণ' : 'AI Vision Extracted')}
                </span>
                <h4 className="prescription-inline-title dark:text-white">
                  {language === 'bn' ? 'ওষুধের উইথড্রয়াল ও প্রত্যাহার তথ্য' : 'Drug Withdrawal & Residue Safety'}
                </h4>
              </div>
              <button
                type="button"
                className="prescription-clear-btn"
                onClick={removePrescription}
              >
                ✕ {language === 'bn' ? 'নতুন স্ক্যান / সাফ করুন' : 'Clear / New Scan'}
              </button>
            </div>

            {prescriptionResult.transcription && (
              <p className="prescription-transcription-note dark:text-gray-300 dark:bg-gray-800/80">
                <Icon name="book" size={14} />
                <span>{prescriptionResult.transcription}</span>
              </p>
            )}

            <div className="prescription-medicines-list">
              {prescriptionResult.medicines?.map((drug, index) => {
                const isBanned = drug.regulatoryStatus === 'BANNED'
                const isRestricted = drug.regulatoryStatus === 'RESTRICTED'
                return (
                  <article
                    className="prescription-medicine-item dark:bg-gray-800/90 dark:border-gray-700"
                    key={`${drug.tradeName}-${drug.genericName}-${index}`}
                  >
                    <div className="prescription-item-top">
                      <div>
                        <h5 className="prescription-item-tradename dark:text-white">
                          {drug.tradeName || drug.genericName}
                        </h5>
                        <p className="prescription-item-generic dark:text-gray-300">
                          <strong>{language === 'bn' ? 'জেনেরিক:' : 'Generic:'}</strong>{' '}
                          {language === 'bn' && drug.genericNameBn ? drug.genericNameBn : drug.genericName}
                        </p>
                      </div>
                      <span className={`prescription-status-pill ${isBanned ? 'is-banned' : isRestricted ? 'is-restricted' : 'is-approved'}`}>
                        {language === 'bn' && drug.regulatoryStatusBn ? drug.regulatoryStatusBn : drug.regulatoryStatus}
                      </span>
                    </div>

                    <div className="prescription-detail-grid">
                      <div className="prescription-detail-cell">
                        <span className="prescription-cell-label">{language === 'bn' ? 'অ্যান্টিবায়োটিক শ্রেণী' : 'Antibiotic Class'}</span>
                        <strong className="prescription-cell-value dark:text-gray-200">
                          {language === 'bn' && drug.antibioticClassBn ? drug.antibioticClassBn : drug.antibioticClass}
                        </strong>
                      </div>
                      <div className="prescription-detail-cell">
                        <span className="prescription-cell-label">{language === 'bn' ? 'নির্ধারিত মাত্রা / ডোজ' : 'Prescribed / Label Dose'}</span>
                        <strong className="prescription-cell-value dark:text-gray-200">
                          {language === 'bn' && drug.dosageBn ? drug.dosageBn : drug.dosage}
                        </strong>
                      </div>
                    </div>

                    <div className="prescription-withdrawal-strip">
                      <div className="prescription-withdrawal-badge meat">
                        <span className="badge-title">{language === 'bn' ? 'মাংসের উইথড্রয়াল' : 'Meat Withdrawal'}</span>
                        <strong className="badge-val">
                          {language === 'bn' && drug.meatWithdrawalDaysBn ? drug.meatWithdrawalDaysBn : (drug.meatWithdrawalDays || drug.withdrawalPeriod || '—')}
                        </strong>
                      </div>
                      <div className="prescription-withdrawal-badge eggs">
                        <span className="badge-title">{language === 'bn' ? 'ডিমের উইথড্রয়াল' : 'Egg Withdrawal'}</span>
                        <strong className="badge-val">
                          {language === 'bn' && drug.eggWithdrawalDaysBn ? drug.eggWithdrawalDaysBn : (drug.eggWithdrawalDays || 'Not for layers')}
                        </strong>
                      </div>
                    </div>

                    {drug.indications && (
                      <p className="prescription-item-indications dark:text-gray-300">
                        <strong>{language === 'bn' ? 'কার্যকারিতা:' : 'Indications:'}</strong>{' '}
                        {language === 'bn' && drug.indicationsBn ? drug.indicationsBn : drug.indications}
                      </p>
                    )}

                    <footer className="prescription-item-footer dark:text-gray-400">
                      <span>{drug.authorities || 'DGDA & DLS Bangladesh'}</span>
                    </footer>
                  </article>
                )
              })}
            </div>

            <div className="prescription-formulary-drawer dark:border-gray-700">
              <button
                type="button"
                className="prescription-formulary-toggle dark:text-gray-200 dark:hover:bg-gray-800"
                onClick={() => setShowDrugFormulary((v) => !v)}
              >
                <span>
                  {language === 'bn'
                    ? 'বাংলাদেশে প্রচলিত সাধারণ পোল্ট্রি অ্যান্টিবায়োটিকের উইথড্রয়াল তালিকা'
                    : 'Browse Common Bangladesh Poultry Antibiotics Reference (Doxycycline, Enrofloxacin, Ciprofloxacin...)'}
                </span>
                <Icon name={showDrugFormulary ? 'chevron-up' : 'chevron-down'} size={15} />
              </button>

              {showDrugFormulary && (
                <div className="prescription-formulary-table-wrap">
                  <table className="prescription-formulary-table dark:text-gray-200">
                    <thead>
                      <tr>
                        <th>{language === 'bn' ? 'ওষুধ ও ব্র্যান্ড' : 'Medicine (Generic & Brands)'}</th>
                        <th>{language === 'bn' ? 'মাংসের উইথড্রয়াল' : 'Meat'}</th>
                        <th>{language === 'bn' ? 'ডিমের উইথড্রয়াল' : 'Eggs'}</th>
                        <th>{language === 'bn' ? 'নিয়ম ও স্ট্যাটাস' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {BANGLADESH_POULTRY_DRUG_DATABASE.map((item) => (
                        <tr key={item.id} className={item.regulatoryStatus === 'BANNED' ? 'row-banned' : ''}>
                          <td>
                            <strong>{language === 'bn' ? item.genericNameBn : item.genericName}</strong>
                            <small className="block text-gray-500 dark:text-gray-400">
                              {item.tradeNames.slice(0, 3).join(', ')}
                            </small>
                          </td>
                          <td><span className="badge-pill meat">{language === 'bn' ? item.meatWithdrawalDaysBn : item.meatWithdrawalDays}</span></td>
                          <td><span className="badge-pill egg">{language === 'bn' ? item.eggWithdrawalDaysBn : item.eggWithdrawalDays}</span></td>
                          <td>
                            <small className={item.regulatoryStatus === 'BANNED' ? 'text-red-600 font-bold' : ''}>
                              {language === 'bn' ? item.regulatoryStatusBn : item.regulatoryStatus}
                            </small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="prescription-inline-safety-notice dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200">
              <Icon name="alert-triangle" size={16} />
              <span>
                {language === 'bn'
                  ? 'সতর্কতা: অ্যান্টিবায়োটিকের অবশিষ্টাংশ মানবদেহে প্রবেশ রোধে উইথড্রয়াল সময়সীমা মেনে চলা বাধ্যতামূলক। কোনো অবস্থাতেই নিবন্ধিত ভেটেরিনারি চিকিৎসকের প্রেসক্রিপশন ছাড়া অ্যান্টিবায়োটিক ব্যবহার করবেন না।'
                  : 'Notice: Strictly adhere to withdrawal periods to prevent chemical and antimicrobial residues in human food chains. Never self-prescribe antibiotics without a registered veterinarian’s direct examination.'}
              </span>
            </div>
          </div>
        )}
      </section>

      {reportModalOpen && currentReport && (
        <div
          className="diagnosis-report-modal-backdrop"
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
            {/* Fixed Header */}
            <div className="diagnosis-report-header dark:bg-gray-800 dark:border-gray-700">
              <div>
                <span className="diagnosis-section-kicker dark:text-gray-300">
                  {language === 'bn' ? 'ক্লিনিকাল ট্রায়াজ রিপোর্ট' : 'CLINICAL TRIAGE REPORT'}
                </span>
                <h3 id="report-modal-title" className="dark:text-white" style={{ margin: '2px 0 0', fontSize: '15px', fontWeight: 800 }}>
                  {language === 'bn' ? 'ফ্লক স্বাস্থ্য স্ক্রীনিং ফলাফল' : 'Flock Health Screening'}
                </h3>
              </div>
              <button
                className="dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
                type="button"
                onClick={() => setReportModalOpen(false)}
                aria-label={language === 'bn' ? 'রিপোর্ট উইন্ডো বন্ধ করুন' : 'Close diagnostic report'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="diagnosis-report-body">
              <div className="diagnosis-report-badge-list">
                {currentReport.hasImage && (
                  <span className="diagnosis-report-badge">
                    <Icon name="image" size={12} />
                    <span>{currentReport.imageName || (language === 'bn' ? 'ফ্লকের ছবি' : 'Flock Image')}</span>
                  </span>
                )}
                {currentReport.hasAudio && (
                  <span className="diagnosis-report-badge">
                    <Icon name="mic" size={12} />
                    <span>{currentReport.audioName || (language === 'bn' ? 'ফ্লকের অডিও' : 'Flock Audio')}</span>
                  </span>
                )}
                {currentReport.hasText && (
                  <span className="diagnosis-report-badge">
                    <Icon name="spark" size={12} />
                    <span>{language === 'bn' ? 'বর্ণিত লক্ষণ' : 'Symptoms Noted'}</span>
                  </span>
                )}
              </div>

              {/* 1. Primary Diagnosis Card */}
              <div className="diagnosis-report-top-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#166534' }}>
                    {language === 'bn' ? 'শনাক্তকৃত প্রধান রোগ' : 'Primary Condition Detected'}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#15803d' }}>
                    {currentReport.topConfidence}
                  </span>
                </div>
                <h4 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  {currentReport.topDisease}
                </h4>
                <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#475569' }}>
                  {currentReport.hasImage
                    ? (language === 'bn' ? 'অন-ডিভাইস এজ ভিশন মডেল (i4VE4hlCa) দ্বারা বিশ্লেষিত।' : 'Calculated client-side via Google Teachable Machine edge vision model (i4VE4hlCa).')
                    : (language === 'bn' ? 'লোকাল পোল্ট্রি প্যাথোজেন এবং লক্ষণ সূচকের সাথে যাচাইকৃত।' : 'Screened against local clinical poultry pathogen and symptom indices.')}
                </p>
              </div>

              {/* 2. Confidence Breakdown (micro-scrollable list) */}
              {currentReport.predictions?.length > 0 && (
                <div className="diagnosis-report-breakdown">
                  <h5 style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                    {language === 'bn' ? 'সম্ভাব্য রোগের শতকরা হার (% স্কোর)' : 'Confidence Breakdown (% Score)'}
                  </h5>
                  <div className="diagnosis-report-breakdown-list">
                    {deduplicatePredictions(currentReport.predictions).map((pred) => {
                      const pct = typeof pred.confidence === 'number'
                        ? Math.min(100, Math.max(0, Math.round(pred.confidence * 100)))
                        : parseInt(pred.percentage, 10) || 0
                      return (
                        <div key={pred.disease} className="diagnosis-report-breakdown-row">
                          <span style={{ minWidth: '110px', fontWeight: 600, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pred.disease}>
                            {pred.disease}
                          </span>
                          <div className="diagnosis-report-progress-bar-bg">
                            <div className="diagnosis-report-progress-bar-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span style={{ minWidth: '45px', textAlign: 'right', fontWeight: 700, fontSize: '11px' }}>
                            {pred.percentage || `${pct}%`}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 3. AI Clinical Guidance & Biosecurity Advice */}
              <div className="diagnosis-report-ai-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
                  <Icon name="spark" size={15} />
                  <h5 style={{ margin: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {language === 'bn' ? 'ভেটেরিনারি গাইডলাইন ও খামার জৈবনিরাপত্তা পরামর্শ' : 'Veterinary Guidance & Farm Biosecurity Advice'}
                  </h5>
                </div>

                {currentReport.explanationLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0', fontSize: '12px', color: '#64748b' }}>
                    <span className="ai-spinner" />
                    <span>{language === 'bn' ? 'ফ্লকের তথ্য পর্যালোচনা করা হচ্ছে এবং জৈবনিরাপত্তা পরামর্শ প্রস্তুত করা হচ্ছে…' : 'Analyzing flock findings and preparing biosecurity guidance…'}</span>
                  </div>
                ) : (
                  <div style={{ fontSize: '11.5px', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
                    <p style={{ margin: 0 }}>{currentReport.explanation}</p>
                    {currentReport.explanationFallback && (
                      <p style={{ margin: '6px 0 0', fontWeight: 600, color: '#b45309' }}>
                        {REPORT_AI_FALLBACK_NOTE}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 4. Verified Reference Sources (Authentic peer-reviewed literature & portals only; NO YouTube) */}
              {currentReport.sources?.length > 0 && (
                <div className="diagnosis-report-sources-card">
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {language === 'bn' ? 'যাচাইকৃত ভেটেরিনারি রেফারেন্স সোর্স:' : 'Verified Veterinary Reference Sources:'}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
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
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#047857', fontWeight: 600, textDecoration: 'underline' }}
                          >
                            <span>{title} {provider ? `(${provider})` : ''}</span>
                            <Icon name="arrow" size={9} />
                          </a>
                        )
                      }
                      return <span key={sIdx} style={{ fontSize: '11px', color: '#64748b' }}>{title}</span>
                    })}
                  </div>
                </div>
              )}

              {/* 5. Veterinary Safety Notice */}
              <div className="diagnosis-report-disclaimer">
                <strong>{language === 'bn' ? 'জরুরি ভেটেরিনারি নোটিশ:' : 'Veterinary Safety Notice:'}</strong>{' '}
                {language === 'bn'
                  ? 'এটি একটি প্রাথমিক স্ক্রীনিং এইড, কোনো চিকিৎসা প্রেসক্রিপশন নয়। এএমআর (AMR) নীতি অনুসারে কোনো অ্যান্টিবায়োটিক প্রয়োগ করবেন না। সঠিক পরীক্ষা ও ব্যবস্থাপনার জন্য রেজিস্টার্ড ভেটেরিনারি চিকিৎসকের পরামর্শ নিন।'
                  : 'This diagnostic screening aid is designed for early flock triage only. Automated AI does NOT provide antibiotic prescriptions or treatment dosages under AMR stewardship guidelines. Please consult a registered veterinarian or local livestock officer for clinical examination and prescription.'}
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="diagnosis-report-footer dark:bg-gray-900 dark:border-gray-700">
              <button
                type="button"
                className="diagnosis-glass-button dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 600 }}
                onClick={() => setReportModalOpen(false)}
              >
                {language === 'bn' ? 'রিপোর্ট বন্ধ করুন' : 'Close Report'}
              </button>
            </div>
          </section>
        </div>
      )}



      {saveMessage && <p className="diagnosis-save-message" role="status">{saveMessage}</p>}
    </section>
  )
}
