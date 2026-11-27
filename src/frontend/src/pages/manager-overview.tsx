import type { ReactNode } from 'react'
import { ArrowRight, Building2, CalendarCheck2, CalendarDays, CircleCheck, CircleMinus, LayoutGrid, MapPin, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { bookingOrder, ManagerBookingTable } from '../components/manager-booking-table'
import { ManagerData, ManagerEmpty, ManagerRefresh } from '../components/manager-ui'
import { NotificationList } from '../components/player-notifications'
import { WorkspacePanel, WorkspaceStatus } from '../components/player-workspace-ui'
import { formatTimestamp, sportLabel } from '../lib/booking-time'
import { managerNoticeCopy, useManagedFacility, useManager, useManagerBookings, useManagerMaintenance } from '../lib/manager-data'
import { maintenanceState } from './manager-maintenance'

function Metric({ label, value, loading, icon }: { label: string; value?: number; loading: boolean; icon: ReactNode }) {
  return <div className="manager-metric">
    <span>{label}</span><span className="manager-metric-icon">{icon}</span>
    {loading ? <span className="skeleton manager-metric-skeleton" role="status" aria-label={'Loading ' + label} />
      : value === undefined ? <small>Unavailable</small> : <strong>{value}</strong>}
  </div>
}

function ViewLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="text-link directional-link">{children}<ArrowRight size={14} aria-hidden="true" /></Link>
}

export function ManagerOverview() {
  const { session } = useManager()
  const facility = useManagedFacility()
  const upcoming = useManagerBookings('upcoming')
  const completed = useManagerBookings('completed')
  const maintenance = useManagerMaintenance()
  const venue = facility.data?.facility
  const courts = facility.data?.courts
  const available = courts?.filter(court => court.status === 'AVAILABLE').length
  const refresh = () => { facility.retry(); upcoming.retry(); completed.retry(); maintenance.retry() }
  return <div className="player-page manager-overview">
    <section className="manager-hero" aria-labelledby="manager-welcome">
      <div className="manager-hero-copy">
        <p className="manager-hero-kicker"><Building2 size={16} aria-hidden="true" />Arena management</p>
        <h1 id="manager-welcome">{session.name ? 'Welcome, ' + session.name : 'Overview'}</h1>
        {venue ? <div className="manager-hero-facility"><MapPin size={16} aria-hidden="true" /><span>{venue.name}</span>
          <WorkspaceStatus status={venue.operatingStatus} /></div>
          : facility.loading ? <p role="status">Loading your facility…</p> : <p>Facility details unavailable</p>}
      </div>
      <Link className="button button--lime" to="/manager/facility">Manage facility <ArrowRight size={17} aria-hidden="true" /></Link>
    </section>
    <section className="manager-summary" aria-labelledby="operating-summary">
      <div className="manager-section-head"><h2 id="operating-summary">Operational summary</h2>
        <ManagerRefresh disabled={facility.loading || upcoming.loading || completed.loading || maintenance.loading} onClick={refresh} /></div>
      <div className="manager-metrics">
        <Metric label="Managed courts" loading={facility.loading} value={courts?.length} icon={<LayoutGrid size={17} />} />
        <Metric label="Available courts" loading={facility.loading} value={available} icon={<CircleCheck size={17} />} />
        <Metric label="Unavailable courts" loading={facility.loading} value={courts && available !== undefined ? courts.length - available : undefined} icon={<CircleMinus size={17} />} />
        <Metric label="Upcoming bookings" loading={upcoming.loading} value={upcoming.data?.length} icon={<CalendarDays size={17} />} />
        <Metric label="Completed bookings" loading={completed.loading} value={completed.data?.length} icon={<CalendarCheck2 size={17} />} />
        <Metric label="Maintenance windows" loading={maintenance.loading}
          value={maintenance.data?.filter(window => maintenanceState(window) !== 'ENDING').length} icon={<Wrench size={17} />} />
      </div>
    </section>
    <div className="manager-overview-grid manager-overview-grid--primary">
      <WorkspacePanel title="Upcoming bookings" description="Next reservations by date and time." action={<ViewLink to="/manager/bookings">All bookings</ViewLink>}>
        <ManagerData resource={upcoming} label="upcoming bookings">{rows => rows.length
          ? <ManagerBookingTable rows={[...rows].sort(bookingOrder).slice(0, 5)} compact />
          : <ManagerEmpty title="No upcoming bookings" detail="New reservations for your courts will appear here." />}</ManagerData>
      </WorkspacePanel>
      <WorkspacePanel title="Court status" action={<ViewLink to="/manager/courts">Manage courts</ViewLink>}>
        <ManagerData resource={facility} label="court status">{({ courts }) => courts.length ? <ul className="manager-compact-list">
          {[...courts].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 5).map(court => <li key={court.courtID}>
            <LayoutGrid size={17} aria-hidden="true" /><span><strong>{court.name}</strong><small>{sportLabel(court.sportType)}</small></span>
            <WorkspaceStatus status={court.status} />
          </li>)}
        </ul> : <ManagerEmpty title="No courts added yet" detail="Set up your first court to open it for bookings." />}</ManagerData>
      </WorkspacePanel>
    </div>
    <div className="manager-overview-grid">
      <WorkspacePanel title="Maintenance schedule" action={<ViewLink to="/manager/maintenance">Manage maintenance</ViewLink>}>
        <ManagerData resource={maintenance} label="maintenance schedule">{rows => rows.length ? <ul className="manager-compact-list">
          {[...rows].sort((a, b) => a.maintenanceFrom.localeCompare(b.maintenanceFrom)).slice(0, 3).map(item => <li key={item.courtID}>
            <Wrench size={17} aria-hidden="true" /><span><strong>{item.courtName}</strong><small>{formatTimestamp(item.maintenanceFrom)}</small></span>
            <WorkspaceStatus status={maintenanceState(item)} />
          </li>)}
        </ul> : <ManagerEmpty title="No maintenance windows" />}</ManagerData>
      </WorkspacePanel>
      <WorkspacePanel title="Recent booking activity" description="Most recently played reservations by booking date."
        action={<ViewLink to="/manager/bookings?view=completed">Completed bookings</ViewLink>}>
        <ManagerData resource={completed} label="completed bookings">{rows => rows.length ? <ul className="manager-compact-list">
          {[...rows].sort((a, b) => bookingOrder(b, a)).slice(0, 3).map(row => <li key={row.bookingID}>
            <CalendarCheck2 size={17} aria-hidden="true" /><span><strong>{row.courtName}</strong><small>{row.playerName} · {row.bookingDate}</small></span>
            <Link className="text-link" to={'/manager/bookings?' + new URLSearchParams({ view: 'completed', booking: row.bookingID })}>View</Link>
          </li>)}
        </ul> : <ManagerEmpty title="No completed bookings" />}</ManagerData>
      </WorkspacePanel>
    </div>
    <WorkspacePanel title="Recent notifications" action={<ViewLink to="/manager/notifications">Open inbox</ViewLink>}>
      <NotificationList limit={3} copy={managerNoticeCopy} />
    </WorkspacePanel>
  </div>
}
