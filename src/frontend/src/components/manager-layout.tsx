import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Building2, CalendarDays, Clock3, House, LayoutGrid, RefreshCw, Settings, ShieldAlert, ShieldCheck, Wrench } from 'lucide-react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { NotificationInbox, NotificationList } from './player-notifications'
import { PlayerHeading, WorkspacePanel, WorkspaceStatus } from './player-workspace-ui'
import { ContentError, Skeleton } from './ui'
import { WorkspaceShell } from './workspace-shell'
import { accountApi, ApiError } from '../lib/api'
import { managerNoticeCopy } from '../lib/manager-data'
import type { ManagerContext } from '../lib/manager-data'
import { NotificationsProvider, useNotifications } from '../lib/notifications'
import { useSession } from '../lib/session'
import type { Session } from '../lib/session'

const overviewLink = { label: 'Overview', to: '/manager', Icon: House, end: true }
const operationsLinks = [
  overviewLink,
  { label: 'My Facility', to: '/manager/facility', Icon: Building2 },
  { label: 'Courts', to: '/manager/courts', Icon: LayoutGrid },
  { label: 'Maintenance', to: '/manager/maintenance', Icon: Wrench },
  { label: 'Bookings', to: '/manager/bookings', Icon: CalendarDays },
]
const accountLinks = [
  { label: 'Notifications', to: '/manager/notifications', Icon: Bell },
  { label: 'Settings', to: '/manager/settings', Icon: Settings },
]

function useManagerApproval(userId: string) {
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  const check = useCallback(() => {
    if (pending.current) return
    const request = new AbortController()
    pending.current = request
    setBusy(true)
    accountApi.status(userId, request.signal).then(result => {
      if (request.signal.aborted) return
      setStatus(result.accountStatus.trim().toUpperCase())
      setError('')
    }).catch(failure => {
      if (request.signal.aborted) return
      setStatus('')
      setError(failure instanceof ApiError ? failure.message : 'Courtly could not check your account status.')
    }).finally(() => {
      if (pending.current === request) {
        pending.current = null
        setBusy(false)
      }
    })
  }, [userId])

  useEffect(() => {
    check()
    const whenVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', whenVisible)
    const timer = window.setInterval(whenVisible, 60_000)
    return () => {
      pending.current?.abort()
      pending.current = null
      document.removeEventListener('visibilitychange', whenVisible)
      window.clearInterval(timer)
    }
  }, [check])
  return { status, busy, error, check }
}

function ManagerApproval({ session, approval }: { session: Session; approval: ReturnType<typeof useManagerApproval> }) {
  const notices = useNotifications()
  const rejected = approval.status === 'REJECTED'
  const pending = approval.status === 'PENDING_APPROVAL'
  const decision = rejected ? notices.snapshot?.items.find(item =>
    item.type === 'PROFILE_REJECTED' && item.title === 'Account Not Approved') : undefined
  const reason = decision?.message?.replace(/^Your Arena Manager registration was not approved\. Reason: /, '')
  const Icon = rejected ? ShieldAlert : pending ? Clock3 : ShieldCheck
  const title = rejected ? 'Manager approval declined' : pending ? 'Account pending approval' : 'Manager access'
  return <div className="player-page">
    <PlayerHeading title={title} />
    {approval.error && <ContentError error={approval.error} retry={approval.check} />}
    <section className="manager-approval player-panel">
      <span className="manager-icon"><Icon size={24} aria-hidden="true" /></span>
      <div className="manager-approval-copy">
        {approval.status && <WorkspaceStatus status={approval.status} />}
        <h2>{rejected ? 'Your application was declined' : pending ? 'An administrator is reviewing your application' : 'Check your account status'}</h2>
        <p>{rejected ? reason || 'Check your inbox for the decision. Contact the Courtly administrator for help with your application.'
          : pending ? 'You’ll receive an account notification when a decision is made. Once approved, your facility and booking tools will be available here.'
            : 'Courtly needs to verify your approval before opening management tools.'}</p>
        <div className="workspace-actions">
          <button type="button" className="button button--primary" disabled={approval.busy} onClick={() => { approval.check(); notices.refresh() }}>
            <RefreshCw size={16} aria-hidden="true" />{approval.busy ? 'Checking…' : 'Refresh status'}
          </button>
          <Link to="/manager/notifications" className="button button--outline">Open inbox</Link>
        </div>
      </div>
    </section>
    <div className="manager-overview-grid">
      <WorkspacePanel title="Account information" action={<Link to="/manager/settings" className="text-link">Account settings</Link>}>
        <dl className="manager-facts"><div><dt>Name</dt><dd>{session.name}</dd></div><div><dt>Email</dt><dd>{session.email}</dd></div></dl>
      </WorkspacePanel>
      <WorkspacePanel title="Recent notifications"><NotificationList limit={3} copy={managerNoticeCopy} /></WorkspacePanel>
    </div>
  </div>
}

function ManagerWorkspace({ session }: { session: Session }) {
  const { pathname } = useLocation()
  const path = pathname.replace(/\/$/, '')
  const approval = useManagerApproval(session.userId)
  const approved = approval.status === 'ACTIVE' || approval.status === 'APPROVED'
  const isAccount = accountLinks.some(link => link.to === path)
  const title = [...operationsLinks, ...accountLinks].find(link => link.to === path)?.label ?? 'Manager workspace'
  const context: ManagerContext = { session, accountStatus: approval.status }
  return <WorkspaceShell session={session} roleLabel="Manager" root="/manager" title={title} noticeCopy={managerNoticeCopy}
    groups={[{ label: 'Operations', links: approved ? operationsLinks : [overviewLink] }, { label: 'Account', links: accountLinks }]}>
    {approved || isAccount ? <Outlet context={context} />
      : !approval.status && approval.busy && !approval.error ? <Skeleton label="Checking manager approval" count={2} />
      : <ManagerApproval session={session} approval={approval} />}
  </WorkspaceShell>
}

export function ManagerGuard() {
  const { session } = useSession()
  const { pathname, search } = useLocation()
  if (!session) return <Navigate replace to={'/login?' + new URLSearchParams({ returnTo: pathname + search, role: 'MANAGER' })} />
  if (session.role !== 'MANAGER') return <Navigate to="/workspace" replace />
  return <NotificationsProvider key={session.userId} userId={session.userId}>
    <ManagerWorkspace session={session} />
  </NotificationsProvider>
}

export function ManagerNotifications() {
  return <NotificationInbox description="Facility bookings, maintenance, and account updates." copy={managerNoticeCopy} />
}
