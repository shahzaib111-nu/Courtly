import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Inbox, RefreshCw } from 'lucide-react'
import { failureMessage } from './player-workspace-ui'
import { ContentError, Dialog, Message, Skeleton } from './ui'

export function ManagerEmpty({ title, detail }: { title: string; detail?: string }) {
  return <div className="manager-empty"><Inbox size={21} aria-hidden="true" /><div><h3>{title}</h3>{detail && <p>{detail}</p>}</div></div>
}

export function ManagerData<T>({ resource, label, children }: {
  resource: { data?: T; loading: boolean; error?: string; retry: () => void }
  label: string
  children: (data: T) => ReactNode
}) {
  if (resource.loading) return <Skeleton label={'Loading ' + label} count={2} />
  if (resource.error) return <ContentError error={resource.error} retry={resource.retry} />
  return resource.data === undefined ? <ManagerEmpty title={label + ' unavailable'} /> : children(resource.data)
}

export function ManagerRefresh({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return <button type="button" className="button button--outline button--small" disabled={disabled} onClick={onClick}>
    <RefreshCw size={15} aria-hidden="true" />Refresh
  </button>
}

export function ManagerConfirm({ title, label, description, danger, onClose, onConfirm }: {
  title: string; label: string; description: ReactNode; danger?: boolean; onClose: () => void; onConfirm: () => Promise<void>
}) {
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function confirm() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try { await onConfirm() }
    catch (failure) { setError(failureMessage(failure, 'Courtly could not verify the change. Refresh before retrying.')) }
    finally { pending.current = false; setBusy(false) }
  }
  return <Dialog title={title} onClose={() => { if (!pending.current) onClose() }}>
    <div className="manager-dialog-copy">{description}</div>
    {error && <Message>{error}</Message>}
    <div className="workspace-actions dialog-actions">
      <button type="button" className="button button--outline" onClick={onClose} disabled={busy}>Go back</button>
      <button type="button" className={'button ' + (danger ? 'button--danger' : 'button--primary')} disabled={busy}
        onClick={() => void confirm()}>{busy ? 'Working…' : label}</button>
    </div>
  </Dialog>
}

export const clockPattern = /^([01]\d|2[0-3]):[0-5]\d$/
