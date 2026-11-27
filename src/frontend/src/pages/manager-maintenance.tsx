import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarClock, Plus, Wrench } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { ManagerConfirm, ManagerData, ManagerEmpty, ManagerRefresh } from '../components/manager-ui'
import { PlayerHeading, WorkspacePanel, WorkspaceStatus } from '../components/player-workspace-ui'
import { Dialog, Field, Message, Submit, Toast } from '../components/ui'
import { ApiError } from '../lib/api'
import { invalidateAvailability } from '../lib/availability'
import { formatTimestamp, lahoreTimestamp, sportLabel } from '../lib/booking-time'
import type { Court } from '../lib/contracts'
import { managerApi } from '../lib/manager-api'
import type { MaintenanceWindow } from '../lib/manager-api'
import { useManagedFacility, useManagerMaintenance } from '../lib/manager-data'

const minute = 60_000
const day = 24 * 60 * minute
const localTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const lahoreLocalInput = (date: number) => new Date(date + 5 * 60 * minute).toISOString().slice(0, 16)

function inOneYear(now: number) {
  const date = new Date(now + 5 * 60 * minute)
  const month = date.getUTCMonth()
  date.setUTCFullYear(date.getUTCFullYear() + 1)
  if (date.getUTCMonth() !== month) date.setUTCDate(0)
  return date.valueOf() - 5 * 60 * minute
}

export function maintenanceState(window: MaintenanceWindow) {
  if (window.maintenanceTo && lahoreTimestamp(window.maintenanceTo) <= Date.now()) return 'ENDING'
  if (lahoreTimestamp(window.maintenanceFrom) > Date.now()) return 'SCHEDULED'
  return window.status === 'MAINTENANCE' ? 'IN_PROGRESS' : 'STARTING'
}

function MaintenanceEditor({ courts, selected, onSave, onClose }: {
  courts: Court[]; selected?: string; onSave: (courtID: string) => void; onClose: () => void
}) {
  const [courtID, setCourtID] = useState(selected ?? '')
  const [busy, setBusy] = useState(false)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const pending = useRef(false)
  const court = courts.find(item => item.courtID === courtID)
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const data = new FormData(event.currentTarget)
    const from = String(data.get('maintenanceFrom') ?? '')
    const to = String(data.get('maintenanceTo') ?? '')
    const start = lahoreTimestamp(from)
    const end = lahoreTimestamp(to)
    const now = Date.now()
    const errors: Record<string, string> = {}
    if (!court) errors.courtID = 'Choose one of your managed courts.'
    if (!localTime.test(from) || !Number.isFinite(start) || start <= now) errors.maintenanceFrom = 'Choose a start time in the future.'
    else if (start > inOneYear(now)) errors.maintenanceFrom = 'Maintenance can start at most one year ahead.'
    if (to && (!localTime.test(to) || !Number.isFinite(end) || end <= start)) errors.maintenanceTo = 'End time must follow the start time.'
    else if (to && end - start > 90 * day) errors.maintenanceTo = 'A maintenance window can last at most 90 days.'
    if (court?.maintenanceFrom && data.get('replace') !== 'on') errors.replace = 'Confirm that you want to replace the current window.'
    setFields(errors)
    setError('')
    if (Object.keys(errors).length) return
    pending.current = true
    setBusy(true)
    try {
      const result = await managerApi.scheduleMaintenance(courtID, { maintenanceFrom: from, maintenanceTo: to || null })
      if (result?.courtID !== courtID) throw new ApiError('Courtly could not verify the scheduled window. Refresh before trying again.')
      onSave(courtID)
    } catch (failure) {
      if (failure instanceof ApiError) setFields(failure.fieldErrors)
      setError(failure instanceof ApiError ? failure.message : 'The maintenance window could not be saved.')
    } finally { pending.current = false; setBusy(false) }
  }
  return <Dialog title="Schedule maintenance" onClose={() => { if (!pending.current) onClose() }}>
    <form className="workspace-form" onSubmit={save} noValidate>
      <p className="field-hint">Enter dates and times in Lahore time.</p>
      <div className="field"><label htmlFor="maintenance-court">Court</label>
        <select id="maintenance-court" value={courtID} onChange={event => setCourtID(event.target.value)}
          aria-invalid={!!fields.courtID} aria-describedby={fields.courtID ? 'maintenance-court-error' : undefined}>
          <option value="">Choose a court</option>{courts.map(item => <option key={item.courtID} value={item.courtID}>{item.name}</option>)}
        </select>{fields.courtID && <span id="maintenance-court-error" className="field-error">{fields.courtID}</span>}
      </div>
      <Field label="Start date and time" name="maintenanceFrom" type="datetime-local" min={lahoreLocalInput(Date.now() + minute)}
        max={lahoreLocalInput(inOneYear(Date.now()))} required error={fields.maintenanceFrom} />
      <Field label="End date and time (optional)" name="maintenanceTo" type="datetime-local" error={fields.maintenanceTo}
        hint="Leave blank for open-ended maintenance. Dated windows can last up to 90 days." />
      {court?.maintenanceFrom && <label className="manager-checkbox" key={courtID}>
        <input type="checkbox" name="replace" aria-invalid={!!fields.replace} aria-describedby={fields.replace ? 'replace-window-error' : undefined} />
        Replace the window starting {formatTimestamp(court.maintenanceFrom)}
      </label>}
      {court?.maintenanceFrom && fields.replace && <span id="replace-window-error" className="field-error">{fields.replace}</span>}
      {error && <Message>{error}</Message>}
      <div className="workspace-actions dialog-actions">
        <button type="button" className="button button--outline" onClick={onClose} disabled={busy}>Go back</button>
        <Submit busy={busy}>{busy ? 'Scheduling…' : 'Schedule window'}</Submit>
      </div>
    </form>
  </Dialog>
}

export function ManagerMaintenance() {
  const [params, setParams] = useSearchParams()
  const facility = useManagedFacility()
  const resource = useManagerMaintenance()
  const requestedCourt = params.get('court')
  const courts = facility.data?.courts ?? []
  const [scheduling, setScheduling] = useState(false)
  const [cancel, setCancel] = useState<MaintenanceWindow>()
  const [toast, setToast] = useState('')
  const selected = courts.find(court => court.courtID === requestedCourt)?.courtID
  const isScheduling = scheduling || !!selected
  const closeSchedule = () => { setScheduling(false); setParams({}, { replace: true }) }
  function refresh() { resource.retry(); facility.retry() }
  function changed(id: string, message: string) {
    invalidateAvailability(id)
    refresh()
    closeSchedule()
    setCancel(undefined)
    setToast(message)
  }
  return <div className="player-page">
    <PlayerHeading title="Maintenance" description="Plan court downtime and manage active maintenance windows."
      action={<button className="button button--primary" type="button" disabled={!courts.length} onClick={() => setScheduling(true)}>
        <Plus size={17} />Schedule maintenance</button>} />
    {facility.error && <ManagerData resource={facility} label="managed courts">{() => null}</ManagerData>}
    <WorkspacePanel title="Maintenance windows" description="One window per court. All times are Lahore time."
      action={<ManagerRefresh disabled={facility.loading || resource.loading} onClick={refresh} />}>
      <ManagerData resource={resource} label="maintenance windows">{records => {
        const rows = [...records].sort((a, b) => a.maintenanceFrom.localeCompare(b.maintenanceFrom))
        return rows.length ? <div className="workspace-table-wrap" tabIndex={0} aria-label="Maintenance windows">
          <table className="workspace-table manager-table">
            <thead><tr><th scope="col">Court</th><th scope="col">Status</th><th scope="col">Window</th><th scope="col">Actions</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.courtID}>
              <th scope="row"><span className="manager-table-court"><Wrench size={16} aria-hidden="true" />{row.courtName}</span><small>{sportLabel(row.sportType)}</small></th>
              <td><WorkspaceStatus status={maintenanceState(row)} /><small>Court {row.status.toLowerCase()}</small></td>
              <td>{formatTimestamp(row.maintenanceFrom)}<small>{row.maintenanceTo ? 'Ends ' + formatTimestamp(row.maintenanceTo) : 'Open-ended'}</small></td>
              <td><div className="manager-row-actions">
                <Link className="text-link" to={'?court=' + encodeURIComponent(row.courtID)}>Replace window</Link>
                <button type="button" className="text-link manager-danger-link" onClick={() => setCancel(row)}>Cancel window</button>
              </div></td>
            </tr>)}</tbody>
          </table>
        </div> : <ManagerEmpty title="No maintenance windows" detail="Scheduled and in-progress work will appear here." />
      }}</ManagerData>
    </WorkspacePanel>
    <WorkspacePanel title="Manual maintenance status" description="These courts are marked for maintenance without a dated window."
      action={<Link to="/manager/courts" className="text-link">Manage courts</Link>}>
      <ManagerData resource={facility} label="court status">{({ courts }) => {
        const rows = courts.filter(court => court.status === 'MAINTENANCE' && !court.maintenanceFrom)
        return rows.length ? <ul className="manager-compact-list">{rows.map(court => <li key={court.courtID}>
          <CalendarClock size={18} aria-hidden="true" /><span><strong>{court.name}</strong><small>{sportLabel(court.sportType)}</small></span>
          <WorkspaceStatus status={court.status} />
        </li>)}</ul> : <ManagerEmpty title="No courts in manual maintenance" />
      }}</ManagerData>
    </WorkspacePanel>
    {isScheduling && !!courts.length && <MaintenanceEditor key={selected ?? 'new'} courts={courts} selected={selected}
      onClose={closeSchedule} onSave={id => changed(id, 'Maintenance scheduled.')} />}
    {cancel && <ManagerConfirm title="Cancel maintenance window?" label="Cancel maintenance" danger onClose={() => setCancel(undefined)}
      description={<p>Remove the maintenance window for <strong>{cancel.courtName}</strong>? The backend sets the court to Available if it is currently in maintenance.</p>}
      onConfirm={async () => {
        const result = await managerApi.cancelMaintenance(cancel.courtID)
        if (!result?.message) throw new ApiError('Courtly could not verify that maintenance was cancelled.')
        changed(cancel.courtID, 'Maintenance cancelled.')
      }} />}
    {toast && <Toast onClose={() => setToast('')}>{toast}</Toast>}
  </div>
}
