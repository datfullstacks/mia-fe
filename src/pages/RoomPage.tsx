import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AmberPanel } from '../components/AmberPanel'
import { HistoryPanel } from '../components/HistoryPanel'
import { PricingPanel } from '../components/PricingPanel'
import { SealPanel } from '../components/SealPanel'
import { SettingsPanel } from '../components/SettingsPanel'
import { UnsealPanel } from '../components/UnsealPanel'
import { subscribeToAmbersChanged } from '../lib/amberEvents'
import { type Amber, fetchAmbers, fetchRadioStations, type RadioStation } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatClock, formatDateTime } from '../lib/time'

type RoomDevice = 'amber' | 'clock' | 'vinyl' | 'radio' | 'calendar' | 'note'
type AmberMode = 'seal' | 'unseal'
type PhoneApp = 'amber' | 'history' | 'pricing' | 'settings'

interface DiaryEntry {
  date: string
  content: string
  updatedAt: string
}

interface VinylPreset {
  pad: number
  harmony: number
  melody: number[]
  wobbleHz: number
}

interface VinylPlayback {
  context: AudioContext
  masterGain: GainNode
  stop: () => void
}

type BrowserAudioContext = typeof AudioContext

const PHONE_APPS: PhoneApp[] = ['amber', 'history', 'pricing', 'settings']
const GUEST_PHONE_APPS: PhoneApp[] = ['settings']
const PHONE_APP_LABELS: Record<PhoneApp, string> = {
  amber: 'Amber',
  history: 'Lịch sử',
  pricing: 'Gói',
  settings: 'Cài đặt',
}
const PHONE_APP_CAPTIONS: Record<PhoneApp, string> = {
  amber: 'Số lượt còn lại',
  history: 'Các amber đã tạo',
  pricing: 'Mua thêm amber',
  settings: 'Âm thanh và tài khoản',
}
const PHONE_APP_BADGES: Record<PhoneApp, string> = {
  amber: 'AM',
  history: 'LS',
  pricing: 'GO',
  settings: 'CD',
}

const VINYL_TRACKS = [
  'Bên cửa sổ lúc hai giờ',
  'Mưa qua hiên gỗ',
  'Đèn vàng cuối ngõ',
  'Thư chưa gửi',
  'Bước chân trong đêm',
  'Sương trên mặt bàn',
  'Lặng giữa thành phố',
]

const VINYL_PRESETS: VinylPreset[] = [
  { pad: 196, harmony: 247, melody: [392, 440, 392, 330], wobbleHz: 0.18 },
  { pad: 174.61, harmony: 220, melody: [349.23, 392, 349.23, 329.63], wobbleHz: 0.14 },
  { pad: 220, harmony: 277.18, melody: [440, 493.88, 440, 369.99], wobbleHz: 0.22 },
  { pad: 164.81, harmony: 207.65, melody: [329.63, 369.99, 329.63, 293.66], wobbleHz: 0.16 },
  { pad: 185, harmony: 233.08, melody: [369.99, 415.3, 369.99, 311.13], wobbleHz: 0.2 },
  { pad: 146.83, harmony: 185, melody: [293.66, 329.63, 293.66, 261.63], wobbleHz: 0.18 },
  { pad: 207.65, harmony: 261.63, melody: [415.3, 440, 415.3, 349.23], wobbleHz: 0.24 },
]

const CALENDAR_MESSAGES = [
  'Hôm nay cứ đi chậm một chút, mọi thứ không cần gấp.',
  'Một căn phòng yên cũng đủ làm dịu cả ngày dài.',
  'Có những điều nên để thời gian nói hộ.',
  'Viết ít thôi, nhưng viết thật lòng.',
  'Nếu mệt, cứ ngồi xuống và nghe một bài nhạc.',
  'Một buổi tối ấm luôn đáng giá hơn một ngày ồn ào.',
  'Những ký ức tốt thường đến rất khẽ.',
  'Có những lá thư chỉ nên mở khi lòng đã lặng.',
  'Hôm nay hợp để giữ lại một điều đẹp.',
  'Lofi không chữa lành tất cả, nhưng đủ làm chậm tim.',
  'Nhìn ra cửa sổ một lát cũng là nghỉ ngơi.',
  'Không phải mọi câu trả lời đều cần ngay lúc này.',
  'Để lại cho ngày mai một chút dịu dàng.',
  'Điều quan trọng nhất tối nay là sự bình yên.',
  'Nhẹ thôi, vì ngày hôm nay đã đủ nặng rồi.',
]

const DIARY_STORAGE_KEY = 'mia-room-diary-entries'

function getTimeSegment(date: Date) {
  const hour = date.getHours()
  if (hour < 6) return 'midnight'
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'night'
}

function getInitialPhoneState(searchParams: URLSearchParams) {
  const requestedApp = searchParams.get('app')
  const normalizedApp = requestedApp === 'wallet' ? 'pricing' : requestedApp

  if (normalizedApp && PHONE_APPS.includes(normalizedApp as PhoneApp)) {
    return { isOpen: true, app: normalizedApp as PhoneApp }
  }

  return { isOpen: false, app: null as PhoneApp | null }
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function buildCalendarDays(cursor: Date) {
  const monthStart = startOfMonth(cursor)
  const weekday = (monthStart.getDay() + 6) % 7
  const start = addDays(monthStart, -weekday)

  return Array.from({ length: 35 }, (_, index) => {
    const date = addDays(start, index)
    return {
      key: toDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === cursor.getMonth(),
    }
  })
}

function getCalendarMessage(dateKey: string) {
  const dayNumber = Number.parseInt(dateKey.slice(-2), 10)
  return CALENDAR_MESSAGES[(dayNumber - 1) % CALENDAR_MESSAGES.length]
}

function loadDiaryEntries(): Record<string, DiaryEntry> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(DIARY_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, DiaryEntry>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function getAmberTone(amber: Amber) {
  switch (amber.status) {
    case 'scheduled':
      return 'amber-chip scheduled'
    case 'ready':
      return 'amber-chip ready'
    case 'opened':
      return 'amber-chip opened'
    case 'cancelled':
      return 'amber-chip cancelled'
    default:
      return 'amber-chip'
  }
}

function buildNoiseBuffer(context: AudioContext) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * 0.2
  }
  return buffer
}

function getAudioContextClass(): BrowserAudioContext | null {
  if (typeof window === 'undefined') return null

  return window.AudioContext || (window as Window & { webkitAudioContext?: BrowserAudioContext }).webkitAudioContext || null
}

export function RoomPage() {
  const { currentUser, token } = useAuth()
  const isGuest = !currentUser
  const [searchParams] = useSearchParams()
  const initialPhoneState = useMemo(() => getInitialPhoneState(searchParams), [searchParams])
  const [clock, setClock] = useState(() => new Date())
  const [isPhoneOpen, setIsPhoneOpen] = useState(initialPhoneState.isOpen)
  const [activePhoneApp, setActivePhoneApp] = useState<PhoneApp | null>(initialPhoneState.app)
  const [activeDevice, setActiveDevice] = useState<RoomDevice | null>(null)
  const [amberMode, setAmberMode] = useState<AmberMode>('seal')
  const [roomAmbers, setRoomAmbers] = useState<Amber[]>([])
  const [isAmberLoading, setIsAmberLoading] = useState(false)
  const [amberError, setAmberError] = useState<string | null>(null)
  const [radioStations, setRadioStations] = useState<RadioStation[]>([])
  const [isRadioLoading, setIsRadioLoading] = useState(false)
  const [radioError, setRadioError] = useState<string | null>(null)
  const [radioStationIndex, setRadioStationIndex] = useState(0)
  const [radioVolume, setRadioVolume] = useState(52)
  const [radioPlaying, setRadioPlaying] = useState(false)
  const [vinylTrackIndex, setVinylTrackIndex] = useState(0)
  const [vinylVolume, setVinylVolume] = useState(38)
  const [vinylPlaying, setVinylPlaying] = useState(false)
  const [vinylError, setVinylError] = useState<string | null>(null)
  const [calendarCursor, setCalendarCursor] = useState(() => startOfMonth(new Date()))
  const [calendarSelectedKey, setCalendarSelectedKey] = useState(() => toDateKey(new Date()))
  const [diaryEntries, setDiaryEntries] = useState<Record<string, DiaryEntry>>(() => loadDiaryEntries())
  const [diaryDate, setDiaryDate] = useState(() => toDateKey(new Date()))
  const [diaryDraft, setDiaryDraft] = useState(() => loadDiaryEntries()[toDateKey(new Date())]?.content || '')
  const [diaryFeedback, setDiaryFeedback] = useState<string | null>(null)
  const radioAudioRef = useRef<HTMLAudioElement | null>(null)
  const vinylPlaybackRef = useRef<VinylPlayback | null>(null)
  const availablePhoneApps = currentUser ? PHONE_APPS : GUEST_PHONE_APPS
  const timeSegment = getTimeSegment(clock)
  const radioStation = radioStations[radioStationIndex] ?? null
  const calendarDays = useMemo(() => buildCalendarDays(calendarCursor), [calendarCursor])
  const diaryList = useMemo(
    () => Object.values(diaryEntries).sort((left, right) => right.date.localeCompare(left.date)),
    [diaryEntries],
  )

  const stopVinylPlayback = useCallback(() => {
    const currentPlayback = vinylPlaybackRef.current
    if (!currentPlayback) return
    currentPlayback.stop()
    vinylPlaybackRef.current = null
  }, [])

  const startVinylPlayback = useCallback(async (trackIndex: number) => {
    stopVinylPlayback()
    setVinylError(null)

    try {
      const preset = VINYL_PRESETS[trackIndex] ?? VINYL_PRESETS[0]
      const AudioContextClass = getAudioContextClass()
      if (!AudioContextClass) {
        throw new Error('AudioContext is not supported in this browser')
      }

      const context = new AudioContextClass()
      const masterGain = context.createGain()
      const filter = context.createBiquadFilter()
      const padGain = context.createGain()
      const harmonyGain = context.createGain()
      const leadGain = context.createGain()
      const noiseGain = context.createGain()
      const lowLfo = context.createOscillator()
      const lfoGain = context.createGain()
      const padOsc = context.createOscillator()
      const harmonyOsc = context.createOscillator()
      const leadOsc = context.createOscillator()
      const crackle = context.createBufferSource()
      const melodyPattern = preset.melody

      await context.resume()
      if (context.state !== 'running') {
        throw new Error('AudioContext could not start')
      }

      masterGain.gain.value = Math.max(vinylVolume / 100, 0.01) * 0.36
      filter.type = 'lowpass'
      filter.frequency.value = 1800
      filter.Q.value = 0.9
      padGain.gain.value = 0.12
      harmonyGain.gain.value = 0.065
      leadGain.gain.value = 0.05
      noiseGain.gain.value = 0.016
      padOsc.type = 'triangle'
      harmonyOsc.type = 'sine'
      leadOsc.type = 'triangle'
      lowLfo.type = 'sine'
      padOsc.frequency.value = preset.pad
      harmonyOsc.frequency.value = preset.harmony
      leadOsc.frequency.value = melodyPattern[0]
      lowLfo.frequency.value = preset.wobbleHz
      lfoGain.gain.value = 180

      lowLfo.connect(lfoGain)
      lfoGain.connect(filter.frequency)
      padOsc.connect(padGain)
      harmonyOsc.connect(harmonyGain)
      leadOsc.connect(leadGain)
      padGain.connect(filter)
      harmonyGain.connect(filter)
      leadGain.connect(filter)
      crackle.buffer = buildNoiseBuffer(context)
      crackle.loop = true
      crackle.connect(noiseGain)
      noiseGain.connect(filter)
      filter.connect(masterGain)
      masterGain.connect(context.destination)

      let melodyStep = 0
      const melodyTimer = window.setInterval(() => {
        melodyStep = (melodyStep + 1) % melodyPattern.length
        leadOsc.frequency.setTargetAtTime(melodyPattern[melodyStep], context.currentTime, 0.18)
      }, 1600)

      padOsc.start()
      harmonyOsc.start()
      leadOsc.start()
      lowLfo.start()
      crackle.start()

      vinylPlaybackRef.current = {
        context,
        masterGain,
        stop: () => {
          window.clearInterval(melodyTimer)
          crackle.stop()
          padOsc.stop()
          harmonyOsc.stop()
          leadOsc.stop()
          lowLfo.stop()
          crackle.disconnect()
          padOsc.disconnect()
          harmonyOsc.disconnect()
          leadOsc.disconnect()
          lowLfo.disconnect()
          filter.disconnect()
          masterGain.disconnect()
          void context.close()
        },
      }
    } catch {
      setVinylError('Trình duyệt chưa cho phát âm thanh. Hãy bấm phát lại.')
      setVinylPlaying(false)
    }
  }, [stopVinylPlayback, vinylVolume])

  const loadRoomAmbers = useCallback(async () => {
    if (!token) {
      setRoomAmbers([])
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
      setRoomAmbers(response.items)
      setAmberError(null)
    } catch (nextError) {
      setAmberError(nextError instanceof Error ? nextError.message : 'Không tải được amber trong phòng')
    } finally {
      setIsAmberLoading(false)
    }
  }, [token])

  const loadRadioStations = useCallback(async () => {
    try {
      setIsRadioLoading(true)
      const response = await fetchRadioStations()
      setRadioStations(response.items)
      setRadioStationIndex(0)
      setRadioError(null)
    } catch (nextError) {
      setRadioError(nextError instanceof Error ? nextError.message : 'Không tải được danh sách radio')
    } finally {
      setIsRadioLoading(false)
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClock(new Date())
    }, 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    void loadRoomAmbers()
    return subscribeToAmbersChanged(() => {
      void loadRoomAmbers()
    })
  }, [loadRoomAmbers])

  useEffect(() => {
    void loadRadioStations()
  }, [loadRadioStations])

  useEffect(() => {
    if (activePhoneApp && !availablePhoneApps.includes(activePhoneApp)) {
      setActivePhoneApp(null)
    }
  }, [activePhoneApp, availablePhoneApps])

  useEffect(() => {
    window.localStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(diaryEntries))
  }, [diaryEntries])

  useEffect(() => {
    setDiaryDraft(diaryEntries[diaryDate]?.content || '')
    setDiaryFeedback(null)
  }, [diaryDate, diaryEntries])

  useEffect(() => {
    const audio = radioAudioRef.current
    if (!audio) return
    audio.volume = radioVolume / 100
  }, [radioVolume])

  useEffect(() => {
    const currentPlayback = vinylPlaybackRef.current
    if (!currentPlayback) return
    currentPlayback.masterGain.gain.value = Math.max(vinylVolume / 100, 0.01) * 0.36
  }, [vinylVolume])

  useEffect(() => {
    const audio = radioAudioRef.current
    if (!audio) return

    if (!radioStation?.streamUrl) {
      audio.pause()
      audio.removeAttribute('src')
      setRadioPlaying(false)
      return
    }

    if (audio.src !== radioStation.streamUrl) {
      audio.src = radioStation.streamUrl
      audio.load()
    }

    if (radioPlaying) {
      void audio.play().catch(() => {
        setRadioError('Trình duyệt đang chặn tự phát. Hãy bấm phát lại.')
        setRadioPlaying(false)
      })
    }
  }, [radioPlaying, radioStation])

  useEffect(() => {
    return () => {
      stopVinylPlayback()
    }
  }, [stopVinylPlayback])

  function openPhone(app?: PhoneApp) {
    setActiveDevice(null)
    setIsPhoneOpen(true)
    if (!app) {
      setActivePhoneApp(null)
      return
    }
    setActivePhoneApp(currentUser || GUEST_PHONE_APPS.includes(app) ? app : 'settings')
  }

  function openDevice(device: RoomDevice) {
    setIsPhoneOpen(false)
    setActivePhoneApp(null)
    setActiveDevice(device)
  }

  function openAmberMode(mode: AmberMode) {
    setAmberMode(currentUser ? mode : 'unseal')
    openDevice('amber')
  }

  function closeDevice() {
    setActiveDevice(null)
  }

  function saveDiaryEntry() {
    const nextContent = diaryDraft.trim()
    if (!nextContent) {
      setDiaryFeedback('Nhật ký đang trống, chưa có gì để lưu.')
      return
    }

    setDiaryEntries((current) => ({
      ...current,
      [diaryDate]: { date: diaryDate, content: nextContent, updatedAt: new Date().toISOString() },
    }))
    setDiaryFeedback('Đã lưu trang nhật ký.')
  }

  function deleteDiaryEntry() {
    setDiaryEntries((current) => {
      const nextEntries = { ...current }
      delete nextEntries[diaryDate]
      return nextEntries
    })
    setDiaryDraft('')
    setDiaryFeedback('Đã xoá trang nhật ký này.')
  }

  function handleRadioFrequencyChange(value: number) {
    if (radioStations.length === 0) return

    const nextIndex = radioStations.reduce((closestIndex, station, index) => {
      const currentDistance = Math.abs(station.frequency - value)
      const closestDistance = Math.abs(radioStations[closestIndex].frequency - value)
      return currentDistance < closestDistance ? index : closestIndex
    }, 0)

    setRadioStationIndex(nextIndex)
  }

  function toggleRadioPlayback() {
    const audio = radioAudioRef.current
    if (!radioStation?.streamUrl || !audio) {
      setRadioError('Station này hiện chưa có stream khả dụng.')
      return
    }

    if (radioPlaying) {
      audio.pause()
      setRadioPlaying(false)
      return
    }

    void audio.play().then(() => {
      setRadioPlaying(true)
      setRadioError(null)
    }).catch(() => {
      setRadioError('Trình duyệt đang chặn phát trực tiếp. Hãy thử lại.')
      setRadioPlaying(false)
    })
  }

  async function toggleVinylPlayback() {
    if (vinylPlaying) {
      stopVinylPlayback()
      setVinylPlaying(false)
      return
    }

    await startVinylPlayback(vinylTrackIndex)
    if (!vinylPlaybackRef.current) return
    setVinylPlaying(true)
  }

  async function chooseVinylTrack(index: number) {
    setVinylTrackIndex(index)
    if (!vinylPlaying) return
    await startVinylPlayback(index)
    if (!vinylPlaybackRef.current) return
    setVinylPlaying(true)
  }

  function renderPhoneApp() {
    switch (activePhoneApp) {
      case 'amber':
        return (
          <AmberPanel
            onOpenHistory={() => setActivePhoneApp('history')}
            onOpenPricing={() => setActivePhoneApp('pricing')}
          />
        )
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

  function renderDeviceContent() {
    if (activeDevice === 'amber') {
      return (
        <div className="device-panel amber-device-panel">
          <div className="device-mode-row">
            {currentUser ? (
              <button
                className={amberMode === 'seal' ? 'mode-chip active' : 'mode-chip'}
                onClick={() => setAmberMode('seal')}
                type="button"
              >
                Lưu hổ phách
              </button>
            ) : null}
            <button
              className={amberMode === 'unseal' ? 'mode-chip active' : 'mode-chip'}
              onClick={() => setAmberMode('unseal')}
              type="button"
            >
              Mở hổ phách
            </button>
          </div>
          <div className="device-panel-surface">
            {amberMode === 'seal' && currentUser ? <SealPanel /> : <UnsealPanel />}
          </div>
        </div>
      )
    }

    if (activeDevice === 'clock') {
      return (
        <div className="device-panel">
          <div className="clock-device">
            <div className="clock-display">{formatClock(clock)}</div>
            <div className="clock-meta">
              <strong>{clock.toLocaleDateString('vi-VN', { weekday: 'long' })}</strong>
              <span>{clock.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
            </div>
          </div>
        </div>
      )
    }

    if (activeDevice === 'vinyl') {
      return (
        <div className="device-panel">
          <div className="vinyl-device">
            <div className={vinylPlaying ? 'vinyl-device-disc spinning' : 'vinyl-device-disc'} />
            <div className="vinyl-device-meta">
              <span className="mono-label">Đang chọn</span>
              <strong>{VINYL_TRACKS[vinylTrackIndex]}</strong>
            </div>
          </div>
          <label className="slider-field">
            Âm lượng
            <input max={100} min={0} type="range" value={vinylVolume} onChange={(event) => setVinylVolume(Number(event.target.value))} />
          </label>
          <div className="button-row compact-actions">
            <button className="phone-button primary" onClick={() => void toggleVinylPlayback()} type="button">
              {vinylPlaying ? 'Tạm dừng' : 'Phát'}
            </button>
          </div>
          {vinylError ? <p className="feedback error">{vinylError}</p> : null}
          <div className="track-list">
            {VINYL_TRACKS.map((track, index) => (
              <button
                key={track}
                className={index === vinylTrackIndex ? 'track-row active' : 'track-row'}
                onClick={() => void chooseVinylTrack(index)}
                type="button"
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{track}</strong>
              </button>
            ))}
          </div>
        </div>
      )
    }

    if (activeDevice === 'radio') {
      return (
        <div className="device-panel">
          <div className="radio-device">
            <div className="radio-frequency-display">
              <strong>{radioStation ? radioStation.frequency.toFixed(1) : '88.1'} FM</strong>
              <span>{radioStation?.name || 'Đang tìm station'}</span>
            </div>
            <label className="slider-field">
              Tần số
              <input
                max={radioStations.length > 0 ? radioStations[radioStations.length - 1].frequency : 108}
                min={radioStations.length > 0 ? radioStations[0].frequency : 88}
                step={0.1}
                type="range"
                value={radioStation?.frequency ?? 88.1}
                onChange={(event) => handleRadioFrequencyChange(Number(event.target.value))}
              />
            </label>
            <label className="slider-field">
              Âm lượng
              <input max={100} min={0} type="range" value={radioVolume} onChange={(event) => setRadioVolume(Number(event.target.value))} />
            </label>
            <div className="button-row compact-actions">
              <button className="phone-button primary" onClick={toggleRadioPlayback} type="button">
                {radioPlaying ? 'Tạm dừng' : 'Phát'}
              </button>
              <button className="phone-button ghost" onClick={() => void loadRadioStations()} type="button">
                Làm mới
              </button>
            </div>
          </div>
          {isRadioLoading ? <p className="feedback">Đang tải radio Việt...</p> : null}
          {radioError ? <p className="feedback error">{radioError}</p> : null}
          {radioStation ? (
            <article className="phone-card">
              <div className="phone-card-head">
                <div>
                  <span className="mono-label">{radioStation.frequency.toFixed(1)} FM</span>
                  <h4>{radioStation.name}</h4>
                </div>
              </div>
              <p>{radioStation.tags.length > 0 ? radioStation.tags.join(' · ') : 'Radio Việt / tổng hợp'}</p>
            </article>
          ) : null}
        </div>
      )
    }

    if (activeDevice === 'calendar') {
      return (
        <div className="device-panel">
          <div className="calendar-device-head">
            <button className="phone-button ghost" onClick={() => setCalendarCursor(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1))} type="button">
              Tháng trước
            </button>
            <h3>{calendarCursor.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</h3>
            <button className="phone-button ghost" onClick={() => setCalendarCursor(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1))} type="button">
              Tháng sau
            </button>
          </div>
          <div className="calendar-weekdays">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {calendarDays.map((day) => (
              <button
                key={day.key}
                className={
                  day.key === calendarSelectedKey
                    ? `calendar-cell active${day.inMonth ? '' : ' muted'}`
                    : `calendar-cell${day.inMonth ? '' : ' muted'}`
                }
                onClick={() => setCalendarSelectedKey(day.key)}
                type="button"
              >
                {day.day}
              </button>
            ))}
          </div>
          <article className="phone-card calendar-message-card">
            <span className="mono-label">{calendarSelectedKey}</span>
            <p>{getCalendarMessage(calendarSelectedKey)}</p>
          </article>
        </div>
      )
    }

    if (activeDevice === 'note') {
      return (
        <div className="device-panel device-panel-note">
          <div className="note-device">
            <aside className="note-sidebar">
              <label className="stacked-field">
                Chọn ngày
                <input type="date" value={diaryDate} onChange={(event) => setDiaryDate(event.target.value)} />
              </label>
              <div className="note-entry-list">
                {diaryList.length === 0 ? (
                  <p className="helper-copy">Chưa có trang nhật ký nào.</p>
                ) : (
                  diaryList.map((entry) => (
                    <button
                      key={entry.date}
                      className={entry.date === diaryDate ? 'note-entry-item active' : 'note-entry-item'}
                      onClick={() => setDiaryDate(entry.date)}
                      type="button"
                    >
                      <strong>{entry.date}</strong>
                      <small>{formatDateTime(entry.updatedAt)}</small>
                    </button>
                  ))
                )}
              </div>
            </aside>
            <div className="note-editor">
              <div className="note-paper">
                <div className="note-paper-head">
                  <span className="mono-label">{diaryDate}</span>
                  <strong>Trang nhật ký</strong>
                </div>
                <textarea
                  className="note-textarea"
                  placeholder="Viết lại điều gì đó cho ngày hôm nay..."
                  value={diaryDraft}
                  onChange={(event) => setDiaryDraft(event.target.value)}
                />
              </div>
              <div className="button-row compact-actions">
                <button className="phone-button primary" onClick={saveDiaryEntry} type="button">
                  Lưu trang
                </button>
                <button className="phone-button ghost" onClick={deleteDiaryEntry} type="button">
                  Xoá trang
                </button>
              </div>
              {diaryFeedback ? <p className="feedback success">{diaryFeedback}</p> : null}
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="room-shell room-shell-lofi">
      <section className={`room-stage room-stage-lofi stage-${timeSegment}`}>
        <div className="lofi-scene" aria-hidden="true">
          <div className="lofi-glow lofi-glow-left" />
          <div className="lofi-glow lofi-glow-right" />
          <div className="lofi-window"><div className="lofi-window-light" /></div>
          <div className="lofi-lamp" />
          <div className="lofi-shelf"><span /><span /><span /></div>
          <div className="lofi-poster lofi-poster-left" />
          <div className="lofi-poster lofi-poster-right" />
          <div className="lofi-plant" />
          <div className="lofi-desk" />
        </div>

        <div className={isGuest ? 'room-grid-vn room-grid-vn-guest' : 'room-grid-vn'}>
          <button className="room-object-vn room-object-vn-clock" onClick={() => openDevice('clock')} type="button">
            <span className="room-object-kicker">Đồng hồ</span>
            <strong>{formatClock(clock)}</strong>
            <small>Giờ trong phòng</small>
          </button>

          <button className="room-object-vn room-object-vn-calendar" onClick={() => openDevice('calendar')} type="button">
            <span className="room-object-kicker">Lịch</span>
            <strong>{clock.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</strong>
            <small>Ngày và thông điệp</small>
          </button>

          <section className="amber-tray-vn">
            <div className="amber-tray-head">
              <div>
                <span className="room-object-kicker">Hổ phách</span>
                <strong>{currentUser ? `${currentUser.amberQuota.remainingCredits} amber còn lại` : 'Mở amber dành cho khách'}</strong>
              </div>
            </div>
            <div className="amber-action-row">
              {currentUser ? (
                <button className="phone-button primary" onClick={() => openAmberMode('seal')} type="button">
                  Lưu hổ phách
                </button>
              ) : null}
              <button className="phone-button ghost" onClick={() => openAmberMode('unseal')} type="button">
                Mở hổ phách
              </button>
            </div>
            {currentUser ? (
              <>
                {isAmberLoading ? <p className="helper-copy">Đang kiểm tra amber trên bàn...</p> : null}
                {amberError ? <p className="feedback error">{amberError}</p> : null}
                {!isAmberLoading && !amberError && roomAmbers.length > 0 ? (
                  <div className="amber-chip-row">
                    {roomAmbers.map((amber) => (
                      <span key={amber.id} className={getAmberTone(amber)}>
                        <span>{amber.code}</span>
                        <strong>{amber.recipientEmail.split('@')[0]}</strong>
                      </span>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="helper-copy">Khách chỉ có thể mở amber. Quản lý amber nằm trong điện thoại sau khi đăng nhập.</p>
            )}
          </section>

          <button className="room-object-vn room-object-vn-vinyl" onClick={() => openDevice('vinyl')} type="button">
            <div className="vinyl-mini-disc" />
            <span className="room-object-kicker">Đĩa than</span>
            <strong>{VINYL_TRACKS[vinylTrackIndex]}</strong>
            <small>{vinylPlaying ? 'Đang phát lofi' : 'Nhấn để mở player'}</small>
          </button>

          <button className="room-object-vn room-object-vn-radio" onClick={() => openDevice('radio')} type="button">
            <span className="room-object-kicker">Radio</span>
            <strong>{radioStation ? `${radioStation.frequency.toFixed(1)} FM` : '88.1 FM'}</strong>
            <small>{radioStation?.name || 'Station Việt chọn lọc'}</small>
          </button>

          {!isGuest ? (
            <button className="room-object-vn room-object-vn-note" onClick={() => openDevice('note')} type="button">
              <span className="room-object-kicker">Nhật ký</span>
              <strong>{diaryEntries[diaryDate] ? 'Đã có trang hôm nay' : 'Mở sổ viết'}</strong>
              <small>Viết, sửa và xem lại theo ngày</small>
            </button>
          ) : null}

          <button className="room-object-vn room-object-vn-phone" onClick={() => openPhone()} type="button">
            <div className="phone-mini-frame"><span /></div>
            <span className="room-object-kicker">Điện thoại</span>
            <strong>{isGuest ? 'Cài đặt nhanh' : 'Quản lý của bạn'}</strong>
            <small>{isGuest ? 'Chỉ còn app cài đặt' : 'Amber, lịch sử và gói mua'}</small>
          </button>
        </div>

        <audio ref={radioAudioRef} preload="none" />

        {activeDevice ? (
          <div className="device-overlay-vn">
            <div className={activeDevice === 'note' ? 'device-sheet-vn device-sheet-vn-note' : 'device-sheet-vn'}>
              <div className="device-sheet-topbar">
                <button className="icon-button" onClick={closeDevice} type="button">
                  ×
                </button>
              </div>
              <div className="device-sheet-body">{renderDeviceContent()}</div>
            </div>
          </div>
        ) : null}

        {isPhoneOpen ? (
          <div className="device-overlay-vn phone-overlay-vn">
            <div className="smartphone-shell">
              <div className="smartphone-screen">
                <div className="smartphone-statusbar">
                  <span>{formatClock(clock).slice(0, 5)}</span>
                  <div className="smartphone-status-icons" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>

                <div className="smartphone-toolbar">
                  {activePhoneApp ? (
                    <button className="icon-button" onClick={() => setActivePhoneApp(null)} type="button">
                      ‹
                    </button>
                  ) : (
                    <span className="icon-button ghost-space" />
                  )}
                  <button className="icon-button" onClick={() => setIsPhoneOpen(false)} type="button">
                    ×
                  </button>
                </div>

                <div className="phone-app-body phone-app-body-vn">
                  {activePhoneApp ? (
                    renderPhoneApp()
                  ) : (
                    <div className="phone-home-screen phone-home-screen-vn">
                      <div className="phone-home-grid phone-home-grid-vn">
                        {availablePhoneApps.map((app) => (
                          <button key={app} className="phone-app-icon phone-app-icon-vn" onClick={() => setActivePhoneApp(app)} type="button">
                            <span className="phone-app-icon-badge">{PHONE_APP_BADGES[app]}</span>
                            <strong>{PHONE_APP_LABELS[app]}</strong>
                            <small>{PHONE_APP_CAPTIONS[app]}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
