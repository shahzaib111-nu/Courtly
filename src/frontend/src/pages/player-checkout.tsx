import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { loadStripe } from '@stripe/stripe-js/pure'
import type { Stripe, StripeCardElement } from '@stripe/stripe-js'
import { CalendarDays, Clock3, CreditCard, LockKeyhole, MapPin, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PlayerEmpty } from '../components/player-booking-ui'
import { usePlayer } from '../components/player-layout'
import { BackToBookings, failureMessage, PlayerHeading, WorkspacePanel } from '../components/player-workspace-ui'
import { ContentError, Message, Skeleton, Submit } from '../components/ui'
import { ApiError, discoveryApi, paymentApi, playerApi } from '../lib/api'
import { canPay, checkoutLink, formatDate, lahoreTimestamp, priceLabel, sportLabel } from '../lib/booking-time'
import type { Booking, Checkout, PlayerPayment } from '../lib/contracts'
import { paymentAttemptKey } from '../lib/session'
import { useNotifications } from '../lib/notifications'
import { useResource } from '../lib/use-resource'
import { isRecordedPayment, ReceiptView } from './player-payments'
import { CopyReference } from '../components/copy-reference'

async function existingReceipt(bookingID: string, signal?: AbortSignal) {
  try { return await paymentApi.receipt(bookingID, signal) }
  catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined
    throw error
  }
}

function useCountdown(deadline: number) {
  const remaining = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
  const [seconds, setSeconds] = useState(remaining)
  useEffect(() => {
    setSeconds(remaining())
    if (!Number.isFinite(deadline)) return
    const timer = window.setInterval(() => {
      const current = remaining()
      setSeconds(current)
      if (current === 0) window.clearInterval(timer)
    }, 250)
    return () => window.clearInterval(timer)
  }, [deadline])
  return Number.isFinite(deadline) ? seconds : undefined
}

function BookingSummary({ booking, checkout }: { booking?: Booking; checkout?: Checkout }) {
  const courtID = booking?.courtID
  const court = useResource(useCallback((signal: AbortSignal) => courtID ? discoveryApi.court(courtID, signal) : Promise.resolve(undefined), [courtID]))
  const facilityId = court.data?.facilityId
  const facility = useResource(useCallback((signal: AbortSignal) => facilityId ? discoveryApi.facility(facilityId, signal) : Promise.resolve(undefined), [facilityId]))
  const payable = checkout?.amount ?? booking?.totalCost
  const discount = checkout?.discount ?? booking?.discountApplied
  const subtotal = checkout?.subtotal ?? (payable != null && discount != null ? payable + discount : undefined)
  const date = checkout?.bookingDate ?? booking?.bookingDate
  const sport = checkout?.sportType ?? booking?.sportType
  return <WorkspacePanel title="Booking summary" className="checkout-summary">
    <div className="checkout-court">
      <span className="booking-icon"><MapPin size={20} aria-hidden="true" /></span>
      <div><h3>{checkout?.courtName || booking?.courtName || 'Court booking'}</h3>
        {facility.data?.facility.name && <p>{facility.data.facility.name}</p>}
        {sport && <p>{sportLabel(sport)}</p>}
      </div>
    </div>
    <dl className="receipt-details">
      <div><dt><CalendarDays size={16} aria-hidden="true" />Date</dt><dd>{date ? formatDate(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Unavailable'}</dd></div>
      <div><dt><Clock3 size={16} aria-hidden="true" />Time</dt><dd>{checkout?.timeSlot ?? booking?.timeSlot ?? 'Unavailable'}</dd></div>
      <div><dt>Booking reference</dt><dd><CopyReference value={checkout?.bookingID ?? booking?.bookingID} /></dd></div>
    </dl>
    {subtotal != null && discount != null && payable != null && <dl className="pricing-breakdown">
      <div><dt>Subtotal{(checkout?.peakHour ?? booking?.peakHour) && ' · peak pricing'}</dt><dd>{priceLabel(subtotal)}</dd></div>
      <div><dt>Verified discount</dt><dd>{discount > 0 ? '− ' : ''}{priceLabel(discount)}</dd></div>
      <div className="pricing-total"><dt>Total payable</dt><dd>{priceLabel(payable)}</dd></div>
    </dl>}
  </WorkspacePanel>
}

function StripeCard({ checkout, expired, busy, onPay }: {
  checkout: Checkout; expired: boolean; busy: boolean; onPay: (stripe: Stripe, card: StripeCardElement) => Promise<void>
}) {
  const mount = useRef<HTMLDivElement>(null)
  const stripe = useRef<Stripe | null>(null)
  const card = useRef<StripeCardElement | null>(null)
  const [complete, setComplete] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    let element: StripeCardElement | undefined
    setComplete(false)
    setReady(false)
    setError('')
    loadStripe(checkout.publishableKey).then(instance => {
      if (!active || !mount.current) return
      if (!instance) throw new Error('Stripe unavailable')
      stripe.current = instance
      element = instance.elements().create('card', {
        style: { base: { color: '#101c17', fontSize: '16px', '::placeholder': { color: '#566458' } }, invalid: { color: '#97382c' } },
      })
      element.on('ready', () => setReady(true))
      element.on('change', event => {
        setComplete(event.complete)
        setError(event.error?.message || '')
      })
      element.mount(mount.current)
      card.current = element
    }).catch(() => {
      if (active) setError('The secure card form could not load. Check your connection and retry.')
    })
    return () => {
      active = false
      element?.destroy()
      card.current = null
      stripe.current = null
    }
  }, [checkout.publishableKey, attempt])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!busy && !expired && complete && stripe.current && card.current) void onPay(stripe.current, card.current)
  }

  return <form onSubmit={submit} className="workspace-form">
    <div className="field"><div className="checkout-card-label"><CreditCard size={18} aria-hidden="true" /><strong>Card details</strong></div>
      {!ready && !error && <p role="status">Loading secure card fields…</p>}
      <div ref={mount} className="stripe-field" aria-label="Secure card fields" />
    </div>
    {error && (ready ? <Message>{error}</Message> : <ContentError error={error} retry={() => setAttempt(value => value + 1)} />)}
    <Submit busy={busy || !complete || expired}>{busy ? 'Processing payment…' : 'Pay ' + priceLabel(checkout.amount)}</Submit>
  </form>
}

function CheckoutFlow({ bookingID, booking, initialReceipt }: { bookingID: string; booking?: Booking; initialReceipt?: PlayerPayment }) {
  const { userId } = usePlayer()
  const { refresh } = useNotifications()
  const attemptKey = paymentAttemptKey(userId, bookingID)
  const [recoveryID, setRecoveryID] = useState(() => localStorage.getItem(attemptKey) || '')
  const [receipt, setReceipt] = useState(initialReceipt)
  const [checkout, setCheckout] = useState<Checkout>()
  const [configurationMissing, setConfigurationMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const operation = useRef(false)
  const deadline = checkout?.paymentDeadline ?? (booking?.createdAt ?? '')
  const timestamp = deadline ? lahoreTimestamp(deadline) + (checkout ? 0 : 600_000) : NaN
  const seconds = useCountdown(timestamp)
  const expired = Number.isFinite(timestamp) && Date.now() >= timestamp
  const eligible = booking && canPay(booking, Date.now()) && !expired
  useEffect(() => {
    if (initialReceipt) localStorage.removeItem(attemptKey)
    const sync = (event: StorageEvent) => {
      if (event.key === attemptKey) setRecoveryID(event.newValue || '')
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [attemptKey, initialReceipt])

  function acceptReceipt(payment: PlayerPayment) {
    if (!isRecordedPayment(payment)) throw new ApiError('Courtly has not recorded a completed payment for this booking.')
    localStorage.removeItem(attemptKey)
    setRecoveryID('')
    setReceipt(payment)
    refresh()
  }

  async function run(action: () => Promise<void>) {
    if (operation.current) return
    operation.current = true
    setBusy(true)
    setError('')
    try {
      if (navigator.locks) {
        await navigator.locks.request(attemptKey, { ifAvailable: true }, async lock => {
          if (!lock) throw new ApiError('Payment is already in progress in another Courtly tab.')
          await action()
        })
      } else await action()
    }
    catch (failure) { setError(failureMessage(failure, 'The payment action could not be completed. Please try again.')) }
    finally {
      operation.current = false
      setBusy(false)
    }
  }

  async function checkPayment(id: string) {
    try {
      const existing = await existingReceipt(bookingID)
      acceptReceipt(existing ?? await paymentApi.confirm(bookingID, id))
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 409) {
        const existing = await existingReceipt(bookingID)
        if (existing) { acceptReceipt(existing); return }
      }
      if (failure instanceof ApiError && failure.status === 402 && /status: (?:requires_payment_method|canceled)\b/.test(failure.message)) {
        localStorage.removeItem(attemptKey)
        setRecoveryID('')
        if (/status: canceled\b/.test(failure.message)) setCheckout(undefined)
        throw new ApiError('Stripe did not complete this attempt. You can retry if your booking is still held.')
      }
      if (failure instanceof ApiError && failure.status === 403) throw failure
      throw new ApiError('Courtly could not verify the payment yet. Check the existing attempt before trying another payment.')
    }
  }

  function start() {
    void run(async () => {
      if (checkout || localStorage.getItem(attemptKey) || !booking || !canPay(booking, Date.now())) return
      const existing = await existingReceipt(bookingID)
      if (existing) { acceptReceipt(existing); return }
      let result: Checkout
      try { result = await paymentApi.start(bookingID) }
      catch (failure) {
        if (failure instanceof ApiError && (failure.status === 409 || failure.status === 404)) {
          const posted = await existingReceipt(bookingID)
          if (posted) { acceptReceipt(posted); return }
        }
        throw failure
      }
      if (!/^pk_(test|live)_/.test(result.publishableKey || '') || !result.clientSecret || !result.paymentIntentID) {
        setConfigurationMissing(true)
        throw new ApiError('Online card payments are unavailable. The payment provider is missing configuration.')
      }
      setCheckout(result)
    })
  }

  async function pay(stripe: Stripe, card: StripeCardElement) {
    await run(async () => {
      if (!checkout || localStorage.getItem(attemptKey) || Date.now() >= lahoreTimestamp(checkout.paymentDeadline)) return
      const currentToken = localStorage.getItem('jwtToken')
      const existing = await existingReceipt(bookingID)
      if (existing) { acceptReceipt(existing); return }
      if (!currentToken || localStorage.getItem('jwtToken') !== currentToken) return
      const id = checkout.paymentIntentID
      // Only the non-secret intent reference is shared for recovery. Stripe's client secret stays in memory.
      localStorage.setItem(attemptKey, id)
      setRecoveryID(id)
      const result = await stripe.confirmCardPayment(checkout.clientSecret, { payment_method: { card } })
      if (result.error?.payment_intent?.status === 'requires_payment_method') {
        localStorage.removeItem(attemptKey)
        setRecoveryID('')
        throw new ApiError(result.error.message || 'The card was declined. Check the details or use another card.')
      }
      if (result.error || result.paymentIntent?.status !== 'succeeded') {
        throw new ApiError('Stripe did not return a completed payment. Check the existing attempt for its latest status.')
      }
      await checkPayment(id)
    })
  }

  if (receipt && isRecordedPayment(receipt)) return <ReceiptView payment={receipt} fromCheckout />
  const blocked = expired ? 'The payment window has ended. Return to My bookings to check the reservation.'
    : booking?.status === 'CANCELLED' ? 'This booking was cancelled.'
      : booking ? 'This booking has no payable hold or recorded card receipt.' : 'This booking is outside your available booking history or could not be found.'
  return <div className="player-page">
    <PlayerHeading title="Checkout" description="Pay for your reserved court." action={<BackToBookings />} />
    <div className="checkout-grid">
      <WorkspacePanel title="Card payment" description="Complete payment to confirm your booking.">
        {eligible && seconds != null && <p className="checkout-deadline"><Clock3 size={17} aria-hidden="true" />
          <span>Time left to pay</span><strong role="timer">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</strong>
        </p>}
        {error && <Message>{error}</Message>}
        {checkout && <div hidden={!busy && (!!recoveryID || !eligible)}>
          <StripeCard checkout={checkout} expired={expired} busy={busy} onPay={pay} />
        </div>}
        {recoveryID && (!busy || !checkout) ? <div className="workspace-form">
          <p>Check the status of the payment you started.</p>
          <button type="button" className="button button--primary" disabled={busy}
            onClick={() => void run(() => checkPayment(recoveryID))}>{busy ? 'Checking payment…' : 'Check payment status'}</button>
        </div> : eligible ? !checkout && <button className="button button--primary checkout-start" type="button" disabled={busy || configurationMissing} onClick={start}>
          <LockKeyhole size={17} aria-hidden="true" />{busy ? 'Preparing payment…' : 'Continue to secure card entry'}</button>
          : <PlayerEmpty title="Payment unavailable" detail={blocked} />}
        {(eligible || recoveryID) && <p className="checkout-security"><ShieldCheck size={18} aria-hidden="true" />Card details are collected securely by Stripe.</p>}
      </WorkspacePanel>
      {booking && <BookingSummary booking={booking} checkout={checkout} />}
    </div>
  </div>
}

export function PlayerCheckout() {
  const { bookingID = '' } = useParams()
  const { userId } = usePlayer()
  const resource = useResource(useCallback(async (signal: AbortSignal) => {
    const receipt = await existingReceipt(bookingID, signal)
    if (receipt && isRecordedPayment(receipt)) return { receipt }
    const bookings = await playerApi.bookings(userId, signal)
    return { booking: bookings.find(booking => booking.bookingID === bookingID) }
  }, [bookingID, userId]))
  if (resource.data) return <CheckoutFlow key={bookingID} bookingID={bookingID} booking={resource.data.booking} initialReceipt={resource.data.receipt} />
  return <div className="player-page">
    <PlayerHeading title="Checkout" action={<BackToBookings />} />
    {resource.loading ? <Skeleton label="Loading booking and payment status" count={2} />
      : resource.error && <ContentError error={resource.error} retry={resource.retry} />}
    <Link className="text-link" to={checkoutLink(bookingID, true)}>Look up this receipt</Link>
  </div>
}
