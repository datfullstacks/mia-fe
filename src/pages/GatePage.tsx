import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function GatePage() {
  const navigate = useNavigate()
  const { login, register } = useAuth()
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

  return (
    <div className="gate-shell">
      <section className="gate-panel gate-copy">
        <p className="eyebrow">MIA Gate</p>
        <h1>Moments in Amber</h1>
        <p>
          A web experience for sealing a message, leaving it in a warm room, and
          returning only when time allows it to open.
        </p>
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

        <p className="helper-copy">
          Seed accounts: `admin@mia.local / admin123` and `dat@mia.local / dat12345`.
        </p>

        <Link className="subtle-link" to="/admin">
          Open admin placeholder
        </Link>
      </section>
    </div>
  )
}
