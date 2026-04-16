export interface User {
  id: string
  name: string
  email: string
  tier: 'free' | 'pro'
  isAdmin: boolean
  createdAt: string
  amberQuota: {
    freeCredits: number
    purchasedCredits: number
    totalCredits: number
    usedCredits: number
    remainingCredits: number
  }
}

export interface Amber {
  id: string
  code: string
  recipientEmail: string
  message: string
  openAt: string
  createdBy: string
  createdAt: string
  status: 'scheduled' | 'ready' | 'opened' | 'cancelled'
  archivedAt: string | null
}

export interface AmberMutationPayload {
  recipientEmail: string
  message: string
  openAt: string
  passcode?: string
}

export interface AmberListOptions {
  includeArchived?: boolean
  status?: 'all' | Amber['status']
  search?: string
  page?: number
  pageSize?: number
}

export type PaymentStatus = 'pending' | 'pending_review' | 'paid' | 'approved_manual' | 'expired'

export interface PaymentPlan {
  id: string
  amount: number
  amberCredits: number
  label: string
}

export interface Payment {
  id: string
  paymentRef: string
  planId: string
  planLabel: string
  amberCredits: number
  amount: number
  note: string
  status: PaymentStatus
  createdAt: string
  expiresAt: string | null
  paidAt: string | null
  userId: string
  reviewedAt: string | null
  reviewedBy: string | null
  provider: 'sepay_qr'
  providerTransactionId: string | null
  lastTransferAmount: number | null
  lastTransferAt: string | null
  statusDetail: string | null
  bankName: string
  accountNumber: string
  accountName: string
  qrUrl: string | null
}

export interface MailLog {
  id: string
  amberId: string
  event: 'amber_created' | 'amber_ready'
  status: 'sent' | 'failed'
  recipientEmail: string
  subject: string
  providerMessageId: string
  createdAt: string
  sentAt: string
  errorMessage: string | null
}

export interface AdminActionLog {
  id: string
  adminUserId: string
  adminName: string
  adminEmail: string
  actionType: 'approve_payment' | 'process_ready_emails' | 'retry_mail_log'
  targetType: 'payment' | 'mail_batch' | 'mail_log'
  targetId: string | null
  summary: string
  createdAt: string
}

export interface PaginationMeta {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export interface OverviewResponse {
  project: {
    name: string
    subtitle: string
    architecture: {
      frontend: string
      backend: string
    }
  }
  modules: string[]
  roadmap: string[]
  stats: {
    totalAmbers: number
    scheduledCount: number
    readyCount: number
  }
}

export interface AdminOverviewResponse {
  stats: {
    users: {
      totalUsers: number
      proUsers: number
    }
    ambers: {
      totalAmbers: number
      scheduledCount: number
      readyCount: number
    }
    payments: {
      totalPayments: number
      pendingPayments: number
      paidPayments: number
      reviewPayments: number
    }
    mail: {
      totalLogs: number
      sentLogs: number
      failedLogs: number
      readyEmails: number
    }
    audit: {
      totalActionLogs: number
    }
  }
  amberMetadata: Array<{
    id: string
    code: string
    recipientEmail: string
    openAt: string
    createdBy: string
    createdAt: string
    status: 'scheduled' | 'ready' | 'opened' | 'cancelled'
    message: string
    archivedAt: string | null
  }>
  amberPagination: PaginationMeta
  payments: Payment[]
  paymentPagination: PaginationMeta
  mailLogs: MailLog[]
  mailPagination: PaginationMeta
  actionLogs: AdminActionLog[]
  actionPagination: PaginationMeta
}

export interface UnsealResult {
  state: 'not_ready' | 'opened'
  code: string
  recipientEmail: string
  openAt: string
  message?: string
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
let csrfTokenMemory: string | null = null

function resolveApiUrl(path: string) {
  if (!API_BASE_URL) {
    return path
  }

  return `${API_BASE_URL}${path}`
}

export function setCsrfToken(nextToken: string | null) {
  csrfTokenMemory = nextToken
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase()
  const csrfToken = getCsrfToken()
  const headers = new Headers(init?.headers ?? {})

  headers.set('Content-Type', 'application/json')

  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken)
  }

  const response = await fetch(resolveApiUrl(path), {
    credentials: 'include',
    headers,
    ...init,
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(error?.message || 'Request failed')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

function getCsrfToken() {
  if (csrfTokenMemory) {
    return csrfTokenMemory
  }

  if (typeof document === 'undefined') {
    return null
  }

  const match = document.cookie.match(/(?:^|; )mia_csrf=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

function authHeaders(token?: string | null) {
  if (!token || token === 'cookie-session') {
    return {} as Record<string, string>
  }

  return {
    Authorization: `Bearer ${token}`,
  } satisfies Record<string, string>
}

export function fetchHealth() {
  return request<{ ok: boolean; timestamp: string; uptimeSeconds: number }>('/api/health')
}

export function fetchOverview() {
  return request<OverviewResponse>('/api/overview')
}

export function registerUser(payload: { name: string; email: string; password: string }) {
  return request<{ token: string; user: User; csrfToken: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function loginUser(payload: { email: string; password: string }) {
  return request<{ token: string; user: User; csrfToken: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchMe(token?: string | null) {
  return request<{ user: User; csrfToken: string }>('/api/auth/me', {
    headers: authHeaders(token),
  })
}

export function logoutUser(token?: string | null) {
  return request<void>('/api/auth/logout', {
    method: 'POST',
    headers: authHeaders(token),
  })
}

export function fetchAmbers(token?: string | null, options?: AmberListOptions) {
  const params = new URLSearchParams()

  if (options?.includeArchived) {
    params.set('includeArchived', 'true')
  }

  if (options?.status && options.status !== 'all') {
    params.set('status', options.status)
  }

  if (options?.search?.trim()) {
    params.set('search', options.search.trim())
  }

  if (options?.page) {
    params.set('page', String(options.page))
  }

  if (options?.pageSize) {
    params.set('pageSize', String(options.pageSize))
  }

  const queryString = params.toString()

  return request<{ items: Amber[]; pagination: PaginationMeta }>(
    `/api/ambers${queryString ? `?${queryString}` : ''}`,
    {
    headers: authHeaders(token),
    },
  )
}

export function createAmber(
  token: string | null | undefined,
  payload: AmberMutationPayload & { passcode: string },
) {
  return request<{ item: Amber }>('/api/ambers', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

export function updateAmber(token: string | null | undefined, amberId: string, payload: AmberMutationPayload) {
  return request<{ item: Amber }>(`/api/ambers/${amberId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

export function cancelAmber(token: string | null | undefined, amberId: string) {
  return request<{ item: Amber }>(`/api/ambers/${amberId}/cancel`, {
    method: 'POST',
    headers: authHeaders(token),
  })
}

export function archiveAmber(token: string | null | undefined, amberId: string) {
  return request<{ item: Amber }>(`/api/ambers/${amberId}/archive`, {
    method: 'POST',
    headers: authHeaders(token),
  })
}

export function unsealAmber(payload: { code: string; passcode: string }) {
  return request<{ item: UnsealResult }>('/api/unseal', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchMailLogs(token?: string | null, options?: { amberIds?: string[] }) {
  const params = new URLSearchParams()

  if (options?.amberIds?.length) {
    params.set('amberIds', options.amberIds.join(','))
  }

  const queryString = params.toString()

  return request<{ items: MailLog[] }>(`/api/mail-logs${queryString ? `?${queryString}` : ''}`, {
    headers: authHeaders(token),
  })
}

export function retryMyMailLog(token: string | null | undefined, mailLogId: string) {
  return request<{ item: MailLog }>(`/api/mail-logs/${mailLogId}/retry`, {
    method: 'POST',
    headers: authHeaders(token),
  })
}

export function fetchPayments(token?: string | null) {
  return request<{ items: Payment[] }>('/api/payments', {
    headers: authHeaders(token),
  })
}

export function fetchPaymentPlans() {
  return request<{ items: PaymentPlan[] }>('/api/payment-plans')
}

export function fetchPayment(token: string | null | undefined, paymentId: string) {
  return request<{ item: Payment }>(`/api/payments/${paymentId}`, {
    headers: authHeaders(token),
  })
}

export function createPayment(token: string | null | undefined, payload: { note: string; planId: string }) {
  return request<{ item: Payment }>('/api/payments', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

export function fetchAdminOverview(
  token?: string | null,
  options?: {
    amberStatus?: 'all' | Amber['status']
    amberSearch?: string
    amberPage?: number
    amberPageSize?: number
    paymentStatus?: 'all' | PaymentStatus
    paymentSearch?: string
    paymentPage?: number
    paymentPageSize?: number
    mailStatus?: 'all' | MailLog['status']
    mailEvent?: 'all' | MailLog['event']
    mailSearch?: string
    mailPage?: number
    mailPageSize?: number
    actionType?: 'all' | AdminActionLog['actionType']
    actionSearch?: string
    actionPage?: number
    actionPageSize?: number
  },
) {
  const params = new URLSearchParams()

  if (options?.amberStatus && options.amberStatus !== 'all') {
    params.set('amberStatus', options.amberStatus)
  }

  if (options?.amberPage) {
    params.set('amberPage', String(options.amberPage))
  }

  if (options?.amberPageSize) {
    params.set('amberPageSize', String(options.amberPageSize))
  }

  if (options?.amberSearch?.trim()) {
    params.set('amberSearch', options.amberSearch.trim())
  }

  if (options?.paymentStatus && options.paymentStatus !== 'all') {
    params.set('paymentStatus', options.paymentStatus)
  }

  if (options?.paymentPage) {
    params.set('paymentPage', String(options.paymentPage))
  }

  if (options?.paymentPageSize) {
    params.set('paymentPageSize', String(options.paymentPageSize))
  }

  if (options?.paymentSearch?.trim()) {
    params.set('paymentSearch', options.paymentSearch.trim())
  }

  if (options?.mailStatus && options.mailStatus !== 'all') {
    params.set('mailStatus', options.mailStatus)
  }

  if (options?.mailEvent && options.mailEvent !== 'all') {
    params.set('mailEvent', options.mailEvent)
  }

  if (options?.mailPage) {
    params.set('mailPage', String(options.mailPage))
  }

  if (options?.mailPageSize) {
    params.set('mailPageSize', String(options.mailPageSize))
  }

  if (options?.mailSearch?.trim()) {
    params.set('mailSearch', options.mailSearch.trim())
  }

  if (options?.actionType && options.actionType !== 'all') {
    params.set('actionType', options.actionType)
  }

  if (options?.actionSearch?.trim()) {
    params.set('actionSearch', options.actionSearch.trim())
  }

  if (options?.actionPage) {
    params.set('actionPage', String(options.actionPage))
  }

  if (options?.actionPageSize) {
    params.set('actionPageSize', String(options.actionPageSize))
  }

  const queryString = params.toString()

  return request<AdminOverviewResponse>(`/api/admin/overview${queryString ? `?${queryString}` : ''}`, {
    headers: authHeaders(token),
  })
}

export function approvePayment(token: string | null | undefined, paymentId: string) {
  return request<{ item: Payment }>(`/api/admin/payments/${paymentId}/approve`, {
    method: 'POST',
    headers: authHeaders(token),
  })
}

export function processReadyEmails(token: string | null | undefined) {
  return request<{ processedCount: number; items: MailLog[] }>('/api/admin/mail-logs/process-ready', {
    method: 'POST',
    headers: authHeaders(token),
  })
}

export function retryMailLog(token: string | null | undefined, mailLogId: string) {
  return request<{ item: MailLog }>(`/api/admin/mail-logs/${mailLogId}/retry`, {
    method: 'POST',
    headers: authHeaders(token),
  })
}
