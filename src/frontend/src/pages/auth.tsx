import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Building2, Github, ShieldCheck, UserRound } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Brand, Field, Message, Submit, Toast } from '../components/ui'
import { ApiError, authApi } from '../lib/api'
import type { Category, Provider, RegistrationRequest, RegistrationRole, Role } from '../lib/contracts'
import { DELETION_NOTICE_KEY, parseRole, safeReturnTo, useSession } from '../lib/session'
import { localDate, normalizePhone, validate } from '../lib/validation'
import { useResource } from '../lib/use-resource'

const oauthReturnKey = 'courtly.oauth.return'
type Errors = Record<string, string>

const categories: Record<Category, string> = {
  REGULAR: 'Regular', STUDENT: 'Student', SENIOR: 'Senior', FAMILY: 'Family', GROUP: 'Group',
}

function showFailure(error: unknown, setError: (message: string) => void, setFields?: (errors: Errors) => void) {
  if (error instanceof ApiError) {
    setFields?.(error.fieldErrors)
    setError(error.message)
  } else {
    setError('This request could not be completed. Please try again.')
  }
}

function AuthLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className={wide ? 'auth-layout auth-layout--wide' : 'auth-layout'}>
      <aside className="auth-aside">
        <img className="auth-photo" src="/images/tennis-player-1024.webp" alt="" decoding="async"
          srcSet="/images/tennis-player-640.webp 640w, /images/tennis-player-1024.webp 1024w" sizes="(max-width: 760px) 1px, 44vw"
          onError={event => { event.currentTarget.hidden = true }} />
        <div className="auth-aside-inner">
          <Brand />
          <div className="auth-aside-copy">
            <p className="eyebrow">Your next game, in Lahore</p>
            <p className="auth-tagline">Find. Book.<br /><span>Play.</span></p>
          </div>
        </div>
      </aside>
      <section className="auth-main">
        <div className="auth-top">
          <div className="mobile-brand"><Brand /></div>
          <Link className="back-link" to="/"><ArrowLeft size={16} /> Back to Courtly</Link>
        </div>
        <div className="auth-content">{children}</div>
      </section>
    </main>
  )
}

function RolePicker({ role, onChange, disabled }: { role: Role; onChange: (role: RegistrationRole) => void; disabled: boolean }) {
  return <fieldset className="role-picker" disabled={disabled}>
    <legend className="sr-only">Account role</legend>
    {([
      ['PLAYER', 'Player', UserRound],
      ['MANAGER', 'Arena manager', Building2],
    ] as const).map(([value, label, Icon]) => (
      <label key={value} className="role-choice">
        <input type="radio" name="accountRole" checked={role === value} onChange={() => onChange(value)} />
        <span><Icon size={18} aria-hidden="true" />{label}</span>
      </label>
    ))}
  </fieldset>
}

function SocialButtons({ role, destination }: { role: RegistrationRole; destination: string }) {
  const { data } = useResource(authApi.providers)
  const providers = data?.providers.filter(value => value === 'google' || value === 'github')
  if (!providers?.length) return null
  const start = (provider: Provider) => {
    sessionStorage.setItem(oauthReturnKey, destination)
    window.location.assign(authApi.authorizeUrl(provider, role))
  }
  return <div className="social">
    <div className="separator"><span>or continue with</span></div>
    <div className="social-grid">
      {providers.map(provider => <button key={provider} className="button button--outline" type="button" onClick={() => start(provider)}>
        {provider === 'google' ? <span className="provider-letter" aria-hidden="true">G</span> : <Github size={18} aria-hidden="true" />}
        {provider === 'google' ? 'Google' : 'GitHub'}
      </button>)}
    </div>
  </div>
}

function useAuthDestination() {
  const [query] = useSearchParams()
  const destination = safeReturnTo(query.get('returnTo'))
  return { query, destination }
}

function authPath(path: string, destination: string, role: Role) {
  const query = new URLSearchParams()
  if (role === 'MANAGER') query.set('role', 'manager')
  if (destination !== '/workspace') query.set('returnTo', destination)
  return path + (query.size ? '?' + query : '')
}

function signedInDestination(role: Role, destination: string) {
  const managerDestination = destination === '/manager' || destination.startsWith('/manager/') || destination.startsWith('/manager?')
  const adminDestination = destination === '/admin' || destination.startsWith('/admin/') || destination.startsWith('/admin?')
  if (role === 'ADMIN') return adminDestination ? destination : '/admin'
  if (role === 'MANAGER') return managerDestination ? destination : '/manager'
  return !managerDestination && !adminDestination ? destination : '/workspace'
}

export function LoginPage() {
  const { query, destination } = useAuthDestination()
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useSession()
  const [role, setRole] = useState<Role>(parseRole(query.get('role')) ?? 'PLAYER')
  const [notice, setNotice] = useState<string | undefined>(() => sessionStorage.getItem(DELETION_NOTICE_KEY)
    ? 'Account deletion requested. You’ve been signed out.' : location.state?.notice)
  const [busy, setBusy] = useState(false)
  const [fields, setFields] = useState<Errors>({})
  const [error, setError] = useState('')

  useEffect(() => { sessionStorage.removeItem(DELETION_NOTICE_KEY) }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const pass = String(form.get('password') ?? '')
    const problems: Errors = {}
    if (!email) problems.email = 'Enter your email or username.'
    if (!pass) problems.password = 'Enter your password.'
    setFields(problems)
    if (Object.keys(problems).length) return

    setBusy(true)
    try {
      const loggedIn = await authApi.login({ email, pass, role })
      signIn(loggedIn)
      navigate(signedInDestination(loggedIn.role, destination), { replace: true })
    } catch (failure) {
      showFailure(failure, setError, setFields)
    } finally {
      setBusy(false)
    }
  }

  return <AuthLayout>
    <div className="auth-intro">
      <h1>{role === 'ADMIN' ? 'Admin sign in' : 'Sign in to Courtly'}</h1>
      <p>{role === 'MANAGER' ? 'Access your arena workspace.' : role === 'ADMIN' ? 'Access Courtly administration.' : 'Your next game is waiting.'}</p>
    </div>
    {role !== 'ADMIN' && <RolePicker role={role} onChange={value => { setRole(value); setError('') }} disabled={busy} />}
    {error && <Message>{error}</Message>}
    <form className="auth-form" noValidate onSubmit={submit}>
      <Field label="Email or username" name="email" autoComplete="username" placeholder="Enter your email or username"
        defaultValue={location.state?.email ?? ''} error={fields.email} required />
      <Field label="Password" name="password" type="password" autoComplete="current-password"
        placeholder="Enter your password" error={fields.password} required />
      {role !== 'ADMIN' && <div className="form-meta"><Link className="text-link" to={authPath('/forgot-password', destination, role)}>Forgot password?</Link></div>}
      <Submit busy={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={18} aria-hidden="true" /></Submit>
    </form>
    {role !== 'ADMIN' && <>
      <SocialButtons role={role} destination={destination} />
      <p className="auth-switch">New to Courtly? <Link className="text-link" to={authPath('/register', destination, role)}>Create an account</Link></p>
    </>}
    <button className="admin-switch" type="button" disabled={busy} onClick={() => { setRole(role === 'ADMIN' ? 'PLAYER' : 'ADMIN'); setError(''); setFields({}) }}>
      <ShieldCheck size={15} aria-hidden="true" />{role === 'ADMIN' ? 'Player or arena manager sign in' : 'Admin sign in'}
    </button>
    {notice && <Toast onClose={() => setNotice(undefined)}>{notice}</Toast>}
  </AuthLayout>
}

export function RegisterPage() {
  const { query, destination } = useAuthDestination()
  const [role, setRole] = useState<RegistrationRole>(query.get('role')?.toUpperCase() === 'MANAGER' ? 'MANAGER' : 'PLAYER')
  const [category, setCategory] = useState<Category>('REGULAR')
  const [fields, setFields] = useState<Errors>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { signIn } = useSession()
  const navigate = useNavigate()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError('')
    const form = new FormData(event.currentTarget)
    const get = (key: string) => String(form.get(key) ?? '').trim()
    const password = String(form.get('password') ?? '')
    const input: RegistrationRequest = {
      name: get('name'), username: get('username'), email: get('email'), password,
      phone: get('phone'), dateOfBirth: get('dateOfBirth'), role,
    }
    const problems: Errors = {}
    const check = (key: string, message: string) => { if (message) problems[key] = message }
    check('name', validate.name(input.name))
    check('username', validate.username(input.username ?? ''))
    check('email', validate.email(input.email))
    check('phone', validate.phone(input.phone))
    check('dateOfBirth', validate.birthDate(input.dateOfBirth, role))
    check('password', validate.password(password))
    if (password !== form.get('confirmation')) problems.confirmation = 'Passwords do not match.'
    if (role === 'PLAYER') {
      input.category = category
      if (category === 'STUDENT') {
        input.studentId = get('studentId')
        input.universityEmail = get('universityEmail')
        check('studentId', validate.studentId(input.studentId))
        check('universityEmail', validate.universityEmail(input.universityEmail))
      }
      if (category === 'FAMILY' && get('familySize')) {
        input.familySize = Number(get('familySize'))
        if (!Number.isInteger(input.familySize) || input.familySize < 2 || input.familySize > 20) {
          problems.familySize = 'Enter a whole number from 2 to 20.'
        }
      }
      if (category === 'GROUP') {
        input.groupSize = Number(get('groupSize'))
        input.leadMemberName = get('leadMemberName')
        if (!Number.isInteger(input.groupSize) || input.groupSize < 2 || input.groupSize > 50) {
          problems.groupSize = 'Enter a whole number from 2 to 50.'
        }
        if (input.leadMemberName) check('leadMemberName', validate.name(input.leadMemberName))
      }
    }
    setFields(problems)
    if (Object.keys(problems).length) return

    input.phone = normalizePhone(input.phone)
    setBusy(true)
    try {
      const created = await authApi.register(input)
      try {
        const loggedIn = await authApi.login({ email: created.email, pass: password, role: created.role })
        signIn(loggedIn)
        navigate(signedInDestination(loggedIn.role, destination), { replace: true })
      } catch {
        navigate(authPath('/login', destination, created.role), { replace: true, state: { notice: 'Account created. Sign in to continue.', email: created.email } })
      }
    } catch (failure) {
      showFailure(failure, setError, setFields)
    } finally {
      setBusy(false)
    }
  }

  return <AuthLayout wide>
    <div className="auth-intro">
      <h1>Create your account</h1>
      <p>{role === 'MANAGER' ? 'An administrator reviews new arena manager accounts.' : 'Find local courts and book your next game.'}</p>
    </div>
    <RolePicker role={role} onChange={value => { setRole(value); setError(''); setFields({}) }} disabled={busy} />
    {error && <Message>{error}</Message>}
    <form className="auth-form" noValidate onSubmit={submit} onInput={event => {
      const name = (event.target as HTMLInputElement).name
      if (fields[name]) setFields(current => ({ ...current, [name]: '' }))
    }}>
      <div className="form-grid">
        <Field label="Full name" name="name" autoComplete="name" maxLength={100} required error={fields.name} />
        <Field label="Username (optional)" name="username" autoComplete="username" maxLength={30} error={fields.username} />
        <Field label="Email address" name="email" type="email" autoComplete="email" maxLength={100} required error={fields.email} />
        <Field label="Mobile number" name="phone" type="tel" autoComplete="tel" inputMode="tel"
          maxLength={20} placeholder="03XX-XXXXXXX" required error={fields.phone} />
        <Field label="Date of birth" name="dateOfBirth" type="date" autoComplete="bday" max={localDate()} required error={fields.dateOfBirth} />
        {role === 'PLAYER' && <div className="field">
          <label htmlFor="register-category">Player category</label>
          <select id="register-category" value={category} onChange={event => setCategory(event.target.value as Category)}>
            {Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {fields.category && <span className="field-error">{fields.category}</span>}
        </div>}
        {role === 'PLAYER' && category === 'STUDENT' && <>
          <Field label="Student ID (optional)" name="studentId" maxLength={30} error={fields.studentId} />
          <Field label="University email (optional)" name="universityEmail" type="email" maxLength={100} error={fields.universityEmail} />
        </>}
        {role === 'PLAYER' && category === 'FAMILY' && <Field label="Family size (optional)" name="familySize" type="number" min={2} max={20} error={fields.familySize} />}
        {role === 'PLAYER' && category === 'GROUP' && <>
          <Field label="Group size" name="groupSize" type="number" min={2} max={50} required error={fields.groupSize} />
          <Field label="Group lead (optional)" name="leadMemberName" maxLength={100} error={fields.leadMemberName} />
        </>}
        <Field label="Password" name="password" type="password" autoComplete="new-password" maxLength={100}
          hint="At least 8 characters, including a letter and a number." required error={fields.password} />
        <Field label="Confirm password" name="confirmation" type="password" autoComplete="new-password" maxLength={100}
          required error={fields.confirmation} />
      </div>
      <Submit busy={busy}>{busy ? 'Creating account…' : 'Create account'}<ArrowRight size={18} aria-hidden="true" /></Submit>
    </form>
    <SocialButtons role={role} destination={destination} />
    <p className="auth-switch">Already have an account? <Link className="text-link" to={authPath('/login', destination, role)}>Sign in</Link></p>
  </AuthLayout>
}

export function RecoveryPage() {
  const { query, destination } = useAuthDestination()
  const loginPath = authPath('/login', destination, parseRole(query.get('role')) ?? 'PLAYER')
  const navigate = useNavigate()
  const [stage, setStage] = useState<'email' | 'code' | 'password'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Errors>({})
  const [notice, setNotice] = useState('')

  async function send(address: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await authApi.forgot(address)
      setEmail(address)
      setOtp('')
      setStage('code')
      setNotice('Check your email for a six-digit code.')
    } catch (failure) {
      showFailure(failure, setError, setFields)
    } finally {
      setBusy(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError('')
    setFields({})
    setNotice('')
    const form = new FormData(event.currentTarget)
    if (stage === 'email') {
      const address = String(form.get('email') ?? '').trim()
      const problem = validate.email(address)
      if (problem) return setFields({ email: problem })
      return send(address)
    }
    if (stage === 'code') {
      const code = String(form.get('otp') ?? '').trim()
      if (!/^\d{6}$/.test(code)) return setFields({ otp: 'Enter the six-digit code.' })
      setBusy(true)
      try {
        await authApi.verifyOtp(email, code)
        setOtp(code)
        setStage('password')
      } catch (failure) {
        showFailure(failure, setError, setFields)
      } finally {
        setBusy(false)
      }
      return
    }
    const password = String(form.get('newPassword') ?? '')
    const problem = validate.password(password)
    if (problem) return setFields({ newPassword: problem })
    if (password !== form.get('confirmation')) return setFields({ confirmation: 'Passwords do not match.' })
    setBusy(true)
    try {
      await authApi.reset(email, otp, password)
      navigate(loginPath, { replace: true, state: { notice: 'Password reset. You can sign in now.', email } })
    } catch (failure) {
      showFailure(failure, setError, setFields)
    } finally {
      setBusy(false)
    }
  }

  const content = {
    email: { title: 'Reset your password', description: 'Enter the email address associated with your Courtly account.', action: 'Send a code' },
    code: { title: 'Verify your email', description: 'Enter the code we sent to ' + email + '.', action: 'Verify code' },
    password: { title: 'Choose a new password', description: 'Use at least eight characters with a letter and a number.', action: 'Reset password' },
  }[stage]

  return <AuthLayout>
    <div className="auth-intro"><h1>{content.title}</h1><p>{content.description}</p></div>
    {error && <Message>{error}</Message>}
    {notice && <Message kind="success">{notice}</Message>}
    <form key={stage} className="auth-form" onSubmit={submit} noValidate>
      {stage === 'email' && <Field label="Email address" name="email" type="email" autoComplete="email" maxLength={100} defaultValue={email} required error={fields.email} />}
      {stage === 'code' && <Field label="Verification code" name="otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required error={fields.otp} />}
      {stage === 'password' && <>
        <Field label="New password" name="newPassword" type="password" autoComplete="new-password" maxLength={100} required error={fields.newPassword} />
        <Field label="Confirm password" name="confirmation" type="password" autoComplete="new-password" maxLength={100} required error={fields.confirmation} />
      </>}
      <Submit busy={busy}>{busy ? 'Please wait…' : content.action}<ArrowRight size={18} aria-hidden="true" /></Submit>
    </form>
    {stage !== 'email' && <div className="recover-actions">
      <button type="button" className="text-link" disabled={busy} onClick={() => void send(email)}>Send another code</button>
      <button type="button" className="text-link" disabled={busy} onClick={() => { setStage('email'); setError(''); setFields({}); setNotice('') }}>Change email</button>
    </div>}
    <Link className="back-link auth-switch" to={loginPath}><ArrowLeft size={16} /> Back to sign in</Link>
  </AuthLayout>
}

const oauthErrors: Record<string, string> = {
  access_denied: 'Sign-in was cancelled. You can try again.',
  EMAIL_NOT_VERIFIED: 'Verify your email with the provider before continuing.',
  ACCOUNT_PENDING_DELETION: 'This account is pending deletion.',
  ADMIN_OAUTH_NOT_SUPPORTED: 'Administrator accounts use password sign-in.',
  email_required: 'Your provider did not share an email address.',
}

export function OAuthCallbackPage() {
  const { signIn } = useSession()
  const navigate = useNavigate()
  const handled = useRef(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (handled.current) return
    handled.current = true
    const params = new URLSearchParams(window.location.hash.slice(1))
    window.history.replaceState(window.history.state, '', window.location.pathname)
    const destination = safeReturnTo(sessionStorage.getItem(oauthReturnKey))
    sessionStorage.removeItem(oauthReturnKey)
    const failure = params.get('error')
    const token = params.get('token')
    const role = parseRole(params.get('role'))
    const email = params.get('email')
    if (failure || !token || !role || !email) {
      const message = failure?.startsWith('ROLE_MISMATCH')
        ? 'Choose the role associated with your existing account and try again.'
        : oauthErrors[failure ?? ''] ?? 'Social sign-in could not be completed. Try signing in again.'
      setError(message)
      return
    }
    try {
      signIn({
        success: true, token, role, email, playerID: params.get('playerID'),
        name: params.get('name') ?? '', accountStatus: params.get('accountStatus'),
        expiresIn: Number(params.get('expiresIn')) || 0,
      })
      navigate(signedInDestination(role, destination), { replace: true })
    } catch {
      setError('Courtly could not validate your sign-in. Please try again.')
    }
  }, [navigate, signIn])

  return <AuthLayout>
    <div className="auth-intro"><h1>{error ? 'Sign-in interrupted' : 'Finishing sign-in'}</h1></div>
    {error ? <><Message>{error}</Message><Link className="button button--primary mt-4" to="/login">Back to sign in</Link></>
      : <p role="status">Connecting your Courtly account…</p>}
  </AuthLayout>
}
