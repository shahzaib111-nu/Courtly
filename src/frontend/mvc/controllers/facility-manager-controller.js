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
