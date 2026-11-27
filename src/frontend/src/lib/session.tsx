import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { SESSION_EXPIRED } from './api'
import type { LoginResponse, Role } from './contracts'

const sessionKeys = [
  'jwtToken', 'jwtExpiresIn', 'userRole', 'playerID', 'playerEmail',
  'playerName', 'accountStatus', 'authProvider', 'lastActivity',
]
const inactivityLimit = 30 * 60 * 1000
export const DELETION_NOTICE_KEY = 'courtly:deletion-requested'

export interface Session {
  role: Role
  userId: string
  email: string
  name: string
  accountStatus: string
  expiresAt: number
}

interface SessionValue {
  session: Session | null
  signIn: (response: LoginResponse) => void
  signOut: () => void
  signOutToLogin: () => void
  updateIdentity: (userId: string, profile: { name: string; email: string; accountStatus: string | null }) => void
}

const SessionContext = createContext<SessionValue | null>(null)
const paymentAttemptPrefix = 'courtly:payment-attempt:'
export const paymentAttemptKey = (userId: string, bookingID: string) => paymentAttemptPrefix + userId + ':' + bookingID

function clearPaymentAttempts() {
  Object.keys(localStorage).filter(key => key.startsWith(paymentAttemptPrefix)).forEach(key => localStorage.removeItem(key))
}

export function parseRole(value: string | null): Role | null {
  const role = value?.toUpperCase()
  return role === 'PLAYER' || role === 'MANAGER' || role === 'ADMIN' ? role : null
}

function readExpiry(token: string) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(payload))
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : 0
  } catch {
    return 0
  }
}

function readSession(): Session | null {
  const token = localStorage.getItem('jwtToken')
  const role = parseRole(localStorage.getItem('userRole'))
  const email = localStorage.getItem('playerEmail')
  if (!token || !role || !email) return null
  const expiresAt = readExpiry(token)
  const userId = role === 'ADMIN' ? 'ADMIN' : localStorage.getItem('playerID')
  const lastActivity = Number(localStorage.getItem('lastActivity'))
  const idle = lastActivity > 0 && Date.now() - lastActivity >= inactivityLimit
  if (expiresAt <= Date.now() || idle || !userId) return null

  return {
    role, email, userId, expiresAt,
    name: localStorage.getItem('playerName') || '',
    accountStatus: localStorage.getItem('accountStatus') || 'Active',
  }
}

function clearSession() {
  sessionKeys.forEach(key => localStorage.removeItem(key))
  clearPaymentAttempts()
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(readSession)

  function signOut() {
    clearSession()
    setSession(null)
  }

  function signOutToLogin() {
    clearSession()
    window.location.replace('/login')
  }

  function signIn(response: LoginResponse) {
    const { token, role, playerID, name, email, accountStatus } = response
    if (!response.success || !parseRole(role) || !email || !token || readExpiry(token) <= Date.now()
      || (role !== 'ADMIN' && !playerID)) {
      throw new Error('Courtly received an invalid session. Please sign in again.')
    }
    if (readSession()?.userId !== playerID) clearPaymentAttempts()

    localStorage.removeItem('authProvider')
    localStorage.removeItem('jwtExpiresIn')
    const values = {
      userRole: role.toLowerCase(), playerID: playerID || '', playerEmail: email,
      playerName: name, accountStatus: accountStatus || 'Active',
      lastActivity: String(Date.now()), jwtToken: token,
    }
    Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value))
    setSession(readSession())
  }

  function updateIdentity(userId: string, profile: { name: string; email: string; accountStatus: string | null }) {
    const current = readSession()
    if (!current || current.userId !== userId) return
    localStorage.setItem('playerName', profile.name)
    localStorage.setItem('playerEmail', profile.email)
    if (profile.accountStatus) localStorage.setItem('accountStatus', profile.accountStatus)
    setSession(readSession())
  }

  useEffect(() => {
    const refresh = () => setSession(readSession())
    const sync = (event: StorageEvent) => { if (event.key !== 'lastActivity') refresh() }
    const expire = () => {
      clearSession()
      setSession(null)
    }
    if (!readSession() && localStorage.getItem('jwtToken')) expire()
    window.addEventListener('storage', sync)
    window.addEventListener('pageshow', refresh)
    window.addEventListener(SESSION_EXPIRED, expire)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('pageshow', refresh)
      window.removeEventListener(SESSION_EXPIRED, expire)
    }
  }, [])

  useEffect(() => {
    if (!session) return
    const timer = window.setTimeout(() => {
      const current = readSession()
      if (current) setSession(current)
      else {
        clearSession()
        setSession(null)
      }
    }, Math.min(session.expiresAt - Date.now() + 10, 2_147_483_647))
    return () => clearTimeout(timer)
  }, [session])

  const signedIn = session !== null
  useEffect(() => {
    if (!signedIn) return
    const check = () => {
      if (readSession()) return true
      clearSession()
      setSession(null)
      return false
    }
    const activity = () => {
      if (check() && Date.now() - Number(localStorage.getItem('lastActivity')) > 15_000) {
        localStorage.setItem('lastActivity', String(Date.now()))
      }
    }
    const events = ['pointerdown', 'keydown', 'scroll'] as const
    events.forEach(event => window.addEventListener(event, activity, { passive: true }))
    const timer = window.setInterval(check, 30_000)
    return () => {
      events.forEach(event => window.removeEventListener(event, activity))
      window.clearInterval(timer)
    }
  }, [signedIn])

  return <SessionContext.Provider value={{ session, signIn, signOut, signOutToLogin, updateIdentity }}>{children}</SessionContext.Provider>
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('SessionProvider is missing.')
  return value
}

export function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/workspace'
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) return '/workspace'
    const publicPath = url.pathname === '/courts' || url.pathname === '/facilities' || url.pathname.startsWith('/facilities/')
    const playerPath = /^\/player(?:\/(?:courts|bookings|payments|matches|leaderboard|ratings|verification|notifications|settings)|\/(?:checkout|payments)\/[^/]+)?\/?$/.test(url.pathname)
    const managerPath = /^\/manager(?:\/(?:facility|courts|maintenance|bookings|notifications|settings))?\/?$/.test(url.pathname)
    const adminPath = /^\/admin(?:\/(?:managers|verification|accounts|bookings|payments|disputes|reports|email-delivery|backups|notifications))?\/?$/.test(url.pathname)
    if (!publicPath && !playerPath && !managerPath && !adminPath && url.pathname !== '/workspace') {
      return '/workspace'
    }
    return url.pathname + url.search
  } catch {
    return '/workspace'
  }
}
