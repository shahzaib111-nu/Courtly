import { useCallback, useState } from 'react'
import { AdminData, AdminMetrics, AdminPage, AdminRefresh, AdminTable, display, FilterSelect, matches, SearchFilter, useAdminOperation } from '../components/admin-ui'
import { WorkspacePanel, WorkspaceStatus, statusLabel } from '../components/player-workspace-ui'
import { Field, Message } from '../components/ui'
import { ApiError } from '../lib/api'
import { adminApi } from '../lib/admin-api'
import { addDays, formatTimestamp, priceLabel, todayInLahore } from '../lib/booking-time'
import { useResource } from '../lib/use-resource'

export const paymentPeriod = () => ({ from: addDays(todayInLahore(), -29), to: todayInLahore() })

export function AdminBookings() {
  const resource = useResource(adminApi.bookings)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [date, setDate] = useState('')
  return <AdminPage title="Active bookings" description="Monitor pending and confirmed reservations across facilities."
    action={<AdminRefresh onClick={resource.retry} disabled={resource.loading} />}>
    <WorkspacePanel title="Booking register">
      <div className="admin-filters"><SearchFilter value={search} change={setSearch} label="Search courts or players" />
        <Field label="Booking date" type="date" value={date} onChange={event => setDate(event.target.value)} />
        <FilterSelect label="Status" value={status} change={setStatus} values={['PENDING', 'CONFIRMED']} emptyLabel="All statuses" />
      </div>
      <AdminData resource={resource} label="active bookings">{rows => <AdminTable label="Active bookings"
        columns={['Court', 'Player', 'Date', 'Slot', 'Status']}
        rows={rows.filter(row => (!status || row.status === status) && (!date || row.bookingDate === date) && matches(search, row.courtName, row.playerName))
          .map(row => [display(row.courtName), row.playerName, display(row.bookingDate), display(row.timeSlot), <WorkspaceStatus status={row.status} />])} />}</AdminData>
    </WorkspacePanel>
  </AdminPage>
}

export function AdminPayments() {
  const [range, setRange] = useState(paymentPeriod)
  const [draft, setDraft] = useState(range)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const resource = useResource(useCallback((signal: AbortSignal) => adminApi.payments(range.from, range.to, signal), [range.from, range.to]))
  return <AdminPage title="Payment summaries" description="Reported values of confirmed and completed bookings by confirmation date."
    action={<AdminRefresh onClick={resource.retry} disabled={resource.loading} />}>
    <WorkspacePanel title="Booking-derived amounts" description="This includes manually confirmed reservations. Stripe receipts are recorded separately.">
      <form className="admin-filters" onSubmit={event => {
        event.preventDefault()
        if (!draft.from || !draft.to || draft.from > draft.to) { setError('Choose a valid date range.'); return }
        setError('')
        if (range.from === draft.from && range.to === draft.to) resource.retry()
        else setRange(draft)
      }}>
        <Field label="From" type="date" required value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} />
        <Field label="To" type="date" required value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} />
        <button className="button button--primary" type="submit">Apply dates</button>
      </form>
      {error && <Message>{error}</Message>}
      <p className="field-hint">Confirmation dates {range.from} to {range.to}</p>
      <SearchFilter value={search} change={setSearch} label="Search payer or court" />
      <AdminData resource={resource} label="payment summaries">{records => {
        const rows = records.filter(row => matches(search, row.payerName, row.courtName))
        return <><AdminMetrics values={[
          ['Matching bookings', rows.length],
          ['Reported booking amount', priceLabel(rows.reduce((total, row) => total + row.amountPaid, 0))],
        ]} />
          <AdminTable label="Payment summaries" columns={['Payer', 'Court', 'Booking and slot', 'Confirmed', 'Reported amount']}
            rows={rows.map(row => [row.payerName.includes('@') ? 'Name unavailable' : row.payerName, display(row.courtName),
              <>{display(row.bookingDate)}<small>{row.timeSlot}</small></>, formatTimestamp(row.paymentDateTime), priceLabel(row.amountPaid)])} />
        </>
      }}</AdminData>
    </WorkspacePanel>
  </AdminPage>
}

function maskRecipient(email: string | null) {
  if (!email) return '—'
  const [name, domain] = email.split('@')
  return name && domain ? name[0] + '•••@' + domain : 'Recipient on record'
}

export function AdminDelivery() {
  const [status, setStatus] = useState('')
  const [limit, setLimit] = useState('100')
  const resource = useResource(useCallback((signal: AbortSignal) => adminApi.delivery(status, Number(limit), signal), [status, limit]))
  const operations = useAdminOperation(resource.retry)
  return <AdminPage title="Email delivery" description="Monitor notification delivery, retries, and final failures."
    action={<AdminRefresh onClick={resource.retry} disabled={resource.loading} />}>
    <WorkspacePanel title="Delivery log">
      <div className="admin-filters">
        <FilterSelect label="Status" value={status} change={setStatus} values={['SENT', 'QUEUED', 'FAILED']} emptyLabel="All statuses" />
        <FilterSelect label="Entry limit" value={limit} change={setLimit} values={['25', '100', '250', '500']} />
      </div>
      <AdminData resource={resource} label="delivery log">{({ counts, entries }) => <>
        <AdminMetrics values={['SENT', 'QUEUED', 'FAILED'].map(key => [statusLabel(key), counts[key] ?? '—'])} />
        <AdminTable label="Email deliveries"
          columns={['Notification', 'Recipient', 'Status', 'Attempts', 'Created and last attempt', 'Delivered', 'Next retry', 'Failure']}
          rows={entries.map(row => [statusLabel(row.type), maskRecipient(row.recipientEmail), <WorkspaceStatus status={row.status} />,
            row.attempts, <>{formatTimestamp(row.createdAt)}<small>{formatTimestamp(row.lastAttemptAt)}</small></>, formatTimestamp(row.deliveredAt),
            formatTimestamp(row.nextAttemptAt), display(row.lastError)])} />
      </>}</AdminData>
    </WorkspacePanel>
    <WorkspacePanel title="Delivery test" description="Send one test message to a mailbox you control.">
      <button type="button" className="button button--outline" onClick={() => operations.open({
        title: 'Send a delivery test?', action: 'Send test email', description: <p>Courtly will send one diagnostic message to this address.</p>,
        fields: <Field name="recipient" label="Authorized test mailbox" type="email" required maxLength={100} />,
        run: async data => {
          const result = await adminApi.testEmail(String(data.get('recipient') ?? '').trim())
          if (result.status !== 'SUCCESS') throw new ApiError('The test email was not delivered.')
          return 'Test email delivered.'
        },
      })}>Test email delivery</button>
    </WorkspacePanel>{operations.overlay}
  </AdminPage>
}

export function AdminBackups() {
  const resource = useResource(adminApi.backups)
  const operations = useAdminOperation(resource.retry)
  return <AdminPage title="Backups" description="Check database backup configuration and available snapshots."
    action={<AdminRefresh onClick={resource.retry} disabled={resource.loading} />}>
    <AdminData resource={resource} label="backup status">{status => <>
      <AdminMetrics values={[
        ['Scheduled backups', status.enabled ? 'Enabled' : 'Disabled'], ['Interval', status.intervalDays + ' days'],
        ['Retention', status.keep + ' files'], ['Encryption', status.encrypted ? 'Enabled' : 'Disabled'],
        ['Last backup', formatTimestamp(status.lastBackupAt)], ['Next due', status.enabled ? formatTimestamp(status.nextDueAt) : '—'],
      ]} />
      <WorkspacePanel title="Available backups" action={<button type="button" className="button button--primary" onClick={() => operations.open({
        title: 'Create database backup?', action: 'Create backup',
        description: <p>Courtly will create a snapshot using the server’s retention and encryption settings.</p>,
        run: async () => {
          const saved = await adminApi.createBackup().catch(() => { throw new ApiError('The server could not create a backup. Refresh the backup list before trying again.') })
          if (!saved?.fileName) throw new ApiError('Courtly could not verify the new backup.')
          return 'Backup created.'
        },
      })}>Create backup</button>}>
        <AdminTable label="Available backups" columns={['File', 'Size', 'Created']}
          rows={status.backups.map(row => [row.fileName, new Intl.NumberFormat('en-PK').format(row.sizeBytes) + ' bytes', formatTimestamp(row.createdAt)])} />
      </WorkspacePanel>
    </>}</AdminData>{operations.overlay}
  </AdminPage>
}
