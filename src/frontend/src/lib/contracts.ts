export type Role = 'PLAYER' | 'MANAGER' | 'ADMIN'
export type RegistrationRole = Exclude<Role, 'ADMIN'>
export type Provider = 'google' | 'github'
export type Category = 'REGULAR' | 'STUDENT' | 'SENIOR' | 'FAMILY' | 'GROUP'

export interface RegistrationRequest {
  name: string
  email: string
  password: string
  username?: string
  phone: string
  dateOfBirth: string
  role: RegistrationRole
  category?: Category
  studentId?: string
  universityEmail?: string
  familySize?: number
  groupSize?: number
  leadMemberName?: string
}

export interface RegistrationResponse {
  userID: string
  name: string
  email: string
  role: RegistrationRole
  accountStatus: string
}

export interface LoginResponse {
  success: true
  role: Role
  playerID: string | null
  name: string
  email: string
  accountStatus: string | null
  token: string
  expiresIn: number
}

export interface Credentials {
  email: string
  pass: string
  role: Role
}

export interface Court {
  courtID: string
  name: string
  sportType: string
  hourlyRate: number
  capacity: number
  openTime: string | null
  closeTime: string | null
  slotDurationMinutes: number
  status: string
  description: string | null
  managerId: string | null
  facilityId: string | null
  peakStartTime: string | null
  peakEndTime: string | null
  peakMultiplier: number
  weekendMultiplier: number
  maintenanceFrom: string | null
  maintenanceTo: string | null
}

export interface Facility {
  facilityID: string
  name: string
  location: string | null
  openingTime: string
  closingTime: string
  managerId: string | null
  managerName: string | null
  operatingStatus: 'OPEN' | 'CLOSED'
  courtCount: number
  averageRating: number | null
  ratingCount: number
}

export interface FacilityDetail {
  facility: Facility
  courts: Court[]
}

export interface Slot {
  courtID: string
  courtName: string
  sportType: string
  timeSlot: string
  startTime: string
  endTime: string
  available: boolean
  isPeak: boolean
  price: number
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'

export interface BookingRequest {
  playerID: string
  courtID: string
  bookingDate: string
  timeSlot: string
}

export interface Booking extends BookingRequest {
  bookingID: string
  courtName: string | null
  sportType: string | null
  baseRate: number
  totalCost: number
  discountApplied: number
  peakHour: boolean
  status: BookingStatus
  createdAt: string | null
  confirmedAt: string | null
  closedAt: string | null
}

export interface BookingQuote {
  courtID: string
  courtName: string
  timeSlot: string
  date: string
  baseRate: number
  peakMultiplier: number
  isPeak: boolean
  price: number
}

// Keep only the fields the player screens use from the backend responses.
export interface PlayerProfile {
  name: string
}

export interface ProfileUpdate {
  name: string
  username: string
  phone: string
  dateOfBirth: string
  category?: Category
  studentId?: string
  universityEmail?: string
  familySize?: number
  groupSize?: number
  leadMemberName?: string
}

export interface AccountProfile {
  name: string
  email: string
  username: string | null
  phone: string | null
  dateOfBirth: string | null
  category: Category
  studentId: string | null
  universityEmail: string | null
  familySize: number | null
  groupSize: number | null
  leadMemberName: string | null
  discountTier: string
  accountStatus: string | null
  deletionStatus: string | null
  authProvider: string
  hasPassword: boolean
}

export interface PlayerPayment {
  paymentID: string
  receiptNo: string | null
  bookingID: string
  status: string
  playerName: string | null
  courtName: string | null
  bookingDate: string | null
  timeSlot: string | null
  peakHour: boolean
  subtotal: number
  discount: number
  amountPaid: number
  cardBrand: string | null
  maskedCard: string | null
  transactionRef: string | null
  paidAt: string | null
}

export interface Checkout {
  bookingID: string
  paymentIntentID: string
  clientSecret: string
  publishableKey: string
  courtName: string | null
  sportType: string | null
  bookingDate: string
  timeSlot: string
  peakHour: boolean
  subtotal: number
  discount: number
  amount: number
  currency: string
  paymentDeadline: string
}

export type MatchOutcome = 'WIN' | 'LOSS' | 'DRAW'

export interface MatchSubmission {
  bookingID: string
  playerID: string
  opponentName: string
  playerScore: number
  opponentScore: number
  result: MatchOutcome
}

export interface MatchResult extends MatchSubmission {
  matchID: string
  courtName: string | null
  sportType: string | null
  bookingDate: string
  timeSlot: string
  pointsEarned: number
  status: string
  disputeReason: string | null
  submittedAt: string
  resolvedAt: string | null
}

export interface RatingSubmission {
  bookingID: string
  playerID: string
  ratingScore: number
  feedbackText: string
}

export interface FacilityRating extends Omit<RatingSubmission, 'feedbackText'> {
  ratingID: string
  courtID: string
  courtName: string | null
  facilityId: string | null
  facilityName: string | null
  sportType: string | null
  bookingDate: string
  feedbackText: string | null
  submittedAt: string
}

export type DocumentType = 'STUDENT_ID' | 'SENIOR_CARD' | 'FAMILY_CARD'

export interface VerificationRecord {
  docID: string
  docType: DocumentType
  uploadDate: string
  status: string
  rejectionReason: string | null
  reviewedAt: string | null
}

export interface RankingEntry {
  playerID: string
  playerName: string
  rankPoints: number
}

export interface PlayerNotification {
  notificationID: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
}
