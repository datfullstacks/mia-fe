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
      return `Đã gửi ${formatDateTime(latestLog.sentAt)}`
    }

    return latestLog.errorMessage
      ? `Lỗi: ${latestLog.errorMessage}`
      : `Lỗi ${formatDateTime(latestLog.sentAt)}`
  }

  if (event === 'amber_created') {
    return 'Chưa có log mail xác nhận'
  }

  if (amber.status === 'scheduled') {
    return 'Chưa tới giờ gửi'
  }

  if (amber.status === 'cancelled') {
    return 'Amber đã huỷ trước khi gửi thông báo'
  }

  return 'Chưa gửi thông báo mở amber'
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
        setError('Bạn cần đăng nhập để xem lịch sử amber')
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
      setError(nextError instanceof Error ? nextError.message : 'Không thể tải danh sách amber')
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
        throw new Error('Bạn cần đăng nhập để sửa amber')
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
      setError(nextError instanceof Error ? nextError.message : 'Không thể cập nhật amber')
    } finally {
      setSavingId(null)
    }
  }

  async function handleCancel(item: Amber) {
    try {
      if (!token) {
        throw new Error('Bạn cần đăng nhập để huỷ amber')
      }

      setSavingId(item.id)
      await cancelAmber(token, item.id)
      if (editingId === item.id) {
        stopEditing()
      }
      notifyAmbersChanged()
      await load()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Không thể huỷ amber')
    } finally {
      setSavingId(null)
    }
  }

  async function handleRetryMailLog(mailLog: MailLog) {
    try {
      if (!token) {
        throw new Error('Bạn cần đăng nhập để gửi lại mail')
      }

      setRetryingMailLogId(mailLog.id)
      await retryMyMailLog(token, mailLog.id)
      await load()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Không thể gửi lại mail')
    } finally {
      setRetryingMailLogId(null)
    }
  }

  async function handleArchive(item: Amber) {
    try {
      if (!token) {
        throw new Error('Bạn cần đăng nhập để lưu trữ amber')
      }

      setSavingId(item.id)
      await archiveAmber(token, item.id)
      notifyAmbersChanged()
      await load()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Không thể lưu trữ amber')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="phone-panel">
      <div className="panel-heading inline">
        <div>
          <p className="panel-tag">History</p>
          <h3>Lịch sử amber</h3>
        </div>
        <p className="helper-copy">
          {pagination.totalCount} amber
        </p>
      </div>

      <div className="toolbar-grid">
        <label className="stacked-field">
          Trạng thái
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as 'all' | Amber['status'])
              setPage(1)
            }}
          >
            <option value="all">Tất cả</option>
            <option value="scheduled">Đã hẹn</option>
            <option value="ready">Mở được</option>
            <option value="opened">Đã mở</option>
            <option value="cancelled">Đã huỷ</option>
          </select>
        </label>
        <label className="stacked-field grow-field">
          Tìm kiếm
          <input
            placeholder="Mã, người nhận, nội dung..."
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
            Áp dụng
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
            Xoá
          </button>
          <button
            className={showArchived ? 'chip active' : 'chip'}
            onClick={() => {
              setPage(1)
              setShowArchived((current) => !current)
            }}
            type="button"
          >
            {showArchived ? 'Ẩn lưu trữ' : 'Xem lưu trữ'}
          </button>
          <button className="phone-button ghost" onClick={() => void load()} type="button">
            Làm mới
          </button>
        </div>
      </div>

      {currentUser ? <p className="helper-copy">Đang dùng {currentUser.email}</p> : null}

      {isLoading ? <p className="feedback">Đang tải lịch sử...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}

      {!isLoading && !error ? (
        <div className="phone-card-list">
          {items.length === 0 ? (
            <article className="phone-card">
              <p className="feedback">
                Không có amber nào khớp bộ lọc hiện tại.
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
                    Email người nhận
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
                    Nội dung
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
                    Mở vào lúc
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
                    Mật mã mới
                    <input
                      placeholder="Để trống nếu giữ nguyên mật mã"
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
                      {savingId === item.id ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                    <button
                      className="phone-button ghost"
                      disabled={savingId === item.id}
                      onClick={stopEditing}
                      type="button"
                    >
                      Huỷ sửa
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p>{item.message}</p>
                  <dl className="mini-meta">
                    <div>
                        <dt>Người tạo</dt>
                        <dd>{item.createdBy}</dd>
                      </div>
                    <div>
                      <dt>Mở lúc</dt>
                      <dd>{formatDateTime(item.openAt)}</dd>
                    </div>
                    {item.archivedAt ? (
                      <div>
                        <dt>Lưu trữ</dt>
                        <dd>{formatDateTime(item.archivedAt)}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <div className="history-mail-block">
                    <p className="panel-tag">Mail</p>
                    <ul className="plain-list compact history-mail-list">
                      <li>
                        Mail xác nhận: {getMailStatusCopy(item, 'amber_created', createdLog)}
                        {createdLog?.status === 'failed' ? (
                          <button
                            className="phone-button ghost inline-button"
                            disabled={retryingMailLogId === createdLog.id}
                            onClick={() => void handleRetryMailLog(createdLog)}
                            type="button"
                          >
                            {retryingMailLogId === createdLog.id ? 'Đang gửi lại...' : 'Gửi lại'}
                          </button>
                        ) : null}
                      </li>
                      <li>
                        Thông báo mở: {getMailStatusCopy(item, 'amber_ready', readyLog)}
                        {readyLog?.status === 'failed' ? (
                          <button
                            className="phone-button ghost inline-button"
                            disabled={retryingMailLogId === readyLog.id}
                            onClick={() => void handleRetryMailLog(readyLog)}
                            type="button"
                          >
                            {retryingMailLogId === readyLog.id ? 'Đang gửi lại...' : 'Gửi lại'}
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
                        Sửa
                      </button>
                      <button
                        className="phone-button ghost"
                        disabled={savingId === item.id}
                        onClick={() => void handleCancel(item)}
                        type="button"
                      >
                        {savingId === item.id ? 'Đang huỷ...' : 'Huỷ amber'}
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
                        {savingId === item.id ? 'Đang lưu trữ...' : 'Lưu trữ'}
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
                Trang {pagination.page} / {pagination.totalPages}
              </p>
              <div className="button-row">
                <button
                  className="phone-button ghost"
                  disabled={!pagination.hasPreviousPage}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                    Trước
                </button>
                <button
                  className="phone-button ghost"
                  disabled={!pagination.hasNextPage}
                  onClick={() => setPage((current) => current + 1)}
                  type="button"
                >
                    Sau
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
