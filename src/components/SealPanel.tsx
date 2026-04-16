import { useState } from 'react'
import { createAmber } from '../lib/api'
import { notifyAmbersChanged } from '../lib/amberEvents'
import { useAuth } from '../lib/auth'

function createInitialOpenAt() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
}

export function SealPanel() {
  const { currentUser, token } = useAuth()
  const [form, setForm] = useState(() => ({
    recipientEmail: '',
    message: '',
    openAt: createInitialOpenAt(),
    passcode: '',
  }))
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setResult(null)
    setIsSubmitting(true)

    try {
      if (!token) {
        throw new Error('Login is required to create amber')
      }

      const response = await createAmber(token, {
        recipientEmail: form.recipientEmail,
        message: form.message,
        openAt: new Date(form.openAt).toISOString(),
        passcode: form.passcode,
      })

      const nextOpenAt = createInitialOpenAt()
      setResult(`Created ${response.item.code} for ${response.item.recipientEmail}`)
      setForm({
        recipientEmail: '',
        message: '',
        openAt: nextOpenAt,
        passcode: '',
      })
      notifyAmbersChanged()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to create amber')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="phone-panel">
      <div className="panel-heading">
        <p className="panel-tag">Seal</p>
        <h3>Seal a new amber</h3>
      </div>

      {currentUser ? (
        <p className="helper-copy">Signed in as {currentUser.name}</p>
      ) : (
        <p className="feedback error">Login is required to use Seal.</p>
      )}

      <form className="phone-form" onSubmit={handleSubmit}>
        <label>
          Recipient email
          <input
            required
            type="email"
            value={form.recipientEmail}
            onChange={(event) =>
              setForm((current) => ({ ...current, recipientEmail: event.target.value }))
            }
          />
        </label>

        <label>
          Message
          <textarea
            required
            minLength={10}
            value={form.message}
            onChange={(event) =>
              setForm((current) => ({ ...current, message: event.target.value }))
            }
          />
        </label>

        <label>
          Open at
          <input
            required
            type="datetime-local"
            value={form.openAt}
            onChange={(event) =>
              setForm((current) => ({ ...current, openAt: event.target.value }))
            }
          />
        </label>

        <label>
          Passcode
          <input
            required
            minLength={4}
            type="password"
            value={form.passcode}
            onChange={(event) =>
              setForm((current) => ({ ...current, passcode: event.target.value }))
            }
          />
        </label>

        <button className="phone-button primary" disabled={isSubmitting || !currentUser} type="submit">
          {isSubmitting ? 'Sealing...' : 'Seal amber'}
        </button>
      </form>

      {error ? <p className="feedback error">{error}</p> : null}
      {result ? <p className="feedback success">{result}</p> : null}
    </div>
  )
}
