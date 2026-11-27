import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, RefreshCw, Search, UsersRound, Zap,
} from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PlayerEmpty, SportGlyph } from '../components/player-booking-ui'
import { usePlayer } from '../components/player-layout'
import { ContentError, Dialog, Message, Skeleton } from '../components/ui'
import { ApiError, discoveryApi, playerApi } from '../lib/api'
import { invalidateAvailability, loadAvailability } from '../lib/availability'
import type { AvailabilityDay } from '../lib/availability'
import { addDays, checkoutLink, formatDate, isFutureSlot, priceLabel, sportLabel, todayInLahore, weekStart } from '../lib/booking-time'
import type { Court, Facility, Slot } from '../lib/contracts'
import { useResource } from '../lib/use-resource'
import { useNotifications } from '../lib/notifications'
import { validDate } from '../lib/validation'

const layoutQuery = '(max-width: 850px)'

function useDailyCalendar() {
  const [daily, setDaily] = useState(() => window.matchMedia(layoutQuery).matches)
  useEffect(() => {
    const query = window.matchMedia(layoutQuery)
    const sync = () => setDaily(query.matches)
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  return daily
}

function CourtChoice({ court, facility, selected, choose }: { court: Court; facility?: Facility; selected: boolean; choose: () => void }) {
  const status = court.status === 'AVAILABLE' ? 'Available for booking' : court.status === 'MAINTENANCE' ? 'Maintenance' : 'Closed'
  return <button className="court-choice" type="button" aria-pressed={selected} onClick={choose}>
    <span className="booking-icon"><SportGlyph sport={court.sportType} /></span>
    <span className="court-choice-copy">
      <strong>{court.name}</strong>
      {facility && <span><MapPin size={13} aria-hidden="true" />{facility.name}</span>}
      <span className={court.status === 'AVAILABLE' ? 'court-choice-open' : ''}>{status}</span>
    </span>
    <ChevronRight size={17} className="court-choice-chevron" aria-hidden="true" />
  </button>
}

interface Selection {
  date: string
  slot: Slot
}

function CalendarColumn({ day, date, court, today, loading, selection, onSelect, onRetry }: {
  day?: AvailabilityDay; date: string; court: Court; today: string; loading: boolean
  selection: Selection | null; onSelect: (slot: Slot, date: string) => void; onRetry: () => void
}) {
  if (date < today) return <p className="calendar-column-note">Past date</p>
  if (loading) return <div className="calendar-column-skeleton" role="status" aria-label="Checking times for this date"><i /><i /><i /></div>
  if (day?.error) return <div className="calendar-column-note" role="alert"><span>{day.error}</span>
    <button className="text-link" type="button" onClick={onRetry}>Retry</button></div>
  if (!day?.slots?.length) return <p className="calendar-column-note">No scheduled times</p>
  return <div className="calendar-times">{day.slots.map(slot => {
    const past = !isFutureSlot(date, slot.startTime)
    const available = court.status === 'AVAILABLE' && slot.available && !past
    const selected = selection?.date === date && selection.slot.timeSlot === slot.timeSlot
    return <button key={slot.timeSlot} className="calendar-slot" type="button" disabled={!available} aria-pressed={selected}
      data-slot-state={past ? 'past' : available && slot.isPeak ? 'peak' : undefined}
      aria-label={`${slot.startTime} to ${slot.endTime}, ${past ? 'past' : available ? priceLabel(slot.price) + (slot.isPeak ? ', peak time' : '') : 'unavailable'}`}
      onClick={() => onSelect(slot, date)}>
      <span><strong>{slot.startTime}</strong><span className="slot-end">–{slot.endTime}</span>{available && slot.isPeak && <Zap size={13} aria-hidden="true" />}</span>
      <small>{past ? 'Past' : available ? priceLabel(slot.price) : 'Unavailable'}</small>
    </button>
  })}</div>
}

function ReservationReview({ court, facility, selection, onClose, onChanged }: {
  court: Court; facility?: Facility; selection: Selection; onClose: () => void; onChanged: () => void
}) {
  const { userId } = usePlayer()
  const { refresh } = useNotifications()
  const navigate = useNavigate()
  const { date, slot } = selection
  const loadQuote = useCallback((signal: AbortSignal) => discoveryApi.price(court.courtID, date, slot.timeSlot, signal),
    [court.courtID, date, slot.timeSlot])
  const quote = useResource(loadQuote)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const submitting = useRef(false)

  async function reserve(andPay: boolean) {
    if (submitting.current || !quote.data || uncertain || unavailable) return
    submitting.current = true
    setBusy(true)
    setError('')
    let sentBooking = false
    try {
      const [latestCourt, latestSlots] = await Promise.all([
        discoveryApi.court(court.courtID), discoveryApi.courtSlots(court.courtID, date),
      ])
      const latest = latestSlots.find(candidate => candidate.timeSlot === slot.timeSlot)
      if (latestCourt.status !== 'AVAILABLE' || !latest?.available || !isFutureSlot(date, latest.startTime)) {
        setUnavailable(true)
        onChanged()
        throw new Error('This time is no longer available. Close this review and choose another time.')
      }
      if (latest.price !== quote.data.price) {
        onChanged()
        quote.retry()
        throw new Error('The slot price changed. Review the updated amount before reserving.')
      }
      sentBooking = true
      const booking = await playerApi.reserve({ playerID: userId, courtID: court.courtID, bookingDate: date, timeSlot: latest.timeSlot })
      if (!booking?.bookingID || booking.status !== 'PENDING') {
        setUncertain(true)
        throw new Error('Courtly could not verify the reservation. Check My bookings before trying again.')
      }
      invalidateAvailability(court.courtID)
      refresh()
      if (andPay) navigate(checkoutLink(booking.bookingID))
      else navigate('/player/bookings', { state: { notice: `Slot reserved at ${priceLabel(booking.totalCost)}.` } })
    } catch (failure) {
      if (sentBooking && failure instanceof ApiError && failure.status === 0) {
        setUncertain(true)
        setError('The server response was interrupted. Check My bookings before trying again.')
      } else {
        setError(failure instanceof Error ? failure.message : 'The reservation could not be confirmed.')
      }
      if (sentBooking) onChanged()
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return <Dialog title="Review your booking" onClose={() => { if (!busy) onClose() }}>
    <dl className="slot-summary">
      <div><dt>Court</dt><dd>{court.name}</dd></div>
      {facility && <div><dt>Facility</dt><dd>{facility.name}</dd></div>}
      <div><dt>When</dt><dd>{formatDate(date)} · {slot.timeSlot.replace('-', '–')}</dd></div>
      {quote.data && <div><dt>Slot price</dt><dd>{priceLabel(quote.data.price)}{quote.data.isPeak && ' · Peak'}</dd></div>}
    </dl>
    {quote.loading && <p className="dialog-note" role="status">Checking the current price…</p>}
    {quote.error && <ContentError error={quote.error} retry={quote.retry} />}
    {quote.data && <p className="dialog-note">The reservation total includes any verified discount. You’ll have 10 minutes to pay once your slot is held.</p>}
    {error && <Message>{error}</Message>}
    {uncertain ? <Link to="/player/bookings" className="button button--outline">Open My bookings <ArrowRight size={17} /></Link>
      : <div className="booking-dialog-actions">
        <button type="button" className="button button--outline" disabled={busy || unavailable || !quote.data} onClick={() => void reserve(false)}>Reserve only</button>
        <button type="button" className="button button--primary" disabled={busy || unavailable || !quote.data} onClick={() => void reserve(true)}>
          {busy ? 'Checking and reserving…' : 'Reserve & pay'} <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>}
  </Dialog>
}

export function PlayerCourts() {
  const [query, setQuery] = useSearchParams()
  const [review, setReview] = useState<Selection | null>(null)
  const [search, setSearch] = useState('')
  const daily = useDailyCalendar()
  const [now, setNow] = useState(Date.now)
  const today = todayInLahore(new Date(now))

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const sports = useResource(discoveryApi.sports)
  const courts = useResource(discoveryApi.courts)
  const facilities = useResource(discoveryApi.facilities)
  const requestedSport = query.get('sport')?.toUpperCase() ?? ''
  const facilityID = query.get('facility') ?? ''
  const requestedCourt = query.get('court') ?? ''
  const bookmarkedSport = courts.data?.find(court => court.courtID === requestedCourt)?.sportType
  const sport = sports.data?.includes(requestedSport) ? requestedSport : bookmarkedSport ?? sports.data?.[0] ?? ''
  const requestedDate = query.get('date') ?? ''
  const date = validDate(requestedDate) && requestedDate >= today ? requestedDate : today
  const start = weekStart(date)
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))
  const directory = (courts.data ?? []).filter(court => court.sportType === sport
    && (!facilityID || court.facilityId === facilityID)
    && court.name.toLowerCase().includes(search.trim().toLowerCase()))
  const selectedCourt = directory.find(court => court.courtID === requestedCourt)
    ?? directory.find(court => court.status === 'AVAILABLE') ?? directory[0]
  const courtID = selectedCourt?.courtID ?? ''
  const selectedFacility = facilities.data?.find(facility => facility.facilityID === selectedCourt?.facilityId)
  const datesKey = (daily ? [date] : days.filter(day => day >= today)).join(',')
  const loadWeek = useCallback((signal: AbortSignal) =>
    courtID && datesKey ? loadAvailability(courtID, datesKey.split(','), signal) : Promise.resolve([]), [courtID, datesKey])
  const week = useResource(loadWeek)
  const slotParam = query.get('slot')
  const slot = !requestedCourt || requestedCourt === courtID ? week.data?.find(day => day.date === date)?.slots?.find(candidate =>
    candidate.timeSlot === slotParam && candidate.available && isFutureSlot(date, candidate.startTime)) : undefined
  const selection = selectedCourt?.status === 'AVAILABLE' && slot ? { date, slot } : null

  function update(values: Record<string, string>) {
    setQuery(current => {
      const next = new URLSearchParams(current)
      Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
      return next
    }, { replace: true })
  }

  function chooseDate(value: string) {
    if (validDate(value) && value >= today) update({ date: value, slot: '' })
  }

  function stepWeek(direction: number) {
    const next = addDays(date, direction * 7)
    chooseDate(next < today ? today : next)
  }

  function refresh() {
    invalidateAvailability(courtID)
    week.retry()
  }

  return <div className="player-page">
    <div className="player-page-heading">
      <div><p className="eyebrow">Lahore, Pakistan</p><h1>Find a court</h1><p>Choose a court, compare times, and reserve your slot.</p></div>
    </div>
    <section className="player-panel player-court-filters" aria-label="Court filters">
      <div className="field"><label htmlFor="player-sport">Sport</label>
        <select id="player-sport" value={sport} disabled={!sports.data?.length}
          onChange={event => update({ sport: event.target.value, court: '', slot: '' })}>
          {!sport && <option value="">{sports.loading ? 'Loading sports…' : 'No sports available'}</option>}
          {sports.data?.map(value => <option key={value} value={value}>{sportLabel(value)}</option>)}
        </select>
      </div>
      <div className="field"><label htmlFor="player-facility">Facility</label>
        <select id="player-facility" value={facilityID} onChange={event => update({ facility: event.target.value, court: '', slot: '' })}>
          <option value="">All facilities</option>
          {facilityID && !facilities.data?.some(facility => facility.facilityID === facilityID) && <option value={facilityID}>Selected facility</option>}
          {facilities.data?.map(facility => <option key={facility.facilityID} value={facility.facilityID}>{facility.name}</option>)}
        </select>
      </div>
      <div className="field"><label htmlFor="player-date">Date</label>
        <input id="player-date" type="date" min={today} value={date} onChange={event => chooseDate(event.target.value)} />
      </div>
    </section>
    {sports.error && <ContentError error={sports.error} retry={sports.retry} />}
    {facilities.error && <ContentError error={facilities.error} retry={facilities.retry} />}
    <div className="booking-workbench">
      <section className="player-panel court-directory">
        <div className="player-panel-heading"><div><h2>Courts</h2><p>{courts.data ? `${directory.length} ${directory.length === 1 ? 'court' : 'courts'} found` : 'Browse the court directory'}</p></div></div>
        <label className="court-search"><Search size={17} aria-hidden="true" />
          <input aria-label="Search court names" placeholder="Search courts" value={search}
            onChange={event => { setSearch(event.target.value); update({ slot: '' }) }} />
        </label>
        {courts.loading || sports.loading ? <Skeleton label="Loading courts" count={2} /> : courts.error
          ? <ContentError error={courts.error} retry={courts.retry} />
          : directory.length ? <div className="court-choices">{directory.map(court =>
            <CourtChoice key={court.courtID} court={court} facility={facilities.data?.find(item => item.facilityID === court.facilityId)}
              selected={courtID === court.courtID} choose={() => update({ court: court.courtID, slot: '' })} />)}</div>
          : <PlayerEmpty title="No matching courts" detail="Try another sport, facility, or court name." />}
      </section>
      {selectedCourt && <section className="player-panel calendar-panel">
        <div className="player-panel-heading calendar-court-heading">
          <div><h2>{selectedCourt.name}</h2>
            {selectedFacility && <Link to={'/facilities/' + encodeURIComponent(selectedFacility.facilityID)}
              className="text-link directional-link"><MapPin size={14} aria-hidden="true" />{selectedFacility.name}</Link>}
          </div>
          <div className="calendar-base-rate"><strong>{priceLabel(selectedCourt.hourlyRate)}</strong><span> / hour</span></div>
        </div>
        <div className="calendar-court-facts">
          <span><UsersRound size={15} /> Capacity {selectedCourt.capacity}</span>
          {selectedCourt.openTime && selectedCourt.closeTime && <span><Clock3 size={15} />{selectedCourt.openTime}–{selectedCourt.closeTime}</span>}
          {selectedFacility?.location && <span><MapPin size={15} />{selectedFacility.location}</span>}
        </div>
        {selectedCourt.description && <p className="calendar-description">{selectedCourt.description}</p>}
        {selectedCourt.status !== 'AVAILABLE' && <p className="calendar-closed" role="status">This court is {selectedCourt.status === 'MAINTENANCE' ? 'under maintenance' : 'closed'}. Slots cannot be reserved right now.</p>}
        <div className="calendar-toolbar">
          <div><h3><CalendarDays size={18} /> Weekly availability</h3>
            <p>{formatDate(start, { month: 'short', day: 'numeric' })} – {formatDate(days[6], { month: 'short', day: 'numeric', year: 'numeric' })} · Lahore time</p></div>
          <div className="calendar-navigation">
            <button className="button button--outline button--small" type="button" onClick={() => chooseDate(today)} disabled={date === today}>Today</button>
            <button className="icon-button" title="Refresh availability" aria-label="Refresh availability" type="button" onClick={refresh}><RefreshCw size={17} /></button>
            <button className="icon-button" aria-label="Previous week" type="button" disabled={start <= weekStart(today)} onClick={() => stepWeek(-1)}><ChevronLeft size={19} /></button>
            <button className="icon-button" aria-label="Next week" type="button" onClick={() => stepWeek(1)}><ChevronRight size={19} /></button>
          </div>
        </div>
        {selection && <div className="calendar-selection">
          <div><strong>{formatDate(selection.date)} · {selection.slot.timeSlot.replace('-', '–')}</strong><span>{priceLabel(selection.slot.price)} before any discount</span></div>
          <button type="button" className="button button--primary" onClick={() => setReview(selection)}>Review booking <ArrowRight size={17} /></button>
        </div>}
        <div className="calendar-day-strip" role="group" aria-label="Choose a day">
          {days.map(day => <button type="button" key={day} className="calendar-day" disabled={day < today}
            aria-label={formatDate(day, { weekday: 'long', day: 'numeric', month: 'long' })} aria-pressed={day === date} onClick={() => chooseDate(day)}>
            <span>{formatDate(day, { weekday: 'short' })}</span><strong>{Number(day.slice(8))}</strong>
          </button>)}
        </div>
        <div className={`calendar-grid${daily ? ' calendar-grid--daily' : ''}`} role="region"
          aria-label={daily ? 'Daily time slots' : 'Weekly time slots'} tabIndex={0}>
          {(daily ? [date] : days).map(day =>
            <section key={day} className="calendar-column" aria-label={formatDate(day)}>
              <CalendarColumn day={week.data?.find(item => item.date === day)} date={day} court={selectedCourt} today={today}
                loading={week.loading} selection={selection} onRetry={refresh}
                onSelect={(picked, day) => update({ date: day, court: picked.courtID, slot: picked.timeSlot })} />
            </section>)}
        </div>
        <div className="calendar-bottom">
          <div className="calendar-legend"><span><i />Available</span><span><i />Unavailable</span><span><i />Selected</span><span><Zap size={13} />Peak</span></div>
          {!selection && <p className="calendar-guidance" role="status">{slotParam && !week.loading
            ? 'Your previous time is unavailable. Select another slot.' : 'Select an available time to review your booking.'}</p>}
        </div>
      </section>}
    </div>
    {review && selectedCourt && review.date === date && review.slot.courtID === selectedCourt.courtID
      && <ReservationReview court={selectedCourt} facility={selectedFacility} selection={review}
      onClose={() => setReview(null)} onChanged={refresh} />}
  </div>
}
