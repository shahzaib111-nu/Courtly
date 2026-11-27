import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Building2, Clock3, MapPin, Pencil, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { clockPattern, ManagerData, ManagerRefresh } from '../components/manager-ui'
import { PlayerHeading, WorkspacePanel, WorkspaceStatus } from '../components/player-workspace-ui'
import { Dialog, Field, Message, Submit, Toast } from '../components/ui'
import { ApiError } from '../lib/api'
import type { Facility } from '../lib/contracts'
import { managerApi } from '../lib/manager-api'
import { useManagedFacility } from '../lib/manager-data'

function FacilityEditor({ facility, onClose, onSave }: { facility: Facility; onClose: () => void; onSave: () => void }) {
  const [busy, setBusy] = useState(false)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const pending = useRef(false)
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const inputs = new FormData(event.currentTarget)
    const value = (key: string) => String(inputs.get(key) ?? '').trim()
    const data = { name: value('name'), location: value('location'), openingTime: value('openingTime'), closingTime: value('closingTime') }
    const errors: Record<string, string> = {}
    if (!/^(?=.*\p{L})[\p{L}\d .,'&()-]{2,100}$/u.test(data.name)) errors.name = 'Use 2–100 characters, including at least one letter. Numbers, spaces, and . , ’ & ( ) - are allowed.'
    if (data.location.length < 5 || data.location.length > 200) errors.location = 'Enter a location of 5–200 characters.'
    for (const name of ['openingTime', 'closingTime'] as const) if (!clockPattern.test(data[name])) errors[name] = 'Enter a time in HH:mm format.'
    if (data.openingTime && data.openingTime === data.closingTime) errors.closingTime = 'Closing time must differ from opening time.'
    setFields(errors)
    setError('')
    if (Object.keys(errors).length) return
    pending.current = true
    setBusy(true)
    try {
      const result = await managerApi.updateFacility(facility.facilityID, data)
      if (result?.facilityID !== facility.facilityID) throw new ApiError('Courtly could not verify the saved facility. Refresh the page before trying again.')
      onSave()
    } catch (failure) {
      if (failure instanceof ApiError) setFields(failure.fieldErrors)
      setError(failure instanceof ApiError ? failure.message : 'The facility could not be saved.')
    } finally { pending.current = false; setBusy(false) }
  }
  return <Dialog title="Edit facility" onClose={() => { if (!pending.current) onClose() }}>
    <form className="workspace-form" onSubmit={save} noValidate>
      <Field label="Facility name" name="name" defaultValue={facility.name} maxLength={100} required error={fields.name} />
      <Field label="Location" name="location" defaultValue={facility.location ?? ''} maxLength={200} required error={fields.location} />
      <div className="workspace-field-grid">
        <Field label="Opening time" name="openingTime" type="time" defaultValue={facility.openingTime} required error={fields.openingTime} />
        <Field label="Closing time" name="closingTime" type="time" defaultValue={facility.closingTime} required error={fields.closingTime} />
      </div>
      {error && <Message>{error}</Message>}
      <div className="workspace-actions dialog-actions">
        <button className="button button--outline" type="button" onClick={onClose} disabled={busy}>Cancel</button>
        <Submit busy={busy}>{busy ? 'Saving…' : 'Save facility'}</Submit>
      </div>
    </form>
  </Dialog>
}

export function ManagerFacility() {
  const resource = useManagedFacility()
  const [editing, setEditing] = useState<Facility>()
  const [toast, setToast] = useState('')
  return <div className="player-page">
    <PlayerHeading title="My Facility" description="Manage the public details and opening hours for your arena." />
    <WorkspacePanel title="Facility details" action={<ManagerRefresh disabled={resource.loading} onClick={resource.retry} />}>
      <ManagerData resource={resource} label="facility details">{({ facility }) => <>
        <div className="manager-facility-head">
          <span className="manager-icon"><Building2 size={24} aria-hidden="true" /></span>
          <div><h3>{facility.name}</h3><p><MapPin size={15} aria-hidden="true" />{facility.location || 'Location not yet added'}</p></div>
          <WorkspaceStatus status={facility.operatingStatus} />
          <button className="button button--outline button--small" type="button" onClick={() => setEditing(facility)}><Pencil size={15} />Edit facility</button>
        </div>
        <dl className="manager-facts manager-facility-facts">
          <div><dt><Clock3 size={15} aria-hidden="true" />Operating hours</dt><dd>{facility.openingTime}–{facility.closingTime}{facility.closingTime < facility.openingTime && ' next day'}</dd></div>
          <div><dt>Courts</dt><dd>{facility.courtCount} <Link to="/manager/courts" className="text-link">Manage courts</Link></dd></div>
          <div><dt><Star size={15} aria-hidden="true" />Facility rating</dt><dd>{facility.averageRating === null ? 'No ratings yet' : facility.averageRating.toFixed(1) + ' / 5'}
            <small>{facility.ratingCount} {facility.ratingCount === 1 ? 'rating' : 'ratings'}</small></dd></div>
        </dl>
      </>}</ManagerData>
    </WorkspacePanel>
    {editing && <FacilityEditor facility={editing} onClose={() => setEditing(undefined)} onSave={() => {
      setEditing(undefined); resource.retry(); setToast('Facility updated.')
    }} />}
    {toast && <Toast onClose={() => setToast('')}>{toast}</Toast>}
  </div>
}
