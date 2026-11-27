import { Link } from 'react-router-dom'
import { formatDate, priceLabel, sportLabel } from '../lib/booking-time'
import type { ManagerBooking } from '../lib/manager-api'
import { WorkspaceStatus } from './player-workspace-ui'

export const bookingOrder = (a: ManagerBooking, b: ManagerBooking) =>
  (a.bookingDate + a.timeSlot).localeCompare(b.bookingDate + b.timeSlot)

export function ManagerBookingTable({ rows, completed = false, compact = false }: {
  rows: ManagerBooking[]; completed?: boolean; compact?: boolean
}) {
  return <div className="workspace-table-wrap" tabIndex={0} aria-label={completed ? 'Completed bookings' : 'Upcoming bookings'}>
    <table className={'workspace-table manager-table' + (compact ? ' manager-table--compact' : '')}>
      <thead><tr><th scope="col">Court</th><th scope="col" className="manager-table-secondary">Player</th><th scope="col">Date and slot</th>
        {!compact && <th scope="col" className="manager-table-secondary">Booking value</th>}<th scope="col">Status</th><th scope="col">Details</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.bookingID}>
        <th scope="row">{row.courtName || 'Court booking'}<small>{sportLabel(row.sportType)}</small></th>
        <td className="manager-table-secondary">{row.playerName}</td>
        <td>{row.bookingDate ? formatDate(row.bookingDate, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unavailable'}
          <small>{row.timeSlot.replace('-', '–')}</small></td>
        {!compact && <td className="manager-table-secondary manager-amount">{priceLabel(row.totalCost)}</td>}
        <td><WorkspaceStatus status={row.status} /></td>
        <td><Link className="text-link" aria-label={'View booking ' + row.bookingID}
          to={'/manager/bookings?' + new URLSearchParams({ booking: row.bookingID, ...(completed ? { view: 'completed' } : {}) })}>View</Link></td>
      </tr>)}</tbody>
    </table>
  </div>
}
