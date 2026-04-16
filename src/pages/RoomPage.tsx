import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { HistoryPanel } from '../components/HistoryPanel'
import { SealPanel } from '../components/SealPanel'
import { SettingsPanel } from '../components/SettingsPanel'
import { UnsealPanel } from '../components/UnsealPanel'
import { WalletPanel } from '../components/WalletPanel'
import { useAuth } from '../lib/auth'
import { formatClock } from '../lib/time'

type RoomObject = 'clock' | 'vinyl' | 'radio' | 'calendar' | 'diary'
type PhoneApp = 'seal' | 'unseal' | 'history' | 'wallet' | 'settings'

const phoneApps: PhoneApp[] = ['seal', 'unseal', 'history', 'wallet', 'settings']
const guestPhoneApps: PhoneApp[] = ['unseal', 'settings']
const phoneAppLabels: Record<PhoneApp, string> = {
  seal: 'Seal',
  unseal: 'Unseal',
  history: 'History',
  wallet: 'Wallet',
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

function getInitialPhoneState(searchParams: URLSearchParams) {
  const requestedApp = searchParams.get('app')

  if (requestedApp && phoneApps.includes(requestedApp as PhoneApp)) {
    return {
      isOpen: true,
      app: requestedApp as PhoneApp,
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
      case 'wallet':
        return <WalletPanel />
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
          <h1>Interactive MIA room prototype</h1>
          <p className="room-user-copy">
            {currentUser
              ? `Signed in as ${currentUser.name}. Seal, track, and upgrade from the phone.`
              : 'Guest mode keeps the room open, but only the Unseal flow is available.'}
          </p>
        </div>
        <div className="room-topbar-actions">
          <Link className="subtle-link" to="/gate">
            Back to Gate
          </Link>
          <Link className="subtle-link" to="/admin">
            Admin
          </Link>
        </div>
      </header>

      <section className="room-frame">
        <div className="room-stage">
          <button
            className="room-object object-clock"
            onClick={() => setActiveObject('clock')}
            type="button"
          >
            <span className="object-dot" />
            <strong>Clock</strong>
            <small>{formatClock(clock)}</small>
          </button>

          <button
            className="room-object object-vinyl"
            onClick={() => setActiveObject('vinyl')}
            type="button"
          >
            <span className="object-dot" />
            <div className={vinylPlaying ? 'vinyl-disc spinning' : 'vinyl-disc'} />
            <strong>Vinyl Player</strong>
          </button>

          <button
            className="room-object object-radio"
            onClick={() => setActiveObject('radio')}
            type="button"
          >
            <span className="object-dot" />
            <strong>Radio</strong>
            <small>{selectedRadio}</small>
          </button>

          <button
            className="room-object object-calendar"
            onClick={() => setActiveObject('calendar')}
            type="button"
          >
            <span className="object-dot" />
            <strong>Calendar</strong>
            <small>{clock.toLocaleDateString()}</small>
          </button>

          <button
            className="room-object object-diary"
            onClick={() => setActiveObject('diary')}
            type="button"
          >
            <span className="object-dot" />
            <strong>Diary</strong>
          </button>

          <button
            className="room-object object-phone"
            onClick={() => openPhone(currentUser ? 'seal' : 'unseal')}
            type="button"
          >
            <span className="object-dot" />
            <div className="phone-silhouette">
              <span />
            </div>
            <strong>Smartphone OS</strong>
            <small>{currentUser ? 'Open apps' : 'Guest unlock'}</small>
          </button>

          <aside className="room-info">
            {!activeObject ? (
              <div className="room-info-card">
                <p className="panel-tag">Room status</p>
                <h3>{currentUser ? 'Select an object' : 'Guest room access'}</h3>
                <p>
                  {currentUser
                    ? 'The room now mirrors the doc structure: object hotspots outside, phone apps inside, and real Express-backed flows for seal, unseal, payments, and admin.'
                    : 'You can explore the room visuals, but the phone will open directly into Unseal until you sign in at the gate.'}
                </p>
              </div>
            ) : null}

            {activeObject === 'clock' ? (
              <div className="room-info-card">
                <p className="panel-tag">Clock</p>
                <h3>{formatClock(clock)}</h3>
                <p>The room clock is live and anchored to the browser time.</p>
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
                  {vinylPlaying ? 'Pause disc' : 'Spin disc'}
                </button>
              </div>
            ) : null}

            {activeObject === 'radio' ? (
              <div className="room-info-card">
                <p className="panel-tag">Radio</p>
                <h3>Ambient channels</h3>
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
                <h3>{clock.toLocaleDateString()}</h3>
                <p>{quotes[clock.getDate() % quotes.length]}</p>
              </div>
            ) : null}

            {activeObject === 'diary' ? (
              <div className="room-info-card">
                <p className="panel-tag">Diary</p>
                <h3>Quick note</h3>
                <textarea
                  className="room-textarea"
                  placeholder="Write a short room note..."
                  value={diaryNote}
                  onChange={(event) => setDiaryNote(event.target.value)}
                />
              </div>
            ) : null}
          </aside>

          {isPhoneOpen ? (
            <div className="phone-overlay">
              <div className="phone-window">
                <header className="phone-window-head">
                  <div>
                    <p className="panel-tag">Smartphone OS</p>
                    <h3>{phoneAppLabels[activePhoneApp]}</h3>
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
