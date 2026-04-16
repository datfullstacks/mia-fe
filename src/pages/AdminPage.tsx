import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusPill } from '../components/StatusPill'
import {
  approvePayment,
  fetchAdminOverview,
  processReadyEmails,
  retryMailLog,
  type AdminActionLog,
  type AdminOverviewResponse,
  type Amber,
  type MailLog,
  type Payment,
} from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDateTime } from '../lib/time'

const ADMIN_PAGE_SIZE = 5

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

export function AdminPage() {
  const { currentUser, isLoading, token } = useAuth()
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(true)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [mailActionState, setMailActionState] = useState<string | null>(null)
  const [retryingMailLogId, setRetryingMailLogId] = useState<string | null>(null)
  const [amberStatusFilter, setAmberStatusFilter] = useState<'all' | Amber['status']>('all')
  const [amberSearchInput, setAmberSearchInput] = useState('')
  const [amberSearch, setAmberSearch] = useState('')
  const [amberPage, setAmberPage] = useState(1)
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | Payment['status']>('all')
  const [paymentSearchInput, setPaymentSearchInput] = useState('')
  const [paymentSearch, setPaymentSearch] = useState('')
  const [paymentPage, setPaymentPage] = useState(1)
  const [mailStatusFilter, setMailStatusFilter] = useState<'all' | MailLog['status']>('all')
  const [mailEventFilter, setMailEventFilter] = useState<'all' | MailLog['event']>('all')
  const [mailSearchInput, setMailSearchInput] = useState('')
  const [mailSearch, setMailSearch] = useState('')
  const [mailPage, setMailPage] = useState(1)
  const [actionTypeFilter, setActionTypeFilter] = useState<'all' | AdminActionLog['actionType']>('all')
  const [actionSearchInput, setActionSearchInput] = useState('')
  const [actionSearch, setActionSearch] = useState('')
  const [actionPage, setActionPage] = useState(1)

  const loadOverview = useCallback(async () => {
    if (!token || !currentUser?.isAdmin) {
      setOverview(null)
      setIsRefreshing(false)
      return
    }

    setIsRefreshing(true)

    try {
      const response = await fetchAdminOverview(token, {
        amberStatus: amberStatusFilter,
        amberSearch,
        amberPage,
        amberPageSize: ADMIN_PAGE_SIZE,
        paymentStatus: paymentStatusFilter,
        paymentSearch,
        paymentPage,
        paymentPageSize: ADMIN_PAGE_SIZE,
        mailStatus: mailStatusFilter,
        mailEvent: mailEventFilter,
        mailSearch,
        mailPage,
        mailPageSize: ADMIN_PAGE_SIZE,
        actionType: actionTypeFilter,
        actionSearch,
        actionPage,
        actionPageSize: ADMIN_PAGE_SIZE,
      })
      setOverview(response)
      if (response.amberPagination.page !== amberPage) {
        setAmberPage(response.amberPagination.page)
      }
      if (response.paymentPagination.page !== paymentPage) {
        setPaymentPage(response.paymentPagination.page)
      }
      if (response.mailPagination.page !== mailPage) {
        setMailPage(response.mailPagination.page)
      }
      if (response.actionPagination.page !== actionPage) {
        setActionPage(response.actionPagination.page)
      }
      setError(null)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load admin data')
    } finally {
      setIsRefreshing(false)
    }
  }, [
    amberPage,
    amberSearch,
    amberStatusFilter,
    actionPage,
    actionSearch,
    actionTypeFilter,
    currentUser?.isAdmin,
    mailEventFilter,
    mailPage,
    mailSearch,
    mailStatusFilter,
    paymentPage,
    paymentSearch,
    paymentStatusFilter,
    token,
  ])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  async function handleApprove(payment: Payment) {
    if (!token) {
      return
    }

    setPendingActionId(payment.id)

    try {
      await approvePayment(token, payment.id)
      await loadOverview()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to approve payment')
    } finally {
      setPendingActionId(null)
    }
  }

  async function handleProcessReadyEmails() {
    if (!token) {
      return
    }

    setMailActionState('Processing...')

    try {
      const response = await processReadyEmails(token)
      setMailActionState(`Processed ${response.processedCount} ready email(s)`)
      await loadOverview()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to process ready emails')
      setMailActionState(null)
    }
  }

  async function handleRetryMailLog(mailLog: MailLog) {
    if (!token) {
      return
    }

    setRetryingMailLogId(mailLog.id)

    try {
      const response = await retryMailLog(token, mailLog.id)
      setMailActionState(`Retried ${response.item.event} for ${response.item.recipientEmail}`)
      await loadOverview()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to retry mail log')
    } finally {
      setRetryingMailLogId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="admin-shell">
        <section className="panel">
          <p className="feedback">Loading admin session...</p>
        </section>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="admin-shell">
        <section className="panel">
          <p className="panel-tag">Admin portal</p>
          <h2>Admin login required</h2>
          <p className="helper-copy">
            Sign in with the seeded admin account to review payments and amber metadata.
          </p>
          <Link className="phone-button ghost" to="/gate">
            Go to Gate
          </Link>
        </section>
      </div>
    )
  }

  if (!currentUser.isAdmin) {
    return (
      <div className="admin-shell">
        <section className="panel">
          <p className="panel-tag">Admin portal</p>
          <h2>Admin access only</h2>
          <p className="helper-copy">
            Signed in as {currentUser.email}, but this account does not have admin privileges.
          </p>
          <Link className="phone-button ghost" to="/room">
            Return to Room
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="admin-shell">
      <section className="panel">
        <p className="panel-tag">Admin portal</p>
        <h2>Admin overview for the rebuilt stack</h2>
        <p className="helper-copy">
          This page now reads live metrics from the Express backend and lets admin review amber
          packages, mail delivery, and archive activity in one place.
        </p>

        {error ? <p className="feedback error">{error}</p> : null}

        <div className="panel-heading inline admin-heading">
          <p className="helper-copy">Signed in as {currentUser.email}</p>
          <div className="button-row">
            <Link className="phone-button ghost" to="/room">
              Back to Room
            </Link>
            <button className="phone-button primary" onClick={() => void loadOverview()} type="button">
              Refresh
            </button>
          </div>
        </div>

        {isRefreshing ? <p className="feedback">Loading admin data...</p> : null}

        {overview ? (
          <>
            <div className="metric-grid admin">
              <article className="metric-card">
                <span>Users</span>
                <strong>{overview.stats.users.totalUsers}</strong>
              </article>
              <article className="metric-card">
                <span>Legacy Pro users</span>
                <strong>{overview.stats.users.proUsers}</strong>
              </article>
              <article className="metric-card">
                <span>Total ambers</span>
                <strong>{overview.stats.ambers.totalAmbers}</strong>
              </article>
              <article className="metric-card">
                <span>Ready ambers</span>
                <strong>{overview.stats.ambers.readyCount}</strong>
              </article>
              <article className="metric-card">
                <span>Payments</span>
                <strong>{overview.stats.payments.totalPayments}</strong>
              </article>
              <article className="metric-card">
                <span>Pending payments</span>
                <strong>{overview.stats.payments.pendingPayments}</strong>
              </article>
              <article className="metric-card">
                <span>Paid payments</span>
                <strong>{overview.stats.payments.paidPayments}</strong>
              </article>
              <article className="metric-card">
                <span>Review payments</span>
                <strong>{overview.stats.payments.reviewPayments}</strong>
              </article>
              <article className="metric-card">
                <span>Mail logs</span>
                <strong>{overview.stats.mail.totalLogs}</strong>
              </article>
              <article className="metric-card">
                <span>Failed mail logs</span>
                <strong>{overview.stats.mail.failedLogs}</strong>
              </article>
              <article className="metric-card">
                <span>Ready emails</span>
                <strong>{overview.stats.mail.readyEmails}</strong>
              </article>
              <article className="metric-card">
                <span>Admin actions</span>
                <strong>{overview.stats.audit.totalActionLogs}</strong>
              </article>
            </div>

            <div className="admin-grid">
              <div className="phone-card-list">
                <article className="phone-card">
                  <div className="panel-heading">
                    <p className="panel-tag">Amber metadata</p>
                    <h3>Content stays masked for admin</h3>
                  </div>
                  <div className="toolbar-grid">
                    <label className="stacked-field">
                      Status
                      <select
                        value={amberStatusFilter}
                        onChange={(event) => {
                          setAmberPage(1)
                          setAmberStatusFilter(event.target.value as 'all' | Amber['status'])
                        }}
                      >
                        <option value="all">All states</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="ready">Ready</option>
                        <option value="opened">Opened</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </label>
                    <label className="stacked-field grow-field">
                      Search
                      <input
                        placeholder="Code, recipient, creator..."
                        type="search"
                        value={amberSearchInput}
                        onChange={(event) => setAmberSearchInput(event.target.value)}
                      />
                    </label>
                    <div className="button-row">
                      <button
                        className="phone-button ghost"
                        onClick={() => {
                          setAmberPage(1)
                          setAmberSearch(amberSearchInput.trim())
                        }}
                        type="button"
                      >
                        Apply search
                      </button>
                      <button
                        className="phone-button ghost"
                        onClick={() => {
                          setAmberPage(1)
                          setAmberSearchInput('')
                          setAmberSearch('')
                        }}
                        type="button"
                      >
                        Clear
                      </button>
                    </div>
                    <p className="helper-copy">
                      Showing {overview.amberPagination.totalCount} amber record
                      {overview.amberPagination.totalCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </article>
                {overview.amberMetadata.length === 0 ? (
                  <article className="phone-card">
                    <p className="feedback">No amber matched the current admin filter.</p>
                  </article>
                ) : null}
                {overview.amberMetadata.map((amber) => (
                  <article className="phone-card" key={amber.id}>
                    <div className="phone-card-head">
                      <div>
                        <span className="mono-label">{amber.code}</span>
                        <h4>{amber.recipientEmail}</h4>
                      </div>
                      <StatusPill status={amber.status} />
                    </div>
                    <p>{amber.message}</p>
                    <dl className="mini-meta">
                      <div>
                        <dt>By</dt>
                        <dd>{amber.createdBy}</dd>
                      </div>
                      <div>
                        <dt>Opens</dt>
                        <dd>{formatDateTime(amber.openAt)}</dd>
                      </div>
                      {amber.archivedAt ? (
                        <div>
                          <dt>Archived</dt>
                          <dd>{formatDateTime(amber.archivedAt)}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </article>
                ))}
                {overview.amberPagination.totalPages > 1 ? (
                  <div className="pagination-row">
                    <p className="helper-copy">
                      Page {overview.amberPagination.page} of {overview.amberPagination.totalPages}
                    </p>
                    <div className="button-row">
                      <button
                        className="phone-button ghost"
                        disabled={!overview.amberPagination.hasPreviousPage}
                        onClick={() => setAmberPage((current) => Math.max(1, current - 1))}
                        type="button"
                      >
                        Previous
                      </button>
                      <button
                        className="phone-button ghost"
                        disabled={!overview.amberPagination.hasNextPage}
                        onClick={() => setAmberPage((current) => current + 1)}
                        type="button"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="phone-card-list">
                <article className="phone-card">
                  <div className="panel-heading">
                    <p className="panel-tag">Payments</p>
                    <h3>Approve amber packages</h3>
                  </div>
                  <div className="toolbar-grid">
                    <label className="stacked-field">
                      Status
                      <select
                        value={paymentStatusFilter}
                        onChange={(event) => {
                          setPaymentPage(1)
                          setPaymentStatusFilter(event.target.value as 'all' | Payment['status'])
                        }}
                      >
                        <option value="all">All payments</option>
                        <option value="pending">Pending</option>
                        <option value="pending_review">Pending review</option>
                        <option value="paid">Paid</option>
                        <option value="approved_manual">Approved manually</option>
                        <option value="expired">Expired</option>
                      </select>
                    </label>
                    <label className="stacked-field grow-field">
                      Search
                      <input
                        placeholder="Payment ref, note, tx..."
                        type="search"
                        value={paymentSearchInput}
                        onChange={(event) => setPaymentSearchInput(event.target.value)}
                      />
                    </label>
                    <div className="button-row">
                      <button
                        className="phone-button ghost"
                        onClick={() => {
                          setPaymentPage(1)
                          setPaymentSearch(paymentSearchInput.trim())
                        }}
                        type="button"
                      >
                        Apply search
                      </button>
                      <button
                        className="phone-button ghost"
                        onClick={() => {
                          setPaymentPage(1)
                          setPaymentSearchInput('')
                          setPaymentSearch('')
                        }}
                        type="button"
                      >
                        Clear
                      </button>
                    </div>
                    <p className="helper-copy">
                      Showing {overview.paymentPagination.totalCount} payment
                      {overview.paymentPagination.totalCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </article>
                {overview.payments.length === 0 ? (
                  <article className="phone-card">
                    <p className="feedback">No payment matched the current admin filter.</p>
                  </article>
                ) : null}
                {overview.payments.map((payment) => (
                  <article className="phone-card" key={payment.id}>
                    <div className="phone-card-head">
                      <div>
                        <span className="mono-label">{payment.paymentRef}</span>
                        <h4>{payment.amount.toLocaleString()} VND</h4>
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
                    {payment.statusDetail ? (
                      <p className="feedback error">{payment.statusDetail}</p>
                    ) : null}
                    {payment.reviewedAt ? (
                      <p className="helper-copy">Reviewed {formatDateTime(payment.reviewedAt)}</p>
                    ) : null}
                    {payment.status !== 'paid' && payment.status !== 'approved_manual' ? (
                      <button
                        className="phone-button primary"
                        disabled={pendingActionId === payment.id}
                        onClick={() => void handleApprove(payment)}
                        type="button"
                      >
                        {pendingActionId === payment.id ? 'Approving...' : 'Approve manually'}
                      </button>
                    ) : null}
                  </article>
                ))}
                {overview.paymentPagination.totalPages > 1 ? (
                  <div className="pagination-row">
                    <p className="helper-copy">
                      Page {overview.paymentPagination.page} of {overview.paymentPagination.totalPages}
                    </p>
                    <div className="button-row">
                      <button
                        className="phone-button ghost"
                        disabled={!overview.paymentPagination.hasPreviousPage}
                        onClick={() => setPaymentPage((current) => Math.max(1, current - 1))}
                        type="button"
                      >
                        Previous
                      </button>
                      <button
                        className="phone-button ghost"
                        disabled={!overview.paymentPagination.hasNextPage}
                        onClick={() => setPaymentPage((current) => current + 1)}
                        type="button"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="phone-card-list">
                <article className="phone-card">
                  <div className="panel-heading">
                    <p className="panel-tag">Audit log</p>
                    <h3>Track admin-side mutations</h3>
                  </div>
                  <div className="toolbar-grid">
                    <label className="stacked-field">
                      Action
                      <select
                        value={actionTypeFilter}
                        onChange={(event) => {
                          setActionPage(1)
                          setActionTypeFilter(event.target.value as 'all' | AdminActionLog['actionType'])
                        }}
                      >
                        <option value="all">All actions</option>
                        <option value="approve_payment">Approve payment</option>
                        <option value="process_ready_emails">Process ready emails</option>
                        <option value="retry_mail_log">Retry mail log</option>
                      </select>
                    </label>
                    <label className="stacked-field grow-field">
                      Search
                      <input
                        placeholder="Admin, summary, target..."
                        type="search"
                        value={actionSearchInput}
                        onChange={(event) => setActionSearchInput(event.target.value)}
                      />
                    </label>
                    <div className="button-row">
                      <button
                        className="phone-button ghost"
                        onClick={() => {
                          setActionPage(1)
                          setActionSearch(actionSearchInput.trim())
                        }}
                        type="button"
                      >
                        Apply search
                      </button>
                      <button
                        className="phone-button ghost"
                        onClick={() => {
                          setActionPage(1)
                          setActionSearchInput('')
                          setActionSearch('')
                        }}
                        type="button"
                      >
                        Clear
                      </button>
                    </div>
                    <p className="helper-copy">
                      Showing {overview.actionPagination.totalCount} admin action
                      {overview.actionPagination.totalCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </article>
                {overview.actionLogs.length === 0 ? (
                  <article className="phone-card">
                    <p className="feedback">No admin action matched the current filter.</p>
                  </article>
                ) : null}
                {overview.actionLogs.map((actionLog: AdminActionLog) => (
                  <article className="phone-card" key={actionLog.id}>
                    <div className="phone-card-head">
                      <div>
                        <span className="mono-label">{actionLog.actionType}</span>
                        <h4>{actionLog.adminEmail}</h4>
                      </div>
                      <span className="mono-label">{actionLog.targetType}</span>
                    </div>
                    <p>{actionLog.summary}</p>
                    <dl className="mini-meta">
                      <div>
                        <dt>Admin</dt>
                        <dd>{actionLog.adminName}</dd>
                      </div>
                      <div>
                        <dt>Created</dt>
                        <dd>{formatDateTime(actionLog.createdAt)}</dd>
                      </div>
                      {actionLog.targetId ? (
                        <div>
                          <dt>Target</dt>
                          <dd>{actionLog.targetId}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </article>
                ))}
                {overview.actionPagination.totalPages > 1 ? (
                  <div className="pagination-row">
                    <p className="helper-copy">
                      Page {overview.actionPagination.page} of {overview.actionPagination.totalPages}
                    </p>
                    <div className="button-row">
                      <button
                        className="phone-button ghost"
                        disabled={!overview.actionPagination.hasPreviousPage}
                        onClick={() => setActionPage((current) => Math.max(1, current - 1))}
                        type="button"
                      >
                        Previous
                      </button>
                      <button
                        className="phone-button ghost"
                        disabled={!overview.actionPagination.hasNextPage}
                        onClick={() => setActionPage((current) => current + 1)}
                        type="button"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="phone-card-list">
                <article className="phone-card">
                  <div className="panel-heading">
                    <p className="panel-tag">Mail logs</p>
                    <h3>Process ready amber notifications</h3>
                  </div>
                  <p className="helper-copy">
                    Create flow logs seal confirmation immediately. Ready notifications are
                    processed once from this admin action.
                  </p>
                  <div className="button-row">
                    <button
                      className="phone-button primary"
                      onClick={() => void handleProcessReadyEmails()}
                      type="button"
                    >
                      Process ready emails
                    </button>
                  </div>
                  <div className="toolbar-grid">
                    <label className="stacked-field">
                      Status
                      <select
                        value={mailStatusFilter}
                        onChange={(event) => {
                          setMailPage(1)
                          setMailStatusFilter(event.target.value as 'all' | MailLog['status'])
                        }}
                      >
                        <option value="all">All mail statuses</option>
                        <option value="sent">Sent</option>
                        <option value="failed">Failed</option>
                      </select>
                    </label>
                    <label className="stacked-field">
                      Event
                      <select
                        value={mailEventFilter}
                        onChange={(event) => {
                          setMailPage(1)
                          setMailEventFilter(event.target.value as 'all' | MailLog['event'])
                        }}
                      >
                        <option value="all">All mail events</option>
                        <option value="amber_created">Seal confirmation</option>
                        <option value="amber_ready">Ready notification</option>
                      </select>
                    </label>
                    <label className="stacked-field grow-field">
                      Search
                      <input
                        placeholder="Recipient, subject, event..."
                        type="search"
                        value={mailSearchInput}
                        onChange={(event) => setMailSearchInput(event.target.value)}
                      />
                    </label>
                    <div className="button-row">
                      <button
                        className="phone-button ghost"
                        onClick={() => {
                          setMailPage(1)
                          setMailSearch(mailSearchInput.trim())
                        }}
                        type="button"
                      >
                        Apply search
                      </button>
                      <button
                        className="phone-button ghost"
                        onClick={() => {
                          setMailPage(1)
                          setMailSearchInput('')
                          setMailSearch('')
                        }}
                        type="button"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {mailActionState ? <p className="feedback success">{mailActionState}</p> : null}
                </article>
                {overview.mailLogs.length === 0 ? (
                  <article className="phone-card">
                    <p className="feedback">No mail log matched the current admin filter.</p>
                  </article>
                ) : null}
                {overview.mailLogs.map((mailLog: MailLog) => (
                  <article className="phone-card" key={mailLog.id}>
                    <div className="phone-card-head">
                      <div>
                        <span className="mono-label">{mailLog.event}</span>
                        <h4>{mailLog.recipientEmail}</h4>
                      </div>
                      <span className="mono-label">{mailLog.status}</span>
                    </div>
                    <p>{mailLog.subject}</p>
                    {mailLog.errorMessage ? (
                      <p className="feedback error">{mailLog.errorMessage}</p>
                    ) : null}
                    <dl className="mini-meta">
                      <div>
                        <dt>Sent</dt>
                        <dd>{formatDateTime(mailLog.sentAt)}</dd>
                      </div>
                      <div>
                        <dt>Provider</dt>
                        <dd>{mailLog.providerMessageId}</dd>
                      </div>
                    </dl>
                    {mailLog.status === 'failed' ? (
                      <button
                        className="phone-button ghost"
                        disabled={retryingMailLogId === mailLog.id}
                        onClick={() => void handleRetryMailLog(mailLog)}
                        type="button"
                      >
                        {retryingMailLogId === mailLog.id ? 'Retrying...' : 'Retry mail'}
                      </button>
                    ) : null}
                  </article>
                ))}
                {overview.mailPagination.totalPages > 1 ? (
                  <div className="pagination-row">
                    <p className="helper-copy">
                      Page {overview.mailPagination.page} of {overview.mailPagination.totalPages}
                    </p>
                    <div className="button-row">
                      <button
                        className="phone-button ghost"
                        disabled={!overview.mailPagination.hasPreviousPage}
                        onClick={() => setMailPage((current) => Math.max(1, current - 1))}
                        type="button"
                      >
                        Previous
                      </button>
                      <button
                        className="phone-button ghost"
                        disabled={!overview.mailPagination.hasNextPage}
                        onClick={() => setMailPage((current) => current + 1)}
                        type="button"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  )
}
