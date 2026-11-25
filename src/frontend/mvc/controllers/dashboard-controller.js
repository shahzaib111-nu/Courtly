async function loadVerificationStatus() {
            const email = localStorage.getItem('playerEmail');
            const card  = document.getElementById('verificationStatusCard');

            const states = {
                none: {
                    cls:  'bg-slate-800/40 border-slate-700',
                    html: `<div class="flex items-center justify-between"><div><p class="text-xs text-slate-400 uppercase tracking-wider mb-1">Verification Status</p><p class="text-sm text-slate-300">🪪 Not verified — submit a document to unlock discounts</p></div><a href="verification.html" class="text-xs bg-teal-700 hover:bg-teal-600 px-3 py-1.5 rounded-lg text-white transition-colors">Verify Now →</a></div>`
                },
                PENDING: {
                    cls:  'bg-yellow-900/30 border-yellow-700/60',
                    html: `<p class="text-xs text-yellow-400/70 uppercase tracking-wider mb-1">Verification Status</p><p class="text-sm font-medium text-yellow-300">⏳ Pending — your document is under admin review</p>`
                },
                APPROVED: {
                    cls:  'bg-emerald-900/30 border-emerald-700/60',
                    html: `<p class="text-xs text-emerald-400/70 uppercase tracking-wider mb-1">Verification Status</p><p class="text-sm font-medium text-emerald-300">✓ Verified — 20% discount is active on all bookings</p>`
                },
                REJECTED: (reason) => ({
                    cls:  'bg-rose-900/30 border-rose-700/60',
                    html: `<div class="flex items-center justify-between"><div><p class="text-xs text-rose-400/70 uppercase tracking-wider mb-1">Verification Status</p><p class="text-sm font-medium text-rose-300">✕ Rejected${reason ? ' — ' + reason : ''}</p></div><a href="verification.html" class="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-white transition-colors whitespace-nowrap ml-4">Resubmit →</a></div>`
                })
            };

            const render = (state) => {
                card.className = `backdrop-blur-xl border rounded-xl p-5 ${state.cls}`;
                card.innerHTML = state.html;
                card.classList.remove('hidden');
            };

            if (!email) { render(states.none); return; }

            try {
                const res  = await fetch(`${AUTH_API.replace('/auth', '')}/docs/status?playerEmail=${encodeURIComponent(email)}`);
                if (!res.ok) { render(states.none); return; }
                const docs = await res.json();
                if (!docs.length) { render(states.none); return; }

                const latest = docs[docs.length - 1];
                if (latest.status === 'REJECTED') {
                    render(states.REJECTED(latest.rejectionReason));
                } else {
                    render(states[latest.status] || states.none);
                }
            } catch (_) {
                render(states.none);
            }
        }

        async function loadProfile() {
            const email = localStorage.getItem('playerEmail');
            if (!email) return;

            try {
                const res = await fetch(`${AUTH_API}/profile?email=${encodeURIComponent(email)}`);
                if (!res.ok) return;
                const p = await res.json();

                document.getElementById('profileName').textContent  = p.name      || '—';
                document.getElementById('profileEmail').textContent = p.email     || '—';
                document.getElementById('profileAuthProvider').textContent = oauthModel.signInMethodLabel(p.authProvider);
                document.getElementById('profilePhone').textContent = p.phone     || '—';
                document.getElementById('profileDob').textContent   = p.dateOfBirth
                    ? new Date(p.dateOfBirth).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })
                    : '—';

                const welcomeEl = document.getElementById('welcomeMsg');
                if (welcomeEl) welcomeEl.textContent = `Welcome, ${p.name || 'Player'}`;
                const avatarEl  = document.getElementById('welcomeAvatar');
                if (avatarEl && p.name) avatarEl.textContent = p.name.charAt(0).toUpperCase();

                const tierConfig = {
                    NONE:    { cls: 'bg-slate-700 text-slate-300',                                        label: 'Not Verified'          },
                    STUDENT: { cls: 'bg-indigo-900/60 text-indigo-300 border border-indigo-700/40',       label: '🎓 Student — 20% off'  },
                    SENIOR:  { cls: 'bg-amber-900/60 text-amber-300 border border-amber-700/40',          label: '🧓 Senior — 20% off'   },
                    FAMILY:  { cls: 'bg-teal-900/60 text-teal-300 border border-teal-700/40',             label: '👨‍👩‍👧 Family — 20% off' }
                };
                const tier  = tierConfig[p.discountTier] || tierConfig.NONE;
                const badge = document.getElementById('tierBadge');
                badge.className   = `px-3 py-1.5 rounded-full text-xs font-medium ${tier.cls}`;
                badge.textContent = tier.label;
                badge.classList.remove('hidden');

                const verifyBtn = document.getElementById('verifyNavBtn');
                if (verifyBtn && ['STUDENT', 'SENIOR', 'FAMILY'].includes(p.discountTier)) {
                    verifyBtn.outerHTML = '<span class="text-sm bg-emerald-800/50 text-emerald-300 border border-emerald-700/40 px-4 py-2 rounded-md">✓ Verified</span>';
                }

                document.getElementById('profileCard').classList.remove('hidden');
            } catch (_) {}
        }

        document.addEventListener('DOMContentLoaded', () => {
            loadVerificationStatus();
            loadProfile();
        });
