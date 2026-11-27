import type {
  Court, Credentials, Facility, FacilityDetail, LoginResponse, Provider,
  RegistrationRequest, RegistrationResponse, RegistrationRole, Slot,
  Booking, BookingQuote, BookingRequest, PlayerNotification, PlayerPayment, PlayerProfile, RankingEntry,
  AccountProfile, Checkout, DocumentType, FacilityRating, MatchResult, MatchSubmission, ProfileUpdate,
  RatingSubmission, VerificationRecord,
} from './contracts'

export const API_BASE = 'http://localhost:8081'
export const SESSION_EXPIRED = 'courtly:session-expired'

type ApiPath = `/api/${string}`
type Query = Record<string, string | number | boolean | null | undefined>
type Body = Record<string, unknown> | RegistrationRequest | BookingRequest | ProfileUpdate
  | MatchSubmission | RatingSubmission | URLSearchParams | FormData

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  query?: Query
  body?: Body
  response?: 'json' | 'blob' | 'text' | 'empty'
  authenticated?: boolean
  signal?: AbortSignal
  cache?: RequestCache
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function makeUrl(path: ApiPath, query?: Query) {
  const url = new URL(path, API_BASE)
  if (url.origin !== API_BASE || !url.pathname.startsWith('/api/')) {
    throw new ApiError('Invalid Courtly API address.')
  }
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value != null) url.searchParams.set(key, String(value))
  }
  return url
}

const readable = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

async function responseError(response: Response) {
  const fallback = {
    401: 'Sign in to continue.',
    403: 'Your account does not have access to this action.',
    404: 'We could not find what you requested.',
    413: 'The selected file is too large.',
    423: 'Your account is temporarily locked.',
    503: 'This service is currently unavailable.',
  }[response.status] ?? 'The server could not complete the request. Please try again.'

  if (response.status >= 500) return new ApiError(fallback, response.status)
  const body = await response.text().catch(() => '')

  if (response.headers.get('content-type')?.includes('json')) {
    try {
      const data = JSON.parse(body)
      const fields = Object.fromEntries(
        Object.entries(data?.fieldErrors ?? {}).filter((entry): entry is [string, string] => readable(entry[1])),
      )
      const message = readable(data?.message) ? data.message : readable(data?.error) ? data.error : fallback
      return new ApiError(message, response.status, fields)
    } catch {
      return new ApiError(fallback, response.status)
    }
  }
  const message = response.headers.get('content-type')?.includes('text/plain') && readable(body)
    ? body.trim() : fallback
  return new ApiError(message, response.status)
}

export async function apiRequest<T>(path: ApiPath, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers()
  const token = options.authenticated === false ? null : localStorage.getItem('jwtToken')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let body: BodyInit | undefined
  if (options.body instanceof FormData || options.body instanceof URLSearchParams) {
    body = options.body
  } else if (options.body) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.body)
  }

  const url = makeUrl(path, options.query)
  let response: Response
  try {
    response = await fetch(url, { method: options.method ?? 'GET', headers, body, signal: options.signal, cache: options.cache, redirect: 'error' })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new ApiError('Courtly could not reach the server. Please try again.')
  }

  if (!response.ok) {
    // Stripe provider errors can contain configuration details. Keep them out of the UI.
    if (response.status >= 500 && path.startsWith('/api/payments/')) {
      const message = response.status === 503 ? 'Online payments are not configured on this server.'
        : 'Courtly could not complete the payment request. Please try again.'
      throw new ApiError(message, response.status)
    }
    if (response.status >= 500 && path === '/api/auth/forgot-password') {
      throw new ApiError('Courtly could not send a recovery email. Check your address and try again later.', response.status)
    }
    const error = await responseError(response)
    const incorrectPassword = path === '/api/auth/change-password' && error.message === 'Current password is incorrect.'
    if (response.status === 401 && !incorrectPassword && token && localStorage.getItem('jwtToken') === token) {
      window.dispatchEvent(new Event(SESSION_EXPIRED))
    }
    throw error
  }
  if (options.response === 'blob') return await response.blob() as T
  if (options.response === 'text') return await response.text() as T
  if (response.status === 204 || options.response === 'empty') return undefined as T

  const content = await response.text()
  if (!content.trim()) return undefined as T
  try {
    return JSON.parse(content) as T
  } catch {
    throw new ApiError('Courtly received an unexpected server response.', response.status)
  }
}

const publicly = { authenticated: false } as const

export const authApi = {
  login: ({ email, pass, role }: Credentials) =>
    apiRequest<LoginResponse>('/api/auth/login', {
      ...publicly, method: 'POST', body: new URLSearchParams({ email, pass, role }),
    }),
  register: (body: RegistrationRequest) =>
    apiRequest<RegistrationResponse>('/api/auth/register', { ...publicly, method: 'POST', body }),
  forgot: (email: string) =>
    apiRequest<{ message: string }>('/api/auth/forgot-password', { ...publicly, method: 'POST', body: { email } }),
  verifyOtp: (email: string, otp: string) =>
    apiRequest<{ message: string }>('/api/auth/verify-otp', { ...publicly, method: 'POST', body: { email, otp } }),
  reset: (email: string, otp: string, newPassword: string) =>
    apiRequest<{ message: string }>('/api/auth/reset-password-otp', {
      ...publicly, method: 'PUT', body: { email, otp, newPassword },
    }),
  providers: (signal?: AbortSignal) =>
    apiRequest<{ providers: Provider[] }>('/api/auth/oauth2/providers', { ...publicly, signal }),
  authorizeUrl: (provider: Provider, role: RegistrationRole) =>
    makeUrl(`/api/auth/oauth2/authorize/${provider}`, {
      role, redirect_uri: new URL('/oauth-callback', window.location.origin).href,
    }).href,
}

export const discoveryApi = {
  courts: (signal?: AbortSignal) => apiRequest<Court[]>('/api/courts', { ...publicly, signal }),
  facilities: (signal?: AbortSignal) => apiRequest<Facility[]>('/api/facilities', { ...publicly, signal }),
  sports: (signal?: AbortSignal) => apiRequest<string[]>('/api/courts/sport-types', { ...publicly, signal }),
  court: (id: string, signal?: AbortSignal) =>
    apiRequest<Court>(`/api/courts/${encodeURIComponent(id)}`, { ...publicly, signal }),
  facility: (id: string, signal?: AbortSignal) =>
    apiRequest<FacilityDetail>(`/api/facilities/${encodeURIComponent(id)}`, { ...publicly, signal }),
  availability: (date: string, type: string, signal?: AbortSignal) =>
    apiRequest<Slot[]>('/api/bookings/availability', { ...publicly, query: { date, type }, signal }),
  courtSlots: (courtID: string, date: string, signal?: AbortSignal) =>
    apiRequest<Slot[]>(`/api/bookings/court/${encodeURIComponent(courtID)}`, { ...publicly, query: { date }, signal }),
  price: (courtID: string, date: string, timeSlot: string, signal?: AbortSignal) =>
    apiRequest<BookingQuote>('/api/bookings/price', { ...publicly, query: { courtID, date, timeSlot }, signal }),
}

function verificationFields(record: VerificationRecord): VerificationRecord {
  const { docID, docType, uploadDate, status, rejectionReason, reviewedAt } = record
  return { docID, docType, uploadDate, status, rejectionReason, reviewedAt }
}

const encode = encodeURIComponent

export const playerApi = {
  profile: async (email: string, signal?: AbortSignal): Promise<PlayerProfile> => {
    const { name } = await apiRequest<PlayerProfile>('/api/auth/profile', { query: { email }, signal })
    return { name }
  },
  bookings: (playerID: string, signal?: AbortSignal) =>
    apiRequest<Booking[]>(`/api/bookings/player/${encodeURIComponent(playerID)}`, { signal }),
  reserve: (body: BookingRequest) => apiRequest<Booking>('/api/bookings', { method: 'POST', body }),
  cancel: (bookingID: string) => apiRequest<Booking>(`/api/bookings/${encodeURIComponent(bookingID)}/cancel`, { method: 'PUT' }),
  payments: (playerID: string, signal?: AbortSignal) =>
    apiRequest<PlayerPayment[]>(`/api/payments/player/${encode(playerID)}`, { signal }),
  rankingPoints: async (playerID: string, signal?: AbortSignal) => {
    const rankings = await apiRequest<RankingEntry[]>('/api/matches/leaderboard', { signal })
    return rankings.find(entry => entry.playerID === playerID)?.rankPoints ?? 0
  },
}

export const paymentApi = {
  receipt: (bookingID: string, signal?: AbortSignal) =>
    apiRequest<PlayerPayment>(`/api/payments/booking/${encode(bookingID)}`, { signal }),
  start: (bookingID: string) =>
    apiRequest<Checkout>('/api/payments/create-payment-intent', { method: 'POST', body: { bookingID } }),
  confirm: (bookingID: string, paymentIntentID: string) =>
    apiRequest<PlayerPayment>('/api/payments/confirm', { method: 'POST', body: { bookingID, paymentIntentID } }),
}

export const matchApi = {
  history: (id: string, signal?: AbortSignal) => apiRequest<MatchResult[]>(`/api/matches/player/${encode(id)}`, { signal }),
  check: (id: string, signal?: AbortSignal) => apiRequest<{ submitted: boolean }>(`/api/matches/check/${encode(id)}`, { signal }),
  submit: (body: MatchSubmission) => apiRequest<MatchResult>('/api/matches/submit', { method: 'POST', body }),
  leaderboard: (signal?: AbortSignal) => apiRequest<RankingEntry[]>('/api/matches/leaderboard', { signal }),
}

export const ratingApi = {
  history: (id: string, signal?: AbortSignal) => apiRequest<FacilityRating[]>(`/api/ratings/player/${encode(id)}`, { signal }),
  check: (id: string, signal?: AbortSignal) => apiRequest<{ submitted: boolean }>(`/api/ratings/check/${encode(id)}`, { signal }),
  submit: (body: RatingSubmission) => apiRequest<FacilityRating>('/api/ratings/submit', { method: 'POST', body }),
  average: (id: string, signal?: AbortSignal) =>
    apiRequest<{ average: number }>(`/api/ratings/average/${encode(id)}`, { ...publicly, signal }),
}

export const notificationApi = {
  list: async (userId: string, signal?: AbortSignal): Promise<PlayerNotification[]> => {
    const items = await apiRequest<PlayerNotification[]>('/api/notifications', { query: { userId }, signal })
    return items.map(({ notificationID, type, title, message, read, createdAt }) => ({ notificationID, type, title, message, read, createdAt }))
  },
  unread: (userId: string, signal?: AbortSignal) =>
    apiRequest<{ count: number }>('/api/notifications/unread-count', { query: { userId }, signal }),
  read: (id: string) => apiRequest<void>(`/api/notifications/${encode(id)}/read`, { method: 'PUT' }),
  readAll: (userId: string) => apiRequest<void>('/api/notifications/read-all', { method: 'PUT', query: { userId } }),
  remove: (id: string) => apiRequest<void>(`/api/notifications/${encode(id)}`, { method: 'DELETE' }),
  clear: (userId: string) => apiRequest<void>('/api/notifications/all', { method: 'DELETE', query: { userId } }),
}

export const accountApi = {
  profile: (email: string, signal?: AbortSignal) =>
    apiRequest<AccountProfile>('/api/auth/profile', { query: { email }, signal }),
  update: (body: ProfileUpdate) => apiRequest<AccountProfile>('/api/auth/profile', { method: 'PUT', body }),
  status: (playerID: string, signal?: AbortSignal) =>
    apiRequest<{ accountStatus: string }>('/api/auth/account-status', { query: { playerID }, signal }),
  password: (email: string, currentPassword: string, newPassword: string) =>
    apiRequest<{ message: string }>('/api/auth/change-password', { method: 'PUT', body: { email, currentPassword, newPassword } }),
  requestDeletion: (playerEmail: string) =>
    apiRequest<void>('/api/auth/request-deletion', { method: 'POST', query: { playerEmail } }),
  documents: async (playerEmail: string, signal?: AbortSignal) =>
    (await apiRequest<VerificationRecord[]>('/api/docs/status', { query: { playerEmail }, signal })).map(verificationFields),
  upload: async (playerEmail: string, docType: DocumentType, file: File) => {
    const body = new FormData()
    body.append('file', file)
    body.append('docType', docType)
    body.append('playerEmail', playerEmail)
    return verificationFields(await apiRequest<VerificationRecord>('/api/docs/upload', { method: 'POST', body }))
  },
}
