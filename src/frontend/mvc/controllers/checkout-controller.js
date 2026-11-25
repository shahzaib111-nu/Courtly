// ============================================================
// CHECKOUT CONTROLLER  (checkout.html?bookingID=...)
//
// The server is the single source of truth:
//   1. POST /api/payments/create-payment-intent → amount, discount, Stripe client secret
//   2. Stripe.js charges the card in the browser (card numbers never reach our server)
//   3. POST /api/payments/confirm → server re-checks with Stripe, records the payment,
//      confirms the booking and returns the receipt
// ============================================================
(async () => {
    const PAYMENT_API = `${API_BASE}/api/payments`;
    const bookingID   = new URLSearchParams(window.location.search).get('bookingID') || '';

    const payButton        = document.getElementById('submit-button');
    const buttonText       = document.getElementById('button-text');
    const spinner          = document.getElementById('spinner');
    const message          = document.getElementById('payment-message');
    const details          = document.getElementById('booking-details');
    const priceSummary     = document.getElementById('price-summary');
    const formContainer    = document.getElementById('form-container');
    const successContainer = document.getElementById('success-container');

    const pkr = n => `PKR ${Math.round(Number(n) || 0).toLocaleString()}`;
    const longDate = d => d
        ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';

    /** Something prevents paying (not signed in, booking gone, already paid...). */
    function blockCheckout(text) {
        message.textContent = text;
        payButton.disabled = true;
        payButton.classList.add('opacity-50', 'cursor-not-allowed');
        if (details.textContent === 'Loading details...') details.textContent = 'Payment unavailable';
    }

    async function postJson(url, body) {
        const res  = await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    }

    if (!localStorage.getItem('jwtToken')) { blockCheckout('Please sign in to pay for your booking.'); return; }
    if (!bookingID) { blockCheckout('No booking selected. Please choose a slot from your dashboard.'); return; }

    // --- 1. Ask the server for the amount and a Stripe payment ---
    let checkout;
    try {
        const { ok, status, data } = await postJson(`${PAYMENT_API}/create-payment-intent`, { bookingID });
        if (!ok && status === 409 && /already been paid/i.test(data.message || '')) {
            // Paid earlier (e.g. page refreshed after paying): show the stored receipt instead.
            const r = await fetch(`${PAYMENT_API}/booking/${encodeURIComponent(bookingID)}`);
            if (r.ok) { populateReceipt(await r.json()); showSuccess(); return; }
        }
        if (!ok) { blockCheckout(data.message || 'Could not start the payment.'); return; }
        checkout = data;
    } catch {
        blockCheckout(`Cannot connect to the server. Make sure the backend is running at ${API_BASE}.`);
        return;
    }

    // --- 2. Render the server-calculated summary ---
    const shortDate = checkout.bookingDate
        ? new Date(checkout.bookingDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : '';
    details.innerHTML =
        `<span class="font-semibold text-white">${checkout.courtName || 'Court'}</span>` +
        (shortDate ? ` &nbsp;·&nbsp; ${shortDate}` : '') +
        ` &nbsp;·&nbsp; ${checkout.timeSlot || ''}` +
        (checkout.peakHour ? ` <span class="ml-2 px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-400">PEAK</span>` : '');
    priceSummary.innerHTML = checkout.discount > 0
        ? `<span class="text-gray-400 line-through text-sm">${pkr(checkout.subtotal)}</span>
           <span class="ml-3 font-bold text-white text-2xl">${pkr(checkout.amount)}</span>
           <p class="text-xs text-emerald-400 font-medium mt-1">✓ Verified discount: ${pkr(checkout.discount)} off</p>`
        : `<span class="font-bold text-white text-2xl">${pkr(checkout.amount)}</span>`;
    buttonText.textContent = `Pay ${pkr(checkout.amount)}`;

    if (!checkout.publishableKey) { blockCheckout('Online payments are not configured on this server.'); return; }

    // --- 3. Stripe card form ---
    const stripe   = Stripe(checkout.publishableKey);
    const elements = stripe.elements();
    const cardElement = elements.create('card', { style: {
        base: {
            color: "#ffffff",
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            fontSmoothing: "antialiased",
            fontSize: "16px",
            iconColor: "#60a5fa",
            "::placeholder": { color: "#9ca3af" }
        },
        invalid: { color: "#f87171", iconColor: "#f87171" }
    }});
    cardElement.mount('#card-element');

    const setLoading = (isLoading, label) => {
        payButton.disabled = isLoading;
        buttonText.textContent = isLoading ? (label || 'Processing...') : `Pay ${pkr(checkout.amount)}`;
        spinner.classList.toggle('hidden', !isLoading);
    };

    function populateReceipt(r) {
        const paidAt = r.paidAt ? new Date(r.paidAt) : new Date();
        document.getElementById('r-receipt-no').textContent = r.receiptNo;
        document.getElementById('r-pay-date').textContent   =
            paidAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + '  ' +
            paidAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('r-txn-id').textContent     = r.transactionRef || '—';
        document.getElementById('r-card').textContent       =
            r.maskedCard ? `${(r.cardBrand || 'card').toUpperCase()} ${r.maskedCard}` : '—';
        document.getElementById('r-court').textContent      = r.courtName || '—';
        document.getElementById('r-time').textContent       = r.timeSlot || '—';
        document.getElementById('r-book-date').textContent  = longDate(r.bookingDate);
        document.getElementById('r-player').textContent     = r.playerName || '—';
        document.getElementById('r-booking-id').textContent = r.bookingID;
        document.getElementById('r-base').textContent       = pkr(r.subtotal);
        document.getElementById('r-total').textContent      = pkr(r.amountPaid);
        if (r.peakHour) document.getElementById('r-peak-row').classList.remove('hidden');
        if (r.discount > 0) {
            document.getElementById('r-discount-amount').textContent = `− ${pkr(r.discount)}`;
            document.getElementById('r-discount-row').classList.remove('hidden');
        }
    }

    /** Ask the server to verify and record the payment. Retries network errors: the call is idempotent. */
    async function confirmWithServer(paymentIntentID) {
        for (let attempt = 1; ; attempt++) {
            try {
                return await postJson(`${PAYMENT_API}/confirm`, { bookingID, paymentIntentID });
            } catch (err) {
                if (attempt >= 3) throw err;
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }

    payButton.addEventListener('click', async () => {
        setLoading(true);
        message.textContent = '';

        // 4. Charge the card with Stripe
        const result = await stripe.confirmCardPayment(checkout.clientSecret, { payment_method: { card: cardElement } });
        if (result.error) {
            message.textContent = result.error.message;   // e.g. card declined: player can retry
            setLoading(false);
            return;
        }

        // 5. Server verifies with Stripe, records the payment and confirms the booking
        setLoading(true, 'Confirming booking...');
        let response;
        try {
            response = await confirmWithServer(result.paymentIntent.id);
        } catch {
            blockCheckout('Your card was charged, but we could not reach the server to confirm the booking. ' +
                          'Do not pay again: refresh this page in a moment, or contact support with reference ' +
                          result.paymentIntent.id + '.');
            setLoading(false);
            payButton.disabled = true;
            return;
        }
        if (!response.ok) {
            blockCheckout(response.data.message || 'The payment could not be confirmed.');
            setLoading(false);
            payButton.disabled = true;
            return;
        }

        populateReceipt(response.data);
        showSuccess();
    });

    function showSuccess() {
        formContainer.style.opacity = '0';
        setTimeout(() => {
            formContainer.style.display = 'none';
            successContainer.classList.remove('hidden');
            document.getElementById('checkout-card').style.transform = 'scale(0.98)';
        }, 300);
    }
})();

// Extracted page controller
function slideOutAndNavigate(url, event) {
            event.preventDefault(); // Stop the link from working instantly
            
            const card = document.getElementById('checkout-card');
            
            // Swap the animation classes
            card.classList.remove('page-enter');
            card.classList.add('page-exit');
            
            // Wait for the animation to finish, then navigate
            setTimeout(() => {
                window.location.href = url;
            }, 350); 
        }
