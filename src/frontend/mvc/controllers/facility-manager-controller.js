(function checkManagerApproval() {
            const status   = localStorage.getItem('accountStatus');
            const playerID = localStorage.getItem('playerID');
            if (status !== 'PENDING_APPROVAL' && status !== 'REJECTED') return;

            // Hide the full manager interface
            document.querySelector('main').classList.add('hidden');

            // Build restricted view
            const restricted = document.createElement('div');
            restricted.className = 'relative z-10 max-w-xl mx-auto mt-24 px-6';
            restricted.innerHTML = `
                <div class="bg-slate-800/80 border border-slate-700 rounded-2xl p-8 text-center shadow-2xl">
                    <div class="text-5xl mb-4">${status === 'REJECTED' ? '🚫' : '🔒'}</div>
                    <h2 class="text-xl font-bold text-white mb-2">
                        ${status === 'REJECTED' ? 'Registration Not Approved' : 'Account Pending Approval'}
                    </h2>
                    <p class="text-slate-400 text-sm mb-6">
                        ${status === 'REJECTED'
                            ? 'Your Arena Manager registration was not approved. Check your notifications for the reason.'
                            : 'Your Arena Manager account is awaiting admin approval. You will receive a notification once a decision has been made.'}
                    </p>
                    <p class="text-slate-500 text-xs mb-6">
                        Your notification bell above is active — watch for an update from the admin.
                    </p>
                    <button id="checkStatusBtn"
                        class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition">
                        Check Approval Status
                    </button>
                </div>`;
            document.body.appendChild(restricted);

            document.getElementById('checkStatusBtn').addEventListener('click', async () => {
                const btn = document.getElementById('checkStatusBtn');
                btn.textContent = 'Checking…';
                btn.disabled = true;
                try {
                    const res  = await fetch(`${API_BASE}/api/auth/account-status?playerID=${encodeURIComponent(playerID)}`);
                    const data = await res.json();
                    if (data.accountStatus === 'Active') {
                        localStorage.setItem('accountStatus', 'Active');
                        window.location.reload();
                    } else {
                        btn.textContent = 'Still Pending';
                        setTimeout(() => { btn.textContent = 'Check Approval Status'; btn.disabled = false; }, 2000);
                    }
                } catch (_) {
                    btn.textContent = 'Error — Try Again';
                    btn.disabled = false;
                }
            });

            // Auto-poll every 30 minutes
            setInterval(async () => {
                try {
                    const res  = await fetch(`${API_BASE}/api/auth/account-status?playerID=${encodeURIComponent(playerID)}`);
                    const data = await res.json();
                    if (data.accountStatus === 'Active') {
                        localStorage.setItem('accountStatus', 'Active');
                        window.location.reload();
                    }
                } catch (_) {}
            }, 30 * 60 * 1000);
        })();


// ── My Facility (class diagram: Facility; FR-32 update facility information) ──
const facilityInfoController = {
    facility: null,

    async load() {
        if (!document.getElementById('facilityCard')) return;
        try {
            const res = await fetch(`${API_BASE}/api/facilities/mine`);
            if (!res.ok) throw new Error();
            this.facility = await res.json();
            this.render();
        } catch {
            document.getElementById('facilityName').textContent = 'Facility unavailable';
        }
    },

    render() {
        const f = this.facility;
        document.getElementById('facilityName').textContent     = f.name;
        document.getElementById('facilityLocation').textContent = f.location ? `📍 ${f.location}` : '📍 Location not set yet: click Edit Facility';
        document.getElementById('facilityHours').textContent    = `${f.openingTime} – ${f.closingTime}`;
        const st = document.getElementById('facilityStatus');
        st.textContent = f.operatingStatus === 'OPEN' ? 'Open now' : 'Closed now';
        st.className   = 'ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ' +
            (f.operatingStatus === 'OPEN' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-700 text-slate-300');
        document.getElementById('facilityRating').textContent =
            f.averageRating != null ? `★ ${f.averageRating}` : '—';
    },

    edit() {
        const f = this.facility || {};
        document.getElementById('facNameInput').value     = f.name || '';
        document.getElementById('facLocationInput').value = f.location || '';
        document.getElementById('facOpenInput').value     = f.openingTime || '08:00';
        document.getElementById('facCloseInput').value    = f.closingTime || '22:00';
        document.getElementById('facilityError').classList.add('hidden');
        document.getElementById('facilityView').classList.add('hidden');
        document.getElementById('facilityForm').classList.remove('hidden');
    },

    cancel() {
        document.getElementById('facilityForm').classList.add('hidden');
        document.getElementById('facilityView').classList.remove('hidden');
    },

    async save() {
        const body = {
            name:        document.getElementById('facNameInput').value.trim(),
            location:    document.getElementById('facLocationInput').value.trim(),
            openingTime: document.getElementById('facOpenInput').value,
            closingTime: document.getElementById('facCloseInput').value,
        };
        const err = document.getElementById('facilityError');
        const btn = document.getElementById('facSaveBtn');
        btn.disabled = true; btn.textContent = 'Saving…';
        try {
            const res  = await fetch(`${API_BASE}/api/facilities/${encodeURIComponent(this.facility.facilityID)}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                err.textContent = apiErrorText(data, 'The facility could not be saved.');
                err.classList.remove('hidden');
                return;
            }
            this.facility = data;
            this.render();
            this.cancel();
            showPopup('Facility details updated.');
        } catch {
            err.textContent = `Cannot connect to server. Make sure the backend is running at ${API_BASE}.`;
            err.classList.remove('hidden');
        } finally {
            btn.disabled = false; btn.textContent = 'Save Facility';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => facilityInfoController.load());
