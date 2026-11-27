import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Building2, CalendarDays, Clock3,
  LocateFixed, MapPin, Search, Star, UsersRound,
} from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { SportGlyph } from '../components/player-booking-ui'
import { ContentError, Dialog, Skeleton } from '../components/ui'
import { discoveryApi } from '../lib/api'
import type { Court, Facility, Slot } from '../lib/contracts'
import { useSession } from '../lib/session'
import { useResource } from '../lib/use-resource'
import { validDate } from '../lib/validation'
import { dateObject as calendarDate, isFutureSlot, priceLabel as price, sportLabel, todayInLahore } from '../lib/booking-time'

const shortDay = new Intl.DateTimeFormat('en-PK', { weekday: 'short', timeZone: 'UTC' })
const longDate = new Intl.DateTimeFormat('en-PK', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

const courtLink = (filters: Record<string, string>) => '/courts?' + new URLSearchParams(filters)
const facilityLink = (id: string) => '/facilities/' + encodeURIComponent(id)

function Empty({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><Search aria-hidden="true" size={22} /><h3>{title}</h3><p>{description}</p></div>
}

function FacilityCard({ facility }: { facility: Facility }) {
  const open = facility.operatingStatus === 'OPEN'
  return <Link to={facilityLink(facility.facilityID)} className="facility-card">
    <div className="facility-map" aria-hidden="true"><div className="court-markings"><i /><b /></div><MapPin size={23} /></div>
    <div className="facility-copy">
      <div className="facility-meta"><span className="badge">{facility.courtCount} {facility.courtCount === 1 ? 'court' : 'courts'}</span>
        {open && <span className="open-indicator"><i /> Open</span>}
      </div>
      <h3>{facility.name}</h3>
      {facility.location && <p>{facility.location}</p>}
      <span className="facility-arrow"><ArrowUpRight size={20} aria-hidden="true" /></span>
    </div>
  </Link>
}

export function LandingPage() {
  const { session } = useSession()
  const sports = useResource(discoveryApi.sports)
  const facilities = useResource(discoveryApi.facilities)
  return <>
    <section className="container">
      <div className="hero">
        <img className="hero-image" src="/images/tennis-court-1280.webp" alt="" fetchPriority="high"
          srcSet="/images/tennis-court-640.webp 640w, /images/tennis-court-1280.webp 1280w" sizes="(max-width: 1360px) 95vw, 1280px"
          onError={event => { event.currentTarget.hidden = true }} />
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow"><span /> Sports courts in Lahore</p>
          <h1>Find. Book.<br /><span>Play.</span></h1>
          <p className="hero-description">Explore Lahore’s courts, check live availability, and get your next game on the calendar.</p>
          <div className="hero-actions">
            <Link to="/courts" className="button button--lime">Find a court <ArrowUpRight size={19} /></Link>
            <Link to={session?.role === 'MANAGER' ? '/workspace' : '/login?role=manager'} className="button button--glass">Manage an arena <ArrowRight size={18} /></Link>
          </div>
        </div>
      </div>
    </section>
    <section className="section container" aria-labelledby="sports-title">
      <div className="section-heading">
        <div><p className="eyebrow">Explore by sport</p><h2 id="sports-title">What’s your game?</h2></div>
        <Link className="text-link directional-link" to="/courts">Browse all courts <ArrowUpRight size={18} /></Link>
      </div>
      {sports.loading ? <Skeleton label="Loading sports" count={4} /> : sports.error ? <ContentError error={sports.error} retry={sports.retry} />
        : sports.data?.length ? <div className="sports-grid">{sports.data.map(sport => <Link key={sport} className="sport-tile" to={courtLink({ sport })}>
          <SportGlyph sport={sport} /><span>{sportLabel(sport)}</span><ArrowUpRight className="sport-arrow" size={14} aria-hidden="true" />
        </Link>)}</div> : <Empty title="No sports listed" description="Check back when courts have been added." />}
    </section>
    <section className="section container featured-section" aria-labelledby="featured-title">
      <div className="section-heading">
        <div><p className="eyebrow">Around Lahore</p><h2 id="featured-title">Find your next venue.</h2></div>
        <Link className="text-link directional-link" to="/facilities">All facilities <ArrowUpRight size={18} /></Link>
      </div>
      {facilities.loading ? <Skeleton label="Loading facilities" count={2} /> : facilities.error
        ? <ContentError error={facilities.error} retry={facilities.retry} />
        : facilities.data?.length ? <div className="facility-grid">{facilities.data.slice(0, 2).map(facility => <FacilityCard key={facility.facilityID} facility={facility} />)}</div>
        : <Empty title="No facilities listed" description="Available facilities will appear here." />}
    </section>
    <section id="how-it-works" className="how">
      <div className="container how-inner">
        <div><p className="eyebrow">How it works</p><h2>Get on court.</h2></div>
        <ol className="steps">
          <li><LocateFixed size={26} aria-hidden="true" /><h3>Find a court</h3><p>Pick a sport and see courts across Lahore.</p></li>
          <li><CalendarDays size={26} aria-hidden="true" /><h3>Book a slot</h3><p>Choose a time and review the price before payment.</p></li>
          <li><ArrowDownRight size={26} aria-hidden="true" /><h3>Show up and play</h3><p>Keep your booking confirmation handy for game day.</p></li>
        </ol>
      </div>
    </section>
  </>
}

export function FacilitiesPage() {
  const facilities = useResource(discoveryApi.facilities)
  return <section className="container subpage">
    <div className="page-heading"><p className="eyebrow">Explore Lahore</p><h1>Facilities.</h1><p>Browse arenas and see the courts at each location.</p></div>
    {facilities.loading ? <Skeleton label="Loading facilities" count={2} /> : facilities.error
      ? <ContentError error={facilities.error} retry={facilities.retry} />
      : facilities.data?.length ? <div className="facility-grid">{facilities.data.map(facility => <FacilityCard key={facility.facilityID} facility={facility} />)}</div>
      : <Empty title="No facilities listed" description="Facilities will appear here as they are added." />}
  </section>
}

function CourtCard({ court }: { court: Court }) {
  return <article className="court-card">
    <div className="court-card-top"><SportGlyph sport={court.sportType} /><span className="badge">{sportLabel(court.sportType)}</span></div>
    <h3>{court.name}</h3>
    {court.description && <p>{court.description}</p>}
    <div className="court-facts"><span><UsersRound size={16} aria-hidden="true" /> {court.capacity} players</span>
      {court.openTime && court.closeTime && <span><Clock3 size={16} aria-hidden="true" /> {court.openTime}–{court.closeTime}</span>}
    </div>
    <div className="court-card-footer">
      <div><strong>{price(court.hourlyRate)}</strong><span> / hour</span></div>
      {court.status === 'AVAILABLE'
        ? <Link className="text-link directional-link" to={courtLink({ sport: court.sportType, court: court.courtID, ...(court.facilityId ? { facility: court.facilityId } : {}) })}>See times <ArrowRight size={17} /></Link>
        : <span className="badge">{court.status === 'MAINTENANCE' ? 'Maintenance' : 'Closed'}</span>}
    </div>
  </article>
}

export function FacilityPage() {
  const { facilityId = '' } = useParams()
  const load = useCallback((signal: AbortSignal) => discoveryApi.facility(facilityId, signal), [facilityId])
  const facility = useResource(load)
  const detail = facility.data
  return <section className="container subpage">
    <Link className="back-link" to="/facilities"><ArrowLeft size={16} /> All facilities</Link>
    {facility.loading ? <Skeleton label="Loading facility" /> : facility.error ? <ContentError error={facility.error} retry={facility.retry} /> : detail && <>
      <div className="page-heading facility-page-heading">
        <p className="eyebrow">Sports facility</p><h1>{detail.facility.name}</h1>
        <div className="venue-facts">
          {detail.facility.location && <span><MapPin size={17} /> {detail.facility.location}</span>}
          <span><Clock3 size={17} /> {detail.facility.openingTime}–{detail.facility.closingTime}</span>
          {detail.facility.averageRating != null && <span><Star size={17} /> {detail.facility.averageRating.toFixed(1)} ({detail.facility.ratingCount})</span>}
        </div>
      </div>
      <h2 className="subpage-section-title">Courts at this facility</h2>
      {detail.courts.length ? <div className="court-grid">{detail.courts.map(court => <CourtCard key={court.courtID} court={court} />)}</div>
        : <Empty title="No courts listed" description="This facility has no courts to display yet." />}
    </>}
  </section>
}

function DateStrip({ date, today, onChange }: { date: string; today: string; onChange: (value: string) => void }) {
  const last = calendarDate(today)
  last.setUTCDate(last.getUTCDate() + 6)
  const start = calendarDate(date) > last ? date : today
  return <div className="date-strip" role="group" aria-label="Next available dates">
    {Array.from({ length: 7 }, (_, index) => {
      const day = calendarDate(start)
      day.setUTCDate(day.getUTCDate() + index)
      const iso = day.toISOString().slice(0, 10)
      return <button key={iso} type="button" className="day-chip" aria-pressed={date === iso}
        aria-label={longDate.format(day)} onClick={() => onChange(iso)}>
        <span>{shortDay.format(day)}</span><strong>{day.getUTCDate()}</strong>
      </button>
    })}
  </div>
}

function SlotDialog({ slot, date, facility, facilityID, onClose }: { slot: Slot; date: string; facility?: Facility; facilityID?: string; onClose: () => void }) {
  const { session } = useSession()
  const workspace = '/player/courts?' + new URLSearchParams({
    sport: slot.sportType, date, court: slot.courtID, slot: slot.timeSlot,
    ...(facilityID ? { facility: facilityID } : {}),
  })
  const destination = session?.role === 'PLAYER'
    ? workspace
    : '/login?' + new URLSearchParams({ returnTo: workspace })
  return <Dialog title={slot.courtName} onClose={onClose}>
    <dl className="slot-summary">
      <div><dt>When</dt><dd>{longDate.format(calendarDate(date))} · {slot.startTime}–{slot.endTime}</dd></div>
      <div><dt>Sport</dt><dd>{sportLabel(slot.sportType)}</dd></div>
      {facility && <div><dt>Facility</dt><dd>{facility.name}</dd></div>}
      <div><dt>Slot price</dt><dd>{price(slot.price)}{slot.isPeak && ' · Peak'}</dd></div>
    </dl>
    <p className="dialog-note">Availability and your total are confirmed when you book.</p>
    <Link className="button button--primary w-full" to={destination}>
      {session?.role === 'PLAYER' ? 'Continue to booking' : 'Sign in to book'} <ArrowRight size={18} />
    </Link>
  </Dialog>
}

export function CourtsPage() {
  const [query, setQuery] = useSearchParams()
  const today = todayInLahore()
  const rawDate = query.get('date') ?? ''
  const date = rawDate >= today && validDate(rawDate) ? rawDate : today
  const sport = query.get('sport')?.toUpperCase() ?? ''
  const courtId = query.get('court') ?? ''
  const facilityId = query.get('facility') ?? ''
  const [selected, setSelected] = useState<{ slot: Slot; date: string } | null>(null)
  const sports = useResource(discoveryApi.sports)
  const courts = useResource(discoveryApi.courts)
  const facilities = useResource(discoveryApi.facilities)
  const hasSport = !!sports.data?.includes(sport)
  const loadSlots = useCallback((signal: AbortSignal) =>
    hasSport ? discoveryApi.availability(date, sport, signal) : Promise.resolve([]), [date, hasSport, sport])
  const slots = useResource(loadSlots)
  const matches = courts.data?.filter(court => (!hasSport || court.sportType === sport)
    && (!facilityId || court.facilityId === facilityId)) ?? []
  const facilityCourtIds = new Set(matches.map(court => court.courtID))
  const visibleSlots = slots.data?.filter(slot =>
    slot.available && (!courtId || courtId === slot.courtID) && (!facilityId || facilityCourtIds.has(slot.courtID))
      && isFutureSlot(date, slot.startTime),
  ) ?? []
  const selectedFacilityID = facilityId || courts.data?.find(court => court.courtID === selected?.slot.courtID)?.facilityId || undefined
  const selectedFacility = facilities.data?.find(facility => facility.facilityID === selectedFacilityID)

  function apply(filters: Record<string, string>) {
    setSelected(null)
    setQuery(current => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(filters)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      return next
    })
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const nextSport = String(data.get('sport') ?? '')
    const nextFacility = String(data.get('facility') ?? '')
    apply({ date: String(data.get('date') ?? today), sport: nextSport, facility: nextFacility,
      court: sport === nextSport && facilityId === nextFacility ? courtId : '' })
  }

  return <section className="container subpage">
    <div className="page-heading"><p className="eyebrow">Lahore, Pakistan</p><h1>Find a court.</h1><p>Pick a sport and date to see available times and prices.</p></div>
    <div className="search-panel">
      <form className="search-form public-search-form" onSubmit={search} key={sport + date + hasSport + facilityId}>
        <div className="field"><label htmlFor="court-sport">Sport</label>
          <select id="court-sport" name="sport" defaultValue={sport || ''} required disabled={!sports.data?.length}>
            {!sports.data?.includes(sport) && <option value={sport} disabled>Choose a sport</option>}
            {sports.data?.map(value => <option key={value} value={value}>{sportLabel(value)}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="court-facility">Facility</label>
          <select id="court-facility" name="facility" defaultValue={facilityId}>
            <option value="">All facilities</option>
            {facilityId && !facilities.data?.some(facility => facility.facilityID === facilityId) && <option value={facilityId}>Selected facility</option>}
            {facilities.data?.map(facility => <option key={facility.facilityID} value={facility.facilityID}>{facility.name}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="court-date">Date</label><input id="court-date" type="date" name="date" min={today} defaultValue={date} required /></div>
        <button className="button button--primary" type="submit" disabled={!sports.data?.length}><Search size={18} /> Search availability</button>
      </form>
      {sports.error && <ContentError error={sports.error} retry={sports.retry} />}
      {facilities.error && <ContentError error={facilities.error} retry={facilities.retry} />}
      <DateStrip date={date} today={today} onChange={value => apply({ date: value })} />
    </div>
    {hasSport && <div className="availability">
      <div className="section-heading">
        <div><p className="eyebrow">{longDate.format(calendarDate(date))} · Lahore time</p><h2>Available times</h2></div>
        {courtId && <button type="button" className="text-link" onClick={() => apply({ court: '' })}>Show all {sportLabel(sport).toLowerCase()} courts</button>}
      </div>
      {slots.loading || (facilityId && courts.loading) ? <Skeleton label="Checking live availability" />
        : slots.error ? <ContentError error={slots.error} retry={slots.retry} />
        : facilityId && courts.error ? <ContentError error={courts.error} retry={courts.retry} />
        : visibleSlots.length ? <div className="table-frame" role="region" tabIndex={0} aria-label="Live availability"><table className="slot-table">
          <caption className="sr-only">Available {sportLabel(sport).toLowerCase()} slots</caption>
          <thead><tr><th scope="col">Court</th><th scope="col">Time</th><th scope="col">Price</th><th scope="col"><span className="sr-only">Choose time</span></th></tr></thead>
          <tbody>{visibleSlots.map(slot => <tr key={slot.courtID + slot.timeSlot}>
            <th scope="row">{slot.courtName}</th><td>{slot.startTime}–{slot.endTime}{slot.isPeak && <span className="badge peak-badge">Peak</span>}</td>
            <td>{price(slot.price)}</td><td><button className="button button--outline button--small" type="button"
              aria-label={`Choose ${slot.courtName} at ${slot.startTime}`} onClick={() => setSelected({ slot, date })}>Choose <ArrowRight size={15} /></button></td>
          </tr>)}</tbody>
        </table></div> : <Empty title="No available times" description="Try another date or sport." />}
    </div>}
    <div className="court-list">
      <div className="section-heading"><div><p className="eyebrow">Court directory</p><h2>{hasSport ? sportLabel(sport) + ' courts' : 'All courts'}</h2></div><Building2 size={26} aria-hidden="true" /></div>
      {courts.loading ? <Skeleton label="Loading courts" /> : courts.error ? <ContentError error={courts.error} retry={courts.retry} />
        : matches.length ? <div className="court-grid">{matches.map(court => <CourtCard key={court.courtID} court={court} />)}</div>
        : <Empty title={courts.data?.length ? 'No matching courts' : 'No courts listed'}
          description={courts.data?.length ? 'Change the sport or facility to see more courts.' : 'Courts will appear once a venue adds them.'} />}
    </div>
    {selected && selected.date === date && selected.slot.sportType === sport
      && <SlotDialog slot={selected.slot} date={selected.date} facility={selectedFacility} facilityID={selectedFacilityID} onClose={() => setSelected(null)} />}
  </section>
}
