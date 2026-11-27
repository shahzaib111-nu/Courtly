import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { bookingFacility, BookingLine, PlayerEmpty } from '../components/player-booking-ui'
import { usePlayer } from '../components/player-layout'
import { ContentError, Dialog, Message, Skeleton, Toast } from '../components/ui'
import { ApiError, discoveryApi, playerApi } from '../lib/api'
import { invalidateAvailability } from '../lib/availability'
import { canPay, canReviewBooking, checkoutLink, formatDate } from '../lib/booking-time'
import type { Booking, BookingStatus } from '../lib/contracts'
import { useResource } from '../lib/use-resource'
import { useNotifications } from '../lib/notifications'

const filters: { value: BookingStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' }, { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' }, { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]
const statusOrder: Record<BookingStatus, number> = { PENDING: 0, CONFIRMED: 1, COMPLETED: 2, CANCELLED: 3 }

export function PlayerBookings() {
  const { userId } = usePlayer()
  const { refresh } = useNotifications()
  const location = useLocation()
  const bookings = useResource(useCallback((signal: AbortSignal) => playerApi.bookings(userId, signal), [userId]))
  const payments = useResource(useCallback((signal: AbortSignal) => playerApi.payments(userId, signal), [userId]))
  const courts = useResource(discoveryApi.courts)
  const facilities = useResource(discoveryApi.facilities)
  const [filter, setFilter] = useState<typeof filters[number]['value']>('ALL')
  const [target, setTarget] = useState<Booking | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<string>(location.state?.notice || '')
  const [now, setNow] = useState(Date.now())
  const cancelling = useRef(false)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [])

  const records = (bookings.data ?? []).filter(booking => filter === 'ALL' || booking.status === filter)
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status]
      || (statusOrder[a.status] < 2
        ? (a.bookingDate + a.timeSlot).localeCompare(b.bookingDate + b.timeSlot)
        : (b.closedAt ?? b.bookingDate).localeCompare(a.closedAt ?? a.bookingDate)))
  const receipts = new Set(payments.data?.filter(payment => payment.status === 'SUCCESS' || payment.status === 'REFUNDED')
    .map(payment => payment.bookingID))

  async function cancel() {
    if (!target || cancelling.current) return
    cancelling.current = true
    setBusy(true)
    setError('')
    try {
      const cancelled = await playerApi.cancel(target.bookingID)
      if (cancelled?.bookingID !== target.bookingID || cancelled.status !== 'CANCELLED') {
        throw new Error('Courtly could not verify the cancellation. Refresh your bookings before trying again.')
      }
      invalidateAvailability(cancelled.courtID)
      setTarget(null)
      bookings.retry()
      refresh()
      setNotice('Booking cancelled.')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The cancellation could not be confirmed.')
      if (failure instanceof ApiError && failure.status === 409) bookings.retry()
    } finally {
      cancelling.current = false
      setBusy(false)
    }
  }

  return <div className="player-page">
    <div className="player-page-heading">
      <div><h1>My bookings</h1><p>Manage your reservations. Completed and cancelled bookings appear for up to 24 hours.</p></div>
      <Link className="button button--primary" to="/player/courts">Find a court <ArrowRight size={17} aria-hidden="true" /></Link>
    </div>
    <section className="player-panel player-bookings-panel">
      <div className="booking-filter-row">
        <div className="booking-filters" role="group" aria-label="Filter bookings by status">
          {filters.map(option => <button className="booking-filter" type="button" key={option.value}
            aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}</button>)}
        </div>
        <button className="icon-button" title="Refresh bookings" aria-label="Refresh bookings" type="button" disabled={bookings.loading}
          onClick={() => { bookings.retry(); payments.retry() }}><RefreshCw size={17} /></button>
      </div>
      {payments.error && <ContentError error="Payment records could not be loaded." retry={payments.retry} />}
      {bookings.loading ? <Skeleton label="Loading bookings" count={3} />
        : bookings.error ? <ContentError error={bookings.error} retry={bookings.retry} />
        : records.length === 0 ? <PlayerEmpty title={filter === 'ALL' ? 'No bookings yet' : `No ${filter.toLowerCase()} bookings`}
          detail={filter === 'ALL' ? 'Once you reserve a court, it will appear here.' : 'Try another status to see your other bookings.'} browse={filter === 'ALL'} />
        : <div className="booking-lines">{records.map(booking => <BookingLine key={booking.bookingID} booking={booking}
          facility={bookingFacility(booking, courts.data, facilities.data)}>
          {canPay(booking, now) && <Link className="button button--primary button--small" to={checkoutLink(booking.bookingID)}>Continue to payment</Link>}
          {booking.status === 'PENDING' && !canPay(booking, now) && <span className="hold-ended">Payment window ended</span>}
          {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && <button className="booking-cancel" type="button"
            onClick={() => { setError(''); setTarget(booking) }}>Cancel booking</button>}
          {receipts.has(booking.bookingID) && <Link className="text-link" to={checkoutLink(booking.bookingID, true)}>View receipt</Link>}
          {canReviewBooking(booking, now) && <>
            <Link className="text-link" to={'/player/matches?' + new URLSearchParams({ booking: booking.bookingID })}>Match result</Link>
            <Link className="text-link" to={'/player/ratings?' + new URLSearchParams({ booking: booking.bookingID })}>Rate facility</Link>
          </>}
        </BookingLine>)}</div>}
    </section>
    {target && <Dialog title="Cancel this booking?" onClose={() => { if (!busy) setTarget(null) }}>
      <p className="dialog-note">{target.courtName || 'Court reservation'} · {formatDate(target.bookingDate)} · {target.timeSlot.replace('-', '–')}</p>
      {target.status === 'CONFIRMED' && <p className="dialog-note">If you paid for this booking, cancellation does not guarantee a refund.</p>}
      {error && <Message>{error}</Message>}
      <div className="booking-dialog-actions">
        <button className="button button--outline" type="button" disabled={busy} onClick={() => setTarget(null)}>Keep booking</button>
        <button className="button button--danger" type="button" disabled={busy} onClick={() => void cancel()}>
          {busy ? 'Cancelling…' : 'Cancel booking'}
        </button>
      </div>
    </Dialog>}
    {notice && <Toast onClose={() => setNotice('')}>{notice}</Toast>}
  </div>
}
