import { useEffect, useMemo, useState } from 'react'
import { Check, Hand, MessageSquarePlus, Send, Trash2 } from 'lucide-react'
import {
  POULTRYMEDIX_ROOM_INTERACTION_CHANNEL,
  POULTRYMEDIX_ROOM_INTERACTION_EVENT,
  acknowledgeRaisedHand,
  clearAllRaisedHands,
  getRoomInteractionState,
  getRoomRoleGrouping,
  seedRoomQuestionsIfEmpty,
  sendLiveQaMessage,
  toggleLiveQaAnswered,
  toggleRaiseHand,
} from '../lib/liveRoomInteractionStore.js'
import { useLanguage } from '../context/useLanguage.js'

function formatShortTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function LiveQaHandRaisePanel({
  roomId = 'PMX-ROOM-LIVE',
  userRole = 'FARMER',
  participantId = '',
  participantName = 'Participant',
  initialQuestions = [],
  onQuestionPosted,
  onQuestionAnsweredToggled,
  compact = false,
}) {
  const { t } = useLanguage()
  const roleInfo = useMemo(() => getRoomRoleGrouping(userRole), [userRole])
  const isHost = roleInfo.isHost
  const resolvedParticipantId = useMemo(
    () => participantId || `${roleInfo.userRole}-${participantName}`.slice(0, 48),
    [participantId, roleInfo.userRole, participantName]
  )

  const [roomState, setRoomState] = useState(() => {
    if (Array.isArray(initialQuestions) && initialQuestions.length > 0) {
      return seedRoomQuestionsIfEmpty(roomId, initialQuestions)
    }
    return getRoomInteractionState(roomId)
  })
  const [draft, setDraft] = useState('')

  useEffect(() => {
    function syncInteraction() {
      setRoomState(getRoomInteractionState(roomId))
    }

    window.addEventListener(POULTRYMEDIX_ROOM_INTERACTION_EVENT, syncInteraction)
    window.addEventListener('storage', syncInteraction)

    let bc = null
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(POULTRYMEDIX_ROOM_INTERACTION_CHANNEL)
      bc.onmessage = syncInteraction
    }

    return () => {
      if (bc) bc.close()
      window.removeEventListener(POULTRYMEDIX_ROOM_INTERACTION_EVENT, syncInteraction)
      window.removeEventListener('storage', syncInteraction)
    }
  }, [roomId])

  const myHandRaised = roomState.raisedHands.some((h) => h.participantId === resolvedParticipantId)

  function handleSendMessage(event) {
    event.preventDefault()
    if (!draft.trim()) return
    const res = sendLiveQaMessage(roomId, {
      author: participantName || t(roleInfo.roleLabelKey),
      userRole: roleInfo.userRole,
      text: draft,
    })
    if (res.ok) {
      setRoomState(res.state)
      setDraft('')
      if (onQuestionPosted) onQuestionPosted(res.message)
    }
  }

  function handleToggleHand() {
    const res = toggleRaiseHand(roomId, {
      participantId: resolvedParticipantId,
      participantName: participantName || t(roleInfo.roleLabelKey),
      userRole: roleInfo.userRole,
    })
    setRoomState(res.state)
  }

  return (
    <div className={`pmx-qa-sync-panel${compact ? ' is-compact' : ''} dark:bg-gray-900 dark:border-gray-700`}>
      <div className="pmx-qa-sync-header">
        <div>
          <strong>
            <MessageSquarePlus size={14} aria-hidden="true" />
            <span>{t('liveQaAndHandsTitle')}</span>
          </strong>
          <small>{t('liveCrossTabSyncHint')}</small>
        </div>
        <span className={`pmx-live-role-badge ${isHost ? 'is-host' : 'is-participant'}`}>
          {t(roleInfo.badgeKey)}
        </span>
      </div>

      {/* Synchronized Hand-Raise Queue & Participant Trigger */}
      <div className="pmx-hand-raise-bar dark:bg-gray-800 dark:border-gray-700">
        {!isHost ? (
          <div className="pmx-hand-participant-row">
            <button
              type="button"
              className={`pmx-hand-btn${myHandRaised ? ' is-active' : ''}`}
              onClick={handleToggleHand}
              aria-pressed={myHandRaised}
            >
              <Hand size={14} aria-hidden="true" />
              <span>{myHandRaised ? t('liveLowerHandBtn') : t('liveRaiseHandBtn')}</span>
            </button>
            <span className="pmx-hand-counter">
              {roomState.raisedHands.length > 0
                ? t('liveHandsQueueCount', { count: roomState.raisedHands.length })
                : t('liveNoHandsRaised')}
            </span>
          </div>
        ) : (
          <div className="pmx-host-hands-box">
            <div className="pmx-host-hands-top">
              <strong>
                <Hand size={13} aria-hidden="true" />
                <span>{t('liveHandsQueueCount', { count: roomState.raisedHands.length })}</span>
              </strong>
              {roomState.raisedHands.length > 0 && (
                <button
                  type="button"
                  className="pmx-hand-clear-btn"
                  onClick={() => setRoomState(clearAllRaisedHands(roomId))}
                >
                  <Trash2 size={11} aria-hidden="true" />
                  <span>{t('liveClearHandsBtn')}</span>
                </button>
              )}
            </div>
            {roomState.raisedHands.length === 0 ? (
              <p className="pmx-hand-empty-hint">{t('liveNoHandsRaised')}</p>
            ) : (
              <ul className="pmx-raised-hands-list">
                {roomState.raisedHands.map((item) => (
                  <li key={item.participantId} className="dark:bg-gray-900 dark:border-gray-700">
                    <div>
                      <strong>{item.participantName}</strong>
                      <small>
                        {item.userRole === 'VET_STUDENT' ? t('roleStudent') : t('roleFarmer')} · {formatShortTime(item.raisedAt)}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="pmx-hand-ack-btn"
                      onClick={() => setRoomState(acknowledgeRaisedHand(roomId, item.participantId))}
                    >
                      <Check size={12} aria-hidden="true" />
                      <span>{t('liveAcknowledgeHandBtn')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Synchronized Live Q&A Composer & Feed */}
      <form className="seminar-qa-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          maxLength={280}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={isHost ? t('liveHostMessagePlaceholder') : t('seminarAskPlaceholder')}
        />
        <button type="submit" aria-label={t('sendMessage')}>
          <Send size={14} aria-hidden="true" />
        </button>
      </form>

      <ul className="seminar-qa-list">
        {roomState.messages.length === 0 ? (
          <li className="seminar-qa-empty">{t('seminarNoQuestionsYet')}</li>
        ) : (
          roomState.messages.map((msg) => (
            <li key={msg.id} className={msg.answered ? 'is-answered' : undefined}>
              <div className="seminar-qa-top">
                <span className="pmx-qa-author-wrap">
                  <strong>{msg.author}</strong>
                  <span className={`pmx-qa-role-tag${msg.userRole === 'REGISTERED_VET' ? ' is-host' : ''}`}>
                    {msg.userRole === 'REGISTERED_VET'
                      ? t('liveRoleHostBadge')
                      : msg.userRole === 'VET_STUDENT'
                        ? t('roleStudent')
                        : t('roleFarmer')}
                  </span>
                </span>
                {isHost ? (
                  <button
                    type="button"
                    className="seminar-qa-toggle-ans"
                    onClick={() => {
                      setRoomState(toggleLiveQaAnswered(roomId, msg.id))
                      if (onQuestionAnsweredToggled) onQuestionAnsweredToggled(msg.id)
                    }}
                  >
                    {msg.answered ? t('seminarAnsweredTag') : t('seminarMarkAnsweredBtn')}
                  </button>
                ) : msg.answered ? (
                  <span className="seminar-qa-done-tag">{t('seminarAnsweredTag')}</span>
                ) : null}
              </div>
              <p>{msg.text}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
