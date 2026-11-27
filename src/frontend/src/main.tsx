import { lazy, StrictMode, Suspense, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import { SiteShell } from './components/site-shell'
import { SessionProvider, useSession } from './lib/session'
import { LoginPage, OAuthCallbackPage, RecoveryPage, RegisterPage } from './pages/auth'
import { CourtsPage, FacilitiesPage, FacilityPage, LandingPage } from './pages/discovery'
import { PlayerGuard } from './components/player-layout'
import { PlayerOverview } from './pages/player-overview'
import { PlayerCourts } from './pages/player-courts'
import { PlayerBookings } from './pages/player-bookings'
import { PlayerPayments, PlayerReceipt } from './pages/player-payments'
import { PlayerNotifications } from './components/player-notifications'
import { checkoutLink } from './lib/booking-time'
import { Skeleton } from './components/ui'
import './styles.css'
import './player.css'
import './player-workspace.css'

const PlayerCheckout = lazy(() => import('./pages/player-checkout').then(module => ({ default: module.PlayerCheckout })))
const PlayerLeaderboard = lazy(() => import('./pages/player-leaderboard').then(module => ({ default: module.PlayerLeaderboard })))
const PlayerResults = lazy(() => import('./pages/player-results').then(module => ({ default: module.PlayerResults })))
const PlayerSettings = lazy(() => import('./pages/player-settings').then(module => ({ default: module.PlayerSettings })))
const PlayerVerification = lazy(() => import('./pages/player-verification').then(module => ({ default: module.PlayerVerification })))
const AdminWorkspace = lazy(() => import('./pages/admin-workspace'))

const managerWorkspace = () => import('./pages/manager-workspace')
const ManagerGuard = lazy(() => managerWorkspace().then(module => ({ default: module.ManagerGuard })))
const ManagerOverview = lazy(() => managerWorkspace().then(module => ({ default: module.ManagerOverview })))
const ManagerFacility = lazy(() => managerWorkspace().then(module => ({ default: module.ManagerFacility })))
const ManagerCourts = lazy(() => managerWorkspace().then(module => ({ default: module.ManagerCourts })))
const ManagerMaintenance = lazy(() => managerWorkspace().then(module => ({ default: module.ManagerMaintenance })))
const ManagerBookings = lazy(() => managerWorkspace().then(module => ({ default: module.ManagerBookings })))
const ManagerNotifications = lazy(() => managerWorkspace().then(module => ({ default: module.ManagerNotifications })))
const ManagerSettings = lazy(() => managerWorkspace().then(module => ({ default: module.ManagerSettings })))

function RouteScroll() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (pathname === '/oauth-callback' || pathname === '/oauth-callback.html') return
    const frame = requestAnimationFrame(() => {
      const target = hash && document.getElementById(hash.slice(1))
      if (target) target.scrollIntoView()
      else window.scrollTo(0, 0)
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname, hash])
  return null
}

function Workspace() {
  const { session } = useSession()
  const { search } = useLocation()
  if (!session) {
    const returnTo = '/workspace' + search
    return <Navigate to={'/login?' + new URLSearchParams({ returnTo })} replace />
  }
  if (session.role === 'MANAGER') return <Navigate to="/manager" replace />
  if (session.role === 'ADMIN') return <Navigate to="/admin" replace />
  const params = new URLSearchParams(search)
  const hasBookingFilters = ['sport', 'facility', 'court', 'date', 'slot'].some(key => params.has(key))
  return <Navigate to={hasBookingFilters ? '/player/courts' + search : '/player'} replace />
}

function PlayerCompatibilityRoute({ page }: { page: 'dashboard' | 'checkout' | 'verification' }) {
  const { search } = useLocation()
  const query = new URLSearchParams(search)
  const bookingID = query.get('bookingID')
  if (page === 'checkout') return <Navigate replace to={bookingID ? checkoutLink(bookingID, query.get('receipt') === '1') : '/player/bookings'} />
  if (page === 'verification') return <Navigate replace to="/player/verification" />
  const section = query.get('section') ?? ''
  const sections = ['payments', 'matches', 'leaderboard', 'ratings', 'notifications', 'settings', 'bookings', 'verification']
  if (sections.includes(section)) return <Navigate replace to={'/player/' + section} />
  if (['sport', 'facility', 'court', 'date', 'slot'].some(key => query.has(key))) return <Navigate replace to={'/player/courts' + search} />
  return <Navigate replace to="/player" />
}

const bookmarkRoutes = ['index', 'dashboard', 'facility-manager', 'admin', 'checkout', 'verification', 'oauth-callback']

function LegacyBookmark({ page }: { page: string }) {
  const { search, hash } = useLocation()
  return <Navigate replace to={{ pathname: `/${page}.html`, search, hash }} />
}

function App() {
  const { pathname } = useLocation()
  return <>
    <RouteScroll />
    <Routes>
      <Route element={<SiteShell />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/courts" element={<CourtsPage />} />
        <Route path="/facilities" element={<FacilitiesPage />} />
        <Route path="/facilities/:facilityId" element={<FacilityPage />} />
        <Route path="*" element={<div className="container subpage page-heading">
          <h1>Page not found.</h1><Link to="/" className="text-link">Return to Courtly</Link>
        </div>} />
      </Route>
      <Route path="/index.html" element={<Navigate to="/" replace />} />
      <Route path="/login" element={<LoginPage key={pathname} />} />
      <Route path="/register" element={<RegisterPage key={pathname} />} />
      <Route path="/forgot-password" element={<RecoveryPage />} />
      <Route path="/oauth-callback" element={<OAuthCallbackPage />} />
      <Route path="/oauth-callback.html" element={<OAuthCallbackPage />} />
      <Route path="/player" element={<PlayerGuard />}>
        <Route index element={<PlayerOverview />} />
        <Route path="courts" element={<PlayerCourts />} />
        <Route path="bookings" element={<PlayerBookings />} />
        <Route path="checkout/:bookingID" element={<Suspense fallback={<Skeleton label="Loading checkout" />}><PlayerCheckout /></Suspense>} />
        <Route path="payments" element={<PlayerPayments />} />
        <Route path="payments/:bookingID" element={<PlayerReceipt />} />
        <Route path="matches" element={<Suspense fallback={<Skeleton label="Loading match results" />}><PlayerResults key="matches" /></Suspense>} />
        <Route path="leaderboard" element={<Suspense fallback={<Skeleton label="Loading leaderboard" />}><PlayerLeaderboard /></Suspense>} />
        <Route path="ratings" element={<Suspense fallback={<Skeleton label="Loading ratings" />}><PlayerResults key="ratings" rating /></Suspense>} />
        <Route path="verification" element={<Suspense fallback={<Skeleton label="Loading verification" />}><PlayerVerification /></Suspense>} />
        <Route path="notifications" element={<PlayerNotifications />} />
        <Route path="settings" element={<Suspense fallback={<Skeleton label="Loading settings" />}><PlayerSettings /></Suspense>} />
      </Route>
      <Route path="/manager" element={<Suspense fallback={<Skeleton label="Loading manager workspace" count={2} />}><ManagerGuard /></Suspense>}>
        <Route index element={<ManagerOverview />} />
        <Route path="facility" element={<ManagerFacility />} />
        <Route path="courts" element={<ManagerCourts />} />
        <Route path="maintenance" element={<ManagerMaintenance />} />
        <Route path="bookings" element={<ManagerBookings />} />
        <Route path="notifications" element={<ManagerNotifications />} />
        <Route path="settings" element={<ManagerSettings />} />
      </Route>
      <Route path="/workspace" element={<Workspace />} />
      <Route path="/admin/*" element={<Suspense fallback={<Skeleton label="Loading administrator workspace" />}><AdminWorkspace /></Suspense>} />
      <Route path="/dashboard.html" element={<PlayerCompatibilityRoute page="dashboard" />} />
      <Route path="/facility-manager.html" element={<Navigate to="/manager" replace />} />
      <Route path="/admin.html" element={<Navigate to="/admin" replace />} />
      <Route path="/checkout.html" element={<PlayerCompatibilityRoute page="checkout" />} />
      <Route path="/verification.html" element={<PlayerCompatibilityRoute page="verification" />} />
      {bookmarkRoutes.map(page => <Route key={page} path={`/legacy/${page}.html`} element={<LegacyBookmark page={page} />} />)}
    </Routes>
  </>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter><SessionProvider><App /></SessionProvider></BrowserRouter>
  </StrictMode>,
)
