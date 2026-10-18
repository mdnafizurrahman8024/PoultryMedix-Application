import React, { Suspense, useEffect, useRef, useState } from 'react'
import { Globe, Menu, X } from 'lucide-react'
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
import { USER_ROLES, useUser } from './context/UserContext.jsx'
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

const openWeatherApiKey = import.meta.env.VITE_OPENWEATHER_API_KEY

function Dashboard({ onLogout, initialName, initialLocation }) {
  const { t, language, setLanguage } = useLanguage()
  const { role, setRole } = useUser()
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const [desktopProfileMenuOpen, setDesktopProfileMenuOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isWideDesktop, setIsWideDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches)
  const [showPointsPopup, setShowPointsPopup] = useState(false)
  const languageMenuRef = useRef(null)
  const mobileLanguageMenuRef = useRef(null)
  const headerRef = useRef(null)
  const pointsPopupRef = useRef(null)
  const [weather, setWeather] = useState(null)
  const [weatherError, setWeatherError] = useState('')
  const [weatherLoadingState, setWeatherLoading] = useState(true)
  const [weatherRefresh, setWeatherRefresh] = useState(0)
  const hasGeolocation = typeof navigator !== 'undefined' && Boolean(navigator.geolocation)
  const weatherLoading = Boolean(hasGeolocation && weatherLoadingState)
  const weatherErrorMessage = !hasGeolocation
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
    const desktopQuery = window.matchMedia('(min-width: 1024px)')
    const updateDesktopLayout = () => setIsWideDesktop(desktopQuery.matches)
    updateDesktopLayout()
    desktopQuery.addEventListener('change', updateDesktopLayout)
    return () => desktopQuery.removeEventListener('change', updateDesktopLayout)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--app-font-size', `${fontSize}px`)
    root.style.setProperty('--app-scale', String(fontSize / 16))
  }, [fontSize])

  useEffect(() => {
    document.documentElement.dataset.fontFamily = fontFamily
  }, [fontFamily])

  useEffect(() => {
    function closeLanguageMenu(event) {
      const clickedDesktopLanguage = languageMenuRef.current?.contains(event.target)
      const clickedMobileLanguage = mobileLanguageMenuRef.current?.contains(event.target)
      if (!clickedDesktopLanguage && !clickedMobileLanguage) {
        setLanguageMenuOpen(false)
      }
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setDesktopProfileMenuOpen(false)
      }
    }

    function closeLanguageMenuOnEscape(event) {
      if (event.key === 'Escape') {
        setLanguageMenuOpen(false)
        setDesktopProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', closeLanguageMenu)
    document.addEventListener('keydown', closeLanguageMenuOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeLanguageMenu)
      document.removeEventListener('keydown', closeLanguageMenuOnEscape)
    }
  }, [])

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined

    function closeMobileMenu(event) {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setIsMobileMenuOpen(false)
        setLanguageMenuOpen(false)
      }
    }

    function closeMobileMenuOnEscape(event) {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false)
        setLanguageMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', closeMobileMenu)
    document.addEventListener('keydown', closeMobileMenuOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMobileMenu)
      document.removeEventListener('keydown', closeMobileMenuOnEscape)
    }
  }, [isMobileMenuOpen])

  useEffect(() => {
    if (!showPointsPopup) return undefined

    function closePointsPopup(event) {
      if (pointsPopupRef.current && !pointsPopupRef.current.contains(event.target)) {
        setShowPointsPopup(false)
      }
    }

    function closePointsPopupOnEscape(event) {
      if (event.key === 'Escape') setShowPointsPopup(false)
    }

    document.addEventListener('mousedown', closePointsPopup)
    document.addEventListener('keydown', closePointsPopupOnEscape)
    return () => {
      document.removeEventListener('mousedown', closePointsPopup)
      document.removeEventListener('keydown', closePointsPopupOnEscape)
    }
  }, [showPointsPopup])

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
    if (!navigator.geolocation) {
      setWeatherLoading(false)
      return () => { active = false }
    }
    if (!openWeatherApiKey) {
      setWeatherError('weatherKeyMissing')
      setWeatherLoading(false)
      return () => { active = false }
    }

    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const query = new URLSearchParams({
          lat: String(coords.latitude),
          lon: String(coords.longitude),
          appid: openWeatherApiKey,
          units: 'metric',
          lang: language,
        })
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?${query.toString()}`
        const optionalWeatherRequest = (url) => fetch(url)
          .then((response) => response.ok ? response.json() : null)
          .catch(() => null)
        const [response, uv, places] = await Promise.all([
          fetch(weatherUrl),
          optionalWeatherRequest(`https://api.openweathermap.org/data/2.5/uvi?${query.toString()}`),
          optionalWeatherRequest(`https://api.openweathermap.org/geo/1.0/reverse?${query.toString()}&limit=1`),
        ])
        const current = await response.json().catch(() => null)
        if (!response.ok || !current?.main || !Array.isArray(current.weather)) {
          throw new Error('weatherFetchError')
        }
        const place = Array.isArray(places) ? places[0] : null
        const currentWeather = current.weather[0]
        if (active) {
          setWeather({
            city: place?.local_names?.[language] || place?.name || current.name || t('yourLocation'),
            country: place?.country || current.sys?.country || '',
            temperature: Math.round(current.main.temp),
            feelsLike: Math.round(current.main.feels_like),
            condition: currentWeather?.description || t('weatherUnavailable'),
            icon: /^\d{2}[dn]$/.test(currentWeather?.icon || '') ? currentWeather.icon : '01d',
            theme: resolveWeatherTheme(currentWeather),
            humidity: current.main.humidity,
            wind: Math.round((current.wind?.speed || 0) * 3.6),
            uv: Number.isFinite(uv?.value) ? uv.value : null,
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
  }, [language, t, weatherRefresh])

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

  const renderLanguageControl = (ref) => (
    <div className="dashboard-language-menu" ref={ref}>
      <button className="dashboard-language-trigger" type="button" aria-expanded={languageMenuOpen} aria-haspopup="menu" aria-label={t('language')} title={t('language')} onClick={() => setLanguageMenuOpen((current) => !current)}>
        <Globe size={17} strokeWidth={1.8} aria-hidden="true" />
        <span>{language.toUpperCase()}</span>
      </button>
      {languageMenuOpen && (
        <div className="dashboard-language-dropdown absolute z-50 rounded shadow-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" role="menu" aria-label={t('language')}>
          {[
            ['en', 'EN'],
            ['bn', 'à¦¬à¦¾à¦‚à¦²à¦¾'],
            ['hi', 'à¤¹à¤¿à¦‚à¦¦à¥€'],
            ['ur', 'Ø§Ø±Ø¯Ùˆ'],
          ].map(([code]) => (
            <button className={`${language === code ? 'active' : ''} dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700`} type="button" role="menuitem" key={code} onClick={() => { setLanguage(code); setLanguageMenuOpen(false) }}>
              {({ en: 'English', bn: '\u09ac\u09be\u0982\u09b2\u09be', hi: '\u0939\u093f\u0928\u094d\u0926\u0940', ur: '\u0627\u0631\u062f\u0648' })[code]}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const renderRoleControl = () => import.meta.env.DEV && (
    <label className="role-switcher">
      <span>{t('devRole')}</span>
      <select value={role} onChange={(event) => setRole(event.target.value)} aria-label={t('switchDevelopmentRole')}>
        {USER_ROLES.map((userRole) => <option key={userRole} value={userRole}>{t(`roleOptions.${userRole}`)}</option>)}
      </select>
    </label>
  )

  const renderProfileControl = () => (
    <button className="mobile-profile-control" type="button" onClick={() => { setIsMobileMenuOpen(false); setSettingsOpen(true); setSettingsMessage('') }} aria-label={t('profileSettings')}>
      <span className="mobile-profile-avatar">{avatar ? <img src={avatar} alt="" /> : <Icon name="user" size={19} />}</span>
      <span>{t('settings')}</span>
    </button>
  )

  const openAboutUs = () => {
    setIsMobileMenuOpen(false)
    setDesktopProfileMenuOpen(false)
    setActiveView('team')
  }

  const renderAboutUsControl = () => (
    <button className="header-menu-item" type="button" onClick={openAboutUs}>
      <Icon name="users" size={18} />
      <span>About Us</span>
    </button>
  )

  const renderPrivacyControl = () => (
    <button className="header-menu-item" type="button" onClick={() => { setIsMobileMenuOpen(false); setDesktopProfileMenuOpen(false) }}>
      <Icon name="shield" size={18} />
      <span>Privacy &amp; Security</span>
    </button>
  )

  return (
    <main className="dashboard-shell w-full min-w-0 max-w-full md:text-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <header className={`dashboard-header bg-white dark:bg-gray-900 text-gray-900 dark:text-white dark:border-gray-700${isMobileMenuOpen || showPointsPopup ? ' is-mobile-menu-open' : ''}`} ref={headerRef}>
        <a className="dashboard-brand" href="#dashboard" aria-label={t('brand')} onClick={() => setActiveView('home')}>
          <img className="dashboard-brand-mark" src="/images/logo.png" alt="" />
          <span>Poultry<span>Medix</span></span>
        </a>
        <div className="dashboard-header-actions flex items-center gap-4">
          <div className="points-pill header-points-pill" aria-label={`${t('points')}: ${points}`}><Icon name="star" size={14} /><strong>{points}</strong> <span>{t('points')}</span></div>
          <div className="mobile-points-wrap" ref={pointsPopupRef}>
            <button className="mobile-points-trigger" type="button" aria-label={`${points} ${t('points')}`} aria-expanded={showPointsPopup} onClick={() => { setIsMobileMenuOpen(false); setShowPointsPopup((current) => !current) }}>
              <Icon name="star" size={20} />
            </button>
            {showPointsPopup && (
              <div className="mobile-points-popup" role="status">
                <Icon name="star" size={18} />
                <strong>{points}</strong>
                <span>{t('points')}</span>
              </div>
            )}
          </div>
          <ThemeToggle />
          <button
            className="mobile-header-menu-trigger block md:hidden"
            type="button"
            aria-label={isMobileMenuOpen ? t('close') : t('profileSettings')}
            aria-expanded={isMobileMenuOpen}
            aria-controls="dashboard-mobile-menu"
            onClick={() => { setShowPointsPopup(false); setIsMobileMenuOpen((current) => !current) }}
          >
            {isMobileMenuOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
          </button>
          <div className="hidden md:flex items-center gap-x-4 dashboard-desktop-header-controls">
          <div className="dashboard-language-menu" ref={languageMenuRef}>
            <button
              className="dashboard-language-trigger"
              type="button"
              aria-expanded={languageMenuOpen}
              aria-haspopup="menu"
              aria-label={t('language')}
              title={t('language')}
              onClick={() => setLanguageMenuOpen((current) => !current)}
            >
              <Globe size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>{language.toUpperCase()}</span>
            </button>
            {languageMenuOpen && (
              <div className="dashboard-language-dropdown absolute z-50 rounded shadow-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" role="menu" aria-label={t('language')}>
                {[
                  ['en', 'EN'],
                  ['bn', 'বাংলা'],
                  ['hi', 'हिंदी'],
                  ['ur', 'اردو'],
                ].map(([code, label]) => (
                  <button
                    className={`${language === code ? 'active' : ''} dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700`}
                    type="button"
                    role="menuitem"
                    key={code}
                    onClick={() => {
                      setLanguage(code)
                      setLanguageMenuOpen(false)
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {import.meta.env.DEV && (
            // TODO: REMOVE BEFORE PRODUCTION
            <label className="role-switcher">
              <span>{t('devRole')}</span>
              <select value={role} onChange={(event) => setRole(event.target.value)} aria-label={t('switchDevelopmentRole')}>
                {USER_ROLES.map((userRole) => <option key={userRole} value={userRole}>{t(`roleOptions.${userRole}`)}</option>)}
              </select>
            </label>
          )}
          <div className="desktop-profile-menu-wrap">
            <button className="profile-button" type="button" onClick={() => setDesktopProfileMenuOpen((current) => !current)} aria-label={t('profileSettings')} aria-expanded={desktopProfileMenuOpen}>
              {avatar ? <img src={avatar} alt="" /> : <Icon name="user" size={19} />}
            </button>
            {desktopProfileMenuOpen && (
              <div className="desktop-profile-menu" role="menu">
                <button className="header-menu-item" type="button" role="menuitem" onClick={() => { setDesktopProfileMenuOpen(false); setSettingsOpen(true); setSettingsMessage('') }}>
                  <Icon name="settings" size={18} />
                  <span>{t('settings')}</span>
                </button>
                {renderAboutUsControl()}
                {renderPrivacyControl()}
              </div>
            )}
          </div>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div id="dashboard-mobile-menu" className="absolute top-full right-0 w-full bg-white dark:bg-gray-900 p-4 shadow-lg z-[100] flex flex-col gap-4 md:hidden mobile-header-dropdown">
            {renderLanguageControl(mobileLanguageMenuRef)}
            {renderRoleControl()}
            {renderProfileControl()}
            {renderAboutUsControl()}
            {renderPrivacyControl()}
          </div>
        )}
      </header>

      <div className="dashboard-content w-full min-w-0 max-w-full md:max-w-7xl mx-auto px-4 md:px-8 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white" style={isWideDesktop ? { width: 'min(calc(100% - 96px), 1280px)', maxWidth: '1280px', marginInline: 'auto', paddingInline: '32px' } : undefined}>
        <AIChat isWideDesktop={isWideDesktop} />
        {activeView === 'home' ? <>
        <section className="dashboard-greeting">
          <div>
            <p className="dashboard-kicker">{t('dashboardEyebrow')}</p>
            <h1>{t('hello')} {name.trim() || t('farmer')}</h1>
            <p>{t('dashboardIntro')}</p>
          </div>
        </section>

        <section className={`weather-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700 weather-card--${weatherTheme}${heatStress ? ' weather-card--alert' : ''}`} aria-labelledby="weather-heading">
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
            <div className="weather-error" role="status">
              <Icon name="cloud" size={21} />
              <p className="weather-error-message">{weatherErrorMessage}</p>
              <button type="button" onClick={retryWeather}>{t('retry')}</button>
            </div>
          )}
        </section>

        <DiagnosisHub />

        <section className="guidelines-section bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700" aria-labelledby="guidelines-heading">
          <button
            className="guidelines-accordion-trigger dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
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
          {guidelinesExpanded && <div className="guideline-grid dark:text-gray-100" id="guidelines-accordion-content">
            {guidelinesData.map((guideline) => (
              <article className="guideline-card dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700" key={guideline.id}>
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
          <Suspense fallback={<div className="p-4 text-center">{t('loadingMap')}</div>}>
            <EpidemiologyMap />
          </Suspense>
        ) : activeView === 'data' ? <DataHub onContributionSubmitted={() => { setPoints((previousPoints) => previousPoints + 10); setPointsToast(true) }} /> : activeView === 'history' ? <ClinicalLog /> : activeView === 'team' ? <TeamPage /> : activeView === 'telemedicine' ? <Telemedicine /> : (
          <Suspense fallback={<div className="p-4 text-center">{t('loadingMap')}</div>}>
            <EpidemiologyMap />
          </Suspense>
        )}
      </div>
      {pointsToast && <div className="points-toast" role="status">+10 Point earned for your contribution!</div>}

      <nav className="bottom-navigation w-full md:max-w-7xl mx-auto" aria-label={t('featureNavigation')} style={isWideDesktop ? { display: 'flex', width: '100vw', maxWidth: 'none', boxSizing: 'border-box', left: '50%', right: 'auto', transform: 'translateX(-50%)' } : undefined}>
        <div className="bottom-navigation-items flex w-full justify-between items-center px-2 md:px-8" style={isWideDesktop ? { display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', paddingInline: '32px' } : undefined}>
          {[
            ['home', 'home', 'bottomHome'],
            ['map', 'map', 'bottomMap'],
            ['history', 'clipboard', 'clinicalHistoryNav'],
            ['data', 'brain', 'bottomContribute'],
            ['telemedicine', 'stethoscope', 'consultVetNav'],
          ].map(([view, icon, label]) => (
            <button type="button" key={view} aria-current={activeView === view ? 'page' : undefined} className={`flex-1 flex flex-col items-center justify-center min-w-[70px] md:min-w-[100px] text-center${activeView === view ? ' active' : ''}`} onClick={() => setActiveView(view)} style={isWideDesktop ? { display: 'flex', flex: '1 1 0', minWidth: '100px', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' } : undefined}>
              <Icon name={icon} size={19} /><span className="text-xs md:text-base font-medium" style={isWideDesktop ? { maxWidth: 'none', overflow: 'visible', textOverflow: 'clip', whiteSpace: 'nowrap', fontSize: '16px', fontWeight: 500 } : undefined}>{t(label)}</span>
            </button>
          ))}
        </div>
      </nav>

      {settingsOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false) }}>
          <section className="settings-modal fixed bottom-0 left-0 z-50 w-full max-h-[90vh] overflow-y-auto rounded-t-2xl shadow-lg lg:relative lg:inset-auto lg:z-auto lg:w-[min(100%,560px)] lg:max-h-[min(90vh,850px)] lg:overflow-hidden lg:rounded-2xl lg:shadow-[0_25px_80px_rgba(18,43,25,0.23)] bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="settings-header">
              <div><p>{t('settingsEyebrow')}</p><h2 id="settings-title">{t('settings')}</h2></div>
              <button className="icon-button modal-close" type="button" aria-label={t('close')} onClick={() => setSettingsOpen(false)}><Icon name="close" size={20} /></button>
            </div>
            <div className="settings-body">
              <section className="settings-block dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
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
          <section className="sos-modal bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700" role="dialog" aria-modal="true" aria-labelledby="sos-title">
            <button className="icon-button modal-close" type="button" aria-label={t('close')} onClick={() => setSosOpen(false)}><Icon name="close" size={20} /></button>
            <span className="sos-modal-icon"><Icon name="alert" size={25} /></span>
            <h2 id="sos-title">{t('emergencySos')}</h2>
            <p>{t('sosInstructions')}</p>
            <button className="save-profile-button" type="button" onClick={() => setSosOpen(false)}>{t('understood')}</button>
          </section>
        </div>
      )}
    </main>
  )
}

function BrandFooter() {
  return <span className="dashboard-footer-brand"><img className="dashboard-footer-brand-mark" src="/images/logo.png" alt="" /> Poultry<span>Medix</span></span>
}

export default Dashboard
