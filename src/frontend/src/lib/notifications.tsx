import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError, notificationApi } from './api'
import type { PlayerNotification } from './contracts'

interface Snapshot {
  items: PlayerNotification[]
  count: number
}

interface NotificationState {
  snapshot: Snapshot | null
  loading: boolean
  error: string
  busy: boolean
  refresh: () => void
  change: (action: 'read' | 'remove' | 'readAll' | 'clear', id?: string) => Promise<boolean>
}

const NotificationsContext = createContext<NotificationState | null>(null)

export function NotificationsProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef<AbortController | null>(null)
  const mutating = useRef(false)
  const mounted = useRef(false)

  const refresh = useCallback(() => {
    if (pending.current || mutating.current || !mounted.current) return
    const request = new AbortController()
    pending.current = request
    Promise.all([notificationApi.list(userId, request.signal), notificationApi.unread(userId, request.signal)])
      .then(([items, unread]) => {
        if (request.signal.aborted) return
        setSnapshot({ items, count: unread.count })
        setError('')
      }).catch(failure => {
        if (!request.signal.aborted) setError(failure instanceof ApiError ? failure.message : 'Notifications could not be loaded.')
      }).finally(() => {
        if (pending.current === request) {
          pending.current = null
          setLoading(false)
        }
      })
  }, [userId])

  useEffect(() => {
    mounted.current = true
    refresh()
    const visibleRefresh = () => { if (document.visibilityState === 'visible') refresh() }
    const timer = window.setInterval(visibleRefresh, 60_000)
    document.addEventListener('visibilitychange', visibleRefresh)
    return () => {
      mounted.current = false
      pending.current?.abort()
      pending.current = null
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', visibleRefresh)
    }
  }, [refresh])

  async function change(action: 'read' | 'remove' | 'readAll' | 'clear', id?: string) {
    if (mutating.current || ((action === 'remove' || action === 'read') && !id)) return false
    mutating.current = true
    pending.current?.abort()
    pending.current = null
    setBusy(true)
    setError('')
    let saved = false
    try {
      if (action === 'read' && id) await notificationApi.read(id)
      if (action === 'remove' && id) await notificationApi.remove(id)
      if (action === 'readAll') await notificationApi.readAll(userId)
      if (action === 'clear') await notificationApi.clear(userId)
      if (!mounted.current) return false
      saved = true
      setSnapshot(previous => {
        if (!previous) return null
        const items = action === 'clear' ? [] : action === 'remove'
          ? previous.items.filter(item => item.notificationID !== id)
          : previous.items.map(item => action === 'readAll' || item.notificationID === id ? { ...item, read: true } : item)
        const changedUnread = (action === 'read' || action === 'remove') && previous.items.some(item => item.notificationID === id && !item.read)
        const count = action === 'clear' || action === 'readAll' ? 0 : Math.max(0, previous.count - Number(changedUnread))
        return { items, count }
      })
      return true
    } catch (failure) {
      if (mounted.current) setError(failure instanceof ApiError ? failure.message : 'The notification action could not be completed.')
      return false
    } finally {
      mutating.current = false
      if (mounted.current) {
        setBusy(false)
        setLoading(false)
        if (saved) refresh()
      }
    }
  }

  return <NotificationsContext.Provider value={{ snapshot, loading, error, busy, refresh, change }}>
    {children}
  </NotificationsContext.Provider>
}

export function useNotifications() {
  const state = useContext(NotificationsContext)
  if (!state) throw new Error('NotificationsProvider is missing.')
  return state
}
