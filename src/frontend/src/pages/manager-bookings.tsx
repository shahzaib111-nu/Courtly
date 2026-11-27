import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { bookingOrder, ManagerBookingTable } from '../components/manager-booking-table'
import { ManagerConfirm, ManagerData, ManagerEmpty, ManagerRefresh } from '../components/manager-ui'
import { PlayerHeading, WorkspacePanel, WorkspaceStatus } from '../components/player-workspace-ui'
import { Dialog, Field, Message, Toast } from '../components/ui'
import { ApiError } from '../lib/api'
import { invalidateAvailability } from '../lib/availability'
import { formatDate, priceLabel, sportLabel } from '../lib/booking-time'
import { managerApi } from '../lib/manager-api'
import { useManagerBookings } from '../lib/manager-data'
import { useNotifications } from '../lib/notifications'

export function ManagerBookings() {
  const [params, setParams] = useSearchParams()
  const completed = params.get('view') === 'completed'
  const resource = useManagerBookings(completed ? 'completed' : 'upcoming')
  const notices = useNotifications()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [sport, setSport] = useState('')
  const [toast, setToast] = useState('')
  const [mutation, setMutation] = useState<'confirm' | 'cancel'>()
  const bookingID = params.get('booking')
  const selected = resource.data?.find(item => item.bookingID === bookingID)
  const sports = [...new Set(resource.data?.map(item => item.sportType).filter(Boolean))].sort()
  const resetFilters = () => { setSearch(''); setStatus(''); setSport('') }
  const viewParams = completed ? 'view=completed' : ''
  const close = () => { setMutation(undefined); setParams(viewParams, { replace: true }) }
  const query = search.trim().toLowerCase()
  const rows = resource.data?.filter(row => (!status || row.status === status) &&
    (!sport || row.sportType === sport) && [row.courtName, row.playerName, row.playerEmail, row.bookingID].some(text => text.toLowerCase().includes(query)))
    .sort(completed ? (a, b) => bookingOrder(b, a) : bookingOrder) ?? []
  return <div className="player-page">
    <PlayerHeading title="Bookings" description="Review reservations and manage bookings for your courts." />
    <WorkspacePanel title={completed ? 'Completed reservations' : 'Upcoming reservations'}
      description="Booking value is the reservation price. Card payments are recorded separately."
      action={<ManagerRefresh disabled={resource.loading} onClick={resource.retry} />}>
      <div className="booking-filters" role="group" aria-label="Booking lists">
        <button className="booking-filter" type="button" aria-pressed={!completed} onClick={() => { resetFilters(); setParams({}) }}>Upcoming</button>
        <button className="booking-filter" type="button" aria-pressed={completed} onClick={() => { resetFilters(); setParams({ view: 'completed' }) }}>Completed</button>
      </div>
      <div className="manager-filters">
        <Field label="Search bookings" type="search" placeholder="Court, player, or reference"
          value={search} onChange={event => setSearch(event.target.value)} />
        <div className="field"><label htmlFor="filter-booking-sport">Sport</label>
          <select id="filter-booking-sport" value={sport} onChange={event => setSport(event.target.value)}>
            <option value="">All sports</option>{sports.map(value => <option key={value} value={value}>{sportLabel(value)}</option>)}
          </select>
        </div>
        {!completed && <div className="field"><label htmlFor="filter-booking-status">Status</label>
          <select id="filter-booking-status" value={status} onChange={event => setStatus(event.target.value)}>
            <option value="">All statuses</option><option value="PENDING">Pending</option><option value="CONFIRMED">Confirmed</option>
          </select>
        </div>}
      </div>
      <ManagerData resource={resource} label="bookings">{all => <>
        {bookingID && !selected && <Message>This booking no longer appears in this list.</Message>}
        {rows.length ? <ManagerBookingTable rows={rows} completed={completed} />
          : <ManagerEmpty title={all.length ? 'No bookings match your filters' : completed ? 'No completed bookings' : 'No upcoming bookings'}
            detail={all.length ? 'Try a different search or filter.' : undefined} />}
      </>}</ManagerData>
    </WorkspacePanel>
    {selected && !mutation && <Dialog title="Booking details" onClose={close}>
      <div className="workspace-actions"><WorkspaceStatus status={selected.status} /><strong>{selected.courtName}</strong></div>
      <dl className="manager-facts manager-facility-facts">
        <div><dt>Booking reference</dt><dd>{selected.bookingID}</dd></div>
        <div><dt>Sport</dt><dd>{sportLabel(selected.sportType)}</dd></div>
        <div><dt>Player</dt><dd>{selected.playerName}<small>{selected.playerEmail}</small></dd></div>
        <div><dt>Date</dt><dd>{selected.bookingDate ? formatDate(selected.bookingDate, { dateStyle: 'long' }) : 'Unavailable'}</dd></div>
        <div><dt>Time slot</dt><dd>{selected.timeSlot.replace('-', '–')}</dd></div>
        <div><dt>Booking value</dt><dd>{priceLabel(selected.totalCost)}</dd></div>
      </dl>
      {!completed && <div className="workspace-actions dialog-actions">
        {(selected.status === 'PENDING' || selected.status === 'CONFIRMED') &&
          <button type="button" className="button button--outline manager-danger-link" onClick={() => setMutation('cancel')}><X size={16} />Cancel booking</button>}
        {selected.status === 'PENDING' &&
          <button type="button" className="button button--primary" onClick={() => setMutation('confirm')}><Check size={16} />Manually confirm</button>}
      </div>}
    </Dialog>}
    {selected && mutation && <ManagerConfirm title={mutation === 'confirm' ? 'Confirm booking manually?' : 'Cancel booking?'}
      label={mutation === 'confirm' ? 'Confirm booking' : 'Cancel booking'} danger={mutation === 'cancel'} onClose={() => setMutation(undefined)}
      description={<><p><strong>{selected.courtName}</strong> · {selected.timeSlot}</p><p>{mutation === 'confirm'
        ? 'This confirms the reservation. A Stripe payment requires a separate transaction.'
        : 'Cancellation releases the reservation. Any refund needs separate verification.'}</p></>}
      onConfirm={async () => {
        const confirm = mutation === 'confirm'
        const result = await (confirm ? managerApi.confirmBooking(selected.bookingID) : managerApi.cancelBooking(selected.bookingID))
        if (result?.bookingID !== selected.bookingID || result.status !== (confirm ? 'CONFIRMED' : 'CANCELLED')) {
          throw new ApiError('Courtly could not verify the updated booking. Refresh before retrying.')
        }
        invalidateAvailability(result.courtID)
        close()
        resource.retry()
        notices.refresh()
        setToast(confirm ? 'Booking confirmed.' : 'Booking cancelled.')
      }} />}
    {toast && <Toast onClose={() => setToast('')}>{toast}</Toast>}
  </div>
}
