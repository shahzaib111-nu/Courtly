import { CalendarDays, Dribbble, Flag, Goal, MapPin, Volleyball } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Booking, BookingStatus, Court, Facility } from '../lib/contracts'
import { formatDate, priceLabel, sportLabel } from '../lib/booking-time'
import { Link } from 'react-router-dom'

const statuses: Record<BookingStatus, string> = {
  PENDING: 'Pending payment', CONFIRMED: 'Confirmed', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
}

export function BookingBadge({ status }: { status: BookingStatus }) {
  return <span className={`booking-status booking-status--${status.toLowerCase()}`}><i aria-hidden="true" />{statuses[status] ?? status}</span>
}

export function SportGlyph({ sport }: { sport: string | null }) {
  if (['TENNIS', 'BADMINTON', 'SQUASH'].includes(sport ?? '')) {
    return <span className={`racket racket--${sport?.toLowerCase()}`} aria-hidden="true" />
  }
  if (sport === 'FOOTBALL') return <span className="football-glyph" aria-hidden="true" />
  if (sport === 'FUTSAL') return <Goal size={23} aria-hidden="true" />
  if (sport === 'BASKETBALL') return <Dribbble size={23} aria-hidden="true" />
  if (sport === 'VOLLEYBALL') return <Volleyball size={23} aria-hidden="true" />
  if (sport === 'CRICKET') return <span className="cricket-bat" aria-hidden="true" />
  return <Flag size={21} aria-hidden="true" />
}

export function bookingFacility(booking: Booking, courts?: Court[], facilities?: Facility[]) {
  const facilityId = courts?.find(court => court.courtID === booking.courtID)?.facilityId
  return facilityId ? facilities?.find(facility => facility.facilityID === facilityId) : undefined
}

export function BookingLine({ booking, facility, children }: { booking: Booking; facility?: Facility; children?: ReactNode }) {
  return <article className="booking-line" data-booking-id={booking.bookingID}>
    <div className="booking-icon"><SportGlyph sport={booking.sportType} /></div>
    <div className="booking-line-copy">
      <h3>{booking.courtName || sportLabel(booking.sportType ?? '')}</h3>
      <p><CalendarDays size={15} aria-hidden="true" />{formatDate(booking.bookingDate)} <span>·</span> {booking.timeSlot.replace('-', '–')}</p>
      {facility && <p><MapPin size={15} aria-hidden="true" />{facility.name}</p>}
    </div>
    <div className="booking-line-total"><BookingBadge status={booking.status} />
      <strong>{priceLabel(booking.totalCost)}</strong>
    </div>
    {children && <div className="booking-line-actions">{children}</div>}
  </article>
}

export function PlayerEmpty({ title, detail, browse = false }: { title: string; detail: string; browse?: boolean }) {
  return <div className="player-empty">
    <div className="booking-icon"><CalendarDays size={22} aria-hidden="true" /></div>
    <div><h3>{title}</h3><p>{detail}</p></div>
    {browse && <Link className="button button--outline button--small" to="/player/courts">Find a court</Link>}
  </div>
}
