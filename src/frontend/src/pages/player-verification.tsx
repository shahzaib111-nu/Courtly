import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FileCheck2, FileText, ShieldCheck, UploadCloud, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PlayerEmpty } from '../components/player-booking-ui'
import { usePlayer } from '../components/player-layout'
import { failureMessage, PlayerHeading, statusLabel, WorkspacePanel, WorkspaceStatus } from '../components/player-workspace-ui'
import { ContentError, Message, Skeleton, Toast } from '../components/ui'
import { accountApi } from '../lib/api'
import { formatTimestamp } from '../lib/booking-time'
import type { DocumentType } from '../lib/contracts'
import { useNotifications } from '../lib/notifications'
import { useResource } from '../lib/use-resource'

const documents: Record<DocumentType, string> = { STUDENT_ID: 'Student ID', SENIOR_CARD: 'Senior card', FAMILY_CARD: 'Family card' }
const maxBytes = 5 * 1024 * 1024

function fileProblem(file: File) {
  if (!file.size) return 'The selected file is empty.'
  if (file.size > maxBytes) return 'Choose a file no larger than 5 MB.'
  if (!/\.(jpe?g|png|pdf)$/i.test(file.name)) return 'Choose a JPG, JPEG, PNG, or PDF document.'
  return ''
}

export function PlayerVerification() {
  const { email } = usePlayer()
  const { refresh } = useNotifications()
  const profile = useResource(useCallback((signal: AbortSignal) => accountApi.profile(email, signal), [email]))
  const history = useResource(useCallback((signal: AbortSignal) => accountApi.documents(email, signal), [email]))
  const [type, setType] = useState<DocumentType>('STUDENT_ID')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const pending = useRef(false)
  const interacted = useRef(false)
  const category = profile.data?.category
  useEffect(() => {
    if (interacted.current) return
    if (category === 'SENIOR') setType('SENIOR_CARD')
    if (category === 'FAMILY') setType('FAMILY_CARD')
  }, [category])

  function selectFile(file?: File) {
    if (!file) return
    const issue = fileProblem(file)
    setFile(issue ? null : file)
    setError(issue)
    if (input.current) input.current.value = ''
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || !file || !profile.data) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await accountApi.upload(profile.data.email, type, file)
      setFile(null)
      setToast('Document submitted for review.')
      history.retry()
      profile.retry()
      refresh()
    } catch (failure) {
      setError(failureMessage(failure, 'The document could not be uploaded.'))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const sorted = [...(history.data ?? [])].sort((left, right) => Date.parse(right.uploadDate) - Date.parse(left.uploadDate))
  return <div className="player-page">
    <PlayerHeading title="Discount verification" description="Submit an eligibility document and follow its review." />
    <section className="verification-summary" aria-label="Current verification details">
      <span className="verification-shield"><ShieldCheck size={26} aria-hidden="true" /></span>
      {profile.loading ? <Skeleton label="Loading discount tier" count={1} />
        : profile.error ? <ContentError error={profile.error} retry={profile.retry} />
        : <>
          <div className="workspace-fact"><span>Player category</span><strong>{category ? statusLabel(category) : 'Unavailable'}</strong></div>
          <div className="workspace-fact"><span>Verified discount tier</span><strong>{profile.data ? statusLabel(profile.data.discountTier) : 'Unavailable'}</strong></div>
          <Link className="text-link" to="/player/settings">Manage category</Link>
        </>}
    </section>
    <div className="workspace-split">
      <WorkspacePanel title="Upload a document" description="Choose a document that shows your eligibility.">
        <form onSubmit={submit} className="workspace-form">
          <div className="field"><label htmlFor="verification-type">Document type</label>
            <select id="verification-type" value={type} disabled={busy} onChange={event => {
              interacted.current = true
              setType(event.target.value as DocumentType)
            }}>
              {Object.entries(documents).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className={'verification-drop' + (dragging ? ' verification-drop--active' : '')}
            onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={event => {
              event.preventDefault()
              setDragging(false)
              if (busy) return
              if (event.dataTransfer.files.length > 1) {
                setFile(null)
                setError('Choose one document per upload.')
              } else selectFile(event.dataTransfer.files[0])
            }}>
            <UploadCloud size={27} aria-hidden="true" /><strong>Drop your document here</strong>
            <span>JPG, JPEG, PNG or PDF · up to 5 MB</span>
            <input ref={input} type="file" hidden accept=".jpg,.jpeg,.png,.pdf" aria-label="Verification document"
              onChange={event => selectFile(event.target.files?.[0])} />
            <button type="button" className="button button--outline button--small" disabled={busy} onClick={() => input.current?.click()}>Choose file</button>
          </div>
          {file && <div className="workspace-context verification-file"><FileCheck2 size={20} aria-hidden="true" />
            <div><strong>{file.name}</strong><p>{new Intl.NumberFormat('en-PK', { maximumFractionDigits: 1 }).format(file.size / 1024)} KB</p></div>
            <button type="button" className="icon-button" aria-label="Remove selected document" disabled={busy} onClick={() => { setFile(null); setError('') }}><X size={17} /></button>
          </div>}
          {error && <Message>{error}</Message>}
          <button type="submit" className="button button--primary" disabled={busy || !file || !profile.data}>{busy ? 'Uploading…' : 'Submit for review'}</button>
        </form>
      </WorkspacePanel>
      <WorkspacePanel title="Verification history" action={<button type="button" className="button button--outline button--small" onClick={() => { history.retry(); profile.retry() }}>Refresh</button>}>
        {history.loading ? <Skeleton label="Loading verification history" count={2} />
          : history.error ? <ContentError error={history.error} retry={history.retry} />
          : sorted.length ? <ul className="workspace-records">{sorted.map(record => <li key={record.docID}>
            <span className="booking-icon"><FileText size={18} aria-hidden="true" /></span>
            <div className="workspace-record-copy"><h3>{documents[record.docType] ?? 'Eligibility document'}</h3>
              <p>Submitted {formatTimestamp(record.uploadDate)}</p>
              {record.reviewedAt && <p>Reviewed {formatTimestamp(record.reviewedAt)}</p>}
              {record.status === 'REJECTED' && <p className="record-dispute">{record.rejectionReason && <>{record.rejectionReason} </>}
                Choose the same document type to submit a corrected file.</p>}
            </div><WorkspaceStatus status={record.status} />
          </li>)}</ul> : <PlayerEmpty title="No documents submitted" detail="Your verification requests and decisions will appear here." />}
      </WorkspacePanel>
    </div>
    {toast && <Toast onClose={() => setToast('')}>{toast}</Toast>}
  </div>
}
