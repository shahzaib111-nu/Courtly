import { useCallback } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowRight, ArrowUpRight, CalendarDays, CreditCard, Medal } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { usePlayer } from '../components/player-layout'
import { NotificationList } from '../components/player-notifications'
import { bookingFacility, BookingLine, PlayerEmpty } from '../components/player-booking-ui'
import { ContentError, Skeleton } from '../components/ui'
import { discoveryApi, playerApi } from '../lib/api'
import { formatDate, isFutureSlot, priceLabel, sportLabel, todayInLahore } from '../lib/booking-time'
import { useResource } from '../lib/use-resource'

function QuickBook() {
  const navigate = useNavigate()
  const sports = useResource(discoveryApi.sports)
  const today = todayInLahore()

  function findTimes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const sport = String(form.get('sport') ?? '')
    if (!sports.data?.includes(sport)) return
    const query = new URLSearchParams({ sport, date: String(form.get('date') || today) })
    navigate('/player/courts?' + query)
  }

  return <section className="player-panel quick-book">
    <div className="player-panel-heading"><div><h2>Quick book</h2><p>Pick a sport and a day to see open courts.</p></div></div>
    {sports.error && <ContentError error={sports.error} retry={sports.retry} />}
    <form onSubmit={findTimes}>
      <div className="field"><label htmlFor="quick-sport">Sport</label>
        <select id="quick-sport" name="sport" defaultValue="" disabled={!sports.data?.length} required>
          <option value="" disabled>{sports.loading ? 'Loading sports…' : 'Select a sport'}</option>
          {sports.data?.map(sport => <option key={sport} value={sport}>{sportLabel(sport)}</option>)}
        </select>
      </div>
      <div className="field"><label htmlFor="quick-date">Date</label><input id="quick-date" name="date" type="date" min={today} defaultValue={today} required /></div>
      <button className="button button--primary" disabled={!sports.data?.length}>Find times <ArrowRight size={17} aria-hidden="true" /></button>
    </form>
  </section>
}

function Metric({ label, value, note, icon, loading, error, retry }: {
  label: string; value: ReactNode; note: string; icon: ReactNode; loading: boolean; error?: string; retry: () => void
}) {
  return <div className="player-metric">
    <div className="player-metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div>
    {loading ? <div className="metric-skeleton skeleton" role="status" aria-label={`Loading ${label.toLowerCase()}`} />
      : error ? <div className="metric-unavailable"><p>Unavailable</p><button type="button" className="text-link" onClick={retry}>Retry</button></div>
      : <><strong>{value}</strong><p>{note}</p></>}
  </div>
}

export function PlayerOverview() {
  const { userId, email, name } = usePlayer()
  const profile = useResource(useCallback((signal: AbortSignal) => playerApi.profile(email, signal), [email]))
  const bookings = useResource(useCallback((signal: AbortSignal) => playerApi.bookings(userId, signal), [userId]))
  const payments = useResource(useCallback((signal: AbortSignal) => playerApi.payments(userId, signal), [userId]))
  const rankings = useResource(useCallback((signal: AbortSignal) => playerApi.rankingPoints(userId, signal), [userId]))
  const courts = useResource(discoveryApi.courts)
  const facilities = useResource(discoveryApi.facilities)

  const firstName = (profile.data?.name || name).trim().split(/\s+/)[0]
  const active = (bookings.data ?? []).filter(booking => booking.status === 'PENDING' || booking.status === 'CONFIRMED')
  const upcoming = active.filter(booking => isFutureSlot(booking.bookingDate, booking.timeSlot.split('-')[0]))
    .sort((a, b) => (a.bookingDate + a.timeSlot).localeCompare(b.bookingDate + b.timeSlot)).slice(0, 3)
  const paid = (payments.data ?? []).filter(payment => payment.status === 'SUCCESS')

  return <div className="player-page player-overview">
    <section className="player-welcome" aria-labelledby="welcome-title">
      <img src="/images/tennis-court-1280.webp" alt="" decoding="async"
        srcSet="/images/tennis-court-640.webp 640w, /images/tennis-court-1280.webp 1280w" sizes="(max-width: 900px) 90vw, 58vw"
        onError={event => { event.currentTarget.hidden = true }} />
      <div className="player-welcome-copy">
        <p className="eyebrow">{formatDate(todayInLahore(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 id="welcome-title">{firstName ? `Welcome, ${firstName}.` : 'Welcome to Courtly.'}</h1>
        <p>Find a time to play in Lahore.</p>
        <Link className="button button--lime" to="/player/courts">Find a court <ArrowUpRight size={18} aria-hidden="true" /></Link>
      </div>
    </section>
    <section className="player-metrics" aria-label="Player statistics">
      <Metric label="Active bookings" value={active.length} note="Pending and confirmed" icon={<CalendarDays size={19} />}
        loading={bookings.loading} error={bookings.error} retry={bookings.retry} />
      <Metric label="Ranking points" value={rankings.data} note="Courtly leaderboard" icon={<Medal size={19} />}
        loading={rankings.loading} error={rankings.error} retry={rankings.retry} />
      <Metric label="Card payments" value={priceLabel(paid.reduce((total, payment) => total + payment.amountPaid, 0))}
        note={paid.length === 1 ? '1 successful payment' : `${paid.length} successful payments`} icon={<CreditCard size={19} />}
        loading={payments.loading} error={payments.error} retry={payments.retry} />
    </section>
    <div className="overview-grid">
      <section className="player-panel overview-upcoming">
        <div className="player-panel-heading">
          <div><h2>Upcoming bookings</h2><p>Your next sessions, in order.</p></div>
          <Link to="/player/bookings" className="text-link directional-link">My bookings <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        {bookings.loading ? <Skeleton label="Loading upcoming bookings" count={2} />
          : bookings.error ? <ContentError error={bookings.error} retry={bookings.retry} />
          : upcoming.length ? <div className="booking-lines">{upcoming.map(booking =>
            <BookingLine key={booking.bookingID} booking={booking} facility={bookingFacility(booking, courts.data, facilities.data)} />)}</div>
          : <PlayerEmpty title="No upcoming bookings" detail="Choose a court and a time to plan your next game." browse />}
      </section>
      <QuickBook />
    </div>
    <section className="player-panel overview-notices">
      <div className="player-panel-heading"><div><h2>Recent notifications</h2><p>Updates about your Courtly account and bookings.</p></div>
        <Link className="text-link directional-link" to="/player/notifications">Open inbox <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
      <NotificationList limit={3} />
    </section>
  </div>
}
