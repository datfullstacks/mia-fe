import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { HistoryPanel } from '../components/HistoryPanel'
import { PricingPanel } from '../components/PricingPanel'
import { SealPanel } from '../components/SealPanel'
import { StatusPill } from '../components/StatusPill'
import { SettingsPanel } from '../components/SettingsPanel'
import { UnsealPanel } from '../components/UnsealPanel'
import { subscribeToAmbersChanged } from '../lib/amberEvents'
import { type Amber, fetchAmbers } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatClock, formatDateTime, getCountdownText } from '../lib/time'

type RoomObject = 'clock' | 'vinyl' | 'radio' | 'calendar' | 'diary' | 'amber'
type PhoneApp = 'seal' | 'unseal' | 'history' | 'pricing' | 'settings'

const phoneApps: PhoneApp[] = ['seal', 'unseal', 'history', 'pricing', 'settings']
const guestPhoneApps: PhoneApp[] = ['unseal', 'settings']
const phoneAppLabels: Record<PhoneApp, string> = {
  seal: 'Seal',
  unseal: 'Unseal',
  history: 'History',
  pricing: 'Pricing',
  settings: 'Settings',
}

const vinylTracks = [
  'Warm Table at 2AM',
  'Needle in Amber',
  'Rain Against the Window',
  'Quiet Hallway Echo',
  'Coffee Steam Loop',
  'Almost Morning',
  'Letters on the Desk',
]

const radioStations = ['Jazz Corner', 'LoFi Transit', 'Soft News']
const quotes = [
  'Some days are only meant to be kept, not rushed.',
  'Certain words should open only after time has softened them.',
  'The quietest room usually lets memory speak the loudest.',
]

const roomObjectLabels: Record<RoomObject, string> = {
  clock: 'Clock',
  vinyl: 'Vinyl player',
  radio: 'Radio',
  calendar: 'Calendar',
  diary: 'Diary',
  amber: 'Amber archive',
}

const roomObjectBadges: Record<RoomObject, string> = {
  clock: 'CLK',
  vinyl: 'VNL',
  radio: 'RAD',
  calendar: 'DAY',
  diary: 'NOTE',
  amber: 'AMB',
}

function getTimeSegment(date: Date) {
  const hour = date.getHours()

  if (hour < 6) {
    return 'midnight'
  }

  if (hour < 12) {
    return 'morning'
  }

  if (hour < 18) {
    return 'afternoon'
  }

  return 'night'
}

function getTimeSegmentTitle(segment: ReturnType<typeof getTimeSegment>) {
  switch (segment) {
    case 'midnight':
      return 'After-hours glow'
    case 'morning':
      return 'Soft daylight rehearsal'
    case 'afternoon':
      return 'Golden desk hour'
    case 'night':
      return 'Lantern-lit archive'
    default:
      return 'Memory room'
  }
}

function getRoomPrompt(segment: ReturnType<typeof getTimeSegment>, currentUserName?: string) {
  switch (segment) {
    case 'midnight':
      return currentUserName
        ? `The room has settled into its quietest register, ${currentUserName}. Ideal for sealing words that should open later.`
        : 'The room is at its quietest. Guest mode keeps only the unlock path within reach.'
    case 'morning':
      return currentUserName
        ? `Fresh light, clean desk, and enough calm to review your sealed moments before the day gets loud.`
        : 'Morning light keeps the room open, but only guest unlock is available until you sign in.'
    case 'afternoon':
      return currentUserName
        ? `Everything feels awake here: history, pricing, and seal flows all sit inside the phone waiting for the next action.`
        : 'The room is open to explore, but the phone stays on guest unlock until you enter through the gate.'
    case 'night':
      return currentUserName
        ? `This is the best light for MIA: warm shadows, live objects, and your full toolkit inside the phone.`
        : 'Night mode keeps the room cinematic. Sign in to unlock the full phone, or stay guest and unseal only.'
    default:
      return 'A room for timing memory with care.'
  }
}

function getInitialPhoneState(searchParams: URLSearchParams) {
  const requestedApp = searchParams.get('app')
  const normalizedApp = requestedApp === 'wallet' ? 'pricing' : requestedApp

  if (normalizedApp && phoneApps.includes(normalizedApp as PhoneApp)) {
    return {
      isOpen: true,
      app: normalizedApp as PhoneApp,
    }
  }

  return {
    isOpen: false,
    app: 'seal' as PhoneApp,
  }
}

function getAmberAmbientCopy(amber: Amber, nowMs: number) {
  if (amber.status === 'scheduled') {
    return getCountdownText(amber.openAt, nowMs)
  }

  if (amber.status === 'ready') {
    return 'Ready to unseal'
  }

  if (amber.status === 'opened') {
    return `Opened ${formatDateTime(amber.openAt)}`
  }

  return 'Cancelled'
}

function getAmberInfoCopy(amber: Amber, nowMs: number) {
  if (amber.status === 'scheduled') {
    return `This amber is still sealed. It opens in ${getCountdownText(amber.openAt, nowMs)}.`
  }

  if (amber.status === 'ready') {
    return 'This amber has reached its opening time. It now sits in the room as a live, ready memory.'
  }

  if (amber.status === 'opened') {
    return 'This amber has already been opened, so it behaves more like a preserved memory than a sealed one.'
  }

  return 'This amber was cancelled before it could open. It remains part of the room archive, but no longer active.'
}

function getAmberNodeTitle(amber: Amber) {
  const localPart = amber.recipientEmail.split('@')[0] || amber.recipientEmail
  return localPart.length > 12 ? `${localPart.slice(0, 12)}...` : localPart
}

export function RoomPage() {
  const { currentUser, token } = useAuth()
  const [searchParams] = useSearchParams()
  const initialPhoneState = useMemo(() => getInitialPhoneState(searchParams), [searchParams])
  const initialActivePhoneApp =
    currentUser || guestPhoneApps.includes(initialPhoneState.app) ? initialPhoneState.app : 'unseal'
  const [isPhoneOpen, setIsPhoneOpen] = useState(initialPhoneState.isOpen)
  const [activePhoneApp, setActivePhoneApp] = useState<PhoneApp>(initialActivePhoneApp)
  const [activeObject, setActiveObject] = useState<RoomObject | null>(null)
  const [clock, setClock] = useState(() => new Date())
  const [roomAmbers, setRoomAmbers] = useState<Amber[]>([])
  const [isAmberLoading, setIsAmberLoading] = useState(false)
  const [amberError, setAmberError] = useState<string | null>(null)
  const [activeAmberId, setActiveAmberId] = useState<string | null>(null)
  const [selectedRadio, setSelectedRadio] = useState(radioStations[0])
  const [diaryNote, setDiaryNote] = useState(
    () => window.localStorage.getItem('mia-room-diary') || '',
  )
  const [vinylPlaying, setVinylPlaying] = useState(false)
  const availablePhoneApps = currentUser ? phoneApps : guestPhoneApps
  const timeSegment = getTimeSegment(clock)
  const stageTitle = getTimeSegmentTitle(timeSegment)
  const roomPrompt = getRoomPrompt(timeSegment, currentUser?.name)
  const activeQuote = quotes[clock.getDate() % quotes.length]
  const activeFocusLabel = activeObject ? roomObjectLabels[activeObject] : 'Ambient sweep'
  const longDate = clock.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const activeAmber = roomAmbers.find((item) => item.id === activeAmberId) ?? roomAmbers[0] ?? null

  const loadRoomAmbers = useCallback(async () => {
    if (!token) {
      setRoomAmbers([])
      setActiveAmberId(null)
      setAmberError(null)
      setIsAmberLoading(false)
      return
    }

    try {
      setIsAmberLoading(true)
      const response = await fetchAmbers(token, {
        status: 'all',
        includeArchived: false,
        page: 1,
        pageSize: 4,
      })
      const nextItems = response.items
      setRoomAmbers(nextItems)
      setAmberError(null)
      setActiveAmberId((current) => {
        if (current && nextItems.some((item) => item.id === current)) {
          return current
        }

        return nextItems[0]?.id ?? null
      })
    } catch (nextError) {
      setAmberError(nextError instanceof Error ? nextError.message : 'Failed to load ambers for the room')
    } finally {
      setIsAmberLoading(false)
    }
  }, [token])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClock(new Date())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('mia-room-diary', diaryNote)
  }, [diaryNote])

  useEffect(() => {
    void loadRoomAmbers()
    return subscribeToAmbersChanged(() => {
      void loadRoomAmbers()
    })
  }, [loadRoomAmbers])

  function openPhone(app: PhoneApp) {
    const nextApp = currentUser || guestPhoneApps.includes(app) ? app : 'unseal'
    setActivePhoneApp(nextApp)
    setIsPhoneOpen(true)
  }

  function focusAmber(amberId: string) {
    setActiveAmberId(amberId)
    setActiveObject('amber')
  }

  function renderPhoneApp() {
    switch (activePhoneApp) {
      case 'seal':
        return <SealPanel />
      case 'unseal':
        return <UnsealPanel />
      case 'history':
        return <HistoryPanel />
      case 'pricing':
        return <PricingPanel />
      case 'settings':
        return <SettingsPanel />
      default:
        return null
    }
  }

  return (
    <div className="room-shell">
      <section className={`room-stage stage-${timeSegment}`}>
        <div className="room-atmosphere" aria-hidden="true">
          <div className="room-architecture">
            <div className="room-back-wall" />
            <div className="room-side-wall room-side-wall-left" />
            <div className="room-side-wall room-side-wall-right" />
            <div className="room-floor-plane" />
            <div className="room-desk-plane" />
          </div>
          <div className="room-glow room-glow-primary" />
          <div className="room-glow room-glow-secondary" />
          <div className="room-ceiling-haze" />
          <div className="room-light-cone" />
          <div className="room-window">
            <span className="room-window-pane room-window-pane-left" />
            <span className="room-window-pane room-window-pane-right" />
          </div>
          <div className="room-shelf">
            <span className="shelf-book shelf-book-tall" />
            <span className="shelf-book shelf-book-short" />
            <span className="shelf-book shelf-book-wide" />
            <span className="shelf-vase" />
          </div>
          <div className="room-rug" />
        </div>

        <div className="room-hud">
          <div className="room-hud-brand">
            <span className="workspace-pill">MIA</span>
            <div className="room-hud-copy">
              <strong>{stageTitle}</strong>
              <span>{currentUser ? `${currentUser.name} in the room` : 'Guest access'}</span>
            </div>
          </div>
          <div className="room-topbar-actions">
            <Link className="room-nav-link" to="/gate">
              Gate
            </Link>
            <Link className="room-nav-link" to="/admin">
              Admin
            </Link>
          </div>
        </div>

        <div className="room-layout">
          <section className="room-ledger">
            <p className="panel-tag">Tonight in MIA</p>
            <h2>{stageTitle}</h2>
            <p>{roomPrompt}</p>
            <div className="room-ledger-meta">
              <div>
                <span>Focus</span>
                <strong>{activeFocusLabel}</strong>
              </div>
              <div>
                <span>Access</span>
                <strong>{currentUser ? `${availablePhoneApps.length} phone apps` : 'Guest unlock only'}</strong>
              </div>
              <div>
                <span>Date</span>
                <strong>{longDate}</strong>
              </div>
            </div>
          </section>

          <button
            className="room-object object-clock"
            onClick={() => setActiveObject('clock')}
            type="button"
          >
            <span className="object-dot" />
            <span className="room-object-badge">{roomObjectBadges.clock}</span>
            <strong>Clock</strong>
            <small>{formatClock(clock)}</small>
          </button>

          <button
            className="room-object object-vinyl"
            onClick={() => setActiveObject('vinyl')}
            type="button"
          >
            <span className="object-dot" />
            <span className="room-object-badge">{roomObjectBadges.vinyl}</span>
            <div className={vinylPlaying ? 'vinyl-disc spinning' : 'vinyl-disc'} />
            <strong>Vinyl Player</strong>
          </button>

          <button
            className="room-object object-radio"
            onClick={() => setActiveObject('radio')}
            type="button"
          >
            <span className="object-dot" />
            <span className="room-object-badge">{roomObjectBadges.radio}</span>
            <strong>Radio</strong>
            <small>{selectedRadio}</small>
          </button>

          <button
            className="room-object object-calendar"
            onClick={() => setActiveObject('calendar')}
            type="button"
          >
            <span className="object-dot" />
            <span className="room-object-badge">{roomObjectBadges.calendar}</span>
            <strong>Calendar</strong>
            <small>{clock.toLocaleDateString()}</small>
          </button>

          <section
            className={
              currentUser ? 'room-amber-cluster' : 'room-amber-cluster room-amber-cluster-guest'
            }
          >
            <div className="room-amber-cluster-head">
              <div>
                <p className="panel-tag">Amber archive</p>
                <h3>{currentUser ? 'Amber tray' : 'Guest path'}</h3>
              </div>
              {currentUser ? (
                <button className="phone-button ghost" onClick={() => openPhone('history')} type="button">
                  History
                </button>
              ) : (
                <button className="phone-button ghost" onClick={() => openPhone('unseal')} type="button">
                  Unseal
                </button>
              )}
            </div>

            {currentUser ? (
              <>
                {isAmberLoading ? <p className="helper-copy">Loading amber presence...</p> : null}
                {amberError ? <p className="feedback error">{amberError}</p> : null}
                {!isAmberLoading && !amberError ? (
                  roomAmbers.length > 0 ? (
                    <div className="amber-node-grid">
                      {roomAmbers.map((amber) => (
                        <button
                          key={amber.id}
                          className={
                            activeAmberId === amber.id
                              ? `amber-node amber-node-${amber.status} active`
                              : `amber-node amber-node-${amber.status}`
                          }
                          onClick={() => focusAmber(amber.id)}
                          type="button"
                        >
                          <span className="amber-node-glow" />
                          <span className="amber-node-code">{amber.code}</span>
                          <strong>{getAmberNodeTitle(amber)}</strong>
                          <small>{getAmberAmbientCopy(amber, clock.getTime())}</small>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="room-amber-empty">
                      <p>No live amber on the desk yet.</p>
                      <button className="phone-button ghost" onClick={() => openPhone('seal')} type="button">
                        Seal your first amber
                      </button>
                    </div>
                  )
                ) : null}
              </>
            ) : (
              <div className="room-amber-empty">
                <p>Guest mode keeps only the unseal path active.</p>
                <button className="phone-button ghost" onClick={() => openPhone('unseal')} type="button">
                  Open unseal
                </button>
              </div>
            )}
          </section>

          <button
            className="room-object object-diary"
            onClick={() => setActiveObject('diary')}
            type="button"
          >
            <span className="object-dot" />
            <span className="room-object-badge">{roomObjectBadges.diary}</span>
            <strong>Diary</strong>
            <small>{diaryNote ? 'Saved locally' : 'Write a note'}</small>
          </button>

          <button
            className="room-object object-phone"
            onClick={() => openPhone(currentUser ? 'seal' : 'unseal')}
            type="button"
          >
            <span className="object-dot" />
            <span className="room-object-badge">OS</span>
            <div className="phone-silhouette">
              <span />
            </div>
            <strong>Smartphone OS</strong>
            <small>{currentUser ? 'Seal, history, pricing' : 'Guest unlock'}</small>
          </button>

          <aside className="room-info">
            {!activeObject ? (
              <div className="room-info-card room-info-card-intro">
                <p className="panel-tag">Room reading</p>
                <h3>{currentUser ? 'The room leads' : 'Guest-safe ambient mode'}</h3>
                <p>
                  {currentUser
                    ? 'Select a room object or tap an amber on the tray.'
                    : 'Explore the room, then open Unseal from the phone.'}
                </p>
              </div>
            ) : null}

            {activeObject === 'clock' ? (
              <div className="room-info-card">
                <p className="panel-tag">Clock</p>
                <h3>{formatClock(clock)}</h3>
                <p>The room clock is live, and the lighting shifts with it. MIA should always feel aware of time, not static.</p>
              </div>
            ) : null}

            {activeObject === 'vinyl' ? (
              <div className="room-info-card">
                <p className="panel-tag">Vinyl player</p>
                <h3>Lo-fi track list</h3>
                <ul className="plain-list compact">
                  {vinylTracks.map((track) => (
                    <li key={track}>{track}</li>
                  ))}
                </ul>
                <button
                  className="phone-button ghost"
                  onClick={() => setVinylPlaying((current) => !current)}
                  type="button"
                >
                  {vinylPlaying ? 'Pause ambience' : 'Spin ambience'}
                </button>
              </div>
            ) : null}

            {activeObject === 'radio' ? (
              <div className="room-info-card">
                <p className="panel-tag">Radio</p>
                <h3>Ambient channels</h3>
                <p>These are still UI-only channels, but the room treats them as a tone switch for the scene.</p>
                <div className="button-row">
                  {radioStations.map((station) => (
                    <button
                      key={station}
                      className={selectedRadio === station ? 'chip active' : 'chip'}
                      onClick={() => setSelectedRadio(station)}
                      type="button"
                    >
                      {station}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {activeObject === 'calendar' ? (
              <div className="room-info-card">
                <p className="panel-tag">Calendar</p>
                <h3>{longDate}</h3>
                <p>{quotes[clock.getDate() % quotes.length]}</p>
              </div>
            ) : null}

            {activeObject === 'diary' ? (
              <div className="room-info-card">
                <p className="panel-tag">Diary</p>
                <h3>Quick note</h3>
                <p>Local room note only. It is there to make the room feel inhabited, not to replace amber creation.</p>
                <textarea
                  className="room-textarea"
                  placeholder="Write a short room note..."
                  value={diaryNote}
                  onChange={(event) => setDiaryNote(event.target.value)}
                />
              </div>
            ) : null}

            {activeObject === 'amber' ? (
              <div className="room-info-card">
                <p className="panel-tag">Amber archive</p>
                {activeAmber ? (
                  <>
                    <div className="room-amber-focus-head">
                      <div>
                        <h3>{activeAmber.code}</h3>
                        <p className="helper-copy">{activeAmber.recipientEmail}</p>
                      </div>
                      <StatusPill status={activeAmber.status} />
                    </div>
                    <p>{getAmberInfoCopy(activeAmber, clock.getTime())}</p>
                    <dl className="mini-meta">
                      <div>
                        <dt>Open at</dt>
                        <dd>{formatDateTime(activeAmber.openAt)}</dd>
                      </div>
                      <div>
                        <dt>Created</dt>
                        <dd>{formatDateTime(activeAmber.createdAt)}</dd>
                      </div>
                    </dl>
                    <p className="room-amber-message">{activeAmber.message}</p>
                    <div className="button-row">
                      <button className="phone-button ghost" onClick={() => openPhone('history')} type="button">
                        Review in history
                      </button>
                      <button className="phone-button ghost" onClick={() => openPhone('seal')} type="button">
                        Seal another
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3>Amber archive</h3>
                    <p>The room has no active amber to surface yet. Once you seal one, it will appear here as part of the scene.</p>
                  </>
                )}
              </div>
            ) : null}
          </aside>

          <div className="room-status-strip">
            <span>{formatClock(clock)}</span>
            <span>{currentUser ? 'Signed room access' : 'Guest room access'}</span>
            <span>{activeObject ? `Focus: ${roomObjectLabels[activeObject]}` : activeQuote}</span>
          </div>
        </div>

        {isPhoneOpen ? (
          <div className="phone-overlay">
            <div className="phone-window">
              <div className="phone-window-statusbar">
                <span>{formatClock(clock)}</span>
                <span>{currentUser ? currentUser.name : 'Guest mode'}</span>
              </div>
              <header className="phone-window-head">
                <div>
                  <p className="panel-tag">Smartphone OS</p>
                  <h3>{phoneAppLabels[activePhoneApp]}</h3>
                  <p className="helper-copy">
                    {currentUser
                      ? 'The phone is the operational layer inside the room.'
                      : 'Guest mode limits the phone to safe unlock-only access.'}
                  </p>
                </div>
                <button
                  className="phone-button ghost"
                  onClick={() => setIsPhoneOpen(false)}
                  type="button"
                >
                  Close
                </button>
              </header>

              <nav className="phone-tabs">
                {availablePhoneApps.map((app) => (
                  <button
                    key={app}
                    className={activePhoneApp === app ? 'phone-tab active' : 'phone-tab'}
                    onClick={() => setActivePhoneApp(app)}
                    type="button"
                  >
                    {phoneAppLabels[app]}
                  </button>
                ))}
              </nav>

              <div className="phone-app-body">{renderPhoneApp()}</div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
