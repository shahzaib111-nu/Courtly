import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Dialog, Field, Message, Toast } from './ui'
import { failureMessage, PlayerHeading } from './player-workspace-ui'
import { ManagerEmpty } from './manager-ui'

export { ManagerData as AdminData, ManagerRefresh as AdminRefresh } from './manager-ui'

export function AdminPage({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return <div className="player-page"><PlayerHeading title={title} description={description} action={action} />{children}</div>
}

export function AdminTable({ columns, rows, label }: { columns: string[]; rows: ReactNode[][]; label: string }) {
  if (!rows.length) return <ManagerEmpty title="No matching records" detail="Try a different filter or refresh for updates." />
  return <div className="workspace-table-wrap admin-table-wrap" tabIndex={0} aria-label={label}>
    <table className="workspace-table admin-table"><thead><tr>
      {columns.map(name => <th key={name} scope="col">{name}</th>)}
    </tr></thead><tbody>
      {rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) =>
        index === 0 ? <th key={index} scope="row">{cell}</th> : <td key={index}>{cell}</td>)}</tr>)}
    </tbody></table>
  </div>
}

export function AdminMetrics({ values }: { values: [string, ReactNode][] }) {
  return <dl className="admin-metrics">{values.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
}

type Operation = {
  title: string
  action: string
  description: ReactNode
  danger?: boolean
  run: (data: FormData) => Promise<string>
  fields?: ReactNode
}

export function useAdminOperation(onSaved: () => void) {
  const [operation, open] = useState<Operation>()
  const [notice, setNotice] = useState('')
  return { open, overlay: <>
    {operation && <OperationDialog operation={operation} close={() => open(undefined)} saved={message => {
      open(undefined)
      setNotice(message)
      onSaved()
    }} />}
    {notice && <Toast onClose={() => setNotice('')}>{notice}</Toast>}
  </> }
}

function OperationDialog({ operation, close, saved }: { operation: Operation; close: () => void; saved: (message: string) => void }) {
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <Dialog title={operation.title} onClose={() => { if (!pending.current) close() }}>
    <form className="workspace-form" onSubmit={async event => {
      event.preventDefault()
      if (pending.current) return
      pending.current = true
      setBusy(true)
      setError('')
      const data = new FormData(event.currentTarget)
      try { saved(await operation.run(data)) }
      catch (failure) { setError(failureMessage(failure, 'Courtly could not complete this action.')) }
      finally { pending.current = false; setBusy(false) }
    }}>
      <div className="admin-dialog-copy">{operation.description}</div>
      {operation.fields}
      {error && <Message>{error}</Message>}
      <div className="workspace-actions dialog-actions">
        <button type="button" className="button button--outline" onClick={close} disabled={busy}>Go back</button>
        <button type="submit" className={'button ' + (operation.danger ? 'button--danger' : 'button--primary')} disabled={busy}>
          {busy ? 'Working…' : operation.action}
        </button>
      </div>
    </form>
  </Dialog>
}

export function FilterSelect({ label, value, values, change, emptyLabel, format = value => value }: {
  label: string; value: string; values: string[]; change: (value: string) => void; emptyLabel?: string; format?: (value: string) => string
}) {
  const id = useId()
  return <div className="field"><label htmlFor={id}>{label}</label>
    <select id={id} value={value} onChange={event => change(event.target.value)}>
      {emptyLabel && <option value="">{emptyLabel}</option>}
      {values.map(option => <option key={option} value={option}>{format(option)}</option>)}
    </select>
  </div>
}

export function SearchFilter({ value, change, label = 'Search' }: { value: string; change: (value: string) => void; label?: string }) {
  return <Field label={label} type="search" value={value} onChange={event => change(event.target.value)} />
}

export const display = (value: string | null | undefined) => value || '—'
export function matches(query: string, ...values: string[]) {
  return values.some(value => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
}
