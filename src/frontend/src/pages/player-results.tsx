import { useCallback, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { MapPin, Star, Trophy } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { PlayerEmpty } from '../components/player-booking-ui'
import { usePlayer } from '../components/player-layout'
import { BackToBookings, failureMessage, PlayerHeading, statusLabel, WorkspacePanel, WorkspaceStatus } from '../components/player-workspace-ui'
import { ContentError, Field, Message, Skeleton, Submit, Toast } from '../components/ui'
import { discoveryApi, matchApi, playerApi, ratingApi } from '../lib/api'
import { canReviewBooking, formatDate, formatTimestamp, sportLabel } from '../lib/booking-time'
import type { Booking, FacilityRating, MatchOutcome, MatchResult } from '../lib/contracts'
import { useResource } from '../lib/use-resource'

function BookingDetails({ booking, rating }: { booking: Booking; rating: boolean }) {
  const court = useResource(useCallback((signal: AbortSignal) => discoveryApi.court(booking.courtID, signal), [booking.courtID]))
  const facilityId = court.data?.facilityId
  const facility = useResource(useCallback((signal: AbortSignal) => facilityId
    ? discoveryApi.facility(facilityId, signal) : Promise.resolve(undefined), [facilityId]))
  const average = useResource(useCallback((signal: AbortSignal) => rating
    ? ratingApi.average(booking.courtID, signal) : Promise.resolve(undefined), [rating, booking.courtID]))
  return <div className="workspace-context">
    <span className="booking-icon"><MapPin size={18} aria-hidden="true" /></span>
    <div><strong>{booking.courtName || 'Court booking'}</strong>
      <p>{[facility.data?.facility.name, booking.sportType && sportLabel(booking.sportType), formatDate(booking.bookingDate), booking.timeSlot].filter(Boolean).join(' · ')}</p>
      {!!average.data?.average && <p>Court average {average.data.average.toFixed(1)} / 5</p>}
    </div>
  </div>
}

function SubmissionForm({ booking, rating, onSaved }: {
  booking: Booking; rating: boolean; onSaved: (record: MatchResult | FacilityRating) => void
}) {
  const { userId } = usePlayer()
  const api = rating ? ratingApi : matchApi
  const check = useResource(useCallback((signal: AbortSignal) => api.check(booking.bookingID, signal), [api, booking.bookingID]))
  const [stars, setStars] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || check.data?.submitted !== false) return
    const form = new FormData(event.currentTarget)
    setProblem('')
    const opponentName = String(form.get('opponentName') ?? '').trim()
    const playerScore = Number(form.get('playerScore'))
    const opponentScore = Number(form.get('opponentScore'))
    const result = String(form.get('result')) as MatchOutcome
    if (rating ? stars < 1 || feedback.length > 500 : opponentName.length < 2 || opponentName.length > 100 ||
      [playerScore, opponentScore].some(score => !Number.isInteger(score) || score < 0 || score > 999) ||
      !['WIN', 'LOSS', 'DRAW'].includes(result)) {
      setProblem(rating ? 'Choose a star rating and keep your feedback within 500 characters.' : 'Enter an opponent, two whole-number scores from 0 to 999, and an outcome.')
      return
    }
    submitting.current = true
    setBusy(true)
    try {
      const existing = await api.check(booking.bookingID)
      if (existing.submitted) {
        setProblem('This booking already has a submission.')
        check.retry()
        return
      }
      const ids = { bookingID: booking.bookingID, playerID: userId }
      const record = rating
        ? await ratingApi.submit({ ...ids, ratingScore: stars, feedbackText: feedback.trim() })
        : await matchApi.submit({ ...ids, opponentName, playerScore, opponentScore, result })
      onSaved(record)
    } catch (error) {
      setProblem(failureMessage(error, 'Your submission could not be saved.'))
      check.retry()
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return <>
    <BookingDetails booking={booking} rating={rating} />
    {problem && <Message>{problem}</Message>}
    {check.loading ? <Skeleton label="Checking submission status" count={1} />
      : check.error ? <ContentError error={check.error} retry={check.retry} />
      : check.data?.submitted ? <Message kind="success">This booking already has a {rating ? 'rating' : 'match result'}.</Message>
      : <form className="workspace-form" onSubmit={submit}>
        {rating ? <>
          <fieldset className="star-field"><legend>Your rating</legend>
            <div>{[1, 2, 3, 4, 5].map(score => <label key={score}>
              <input type="radio" name="rating" value={score} checked={stars === score} required onChange={() => setStars(score)}
                aria-label={score + (score === 1 ? ' star' : ' stars')} />
              <span className={score <= stars ? 'star-selected' : ''}><Star size={25} aria-hidden="true" /></span>
            </label>)}</div>
          </fieldset>
          <div className="field"><label htmlFor="rating-feedback">Written feedback (optional)</label>
            <textarea id="rating-feedback" rows={4} maxLength={500} value={feedback} onChange={event => setFeedback(event.target.value)}
              aria-describedby="rating-count" />
            <small id="rating-count" className="field-hint">{feedback.length}/500 characters</small>
          </div>
        </> : <>
          <Field label="Opponent name" name="opponentName" minLength={2} maxLength={100} required />
          <div className="workspace-field-grid">
            <Field label="Your score" name="playerScore" type="number" min={0} max={999} step={1} required />
            <Field label="Opponent score" name="opponentScore" type="number" min={0} max={999} step={1} required />
          </div>
          <div className="field"><label htmlFor="match-outcome">Outcome</label>
            <select id="match-outcome" name="result" required defaultValue="">
              <option value="" disabled>Select an outcome</option><option value="WIN">Win</option>
              <option value="LOSS">Loss</option><option value="DRAW">Draw</option>
            </select>
            <span className="field-hint">If the outcome conflicts with the scores, Courtly sends the result for review.</span>
          </div>
        </>}
        <Submit busy={busy}>{busy ? 'Submitting…' : rating ? 'Submit rating' : 'Submit result'}</Submit>
      </form>}
  </>
}

function MatchHistory({ records }: { records: MatchResult[] }) {
  return <ul className="workspace-records">{records.map(record => <li key={record.matchID}>
    <span className="booking-icon"><Trophy size={18} aria-hidden="true" /></span>
    <div className="workspace-record-copy"><h3>{record.courtName || 'Court booking'}</h3>
      <p>{[record.sportType && sportLabel(record.sportType), formatDate(record.bookingDate), record.timeSlot].filter(Boolean).join(' · ')}</p>
      <p>vs. {record.opponentName}</p>
      {record.status === 'DISPUTED' && <p className="record-dispute">Awaiting review. {record.disputeReason}</p>}
      {record.status === 'RESOLVED' && record.resolvedAt && <p>Resolved {formatTimestamp(record.resolvedAt)}</p>}
    </div>
    <div className="workspace-record-value">
      <strong>{record.playerScore}–{record.opponentScore} · {statusLabel(record.result)}</strong>
      <span>{record.pointsEarned} {record.pointsEarned === 1 ? 'point' : 'points'} earned</span>
      <WorkspaceStatus status={record.status} />
    </div>
  </li>)}</ul>
}

function RatingHistory({ records }: { records: FacilityRating[] }) {
  return <ul className="workspace-records">{records.map(record => <li key={record.ratingID}>
    <span className="booking-icon"><Star size={18} aria-hidden="true" /></span>
    <div className="workspace-record-copy"><h3>{record.courtName || 'Court booking'}</h3>
      <p>{[record.facilityName, record.sportType && sportLabel(record.sportType), formatDate(record.bookingDate)].filter(Boolean).join(' · ')}</p>
      {record.feedbackText && <p className="workspace-written-feedback">{record.feedbackText}</p>}
      <p>Sent {formatTimestamp(record.submittedAt)}</p>
    </div>
    <div className="workspace-record-value"><strong>{record.ratingScore} / 5</strong><WorkspaceStatus status="SUBMITTED" /></div>
  </li>)}</ul>
}

export function PlayerResults({ rating = false }: { rating?: boolean }) {
  const { userId } = usePlayer()
  const [params, setParams] = useSearchParams()
  const [toast, setToast] = useState('')
  const [saved, setSaved] = useState<(MatchResult | FacilityRating)[]>([])
  const bookings = useResource(useCallback((signal: AbortSignal) => playerApi.bookings(userId, signal), [userId]))
  const history = useResource<(MatchResult | FacilityRating)[]>(useCallback((signal: AbortSignal) => rating
    ? ratingApi.history(userId, signal) : matchApi.history(userId, signal), [userId, rating]))
  const records = [...saved.filter(record => !history.data?.some(item => item.bookingID === record.bookingID)), ...(history.data ?? [])]
  const submitted = new Set(records.map(record => record.bookingID))
  const eligible = bookings.data?.filter(booking => canReviewBooking(booking) && !submitted.has(booking.bookingID)) ?? []
  const requested = params.get('booking')
  const selected = eligible.find(booking => booking.bookingID === requested)
  const requestedSubmitted = !!requested && submitted.has(requested)
  const title = rating ? 'Ratings and feedback' : 'Match results'

  function onSaved(record: MatchResult | FacilityRating) {
    setSaved(items => [record, ...items])
    setParams({}, { replace: true })
    setToast(rating ? 'Rating submitted.' : 'status' in record && record.status === 'DISPUTED'
      ? 'Match result sent for review.' : 'Match result submitted.')
    history.retry()
  }

  return <div className="player-page">
    <PlayerHeading title={title} description={rating ? 'Share feedback from bookings you’ve played.' : 'Record scores and track the ranking points you’ve earned.'}
      action={<BackToBookings />} />
    <div className="workspace-split">
      <WorkspacePanel title={rating ? 'Rate a booking' : 'Submit a result'}
        description="Choose a recent booking after its time slot has ended.">
        {bookings.loading ? <Skeleton label="Loading recent bookings" count={2} />
          : bookings.error ? <ContentError error={bookings.error} retry={bookings.retry} />
          : <>
            {requestedSubmitted && <Message kind="success">This booking already has a submission. See your history.</Message>}
            {requested && !selected && !requestedSubmitted && <Message>This booking is outside the available selection or is ineligible.</Message>}
            {!eligible.length ? <PlayerEmpty title="No eligible bookings" detail="Courtly only makes recent bookings available for selection." />
              : <div className="workspace-form">
                <div className="field"><label htmlFor="review-booking">Booking</label>
                  <select id="review-booking" value={selected?.bookingID ?? ''} onChange={event => {
                    setParams(event.target.value ? { booking: event.target.value } : {}, { replace: true })
                  }}>
                    <option value="">Select a booking</option>
                    {eligible.map(booking => <option key={booking.bookingID} value={booking.bookingID}>
                      {booking.courtName || 'Court'} · {formatDate(booking.bookingDate)} · {booking.timeSlot}
                    </option>)}
                  </select>
                </div>
                {selected && <SubmissionForm key={selected.bookingID} booking={selected} rating={rating} onSaved={onSaved} />}
              </div>}
          </>}
      </WorkspacePanel>
      <WorkspacePanel title={rating ? 'Your ratings' : 'Match history'}>
        {history.error && <ContentError error={history.error} retry={history.retry} />}
        {records.length ? rating ? <RatingHistory records={records as FacilityRating[]} /> : <MatchHistory records={records as MatchResult[]} />
          : history.loading ? <Skeleton label={'Loading ' + title.toLowerCase()} count={3} />
          : !history.error && <PlayerEmpty title={rating ? 'No ratings yet' : 'No match results yet'}
            detail={rating ? 'Your submitted court and facility feedback will appear here.' : 'Your results and points will appear here after submission.'} />}
      </WorkspacePanel>
    </div>
    {toast && <Toast onClose={() => setToast('')}>{toast}</Toast>}
  </div>
}
