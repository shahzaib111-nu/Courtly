import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { failureMessage, statusLabel, WorkspacePanel } from './player-workspace-ui'
import { Field, Message, Submit } from './ui'
import { accountApi, ApiError } from '../lib/api'
import type { AccountProfile, Category, ProfileUpdate, RegistrationRole } from '../lib/contracts'
import { localDate, normalizePhone, validate } from '../lib/validation'

const categories: Category[] = ['REGULAR', 'STUDENT', 'SENIOR', 'FAMILY', 'GROUP']

export function ProfileForm({ profile, onSave, role = 'PLAYER' }: { profile: AccountProfile; onSave: (updated: AccountProfile) => void; role?: RegistrationRole }) {
  const [category, setCategory] = useState(profile.category)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const form = new FormData(event.currentTarget)
    const field = (name: string) => String(form.get(name) ?? '').trim()
    const phone = field('phone')
    const body: ProfileUpdate = {
      name: field('name'), username: field('username'), phone: normalizePhone(phone), dateOfBirth: field('dateOfBirth'), ...(role === 'PLAYER' ? { category } : {}),
    }
    const problems: Record<string, string> = {
      name: validate.name(body.name), username: validate.username(body.username),
      phone: validate.phone(phone), dateOfBirth: validate.birthDate(body.dateOfBirth, role),
    }
    if (role === 'PLAYER' && category === 'STUDENT') {
      body.studentId = field('studentId')
      body.universityEmail = field('universityEmail').toLowerCase()
      problems.studentId = validate.studentId(body.studentId)
      problems.universityEmail = validate.universityEmail(body.universityEmail)
    }
    if (role === 'PLAYER' && category === 'FAMILY' && field('familySize')) {
      body.familySize = Number(field('familySize'))
      if (!Number.isInteger(body.familySize) || body.familySize < 2 || body.familySize > 20) problems.familySize = 'Enter a whole number from 2 to 20.'
    }
    if (role === 'PLAYER' && category === 'GROUP') {
      body.groupSize = Number(field('groupSize'))
      body.leadMemberName = field('leadMemberName')
      if (!Number.isInteger(body.groupSize) || body.groupSize < 2 || body.groupSize > 50) problems.groupSize = 'Enter a whole number from 2 to 50.'
      if (body.leadMemberName) problems.leadMemberName = validate.name(body.leadMemberName)
    }
    setError('')
    setFields(problems)
    if (Object.values(problems).some(Boolean)) return
    pending.current = true
    setBusy(true)
    try { onSave(await accountApi.update(body)) }
    catch (failure) {
      if (failure instanceof ApiError) setFields(failure.fieldErrors)
      setError(failureMessage(failure, 'Your profile could not be saved.'))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return <form className="player-page" onSubmit={save}>
    <WorkspacePanel title="Personal information">
      <div className="workspace-field-grid">
        <Field label="Full name" name="name" defaultValue={profile.name} error={fields.name} required maxLength={100} autoComplete="name" />
        <Field label="Username" name="username" defaultValue={profile.username ?? ''} error={fields.username} maxLength={30} autoComplete="username" />
        <Field label="Account email" type="email" value={profile.email} readOnly autoComplete="email" />
        <Field label="Mobile number" name="phone" type="tel" defaultValue={profile.phone ?? ''} error={fields.phone}
          hint="Pakistani mobile number" required autoComplete="tel" />
        <Field label="Date of birth" name="dateOfBirth" type="date" defaultValue={profile.dateOfBirth ?? ''}
          error={fields.dateOfBirth} max={localDate()} autoComplete="bday" required />
      </div>
      {role === 'MANAGER' && <div className="workspace-form manager-profile-actions">
        {error && <Message>{error}</Message>}
        <Submit busy={busy}>{busy ? 'Saving…' : 'Save profile'}</Submit>
      </div>}
    </WorkspacePanel>
    {role === 'PLAYER' && <WorkspacePanel title="Player category" action={<Link className="text-link" to="/player/verification">Discount verification</Link>}>
      <div className="workspace-form">
        <div className="workspace-field-grid">
          <div className="field"><label htmlFor="settings-category">Category</label>
            <select id="settings-category" value={category} onChange={event => setCategory(event.target.value as Category)}>
              {categories.map(value => <option key={value} value={value}>{statusLabel(value)}</option>)}
            </select>
          </div>
          <div className="workspace-fact"><span>Verified discount tier</span><strong>{statusLabel(profile.discountTier)}</strong></div>
          {category === 'STUDENT' && <>
            <Field label="Student ID (optional)" name="studentId" defaultValue={profile.studentId ?? ''} error={fields.studentId} maxLength={30} />
            <Field label="University email (optional)" name="universityEmail" type="email" defaultValue={profile.universityEmail ?? ''}
              error={fields.universityEmail} maxLength={100} />
          </>}
          {category === 'FAMILY' && <Field label="Family size (optional)" name="familySize" type="number" min={2} max={20}
            defaultValue={profile.familySize ?? ''} error={fields.familySize} />}
          {category === 'GROUP' && <>
            <Field label="Group size" name="groupSize" type="number" min={2} max={50}
              defaultValue={profile.groupSize ?? ''} error={fields.groupSize} required />
            <Field label="Lead member name (optional)" name="leadMemberName" defaultValue={profile.leadMemberName ?? ''}
              maxLength={100} error={fields.leadMemberName} hint="Defaults to your full name." />
          </>}
        </div>
        {error && <Message>{error}</Message>}
        <Submit busy={busy}>{busy ? 'Saving…' : 'Save profile'}</Submit>
      </div>
    </WorkspacePanel>}
  </form>
}

export function PasswordForm({ profile, onSave }: { profile: AccountProfile; onSave: (notice: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const pending = useRef(false)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const element = event.currentTarget
    const form = new FormData(element)
    const current = String(form.get('currentPassword') ?? '')
    const password = String(form.get('newPassword') ?? '')
    const problems = {
      newPassword: validate.password(password.trim()),
      confirmation: password !== form.get('confirmation') ? 'Passwords do not match.' : '',
    }
    setError('')
    setFields(problems)
    if (Object.values(problems).some(Boolean)) return
    pending.current = true
    setBusy(true)
    try {
      await accountApi.password(profile.email, current, password)
      element.reset()
      onSave(profile.hasPassword ? 'Password changed.' : 'Password set.')
    } catch (failure) {
      if (failure instanceof ApiError) setFields(failure.fieldErrors)
      setError(failureMessage(failure, 'Your password could not be updated.'))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const action = profile.hasPassword ? 'Change password' : 'Set password'
  const provider = { GOOGLE: 'Google', GITHUB: 'GitHub', LOCAL: 'Email and password' }[profile.authProvider] ?? statusLabel(profile.authProvider)
  return <WorkspacePanel title="Security" description={'Sign-in provider · ' + provider}>
    <form className="workspace-form" onSubmit={save}>
      {profile.hasPassword && <Field label="Current password" type="password" name="currentPassword" autoComplete="current-password"
        error={fields.currentPassword} required maxLength={100} />}
      <div className="workspace-field-grid">
        <Field label="New password" type="password" name="newPassword" autoComplete="new-password" error={fields.newPassword}
          hint="8–100 characters with a letter and a number." required maxLength={100} />
        <Field label="Confirm new password" type="password" name="confirmation" autoComplete="new-password"
          error={fields.confirmation} required maxLength={100} />
      </div>
      {error && <Message>{error}</Message>}
      <Submit busy={busy}>{busy ? 'Saving…' : action}</Submit>
    </form>
  </WorkspacePanel>
}
