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
                document.getElementById('profileUsername').textContent = p.username || '—';
                const catDetail = p.category === 'GROUP' && p.groupSize ? ` (${p.groupSize} people${p.leadMemberName ? ', lead: ' + p.leadMemberName : ''})`
                    : p.category === 'FAMILY' && p.familySize ? ` (${p.familySize} members)`
                    : p.category === 'STUDENT' && p.studentId ? ` (ID ${p.studentId})` : '';
                document.getElementById('profileCategory').textContent = profileController.categoryLabel(p.category) + catDetail;
                profileController.current = p;
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

        // ── Edit profile (FR-10) ─────────────────────────────────────────────
        const profileController = {
            current: null,

            categoryLabel(c) {
                return ({ REGULAR: 'Regular', STUDENT: 'Student', SENIOR: 'Senior', FAMILY: 'Family', GROUP: 'Group' })[c] || 'Regular';
            },

            open() {
                const p = this.current || {};
                document.getElementById('editName').value      = p.name || '';
                document.getElementById('editUsername').value  = p.username || '';
                document.getElementById('editPhone').value     = p.phone || '';
                document.getElementById('editDob').value       = p.dateOfBirth || '';
                document.getElementById('editDob').max         = todayIso();
                document.getElementById('editCategory').value  = p.category || 'REGULAR';
                document.getElementById('editGroupSize').value = p.groupSize || '';
                document.getElementById('editFamilySize').value = p.familySize || '';
                document.getElementById('editLeadMember').value = p.leadMemberName || '';
                document.getElementById('editStudentId').value  = p.studentId || '';
                document.getElementById('editUniEmail').value   = p.universityEmail || '';
                this.toggleCategory();
                document.getElementById('profileError').classList.add('hidden');
                const modal = document.getElementById('profileModal');
                modal.classList.remove('hidden'); modal.classList.add('flex');
            },

            /** Shows only the detail fields that belong to the chosen category. */
            toggleCategory() {
                const c = document.getElementById('editCategory').value;
                document.getElementById('editGroupSizeRow').classList.toggle('hidden', c !== 'GROUP');
                document.getElementById('editGroupLeadRow').classList.toggle('hidden', c !== 'GROUP');
                document.getElementById('editFamilyRow').classList.toggle('hidden', c !== 'FAMILY');
                document.getElementById('editStudentRow').classList.toggle('hidden', c !== 'STUDENT');
            },

            close() {
                const modal = document.getElementById('profileModal');
                modal.classList.add('hidden'); modal.classList.remove('flex');
            },

            _error(msg) {
                const el = document.getElementById('profileError');
                el.textContent = msg;
                el.classList.remove('hidden');
            },

            async save() {
                const body = {
                    name:        document.getElementById('editName').value.trim(),
                    username:    document.getElementById('editUsername').value.trim(),
                    phone:       document.getElementById('editPhone').value.trim(),
                    dateOfBirth: document.getElementById('editDob').value,
                    category:    document.getElementById('editCategory').value,
                };
                if (body.category === 'GROUP') {
                    body.groupSize      = Number(document.getElementById('editGroupSize').value);
                    body.leadMemberName = document.getElementById('editLeadMember').value.trim();
                    if (body.leadMemberName && Validate.name(body.leadMemberName))
                        return this._error('Group lead: ' + Validate.name(body.leadMemberName));
                }
                if (body.category === 'FAMILY') {
                    const fs = document.getElementById('editFamilySize').value;
                    if (fs) body.familySize = Number(fs);
                    if (fs && !(body.familySize >= 2 && body.familySize <= 20))
                        return this._error('Family members must be between 2 and 20.');
                }
                if (body.category === 'STUDENT') {
                    body.studentId       = document.getElementById('editStudentId').value.trim();
                    body.universityEmail = document.getElementById('editUniEmail').value.trim();
                    const studentProblem = Validate.studentId(body.studentId) || Validate.universityEmail(body.universityEmail);
                    if (studentProblem) return this._error(studentProblem);
                }

                const isManager = localStorage.getItem('userRole') === 'manager';
                const problem = Validate.name(body.name) || Validate.username(body.username)
                    || Validate.phone(body.phone) || Validate.dateOfBirth(body.dateOfBirth, isManager ? 18 : 5);
                if (problem) return this._error(problem);
                body.phone = Validate.normalizePhone(body.phone);
                if (body.category === 'GROUP' && !(body.groupSize >= 2 && body.groupSize <= 50))
                    return this._error('Enter the number of people in your group (2-50).');

                const btn = document.getElementById('saveProfileBtn');
                btn.disabled = true; btn.textContent = 'Saving…';
                try {
                    const res  = await fetch(`${AUTH_API}/profile`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) return this._error(apiErrorText(data, 'Your profile could not be saved.'));
                    localStorage.setItem('playerName', data.name || body.name);
                    this.close();
                    await loadProfile();
                    if (typeof showPopup === 'function') showPopup('Profile updated.');
                } catch {
                    this._error(`Cannot connect to server. Make sure the backend is running at ${API_BASE}.`);
                } finally {
                    btn.disabled = false; btn.textContent = 'Save Changes';
                }
            }
        };

        // ── Payment history (FR-26) ──────────────────────────────────────────
        const paymentHistoryController = {
            async load() {
                const box = document.getElementById('paymentHistoryContainer');
                const playerID = localStorage.getItem('playerID');
                if (!box || !playerID) return;
                const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
                const pkr = n => `PKR ${Math.round(Number(n) || 0).toLocaleString()}`;
                try {
                    const res = await fetch(`${API_BASE}/api/payments/player/${encodeURIComponent(playerID)}`);
                    if (!res.ok) throw new Error();
                    const payments = await res.json();
                    if (!payments.length) {
                        box.innerHTML = '<p class="text-slate-400 text-sm">No payments yet. Paid bookings and their receipts will appear here.</p>';
                        return;
                    }
                    box.innerHTML = `
                        <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead><tr class="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-700">
                                <th class="py-2 pr-4">Receipt</th><th class="py-2 pr-4">Court</th><th class="py-2 pr-4">Session</th>
                                <th class="py-2 pr-4">Paid</th><th class="py-2 pr-4">Card</th><th class="py-2 pr-4">Status</th><th class="py-2"></th>
                            </tr></thead>
                            <tbody class="divide-y divide-slate-700/50">
                            ${payments.map(p => {
                                const paidAt = p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                                const refunded = p.status === 'REFUNDED';
                                return `<tr>
                                    <td class="py-3 pr-4 font-mono text-xs text-slate-300">${esc(p.receiptNo)}</td>
                                    <td class="py-3 pr-4 text-slate-200">${esc(p.courtName)}</td>
                                    <td class="py-3 pr-4 text-slate-400 text-xs">${esc(p.bookingDate || '—')}<br>${esc(p.timeSlot || '')}</td>
                                    <td class="py-3 pr-4 text-white font-semibold">${pkr(p.amountPaid)}<br><span class="text-xs text-slate-500 font-normal">${paidAt}</span></td>
                                    <td class="py-3 pr-4 text-slate-400 text-xs">${esc((p.cardBrand || '').toUpperCase())} ${esc(p.maskedCard || '')}</td>
                                    <td class="py-3 pr-4"><span class="px-2 py-0.5 rounded-full text-xs font-medium ${refunded
                                        ? 'bg-sky-900/50 text-sky-300' : 'bg-emerald-900/50 text-emerald-300'}">${refunded ? 'Refunded' : 'Paid'}</span></td>
                                    <td class="py-3 text-right">${refunded ? '' : `<a href="checkout.html?bookingID=${encodeURIComponent(p.bookingID)}"
                                        class="text-xs text-indigo-400 hover:text-indigo-300 whitespace-nowrap">View receipt →</a>`}</td>
                                </tr>`;
                            }).join('')}
                            </tbody>
                        </table>
                        </div>`;
                } catch {
                    box.innerHTML = '<p class="text-rose-400 text-sm">Could not load your payment history.</p>';
                }
            }
        };

        document.addEventListener('DOMContentLoaded', () => {
            loadVerificationStatus();
            loadProfile();
            paymentHistoryController.load();
        });
