import { useCallback, useEffect, useState } from 'react'
import { createPayment, fetchPayments, type Payment } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDateTime } from '../lib/time'
import { StatusPill } from './StatusPill'

export function WalletPanel() {
  const { currentUser, token } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [note, setNote] = useState('MIA PRO request')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const loadPayments = useCallback(async () => {
    try {
      if (!token) {
        setPayments([])
        return
      }

      const response = await fetchPayments(token)
      setPayments(response.items)
      setError(null)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load payments')
    }
  }, [token])

  useEffect(() => {
    void loadPayments()
  }, [loadPayments])

  async function handleRequest() {
    try {
      if (!token) {
        throw new Error('Login is required to create a payment request')
      }

      const response = await createPayment(token, {
        amount: 99000,
        note: note,
      })
      setResult(`Created ${response.item.paymentRef}`)
      setError(null)
      await loadPayments()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to request upgrade')
    }
  }

  return (
    <div className="phone-panel">
      <div className="panel-heading">
        <p className="panel-tag">Wallet</p>
        <h3>Manual Pro upgrade</h3>
      </div>

      <div className="wallet-grid">
        <div className="qr-placeholder" aria-hidden="true">
          <span>MIA PRO</span>
        </div>
        <div className="wallet-copy">
          <p>
            Wallet now writes payment requests to the Express backend. Approval still happens
            from the admin screen.
          </p>
          <ul className="plain-list compact">
            <li>Identifier: MIA PRO {currentUser ? currentUser.id : '{guest}'}</li>
            <li>Current tier: {currentUser ? currentUser.tier : 'guest'}</li>
            <li>Flow target: request, review, approve</li>
          </ul>
        </div>
      </div>

      <label className="stacked-field">
        Transfer note
        <input value={note} onChange={(event) => setNote(event.target.value)} />
      </label>

      <button className="phone-button primary" disabled={!currentUser} onClick={() => void handleRequest()} type="button">
        Request Pro upgrade
      </button>

      {error ? <p className="feedback error">{error}</p> : null}
      {result ? <p className="feedback success">{result}</p> : null}

      <div className="phone-card-list">
        {payments.map((payment) => (
          <article className="phone-card" key={payment.id}>
            <div className="phone-card-head">
              <div>
                <span className="mono-label">{payment.paymentRef}</span>
                <h4>{payment.amount.toLocaleString()} VND</h4>
              </div>
              <StatusPill status={payment.status === 'approved' ? 'opened' : 'scheduled'} />
            </div>
            <p>{payment.note || 'No note'}</p>
            <p className="helper-copy">Created {formatDateTime(payment.createdAt)}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
