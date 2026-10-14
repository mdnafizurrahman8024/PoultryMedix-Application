import React, { Suspense, useEffect, useState } from 'react'
import AIChat from './AIChat.jsx'
import DiagnosisHub from './DiagnosisHub.jsx'
import { supabase } from './lib/supabase.js'
import { useLanguage } from './context/useLanguage.js'
import Icon from './components/Icon.jsx'
import DataHub from './veterinary/DataHub.jsx'
import TeamPage from './veterinary/TeamPage.jsx'
import ClinicalLog from './veterinary/ClinicalLog.jsx'
import Telemedicine from './veterinary/Telemedicine.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import { searchWikipedia } from './lib/wikipedia.js'
import './Dashboard.css'
import './VeterinaryFeatures.css'

const EpidemiologyMap = React.lazy(() => import('./veterinary/EpidemiologyMap.jsx'))

const guidelinesData = [
  {
    id: 1,
    title: 'Respiratory health',
    titleBn: 'শ্বাসতন্ত্রের স্বাস্থ্য',
    titleHi: 'श्वसन स्वास्थ्य',
    titleUr: 'تنفسی صحت',
    description: 'Observe breathing, coughing, nasal discharge, and changes in flock activity. Record when signs began and how many birds are affected. Improve ventilation and reduce dust while arranging an assessment by a veterinarian. Do not start antibiotics without a diagnosis and prescription.',
    descriptionBn: 'শ্বাস-প্রশ্বাস, কাশি, নাক দিয়ে স্রাব এবং পালের সক্রিয়তার পরিবর্তন লক্ষ্য করুন। লক্ষণ কখন শুরু হয়েছে এবং কতটি পাখি আক্রান্ত তা লিখে রাখুন। পশুচিকিৎসকের মূল্যায়নের ব্যবস্থা করার সময় বায়ু চলাচল উন্নত করুন এবং ধুলা কমান। রোগ নির্ণয় ও প্রেসক্রিপশন ছাড়া অ্যান্টিবায়োটিক শুরু করবেন না।',
    descriptionHi: 'साँस, खाँसी, नाक से स्राव और झुंड की गतिविधि में बदलाव देखें। लक्षण कब शुरू हुए और कितने पक्षी प्रभावित हैं, दर्ज करें। पशु चिकित्सक से जाँच की व्यवस्था करते समय हवा का प्रवाह बेहतर करें और धूल घटाएँ। निदान और पर्चे के बिना एंटीबायोटिक शुरू न करें।',
    descriptionUr: 'سانس، کھانسی، ناک کے اخراج اور ریوڑ کی سرگرمی میں تبدیلی دیکھیں۔ علامات کب شروع ہوئیں اور کتنے پرندے متاثر ہیں، درج کریں۔ ویٹرنری معائنے کا بندوبست کرتے ہوئے ہوا کی آمدورفت بہتر اور گرد کم کریں۔ تشخیص اور نسخے کے بغیر اینٹی بایوٹک شروع نہ کریں۔',
    images: [],
  },
  {
    id: 2,
    title: 'Digestive health',
    titleBn: 'পরিপাকতন্ত্রের স্বাস্থ্য',
    titleHi: 'पाचन स्वास्थ्य',
    titleUr: 'نظامِ ہاضمہ کی صحت',
    description: 'Track feed and water intake, droppings, and the number of birds showing signs. Keep clean water available and separate visibly unwell birds when safe to do so. Share the timeline and any recent feed or management changes with your veterinarian.',
    descriptionBn: 'খাদ্য ও পানির গ্রহণ, বিষ্ঠা এবং লক্ষণযুক্ত পাখির সংখ্যা নথিভুক্ত করুন। পরিষ্কার পানি দিন এবং নিরাপদ হলে অসুস্থ পাখিকে আলাদা রাখুন। সময়রেখা এবং খাদ্য বা ব্যবস্থাপনায় সাম্প্রতিক পরিবর্তনের তথ্য পশুচিকিৎসককে জানান।',
    descriptionHi: 'चारे और पानी की खपत, बीट तथा लक्षण दिखाने वाले पक्षियों की संख्या दर्ज करें। साफ़ पानी उपलब्ध रखें और सुरक्षित होने पर स्पष्ट रूप से अस्वस्थ पक्षियों को अलग करें। समय-क्रम और चारे या प्रबंधन में हाल के बदलाव पशु चिकित्सक को बताएँ।',
    descriptionUr: 'خوراک اور پانی کی مقدار، فضلے اور علامات والے پرندوں کی تعداد درج کریں۔ صاف پانی دستیاب رکھیں اور محفوظ ہونے پر واضح طور پر بیمار پرندوں کو الگ کریں۔ علامات کی ترتیب اور خوراک یا انتظام میں حالیہ تبدیلیاں ویٹرنری ڈاکٹر کو بتائیں۔',
    images: [],
  },
  {
    id: 3,
    title: 'Prevention & biosecurity',
    titleBn: 'প্রতিরোধ ও জৈব-নিরাপত্তা',
    titleHi: 'रोकथाम और जैव-सुरक्षा',
    titleUr: 'بچاؤ اور حیاتیاتی تحفظ',
    description: 'Limit unnecessary visitors, clean and disinfect equipment between groups, and protect feed and water from contamination. Follow local vaccination and farm biosecurity plans with veterinary guidance, and report unusual illness or mortality promptly.',
    descriptionBn: 'অপ্রয়োজনীয় দর্শনার্থী সীমিত করুন, এক দল থেকে অন্য দলে যাওয়ার আগে সরঞ্জাম পরিষ্কার ও জীবাণুমুক্ত করুন এবং খাদ্য ও পানি দূষণ থেকে রক্ষা করুন। পশুচিকিৎসকের নির্দেশনায় স্থানীয় টিকাদান ও খামারের জৈব-নিরাপত্তা পরিকল্পনা অনুসরণ করুন এবং অস্বাভাবিক অসুস্থতা বা মৃত্যুর খবর দ্রুত জানান।',
    descriptionHi: 'अनावश्यक आगंतुक सीमित करें, समूहों के बीच उपकरण साफ़ और कीटाणुरहित करें, तथा चारे और पानी को दूषित होने से बचाएँ। पशु चिकित्सक के मार्गदर्शन में स्थानीय टीकाकरण और फार्म जैव-सुरक्षा योजना अपनाएँ और असामान्य बीमारी या मृत्यु की तुरंत सूचना दें।',
    descriptionUr: 'غیر ضروری مہمانوں کو محدود کریں، گروہوں کے درمیان آلات صاف اور جراثیم سے پاک کریں، اور خوراک و پانی کو آلودگی سے بچائیں۔ ویٹرنری رہنمائی کے ساتھ مقامی ویکسین اور فارم کے حیاتیاتی تحفظ کے منصوبے پر عمل کریں، اور غیر معمولی بیماری یا اموات کی اطلاع فوراً دیں۔',
    images: [],
  },
]

const notices = [
  { id: 'colistin', typeKey: 'noticeLabel', titleKey: 'colistinTitle', descriptionKey: 'colistinDescription', dateKey: 'latest' },
  { id: 'tip-water', typeKey: 'dailyTip', titleKey: 'waterTipTitle', descriptionKey: 'waterTipDescription', dateKey: 'today' },
  { id: 'tip-records', typeKey: 'dailyTip', titleKey: 'recordTipTitle', descriptionKey: 'recordTipDescription', dateKey: 'today' },
]

function resolveWeatherTheme(weather) {
  if (weather?.icon?.endsWith('n')) return 'night'

  const condition = weather?.main?.toLowerCase()
  if (condition === 'thunderstorm') return 'storm'
  if (condition === 'rain' || condition === 'drizzle') return 'rain'
  if (condition === 'snow') return 'snow'
  if (['mist', 'smoke', 'haze', 'dust', 'fog', 'sand', 'ash', 'squall', 'tornado'].includes(condition)) return 'mist'
  if (condition === 'clouds') return 'cloudy'
  return 'sunny'
}

function Dashboard({ onLogout, initialName, initialLocation }) {
  const { t, language, setLanguage } = useLanguage()
  const [weather, setWeather] = useState(null)
  const [weatherError, setWeatherError] = useState('')
  const [weatherLoadingState, setWeatherLoading] = useState(true)
  const [weatherRefresh, setWeatherRefresh] = useState(0)
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY
  const hasGeolocation = typeof navigator !== 'undefined' && Boolean(navigator.geolocation)
  const weatherLoading = Boolean(apiKey && hasGeolocation && weatherLoadingState)
  const weatherErrorMessage = !apiKey
    ? t('weatherKeyMissing')
    : !hasGeolocation
      ? t('geoUnavailable')
      : weatherError
        ? t(weatherError)
        : ''
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sosOpen, setSosOpen] = useState(false)
  const [noticeSearch, setNoticeSearch] = useState('')
  const [visibleNotices, setVisibleNotices] = useState(notices)
  const [noticeSearchLoading, setNoticeSearchLoading] = useState(false)
  const [noticeSearchError, setNoticeSearchError] = useState('')
  const [points, setPoints] = useState(140)
  const [pointsToast, setPointsToast] = useState(false)
  const [fontSize, setFontSize] = useState(() => {
    const savedSize = Number(localStorage.getItem('poultry-font-size'))
    return Number.isInteger(savedSize) && savedSize >= 14 && savedSize <= 24 ? savedSize : 16
  })
  const [fontFamily, setFontFamily] = useState(() => {
    const savedFamily = localStorage.getItem('poultry-font-family')
    return ['system', 'hind-siliguri', 'noto-bengali', 'inter', 'poppins'].includes(savedFamily) ? savedFamily : 'system'
  })
  const [name, setName] = useState(() => localStorage.getItem('poultry-profile-name') || initialName || '')
  const [profileLocation, setProfileLocation] = useState(() => localStorage.getItem('poultry-profile-location') || initialLocation || '')
  const [avatar, setAvatar] = useState(() => localStorage.getItem('poultry-profile-avatar') || '')
  const [dailyTipsEnabled, setDailyTipsEnabled] = useState(() => localStorage.getItem('poultry-notify-tips') !== 'false')
  const [noticesEnabled, setNoticesEnabled] = useState(() => localStorage.getItem('poultry-notify-notices') !== 'false')
  const [feedback, setFeedback] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState('')
  const [shareMessage, setShareMessage] = useState('')
  const [guidelinesExpanded, setGuidelinesExpanded] = useState(false)
  const [activeView, setActiveView] = useState('home')

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--app-font-size', `${fontSize}px`)
    root.style.setProperty('--app-scale', String(fontSize / 16))
  }, [fontSize])

  useEffect(() => {
    document.documentElement.dataset.fontFamily = fontFamily
  }, [fontFamily])

  useEffect(() => {
    const query = noticeSearch.trim().toLocaleLowerCase()
    let active = true
    const controller = new AbortController()
    const searchTimeout = window.setTimeout(async () => {
      const results = query
        ? notices.filter(({ titleKey, descriptionKey, typeKey }) => (
          `${t(titleKey)} ${t(descriptionKey)} ${t(typeKey)}`.toLocaleLowerCase().includes(query)
        ))
        : notices
      if (!active) return
      setNoticeSearchError('')
      if (!query || results.length) {
        setVisibleNotices(results)
        setNoticeSearchLoading(false)
        return
      }

      setNoticeSearchLoading(true)
      try {
        const externalResult = await searchWikipedia(noticeSearch.trim(), language, controller.signal)
        if (!active) return
        setVisibleNotices(externalResult ? [{
          id: `external-${externalResult.title}`,
          typeKey: 'dailyTip',
          external: externalResult,
        }] : [])
        if (!externalResult) setNoticeSearchError('noExternalSearchResult')
      } catch {
        if (active && !controller.signal.aborted) {
          setVisibleNotices([])
          setNoticeSearchError('externalSearchError')
        }
      } finally {
        if (active) setNoticeSearchLoading(false)
      }
    }, query ? 350 : 0)

    return () => {
      active = false
      controller.abort()
      window.clearTimeout(searchTimeout)
    }
  }, [noticeSearch, language, t])

  function handleNoticeSearchChange(event) {
    const nextQuery = event.target.value
    const normalizedQuery = nextQuery.trim().toLocaleLowerCase()
    const localResults = normalizedQuery
      ? notices.filter(({ titleKey, descriptionKey, typeKey }) => (
        `${t(titleKey)} ${t(descriptionKey)} ${t(typeKey)}`.toLocaleLowerCase().includes(normalizedQuery)
      ))
      : notices

    setNoticeSearch(nextQuery)
    setNoticeSearchError('')
    setNoticeSearchLoading(Boolean(normalizedQuery && localResults.length === 0))
  }

  useEffect(() => {
    if (!pointsToast) return undefined
    const timeout = window.setTimeout(() => setPointsToast(false), 3000)
    return () => window.clearTimeout(timeout)
  }, [pointsToast])

  useEffect(() => {
    let active = true
    if (!apiKey || !navigator.geolocation) return () => { active = false }

    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const query = `lat=${coords.latitude}&lon=${coords.longitude}&appid=${apiKey}`
        const [weatherResponse, uvResponse, placeResponse] = await Promise.all([
          fetch(`https://api.openweathermap.org/data/2.5/weather?${query}&units=metric&lang=${language}`),
          fetch(`https://api.openweathermap.org/data/2.5/uvi?${query}`),
          fetch(`https://api.openweathermap.org/geo/1.0/reverse?${query}&limit=1&lang=${language}`),
        ])
        if (!weatherResponse.ok) throw new Error(`Weather request failed (${weatherResponse.status})`)
        const current = await weatherResponse.json()
        const uv = uvResponse.ok ? await uvResponse.json() : null
        const places = placeResponse.ok ? await placeResponse.json() : []
        if (active) {
          setWeather({
            city: places[0]?.local_names?.[language] || places[0]?.name || current.name || t('yourLocation'),
            country: places[0]?.country || '',
            temperature: Math.round(current.main.temp),
            feelsLike: Math.round(current.main.feels_like),
            condition: current.weather?.[0]?.description || t('weatherUnavailable'),
            icon: current.weather?.[0]?.icon || '01d',
            theme: resolveWeatherTheme(current.weather?.[0]),
            humidity: current.main.humidity,
            wind: Math.round((current.wind?.speed || 0) * 3.6),
            uv: uv?.value ?? null,
          })
          setWeatherError('')
        }
      } catch {
        if (active) setWeatherError('weatherFetchError')
      } finally {
        if (active) setWeatherLoading(false)
      }
    }, () => {
      if (active) {
        setWeatherError('geoPermissionError')
        setWeatherLoading(false)
      }
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 })

    return () => { active = false }
  }, [apiKey, language, t, weatherRefresh])

  useEffect(() => {
    if (!settingsOpen && !sosOpen) return undefined
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setSettingsOpen(false)
        setSosOpen(false)
      }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [settingsOpen, sosOpen])

  const heatStress = weather && (
    weather.temperature >= 35
    || (weather.temperature >= 30 && weather.humidity >= 70)
    || weather.feelsLike >= 36
  )
  const weatherTheme = weather?.theme || 'sunny'

  async function shareApp() {
    setShareMessage('')
    try {
      if (navigator.share) {
        await navigator.share({ title: 'PoultryMedix', text: t('shareText'), url: window.location.origin })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.origin)
        setShareMessage(t('linkCopied'))
      } else {
        setShareMessage(t('shareUnavailable'))
      }
    } catch (error) {
      if (error.name !== 'AbortError') setShareMessage(t('shareUnavailable'))
    }
  }

  function saveProfile() {
    try {
      localStorage.setItem('poultry-profile-name', name.trim())
      localStorage.setItem('poultry-profile-location', profileLocation.trim())
      if (avatar) localStorage.setItem('poultry-profile-avatar', avatar)
      setSettingsMessage(t('profileSaved'))
    } catch {
      setSettingsMessage(t('profileSaveError'))
    }
  }

  function updateFontSize(event) {
    const nextSize = Number(event.target.value)
    setFontSize(nextSize)
    try {
      localStorage.setItem('poultry-font-size', nextSize)
      setSettingsMessage('')
    } catch {
      setSettingsMessage(t('fontSizeSaveError'))
    }
  }

  function updateFontFamily(event) {
    const nextFamily = event.target.value
    setFontFamily(nextFamily)
    try {
      localStorage.setItem('poultry-font-family', nextFamily)
      setSettingsMessage('')
    } catch {
      setSettingsMessage(t('fontSizeSaveError'))
    }
  }

  function retryWeather() {
    setWeather(null)
    setWeatherError('')
    setWeatherLoading(true)
    setWeatherRefresh((refresh) => refresh + 1)
  }

  function handleAvatarChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setSettingsMessage(t('imageOnlyError'))
      return
    }
    if (file.size > 1024 * 1024) {
      setSettingsMessage(t('imageTooLarge'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatar(reader.result)
        setSettingsMessage('')
      }
    }
    reader.onerror = () => setSettingsMessage(t('imageReadError'))
    reader.readAsDataURL(file)
  }

  function saveNotification(key, value) {
    try {
      if (key === 'tips') {
        localStorage.setItem('poultry-notify-tips', String(value))
        setDailyTipsEnabled(value)
      } else {
        localStorage.setItem('poultry-notify-notices', String(value))
        setNoticesEnabled(value)
      }
      setSettingsMessage('')
    } catch {
      setSettingsMessage(t('preferenceSaveError'))
    }
  }

  async function submitFeedback(event) {
    event.preventDefault()
    if (!feedback.trim()) return
    try {
      localStorage.setItem('poultry-feedback-latest', feedback.trim())
      setFeedbackSent(true)
      setFeedback('')
    } catch {
      setFeedbackSent(false)
      setSettingsMessage(t('feedbackSaveError'))
    }
  }

  async function logout() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      onLogout()
    } catch {
      setSettingsMessage(t('logoutError'))
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <a className="dashboard-brand" href="#dashboard" aria-label={t('brand')} onClick={() => setActiveView('home')}>
          <img className="dashboard-brand-mark" src="/images/logo.png" alt="" />
          <span>Poultry<span>Medix</span></span>
        </a>
        <div className="dashboard-header-actions">
          <div className="points-pill" aria-label={`${t('points')}: ${points}`}><Icon name="star" size={14} /><strong>{points}</strong> <span>{t('points')}</span></div>
          <ThemeToggle />
          <select className="dashboard-language-button" aria-label={t('language')} title={t('language')} value={language} onChange={(event) => setLanguage(event.target.value)}>
            {['en', 'bn', 'hi', 'ur'].map((code) => <option key={code} value={code}>{t(`language${{ en: 'English', bn: 'Bangla', hi: 'Hindi', ur: 'Urdu' }[code]}`)}</option>)}
          </select>
          <button className="profile-button" type="button" onClick={() => { setSettingsOpen(true); setSettingsMessage('') }} aria-label={t('profileSettings')}>
            {avatar ? <img src={avatar} alt="" /> : <Icon name="user" size={19} />}
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        {activeView === 'home' ? <>
        <section className="dashboard-greeting">
          <div>
            <p className="dashboard-kicker">{t('dashboardEyebrow')}</p>
            <h1>{t('hello')} {name.trim() || t('farmer')}</h1>
            <p>{t('dashboardIntro')}</p>
          </div>
        </section>

        <section className={`weather-card weather-card--${weatherTheme}${heatStress ? ' weather-card--alert' : ''}`} aria-labelledby="weather-heading">
          <div className="weather-card-top">
            <div className="weather-location">
              <span className="weather-location-icon"><Icon name="pin" size={15} /></span>
              <div><p>{t('localWeather')}</p><h2 id="weather-heading">{weather ? `${weather.city}${weather.country ? `, ${weather.country}` : ''}` : t('yourLocation')}</h2></div>
            </div>
            <span className="live-chip"><span />{t('liveWeather')}</span>
          </div>
          {weatherLoading ? (
            <div className="weather-loading"><span className="loading-dot" />{t('weatherLoading')}</div>
          ) : weather ? (
            <>
              <div className="weather-main">
                <div className="weather-temperature">
                  <img src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`} alt={weather.condition} />
                  <strong>{weather.temperature}°</strong><span>C</span>
                </div>
                <div className="weather-condition"><span>{weather.condition}</span><small>{t('feelsLike')}: {weather.feelsLike}°C</small></div>
              </div>
              <div className="weather-metrics">
                <div><Icon name="droplet" size={17} /><span>{t('humidity')}</span><strong>{weather.humidity}%</strong></div>
                <div><Icon name="wind" size={17} /><span>{t('wind')}</span><strong>{weather.wind} <small>km/h</small></strong></div>
                <div><Icon name="sun" size={17} /><span>{t('uvIndex')}</span><strong>{weather.uv === null ? '—' : weather.uv}</strong></div>
              </div>
              <div className={`heat-alert${heatStress ? ' heat-alert--high' : ''}`}>
                <Icon name={heatStress ? 'alert' : 'thermometer'} size={17} />
                <span><strong>{heatStress ? t('heatStressAlert') : t('heatStressCheck')}</strong><small>{heatStress ? t('heatStressAdvice') : t('heatStressNormal')}</small></span>
                <span className="heat-badge">{heatStress ? t('attention') : t('normal')}</span>
              </div>
            </>
          ) : (
            <div className="weather-error" role="status"><Icon name="cloud" size={21} /><span>{weatherErrorMessage}</span><button type="button" onClick={retryWeather}>{t('retry')}</button></div>
          )}
        </section>

        <DiagnosisHub />

        <section className="guidelines-section" aria-labelledby="guidelines-heading">
          <button
            className="guidelines-accordion-trigger"
            type="button"
            aria-expanded={guidelinesExpanded}
            aria-controls="guidelines-accordion-content"
            onClick={() => setGuidelinesExpanded((expanded) => !expanded)}
          >
            <span className="section-icon"><Icon name="book" size={18} /></span>
            <span className="guidelines-accordion-copy">
              <h2 id="guidelines-heading">{t('guidelinesTitle')}</h2>
              <span>{t('guidelinesSubtitle')}</span>
            </span>
            <Icon className={`guidelines-accordion-chevron${guidelinesExpanded ? ' is-open' : ''}`} name="chevron" size={17} />
          </button>
          {guidelinesExpanded && <div className="guideline-grid" id="guidelines-accordion-content">
            {guidelinesData.map((guideline) => (
              <article className="guideline-card" key={guideline.id}>
                <div className="guideline-card-content">
                  <h3>{guideline[`title${{ en: '', bn: 'Bn', hi: 'Hi', ur: 'Ur' }[language]}`]}</h3>
                  <p>{guideline[`description${{ en: '', bn: 'Bn', hi: 'Hi', ur: 'Ur' }[language]}`]}</p>
                  {guideline.images.length > 0 && (
                    <div className="guideline-image-grid">
                      {guideline.images.map((imagePath) => <img key={imagePath} src={imagePath} alt={guideline[`title${{ en: '', bn: 'Bn', hi: 'Hi', ur: 'Ur' }[language]}`]} />)}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>}
        </section>

        <section className="notices-section" aria-labelledby="notices-heading">
          <div className="section-heading notices-heading">
            <div><span className="section-icon section-icon--sun"><Icon name="bell" size={18} /></span><div><h2 id="notices-heading">{t('noticesTitle')}</h2><p>{t('noticesSubtitle')}</p></div></div>
            <div className="notice-search-wrap">
              <label className="notice-search"><Icon name="search" size={17} /><input type="search" placeholder={t('searchNotices')} value={noticeSearch} onChange={handleNoticeSearchChange} aria-label={t('searchNotices')} /></label>
              {noticeSearchLoading && <p className="notice-search-status" role="status">{t('searchingOnlineSources')}</p>}
            </div>
          </div>
          <div className="notice-list">
            {!noticeSearchLoading && (visibleNotices.length ? visibleNotices.map(({ id, typeKey, titleKey, descriptionKey, dateKey, external }) => (
              <article className={`notice-item${id === 'colistin' ? ' notice-item--important' : ''}`} key={id}>
                <span className={`notice-symbol${id === 'colistin' ? ' notice-symbol--red' : ''}`}><Icon name={id === 'colistin' ? 'alert' : 'leaf'} size={17} /></span>
                <div className="notice-copy">
                  <span className="notice-type">{external ? t('externalSourceBadge') : t(typeKey)}</span>
                  <h3>{external?.title || t(titleKey)}</h3>
                  <p>{external?.extract || t(descriptionKey)}</p>
                  {external && <a className="external-source-badge" href={external.url} target="_blank" rel="noreferrer">{t('wikipediaSource')}</a>}
                </div>
                {!external && <time>{t(dateKey)}</time>}
              </article>
            )) : <p className="empty-notices">{noticeSearchError ? t(noticeSearchError) : t('noNotices')}</p>)}
          </div>
          <p className="notice-disclaimer">{t('noticeDisclaimer')}</p>
        </section>

        <button className="sos-button" type="button" onClick={() => setSosOpen(true)}>
          <span className="sos-symbol"><Icon name="sos" size={19} /></span>
          <span><strong>{t('emergencySos')}</strong><small>{t('emergencySubtitle')}</small></span>
          <Icon name="arrow" size={18} />
        </button>
        <footer className="dashboard-footer"><BrandFooter /> <span>{t('dashboardFooter')}</span></footer>
        </> : activeView === 'map' ? (
          <Suspense fallback={<div className="p-4 text-center">Loading Map...</div>}>
            <EpidemiologyMap />
          </Suspense>
        ) : activeView === 'data' ? <DataHub onContributionSubmitted={() => { setPoints((previousPoints) => previousPoints + 10); setPointsToast(true) }} /> : activeView === 'history' ? <ClinicalLog /> : activeView === 'team' ? <TeamPage /> : activeView === 'telemedicine' ? <Telemedicine /> : (
          <Suspense fallback={<div className="p-4 text-center">Loading Map...</div>}>
            <EpidemiologyMap />
          </Suspense>
        )}
      </div>
      {pointsToast && <div className="points-toast" role="status">+10 Point earned for your contribution!</div>}

      <nav className="bottom-navigation" aria-label={t('featureNavigation')}>
        {[
          ['home', 'home', 'bottomHome'],
          ['map', 'map', 'bottomMap'],
          ['history', 'clipboard', 'clinicalHistoryNav'],
          ['data', 'brain', 'bottomContribute'],
          ['telemedicine', 'stethoscope', 'consultVetNav'],
          ['team', 'users', 'teamNav'],
        ].map(([view, icon, label]) => (
          <button type="button" key={view} aria-current={activeView === view ? 'page' : undefined} className={activeView === view ? 'active' : ''} onClick={() => setActiveView(view)}>
            <Icon name={icon} size={19} /><span>{t(label)}</span>
          </button>
        ))}
      </nav>

      {settingsOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false) }}>
          <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="settings-header">
              <div><p>{t('settingsEyebrow')}</p><h2 id="settings-title">{t('settings')}</h2></div>
              <button className="icon-button modal-close" type="button" aria-label={t('close')} onClick={() => setSettingsOpen(false)}><Icon name="close" size={20} /></button>
            </div>
            <div className="settings-body">
              <section className="settings-block">
                <div className="settings-block-heading"><span className="settings-icon settings-logo-icon"><img src="/images/logo.png" alt="" /></span><div><h3>{t('profileSettings')}</h3><p>{t('profileDescription')}</p></div></div>
                <div className="profile-photo-row">
                  {avatar ? <img className="profile-avatar-large" src={avatar} alt={t('profilePhoto')} /> : <span className="profile-avatar-large profile-avatar-placeholder"><Icon name="user" size={22} /></span>}
                  <label className="settings-action upload-avatar"><Icon name="upload" size={15} /> {t('uploadPhoto')}<input type="file" accept="image/*" onChange={handleAvatarChange} /></label>
                </div>
                <label className="settings-label">{t('displayName')}<input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('namePlaceholder')} /></label>
                <label className="settings-label">{t('location')}<input value={profileLocation} onChange={(event) => setProfileLocation(event.target.value)} placeholder={t('profileLocationPlaceholder')} /></label>
                <button className="save-profile-button" type="button" onClick={saveProfile}>{t('saveProfile')}</button>
                {settingsMessage && <p className="settings-feedback" role="status">{settingsMessage}</p>}
              </section>

              <section className="settings-block manual-block">
                <div className="settings-block-heading"><span className="settings-icon"><Icon name="book" size={17} /></span><div><h3>{t('userManual')}</h3><p>{t('manualDescription')}</p></div></div>
                {['scannerManual', 'prescriptionManual', 'outbreakManual', 'dataHubManual', 'guidelinesManual'].map((key) => (
                  <details className="manual-item" key={key}>
                    <summary>{t(`${key}Title`)}<Icon name="chevron" size={16} /></summary>
                    <p>{t(key)}</p>
                  </details>
                ))}
              </section>

              <section className="settings-block">
               <div className="settings-block-heading"><span className="settings-icon"><Icon name="globe" size={17} /></span><div><h3>{t('fontSize')}</h3><p>{t('fontSizeDescription')}</p></div></div>
               <label className="settings-label" htmlFor="font-size-range">
                 Font size: <strong>{fontSize}px</strong>
                 <input id="font-size-range" type="range" min="14" max="24" step="1" value={fontSize} onChange={updateFontSize} />
                 <span className="settings-range-labels"><span>14px</span><span>24px</span></span>
               </label>
               <label className="settings-label" htmlFor="font-family-select">
                 Font style / family
                 <select id="font-family-select" value={fontFamily} onChange={updateFontFamily}>
                   <option value="system">Default (System UI)</option>
                   <option value="hind-siliguri">Hind Siliguri (English + Bengali)</option>
                   <option value="noto-bengali">Noto Sans Bengali</option>
                   <option value="inter">Inter</option>
                   <option value="poppins">Poppins</option>
                 </select>
               </label>
              </section>

              <section className="settings-block">
                <div className="settings-block-heading"><span className="settings-icon"><Icon name="share" size={17} /></span><div><h3>{t('shareApp')}</h3><p>{t('shareDescription')}</p></div></div>
                <button className="settings-action" type="button" onClick={shareApp}>{t('shareApp')} <Icon name="arrow" size={15} /></button>
                {shareMessage && <p className="settings-feedback" role="status">{shareMessage}</p>}
              </section>

              <section className="settings-block">
                <div className="settings-block-heading"><span className="settings-icon"><Icon name="bell" size={17} /></span><div><h3>{t('notifications')}</h3><p>{t('notificationDescription')}</p></div></div>
                <div className="toggle-row"><span>{t('dailyTipsNotifications')}</span><button type="button" role="switch" aria-checked={dailyTipsEnabled} aria-label={t('dailyTipsNotifications')} className={`toggle-switch${dailyTipsEnabled ? ' is-on' : ''}`} onClick={() => saveNotification('tips', !dailyTipsEnabled)}><span /></button></div>
                <div className="toggle-row"><span>{t('noticeNotifications')}</span><button type="button" role="switch" aria-checked={noticesEnabled} aria-label={t('noticeNotifications')} className={`toggle-switch${noticesEnabled ? ' is-on' : ''}`} onClick={() => saveNotification('notices', !noticesEnabled)}><span /></button></div>
              </section>

              <section className="settings-block">
                <div className="settings-block-heading"><span className="settings-icon"><Icon name="message" size={17} /></span><div><h3>{t('feedbackTitle')}</h3><p>{t('feedbackDescription')}</p></div></div>
                <form className="feedback-form" onSubmit={submitFeedback}>
                  <textarea value={feedback} onChange={(event) => { setFeedback(event.target.value); setFeedbackSent(false) }} placeholder={t('feedbackPlaceholder')} rows="3" />
                  <button type="submit" disabled={!feedback.trim()}>{t('sendFeedback')}</button>
                </form>
                {feedbackSent && <p className="settings-feedback" role="status">{t('feedbackThanks')}</p>}
              </section>

              <button className="signout-button" type="button" onClick={logout}><Icon name="logout" size={17} /> {t('signOut')}</button>
            </div>
          </section>
        </div>
      )}

      {sosOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSosOpen(false) }}>
          <section className="sos-modal" role="dialog" aria-modal="true" aria-labelledby="sos-title">
            <button className="icon-button modal-close" type="button" aria-label={t('close')} onClick={() => setSosOpen(false)}><Icon name="close" size={20} /></button>
            <span className="sos-modal-icon"><Icon name="alert" size={25} /></span>
            <h2 id="sos-title">{t('emergencySos')}</h2>
            <p>{t('sosInstructions')}</p>
            <button className="save-profile-button" type="button" onClick={() => setSosOpen(false)}>{t('understood')}</button>
          </section>
        </div>
      )}
      <AIChat />
    </main>
  )
}

function BrandFooter() {
  return <span className="dashboard-footer-brand"><img className="dashboard-footer-brand-mark" src="/images/logo.png" alt="" /> Poultry<span>Medix</span></span>
}

export default Dashboard
