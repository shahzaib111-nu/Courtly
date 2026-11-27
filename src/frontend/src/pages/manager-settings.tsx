import { useCallback, useState } from 'react'
import { PasswordForm, ProfileForm } from '../components/account-forms'
import { PlayerHeading, WorkspacePanel, WorkspaceStatus } from '../components/player-workspace-ui'
import { ContentError, Skeleton, Toast } from '../components/ui'
import { accountApi } from '../lib/api'
import { useManager } from '../lib/manager-data'
import { useSession } from '../lib/session'
import { useResource } from '../lib/use-resource'

export function ManagerSettings() {
  const { session, accountStatus } = useManager()
  const { updateIdentity } = useSession()
  const [toast, setToast] = useState('')
  const profile = useResource(useCallback((signal: AbortSignal) => accountApi.profile(session.email, signal), [session.email]))
  return <div className="player-page">
    <PlayerHeading title="Settings" description="Manage your arena manager account and sign-in details." />
    <WorkspacePanel title="Account status">
      <dl className="manager-facts"><div><dt>Role</dt><dd>Arena manager</dd></div>
        <div><dt>Approval</dt><dd><WorkspaceStatus status={accountStatus || profile.data?.accountStatus || 'UNAVAILABLE'} /></dd></div>
      </dl>
    </WorkspacePanel>
    {profile.loading ? <Skeleton label="Loading account settings" />
      : profile.error ? <ContentError error={profile.error} retry={profile.retry} />
      : profile.data && <>
        <ProfileForm profile={profile.data} role="MANAGER" onSave={updated => {
          updateIdentity(session.userId, updated)
          profile.retry()
          setToast('Profile saved.')
        }} />
        <PasswordForm profile={profile.data} onSave={message => { profile.retry(); setToast(message) }} />
      </>}
    {toast && <Toast onClose={() => setToast('')}>{toast}</Toast>}
  </div>
}
