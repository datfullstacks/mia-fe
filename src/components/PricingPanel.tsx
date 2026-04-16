import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPayment, fetchPayment, fetchPayments, type Payment } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDateTime } from '../lib/time'
import { StatusPill } from './StatusPill'

const SUCCESS_STATUSES = new Set<Payment['status']>(['paid', 'approved_manual'])

function formatVnd(amount: number) {
  return amount.toLocaleString('vi-VN') + ' VND'
}

function formatCountdown(expiresAt: string | null, now: number) {
  if (!expiresAt) {
    return null
  }

  const remainingMs = new Date(expiresAt).getTime() - now

  if (remainingMs <= 0) {
    return 'Order expired'
  }

  const totalSeconds = Math.floor(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `Expires in ${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function PricingPanel() {
  const { currentUser, token, refreshSession } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null)
  const [activePayment, setActivePayment] = useState<Payment | null>(null)
  const [note, setNote] = useState('MIA Pro upgrade')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [isCreating, setIsCreating] = useState(false)

  const syncPaymentIntoState = useCallback((payment: Payment) => {
    setActivePayment(payment)
    setPayments((current) => {
      const existing = current.find((item) => item.id === payment.id)

      if (!existing) {
        return [payment, ...current]
      }

      return current.map((item) => (item.id === payment.id ? payment : item))
    })
  }, [])

  const loadPayments = useCallback(async () => {
    try {
      if (!token) {
        setPayments([])
        setActivePaymentId(null)
        setActivePayment(null)
        return
      }

      const response = await fetchPayments(token)
      setPayments(response.items)
      setError(null)
      setActivePaymentId((current) => {
        if (current && response.items.some((item) => item.id === current)) {
          return current
        }

        const firstPending = response.items.find((item) => item.status === 'pending')
        return firstPending?.id || response.items[0]?.id || null
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load payments')
    }
  }, [token])

  const loadPaymentDetail = useCallback(
    async (paymentId: string) => {
      if (!token) {
        return
      }

      try {
        const response = await fetchPayment(token, paymentId)
        syncPaymentIntoState(response.item)

        if (SUCCESS_STATUSES.has(response.item.status) && currentUser?.tier !== 'pro') {
          await refreshSession()
        }
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to refresh payment')
      }
    },
    [currentUser?.tier, refreshSession, syncPaymentIntoState, token],
  )

  useEffect(() => {
    void loadPayments()
  }, [loadPayments])

  useEffect(() => {
    if (!activePaymentId) {
      setActivePayment(null)
      return
    }

    void loadPaymentDetail(activePaymentId)
  }, [activePaymentId, loadPaymentDetail])

  useEffect(() => {
    if (!activePaymentId || !activePayment || activePayment.status !== 'pending') {
      return
    }

    const intervalId = window.setInterval(() => {
      void loadPaymentDetail(activePaymentId)
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [activePayment, activePaymentId, loadPaymentDetail])

  useEffect(() => {
    if (!activePayment || activePayment.status !== 'pending') {
      return
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [activePayment])

  async function handleRequest() {
    try {
      if (!token) {
        throw new Error('Login is required to create a payment QR')
      }

      setIsCreating(true)
      const response = await createPayment(token, {
        note: note,
      })
      syncPaymentIntoState(response.item)
      setActivePaymentId(response.item.id)
      setResult(`QR ready for ${response.item.paymentRef}`)
      setError(null)
      await loadPayments()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to create payment QR')
    } finally {
      setIsCreating(false)
    }
  }

  const countdown = useMemo(() => formatCountdown(activePayment?.expiresAt || null, now), [activePayment, now])

  return (
    <div className="phone-panel">
      <div className="panel-heading">
        <p className="panel-tag">Pricing</p>
        <h3>Upgrade to Pro</h3>
      </div>

      <div className="pricing-grid">
        <div className="qr-frame" aria-hidden={activePayment?.qrUrl ? undefined : true}>
          {activePayment?.qrUrl ? (
            <img alt={`QR for ${activePayment.paymentRef}`} className="qr-image" src={activePayment.qrUrl} />
          ) : (
            <div className="qr-placeholder">
              <span>MIA PRO</span>
            </div>
          )}
        </div>
        <div className="pricing-copy">
          <p>
            Pick the Pro upgrade, scan the dedicated SePay QR, and keep the transfer description
            unchanged. MIA will activate Pro automatically when the webhook matches the payment ref
            and amount.
          </p>
          <ul className="plain-list compact">
            <li>Current tier: {currentUser ? currentUser.tier : 'guest'}</li>
            <li>Flow target: QR scan, transfer, webhook, auto-activate</li>
            <li>Admin fallback remains available for review-only cases</li>
          </ul>
        </div>
      </div>

      <label className="stacked-field">
        Internal note
        <input value={note} onChange={(event) => setNote(event.target.value)} />
      </label>

      <button
        className="phone-button primary"
        disabled={!currentUser || currentUser.tier === 'pro' || isCreating}
        onClick={() => void handleRequest()}
        type="button"
      >
        {currentUser?.tier === 'pro'
          ? 'Pro already active'
          : isCreating
            ? 'Preparing QR...'
            : 'Create SePay QR'}
      </button>

      {error ? <p className="feedback error">{error}</p> : null}
      {result ? <p className="feedback success">{result}</p> : null}

      {activePayment ? (
        <article className="phone-card pricing-active-card">
          <div className="phone-card-head">
            <div>
              <span className="mono-label">{activePayment.paymentRef}</span>
              <h4>{formatVnd(activePayment.amount)}</h4>
            </div>
            <StatusPill status={activePayment.status} />
          </div>
          <dl className="mini-meta">
            <div>
              <dt>Bank</dt>
              <dd>{activePayment.bankName}</dd>
            </div>
            <div>
              <dt>Account</dt>
              <dd>{activePayment.accountNumber}</dd>
            </div>
            <div>
              <dt>Holder</dt>
              <dd>{activePayment.accountName || 'Configured in SePay'}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{activePayment.paymentRef}</dd>
            </div>
          </dl>
          <p className="helper-copy">
            Do not edit the transfer description. MIA matches the webhook by this payment ref.
          </p>
          {countdown ? <p className="countdown">{countdown}</p> : null}
          {activePayment.status === 'pending_review' ? (
            <p className="feedback error">
              A transfer was detected but it did not match cleanly. Admin review is required.
            </p>
          ) : null}
          {activePayment.status === 'paid' ? (
            <p className="feedback success">Payment confirmed by SePay. Pro is now active.</p>
          ) : null}
          {activePayment.status === 'approved_manual' ? (
            <p className="feedback success">This order was manually approved by admin.</p>
          ) : null}
        </article>
      ) : null}

      <div className="phone-card-list">
        {payments.map((payment) => (
          <article className="phone-card" key={payment.id}>
            <div className="phone-card-head">
              <div>
                <span className="mono-label">{payment.paymentRef}</span>
                <h4>{formatVnd(payment.amount)}</h4>
              </div>
              <StatusPill status={payment.status} />
            </div>
            <p>{payment.note || 'No note'}</p>
            <dl className="mini-meta">
              <div>
                <dt>Created</dt>
                <dd>{formatDateTime(payment.createdAt)}</dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>{payment.expiresAt ? formatDateTime(payment.expiresAt) : 'No expiry'}</dd>
              </div>
              <div>
                <dt>Paid</dt>
                <dd>{payment.paidAt ? formatDateTime(payment.paidAt) : 'Waiting'}</dd>
              </div>
              <div>
                <dt>Provider Tx</dt>
                <dd>{payment.providerTransactionId || 'Pending webhook'}</dd>
              </div>
            </dl>
            <div className="button-row">
              <button
                className="phone-button ghost"
                onClick={() => {
                  setActivePaymentId(payment.id)
                  setResult(null)
                }}
                type="button"
              >
                Open checkout
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
