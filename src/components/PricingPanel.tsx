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
    return 'Đã xác nhận'
  }

  return 'Đang chờ'
}

function formatCountdown(expiresAt: string | null, now: number) {
  if (!expiresAt) {
    return null
  }

  const remainingMs = new Date(expiresAt).getTime() - now

  if (remainingMs <= 0) {
    return 'Đơn đã hết hạn'
  }

  const totalSeconds = Math.floor(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `Hết hạn sau ${minutes}:${seconds.toString().padStart(2, '0')}`
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
        setError(nextError instanceof Error ? nextError.message : 'Không thể tải gói amber')
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
        setError(nextError instanceof Error ? nextError.message : 'Không thể tải đơn thanh toán')
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
        setError(nextError instanceof Error ? nextError.message : 'Không thể cập nhật trạng thái thanh toán')
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
        throw new Error('Bạn cần đăng nhập để tạo QR thanh toán')
      }

      if (!selectedPlanId) {
        throw new Error('Hãy chọn một gói amber trước')
      }

      setIsCreating(true)
      const response = await createPayment(token, {
        note: note,
        planId: selectedPlanId,
      })
      syncPaymentIntoState(response.item)
      setActivePaymentId(response.item.id)
      setResult(`Đã tạo QR cho ${response.item.paymentRef}`)
      setError(null)
      await loadPayments()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Không thể tạo QR thanh toán')
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
        <h3>Mua thêm amber</h3>
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
            Tài khoản mới có 3 amber miễn phí. Chọn gói, quét mã SePay và giữ nguyên nội dung
            chuyển khoản. Hệ thống sẽ cộng amber tự động khi webhook khớp mã thanh toán và số tiền.
          </p>
          <ul className="plain-list compact">
            <li>Còn lại: {currentUser ? currentUser.amberQuota.remainingCredits : 0} amber</li>
            <li>Đã dùng: {currentUser ? currentUser.amberQuota.usedCredits : 0} amber</li>
            <li>Nếu lệch tiền hoặc sai nội dung, admin vẫn có thể kiểm tra tay.</li>
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
        Ghi chú nội bộ
        <input value={note} onChange={(event) => setNote(event.target.value)} />
      </label>

      <button
        className="phone-button primary"
        disabled={!currentUser || isCreating || !selectedPlan}
        onClick={() => void handleRequest()}
        type="button"
      >
        {isCreating
          ? 'Đang tạo QR...'
          : selectedPlan
            ? `Tạo QR cho ${selectedPlan.amberCredits} amber`
            : 'Tạo QR SePay'}
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
              <dt>Tài khoản</dt>
              <dd>{activePayment.accountNumber}</dd>
            </div>
            <div>
              <dt>Chủ tài khoản</dt>
              <dd>{activePayment.accountName || 'Đã cấu hình trong SePay'}</dd>
            </div>
            <div>
              <dt>Nội dung CK</dt>
              <dd>{activePayment.paymentRef}</dd>
            </div>
          </dl>
          <p className="helper-copy">
            Đừng sửa nội dung chuyển khoản. Hệ thống đối soát theo đúng mã này.
          </p>
          {countdown ? <p className="countdown">{countdown}</p> : null}
          {activePayment.status === 'pending_review' ? (
            <div className="feedback error">
              <p>Đã phát hiện giao dịch nhưng chưa khớp hoàn toàn.</p>
              {activePayment.statusDetail ? <p>{activePayment.statusDetail}</p> : null}
              {activePayment.lastTransferAt ? (
                <p>Giao dịch gần nhất: {formatDateTime(activePayment.lastTransferAt)}</p>
              ) : null}
            </div>
          ) : null}
          {activePayment.status === 'paid' ? (
            <p className="feedback success">SePay đã xác nhận. Amber đã được cộng vào tài khoản của bạn.</p>
          ) : null}
          {activePayment.status === 'approved_manual' ? (
            <p className="feedback success">Gói amber này đã được admin duyệt tay.</p>
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
              <p>{payment.note || 'Không có ghi chú'}</p>
              <dl className="mini-meta">
                <div>
                  <dt>Tạo lúc</dt>
                  <dd>{formatDateTime(payment.createdAt)}</dd>
                </div>
                <div>
                  <dt>Hết hạn</dt>
                  <dd>{payment.expiresAt ? formatDateTime(payment.expiresAt) : 'Không có hạn'}</dd>
                </div>
                <div>
                  <dt>Thanh toán</dt>
                  <dd>{getPaidLabel(payment)}</dd>
                </div>
                <div>
                  <dt>Mã giao dịch</dt>
                  <dd>{payment.providerTransactionId || 'Đang chờ webhook'}</dd>
                </div>
              {payment.lastTransferAmount ? (
                <div>
                  <dt>Đã nhận</dt>
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
                Mở đơn này
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
