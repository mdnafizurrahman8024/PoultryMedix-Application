import { useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  MessageSquarePlus,
  PlusCircle,
  Radio,
  Users,
  Video,
  X,
} from 'lucide-react'
import './Telemedicine.css'
import LiveMediaStage from './LiveMediaStage.jsx'
import LiveQaHandRaisePanel from './LiveQaHandRaisePanel.jsx'
import {
  getRoomInteractionState,
  getRoomRoleGrouping,
  POULTRYMEDIX_ROOM_INTERACTION_CHANNEL,
  POULTRYMEDIX_ROOM_INTERACTION_EVENT,
} from '../lib/liveRoomInteractionStore.js'
import {
  POULTRYMEDIX_SEMINARS_CHANNEL,
  POULTRYMEDIX_SEMINARS_UPDATED_EVENT,
  SEMINAR_CATEGORIES,
  createFreeSeminar,
  getFreeSeminars,
  setSeminarStatus,
  toggleSeminarRegistration,
} from '../lib/seminarStore.js'
import { getLocalTodayDateStr, getSuggestedSlotTime } from '../lib/telehealthNotifier.js'
import { useLanguage } from '../context/useLanguage.js'
import { useUser } from '../context/user-context.js'

function readSavedProfileName() {
  try {
    return localStorage.getItem('poultry-profile-name')?.trim() || ''
  } catch {
    return ''
  }
}

export default function FreeSeminarHub({ preselectedSeminarId = '' }) {
  const { language, t } = useLanguage()
  const { role } = useUser()
  const isBn = language === 'bn'
  const roleGroup = getRoomRoleGrouping(role)
  const isRoomHost = roleGroup.isHost
  const participantDisplayName = readSavedProfileName() || t(roleGroup.roleLabelKey)

  const [seminars, setSeminars] = useState(() => getFreeSeminars())
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeLiveSeminarId, setActiveLiveSeminarId] = useState(() => {
    const initial = getFreeSeminars()
    if (preselectedSeminarId) {
      const target = initial.find((s) => s.id === preselectedSeminarId)
      if (target?.status === 'live') return target.id
    }
    return ''
  })
  const [expandedQaId, setExpandedQaId] = useState('')
  const [interactionTick, setInteractionTick] = useState(0)

  const [hostComposerOpen, setHostComposerOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('basic_guidelines')
  const [newHostName, setNewHostName] = useState('Dr. Md Nafizur Rahman')
  const [newDate, setNewDate] = useState(() => getLocalTodayDateStr())
  const [newTime, setNewTime] = useState(() => getSuggestedSlotTime(30))
  const [newDuration, setNewDuration] = useState('45')
  const [newAgenda, setNewAgenda] = useState('')
  const [startNow, setStartNow] = useState(false)
  const [hostNotice, setHostNotice] = useState('')

  useEffect(() => {
    function syncSeminars() {
      setSeminars(getFreeSeminars())
      setInteractionTick((n) => n + 1)
    }
    window.addEventListener(POULTRYMEDIX_SEMINARS_UPDATED_EVENT, syncSeminars)
    window.addEventListener(POULTRYMEDIX_ROOM_INTERACTION_EVENT, syncSeminars)
    window.addEventListener('storage', syncSeminars)

    let bc = null
    let qaBc = null
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(POULTRYMEDIX_SEMINARS_CHANNEL)
      bc.onmessage = syncSeminars
      qaBc = new BroadcastChannel(POULTRYMEDIX_ROOM_INTERACTION_CHANNEL)
      qaBc.onmessage = syncSeminars
    }
    return () => {
      if (bc) bc.close()
      if (qaBc) qaBc.close()
      window.removeEventListener(POULTRYMEDIX_SEMINARS_UPDATED_EVENT, syncSeminars)
      window.removeEventListener(POULTRYMEDIX_ROOM_INTERACTION_EVENT, syncSeminars)
      window.removeEventListener('storage', syncSeminars)
    }
  }, [])

  const filteredSeminars = useMemo(() => {
    const list = activeCategory === 'all'
      ? seminars
      : seminars.filter((s) => s.category === activeCategory)
    const order = { live: 0, upcoming: 1, ended: 2 }
    return [...list].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))
  }, [seminars, activeCategory])

  const liveSeminar = useMemo(
    () => seminars.find((s) => s.id === activeLiveSeminarId) || null,
    [seminars, activeLiveSeminarId]
  )

  const liveCount = seminars.filter((s) => s.status === 'live').length
  const upcomingCount = seminars.filter((s) => s.status === 'upcoming').length
  const totalSeatsReserved = seminars.reduce((sum, s) => sum + (Number(s.registeredCount) || 0), 0)

  function categoryLabel(catId) {
    const item = SEMINAR_CATEGORIES.find((c) => c.id === catId)
    return item ? (isBn ? item.labelBn : item.labelEn) : catId
  }

  function handleRegisterToggle(id) {
    const res = toggleSeminarRegistration(id)
    setSeminars(res.seminars)
  }

  function handleCreateSeminar(event) {
    event.preventDefault()
    const res = createFreeSeminar({
      titleEn: newTitle,
      titleBn: newTitle,
      category: newCategory,
      hostName: newHostName,
      date: newDate,
      time: newTime,
      durationMinutes: Number(newDuration) || 45,
      agendaEn: newAgenda,
      agendaBn: newAgenda,
      startImmediately: startNow,
    })
    if (!res.ok) return
    setSeminars(res.seminars)
    setHostComposerOpen(false)
    setNewTitle('')
    setNewAgenda('')
    setHostNotice(
      isBn
        ? `ফ্রি সেমিনার "${res.seminar.titleBn}" প্রকাশিত হয়েছে ও নোটিফিকেশনে পাঠানো হয়েছে!`
        : `Free seminar "${res.seminar.titleEn}" published and alerted in notifications!`
    )
    if (res.seminar.status === 'live') {
      setActiveLiveSeminarId(res.seminar.id)
    }
    window.setTimeout(() => setHostNotice(''), 4000)
  }

  return (
    <main className="veterinary-page seminar-hub-page w-full min-w-0 max-w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <section className="veterinary-page-heading">
        <span className="veterinary-kicker">{t('seminarHubKicker')}</span>
        <h1>{t('seminarHubTitle')}</h1>
        <p>{t('seminarHubSubtitle')}</p>
      </section>

      {/* Top KPI + Host CTA Strip */}
      <section className="seminar-overview-strip dark:bg-gray-800 dark:border-gray-700">
        <div className="seminar-stats-row">
          <div className="seminar-stat-pill is-live">
            <Radio size={14} aria-hidden="true" />
            <span>{isBn ? `${liveCount}টি লাইভ সেশন` : `${liveCount} Live Now`}</span>
          </div>
          <div className="seminar-stat-pill">
            <Calendar size={14} aria-hidden="true" />
            <span>{isBn ? `${upcomingCount}টি আসন্ন ফ্রি সেশন` : `${upcomingCount} Upcoming Free`}</span>
          </div>
          <div className="seminar-stat-pill">
            <Users size={14} aria-hidden="true" />
            <span>{isBn ? `${totalSeatsReserved} জন অংশগ্রহণকারী` : `${totalSeatsReserved} Participants`}</span>
          </div>
        </div>

        {isRoomHost ? (
          <button
            type="button"
            className="pmx-primary-submit-btn"
            onClick={() => setHostComposerOpen((prev) => !prev)}
          >
            <PlusCircle size={15} aria-hidden="true" />
            <span>{hostComposerOpen ? t('close') : t('seminarHostNewBtn')}</span>
          </button>
        ) : (
          <span className="pmx-live-role-badge is-participant">
            {t('liveRoleParticipantBadge')} · {t(roleGroup.roleLabelKey)}
          </span>
        )}
      </section>

      {hostNotice && (
        <div className="pmx-checkout-success" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{hostNotice}</span>
        </div>
      )}

      {/* Organizer / Registered Veterinarian Create Free Seminar Form */}
      {hostComposerOpen && isRoomHost && (
        <form className="seminar-host-form dark:bg-gray-800 dark:border-gray-700" onSubmit={handleCreateSeminar}>
          <div className="seminar-host-form-head">
            <div>
              <strong>{t('seminarCreateHeading')}</strong>
              <small>{t('seminarCreateSub')}</small>
            </div>
            <span className="seminar-free-badge">{isBn ? '১০০% ফ্রি সেশন' : '100% FREE · ৳ 0'}</span>
          </div>

          <div className="seminar-host-grid">
            <label className="surveillance-field" style={{ gridColumn: '1 / -1' }}>
              <span>{t('seminarFieldTitle')}</span>
              <input
                type="text"
                required
                maxLength={160}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={isBn
                  ? 'যেমন: ব্রয়লার খামারে অ্যান্টিবায়োটিক রেজিস্ট্যান্স প্রতিরোধ ও জৈব-নিরাপত্তা গাইডলাইন'
                  : 'e.g. AMR Stewardship & Biosecurity Basics for Marginal Poultry Farmers'}
              />
            </label>

            <label className="surveillance-field">
              <span>{t('seminarFieldCategory')}</span>
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                {SEMINAR_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {isBn ? cat.labelBn : cat.labelEn}
                  </option>
                ))}
              </select>
            </label>

            <label className="surveillance-field">
              <span>{t('seminarFieldHost')}</span>
              <input
                type="text"
                maxLength={100}
                value={newHostName}
                onChange={(e) => setNewHostName(e.target.value)}
              />
            </label>

            <label className="surveillance-field">
              <span>{t('preferredDate')}</span>
              <input type="date" min={getLocalTodayDateStr()} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </label>

            <label className="surveillance-field">
              <span>{t('preferredTime')}</span>
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            </label>

            <label className="surveillance-field">
              <span>{t('seminarFieldDuration')}</span>
              <input type="number" min="15" max="180" value={newDuration} onChange={(e) => setNewDuration(e.target.value)} />
            </label>

            <label className="surveillance-field" style={{ gridColumn: '1 / -1' }}>
              <span>{t('seminarFieldAgenda')}</span>
              <input
                type="text"
                maxLength={350}
                value={newAgenda}
                onChange={(e) => setNewAgenda(e.target.value)}
                placeholder={isBn
                  ? 'আলোচ্য বিষয়: খামার পরিচালনা, টিকা কোল্ড-চেইন, উইথড্রয়াল ও সরাসরি প্রশ্নোত্তর'
                  : 'Key points: Shed ventilation, cold-chain vaccines, AMR withdrawal rules & open farmer Q&A'}
              />
            </label>
          </div>

          <label className="pmx-telehealth-consent-box dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={startNow}
              onChange={(e) => setStartNow(e.target.checked)}
            />
            <span>{t('seminarStartImmediatelyLabel')}</span>
          </label>

          <div className="pmx-checkout-actions">
            <button type="button" className="pmx-secondary-btn dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200" onClick={() => setHostComposerOpen(false)}>
              {t('cancel')}
            </button>
            <button type="submit" className="pmx-primary-submit-btn">
              <GraduationCap size={16} aria-hidden="true" />
              <span>{startNow ? t('seminarPublishGoLiveBtn') : t('seminarPublishBtn')}</span>
            </button>
          </div>
        </form>
      )}

      {/* Embedded Live In-App Seminar Auditorium Room */}
      {liveSeminar && (
        <section className="seminar-auditorium dark:bg-gray-800 dark:border-gray-700" aria-label={t('seminarLiveRoomLabel')}>
          <header className="seminar-auditorium-head dark:bg-gray-950 dark:border-gray-800">
            <div>
              <div className="seminar-card-badges">
                <span className="seminar-status-pill is-live">● {t('seminarLiveNowBadge')}</span>
                <span className="seminar-free-badge">{isBn ? 'ফ্রি প্রবেশ' : 'FREE ACCESS'}</span>
                <span className="pmx-room-code-pill">{liveSeminar.roomCode}</span>
              </div>
              <h2>{isBn ? liveSeminar.titleBn : liveSeminar.titleEn}</h2>
              <p>{liveSeminar.hostName} · {isBn ? liveSeminar.hostRoleBn : liveSeminar.hostRoleEn}</p>
            </div>
            <button
              type="button"
              className="pmx-secondary-btn dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
              onClick={() => setActiveLiveSeminarId('')}
            >
              <X size={15} aria-hidden="true" />
              <span>{t('seminarLeaveRoomBtn')}</span>
            </button>
          </header>

          <div className="seminar-auditorium-grid">
            <LiveMediaStage
              key={`${liveSeminar.roomCode}-${roleGroup.side}`}
              roomId={liveSeminar.roomCode}
              userRole={role}
              displayName={participantDisplayName}
              remoteTitle={liveSeminar.hostName}
              remoteSubtitle={isBn ? liveSeminar.hostRoleBn : liveSeminar.hostRoleEn}
              heightPx={380}
              endButtonLabel={isRoomHost ? t('seminarEndSessionBtn') : t('seminarLeaveRoomBtn')}
              onLeaveOrEnd={() => {
                if (isRoomHost) {
                  setSeminars(setSeminarStatus(liveSeminar.id, 'ended'))
                }
                setActiveLiveSeminarId('')
              }}
            />

            <aside className="seminar-auditorium-sidebar dark:bg-gray-900 dark:border-gray-700">
              <div className="seminar-agenda-card dark:bg-gray-800 dark:border-gray-700">
                <strong>{t('seminarAgendaHeading')}</strong>
                <p>{isBn ? liveSeminar.agendaBn : liveSeminar.agendaEn}</p>
              </div>

              <LiveQaHandRaisePanel
                key={`qa-${liveSeminar.roomCode}-${roleGroup.side}`}
                roomId={liveSeminar.roomCode}
                userRole={role}
                participantName={participantDisplayName}
                initialQuestions={liveSeminar.questions}
              />
            </aside>
          </div>
        </section>
      )}

      {/* Category Filter Pills */}
      <div className="seminar-filter-row" role="tablist" aria-label={t('seminarCategoriesLabel')}>
        {SEMINAR_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={activeCategory === cat.id}
            className={`blueprint-chip${activeCategory === cat.id ? ' is-active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {isBn ? cat.labelBn : cat.labelEn}
          </button>
        ))}
      </div>

      {/* Seminar Directory Cards */}
      <section className="seminar-cards-grid" data-sync={interactionTick}>
        {filteredSeminars.map((sem) => {
          const isLive = sem.status === 'live'
          const isEnded = sem.status === 'ended'
          const isQaOpen = expandedQaId === sem.id
          const syncedCount = Math.max(
            (sem.questions || []).length,
            getRoomInteractionState(sem.roomCode).messages.length
          )
          return (
            <article key={sem.id} className={`seminar-card${isLive ? ' is-live' : ''} dark:bg-gray-800 dark:border-gray-700`}>
              <div className="seminar-card-badges">
                <span className={`seminar-status-pill is-${sem.status}`}>
                  {isLive
                    ? `● ${t('seminarLiveNowBadge')}`
                    : isEnded
                      ? t('seminarEndedBadge')
                      : t('seminarUpcomingBadge')}
                </span>
                <span className="seminar-free-badge">{isBn ? 'ফ্রি · ৳ ০' : 'FREE · ৳ 0'}</span>
                <span className="seminar-topic-badge dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700">
                  {categoryLabel(sem.category)}
                </span>
              </div>

              <h3>{isBn ? sem.titleBn : sem.titleEn}</h3>
              <p className="seminar-card-agenda dark:text-gray-300">
                {isBn ? sem.agendaBn : sem.agendaEn}
              </p>

              <div className="seminar-card-meta dark:border-gray-700">
                <div>
                  <strong>{sem.hostName}</strong>
                  <small>{isBn ? sem.hostRoleBn : sem.hostRoleEn}</small>
                </div>
                <div className="seminar-time-meta">
                  <span><Calendar size={12} aria-hidden="true" /> {sem.date} · {sem.time}</span>
                  <span><Clock size={12} aria-hidden="true" /> {sem.durationMinutes} {isBn ? 'মিনিট' : 'min'} · {sem.registeredCount} {isBn ? 'জন' : 'joined'}</span>
                </div>
              </div>

              <div className="seminar-card-actions">
                {isLive ? (
                  <button
                    type="button"
                    className="pmx-primary-submit-btn"
                    style={{ flex: 1 }}
                    onClick={() => setActiveLiveSeminarId(sem.id)}
                  >
                    <Video size={15} aria-hidden="true" />
                    <span>{t('seminarJoinLiveBtn')}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isEnded}
                    className={sem.isRegistered ? 'pmx-sandbox-btn' : 'pmx-primary-submit-btn'}
                    style={{ flex: 1 }}
                    onClick={() => handleRegisterToggle(sem.id)}
                  >
                    <CheckCircle2 size={15} aria-hidden="true" />
                    <span>
                      {isEnded
                        ? t('seminarEndedBadge')
                        : sem.isRegistered
                          ? t('seminarSpotSavedBtn')
                          : t('seminarSaveFreeSpotBtn')}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  className="pmx-secondary-btn dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200"
                  onClick={() => setExpandedQaId(isQaOpen ? '' : sem.id)}
                >
                  <MessageSquarePlus size={14} aria-hidden="true" />
                  <span>Q&A ({syncedCount})</span>
                </button>
              </div>

              {isRoomHost && (
                <div className="seminar-host-controls">
                  {!isLive && (
                    <button
                      type="button"
                      className="seminar-host-ctrl-btn is-go-live"
                      onClick={() => {
                        setSeminars(setSeminarStatus(sem.id, 'live'))
                        setActiveLiveSeminarId(sem.id)
                      }}
                    >
                      <Radio size={12} aria-hidden="true" />
                      <span>{t('seminarGoLiveBtn')}</span>
                    </button>
                  )}
                  {isLive && (
                    <button
                      type="button"
                      className="seminar-host-ctrl-btn"
                      onClick={() => {
                        setSeminars(setSeminarStatus(sem.id, 'ended'))
                        if (activeLiveSeminarId === sem.id) setActiveLiveSeminarId('')
                      }}
                    >
                      <span>{t('seminarEndSessionBtn')}</span>
                    </button>
                  )}
                </div>
              )}

              {isQaOpen && (
                <LiveQaHandRaisePanel
                  key={`card-qa-${sem.roomCode}-${roleGroup.side}`}
                  roomId={sem.roomCode}
                  userRole={role}
                  participantName={participantDisplayName}
                  initialQuestions={sem.questions}
                  compact
                />
              )}
            </article>
          )
        })}
      </section>
    </main>
  )
}
