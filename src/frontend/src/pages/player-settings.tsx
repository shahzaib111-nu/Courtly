import { useCallback, useRef, useState } from 'react'
import { PasswordForm, ProfileForm } from '../components/account-forms'
import { usePlayer } from '../components/player-layout'
import { failureMessage, PlayerHeading, WorkspacePanel, WorkspaceStatus } from '../components/player-workspace-ui'
import { ContentError, Dialog, Message, Skeleton, Toast } from '../components/ui'
import { accountApi } from '../lib/api'
import type { AccountProfile } from '../lib/contracts'
import { DELETION_NOTICE_KEY, useSession } from '../lib/session'
import { useResource } from '../lib/use-resource'
export function PlayerSettings() {
  const { userId, email } = usePlayer()
  const { signOutToLogin, updateIdentity } = useSession()
  const profile = useResource(useCallback((signal: AbortSignal) => accountApi.profile(email, signal), [email]))
  const status = useResource(useCallback((signal: AbortSignal) => accountApi.status(userId, signal), [userId]))
  const [toast, setToast] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const deleting = useRef(false)
  const data = profile.data

  async function requestDeletion() {
    if (!data || deleting.current) return
    deleting.current = true
    setBusy(true)
    setError('')
    try {
      await accountApi.requestDeletion(data.email)
      sessionStorage.setItem(DELETION_NOTICE_KEY, '1')
      signOutToLogin()
    } catch (failure) {
      setError(failureMessage(failure, 'Your deletion request could not be submitted.'))
    } finally {
      deleting.current = false
      setBusy(false)
    }
  }

  function refreshAccount(message: string, updated?: AccountProfile) {
    if (updated) updateIdentity(userId, updated)
    profile.retry()
    status.retry()
    setToast(message)
  }

  return <div className="player-page">
    <PlayerHeading title="Settings" description="Manage your profile, sign-in, and Courtly account." />
    {profile.loading ? <Skeleton label="Loading account settings" />
      : profile.error ? <ContentError error={profile.error} retry={profile.retry} />
      : data && <>
        <ProfileForm profile={data} onSave={updated => refreshAccount('Profile saved.', updated)} />
        <PasswordForm profile={data} onSave={message => refreshAccount(message)} />
        <WorkspacePanel title="Account management" className="account-management">
          <div className="workspace-account-status"><span>Account status</span>
            <WorkspaceStatus status={status.data?.accountStatus ?? data.accountStatus ?? 'UNAVAILABLE'} /></div>
          {status.error && <ContentError error={status.error} retry={status.retry} />}
          {data.deletionStatus === 'PENDING' ? <Message kind="success">Your deletion request is pending.</Message>
            : <div className="workspace-danger-row"><div><h3>Request account deletion</h3>
              <p>Submit a deletion request for administrator review and sign out of Courtly.</p></div>
              <button type="button" className="button button--danger button--small" onClick={() => { setError(''); setConfirm(true) }}>Request deletion</button>
            </div>}
        </WorkspacePanel>
      </>}
    {confirm && <Dialog title="Request account deletion?" onClose={() => { if (!busy) setConfirm(false) }}>
      <p>This starts the seven-day grace period and signs you out. Your account will be pending administrator review.</p>
      {error && <Message>{error}</Message>}
      <div className="workspace-actions dialog-actions">
        <button className="button button--outline" type="button" disabled={busy} onClick={() => setConfirm(false)}>Keep my account</button>
        <button className="button button--danger" type="button" disabled={busy} onClick={() => void requestDeletion()}>
          {busy ? 'Submitting…' : 'Request deletion'}
        </button>
      </div>
    </Dialog>}
    {toast && <Toast onClose={() => setToast('')}>{toast}</Toast>}
  </div>
}
