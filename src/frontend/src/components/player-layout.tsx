import { Bell, CalendarDays, CreditCard, House, Medal, Search, Settings, ShieldCheck, Star, Trophy } from 'lucide-react'
import { Navigate, useLocation, useOutletContext } from 'react-router-dom'
import { WorkspaceShell } from './workspace-shell'
import { NotificationsProvider } from '../lib/notifications'
import { useSession } from '../lib/session'
import type { Session } from '../lib/session'
const playLinks = [
  { label: 'Overview', to: '/player', Icon: House, end: true },
  { label: 'Find a Court', to: '/player/courts', Icon: Search },
  { label: 'My Bookings', to: '/player/bookings', Icon: CalendarDays },
  { label: 'Matches', to: '/player/matches', Icon: Trophy },
  { label: 'Leaderboard', to: '/player/leaderboard', Icon: Medal },
  { label: 'Ratings and Feedback', to: '/player/ratings', Icon: Star },
]

const accountLinks = [
  { label: 'Payments', to: '/player/payments', Icon: CreditCard },
  { label: 'Verification', to: '/player/verification', Icon: ShieldCheck },
  { label: 'Notifications', to: '/player/notifications', Icon: Bell },
  { label: 'Settings', to: '/player/settings', Icon: Settings },
]

export function PlayerGuard() {
  const { session } = useSession()
  const { pathname, search } = useLocation()
  if (!session) {
    return <Navigate replace to={'/login?' + new URLSearchParams({ returnTo: pathname + search, role: 'PLAYER' })} />
  }
  if (session.role !== 'PLAYER') return <Navigate to="/workspace" replace />
  const title = [...playLinks, ...accountLinks].find(item => item.to === pathname.replace(/\/$/, ''))?.label ??
    (pathname.startsWith('/player/checkout/') ? 'Checkout' : pathname.startsWith('/player/payments/') ? 'Receipt' : 'Player workspace')
  return <NotificationsProvider key={session.userId} userId={session.userId}>
    <WorkspaceShell session={session} roleLabel="Player" root="/player" title={title}
      groups={[{ label: 'Play', links: playLinks }, { label: 'Account', links: accountLinks }]} />
  </NotificationsProvider>
}

export const usePlayer = () => useOutletContext<Session>()
