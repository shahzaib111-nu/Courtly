import { useCallback, useEffect, useState } from 'react'
import { FileSearch } from 'lucide-react'
import { AdminData, AdminPage, AdminRefresh, AdminTable, display, matches, SearchFilter, useAdminOperation } from '../components/admin-ui'
import { WorkspacePanel, WorkspaceStatus, statusLabel } from '../components/player-workspace-ui'
import { ContentError, Dialog, Field } from '../components/ui'
import { adminApi } from '../lib/admin-api'
import type { DeletionAccount, DeletionAction, ManagerApplication, ReviewDoc } from '../lib/admin-api'
import { ApiError } from '../lib/api'
import { formatTimestamp, sportLabel } from '../lib/booking-time'
import type { MatchOutcome } from '../lib/contracts'
import { useNotifications } from '../lib/notifications'
import { useResource } from '../lib/use-resource'

function Reason({ required = false }: { required?: boolean }) {
  return <Field name="reason" label={required ? 'Rejection reason' : 'Rejection reason (optional)'}
    required={required} minLength={required ? 5 : undefined} maxLength={255} />
}

export function AdminManagers() {
  const resource = useResource(adminApi.managers)
  const { refresh } = useNotifications()
  const operations = useAdminOperation(() => { resource.retry(); refresh() })
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ManagerApplication>()
  return <AdminPage title="Manager approvals" description="Review applications for arena manager access."
    action={<AdminRefresh disabled={resource.loading} onClick={resource.retry} />}>
    <WorkspacePanel title="Pending applications">
      <SearchFilter value={search} change={setSearch} label="Search applications" />
      <AdminData resource={resource} label="applications">{rows => <AdminTable label="Pending applications"
        columns={['Applicant', 'Email', 'Phone', 'Decision']}
        rows={rows.filter(row => matches(search, row.name, row.email, row.phone)).map(row => [
          row.name, row.email, display(row.phone), <div className="admin-actions">
            <button className="text-link" type="button" onClick={() => setSelected(row)}>Details</button>
            {(['APPROVE', 'REJECT'] as const).map(action => <button key={action} className="text-link" type="button"
              onClick={() => operations.open({ title: statusLabel(action) + ' manager?', action: statusLabel(action),
                description: <><strong>{row.name}</strong><p>{row.email} · {display(row.phone)}</p><p>Date of birth {display(row.dateOfBirth)}</p></>,
                danger: action === 'REJECT', fields: action === 'REJECT' ? <Reason /> : undefined,
                run: async data => {
                  const reason = String(data.get('reason') ?? '').trim()
                  await adminApi.managerDecision(row.userID, action, reason || undefined)
                  return action === 'APPROVE' ? 'Manager approved.' : 'Application rejected.'
                },
              })}>{statusLabel(action)}</button>)}
          </div>,
        ])} />}</AdminData>
    </WorkspacePanel>
    {selected && <Dialog title="Application details" onClose={() => setSelected(undefined)}>
      <dl className="admin-metrics">
        <div><dt>Applicant</dt><dd>{selected.name}</dd></div>
        <div><dt>Email</dt><dd>{selected.email}</dd></div>
        <div><dt>Phone</dt><dd>{display(selected.phone)}</dd></div>
        <div><dt>Date of birth</dt><dd>{display(selected.dateOfBirth)}</dd></div>
      </dl>
    </Dialog>}
    {operations.overlay}
  </AdminPage>
}

const previewTypes = ['application/pdf', 'image/png', 'image/jpeg']

function DocumentPreview({ id }: { id: string }) {
  const resource = useResource(useCallback((signal: AbortSignal) => adminApi.preview(id, signal), [id]))
  const [preview, setPreview] = useState<{ blob: Blob; url: string }>()
  const blob = resource.data
  useEffect(() => {
    if (!blob || !previewTypes.includes(blob.type)) return
    const url = URL.createObjectURL(blob)
    setPreview({ blob, url })
    return () => URL.revokeObjectURL(url)
  }, [blob])
  return <AdminData resource={resource} label="protected document">{file => {
    if (!previewTypes.includes(file.type)) return <p role="alert">This file format cannot be previewed.</p>
    if (preview?.blob !== file) return <p role="status">Preparing preview…</p>
    return file.type === 'application/pdf'
      ? <object className="admin-preview" data={preview.url} type="application/pdf" aria-label="Verification PDF">
        <p>This browser could not display the PDF preview.</p>
      </object>
      : <img className="admin-preview" src={preview.url} alt="Submitted verification document" />
  }}</AdminData>
}

export function AdminVerification() {
  const resource = useResource(adminApi.documents)
  const stats = useResource(adminApi.statistics)
  const [doc, setDoc] = useState<ReviewDoc>()
  const { refresh } = useNotifications()
  const reload = () => { resource.retry(); stats.retry() }
  const operations = useAdminOperation(() => { setDoc(undefined); reload(); refresh() })
  const decide = (item: ReviewDoc, decision: 'APPROVED' | 'REJECTED') => {
    const reject = decision === 'REJECTED'
    operations.open({ title: reject ? 'Reject document?' : 'Approve document?', action: reject ? 'Reject' : 'Approve', danger: reject,
      description: <p>{statusLabel(item.docType)} for <strong>{item.applicant || item.email}</strong></p>,
      fields: reject ? <Reason required /> : undefined,
      run: async data => {
        const reason = String(data.get('reason') ?? '').trim()
        if (reject && (reason.length < 5 || reason.length > 255)) throw new ApiError('Enter a rejection reason of 5–255 characters.')
        await adminApi.review(item.docID, decision, reject ? reason : undefined)
        return reject ? 'Document rejected.' : 'Document approved.'
      },
    })
  }
  return <AdminPage title="Document verification" description="Review submitted proof for verified discounts."
    action={<AdminRefresh onClick={reload} disabled={resource.loading || stats.loading} />}>
    {stats.data && <div className="admin-strip"><span>{stats.data.pendingCount} pending</span><span>{stats.data.approvedToday} approved today</span><span>{stats.data.rejectedToday} rejected today</span></div>}
    {stats.error && <ContentError error={stats.error} retry={stats.retry} />}
    <div className="admin-review">
      <WorkspacePanel title="Pending documents">
        <AdminData resource={resource} label="pending documents">{rows => rows.length ? <ul className="admin-review-list">{rows.map(item =>
          <li key={item.docID}><button type="button" aria-pressed={doc?.docID === item.docID} onClick={() => setDoc(item)}>
            <FileSearch size={19} aria-hidden="true" /><span><strong>{item.applicant || 'Applicant'}</strong>
              <small>{statusLabel(item.docType)} · {formatTimestamp(item.uploadDate)}</small></span>
          </button></li>)}</ul> : <p>No documents are awaiting review.</p>}</AdminData>
      </WorkspacePanel>
      <WorkspacePanel title="Document preview" description={doc ? doc.email : 'Select a document from the queue.'}
        action={doc && <button type="button" className="text-link" onClick={() => setDoc(undefined)}>Close preview</button>}>
        {doc && <><div className="admin-strip"><WorkspaceStatus status={doc.status} /><span>{statusLabel(doc.docType)}</span></div>
          <DocumentPreview key={doc.docID} id={doc.docID} />
          <div className="admin-actions">
            <button type="button" className="button button--primary" onClick={() => decide(doc, 'APPROVED')}>Approve document</button>
            <button type="button" className="button button--outline" onClick={() => decide(doc, 'REJECTED')}>Reject document</button>
          </div>
        </>}
      </WorkspacePanel>
    </div>
    {operations.overlay}
  </AdminPage>
}

const accountActions = {
  DELETE_NOW: ['Delete now', 'Permanently deletes the account and its stored verification documents.'],
  ARCHIVE: ['Archive account', 'Keeps the account in the archive. It can be restored from the archive list.'],
  CANCEL: ['Cancel deletion', 'Clears the deletion request and returns the account to active use.'],
}

export function AdminAccounts() {
  const pending = useResource(adminApi.deletions)
  const archive = useResource(adminApi.archive)
  const [archived, setArchived] = useState(false)
  const [search, setSearch] = useState('')
  const resource = archived ? archive : pending
  const refresh = () => { pending.retry(); archive.retry() }
  const operations = useAdminOperation(refresh)
  const act = (row: DeletionAccount, action: DeletionAction) => {
    const [title, explanation] = accountActions[action]
    const label = archived ? 'Restore account' : title
    operations.open({ title: label + '?', action: label, danger: action === 'DELETE_NOW',
      description: <><strong>{row.name || row.email}</strong><p>{explanation}</p></>,
      run: async () => { await adminApi.processAccount(row.email, action); return label + ' completed.' },
    })
  }
  return <AdminPage title="Account requests" description="Manage deletion requests and archived accounts." action={<AdminRefresh onClick={refresh} />}>
    <WorkspacePanel title={archived ? 'Archived accounts' : 'Pending deletion requests'}>
      <div className="admin-actions" aria-label="Account queue">
        <button className="booking-filter" type="button" aria-pressed={!archived} onClick={() => setArchived(false)}>Pending</button>
        <button className="booking-filter" type="button" aria-pressed={archived} onClick={() => setArchived(true)}>Archived</button>
      </div>
      <SearchFilter value={search} change={setSearch} label="Search accounts" />
      <AdminData resource={resource} label="account requests">{rows => <AdminTable label="Account requests"
        columns={['Account', 'Requested', ...(archived ? [] : ['Grace period']), 'Actions']}
        rows={rows.filter(row => matches(search, row.name, row.email)).map(row => [
          <>{display(row.name)}<small>{row.email}</small></>, formatTimestamp(row.deletionRequestedAt),
          ...(archived ? [] : [row.daysRemaining == null ? '—' : row.daysRemaining + ' days remaining']),
          <div className="admin-actions">{(archived ? ['CANCEL'] as const : ['ARCHIVE', 'CANCEL', 'DELETE_NOW'] as const).map(action =>
            <button key={action} type="button" className="text-link" onClick={() => act(row, action)}>
              {archived ? 'Restore account' : accountActions[action][0]}
            </button>)}</div>,
        ])} />}</AdminData>
    </WorkspacePanel>{operations.overlay}
  </AdminPage>
}

export function AdminDisputes() {
  const resource = useResource(adminApi.disputes)
  const operations = useAdminOperation(resource.retry)
  return <AdminPage title="Match disputes" description="Review conflicting scores and record the final result."
    action={<AdminRefresh onClick={resource.retry} disabled={resource.loading} />}>
    <WorkspacePanel title="Outstanding disputes">
      <AdminData resource={resource} label="disputes">{rows => <AdminTable label="Outstanding disputes"
        columns={['Player and opponent', 'Court and slot', 'Submitted result', 'Dispute reason', 'Action']}
        rows={rows.map(item => [
          <>{display(item.playerName)}<small>vs. {item.opponentName}</small></>,
          <>{display(item.courtName)}<small>{sportLabel(item.sportType ?? '')} · {item.bookingDate} · {item.timeSlot}</small></>,
          item.playerScore + '–' + item.opponentScore + ' · ' + statusLabel(item.result), display(item.disputeReason),
          <button type="button" className="text-link" onClick={() => operations.open({
            title: 'Resolve match dispute?', action: 'Record resolution',
            description: <p>{item.playerName} vs. {item.opponentName}. Courtly applies ranking points when the decision is recorded.</p>,
            fields: <>
              <div className="workspace-field-grid">
                <Field name="player" type="number" label="Corrected player score" defaultValue={item.playerScore} min={0} max={999} required />
                <Field name="opponent" type="number" label="Corrected opponent score" defaultValue={item.opponentScore} min={0} max={999} required />
              </div>
              <label className="field"><span>Corrected result</span><select name="result" defaultValue={item.result}>
                <option value="WIN">Win</option><option value="LOSS">Loss</option><option value="DRAW">Draw</option>
              </select></label>
            </>,
            run: async data => {
              const player = Number(data.get('player'))
              const opponent = Number(data.get('opponent'))
              const result = String(data.get('result')) as MatchOutcome
              const expected = player === opponent ? 'DRAW' : player > opponent ? 'WIN' : 'LOSS'
              if (expected !== result || [player, opponent].some(score => !Number.isInteger(score) || score < 0 || score > 999))
                throw new ApiError('Enter valid scores and a result that agrees with them.')
              const saved = await adminApi.resolve(item.matchID, player, opponent, result)
              if (saved.status !== 'RESOLVED') throw new ApiError('Courtly could not verify the recorded resolution.')
              return 'Dispute resolved. Points awarded by Courtly ' + saved.pointsEarned + '.'
            },
          })}>Resolve</button>,
        ])} />}</AdminData>
    </WorkspacePanel>{operations.overlay}
  </AdminPage>
}
