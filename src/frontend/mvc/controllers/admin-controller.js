const ADMIN_API = `${API_BASE}/api/admin`;

/** Records a generated/exported report in the report history (SYSTEM_REPORT). Never blocks the UI. */
function logReport(reportType, filters, exportFormat) {
    fetch(`${ADMIN_API}/reports/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType, filters: filters || {}, exportFormat })
    }).then(() => { if (typeof reportHistoryController !== 'undefined') reportHistoryController.load(); })
      .catch(() => {});
}

        function closeAllReportPanels() {
            document.getElementById('reportDetails').classList.add('hidden');
            document.getElementById('panel-feedback').classList.add('hidden');
            document.getElementById('panel-rankings').classList.add('hidden');
            document.getElementById('unified-filter').classList.add('hidden');
            document.querySelectorAll('#reportButtonGrid button[data-report-type]').forEach(b => {
                b.className = 'flex flex-col items-center gap-2 p-4 bg-slate-900/40 border border-slate-700 rounded-xl transition-all hover:border-slate-500';
            });
            if (window._activeBookingsInterval) {
                clearInterval(window._activeBookingsInterval);
                window._activeBookingsInterval = null;
            }
        }

        function showFilterFor(type) {
            const uf = document.getElementById('unified-filter');
            const fm = document.getElementById('filter-main');
            const ff = document.getElementById('filter-feedback');
            const fr = document.getElementById('filter-rankings');
            fm.classList.add('hidden');
            ff.classList.add('hidden');
            fr.classList.add('hidden');
            uf.classList.remove('hidden');
            uf.dataset.activeType = type;
            if (type === 'FACILITY_FEEDBACK') {
                ff.classList.remove('hidden');
            } else if (type === 'PLAYER_RANKINGS') {
                fr.classList.remove('hidden');
            } else {
                fm.classList.remove('hidden');
            }
        }

        function _activeReportType() {
            const uf = document.getElementById('unified-filter');
            return uf.dataset.activeType || (adminController && adminController.selectedReportType) || 'COURT_UTILIZATION';
        }

        function generateActiveReport() {
            const type = _activeReportType();
            if (type === 'FACILITY_FEEDBACK') {
                feedbackController._applyFilters();
            } else if (type === 'PLAYER_RANKINGS') {
                rankingsController.generate();
            } else {
                const from = document.getElementById('reportStartDate').value;
                const to   = document.getElementById('reportEndDate').value;
                if (from && to && from >= to) { showPopup('"From" date must be before the "To" date.'); return; }
                adminController.loadReport(type);
            }
        }

        function exportActivePDF() {
            const type = _activeReportType();
            if (type === 'FACILITY_FEEDBACK') {
                feedbackController._exportPDF();
            } else if (type === 'PLAYER_RANKINGS') {
                rankingsController.exportPDF();
            } else {
                adminController.downloadPDF();
            }
        }

        function resetMainReport() {
            document.getElementById('reportStartDate').value = '';
            document.getElementById('reportEndDate').value = '';
            const ct = document.getElementById('reportCourtType');
            if (ct) ct.value = '';
        }

        async function loadPaymentHistory() {
            const from = document.getElementById('phFrom').value;
            const to   = document.getElementById('phTo').value;
            if (from && to && from >= to) { showPopup('"From" date must be before the "To" date.'); return; }
            const tbody = document.getElementById('phTableBody');
            tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400 text-sm">Loading...</td></tr>';
            try {
                let url = `${API_BASE}/api/admin/payment-history`;
                const params = new URLSearchParams();
                if (from) params.set('from', from);
                if (to)   params.set('to', to);
                if (params.toString()) url += '?' + params.toString();
                const res = await fetch(url);
                const data = await res.json();
                if (!data.length) {
                    tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-500 text-sm">No payments found for the selected range.</td></tr>';
                    return;
                }
                tbody.innerHTML = data.map(p => {
                    const dt = p.paymentDateTime ? p.paymentDateTime.replace('T', ' ').substring(0, 16) : '—';
                    return `<tr class="hover:bg-slate-700/20 transition-colors border-b border-slate-700/40">
                        <td class="px-4 py-3 text-slate-200">${p.payerName || '—'}</td>
                        <td class="px-4 py-3 text-slate-400">${dt}</td>
                        <td class="px-4 py-3 text-slate-300">${p.courtName || '—'}</td>
                        <td class="px-4 py-3 text-slate-400">${p.bookingDate || '—'}</td>
                        <td class="px-4 py-3 text-slate-400">${p.timeSlot || '—'}</td>
                        <td class="px-4 py-3 text-teal-400 font-semibold">₨${(p.amountPaid || 0).toLocaleString()}</td>
                    </tr>`;
                }).join('');
            } catch (e) {
                tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-red-400 text-sm">Failed to load payment history. Make sure the backend is running.</td></tr>';
            }
        }

        let _activeBookings = [];

        const adminController = {
            pendingDocID: null,

            async loadPendingDocs() {
                const loading = document.getElementById('docsLoading');
                const empty = document.getElementById('docsEmpty');
                const tableWrap = document.getElementById('docsTableWrap');
                const tbody = document.getElementById('docsTableBody');

                loading.classList.remove('hidden');
                empty.classList.add('hidden');
                tableWrap.classList.add('hidden');

                try {
                    const res = await fetch(`${ADMIN_API}/pending-docs`);
                    const docs = await res.json();

                    document.getElementById('countPending').textContent = docs.length;
                    loading.classList.add('hidden');

                    if (docs.length === 0) {
                        empty.classList.remove('hidden');
                        return;
                    }

                    tbody.innerHTML = '';
                    docs.forEach(doc => {
                        const date = doc.uploadDate ? new Date(doc.uploadDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                        const docTypeLabel = { STUDENT_ID: 'Student ID', SENIOR_CARD: 'Senior Card', FAMILY_CARD: 'Family Card' }[doc.docType] || doc.docType;
                        const playerEmail = doc.player?.email || '—';

                        const row = document.createElement('tr');
                        row.id = `row-${doc.docID}`;
                        row.className = 'hover:bg-slate-700/20 transition-colors';
                        row.innerHTML = `
                            <td class="px-6 py-4 font-mono text-xs text-slate-400">${doc.docID}</td>
                            <td class="px-6 py-4 text-slate-200">${playerEmail}</td>
                            <td class="px-6 py-4">
                                <span class="px-2 py-1 bg-indigo-900/50 text-indigo-300 text-xs rounded-full">${docTypeLabel}</span>
                            </td>
                            <td class="px-6 py-4 text-slate-400 text-xs">${date}</td>
                            <td class="px-6 py-4">
                                <div class="flex gap-2">
                                    <button onclick="window.open('${API_BASE}/api/docs/view/${doc.docID}', '_blank')"
                                        class="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs font-medium rounded-lg transition-all active:scale-95">
                                        👁 View
                                    </button>
                                    <button onclick="adminController.approve('${doc.docID}')"
                                        class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95">
                                        ✓ Approve
                                    </button>
                                    <button onclick="adminController.openRejectModal('${doc.docID}')"
                                        class="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white text-xs font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-rose-500/20 active:scale-95">
                                        ✕ Reject
                                    </button>
                                </div>
                            </td>
                        `;
                        tbody.appendChild(row);
                    });

                    tableWrap.classList.remove('hidden');

                } catch (err) {
                    loading.classList.add('hidden');
                    empty.classList.remove('hidden');
                    empty.innerHTML = `<p class="text-4xl mb-3">⚠️</p><p class="text-red-400 font-medium">Failed to load</p><p class="text-slate-500 text-sm mt-1">Make sure the backend is running at ${API_BASE}.</p>`;
                }
            },

            async approve(docID) {
                const row = document.getElementById(`row-${docID}`);
                const btn = row.querySelector('button');
                btn.textContent = 'Processing…';
                btn.disabled = true;

                try {
                    const res = await fetch(`${ADMIN_API}/verify-doc?docID=${encodeURIComponent(docID)}&newStatus=APPROVED`, { method: 'POST' });
                    if (!res.ok) throw new Error(await res.text());

                    row.classList.add('opacity-0', 'transition-opacity', 'duration-500');
                    setTimeout(() => {
                        row.remove();
                        const remaining = document.getElementById('docsTableBody').children.length;
                        document.getElementById('countPending').textContent = remaining;
                        if (remaining === 0) {
                            document.getElementById('docsTableWrap').classList.add('hidden');
                            document.getElementById('docsEmpty').classList.remove('hidden');
                        }
                    }, 500);
                } catch (err) {
                    alert('Approval failed: ' + err.message);
                    btn.textContent = '✓ Approve';
                    btn.disabled = false;
                }
            },

            openRejectModal(docID) {
                this.pendingDocID = docID;
                document.getElementById('rejectReason').value = '';
                document.getElementById('rejectModal').classList.remove('hidden');
            },

            closeRejectModal() {
                this.pendingDocID = null;
                document.getElementById('rejectModal').classList.add('hidden');
            },

            async confirmReject() {
                const reason = document.getElementById('rejectReason').value.trim();
                if (!reason) {
                    document.getElementById('rejectReason').focus();
                    return;
                }

                const modal = document.getElementById('rejectModal');
                if (modal._mgrMode && this._pendingManagerRejectID) {
                    const playerID = this._pendingManagerRejectID;
                    modal._mgrMode = false;
                    this._pendingManagerRejectID = null;
                    this.closeRejectModal();
                    await this.approveManager(playerID, 'REJECT', reason);
                    return;
                }

                const docID = this.pendingDocID;
                this.closeRejectModal();

                const row = document.getElementById(`row-${docID}`);

                try {
                    const params = new URLSearchParams({ docID, newStatus: 'REJECTED', rejectionReason: reason });
                    const res = await fetch(`${ADMIN_API}/verify-doc?${params}`, { method: 'POST' });
                    if (!res.ok) throw new Error(await res.text());

                    row.classList.add('opacity-0', 'transition-opacity', 'duration-500');
                    setTimeout(() => {
                        row.remove();
                        const remaining = document.getElementById('docsTableBody').children.length;
                        document.getElementById('countPending').textContent = remaining;
                        if (remaining === 0) {
                            document.getElementById('docsTableWrap').classList.add('hidden');
                            document.getElementById('docsEmpty').classList.remove('hidden');
                        }
                    }, 500);
                } catch (err) {
                    alert('Rejection failed: ' + err.message);
                }
            },

            async loadStats() {
                try {
                    const res = await fetch(`${ADMIN_API}/stats`);
                    const stats = await res.json();
                    document.getElementById('countPending').textContent = stats.pendingCount;
                    document.getElementById('countApprovedToday').textContent = stats.approvedToday;
                    document.getElementById('countRejectedToday').textContent = stats.rejectedToday;
                } catch (_) {}
            },

            async loadDeletionRequests() {
                const loading = document.getElementById('deletionLoading');
                const empty = document.getElementById('deletionEmpty');
                const tableWrap = document.getElementById('deletionTableWrap');
                const tbody = document.getElementById('deletionTableBody');

                loading.classList.remove('hidden');
                empty.classList.add('hidden');
                tableWrap.classList.add('hidden');

                try {
                    const res = await fetch(`${ADMIN_API}/deletion-requests`);
                    const requests = await res.json();
                    loading.classList.add('hidden');

                    if (!requests.length) { empty.classList.remove('hidden'); return; }

                    tbody.innerHTML = '';
                    requests.forEach(r => {
                        const date = r.deletionRequestedAt
                            ? new Date(r.deletionRequestedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—';
                        const urgencyCls = r.daysRemaining <= 1 ? 'text-rose-400 font-bold' : r.daysRemaining <= 3 ? 'text-yellow-400' : 'text-slate-300';
                        const row = document.createElement('tr');
                        row.id = `del-row-${CSS.escape(r.email)}`;
                        row.className = 'hover:bg-slate-700/20 transition-colors';
                        row.innerHTML = `
                            <td class="px-6 py-4 text-slate-200">${r.name}</td>
                            <td class="px-6 py-4 text-slate-300 text-xs font-mono">${r.email}</td>
                            <td class="px-6 py-4 text-slate-400 text-xs">${date}</td>
                            <td class="px-6 py-4"><span class="${urgencyCls}">${r.daysRemaining}d left</span></td>
                            <td class="px-6 py-4">
                                <div class="flex gap-2">
                                    <button onclick="adminController.processDeletion('${r.email}', 'DELETE_NOW')"
                                        class="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white text-xs font-medium rounded-lg transition-all active:scale-95">
                                        🗑 Delete Now
                                    </button>
                                    <button onclick="adminController.processDeletion('${r.email}', 'ARCHIVE')"
                                        class="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs font-medium rounded-lg transition-all active:scale-95">
                                        📦 Archive
                                    </button>
                                    <button onclick="adminController.processDeletion('${r.email}', 'CANCEL')"
                                        class="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg transition-all active:scale-95">
                                        ↩ Cancel Deletion
                                    </button>
                                </div>
                            </td>
                        `;
                        tbody.appendChild(row);
                    });
                    tableWrap.classList.remove('hidden');
                } catch (_) {
                    loading.classList.add('hidden');
                    empty.classList.remove('hidden');
                }
            },

            async processDeletion(email, action) {
                const rowId = `del-row-${CSS.escape(email)}`;
                const row = document.getElementById(rowId);
                try {
                    const params = new URLSearchParams({ playerEmail: email, action });
                    const res = await fetch(`${ADMIN_API}/process-deletion?${params}`, { method: 'POST' });
                    if (!res.ok) throw new Error(await res.text());
                    if (row) {
                        row.classList.add('opacity-0', 'transition-opacity', 'duration-500');
                        setTimeout(() => {
                            row.remove();
                            if (!document.getElementById('deletionTableBody').children.length) {
                                document.getElementById('deletionTableWrap').classList.add('hidden');
                                document.getElementById('deletionEmpty').classList.remove('hidden');
                            }
                        }, 500);
                    }
                } catch (err) {
                    alert('Action failed: ' + err.message);
                }
            },

            async loadArchivedAccounts() {
                const loading = document.getElementById('archiveLoading');
                const empty = document.getElementById('archiveEmpty');
                const tableWrap = document.getElementById('archiveTableWrap');
                const tbody = document.getElementById('archiveTableBody');

                loading.classList.remove('hidden');
                empty.classList.add('hidden');
                tableWrap.classList.add('hidden');

                try {
                    const res = await fetch(`${ADMIN_API}/archived-accounts`);
                    const accounts = await res.json();
                    loading.classList.add('hidden');

                    if (!accounts.length) { empty.classList.remove('hidden'); return; }

                    tbody.innerHTML = '';
                    accounts.forEach(a => {
                        const date = a.deletionRequestedAt
                            ? new Date(a.deletionRequestedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—';
                        const row = document.createElement('tr');
                        row.id = `arch-row-${CSS.escape(a.email)}`;
                        row.className = 'hover:bg-slate-700/20 transition-colors';
                        row.innerHTML = `
                            <td class="px-6 py-4 text-slate-200">${a.name}</td>
                            <td class="px-6 py-4 text-slate-300 text-xs font-mono">${a.email}</td>
                            <td class="px-6 py-4 text-slate-400 text-xs">${date}</td>
                            <td class="px-6 py-4">
                                <button onclick="adminController.restoreAccount('${a.email}')"
                                    class="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg transition-all active:scale-95">
                                    ↩ Restore Account
                                </button>
                            </td>
                        `;
                        tbody.appendChild(row);
                    });
                    tableWrap.classList.remove('hidden');
                } catch (_) {
                    loading.classList.add('hidden');
                    empty.classList.remove('hidden');
                }
            },

            async restoreAccount(email) {
                const rowId = `arch-row-${CSS.escape(email)}`;
                const row = document.getElementById(rowId);
                try {
                    const params = new URLSearchParams({ playerEmail: email, action: 'CANCEL' });
                    const res = await fetch(`${ADMIN_API}/process-deletion?${params}`, { method: 'POST' });
                    if (!res.ok) throw new Error(await res.text());
                    if (row) {
                        row.classList.add('opacity-0', 'transition-opacity', 'duration-500');
                        setTimeout(() => {
                            row.remove();
                            if (!document.getElementById('archiveTableBody').children.length) {
                                document.getElementById('archiveTableWrap').classList.add('hidden');
                                document.getElementById('archiveEmpty').classList.remove('hidden');
                            }
                        }, 500);
                    }
                } catch (err) {
                    alert('Restore failed: ' + err.message);
                }
            },

            async loadPendingManagers() {
                const loading  = document.getElementById('managersLoading');
                const empty    = document.getElementById('managersEmpty');
                const tableWrap = document.getElementById('managersTableWrap');
                const tbody    = document.getElementById('managersTableBody');
                loading.classList.remove('hidden');
                empty.classList.add('hidden');
                tableWrap.classList.add('hidden');
                try {
                    const res  = await fetch(`${ADMIN_API}/pending-managers`);
                    const data = await res.json();
                    loading.classList.add('hidden');
                    tbody.innerHTML = '';
                    if (!data.length) { empty.classList.remove('hidden'); return; }
                    data.forEach(m => {
                        const row = document.createElement('tr');
                        row.id = `mgr-row-${CSS.escape(m.userID)}`;
                        row.className = 'hover:bg-slate-700/10 transition-colors';
                        row.innerHTML = `
                            <td class="px-4 py-3 text-slate-200">${m.name}</td>
                            <td class="px-4 py-3 text-slate-400">${m.email}</td>
                            <td class="px-4 py-3 text-slate-400">${m.phone || '—'}</td>
                            <td class="px-4 py-3 text-slate-400">${m.dateOfBirth || '—'}</td>
                            <td class="px-4 py-3 flex gap-2">
                                <button onclick="adminController.approveManager('${m.userID}','APPROVE')"
                                    class="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition">
                                    ✓ Approve
                                </button>
                                <button onclick="adminController._openManagerRejectModal('${m.userID}')"
                                    class="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white text-xs font-medium rounded-lg transition">
                                    ✗ Reject
                                </button>
                            </td>`;
                        tbody.appendChild(row);
                    });
                    tableWrap.classList.remove('hidden');
                } catch (_) {
                    loading.classList.add('hidden');
                    empty.classList.remove('hidden');
                }
            },

            async approveManager(playerID, action, reason) {
                const params = new URLSearchParams({ playerID, action });
                if (reason) params.append('rejectionReason', reason);
                try {
                    const res = await fetch(`${ADMIN_API}/approve-manager?${params}`, { method: 'POST' });
                    if (!res.ok) throw new Error(await res.text());
                    const row = document.getElementById(`mgr-row-${CSS.escape(playerID)}`);
                    if (row) {
                        row.classList.add('opacity-0', 'transition-opacity', 'duration-500');
                        setTimeout(() => {
                            row.remove();
                            if (!document.getElementById('managersTableBody').children.length) {
                                document.getElementById('managersTableWrap').classList.add('hidden');
                                document.getElementById('managersEmpty').classList.remove('hidden');
                            }
                        }, 500);
                    }
                } catch (err) {
                    alert('Action failed: ' + err.message);
                }
            },

            _openManagerRejectModal(playerID) {
                this.pendingDocID = null;
                this._pendingManagerRejectID = playerID;
                document.getElementById('rejectReason').value = '';
                const modal = document.getElementById('rejectModal');
                modal._mgrMode = true;
                modal.classList.remove('hidden');
            },

            initReportPanel() {
                const today = new Date();
                const end = today.toISOString().slice(0, 10);
                const start = new Date(today);
                start.setDate(start.getDate() - 7);
                document.getElementById('reportStartDate').value = start.toISOString().slice(0, 10);
                document.getElementById('reportEndDate').value = end;

                this.selectedReportType = 'COURT_UTILIZATION';
                this.markSelectedReport('COURT_UTILIZATION');
                this.loadCourtTypes();
                this.loadReport('COURT_UTILIZATION');
                showFilterFor('COURT_UTILIZATION');
            },

            markSelectedReport(type) {
                const buttons = document.querySelectorAll('#reportButtonGrid button[data-report-type]');
                buttons.forEach(button => {
                    const isSelected = button.dataset.reportType === type;
                    button.className = isSelected
                        ? 'flex flex-col items-center gap-2 p-4 bg-slate-700 border border-indigo-500 rounded-xl shadow ring-1 ring-indigo-500/30'
                        : 'flex flex-col items-center gap-2 p-4 bg-slate-900/40 border border-slate-700 rounded-xl transition-all hover:border-slate-500';
                });

                // Show court type dropdown only for COURT_UTILIZATION
                const courtTypeLabel = document.getElementById('courtTypeLabel');
                if (type === 'COURT_UTILIZATION') {
                    courtTypeLabel.classList.remove('hidden');
                } else {
                    courtTypeLabel.classList.add('hidden');
                }
            },

            async loadCourtTypes() {
                try {
                    const res = await fetch(`${API_BASE}/api/courts`);
                    const courts = await res.json();
                    const select = document.getElementById('reportCourtType');
                    select.innerHTML = '<option value="">All Courts</option>';
                    const sportTypes = [...new Set(courts.map(c => c.sportType))].sort();
                    sportTypes.forEach(type => {
                        const option = document.createElement('option');
                        option.value = type;
                        option.textContent = type;
                        select.appendChild(option);
                    });
                } catch (err) {
                    console.error('Failed to load court types:', err);
                }
            },

            async loadReport(type) {
                if (!type) {
                    type = this.selectedReportType || 'COURT_UTILIZATION';
                }
                closeAllReportPanels();
                showFilterFor(type);
                this.selectedReportType = type;
                this.markSelectedReport(type);

                const startDate = document.getElementById('reportStartDate').value;
                const endDate = document.getElementById('reportEndDate').value;
                const courtType = document.getElementById('reportCourtType').value;
                const reportDetails = document.getElementById('reportDetails');
                const header = document.getElementById('reportTypeTitle');
                const rangeLabel = document.getElementById('reportRangeLabel');
                const statusBadge = document.getElementById('reportStatusBadge');
                const content = document.getElementById('reportContent');

                header.textContent = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                rangeLabel.textContent = `For ${startDate || 'start'} → ${endDate || 'end'}`;
                statusBadge.textContent = 'Loading…';
                content.innerHTML = '<div class="py-12 text-center text-slate-400 animate-pulse">Generating report inside this card…</div>';
                reportDetails.classList.remove('hidden');

                try {
                    const params = new URLSearchParams({ type, startDate, endDate });
                    if (courtType) params.append('courtType', courtType);

                    const fetchReport = fetch(`${ADMIN_API}/reports?${params}`);
                    const fetchActive = type === 'COURT_UTILIZATION'
                        ? fetch(`${ADMIN_API}/active-bookings`)
                        : Promise.resolve(null);

                    const [res, activeRes] = await Promise.all([fetchReport, fetchActive]);
                    if (!res.ok) throw new Error(await res.text());
                    const report = await res.json();

                    if (activeRes) {
                        _activeBookings = activeRes.ok ? await activeRes.json() : [];
                    } else {
                        _activeBookings = [];
                    }

                    statusBadge.textContent = 'Generated';
                    content.innerHTML = this.renderReportContent(type, report);
                    this.renderChart(type, report);

                    if (type === 'COURT_UTILIZATION') {
                        if (window._activeBookingsInterval) clearInterval(window._activeBookingsInterval);
                        window._activeBookingsInterval = setInterval(async () => {
                            try {
                                const r = await fetch(`${ADMIN_API}/active-bookings`);
                                if (r.ok) {
                                    _activeBookings = await r.json();
                                    const card = document.getElementById('activeBookingsCard');
                                    if (card) card.innerHTML = adminController._renderActiveBookingsTable();
                                }
                            } catch (_) {}
                        }, 30 * 60 * 1000);
                    }
                } catch (err) {
                    statusBadge.textContent = 'Failed';
                    content.innerHTML = `<div class="rounded-2xl bg-rose-900/70 border border-rose-600 p-6 text-sm text-rose-200">Unable to load the report. ${err.message}</div>`;
                }
            },

            renderReportContent(type, report) {
                const highlight = (value) => `<span class="text-white font-semibold">${value}</span>`;

                if (type === 'COURT_UTILIZATION') {
                    const summary = `
                        <div class="grid gap-3 md:grid-cols-4">
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-xs uppercase tracking-wider text-slate-400">Total courts</p>
                                <p class="mt-3 text-3xl font-semibold text-white">${report.totalCourts || 0}</p>
                            </div>
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-xs uppercase tracking-wider text-slate-400">Past bookings</p>
                                <p class="mt-3 text-3xl font-semibold text-white">${report.pastBookings || 0}</p>
                            </div>
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-xs uppercase tracking-wider text-slate-400">Upcoming bookings</p>
                                <p class="mt-3 text-3xl font-semibold text-blue-400">${report.upcomingBookings || 0}</p>
                            </div>
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-xs uppercase tracking-wider text-slate-400">Total booked hours</p>
                                <p class="mt-3 text-3xl font-semibold text-white">${Math.round(report.totalBookedHours || 0)}</p>
                            </div>
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-xs uppercase tracking-wider text-slate-400">Average utilization</p>
                                <p class="mt-3 text-3xl font-semibold text-white">${Math.round(report.averageUtilization || 0)}%</p>
                            </div>
                        </div>
                    `;
                    const topCourts = report.topCourts || [];
                    const rows = topCourts.map(court => `
                        <tr class="hover:bg-slate-700/20 transition-colors">
                            <td class="px-4 py-3 text-slate-200">${court.courtName}</td>
                            <td class="px-4 py-3 text-slate-400">${Math.round(court.bookedSlots)}</td>
                            <td class="px-4 py-3 text-slate-400">${Math.round(court.utilizationPercent)}%</td>
                        </tr>
                    `).join('');

                    return `
                        <div class="rounded-2xl bg-slate-800/90 border border-cyan-700/60 p-4">
                            <p class="text-sm text-cyan-400 uppercase tracking-wider mb-3 font-semibold">📅 Active & Upcoming Bookings</p>
                            <div id="activeBookingsCard">${this._renderActiveBookingsTable()}</div>
                        </div>
                        ${summary}
                        <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                            <p class="text-sm text-slate-400 uppercase tracking-wider mb-3">Top courts by occupancy</p>
                            <div class="overflow-x-auto">
                                <table class="w-full text-sm">
                                    <thead>
                                        <tr class="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-700">
                                            <th class="px-4 py-3">Court</th>
                                            <th class="px-4 py-3">Booked slots</th>
                                            <th class="px-4 py-3">Utilization</th>
                                        </tr>
                                    </thead>
                                    <tbody>${rows || '<tr><td colspan="3" class="px-4 py-4 text-slate-500">No booking data found for the selected range.</td></tr>'}</tbody>
                                </table>
                            </div>
                        </div>
                        <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                            <p class="text-sm text-slate-400 uppercase tracking-wider mb-3">Court Utilization Chart</p>
                            <div class="h-72">
                                <canvas id="courtUtilizationChart" class="w-full h-full"></canvas>
                            </div>
                        </div>`;
                }

                if (type === 'REVENUE_SUMMARY') {
                    const income      = (report.totalRevenue    || 0).toFixed(2);
                    const baseIncome  = (report.baseRevenue     || 0).toFixed(2);
                    const extraIncome = Math.max(0, report.peakWeekendExtra || 0).toFixed(2);
                    const discountIncome = Math.abs(report.discountRevenue || 0).toFixed(2);
                    const count = report.bookingCount || 0;
                    const avg = (report.averageRevenue || 0).toFixed(2);
                    const items = Object.entries(report.revenueBySport || {}).map(([sport, amount]) => `
                        <tr class="hover:bg-slate-700/20 transition-colors">
                            <td class="px-4 py-3 text-slate-200">${sport}</td>
                            <td class="px-4 py-3 text-slate-400">₨${amount.toFixed(2)}</td>
                        </tr>`).join('');

                    return `
                        <div class="grid gap-3 md:grid-cols-5">
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-xs uppercase tracking-wider text-slate-400">Total revenue</p>
                                <p class="mt-3 text-3xl font-semibold text-white">₨${income}</p>
                            </div>
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-xs uppercase tracking-wider text-slate-400">Base revenue</p>
                                <p class="mt-3 text-3xl font-semibold text-slate-300">₨${baseIncome}</p>
                            </div>
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-xs uppercase tracking-wider text-slate-400">Peak + Weekend extra</p>
                                <p class="mt-3 text-3xl font-semibold text-amber-400">₨${extraIncome}</p>
                            </div>
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-xs uppercase tracking-wider text-slate-400">Discounts offered</p>
                                <p class="mt-3 text-3xl font-semibold text-rose-400">₨${discountIncome}</p>
                            </div>
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-xs uppercase tracking-wider text-slate-400">Bookings counted</p>
                                <p class="mt-3 text-3xl font-semibold text-white">${count}</p>
                            </div>
                        </div>
                        <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                            <p class="text-sm text-slate-400 uppercase tracking-wider mb-3">Revenue by sport</p>
                            <div class="overflow-x-auto">
                                <table class="w-full text-sm">
                                    <thead>
                                        <tr class="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-700">
                                            <th class="px-4 py-3">Sport</th>
                                            <th class="px-4 py-3">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody>${items || '<tr><td colspan="2" class="px-4 py-4 text-slate-500">No revenue recorded for the selected range.</td></tr>'}</tbody>
                                </table>
                            </div>
                        </div>
                        <div class="grid gap-4 lg:grid-cols-2">
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4 flex flex-col">
                                <p class="text-sm text-slate-400 uppercase tracking-wider mb-3">Revenue Distribution</p>
                                <div class="h-72">
                                    <canvas id="revenueChart" class="w-full h-full"></canvas>
                                </div>
                            </div>
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4 flex flex-col">
                                <p class="text-sm text-slate-400 uppercase tracking-wider mb-3">Revenue by Sport</p>
                                <div class="h-72">
                                    <canvas id="revenueBreakdownChart" class="w-full h-full"></canvas>
                                </div>
                            </div>
                        </div>`;
                }

                if (type === 'USER_DEMOGRAPHICS') {
                    const tiers = report.discountTierCounts || {};
                    const groups = report.ageGroupCounts || {};
                    const tierRows = Object.entries(tiers).map(([tier, count]) => `
                        <tr class="hover:bg-slate-700/20 transition-colors">
                            <td class="px-4 py-3 text-slate-200">${tier}</td>
                            <td class="px-4 py-3 text-slate-400">${count}</td>
                        </tr>`).join('');
                    const ageRows = Object.entries(groups).map(([group, count]) => `
                        <tr class="hover:bg-slate-700/20 transition-colors">
                            <td class="px-4 py-3 text-slate-200">${group}</td>
                            <td class="px-4 py-3 text-slate-400">${count}</td>
                        </tr>`).join('');

                    return `
                        <div class="grid gap-3 md:grid-cols-4">
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-xs uppercase tracking-wider text-slate-400">Total players</p>
                                <p class="mt-3 text-3xl font-semibold text-white">${report.totalPlayers || 0}</p>
                            </div>
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-xs uppercase tracking-wider text-slate-400">Total managers</p>
                                <p class="mt-3 text-3xl font-semibold text-white">${report.totalManagers || 0}</p>
                            </div>
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-xs uppercase tracking-wider text-slate-400">Active tiers</p>
                                <p class="mt-3 text-3xl font-semibold text-white">${Object.keys(tiers).length}</p>
                            </div>
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-xs uppercase tracking-wider text-slate-400">Age groups</p>
                                <p class="mt-3 text-3xl font-semibold text-white">${Object.keys(groups).length}</p>
                            </div>
                        </div>
                        <div class="grid gap-3 md:grid-cols-2">
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-sm text-slate-400 uppercase tracking-wider mb-3">Discount tier breakdown</p>
                                <div class="overflow-x-auto">
                                    <table class="w-full text-sm">
                                        <tbody>${tierRows || '<tr><td class="px-4 py-4 text-slate-500">No players found.</td></tr>'}</tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-sm text-slate-400 uppercase tracking-wider mb-3">Age group distribution</p>
                                <div class="overflow-x-auto">
                                    <table class="w-full text-sm">
                                        <tbody>${ageRows || '<tr><td class="px-4 py-4 text-slate-500">No players found.</td></tr>'}</tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div class="grid gap-3 md:grid-cols-3">
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-sm text-slate-400 uppercase tracking-wider mb-3">Discount Tiers Chart</p>
                                <canvas id="discountChart" width="400" height="400"></canvas>
                            </div>
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-sm text-slate-400 uppercase tracking-wider mb-3">Age Groups Chart</p>
                                <canvas id="ageChart" width="400" height="400"></canvas>
                            </div>
                            <div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-4">
                                <p class="text-sm text-slate-400 uppercase tracking-wider mb-3">Managers vs Players</p>
                                <canvas id="managersChart" width="400" height="400"></canvas>
                            </div>
                        </div>`;
                }

                return `<div class="rounded-2xl bg-slate-800/90 border border-slate-700 p-6 text-sm text-slate-400">This report type is not supported yet.</div>`;
            },

            _renderActiveBookingsTable() {
                if (!_activeBookings.length) {
                    return '<p class="text-slate-500 text-sm py-2">No active or upcoming bookings.</p>';
                }
                const rows = _activeBookings.map(b => {
                    const paid = b.status === 'CONFIRMED';
                    return `<tr class="hover:bg-slate-700/20 transition-colors">
                        <td class="px-4 py-3 text-slate-200">${b.courtName}</td>
                        <td class="px-4 py-3 text-slate-400">${b.bookingDate}</td>
                        <td class="px-4 py-3 text-slate-400">${b.timeSlot}</td>
                        <td class="px-4 py-3 text-slate-400">${b.playerName}</td>
                        <td class="px-4 py-3">
                            <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${paid ? 'bg-emerald-900/50 text-emerald-400' : 'bg-yellow-900/50 text-yellow-400'}">
                                ${paid ? 'Paid ✓' : 'Unpaid ⏳'}
                            </span>
                        </td>
                    </tr>`;
                }).join('');
                return `<div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-700">
                                <th class="px-4 py-3">Court</th>
                                <th class="px-4 py-3">Date</th>
                                <th class="px-4 py-3">Time Slot</th>
                                <th class="px-4 py-3">Player</th>
                                <th class="px-4 py-3">Payment</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
            },

            renderChart(type, report) {
                if (type === 'COURT_UTILIZATION') {
                    const ctx = document.getElementById('courtUtilizationChart');
                    if (!ctx) return;
                    const topCourts = report.topCourts || [];
                    const palette = [
                        'rgba(59, 130, 246, 0.75)',
                        'rgba(16, 185, 129, 0.75)',
                        'rgba(245, 158, 11, 0.75)',
                        'rgba(239, 68, 68, 0.75)',
                        'rgba(139, 92, 246, 0.75)',
                        'rgba(14, 165, 233, 0.75)',
                        'rgba(20, 184, 166, 0.75)',
                        'rgba(236, 72, 153, 0.75)'
                    ];
                    const borderPalette = [
                        'rgba(59, 130, 246, 1)',
                        'rgba(16, 185, 129, 1)',
                        'rgba(245, 158, 11, 1)',
                        'rgba(239, 68, 68, 1)',
                        'rgba(139, 92, 246, 1)',
                        'rgba(14, 165, 233, 1)',
                        'rgba(20, 184, 166, 1)',
                        'rgba(236, 72, 153, 1)'
                    ];
                    new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: topCourts.map(c => c.courtName),
                            datasets: [{
                                label: 'Booked Slots',
                                data: topCourts.map(c => Math.round(c.bookedSlots)),
                                backgroundColor: topCourts.map((_, i) => palette[i % palette.length]),
                                borderColor: topCourts.map((_, i) => borderPalette[i % borderPalette.length]),
                                borderWidth: 1
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: { color: '#94a3b8', precision: 0 },
                                    grid: { color: '#374151' }
                                },
                                x: {
                                    ticks: { color: '#94a3b8' },
                                    grid: { color: '#374151' }
                                }
                            },
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    callbacks: {
                                        label: context => `${context.dataset.label}: ${Math.round(context.parsed.y)}`
                                    }
                                }
                            }
                        }
                    });
                } else if (type === 'REVENUE_SUMMARY') {
                    const revenueCtx = document.getElementById('revenueChart');
                    const breakdownCtx = document.getElementById('revenueBreakdownChart');
                    const revenueBySport = report.revenueBySport || {};
                    const labels = Object.keys(revenueBySport);
                    const data = Object.values(revenueBySport);

                    if (revenueCtx) {
                        new Chart(revenueCtx, {
                            type: 'doughnut',
                            data: {
                                labels: labels,
                                datasets: [{
                                    data: data,
                                    backgroundColor: [
                                        'rgba(59, 130, 246, 0.8)',
                                        'rgba(16, 185, 129, 0.8)',
                                        'rgba(245, 158, 11, 0.8)',
                                        'rgba(239, 68, 68, 0.8)',
                                        'rgba(139, 92, 246, 0.8)',
                                        'rgba(236, 72, 153, 0.8)',
                                        'rgba(14, 165, 233, 0.8)',
                                        'rgba(20, 184, 166, 0.8)'
                                    ],
                                    borderColor: labels.map(() => 'rgba(255, 255, 255, 0.9)'),
                                    borderWidth: 1
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: {
                                        position: 'bottom',
                                        labels: { color: '#94a3b8', boxWidth: 12, padding: 12 }
                                    }
                                }
                            }
                        });
                    }

                    if (breakdownCtx) {
                        new Chart(breakdownCtx, {
                            type: 'bar',
                            data: {
                                labels: labels,
                                datasets: [{
                                    label: 'Revenue',
                                    data: data,
                                    backgroundColor: 'rgba(56, 189, 248, 0.7)',
                                    borderColor: 'rgba(56, 189, 248, 1)',
                                    borderWidth: 1
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        ticks: { color: '#94a3b8', precision: 0 },
                                        grid: { color: '#374151' }
                                    },
                                    x: {
                                        ticks: { color: '#94a3b8' },
                                        grid: { color: '#374151' }
                                    }
                                },
                                plugins: {
                                    legend: { display: false },
                                    tooltip: {
                                        callbacks: {
                                            label: context => `$${context.parsed.y.toFixed(2)}`
                                        }
                                    }
                                }
                            }
                        });
                    }
                } else if (type === 'USER_DEMOGRAPHICS') {
                    // Discount chart
                    const discountCtx = document.getElementById('discountChart');
                    if (discountCtx) {
                        const tiers = report.discountTierCounts || {};
                        const tierValues = Object.values(tiers).map(Number);
                        const maxTier = Math.max(1, ...tierValues);
                        new Chart(discountCtx, {
                            type: 'bar',
                            data: {
                                labels: Object.keys(tiers),
                                datasets: [{
                                    label: 'Players',
                                    data: tierValues,
                                    backgroundColor: 'rgba(139, 92, 246, 0.5)',
                                    borderColor: 'rgba(139, 92, 246, 1)',
                                    borderWidth: 1
                                }]
                            },
                            options: {
                                responsive: true,
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        suggestedMax: maxTier + 1,
                                        ticks: {
                                            color: '#94a3b8',
                                            precision: 0,
                                            stepSize: 1,
                                            callback: value => Number.isInteger(value) ? value.toString() : ''
                                        },
                                        grid: { color: '#374151' }
                                    },
                                    x: {
                                        ticks: { color: '#94a3b8' },
                                        grid: { color: '#374151' }
                                    }
                                },
                                plugins: {
                                    legend: { labels: { color: '#94a3b8' } }
                                }
                            }
                        });
                    }
                    // Age chart
                    const ageCtx = document.getElementById('ageChart');
                    if (ageCtx) {
                        const groups = report.ageGroupCounts || {};
                        const ageValues = Object.values(groups).map(Number);
                        const maxAgeValue = Math.max(1, ...ageValues);
                        new Chart(ageCtx, {
                            type: 'bar',
                            data: {
                                labels: Object.keys(groups),
                                datasets: [{
                                    label: 'Players',
                                    data: ageValues,
                                    backgroundColor: 'rgba(245, 158, 11, 0.5)',
                                    borderColor: 'rgba(245, 158, 11, 1)',
                                    borderWidth: 1
                                }]
                            },
                            options: {
                                responsive: true,
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        suggestedMax: maxAgeValue + 1,
                                        ticks: {
                                            color: '#94a3b8',
                                            precision: 0,
                                            stepSize: 1,
                                            callback: value => Number.isInteger(value) ? value.toString() : ''
                                        },
                                        grid: { color: '#374151' }
                                    },
                                    x: {
                                        ticks: { color: '#94a3b8' },
                                        grid: { color: '#374151' }
                                    }
                                },
                                plugins: {
                                    legend: { labels: { color: '#94a3b8' } }
                                }
                            }
                        });
                    }
                    // Managers chart
                    const managersCtx = document.getElementById('managersChart');
                    if (managersCtx) {
                        const totalPlayers = report.totalPlayers || 0;
                        const totalManagers = report.totalManagers || 0;
                        const regularPlayers = totalPlayers;
                        new Chart(managersCtx, {
                            type: 'doughnut',
                            data: {
                                labels: ['Managers', 'Players'],
                                datasets: [{
                                    data: [totalManagers, regularPlayers],
                                    backgroundColor: ['rgba(239, 68, 68, 0.8)', 'rgba(59, 130, 246, 0.8)'],
                                    borderColor: ['rgba(239, 68, 68, 1)', 'rgba(59, 130, 246, 1)'],
                                    borderWidth: 1
                                }]
                            },
                            options: {
                                responsive: true,
                                plugins: {
                                    legend: { labels: { color: '#94a3b8' } }
                                }
                            }
                        });
                    }
                }
            },

            downloadPDF() {
                try {
                    const pkg = window.jspdf || window.jsPDF;
                    const jsPDFCtor = typeof pkg === 'function'
                        ? pkg
                        : pkg?.jsPDF || pkg?.default || pkg?.jsPDF?.default;

                    if (!jsPDFCtor || typeof jsPDFCtor !== 'function') {
                        alert('Unable to generate PDF: jsPDF is not loaded.');
                        return;
                    }

                    const doc = new jsPDFCtor({ unit: 'pt', format: 'a4' });
                    const reportType = this.selectedReportType || 'REPORT';
                    const startDate = document.getElementById('reportStartDate').value || 'Start';
                    const endDate = document.getElementById('reportEndDate').value || 'End';
                    const content = document.getElementById('reportContent');

                    const title = reportType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    const margin = 40;
                    let y = 60;

                    const ensurePage = (height = 0) => {
                        if (y + height > 760) {
                            doc.addPage();
                            y = 60;
                        }
                    };

                    const addSectionTitle = (text) => {
                        doc.setFontSize(12);
                        doc.setTextColor(51, 65, 85);
                        doc.text(text, margin, y);
                        y += 20;
                    };

                    const addChartFromCanvas = (canvasId, label) => {
                        const canvas = document.getElementById(canvasId);
                        if (!canvas) return;
                        const imgData = canvas.toDataURL('image/png');
                        const imgWidth = 360;
                        const imgHeight = Math.round((canvas.height / canvas.width) * imgWidth);
                        const chartX = margin + (515 - imgWidth) / 2;
                        const blockHeight = imgHeight + 48; // title + spacing + divider
                        ensurePage(blockHeight + 12);
                        addSectionTitle(label);
                        try {
                            doc.addImage(imgData, 'PNG', chartX, y, imgWidth, imgHeight);
                            y += imgHeight + 14;
                            doc.setDrawColor(148, 163, 184);
                            doc.setLineWidth(0.4);
                            doc.line(margin, y, 555, y);
                            y += 18;
                        } catch (imageErr) {
                            console.warn(`Chart image export failed for ${canvasId}:`, imageErr);
                        }
                    };

                    // Header card
                    doc.setFillColor(15, 23, 42);
                    doc.roundedRect(margin, y - 20, 515, 60, 12, 12, 'F');
                    doc.setFontSize(22);
                    doc.setTextColor(255, 255, 255);
                    doc.text(title, margin + 14, y + 8);
                    doc.setFontSize(11);
                    doc.setTextColor(190, 199, 217);
                    doc.text(`Report period: ${startDate} · ${endDate}`, margin + 14, y + 28);
                    y += 80;

                    doc.setDrawColor(148, 163, 184);
                    doc.setLineWidth(0.6);
                    doc.line(margin, y, 555, y);
                    y += 24;

                    const summaryBlocks = Array.from(content.querySelectorAll('.grid > div')).filter(block => block.querySelector('.text-3xl')).slice(0, 6);
                    if (summaryBlocks.length) {
                        const cardWidth = 255;
                        const cardHeight = 78;
                        summaryBlocks.forEach((block, index) => {
                            const label = block.querySelector('.text-xs')?.textContent?.trim() || '';
                            const value = block.querySelector('.text-3xl')?.textContent?.trim() || '';
                            const x = margin + (index % 2) * (cardWidth + 10);
                            if (index % 2 === 0) {
                                ensurePage(cardHeight + 40);
                            }
                            doc.setFillColor(10, 44, 87);
                            doc.setDrawColor(56, 189, 248);
                            doc.roundedRect(x, y, cardWidth, cardHeight, 10, 10, 'F');
                            doc.setLineWidth(0.5);
                            doc.roundedRect(x, y, cardWidth, cardHeight, 10, 10, 'S');
                            doc.setFontSize(9);
                            doc.setTextColor(167, 196, 237);
                            doc.text(label.toUpperCase(), x + 14, y + 18);
                            doc.setFontSize(18);
                            doc.setTextColor(255, 255, 255);
                            doc.text(value, x + 14, y + 45);
                            if (index % 2 === 1) {
                                y += cardHeight + 14;
                            }
                        });
                        if (summaryBlocks.length % 2 !== 0) {
                            y += cardHeight + 14;
                        }
                        y += 10;
                    }

                    // Add chart images for the current report type
                    addChartFromCanvas('courtUtilizationChart', 'Court Utilization Chart');
                    addChartFromCanvas('revenueChart', 'Revenue Distribution');
                    addChartFromCanvas('revenueBreakdownChart', 'Revenue by Sport');
                    addChartFromCanvas('discountChart', 'Discount Tiers Chart');
                    addChartFromCanvas('ageChart', 'Age Groups Chart');
                    addChartFromCanvas('managersChart', 'Managers vs Players');

                    const sections = Array.from(content.querySelectorAll('.rounded-2xl')).filter(el => el.classList.contains('bg-slate-800/90') && !el.querySelector('canvas'));
                    sections.forEach(section => {
                        const heading = section.querySelector('p.text-sm');
                        if (!heading) return;
                        const sectionTitle = heading.textContent.trim();

                        const table = section.querySelector('table');
                        const rows = table ? Array.from(table.querySelectorAll('tr')) : [];
                        const paragraphs = Array.from(section.querySelectorAll('p:not(.text-xs):not(.text-sm)'));
                        let paragraphHeight = 0;
                        paragraphs.forEach(paragraph => {
                            const text = paragraph.textContent.trim();
                            if (!text) return;
                            paragraphHeight += doc.splitTextToSize(text, 520).length * 14;
                        });

                        const sectionHeight = 18 + (rows.length ? (rows.length * 18 + 10) : 0) + paragraphHeight + 14;
                        ensurePage(sectionHeight + 8);

                        doc.setFontSize(12);
                        doc.setTextColor(51, 65, 85);
                        doc.text(sectionTitle, margin, y);
                        y += 18;

                        if (table) {
                            rows.forEach((row, rowIndex) => {
                                ensurePage(20);
                                const cells = Array.from(row.querySelectorAll('th, td'));
                                let x = margin;
                                cells.forEach(cell => {
                                    const text = cell.textContent.trim();
                                    doc.setFontSize(rowIndex === 0 ? 10 : 9);
                                    doc.setTextColor(rowIndex === 0 ? 74 : 100, rowIndex === 0 ? 85 : 116, rowIndex === 0 ? 104 : 139);
                                    doc.text(text, x, y);
                                    x += 180;
                                });
                                y += 18;
                            });
                            y += 10;
                        }

                        paragraphs.forEach(paragraph => {
                            const text = paragraph.textContent.trim();
                            if (!text) return;
                            const lines = doc.splitTextToSize(text, 520);
                            ensurePage(lines.length * 14);
                            doc.setFontSize(10);
                            doc.setTextColor(100, 116, 139);
                            doc.text(lines, margin, y);
                            y += lines.length * 14;
                        });
                        y += 14;
                    });

                    if (this.selectedReportType === 'COURT_UTILIZATION' && _activeBookings.length) {
                        ensurePage(40);
                        doc.setFontSize(13);
                        doc.setTextColor(34, 211, 238);
                        doc.text('Active & Upcoming Bookings', margin, y);
                        y += 18;
                        const abHeaders = ['Court', 'Date', 'Time Slot', 'Player', 'Payment'];
                        const abColW = [110, 90, 100, 120, 80];
                        let ax = margin;
                        doc.setFontSize(9);
                        doc.setTextColor(100, 116, 139);
                        abHeaders.forEach((h, i) => { doc.text(h.toUpperCase(), ax, y); ax += abColW[i]; });
                        y += 14;
                        _activeBookings.forEach(b => {
                            ensurePage(18);
                            ax = margin;
                            doc.setFontSize(9);
                            doc.setTextColor(226, 232, 240);
                            [b.courtName, b.bookingDate, b.timeSlot, b.playerName, b.status === 'CONFIRMED' ? 'Paid' : 'Unpaid'].forEach((v, i) => {
                                doc.text(String(v || ''), ax, y);
                                ax += abColW[i];
                            });
                            y += 16;
                        });
                        y += 10;
                    }

                    ensurePage(24);
                    doc.setFontSize(9);
                    doc.setTextColor(148, 163, 184);
                    doc.text('Generated by Courtly Admin • Smart report with embedded charts', margin, 780);
                    const _pdfNameMap = {
                        COURT_UTILIZATION: 'Courtly_UtilizationReport',
                        REVENUE_SUMMARY:   'Courtly_RevenueReport',
                        USER_DEMOGRAPHICS: 'Courtly_DemographicsReport',
                    };
                    doc.save((_pdfNameMap[this.selectedReportType] || 'Courtly_Report') + '.pdf');
                    logReport(this.selectedReportType, {
                        startDate: document.getElementById('reportStartDate')?.value,
                        endDate:   document.getElementById('reportEndDate')?.value,
                        courtType: document.getElementById('reportCourtType')?.value }, 'PDF');
                } catch (err) {
                    console.error('PDF generation failed', err);
                    alert('PDF generation failed: ' + (err.message || err));
                }
            }
        };

        adminController.loadPendingDocs();
        adminController.loadPendingManagers();
        adminController.loadStats();
        adminController.loadDeletionRequests();
        adminController.loadArchivedAccounts();
        adminController.initReportPanel();

        // ── Disputed match results (FR-38) ───────────────────────────────────
        const _esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

        const disputesController = {
            async load() {
                const box = document.getElementById('disputesBody');
                if (!box) return;
                box.className = 'p-6 text-sm';
                try {
                    const res = await fetch(`${API_BASE}/api/matches/disputed`);
                    if (!res.ok) throw new Error();
                    const list = await res.json();
                    if (!list.length) {
                        box.innerHTML = '<div class="text-center py-6"><p class="text-4xl mb-3">✅</p><p class="text-slate-300 font-medium">No disputed results</p></div>';
                        return;
                    }
                    box.className = 'overflow-x-auto';
                    box.innerHTML = `<table class="w-full text-sm">
                        <thead><tr class="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-700">
                            <th class="px-6 py-3">Player</th><th class="px-6 py-3">Match</th><th class="px-6 py-3">Submitted</th>
                            <th class="px-6 py-3">Problem</th><th class="px-6 py-3">Final result</th>
                        </tr></thead>
                        <tbody class="divide-y divide-slate-700/50">
                        ${list.map(m => {
                            const id = _esc(m.matchID);
                            return `<tr id="dispute-${id}" class="hover:bg-slate-700/20">
                                <td class="px-6 py-4 text-slate-200">${_esc(m.playerName)}<br><span class="text-xs text-slate-500">vs ${_esc(m.opponentName)}</span></td>
                                <td class="px-6 py-4 text-slate-300 text-xs">${_esc(m.courtName)}<br>${_esc(m.bookingDate)} · ${_esc(m.timeSlot)}</td>
                                <td class="px-6 py-4 text-slate-300">${_esc(m.result)} ${_esc(m.playerScore)}-${_esc(m.opponentScore)}</td>
                                <td class="px-6 py-4 text-amber-300 text-xs max-w-xs">${_esc(m.disputeReason)}</td>
                                <td class="px-6 py-4">
                                    <div class="flex items-center gap-1.5">
                                        <input id="ps-${id}" type="number" min="0" max="999" value="${_esc(m.playerScore)}" class="w-14 bg-slate-900/60 border border-slate-600 rounded-md px-2 py-1 text-white text-xs text-center" title="Player score">
                                        <span class="text-slate-500">-</span>
                                        <input id="os-${id}" type="number" min="0" max="999" value="${_esc(m.opponentScore)}" class="w-14 bg-slate-900/60 border border-slate-600 rounded-md px-2 py-1 text-white text-xs text-center" title="Opponent score">
                                        <select id="res-${id}" class="bg-slate-900/60 border border-slate-600 rounded-md px-1 py-1 text-white text-xs">
                                            <option>WIN</option><option>DRAW</option><option>LOSS</option>
                                        </select>
                                        <button onclick="disputesController.resolve('${id}')"
                                            class="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-all active:scale-95">Resolve</button>
                                    </div>
                                    <p id="err-${id}" class="hidden text-xs text-rose-400 mt-1"></p>
                                </td>
                            </tr>`;
                        }).join('')}
                        </tbody></table>`;
                } catch {
                    box.innerHTML = '<p class="text-rose-400">Failed to load disputed results.</p>';
                }
            },

            async resolve(matchID) {
                const err = document.getElementById(`err-${matchID}`);
                err.classList.add('hidden');
                const body = {
                    playerScore:   Number(document.getElementById(`ps-${matchID}`).value),
                    opponentScore: Number(document.getElementById(`os-${matchID}`).value),
                    result:        document.getElementById(`res-${matchID}`).value
                };
                try {
                    const res = await fetch(`${API_BASE}/api/matches/${encodeURIComponent(matchID)}/resolve`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        err.textContent = apiErrorText(data, 'Could not resolve this result.');
                        err.classList.remove('hidden');
                        return;
                    }
                    showPopup(`Result set to ${data.result} ${data.playerScore}-${data.opponentScore}. ${data.pointsEarned} ranking point(s) awarded.`);
                    this.load();
                } catch {
                    err.textContent = 'Cannot connect to server.';
                    err.classList.remove('hidden');
                }
            }
        };

        // ── Notification e-mail delivery log (FR-43) ─────────────────────────
        const deliveryLogController = {
            async load() {
                const box = document.getElementById('deliveryLogBody');
                if (!box) return;
                box.className = 'p-6 text-sm';
                try {
                    const res = await fetch(`${API_BASE}/api/notifications/delivery-log?limit=15`);
                    if (!res.ok) throw new Error();
                    const { counts, entries } = await res.json();
                    const badge = { SENT: 'bg-emerald-900/50 text-emerald-300', QUEUED: 'bg-amber-900/50 text-amber-300', FAILED: 'bg-rose-900/50 text-rose-300' };
                    const tile = (label, n, cls) => `<div class="flex-1 bg-slate-900/40 border border-slate-700 rounded-xl p-4 text-center">
                        <p class="text-2xl font-bold ${cls}">${n ?? 0}</p><p class="text-xs text-slate-400 mt-1">${label}</p></div>`;
                    box.innerHTML = `
                        <div class="flex gap-3 mb-5">
                            ${tile('Sent', counts.SENT, 'text-emerald-300')}
                            ${tile('Queued for retry', counts.QUEUED, 'text-amber-300')}
                            ${tile('Failed (gave up)', counts.FAILED, 'text-rose-300')}
                        </div>
                        ${entries.length ? `<div class="overflow-x-auto"><table class="w-full text-xs">
                            <thead><tr class="text-left text-slate-400 uppercase tracking-wider border-b border-slate-700">
                                <th class="py-2 pr-4">When</th><th class="py-2 pr-4">Recipient</th><th class="py-2 pr-4">Notification</th>
                                <th class="py-2 pr-4">Status</th><th class="py-2 pr-4">Attempts</th><th class="py-2">Last error</th>
                            </tr></thead>
                            <tbody class="divide-y divide-slate-700/50">
                            ${entries.map(e => `<tr>
                                <td class="py-2 pr-4 text-slate-400 whitespace-nowrap">${e.createdAt ? new Date(e.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                <td class="py-2 pr-4 text-slate-300">${_esc(e.recipientEmail || e.userId)}</td>
                                <td class="py-2 pr-4 text-slate-200">${_esc(e.title)}</td>
                                <td class="py-2 pr-4"><span class="px-2 py-0.5 rounded-full font-medium ${badge[e.status] || ''}">${_esc(e.status)}</span></td>
                                <td class="py-2 pr-4 text-slate-300">${_esc(e.attempts)}</td>
                                <td class="py-2 text-slate-500">${_esc(e.lastError || '')}</td>
                            </tr>`).join('')}
                            </tbody></table></div>` : '<p class="text-slate-400">No notifications have been sent yet.</p>'}`;
                } catch {
                    box.innerHTML = '<p class="text-rose-400">Failed to load the delivery log.</p>';
                }
            }
        };

        // ── Report history (class diagram: SystemReport) ─────────────────────
        const reportHistoryController = {
            async load() {
                const box = document.getElementById('reportHistoryBody');
                if (!box) return;
                try {
                    const res = await fetch(`${ADMIN_API}/reports/history?limit=15`);
                    if (!res.ok) throw new Error();
                    const list = await res.json();
                    if (!list.length) { box.innerHTML = '<p class="text-slate-400 text-sm p-6">No reports generated yet.</p>'; return; }
                    const label = t => t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                    const fmt = { VIEW: 'bg-slate-700 text-slate-300', PDF: 'bg-rose-900/50 text-rose-300', CSV: 'bg-emerald-900/50 text-emerald-300' };
                    box.innerHTML = `<div class="overflow-x-auto"><table class="w-full text-xs">
                        <thead><tr class="text-left text-slate-400 uppercase tracking-wider border-b border-slate-700">
                            <th class="px-6 py-2">Generated</th><th class="px-6 py-2">Report</th><th class="px-6 py-2">Format</th><th class="px-6 py-2">Filters</th>
                        </tr></thead>
                        <tbody class="divide-y divide-slate-700/50">
                        ${list.map(r => {
                            let filters = '';
                            try { filters = Object.entries(JSON.parse(r.filters || '{}')).map(([k, v]) => `${k}: ${v}`).join(' · '); } catch {}
                            return `<tr>
                                <td class="px-6 py-2 text-slate-400 whitespace-nowrap">${r.generatedAt ? new Date(r.generatedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                <td class="px-6 py-2 text-slate-200">${_esc(label(r.reportType))}</td>
                                <td class="px-6 py-2"><span class="px-2 py-0.5 rounded-full font-medium ${fmt[r.exportFormat] || ''}">${_esc(r.exportFormat)}</span></td>
                                <td class="px-6 py-2 text-slate-500">${_esc(filters || '—')}</td>
                            </tr>`;
                        }).join('')}
                        </tbody></table></div>`;
                } catch {
                    box.innerHTML = '<p class="text-rose-400 text-sm p-6">Failed to load report history.</p>';
                }
            }
        };

        disputesController.load();
        deliveryLogController.load();
        reportHistoryController.load();



        // ── Facility Feedback Report Controller ──────────────────────────────

        const feedbackController = {
            _loaded: false,
            _distChart: null,
            _courtChart: null,
            _allData: [],
            _currentData: [],

            toggle() {
                const wasOpen = !document.getElementById('panel-feedback').classList.contains('hidden');
                closeAllReportPanels();
                if (!wasOpen) {
                    document.getElementById('panel-feedback').classList.remove('hidden');
                    document.getElementById('tab-feedback').className = 'flex flex-col items-center gap-2 p-4 bg-slate-700 border border-indigo-500 rounded-xl shadow ring-1 ring-indigo-500/30';
                    if (!this._loaded) this._load();
                }
            },

            async _load() {
                const loading = document.getElementById('fb-loading');
                const content = document.getElementById('fb-content');
                const empty   = document.getElementById('fb-empty');
                loading.classList.remove('hidden');
                content.classList.add('hidden');
                empty.classList.add('hidden');
                try {
                    const res = await fetch(RATING_API + '/all');
                    if (!res.ok) throw new Error(await res.text());
                    const data = await res.json();
                    this._loaded = true;
                    this._allData = data;
                    logReport('FACILITY_FEEDBACK', {}, 'VIEW');
                    loading.classList.add('hidden');
                    this._populateSports(data);
                    if (!data.length) { empty.classList.remove('hidden'); return; }
                    this._render(data);
                    content.classList.remove('hidden');
                } catch (e) {
                    loading.classList.add('hidden');
                    empty.innerHTML =
                        '<p class="text-4xl mb-3">⚠️</p>' +
                        '<p class="text-red-400 font-semibold">Failed to load feedback</p>' +
                        '<p class="text-slate-500 text-sm mt-1">' + e.message + '</p>';
                    empty.classList.remove('hidden');
                }
            },

            _populateSports(data) {
                var sel     = document.getElementById('fb-filter-sport');
                var current = sel.value;
                var sports  = data.map(function(r) { return r.sportType; })
                                  .filter(Boolean)
                                  .filter(function(v, i, a) { return a.indexOf(v) === i; })
                                  .sort();
                sel.innerHTML = '<option value="">All Sports</option>'
                    + sports.map(function(s) {
                        return '<option value="' + s + '"' + (s === current ? ' selected' : '') + '>' + s + '</option>';
                    }).join('');
            },

            _applyFilters() {
                var sport = document.getElementById('fb-filter-sport').value;
                var from  = document.getElementById('fb-filter-from').value;
                var to    = document.getElementById('fb-filter-to').value;
                if (from && to && from >= to) { showPopup('"From" date must be before the "To" date.'); return; }
                var data  = this._allData.slice();
                if (sport) data = data.filter(function(r) { return r.sportType === sport; });
                if (from)  data = data.filter(function(r) { return r.bookingDate && r.bookingDate >= from; });
                if (to)    data = data.filter(function(r) { return r.bookingDate && r.bookingDate <= to; });

                var empty   = document.getElementById('fb-empty');
                var content = document.getElementById('fb-content');
                if (!data.length) {
                    content.classList.add('hidden');
                    empty.innerHTML = '<p class="text-5xl mb-4">🔍</p>'
                        + '<p class="text-slate-300 font-semibold text-base">No reviews match the selected filters</p>'
                        + '<p class="text-slate-500 text-sm mt-1">Try adjusting or clearing the filters.</p>';
                    empty.classList.remove('hidden');
                    return;
                }
                empty.classList.add('hidden');
                this._render(data);
                content.classList.remove('hidden');
            },

            _clearFilters() {
                document.getElementById('fb-filter-sport').value = '';
                document.getElementById('fb-filter-from').value  = '';
                document.getElementById('fb-filter-to').value    = '';
                var empty   = document.getElementById('fb-empty');
                var content = document.getElementById('fb-content');
                if (!this._allData.length) {
                    content.classList.add('hidden');
                    empty.innerHTML = '<p class="text-5xl mb-4">💬</p>'
                        + '<p class="text-slate-300 font-semibold text-base">No reviews yet</p>'
                        + '<p class="text-slate-500 text-sm mt-1">Facility ratings will appear here once players submit feedback after their sessions.</p>';
                    empty.classList.remove('hidden');
                    return;
                }
                empty.classList.add('hidden');
                this._render(this._allData);
                content.classList.remove('hidden');
            },

            _render(data) {
                this._currentData = data;
                this._renderSummary(data);
                this._renderCharts(data);
                this._renderReviews(data);
            },

            _exportPDF() {
                var data = this._currentData.length ? this._currentData : this._allData;
                if (!data.length) { alert('No data to export.'); return; }

                var jsPDF = window.jspdf.jsPDF;
                var doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                var pageW = doc.internal.pageSize.getWidth();
                var pageH = doc.internal.pageSize.getHeight();
                var M     = 14;
                var y     = 0;

                // ── Star polygon helper ───────────────────────────────────────
                function drawStar(cx, cy, r) {
                    var pts = [];
                    for (var i = 0; i < 10; i++) {
                        var angle  = (i * Math.PI * 2 / 10) - Math.PI / 2;
                        var radius = (i % 2 === 0) ? r : r * 0.42;
                        pts.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
                    }
                    var segs = [];
                    for (var j = 1; j < pts.length; j++) {
                        segs.push([pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]]);
                    }
                    doc.lines(segs, pts[0][0], pts[0][1], [1, 1], 'F', true);
                }

                function drawStarRow(x, y, score, r) {
                    for (var i = 0; i < 5; i++) {
                        doc.setFillColor(i < score ? 251 : 70, i < score ? 191 : 65, i < score ? 36 : 100);
                        drawStar(x + i * r * 2.7 + r, y, r);
                    }
                }

                // ── Header banner ─────────────────────────────────────────────
                doc.setFillColor(55, 48, 163);
                doc.rect(0, 0, pageW, 34, 'F');
                doc.setFillColor(139, 92, 246);
                doc.rect(0, 30, pageW, 4, 'F');

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(22);
                doc.setTextColor(255, 255, 255);
                doc.text('Courtly', M, 16);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(196, 181, 253);
                doc.text('Facility Feedback Report', M, 26);
                var dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                doc.text(dateStr, pageW - M, 26, { align: 'right' });
                y = 44;

                // ── Active filters badge ──────────────────────────────────────
                var sport = document.getElementById('fb-filter-sport').value;
                var from  = document.getElementById('fb-filter-from').value;
                var to    = document.getElementById('fb-filter-to').value;
                var parts = [];
                if (sport) parts.push('Sport: ' + sport);
                if (from)  parts.push('From: ' + from);
                if (to)    parts.push('To: ' + to);
                if (parts.length) {
                    doc.setFillColor(38, 33, 78);
                    doc.roundedRect(M, y - 5, pageW - M * 2, 11, 2, 2, 'F');
                    doc.setFillColor(139, 92, 246);
                    doc.roundedRect(M, y - 5, 2, 11, 1, 1, 'F');
                    doc.setFontSize(8.5);
                    doc.setTextColor(167, 139, 250);
                    doc.text('Filters: ' + parts.join('   |   '), M + 5, y + 1);
                    y += 14;
                }

                // ── Stat boxes ────────────────────────────────────────────────
                var total    = data.length;
                var sum      = data.reduce(function(s, r) { return s + r.ratingScore; }, 0);
                var avgNum   = sum / total;
                var posPct   = Math.round(data.filter(function(r) { return r.ratingScore >= 4; }).length * 100 / total);
                var boxW     = (pageW - M * 2 - 10) / 3;
                var boxH     = 30;

                var statsArr = [
                    { label: 'TOTAL REVIEWS',    value: String(total),           accent: [99, 102, 241], vrgb: [255, 255, 255], sub: null },
                    { label: 'AVERAGE RATING',   value: avgNum.toFixed(1) + '/5', accent: [234, 179, 8],  vrgb: [251, 191, 36],  sub: avgNum },
                    { label: '4-5 STAR REVIEWS', value: posPct + '%',            accent: [20, 184, 166], vrgb: [45, 212, 191],  sub: null }
                ];
                statsArr.forEach(function(stat, i) {
                    var bx = M + i * (boxW + 5);
                    doc.setFillColor(20, 18, 40);
                    doc.roundedRect(bx, y, boxW, boxH, 3, 3, 'F');
                    doc.setFillColor(stat.accent[0], stat.accent[1], stat.accent[2]);
                    doc.roundedRect(bx, y, boxW, 2.5, 1, 1, 'F');
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(16);
                    doc.setTextColor(stat.vrgb[0], stat.vrgb[1], stat.vrgb[2]);
                    doc.text(stat.value, bx + boxW / 2, y + 14, { align: 'center' });
                    // Mini star row under average rating value
                    if (stat.sub !== null) {
                        var sr = 1.1;
                        var sw = 5 * sr * 2.7;
                        drawStarRow(bx + (boxW - sw) / 2, y + 20, Math.round(stat.sub), sr);
                        y += 0; // stars fit within boxH
                    }
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(6.5);
                    doc.setTextColor(130, 125, 160);
                    doc.text(stat.label, bx + boxW / 2, y + boxH - 4, { align: 'center' });
                });
                y += boxH + 9;

                // ── Charts ────────────────────────────────────────────────────
                try {
                    var chartW = (pageW - M * 2 - 8) / 2;
                    var chartH = 64;

                    doc.setFillColor(16, 14, 32);
                    doc.roundedRect(M,              y, chartW,      chartH + 8, 3, 3, 'F');
                    doc.roundedRect(M + chartW + 8, y, chartW,      chartH + 8, 3, 3, 'F');

                    if (this._distChart) {
                        doc.addImage(this._distChart.toBase64Image('image/png', 1),  'PNG', M + 2,              y + 2, chartW - 4, chartH);
                    }
                    if (this._courtChart) {
                        doc.addImage(this._courtChart.toBase64Image('image/png', 1), 'PNG', M + chartW + 10,    y + 2, chartW - 4, chartH);
                    }

                    doc.setFontSize(7.5);
                    doc.setTextColor(110, 105, 145);
                    doc.text('Rating Distribution',     M + chartW / 2,              y + chartH + 6, { align: 'center' });
                    doc.text('Average Rating by Court', M + chartW + 8 + chartW / 2, y + chartH + 6, { align: 'center' });
                    y += chartH + 14;
                } catch (e) { /* charts not ready */ }

                // ── Reviews table ─────────────────────────────────────────────
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.setTextColor(167, 139, 250);
                doc.text('Written Reviews', M, y);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8.5);
                doc.setTextColor(100, 95, 130);
                doc.text(data.length + ' total', pageW - M, y, { align: 'right' });
                y += 5;

                var tableRows = data.map(function(r) {
                    return [
                        r.courtName   || 'Unknown',
                        r.sportType   || '—',
                        r.bookingDate || '—',
                        r.ratingScore || 0,
                        r.feedbackText || '—'
                    ];
                });

                doc.autoTable({
                    startY: y,
                    head: [['Court', 'Sport', 'Date', 'Rating', 'Feedback']],
                    body: tableRows,
                    margin: { left: M, right: M },
                    styles: {
                        fontSize: 8,
                        cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
                        textColor: [210, 205, 235],
                        fillColor: [20, 18, 38],
                        lineColor: [48, 42, 78],
                        lineWidth: 0.2
                    },
                    headStyles: {
                        fillColor: [55, 48, 163],
                        textColor: [255, 255, 255],
                        fontStyle: 'bold',
                        fontSize: 8.5
                    },
                    alternateRowStyles: { fillColor: [28, 25, 50] },
                    columnStyles: {
                        0: { cellWidth: 30 },
                        1: { cellWidth: 26 },
                        2: { cellWidth: 24 },
                        3: { cellWidth: 34 },
                        4: { cellWidth: 'auto' }
                    },
                    willDrawCell: function(hookData) {
                        if (hookData.section === 'body' && hookData.column.index === 3) {
                            hookData.cell.text = [''];
                        }
                    },
                    didDrawCell: function(hookData) {
                        if (hookData.section === 'body' && hookData.column.index === 3) {
                            var score = parseInt(hookData.cell.raw) || 0;
                            var cx    = hookData.cell.x + 3;
                            var cy    = hookData.cell.y + hookData.cell.height / 2;
                            var r     = 1.35;
                            for (var si = 0; si < 5; si++) {
                                var filled = si < score;
                                doc.setFillColor(filled ? 251 : 72, filled ? 191 : 68, filled ? 36 : 100);
                                var pts = [];
                                for (var pi = 0; pi < 10; pi++) {
                                    var ang = (pi * Math.PI * 2 / 10) - Math.PI / 2;
                                    var rad = (pi % 2 === 0) ? r : r * 0.42;
                                    pts.push([cx + si * r * 2.7 + r + rad * Math.cos(ang),
                                              cy + rad * Math.sin(ang)]);
                                }
                                var segs = [];
                                for (var qi = 1; qi < pts.length; qi++) {
                                    segs.push([pts[qi][0] - pts[qi - 1][0], pts[qi][1] - pts[qi - 1][1]]);
                                }
                                doc.lines(segs, pts[0][0], pts[0][1], [1, 1], 'F', true);
                            }
                            doc.setFont('helvetica', 'normal');
                            doc.setFontSize(7.5);
                            doc.setTextColor(160, 155, 190);
                            doc.text('(' + score + ')', cx + 5 * r * 2.7 + 1, cy + 1.2);
                        }
                    }
                });

                // ── Footer on every page ──────────────────────────────────────
                var pageCount = doc.internal.getNumberOfPages();
                for (var p = 1; p <= pageCount; p++) {
                    doc.setPage(p);
                    doc.setFillColor(18, 16, 36);
                    doc.rect(0, pageH - 11, pageW, 11, 'F');
                    doc.setFontSize(7);
                    doc.setTextColor(85, 80, 118);
                    doc.text('Courtly  •  Facility Feedback Report  •  Confidential', M, pageH - 4);
                    doc.text('Page ' + p + ' of ' + pageCount, pageW - M, pageH - 4, { align: 'right' });
                }

                var sportPart = sport ? '_' + sport.replace(/\s+/g, '-') : '';
                var datePart  = (from || to) ? '_' + (from || '') + (to ? '_to_' + to : '') : '';
                doc.save('Courtly_FeedbackReport' + sportPart + datePart + '.pdf');
                logReport('FACILITY_FEEDBACK', {}, 'PDF');
            },

            _renderSummary(data) {
                const total    = data.length;
                const avg      = data.reduce(function(s, r) { return s + r.ratingScore; }, 0) / total;
                const positive = data.filter(function(r) { return r.ratingScore >= 4; }).length;
                document.getElementById('fb-total').textContent    = total;
                document.getElementById('fb-avg').textContent      = avg.toFixed(1) + ' ★';
                document.getElementById('fb-positive').textContent = Math.round(positive * 100 / total) + '%';
            },

            _renderCharts(data) {
                // Rating distribution doughnut
                var dist = [0, 0, 0, 0, 0];
                data.forEach(function(r) {
                    if (r.ratingScore >= 1 && r.ratingScore <= 5) dist[r.ratingScore - 1]++;
                });
                if (this._distChart) this._distChart.destroy();
                this._distChart = new Chart(document.getElementById('fb-chart-dist'), {
                    type: 'doughnut',
                    data: {
                        labels: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'],
                        datasets: [{
                            data: dist,
                            backgroundColor: ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'],
                            borderWidth: 0,
                            hoverOffset: 10
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 14, padding: 10 }
                            }
                        }
                    }
                });

                // Court-wise average horizontal bar
                var courtMap = {};
                data.forEach(function(r) {
                    var k = r.courtName || 'Unknown';
                    if (!courtMap[k]) courtMap[k] = { total: 0, count: 0 };
                    courtMap[k].total += r.ratingScore;
                    courtMap[k].count++;
                });
                var courts = Object.keys(courtMap);
                var avgs   = courts.map(function(c) {
                    return parseFloat((courtMap[c].total / courtMap[c].count).toFixed(1));
                });
                if (this._courtChart) this._courtChart.destroy();
                this._courtChart = new Chart(document.getElementById('fb-chart-court'), {
                    type: 'bar',
                    data: {
                        labels: courts,
                        datasets: [{
                            label: 'Avg Rating',
                            data: avgs,
                            backgroundColor: 'rgba(139,92,246,0.65)',
                            borderColor: '#8b5cf6',
                            borderWidth: 1,
                            borderRadius: 5
                        }]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: {
                                min: 0, max: 5,
                                ticks: { color: '#64748b', stepSize: 1 },
                                grid: { color: 'rgba(100,116,139,0.15)' }
                            },
                            y: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                        },
                        plugins: { legend: { display: false } }
                    }
                });
            },

            _renderReviews(data) {
                var recent = data.slice().sort(function(a, b) {
                    return new Date(b.submittedAt) - new Date(a.submittedAt);
                }).slice(0, 20);

                document.getElementById('fb-reviews-count').textContent =
                    'Showing ' + recent.length + ' of ' + data.length + ' reviews';

                document.getElementById('fb-reviews').innerHTML = recent.map(function(r) {
                    var score   = r.ratingScore || 0;
                    var filled  = '★'.repeat(score);
                    var hollow  = '☆'.repeat(5 - score);
                    var starCls = score >= 4 ? 'text-amber-400' : (score === 3 ? 'text-yellow-500' : 'text-red-400');
                    var review  = r.feedbackText
                        ? '<p class="text-slate-300 text-sm mt-2 leading-relaxed italic">&ldquo;' + r.feedbackText + '&rdquo;</p>'
                        : '<p class="text-slate-600 text-xs mt-2 italic">No written feedback</p>';
                    return '<div class="bg-slate-900/50 border border-slate-700/40 rounded-xl p-4">'
                        + '<div class="flex items-start justify-between gap-3">'
                        + '<div class="flex-1 min-w-0">'
                        + '<div class="flex flex-wrap items-center gap-2 mb-1.5">'
                        + '<span class="text-sm font-semibold text-white">' + (r.courtName || 'Unknown Court') + '</span>'
                        + (r.sportType ? '<span class="px-2 py-0.5 bg-slate-700/70 text-slate-400 text-xs rounded-full">' + r.sportType + '</span>' : '')
                        + '</div>'
                        + '<p class="' + starCls + ' text-base tracking-widest">' + filled + hollow + '</p>'
                        + review
                        + '</div>'
                        + '<p class="text-xs text-slate-500 shrink-0 pt-0.5">' + (r.bookingDate || '') + '</p>'
                        + '</div></div>';
                }).join('');
            }
        };

        // ═══════════════ Rankings Controller (UC-15) ═══════════════
        const rankingsController = {
            _data: [],

            toggle() {
                const wasOpen = !document.getElementById('panel-rankings').classList.contains('hidden');
                closeAllReportPanels();
                if (!wasOpen) {
                    document.getElementById('panel-rankings').classList.remove('hidden');
                    document.getElementById('tab-rankings').className = 'flex flex-col items-center gap-2 p-4 bg-slate-700 border border-indigo-500 rounded-xl shadow ring-1 ring-indigo-500/30';
                }
            },

            async generate() {
                const sport  = document.getElementById('rk-sport').value.trim();
                const from   = document.getElementById('rk-from').value;
                const to     = document.getElementById('rk-to').value;
                const minRaw = document.getElementById('rk-min-matches').value;
                const minM   = minRaw ? parseInt(minRaw, 10) : 0;
                const errEl  = document.getElementById('rk-error');

                // Validate date range
                if (from && to && from > to) {
                    errEl.textContent = 'From date cannot be after To date.';
                    errEl.classList.remove('hidden');
                    return;
                }
                errEl.classList.add('hidden');

                this._setState('loading');

                try {
                    const baseUrl = typeof MATCH_API !== 'undefined' ? MATCH_API : `${API_BASE}/api/matches`;
                    let url = baseUrl + '/rankings';
                    const params = new URLSearchParams();
                    if (sport) params.set('sportType', sport);
                    if (from)  params.set('dateFrom', from);
                    if (to)    params.set('dateTo', to);
                    const qs = params.toString();
                    if (qs) url += '?' + qs;

                    const res = await fetch(url);
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({ error: res.statusText }));
                        throw new Error(err.error || res.statusText);
                    }
                    let data = await res.json();

                    // Client-side min matches filter
                    if (minM > 0) data = data.filter(r => r.matches >= minM);

                    // Re-rank after filter
                    data.forEach((r, i) => r.rank = i + 1);

                    this._data = data;
                    this._render(data);
                } catch (e) {
                    errEl.textContent = 'Failed to load rankings: ' + e.message;
                    errEl.classList.remove('hidden');
                    this._setState('prompt');
                }
            },

            reset() {
                document.getElementById('rk-sport').value = '';
                document.getElementById('rk-from').value  = '';
                document.getElementById('rk-to').value    = '';
                document.getElementById('rk-min-matches').value = '';
                document.getElementById('rk-error').classList.add('hidden');
                this._data = [];
                this._setState('prompt');
            },

            _setState(state) {
                ['rk-prompt', 'rk-loading', 'rk-content', 'rk-empty'].forEach(id => {
                    document.getElementById(id).classList.add('hidden');
                });
                document.getElementById(
                    state === 'loading' ? 'rk-loading' :
                    state === 'content' ? 'rk-content' :
                    state === 'empty'   ? 'rk-empty'   : 'rk-prompt'
                ).classList.remove('hidden');
            },

            _render(data) {
                if (!data || data.length === 0) {
                    this._setState('empty');
                    return;
                }

                // Summary cards
                const totalMatches = data.reduce((s, r) => s + r.matches, 0);
                document.getElementById('rk-stat-players').textContent = data.length;
                document.getElementById('rk-stat-matches').textContent = totalMatches;

                // Top sport by match count
                const sportCounts = {};
                data.forEach(r => {
                    if (r.sportType && r.sportType !== '—') {
                        sportCounts[r.sportType] = (sportCounts[r.sportType] || 0) + r.matches;
                    }
                });
                const topSport = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])[0];
                document.getElementById('rk-stat-sport').textContent = topSport ? topSport[0] : '—';

                // Table rows
                const medals = ['🥇', '🥈', '🥉'];
                document.getElementById('rk-tbody').innerHTML = data.map(r => {
                    const medal   = r.rank <= 3 ? medals[r.rank - 1] : '';
                    const rankDisp = medal
                        ? `<span class="mr-1">${medal}</span><span class="text-slate-300">#${r.rank}</span>`
                        : `<span class="text-slate-400">#${r.rank}</span>`;
                    const winRate  = typeof r.winRate === 'number' ? r.winRate.toFixed(1) + '%' : '—';
                    const ptColor  = r.rank === 1 ? 'text-amber-300 font-bold' : r.rank <= 3 ? 'text-amber-400' : 'text-white';
                    return `<tr class="hover:bg-slate-700/20 transition-colors">
                        <td class="py-3 pr-4">${rankDisp}</td>
                        <td class="py-3 pr-4">
                            <p class="text-white font-medium text-sm">${r.playerName || r.playerID}</p>
                            <p class="text-slate-500 text-xs font-mono">${r.playerID}</p>
                        </td>
                        <td class="py-3 pr-4 text-slate-300 text-sm">${r.sportType || '—'}</td>
                        <td class="py-3 pr-4 text-center">
                            <span class="px-2 py-0.5 bg-emerald-900/60 text-emerald-400 text-xs font-semibold rounded-full">${r.wins}</span>
                        </td>
                        <td class="py-3 pr-4 text-center">
                            <span class="px-2 py-0.5 bg-red-900/60 text-red-400 text-xs font-semibold rounded-full">${r.losses}</span>
                        </td>
                        <td class="py-3 pr-4 text-center">
                            <span class="px-2 py-0.5 bg-slate-700/80 text-slate-300 text-xs font-semibold rounded-full">${r.draws}</span>
                        </td>
                        <td class="py-3 pr-4 text-center text-slate-300 text-sm">${r.matches}</td>
                        <td class="py-3 pr-4 text-center text-sm ${ptColor}">${r.points}</td>
                        <td class="py-3 text-center text-sm text-slate-300">${winRate}</td>
                    </tr>`;
                }).join('');

                this._setState('content');
            },

            exportCSV() {
                if (!this._data.length) return;
                const headers = ['Rank','Player Name','Player ID','Sport','Wins','Losses','Draws','Matches','Points','Win Rate (%)'];
                const rows = this._data.map(r => [
                    r.rank, r.playerName || r.playerID, r.playerID,
                    r.sportType || '', r.wins, r.losses, r.draws,
                    r.matches, r.points,
                    typeof r.winRate === 'number' ? r.winRate.toFixed(1) : ''
                ]);
                const csv = [headers, ...rows].map(row =>
                    row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')
                ).join('\r\n');

                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href     = url;
                a.download = 'Courtly_RankingsReport.csv';
                a.click();
                logReport('PLAYER_RANKINGS', {}, 'CSV');
                URL.revokeObjectURL(url);
            },

            exportPDF() {
                if (!this._data.length) return;
                const { jsPDF } = window.jspdf;
                const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                const pageW = doc.internal.pageSize.getWidth();
                const pageH = doc.internal.pageSize.getHeight();
                const M     = 14;

                // ── Background ────────────────────────────────────────────────
                doc.setFillColor(12, 10, 26);
                doc.rect(0, 0, pageW, pageH, 'F');

                // ── Header bar ────────────────────────────────────────────────
                doc.setFillColor(30, 27, 75);
                doc.rect(0, 0, pageW, 22, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.setTextColor(250, 204, 21);
                doc.text('Courtly', M, 14);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(200, 195, 230);
                doc.text('Player Rankings Report', M + 44, 14);

                // Right-side meta
                const sport  = document.getElementById('rk-sport').value || 'All Sports';
                const from   = document.getElementById('rk-from').value  || '—';
                const to     = document.getElementById('rk-to').value    || '—';
                const minM   = document.getElementById('rk-min-matches').value || 'Any';
                doc.setFontSize(7.5);
                doc.setTextColor(140, 135, 175);
                doc.text('Sport: ' + sport, pageW - M, 8,  { align: 'right' });
                doc.text('Date: ' + from + ' to ' + to, pageW - M, 13, { align: 'right' });
                doc.text('Min Matches: ' + minM + '   |   Generated: ' + new Date().toLocaleDateString('en-PK'), pageW - M, 18, { align: 'right' });

                // ── Summary cards ─────────────────────────────────────────────
                let cy = 30;
                const cardW = (pageW - M * 2 - 8) / 3;
                const cards = [
                    { label: 'Players Ranked', value: String(this._data.length),      color: [255, 255, 255] },
                    { label: 'Total Matches',  value: String(this._data.reduce((s,r)=>s+r.matches,0)), color: [251, 191, 36] },
                    { label: 'Top Sport',      value: document.getElementById('rk-stat-sport').textContent, color: [45, 212, 191] }
                ];
                cards.forEach((c, i) => {
                    const cx = M + i * (cardW + 4);
                    doc.setFillColor(22, 20, 50);
                    doc.roundedRect(cx, cy, cardW, 16, 2, 2, 'F');
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(12);
                    doc.setTextColor(...c.color);
                    doc.text(c.value, cx + cardW / 2, cy + 7.5, { align: 'center' });
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(6.5);
                    doc.setTextColor(100, 95, 140);
                    doc.text(c.label.toUpperCase(), cx + cardW / 2, cy + 13, { align: 'center' });
                });

                // ── Table ─────────────────────────────────────────────────────
                const tableTop = cy + 22;
                const tableRows = this._data.map(r => [
                    '#' + r.rank,
                    r.playerName || r.playerID,
                    r.playerID,
                    r.sportType || '—',
                    r.wins,
                    r.losses,
                    r.draws,
                    r.matches,
                    r.points,
                    (typeof r.winRate === 'number' ? r.winRate.toFixed(1) : '0.0') + '%'
                ]);

                doc.autoTable({
                    startY: tableTop,
                    margin: { left: M, right: M },
                    head: [['Rank', 'Player Name', 'Player ID', 'Sport', 'W', 'L', 'D', 'Matches', 'Points', 'Win Rate']],
                    body: tableRows,
                    theme: 'plain',
                    styles: {
                        font: 'helvetica',
                        fontSize: 8,
                        textColor: [200, 195, 230],
                        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
                        fillColor: [18, 16, 40],
                        lineColor: [48, 42, 78],
                        lineWidth: 0.2
                    },
                    headStyles: {
                        fillColor: [92, 60, 15],
                        textColor: [251, 191, 36],
                        fontStyle: 'bold',
                        fontSize: 8.5
                    },
                    alternateRowStyles: { fillColor: [24, 22, 50] },
                    columnStyles: {
                        0: { cellWidth: 14, halign: 'center' },
                        1: { cellWidth: 40 },
                        2: { cellWidth: 30, textColor: [100, 95, 140] },
                        3: { cellWidth: 26 },
                        4: { cellWidth: 12, halign: 'center', textColor: [52, 211, 153] },
                        5: { cellWidth: 12, halign: 'center', textColor: [248, 113, 113] },
                        6: { cellWidth: 12, halign: 'center', textColor: [148, 163, 184] },
                        7: { cellWidth: 18, halign: 'center' },
                        8: { cellWidth: 18, halign: 'center', textColor: [251, 191, 36] },
                        9: { cellWidth: 'auto', halign: 'center' }
                    },
                    didDrawCell(hookData) {
                        // Gold color for rank 1-3 in rank column
                        if (hookData.section === 'body' && hookData.column.index === 0) {
                            const rank = parseInt(String(hookData.cell.raw).replace('#', '')) || 0;
                            if (rank <= 3) {
                                hookData.doc.setFont('helvetica', 'bold');
                                hookData.doc.setFontSize(8);
                                hookData.doc.setTextColor(rank === 1 ? 251 : rank === 2 ? 209 : 180,
                                                          rank === 1 ? 191 : rank === 2 ? 213 : 160,
                                                          rank === 1 ? 36  : rank === 2 ? 84  : 100);
                                hookData.doc.text(
                                    hookData.cell.raw,
                                    hookData.cell.x + hookData.cell.width / 2,
                                    hookData.cell.y + hookData.cell.height / 2 + 1.2,
                                    { align: 'center' }
                                );
                            }
                        }
                    }
                });

                // ── Footer ────────────────────────────────────────────────────
                const pageCount = doc.internal.getNumberOfPages();
                for (let p = 1; p <= pageCount; p++) {
                    doc.setPage(p);
                    doc.setFillColor(18, 16, 36);
                    doc.rect(0, pageH - 11, pageW, 11, 'F');
                    doc.setFontSize(7);
                    doc.setTextColor(85, 80, 118);
                    doc.text('Courtly  •  Player Rankings Report  •  Confidential', M, pageH - 4);
                    doc.text('Page ' + p + ' of ' + pageCount, pageW - M, pageH - 4, { align: 'right' });
                }

                doc.save('Courtly_RankingsReport.pdf');
                logReport('PLAYER_RANKINGS', {}, 'PDF');
            }
        };
