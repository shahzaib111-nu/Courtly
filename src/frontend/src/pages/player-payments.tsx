import { useCallback, useState } from 'react'
import { ArrowLeft, CreditCard, Printer, ReceiptText } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { CopyReference } from '../components/copy-reference'
import { PlayerEmpty } from '../components/player-booking-ui'
import { usePlayer } from '../components/player-layout'
import { PlayerHeading, WorkspacePanel, WorkspaceStatus } from '../components/player-workspace-ui'
import { ContentError, Field, Message, Skeleton } from '../components/ui'
import { ApiError, paymentApi, playerApi } from '../lib/api'
import { checkoutLink, formatDate, formatTimestamp, priceLabel } from '../lib/booking-time'
import type { PlayerPayment } from '../lib/contracts'
import { useResource } from '../lib/use-resource'

const fullDate = { day: 'numeric', month: 'long', year: 'numeric' } as const
const cardLabel = (payment: PlayerPayment) => payment.maskedCard
  ? [payment.cardBrand?.toUpperCase(), payment.maskedCard].filter(Boolean).join(' ') : 'Unavailable'
export const isRecordedPayment = (payment: PlayerPayment) => payment.status === 'SUCCESS' || payment.status === 'REFUNDED'

export function PlayerPayments() {
  const { userId } = usePlayer()
  const payments = useResource(useCallback((signal: AbortSignal) => playerApi.payments(userId, signal), [userId]))
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const search = query.trim().toLocaleLowerCase()
  const records = payments.data?.filter(isRecordedPayment) ?? []
  const shown = records.filter(payment => (!status || payment.status === status) &&
    (!search || [payment.bookingID, payment.receiptNo, payment.courtName, payment.maskedCard]
      .some(value => value?.toLocaleLowerCase().includes(search))))

  return <div className="player-page">
    <PlayerHeading title="Payments" description="Review your recorded card payments and print receipts." />
    <WorkspacePanel title="Transaction history">
      {!!records.length && <div className="workspace-filters">
        <Field label="Search transactions" type="search" value={query} placeholder="Court, booking, or receipt" onChange={event => setQuery(event.target.value)} />
        <div className="field"><label htmlFor="payment-status">Payment status</label>
          <select id="payment-status" value={status} onChange={event => setStatus(event.target.value)}>
            <option value="">All statuses</option><option value="SUCCESS">Paid</option><option value="REFUNDED">Refunded</option>
          </select>
        </div>
      </div>}
      {payments.loading ? <Skeleton label="Loading payment history" />
        : payments.error ? <ContentError error={payments.error} retry={payments.retry} />
        : !records.length ? <PlayerEmpty title="No recorded card payments" detail="Paid and refunded Stripe transactions will appear here." />
        : !shown.length ? <PlayerEmpty title="No matching payments" detail="Try a different search or status." />
        : <div className="workspace-table-wrap" tabIndex={0} aria-label="Recorded card payments">
          <table className="workspace-table payments-table">
            <thead><tr><th scope="col">Court and booking</th><th scope="col">Transaction date</th><th scope="col">Card</th>
              <th scope="col">Amount paid</th><th scope="col">Status</th><th scope="col">Receipt</th></tr></thead>
            <tbody>{shown.map(payment => <tr key={payment.paymentID}>
              <th scope="row"><strong>{payment.courtName || 'Court booking'}</strong><CopyReference value={payment.bookingID} /></th>
              <td>{formatTimestamp(payment.paidAt)}</td><td>{cardLabel(payment)}</td><td>{priceLabel(payment.amountPaid)}</td>
              <td><WorkspaceStatus status={payment.status} /></td>
              <td><Link className="text-link" to={checkoutLink(payment.bookingID, true)}
                aria-label={'View receipt ' + (payment.receiptNo ?? 'for booking ' + payment.bookingID)}>{payment.receiptNo || 'View receipt'}</Link></td>
            </tr>)}</tbody>
          </table>
        </div>}
    </WorkspacePanel>
  </div>
}

export function ReceiptView({ payment, fromCheckout = false }: { payment: PlayerPayment; fromCheckout?: boolean }) {
  return <div className="player-page receipt-screen">
    <PlayerHeading title="Payment receipt" action={<Link className="button button--outline button--small receipt-ui" to="/player/payments">
      <ArrowLeft size={16} />Payment history</Link>} />
    {fromCheckout && payment.status === 'SUCCESS' && <div className="receipt-ui"><Message kind="success">
      Courtly recorded your payment. <Link className="text-link" to="/player/bookings">See your bookings</Link>
    </Message></div>}
    <article className="player-panel receipt-paper">
      <header className="receipt-header">
        <span className="booking-icon"><ReceiptText size={22} aria-hidden="true" /></span>
        <div><h2>Courtly</h2><p>{payment.receiptNo || 'Receipt number unavailable'}</p></div>
        <WorkspaceStatus status={payment.status} />
      </header>
      <dl className="receipt-details">
        {payment.playerName && <div><dt>Player</dt><dd>{payment.playerName}</dd></div>}
        <div><dt>Booking reference</dt><dd><CopyReference key={payment.bookingID} value={payment.bookingID} /></dd></div>
        <div><dt>Court</dt><dd>{payment.courtName || 'Court booking'}</dd></div>
        {payment.bookingDate && <div><dt>Booking date</dt><dd>{formatDate(payment.bookingDate, fullDate)}</dd></div>}
        {payment.timeSlot && <div><dt>Time slot</dt><dd>{payment.timeSlot}</dd></div>}
        <div><dt>Transaction date</dt><dd>{formatTimestamp(payment.paidAt)}</dd></div>
        {payment.maskedCard && <div><dt>Card</dt><dd><CreditCard size={16} aria-hidden="true" />{cardLabel(payment)}</dd></div>}
        {payment.transactionRef && <div><dt>Transaction reference</dt><dd><CopyReference value={payment.transactionRef} label="transaction reference" /></dd></div>}
      </dl>
      <dl className="pricing-breakdown">
        <div><dt>Subtotal{payment.peakHour && ' · peak pricing'}</dt><dd>{priceLabel(payment.subtotal)}</dd></div>
        <div><dt>Verified discount</dt><dd>{payment.discount > 0 ? '− ' : ''}{priceLabel(payment.discount)}</dd></div>
        <div className="pricing-total"><dt>Amount paid</dt><dd>{priceLabel(payment.amountPaid)}</dd></div>
      </dl>
      <button type="button" className="button button--outline receipt-ui" onClick={() => window.print()}><Printer size={17} />Print or save as PDF</button>
    </article>
  </div>
}

export function PlayerReceipt() {
  const { bookingID = '' } = useParams()
  const { userId } = usePlayer()
  const receipt = useResource(useCallback(async (signal: AbortSignal) => {
    try { return await paymentApi.receipt(bookingID, signal) }
    catch (failure) {
      if (!(failure instanceof ApiError) || failure.status !== 404) throw failure
      // History can retain a payment after its booking record is removed.
      return (await playerApi.payments(userId, signal)).find(payment => payment.bookingID === bookingID)
    }
  }, [bookingID, userId]))
  if (receipt.data && isRecordedPayment(receipt.data)) return <ReceiptView payment={receipt.data} />
  return <div className="player-page">
    <PlayerHeading title="Payment receipt" action={<Link className="button button--outline button--small" to="/player/payments">Payment history</Link>} />
    {receipt.loading ? <Skeleton label="Loading payment receipt" count={2} />
      : receipt.error ? <ContentError error={receipt.error} retry={receipt.retry} />
      : <PlayerEmpty title="No payment receipt for this booking" detail="Receipts appear after Courtly records a card transaction." />}
  </div>
}
