import { Medal, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PlayerEmpty } from '../components/player-booking-ui'
import { usePlayer } from '../components/player-layout'
import { initials, PlayerHeading, WorkspacePanel } from '../components/player-workspace-ui'
import { ContentError, Skeleton } from '../components/ui'
import { matchApi } from '../lib/api'
import { useResource } from '../lib/use-resource'

const points = new Intl.NumberFormat('en-PK')

export function PlayerLeaderboard() {
  const { userId } = usePlayer()
  const rankings = useResource(matchApi.leaderboard)
  const entries = rankings.data ?? []
  const position = entries.findIndex(entry => entry.playerID === userId) + 1
  return <div className="player-page">
    <PlayerHeading title="Leaderboard" description="See how players rank across Courtly." action={
      <Link className="button button--outline button--small" to="/player/matches">My match results</Link>} />
    {rankings.loading ? <Skeleton label="Loading leaderboard" />
      : rankings.error ? <ContentError error={rankings.error} retry={rankings.retry} />
      : !entries.length ? <WorkspacePanel title="Player rankings"><PlayerEmpty title="The leaderboard is open"
        detail="Players appear here once they earn ranking points." /></WorkspacePanel>
      : <>
        <section className="leaderboard-hero" aria-label="Top ranked players">
          <div className="leaderboard-hero-copy">
            <Trophy size={26} aria-hidden="true" /><h2>Top of the table</h2>
            <p>{position > 0 ? 'Your position is #' + position : 'Your ranking will appear once you earn points.'}</p>
          </div>
          <ol className="leaderboard-podium">{entries.slice(0, 3).map((entry, index) =>
            <li className={'podium-place podium-place--' + (index + 1)} key={entry.playerID}>
              <span className="podium-rank"><Medal size={17} aria-hidden="true" />#{index + 1}</span>
              <span className="podium-avatar" aria-hidden="true">{initials(entry.playerName)}</span>
              <strong>{entry.playerName}{entry.playerID === userId && <small> · You</small>}</strong>
              <span>{points.format(entry.rankPoints)} pts</span>
            </li>)}</ol>
        </section>
        <WorkspacePanel title="Full standings">
          <div className="workspace-table-wrap"><table className="workspace-table leaderboard-table">
            <thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Points</th></tr></thead>
            <tbody>{entries.map((entry, index) => <tr key={entry.playerID} className={entry.playerID === userId ? 'current-player' : ''}>
              <td>#{index + 1}</td>
              <th scope="row"><span className="leaderboard-player"><span className="player-avatar" aria-hidden="true">{initials(entry.playerName)}</span>
                <span>{entry.playerName}{entry.playerID === userId && <small> You</small>}</span></span></th>
              <td>{points.format(entry.rankPoints)}</td>
            </tr>)}</tbody>
          </table></div>
        </WorkspacePanel>
      </>}
  </div>
}
