import { useEffect, useState } from 'react'
import { unsealAmber, type UnsealResult } from '../lib/api'
import { formatDateTime, getCountdownText } from '../lib/time'
import { StatusPill } from './StatusPill'

export function UnsealPanel() {
  const [code, setCode] = useState('')
  const [passcode, setPasscode] = useState('')
  const [result, setResult] = useState<UnsealResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setResult(null)

    try {
      const response = await unsealAmber({
        code: code.trim(),
        passcode: passcode,
      })
      setResult(response.item)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to check amber')
    }
  }

  const countdown =
    result && new Date(result.openAt).getTime() > nowMs
      ? getCountdownText(result.openAt, nowMs)
      : null

  return (
    <div className="phone-panel">
      <div className="panel-heading">
        <p className="panel-tag">Unseal</p>
        <h3>Guest unlock flow prototype</h3>
      </div>

      <form className="phone-form compact" onSubmit={handleSubmit}>
        <label>
          Amber code
          <input value={code} onChange={(event) => setCode(event.target.value)} />
        </label>
        <label>
          Passcode
          <input
            type="password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
          />
        </label>
        <button className="phone-button primary" type="submit">
          Check amber
        </button>
      </form>

      <p className="helper-copy">
        Guest unlock is now backed by a real Express route using amber code and passcode.
      </p>

      {error ? <p className="feedback error">{error}</p> : null}

      {result ? (
        <article className="phone-card">
          <div className="phone-card-head">
            <div>
              <span className="mono-label">{result.code}</span>
              <h4>{result.recipientEmail}</h4>
            </div>
            <StatusPill status={result.state === 'opened' ? 'opened' : 'scheduled'} />
          </div>
          <p className="helper-copy">Opens {formatDateTime(result.openAt)}</p>
          {countdown ? <p className="countdown">{countdown}</p> : null}
          {result.state === 'not_ready' ? (
            <p>Amber found, but it is still sealed.</p>
          ) : null}
          {result.message ? <p>{result.message}</p> : null}
        </article>
      ) : null}
    </div>
  )
}
