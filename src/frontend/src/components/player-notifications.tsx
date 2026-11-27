import { useRef, useState } from 'react'
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatTimestamp } from '../lib/booking-time'
import { useNotifications } from '../lib/notifications'
import type { PlayerNotification } from '../lib/contracts'
import { PlayerEmpty } from './player-booking-ui'
import { PlayerHeading, WorkspacePanel } from './player-workspace-ui'
import { ContentError, Dialog, Skeleton, Toast } from './ui'

type NoticeCopy = (notice: PlayerNotification) => Pick<PlayerNotification, 'title' | 'message'>
const originalCopy: NoticeCopy = notice => notice

export function NotificationList({ limit, actions = false, copy = originalCopy }: { limit?: number; actions?: boolean; copy?: NoticeCopy }) {
  const { snapshot, loading, error, busy, refresh, change } = useNotifications()
  if (loading) return <Skeleton label="Loading notifications" count={2} />
  const items = snapshot?.items.slice(0, limit)
  return <div className="notice-list-wrap">
    {error && <ContentError error={error} retry={refresh} />}
    {items?.length ? <ul className="notice-list">{items.map(item => {
      const { title, message } = copy(item)
      return <li key={item.notificationID} className={item.read ? '' : 'notice-unread'}>
        <span className="booking-icon"><Bell size={17} aria-hidden="true" /></span>
        <div className="notice-copy">
          <h3>{title}{!item.read && <span className="unread-dot" aria-label="Unread" />}</h3>
          <p>{message}</p><time dateTime={item.createdAt}>{formatTimestamp(item.createdAt)}</time>
        </div>
        {actions && <div className="notice-actions">
          {!item.read && <button type="button" className="icon-button" title="Mark as read" aria-label={'Mark as read: ' + title}
            disabled={busy} onClick={() => void change('read', item.notificationID)}><Check size={17} /></button>}
          <button type="button" className="icon-button" title="Delete notification" aria-label={'Delete notification: ' + title}
            disabled={busy} onClick={() => void change('remove', item.notificationID)}><Trash2 size={17} /></button>
        </div>}
      </li>
    })}</ul> : snapshot && <PlayerEmpty title="You’re all caught up" detail="New booking and account updates will appear here." />}
  </div>
}

export function NotificationBell({ inboxPath, copy }: { inboxPath: string; copy?: NoticeCopy }) {
  const { snapshot, refresh } = useNotifications()
  const ref = useRef<HTMLDetailsElement>(null)
  const count = snapshot?.count ?? 0
  return <details ref={ref} className="notice-bell" onToggle={event => { if (event.currentTarget.open) refresh() }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false }}
    onKeyDown={event => {
      if (event.key === 'Escape' && ref.current?.open) {
        ref.current.open = false
        ref.current.querySelector('summary')?.focus()
      }
    }}>
    <summary className="icon-button" aria-label={count ? 'Notifications, ' + count + ' unread' : 'Notifications'}>
      <Bell size={19} aria-hidden="true" />{count > 0 && <span aria-hidden="true">{count > 99 ? '99+' : count}</span>}
    </summary>
    <section className="notice-popover" aria-label="Recent notifications">
      <div className="notice-popover-heading"><h2>Notifications</h2><Link className="text-link" to={inboxPath}
        onClick={() => { if (ref.current) ref.current.open = false }}>Open inbox</Link></div>
      <NotificationList limit={3} actions copy={copy} />
    </section>
  </details>
}

export function NotificationInbox({ description, copy }: { description: string; copy?: NoticeCopy }) {
  const { snapshot, busy, change, refresh } = useNotifications()
  const [clearing, setClearing] = useState(false)
  const [toast, setToast] = useState('')
  const count = snapshot?.count
  return <div className="player-page">
    <PlayerHeading title="Notifications" description={description} />
    <WorkspacePanel title="Inbox" description={count == null ? undefined : count + ' unread'}
      action={<div className="workspace-actions">
        <button type="button" className="button button--outline button--small" onClick={refresh}>Refresh</button>
        <button type="button" className="button button--outline button--small" disabled={!count || busy}
          onClick={() => void change('readAll')}><CheckCheck size={15} />Mark all read</button>
        <button type="button" className="button button--outline button--small" disabled={!snapshot?.items.length || busy}
          onClick={() => setClearing(true)}><Trash2 size={15} />Clear inbox</button>
      </div>}>
      <NotificationList actions copy={copy} />
    </WorkspacePanel>
    {clearing && <Dialog title="Clear your inbox?" onClose={() => { if (!busy) setClearing(false) }}>
      <p>This permanently removes every notification in your inbox.</p>
      <div className="workspace-actions dialog-actions">
        <button type="button" className="button button--outline" disabled={busy} onClick={() => setClearing(false)}>Cancel</button>
        <button type="button" className="button button--danger" disabled={busy} onClick={async () => {
          if (await change('clear')) setToast('Inbox cleared.')
          setClearing(false)
        }}>{busy ? 'Clearing…' : 'Clear notifications'}</button>
      </div>
    </Dialog>}
    {toast && <Toast onClose={() => setToast('')}>{toast}</Toast>}
  </div>
}

export function PlayerNotifications() {
  return <NotificationInbox description="Booking, match, and account updates." />
}
