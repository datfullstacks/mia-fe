import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { HistoryPanel } from '../components/HistoryPanel'
import { PricingPanel } from '../components/PricingPanel'
import { SealPanel } from '../components/SealPanel'
import { SettingsPanel } from '../components/SettingsPanel'
import { UnsealPanel } from '../components/UnsealPanel'
import { useAuth } from '../lib/auth'
import { formatClock } from '../lib/time'

type RoomObject = 'clock' | 'vinyl' | 'radio' | 'calendar' | 'diary'
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
}

const roomObjectBadges: Record<RoomObject, string> = {
  clock: 'CLK',
  vinyl: 'VNL',
  radio: 'RAD',
  calendar: 'DAY',
  diary: 'NOTE',
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

export function RoomPage() {
  const { currentUser } = useAuth()
  const [searchParams] = useSearchParams()
  const initialPhoneState = useMemo(() => getInitialPhoneState(searchParams), [searchParams])
  const initialActivePhoneApp =
    currentUser || guestPhoneApps.includes(initialPhoneState.app) ? initialPhoneState.app : 'unseal'
  const [isPhoneOpen, setIsPhoneOpen] = useState(initialPhoneState.isOpen)
  const [activePhoneApp, setActivePhoneApp] = useState<PhoneApp>(initialActivePhoneApp)
  const [activeObject, setActiveObject] = useState<RoomObject | null>(null)
  const [clock, setClock] = useState(() => new Date())
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

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClock(new Date())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('mia-room-diary', diaryNote)
  }, [diaryNote])

  function openPhone(app: PhoneApp) {
    const nextApp = currentUser || guestPhoneApps.includes(app) ? app : 'unseal'
    setActivePhoneApp(nextApp)
    setIsPhoneOpen(true)
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
      <header className="room-topbar">
        <div>
          <p className="eyebrow">The Room</p>
          <h1>The Memory Room</h1>
          <p className="room-user-copy">
            {currentUser
              ? `Signed in as ${currentUser.name}. The room now acts like a living shell around Seal, History, Pricing, and guest-safe Unseal.`
              : 'Guest mode keeps the room explorable, but the phone opens only into Unseal until you pass through the gate.'}
          </p>
        </div>
        <div className="room-topbar-actions">
          <Link className="room-nav-link" to="/gate">
            Back to Gate
          </Link>
          <Link className="room-nav-link" to="/admin">
            Admin
          </Link>
        </div>
      </header>

      <section className="room-frame">
        <div className={`room-stage stage-${timeSegment}`}>
          <div className="room-atmosphere" aria-hidden="true">
            <div className="room-glow room-glow-primary" />
            <div className="room-glow room-glow-secondary" />
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
                <div className="room-info-card">
                  <p className="panel-tag">Room reading</p>
                  <h3>{currentUser ? 'Hover the room, then enter the phone' : 'Guest-safe ambient mode'}</h3>
                  <p>
                    {currentUser
                      ? 'Every hotspot now behaves like a live accent around the real product shell. The room is atmosphere; the phone is action.'
                      : 'You can explore the room, read the ambience, and open the phone into Unseal. Sign in at the gate to unlock the rest of the apps.'}
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
        </div>
      </section>
    </div>
  )
}
