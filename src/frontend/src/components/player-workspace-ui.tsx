import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../lib/api'

export function PlayerHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <header className="player-page-heading">
    <div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}
  </header>
}

export function WorkspacePanel({ title, description, action, children, className = '' }: {
  title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string
}) {
  return <section className={'player-panel workspace-panel ' + className}>
    <div className="player-panel-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>
    {children}
  </section>
}

const statusLabels: Record<string, string> = { SUCCESS: 'Paid', VALID: 'Valid', DISPUTED: 'Disputed', RESOLVED: 'Resolved' }

export function statusLabel(status: string) {
  return statusLabels[status] ?? status.toLowerCase().replaceAll('_', ' ').replace(/^./, character => character.toUpperCase())
}

export function WorkspaceStatus({ status }: { status: string }) {
  return <span className={'workspace-status workspace-status--' + status.toLowerCase()}>{statusLabel(status)}</span>
}

export function BackToBookings() {
  return <Link className="button button--outline button--small" to="/player/bookings">My bookings</Link>
}

export function failureMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('') || '?'
}
