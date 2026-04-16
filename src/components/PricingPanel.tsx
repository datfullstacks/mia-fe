import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPayment, fetchPayment, fetchPaymentPlans, fetchPayments, type Payment, type PaymentPlan } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDateTime } from '../lib/time'
import { StatusPill } from './StatusPill'

const SUCCESS_STATUSES = new Set<Payment['status']>(['paid', 'approved_manual'])

function formatVnd(amount: number) {
  return amount.toLocaleString('vi-VN') + ' VND'
}

function getPaidLabel(payment: Payment) {
  if (payment.paidAt) {
    return formatDateTime(payment.paidAt)
  }

  if (payment.status === 'paid') {
    return 'Confirmed'
  }

  return 'Waiting'
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
  const [plans, setPlans] = useState<PaymentPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [payments, setPayments] = useState<Payment[]>([])
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null)
  const [activePayment, setActivePayment] = useState<Payment | null>(null)
  const [note, setNote] = useState('Amber package purchase')
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

  useEffect(() => {
    async function loadPlans() {
      try {
        const response = await fetchPaymentPlans()
        setPlans(response.items)
        setSelectedPlanId((current) => current || response.items[0]?.id || '')
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load pricing plans')
      }
    }

    void loadPlans()
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

        if (SUCCESS_STATUSES.has(response.item.status)) {
          await refreshSession()
        }
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to refresh payment')
      }
    },
    [refreshSession, syncPaymentIntoState, token],
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

      if (!selectedPlanId) {
        throw new Error('Choose a pricing package first')
      }

      setIsCreating(true)
      const response = await createPayment(token, {
        note: note,
        planId: selectedPlanId,
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
  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) || plans[0] || null

  return (
    <div className="phone-panel">
      <div className="panel-heading">
        <p className="panel-tag">Pricing</p>
        <h3>Buy more amber</h3>
      </div>

      <div className="pricing-grid">
        <div className="qr-frame" aria-hidden={activePayment?.qrUrl ? undefined : true}>
          {activePayment?.qrUrl ? (
            <img alt={`QR for ${activePayment.paymentRef}`} className="qr-image" src={activePayment.qrUrl} />
          ) : (
            <div className="qr-placeholder">
              <span>MIA AMBER</span>
            </div>
          )}
        </div>
        <div className="pricing-copy">
          <p>
            New accounts start with 3 free amber. Pick a package, scan the SePay QR, and keep the
            transfer description unchanged. MIA will add the purchased amber automatically when the
            webhook matches the payment ref and amount.
          </p>
          <ul className="plain-list compact">
            <li>Remaining amber: {currentUser ? currentUser.amberQuota.remainingCredits : 0}</li>
            <li>Used amber: {currentUser ? currentUser.amberQuota.usedCredits : 0}</li>
            <li>Admin fallback remains available for review-only cases.</li>
          </ul>
        </div>
      </div>

      <div className="phone-card-list">
        {plans.map((plan) => (
          <button
            key={plan.id}
            className={selectedPlanId === plan.id ? 'pricing-plan-card active' : 'pricing-plan-card'}
            onClick={() => setSelectedPlanId(plan.id)}
            type="button"
          >
            <span className="mono-label">{plan.amount.toLocaleString('vi-VN')} VND</span>
            <strong>{plan.amberCredits} amber</strong>
            <small>{plan.label}</small>
          </button>
        ))}
      </div>

      <label className="stacked-field">
        Internal note
        <input value={note} onChange={(event) => setNote(event.target.value)} />
      </label>

      <button
        className="phone-button primary"
        disabled={!currentUser || isCreating || !selectedPlan}
        onClick={() => void handleRequest()}
        type="button"
      >
        {isCreating
          ? 'Preparing QR...'
          : selectedPlan
            ? `Create QR for ${selectedPlan.amberCredits} amber`
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
          <p className="helper-copy">
            {activePayment.planLabel} · {activePayment.amberCredits} amber
          </p>
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
            <div className="feedback error">
              <p>A transfer was detected but it did not match cleanly.</p>
              {activePayment.statusDetail ? <p>{activePayment.statusDetail}</p> : null}
              {activePayment.lastTransferAt ? (
                <p>Latest transfer: {formatDateTime(activePayment.lastTransferAt)}</p>
              ) : null}
            </div>
          ) : null}
          {activePayment.status === 'paid' ? (
            <p className="feedback success">Payment confirmed by SePay. Amber has been added to your balance.</p>
          ) : null}
          {activePayment.status === 'approved_manual' ? (
            <p className="feedback success">This amber package was manually approved by admin.</p>
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
            <p>{payment.planLabel} · {payment.amberCredits} amber</p>
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
                <dd>{getPaidLabel(payment)}</dd>
              </div>
              <div>
                <dt>Provider Tx</dt>
                <dd>{payment.providerTransactionId || 'Pending webhook'}</dd>
              </div>
              {payment.lastTransferAmount ? (
                <div>
                  <dt>Received</dt>
                  <dd>{formatVnd(payment.lastTransferAmount)}</dd>
                </div>
              ) : null}
            </dl>
            {payment.statusDetail ? <p className="feedback error">{payment.statusDetail}</p> : null}
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
