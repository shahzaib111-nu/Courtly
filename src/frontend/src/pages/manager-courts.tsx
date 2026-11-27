import { useCallback, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { LayoutGrid, Plus, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { clockPattern, ManagerConfirm, ManagerData, ManagerEmpty } from '../components/manager-ui'
import { PlayerHeading, statusLabel, WorkspacePanel, WorkspaceStatus } from '../components/player-workspace-ui'
import { Dialog, Field, Message, Submit, Toast } from '../components/ui'
import { ApiError } from '../lib/api'
import { invalidateAvailability } from '../lib/availability'
import { formatTimestamp, priceLabel, sportLabel } from '../lib/booking-time'
import type { Court } from '../lib/contracts'
import { managerApi } from '../lib/manager-api'
import type { CourtUpdate } from '../lib/manager-api'
import { useManagedFacility } from '../lib/manager-data'
import { useResource } from '../lib/use-resource'

const sports = ['TENNIS', 'CRICKET', 'FOOTBALL', 'BASKETBALL', 'FUTSAL', 'BADMINTON', 'SQUASH', 'VOLLEYBALL']
const statuses = ['AVAILABLE', 'MAINTENANCE', 'CLOSED']
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))

function validateCourt(data: CourtUpdate) {
  const errors: Record<string, string> = {}
  if (!/^(?=.*\p{L})[\p{L}\d .,'&()#/-]{2,100}$/u.test(data.name)) errors.name = 'Use 2–100 permitted characters with at least one letter.'
  if (!sports.includes(data.sportType)) errors.sportType = 'Choose a supported sport.'
  if (!statuses.includes(data.status)) errors.status = 'Choose a court status.'
  if (!Number.isFinite(data.hourlyRate) || data.hourlyRate < 100 || data.hourlyRate > 100000) errors.hourlyRate = 'Enter PKR 100–100,000.'
  if (!Number.isInteger(data.capacity) || data.capacity < 0 || data.capacity > 100) errors.capacity = 'Enter a whole number from 1 to 100, or leave blank for the sport default.'
  if ((data.description?.length ?? 0) > 500) errors.description = 'Keep the description within 500 characters.'
  const slot = data.slotDurationMinutes
  if (slot < 30 || slot > 240 || slot % 15 !== 0) errors.slotDurationMinutes = 'Choose 30–240 minutes in 15-minute increments.'
  const open = data.openTime ?? ''
  const close = data.closeTime ?? ''
  if (!clockPattern.test(open)) errors.openTime = 'Enter an opening time.'
  if (!clockPattern.test(close) || close === open) errors.closeTime = 'Enter a closing time different from opening.'
  if (!errors.openTime && !errors.closeTime && (minutes(close) - minutes(open) + 1440) % 1440 < slot) {
    errors.closeTime = 'The operating hours must fit at least one full slot.'
  }
  if (data.peakStartTime || data.peakEndTime) {
    if (!clockPattern.test(data.peakStartTime ?? '')) errors.peakStartTime = 'Enter both peak times, or leave both blank.'
    if (!clockPattern.test(data.peakEndTime ?? '') || (data.peakEndTime ?? '') <= (data.peakStartTime ?? '')) {
      errors.peakEndTime = 'Peak end must follow peak start on the same day.'
    }
  }
  for (const key of ['peakMultiplier', 'weekendMultiplier'] as const) {
    if (!Number.isFinite(data[key]) || data[key] < 1 || data[key] > 3) errors[key] = 'Enter a multiplier between 1.0 and 3.0.'
  }
  return errors
}

function CourtEditor({ court, onClose, onSave }: { court?: Court; onClose: () => void; onSave: (court: Court) => void }) {
  const [busy, setBusy] = useState(false)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const pending = useRef(false)
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const data = new FormData(event.currentTarget)
    const value = (name: string) => String(data.get(name) ?? '').trim()
    const payload: CourtUpdate = {
      name: value('name'), sportType: value('sportType'), status: value('status'),
      description: value('description') || null, capacity: Number(value('capacity')),
      openTime: value('openTime'), closeTime: value('closeTime'), slotDurationMinutes: Number(value('slotDurationMinutes')),
      hourlyRate: Number(value('hourlyRate')), peakStartTime: value('peakStartTime') || null, peakEndTime: value('peakEndTime') || null,
      peakMultiplier: Number(value('peakMultiplier') || '1'), weekendMultiplier: Number(value('weekendMultiplier') || '1'),
    }
    const errors = validateCourt(payload)
    setFields(errors)
    setError('')
    if (Object.keys(errors).length) return
    pending.current = true
    setBusy(true)
    try {
      const saved = await managerApi.saveCourt(payload, court?.courtID)
      if (!saved?.courtID || (court && saved.courtID !== court.courtID)) throw new ApiError('Courtly could not verify the saved court. Refresh the list before trying again.')
      onSave(saved)
    } catch (failure) {
      if (failure instanceof ApiError) setFields(failure.fieldErrors)
      setError(failure instanceof ApiError ? failure.message : 'The court could not be saved.')
    } finally { pending.current = false; setBusy(false) }
  }
  return <Dialog title={court ? 'Edit court' : 'Add court'} onClose={() => { if (!pending.current) onClose() }}>
    <form className="workspace-form manager-court-form" onSubmit={save} noValidate>
      <fieldset className="manager-fieldset">
        <legend>Basic information</legend>
        <div className="workspace-field-grid">
          <Field label="Court name" name="name" defaultValue={court?.name} maxLength={100} required error={fields.name} />
          <div className="field"><label htmlFor="court-sport">Sport</label>
            <select id="court-sport" name="sportType" defaultValue={court?.sportType ?? ''} required aria-invalid={!!fields.sportType} aria-describedby={fields.sportType ? 'court-sport-error' : undefined}>
              <option value="" disabled>Choose a sport</option>{sports.map(sport => <option key={sport} value={sport}>{sportLabel(sport)}</option>)}
            </select>{fields.sportType && <span id="court-sport-error" className="field-error">{fields.sportType}</span>}
          </div>
          <Field label="Capacity" name="capacity" type="number" min={1} max={100} defaultValue={court?.capacity || undefined}
            hint="Optional. Uses the sport’s default when blank." error={fields.capacity} />
          <div className="field"><label htmlFor="court-status">Court status</label>
            <select id="court-status" name="status" defaultValue={court?.status ?? 'AVAILABLE'}>
              {statuses.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label htmlFor="court-description">Description</label>
          <textarea id="court-description" name="description" maxLength={500} rows={3} defaultValue={court?.description ?? ''}
            aria-describedby="court-description-note" aria-invalid={!!fields.description} />
          <span id="court-description-note" className={fields.description ? 'field-error' : 'field-hint'}>{fields.description || 'Optional · up to 500 characters'}</span>
        </div>
      </fieldset>
      <fieldset className="manager-fieldset">
        <legend>Operating schedule</legend>
        <div className="workspace-field-grid">
          <Field label="Opening time" name="openTime" type="time" defaultValue={court?.openTime ?? '08:00'} required error={fields.openTime} />
          <Field label="Closing time" name="closeTime" type="time" defaultValue={court?.closeTime ?? '22:00'} required
            hint="An earlier closing time is on the following day." error={fields.closeTime} />
          <Field label="Slot duration (minutes)" name="slotDurationMinutes" type="number" min={30} max={240} step={15}
            defaultValue={court?.slotDurationMinutes || 60} required error={fields.slotDurationMinutes} />
        </div>
      </fieldset>
      <fieldset className="manager-fieldset">
        <legend>Pricing</legend>
        <div className="workspace-field-grid">
          <Field label="Hourly rate (PKR)" name="hourlyRate" type="number" step="any" min={100} max={100000} required defaultValue={court?.hourlyRate} error={fields.hourlyRate} />
          <Field label="Weekend multiplier" name="weekendMultiplier" type="number" step="any" min={1} max={3} defaultValue={court?.weekendMultiplier ?? 1} error={fields.weekendMultiplier} />
          <Field label="Peak start time" name="peakStartTime" type="time" defaultValue={court?.peakStartTime ?? ''} error={fields.peakStartTime} />
          <Field label="Peak end time" name="peakEndTime" type="time" defaultValue={court?.peakEndTime ?? ''} error={fields.peakEndTime} />
          <Field label="Peak multiplier" name="peakMultiplier" type="number" step="any" min={1} max={3} defaultValue={court?.peakMultiplier ?? 1} error={fields.peakMultiplier} />
        </div>
      </fieldset>
      {error && <Message>{error}</Message>}
      <div className="workspace-actions dialog-actions">
        <button className="button button--outline" type="button" onClick={onClose} disabled={busy}>Cancel</button>
        <Submit busy={busy}>{busy ? 'Saving…' : 'Save court'}</Submit>
      </div>
    </form>
  </Dialog>
}

function courtHours(court: Court) {
  if (!court.openTime || !court.closeTime) return 'Unavailable'
  return court.openTime + '–' + court.closeTime + (court.closeTime < court.openTime ? ' next day' : '')
}

function CourtDetails({ court, onClose, onEdit }: { court: Court; onClose: () => void; onEdit: () => void }) {
  const slots = useResource(useCallback((signal: AbortSignal) => managerApi.slots(court.courtID, signal), [court.courtID]))
  return <Dialog title={court.name} onClose={onClose}>
    <div className="workspace-actions"><WorkspaceStatus status={court.status} /><span>{sportLabel(court.sportType)}</span></div>
    {court.description && <p className="manager-dialog-copy">{court.description}</p>}
    <dl className="manager-facts manager-facility-facts">
      <div><dt>Hourly rate</dt><dd>{priceLabel(court.hourlyRate)}</dd></div>
      <div><dt>Capacity</dt><dd>{court.capacity} players</dd></div>
      <div><dt>Operating hours</dt><dd>{courtHours(court)}</dd></div>
      <div><dt>Slot duration</dt><dd>{court.slotDurationMinutes} min</dd></div>
      <div><dt>Peak pricing</dt><dd>{court.peakStartTime && court.peakEndTime
        ? court.peakStartTime + '–' + court.peakEndTime + ' · ' + court.peakMultiplier + '×' : 'No peak hours set'}</dd></div>
      <div><dt>Weekend pricing</dt><dd>{court.weekendMultiplier}×</dd></div>
      {court.maintenanceFrom && <div><dt>Maintenance</dt><dd>{formatTimestamp(court.maintenanceFrom)}
        <small>{court.maintenanceTo ? 'Ends ' + formatTimestamp(court.maintenanceTo) : 'Open-ended'}</small></dd></div>}
    </dl>
    <h3 className="manager-section-label">Operating time slots</h3>
    <p className="field-hint">Slot pattern from the court’s operating hours.</p>
    <ManagerData resource={slots} label="time slots">{rows => rows.length ? <ul className="manager-slots">
      {rows.map(row => <li key={row.startTime}>{row.display}</li>)}
    </ul> : <ManagerEmpty title="No configured time slots" />}</ManagerData>
    <div className="workspace-actions dialog-actions">
      <Link className="button button--outline" to={'/manager/maintenance?' + new URLSearchParams({ court: court.courtID })}>Manage maintenance</Link>
      <button type="button" className="button button--primary" onClick={onEdit}>Edit court</button>
    </div>
  </Dialog>
}

type CourtAction = { kind: 'new' } | { kind: 'details' | 'edit' | 'delete'; court: Court }

export function ManagerCourts() {
  const resource = useManagedFacility()
  const [query, setQuery] = useState('')
  const [sport, setSport] = useState('')
  const [status, setStatus] = useState('')
  const [action, setAction] = useState<CourtAction>()
  const [toast, setToast] = useState('')
  const close = () => setAction(undefined)
  function changed(id: string, message: string) {
    invalidateAvailability(id)
    resource.retry()
    close()
    setToast(message)
  }
  return <div className="player-page">
    <PlayerHeading title="Courts" description="Manage court availability, operating hours, and pricing."
      action={<button className="button button--primary" type="button" disabled={!resource.data} onClick={() => setAction({ kind: 'new' })}><Plus size={17} />Add court</button>} />
    <WorkspacePanel title="Managed courts" description={resource.data?.facility.name}>
      <div className="manager-filters">
        <Field label="Search courts" type="search" placeholder="Court name" value={query} onChange={event => setQuery(event.target.value)} />
        <div className="field"><label htmlFor="filter-court-sport">Sport</label>
          <select id="filter-court-sport" value={sport} onChange={event => setSport(event.target.value)}>
            <option value="">All sports</option>{sports.map(value => <option key={value} value={value}>{sportLabel(value)}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="filter-court-status">Status</label>
          <select id="filter-court-status" value={status} onChange={event => setStatus(event.target.value)}>
            <option value="">All statuses</option>{statuses.map(value => <option key={value} value={value}>{statusLabel(value)}</option>)}
          </select>
        </div>
      </div>
      <ManagerData resource={resource} label="managed courts">{({ courts }) => {
        const rows = courts.filter(court => court.name.toLowerCase().includes(query.trim().toLowerCase()) &&
          (!sport || sport === court.sportType) && (!status || status === court.status)).sort((a, b) => a.name.localeCompare(b.name))
        if (!rows.length) return <ManagerEmpty title={courts.length ? 'No courts match your filters' : 'No courts added yet'}
          detail={courts.length ? 'Try a different search or filter.' : 'Add a court to set its hours, pricing, and booking availability.'} />
        return <div className="workspace-table-wrap" tabIndex={0} aria-label="Managed courts">
          <table className="workspace-table manager-table">
            <thead><tr><th scope="col">Court</th><th scope="col">Status</th><th scope="col" className="manager-table-secondary">Hours and slots</th>
              <th scope="col" className="manager-table-secondary">Rate / hour</th><th scope="col">Actions</th></tr></thead>
            <tbody>{rows.map(court => <tr key={court.courtID}>
              <th scope="row"><span className="manager-table-court"><LayoutGrid size={16} aria-hidden="true" />{court.name}</span>
                <small>{sportLabel(court.sportType)} · {court.capacity} players</small></th>
              <td><WorkspaceStatus status={court.status} />{court.maintenanceFrom && <small className="manager-table-note"><Wrench size={12} aria-hidden="true" />Maintenance window</small>}</td>
              <td className="manager-table-secondary">{courtHours(court)}<small>{court.slotDurationMinutes} min slots</small></td>
              <td className="manager-table-secondary manager-amount">{priceLabel(court.hourlyRate)}</td>
              <td><div className="manager-row-actions">
                <button type="button" className="text-link" onClick={() => setAction({ kind: 'details', court })}>Details</button>
                <button type="button" className="text-link" onClick={() => setAction({ kind: 'edit', court })}>Edit</button>
                <button type="button" className="text-link manager-danger-link" onClick={() => setAction({ kind: 'delete', court })}>Delete</button>
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>
      }}</ManagerData>
    </WorkspacePanel>
    {action?.kind === 'details' && <CourtDetails court={action.court} onClose={close} onEdit={() => setAction({ kind: 'edit', court: action.court })} />}
    {(action?.kind === 'new' || action?.kind === 'edit') && <CourtEditor court={action.kind === 'edit' ? action.court : undefined}
      onClose={close} onSave={court => changed(court.courtID, action.kind === 'edit' ? 'Court updated.' : 'Court added.')} />}
    {action?.kind === 'delete' && <ManagerConfirm title="Delete court?" label="Delete court" danger onClose={close}
      description={<p>Remove <strong>{action.court.name}</strong> from your facility? Courtly protects courts with active upcoming bookings.</p>}
      onConfirm={async () => {
        const result = await managerApi.deleteCourt(action.court.courtID)
        if (!result?.deleted) throw new ApiError('Courtly could not verify that the court was deleted.')
        changed(action.court.courtID, 'Court deleted.')
      }} />}
    {toast && <Toast onClose={() => setToast('')}>{toast}</Toast>}
  </div>
}
