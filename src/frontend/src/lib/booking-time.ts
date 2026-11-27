import type { Booking } from './contracts'

const timeZone = 'Asia/Karachi'
const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
const wallTime = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const moneyFormat = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 })

export const dateObject = (date: string) => new Date(date + 'T12:00:00Z')
export const priceLabel = (price: number) => 'PKR ' + moneyFormat.format(price)
export const sportLabel = (sport: string) => sport ? sport.charAt(0) + sport.slice(1).toLowerCase() : 'Court booking'

export function todayInLahore(now = new Date()) {
  const parts = dateParts.formatToParts(now)
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-')
}

export function isFutureSlot(date: string, startTime: string, now = new Date()) {
  const today = todayInLahore(now)
  return date > today || (date === today && startTime > wallTime.format(now))
}

export function addDays(date: string, days: number) {
  const value = dateObject(date)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function weekStart(date: string) {
  return addDays(date, -((dateObject(date).getUTCDay() + 6) % 7))
}

export function formatDate(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  const value = dateObject(date)
  return Number.isNaN(value.getTime()) ? date : new Intl.DateTimeFormat('en-PK', { ...options, timeZone: 'UTC' }).format(value)
}

export function lahoreTimestamp(value: string) {
  return Date.parse(/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? value : value + '+05:00')
}

export function canPay(booking: Booking, now: number) {
  if (booking.status !== 'PENDING') return false
  const created = booking.createdAt ? lahoreTimestamp(booking.createdAt) : NaN
  // The backend enforces the ten-minute hold. Older records may omit createdAt.
  return !Number.isFinite(created) || now < created + 10 * 60 * 1000
}

export function checkoutLink(bookingID: string, receipt = false) {
  return `/player/${receipt ? 'payments' : 'checkout'}/${encodeURIComponent(bookingID)}`
}

export function formatTimestamp(value: string | null) {
  if (!value) return 'Unavailable'
  const date = new Date(lahoreTimestamp(value))
  return Number.isNaN(date.valueOf()) ? 'Unavailable' : new Intl.DateTimeFormat('en-PK', {
    timeZone, dateStyle: 'medium', timeStyle: 'short',
  }).format(date)
}

export function canReviewBooking(booking: Booking, now = Date.now()) {
  const end = booking.timeSlot.split('-')[1]?.trim()
  return (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') &&
    !!end && now > lahoreTimestamp(`${booking.bookingDate}T${end}`)
}
