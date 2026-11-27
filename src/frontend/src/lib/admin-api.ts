import { apiRequest } from './api'
import type { FacilityRating, MatchOutcome, MatchResult } from './contracts'

export interface ManagerApplication { userID: string; name: string; email: string; phone: string; dateOfBirth: string }
export interface ReviewDoc { docID: string; docType: string; uploadDate: string; status: string; applicant: string; email: string }
export interface DeletionAccount { name: string; email: string; deletionRequestedAt: string | null; daysRemaining?: number }
export type DeletionAction = 'DELETE_NOW' | 'ARCHIVE' | 'CANCEL'
export interface ActiveBooking { courtName: string; playerName: string; bookingDate: string; timeSlot: string; status: string }
export interface PaymentSummary { payerName: string; paymentDateTime: string; courtName: string; bookingDate: string; timeSlot: string; amountPaid: number }
export interface Delivery {
  deliveryID: string; type: string; status: string; recipientEmail: string | null; attempts: number
  createdAt: string; lastAttemptAt: string | null; nextAttemptAt: string | null; deliveredAt: string | null; lastError: string | null
}
interface BackupFile { fileName: string; sizeBytes: number; createdAt: string }
interface BackupStatus {
  enabled: boolean; intervalDays: number; keep: number; encrypted: boolean; lastBackupAt: string | null
  nextDueAt: string | null; backups: BackupFile[]
}
export interface ReportLog { reportID: string; reportType: string; filters: string | null; exportFormat: string; generatedAt: string }
export interface Ranking {
  playerID: string; playerName: string; rank: number; sportType: string
  matches: number; wins: number; losses: number; draws: number; points: number; winRate: number
}
export type SummaryType = 'COURT_UTILIZATION' | 'REVENUE_SUMMARY' | 'USER_DEMOGRAPHICS'
export type ReportType = SummaryType | 'PLAYER_RANKINGS' | 'FACILITY_FEEDBACK'
interface SummaryBase { generatedAt: string; startDate: string; endDate: string }
export type SummaryReport = SummaryBase & (
  { type: 'COURT_UTILIZATION'; totalCourts: number; totalBookings: number; pastBookings: number; upcomingBookings: number
    totalBookedHours: number; averageUtilization: number; topCourts: { courtName: string; bookedSlots: number; utilizationPercent: number }[] }
  | { type: 'REVENUE_SUMMARY'; totalRevenue: number; baseRevenue: number; peakWeekendExtra: number; discountRevenue: number
    bookingCount: number; averageRevenue: number; revenueBySport: Record<string, number> }
  | { type: 'USER_DEMOGRAPHICS'; totalPlayers: number; totalManagers: number; ageGroupCounts: Record<string, number>; discountTierCounts: Record<string, number> }
)
const encode = encodeURIComponent
type Query = Record<string, string | number | undefined>
type AdminPath = `/api/admin/${string}`
function read<T>(name: string, signal?: AbortSignal, query?: Query) {
  return apiRequest<T>(('/api/admin/' + name) as AdminPath, { signal, query, cache: 'no-store' })
}
function post<T>(name: string, query?: Query, response?: 'empty') {
  return apiRequest<T>(('/api/admin/' + name) as AdminPath, { method: 'POST', query, response })
}

export const adminApi = {
  managers: (signal?: AbortSignal) => read<ManagerApplication[]>('pending-managers', signal),
  managerDecision: (playerID: string, action: 'APPROVE' | 'REJECT', rejectionReason?: string) =>
    post<void>('approve-manager', { playerID, action, rejectionReason }, 'empty'),
  documents: async (signal?: AbortSignal): Promise<ReviewDoc[]> =>
    (await read<(Omit<ReviewDoc, 'applicant' | 'email'> & { player?: { name?: string; email?: string } })[]>('pending-docs', signal))
      .map(({ docID, docType, uploadDate, status, player }) => ({ docID, docType, uploadDate, status, applicant: player?.name ?? '', email: player?.email ?? '' })),
  statistics: (signal?: AbortSignal) => read<{ pendingCount: number; approvedToday: number; rejectedToday: number }>('stats', signal),
  preview: (id: string, signal: AbortSignal) => apiRequest<Blob>(
    `/api/docs/view/${encode(id)}`, { response: 'blob', cache: 'no-store', signal }),
  review: (docID: string, newStatus: 'APPROVED' | 'REJECTED', rejectionReason?: string) =>
    post<void>('verify-doc', { docID, newStatus, rejectionReason }, 'empty'),
  deletions: (signal?: AbortSignal) => read<DeletionAccount[]>('deletion-requests', signal),
  archive: (signal?: AbortSignal) => read<DeletionAccount[]>('archived-accounts', signal),
  processAccount: (playerEmail: string, action: DeletionAction) => post<void>('process-deletion', { playerEmail, action }, 'empty'),
  bookings: (signal?: AbortSignal) => read<ActiveBooking[]>('active-bookings', signal),
  payments: (from: string, to: string, signal?: AbortSignal) => read<PaymentSummary[]>('payment-history', signal, { from, to }),
  disputes: (signal?: AbortSignal) => apiRequest<(MatchResult & { playerName: string | null })[]>('/api/matches/disputed', { signal, cache: 'no-store' }),
  resolve: (id: string, playerScore: number, opponentScore: number, result: MatchOutcome) =>
    apiRequest<MatchResult>(`/api/matches/${encode(id)}/resolve`, { method: 'POST', body: { playerScore, opponentScore, result } }),
  summary: (type: SummaryType, startDate: string, endDate: string, courtType?: string) =>
    read<SummaryReport>('reports', undefined, { type, startDate, endDate, courtType }),
  rankings: (dateFrom: string, dateTo: string, sportType?: string) =>
    apiRequest<Ranking[]>('/api/matches/rankings', { query: { dateFrom, dateTo, sportType }, cache: 'no-store' }),
  feedback: () => apiRequest<FacilityRating[]>('/api/ratings/all', { cache: 'no-store' }),
  log: (reportType: ReportType, filters: Record<string, string>, exportFormat: 'PDF' | 'CSV' | 'VIEW') =>
    apiRequest<ReportLog>('/api/admin/reports/log', { method: 'POST', body: { reportType, filters, exportFormat } }),
  history: (signal?: AbortSignal) => read<ReportLog[]>('reports/history', signal, { limit: 50 }),
  delivery: async (status: string, limit: number, signal: AbortSignal) => {
    const { counts, entries } = await apiRequest<{ counts: Record<string, number>; entries: Delivery[] }>('/api/notifications/delivery-log',
      { query: { status: status || undefined, limit }, signal, cache: 'no-store' })
    return { counts, entries: entries.map(({ deliveryID, type, status, recipientEmail, attempts, createdAt, deliveredAt, lastAttemptAt, nextAttemptAt, lastError }) =>
      ({ deliveryID, type, status, recipientEmail, attempts, createdAt, deliveredAt, lastAttemptAt, nextAttemptAt, lastError: lastError ? 'Delivery attempt failed' : null })) }
  },
  testEmail: (to: string) => read<{ status: string }>('test-email', undefined, { to }),
  backups: async (signal?: AbortSignal) => {
    const { enabled, intervalDays, keep, encrypted, lastBackupAt, nextDueAt, backups } = await read<BackupStatus>('backups', signal)
    return { enabled, intervalDays, keep, encrypted, lastBackupAt, nextDueAt, backups }
  },
  createBackup: () => post<BackupFile>('backups'),
}
