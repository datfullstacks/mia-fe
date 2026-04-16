import { useCallback, useEffect, useState } from 'react'
import {
  archiveAmber,
  cancelAmber,
  fetchAmbers,
  fetchMailLogs,
  retryMyMailLog,
  type Amber,
  type MailLog,
  type PaginationMeta,
  updateAmber,
} from '../lib/api'
import { notifyAmbersChanged } from '../lib/amberEvents'
import { useAuth } from '../lib/auth'
import { formatDateTime, toDateTimeInputValue } from '../lib/time'
import { StatusPill } from './StatusPill'

const HISTORY_PAGE_SIZE = 4
const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  pageSize: HISTORY_PAGE_SIZE,
  totalCount: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
}

function getLatestMailLog(logs: MailLog[], event: MailLog['event']) {
  return logs.find((log) => log.event === event) ?? null
}

function getMailStatusCopy(
  amber: Amber,
  event: MailLog['event'],
  latestLog: MailLog | null,
) {
  if (latestLog) {
    if (latestLog.status === 'sent') {
      return `Sent ${formatDateTime(latestLog.sentAt)}`
    }

    return latestLog.errorMessage
      ? `Failed: ${latestLog.errorMessage}`
      : `Failed ${formatDateTime(latestLog.sentAt)}`
  }

  if (event === 'amber_created') {
    return 'No confirmation mail logged yet'
  }

  if (amber.status === 'scheduled') {
    return 'Not due yet'
  }

  if (amber.status === 'cancelled') {
    return 'Amber cancelled before ready notification'
  }

  return 'Ready notification not sent yet'
}

export function HistoryPanel() {
  const { token, currentUser } = useAuth()
  const [items, setItems] = useState<Amber[]>([])
  const [mailLogs, setMailLogs] = useState<MailLog[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | Amber['status']>('all')
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationMeta>(EMPTY_PAGINATION)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [retryingMailLogId, setRetryingMailLogId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    recipientEmail: '',
    message: '',
    openAt: '',
    passcode: '',
  })

  const load = useCallback(async () => {
    try {
      if (!token) {
        setItems([])
        setMailLogs([])
        setPagination(EMPTY_PAGINATION)
        setError('Login is required to view your amber history')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      const amberResponse = await fetchAmbers(token, {
        includeArchived: showArchived,
        status: statusFilter,
        search: appliedSearch,
        page,
        pageSize: HISTORY_PAGE_SIZE,
      })
      const amberIds = amberResponse.items.map((item) => item.id)
      const mailResponse =
        amberIds.length > 0 ? await fetchMailLogs(token, { amberIds }) : { items: [] as MailLog[] }

      setItems(amberResponse.items)
      setMailLogs(mailResponse.items)
      setPagination(amberResponse.pagination)
      if (amberResponse.pagination.page !== page) {
        setPage(amberResponse.pagination.page)
      }
      setError(null)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load ambers')
    } finally {
      setIsLoading(false)
    }
  }, [appliedSearch, page, showArchived, statusFilter, token])

  useEffect(() => {
    void load()
  }, [load])

  function startEditing(item: Amber) {
    setEditingId(item.id)
    setEditForm({
      recipientEmail: item.recipientEmail,
      message: item.message,
      openAt: toDateTimeInputValue(item.openAt),
      passcode: '',
    })
    setError(null)
  }

  function stopEditing() {
    setEditingId(null)
    setEditForm({
      recipientEmail: '',
      message: '',
      openAt: '',
      passcode: '',
    })
  }

  async function handleSave(item: Amber) {
    try {
      if (!token) {
        throw new Error('Login is required to update amber')
      }

      setSavingId(item.id)
      await updateAmber(token, item.id, {
        recipientEmail: editForm.recipientEmail,
        message: editForm.message,
        openAt: new Date(editForm.openAt).toISOString(),
        ...(editForm.passcode.trim() ? { passcode: editForm.passcode.trim() } : {}),
      })
      stopEditing()
      notifyAmbersChanged()
      await load()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to update amber')
    } finally {
      setSavingId(null)
    }
  }

  async function handleCancel(item: Amber) {
    try {
      if (!token) {
        throw new Error('Login is required to cancel amber')
      }

      setSavingId(item.id)
      await cancelAmber(token, item.id)
      if (editingId === item.id) {
        stopEditing()
      }
      notifyAmbersChanged()
      await load()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to cancel amber')
    } finally {
      setSavingId(null)
    }
  }

  async function handleRetryMailLog(mailLog: MailLog) {
    try {
      if (!token) {
        throw new Error('Login is required to retry mail delivery')
      }

      setRetryingMailLogId(mailLog.id)
      await retryMyMailLog(token, mailLog.id)
      await load()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to retry mail delivery')
    } finally {
      setRetryingMailLogId(null)
    }
  }

  async function handleArchive(item: Amber) {
    try {
      if (!token) {
        throw new Error('Login is required to archive amber')
      }

      setSavingId(item.id)
      await archiveAmber(token, item.id)
      notifyAmbersChanged()
      await load()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to archive amber')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="phone-panel">
      <div className="panel-heading inline">
        <div>
          <p className="panel-tag">History</p>
          <h3>Your ambers</h3>
        </div>
        <p className="helper-copy">
          {pagination.totalCount} amber{pagination.totalCount === 1 ? '' : 's'}
        </p>
      </div>

      <div className="toolbar-grid">
        <label className="stacked-field">
          Status
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as 'all' | Amber['status'])
              setPage(1)
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
            placeholder="Code, recipient, message..."
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>
        <div className="button-row">
          <button
            className="phone-button ghost"
            onClick={() => {
              setPage(1)
              setAppliedSearch(searchInput.trim())
            }}
            type="button"
          >
            Apply search
          </button>
          <button
            className="phone-button ghost"
            onClick={() => {
              setPage(1)
              setSearchInput('')
              setAppliedSearch('')
            }}
            type="button"
          >
            Clear
          </button>
          <button
            className={showArchived ? 'chip active' : 'chip'}
            onClick={() => {
              setPage(1)
              setShowArchived((current) => !current)
            }}
            type="button"
          >
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
          <button className="phone-button ghost" onClick={() => void load()} type="button">
            Refresh
          </button>
        </div>
      </div>

      {currentUser ? <p className="helper-copy">Signed in as {currentUser.email}</p> : null}

      {isLoading ? <p className="feedback">Loading history...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}

      {!isLoading && !error ? (
        <div className="phone-card-list">
          {items.length === 0 ? (
            <article className="phone-card">
              <p className="feedback">
                No amber matched the current filters.
              </p>
            </article>
          ) : null}
          {items.map((item) => (
            <article className="phone-card" key={item.id}>
              {(() => {
                const amberMailLogs = mailLogs.filter((log) => log.amberId === item.id)
                const createdLog = getLatestMailLog(amberMailLogs, 'amber_created')
                const readyLog = getLatestMailLog(amberMailLogs, 'amber_ready')

                return (
                  <>
              <div className="phone-card-head">
                <div>
                  <span className="mono-label">{item.code}</span>
                  <h4>{item.recipientEmail}</h4>
                </div>
                <StatusPill status={item.status} />
              </div>
              {editingId === item.id ? (
                <form
                  className="phone-form compact"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleSave(item)
                  }}
                >
                  <label>
                    Recipient email
                    <input
                      required
                      type="email"
                      value={editForm.recipientEmail}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          recipientEmail: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Message
                    <textarea
                      required
                      minLength={10}
                      value={editForm.message}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          message: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Open at
                    <input
                      required
                      type="datetime-local"
                      value={editForm.openAt}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          openAt: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    New passcode
                    <input
                      placeholder="Leave blank to keep current passcode"
                      type="password"
                      value={editForm.passcode}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          passcode: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="button-row">
                    <button
                      className="phone-button primary"
                      disabled={savingId === item.id}
                      type="submit"
                    >
                      {savingId === item.id ? 'Saving...' : 'Save changes'}
                    </button>
                    <button
                      className="phone-button ghost"
                      disabled={savingId === item.id}
                      onClick={stopEditing}
                      type="button"
                    >
                      Cancel edit
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p>{item.message}</p>
                  <dl className="mini-meta">
                    <div>
                      <dt>By</dt>
                      <dd>{item.createdBy}</dd>
                    </div>
                    <div>
                      <dt>Open</dt>
                      <dd>{formatDateTime(item.openAt)}</dd>
                    </div>
                    {item.archivedAt ? (
                      <div>
                        <dt>Archived</dt>
                        <dd>{formatDateTime(item.archivedAt)}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <div className="history-mail-block">
                    <p className="panel-tag">Delivery</p>
                    <ul className="plain-list compact history-mail-list">
                      <li>
                        Seal confirmation: {getMailStatusCopy(item, 'amber_created', createdLog)}
                        {createdLog?.status === 'failed' ? (
                          <button
                            className="phone-button ghost inline-button"
                            disabled={retryingMailLogId === createdLog.id}
                            onClick={() => void handleRetryMailLog(createdLog)}
                            type="button"
                          >
                            {retryingMailLogId === createdLog.id ? 'Retrying...' : 'Retry'}
                          </button>
                        ) : null}
                      </li>
                      <li>
                        Ready notification: {getMailStatusCopy(item, 'amber_ready', readyLog)}
                        {readyLog?.status === 'failed' ? (
                          <button
                            className="phone-button ghost inline-button"
                            disabled={retryingMailLogId === readyLog.id}
                            onClick={() => void handleRetryMailLog(readyLog)}
                            type="button"
                          >
                            {retryingMailLogId === readyLog.id ? 'Retrying...' : 'Retry'}
                          </button>
                        ) : null}
                      </li>
                    </ul>
                  </div>
                  {item.status === 'scheduled' ? (
                    <div className="button-row">
                      <button
                        className="phone-button ghost"
                        onClick={() => startEditing(item)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="phone-button ghost"
                        disabled={savingId === item.id}
                        onClick={() => void handleCancel(item)}
                        type="button"
                      >
                        {savingId === item.id ? 'Cancelling...' : 'Cancel amber'}
                      </button>
                    </div>
                  ) : null}
                  {(item.status === 'opened' || item.status === 'cancelled') && !item.archivedAt ? (
                    <div className="button-row">
                      <button
                        className="phone-button ghost"
                        disabled={savingId === item.id}
                        onClick={() => void handleArchive(item)}
                        type="button"
                      >
                        {savingId === item.id ? 'Archiving...' : 'Archive'}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
                  </>
                )
              })()}
            </article>
          ))}
          {pagination.totalPages > 1 ? (
            <div className="pagination-row">
              <p className="helper-copy">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="button-row">
                <button
                  className="phone-button ghost"
                  disabled={!pagination.hasPreviousPage}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="phone-button ghost"
                  disabled={!pagination.hasNextPage}
                  onClick={() => setPage((current) => current + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
