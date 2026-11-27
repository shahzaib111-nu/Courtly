import { lazy, Suspense, useCallback } from 'react'
import { Archive, Bell, CalendarDays, ChartNoAxesCombined, CreditCard, FileCheck2, Gavel, House, Mail, ShieldCheck, UserRoundCog, Users } from 'lucide-react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AdminData, AdminMetrics, AdminPage, AdminRefresh, AdminTable } from '../components/admin-ui'
import { NotificationInbox, NotificationList } from '../components/player-notifications'
import { statusLabel, WorkspacePanel, WorkspaceStatus } from '../components/player-workspace-ui'
import { ContentError, Skeleton } from '../components/ui'
import { WorkspaceShell } from '../components/workspace-shell'
import { adminApi } from '../lib/admin-api'
import { priceLabel } from '../lib/booking-time'
import { NotificationsProvider } from '../lib/notifications'
import { useSession } from '../lib/session'
import { useResource } from '../lib/use-resource'
import { AdminAccounts, AdminDisputes, AdminManagers, AdminVerification } from './admin-queues'
import { AdminBackups, AdminBookings, AdminDelivery, AdminPayments, paymentPeriod } from './admin-monitoring'
import '../admin.css'

const AdminReports = lazy(() => import('./admin-reports').then(module => ({ default: module.AdminReports })))

const groups = [
  { label: 'Workspace', links: [{ label: 'Overview', to: '/admin', Icon: House, end: true }] },
  { label: 'Reviews', links: [
    { label: 'Manager approvals', to: '/admin/managers', Icon: Users },
    { label: 'Document verification', to: '/admin/verification', Icon: FileCheck2 },
    { label: 'Account requests', to: '/admin/accounts', Icon: UserRoundCog },
    { label: 'Match disputes', to: '/admin/disputes', Icon: Gavel },
  ] },
  { label: 'Operations', links: [
    { label: 'Active bookings', to: '/admin/bookings', Icon: CalendarDays },
    { label: 'Payment summaries', to: '/admin/payments', Icon: CreditCard },
    { label: 'Reports', to: '/admin/reports', Icon: ChartNoAxesCombined },
  ] },
  { label: 'System', links: [
    { label: 'Email delivery', to: '/admin/email-delivery', Icon: Mail },
    { label: 'Backups', to: '/admin/backups', Icon: Archive },
    { label: 'Notifications', to: '/admin/notifications', Icon: Bell },
  ] },
]

function AdminOverview() {
  const stats = useResource(adminApi.statistics)
  const managers = useResource(adminApi.managers)
  const accounts = useResource(adminApi.deletions)
  const disputes = useResource(adminApi.disputes)
  const bookings = useResource(adminApi.bookings)
  const { from, to } = paymentPeriod()
  const payments = useResource(useCallback((signal: AbortSignal) => adminApi.payments(from, to, signal), [from, to]))
  function refresh() { [stats, managers, accounts, disputes, bookings, payments].forEach(resource => resource.retry()) }
  const queues = [
    { name: 'Managers awaiting approval', count: managers.data?.length, to: '/admin/managers', loading: managers.loading, Icon: Users },
    { name: 'Documents awaiting review', count: stats.data?.pendingCount, to: '/admin/verification', loading: stats.loading, Icon: FileCheck2 },
    { name: 'Account deletion requests', count: accounts.data?.length, to: '/admin/accounts', loading: accounts.loading, Icon: UserRoundCog },
    { name: 'Outstanding disputes', count: disputes.data?.length, to: '/admin/disputes', loading: disputes.loading, Icon: Gavel },
  ]
  const failed = [stats, managers, accounts, disputes, bookings, payments].some(resource => resource.error)
  const availableRows = bookings.data?.length ?? 0
  const pending = bookings.data?.filter(row => row.status === 'PENDING').length ?? 0
  const confirmed = bookings.data?.filter(row => row.status === 'CONFIRMED').length ?? 0
  return <AdminPage title="Administrator overview" description="Review open tasks and monitor Courtly operations."
    action={<AdminRefresh onClick={refresh} />}>
    {failed && <ContentError error="Some dashboard data could not be loaded." retry={refresh} />}
    <section className="admin-overview-banner">
      <ShieldCheck size={25} aria-hidden="true" /><div><h2>Platform operations</h2><p>Review the current queue or run a dated report.</p></div>
      <Link className="button button--lime button--small" to="/admin/reports">Open reports</Link>
    </section>
    <WorkspacePanel title="Needs attention">
      <div className="admin-queues">{queues.map(({ name, count, to, loading, Icon }) => <Link key={to} to={to}
        data-has-work={typeof count === 'number' && count > 0}>
        <Icon size={19} aria-hidden="true" /><span>{name}</span><strong>{loading ? 'Loading' : count ?? 'Unavailable'}</strong>
      </Link>)}</div>
    </WorkspacePanel>
    <div className="admin-chart-grid">
      <WorkspacePanel title="Active bookings" action={<Link className="text-link" to="/admin/bookings">View bookings</Link>}>
        <AdminData resource={bookings} label="booking distribution">{rows => <>
          <AdminMetrics values={ [['Active', rows.length], ['Pending', pending], ['Confirmed', confirmed]] } />
          {availableRows > 0 && <div className="admin-distribution" aria-label={'Booking distribution: ' + pending + ' pending, ' + confirmed + ' confirmed'} role="img">
            {pending > 0 && <span title="Pending" style={{ width: pending / availableRows * 100 + '%' }} />}
            {confirmed > 0 && <span title="Confirmed" style={{ width: confirmed / availableRows * 100 + '%' }} />}
          </div>}
          {rows.length > 0 && <AdminTable label="Current reservations" columns={['Court', 'Booking date', 'Status']}
            rows={rows.slice(0, 4).map(row => [row.courtName, row.bookingDate, <WorkspaceStatus status={row.status} />])} />}
        </>}</AdminData>
      </WorkspacePanel>
      <div className="player-page">
        <WorkspacePanel title="Reported booking amounts" description={'Confirmed ' + from + ' to ' + to}
          action={<Link className="text-link" to="/admin/payments">View summaries</Link>}>
          <AdminData resource={payments} label="booking amounts">{rows => <AdminMetrics values={[
            ['Reported value', priceLabel(rows.reduce((total, row) => total + row.amountPaid, 0))], ['Bookings', rows.length],
          ]} />}</AdminData>
        </WorkspacePanel>
        <WorkspacePanel title="Document decisions today" action={<Link className="text-link" to="/admin/verification">Open review queue</Link>}>
          <AdminData resource={stats} label="document decisions">{value => <AdminMetrics
            values={['approvedToday', 'rejectedToday'].map(key => [statusLabel(key.replace('Today', ' today')), value[key as 'approvedToday' | 'rejectedToday']])} />}</AdminData>
        </WorkspacePanel>
      </div>
    </div>
    <WorkspacePanel title="Recent notifications" action={<Link className="text-link" to="/admin/notifications">Open inbox</Link>}>
      <NotificationList limit={4} />
    </WorkspacePanel>
  </AdminPage>
}

export default function AdminWorkspace() {
  const { session } = useSession()
  const { pathname, search } = useLocation()
  if (!session) return <Navigate replace to={'/login?' + new URLSearchParams({ role: 'ADMIN', returnTo: pathname + search })} />
  if (session.role !== 'ADMIN') return <Navigate to="/workspace" replace />
  const title = groups.flatMap(group => group.links).find(link => link.to === pathname.replace(/\/$/, ''))?.label ?? 'Administrator workspace'
  return <NotificationsProvider key={session.userId} userId={session.userId}>
    <WorkspaceShell session={session} roleLabel="Administrator" root="/admin" groups={groups} title={title} accountPath="/admin/notifications">
      <Suspense fallback={<Skeleton label="Loading administrator report" />}>
        <Routes>
          <Route index element={<AdminOverview />} />
          <Route path="managers" element={<AdminManagers />} />
          <Route path="verification" element={<AdminVerification />} />
          <Route path="accounts" element={<AdminAccounts />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="disputes" element={<AdminDisputes />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="email-delivery" element={<AdminDelivery />} />
          <Route path="backups" element={<AdminBackups />} />
          <Route path="notifications" element={<NotificationInbox description="Administrative tasks and Courtly system updates." />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Suspense>
    </WorkspaceShell>
  </NotificationsProvider>
}
