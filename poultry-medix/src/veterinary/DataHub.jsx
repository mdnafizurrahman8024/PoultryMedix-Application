import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useLanguage } from '../context/useLanguage.js'
import Icon from '../components/Icon.jsx'
import VoiceRecorder from '../components/VoiceRecorder.jsx'
import { dataHubTopics, supportedUploadTypes } from './dataHubTopics.js'

const maxFileBytes = 8 * 1024 * 1024
const maxTotalBytes = 15 * 1024 * 1024
const antimicrobialTopicSet = new Set(['Antibiotic Prescribing Patterns', 'Bacterial Culture & AST Results'])
const clinicalSignsTopic = 'Clinical Signs & Symptoms'
const generationOptions = ['Not recorded', '1st Gen', '2nd Gen', '3rd Gen', '4th Gen', '5th Gen']
const initialBirdInformation = {
  flockLabel: '',
  birdType: '',
  age: '',
  ageUnit: 'weeks',
  speciesBreed: '',
  sex: '',
  farmType: '',
  productionSystem: '',
  flockSize: '',
  flockDensity: '',
  humanEntryRestricted: false,
  disinfectantUsed: false,
  cleanSurroundings: false,
  previousIllness: '',
  morbidityRate: '',
  mortalityRate: '',
  vaccinationHistory: '',
  feedSources: [],
  waterSource: '',
  wasteManagement: '',
  observedOn: todayISODate(),
}

function ChoiceField({ legend, name, options, value, onChange }) {
  return (
    <fieldset className="bird-choice-field dark:border-gray-700 dark:text-gray-100">
      <legend>{legend}</legend>
      <div className="bird-choice-options">
        {options.map(({ value: optionValue, label }) => (
          <label key={optionValue}>
            <input type="radio" name={name} value={optionValue} checked={value === optionValue} onChange={onChange} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function todayISODate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function getApproximateLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not available in this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        latitude: Number(coords.latitude.toFixed(2)),
        longitude: Number(coords.longitude.toFixed(2)),
      }),
      (error) => reject(new Error(error.message)),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 600_000 },
    )
  })
}

function safeExtension(file) {
  const extension = file.name.split('.').pop()?.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
  return extension || 'bin'
}

export default function DataHub({ onContributionSubmitted }) {
  const { t } = useLanguage()
  const fileInput = useRef(null)
  const imageCameraInput = useRef(null)
  const videoCameraInput = useRef(null)
  const [topic, setTopic] = useState(dataHubTopics[0])
  const [notes, setNotes] = useState('')
  const [birdInformation, setBirdInformation] = useState(initialBirdInformation)
  const [birdInformationExpanded, setBirdInformationExpanded] = useState(false)
  const [clinicalSigns, setClinicalSigns] = useState('')
  const [outcome, setOutcome] = useState('')
  const [veterinarianNotes, setVeterinarianNotes] = useState('')
  const [files, setFiles] = useState([])
  const [shareLocation, setShareLocation] = useState(false)
  const [antibioticClass, setAntibioticClass] = useState('')
  const [antibioticName, setAntibioticName] = useState('')
  const [generation, setGeneration] = useState('Not recorded')
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [toastError, setToastError] = useState('')

  const showAntimicrobialFields = antimicrobialTopicSet.has(topic)
  const isClinicalSignsTopic = topic === clinicalSignsTopic
  const totalBytes = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files])

  useEffect(() => {
    if (!toastError) return undefined
    const timer = window.setTimeout(() => setToastError(''), 3500)
    return () => window.clearTimeout(timer)
  }, [toastError])

  function updateBirdInformation(field, value) {
    setBirdInformation((current) => ({ ...current, [field]: value }))
  }

  function updateBirdChecklist(field, value, checked) {
    setBirdInformation((current) => ({
      ...current,
      [field]: checked
        ? [...current[field], value]
        : current[field].filter((item) => item !== value),
    }))
  }

  async function refreshSubmissions() {
    setLoadingHistory(true)
    const { data, error: historyError } = await supabase
      .from('clinical_submissions')
      .select('id, topic, created_at, status')
      .order('created_at', { ascending: false })
      .limit(5)
    setLoadingHistory(false)
    if (historyError) {
      setHistoryError(t('dataHubLoadError'))
      throw historyError
    }
    setHistoryError('')
    setSubmissions(data || [])
  }

  useEffect(() => {
    let active = true
    async function loadHistory() {
      setLoadingHistory(true)
      const { data, error: historyError } = await supabase
        .from('clinical_submissions')
        .select('id, topic, created_at, status')
        .order('created_at', { ascending: false })
        .limit(5)
      if (!active) return
      setLoadingHistory(false)
      if (historyError) setHistoryError(t('dataHubLoadError'))
      else setSubmissions(data || [])
    }
    loadHistory()
    return () => { active = false }
  }, [t])

  function selectFiles(selectedFiles) {
    setError('')
    setSuccess('')
    const incoming = Array.from(selectedFiles || [])
    const combined = [...files]
    for (const file of incoming) {
      if (!supportedUploadTypes.has(file.type)) {
        setError(t('dataHubUnsupportedFile'))
        continue
      }
      if (file.size > maxFileBytes) {
        setError(t('dataHubFileTooLarge'))
        continue
      }
      if (combined.length >= 4) {
        setError(t('dataHubMaxFiles'))
        continue
      }
      if (combined.some((item) => item.name === file.name && item.size === file.size)) continue
      combined.push(file)
    }
    if (combined.reduce((sum, file) => sum + file.size, 0) > maxTotalBytes) {
      setError(t('dataHubTotalTooLarge'))
      return
    }
    setFiles(combined)
    if (fileInput.current) fileInput.current.value = ''
  }

  function removeFile(index) {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))
  }

  async function submitContribution(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setToastError('')
    if (!shareLocation) {
      setToastError(t('locationRequiredError'))
      return
    }
    const normalizedBirdInformation = {
      ...birdInformation,
      flockLabel: birdInformation.flockLabel.trim(),
      speciesBreed: birdInformation.speciesBreed.trim(),
      previousIllness: birdInformation.previousIllness.trim(),
      vaccinationHistory: birdInformation.vaccinationHistory.trim(),
      wasteManagement: birdInformation.wasteManagement.trim(),
    }
    const clinicalObservation = isClinicalSignsTopic ? {
      signs: clinicalSigns.trim(),
      outcome: outcome.trim(),
      veterinarianNotes: veterinarianNotes.trim(),
    } : null
    const submissionNotes = JSON.stringify({
      poultryBirdInformation: normalizedBirdInformation,
      clinicalObservation,
      notes: isClinicalSignsTopic ? '' : notes.trim(),
    })
    if ((isClinicalSignsTopic ? !clinicalSigns.trim() : !notes.trim()) && files.length === 0) {
      setError(t('dataHubContentRequired'))
      return
    }
    if (isClinicalSignsTopic && !normalizedBirdInformation.flockLabel) {
      setBirdInformationExpanded(true)
      setError(t('clinicalFlockRequired'))
      return
    }
    if (submissionNotes.length > 5000) {
      setError(t('dataHubNotesTooLong'))
      return
    }
    if (showAntimicrobialFields && (!antibioticClass.trim() || !antibioticName.trim())) {
      setError(t('dataHubAntimicrobialRequired'))
      return
    }
    setLoading(true)
    const uploadedPaths = []
    let submissionSaved = false
    try {
      const { data: sessionResult, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const userId = sessionResult.session?.user?.id
      if (!userId) throw new Error(t('dataHubSignInRequired'))

      const location = shareLocation ? await getApproximateLocation() : null
      for (const file of files) {
        const path = `${userId}/${crypto.randomUUID()}.${safeExtension(file)}`
        const { error: uploadError } = await supabase.storage
          .from('clinical-submissions')
          .upload(path, file, { contentType: file.type, upsert: false })
        if (uploadError) throw uploadError
        uploadedPaths.push(path)
      }

      const { error: insertError } = await supabase
        .from('clinical_submissions')
        .insert({
          user_id: userId,
          topic,
          notes: submissionNotes,
          attachment_paths: uploadedPaths,
          antibiotic_class: showAntimicrobialFields ? antibioticClass.trim() : null,
          antibiotic_name: showAntimicrobialFields ? antibioticName.trim() : null,
          antibiotic_generation: showAntimicrobialFields && generation !== 'Not recorded' ? generation : null,
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
        })
      if (insertError) throw insertError
      submissionSaved = true
      onContributionSubmitted?.()

      setNotes('')
      setBirdInformation({ ...initialBirdInformation, observedOn: todayISODate() })
      setBirdInformationExpanded(false)
      setClinicalSigns('')
      setOutcome('')
      setVeterinarianNotes('')
      setFiles([])
      setAntibioticClass('')
      setAntibioticName('')
      setGeneration('Not recorded')
      setShareLocation(false)
      setSuccess(t('dataHubSubmitted'))
      await refreshSubmissions()
    } catch (submitError) {
      if (submissionSaved) {
        setError(t('dataHubSavedHistoryError'))
      } else {
        if (uploadedPaths.length) {
          try {
            const { error: cleanupError } = await supabase.storage.from('clinical-submissions').remove(uploadedPaths)
            if (cleanupError) {
              setError(`${t('dataHubSubmitError')} ${t('dataHubCleanupError')}`)
              return
            }
          } catch {
            setError(`${t('dataHubSubmitError')} ${t('dataHubCleanupError')}`)
            return
          }
        }
        setError(submitError.message || t('dataHubSubmitError'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="veterinary-page data-hub-page bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      {toastError && <div className="data-hub-toast" role="alert">{toastError}</div>}
      <section className="veterinary-page-heading">
        <span className="veterinary-kicker">{t('veterinaryToolsEyebrow')}</span>
        <h1>{t('dataHubTitle')}</h1>
        <p>{t('dataHubDescription')}</p>
      </section>

      <form className="data-hub-form bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700" onSubmit={submitContribution} noValidate>
        <label className="veterinary-field">
          <span>{t('dataHubTopic')}</span>
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            {dataHubTopics.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </label>

        <section className="bird-information-accordion dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" aria-labelledby="bird-information-heading">
          <button
            className="bird-information-trigger dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
            type="button"
            aria-expanded={birdInformationExpanded}
            aria-controls="bird-information-fields"
            onClick={() => setBirdInformationExpanded((expanded) => !expanded)}
          >
            <span className="bird-information-icon"><Icon name="bird" size={19} /></span>
            <span id="bird-information-heading">{t('poultryBirdInformation')}</span>
            <Icon className={`drug-info-accordion-chevron${birdInformationExpanded ? ' is-open' : ''}`} name="chevron" size={17} />
          </button>
          {birdInformationExpanded && (
            <div className="bird-information-fields dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700" id="bird-information-fields">
              <div className="data-hub-field-grid">
                <label className="veterinary-field"><span>{t('clinicalFlockLabel')}</span><input maxLength={120} value={birdInformation.flockLabel} onChange={(event) => updateBirdInformation('flockLabel', event.target.value)} placeholder={t('clinicalFlockPlaceholder')} /></label>
                <label className="veterinary-field"><span>{t('clinicalDate')}</span><input type="date" value={birdInformation.observedOn} onChange={(event) => updateBirdInformation('observedOn', event.target.value)} /></label>
              </div>
              <ChoiceField
                legend={t('birdType')}
                name="bird-type"
                value={birdInformation.birdType}
                onChange={(event) => updateBirdInformation('birdType', event.target.value)}
                options={[
                  { value: 'meat', label: t('birdTypeMeat') },
                  { value: 'egg', label: t('birdTypeEgg') },
                  { value: 'dual-purpose', label: t('birdTypeDual') },
                ]}
              />
              <div className="data-hub-field-grid bird-age-grid">
                <label className="veterinary-field"><span>{t('birdAge')}</span><input type="number" min="0" max="10000" step="1" value={birdInformation.age} onChange={(event) => updateBirdInformation('age', event.target.value)} /></label>
                <label className="veterinary-field"><span>{t('birdAgeUnit')}</span><select value={birdInformation.ageUnit} onChange={(event) => updateBirdInformation('ageUnit', event.target.value)}><option value="days">{t('days')}</option><option value="weeks">{t('weeks')}</option></select></label>
                <label className="veterinary-field"><span>{t('speciesBreed')}</span><input maxLength={160} value={birdInformation.speciesBreed} onChange={(event) => updateBirdInformation('speciesBreed', event.target.value)} /></label>
              </div>
              <ChoiceField
                legend={t('sex')}
                name="bird-sex"
                value={birdInformation.sex}
                onChange={(event) => updateBirdInformation('sex', event.target.value)}
                options={[
                  { value: 'male', label: t('male') },
                  { value: 'female', label: t('female') },
                  { value: 'mixed', label: t('mixed') },
                ]}
              />
              <ChoiceField
                legend={t('farmType')}
                name="farm-type"
                value={birdInformation.farmType}
                onChange={(event) => updateBirdInformation('farmType', event.target.value)}
                options={[
                  { value: 'commercial', label: t('commercial') },
                  { value: 'backyard', label: t('backyard') },
                ]}
              />
              <ChoiceField
                legend={t('productionSystem')}
                name="production-system"
                value={birdInformation.productionSystem}
                onChange={(event) => updateBirdInformation('productionSystem', event.target.value)}
                options={[
                  { value: 'cage', label: t('cageSystem') },
                  { value: 'deep-litter', label: t('deepLitter') },
                  { value: 'free-range', label: t('freeRange') },
                ]}
              />
              <div className="data-hub-field-grid">
                <label className="veterinary-field"><span>{t('flockSize')}</span><input type="number" min="0" step="1" value={birdInformation.flockSize} onChange={(event) => updateBirdInformation('flockSize', event.target.value)} /></label>
                <label className="veterinary-field"><span>{t('flockDensity')}</span><input type="number" min="0" step="0.01" value={birdInformation.flockDensity} onChange={(event) => updateBirdInformation('flockDensity', event.target.value)} placeholder={t('flockDensityUnit')} /></label>
              </div>
              <fieldset className="bird-choice-field">
                <legend>{t('biosecurityLevel')}</legend>
                <div className="bird-choice-options">
                  {[
                    ['humanEntryRestricted', t('humanEntryRestricted')],
                    ['disinfectantUsed', t('disinfectantUsed')],
                    ['cleanSurroundings', t('cleanSurroundings')],
                  ].map(([field, label]) => (
                    <label key={field}><input type="checkbox" checked={birdInformation[field]} onChange={(event) => updateBirdInformation(field, event.target.checked)} /><span>{label}</span></label>
                  ))}
                </div>
              </fieldset>
              <label className="veterinary-field"><span>{t('previousIllness')}</span><input maxLength={300} value={birdInformation.previousIllness} onChange={(event) => updateBirdInformation('previousIllness', event.target.value)} /></label>
              <div className="data-hub-field-grid">
                <label className="veterinary-field"><span>{t('morbidityRate')}</span><input type="number" min="0" max="100" step="0.01" value={birdInformation.morbidityRate} onChange={(event) => updateBirdInformation('morbidityRate', event.target.value)} /></label>
                <label className="veterinary-field"><span>{t('mortalityRate')}</span><input type="number" min="0" max="100" step="0.01" value={birdInformation.mortalityRate} onChange={(event) => updateBirdInformation('mortalityRate', event.target.value)} /></label>
              </div>
              <label className="veterinary-field"><span>{t('vaccinationHistory')}</span><input maxLength={500} value={birdInformation.vaccinationHistory} onChange={(event) => updateBirdInformation('vaccinationHistory', event.target.value)} /></label>
              <fieldset className="bird-choice-field">
                <legend>{t('feedSources')}</legend>
                <div className="bird-choice-options">
                  {[
                    ['household-waste', t('householdWaste')],
                    ['crop-residue', t('cropResidue')],
                    ['commercial-feed', t('commercialFeed')],
                  ].map(([value, label]) => (
                    <label key={value}><input type="checkbox" checked={birdInformation.feedSources.includes(value)} onChange={(event) => updateBirdChecklist('feedSources', value, event.target.checked)} /><span>{label}</span></label>
                  ))}
                </div>
              </fieldset>
              <label className="veterinary-field"><span>{t('waterSource')}</span><select value={birdInformation.waterSource} onChange={(event) => updateBirdInformation('waterSource', event.target.value)}><option value="">{t('selectWaterSource')}</option><option value="surface">{t('surfaceWater')}</option><option value="light-tubewell">{t('lightTubewell')}</option><option value="deep-tubewell">{t('deepTubewell')}</option></select></label>
              <label className="veterinary-field"><span>{t('wasteManagement')}</span><textarea maxLength={500} rows="3" value={birdInformation.wasteManagement} onChange={(event) => updateBirdInformation('wasteManagement', event.target.value)} /></label>
            </div>
          )}
        </section>

        {isClinicalSignsTopic && (
          <section className="clinical-observation-fields dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" aria-labelledby="clinical-observation-heading">
            <h2 id="clinical-observation-heading">{t('clinicalSigns')}</h2>
            <label className="veterinary-field"><span>{t('clinicalSigns')}</span><textarea required maxLength={3000} rows="4" value={clinicalSigns} onChange={(event) => setClinicalSigns(event.target.value)} placeholder={t('clinicalSignsPlaceholder')} /></label>
            <label className="veterinary-field"><span>{t('clinicalOutcome')}</span><textarea maxLength={1000} rows="2" value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder={t('clinicalOutcomePlaceholder')} /></label>
            <label className="veterinary-field"><span>{t('clinicalVetNotes')}</span><textarea maxLength={1000} rows="2" value={veterinarianNotes} onChange={(event) => setVeterinarianNotes(event.target.value)} placeholder={t('clinicalVetNotesPlaceholder')} /></label>
          </section>
        )}

        {showAntimicrobialFields && (
          <section className="antimicrobial-data-fields">
            <h2>{t('dataHubAntimicrobialHeading')}</h2>
            <div className="data-hub-field-grid">
              <label className="veterinary-field"><span>{t('dataHubDrugClass')}</span><input maxLength={120} value={antibioticClass} onChange={(event) => setAntibioticClass(event.target.value)} placeholder={t('dataHubDrugClassPlaceholder')} /></label>
              <label className="veterinary-field"><span>{t('dataHubDrugName')}</span><input maxLength={120} value={antibioticName} onChange={(event) => setAntibioticName(event.target.value)} placeholder={t('dataHubDrugNamePlaceholder')} /></label>
              <label className="veterinary-field"><span>{t('dataHubGeneration')}</span><select value={generation} onChange={(event) => setGeneration(event.target.value)}>{generationOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
            </div>
          </section>
        )}

        {!isClinicalSignsTopic && <label className="veterinary-field">
          <span>{t('dataHubNotes')}</span>
          <textarea maxLength={5000} rows="5" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t('dataHubNotesPlaceholder')} />
        </label>}

        <section className="multimodal-upload dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" aria-labelledby="multimodal-upload-title">
          <div className="veterinary-section-heading">
            <span className="veterinary-section-icon"><Icon name="upload" size={18} /></span>
            <div><h2 id="multimodal-upload-title">{t('multimodalUploadTitle')}</h2><p>{t('multimodalUploadHint')}</p></div>
          </div>
          <input ref={fileInput} className="visually-hidden-input" type="file" multiple accept="image/jpeg,image/png,image/webp,audio/*,application/pdf,video/mp4,video/webm,video/quicktime" onChange={(event) => selectFiles(event.target.files)} aria-label={t('multimodalUploadTitle')} />
          <input ref={imageCameraInput} className="visually-hidden-input" type="file" accept="image/*" capture="environment" onChange={(event) => { selectFiles(event.target.files); event.target.value = '' }} aria-label={t('useLiveCamera')} />
          <input ref={videoCameraInput} className="visually-hidden-input" type="file" accept="video/*" capture="environment" onChange={(event) => { selectFiles(event.target.files); event.target.value = '' }} aria-label={t('useLiveCamera')} />
          <div className="upload-type-grid">
            <div className="upload-type-category upload-type-category--images">
              <div className="upload-type-category-heading"><Icon name="image" size={17} /><strong>{t('uploadImages')}</strong></div>
              <div className="upload-type-category-actions">
                <button className="upload-type-action upload-type-action--upload" type="button" onClick={() => fileInput.current?.click()}><Icon name="upload" size={15} /><span>{t('uploadShort')}</span></button>
                <button className="upload-type-action upload-type-action--live" type="button" aria-label={t('useLiveCamera')} onClick={() => imageCameraInput.current?.click()}><Icon name="camera" size={15} /><span>{t('liveShort')}</span></button>
              </div>
            </div>
            <div className="upload-type-category upload-type-category--documents">
              <div className="upload-type-category-heading"><Icon name="pdf" size={17} /><strong>{t('uploadDocuments')}</strong></div>
              <div className="upload-type-category-actions">
                <button className="upload-type-action upload-type-action--upload" type="button" onClick={() => fileInput.current?.click()}><Icon name="upload" size={15} /><span>{t('uploadShort')}</span></button>
                <button className="upload-type-action upload-type-action--live" type="button" aria-label={t('useLiveCamera')} onClick={() => imageCameraInput.current?.click()}><Icon name="camera" size={15} /><span>{t('liveShort')}</span></button>
              </div>
            </div>
            <div className="upload-type-category upload-type-category--video">
              <div className="upload-type-category-heading"><Icon name="video" size={17} /><strong>{t('uploadVideos')}</strong></div>
              <div className="upload-type-category-actions">
                <button className="upload-type-action upload-type-action--upload" type="button" onClick={() => fileInput.current?.click()}><Icon name="upload" size={15} /><span>{t('uploadShort')}</span></button>
                <button className="upload-type-action upload-type-action--live" type="button" aria-label={t('useLiveCamera')} onClick={() => videoCameraInput.current?.click()}><Icon name="camera" size={15} /><span>{t('liveShort')}</span></button>
              </div>
            </div>
            <div className="upload-type-category upload-type-category--audio">
              <div className="upload-type-category-heading"><Icon name="mic" size={17} /><strong>{t('uploadAudio')}</strong></div>
              <div className="upload-type-category-actions">
                <button className="upload-type-action upload-type-action--upload" type="button" onClick={() => fileInput.current?.click()}><Icon name="upload" size={15} /><span>{t('uploadShort')}</span></button>
                <VoiceRecorder compact buttonLabel={t('liveShort')} buttonAriaLabel={t('recordLiveAudio')} onAudioReady={(blob) => {
                  const type = (blob.type || 'audio/webm').split(';')[0]
                  const extension = type.includes('mp4') ? 'm4a' : type.includes('mpeg') ? 'mp3' : 'webm'
                  selectFiles([new File([blob], `contribution-audio-${Date.now()}.${extension}`, { type })])
                }} />
              </div>
            </div>
          </div>
          {files.length > 0 && <ul className="data-hub-file-list">{files.map((file, index) => <li key={`${file.name}-${file.size}`}><span><Icon name={file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'mic' : file.type === 'application/pdf' ? 'pdf' : 'image'} size={15} />{file.name}</span><button type="button" aria-label={t('removeFile', { name: file.name })} onClick={() => removeFile(index)}><Icon name="remove" size={16} /></button></li>)}</ul>}
          <p className="upload-size-note">{t('dataHubFileLimits', { count: files.length, size: (totalBytes / (1024 * 1024)).toFixed(1) })}</p>
        </section>

        <label className="share-location-consent">
          <input type="checkbox" aria-required="true" checked={shareLocation} onChange={(event) => { setShareLocation(event.target.checked); if (event.target.checked) setToastError('') }} />
          <span><strong>{t('shareApproximateLocation')}</strong><small>{t('approximateLocationPrivacy')}</small></span>
        </label>
        {error && <p className="veterinary-error" role="alert">{error}</p>}
        {success && <p className="veterinary-success" role="status">{success}</p>}
        <button className="veterinary-primary-button" type="submit" disabled={loading}>
          {loading ? <span className="ai-spinner" /> : <Icon name="database" size={17} />}
          {loading ? t('dataHubSubmitting') : t('dataHubSubmit')}
        </button>
      </form>

      <section className="recent-contributions dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" aria-labelledby="recent-contributions-title">
        <div className="veterinary-section-heading"><span className="veterinary-section-icon"><Icon name="chart" size={18} /></span><div><h2 id="recent-contributions-title">{t('recentContributions')}</h2><p>{t('recentContributionsPrivacy')}</p></div></div>
        {loadingHistory ? <p className="veterinary-hint">{t('dataHubHistoryLoading')}</p> : historyError ? <p className="veterinary-error" role="alert">{historyError}</p> : submissions.length === 0 ? <p className="veterinary-hint">{t('dataHubHistoryEmpty')}</p> : (
          <ul className="contribution-list">{submissions.map((submission) => (
            <li key={submission.id}><span><strong>{submission.topic}</strong><small>{new Date(submission.created_at).toLocaleDateString()}</small></span><span className={`submission-status submission-status--${submission.status}`}>{t(`submission_${submission.status}`)}</span></li>
          ))}</ul>
        )}
      </section>
    </div>
  )
}
