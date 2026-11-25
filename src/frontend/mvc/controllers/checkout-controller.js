(async () => {
    const AUTH_API    = `${API_BASE}/api/auth`;
    const BOOKING_API = `${API_BASE}/api/bookings`;
    const PAYMENT_API = `${API_BASE}/api/payments`;

    // --- 1. Extract URL parameters ---
    const urlParams  = new URLSearchParams(window.location.search);
    const bookingID  = urlParams.get('bookingID') || '';
    const courtName  = urlParams.get('court')     || 'Court';
    const timeSlot   = urlParams.get('time')      || '--:--';
    const basePrice  = parseFloat(urlParams.get('price')) || 0;
    const isPeak     = urlParams.get('isPeak') === '1';
    const date       = urlParams.get('date')      || '';

    // --- 2. Fetch discount tier (if logged in) ---
    const playerEmail = localStorage.getItem('playerEmail');
    let discountTier = 'NONE';
    if (playerEmail) {
        try {
            const r = await fetch(`${AUTH_API}/profile?email=${encodeURIComponent(playerEmail)}`);
            if (r.ok) discountTier = (await r.json()).discountTier || 'NONE';
        } catch { /* offline — no discount */ }
    }
    const isVerified = ['STUDENT', 'SENIOR', 'FAMILY'].includes(discountTier);
    const finalPrice = isVerified ? Math.round(basePrice * 0.8) : basePrice;

    // --- 3. Render booking summary ---
    const dateStr = date
        ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : '';
    document.getElementById('booking-details').innerHTML =
        `<span class="font-semibold text-white">${courtName}</span>` +
        (dateStr ? ` &nbsp;·&nbsp; ${dateStr}` : '') +
        ` &nbsp;·&nbsp; ${timeSlot}` +
        (isPeak ? ` <span class="ml-2 px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-400">PEAK</span>` : '');

    const tierLabel = { STUDENT: '🎓 STUDENT', SENIOR: '🧓 SENIOR', FAMILY: '👨‍👩‍👧 FAMILY' };
    document.getElementById('price-summary').innerHTML = isVerified
        ? `<span class="text-gray-400 line-through text-sm">PKR ${basePrice.toLocaleString()}</span>
           <span class="ml-3 font-bold text-white text-2xl">PKR ${finalPrice.toLocaleString()}</span>
           <p class="text-xs text-emerald-400 font-medium mt-1">✓ ${tierLabel[discountTier]} — 20% off applied</p>`
        : `<span class="font-bold text-white text-2xl">PKR ${basePrice.toLocaleString()}</span>`;

    // --- 4. Stripe init ---
    const stripe = Stripe('pk_test_51SzjRkEwB0DEiMPKHSNy9YBajvkWmYr3ISJ7NavD7Jlzc84PX0rXQGntgKgQK8lgLWaXslcCdvfn6gIsmXlO2SH500RzmYyuZB');
    const elements = stripe.elements();
    const style = {
        base: {
            color: "#ffffff",
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            fontSmoothing: "antialiased",
            fontSize: "16px",
            iconColor: "#60a5fa",
            "::placeholder": { color: "#9ca3af" }
        },
        invalid: { color: "#f87171", iconColor: "#f87171" }
    };
    const cardElement = elements.create('card', { style: style });
    cardElement.mount('#card-element');

    const payButton        = document.getElementById('submit-button');
    const buttonText       = document.getElementById('button-text');
    const spinner          = document.getElementById('spinner');
    const message          = document.getElementById('payment-message');
    const formContainer    = document.getElementById('form-container');
    const successContainer = document.getElementById('success-container');

    function populateReceipt(txnId) {
        const now = new Date();
        const receiptNo = '#CRT-' + (bookingID
            ? bookingID.replace(/-/g, '').slice(-8).toUpperCase()
            : now.getTime().toString(36).toUpperCase().slice(-8));
        const payDateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                         + '  ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const bookDateStr = date
            ? new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const datePart   = (date || now.toISOString().split('T')[0]).replace(/-/g, '');
        const timePart   = (timeSlot.split(/[-–]/)[0] || '').trim().replace(':', '') || '0000';
        const uniqSuffix = bookingID ? bookingID.replace(/-/g, '').slice(-4).toUpperCase() : now.getTime().toString(36).toUpperCase().slice(-4);

        document.getElementById('r-receipt-no').textContent = receiptNo;
        document.getElementById('r-pay-date').textContent   = payDateStr;
        document.getElementById('r-txn-id').textContent     = txnId || '—';
        document.getElementById('r-court').textContent      = courtName;
        document.getElementById('r-time').textContent       = timeSlot;
        document.getElementById('r-book-date').textContent  = bookDateStr;
        document.getElementById('r-player').textContent     = localStorage.getItem('playerName') || 'Guest';
        document.getElementById('r-booking-id').textContent = `BK-${datePart}-${timePart}-${uniqSuffix}`;
        document.getElementById('r-base').textContent       = `PKR ${basePrice.toLocaleString()}`;
        document.getElementById('r-total').textContent      = `PKR ${finalPrice.toLocaleString()}`;
        if (isPeak) document.getElementById('r-peak-row').classList.remove('hidden');
        if (isVerified) {
            const tierLabel = { STUDENT: '🎓 Student', SENIOR: '🧓 Senior', FAMILY: '👨‍👩‍👧 Family' };
            document.getElementById('r-discount-label').textContent = `${tierLabel[discountTier] || 'Verified'} Discount`;
            document.getElementById('r-discount-row').classList.remove('hidden');
        }
    }

    const setLoading = (isLoading) => {
        if (isLoading) {
            payButton.disabled = true;
            buttonText.textContent = "Processing...";
            spinner.classList.remove('hidden');
        } else {
            payButton.disabled = false;
            buttonText.textContent = "Confirm Booking";
            spinner.classList.add('hidden');
        }
    };

    payButton.addEventListener('click', async () => {
        setLoading(true);
        message.textContent = "";

        try {
            // 1. Create payment intent for the actual amount
            const response = await fetch(`${PAYMENT_API}/create-payment-intent`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ amount: finalPrice })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            // 2. Run Stripe confirmation
            const result = await stripe.confirmCardPayment(data.clientSecret, {
                payment_method: { card: cardElement }
            });

            if (result.error) {
                message.textContent = result.error.message;
                setLoading(false);
                return;
            }

            if (result.paymentIntent.status === 'succeeded') {
                // 3. Mark the booking as CONFIRMED (so scheduler doesn't auto-cancel it)
                if (bookingID && !bookingID.startsWith('MOCK-')) {
                    try {
                        await fetch(`${BOOKING_API}/${bookingID}/confirm`, { method: 'PUT' });
                    } catch { /* booking confirm failed but payment went through — non-fatal */ }
                }

                // 4. Populate receipt, then reveal
                populateReceipt(result.paymentIntent.id);
                formContainer.style.opacity = '0';
                setTimeout(() => {
                    formContainer.style.display = 'none';
                    successContainer.classList.remove('hidden');
                    document.getElementById('checkout-card').style.transform = 'scale(0.98)';
                }, 300);
            }
        } catch (error) {
            message.textContent = error.message || "Error connecting to the server.";
            setLoading(false);
        }
    });
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
