import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { usePageMeta } from '../lib/pageMeta'

export function GatePage() {
  const navigate = useNavigate()
  const { login, register } = useAuth()
  usePageMeta({
    title: 'MIA Gate | Gửi một lời nhắn cho bạn và bạn bè trong tương lai',
    description:
      'MIA là nơi bạn có thể cất giữ một lời nhắn, hẹn ngày mở lại và gửi đến chính mình hoặc bạn bè trong tương lai.',
  })
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enterRoom() {
    setError(null)
    setIsSubmitting(true)

    try {
      if (mode === 'login') {
        await login({
          email: form.email,
          password: form.password,
        })
      } else {
        await register({
          name: form.name,
          email: form.email,
          password: form.password,
        })
      }

      navigate('/room')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to authenticate')
    } finally {
      setIsSubmitting(false)
    }
  }

  function openGuestUnlock() {
    navigate('/room?app=unseal')
  }

  function openAdminPortal() {
    navigate('/admin')
  }

  return (
    <div className="gate-shell">
      <section className="gate-panel gate-copy">
        <div className="gate-copy-ornament gate-copy-ornament-top" aria-hidden="true" />
        <div className="gate-copy-ornament gate-copy-ornament-bottom" aria-hidden="true" />
        <p className="eyebrow">MIA Gate</p>
        <h1>Gửi một lời nhắn cho bạn và bạn bè trong tương lai.</h1>
        <p>
          MIA là nơi bạn có thể cất giữ một lời nhắn, hẹn ngày mở lại, và gửi nó
          đến chính mình hoặc những người bạn muốn nhớ đến sau này.
        </p>
        <div className="gate-copy-tags">
          <span>Hẹn ngày mở lại</span>
          <span>Gửi cho chính mình</span>
          <span>Lưu cho bạn bè</span>
        </div>
        <div className="gate-copy-card">
          <strong>Một lời nhắn có thể mở ra đúng thời điểm.</strong>
          <p>
            Viết lại điều bạn muốn giữ, khóa nó bằng amber, và để thời gian trả lại
            vào lúc nó thực sự có ý nghĩa.
          </p>
        </div>
      </section>

      <section className="gate-panel gate-form">
        <p className="panel-tag">Gate</p>
        <h2>Enter the room</h2>
        <div className="auth-toggle">
          <button
            className={mode === 'login' ? 'chip active' : 'chip'}
            onClick={() => setMode('login')}
            type="button"
          >
            Login
          </button>
          <button
            className={mode === 'register' ? 'chip active' : 'chip'}
            onClick={() => setMode('register')}
            type="button"
          >
            Register
          </button>
        </div>
        <form
          className="phone-form compact"
          onSubmit={(event) => {
            event.preventDefault()
            void enterRoom()
          }}
        >
          {mode === 'register' ? (
            <label>
              Name
              <input
                placeholder="Your display name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
          ) : null}
          <label>
            Email
            <input
              placeholder="you@example.com"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
            />
          </label>
          <label>
            Password
            <input
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
            />
          </label>
          <button className="phone-button primary" disabled={isSubmitting} type="submit">
            {isSubmitting
              ? mode === 'login'
                ? 'Entering...'
                : 'Creating account...'
              : mode === 'login'
                ? 'Enter room'
                : 'Create account'}
          </button>
        </form>

        {error ? <p className="feedback error">{error}</p> : null}

        <button className="phone-button ghost full-width" onClick={openGuestUnlock} type="button">
          Open amber as guest
        </button>

        <button className="phone-button ghost full-width" onClick={openAdminPortal} type="button">
          Open admin
        </button>

        <p className="helper-copy">
          Seed accounts: `admin@mia.local / admin123` and `dat@mia.local / dat12345`.
        </p>
      </section>
    </div>
  )
}
