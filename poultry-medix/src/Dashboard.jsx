import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronsDownUp, ChevronsUpDown, Globe, Menu, X } from 'lucide-react'
import AIChat from './AIChat.jsx'
import DiagnosisHub from './DiagnosisHub.jsx'
import { supabase } from './lib/supabase.js'
import { useLanguage } from './context/useLanguage.js'
import Icon from './components/Icon.jsx'
import DataHub from './veterinary/DataHub.jsx'
import TeamPage from './veterinary/TeamPage.jsx'
import PrivacyPolicy from './veterinary/PrivacyPolicy.jsx'
import ClinicalLog from './veterinary/ClinicalLog.jsx'
import Telemedicine from './veterinary/Telemedicine.jsx'
import ShedFlockManager from './veterinary/ShedFlockManager.jsx'
import VaccineScheduleTracker from './veterinary/VaccineScheduleTracker.jsx'
import EthicalCareBar from './veterinary/EthicalCareBar.jsx'
import UloDirectoryModal from './veterinary/UloDirectoryModal.jsx'
import {
  POULTRYMEDIX_OPEN_TELEMEDICINE_EVENT,
  POULTRYMEDIX_OPEN_ULO_EVENT,
} from './lib/uloDirectory.js'
import { POULTRYMEDIX_ROOMS_UPDATED_EVENT } from './lib/telehealthNotifier.js'
import { CLINICAL_LOGS_UPDATED_EVENT } from './lib/clinicalLogsStore.js'
import { getSheds, evaluateAllSheds, POULTRYMEDIX_SHEDS_UPDATED_EVENT } from './lib/shedManager.js'
import { POULTRYMEDIX_VACCINES_UPDATED_EVENT } from './lib/vaccineManager.js'
import {
  POULTRYMEDIX_SEMINARS_CHANNEL,
  POULTRYMEDIX_SEMINARS_UPDATED_EVENT,
  getFreeSeminars,
} from './lib/seminarStore.js'
import {
  POULTRYMEDIX_NOTIFICATIONS_READ_EVENT,
  buildAppNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './lib/notificationsEngine.js'
import {
  POULTRYMEDIX_POINTS_UPDATED_EVENT,
  formatPointsValue,
  getPointsHistory,
  getPointsTotal,
} from './lib/pointsStore.js'
import ThemeToggle from './components/ThemeToggle.jsx'
import { USER_ROLES, useUser } from './context/user-context.js'
import './Dashboard.css'
import './VeterinaryFeatures.css'

const EpidemiologyMap = React.lazy(() => import('./veterinary/EpidemiologyMap.jsx'))
const FarmBlueprint = React.lazy(() => import('./veterinary/FarmBlueprint.jsx'))
const FreeSeminarHub = React.lazy(() => import('./veterinary/FreeSeminarHub.jsx'))

const guidelinesData = [
  {
    id: 1,
    title: 'Respiratory health',
    titleBn: 'শ্বাসতন্ত্রের স্বাস্থ্য',
    description: 'Observe breathing, coughing, nasal discharge, and changes in flock activity. Record when signs began and how many birds are affected. Improve ventilation and reduce dust while arranging an assessment by a veterinarian. Do not start antibiotics without a diagnosis and prescription.',
    descriptionBn: 'শ্বাস-প্রশ্বাস, কাশি, নাক দিয়ে স্রাব এবং পালের সক্রিয়তার পরিবর্তন লক্ষ্য করুন। লক্ষণ কখন শুরু হয়েছে এবং কতটি পাখি আক্রান্ত তা লিখে রাখুন। পশুচিকিৎসকের মূল্যায়নের ব্যবস্থা করার সময় বায়ু চলাচল উন্নত করুন এবং ধুলা কমান। রোগ নির্ণয় ও প্রেসক্রিপশন ছাড়া অ্যান্টিবায়োটিক শুরু করবেন না।',
    images: [],
  },
  {
    id: 2,
    title: 'Digestive health',
    titleBn: 'পরিপাকতন্ত্রের স্বাস্থ্য',
    description: 'Track feed and water intake, droppings, and the number of birds showing signs. Keep clean water available and separate visibly unwell birds when safe to do so. Share the timeline and any recent feed or management changes with your veterinarian.',
    descriptionBn: 'খাদ্য ও পানির গ্রহণ, বিষ্ঠা এবং লক্ষণযুক্ত পাখির সংখ্যা নথিভুক্ত করুন। পরিষ্কার পানি দিন এবং নিরাপদ হলে অসুস্থ পাখিকে আলাদা রাখুন। সময়রেখা এবং খাদ্য বা ব্যবস্থাপনায় সাম্প্রতিক পরিবর্তনের তথ্য পশুচিকিৎসককে জানান।',
    images: [],
  },
  {
    id: 3,
    title: 'Prevention & biosecurity',
    titleBn: 'প্রতিরোধ ও জৈব-নিরাপত্তা',
    description: 'Limit unnecessary visitors, clean and disinfect equipment between groups, and protect feed and water from contamination. Follow local vaccination and farm biosecurity plans with veterinary guidance, and report unusual illness or mortality promptly.',
    descriptionBn: 'অপ্রয়োজনীয় দর্শনার্থী সীমিত করুন, এক দল থেকে অন্য দলে যাওয়ার আগে সরঞ্জাম পরিষ্কার ও জীবাণুমুক্ত করুন এবং খাদ্য ও পানি দূষণ থেকে রক্ষা করুন। পশুচিকিৎসকের নির্দেশনায় স্থানীয় টিকাদান ও খামারের জৈব-নিরাপত্তা পরিকল্পনা অনুসরণ করুন এবং অস্বাভাবিক অসুস্থতা বা মৃত্যুর খবর দ্রুত জানান।',
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
  const [showNotificationsPopup, setShowNotificationsPopup] = useState(false)
  const [notificationFilter, setNotificationFilter] = useState('all')
  const [selectedSeminarId, setSelectedSeminarId] = useState('')
  const [freeSeminars, setFreeSeminars] = useState(() => getFreeSeminars())
  const [notifRevision, setNotifRevision] = useState(0)
  const [notifNowMs, setNotifNowMs] = useState(() => Date.now())
  const languageMenuRef = useRef(null)
  const mobileLanguageMenuRef = useRef(null)
  const headerRef = useRef(null)
  const pointsPopupRef = useRef(null)
  const notificationsPopupRef = useRef(null)
  const hasGeolocation = typeof navigator !== 'undefined' && Boolean(navigator.geolocation)
  const canFetchWeather = Boolean(hasGeolocation && openWeatherApiKey)
  const [weather, setWeather] = useState(null)
  const [weatherError, setWeatherError] = useState('')
  const [weatherLoadingState, setWeatherLoading] = useState(() => canFetchWeather)
  const [weatherRefresh, setWeatherRefresh] = useState(0)
  const weatherLoading = Boolean(canFetchWeather && weatherLoadingState)
  const weatherErrorMessage = !hasGeolocation
      ? t('geoUnavailable')
      : !openWeatherApiKey
        ? t('weatherKeyMissing')
        : weatherError
          ? t(weatherError)
          : ''
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileAction, setProfileAction] = useState('')
  const [sosOpen, setSosOpen] = useState(false)
  const [uloModalOpen, setUloModalOpen] = useState(false)
  const [uloDistrict, setUloDistrict] = useState('')

  function openSettingsModal() {
    setProfileAction('')
    setSosOpen(false)
    setUloModalOpen(false)
    setSettingsMessage('')
    setSettingsOpen(true)
  }

  function openProfileActionModal(action) {
    setSettingsOpen(false)
    setSosOpen(false)
    setUloModalOpen(false)
    setProfileAction(action)
  }

  const [activeView, setActiveView] = useState(() => {
    if (typeof window === 'undefined') return 'home'
    const params = new URLSearchParams(window.location.search)
    if (!params.get('pmx_session')) return 'home'
    try {
      const pendingRaw = window.sessionStorage.getItem('poultrymedix_pending_booking_v1')
      const pending = pendingRaw ? JSON.parse(pendingRaw) : null
      return pending?.returnView === 'blueprint' ? 'blueprint' : 'telemedicine'
    } catch {
      return 'telemedicine'
    }
  })

  function openSosModal() {
    setSettingsOpen(false)
    setProfileAction('')
    setUloModalOpen(false)
    setSosOpen(true)
  }

  useEffect(() => {
    function handleOpenTelemedicine() {
      setSettingsOpen(false)
      setProfileAction('')
      setSosOpen(false)
      setUloModalOpen(false)
      setActiveView('telemedicine')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    function handleOpenUlo(event) {
      setSettingsOpen(false)
      setProfileAction('')
      setSosOpen(false)
      setUloDistrict(event?.detail?.district || '')
      setUloModalOpen(true)
    }
    window.addEventListener(POULTRYMEDIX_OPEN_TELEMEDICINE_EVENT, handleOpenTelemedicine)
    window.addEventListener(POULTRYMEDIX_OPEN_ULO_EVENT, handleOpenUlo)
    return () => {
      window.removeEventListener(POULTRYMEDIX_OPEN_TELEMEDICINE_EVENT, handleOpenTelemedicine)
      window.removeEventListener(POULTRYMEDIX_OPEN_ULO_EVENT, handleOpenUlo)
    }
  }, [])
  const [points, setPoints] = useState(() => getPointsTotal())
  const [pointsHistory, setPointsHistory] = useState(() => getPointsHistory())
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
  const [openSections, setOpenSections] = useState({
    diagnosis: true,
    prescription: false,
    sheds: false,
    vaccines: false,
  })
  const [sheds, setSheds] = useState(() => getSheds())

  const allHomeExpanded = openSections.diagnosis
    && openSections.prescription
    && openSections.sheds
    && openSections.vaccines
    && guidelinesExpanded

  const openSectionCount = [
    openSections.diagnosis,
    openSections.prescription,
    openSections.sheds,
    openSections.vaccines,
    guidelinesExpanded,
  ].filter(Boolean).length

  function toggleSection(sectionKey) {
    setOpenSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }))
  }

  function toggleAllHomeSections() {
    const next = !allHomeExpanded
    setOpenSections({
      diagnosis: next,
      prescription: next,
      sheds: next,
      vaccines: next,
    })
    setGuidelinesExpanded(next)
  }

  function openHeatStressSection() {
    setOpenSections((prev) => ({ ...prev, sheds: true }))
    requestAnimationFrame(() => {
      document.getElementById('shed-flock-manager')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  useEffect(() => {
    function syncSheds() {
      setSheds(getSheds())
      setNotifNowMs(Date.now())
      setNotifRevision((r) => r + 1)
    }
    function syncNotificationsAndSeminars() {
      setFreeSeminars(getFreeSeminars())
      setNotifNowMs(Date.now())
      setNotifRevision((r) => r + 1)
    }
    window.addEventListener(POULTRYMEDIX_SHEDS_UPDATED_EVENT, syncSheds)
    window.addEventListener(POULTRYMEDIX_VACCINES_UPDATED_EVENT, syncNotificationsAndSeminars)
    window.addEventListener(POULTRYMEDIX_ROOMS_UPDATED_EVENT, syncNotificationsAndSeminars)
    window.addEventListener(CLINICAL_LOGS_UPDATED_EVENT, syncNotificationsAndSeminars)
    window.addEventListener(POULTRYMEDIX_SEMINARS_UPDATED_EVENT, syncNotificationsAndSeminars)
    window.addEventListener(POULTRYMEDIX_NOTIFICATIONS_READ_EVENT, syncNotificationsAndSeminars)
    window.addEventListener('storage', syncSheds)

    let seminarChannel = null
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      seminarChannel = new BroadcastChannel(POULTRYMEDIX_SEMINARS_CHANNEL)
      seminarChannel.onmessage = syncNotificationsAndSeminars
    }
    const tick = window.setInterval(() => setNotifNowMs(Date.now()), 30000)

    return () => {
      if (seminarChannel) seminarChannel.close()
      window.clearInterval(tick)
      window.removeEventListener(POULTRYMEDIX_SHEDS_UPDATED_EVENT, syncSheds)
      window.removeEventListener(POULTRYMEDIX_VACCINES_UPDATED_EVENT, syncNotificationsAndSeminars)
      window.removeEventListener(POULTRYMEDIX_ROOMS_UPDATED_EVENT, syncNotificationsAndSeminars)
      window.removeEventListener(CLINICAL_LOGS_UPDATED_EVENT, syncNotificationsAndSeminars)
      window.removeEventListener(POULTRYMEDIX_SEMINARS_UPDATED_EVENT, syncNotificationsAndSeminars)
      window.removeEventListener(POULTRYMEDIX_NOTIFICATIONS_READ_EVENT, syncNotificationsAndSeminars)
      window.removeEventListener('storage', syncSheds)
    }
  }, [])

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
    if (!showPointsPopup && !showNotificationsPopup) return undefined

    function closePopupsOnOutsideClick(event) {
      if (showPointsPopup && pointsPopupRef.current && !pointsPopupRef.current.contains(event.target)) {
        setShowPointsPopup(false)
      }
      if (showNotificationsPopup && notificationsPopupRef.current && !notificationsPopupRef.current.contains(event.target)) {
        setShowNotificationsPopup(false)
      }
    }

    function closePopupsOnEscape(event) {
      if (event.key === 'Escape') {
        setShowPointsPopup(false)
        setShowNotificationsPopup(false)
      }
    }

    document.addEventListener('mousedown', closePopupsOnOutsideClick)
    document.addEventListener('keydown', closePopupsOnEscape)
    return () => {
      document.removeEventListener('mousedown', closePopupsOnOutsideClick)
      document.removeEventListener('keydown', closePopupsOnEscape)
    }
  }, [showPointsPopup, showNotificationsPopup])

  useEffect(() => {
    if (!shareMessage) return undefined
    const timeout = window.setTimeout(() => setShareMessage(''), 3000)
    return () => window.clearTimeout(timeout)
  }, [shareMessage])

  useEffect(() => {
    if (!pointsToast) return undefined
    const timeout = window.setTimeout(() => setPointsToast(false), 3000)
    return () => window.clearTimeout(timeout)
  }, [pointsToast])

  useEffect(() => {
    function handlePointsUpdate(event) {
      setPoints(event?.detail?.total ?? getPointsTotal())
      setPointsHistory(event?.detail?.history ?? getPointsHistory())
      setPointsToast(true)
    }

    function handleStorageSync(event) {
      if (!event?.key || event.key.startsWith('poultrymedix_points_')) {
        setPoints(getPointsTotal())
        setPointsHistory(getPointsHistory())
      }
    }

    window.addEventListener(POULTRYMEDIX_POINTS_UPDATED_EVENT, handlePointsUpdate)
    window.addEventListener('storage', handleStorageSync)
    return () => {
      window.removeEventListener(POULTRYMEDIX_POINTS_UPDATED_EVENT, handlePointsUpdate)
      window.removeEventListener('storage', handleStorageSync)
    }
  }, [])

  useEffect(() => {
    if (!canFetchWeather) return undefined
    let active = true

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
  }, [canFetchWeather, language, t, weatherRefresh])

  useEffect(() => {
    if (!settingsOpen && !sosOpen && !profileAction) return undefined
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setSettingsOpen(false)
        setSosOpen(false)
        setProfileAction('')
      }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [settingsOpen, sosOpen, profileAction])

  const shedThermalSummary = sheds.length > 0 && weather
    ? evaluateAllSheds(sheds, weather.temperature, weather.humidity)
    : null

  const fallbackHeatStress = weather && (
    weather.temperature >= 35
    || (weather.temperature >= 30 && weather.humidity >= 70)
    || weather.feelsLike >= 36
  )
  const heatStress = shedThermalSummary
    ? shedThermalSummary.activeAlerts.length > 0
    : fallbackHeatStress
  const weatherTheme = weather?.theme || 'sunny'

  const appNotifications = useMemo(() => {
    void notifRevision
    return buildAppNotifications({
      weather,
      heatStress,
      shedThermalSummary,
      sheds,
      dailyTipsEnabled,
      noticesEnabled,
      freeSeminars,
      language,
      nowMs: notifNowMs,
    })
  }, [notifRevision, weather, heatStress, shedThermalSummary, sheds, dailyTipsEnabled, noticesEnabled, freeSeminars, language, notifNowMs])

  const unreadNotificationsCount = useMemo(
    () => appNotifications.filter((n) => !n.isRead).length,
    [appNotifications]
  )

  const filteredNotifications = useMemo(() => {
    if (notificationFilter === 'all') return appNotifications
    if (notificationFilter === 'alerts') {
      return appNotifications.filter((n) => n.category === 'heat_stress' || n.category === 'vaccine')
    }
    if (notificationFilter === 'telemedicine') {
      return appNotifications.filter((n) => n.category === 'telemedicine')
    }
    return appNotifications.filter((n) => n.category === 'seminar' || n.category === 'daily_tip')
  }, [appNotifications, notificationFilter])

  function handleOpenNotification(item) {
    markNotificationRead(item.id)
    setShowNotificationsPopup(false)
    if (item.targetView === 'seminars') {
      setSelectedSeminarId(item.seminarId || '')
      setActiveView('seminars')
      return
    }
    if (item.targetView === 'telemedicine') {
      setActiveView('telemedicine')
      return
    }
    setActiveView('home')
    if (item.targetSection === 'sheds') {
      setOpenSections((prev) => ({ ...prev, sheds: true }))
      requestAnimationFrame(() => {
        document.getElementById('shed-flock-manager')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } else if (item.targetSection === 'vaccines') {
      setOpenSections((prev) => ({ ...prev, vaccines: true }))
      requestAnimationFrame(() => {
        document.getElementById('home-vaccines-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } else if (item.targetSection === 'notices') {
      requestAnimationFrame(() => {
        document.getElementById('notices-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }

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
      setSettingsOpen(true)
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
            ['en', 'English'],
            ['bn', 'বাংলা'],
          ].map(([code, label]) => (
            <button className={`${language === code ? 'active' : ''} dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700`} type="button" role="menuitem" key={code} onClick={() => { setLanguage(code); setLanguageMenuOpen(false) }}>
              {label}
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
    <button className="mobile-profile-control" type="button" onClick={() => { setIsMobileMenuOpen(false); openSettingsModal() }} aria-label={t('profileSettings')}>
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
      <span>{t('aboutUs')}</span>
    </button>
  )

  const renderPrivacyControl = () => (
    <button className="header-menu-item" type="button" onClick={() => { setIsMobileMenuOpen(false); setDesktopProfileMenuOpen(false); setActiveView('privacy') }}>
      <Icon name="shield" size={18} />
      <span>{t('privacySecurity')}</span>
    </button>
  )

  const closeProfileMenus = () => {
    setIsMobileMenuOpen(false)
    setDesktopProfileMenuOpen(false)
  }

  const renderProfileActions = () => <>
    <button className="header-menu-item" type="button" role="menuitem" onClick={() => { closeProfileMenus(); openProfileActionModal('manual') }}>
      <Icon name="book" size={18} />
      <span>{t('userManual')}</span>
    </button>
    <button className="header-menu-item" type="button" role="menuitem" onClick={() => { closeProfileMenus(); shareApp() }}>
      <Icon name="share" size={18} />
      <span>{t('shareApp')}</span>
    </button>
    <button className="header-menu-item" type="button" role="menuitem" onClick={() => { closeProfileMenus(); openProfileActionModal('feedback') }}>
      <Icon name="message" size={18} />
      <span>{t('feedbackTitle')}</span>
    </button>
    <button className="header-menu-item" type="button" role="menuitem" onClick={() => { closeProfileMenus(); logout() }}>
      <Icon name="logout" size={18} />
      <span>{t('signOut')}</span>
    </button>
  </>

  return (
    <main className="dashboard-shell w-full min-w-0 max-w-full md:text-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <header className={`dashboard-header bg-white dark:bg-gray-900 text-gray-900 dark:text-white dark:border-gray-700${isMobileMenuOpen || showPointsPopup || showNotificationsPopup ? ' is-mobile-menu-open' : ''}`} ref={headerRef}>
        <a className="dashboard-brand" href="#dashboard" aria-label={t('brand')} onClick={() => setActiveView('home')}>
          <img className="dashboard-brand-mark" src="/images/logo.png" alt="" />
          <span>Poultry<span>Medix</span></span>
        </a>
        <div className="dashboard-header-actions flex items-center gap-4">
          <div className="header-points-wrap" ref={pointsPopupRef}>
            <button
              className="header-star-trigger"
              type="button"
              title={`${formatPointsValue(points)} ${t('points')}`}
              aria-label={`${t('points')}: ${formatPointsValue(points)}`}
              aria-expanded={showPointsPopup}
              aria-haspopup="dialog"
              onClick={() => { setIsMobileMenuOpen(false); setLanguageMenuOpen(false); setDesktopProfileMenuOpen(false); setShowNotificationsPopup(false); setShowPointsPopup((current) => !current) }}
            >
              <Icon name="star" size={18} />
            </button>
            {showPointsPopup && (
              <div className="points-popover dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" role="dialog" aria-label={t('pointsSummaryTitle')}>
                <div className="points-popover-header">
                  <div className="points-popover-balance">
                    <span className="points-popover-star" aria-hidden="true"><Icon name="star" size={16} /></span>
                    <div>
                      <span className="points-popover-label">{t('pointsSummaryTitle')}</span>
                      <strong>{formatPointsValue(points)} <span>{t('points')}</span></strong>
                    </div>
                  </div>
                  <button
                    className="points-popover-close"
                    type="button"
                    aria-label={t('close')}
                    onClick={() => setShowPointsPopup(false)}
                  >
                    <Icon name="close" size={15} />
                  </button>
                </div>
                <p className="points-popover-rate">{t('pointsRateNote')}</p>
                <div className="points-popover-history">
                  <h4>{t('pointsHistoryHeading')}</h4>
                  {pointsHistory.length === 0 ? (
                    <p className="points-popover-empty">{t('pointsEmptyNote')}</p>
                  ) : (
                    <ul>
                      {pointsHistory.slice(0, 5).map((entry) => (
                        <li key={entry.id}>
                          <div>
                            <strong>{entry.title || t('bottomContribute')}</strong>
                            {entry.detail && <small>{entry.detail}</small>}
                          </div>
                          <span className="points-entry-badge">+{entry.points}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="points-popover-actions">
                  <button
                    type="button"
                    className="points-action-primary"
                    onClick={() => { setShowPointsPopup(false); setActiveView('data') }}
                  >
                    <Icon name="brain" size={14} />
                    <span>{t('pointsGoContributeBtn')}</span>
                  </button>
                  <button
                    type="button"
                    className="points-action-secondary"
                    onClick={() => { setShowPointsPopup(false); setActiveView('map') }}
                  >
                    <Icon name="map" size={14} />
                    <span>{t('pointsGoSurveillanceBtn')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="header-points-wrap" ref={notificationsPopupRef}>
            <button
              className="header-bell-trigger"
              type="button"
              title={t('notificationsCenterTitle')}
              aria-label={`${t('notificationsCenterTitle')} (${unreadNotificationsCount})`}
              aria-expanded={showNotificationsPopup}
              aria-haspopup="dialog"
              onClick={() => { setIsMobileMenuOpen(false); setLanguageMenuOpen(false); setDesktopProfileMenuOpen(false); setShowPointsPopup(false); setShowNotificationsPopup((current) => !current) }}
            >
              <Icon name="bell" size={18} />
              {unreadNotificationsCount > 0 && (
                <span className="header-bell-badge" aria-hidden="true">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>
            {showNotificationsPopup && (
              <div className="notifications-popover dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" role="dialog" aria-label={t('notificationsCenterTitle')}>
                <div className="points-popover-header">
                  <div>
                    <span className="points-popover-label">{t('notificationsCenterTitle')}</span>
                    <strong className="notifications-count-sub">
                      {unreadNotificationsCount > 0
                        ? t('notificationsUnreadCount', { count: unreadNotificationsCount })
                        : t('notificationsAllCaughtUp')}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {unreadNotificationsCount > 0 && (
                      <button
                        type="button"
                        className="notifications-mark-read-btn"
                        onClick={() => markAllNotificationsRead(appNotifications.map((n) => n.id))}
                      >
                        {t('notificationsMarkAllRead')}
                      </button>
                    )}
                    <button
                      className="points-popover-close"
                      type="button"
                      aria-label={t('close')}
                      onClick={() => setShowNotificationsPopup(false)}
                    >
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                </div>

                <div className="notifications-filter-row" role="tablist" aria-label={t('notificationsCenterTitle')}>
                  {[
                    ['all', 'notifFilterAll'],
                    ['alerts', 'notifFilterAlerts'],
                    ['telemedicine', 'notifFilterTelemedicine'],
                    ['seminars', 'notifFilterSeminars'],
                  ].map(([fKey, labelKey]) => (
                    <button
                      key={fKey}
                      type="button"
                      role="tab"
                      aria-selected={notificationFilter === fKey}
                      className={notificationFilter === fKey ? 'is-active' : undefined}
                      onClick={() => setNotificationFilter(fKey)}
                    >
                      {t(labelKey)}
                    </button>
                  ))}
                </div>

                <div className="notifications-list-scroll">
                  {filteredNotifications.length === 0 ? (
                    <p className="points-popover-empty">{t('notificationsEmpty')}</p>
                  ) : (
                    <ul>
                      {filteredNotifications.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={`notifications-item-btn is-${item.severity}${item.isRead ? ' is-read' : ''}`}
                            onClick={() => handleOpenNotification(item)}
                          >
                            <div className="notifications-item-top">
                              <span className={`notifications-cat-pill is-${item.category}`}>
                                {t(`notifCategoryLabels.${item.category}`, item.category)}
                              </span>
                              <small>{item.meta}</small>
                            </div>
                            <strong>{item.title}</strong>
                            <p>{item.body}</p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="notifications-popover-footer">
                  <button
                    type="button"
                    className="points-action-primary"
                    style={{ width: '100%' }}
                    onClick={() => { setShowNotificationsPopup(false); setActiveView('seminars') }}
                  >
                    <Icon name="graduationCap" size={15} />
                    <span>{t('notificationsOpenFreeSeminarsBtn')}</span>
                  </button>
                </div>
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
            onClick={() => { setShowPointsPopup(false); setShowNotificationsPopup(false); setIsMobileMenuOpen((current) => !current) }}
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
                <button className="header-menu-item" type="button" role="menuitem" onClick={() => { setDesktopProfileMenuOpen(false); openSettingsModal() }}>
                  <Icon name="settings" size={18} />
                  <span>{t('settings')}</span>
                </button>
                {renderAboutUsControl()}
                {renderPrivacyControl()}
                {renderProfileActions()}
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
            {renderProfileActions()}
          </div>
        )}
      </header>

      <div className="dashboard-content w-full min-w-0 max-w-full md:max-w-7xl mx-auto px-4 md:px-8 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white" style={isWideDesktop ? { width: 'min(calc(100% - 96px), 1280px)', maxWidth: '1280px', marginInline: 'auto', paddingInline: '32px' } : undefined}>
        <AIChat />
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
              <div
                className={`heat-alert heat-alert--clickable${heatStress ? ' heat-alert--high' : ''}`}
                role="button"
                tabIndex={0}
                onClick={openHeatStressSection}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openHeatStressSection()
                  }
                }}
                title={language === 'bn' ? 'শেড হিট-স্ট্রেস রিপোর্ট দেখতে ক্লিক করুন' : 'Click to open Shed Heat-Stress Report'}
              >
                <Icon name={heatStress ? 'alert' : 'thermometer'} size={17} />
                {shedThermalSummary ? (
                  <>
                    <span>
                      <strong>
                        {heatStress
                          ? (language === 'bn'
                            ? `${shedThermalSummary.activeAlerts.length}টি শেডে তাপ-পীড়ন সতর্কতা (${shedThermalSummary.highestReport?.shed?.name})`
                            : `${shedThermalSummary.activeAlerts.length} Shed Alert${shedThermalSummary.activeAlerts.length > 1 ? 's' : ''} (${shedThermalSummary.highestReport?.shed?.name})`)
                          : shedThermalSummary.broodingHeatAlerts.length > 0
                          ? (language === 'bn'
                            ? `${shedThermalSummary.broodingHeatAlerts.length}টি শেডে ব্রুডিং তাপ প্রয়োজন`
                            : `${shedThermalSummary.broodingHeatAlerts.length} Shed${shedThermalSummary.broodingHeatAlerts.length > 1 ? 's' : ''} Need Brooding Heat`)
                          : (language === 'bn'
                            ? `সব ${sheds.length}টি শেড আদর্শ তাপমাত্রায় আছে`
                            : `All ${sheds.length} Shed${sheds.length > 1 ? 's' : ''} Within Comfort Targets`)}
                      </strong>
                      <small>
                        {language === 'bn'
                          ? shedThermalSummary.highestReport?.adviceBn
                          : shedThermalSummary.highestReport?.adviceEn}
                      </small>
                    </span>
                    <span className="heat-badge">
                      {language === 'bn'
                        ? shedThermalSummary.highestReport?.severityLabelBn
                        : shedThermalSummary.highestReport?.severityLabelEn}
                    </span>
                  </>
                ) : (
                  <>
                    <span><strong>{heatStress ? t('heatStressAlert') : t('heatStressCheck')}</strong><small>{heatStress ? t('heatStressAdvice') : t('heatStressNormal')}</small></span>
                    <span className="heat-badge">{heatStress ? t('attention') : t('normal')}</span>
                  </>
                )}
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

        <div className="home-accordion-toolbar" role="region" aria-label={language === 'bn' ? 'হোম সেকশন নিয়ন্ত্রণ' : 'Home sections controls'}>
          <div className="home-accordion-toolbar-meta">
            <span>{language === 'bn' ? 'হোম সেকশনসমূহ' : 'Home Sections'}</span>
            <span className="home-open-count-pill">
              {language === 'bn' ? `${openSectionCount}/৫ খোলা` : `${openSectionCount}/5 Open`}
            </span>
          </div>
          <button
            type="button"
            className="home-expand-all-btn"
            onClick={toggleAllHomeSections}
          >
            {allHomeExpanded ? <ChevronsDownUp size={15} aria-hidden="true" /> : <ChevronsUpDown size={15} aria-hidden="true" />}
            <span>
              {allHomeExpanded
                ? (language === 'bn' ? 'সবগুলো বন্ধ করুন' : 'Collapse All')
                : (language === 'bn' ? 'সবগুলো খুলুন' : 'Expand All')}
            </span>
          </button>
        </div>

        <DiagnosisHub
          smartOpen={openSections.diagnosis}
          onToggleSmart={() => toggleSection('diagnosis')}
          prescriptionOpen={openSections.prescription}
          onTogglePrescription={() => toggleSection('prescription')}
        />

        <ShedFlockManager
          weather={weather}
          isOpen={openSections.sheds}
          onToggle={() => toggleSection('sheds')}
        />

        <div id="home-vaccines-section">
          <VaccineScheduleTracker
            isOpen={openSections.vaccines}
            onToggle={() => toggleSection('vaccines')}
          />
        </div>

        <section className="home-free-seminar-banner dark:bg-gray-800 dark:border-gray-700">
          <div className="home-free-seminar-copy">
            <span className="seminar-free-badge">{language === 'bn' ? '১০০% ফ্রি · সবার জন্য উন্মুক্ত' : '100% FREE · OPEN ACCESS'}</span>
            <h3>{t('homeSeminarBannerTitle')}</h3>
            <p>{t('homeSeminarBannerDesc')}</p>
          </div>
          <button
            type="button"
            className="pmx-primary-submit-btn"
            onClick={() => setActiveView('seminars')}
          >
            <Icon name="graduationCap" size={16} />
            <span>{t('homeSeminarBannerBtn')}</span>
          </button>
        </section>

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
                  <h3>{guideline[`title${language === 'bn' ? 'Bn' : ''}`]}</h3>
                  <p>{guideline[`description${language === 'bn' ? 'Bn' : ''}`]}</p>
                  {guideline.images.length > 0 && (
                    <div className="guideline-image-grid">
                      {guideline.images.map((imagePath) => <img key={imagePath} src={imagePath} alt={guideline[`title${language === 'bn' ? 'Bn' : ''}`]} />)}
                    </div>
                  )}
                  <EthicalCareBar
                    compact
                    prefillConcern={guideline[`title${language === 'bn' ? 'Bn' : ''}`]}
                  />
                </div>
              </article>
            ))}
          </div>}
        </section>

        <section className="notices-section" aria-labelledby="notices-heading">
          <div className="section-heading notices-heading">
            <div><span className="section-icon section-icon--sun"><Icon name="bell" size={18} /></span><div><h2 id="notices-heading">{t('noticesTitle')}</h2><p>{t('noticesSubtitle')}</p></div></div>
          </div>
          <div className="notice-list">
            {notices.length ? notices.map(({ id, typeKey, titleKey, descriptionKey, dateKey }) => (
              <article className={`notice-item${id === 'colistin' ? ' notice-item--important' : ''}`} key={id}>
                <span className={`notice-symbol${id === 'colistin' ? ' notice-symbol--red' : ''}`}><Icon name={id === 'colistin' ? 'alert' : 'leaf'} size={17} /></span>
                <div className="notice-copy">
                  <span className="notice-type">{t(typeKey)}</span>
                  <h3>{t(titleKey)}</h3>
                  <p>{t(descriptionKey)}</p>
                </div>
                <time>{t(dateKey)}</time>
              </article>
            )) : <p className="empty-notices">{t('noNotices')}</p>}
          </div>
          <p className="notice-disclaimer">{t('noticeDisclaimer')}</p>
        </section>

        <button className="sos-button" type="button" onClick={openSosModal}>
          <span className="sos-symbol"><Icon name="sos" size={19} /></span>
          <span><strong>{t('emergencySos')}</strong><small>{t('emergencySubtitle')}</small></span>
          <Icon name="arrow" size={18} />
        </button>
        <footer className="dashboard-footer"><BrandFooter /> <span>{t('dashboardFooter')}</span></footer>
        </> : activeView === 'map' ? (
          <Suspense fallback={<div className="p-4 text-center">{t('loadingMap')}</div>}>
            <EpidemiologyMap />
          </Suspense>
        ) : activeView === 'data' ? <DataHub /> : activeView === 'history' ? <ClinicalLog /> : activeView === 'team' ? <TeamPage /> : activeView === 'privacy' ? <PrivacyPolicy /> : activeView === 'telemedicine' ? <Telemedicine /> : activeView === 'blueprint' ? (
          <Suspense fallback={<div className="p-4 text-center">{t('pleaseWait')}</div>}>
            <FarmBlueprint />
          </Suspense>
        ) : activeView === 'seminars' ? (
          <Suspense fallback={<div className="p-4 text-center">{t('pleaseWait')}</div>}>
            <FreeSeminarHub preselectedSeminarId={selectedSeminarId} />
          </Suspense>
        ) : (
          <Suspense fallback={<div className="p-4 text-center">{t('loadingMap')}</div>}>
            <EpidemiologyMap />
          </Suspense>
        )}
      </div>
      {pointsToast && <div className="points-toast" role="status">{t('pointsEarnedToast')}</div>}
      {shareMessage && <div className="points-toast" role="status">{shareMessage}</div>}

      <nav className="bottom-navigation" aria-label={t('featureNavigation')}>
        <div className="bottom-navigation-items">
          {[
            ['home', 'home', 'bottomHome'],
            ['map', 'map', 'bottomMap'],
            ['history', 'clipboard', 'clinicalHistoryNav'],
            ['data', 'brain', 'bottomContribute'],
            ['telemedicine', 'stethoscope', 'consultVetNav'],
            ['blueprint', 'blueprint', 'blueprintNav'],
            ['seminars', 'graduationCap', 'seminarsNav'],
          ].map(([view, icon, label]) => (
            <button
              type="button"
              key={view}
              aria-current={activeView === view ? 'page' : undefined}
              className={activeView === view ? 'active' : undefined}
              onClick={() => setActiveView(view)}
            >
              <Icon name={icon} size={19} />
              <span>{t(label)}</span>
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

              <section className="settings-block">
               <div className="settings-block-heading"><span className="settings-icon"><Icon name="globe" size={17} /></span><div><h3>{t('fontSize')}</h3><p>{t('fontSizeDescription')}</p></div></div>
               <label className="settings-label" htmlFor="font-size-range">
                 {t('fontSize')}: <strong>{fontSize}px</strong>
                 <input id="font-size-range" type="range" min="14" max="24" step="1" value={fontSize} onChange={updateFontSize} />
                 <span className="settings-range-labels"><span>14px</span><span>24px</span></span>
               </label>
               <label className="settings-label" htmlFor="font-family-select">
                 {t('fontStyleFamily')}
                 <select id="font-family-select" value={fontFamily} onChange={updateFontFamily}>
                   <option value="system">{t('fontDefaultSystem')}</option>
                   <option value="hind-siliguri">Hind Siliguri (English + বাংলা)</option>
                   <option value="noto-bengali">Noto Sans Bengali</option>
                   <option value="inter">Inter</option>
                   <option value="poppins">Poppins</option>
                 </select>
               </label>
              </section>

              <section className="settings-block">
                <div className="settings-block-heading"><span className="settings-icon"><Icon name="bell" size={17} /></span><div><h3>{t('notifications')}</h3><p>{t('notificationDescription')}</p></div></div>
                <div className="toggle-row"><span>{t('dailyTipsNotifications')}</span><button type="button" role="switch" aria-checked={dailyTipsEnabled} aria-label={t('dailyTipsNotifications')} className={`toggle-switch${dailyTipsEnabled ? ' is-on' : ''}`} onClick={() => saveNotification('tips', !dailyTipsEnabled)}><span /></button></div>
                <div className="toggle-row"><span>{t('noticeNotifications')}</span><button type="button" role="switch" aria-checked={noticesEnabled} aria-label={t('noticeNotifications')} className={`toggle-switch${noticesEnabled ? ' is-on' : ''}`} onClick={() => saveNotification('notices', !noticesEnabled)}><span /></button></div>
              </section>

            </div>
          </section>
        </div>
      )}

      {profileAction && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileAction('') }}>
          <section className="settings-modal fixed bottom-0 left-0 z-50 w-full max-h-[90vh] overflow-y-auto rounded-t-2xl shadow-lg lg:relative lg:inset-auto lg:z-auto lg:w-[min(100%,560px)] lg:max-h-[min(90vh,850px)] lg:overflow-hidden lg:rounded-2xl lg:shadow-[0_25px_80px_rgba(18,43,25,0.23)] bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700" role="dialog" aria-modal="true" aria-labelledby="profile-action-title">
            <div className="settings-header">
              <div><p>{t('settingsEyebrow')}</p><h2 id="profile-action-title">{profileAction === 'manual' ? t('userManual') : t('feedbackTitle')}</h2></div>
              <button className="icon-button modal-close" type="button" aria-label={t('close')} onClick={() => setProfileAction('')}><Icon name="close" size={20} /></button>
            </div>
            <div className="settings-body">
              {profileAction === 'manual' ? (
                <section className="settings-block manual-block">
                  <div className="settings-block-heading"><span className="settings-icon"><Icon name="book" size={17} /></span><div><h3>{t('userManual')}</h3><p>{t('manualDescription')}</p></div></div>
                  {['scannerManual', 'prescriptionManual', 'outbreakManual', 'dataHubManual', 'guidelinesManual'].map((key) => (
                    <details className="manual-item" key={key}><summary>{t(`${key}Title`)}<Icon name="chevron" size={16} /></summary><p>{t(key)}</p></details>
                  ))}
                </section>
              ) : (
                <section className="settings-block">
                  <div className="settings-block-heading"><span className="settings-icon"><Icon name="message" size={17} /></span><div><h3>{t('feedbackTitle')}</h3><p>{t('feedbackDescription')}</p></div></div>
                  <form className="feedback-form" onSubmit={submitFeedback}>
                    <textarea value={feedback} onChange={(event) => { setFeedback(event.target.value); setFeedbackSent(false) }} placeholder={t('feedbackPlaceholder')} rows="3" />
                    <button type="submit" disabled={!feedback.trim()}>{t('sendFeedback')}</button>
                  </form>
                  {feedbackSent && <p className="settings-feedback" role="status">{t('feedbackThanks')}</p>}
                </section>
              )}
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

      {uloModalOpen && (
        <UloDirectoryModal
          key={uloDistrict || 'all'}
          initialDistrict={uloDistrict}
          onClose={() => setUloModalOpen(false)}
        />
      )}
    </main>
  )
}

function BrandFooter() {
  return <span className="dashboard-footer-brand"><img className="dashboard-footer-brand-mark" src="/images/logo.png" alt="" /> Poultry<span>Medix</span></span>
}

export default Dashboard
